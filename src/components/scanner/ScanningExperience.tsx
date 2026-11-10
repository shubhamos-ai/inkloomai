'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine,
  Type,
  Layers,
  Shield,
  AlertTriangle,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { getAnalysisJobStatus } from '@/lib/api';
import type { AnalysisStatus } from '@/types/analysis';
import ScanningImage from './ScanningImage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanningExperienceProps {
  jobId: string;
  imagePreviewUrl: string | null;
  onComplete: (resultId: string) => void;
  onFailed: () => void;
}

type StageState = 'pending' | 'active' | 'completed';

interface Stage {
  id: number;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: Stage[] = [
  { id: 0, label: 'Analysing visual composition', Icon: ScanLine },
  { id: 1, label: 'Extracting advertisement text', Icon: Type },
  { id: 2, label: 'Identifying brand elements', Icon: Layers },
  { id: 3, label: 'Checking company advertising policies', Icon: Shield },
  { id: 4, label: 'Detecting brand violations', Icon: AlertTriangle },
  { id: 5, label: 'Generating compliance report', Icon: FileText },
];

const POLL_INTERVAL_MS = 1500;
const MIN_DISPLAY_MS = 3000;

/** How many stages should appear completed for a given backend status */
const STATUS_STAGE_MAP: Record<string, number> = {
  queued: 0,
  processing: 2,
  completed: STAGES.length,
  failed: 0,
  cancelled: 0,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageIcon({
  stageState,
  Icon,
}: {
  stageState: StageState;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  if (stageState === 'completed') {
    return (
      <motion.div
        key="check"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 20 }}
      >
        <CheckCircle className="w-5 h-5 text-emerald-600" />
      </motion.div>
    );
  }

  if (stageState === 'active') {
    return (
      <motion.div
        key="spinner"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Loader2 className="w-5 h-5 text-[#E50914] animate-spin" />
      </motion.div>
    );
  }

  // pending
  return (
    <div className="w-5 h-5 flex items-center justify-center">
      <Icon className="w-4 h-4 text-slate-300" />
    </div>
  );
}

function StageRow({
  stage,
  stageState,
  index,
}: {
  stage: Stage;
  stageState: StageState;
  index: number;
}) {
  const isActive = stageState === 'active';
  const isCompleted = stageState === 'completed';
  const isPending = stageState === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: 'easeOut' }}
      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-300 ${
        isActive
          ? 'bg-red-50/80 border border-red-200/80 shadow-sm'
          : isCompleted
          ? 'bg-white/60 border border-emerald-100/60'
          : 'border border-transparent'
      }`}
    >
      {/* Stage icon */}
      <div className="flex-shrink-0 w-5 h-5">
        <AnimatePresence mode="wait">
          <StageIcon
            key={stageState}
            stageState={stageState}
            Icon={stage.Icon}
          />
        </AnimatePresence>
      </div>

      {/* Label */}
      <span
        className={`text-sm font-medium transition-colors duration-300 ${
          isCompleted
            ? 'text-emerald-700 font-semibold'
            : isActive
            ? 'text-red-900 font-semibold'
            : 'text-slate-400'
        }`}
      >
        {stage.label}
      </span>

      {/* Completed indicator */}
      {isCompleted && (
        <motion.div
          className="flex-1 h-px bg-emerald-200 ml-auto max-w-[32px]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{ originX: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
      {isActive && (
        <span className="ml-auto text-[10px] font-mono tracking-wider font-semibold text-[#E50914] bg-red-100/80 px-2 py-0.5 rounded-full animate-pulse">
          AUDITING
        </span>
      )}
    </motion.div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden border border-stone-200 p-[1px]">
      <motion.div
        className="h-full rounded-full"
        style={{
          background: 'linear-gradient(90deg, #E50914, #B81D24)',
          boxShadow: '0 0 10px rgba(229,9,20,0.5)',
        }}
        initial={{ width: '0%' }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}

function ErrorState({ onFailed }: { onFailed: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-4 py-8 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
        <XCircle className="w-7 h-7 text-[#E50914]" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-stone-900">
          Analysis Failed
        </h3>
        <p className="mt-1 text-sm text-stone-500 max-w-xs mx-auto">
          We encountered an issue communicating with the AI cluster. Please verify backend status and try again.
        </p>
      </div>
      <button
        onClick={onFailed}
        className="mt-2 px-5 py-2.5 bg-[#E50914] hover:bg-[#B81D24] text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow"
      >
        Try Again
      </button>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusLabel(status: AnalysisStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued — waiting to process…';
    case 'processing':
      return 'Processing…';
    case 'completed':
      return 'Finalising report…';
    case 'failed':
      return 'Analysis failed';
    case 'cancelled':
      return 'Analysis cancelled';
    default:
      return 'Processing…';
  }
}

function computeStageStates(completedCount: number): StageState[] {
  return STAGES.map((_, i) => {
    if (i < completedCount) return 'completed';
    if (i === completedCount && completedCount < STAGES.length) return 'active';
    return 'pending';
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScanningExperience({
  jobId,
  imagePreviewUrl,
  onComplete,
  onFailed,
}: ScanningExperienceProps) {
  const [status, setStatus] = useState<AnalysisStatus>('queued');
  const [completedStages, setCompletedStages] = useState(0);
  const [isError, setIsError] = useState(false);
  const [isScanning, setIsScanning] = useState(true);

  // Track when the component mounted for minimum display time enforcement
  const mountTimeRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolvedRef = useRef(false); // prevent double-fire of onComplete/onFailed

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleComplete = useCallback(
    (resultId: string) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      stopPolling();

      // Ensure stages complete visually first
      setCompletedStages(STAGES.length);
      setIsScanning(false);

      const elapsed = Date.now() - mountTimeRef.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      setTimeout(() => {
        onComplete(resultId);
      }, remaining);
    },
    [onComplete, stopPolling]
  );

  const handleFailed = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    stopPolling();
    setIsScanning(false);
    setIsError(true);

    setTimeout(() => {
      onFailed();
    }, 2000);
  }, [onFailed, stopPolling]);

  useEffect(() => {
    // Progressively advance stages on a visual timer, independent of polling
    // This ensures smooth stage progression even if the backend is slow
    const stageAdvanceInterval = setInterval(() => {
      setCompletedStages((prev) => {
        // Don't advance beyond "processing" stages (first 3) until backend confirms
        if (prev < 3) return prev + 1;
        return prev;
      });
    }, 1800);

    return () => clearInterval(stageAdvanceInterval);
  }, []);

  useEffect(() => {
    let isActive = true;

    const poll = async () => {
      try {
        const result = await getAnalysisJobStatus(jobId);

        if (!isActive) return;

        setStatus(result.status);

        const backendStages = STATUS_STAGE_MAP[result.status] ?? 0;
        setCompletedStages((prev) => Math.max(prev, backendStages));

        if (result.status === 'completed') {
          const finalId = result.result?.id || result.jobId || jobId;
          handleComplete(finalId);
        } else if (
          result.status === 'failed' ||
          result.status === 'cancelled'
        ) {
          handleFailed();
        }
      } catch {
        // Network blip — keep polling silently
      }
    };

    // Poll immediately, then on interval
    void poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      stopPolling();
    };
  }, [jobId, handleComplete, handleFailed, stopPolling]);

  const stageStates = computeStageStates(completedStages);
  const progress = Math.round((completedStages / STAGES.length) * 100);
  const activeStage = STAGES[Math.min(completedStages, STAGES.length - 1)];

  return (
    <div className="w-full max-w-5xl mx-auto">
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* ── LEFT: Image panel ── */}
        <div className="flex flex-col gap-4">
          <div className="relative aspect-[4/3] w-full">
            <ScanningImage
              imageUrl={imagePreviewUrl}
              isScanning={isScanning}
            />
          </div>

          {/* Subtle footer note */}
          <p className="text-xs text-slate-400 text-center">
            Your advertisement is being processed securely.
          </p>
        </div>

        {/* ── RIGHT: Progress panel ── */}
        <div className="flex flex-col justify-center">
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 lg:p-8">
            <AnimatePresence mode="wait">
              {isError ? (
                <ErrorState key="error" onFailed={onFailed} />
              ) : (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-5"
                >
                  {/* Header */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 border border-red-200 text-[#E50914]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-ping" />
                        AI Multimodal Audit
                      </span>
                    </div>
                    <motion.h2
                      className="text-xl font-bold text-stone-900 leading-snug tracking-tight"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.4 }}
                    >
                      Auditing Creative Compliance
                    </motion.h2>
                    <motion.p
                      className="mt-1 text-sm text-stone-500 leading-relaxed"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18, duration: 0.4 }}
                    >
                      Evaluating advertisement against your active company brand rules and regulatory constraints.
                    </motion.p>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-stone-100" />

                  {/* Stage list */}
                  <div className="flex flex-col gap-0.5">
                    {STAGES.map((stage, i) => (
                      <StageRow
                        key={stage.id}
                        stage={stage}
                        stageState={stageStates[i]}
                        index={i}
                      />
                    ))}
                  </div>

                  {/* Progress bar section */}
                  <div className="flex flex-col gap-2">
                    <ProgressBar progress={progress} />

                    <div className="flex items-center justify-between">
                      <motion.p
                        key={activeStage?.label}
                        className="text-xs font-semibold text-[#E50914] truncate max-w-[220px]"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {activeStage?.label ?? 'Finalising…'}
                      </motion.p>

                      <motion.span
                        key={progress}
                        className="text-xs font-semibold text-stone-500 ml-2 tabular-nums flex-shrink-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {progress}%
                      </motion.span>
                    </div>
                  </div>

                  {/* Status label */}
                  <div className="flex items-center gap-2 pt-1">
                    <Loader2 className="w-3.5 h-3.5 text-[#E50914] animate-spin flex-shrink-0" />
                    <motion.span
                      key={status}
                      className="text-xs text-stone-600 font-medium"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {getStatusLabel(status)}
                    </motion.span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
