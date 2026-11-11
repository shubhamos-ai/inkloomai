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
  Cpu,
  FileText,
  Clock,
  BookOpen,
  ScanLine,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ScoreRing from '@/components/ui/ScoreRing';
import type { AnalysisResult, Violation, AIRecommendation, ComplianceLevel, ViolationSeverity, AnalysisMetadata } from '@/types/analysis';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMPLIANCE_LABELS: Record<ComplianceLevel, string> = {
  excellent: 'Excellent',
  needs_minor_improvements: 'Needs Minor Improvements',
  needs_revision: 'Needs Revision',
  non_compliant: 'Non-Compliant',
  inconclusive: 'Inconclusive',
};

const COMPLIANCE_BADGE: Record<ComplianceLevel, string> = {
  excellent: 'bg-green-50 text-green-700 border-green-200',
  needs_minor_improvements: 'bg-blue-50 text-blue-700 border-blue-200',
  needs_revision: 'bg-amber-50 text-amber-700 border-amber-200',
  non_compliant: 'bg-red-50 text-red-700 border-red-200',
  inconclusive: 'bg-slate-100 text-slate-600 border-slate-300',
};

const SEVERITY_CONFIG: Record<
  ViolationSeverity,
  { label: string; badge: string; border: string; icon: React.ReactNode; boxBorder: string }
> = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-50 text-red-700 border-red-200',
    border: 'border-red-200',
    icon: <XCircle className="w-4 h-4 text-red-600" />,
    boxBorder: '#dc2626',
  },
  major: {
    label: 'Major',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    border: 'border-orange-200',
    icon: <AlertTriangle className="w-4 h-4 text-orange-600" />,
    boxBorder: '#ea580c',
  },
  minor: {
    label: 'Minor',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    border: 'border-amber-200',
    icon: <Info className="w-4 h-4 text-amber-600" />,
    boxBorder: '#d97706',
  },
  passed: {
    label: 'Passed',
    badge: 'bg-green-50 text-green-700 border-green-200',
    border: 'border-green-200',
    icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
    boxBorder: '#16a34a',
  },
};

const PRIORITY_BADGE: Record<AIRecommendation['priority'], string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
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
  colour: string; // tailwind text colour
  bg: string;    // tailwind bg colour
  icon: React.ReactNode;
}

