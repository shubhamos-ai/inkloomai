'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

interface StepAuthProps {
  onSubmit: (values: { email: string; password: string; mode: 'login' | 'signup' }) => Promise<string | null>;
  initialMode?: 'login' | 'signup';
}

const RED = '#E50914';

export default function StepAuth({ onSubmit, initialMode = 'signup' }: StepAuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // /login and /register read the desired mode after mount, so react to the
  // prop changing instead of only honouring it as the initial value.
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passOk = password.length >= (mode === 'signup' ? 8 : 1);
  const valid = emailOk && passOk;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit({ email: email.trim().toLowerCase(), password, mode });
    setBusy(false);
    if (message) setError(message);
  };

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setTouched(false);
    setError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="w-full max-w-md mx-auto"
    >
      {/* Card */}
      <div className="rounded-2xl bg-white p-8 sm:p-10 border border-[#E8E2D9] shadow-[0_12px_40px_rgba(26,24,22,0.06)]">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-6 border border-red-100">
          <Lock className="w-5 h-5 text-[#E50914]" />
        </div>
        <h1 className="text-neutral-900 text-3xl font-black mb-2 tracking-tight">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-neutral-500 text-sm mb-8">
          {mode === 'signup'
            ? 'One enterprise workspace. Every creative governed against brand rules.'
            : 'Sign in to access your advertising compliance dashboard.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                autoComplete="email"
                placeholder="Work email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-xl bg-[#FAF8F5] border ${
                  touched && !emailOk ? 'border-[#E50914]' : 'border-[#E0D8CB]'
                } pl-11 pr-4 py-3.5 text-neutral-900 placeholder-neutral-400 outline-none
                   focus:border-[#E50914] focus:bg-white transition-all text-sm`}
              />
            </div>
            {touched && !emailOk && (
              <p className="mt-1.5 text-xs text-[#E50914] font-medium">Enter a valid email address.</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="Password (minimum 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-xl bg-[#FAF8F5] border ${
                  touched && !passOk ? 'border-[#E50914]' : 'border-[#E0D8CB]'
                } pl-11 pr-11 py-3.5 text-neutral-900 placeholder-neutral-400 outline-none
                   focus:border-[#E50914] focus:bg-white transition-all text-sm`}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {touched && !passOk && (
              <p className="mt-1.5 text-xs text-[#E50914] font-medium">
                {mode === 'signup' ? 'Password must be at least 8 characters.' : 'Enter your password.'}
              </p>
            )}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-[#E50914] font-medium"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl font-bold py-3.5 transition-all text-white
                       shadow-lg shadow-red-500/25 hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
            style={{ backgroundColor: RED }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'signup' ? 'Continue with Email' : 'Sign In'}
            </span>
          </button>
        </form>

        {/* Toggle mode */}
        <p className="mt-6 text-sm text-neutral-500 text-center">
          {mode === 'signup' ? 'Already have a workspace?' : 'New organisation?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
            className="text-[#E50914] font-bold hover:underline"
          >
            {mode === 'signup' ? 'Sign in' : 'Create workspace'}
          </button>
        </p>
        <p className="mt-5 text-xs text-neutral-400 text-center leading-relaxed">
          Your credentials and brand workspaces are isolated and secured with end-to-end multi-tenant encryption.
        </p>
      </div>
    </motion.div>
  );
}
