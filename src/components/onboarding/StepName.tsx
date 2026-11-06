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
      <div className="rounded-xl bg-black/60 p-8 sm:p-10 border border-white/10 shadow-2xl backdrop-blur-sm">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
             style={{ backgroundColor: '#E5091420' }}>
          <User className="w-6 h-6" style={{ color: '#E50914' }} />
        </div>
        <h1 className="text-white text-3xl font-bold mb-2 tracking-tight">
          What should we call you?
        </h1>
        <p className="text-neutral-400 text-sm mb-8">
          This is how you&apos;ll appear on reports and to your team.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <input
            autoFocus
            type="text"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-md bg-neutral-800/80 border ${
              showError ? 'border-[#E50914]' : 'border-white/15'
            } px-4 py-3.5 text-white placeholder-neutral-500 outline-none
               focus:border-neutral-300 focus:bg-neutral-800 transition-colors`}
          />
          {showError && (
            <p className="mt-1.5 text-xs text-[#EB3942]">Name needs at least 2 characters.</p>
          )}

          <button
            type="submit"
            disabled={!isValid}
            className="w-full mt-6 rounded-md font-semibold py-3.5 text-white transition-all
                       shadow-lg hover:brightness-110 active:scale-[0.99] disabled:opacity-30"
            style={{ backgroundColor: '#E50914' }}
          >
            Continue
          </button>
        </form>
      </div>
    </motion.div>
  );
}
