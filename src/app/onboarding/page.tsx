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
import { ShieldCheck } from 'lucide-react';

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
    saveUserSession({
      fullName: updatedData.fullName,
      companyName: updatedData.companyName,
      industry: updatedData.industry,
      website: updatedData.website,
    });
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
    <div className="min-h-screen bg-[#141414] text-white">
      {step < 4 && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#121212]/90 backdrop-blur-md border-b border-white/10">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#E50914] flex items-center justify-center shadow-lg shadow-red-950/50">
                <ShieldCheck size={18} className="text-white" />
              </div>
              <span className="font-extrabold text-white text-sm tracking-tight uppercase">
                Inkloom<span className="text-[#E50914]">AI</span>
              </span>
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
