'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  Hash,
  Building2,
  Image,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ScoreRing from '@/components/ui/ScoreRing';
import type { AnalysisResult, Violation, AIRecommendation, ComplianceLevel, ViolationSeverity } from '@/types/analysis';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMPLIANCE_LABELS: Record<ComplianceLevel, string> = {
  excellent: 'APPROVED (Excellent)',
  needs_minor_improvements: 'APPROVED (Minor Fixes)',
  needs_revision: 'NEEDS REVIEW',
  non_compliant: 'REJECTED (Non-Compliant)',
};

const COMPLIANCE_BADGE: Record<ComplianceLevel, string> = {
  excellent: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
  needs_minor_improvements: 'bg-blue-950/80 text-blue-400 border-blue-700/60',
  needs_revision: 'bg-amber-950/80 text-amber-400 border-amber-700/60',
  non_compliant: 'bg-red-950/80 text-red-400 border-red-700/60',
};

const SEVERITY_CONFIG: Record<
  ViolationSeverity,
  { label: string; badge: string; border: string; icon: React.ReactNode; boxBorder: string }
> = {
  critical: {
    label: 'Critical Breach',
    badge: 'bg-red-950/80 text-red-400 border-red-700/60',
    border: 'border-red-900/40 bg-red-950/20',
    icon: <XCircle className="w-4 h-4 text-red-500" />,
    boxBorder: '#E50914',
  },
  major: {
    label: 'Major Breach',
    badge: 'bg-orange-950/80 text-orange-400 border-orange-700/60',
    border: 'border-orange-900/40 bg-orange-950/20',
    icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    boxBorder: '#ea580c',
  },
  minor: {
    label: 'Minor Deviation',
    badge: 'bg-amber-950/80 text-amber-400 border-amber-700/60',
    border: 'border-amber-900/40 bg-amber-950/20',
    icon: <Info className="w-4 h-4 text-amber-400" />,
    boxBorder: '#d97706',
  },
  passed: {
    label: 'Passed',
    badge: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
    border: 'border-emerald-900/40 bg-emerald-950/20',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    boxBorder: '#16a34a',
  },
};

