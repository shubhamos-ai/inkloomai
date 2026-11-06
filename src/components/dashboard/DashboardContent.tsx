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
  TrendingUp,
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
  status: 'excellent' | 'needs_revision' | 'non_compliant' | 'needs_minor_improvements';
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

function scoreColour(score: number): { bg: string; text: string; border: string } {
  if (score >= 85) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
  if (score >= 60) return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
  return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 60) return 'Needs Work';
  return 'Non-Compliant';
}

/* ─── Skeletons ────────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="bg-black/40 rounded-xl border border-white/5 p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-lg bg-white/5" />
      </div>
      <div className="mt-4 h-8 w-20 rounded-lg bg-white/5" />
      <div className="mt-2 h-3 w-28 rounded bg-white/5" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 animate-pulse">
      <div className="h-12 w-12 rounded-lg bg-white/5 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-white/5" />
        <div className="h-3 w-24 rounded bg-white/5" />
      </div>
      <div className="h-6 w-14 rounded-full bg-white/5" />
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
          status: h.complianceLevel,
          thumbnailUrl: h.thumbnailUrl,
        }));
        setHistory(mapped.slice(0, 4));
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
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {getGreeting()}, {getFirstName(session.fullName)}.
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {session.companyName} workspace is ready.
          </p>
        </div>

        <button
          onClick={() => {
            setShowUpload(true);
            setTimeout(() => {
              document.getElementById('quick-analyse')?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
          }}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
          style={{ backgroundColor: '#E50914' }}
        >
          <Plus className="h-4 w-4" />
          Analyse Advertisement
        </button>
      </motion.div>

      {/* ── Stats Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              title="Total Scans"
              value={stats?.totalAnalysed ?? 0}
              icon={<BarChart3 className="h-5 w-5" />}
              colour="red"
              trend="+2 this week"
            />
            <StatCard
              title="Avg. Score"
              value={stats ? `${stats.averageScore}%` : '—'}
              icon={<Target className="h-5 w-5" />}
              colour="purple"
            />
            <StatCard
              title="Needs Review"
              value={stats?.requiresAttention ?? 0}
              icon={<AlertTriangle className="h-5 w-5" />}
              colour="orange"
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
        className="bg-black/40 rounded-xl border border-white/10 backdrop-blur-sm overflow-hidden"
      >
        <div className="px-5 pt-5 pb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" style={{ color: '#E50914' }} />
              <h2 className="text-base font-semibold text-white">
                Quick Analysis
              </h2>
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">
              Upload an ad to check compliance against your brand rules.
            </p>
          </div>
          {!showUpload && !isAnalysing && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 sm:mt-0 self-start sm:self-auto flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Upload
            </button>
          )}
        </div>

        <div className="p-5">
          {isAnalysing && !showUpload ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-neutral-400">
              <div
                className="h-8 w-8 rounded-full border-2 border-white/20 border-t-[#E50914] animate-spin"
              />
              <p className="text-sm font-medium">Analysis in progress…</p>
              <button
                onClick={() => router.push('/analysis')}
                className="text-xs hover:text-white transition-colors"
                style={{ color: '#E50914' }}
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
              className="w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-white/10 rounded-xl text-neutral-500 hover:border-[#E50914]/50 hover:text-[#E50914] transition-all cursor-pointer"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">
                Click to upload advertisement
              </span>
              <span className="text-xs text-neutral-600">
                PNG, JPG, or WebP up to 15MB
              </span>
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Recent Analyses + Brand Brain ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent Analyses */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="lg:col-span-2 bg-black/40 rounded-xl border border-white/10 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-base font-semibold text-white">Recent Scans</h2>
            <Link
              href="/history"
              className="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
            >
              View All
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="p-3 space-y-2">
            {historyLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <BarChart3 className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No analyses yet</p>
                <p className="text-xs mt-1">
                  Upload your first advertisement above.
                </p>
              </div>
            ) : (
              history.map((item, i) => {
                const scoreColors = scoreColour(item.score);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    {/* Thumbnail */}
                    <div className="h-11 w-11 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BarChart3 className="h-5 w-5 text-neutral-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3 text-neutral-600" />
                        <span className="text-xs text-neutral-500">
                          {formatDate(item.date)}
                        </span>
                      </div>
                    </div>

                    {/* Score badge */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${scoreColors.bg} ${scoreColors.text} ${scoreColors.border}`}>
                      <span className="text-xs font-bold">{item.score}%</span>
                    </div>

                    {/* View button */}
                    <Link
                      href={`/history?result=${item.id}`}
                      className="flex items-center gap-1 text-xs font-medium text-neutral-500 group-hover:text-white transition-colors ml-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Brand Brain Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-black/40 rounded-xl border border-white/10 backdrop-blur-sm flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-base font-semibold text-white">Brand Brain</h2>
            <Brain className="h-5 w-5 text-neutral-500" />
          </div>

          <div className="p-5 flex-1 space-y-5">
            {/* Status */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-sm font-semibold text-green-400">
                Active
              </span>
            </div>

            {/* Meta */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Rules</span>
                <span className="text-sm font-bold text-white">
                  {statsLoading ? '—' : (stats?.brandRulesCount ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Last Updated</span>
                <span className="text-xs font-medium text-neutral-400">
                  {statsLoading
                    ? '—'
                    : stats?.lastUpdated
                    ? formatDate(stats.lastUpdated)
                    : 'Never'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <Link
                href="/brand-brain"
                className="flex items-center justify-between text-sm font-medium text-neutral-400 hover:text-white transition-colors"
              >
                Manage
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
          className="bg-black/40 rounded-xl border border-white/10 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <h2 className="text-base font-semibold text-white">Recent Issues</h2>
          </div>

          <ul className="divide-y divide-white/5">
            {recentViolations.map((violation, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-5 py-3"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                <span className="text-sm text-neutral-300">{violation}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}