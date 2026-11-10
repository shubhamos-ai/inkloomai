'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isOnboardingComplete } from '@/lib/session';

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
    <div
      className="min-h-screen flex items-center justify-center bg-[#FAF8F5]"
    >
      <div className="flex flex-col items-center gap-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md shadow-red-500/20"
          style={{ backgroundColor: '#E50914' }}
        >
          <span className="text-white text-base font-black tracking-tight">IN</span>
        </div>
        <span
          className="text-3xl font-black tracking-tight"
          style={{ color: '#E50914' }}
        >
          INKLOOM
        </span>
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(229,9,20,0.2)', borderTopColor: '#E50914' }}
        />
      </div>
    </div>
  );
}
