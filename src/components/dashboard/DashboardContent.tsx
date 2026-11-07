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
  if (score >= 90) return 'text-emerald-400 bg-emerald-950/60 border-emerald-700/60';
  if (score >= 60) return 'text-amber-400 bg-amber-950/60 border-amber-700/60';
  return 'text-red-400 bg-red-950/60 border-red-700/60';
}

/* ─── Skeleton ──────────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="bg-[#181818] rounded-xl border border-white/10 p-6 shadow-xl animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-lg bg-neutral-800" />
      </div>
      <div className="mt-4 h-8 w-20 rounded bg-neutral-800" />
      <div className="mt-2 h-4 w-32 rounded bg-neutral-800" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-white/5 animate-pulse bg-[#141414]">
      <div className="h-12 w-12 rounded-lg bg-neutral-800 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-neutral-800" />
        <div className="h-3 w-24 rounded bg-neutral-800" />
      </div>
      <div className="h-6 w-14 rounded-full bg-neutral-800" />
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
        setHistory(mapped.slice(0, 5));
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
    <div className="space-y-8 select-none">
      {/* ── Welcome Header ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6"
      >
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {getGreeting()}, <span className="text-[#E50914]">{getFirstName(session.fullName)}</span>.
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Real-time advertisement compliance intelligence for <strong className="text-neutral-200">{session.companyName}</strong>.
          </p>
        </div>

        <button
          onClick={() => {
            setShowUpload(true);
            setTimeout(() => {
              document.getElementById('quick-analyse')?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
          }}
          className="flex items-center gap-2 rounded-md bg-[#E50914] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/40 hover:bg-[#b80710] active:scale-95 transition-all duration-150"
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
              colour="red"
              trend="+3 this week"
            />
            <StatCard
              title="Average Compliance Score"
              value={stats ? `${stats.averageScore}%` : '—'}
              icon={<Target className="h-5 w-5" />}
              colour="blue"
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

      {/* ── Quick Analyse Section ────────────────────────────────────────── */}
      <motion.div
        id="quick-analyse"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-[#181818] rounded-xl border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#E50914]" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Upload & Verify Advertisement
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-neutral-400">
              Drag-and-drop banner image to execute multimodal AI verification against corporate policies.
            </p>
          </div>
          {!showUpload && !isAnalysing && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 sm:mt-0 self-start sm:self-auto flex items-center gap-2 rounded-md border border-white/15 px-4 py-2 text-xs font-semibold text-neutral-200 hover:border-[#E50914] hover:text-[#E50914] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Upload Banner
            </button>
          )}
        </div>

        <div className="p-6">
          {isAnalysing && !showUpload ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-neutral-400">
              <div className="h-10 w-10 rounded-full border-2 border-neutral-700 border-t-[#E50914] animate-spin" />
              <p className="text-sm font-medium text-white">NVIDIA Multimodal Analysis in progress…</p>
              <button
                onClick={() => router.push('/analysis')}
                className="text-xs text-[#E50914] hover:underline"
              >
                View live scan & progress
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
              className="w-full flex flex-col items-center justify-center gap-3 py-12 border-2 border-dashed border-white/15 rounded-xl text-neutral-400 hover:border-[#E50914] hover:text-white transition-all bg-[#141414] cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center group-hover:border-[#E50914]/50 transition-colors">
                <Plus className="h-6 w-6 text-neutral-300 group-hover:text-[#E50914] transition-colors" />
              </div>
              <span className="text-sm font-semibold tracking-wide">
                Drop your advertisement banner here or click to browse
              </span>
              <span className="text-xs text-neutral-500">
                Supports PNG, JPG, JPEG, WEBP (Up to 15MB)
              </span>
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Recent Analyses + Brand Brain ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Analyses Row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="lg:col-span-2 bg-[#181818] rounded-xl border border-white/10 shadow-xl"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Recent Verifications
            </h2>
            <Link
              href="/history"
              className="flex items-center gap-1 text-xs font-semibold text-[#E50914] hover:text-red-400 transition-colors"
            >
              View Full History
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
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <BarChart3 className="h-10 w-10 mb-3 opacity-30 text-neutral-400" />
                <p className="text-sm font-semibold text-neutral-300">No advertisements verified yet</p>
                <p className="text-xs mt-1 text-neutral-500">
                  Upload your first banner above to inspect compliance with NVIDIA NIM.
                </p>
              </div>
            ) : (
              history.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-[#202020] transition-colors border border-transparent hover:border-white/5 group"
                >
                  {/* Thumbnail placeholder */}
                  <div className="h-12 w-12 rounded bg-neutral-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
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
                    <p className="text-sm font-semibold text-white truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3 w-3 text-neutral-500" />
                      <span className="text-xs text-neutral-500">
                        {formatDate(item.date)}
                      </span>
                    </div>
                  </div>

                  {/* Score badge */}
                  <span
                    className={`text-xs font-extrabold px-3 py-1 rounded-full border ${scoreColour(item.score)}`}
                  >
                    {item.score}%
                  </span>

                  {/* View button */}
                  <Link
                    href={`/history?result=${item.id}`}
                    className="flex items-center gap-1 text-xs font-semibold text-neutral-400 group-hover:text-[#E50914] transition-colors ml-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Inspect</span>
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
          className="bg-[#181818] rounded-xl border border-white/10 shadow-xl flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Brand Brain
            </h2>
            <Brain className="h-5 w-5 text-[#E50914]" />
          </div>

          <div className="p-6 flex-1 space-y-5">
            {/* Status */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-sm font-bold text-emerald-400">
                Rules Synchronized
              </span>
            </div>

            {/* Meta */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-neutral-400">Active Policies</span>
                <span className="text-sm font-bold text-white">
                  {statsLoading ? '—' : (stats?.brandRulesCount ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-neutral-400">Model Engine</span>
                <span className="text-xs font-semibold text-[#E50914]">
                  NVIDIA NIM Vision
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Last Synced</span>
                <span className="text-xs font-medium text-neutral-300">
                  {statsLoading
                    ? '—'
                    : stats?.lastUpdated
                    ? formatDate(stats.lastUpdated)
                    : 'Real-time'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10">
              <Link
                href="/brand-brain"
                className="flex items-center justify-between text-sm font-semibold text-[#E50914] hover:text-red-400 transition-colors"
              >
                Inspect Corporate Rules
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
          className="bg-[#181818] rounded-xl border border-white/10 shadow-xl"
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Flagged Policy Breaches
            </h2>
          </div>

          <ul className="divide-y divide-white/5">
            {recentViolations.map((violation, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-6 py-3.5"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-sm text-neutral-300">{violation}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
