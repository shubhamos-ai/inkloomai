'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, ShieldCheck } from 'lucide-react';

interface StepBuildingProps {
  onComplete: () => void;
  companyName: string;
}

const STAGES = [
  { id: 1, label: 'Ingesting corporate advertising policies', duration: 1000 },
  { id: 2, label: 'Mapping constraints to NVIDIA Vision NIM', duration: 1200 },
  { id: 3, label: 'Configuring automated compliance checks', duration: 1200 },
  { id: 4, label: 'Synthesizing enterprise Brand Brain', duration: 1400 },
  { id: 5, label: 'Launching real-time compliance dashboard', duration: 1000 },
];

const TOTAL_DURATION = STAGES.reduce((acc, s) => acc + s.duration, 0);

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
      className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#141414] select-none text-white"
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="flex items-center gap-2.5 mb-12"
      >
        <div className="w-10 h-10 rounded bg-[#E50914] flex items-center justify-center shadow-xl shadow-red-950/60">
          <ShieldCheck size={22} className="text-white" />
        </div>
        <span className="font-extrabold text-xl text-white tracking-tight uppercase">
          Inkloom<span className="text-[#E50914]">AI</span>
        </span>
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
            stroke="#262626"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <motion.circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#E50914"
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
                <Check className="w-10 h-10 text-[#E50914]" strokeWidth={2.5} />
              </motion.div>
            ) : (
              <motion.div
                key="pct"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <span className="text-2xl font-black text-white">
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
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 uppercase">
          Synthesizing <span className="text-[#E50914]">Brand Brain</span>
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          Calibrating neural advertising governance engine for <strong className="text-white">{companyName || 'your enterprise'}</strong>.
        </p>
      </motion.div>

      {/* Stage List */}
      <motion.ul
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="w-full max-w-md space-y-2.5"
      >
        {STAGES.map((stage, index) => {
          const isComplete = completedStages.includes(stage.id);
          const isActive = activeStage === index + 1 && !isComplete;

          return (
            <motion.li
              key={stage.id}
              className={`flex items-center gap-3 p-3.5 rounded-lg border transition-all duration-300 ${
                isComplete
                  ? 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300'
                  : isActive
                  ? 'bg-red-950/30 border-red-900/50 text-white shadow-lg'
                  : 'bg-[#181818] border-white/5 opacity-40 text-neutral-500'
              }`}
            >
              {/* Status Icon */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isComplete ? 'bg-emerald-500' : isActive ? 'bg-[#E50914]' : 'bg-neutral-800'
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
                      className="text-xs font-bold text-neutral-400"
                    >
                      {stage.id}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Label */}
              <span
                className={`text-xs font-semibold tracking-wide transition-colors ${
                  isComplete ? 'text-emerald-300' : isActive ? 'text-white' : 'text-neutral-500'
                }`}
              >
                {stage.label}
              </span>
            </motion.li>
          );
        })}
      </motion.ul>
    </motion.div>
  );
}
