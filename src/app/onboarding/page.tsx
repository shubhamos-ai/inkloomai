'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveUserSession, saveOnboardingState, isOnboardingComplete } from '@/lib/session';
import StepPersonal from '@/components/onboarding/StepPersonal';
import StepCompany from '@/components/onboarding/StepCompany';
import StepBrandBrain from '@/components/onboarding/StepBrandBrain';
import StepBuilding from '@/components/onboarding/StepBuilding';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import { setupBrandBrain } from '@/lib/api';

interface OnboardingData {
  fullName: string;
  companyName: string;
  industry?: string;
  website?: string;
  rulesText?: string;
  files?: File[];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({ fullName: '', companyName: '' });

  useEffect(() => {
    if (isOnboardingComplete()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handlePersonalNext = (fullName: string) => {
    setData(prev => ({ ...prev, fullName }));
    setStep(2);
  };

  const handleCompanyNext = (companyData: { companyName: string; industry?: string; website?: string }) => {
    setData(prev => ({ ...prev, ...companyData }));
    setStep(3);
  };

  const handleBrandBrainNext = async (brainData: { rulesText?: string; files?: File[] }) => {
    const updatedData = { ...data, ...brainData };
    setData(updatedData);
    // Persist session before building
    saveUserSession({
      fullName: updatedData.fullName,
      companyName: updatedData.companyName,
      industry: updatedData.industry,
      website: updatedData.website,
    });
    // Call API (non-blocking for mock)
    setupBrandBrain({
      companyName: updatedData.companyName,
      industry: updatedData.industry,
      website: updatedData.website,
      rulesText: updatedData.rulesText,
    }).catch(() => {});
    setStep(4);
  };

  const handleBuildingComplete = () => {
    saveOnboardingState({
      step: 4,
      fullName: data.fullName,
      companyName: data.companyName,
      industry: data.industry,
      website: data.website,
      completed: true,
    });
    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {step < 4 && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="font-semibold text-slate-900 text-sm">Inkloom AI</span>
            </div>
            <OnboardingProgress currentStep={step} />
          </div>
        </div>
      )}

      <div className={step < 4 ? 'pt-24 pb-12' : ''}>
        {step === 1 && (
          <StepPersonal onNext={handlePersonalNext} initialName={data.fullName} />
        )}
        {step === 2 && (
          <StepCompany
            onNext={handleCompanyNext}
            onBack={() => setStep(1)}
            initialData={{
              companyName: data.companyName,
              industry: data.industry,
              website: data.website,
            }}
          />
        )}
        {step === 3 && (
          <StepBrandBrain onNext={handleBrandBrainNext} onBack={() => setStep(2)} />
        )}
        {step === 4 && (
          <StepBuilding onComplete={handleBuildingComplete} companyName={data.companyName} />
        )}
      </div>
    </div>
  );
}
