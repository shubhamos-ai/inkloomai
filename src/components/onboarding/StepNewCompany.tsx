'use client';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, FileText, X, Loader2, AlignLeft } from 'lucide-react';

interface StepNewCompanyProps {
  onSubmit: (values: {
    companyName: string;
    industry?: string;
    rulesText?: string;
    files: File[];
  }) => Promise<string | null>;
  onBack: () => void;
}

export default function StepNewCompany({ onSubmit, onBack }: StepNewCompanyProps) {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const nameOk = companyName.trim().length >= 2;
  const valid = nameOk;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)].slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit({
      companyName: companyName.trim(),
      industry: industry.trim() || undefined,
      rulesText: rulesText.trim() || undefined,
      files,
    });
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="w-full max-w-xl mx-auto"
    >
      <div className="rounded-2xl bg-white p-8 sm:p-10 border border-[#E8E2D9] shadow-[0_12px_40px_rgba(26,24,22,0.06)]">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-red-50 border border-red-100">
          <Building2 className="w-6 h-6" style={{ color: '#E50914' }} />
        </div>
        <h1 className="text-neutral-900 text-3xl font-black mb-2 tracking-tight">Add your organisation</h1>
        <p className="text-neutral-500 text-sm mb-8">
          Name it, then provide guidelines for the AI Brand Brain to enforce.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Company name */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 mb-2 uppercase tracking-wider">
              Organisation Name
            </label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Vintage Voyages"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={`w-full rounded-xl bg-[#FAF8F5] border ${
                touched && !nameOk ? 'border-[#E50914]' : 'border-[#E0D8CB]'
              } px-4 py-3.5 text-neutral-900 placeholder-neutral-400 outline-none
                 focus:border-[#E50914] focus:bg-white transition-all text-sm`}
            />
            {touched && !nameOk && (
              <p className="mt-1.5 text-xs text-[#E50914] font-medium">Name needs at least 2 characters.</p>
            )}
          </div>

          {/* Industry (optional) */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 mb-2 uppercase tracking-wider">
              Industry Sector <span className="text-neutral-400 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Luxury Goods, SaaS, Retail, FinTech"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-xl bg-[#FAF8F5] border border-[#E0D8CB] px-4 py-3.5
                         text-neutral-900 placeholder-neutral-400 outline-none
                         focus:border-[#E50914] focus:bg-white transition-all text-sm"
            />
          </div>

          {/* Rules & regulations */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-neutral-600 mb-2 uppercase tracking-wider">
              <AlignLeft className="w-3.5 h-3.5 text-[#E50914]" />
              Brand Guidelines &amp; Policies
            </label>
            <textarea
              rows={5}
              placeholder={'Paste brand guidelines or policies:\n• Primary logo always placed top-left on white background\n• Headlines must strictly use brand typeface, bold\n• No comparative claims or unverified awards\n• Mandatory disclaimers on financial offers'}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              className="w-full rounded-xl bg-[#FAF8F5] border border-[#E0D8CB] px-4 py-3.5
                         text-neutral-900 placeholder-neutral-400 outline-none resize-y
                         focus:border-[#E50914] focus:bg-white transition-all text-sm leading-relaxed"
            />
            <p className="mt-1.5 text-xs text-neutral-400">
              Our AI Brand-Rule Extraction engine converts these guidelines into verifiable, versioned compliance rules.
            </p>
          </div>

          {/* Guideline files */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 mb-2 uppercase tracking-wider">
              Brand Guidelines Documents (PDF / DOCX / TXT)
            </label>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-[#D6CCC0] bg-[#FAF8F5] px-4 py-6
                         hover:border-[#E50914] hover:bg-red-50/20 transition-all
                         flex items-center justify-center gap-2 text-sm text-neutral-600"
            >
              <FileText className="w-4 h-4 text-[#E50914]" />
              Attach PDF / DOCX / TXT brandbooks
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.txt,.docx,.md"
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between rounded-xl bg-[#FAF8F5] border border-[#E8E2D9] px-3.5 py-2"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium text-neutral-700 truncate">
                      <FileText className="w-3.5 h-3.5 text-[#E50914] shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-neutral-400 hover:text-red-600"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-[#E50914] font-medium"
            >
              {error}
            </motion.p>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-800 transition-colors px-2 py-2"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={busy || (touched && !valid)}
              className="flex-1 rounded-xl font-bold py-3.5 text-white transition-all shadow-lg shadow-red-500/25
                         hover:brightness-105 active:scale-[0.99] disabled:opacity-30"
              style={{ backgroundColor: '#E50914' }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {busy ? 'Configuring Brand Brain…' : 'Initialize Workspace'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
