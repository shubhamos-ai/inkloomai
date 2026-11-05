'use client';
import { Check, User, Building2, Brain } from 'lucide-react';
import { motion } from 'framer-motion';

interface OnboardingProgressProps {
  currentStep: number;
}

const STEPS = [
  { id: 1, label: 'Personal', icon: User },
  { id: 2, label: 'Company', icon: Building2 },
  { id: 3, label: 'Brand Brain', icon: Brain },
];

export default function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <div className="flex items-center gap-0">
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
                    ? '#16a34a'
                    : isActive
                    ? '#2563EB'
                    : '#e2e8f0',
                  borderColor: isCompleted
                    ? '#16a34a'
                    : isActive
                    ? '#2563EB'
                    : '#cbd5e1',
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
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
                    className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`}
                    strokeWidth={2}
                  />
                )}
              </motion.div>

              {/* Step Label */}
              <span
                className={`mt-1 text-[10px] font-medium hidden sm:block whitespace-nowrap ${
                  isActive
                    ? 'text-blue-600'
                    : isCompleted
                    ? 'text-green-600'
                    : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector Line */}
            {index < STEPS.length - 1 && (
              <div className="relative w-10 sm:w-16 h-[2px] mx-1 mb-3 sm:mb-0 bg-slate-200 overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ width: currentStep > step.id ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="absolute top-0 left-0 h-full bg-green-500"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
