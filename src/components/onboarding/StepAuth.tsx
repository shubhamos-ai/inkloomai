'use client';
import { useState } from 'react';
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
      <div className="rounded-xl bg-black/60 p-8 sm:p-10 border border-white/10 shadow-2xl backdrop-blur-sm">
        <h1 className="text-white text-3xl font-bold mb-2 tracking-tight">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-neutral-400 text-sm mb-8">
          {mode === 'signup'
            ? 'One account. Every ad your brand runs — governed in one place.'
            : 'Sign in to pick up where your brand left off.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-md bg-neutral-800/80 border ${
                  touched && !emailOk ? 'border-[#E50914]' : 'border-white/15'
                } pl-11 pr-4 py-3.5 text-white placeholder-neutral-500 outline-none
                   focus:border-neutral-300 focus:bg-neutral-800 transition-colors`}
              />
            </div>
            {touched && !emailOk && (
              <p className="mt-1.5 text-xs text-[#EB3942]">Enter a valid email address.</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-md bg-neutral-800/80 border ${
                  touched && !passOk ? 'border-[#E50914]' : 'border-white/15'
                } pl-11 pr-11 py-3.5 text-white placeholder-neutral-600 outline-none
                   focus:border-neutral-300 focus:bg-neutral-800 transition-colors`}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {touched && !passOk && (
              <p className="mt-1.5 text-xs text-[#EB3942]">
                {mode === 'signup' ? 'Password must be at least 8 characters.' : 'Enter your password.'}
              </p>
            )}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md bg-[#E50914]/15 border border-[#E50914]/40 px-4 py-3 text-sm text-[#FF6B6B]"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md font-semibold py-3.5 transition-all text-white
                       shadow-lg hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            style={{ backgroundColor: RED }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'signup' ? 'Sign Up — Continue' : 'Sign In'}
            </span>
          </button>
        </form>

        {/* Toggle mode */}
        <p className="mt-6 text-sm text-neutral-400">
          {mode === 'signup' ? 'Already have an account?' : 'New to Inkloom?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
            className="text-white font-medium hover:underline"
          >
            {mode === 'signup' ? 'Sign in' : 'Sign up'}
          </button>
        </p>
        <p className="mt-4 text-xs text-neutral-600 leading-relaxed">
          Your credentials and brand workspaces are isolated and secured with end-to-end multi-tenant encryption.
        </p>
      </div>
    </motion.div>
  );
}
