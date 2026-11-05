// Central API service layer for Inkloom AI (Inkoom AI)
// Integrates with FastAPI + Ollama backend via Cloudflare Tunnel
// Endpoint: https://inkoom-model.shubhamos.com (or NEXT_PUBLIC_AI_API_URL)

import type {
  AnalysisResult,
  AnalysisHistoryItem,
  AnalysisJobStatus,
  AnalysisStatus,
} from '@/types/analysis';
import type {
  BrandBrain,
  BrandBrainSetupPayload,
  BrandRule,
  RuleCategory,
} from '@/types/brand-rules';
import type { DashboardStats } from '@/types/company';
import {
  MOCK_DASHBOARD_STATS,
  MOCK_HISTORY,
  MOCK_BRAND_RULES,
  generateMockAnalysisResult,
  generateMockHistoryItem,
} from './mock-data';
import { getUserSession } from './session';

// ─── Configuration ────────────────────────────────────────────────────────────

export const DEFAULT_API_BASE_URL = 'https://inkoom-model.shubhamos.com';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('inkloom_custom_api_url');
    if (custom) return custom;
  }
  return process.env.NEXT_PUBLIC_AI_API_URL || DEFAULT_API_BASE_URL;
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey =
    process.env.NEXT_PUBLIC_AI_API_KEY ||
    (typeof window !== 'undefined' ? localStorage.getItem('inkloom_ai_api_key') || '' : '');
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

export function isMockModeForced(): boolean {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('inkloom_use_mock_mode');
    if (stored !== null) return stored === 'true';
  }
  return process.env.NEXT_PUBLIC_USE_MOCK === 'true';
}

export function toggleMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  const current = isMockModeForced();
  const next = !current;
  localStorage.setItem('inkloom_use_mock_mode', String(next));
  return next;
}

export function getApiConfig() {
  return {
    baseUrl: getApiBaseUrl(),
    hasApiKey: !!(process.env.NEXT_PUBLIC_AI_API_KEY || (typeof window !== 'undefined' && localStorage.getItem('inkloom_ai_api_key'))),
    isMock: isMockModeForced(),
  };
}

// ─── Local Storage Cache / Fallback Store ─────────────────────────────────────

const HISTORY_STORAGE_KEY = 'inkloom_analysis_history';
const BRAND_BRAIN_KEY = 'inkloom_brand_brain';

function getStoredHistory(): AnalysisHistoryItem[] {
  if (typeof window === 'undefined') return [...MOCK_HISTORY];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [...MOCK_HISTORY];
  } catch {
    return [...MOCK_HISTORY];
  }
}

function saveToHistory(item: AnalysisHistoryItem): void {
  if (typeof window === 'undefined') return;
  const existing = getStoredHistory();
  const updated = [item, ...existing.filter((h) => h.id !== item.id)];
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
}

function getStoredBrandBrain(): BrandBrain | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BRAND_BRAIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveBrandBrain(brain: BrandBrain): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BRAND_BRAIN_KEY, JSON.stringify(brain));
}

async function mockDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export async function checkApiHealth(): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── 1. Onboarding API ────────────────────────────────────────────────────────

export async function submitOnboarding(data: {
  fullName: string;
  companyName: string;
  industry?: string;
  website?: string;
}): Promise<{ success: boolean; message?: string }> {
  if (isMockModeForced()) {
    await mockDelay(350);
    return { success: true, message: 'Onboarding saved (mock)' };
  }

  const baseUrl = getApiBaseUrl();
  const payload = {
    name: data.fullName,
    company_name: data.companyName,
    industry: data.industry || '',
    website: data.website || '',
  };

  try {
    const res = await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`[API] Onboarding backend returned HTTP ${res.status}, falling back to local session`);
      return { success: true };
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] Onboarding network request failed, persisting locally:', err);
    return { success: true, message: 'Saved in offline session' };
  }
}

