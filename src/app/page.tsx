'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isOnboardingComplete } from '@/lib/session';
import { ShieldCheck } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (isOnboardingComplete()) {
      router.replace('/dashboard');
    } else {
      router.replace('/onboarding');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#141414]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded bg-[#E50914] flex items-center justify-center shadow-2xl shadow-red-950/60">
          <ShieldCheck size={28} className="text-white" />
        </div>
        <div className="w-6 h-6 border-2 border-neutral-700 border-t-[#E50914] rounded-full animate-spin" />
      </div>
    </div>
  );
}
