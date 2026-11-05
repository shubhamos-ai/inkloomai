'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, User, Sparkles } from 'lucide-react';

interface StepPersonalProps {
  onNext: (name: string) => void;
  initialName?: string;
}

export default function StepPersonal({ onNext, initialName = '' }: StepPersonalProps) {
  const [name, setName] = useState(initialName);
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const isValid = trimmed.length >= 2;
  const showError = touched && !isValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (isValid) onNext(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="max-w-lg mx-auto px-6"
    >
      {/* Icon Badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'backOut' }}
        className="flex justify-center mb-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <User className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">
          Let&apos;s get to know you.
        </h1>
        <p className="text-slate-500 text-base leading-relaxed">
          Your personalised advertising workspace starts here.
        </p>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            autoFocus
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Alex Johnson"
            className={`input-field w-full ${
              showError
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                : ''
            }`}
          />
          {showError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-sm text-red-500"
            >
              Please enter at least 2 characters.
            </motion.p>
          )}
        </div>

        {/* Hint */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 leading-relaxed">
            Your name helps us personalise your AI workspace and generate branded copy that feels uniquely yours.
          </p>
        </div>

        {/* Continue Button */}
        <button
          type="submit"
          disabled={!isValid && touched}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base"
        >
          Continue
          <ChevronRight className="w-5 h-5" />
        </button>
      </motion.form>
    </motion.div>
  );
}