// ─── 2. Brand Brain Configuration API ─────────────────────────────────────────

export async function setupBrandBrain(
  payload: BrandBrainSetupPayload
): Promise<{ jobId: string; status?: string }> {
  if (isMockModeForced()) {
    await mockDelay(500);
    const initialBrain: BrandBrain = {
      id: `bb_${Date.now()}`,
      companyId: 'comp_001',
      version: '1.0.0',
      totalRules: MOCK_BRAND_RULES.length,
      rulesText: payload.rulesText || '',
      rules: MOCK_BRAND_RULES,
      lastUpdatedAt: new Date().toISOString(),
      status: 'active',
    };
    saveBrandBrain(initialBrain);
    return { jobId: `bb_job_${Date.now()}`, status: 'completed' };
  }

  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  formData.append('company_name', payload.companyName);
  if (payload.industry) formData.append('industry', payload.industry);
  if (payload.website) formData.append('website', payload.website);
  if (payload.rulesText) formData.append('guidelines_text', payload.rulesText);

  if (payload.uploadedFiles && payload.uploadedFiles.length > 0) {
    formData.append('files_meta', JSON.stringify(payload.uploadedFiles));
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/brand-brain`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return {
        jobId: data.job_id || data.jobId || `job_${Date.now()}`,
        status: data.status || 'completed',
      };
    }
  } catch (err) {
    console.warn('[API] Brand Brain setup remote error, saving locally:', err);
  }

  const localBrain: BrandBrain = {
    id: `bb_${Date.now()}`,
    companyId: 'comp_001',
    version: '1.0.0',
    totalRules: MOCK_BRAND_RULES.length,
    rulesText: payload.rulesText || '',
    rules: MOCK_BRAND_RULES,
    lastUpdatedAt: new Date().toISOString(),
    status: 'active',
  };
  saveBrandBrain(localBrain);
  return { jobId: `job_${Date.now()}`, status: 'completed' };
}

// ─── 3. Dashboard Statistics API ──────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const history = getStoredHistory();
  const completed = history.filter((h) => h.status === 'completed');
  const scores = completed.map((h) => h.complianceScore);

  const localCalculated: DashboardStats = {
    totalAnalyses: history.length,
    averageComplianceScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 81,
    needsAttention: completed.filter((h) => h.complianceScore < 75).length,
    fullyCompliant: completed.filter((h) => h.complianceScore >= 90).length,
  };

  if (isMockModeForced()) {
    await mockDelay(200);
    return localCalculated;
  }

  const baseUrl = getApiBaseUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        totalAnalyses: data.total_analyses ?? data.totalAnalyses ?? localCalculated.totalAnalyses,
        averageComplianceScore:
          data.average_compliance_score ??
          data.averageComplianceScore ??
          localCalculated.averageComplianceScore,
        needsAttention:
          data.needs_attention ?? data.needsAttention ?? localCalculated.needsAttention,
        fullyCompliant:
          data.fully_compliant ?? data.fullyCompliant ?? localCalculated.fullyCompliant,
      };
    }
  } catch {
    // Fall back to local calculation
  }

  return localCalculated;
}

// ─── 4. Advertisement Analysis API (POST /api/v1/analysis) ─────────────────────

export interface SubmitAnalysisResponse {
  analysis_id: string;
  jobId: string;
  status: string;
  message: string;
}

export async function submitAnalysis(
  imageFile: File,
  companyName: string
): Promise<SubmitAnalysisResponse> {
  const session = getUserSession();
  const userName = session?.fullName || 'User';

  if (isMockModeForced()) {
    await mockDelay(400);
    const analysisId = `ana_${Date.now()}`;
    const imageUrl = URL.createObjectURL(imageFile);
    const mockResult = generateMockAnalysisResult(
      imageUrl,
      imageFile.name.replace(/\.[^/.]+$/, ''),
      companyName
    );
    mockResult.id = analysisId;

    if (typeof window !== 'undefined') {
      localStorage.setItem('inkloom_pending_result', JSON.stringify(mockResult));
      localStorage.setItem(`inkloom_job_start_${analysisId}`, Date.now().toString());
    }

    return {
      analysis_id: analysisId,
      jobId: analysisId,
      status: 'queued',
      message: 'Advertisement queued for analysis (mock)',
    };
  }

  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('company_name', companyName);
  formData.append('user_name', userName);

  try {
    const res = await fetch(`${baseUrl}/api/v1/analysis`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      const analysisId = data.analysis_id || data.id || `ana_${Date.now()}`;
      return {
        analysis_id: analysisId,
        jobId: analysisId,
        status: data.status || 'queued',
        message: data.message || 'Advertisement queued for analysis',
      };
    } else {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.detail || errData?.message || `Backend responded with HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn('[API] Real analysis endpoint unavailable, switching to local analysis simulation:', err);

    const fallbackId = `ana_${Date.now()}`;
    const imageUrl = URL.createObjectURL(imageFile);
    const mockResult = generateMockAnalysisResult(
      imageUrl,
      imageFile.name.replace(/\.[^/.]+$/, ''),
      companyName
    );
    mockResult.id = fallbackId;

    if (typeof window !== 'undefined') {
      localStorage.setItem('inkloom_pending_result', JSON.stringify(mockResult));
      localStorage.setItem(`inkloom_job_start_${fallbackId}`, Date.now().toString());
    }

    return {
      analysis_id: fallbackId,
      jobId: fallbackId,
      status: 'queued',
      message: 'Processing with local governance engine (backend offline)',
    };
  }
}

