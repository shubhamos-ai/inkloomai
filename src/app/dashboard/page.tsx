'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { isOnboardingComplete, getUserSession } from '@/lib/session';

type Session = NonNullable<ReturnType<typeof getUserSession>>;

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  // Read localStorage after mount: the prerendered HTML has no session, so a
  // synchronous read here would hydrate different markup and log a React
  // hydration error.
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!isOnboardingComplete()) {
      router.replace('/onboarding');
      return;
    }
    setSession(getUserSession());
  }, [router]);

  if (!session) return null;

  return (
    <DashboardLayout currentPath={pathname}>
      <DashboardContent session={session} />
    </DashboardLayout>
  );
}
