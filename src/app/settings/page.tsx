'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SettingsContent from '@/components/dashboard/SettingsContent';
import { isOnboardingComplete } from '@/lib/session';

export default function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isOnboardingComplete()) router.replace('/onboarding');
  }, [router]);

  return (
    <DashboardLayout currentPath={pathname}>
      <SettingsContent />
    </DashboardLayout>
  );
}
