'use client';

import React, {
  useState,
  useRef,
  useCallback,
  DragEvent,
  ChangeEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ImageIcon, X, AlertCircle, Loader2, Scan } from 'lucide-react';
import { validateImageFile } from '@/lib/validation';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface AdvertisementUploadProps {
  onUpload: (file: File) => void;
  isAnalysing: boolean;
}

interface FileState {
  file: File;
  previewUrl: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp';

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function AdvertisementUpload({
  onUpload,
  isAnalysing,
}: AdvertisementUploadProps) {
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Pick / replace a file */
  const applyFile = useCallback((file: File) => {
    setValidationError(null);

    const error = validateImageFile(file);
    if (error) {
      setValidationError(error);
      return;
    }

    setFileState((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  }, []);

  /* Clear file */
  const clearFile = useCallback(() => {
    setFileState((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setValidationError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  /* Drag events */
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  };

  /* File input change */
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  };

  /* Submit */
  const handleAnalyse = () => {
    if (fileState && !isAnalysing) {
      onUpload(fileState.file);
    }
  };

  const canSubmit = !!fileState && !isAnalysing;

  return (
    <div className="space-y-4">
      {/* ── Drop Zone ──────────────────────────────────────────────────── */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !fileState && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !fileState)
            inputRef.current?.click();
        }}
        aria-label="Upload advertisement image"
        className={[
          'relative min-h-[220px] rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center overflow-hidden',
          fileState
            ? 'border-white/10 cursor-default bg-[#141414]'
            : isDragging
            ? 'border-[#E50914] bg-red-950/20 cursor-copy'
            : 'border-white/15 hover:border-[#E50914]/60 hover:bg-[#1a1a1a] cursor-pointer bg-[#141414]',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={onInputChange}
          className="hidden"
          aria-hidden="true"
        />

        <AnimatePresence mode="wait">
          {fileState ? (
            /* Preview */
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full flex flex-col items-center justify-center gap-4 p-6"
            >
              {/* Image preview */}
              <div className="relative rounded-lg overflow-hidden border border-white/15 shadow-xl max-h-52 max-w-sm w-full flex items-center justify-center bg-black/60 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileState.previewUrl}
                  alt="Advertisement preview"
                  className="max-h-48 max-w-full object-contain rounded"
                />
              </div>

              {/* File meta */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-[#202020] border border-white/10">
                  <ImageIcon className="h-4 w-4 text-[#E50914]" />
                </div>
                <div>
                  <p className="font-semibold text-white leading-tight truncate max-w-[240px]">
                    {fileState.file.name}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {formatBytes(fileState.file.size)}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Empty state */
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-3 px-6 py-10 text-center"
            >
              <div
                className={[
                  'flex h-14 w-14 items-center justify-center rounded-xl transition-colors duration-200 border border-white/10',
                  isDragging ? 'bg-red-950/80' : 'bg-[#202020]',
                ].join(' ')}
              >
                <Upload
                  className={[
                    'h-6 w-6 transition-colors duration-200',
                    isDragging ? 'text-[#E50914]' : 'text-neutral-400',
                  ].join(' ')}
                />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Drag & drop your advertisement banner here
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  or{' '}
                  <span className="text-[#E50914] font-semibold underline underline-offset-2 cursor-pointer">
                    browse files
                  </span>
                </p>
              </div>
              <p className="text-xs text-neutral-500">
                Supports JPG, PNG, WEBP · Max 15 MB
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 border-2 border-[#E50914] flex items-center justify-center rounded-xl"
            >
              <div className="flex flex-col items-center gap-2 text-[#E50914]">
                <Upload className="h-8 w-8 animate-bounce" />
                <p className="text-sm font-bold">Release to verify image</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Validation Error ────────────────────────────────────────────── */}
      <AnimatePresence>
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 rounded-lg border border-red-800/60 bg-red-950/60 px-4 py-3"
          >
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{validationError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action Buttons ──────────────────────────────────────────────── */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {/* Remove */}
        <AnimatePresence>
          {fileState && !isAnalysing && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              type="button"
              onClick={clearFile}
              className="flex items-center justify-center gap-2 rounded-md border border-white/10 bg-[#222222] px-5 py-2.5 text-sm font-semibold text-neutral-300 hover:border-red-800/80 hover:text-red-400 hover:bg-red-950/40 transition-colors"
            >
              <X className="h-4 w-4" />
              Remove
            </motion.button>
          )}
        </AnimatePresence>

        {/* Replace */}
        {fileState && !isAnalysing && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-md border border-white/10 bg-[#222222] px-5 py-2.5 text-sm font-semibold text-neutral-300 hover:border-white/20 hover:text-white transition-colors"
          >
            <Upload className="h-4 w-4" />
            Replace
          </button>
        )}

        {/* Analyse button */}
        <button
          type="button"
          onClick={handleAnalyse}
          disabled={!canSubmit}
          className={[
            'flex items-center justify-center gap-2 rounded-md px-6 py-2.5 text-sm font-bold transition-all duration-150',
            canSubmit
              ? 'bg-[#E50914] text-white hover:bg-[#b80710] active:scale-95 shadow-lg shadow-red-950/50'
              : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5',
          ].join(' ')}
        >
          {isAnalysing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running Multimodal AI Inspection…
            </>
          ) : (
            <>
              <Scan className="h-4 w-4" />
              Verify Ad with NVIDIA AI
            </>
          )}
        </button>
      </div>
    </div>
  );
}
