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
  return <div className={`animate-pulse rounded-lg bg-neutral-800 ${className}`} />;
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
      <Skeleton className="h-24 w-full rounded-xl" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BrandBrain['status'] }) {
  const map = {
    active: 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60',
    processing: 'bg-amber-950/80 text-amber-400 border border-amber-800/60',
    draft: 'bg-neutral-800 text-neutral-400 border border-white/10',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${map[status]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'active'
            ? 'bg-emerald-400'
            : status === 'processing'
            ? 'bg-amber-400 animate-pulse'
            : 'bg-neutral-400'
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
    <div className="bg-[#181818] rounded-xl border border-white/10 overflow-hidden shadow-xl select-none">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#202020] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Layers size={15} className="text-[#E50914]" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">Corporate Policy Document (Rules.txt)</span>
        </div>
        {expanded ? (
          <ChevronDown size={15} className="text-neutral-400" />
        ) : (
          <ChevronRight size={15} className="text-neutral-400" />
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
            <div className="border-t border-white/10 px-5 pb-5 pt-4">
              {/* Controls */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setEditing((p) => !p)}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-md border border-white/10 bg-[#252525] text-xs font-semibold text-neutral-300 hover:text-white hover:bg-[#303030] transition-colors"
                >
                  {editing ? (
                    <>
                      <EyeOff size={11} />
                      View Mode
                    </>
                  ) : (
                    <>
                      <Eye size={11} />
                      Edit Rules
                    </>
                  )}
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!text}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-md border border-white/10 bg-[#252525] text-xs font-semibold text-neutral-300 hover:text-white hover:bg-[#303030] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Copy size={11} />
                  {copied ? 'Copied!' : 'Copy Document'}
                </button>
              </div>

              {editing ? (
                <textarea
                  value={text}
                  onChange={(e) => handleEdit(e.target.value)}
                  rows={12}
                  placeholder="Paste organizational policies and advertising rules here…"
                  className="w-full px-3.5 py-3 rounded-md border border-white/15 bg-[#1F1F1F] text-xs text-neutral-200 leading-relaxed font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent transition-shadow"
                />
              ) : (
                <div className="relative">
                  <pre className="w-full h-48 overflow-auto px-3.5 py-3 rounded-md bg-[#121212] border border-white/5 text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                    {text || (
                      <span className="text-neutral-500 italic">
                        No raw guidelines stored. Click Edit Rules to specify policies.
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
    <div className="bg-[#181818] rounded-xl border border-white/10 overflow-hidden shadow-xl select-none">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#202020] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            {RULE_CATEGORY_LABELS[category]}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 border border-white/10 text-xs font-bold text-neutral-300">
            {activeCount}/{rules.length} active
          </span>
        </div>
        {expanded ? (
          <ChevronDown size={15} className="text-neutral-400" />
        ) : (
          <ChevronRight size={15} className="text-neutral-400" />
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
            <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-2.5 bg-[#141414]">
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
      toast.success('Brand Brain synchronized with NVIDIA Vision engine.');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

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
      <div className="space-y-6 select-none">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-[#E50914] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg shadow-red-950/60">
              <Brain size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-3xl font-black text-white tracking-tight uppercase">Brand Brain</h1>
                {brain && <StatusBadge status={brain.status} />}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {brain && (
                  <>
                    <span className="text-xs text-neutral-400">
                      Synchronized {formatRelativeDate(brain.lastUpdatedAt)}
                    </span>
                    <span className="text-neutral-600 select-none">·</span>
                    <span className="text-xs text-neutral-400">Version {brain.version}</span>
                    <span className="text-neutral-600 select-none">·</span>
                    <span className="text-xs font-semibold text-[#E50914]">
                      {totalActive}/{rules.length} Active Constraints
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
                className="flex items-center gap-2 h-9 px-4 rounded-md bg-[#E50914] text-xs font-bold text-white hover:bg-[#b80710] disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-950/50 uppercase"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Synchronizing…
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    Sync with AI
                  </>
                )}
              </motion.button>
            )}
            <button
              onClick={handleAddOpen}
              className="flex items-center gap-2 h-9 px-4 rounded-md border border-white/10 bg-[#252525] text-xs font-bold text-white hover:bg-[#303030] hover:border-white/20 transition-colors uppercase"
            >
              <Plus size={14} />
              Add Policy Rule
            </button>
          </div>
        </div>

        {/* ── Company info card ── */}
        <div className="bg-[#181818] rounded-xl border border-white/10 shadow-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-[#E50914]" />
              </div>
              <div>
                <p className="text-base font-bold text-white">
                  {session?.companyName || 'Enterprise Workspace'}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {session?.industry && (
                    <span className="text-xs text-neutral-400 font-medium">{session.industry}</span>
                  )}
                  {session?.industry && session?.website && (
                    <span className="text-neutral-600 select-none">·</span>
                  )}
                  {session?.website && (
                    <a
                      href={session.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#E50914] hover:underline"
                    >
                      {session.website}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <a
              href="/settings"
              className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-white/10 bg-[#252525] text-xs font-bold text-neutral-300 hover:text-white hover:bg-[#303030] transition-colors flex-shrink-0"
            >
              <Edit2 size={12} />
              Edit Settings
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
          <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers size={14} className="text-[#E50914]" />
            Configured Policy Disciplines
          </h2>

          {rules.length === 0 ? (
            <div className="bg-[#181818] rounded-xl border border-dashed border-white/15 py-14 text-center">
              <Brain size={32} className="mx-auto text-neutral-600 mb-3" />
              <p className="text-sm font-bold text-white uppercase tracking-wider">No brand rules configured</p>
              <p className="text-xs text-neutral-400 mt-1 mb-4">
                Add compliance rules to activate automated advertisement scanning.
              </p>
              <button
                onClick={handleAddOpen}
                className="inline-flex items-center gap-2 h-9 px-5 rounded-md bg-[#E50914] text-xs font-bold text-white hover:bg-[#b80710] shadow-lg shadow-red-950/50 uppercase"
              >
                <Plus size={14} />
                Add First Rule
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
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-[#181818] border border-[#E50914] rounded-full shadow-2xl text-xs text-white font-bold uppercase tracking-wider"
            >
              <span className="w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
              Unsaved Brand Changes
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="ml-2 text-[#E50914] hover:underline disabled:opacity-50"
              >
                Sync Now
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
