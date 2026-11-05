'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BrandBrainContent from '@/components/brand-brain/BrandBrainContent';
import { isOnboardingComplete } from '@/lib/session';

export default function BrandBrainPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isOnboardingComplete()) router.replace('/onboarding');
  }, [router]);

  return (
    <DashboardLayout currentPath={pathname}>
      <BrandBrainContent />
    </DashboardLayout>
  );
}
