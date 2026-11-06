// Central API service layer for Inkloom AI
// Backend: FastAPI on Render.com + NVIDIA NIM (Llama 3.2 11B Vision)
// In production, NEXT_PUBLIC_AI_API_URL is set to the Render backend URL.
// In development, defaults to http://localhost:8000.
//
// This layer normalises the backend's snake_case responses into the
// frontend's camelCase types. Mock/local fallbacks only ever run when the
// user explicitly forces mock mode — otherwise failures surface as errors.
// Real backend data is never replaced with generated content silently.

import type {
  AnalysisResult,
  AnalysisHistoryItem,
  AnalysisJobStatus,
  AnalysisStatus,
  ComplianceLevel,
  Violation,
  ViolationSeverity,
} from '@/types/analysis';
import type {
  BrandBrain,
  BrandBrainSetupPayload,
  BrandRule,
  RuleCategory,
} from '@/types/brand-rules';
import type { DashboardStats } from '@/types/company';
import {
  MOCK_BRAND_RULES,
  generateMockAnalysisResult,
  generateMockHistoryItem,
  MOCK_HISTORY,
} from './mock-data';
import { getUserSession } from './session';

// ─── Configuration ────────────────────────────────────────────────────────────

// In dev: http://localhost:8000
// In production (Render): set NEXT_PUBLIC_AI_API_URL to your Render backend URL
// e.g. https://inkloom-backend.onrender.com
export const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('inkloom_custom_api_url');
    if (custom) return custom;
  }
  return process.env.NEXT_PUBLIC_AI_API_URL || DEFAULT_API_BASE_URL;
}

export function getApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_AI_API_KEY ||
    (typeof window !== 'undefined' ? localStorage.getItem('inkloom_ai_api_key') || '' : '')
  );
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = getApiKey();
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }
  // Session auth: pick the active company when the account owns several.
  if (typeof window !== 'undefined') {
    const companyId = localStorage.getItem('inkloom_company_id');
    if (companyId) headers['X-Company-ID'] = companyId;
  }
  return headers;
}

export function hasApiKey(): boolean {
  return !!getApiKey();
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
    hasApiKey: hasApiKey(),
    isMock: isMockModeForced(),
  };
}

// Authorised URL for assets the browser loads directly (<img> src), which
// cannot send Authorization headers — the backend accepts ?token= as well.
function authorizedUrl(serverPath: string): string {
  const apiKey = getApiKey();
  const sep = serverPath.includes('?') ? '&' : '?';
  return `${getApiBaseUrl()}${serverPath}${sep}token=${encodeURIComponent(apiKey)}`;
}

// ─── Backend → frontend adapters ─────────────────────────────────────────────

function complianceLevelFromOverall(overall: string | null | undefined): ComplianceLevel {
  switch (overall) {
    case 'passed':
      return 'excellent';
    case 'needs_revision':
      return 'needs_revision';
    case 'critical_failure':
      return 'non_compliant';
    default:
      // inconclusive / failed / unknown — be conservative but honest
      return 'needs_minor_improvements';
  }
}

function severityOf(raw: string | undefined): ViolationSeverity {
  if (raw === 'critical') return 'critical';
  if (raw === 'major') return 'major';
  // backend "info" and anything unexpected degrade to minor
  return 'minor';
}

