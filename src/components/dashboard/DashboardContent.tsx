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
  getBrandBrain,
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
  score: number | null;
  date: string;
  status: 'excellent' | 'needs_revision' | 'non_compliant' | 'needs_minor_improvements' | 'inconclusive';
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

function scoreColour(score: number | null): { bg: string; text: string; border: string } {
  if (score === null) return { bg: 'bg-slate-50 text-slate-500', text: 'text-slate-500', border: 'border-slate-200' };
  if (score >= 85) return { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', border: 'border-emerald-200' };
  if (score >= 60) return { bg: 'bg-amber-50 text-amber-700', text: 'text-amber-700', border: 'border-amber-200' };
  return { bg: 'bg-red-50 text-red-700', text: 'text-red-700', border: 'border-red-200' };
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'Inconclusive';
  if (score >= 85) return 'Excellent';
  if (score >= 60) return 'Needs Work';
  return 'Non-Compliant';
}

/* ─── Skeletons ────────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E2D9] p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-xl bg-[#F0EBE1]" />
      </div>
      <div className="mt-4 h-8 w-20 rounded-lg bg-[#F0EBE1]" />
      <div className="mt-2 h-3 w-28 rounded bg-[#F0EBE1]" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-[#E8E2D9] bg-white animate-pulse">
      <div className="h-12 w-12 rounded-xl bg-[#F0EBE1] shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-[#F0EBE1]" />
        <div className="h-3 w-24 rounded bg-[#F0EBE1]" />
      </div>
      <div className="h-6 w-14 rounded-full bg-[#F0EBE1]" />
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
  // The greeting depends on the visitor's clock, so render it after mount to
  // avoid a server/client hydration mismatch on this prerendered page.
  const [greeting, setGreeting] = useState('Welcome');

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  /* Fetch stats + real Brand Brain metadata (never invent rule counts) */
  useEffect(() => {
    setStatsLoading(true);
    Promise.all([
      getDashboardStats().catch(() => null),
      getBrandBrain().catch(() => null),
    ])
      .then(([data, brain]) => {
        if (!data) {
          setStats(null);
          return;
        }
        setStats({
          totalAnalysed: data.totalAnalyses,
          averageScore: data.averageComplianceScore,
          requiresAttention: data.needsAttention,
          fullyCompliant: data.fullyCompliant,
          brandRulesCount: brain?.totalRules ?? 0,
          lastUpdated: brain?.lastUpdatedAt ?? '',
        });
      })
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
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
            {greeting}, {getFirstName(session.fullName)}.
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {session.companyName} workspace is active and brand rules are enforced.
          </p>
        </div>

        <button
          onClick={() => {
            setShowUpload(true);
            setTimeout(() => {
              document.getElementById('quick-analyse')?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-1.5" />
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
        className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden"
      >
        <div className="px-5 pt-5 pb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-[#F0EBE1]">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#E50914]" />
              <h2 className="text-base font-bold text-neutral-900">
                Quick Analysis Engine
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              Upload an advertisement creative to run instant multimodal compliance scanning.
            </p>
          </div>
          {!showUpload && !isAnalysing && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 sm:mt-0 self-start sm:self-auto flex items-center gap-1.5 rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] px-3.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-[#F3EFEA] transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-[#E50914]" />
              New Scan
            </button>
          )}
        </div>

        <div className="p-5">
          {isAnalysing && !showUpload ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-neutral-500">
              <div
                className="h-8 w-8 rounded-full border-2 border-neutral-200 border-t-[#E50914] animate-spin"
              />
              <p className="text-sm font-semibold text-neutral-800">Visual compliance scan in progress…</p>
              <button
                onClick={() => router.push('/analysis')}
                className="text-xs font-semibold text-[#E50914] hover:underline transition-colors"
              >
                View live scan progress →
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
              className="w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-[#E0D8CB] rounded-xl text-neutral-500 hover:border-[#E50914] hover:bg-red-50/20 hover:text-[#E50914] transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D9] group-hover:border-red-200 flex items-center justify-center text-neutral-500 group-hover:text-[#E50914] transition-colors">
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-sm font-bold text-neutral-800 group-hover:text-[#E50914]">
                Upload advertisement for compliance review
              </span>
              <span className="text-xs text-neutral-400">
                Supports PNG, JPG, or WebP up to 15MB
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
          className="lg:col-span-2 bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE1]">
            <h2 className="text-base font-bold text-neutral-900">Recent Scans</h2>
            <Link
              href="/history"
              className="flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-[#E50914] transition-colors"
            >
              View All Scans
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
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-semibold text-neutral-700">No advertisement scans yet</p>
                <p className="text-xs text-neutral-400 mt-1">
                  Upload your creative above to run an AI inspection.
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
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#FAF8F5] transition-colors group border border-transparent hover:border-[#E8E2D9]"
                  >
                    {/* Thumbnail */}
                    <div className="h-11 w-11 rounded-xl bg-[#FAF8F5] border border-[#E8E2D9] flex items-center justify-center shrink-0 overflow-hidden">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BarChart3 className="h-5 w-5 text-neutral-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3 text-neutral-400" />
                        <span className="text-xs text-neutral-500">
                          {formatDate(item.date)}
                        </span>
                      </div>
                    </div>

                    {/* Score badge */}
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${scoreColors.bg} ${scoreColors.border}`}>
                      <span>{item.score !== null ? `${item.score}%` : '—'}</span>
                    </div>

                    {/* View button */}
                    <Link
                      href={`/history?result=${item.id}`}
                      className="flex items-center gap-1 text-xs font-semibold text-neutral-500 group-hover:text-[#E50914] transition-colors ml-1 px-2 py-1 rounded-lg hover:bg-white"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Report</span>
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
          className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE1]">
            <h2 className="text-base font-bold text-neutral-900">Brand Brain</h2>
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <Brain className="h-4 w-4 text-[#E50914]" />
            </div>
          </div>

          <div className="p-5 flex-1 space-y-5">
            {/* Status */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Active Governance Engine
              </span>
            </div>

            {/* Meta */}
            <div className="space-y-3 bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E8E2D9]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500 font-medium">Active Rules</span>
                <span className="text-sm font-black text-neutral-900">
                  {statsLoading ? '—' : (stats?.brandRulesCount ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500 font-medium">Last Modified</span>
                <span className="text-xs font-semibold text-neutral-700">
                  {statsLoading
                    ? '—'
                    : stats?.lastUpdated
                    ? formatDate(stats.lastUpdated)
                    : 'Never'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/brand-brain"
                className="flex items-center justify-between text-xs font-bold text-neutral-700 hover:text-[#E50914] p-2.5 rounded-xl border border-[#E8E2D9] hover:bg-[#FAF8F5] transition-all"
              >
                <span>Manage Brand Brain</span>
                <ArrowRight className="h-3.5 w-3.5" />
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
          className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#F0EBE1]">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-bold text-neutral-900">Flagged Non-Compliance Insights</h2>
          </div>

          <ul className="divide-y divide-[#F0EBE1]">
            {recentViolations.map((violation, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAF8F5] transition-colors"
              >
                <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-xs font-medium text-neutral-700">{violation}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}