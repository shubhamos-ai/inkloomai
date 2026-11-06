'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { saveUserSession, saveApiCredentials } from '@/lib/session';
import StepAuth from '@/components/onboarding/StepAuth';
import StepName from '@/components/onboarding/StepName';
import StepCompanySelect from '@/components/onboarding/StepCompanySelect';
import StepNewCompany from '@/components/onboarding/StepNewCompany';
import StepBuilding from '@/components/onboarding/StepBuilding';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import {
  registerAccount,
  loginAccount,
  fetchMe,
  updateAccountName,
  createCompanyForSession,
  type AuthSession,
  type UserCompanySummary,
} from '@/lib/api';

type Step = 'auth' | 'name' | 'companies' | 'new-company' | 'building';

/** Netflix-style onboarding:
 *  1. Sign up / Sign in (email + password)
 *  2. Name (first sign-up only)
 *  3. Choose a company (or add a new one)
 *  4. New company: name + rules & regulations
 *  5. Workspace builds → dashboard
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('auth');
  const [info, setInfo] = useState<{ name?: string; email?: string; userId?: string }>({});
  const [session, setSession] = useState<AuthSession | null>(null);
  const [companies, setCompanies] = useState<UserCompanySummary[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  // Already signed in with a workspace → straight to the dashboard.
  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== 'undefined' ? localStorage.getItem('inkloom_ai_api_key') : null;
    if (!token || !token.startsWith('il_sess_')) return;
    fetchMe().then((me) => {
      if (cancelled) return;
      if (me && me.companies.length > 0) {
        saveApiCredentials(token, me.companies[0].id);
        saveUserSession({
          fullName: me.user.name,
          email: me.user.email,
          userId: me.user.id,
          companyName: me.companies[0].company_name,
          companyId: me.companies[0].id,
        });
        router.replace('/dashboard');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const applySession = useCallback(
    (value: { session: AuthSession; name?: string }) => {
      const { session: valueSession, name } = value;
      setSession(valueSession);
      saveApiCredentials(valueSession.session_token, null);
      saveUserSession({
        fullName: name ?? valueSession.name,
        userId: valueSession.user_id,
      });
      setInfo({
        name: name ?? valueSession.name,
        userId: valueSession.user_id,
      });
    },
    []
  );

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    const me = await fetchMe();
    setLoadingCompanies(false);
    if (me) {
      setCompanies(me.companies);
      setInfo((prev) => ({ ...prev, name: me.user.name, email: me.user.email, userId: me.user.id }));
    }
  }, []);

  const handleAuth = async ({
    email,
    password,
    mode,
  }: {
    email: string;
    password: string;
    mode: 'login' | 'signup';
  }): Promise<string | null> => {
    const result = mode === 'signup' ? await registerAccount(email, password) : await loginAccount(email, password);
    if (!result.ok) return result.message;

    applySession({ session: result.session });
    saveUserSession({ fullName: result.session.name || email, email });

    if (mode === 'signup') {
      // Netflix flow: name right after account creation.
      setStep('name');
      return null;
    }

    // Sign in → jump to workspace selection.
    setStep('companies');
    loadCompanies();
    return null;
  };

  const handleName = async (name: string) => {
    setInfo((prev) => ({ ...prev, name }));
    await updateAccountName(name);
    setStep('companies');
    if (session) loadCompanies();
  };

  const handleChooseCompany = (company: UserCompanySummary) => {
    if (session) saveApiCredentials(session.session_token, company.id);
    saveUserSession({
      fullName: info.name || session?.name || 'Owner',
      companyName: company.company_name,
      companyId: company.id,
      industry: company.industry ?? undefined,
      website: company.website ?? undefined,
    });
    router.replace('/dashboard');
  };

  const handleNewCompany = async (values: {
    companyName: string;
    industry?: string;
    rulesText?: string;
    files: File[];
  }): Promise<string | null> => {
    if (!session) return 'Session lost — please sign in again.';
    setNewCompanyName(values.companyName);

    // Only the name is required by /onboarding; industry/website travel along.
    const created = await createCompanyForSession({
      name: info.name ?? 'Owner',
      companyName: values.companyName,
      industry: values.industry,
    });
    if (!('companyId' in created)) {
      return created.message;
    }
    const companyId = created.companyId;
    saveApiCredentials(session.session_token, companyId);

    // Rules (text + attached files) into the Brand Brain.
    if (values.rulesText || values.files.length > 0) {
      const formData = new FormData();
      formData.append('company_name', values.companyName);
      if (values.industry) formData.append('industry', values.industry);
      if (values.rulesText) formData.append('guidelines_text', values.rulesText);
      if (values.files.length > 0) {
        values.files.forEach((file) => formData.append('files', file));
      }
      const res = await fetch(`${getApiBaseUrl()}/api/v1/brand-brain`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.session_token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message =
          (typeof body?.detail === 'object' ? body?.detail?.message : body?.detail) ??
          `Brand Brain intake failed (HTTP ${res.status}).`;
        return message;
      }
    }

    saveUserSession({
      fullName: info.name || session?.name || 'Owner',
      companyName: values.companyName,
      companyId,
      industry: values.industry,
    });
    setStep('building');
    return null;
  };

  /** Rail progress: 1 Auth · 2 Name · 3 Companies · 4 Rules · 5 Ready. */
  const RAIL: Record<Step, number> = {
    auth: 1,
    name: 2,
    companies: 3,
    'new-company': 4,
    building: 5,
  };
  const currentStepIndex = RAIL[step];

  return (
    <div className="relative min-h-screen bg-[#141414] overflow-hidden">
      {/* Cinematic backdrop: soft red glow vignette, Netflix style */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, rgba(229,9,20,0.22), transparent 60%),' +
            'radial-gradient(40rem 30rem at 85% 110%, rgba(229,9,20,0.10), transparent 60%)',
        }}
      />
      {/* subtle grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      <div className="relative z-10">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 sm:px-12 py-5">
          <button onClick={() => router.replace('/')} className="flex items-center gap-2.5">
            <span
              className="text-2xl font-extrabold tracking-tight"
              style={{
                color: '#E50914',
                textShadow: '0 0 24px rgba(229,9,20,0.45)',
              }}
            >
              INKLOOM
            </span>
            <span className="text-neutral-500 text-xs tracking-[0.35em] uppercase mt-1 hidden sm:inline">
              AI Governance
            </span>
          </button>
        </header>

        {/* Progress rail (hidden during the cinematic build screen) */}
        {step !== 'building' && (
          <div className="px-6 sm:px-12">
            <OnboardingProgress currentStep={currentStepIndex} total={5} />
          </div>
        )}

        <main
          className={
            step === 'building'
              ? 'min-h-[80vh] flex flex-col items-center justify-center px-6'
              : 'flex min-h-[70vh] flex-col justify-center py-10 sm:py-16 px-6'
          }
        >
          <AnimatePresence mode="wait">
            {step === 'auth' && <StepAuth key="auth" onSubmit={handleAuth} />}

            {step === 'name' && (
              <StepName key="name" onSubmit={handleName} initialName={info.name} />
            )}

            {step === 'companies' && (
              <StepCompanySelect
                key="companies"
                companies={companies}
                loading={loadingCompanies}
                onChoose={handleChooseCompany}
                onAddNew={() => setStep('new-company')}
                onBack={() => {
                  setStep('auth');
                  setSession(null);
                  saveApiCredentials('', null);
                }}
              />
            )}

            {step === 'new-company' && (
              <StepNewCompany key="new-company" onSubmit={handleNewCompany} onBack={() => setStep('companies')} />
            )}

            {step === 'building' && (
              <motion.div key="building" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StepBuilding
                  dark
                  onComplete={() => router.replace('/dashboard')}
                  companyName={newCompanyName}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="px-6 sm:px-12 pb-8">
          <p className="text-neutral-700 text-xs">
            Inkloom AI — advertising compliance &amp; brand governance. All analysis results shown
            are produced by the deployed model; mock output is always clearly labelled.
          </p>
        </footer>
      </div>
    </div>
  );
}

// Imported late to avoid a circular dep at module top with mock-data.
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('inkloom_custom_api_url');
    if (custom) return custom;
  }
  return process.env.NEXT_PUBLIC_AI_API_URL || 'https://inkoom-model.shubhamos.com';
}