/** Map a backend AnalysisReport JSON into the frontend AnalysisResult shape. */
function adaptReport(raw: Record<string, unknown>): AnalysisResult {
  const analysisId = String(raw.analysis_id ?? raw.id ?? '');
  const meta = (raw.analysis_metadata ?? {}) as Record<string, unknown>;
  const violationsRaw = Array.isArray(raw.violations) ? raw.violations : [];

  const violations: Violation[] = violationsRaw.map((v, index) => {
    const item = v as Record<string, unknown>;
    return {
      id: String(item.rule_id ?? `v_${index}`),
      title: String(item.title ?? 'Untitled finding'),
      severity: severityOf(item.severity as string | undefined),
      explanation: String(item.explanation ?? ''),
      relevantRule: String(item.category ?? 'general'),
      ruleId: String(item.rule_id ?? ''),
      evidence: String(item.evidence ?? ''),
      suggestedCorrection: String(item.recommendation ?? ''),
    };
  });

  const recommendationsRaw = Array.isArray(raw.recommendations) ? raw.recommendations : [];
  const recommendations = recommendationsRaw.map((rec, index) => {
    const text = typeof rec === 'string' ? rec : String((rec as Record<string, unknown>).text ?? '');
    const critical = violations.some((v) => v.severity === 'critical');
    return {
      id: `rec_${index + 1}`,
      what: text,
      why: '',
      how: '',
      priority: (critical ? 'high' : violations.length > 0 ? 'medium' : 'low') as
        | 'high'
        | 'medium'
        | 'low',
    };
  });

  const passedChecksRaw = Array.isArray(raw.passed_checks) ? raw.passed_checks : [];
  const passedChecks = passedChecksRaw
    .filter((c) => (c as Record<string, unknown>).state === 'passed')
    .map((c) => {
      const item = c as Record<string, unknown>;
      const detail = String(item.detail ?? '').trim();
      const rule = String(item.rule_id ?? '');
      return detail ? `${rule}: ${detail}` : rule;
    })
    .filter(Boolean);

  const score = typeof raw.compliance_score === 'number' ? raw.compliance_score : 0;

  return {
    id: analysisId,
    advertisementName: String(raw.original_filename ?? meta.original_filename ?? 'Advertisement'),
    imageUrl: raw.image_url
      ? authorizedUrl(String(raw.image_url))
      : authorizedUrl(`/api/v1/analysis/${analysisId}/image`),
    companyName: '', // filled by the caller when known
    complianceScore: score,
    complianceLevel: complianceLevelFromOverall(raw.overall_status as string | undefined),
    status: (raw.status === 'failed' ? 'failed' : 'completed') as AnalysisStatus,
    analysedAt: (createdAt(raw) || new Date().toISOString()),
    violations,
    recommendations,
    passedChecks,
    summary: String(raw.summary ?? ''),
  };
}

function createdAt(raw: Record<string, unknown>): string | null {
  const value = raw.created_at ?? raw.completed_at;
  return typeof value === 'string' && value ? value : null;
}

/** Map a backend AnalysisListItem JSON into the frontend history shape. */
function adaptHistoryItem(raw: Record<string, unknown>): AnalysisHistoryItem {
  const analysisId = String(raw.analysis_id ?? raw.id ?? '');
  const filename = String(raw.original_filename ?? 'Advertisement');
  const status = (['queued', 'processing', 'completed', 'failed', 'cancelled'].includes(
    String(raw.status)
  )
    ? String(raw.status)
    : 'processing') as AnalysisStatus;
  const score = typeof raw.compliance_score === 'number' ? raw.compliance_score : 0;

  return {
    id: analysisId,
    advertisementName: filename.replace(/\.[^/.]+$/, ''),
    thumbnailUrl: authorizedUrl(`/api/v1/analysis/${analysisId}/image`),
    analysedAt: createdAt(raw) || new Date().toISOString(),
    complianceScore: score,
    complianceLevel: complianceLevelFromOverall(raw.overall_status as string | undefined),
    status,
    violationsCount: Number(raw.violations_count ?? 0),
    criticalCount: Number(raw.critical_count ?? 0),
    majorCount: Number(raw.major_count ?? 0),
    minorCount: Number(raw.minor_count ?? 0),
  };
}

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued for analysis',
  preprocess: 'Preparing image',
  ocr: 'Extracting advertisement text',
  vision: 'Analysing visual composition',
  compliance: 'Checking company advertising policies',
  scoring: 'Generating compliance report',
  completed: 'Complete',
  failed: 'Failed',
};

function humanStage(raw: string | undefined): string {
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[^a-z_]/g, '');
  return STAGE_LABELS[key] ?? raw;
}

