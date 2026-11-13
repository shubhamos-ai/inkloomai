'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AdvertisementUpload from '@/components/upload/AdvertisementUpload';
import ScanningExperience from '@/components/scanner/ScanningExperience';
import { submitAnalysis } from '@/lib/api';
import { getUserSession, getActiveJobId, setActiveJobId, isOnboardingComplete } from '@/lib/session';

type PageState = 'upload' | 'scanning';

const PREVIEW_STORAGE_KEY = 'inkloom_active_image_preview';

export default function AnalysisPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [pageState, setPageState] = useState<PageState>('upload');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Read after mount so the first client render matches the prerendered HTML.
  const [hasActiveJob, setHasActiveJob] = useState(false);

  useEffect(() => {
    if (!isOnboardingComplete()) {
      router.replace('/onboarding');
      return;
    }

    // Check for existing active job to resume across refresh or navigation
    const existingJob = getActiveJobId();
    setHasActiveJob(!!existingJob);
    if (existingJob) {
      setCurrentJobId(existingJob);
      const savedPreview = typeof window !== 'undefined' ? localStorage.getItem(PREVIEW_STORAGE_KEY) : null;
      if (savedPreview) {
        setImagePreviewUrl(savedPreview);
      }
      setPageState('scanning');
    }
  }, [router]);

  const handleUpload = async (file: File) => {
    setUploadError(null);

    // Convert file to data URL for persistent preview across page reloads
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImagePreviewUrl(dataUrl);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(PREVIEW_STORAGE_KEY, dataUrl);
        } catch (e) {
          console.warn('Could not store full preview in localStorage due to quota', e);
        }
      }

      const session = getUserSession();
      try {
        const response = await submitAnalysis(file, session?.companyName || 'Your Company');
        const jobId = response.analysis_id || response.jobId;
        setCurrentJobId(jobId);
        setActiveJobId(jobId);
        setHasActiveJob(true);
        setPageState('scanning');
      } catch (err) {
        console.error('Submit analysis error:', err);
        setUploadError(err instanceof Error ? err.message : 'Failed to submit advertisement for analysis');
        setActiveJobId(null);
      }
    };

    reader.onerror = () => {
      setUploadError('Failed to read selected image file.');
    };

    reader.readAsDataURL(file);
  };

  const handleScanComplete = (resultId: string) => {
    setActiveJobId(null);
    setHasActiveJob(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PREVIEW_STORAGE_KEY);
      localStorage.setItem('inkloom_latest_result_id', resultId);
    }
    router.push(`/history?result=${resultId}`);
  };

  const handleScanFailed = () => {
    setActiveJobId(null);
    setHasActiveJob(false);
    setCurrentJobId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PREVIEW_STORAGE_KEY);
    }
    setPageState('upload');
  };

  return (
    <DashboardLayout currentPath={pathname}>
      <div className="max-w-4xl mx-auto space-y-6">
        {pageState === 'upload' && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">Analyse Advertisement</h1>
              <p className="text-slate-500 mt-1">
                Upload your advertisement creative to run AI compliance scanning against your Brand Brain policies.
              </p>
            </div>

            {uploadError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <p className="font-semibold">Analysis Request Failed</p>
                <p className="text-xs mt-0.5">{uploadError}</p>
              </div>
            )}

            <AdvertisementUpload
              onUpload={handleUpload}
              isAnalysing={hasActiveJob}
            />
          </div>
        )}

        {pageState === 'scanning' && currentJobId && (
          <ScanningExperience
            jobId={currentJobId}
            imagePreviewUrl={imagePreviewUrl}
            onComplete={handleScanComplete}
            onFailed={handleScanFailed}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
