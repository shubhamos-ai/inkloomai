'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Image,
  Eye,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import type { AnalysisHistoryItem, ComplianceLevel } from '@/types/analysis';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoryListProps {
  items: AnalysisHistoryItem[];
  onViewReport: (id: string) => void;
  isLoading: boolean;
}

type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';
type FilterLevel = 'all' | ComplianceLevel;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMPLIANCE_LABELS: Record<ComplianceLevel, string> = {
  excellent: 'APPROVED',
  needs_minor_improvements: 'APPROVED (Minor)',
  needs_revision: 'NEEDS REVIEW',
  non_compliant: 'REJECTED',
};

const COMPLIANCE_BADGE: Record<ComplianceLevel, string> = {
  excellent: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
  needs_minor_improvements: 'bg-blue-950/80 text-blue-400 border-blue-700/60',
  needs_revision: 'bg-amber-950/80 text-amber-400 border-amber-700/60',
  non_compliant: 'bg-red-950/80 text-red-400 border-red-700/60',
};

const SCORE_COLOUR: Record<ComplianceLevel, string> = {
  excellent: 'text-emerald-400',
  needs_minor_improvements: 'text-blue-400',
  needs_revision: 'text-amber-400',
  non_compliant: 'text-[#E50914]',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5 animate-pulse bg-[#141414]">
      <div className="w-12 h-12 rounded-lg bg-neutral-800 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 bg-neutral-800 rounded w-48" />
        <div className="h-3 bg-neutral-800 rounded w-28" />
      </div>
      <div className="hidden sm:block h-6 w-24 bg-neutral-800 rounded-full" />
      <div className="hidden md:block h-4 w-16 bg-neutral-800 rounded" />
      <div className="h-8 w-24 bg-neutral-800 rounded-lg" />
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-4 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center mb-4">
        {filtered ? (
          <Search className="w-7 h-7 text-neutral-500" />
        ) : (
          <Image className="w-7 h-7 text-neutral-500" />
        )}
      </div>
      <h3 className="text-base font-bold text-white mb-1 uppercase tracking-wider">
        {filtered ? 'No Matching Records' : 'No Verification Records Yet'}
      </h3>
      <p className="text-xs text-neutral-400 max-w-xs">
        {filtered
          ? 'Try adjusting your search criteria or compliance filter.'
          : 'Upload your first advertisement to generate an executive compliance dossier.'}
      </p>
    </motion.div>
  );
}

// ─── Mobile Card ─────────────────────────────────────────────────────────────