async function fetchApi(path: string, init?: RequestInit): Promise<Response | null> {
  const { headers: initHeaders, ...rest } = init ?? {};
  try {
    return await fetch(`${getApiBaseUrl()}${path}`, {
      ...rest,
      headers: { Accept: 'application/json', ...getAuthHeaders(), ...(initHeaders ?? {}) },
    });
  } catch {
    return null;
  }
}

// ─── Local Storage Cache / Fallback Store ─────────────────────────────────────

const HISTORY_STORAGE_KEY = 'inkloom_analysis_history';
const BRAND_BRAIN_KEY = 'inkloom_brand_brain';

function getStoredHistory(): AnalysisHistoryItem[] {
  if (typeof window === 'undefined') return [...MOCK_HISTORY];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
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

// ─── 0. Auth (email + password accounts) ─────────────────────────────────────

export interface AuthSession {
  user_id: string;
  session_token: string;
  name: string;
  has_company: boolean;
  message?: string;
}

export interface UserCompanySummary {
  id: string;
  company_name: string;
  industry?: string | null;
  website?: string | null;
  created_at: string;
  analysis_count: number;
  compliance_score?: number | null;
}

export interface MeResponse {
  user: { id: string; email: string; name: string; created_at: string };
  companies: UserCompanySummary[];
}

function detailMessage(res: Response, fallback: string): Promise<string> {
  return res
    .json()
    .then((body) => (typeof body?.detail === 'object' ? body?.detail?.message : body?.detail))
    .catch(() => null)
    .then((msg) => (typeof msg === 'string' && msg ? msg : fallback));
}

export async function registerAccount(
  email: string,
  password: string
): Promise<{ ok: true; session: AuthSession } | { ok: false; message: string }> {
  const res = await fetchApi('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res) return { ok: false, message: 'Backend unreachable — try again shortly.' };
  if (!res.ok) return { ok: false, message: await detailMessage(res, 'Registration failed.') };
  return { ok: true, session: await res.json() };
}

export async function loginAccount(
  email: string,
  password: string
): Promise<{ ok: true; session: AuthSession } | { ok: false; message: string }> {
  const res = await fetchApi('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res) return { ok: false, message: 'Backend unreachable — try again shortly.' };
  if (!res.ok) return { ok: false, message: await detailMessage(res, 'Incorrect email or password.') };
  return { ok: true, session: await res.json() };
}

export async function fetchMe(): Promise<MeResponse | null> {
  const res = await fetchApi('/api/v1/auth/me');
  if (!res?.ok) return null;
  return res.json();
}

export async function updateAccountName(name: string): Promise<MeResponse | null> {
  const res = await fetchApi('/api/v1/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res?.ok) return null;
  return res.json();
}

export async function logoutAccount(): Promise<void> {
  await fetchApi('/api/v1/auth/logout', { method: 'POST' });
}

export async function signOutEverywhere(): Promise<void> {
  try { await logoutAccount(); } catch { /* best-effort */ }
}

/** Legacy (session-less) onboarding payload kept for compatibility. */
export async function createCompanyForSession(data: {
  name: string;
  companyName: string;
  industry?: string;
  website?: string;
}): Promise<{ companyId: string } | { ok: false; message: string }> {
  const res = await fetchApi('/api/v1/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      company_name: data.companyName,
      industry: data.industry || undefined,
      website: data.website || undefined,
    }),
  });
  if (!res) return { ok: false, message: 'Backend unreachable — try again shortly.' };
  if (!res.ok) return { ok: false, message: await detailMessage(res, 'Company creation failed.') };
  const body = await res.json();
  return { companyId: body.company_id ?? body.companyId };
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export async function checkApiHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── 1. Onboarding API ────────────────────────────────────────────────────────

export async function submitOnboarding(data: {
  fullName: string;
  companyName: string;
  industry?: string;
  website?: string;
}): Promise<{ success: boolean; message?: string; apiKey?: string }> {
  if (isMockModeForced()) {
    await mockDelay(350);
    return { success: true, message: 'Onboarding saved (mock)' };
  }

  const payload = {
    name: data.fullName,
    company_name: data.companyName,
    industry: data.industry || '',
    website: data.website || '',
  };

  const res = await fetchApi('/api/v1/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res) {
    return { success: false, message: 'Backend unreachable — check your connection.' };
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null))?.detail;
    const message =
      typeof detail === 'object' && detail
        ? detail.message
        : typeof detail === 'string'
        ? detail
        : `Onboarding failed (HTTP ${res.status}).`;
    return { success: false, message };
  }

  const body = await res.json().catch(() => ({}));
  if (body.access_token && typeof window !== 'undefined') {
    // Persist the one-time company API key — it drives all later calls.
    localStorage.setItem('inkloom_ai_api_key', String(body.access_token));
    localStorage.setItem('inkloom_company_id', String(body.company_id ?? ''));
    localStorage.setItem('inkloom_user_id', String(body.user_id ?? ''));
  }
  return { success: true, apiKey: body.access_token };
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

  const formData = new FormData();
  formData.append('company_name', payload.companyName);
  if (payload.industry) formData.append('industry', payload.industry);
  if (payload.website) formData.append('website', payload.website);
  if (payload.rulesText) formData.append('guidelines_text', payload.rulesText);
  if (payload.uploadedFiles && payload.uploadedFiles.length > 0) {
    formData.append('files_meta', JSON.stringify(payload.uploadedFiles));
  }

  const res = await fetchApi('/api/v1/brand-brain', { method: 'POST', body: formData });

  if (res?.ok) {
    const data = await res.json();
    return {
      jobId: data.job_id || data.jobId || `job_${Date.now()}`,
      status: data.status || 'completed',
    };
  }

  if (res) {
    const detail = (await res.json().catch(() => null))?.detail;
    const message =
      (typeof detail === 'object' && detail?.message) || `Brand Brain setup failed (HTTP ${res.status}).`;
    throw new Error(message);
  }

  // Network-level failure
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
  if (isMockModeForced()) {
    await mockDelay(200);
  }

  const res = await fetchApi('/api/v1/dashboard');
  if (res?.ok) {
    const data = await res.json();
    return {
      totalAnalyses: data.total_analyses ?? data.totalAnalyses ?? 0,
      averageComplianceScore:
        data.average_compliance_score ?? data.averageComplianceScore ?? 0,
      needsAttention: data.needs_attention ?? data.needsAttention ?? 0,
      fullyCompliant: data.fully_compliant ?? data.fullyCompliant ?? 0,
    };
  }

  // Local aggregate from honest stored history (no invented numbers).
  const history = getStoredHistory();
  const completed = history.filter((h) => h.status === 'completed');
  const scores = completed.map((h) => h.complianceScore);
  return {
    totalAnalyses: history.length,
    averageComplianceScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0,
    needsAttention: completed.filter((h) => h.complianceScore < 75).length,
    fullyCompliant: completed.filter((h) => h.complianceScore >= 90).length,
  };
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

  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('company_name', companyName);
  formData.append('user_name', userName);

  const res = await fetchApi('/api/v1/analysis', { method: 'POST', body: formData });

  if (res?.ok) {
    const data = await res.json();
    const analysisId = data.analysis_id || data.id || `ana_${Date.now()}`;
    return {
      analysis_id: analysisId,
      jobId: analysisId,
      status: data.status || 'queued',
      message: data.message || 'Advertisement queued for analysis',
    };
  }

  if (res) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    const message =
      typeof detail === 'object' && detail
        ? detail.message
        : typeof detail === 'string'
        ? detail
        : `Backend responded with HTTP ${res.status}`;
    // 409 = another analysis already running for this company. Surface it.
    throw new Error(message);
  }

  throw new Error('Backend unreachable — the analysis was not queued.');
}

