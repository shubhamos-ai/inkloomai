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
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: '#E50914' }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-neutral-600">
        <span>Account</span>
        <span>Name</span>
        <span>Company</span>
        <span>Rules</span>
        <span>Ready</span>
      </div>
    </div>
  );
}
