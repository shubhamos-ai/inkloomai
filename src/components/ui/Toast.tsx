'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

// ─── Style Maps ──────────────────────────────────────────────────────────────

const toastStyles: Record<
  ToastType,
  { container: string; icon: React.ReactNode; iconColor: string }
> = {
  success: {
    container: 'border-green-200 bg-white',
    iconColor: 'text-green-500',
    icon: <CheckCircle size={16} />,
  },
  error: {
    container: 'border-red-200 bg-white',
    iconColor: 'text-red-500',
    icon: <XCircle size={16} />,
  },
  warning: {
    container: 'border-amber-200 bg-white',
    iconColor: 'text-amber-500',
    icon: <AlertTriangle size={16} />,
  },
  info: {
    container: 'border-blue-200 bg-white',
    iconColor: 'text-blue-500',
    icon: <Info size={16} />,
  },
};

// ─── Individual Toast ─────────────────────────────────────────────────────────

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const style = toastStyles[toast.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 48, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)] px-4 py-3.5 rounded-2xl border shadow-lg shadow-slate-200/60 ${style.container}`}
      role="alert"
    >
      {/* Icon */}
      <span className={`flex-shrink-0 mt-0.5 ${style.iconColor}`}>{style.icon}</span>

      {/* Message */}
      <p className="flex-1 text-sm text-slate-700 font-medium leading-snug">
        {toast.message}
      </p>

      {/* Dismiss Button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors mt-0.5"
        aria-label="Dismiss notification"
      >
        <X size={13} className="text-slate-400" />
      </button>
    </motion.div>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-6 right-4 sm:right-6 z-[200] flex flex-col gap-2.5 items-end"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

// ─── useToast Hook ────────────────────────────────────────────────────────────

interface UseToastReturn {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, duration?: number) => string;
  dismissToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 4000): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      return id;
    },
    []
  );

  const success = useCallback(
    (message: string, duration?: number) => addToast(message, 'success', duration),
    [addToast]
  );
  const error = useCallback(
    (message: string, duration?: number) => addToast(message, 'error', duration),
    [addToast]
  );
  const warning = useCallback(
    (message: string, duration?: number) => addToast(message, 'warning', duration),
    [addToast]
  );
  const info = useCallback(
    (message: string, duration?: number) => addToast(message, 'info', duration),
    [addToast]
  );

  return { toasts, addToast, dismissToast, success, error, warning, info };
}
