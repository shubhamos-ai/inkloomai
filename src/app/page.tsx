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
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#141414' }}
    >
      <div className="flex flex-col items-center gap-5">
        <span
          className="text-3xl font-extrabold tracking-tight"
          style={{ color: '#E50914', textShadow: '0 0 32px rgba(229,9,20,0.5)' }}
        >
          INKLOOM
        </span>
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(229,9,20,0.4)', borderTopColor: '#E50914' }}
        />
      </div>
    </div>
  );
}
