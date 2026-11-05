'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import HistoryList from '@/components/history/HistoryList';
import AnalysisReport from '@/components/reports/AnalysisReport';
import { getAnalysisHistory, getAnalysisResult } from '@/lib/api';
import { isOnboardingComplete } from '@/lib/session';
import type { AnalysisHistoryItem, AnalysisResult } from '@/types/analysis';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const resultId = searchParams.get('result');

  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<AnalysisResult | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Load history list
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const items = await getAnalysisHistory();
      setHistoryItems(items);
    } catch (err) {
      console.error('Failed to load analysis history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Load specific report if ?result=ID is in URL
  useEffect(() => {
    if (!resultId) {
      setSelectedReport(null);
      setReportError(null);
      return;
    }

    let isMounted = true;
    const fetchReport = async () => {
      setIsLoadingReport(true);
      setReportError(null);
      try {
        const report = await getAnalysisResult(resultId);
        if (!isMounted) return;
        if (report) {
          setSelectedReport(report);
        } else {
          setReportError(`Analysis report "${resultId}" could not be found.`);
        }
      } catch (err) {
        if (!isMounted) return;
        setReportError('An error occurred while fetching the analysis report.');
      } finally {
        if (isMounted) setIsLoadingReport(false);
      }
    };

    fetchReport();
    return () => {
      isMounted = false;
    };
  }, [resultId]);

  const handleViewReport = (id: string) => {
    router.push(`/history?result=${id}`);
  };

  const handleBackToHistory = () => {
    setSelectedReport(null);
    setReportError(null);
    router.push('/history');
  };

  // If viewing a specific report
  if (resultId) {
    if (isLoadingReport) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-medium text-slate-500">Loading analysis report...</p>
        </div>
      );
    }

    if (reportError || !selectedReport) {
      return (
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-900">Report Not Found</h2>
          <p className="text-sm text-slate-500">{reportError || 'The requested report could not be located.'}</p>
          <button
            onClick={handleBackToHistory}
            className="btn-primary inline-flex items-center gap-2 text-sm py-2.5 px-5"
          >
            Return to History List
          </button>
        </div>
      );
    }

    return (
      <AnalysisReport
        result={selectedReport}
        onBack={handleBackToHistory}
      />
    );
  }

  // Default: show history list
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analysis History</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review past advertisement scans, compliance scores, and detailed violation reports.
          </p>
        </div>
        <button
          onClick={() => router.push('/analysis')}
          className="btn-primary flex items-center justify-center gap-2 text-sm py-2.5 px-4 self-start sm:self-auto"
        >
          Analyse New Ad
        </button>
      </div>

      <HistoryList
        items={historyItems}
        onViewReport={handleViewReport}
        isLoading={isLoadingHistory}
      />
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isOnboardingComplete()) {
      router.replace('/onboarding');
    }
  }, [router]);

  return (
    <DashboardLayout currentPath={pathname}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <HistoryContent />
      </Suspense>
    </DashboardLayout>
  );
}
