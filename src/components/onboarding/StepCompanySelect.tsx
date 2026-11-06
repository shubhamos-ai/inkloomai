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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group text-left rounded-xl border border-white/10 bg-neutral-900/70 p-5
                 hover:border-neutral-300/60 hover:bg-neutral-800/80 transition-all shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
             style={{ backgroundColor: '#E50914' }}>
          <Building2 className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="mt-4 text-white font-semibold text-lg leading-tight truncate">
        {company.company_name}
      </h3>
      <p className="text-neutral-500 text-xs mt-0.5 truncate">
        {company.industry || 'No industry set'}
      </p>

      <div className="mt-4 flex items-center gap-4 text-xs text-neutral-400">
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" />
          {company.analysis_count} scan{company.analysis_count === 1 ? '' : 's'}
        </span>
        {company.compliance_score != null && (
          <span className="inline-flex items-center gap-1.5">
            avg score
            <strong className={company.compliance_score >= 80 ? 'text-emerald-400' : company.compliance_score >= 60 ? 'text-amber-400' : 'text-red-400'}>
              {company.compliance_score}
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
      <h1 className="text-white text-3xl font-bold mb-2 tracking-tight">
        Choose your workspace
      </h1>
      <p className="text-neutral-400 text-sm mb-8">
        Pick a company to open its dashboard, or add a new one.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-500">
          <Loader2 className="w-6 h-6 animate-spin" />
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-xl border-2 border-dashed border-white/15 p-5
                       hover:border-neutral-400/60 hover:bg-white/5 transition-all
                       flex flex-col items-start text-left shadow-xl min-h-[150px]"
          >
            <div className="w-11 h-11 rounded-lg border border-white/20 flex items-center justify-center">
              <Plus className="w-5 h-5 text-neutral-300" />
            </div>
            <h3 className="mt-4 text-white font-semibold text-lg">Add a company</h3>
            <p className="text-neutral-500 text-xs mt-0.5">New brand, new rules, fresh scans.</p>
          </motion.button>
        </div>
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-8 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Switch account
        </button>
      )}
    </motion.div>
  );
}
