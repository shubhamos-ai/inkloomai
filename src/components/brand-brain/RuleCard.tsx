'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2 } from 'lucide-react';
import type { BrandRule, RuleCategory } from '@/types/brand-rules';
import { RULE_CATEGORY_LABELS } from '@/lib/api';

// ─── Category colour map ───────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<RuleCategory, { badge: string; dot: string }> = {
  logo: { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  typography: { badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  colour_palette: { badge: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500' },
  messaging: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  advertising_claims: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  restricted_content: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  legal_compliance: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  general: { badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
};

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  isActive: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function ToggleSwitch({ isActive, onToggle, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={isActive}
      aria-label={isActive ? 'Deactivate rule' : 'Activate rule'}
      className={[
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        isActive ? 'bg-blue-600' : 'bg-slate-200',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={[
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm',
          isActive ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  ruleName: string;
}

function ConfirmDialog({ isOpen, onConfirm, onCancel, ruleName }: ConfirmDialogProps) {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-sm"
      >
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Delete rule</h3>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="font-medium text-slate-700">"{ruleName}"</span>? This action cannot be
          undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-9 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-9 rounded-xl bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── RuleCard ──────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: BrandRule;
  onEdit: (rule: BrandRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

export default function RuleCard({ rule, onEdit, onDelete, onToggle }: RuleCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const colours = CATEGORY_COLOURS[rule.category];

  function handleDelete() {
    setShowConfirm(false);
    onDelete(rule.id);
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className={[
          'group bg-white rounded-2xl border p-4 transition-all duration-150',
          rule.isActive
            ? 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
            : 'border-slate-100 opacity-60 hover:opacity-80',
        ].join(' ')}
      >
        {/* Top row */}
        <div className="flex items-start gap-3">
          {/* Toggle */}
          <div className="pt-0.5 flex-shrink-0">
            <ToggleSwitch
              isActive={rule.isActive}
              onToggle={() => onToggle(rule.id, !rule.isActive)}
            />
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-slate-900 leading-tight">
                {rule.title}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${colours.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colours.dot}`} />
                {RULE_CATEGORY_LABELS[rule.category]}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
              {rule.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(rule)}
              title="Edit rule"
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              title="Delete rule"
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-400 tracking-wide uppercase">
            {rule.id}
          </span>
          {!rule.isActive && (
            <span className="text-[10px] text-slate-400 font-medium">Inactive</span>
          )}
        </div>
      </motion.div>

      <ConfirmDialog
        isOpen={showConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
        ruleName={rule.title}
      />
    </>
  );
}