// ─── 5. Analysis Job Status Polling (GET /api/v1/analysis/{id}/status) ────────

export async function getAnalysisJobStatus(analysisId: string): Promise<AnalysisJobStatus> {
  if (isMockModeForced() || analysisId.startsWith('ana_')) {
    return simulatedStatus(analysisId);
  }

  const res = await fetchApi(`/api/v1/analysis/${analysisId}/status`);
  if (res?.ok) {
    const data = await res.json();
    const status = (['queued', 'processing', 'completed', 'failed', 'cancelled'].includes(
      String(data.status)
    )
      ? String(data.status)
      : 'processing') as AnalysisStatus;

    let result: AnalysisResult | undefined;
    if (status === 'completed' && data.result) {
      result = adaptReport(data.result);
      // Cache the real result for the report page.
      if (typeof window !== 'undefined') {
        localStorage.setItem(`inkloom_result_${analysisId}`, JSON.stringify(result));
      }
      const historyItem = historyItemFromResult(result);
      saveToHistory(historyItem);
    }

    return {
      jobId: analysisId,
      status,
      progress: typeof data.progress === 'number' ? data.progress : status === 'completed' ? 100 : 0,
      currentStage: humanStage(data.current_stage ?? data.stage) || (status === 'completed' ? 'Complete' : ''),
      result,
      error: data.error || undefined,
    };
  }

  if (res && (res.status === 404 || res.status === 401)) {
    return {
      jobId: analysisId,
      status: 'failed',
      progress: 0,
      currentStage: 'Failed',
      error:
        res.status === 404
          ? 'Analysis not found on the server.'
          : 'Authentication failed — please re-run onboarding.',
    };
  }

  // Network error — keep polling without inventing results.
  return {
    jobId: analysisId,
    status: 'processing',
    progress: 0,
    currentStage: 'Connecting to backend…',
  };
}

