'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ArrowLeft, Building2, Globe } from 'lucide-react';

const INDUSTRIES = [
  'Financial Services & FinTech',
  'Healthcare & Pharmaceuticals',
  'Retail & E-commerce',
  'Technology & SaaS',
  'Food & Beverage',
  'Automotive & Aerospace',
  'Energy & Resources',
  'CyberSecurity & Data',
  'Media & Entertainment',
  'Biotechnology',
];

interface CompanyData {
  companyName: string;
  industry?: string;
  website?: string;
}

interface StepCompanyProps {
  onNext: (data: CompanyData) => void;
  onBack: () => void;
  initialData?: {
    companyName?: string;
    industry?: string;
    website?: string;
  };
}

export default function StepCompany({ onNext, onBack, initialData }: StepCompanyProps) {
  const [companyName, setCompanyName] = useState(initialData?.companyName ?? '');
  const [industry, setIndustry] = useState(initialData?.industry ?? '');
  const [website, setWebsite] = useState(initialData?.website ?? '');
  const [touched, setTouched] = useState(false);

  const trimmedName = companyName.trim();
  const isCompanyValid = trimmedName.length >= 2;
  const showError = touched && !isCompanyValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isCompanyValid) return;
    onNext({
      companyName: trimmedName,
      industry: industry || undefined,
      website: website.trim() || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="max-w-lg mx-auto px-6 select-none"
    >
      {/* Icon Badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'backOut' }}
        className="flex justify-center mb-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#181818] border border-white/10 flex items-center justify-center shadow-2xl">
          <Building2 className="w-8 h-8 text-[#E50914]" strokeWidth={1.75} />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-black text-white tracking-tight mb-3">
          Configure Your Enterprise.
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          Specify your organisation profile to anchor brand compliance constraints and automated checks.
        </p>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* Company Name */}
        <div>
          <label htmlFor="companyName" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
            Company Name <span className="text-[#E50914]">*</span>
          </label>
          <input
            id="companyName"
            type="text"
            autoFocus
            autoComplete="organization"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Nexus Dynamics"
            className={`input-field w-full ${
              showError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''
            }`}
          />
          {showError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-xs text-red-400"
            >
              Company name must be at least 2 characters.
            </motion.p>
          )}
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="industry" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
            Industry Sector{' '}
            <span className="text-neutral-500 font-normal">(optional)</span>
          </label>
          <select
            id="industry"
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            className="input-field w-full appearance-none cursor-pointer bg-[#1F1F1F] text-white"
          >
            <option value="">Select industry classification…</option>
            {INDUSTRIES.map(ind => (
              <option key={ind} value={ind} className="bg-[#1F1F1F] text-white">
                {ind}
              </option>
            ))}
          </select>
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
            Corporate Domain{' '}
            <span className="text-neutral-500 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Globe className="w-4 h-4 text-neutral-500" />
            </div>
            <input
              id="website"
              type="url"
              autoComplete="url"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://company.com"
              className="input-field w-full pl-10"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary flex items-center justify-center gap-2 py-3.5 px-5 text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold uppercase tracking-wider"
          >
            Continue to Brand Rules
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
