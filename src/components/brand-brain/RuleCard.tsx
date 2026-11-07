'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2 } from 'lucide-react';
import type { BrandRule, RuleCategory } from '@/types/brand-rules';
import { RULE_CATEGORY_LABELS } from '@/lib/api';

// ─── Category colour map ───────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<RuleCategory, { badge: string; dot: string }> = {
  logo: { badge: 'bg-violet-950/70 text-violet-300 border border-violet-800/50', dot: 'bg-violet-400' },
  typography: { badge: 'bg-sky-950/70 text-sky-300 border border-sky-800/50', dot: 'bg-sky-400' },
  colour_palette: { badge: 'bg-pink-950/70 text-pink-300 border border-pink-800/50', dot: 'bg-pink-400' },
  messaging: { badge: 'bg-amber-950/70 text-amber-300 border border-amber-800/50', dot: 'bg-amber-400' },
  advertising_claims: { badge: 'bg-orange-950/70 text-orange-300 border border-orange-800/50', dot: 'bg-orange-400' },
  restricted_content: { badge: 'bg-red-950/70 text-red-300 border border-red-800/50', dot: 'bg-[#E50914]' },
  legal_compliance: { badge: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50', dot: 'bg-emerald-400' },
  general: { badge: 'bg-neutral-800 text-neutral-300 border border-white/10', dot: 'bg-neutral-400' },
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
        'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:ring-offset-2 focus:ring-offset-[#141414]',
        isActive ? 'bg-[#E50914]' : 'bg-neutral-800',
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#181818] rounded-xl border border-white/10 shadow-2xl p-6 w-full max-w-sm text-white"
      >
        <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-800 flex items-center justify-center mb-4 text-[#E50914]">
          <Trash2 size={18} />
        </div>
        <h3 className="text-base font-bold text-white mb-1 uppercase tracking-wider">Delete Policy Rule</h3>
        <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-white">"{ruleName}"</span>? Automated AI verification will no longer enforce this restriction.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-9 rounded-md border border-white/10 bg-[#252525] text-xs font-semibold text-neutral-300 hover:bg-[#303030] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-9 rounded-md bg-[#E50914] text-xs font-bold text-white hover:bg-[#b80710] shadow-lg shadow-red-950/50 transition-colors uppercase"
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
  const colours = CATEGORY_COLOURS[rule.category] || CATEGORY_COLOURS.general;

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
          'group bg-[#181818] rounded-xl border p-4 transition-all duration-150 select-none shadow-lg',
          rule.isActive
            ? 'border-white/10 hover:border-white/20'
            : 'border-white/5 opacity-50 hover:opacity-75',
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
              <span className="text-sm font-bold text-white leading-tight">
                {rule.title}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${colours.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colours.dot}`} />
                {RULE_CATEGORY_LABELS[rule.category]}
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">
              {rule.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(rule)}
              title="Edit rule"
              className="w-7 h-7 rounded flex items-center justify-center bg-[#252525] hover:bg-[#303030] text-neutral-300 hover:text-white transition-colors border border-white/10"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              title="Delete rule"
              className="w-7 h-7 rounded flex items-center justify-center bg-[#252525] hover:bg-red-950/50 text-neutral-400 hover:text-red-400 transition-colors border border-white/10"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <span className="font-mono text-[10px] text-neutral-500 tracking-wide uppercase">
            {rule.id}
          </span>
          {!rule.isActive && (
            <span className="text-[10px] text-neutral-500 font-semibold uppercase">Inactive</span>
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