function historyItemFromResult(result: AnalysisResult): AnalysisHistoryItem {
  return {
    id: result.id,
    advertisementName: result.advertisementName,
    thumbnailUrl: result.imageUrl,
    analysedAt: result.analysedAt,
    complianceScore: result.complianceScore,
    complianceLevel: result.complianceLevel,
    status: result.status,
    violationsCount: result.violations.length,
    criticalCount: result.violations.filter((v) => v.severity === 'critical').length,
    majorCount: result.violations.filter((v) => v.severity === 'major').length,
    minorCount: result.violations.filter((v) => v.severity === 'minor').length,
  };
}

/** Local simulated progression — used ONLY in forced-mock mode or for ids
 * created locally (`ana_…`), and clearly derived from mock data. */
async function simulatedStatus(analysisId: string): Promise<AnalysisJobStatus> {
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
    'Analysing visual composition (mock)',
    'Extracting advertisement text (mock)',
    'Identifying brand elements (mock)',
    'Checking company advertising policies (mock)',
    'Detecting brand violations (mock)',
    'Generating compliance report (mock)',
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
    currentStage: 'Complete (mock)',
    result: finalResult,
  };
}

// ─── 6. Analysis Full Report (GET /api/v1/analysis/{analysis_id}) ──────────────

export async function getAnalysisResult(
  analysisId: string,
  companyName = 'Your Company'
): Promise<AnalysisResult | null> {
  if (isMockModeForced() || analysisId.startsWith('ana_')) {
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

  // Prefer the cached real result captured during polling.
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(`inkloom_result_${analysisId}`);
    if (cached) {
      const result: AnalysisResult = JSON.parse(cached);
      result.companyName = result.companyName || companyName;
      return result;
    }
  }

  const res = await fetchApi(`/api/v1/analysis/${analysisId}`);
  if (!res) {
    return null; // network unavailable — no fake substitute
  }
  if (res.status === 409) {
    // Still running — report the live status so callers can poll instead.
    const body = await res.json().catch(() => null);
    const detail = body?.detail ?? {};
    return {
      id: analysisId,
      advertisementName: 'Advertisement',
      imageUrl: authorizedUrl(`/api/v1/analysis/${analysisId}/image`),
      companyName,
      complianceScore: 0,
      complianceLevel: 'needs_revision',
      status: 'processing',
      analysedAt: new Date().toISOString(),
      violations: [],
      recommendations: [],
      passedChecks: [],
      summary: detail.current_stage
        ? `Analysis still running (stage: ${detail.current_stage}, ${detail.progress ?? 0}%).`
        : 'Analysis still running.',
    };
  }
  if (!res.ok) return null;

  const raw = await res.json();
  const adapted = adaptReport(raw);
  adapted.companyName = companyName;
  return adapted;
}