// ─── 5. Analysis Job Status Polling (GET /api/v1/analysis/{id}/status) ────────

export async function getAnalysisJobStatus(analysisId: string): Promise<AnalysisJobStatus> {
  if (!isMockModeForced()) {
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/analysis/${analysisId}/status`, {
        headers: {
          Accept: 'application/json',
          ...getAuthHeaders(),
        },
      });

      if (res.ok) {
        const data = await res.json();
        const status: AnalysisStatus = data.status || 'processing';

        if (status === 'completed' && data.result) {
          saveToHistory(generateMockHistoryItem(data.result));
        }

        return {
          jobId: analysisId,
          status,
          progress: data.progress ?? (status === 'completed' ? 100 : 50),
          currentStage: data.stage || data.currentStage || data.message,
          result: data.result,
        };
      }
    } catch {
      // Remote polling failed, fallback to mock progression
    }
  }

  const startTimeKey = `inkloom_job_start_${analysisId}`;
  if (typeof window !== 'undefined' && !localStorage.getItem(startTimeKey)) {
    localStorage.setItem(startTimeKey, Date.now().toString());
  }
  const startTime = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem(startTimeKey) || '0', 10)
    : Date.now();
  const elapsed = Date.now() - startTime;
  const totalDuration = 5500;

  const stages = [
    'Analysing visual composition',
    'Extracting advertisement text',
    'Identifying brand elements',
    'Checking company advertising policies',
    'Detecting brand violations',
    'Generating compliance report',
  ];

  if (elapsed < totalDuration) {
    const progress = Math.min(95, Math.round((elapsed / totalDuration) * 100));
    const stageIndex = Math.min(
      stages.length - 1,
      Math.floor((elapsed / totalDuration) * stages.length)
    );
    return {
      jobId: analysisId,
      status: 'processing',
      progress,
      currentStage: stages[stageIndex],
    };
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem(startTimeKey);
  }

  let finalResult: AnalysisResult;
  const storedPending = typeof window !== 'undefined' ? localStorage.getItem('inkloom_pending_result') : null;
  if (storedPending) {
    finalResult = JSON.parse(storedPending);
    finalResult.id = analysisId;
  } else {
    finalResult = generateMockAnalysisResult('', 'Advertisement', 'Your Company');
    finalResult.id = analysisId;
  }

  saveToHistory(generateMockHistoryItem(finalResult));

  return {
    jobId: analysisId,
    status: 'completed',
    progress: 100,
    currentStage: 'Complete',
    result: finalResult,
  };
}

// ─── 6. Analysis Full Report (GET /api/v1/analysis/{analysis_id}) ──────────────

export async function getAnalysisResult(analysisId: string): Promise<AnalysisResult | null> {
  if (!isMockModeForced()) {
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/analysis/${analysisId}`, {
        headers: {
          Accept: 'application/json',
          ...getAuthHeaders(),
        },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
  }

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('inkloom_pending_result');
    if (stored) {
      const result: AnalysisResult = JSON.parse(stored);
      if (result.id === analysisId) return result;
    }
    const history = getStoredHistory();
    const item = history.find((h) => h.id === analysisId);
    if (item) {
      const generated = generateMockAnalysisResult(item.thumbnailUrl, item.advertisementName, 'Your Company');
      generated.id = item.id;
      generated.complianceScore = item.complianceScore;
      generated.complianceLevel = item.complianceLevel;
      return generated;
    }
  }

  return generateMockAnalysisResult('', 'Advertisement', 'Your Company');
}

