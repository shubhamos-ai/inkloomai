'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export type DialogVariant = 'default' | 'warning' | 'danger';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const variantConfig: Record<
  DialogVariant,
  {
    confirmBtn: string;
    iconWrapper: string;
    icon: React.ReactNode;
  }
> = {
  default: {
    confirmBtn:
      'bg-[#E50914] hover:bg-[#b80710] focus-visible:ring-[#E50914] text-white',
    iconWrapper: 'bg-[#E50914]/20 border border-[#E50914]/40',
    icon: null,
  },
  warning: {
    confirmBtn:
      'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500 text-white',
    iconWrapper: 'bg-amber-950/60 border border-amber-800 text-amber-400',
    icon: <AlertTriangle size={20} className="text-amber-400" />,
  },
  danger: {
    confirmBtn:
      'bg-[#E50914] hover:bg-[#b80710] focus-visible:ring-[#E50914] text-white',
    iconWrapper: 'bg-red-950/60 border border-red-800 text-red-400',
    icon: <AlertTriangle size={20} className="text-red-400" />,
  },
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const config = variantConfig[variant];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset loading when dialog closes
  useEffect(() => {
    if (!isOpen) setLoading(false);
  }, [isOpen]);

  // Trap body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
            onClick={() => !loading && onCancel()}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              key="dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
              aria-describedby="dialog-message"
              initial={{ opacity: 0, scale: 0.93, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 8 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="relative w-full max-w-md bg-[#181818] rounded-2xl shadow-2xl border border-[#262626] overflow-hidden text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={onCancel}
                disabled={loading}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 text-zinc-400 hover:text-white"
                aria-label="Close dialog"
              >
                <X size={15} />
              </button>

              <div className="px-6 pt-6 pb-6">
                {/* Icon (warning / danger variants) */}
                {config.icon && (
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${config.iconWrapper}`}
                  >
                    {config.icon}
                  </div>
                )}

                {/* Title */}
                <h2
                  id="dialog-title"
                  className="text-base font-semibold text-white leading-snug mb-2 pr-6"
                >
                  {title}
                </h2>

                {/* Message */}
                <p
                  id="dialog-message"
                  className="text-sm text-zinc-400 leading-relaxed"
                >
                  {message}
                </p>

                {/* Divider */}
                <div className="mt-6 pt-5 border-t border-[#262626] flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
                  {/* Cancel */}
                  <button
                    onClick={onCancel}
                    disabled={loading}
                    className="flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                  >
                    {cancelLabel}
                  </button>

                  {/* Confirm */}
                  <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${config.confirmBtn}`}
                  >
                    {loading && <LoadingSpinner size="sm" className="border-white/40 border-t-white" />}
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
