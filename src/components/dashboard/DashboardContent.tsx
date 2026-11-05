'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
  Plus,
  ArrowRight,
  Brain,
  Clock,
  ChevronRight,
  Eye,
  Zap,
} from 'lucide-react';

import StatCard from '@/components/dashboard/StatCard';
import AdvertisementUpload from '@/components/upload/AdvertisementUpload';
import {
  getDashboardStats,
  getAnalysisHistory,
  submitAnalysis,
} from '@/lib/api';
import {
  getActiveJobId,
  setActiveJobId,
} from '@/lib/session';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface DashboardStats {
  totalAnalysed: number;
  averageScore: number;
  requiresAttention: number;
  fullyCompliant: number;
  brandRulesCount: number;
  lastUpdated: string;
}

interface AnalysisRecord {
  id: string;
  name: string;
  score: number;
  date: string;
  status: 'compliant' | 'attention' | 'failed';
  thumbnailUrl?: string;
  violations?: string[];
}

interface DashboardContentProps {
  session: { fullName: string; companyName: string };
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function scoreColour(score: number): string {
  if (score >= 85) return 'text-green-700 bg-green-50 border-green-200';
  if (score >= 60) return 'text-orange-700 bg-orange-50 border-orange-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

/* ─── Skeleton ──────────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-xl bg-slate-100" />
      </div>
      <div className="mt-4 h-8 w-20 rounded-lg bg-slate-100" />
      <div className="mt-2 h-4 w-32 rounded bg-slate-100" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 animate-pulse">
      <div className="h-12 w-12 rounded-lg bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-slate-100" />
        <div className="h-3 w-24 rounded bg-slate-100" />
      </div>
      <div className="h-6 w-14 rounded-full bg-slate-100" />
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function DashboardContent({ session }: DashboardContentProps) {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  /* Fetch stats */
  useEffect(() => {
    setStatsLoading(true);
    getDashboardStats()
      .then((data) => {
        setStats({
          totalAnalysed: data.totalAnalyses,
          averageScore: data.averageComplianceScore,
          requiresAttention: data.needsAttention,
          fullyCompliant: data.fullyCompliant,
          brandRulesCount: 10,
          lastUpdated: new Date().toISOString(),
        });
      })
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  /* Fetch history */
  useEffect(() => {
    setHistoryLoading(true);
    getAnalysisHistory()
      .then((items) => {
        const mapped: AnalysisRecord[] = items.map((h) => ({
          id: h.id,
          name: h.advertisementName,
          score: h.complianceScore,
          date: h.analysedAt,
          status:
            h.complianceScore >= 90
              ? 'compliant'
              : h.complianceScore >= 75
              ? 'attention'
              : 'failed',
          thumbnailUrl: h.thumbnailUrl,
        }));
        setHistory(mapped.slice(0, 3));
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  /* Check active job */
  useEffect(() => {
    const jobId = getActiveJobId();
    if (jobId) setIsAnalysing(true);
  }, []);

  const handleUpload = async (file: File) => {
    setIsAnalysing(true);
    try {
      const { jobId } = await submitAnalysis(file, session.companyName);
      setActiveJobId(jobId);
      router.push('/analysis');
    } catch {
      setIsAnalysing(false);
    }
  };

  const recentViolations = history
    .flatMap((h) => (h.violations ?? []).slice(0, 2))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* ── Welcome Header ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {getGreeting()}, {getFirstName(session.fullName)}.
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your brand intelligence workspace is ready.
          </p>
        </div>

        <button
          onClick={() => {
            setShowUpload(true);
            setTimeout(() => {
              document.getElementById('quick-analyse')?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
          }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all duration-150"
        >
          <Plus className="h-4 w-4" />
          Analyse New Advertisement
        </button>
      </motion.div>

      {/* ── Stats Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              title="Total Analysed"
              value={stats?.totalAnalysed ?? 0}
              icon={<BarChart3 className="h-5 w-5" />}
              colour="blue"
              trend="+3 this week"
            />
            <StatCard
              title="Average Compliance Score"
              value={stats ? `${stats.averageScore}%` : '—'}
              icon={<Target className="h-5 w-5" />}
              colour="purple"
            />
            <StatCard
              title="Requires Attention"
              value={stats?.requiresAttention ?? 0}
              icon={<AlertTriangle className="h-5 w-5" />}
              colour="orange"
              trend={stats?.requiresAttention ? 'Review needed' : undefined}
            />
            <StatCard
              title="Fully Compliant"
              value={stats?.fullyCompliant ?? 0}
              icon={<CheckCircle className="h-5 w-5" />}
              colour="green"
            />
          </>
        )}
      </div>

      {/* ── Quick Analyse ───────────────────────────────────────────────── */}
      <motion.div
        id="quick-analyse"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Analyse New Advertisement
              </h2>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Upload an advertisement image to check brand compliance instantly.
            </p>
          </div>
          {!showUpload && !isAnalysing && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 sm:mt-0 self-start sm:self-auto flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Upload
            </button>
          )}
        </div>

        <div className="p-6">
          {isAnalysing && !showUpload ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-500">
              <div className="h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
              <p className="text-sm font-medium">Analysis in progress…</p>
              <button
                onClick={() => router.push('/analysis')}
                className="text-xs text-blue-600 hover:underline"
              >
                View progress
              </button>
            </div>
          ) : showUpload ? (
            <AdvertisementUpload
              onUpload={handleUpload}
              isAnalysing={isAnalysing}
            />
          ) : (
            <button
              onClick={() => setShowUpload(true)}
              className="w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors cursor-pointer"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">
                Click to upload an advertisement
              </span>
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Recent Analyses + Brand Brain ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Analyses */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Recent Analyses
            </h2>
            <Link
              href="/history"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              View All History
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="p-4 space-y-2">
            {historyLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No analyses yet</p>
                <p className="text-xs mt-1">
                  Upload your first advertisement above.
                </p>
              </div>
            ) : (
              history.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  {/* Thumbnail placeholder */}
                  <div className="h-12 w-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BarChart3 className="h-5 w-5 text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="text-xs text-slate-400">
                        {formatDate(item.date)}
                      </span>
                    </div>
                  </div>

                  {/* Score badge */}
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${scoreColour(item.score)}`}
                  >
                    {item.score}%
                  </span>

                  {/* View button */}
                  <Link
                    href={`/history?result=${item.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-blue-600 transition-colors ml-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">View</span>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Brand Brain Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Brand Brain
            </h2>
            <Brain className="h-5 w-5 text-slate-400" />
          </div>

          <div className="p-6 flex-1 space-y-5">
            {/* Status */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
              <span className="text-sm font-semibold text-green-700">
                Active
              </span>
            </div>

            {/* Meta */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Total Rules</span>
                <span className="text-sm font-bold text-slate-900">
                  {statsLoading ? '—' : (stats?.brandRulesCount ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Last Updated</span>
                <span className="text-xs font-medium text-slate-700">
                  {statsLoading
                    ? '—'
                    : stats?.lastUpdated
                    ? formatDate(stats.lastUpdated)
                    : 'Never'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Link
                href="/brand-brain"
                className="flex items-center justify-between text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Manage Brand Brain
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Recent Violations ────────────────────────────────────────────── */}
      {recentViolations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold text-slate-900">
              Recent Violations
            </h2>
          </div>

          <ul className="divide-y divide-slate-100">
            {recentViolations.map((violation, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-6 py-3.5"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                <span className="text-sm text-slate-700">{violation}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
