'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Brain,
  Building2,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Save,
} from 'lucide-react';
import { getBrandBrain, RULE_CATEGORY_LABELS, updateBrandBrain } from '@/lib/api';
import { getUserSession } from '@/lib/session';
import type { BrandBrain, BrandRule, RuleCategory } from '@/types/brand-rules';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import RuleCard from './RuleCard';
import AddRuleModal from './AddRuleModal';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeDate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function generateRuleId(): string {
  return `br_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const ORDERED_CATEGORIES: RuleCategory[] = [
  'logo',
  'typography',
  'colour_palette',
  'messaging',
  'advertising_claims',
  'restricted_content',
  'legal_compliance',
  'general',
];

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BrandBrain['status'] }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    processing: 'bg-amber-100 text-amber-700',
    draft: 'bg-slate-100 text-slate-500',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${map[status]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'active'
            ? 'bg-emerald-500'
            : status === 'processing'
            ? 'bg-amber-500 animate-pulse'
            : 'bg-slate-400'
        }`}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Rules text panel ──────────────────────────────────────────────────────────

interface RulesTextPanelProps {
  text: string;
  onChange: (val: string) => void;
  onDirty: () => void;
}

function RulesTextPanel({ text, onChange, onDirty }: RulesTextPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleEdit(val: string) {
    onChange(val);
    onDirty();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Layers size={15} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-900">Raw Brand Guidelines</span>
        </div>
        {expanded ? (
          <ChevronDown size={15} className="text-slate-400" />
        ) : (
          <ChevronRight size={15} className="text-slate-400" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-slate-100 px-5 pb-5 pt-4">
              {/* Controls */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setEditing((p) => !p)}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {editing ? (
                    <>
                      <EyeOff size={11} />
                      View
                    </>
                  ) : (
                    <>
                      <Eye size={11} />
                      Edit
                    </>
                  )}
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!text}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Copy size={11} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {editing ? (
                <textarea
                  value={text}
                  onChange={(e) => handleEdit(e.target.value)}
                  rows={12}
                  placeholder="Paste your brand guidelines here…"
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              ) : (
                <div className="relative">
                  <pre className="w-full h-48 overflow-auto px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 font-mono leading-relaxed whitespace-pre-wrap break-words">
                    {text || (
                      <span className="text-slate-400 italic">
                        No raw guidelines stored. Switch to Edit mode to add them.
                      </span>
                    )}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Category section ──────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: RuleCategory;
  rules: BrandRule[];
  onEdit: (rule: BrandRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

function CategorySection({ category, rules, onEdit, onDelete, onToggle }: CategorySectionProps) {
  const [expanded, setExpanded] = useState(true);
  if (rules.length === 0) return null;
  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-slate-900">
            {RULE_CATEGORY_LABELS[category]}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-medium text-slate-500">
            {activeCount}/{rules.length}
          </span>
        </div>
        {expanded ? (
          <ChevronDown size={15} className="text-slate-400" />
        ) : (
          <ChevronRight size={15} className="text-slate-400" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2.5">
              <AnimatePresence mode="popLayout">
                {rules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggle={onToggle}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BrandBrainContent() {
  const toast = useToast();
  const session = getUserSession();

  const [brain, setBrain] = useState<BrandBrain | null>(null);
  const [rules, setRules] = useState<BrandRule[]>([]);
  const [rulesText, setRulesText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BrandRule | undefined>(undefined);

  // Load
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getBrandBrain()
      .then((data) => {
        if (cancelled || !data) return;
        setBrain(data);
        setRules(data.rules);
        setRulesText(data.rulesText || '');
      })
      .catch(() => toast.error('Failed to load Brand Brain.'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, []);

  // ── Handlers ──

  const markDirty = useCallback(() => setIsDirty(true), []);

  function handleToggle(id: string, isActive: boolean) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive, updatedAt: new Date().toISOString() } : r)));
    markDirty();
  }

  function handleDelete(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    markDirty();
  }

  function handleEditOpen(rule: BrandRule) {
    setEditingRule(rule);
    setModalOpen(true);
  }

  function handleAddOpen() {
    setEditingRule(undefined);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingRule(undefined);
  }

  function handleModalSave(data: Omit<BrandRule, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    if (editingRule) {
      setRules((prev) =>
        prev.map((r) =>
          r.id === editingRule.id ? { ...r, ...data, updatedAt: now } : r
        )
      );
      toast.success('Rule updated.');
    } else {
      const newRule: BrandRule = {
        id: generateRuleId(),
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      setRules((prev) => [newRule, ...prev]);
      toast.success('New rule added.');
    }
    setIsDirty(true);
    handleModalClose();
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const updated = await updateBrandBrain(rules, rulesText);
      setBrain(updated);
      setRules(updated.rules);
      setIsDirty(false);
      toast.success('Brand Brain saved successfully.');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Group rules by category ──

  const rulesByCategory = ORDERED_CATEGORIES.reduce<Record<RuleCategory, BrandRule[]>>(
    (acc, cat) => {
      acc[cat] = rules.filter((r) => r.category === cat);
      return acc;
    },
    {} as Record<RuleCategory, BrandRule[]>
  );

  if (isLoading) return <LoadingState />;

  const totalActive = rules.filter((r) => r.isActive).length;

  return (
    <>
      <div className="space-y-6">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Brain size={19} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">Brand Brain</h1>
                {brain && <StatusBadge status={brain.status} />}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {brain && (
                  <>
                    <span className="text-xs text-slate-500">
                      Updated {formatRelativeDate(brain.lastUpdatedAt)}
                    </span>
                    <span className="text-slate-200 select-none">·</span>
                    <span className="text-xs text-slate-500">v{brain.version}</span>
                    <span className="text-slate-200 select-none">·</span>
                    <span className="text-xs text-slate-500">
                      {totalActive}/{rules.length} active rules
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDirty && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 h-9 px-4 rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    Save Changes
                  </>
                )}
              </motion.button>
            )}
            <button
              onClick={handleAddOpen}
              className="flex items-center gap-2 h-9 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
            >
              <Plus size={14} />
              Add Rule
            </button>
          </div>
        </div>

        {/* ── Company info card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={15} className="text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {session?.companyName || 'Your Company'}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {session?.industry && (
                    <span className="text-xs text-slate-500">{session.industry}</span>
                  )}
                  {session?.industry && session?.website && (
                    <span className="text-slate-200 select-none">·</span>
                  )}
                  {session?.website && (
                    <a
                      href={session.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {session.website}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <a
              href="/settings"
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
            >
              <Edit2 size={11} />
              Edit
            </a>
          </div>
        </div>

        {/* ── Raw guidelines ── */}
        <RulesTextPanel
          text={rulesText}
          onChange={setRulesText}
          onDirty={markDirty}
        />

        {/* ── Rules by category ── */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Layers size={14} className="text-slate-400" />
            Rules by Category
          </h2>

          {rules.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 text-center">
              <Brain size={28} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No rules yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Add your first brand compliance rule to get started.
              </p>
              <button
                onClick={handleAddOpen}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus size={14} />
                Add Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {ORDERED_CATEGORIES.map((cat) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  rules={rulesByCategory[cat]}
                  onEdit={handleEditOpen}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Unsaved changes indicator ── */}
        <AnimatePresence>
          {isDirty && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-slate-900 rounded-full shadow-xl text-sm text-white font-medium"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Unsaved changes
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="ml-1 text-blue-300 hover:text-blue-200 transition-colors disabled:opacity-50"
              >
                Save now
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal ── */}
      <AddRuleModal
        isOpen={modalOpen}
        rule={editingRule}
        onSave={handleModalSave}
        onClose={handleModalClose}
      />

      {/* ── Toasts ── */}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </>
  );
}
