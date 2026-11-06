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
      <div className="rounded-xl bg-black/60 p-8 sm:p-10 border border-white/10 shadow-2xl backdrop-blur-sm">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
             style={{ backgroundColor: '#E5091420' }}>
          <Building2 className="w-6 h-6" style={{ color: '#E50914' }} />
        </div>
        <h1 className="text-white text-3xl font-bold mb-2 tracking-tight">Add your company</h1>
        <p className="text-neutral-400 text-sm mb-8">
          Name it, then tell our AI how this brand must advertise.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Company name */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wide">
              Company name
            </label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Vintage Voyages"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={`w-full rounded-md bg-neutral-800/80 border ${
                touched && !nameOk ? 'border-[#E50914]' : 'border-white/15'
              } px-4 py-3.5 text-white placeholder-neutral-500 outline-none
                 focus:border-neutral-300 focus:bg-neutral-800 transition-colors`}
            />
            {touched && !nameOk && (
              <p className="mt-1.5 text-xs text-[#EB3942]">Name needs at least 2 characters.</p>
            )}
          </div>

          {/* Industry (optional) */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wide">
              Industry <span className="text-neutral-600 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Travel, SaaS, Cosmetics…"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-md bg-neutral-800/80 border border-white/15 px-4 py-3.5
                         text-white placeholder-neutral-500 outline-none
                         focus:border-neutral-300 focus:bg-neutral-800 transition-colors"
            />
          </div>

          {/* Rules & regulations */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wide">
              <AlignLeft className="w-3.5 h-3.5" />
              Rules &amp; regulations
            </label>
            <textarea
              rows={5}
              placeholder={'Your brand rulebook. Example:\n• Logo always top-left\n• Headlines use the brand typeface, bold\n• Never use competitor names\n• All prices in ₹ with GST listed'}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              className="w-full rounded-md bg-neutral-800/80 border border-white/15 px-4 py-3.5
                         text-white placeholder-neutral-500 outline-none resize-y
                         focus:border-neutral-300 focus:bg-neutral-800 transition-colors"
            />
            <p className="mt-1.5 text-xs text-neutral-600">
              Paste your brandbook text, guidelines or policy — the more specific, the sharper
              the compliance checks.
            </p>
          </div>

          {/* Guideline files */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wide">
              Guideline files (optional, up to 10)
            </label>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="w-full rounded-md border-2 border-dashed border-white/15 px-4 py-6
                         hover:border-neutral-400/60 hover:bg-white/5 transition-all
                         flex items-center justify-center gap-2 text-sm text-neutral-400"
            >
              <FileText className="w-4 h-4" />
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
                    className="flex items-center justify-between rounded-md bg-neutral-800/70 border border-white/10 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm text-neutral-300 truncate">
                      <FileText className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-neutral-500 hover:text-neutral-300"
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
              className="rounded-md bg-[#E50914]/15 border border-[#E50914]/40 px-4 py-3 text-sm text-[#FF6B6B]"
            >
              {error}
            </motion.p>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors px-1"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={busy || (touched && !valid)}
              className="flex-1 rounded-md font-semibold py-3.5 text-white transition-all shadow-lg
                         hover:brightness-110 active:scale-[0.99] disabled:opacity-30"
              style={{ backgroundColor: '#E50914' }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {busy ? 'Setting up…' : 'Create workspace'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
