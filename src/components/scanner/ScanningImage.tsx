'use client';

import { motion } from 'framer-motion';
import { ImageIcon } from 'lucide-react';

interface ScanningImageProps {
  imageUrl: string | null;
  isScanning: boolean;
}

/** Corner bracket SVG decoration — rendered at each of the four corners */
function CornerBracket({
  position,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
}) {
  const rotations: Record<typeof position, string> = {
    tl: 'rotate(0deg)',
    tr: 'rotate(90deg)',
    bl: 'rotate(270deg)',
    br: 'rotate(180deg)',
  };
  const placements: Record<typeof position, string> = {
    tl: 'top-3 left-3',
    tr: 'top-3 right-3',
    bl: 'bottom-3 left-3',
    br: 'bottom-3 right-3',
  };

  return (
    <motion.div
      className={`absolute ${placements[position]} w-6 h-6`}
      style={{ transform: rotations[position] }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <path
          d="M2 10 L2 2 L10 2"
          stroke="#2563EB"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

/** Subtle blue grid overlay rendered as an SVG pattern */
function GridOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      <svg
        className="w-full h-full opacity-[0.07]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="scan-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="#2563EB"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#scan-grid)" />
      </svg>
    </div>
  );
}

/** Animated horizontal scan line with blue glow */
function ScanLine({ isScanning }: { isScanning: boolean }) {
  if (!isScanning) return null;

  return (
    <motion.div
      className="absolute left-0 right-0 pointer-events-none z-10"
      style={{ height: '3px' }}
      initial={{ top: '0%' }}
      animate={{ top: ['0%', '100%', '0%'] }}
      transition={{
        duration: 2.8,
        ease: 'linear',
        repeat: Infinity,
        repeatType: 'loop',
      }}
    >
      {/* Glow halo */}
      <div
        className="absolute inset-x-0"
        style={{
          height: '28px',
          top: '-13px',
          background:
            'linear-gradient(to bottom, transparent, rgba(37,99,235,0.18) 40%, rgba(37,99,235,0.28) 50%, rgba(37,99,235,0.18) 60%, transparent)',
          filter: 'blur(4px)',
        }}
      />
      {/* Core line */}
      <div
        className="absolute inset-x-0 h-[3px]"
        style={{
          background:
            'linear-gradient(to right, transparent 0%, rgba(37,99,235,0.6) 15%, #2563EB 40%, #60A5FA 50%, #2563EB 60%, rgba(37,99,235,0.6) 85%, transparent 100%)',
          boxShadow:
            '0 0 8px 2px rgba(37,99,235,0.7), 0 0 20px 4px rgba(96,165,250,0.4)',
        }}
      />
    </motion.div>
  );
}

/** "ANALYSING" pulsing badge */
function AnalysingBadge({ isScanning }: { isScanning: boolean }) {
  if (!isScanning) return null;

  return (
    <motion.div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      <motion.div
        className="flex items-center gap-1.5 bg-blue-600 text-white text-[10px] font-bold tracking-widest px-3 py-1 rounded-full shadow-lg"
        animate={{ opacity: [1, 0.65, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
        </span>
        ANALYSING
      </motion.div>
    </motion.div>
  );
}

export default function ScanningImage({
  imageUrl,
  isScanning,
}: ScanningImageProps) {
  return (
    <div className="relative w-full h-full min-h-[340px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/60 shadow-xl">
      {/* Image or placeholder */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Advertisement being analysed"
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
          <ImageIcon className="w-12 h-12 opacity-30" />
          <p className="text-sm font-medium opacity-40">No preview available</p>
        </div>
      )}

      {/* Overlay dark vignette to give scanning compositing room */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(2,8,23,0.45) 100%)',
        }}
      />

      {/* Grid */}
      <GridOverlay />

      {/* Scan line */}
      <ScanLine isScanning={isScanning} />

      {/* Corner brackets */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
        <CornerBracket key={pos} position={pos} />
      ))}

      {/* Analysing badge */}
      <AnalysingBadge isScanning={isScanning} />
    </div>
  );
}
