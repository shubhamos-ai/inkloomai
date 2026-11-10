'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';

interface StepNameProps {
  onSubmit: (name: string) => void;
  initialName?: string;
}

export default function StepName({ onSubmit, initialName = '' }: StepNameProps) {
  const [name, setName] = useState(initialName);
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const isValid = trimmed.length >= 2;
  const showError = touched && !isValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (isValid) onSubmit(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="w-full max-w-md mx-auto"
    >
      <div className="rounded-2xl bg-white p-8 sm:p-10 border border-[#E8E2D9] shadow-[0_12px_40px_rgba(26,24,22,0.06)]">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-red-50 border border-red-100">
          <User className="w-6 h-6" style={{ color: '#E50914' }} />
        </div>
        <h1 className="text-neutral-900 text-3xl font-black mb-2 tracking-tight">
          What should we call you?
        </h1>
        <p className="text-neutral-500 text-sm mb-8">
          This is how you&apos;ll appear on reports and to your team.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <input
            autoFocus
            type="text"
            autoComplete="name"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-xl bg-[#FAF8F5] border ${
              showError ? 'border-[#E50914]' : 'border-[#E0D8CB]'
            } px-4 py-3.5 text-neutral-900 placeholder-neutral-400 outline-none
               focus:border-[#E50914] focus:bg-white transition-all text-sm`}
          />
          {showError && (
            <p className="mt-1.5 text-xs text-[#E50914] font-medium">Name needs at least 2 characters.</p>
          )}

          <button
            type="submit"
            disabled={!isValid}
            className="w-full mt-6 rounded-xl font-bold py-3.5 text-white transition-all
                       shadow-lg shadow-red-500/25 hover:brightness-105 active:scale-[0.99] disabled:opacity-30"
            style={{ backgroundColor: '#E50914' }}
          >
            Continue
          </button>
        </form>
      </div>
    </motion.div>
  );
}
