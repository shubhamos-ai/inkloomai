'use client';
import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FileUp,
  FileText,
  X,
  Brain,
  CheckCircle,
  Upload,
} from 'lucide-react';

interface BrandBrainData {
  rulesText?: string;
  files?: File[];
}

interface StepBrandBrainProps {
  onNext: (data: BrandBrainData) => void;
  onBack: () => void;
}

const HELPER_ITEMS = [
  'Brand voice & visual identity',
  'Promotional discount restrictions & ceilings',
  'Approved claims & mandatory disclaimers',
  'Brand logos, color palettes & typography',
  'Prohibited phrases & restricted terms',
  'Regulatory compliance & allergen/disclaimer rules',
  'Dates, deadlines, and pricing formats',
  'Contact info and terms & conditions syntax',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function StepBrandBrain({ onNext, onBack }: StepBrandBrainProps) {
  const [rulesText, setRulesText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent = rulesText.trim().length > 0 || files.length > 0;
  const canSubmit = hasContent && confirmed;

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const accepted: File[] = [];
    Array.from(incoming).forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['txt', 'pdf', 'docx'].includes(ext ?? '')) {
        accepted.push(file);
      }
    });
    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      return [...prev, ...accepted.filter(f => !existingNames.has(f.name))];
    });
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onNext({
      rulesText: rulesText.trim() || undefined,
      files: files.length > 0 ? files : undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="max-w-2xl mx-auto px-6 select-none"
    >
      {/* Icon Badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'backOut' }}
        className="flex justify-center mb-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#181818] border border-white/10 flex items-center justify-center shadow-2xl">
          <Brain className="w-8 h-8 text-[#E50914]" strokeWidth={1.75} />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-black text-white tracking-tight mb-3">
          Build Your Brand Brain.
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed max-w-lg mx-auto">
          Specify your advertising policies and compliance constraints. Inkloom AI evaluates every banner upload against these exact policies.
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* Textarea */}
        <div>
          <label htmlFor="rulesText" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
            Paste Corporate Advertising Rules (Rules.txt)
          </label>
          <textarea
            id="rulesText"
            value={rulesText}
            onChange={e => setRulesText(e.target.value)}
            placeholder={`Example corporate rule set:\n1. Logos must maintain 20px clear margin and cannot be cropped.\n2. Promotional discounts cannot exceed 40% under any circumstance.\n3. Mandatory allergen disclaimer 'Contains Dairy' must appear on all food items.\n4. Dates must follow DD/MM/YYYY formatting.\n5. Customer support email support@company.com must be visible.`}
            className="input-field w-full resize-none font-mono text-sm leading-relaxed"
            style={{ minHeight: '260px' }}
          />
        </div>

        {/* OR Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">or attach document</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* File Upload Zone */}
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
              isDragging
                ? 'border-[#E50914] bg-red-950/20 scale-[1.01]'
                : 'border-white/15 bg-[#181818] hover:border-[#E50914]/60 hover:bg-[#1f1f1f]'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  isDragging ? 'bg-red-900/40 text-[#E50914]' : 'bg-[#222222] border border-white/10 text-neutral-400'
                }`}
              >
                <Upload
                  className="w-6 h-6"
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {isDragging ? 'Drop rules file here' : 'Drag & drop or click to upload rules'}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Accepts .txt, .pdf, .docx (e.g. Rules.txt)
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.pdf,.docx"
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
          </div>

          {/* File List */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.ul
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 space-y-2"
              >
                {files.map((file, index) => (
                  <motion.li
                    key={file.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between gap-3 p-3 bg-[#181818] border border-white/10 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-[#252525] flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-[#E50914]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                        <p className="text-xs text-neutral-400">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* Helper Section */}
        <div className="p-4 bg-[#181818] rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <FileUp className="w-4 h-4 text-[#E50914]" />
            <p className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Recommended Rule Disciplines:</p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {HELPER_ITEMS.map(item => (
              <li key={item} className="flex items-start gap-2 text-xs text-neutral-400">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Confirmation Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 ${
                confirmed
                  ? 'bg-[#E50914] border-[#E50914]'
                  : 'border-white/20 bg-[#1F1F1F] group-hover:border-[#E50914]'
              }`}
            >
              {confirmed && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.15, ease: 'backOut' }}
                >
                  <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </motion.div>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            I confirm these represent authorized enterprise brand policies and compliance guidelines for automated verification.
          </p>
        </label>

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
            disabled={!canSubmit}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Brain className="w-5 h-5" />
            Synthesize Brand Brain
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