const PRIORITY_BADGE: Record<AIRecommendation['priority'], string> = {
  high: 'bg-red-950/80 text-red-400 border-red-700/60',
  medium: 'bg-amber-950/80 text-amber-400 border-amber-700/60',
  low: 'bg-neutral-800 text-neutral-400 border-white/10',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Summary Stat Card ────────────────────────────────────────────────────────

interface SummaryCardProps {
  count: number;
  label: string;
  colour: string;
  bg: string;
  icon: React.ReactNode;
}

function SummaryCard({ count, label, colour, bg, icon }: SummaryCardProps) {
  return (
    <div className={`rounded-xl border border-white/10 ${bg} p-4 flex flex-col items-center text-center gap-1 shadow-lg`}>
      <div className="mb-1">{icon}</div>
      <span className={`text-3xl font-black ${colour}`}>{count}</span>
      <span className="text-xs font-semibold text-neutral-400 leading-tight">{label}</span>
    </div>
  );
}

// ─── Violation Card ───────────────────────────────────────────────────────────

function ViolationCard({ violation, index }: { violation: Violation; index: number }) {
  const cfg = SEVERITY_CONFIG[violation.severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35 }}
      className={`rounded-xl border ${cfg.border} bg-[#181818] overflow-hidden shadow-xl`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-white/10">
        <div className="mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.badge}`}
            >
              {cfg.label}
            </span>
          </div>
          <h4 className="font-bold text-white text-sm">{violation.title}</h4>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Explanation */}
        <p className="text-sm text-neutral-300 leading-relaxed">{violation.explanation}</p>

        {/* Relevant Rule */}
        <div className="rounded-lg bg-[#141414] border border-white/5 px-4 py-3">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
            Relevant Policy · <span className="text-[#E50914] font-mono">{violation.ruleId}</span>
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">{violation.relevantRule}</p>
        </div>

        {/* Evidence */}
        {violation.evidence && (
          <div className="rounded-lg border-l-4 border-amber-500 bg-amber-950/30 px-4 py-3">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Visual Evidence Detected</p>
            <blockquote className="text-sm text-amber-200 italic">&ldquo;{violation.evidence}&rdquo;</blockquote>
          </div>
        )}

        {/* Suggested correction */}
        {violation.suggestedCorrection && (
          <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-3">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
              Required Remediation
            </p>
            <p className="text-sm text-emerald-200 leading-relaxed">{violation.suggestedCorrection}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Recommendation Card ──────────────────────────────────────────────────────

function RecommendationCard({ rec, index }: { rec: AIRecommendation; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35 }}
      className="rounded-xl border border-white/10 bg-[#181818] overflow-hidden shadow-xl"
    >
      <div className="px-5 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border capitalize ${PRIORITY_BADGE[rec.priority]}`}
          >
            {rec.priority} priority
          </span>
        </div>
        <h4 className="font-bold text-white text-sm mt-1">{rec.what}</h4>
      </div>

      <div className="px-5 py-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-[#141414] border border-white/5 px-4 py-3">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Reasoning</p>
          <p className="text-sm text-neutral-300 leading-relaxed">{rec.why}</p>
        </div>
        <div className="rounded-lg bg-[#141414] border border-emerald-900/30 px-4 py-3">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Action Step</p>
          <p className="text-sm text-neutral-200 leading-relaxed">{rec.how}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Visual Evidence ──────────────────────────────────────────────────────────

function VisualEvidence({ result }: { result: AnalysisResult }) {
  const hasBoxes = result.violations.some((v) => v.boundingBox);

  if (!result.imageUrl && !hasBoxes) return null;

  return (
    <section className="rounded-xl border border-white/10 bg-[#181818] overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#E50914]" />
          <h2 className="font-bold text-white uppercase tracking-wider text-sm">Visual Evidence & Ad Inspection</h2>
        </div>
        <p className="text-xs text-neutral-400 mt-0.5">Annotated scan results identifying flagged brand regions</p>
      </div>

      <div className="p-6">
        <div className="relative inline-block max-w-full">
          {result.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.imageUrl}
              alt={result.advertisementName}
              className="rounded-lg max-w-full max-h-[480px] object-contain border border-white/15 bg-black"
            />
          ) : (
            <div className="w-full h-72 rounded-lg bg-neutral-900 flex items-center justify-center border border-white/5">
              <div className="text-center space-y-2">
                <Image className="w-10 h-10 text-neutral-600 mx-auto" />
                <p className="text-sm text-neutral-400">No preview image available</p>
              </div>
            </div>
          )}

          {/* Bounding boxes overlay */}
          {hasBoxes && (
            <div className="absolute inset-0 pointer-events-none">
              {result.violations
                .filter((v) => v.boundingBox)
                .map((v) => {
                  const bb = v.boundingBox!;
                  const cfg = SEVERITY_CONFIG[v.severity];
                  return (
                    <div
                      key={v.id}
                      className="absolute"
                      style={{
                        left: `${bb.x}%`,
                        top: `${bb.y}%`,
                        width: `${bb.width}%`,
                        height: `${bb.height}%`,
                        border: `2px solid ${cfg.boxBorder}`,
                        borderRadius: 4,
                      }}
                    >
                      <span
                        className="absolute top-0 left-0 -translate-y-full text-white text-xs px-1.5 py-0.5 rounded-t font-bold leading-tight"
                        style={{ backgroundColor: cfg.boxBorder }}
                      >
                        {bb.label}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Legend */}
        {hasBoxes && (
          <div className="flex flex-wrap gap-3 mt-4">
            {(['critical', 'major', 'minor'] as const).map((sev) => (
              <div key={sev} className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span
                  className="w-3 h-3 rounded-sm border-2"
                  style={{ borderColor: SEVERITY_CONFIG[sev].boxBorder }}
                />
                {SEVERITY_CONFIG[sev].label}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Passed Checks ────────────────────────────────────────────────────────────

function PassedChecks({ checks }: { checks: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? checks : checks.slice(0, 4);

  if (checks.length === 0) return null;

  return (
    <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-emerald-900/30">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <h2 className="font-bold text-emerald-400 text-sm uppercase tracking-wider">
            Verified Compliant Checks <span className="font-normal text-emerald-500">({checks.length})</span>
          </h2>
        </div>
      </div>

      <div className="px-6 py-4 space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((check, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-neutral-200">{check}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {checks.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-emerald-400 font-semibold mt-2 hover:text-emerald-300 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Show {checks.length - 4} more
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

// ─── Download helper ──────────────────────────────────────────────────────────

function downloadReport(result: AnalysisResult): void {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════',
    '          INKLOOM AI — ADVERTISEMENT COMPLIANCE REPORT',
    '═══════════════════════════════════════════════════════',
    '',
    `Advertisement : ${result.advertisementName}`,
    `Company       : ${result.companyName}`,
    `Analysis ID   : ${result.id}`,
    `Date          : ${formatDate(result.analysedAt)}`,
    `Status        : ${result.status.toUpperCase()}`,
    '',
    '───────────────────────────────────────────────────────',
    'COMPLIANCE SCORE',
    '───────────────────────────────────────────────────────',
    `Score : ${result.complianceScore} / 100`,
    `Level : ${COMPLIANCE_LABELS[result.complianceLevel]}`,
    '',
    'SUMMARY',
    result.summary,
    '',
    '───────────────────────────────────────────────────────',
    'VIOLATIONS',
    '───────────────────────────────────────────────────────',
  ];

  result.violations.forEach((v, i) => {
    lines.push('');
    lines.push(`${i + 1}. [${v.severity.toUpperCase()}] ${v.title}`);
    lines.push(`   Rule      : ${v.ruleId} — ${v.relevantRule}`);
    lines.push(`   Explanation: ${v.explanation}`);
    if (v.evidence) lines.push(`   Evidence  : "${v.evidence}"`);
    lines.push(`   Fix       : ${v.suggestedCorrection}`);
  });

  lines.push('');
  lines.push('───────────────────────────────────────────────────────');
  lines.push('AI RECOMMENDATIONS');
  lines.push('───────────────────────────────────────────────────────');

  result.recommendations.forEach((r, i) => {
    lines.push('');
    lines.push(`${i + 1}. [${r.priority.toUpperCase()}] ${r.what}`);
    lines.push(`   Why : ${r.why}`);
    lines.push(`   How : ${r.how}`);
  });

  lines.push('');
  lines.push('───────────────────────────────────────────────────────');
  lines.push('PASSED CHECKS');
  lines.push('───────────────────────────────────────────────────────');
  result.passedChecks.forEach((c, i) => lines.push(`${i + 1}. ${c}`));

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('Generated by Inkloom AI · Enterprise Ad Governance');
  lines.push('═══════════════════════════════════════════════════════');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inkloom-report-${result.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface AnalysisReportProps {
  result: AnalysisResult;
  onBack: () => void;
  onAnalyseAgain?: () => void;
}

export default function AnalysisReport({ result, onBack, onAnalyseAgain }: AnalysisReportProps) {
  const router = useRouter();
  const handleAnalyseAgain = onAnalyseAgain || (() => router.push('/analysis'));

  const critical = result.violations.filter((v) => v.severity === 'critical').length;
  const major = result.violations.filter((v) => v.severity === 'major').length;
  const minor = result.violations.filter((v) => v.severity === 'minor').length;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-12 select-none"
    >
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <motion.div variants={sectionVariants} className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Verification History
          </button>
          <h1 className="text-2xl font-black text-white sm:text-3xl tracking-tight">
            Ad Verification Report
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadReport(result)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/15 bg-[#252525] text-white text-xs font-bold hover:bg-[#303030] transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Dossier
          </button>
          <button
            onClick={handleAnalyseAgain}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#E50914] text-white text-xs font-bold hover:bg-[#b80710] shadow-lg shadow-red-950/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Verify Another Ad
          </button>
        </div>
      </motion.div>

      {/* ── Metadata Bar ────────────────────────────────────────────────── */}
      <motion.div
        variants={sectionVariants}
        className="rounded-xl border border-white/10 bg-[#181818] px-6 py-4 shadow-xl"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <Building2 className="w-4 h-4 text-[#E50914]" />
            <span className="font-bold text-white">{result.companyName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Calendar className="w-4 h-4 text-neutral-500" />
            {formatDate(result.analysedAt)}
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Hash className="w-4 h-4 text-neutral-500" />
            <span className="font-mono text-xs text-neutral-500">{result.id}</span>
          </div>
          <span
            className={`ml-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${COMPLIANCE_BADGE[result.complianceLevel]}`}
          >
            {COMPLIANCE_LABELS[result.complianceLevel]}
          </span>
        </div>
      </motion.div>

      {/* ── Ad Preview + Score ───────────────────────────────────────────── */}
      <motion.div
        variants={sectionVariants}
        className="rounded-xl border border-white/10 bg-[#181818] overflow-hidden shadow-2xl"
      >
        <div className="flex flex-col lg:flex-row">
          {/* Thumbnail */}
          <div className="lg:w-1/2 p-6 flex items-center justify-center bg-[#121212] border-b lg:border-b-0 lg:border-r border-white/10 min-h-[220px]">
            {result.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.imageUrl}
                alt={result.advertisementName}
                className="rounded-lg max-h-72 max-w-full object-contain shadow-2xl border border-white/10"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-neutral-500">
                <div className="w-20 h-20 rounded-2xl bg-[#1c1c1c] flex items-center justify-center">
                  <Image className="w-9 h-9 text-neutral-600" />
                </div>
                <span className="text-sm">No preview available</span>
              </div>
            )}
          </div>

          {/* Score panel */}
          <div className="lg:w-1/2 p-8 flex flex-col items-center justify-center gap-5">
            <ScoreRing score={result.complianceScore} size={160} />

            <div className="text-center space-y-2">
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-black border ${COMPLIANCE_BADGE[result.complianceLevel]}`}
              >
                {COMPLIANCE_LABELS[result.complianceLevel]}
              </span>
              <p className="text-sm text-neutral-300 leading-relaxed max-w-sm text-center">
                {result.summary}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Violation Summary Cards ──────────────────────────────────────── */}
      <motion.div variants={sectionVariants}>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Compliance Findings Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            count={critical}
            label="Critical Violations"
            colour="text-red-400"
            bg="bg-red-950/40"
            icon={<XCircle className="w-5 h-5 text-red-400" />}
          />
          <SummaryCard
            count={major}
            label="Major Violations"
            colour="text-orange-400"
            bg="bg-orange-950/40"
            icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}
          />
          <SummaryCard
            count={minor}
            label="Minor Violations"
            colour="text-amber-400"
            bg="bg-amber-950/40"
            icon={<Info className="w-5 h-5 text-amber-400" />}
          />
          <SummaryCard
            count={result.passedChecks.length}
            label="Passed Checks"
            colour="text-emerald-400"
            bg="bg-emerald-950/40"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          />
        </div>
      </motion.div>

      {/* ── Visual Evidence ──────────────────────────────────────────────── */}
      <motion.div variants={sectionVariants}>
        <VisualEvidence result={result} />
      </motion.div>

      {/* ── Detailed Violations ──────────────────────────────────────────── */}
      {result.violations.length > 0 && (
        <motion.section variants={sectionVariants}>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
            Detailed Infringements{' '}
            <span className="text-neutral-500 font-normal">({result.violations.length})</span>
          </h2>
          <div className="space-y-3">
            {result.violations.map((v, i) => (
              <ViolationCard key={v.id} violation={v} index={i} />
            ))}
          </div>
        </motion.section>
      )}

      {/* ── AI Recommendations ───────────────────────────────────────────── */}
      {result.recommendations.length > 0 && (
        <motion.section variants={sectionVariants}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-[#E50914] flex items-center justify-center">
              <Info className="w-3 h-3 text-white" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              AI Recommendations & Guidance{' '}
              <span className="text-neutral-500 font-normal">({result.recommendations.length})</span>
            </h2>
          </div>
          <div className="space-y-3">
            {result.recommendations.map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Passed Checks ────────────────────────────────────────────────── */}
      {result.passedChecks.length > 0 && (
        <motion.div variants={sectionVariants}>
          <PassedChecks checks={result.passedChecks} />
        </motion.div>
      )}

      {/* ── Action Buttons ────────────────────────────────────────────────── */}
      <motion.div
        variants={sectionVariants}
        className="flex flex-col sm:flex-row gap-3 pt-2"
      >
        <button
          onClick={handleAnalyseAgain}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-md bg-[#E50914] text-white font-bold hover:bg-[#b80710] shadow-lg shadow-red-950/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Verify Another Banner
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-md border border-white/10 bg-[#252525] text-white font-semibold hover:bg-[#303030] transition-colors"
        >
          Return to Dashboard
        </button>
        <button
          onClick={() => downloadReport(result)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-md border border-white/10 bg-[#252525] text-white font-semibold hover:bg-[#303030] transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </motion.div>
    </motion.div>
  );
}
