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
  excellent: 'Excellent',
  needs_minor_improvements: 'Needs Improvement',
  needs_revision: 'Needs Revision',
  non_compliant: 'Non-Compliant',
};

const COMPLIANCE_BADGE: Record<ComplianceLevel, string> = {
  excellent: 'bg-green-50 text-green-700 border-green-200',
  needs_minor_improvements: 'bg-blue-50 text-blue-700 border-blue-200',
  needs_revision: 'bg-amber-50 text-amber-700 border-amber-200',
  non_compliant: 'bg-red-50 text-red-700 border-red-200',
};

const SCORE_COLOUR: Record<ComplianceLevel, string> = {
  excellent: 'text-green-600',
  needs_minor_improvements: 'text-blue-600',
  needs_revision: 'text-amber-600',
  non_compliant: 'text-red-600',
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
    <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-100 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-slate-200 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-48" />
        <div className="h-3 bg-slate-100 rounded w-28" />
      </div>
      <div className="hidden sm:block h-6 w-24 bg-slate-200 rounded-full" />
      <div className="hidden md:block h-4 w-16 bg-slate-200 rounded" />
      <div className="h-8 w-24 bg-slate-200 rounded-lg" />
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
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        {filtered ? (
          <Search className="w-7 h-7 text-slate-400" />
        ) : (
          <Image className="w-7 h-7 text-slate-400" />
        )}
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">
        {filtered ? 'No results found' : 'No analyses yet'}
      </h3>
      <p className="text-sm text-slate-500 max-w-xs">
        {filtered
          ? "Try adjusting your search or filters to find what you're looking for."
          : 'Upload your first advertisement to get a detailed compliance report.'}
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
      className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt={item.advertisementName}
              className="w-full h-full object-cover"
            />
          ) : (
            <Image className="w-6 h-6 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{item.advertisementName}</p>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
            <Calendar className="w-3 h-3" />
            {formatDate(item.analysedAt)}
          </div>
        </div>
        {/* Score */}
        <span className={`text-xl font-bold ${SCORE_COLOUR[item.complianceLevel]}`}>
          {item.complianceScore}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${COMPLIANCE_BADGE[item.complianceLevel]}`}
        >
          {COMPLIANCE_LABELS[item.complianceLevel]}
        </span>
        {item.violationsCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <AlertTriangle className="w-3 h-3" />
            {item.violationsCount} violation{item.violationsCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <button
        onClick={() => onViewReport(item.id)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
      >
        <Eye className="w-4 h-4" />
        View Report
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
      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
    >
      {/* Thumbnail + name */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl}
                alt={item.advertisementName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <span className="font-medium text-slate-900 text-sm max-w-[200px] truncate">
            {item.advertisementName}
          </span>
        </div>
      </td>

      {/* Date */}
      <td className="px-4 py-4 text-sm text-slate-500 whitespace-nowrap">
        {formatDate(item.analysedAt)}
      </td>

      {/* Score */}
      <td className="px-4 py-4">
        <span className={`text-sm font-bold ${SCORE_COLOUR[item.complianceLevel]}`}>
          {item.complianceScore} / 100
        </span>
      </td>

      {/* Level badge */}
      <td className="px-4 py-4">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${COMPLIANCE_BADGE[item.complianceLevel]}`}
        >
          {COMPLIANCE_LABELS[item.complianceLevel]}
        </span>
      </td>

      {/* Violations */}
      <td className="px-4 py-4 text-sm text-slate-600">
        {item.violationsCount > 0 ? (
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            {item.violationsCount}
          </span>
        ) : (
          <span className="text-green-600 font-medium">None</span>
        )}
      </td>

      {/* Action */}
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => onViewReport(item.id)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View Report
        </button>
      </td>
    </motion.tr>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const FILTER_OPTIONS: { label: string; value: FilterLevel }[] = [
  { label: 'All Results', value: 'all' },
  { label: 'Excellent', value: 'excellent' },
  { label: 'Needs Improvement', value: 'needs_minor_improvements' },
  { label: 'Needs Revision', value: 'needs_revision' },
  { label: 'Non-Compliant', value: 'non_compliant' },
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

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) => item.advertisementName.toLowerCase().includes(q));
    }

    // Filter
    if (filter !== 'all') {
      result = result.filter((item) => item.complianceLevel === filter);
    }

    // Sort
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
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search advertisements…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={() => { setFilterOpen(!filterOpen); setSortOpen(false); }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 hover:border-slate-300 transition whitespace-nowrap"
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
                className="absolute right-0 top-full mt-1 z-20 w-52 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
              >
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilter(opt.value); setFilterOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
                      filter === opt.value ? 'text-blue-600 font-medium bg-blue-50' : 'text-slate-700'
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
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 hover:border-slate-300 transition whitespace-nowrap"
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
                className="absolute right-0 top-full mt-1 z-20 w-48 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSort(opt.value); setSortOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
                      sort === opt.value ? 'text-blue-600 font-medium bg-blue-50' : 'text-slate-700'
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
        <p className="text-xs text-slate-500">
          Showing {processed.length} of {items.length} result{items.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && processed.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <EmptyState filtered={isFiltered} />
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && processed.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Advertisement
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Violations
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Action
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
