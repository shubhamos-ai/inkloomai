'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, X, Sparkles } from 'lucide-react';
import { useBackend } from '@/context/BackendContext';

export default function BackendStatusBanner() {
  const { status, isOnline, isWaking, recheck } = useBackend();
  const [dismissed, setDismissed] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  // If online, don't obstruct the user (or show brief success then hide)
  if (isOnline || dismissed) return null;

  const handleManualWake = async () => {
    setIsPinging(true);
    await recheck();
    setIsPinging(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-[#FFFBF0] border-b border-[#F0E6D2] px-4 py-2.5 text-xs text-neutral-800 shadow-sm relative z-50"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
            {isWaking ? (
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
            ) : (
              <AlertCircle className="w-4 h-4 text-[#E50914] shrink-0" />
            )}

            <div>
              <span className="font-bold text-neutral-900">
                {isWaking ? 'AI Engine Cluster is waking up…' : 'AI Server Offline'}
              </span>{' '}
              <span className="text-neutral-600">
                {isWaking
                  ? 'Render instances spin down during inactivity and take ~30s to boot. You can freely explore the site; advertisement scans unlock as soon as it is online.'
                  : 'Cannot reach the backend cluster right now. You can browse the frontend, but scans and guideline edits are temporarily paused.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleManualWake}
              disabled={isPinging}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#E0D5C1] bg-white text-neutral-700 font-semibold hover:bg-[#F7F2E7] active:scale-95 transition-all"
            >
              <RefreshCw className={`w-3 h-3 ${isPinging || isWaking ? 'animate-spin text-[#E50914]' : 'text-neutral-500'}`} />
              <span>{isPinging ? 'Pinging…' : isWaking ? 'Booting…' : 'Wake Server'}</span>
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-neutral-400 hover:text-neutral-700 transition-colors rounded"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
