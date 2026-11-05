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

export function getUserSession(): { fullName: string; companyName: string; industry?: string; website?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUserSession(data: { fullName: string; companyName: string; industry?: string; website?: string }): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(data));
}

export function clearUserSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_SESSION_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
  localStorage.removeItem(ANALYSIS_JOB_KEY);
}

export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false;
  const session = getUserSession();
  return !!(session?.fullName && session?.companyName);
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