function HistoryCard({
  item,
  onViewReport,
  index,
}: {
  item: AnalysisHistoryItem;
  onViewReport: (id: string) => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="rounded-xl border border-white/10 bg-[#181818] p-4 space-y-3 shadow-xl"
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt={item.advertisementName}
              className="w-full h-full object-cover"
            />
          ) : (
            <Image className="w-6 h-6 text-neutral-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{item.advertisementName}</p>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-neutral-400">
            <Calendar className="w-3 h-3 text-neutral-500" />
            {formatDate(item.analysedAt)}
          </div>
        </div>
        {/* Score */}
        <span className={`text-xl font-extrabold ${SCORE_COLOUR[item.complianceLevel]}`}>
          {item.complianceScore}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${COMPLIANCE_BADGE[item.complianceLevel]}`}
        >
          {COMPLIANCE_LABELS[item.complianceLevel]}
        </span>
        {item.violationsCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
            <AlertTriangle className="w-3 h-3" />
            {item.violationsCount} violation{item.violationsCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <button
        onClick={() => onViewReport(item.id)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-[#252525] border border-white/10 hover:border-[#E50914] text-white text-xs font-bold uppercase transition-colors"
      >
        <Eye className="w-4 h-4 text-[#E50914]" />
        Inspect Report
      </button>
    </motion.div>
  );
}

// ─── Desktop Table Row ────────────────────────────────────────────────────────

function HistoryRow({
  item,
  onViewReport,
  index,
}: {
  item: AnalysisHistoryItem;
  onViewReport: (id: string) => void;
  index: number;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="border-b border-white/5 hover:bg-[#202020] transition-colors"
    >
      {/* Thumbnail + name */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded bg-neutral-900 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl}
                alt={item.advertisementName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image className="w-5 h-5 text-neutral-600" />
            )}
          </div>
          <span className="font-semibold text-white text-sm max-w-[200px] truncate">
            {item.advertisementName}
          </span>
        </div>
      </td>

      {/* Date */}
      <td className="px-4 py-4 text-xs font-medium text-neutral-400 whitespace-nowrap">
        {formatDate(item.analysedAt)}
      </td>

      {/* Score */}
      <td className="px-4 py-4">
        <span className={`text-sm font-extrabold ${SCORE_COLOUR[item.complianceLevel]}`}>
          {item.complianceScore} / 100
        </span>
      </td>

      {/* Level badge */}
      <td className="px-4 py-4">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${COMPLIANCE_BADGE[item.complianceLevel]}`}
        >
          {COMPLIANCE_LABELS[item.complianceLevel]}
        </span>
      </td>

      {/* Violations */}
      <td className="px-4 py-4 text-xs font-semibold text-neutral-300">
        {item.violationsCount > 0 ? (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {item.violationsCount} Flagged
          </span>
        ) : (
          <span className="text-emerald-400 font-bold">Compliant</span>
        )}
      </td>

      {/* Action */}
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => onViewReport(item.id)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#252525] border border-white/10 hover:border-[#E50914] text-white text-xs font-bold uppercase transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-[#E50914]" />
          Inspect
        </button>
      </td>
    </motion.tr>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const FILTER_OPTIONS: { label: string; value: FilterLevel }[] = [
  { label: 'All Results', value: 'all' },
  { label: 'Approved (Excellent)', value: 'excellent' },
  { label: 'Approved (Minor Fixes)', value: 'needs_minor_improvements' },
  { label: 'Needs Review', value: 'needs_revision' },
  { label: 'Rejected (Non-Compliant)', value: 'non_compliant' },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Oldest First', value: 'oldest' },
  { label: 'Highest Score', value: 'highest' },
  { label: 'Lowest Score', value: 'lowest' },
];

export default function HistoryList({ items, onViewReport, isLoading }: HistoryListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const processed = useMemo(() => {
    let result = [...items];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) => item.advertisementName.toLowerCase().includes(q));
    }

    if (filter !== 'all') {
      result = result.filter((item) => item.complianceLevel === filter);
    }

    result.sort((a, b) => {
      if (sort === 'newest') return new Date(b.analysedAt).getTime() - new Date(a.analysedAt).getTime();
      if (sort === 'oldest') return new Date(a.analysedAt).getTime() - new Date(b.analysedAt).getTime();
      if (sort === 'highest') return b.complianceScore - a.complianceScore;
      if (sort === 'lowest') return a.complianceScore - b.complianceScore;
      return 0;
    });

    return result;
  }, [items, search, filter, sort]);

  const isFiltered = search.trim() !== '' || filter !== 'all';

  return (
    <div className="space-y-4 select-none">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search verified advertisements by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#1F1F1F] border border-white/10 rounded-md text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent transition"
          />
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={() => { setFilterOpen(!filterOpen); setSortOpen(false); }}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#1F1F1F] border border-white/10 rounded-md text-white hover:border-white/20 transition whitespace-nowrap"
          >
            <span>{FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? 'Filter'}</span>
            {filterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {filterOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 z-20 w-56 bg-[#181818] border border-white/10 rounded-md shadow-2xl overflow-hidden"
              >
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilter(opt.value); setFilterOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-[#252525] ${
                      filter === opt.value ? 'text-[#E50914] font-bold bg-red-950/20' : 'text-neutral-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => { setSortOpen(!sortOpen); setFilterOpen(false); }}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#1F1F1F] border border-white/10 rounded-md text-white hover:border-white/20 transition whitespace-nowrap"
          >
            <span>{SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort'}</span>
            {sortOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 z-20 w-48 bg-[#181818] border border-white/10 rounded-md shadow-2xl overflow-hidden"
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSort(opt.value); setSortOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-[#252525] ${
                      sort === opt.value ? 'text-[#E50914] font-bold bg-red-950/20' : 'text-neutral-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && items.length > 0 && (
        <p className="text-xs text-neutral-400">
          Displaying {processed.length} of {items.length} verification record{items.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="bg-[#181818] rounded-xl border border-white/10 overflow-hidden shadow-xl">
          {[...Array(5)].map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && processed.length === 0 && (
        <div className="bg-[#181818] rounded-xl border border-white/10 overflow-hidden shadow-xl">
          <EmptyState filtered={isFiltered} />
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && processed.length > 0 && (
        <>
          <div className="hidden md:block bg-[#181818] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-[#121212]">
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Creative Asset
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Verdict
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Policy Issues
                  </th>
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Dossier
                  </th>
                </tr>
              </thead>
              <tbody>
                {processed.map((item, i) => (
                  <HistoryRow key={item.id} item={item} onViewReport={onViewReport} index={i} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {processed.map((item, i) => (
              <HistoryCard key={item.id} item={item} onViewReport={onViewReport} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
