// Session management utility
import type { OnboardingState } from '@/types/user';

const ONBOARDING_KEY = 'inkloom_onboarding';
const USER_SESSION_KEY = 'inkloom_user';
const ANALYSIS_JOB_KEY = 'inkloom_active_job';

export function getOnboardingState(): OnboardingState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingState(state: OnboardingState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
}

export function clearOnboardingState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ONBOARDING_KEY);
}

export function getUserSession(): {
  fullName: string;
  email?: string;
  userId?: string;
  companyName: string;
  companyId?: string;
  industry?: string;
  website?: string;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUserSession(data: {
  fullName: string;
  email?: string;
  userId?: string;
  companyName?: string;
  companyId?: string;
  industry?: string;
  website?: string;
}): void {
  if (typeof window === 'undefined') return;
  const existing = getUserSession() ?? {};
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ ...existing, ...data }));
}

/** Store the session token + active company id for all later API calls. */
export function saveApiCredentials(token: string, companyId?: string | null): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('inkloom_ai_api_key', token);
  if (companyId) {
    localStorage.setItem('inkloom_company_id', companyId);
  } else {
    localStorage.removeItem('inkloom_company_id');
  }
}

export function getApiCredentials(): { token: string | null; companyId: string | null } {
  if (typeof window === 'undefined') return { token: null, companyId: null };
  return {
    token: localStorage.getItem('inkloom_ai_api_key'),
    companyId: localStorage.getItem('inkloom_company_id'),
  };
}

export function clearUserSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_SESSION_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
  localStorage.removeItem(ANALYSIS_JOB_KEY);
  localStorage.removeItem('inkloom_ai_api_key');
  localStorage.removeItem('inkloom_company_id');
  localStorage.removeItem('inkloom_user_id');
  localStorage.removeItem('inkloom_pending_result');
}

export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false;
  // User must be authenticated with a session token and have selected an active company workspace.
  const token = localStorage.getItem('inkloom_ai_api_key');
  const companyId = localStorage.getItem('inkloom_company_id');
  return !!(token && token.startsWith('il_sess_') && companyId);
}

export function getActiveJobId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ANALYSIS_JOB_KEY);
}

export function setActiveJobId(jobId: string | null): void {
  if (typeof window === 'undefined') return;
  if (jobId) {
    localStorage.setItem(ANALYSIS_JOB_KEY, jobId);
  } else {
    localStorage.removeItem(ANALYSIS_JOB_KEY);
  }
}
