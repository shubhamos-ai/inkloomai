'use client';
import { Check, User, Building2, Brain } from 'lucide-react';
import { motion } from 'framer-motion';

interface OnboardingProgressProps {
  currentStep: number;
}

const STEPS = [
  { id: 1, label: 'Identity', icon: User },
  { id: 2, label: 'Enterprise', icon: Building2 },
  { id: 3, label: 'Brand Rules', icon: Brain },
];

export default function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <div className="flex items-center gap-0 select-none">
      {STEPS.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isActive = currentStep === step.id;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isCompleted
                    ? '#059669'
                    : isActive
                    ? '#E50914'
                    : '#1F1F1F',
                  borderColor: isCompleted
                    ? '#10b981'
                    : isActive
                    ? '#E50914'
                    : '#333333',
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg"
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25, ease: 'backOut' }}
                  >
                    <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </motion.div>
                ) : (
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-500'}`}
                    strokeWidth={2}
                  />
                )}
              </motion.div>

              {/* Step Label */}
              <span
                className={`mt-1 text-[10px] font-bold uppercase tracking-wider hidden sm:block whitespace-nowrap ${
                  isActive
                    ? 'text-[#E50914]'
                    : isCompleted
                    ? 'text-emerald-400'
                    : 'text-neutral-500'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector Line */}
            {index < STEPS.length - 1 && (
              <div className="relative w-10 sm:w-16 h-[2px] mx-1 mb-3 sm:mb-0 bg-neutral-800 overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ width: currentStep > step.id ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="absolute top-0 left-0 h-full bg-[#E50914]"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
