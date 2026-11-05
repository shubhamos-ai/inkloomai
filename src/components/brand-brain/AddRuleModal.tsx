'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
import type { BrandRule, RuleCategory } from '@/types/brand-rules';
import { RULE_CATEGORY_LABELS } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

type RuleFormData = Omit<BrandRule, 'id' | 'createdAt' | 'updatedAt'>;

interface AddRuleModalProps {
  isOpen: boolean;
  rule?: BrandRule;
  onSave: (data: RuleFormData) => void;
  onClose: () => void;
}

// ─── Form input component ──────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}

function Field({ label, error, children, required }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = Object.entries(RULE_CATEGORY_LABELS) as [RuleCategory, string][];

const DEFAULT_FORM: RuleFormData = {
  category: 'general',
  title: '',
  description: '',
  isActive: true,
};

export default function AddRuleModal({ isOpen, rule, onSave, onClose }: AddRuleModalProps) {
  const [form, setForm] = useState<RuleFormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof RuleFormData, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!rule;

  // Seed form when editing
  useEffect(() => {
    if (isOpen) {
      setForm(
        rule
          ? {
              category: rule.category,
              title: rule.title,
              description: rule.description,
              isActive: rule.isActive,
            }
          : DEFAULT_FORM
      );
      setErrors({});
    }
  }, [isOpen, rule]);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  function validate(): boolean {
    const next: Partial<Record<keyof RuleFormData, string>> = {};
    if (!form.title.trim()) next.title = 'Title is required.';
    else if (form.title.trim().length < 3) next.title = 'Title must be at least 3 characters.';
    if (!form.description.trim()) next.description = 'Description is required.';
    else if (form.description.trim().length < 10)
      next.description = 'Description must be at least 10 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    // Simulate a tiny async beat for UX polish
    await new Promise((r) => setTimeout(r, 240));
    onSave({ ...form, title: form.title.trim(), description: form.description.trim() });
    setIsSaving(false);
  }

  function set<K extends keyof RuleFormData>(key: K, value: RuleFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            key="modal"
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {isEditing ? 'Edit Rule' : 'Add New Rule'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEditing
                    ? 'Update this brand compliance rule.'
                    : 'Define a new brand compliance rule.'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="px-6 py-5 space-y-5">
                {/* Category */}
                <Field label="Category" required>
                  <select
                    value={form.category}
                    onChange={(e) => set('category', e.target.value as RuleCategory)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow appearance-none cursor-pointer"
                  >
                    {ALL_CATEGORIES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Title */}
                <Field label="Rule Title" error={errors.title} required>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="e.g. Logo Clear Space"
                    maxLength={80}
                    className={[
                      'w-full h-10 px-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow',
                      errors.title ? 'border-red-300' : 'border-slate-200',
                    ].join(' ')}
                  />
                </Field>

                {/* Description */}
                <Field label="Description" error={errors.description} required>
                  <textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Describe this brand rule clearly and concisely…"
                    rows={4}
                    maxLength={500}
                    className={[
                      'w-full px-3 py-2.5 rounded-xl border text-sm text-slate-900 placeholder-slate-400 resize-none leading-relaxed',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow',
                      errors.description ? 'border-red-300' : 'border-slate-200',
                    ].join(' ')}
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-slate-400">
                      {form.description.length}/500
                    </span>
                  </div>
                </Field>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Active</p>
                    <p className="text-xs text-slate-400">
                      Inactive rules are stored but not enforced during analysis.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set('isActive', !form.isActive)}
                    aria-pressed={form.isActive}
                    className={[
                      'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 border-transparent',
                      'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer',
                      form.isActive ? 'bg-blue-600' : 'bg-slate-200',
                    ].join(' ')}
                  >
                    <motion.span
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={[
                        'inline-block h-4 w-4 rounded-full bg-white shadow-sm',
                        form.isActive ? 'translate-x-5' : 'translate-x-0',
                      ].join(' ')}
                    />
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-5 rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save size={13} />
                      {isEditing ? 'Update Rule' : 'Add Rule'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