function SummaryCard({ count, label, colour, bg, icon }: SummaryCardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 ${bg} p-4 flex flex-col items-center text-center gap-1`}>
      <div className="mb-1">{icon}</div>
      <span className={`text-3xl font-bold ${colour}`}>{count}</span>
      <span className="text-xs font-medium text-slate-600 leading-tight">{label}</span>
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
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className={`rounded-2xl border ${cfg.border} bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-stone-100">
        <div className="mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`}
            >
              {cfg.label}
            </span>
            <span className="text-xs font-mono font-medium text-stone-400">
              Rule #{violation.ruleId}
            </span>
          </div>
          <h4 className="font-semibold text-stone-900 text-sm">{violation.title}</h4>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Explanation */}
        <p className="text-sm text-stone-700 leading-relaxed">{violation.explanation}</p>

        {/* Relevant Rule */}
        <div className="rounded-xl bg-stone-50 border border-stone-200/70 px-4 py-3">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
            Active Brand Constraint · <span className="normal-case font-mono">{violation.ruleId}</span>
          </p>
          <p className="text-sm text-stone-800 leading-relaxed font-medium">{violation.relevantRule}</p>
        </div>

        {/* Evidence */}
        {violation.evidence && (
          <div className="rounded-xl border-l-4 border-[#E50914] bg-red-50/60 px-4 py-3">
            <p className="text-xs font-semibold text-[#E50914] uppercase tracking-wider mb-1">Detected Evidence</p>
            <blockquote className="text-sm text-red-950 italic">&ldquo;{violation.evidence}&rdquo;</blockquote>
          </div>
        )}

        {/* Suggested correction */}
        {violation.suggestedCorrection && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
              Remediation Action
            </p>
            <p className="text-sm text-emerald-950 leading-relaxed font-medium">{violation.suggestedCorrection}</p>
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
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
    >
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${PRIORITY_BADGE[rec.priority]}`}
          >
            {rec.priority} priority
          </span>
        </div>
        <h4 className="font-semibold text-slate-900 text-sm mt-1">{rec.what}</h4>
      </div>

      <div className="px-5 py-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Why</p>
          <p className="text-sm text-blue-900 leading-relaxed">{rec.why}</p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">How to fix</p>
          <p className="text-sm text-green-900 leading-relaxed">{rec.how}</p>
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
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-600" />
          <h2 className="font-semibold text-slate-900">Visual Evidence</h2>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Annotated bounding boxes mark detected violations</p>
      </div>

      <div className="p-6">
        <div className="relative inline-block max-w-full">
          {result.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.imageUrl}
              alt={result.advertisementName}
              className="rounded-xl max-w-full max-h-[480px] object-contain border border-slate-200"
            />
          ) : (
            <div className="w-full h-72 rounded-xl bg-slate-100 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Image className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-500">No preview available</p>
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
                        className="absolute top-0 left-0 -translate-y-full text-white text-xs px-1.5 py-0.5 rounded-t font-medium leading-tight"
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
              <div key={sev} className="flex items-center gap-1.5 text-xs text-slate-600">
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
    <section className="rounded-2xl border border-green-200 bg-green-50 overflow-hidden">
      <div className="px-6 py-4 border-b border-green-100">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <h2 className="font-semibold text-green-900">
            Passed Checks <span className="font-normal text-green-700">({checks.length})</span>
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
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-green-900">{check}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {checks.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-green-700 font-medium mt-2 hover:text-green-900 transition-colors"
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

// ─── AI Metadata Panel ────────────────────────────────────────────────────────

function AIMetadataPanel({ meta }: { meta: AnalysisMetadata }) {
  const [expanded, setExpanded] = useState(false);
  const hasOcr = meta.ocr_text && meta.ocr_text.trim() !== '' && meta.ocr_text !== 'none';
  const hasObs = Array.isArray(meta.vision_observations) && meta.vision_observations.length > 0;

  if (!hasOcr && !hasObs && !meta.model && !meta.duration_ms) return null;

  return (
    <section className="rounded-2xl border border-purple-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-purple-100 hover:bg-purple-50/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-white" />
          </div>
          <h2 className="font-semibold text-slate-900 text-sm">AI Engine Observations</h2>
          {meta.is_mock && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
              Mock
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Quick stats */}
          {meta.model && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
              <ScanLine className="w-3 h-3" /> {meta.model}
            </span>
          )}
          {meta.duration_ms && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" /> {(meta.duration_ms / 1000).toFixed(1)}s
            </span>
          )}
          {meta.brand_rules_count !== undefined && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
              <BookOpen className="w-3 h-3" /> {meta.brand_rules_count} rules
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-6 py-5 space-y-5">
              {/* Engine info row */}
              <div className="flex flex-wrap gap-4 text-sm">
                {meta.engine && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    <span className="font-medium">Engine:</span> {meta.engine}
                  </div>
                )}
                {meta.model && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <ScanLine className="w-4 h-4 text-purple-500" />
                    <span className="font-medium">Model:</span>
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{meta.model}</span>
                  </div>
                )}
                {meta.duration_ms && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span className="font-medium">Duration:</span> {(meta.duration_ms / 1000).toFixed(2)}s
                  </div>
                )}
                {meta.brand_rules_count !== undefined && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                    <span className="font-medium">Brand Rules Checked:</span> {meta.brand_rules_count}
                  </div>
                )}
                {meta.ocr_source && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <FileText className="w-4 h-4 text-purple-500" />
                    <span className="font-medium">OCR Source:</span> {meta.ocr_source}
                  </div>
                )}
              </div>

              {/* Vision Observations table */}
              {hasObs && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Vision Observations ({meta.vision_observations!.length})
                  </h3>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Attribute</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {meta.vision_observations!.map((obs, i) => (
                          <tr key={i} className="hover:bg-purple-50/40 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{obs.subject}</td>
                            <td className="px-4 py-2.5 text-slate-600">{obs.attribute}</td>
                            <td className="px-4 py-2.5 text-slate-700">{obs.value}</td>
                            <td className="px-4 py-2.5 text-right">
                              {obs.confidence !== undefined ? (
                                <span className={`text-xs font-semibold ${obs.confidence >= 0.8 ? 'text-green-600' : obs.confidence >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {Math.round(obs.confidence * 100)}%
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* OCR Text */}
              {hasOcr && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Extracted Text (OCR)
                  </h3>
                  <pre className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 whitespace-pre-wrap font-mono leading-relaxed">
                    {meta.ocr_text}
                  </pre>
                </div>
              )}

              {/* Notes */}
              {meta.notes && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Engine Notes</p>
                  <p className="text-sm text-amber-900">{meta.notes}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  lines.push('Generated by Inkloom AI · inkloom.ai');
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
      className="space-y-6 pb-12"
    >
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <motion.div variants={sectionVariants} className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to History
          </button>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Advertisement Analysis Report
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadReport(result)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={handleAnalyseAgain}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Analyse Again
          </button>
        </div>
      </motion.div>

      {/* ── Metadata Bar ────────────────────────────────────────────────── */}
      <motion.div
        variants={sectionVariants}
        className="rounded-2xl border border-slate-200 bg-white px-6 py-4"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-800">{result.companyName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4 text-slate-400" />
            {formatDate(result.analysedAt)}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="font-mono text-xs text-slate-500">{result.id}</span>
          </div>
          <span
            className={`ml-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${COMPLIANCE_BADGE[result.complianceLevel]}`}
          >
            {COMPLIANCE_LABELS[result.complianceLevel]}
          </span>
        </div>
      </motion.div>

      {/* ── Ad Preview + Score ───────────────────────────────────────────── */}
      <motion.div
        variants={sectionVariants}
        className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row">
          {/* Thumbnail */}
          <div className="lg:w-1/2 p-6 flex items-center justify-center bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-100 min-h-[220px]">
            {result.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.imageUrl}
                alt={result.advertisementName}
                className="rounded-xl max-h-72 max-w-full object-contain shadow-sm"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="w-20 h-20 rounded-2xl bg-slate-200 flex items-center justify-center">
                  <Image className="w-9 h-9 text-slate-400" />
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
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${COMPLIANCE_BADGE[result.complianceLevel]}`}
              >
                {COMPLIANCE_LABELS[result.complianceLevel]}
              </span>
              <p className="text-sm text-slate-600 leading-relaxed max-w-sm text-center">
                {result.summary}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Violation Summary Cards ──────────────────────────────────────── */}
      <motion.div variants={sectionVariants}>
        <h2 className="text-base font-semibold text-slate-900 mb-3">Violation Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            count={critical}
            label="Critical Violations"
            colour="text-red-600"
            bg="bg-red-50"
            icon={<XCircle className="w-5 h-5 text-red-500" />}
          />
          <SummaryCard
            count={major}
            label="Major Violations"
            colour="text-orange-600"
            bg="bg-orange-50"
            icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
          />
          <SummaryCard
            count={minor}
            label="Minor Violations"
            colour="text-amber-600"
            bg="bg-amber-50"
            icon={<Info className="w-5 h-5 text-amber-500" />}
          />
          <SummaryCard
            count={result.passedChecks.length}
            label="Passed Checks"
            colour="text-green-600"
            bg="bg-green-50"
            icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
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
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            Detailed Violations{' '}
            <span className="text-slate-400 font-normal">({result.violations.length})</span>
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
            <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center">
              <Info className="w-3 h-3 text-white" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              AI Recommendations{' '}
              <span className="text-slate-400 font-normal">({result.recommendations.length})</span>
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

      {/* ── AI Engine Observations ───────────────────────────────────────── */}
      {result.metadata && (
        <motion.div variants={sectionVariants}>
          <AIMetadataPanel meta={result.metadata} />
        </motion.div>
      )}

      {/* ── Action Buttons ────────────────────────────────────────────────── */}
      <motion.div
        variants={sectionVariants}
        className="flex flex-col sm:flex-row gap-3 pt-2"
      >
        <button
          onClick={handleAnalyseAgain}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Analyse Again
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors"
        >
          Back to Dashboard
        </button>
        <button
          onClick={() => downloadReport(result)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Report
        </button>
      </motion.div>
    </motion.div>
  );
}
