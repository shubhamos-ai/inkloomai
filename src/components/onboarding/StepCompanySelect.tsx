'use client';
import { motion } from 'framer-motion';
import { Building2, Plus, Loader2, BarChart3 } from 'lucide-react';
import type { UserCompanySummary } from '@/lib/api';

interface StepCompanySelectProps {
  companies: UserCompanySummary[];
  onChoose: (company: UserCompanySummary) => void;
  onAddNew: () => void;
  onBack: () => void;
  loading?: boolean;
}

function CompanyCard({
  company,
  onChoose,
  index,
}: {
  company: UserCompanySummary;
  onChoose: (company: UserCompanySummary) => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onChoose(company)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.35, ease: 'easeOut' }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      className="group text-left rounded-2xl border border-[#E8E2D9] bg-white p-6
                 hover:border-[#E50914]/40 hover:shadow-[0_12px_28px_rgba(26,24,22,0.06)] transition-all shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
             style={{ backgroundColor: '#E50914' }}>
          <Building2 className="w-5 h-5 text-white" />
        </div>
      </div>
      <h3 className="mt-4 text-neutral-900 font-bold text-lg leading-tight truncate">
        {company.company_name}
      </h3>
      <p className="text-neutral-500 text-xs mt-0.5 truncate">
        {company.industry || 'General Commerce'}
      </p>

      <div className="mt-4 flex items-center gap-4 text-xs text-neutral-500 pt-3 border-t border-[#F0EBE1]">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <BarChart3 className="w-3.5 h-3.5 text-[#E50914]" />
          {company.analysis_count} scan{company.analysis_count === 1 ? '' : 's'}
        </span>
        {company.compliance_score != null && (
          <span className="inline-flex items-center gap-1.5 font-medium ml-auto">
            avg score
            <strong className={`px-2 py-0.5 rounded-full text-[11px] ${
              company.compliance_score >= 80
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : company.compliance_score >= 60
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {company.compliance_score}%
            </strong>
          </span>
        )}
      </div>
    </motion.button>
  );
}

export default function StepCompanySelect({
  companies,
  onChoose,
  onAddNew,
  onBack,
  loading = false,
}: StepCompanySelectProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto"
    >
      <h1 className="text-neutral-900 text-3xl font-black mb-2 tracking-tight">
        Choose your workspace
      </h1>
      <p className="text-neutral-500 text-sm mb-8">
        Pick an organisation to open its Brand Brain dashboard, or initialize a new workspace.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin text-[#E50914]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {companies.map((company, i) => (
            <CompanyCard key={company.id} company={company} onChoose={onChoose} index={i} />
          ))}

          <motion.button
            type="button"
            onClick={onAddNew}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * companies.length, duration: 0.35 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl border-2 border-dashed border-[#D6CCC0] p-6
                       hover:border-[#E50914] hover:bg-red-50/20 transition-all
                       flex flex-col items-start text-left shadow-sm min-h-[160px] bg-white group"
          >
            <div className="w-11 h-11 rounded-xl border border-[#E0D8CB] bg-[#FAF8F5] flex items-center justify-center group-hover:border-red-200 transition-colors">
              <Plus className="w-5 h-5 text-neutral-600 group-hover:text-[#E50914]" />
            </div>
            <h3 className="mt-4 text-neutral-900 font-bold text-lg group-hover:text-[#E50914] transition-colors">Add organisation</h3>
            <p className="text-neutral-500 text-xs mt-0.5">Isolated Brand Brain, new rules, fresh creatives.</p>
          </motion.button>
        </div>
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-8 text-xs font-semibold text-neutral-500 hover:text-[#E50914] transition-colors"
        >
          ← Switch account
        </button>
      )}
    </motion.div>
  );
}
