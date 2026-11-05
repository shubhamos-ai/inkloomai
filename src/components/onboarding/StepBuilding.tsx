'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

interface StepBuildingProps {
  onComplete: () => void;
  companyName: string;
}

const STAGES = [
  { id: 1, label: 'Receiving brand guidelines', duration: 1000 },
  { id: 2, label: 'Processing company policies', duration: 1200 },
  { id: 3, label: 'Organising brand requirements', duration: 1200 },
  { id: 4, label: 'Preparing your Brand Brain', duration: 1400 },
  { id: 5, label: 'Finalising your workspace', duration: 1000 },
];

const TOTAL_DURATION = STAGES.reduce((acc, s) => acc + s.duration, 0); // ~5800ms

export default function StepBuilding({ onComplete, companyName }: StepBuildingProps) {
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [activeStage, setActiveStage] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    STAGES.forEach((stage, index) => {
      const delay = elapsed;
      timers.push(
        setTimeout(() => {
          setActiveStage(index + 1);
        }, delay)
      );
      elapsed += stage.duration;
      const afterDelay = elapsed;
      timers.push(
        setTimeout(() => {
          setCompletedStages(prev => [...prev, stage.id]);
        }, afterDelay - 200)
      );
    });

    // Smooth progress bar
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const pct = Math.min(((Date.now() - startTime) / TOTAL_DURATION) * 100, 100);
      setProgress(pct);
    }, 60);

    // Complete after all stages
    const completionTimer = setTimeout(() => {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => onComplete(), 600);
    }, TOTAL_DURATION + 400);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(completionTimer);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-slate-50 to-blue-50/30"
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="flex items-center gap-2.5 mb-14"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="font-bold text-xl text-slate-900 tracking-tight">Inkloom AI</span>
      </motion.div>

      {/* Circular Progress */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5, ease: 'backOut' }}
        className="relative mb-10"
      >
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          {/* Background track */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <motion.circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#2563EB"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.3, ease: 'linear' }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {progress >= 100 ? (
              <motion.div
                key="done"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: 'backOut' }}
              >
                <Check className="w-10 h-10 text-blue-600" strokeWidth={2.5} />
              </motion.div>
            ) : (
              <motion.div
                key="pct"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <span className="text-2xl font-bold text-slate-900">
                  {Math.round(progress)}%
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-center mb-10 max-w-md"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
          Building your Personalised{' '}
          <span className="text-blue-600">Advertising Manager</span>
        </h1>
        <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
          Organising{companyName ? ` ${companyName}'s` : ' your'} brand knowledge and preparing your AI workspace.
        </p>
      </motion.div>

      {/* Stage List */}
      <motion.ul
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="w-full max-w-sm space-y-3"
      >
        {STAGES.map((stage, index) => {
          const isComplete = completedStages.includes(stage.id);
          const isActive = activeStage === index + 1 && !isComplete;

          return (
            <motion.li
              key={stage.id}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
                isComplete
                  ? 'bg-green-50 border-green-100'
                  : isActive
                  ? 'bg-blue-50 border-blue-100'
                  : 'bg-white border-slate-100 opacity-50'
              }`}
            >
              {/* Status Icon */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isComplete ? 'bg-green-500' : isActive ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <AnimatePresence mode="wait">
                  {isComplete ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2, ease: 'backOut' }}
                    >
                      <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      key="spinner"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </motion.div>
                  ) : (
                    <motion.span
                      key="num"
                      className="text-xs font-semibold text-slate-400"
                    >
                      {stage.id}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Label */}
              <span
                className={`text-sm font-medium transition-colors ${
                  isComplete ? 'text-green-700' : isActive ? 'text-blue-700' : 'text-slate-400'
                }`}
              >
                {stage.label}
              </span>

              {/* Complete badge */}
              <AnimatePresence>
                {isComplete && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="ml-auto text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full"
                  >
                    Done
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </motion.ul>

      {/* Footer hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="mt-10 text-xs text-slate-400 text-center"
      >
        This usually takes just a few seconds…
      </motion.p>
    </motion.div>
  );
}
