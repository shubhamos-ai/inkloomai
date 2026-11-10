'use client';
import { motion } from 'framer-motion';
import { Check, Building2, User, Brain } from 'lucide-react';

interface OnboardingProgressProps {
  currentStep: number;
  total?: number;
}

/** Slim red progress rail for the Netflix-style onboarding (0..total). */
export default function OnboardingProgress({ currentStep, total = 5 }: OnboardingProgressProps) {
  const pct = Math.max(2, Math.min(100, (currentStep / total) * 100));

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="h-1.5 rounded-full bg-[#E8E2D9] overflow-hidden shadow-inner">
        <motion.div
          className="h-full rounded-full shadow-sm"
          style={{ backgroundColor: '#E50914' }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-2.5 flex justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        <span>Account</span>
        <span>Identity</span>
        <span>Workspace</span>
        <span>Brand Brain</span>
        <span>Launch</span>
      </div>
    </div>
  );
}
