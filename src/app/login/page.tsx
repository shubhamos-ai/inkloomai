'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /login — deep link into the onboarding auth step with the sign-in tab
 * preselected. The flow itself lives in /onboarding so there is a single
 * source of truth for session handling and company selection.
 */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/onboarding?mode=login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shadow-red-500/20"
          style={{ backgroundColor: '#E50914' }}
        >
          <span className="text-white text-sm font-black tracking-tight">IN</span>
        </div>
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(229,9,20,0.2)', borderTopColor: '#E50914' }}
        />
        <p className="text-sm text-neutral-500">Opening sign in…</p>
      </div>
    </div>
  );
}
