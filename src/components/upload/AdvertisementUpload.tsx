'use client';

import React, {
  useState,
  useRef,
  useCallback,
  DragEvent,
  ChangeEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ImageIcon, X, AlertCircle, Loader2, Scan, Server, AlertTriangle } from 'lucide-react';
import { validateImageFile } from '@/lib/validation';
import { useBackend } from '@/context/BackendContext';

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

const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp';

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function AdvertisementUpload({
  onUpload,
  isAnalysing,
}: AdvertisementUploadProps) {
  const { isOnline, isWaking, recheck } = useBackend();
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

    // Revoke previous object URL to avoid memory leaks
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
    if (!isOnline) {
      setValidationError('AI Engine cluster is currently booting up from spin-down. Please allow ~20-30 seconds.');
      recheck();
      return;
    }
    if (fileState && !isAnalysing) {
      onUpload(fileState.file);
    }
  };

  const canSubmit = !!fileState && !isAnalysing && isOnline;

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
            ? 'border-slate-200 cursor-default bg-slate-50'
            : isDragging
            ? 'border-blue-500 bg-blue-50 cursor-copy'
            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer bg-white',
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
              <div className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm max-h-48 max-w-xs w-full flex items-center justify-center bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileState.previewUrl}
                  alt="Advertisement preview"
                  className="max-h-48 max-w-full object-contain"
                />
              </div>

              {/* File meta */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 leading-tight truncate max-w-[200px]">
                    {fileState.file.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
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
                  'flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-200',
                  isDragging ? 'bg-blue-100' : 'bg-slate-100',
                ].join(' ')}
              >
                <Upload
                  className={[
                    'h-6 w-6 transition-colors duration-200',
                    isDragging ? 'text-blue-600' : 'text-slate-400',
                  ].join(' ')}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Drag & drop your advertisement here
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  or{' '}
                  <span className="text-blue-600 font-medium underline underline-offset-2 cursor-pointer">
                    browse files
                  </span>
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Supports JPG, PNG, WEBP · Max 10 MB
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
              className="absolute inset-0 bg-blue-50/80 flex items-center justify-center rounded-xl"
            >
              <div className="flex flex-col items-center gap-2 text-blue-600">
                <Upload className="h-8 w-8 animate-bounce" />
                <p className="text-sm font-semibold">Drop to upload</p>
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
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
          >
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{validationError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action Buttons ──────────────────────────────────────────────── */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {/* Remove / Replace */}
        <AnimatePresence>
          {fileState && !isAnalysing && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              type="button"
              onClick={clearFile}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <X className="h-4 w-4" />
              Remove
            </motion.button>
          )}
        </AnimatePresence>

        {/* Replace (when no file, offer browse again) */}
        {fileState && !isAnalysing && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Replace
          </button>
        )}

        {/* Analyse button */}
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleAnalyse}
            disabled={!fileState || isAnalysing || !isOnline}
            className={[
              'flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-150',
              fileState && !isAnalysing && isOnline
                ? 'bg-[#E50914] text-white hover:brightness-105 active:scale-95 shadow-md shadow-red-500/20'
                : 'bg-[#E8E2D9] text-neutral-400 cursor-not-allowed shadow-none',
            ].join(' ')}
          >
            {isAnalysing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Analysing visual compliance…</span>
              </>
            ) : !isOnline ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <span>Waiting for AI Cluster to wake…</span>
              </>
            ) : (
              <>
                <Scan className="h-4 w-4" />
                <span>Analyse Advertisement</span>
              </>
            )}
          </button>
          {!isOnline && fileState && (
            <p className="text-[11px] text-amber-700 font-medium">
              Backend instance is booting up. Analysis unlocks automatically when ready.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
