'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { isOnboardingComplete, getUserSession } from '@/lib/session';

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isOnboardingComplete()) {
      router.replace('/onboarding');
    }
  }, [router]);

  const session = getUserSession();
  if (!session) return null;

  return (
    <DashboardLayout currentPath={pathname}>
      <DashboardContent session={session} />
    </DashboardLayout>
  );
}
