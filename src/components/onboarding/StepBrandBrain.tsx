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
  'Brand voice & tone guidelines',
  'Advertising regulations & restrictions',
  'Approved claims & messaging',
  'Brand colours & logo usage rules',
  'Restricted terms & language',
  'Industry-specific compliance rules',
  'Target audience definitions',
  'Product / service descriptions',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      className="max-w-2xl mx-auto px-6"
    >
      {/* Icon Badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'backOut' }}
        className="flex justify-center mb-8"
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Brain className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">
          Build your Brand Brain.
        </h1>
        <p className="text-slate-500 text-base leading-relaxed max-w-lg mx-auto">
          Upload your brand guidelines so Inkloom can generate perfectly compliant advertising — every time.
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
          <label htmlFor="rulesText" className="block text-sm font-medium text-slate-700 mb-2">
            Paste your brand guidelines
          </label>
          <textarea
            id="rulesText"
            value={rulesText}
            onChange={e => setRulesText(e.target.value)}
            placeholder={`Include things like:\n• Approved product claims and messaging\n• Restricted terms and language to avoid\n• Brand voice and tone guidelines\n• Regulatory requirements for your industry\n• Target audience descriptions\n• Any specific advertising rules`}
            className="input-field w-full resize-none font-mono text-sm leading-relaxed"
            style={{ minHeight: '300px' }}
          />
        </div>

        {/* OR Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">or upload files</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* File Upload Zone */}
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
              isDragging
                ? 'border-blue-400 bg-blue-50/60 scale-[1.01]'
                : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  isDragging ? 'bg-blue-100' : 'bg-white border border-slate-200'
                }`}
              >
                <Upload
                  className={`w-6 h-6 transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400'}`}
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {isDragging ? 'Drop files here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Accepts .txt, .pdf, .docx — multiple files supported
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
                    className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <FileUp className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-medium text-slate-700">What to include in your guidelines:</p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {HELPER_ITEMS.map(item => (
              <li key={item} className="flex items-start gap-2 text-xs text-slate-500">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
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
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                confirmed
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-slate-300 bg-white group-hover:border-blue-400'
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
          <p className="text-sm text-slate-600 leading-relaxed">
            I confirm these are authorised company guidelines and I have the right to upload this content.
          </p>
        </label>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary flex items-center justify-center gap-2 py-3.5 px-5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Brain className="w-5 h-5" />
            Build My Brand Brain
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