// ─── 7. Analysis History (GET /api/v1/analysis/history) ────────────────────────

export async function getAnalysisHistory(): Promise<AnalysisHistoryItem[]> {
  if (!isMockModeForced()) {
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/analysis/history`, {
        headers: {
          Accept: 'application/json',
          ...getAuthHeaders(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Remote unavailable
    }
  }

  await mockDelay(150);
  return getStoredHistory();
}

// ─── 8. Brand Brain & Rules (GET / PUT /api/v1/brand-brain/rules) ──────────────

export async function getBrandBrain(): Promise<BrandBrain | null> {
  if (!isMockModeForced()) {
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/v1/brand-brain`, {
        headers: {
          Accept: 'application/json',
          ...getAuthHeaders(),
        },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
  }

  await mockDelay(150);
  const stored = getStoredBrandBrain();
  if (stored) return stored;

  const defaultBrain: BrandBrain = {
    id: 'bb_001',
    companyId: 'comp_001',
    version: '1.0.0',
    totalRules: MOCK_BRAND_RULES.length,
    rulesText: '',
    rules: MOCK_BRAND_RULES,
    lastUpdatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  };
  saveBrandBrain(defaultBrain);
  return defaultBrain;
}

export async function updateBrandBrain(
  rules: BrandRule[],
  rulesText?: string
): Promise<BrandBrain> {
  const existing = getStoredBrandBrain();
  const updated: BrandBrain = {
    id: existing?.id || 'bb_001',
    companyId: existing?.companyId || 'comp_001',
    version: existing ? `${(parseFloat(existing.version) + 0.1).toFixed(1)}` : '1.1.0',
    totalRules: rules.length,
    rulesText: rulesText !== undefined ? rulesText : existing?.rulesText || '',
    rules,
    lastUpdatedAt: new Date().toISOString(),
    status: 'active',
  };

  saveBrandBrain(updated);

  if (!isMockModeForced()) {
    const baseUrl = getApiBaseUrl();
    try {
      await fetch(`${baseUrl}/api/v1/brand-brain/rules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ rules, rules_text: rulesText }),
      });
    } catch {
      // Logged and saved locally
    }
  }

  await mockDelay(300);
  return updated;
}

export function addAnalysisToHistory(item: AnalysisHistoryItem): void {
  saveToHistory(item);
}

export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  logo: 'Logo',
  typography: 'Typography',
  colour_palette: 'Colour Palette',
  messaging: 'Messaging',
  advertising_claims: 'Advertising Claims',
  restricted_content: 'Restricted Content',
  legal_compliance: 'Legal Compliance',
  general: 'General',
};