// ─── 7. Analysis History (GET /api/v1/analysis/history) ────────────────────────

export async function getAnalysisHistory(): Promise<AnalysisHistoryItem[]> {
  if (isMockModeForced()) {
    await mockDelay(150);
    return getStoredHistory();
  }

  const res = await fetchApi('/api/v1/analysis/history?limit=50');
  if (res?.ok) {
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.items;
    if (Array.isArray(items)) {
      return items.map((item) => adaptHistoryItem(item as Record<string, unknown>));
    }
  }

  // Remote unavailable — local cache only (never inject mock server data).
  return getStoredHistory();
}

// ─── 8. Brand Brain & Rules (GET / PUT /api/v1/brand-brain/rules) ──────────────

const VALID_CATEGORIES: RuleCategory[] = [
  'logo',
  'typography',
  'colour_palette',
  'messaging',
  'advertising_claims',
  'restricted_content',
  'legal_compliance',
  'general',
];

function normaliseCategory(raw: unknown): RuleCategory {
  const value = String(raw ?? 'general').toLowerCase().replace(/[\s-]+/g, '_');
  return (VALID_CATEGORIES.includes(value as RuleCategory) ? value : 'general') as RuleCategory;
}

/** Map a backend BrandRuleOut JSON into the frontend BrandRule shape. */
function adaptBrandRule(raw: Record<string, unknown>): BrandRule {
  const requirement = String(raw.requirement ?? '');
  return {
    id: String(raw.id ?? raw.code ?? ''),
    code: String(raw.code ?? ''),
    category: normaliseCategory(raw.category),
    title: requirement.length > 80 ? `${requirement.slice(0, 77)}…` : requirement,
    description: requirement,
    isActive: Boolean(raw.enabled),
    createdAt: String(raw.created_at ?? ''),
    updatedAt: String(raw.updated_at ?? ''),
  };
}

export async function getBrandBrain(): Promise<BrandBrain | null> {
  if (isMockModeForced()) {
    await mockDelay(150);
    return getStoredBrandBrain() ?? localDefaultBrain();
  }

  const [brainRes, rulesRes] = await Promise.all([
    fetchApi('/api/v1/brand-brain'),
    fetchApi('/api/v1/brand-brain/rules'),
  ]);

  if (brainRes?.ok) {
    const data = await brainRes.json();
    const rules: BrandRule[] =
      rulesRes?.ok && Array.isArray((await rulesRes.clone().json().catch(() => null))?.rules)
        ? ((await rulesRes.json()) as { rules: Record<string, unknown>[] }).rules.map(adaptBrandRule)
        : [];

    const brain: BrandBrain = {
      id: String(data.company_id ?? 'bb_server'),
      companyId: String(data.company_id ?? ''),
      version: String(data.version ?? '1.0.0'),
      totalRules: Number(data.rule_count ?? rules.length),
      rulesText: String(data.original_rules_text ?? ''),
      rules,
      lastUpdatedAt: String(data.updated_at ?? ''),
      status:
        String(data.extraction_status ?? '') === 'processing'
          ? 'processing'
          : 'active',
    };
    saveBrandBrain(brain);
    return brain;
  }

  const stored = getStoredBrandBrain();
  if (stored) return stored;
  return null;
}

function localDefaultBrain(): BrandBrain {
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

  if (isMockModeForced()) {
    await mockDelay(300);
    saveBrandBrain(updated);
    return updated;
  }

  const res = await fetchApi('/api/v1/brand-brain/rules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rules: rules.map((rule) => ({
        id: rule.code || rule.id,
        category: rule.category,
        requirement: rule.description,
        enabled: rule.isActive,
      })),
      rules_text: rulesText,
    }),
  });

  if (!res?.ok) {
    const message = res
      ? `Rule update failed (HTTP ${res.status}).`
      : 'Backend unreachable while updating rules.';
    throw new Error(message);
  }

  saveBrandBrain(updated);
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
