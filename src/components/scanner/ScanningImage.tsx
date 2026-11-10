'use client';

import { motion } from 'framer-motion';
import { ImageIcon, Sparkles, Cpu } from 'lucide-react';

interface ScanningImageProps {
  imageUrl: string | null;
  isScanning: boolean;
}

/** Corner bracket SVG decoration */
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
    tl: 'top-3.5 left-3.5',
    tr: 'top-3.5 right-3.5',
    bl: 'bottom-3.5 left-3.5',
    br: 'bottom-3.5 right-3.5',
  };

  return (
    <motion.div
      className={`absolute ${placements[position]} w-7 h-7 z-20`}
      style={{ transform: rotations[position] }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_8px_rgba(229,9,20,0.6)]"
      >
        <path
          d="M2 12 L2 2 L12 2"
          stroke="#E50914"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

/** Luxury animated grid pattern with subtle crimson laser effect */
function GridOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      <svg
        className="w-full h-full opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="scan-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="#E50914"
              strokeWidth="0.75"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#scan-grid)" />
      </svg>
    </div>
  );
}

/** Animated horizontal laser scan line with high-intensity glow */
function ScanLine({ isScanning }: { isScanning: boolean }) {
  if (!isScanning) return null;

  return (
    <motion.div
      className="absolute left-0 right-0 pointer-events-none z-20"
      style={{ height: '3px' }}
      initial={{ top: '0%' }}
      animate={{ top: ['0%', '100%', '0%'] }}
      transition={{
        duration: 3.2,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'loop',
      }}
    >
      {/* Soft crimson ambient haze */}
      <div
        className="absolute inset-x-0"
        style={{
          height: '48px',
          top: '-24px',
          background:
            'linear-gradient(to bottom, transparent, rgba(229,9,20,0.15) 35%, rgba(229,9,20,0.3) 50%, rgba(229,9,20,0.15) 65%, transparent)',
          filter: 'blur(6px)',
        }}
      />
      {/* High-intensity core laser beam */}
      <div
        className="absolute inset-x-0 h-[3px]"
        style={{
          background:
            'linear-gradient(to right, transparent 0%, rgba(229,9,20,0.5) 15%, #E50914 45%, #FFFFFF 50%, #E50914 55%, rgba(229,9,20,0.5) 85%, transparent 100%)',
          boxShadow:
            '0 0 12px 3px rgba(229,9,20,0.8), 0 0 24px 6px rgba(229,9,20,0.4)',
        }}
      />
    </motion.div>
  );
}

/** Simulated AI Vision inspection bounding boxes scanning across creative */
function SimulatedTargetBoxes({ isScanning }: { isScanning: boolean }) {
  if (!isScanning) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {/* Target Box 1 - Logo Area */}
      <motion.div
        className="absolute rounded border border-red-500/80 bg-red-500/10"
        style={{ left: '12%', top: '15%', width: '28%', height: '18%' }}
        animate={{
          opacity: [0, 0.9, 0.9, 0],
          scale: [0.95, 1, 1, 0.98],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          repeatDelay: 0.8,
          times: [0, 0.2, 0.8, 1],
        }}
      >
        <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-semibold text-white bg-red-600/90 shadow-sm flex items-center gap-1">
          <Cpu className="w-2.5 h-2.5" />
          BRAND_LOGO: 98.4%
        </span>
      </motion.div>

      {/* Target Box 2 - Typography / Claim Area */}
      <motion.div
        className="absolute rounded border border-amber-500/80 bg-amber-500/10"
        style={{ left: '16%', top: '52%', width: '68%', height: '24%' }}
        animate={{
          opacity: [0, 0.95, 0.95, 0],
          scale: [0.97, 1, 1, 0.99],
        }}
        transition={{
          duration: 4.2,
          repeat: Infinity,
          delay: 1.2,
          times: [0, 0.25, 0.75, 1],
        }}
      >
        <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider font-semibold text-slate-900 bg-amber-400/95 shadow-sm">
          OCR_TEXT_INSPECTION
        </span>
      </motion.div>
    </div>
  );
}

/** Premium "AI AUDIT IN PROGRESS" status pill */
function AnalysingBadge({ isScanning }: { isScanning: boolean }) {
  if (!isScanning) return null;

  return (
    <motion.div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-red-500/40 text-white text-[11px] font-semibold tracking-wider px-3.5 py-1.5 rounded-full shadow-xl">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
        </span>
        <span className="text-white font-medium">INKLOOM VISION ENGINE</span>
        <span className="text-red-400 font-mono text-[10px]">LIVE</span>
      </div>
    </motion.div>
  );
}

export default function ScanningImage({
  imageUrl,
  isScanning,
}: ScanningImageProps) {
  return (
    <div className="relative w-full h-full min-h-[360px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center">
      {/* Image or placeholder */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Advertisement being analysed"
          className="w-full h-full object-contain p-2"
          draggable={false}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
          <ImageIcon className="w-12 h-12 opacity-30" />
          <p className="text-sm font-medium opacity-40">No preview available</p>
        </div>
      )}

      {/* Luxury vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(2,6,18,0.65) 100%)',
        }}
      />

      {/* Grid overlay */}
      <GridOverlay />

      {/* Dynamic bounding box inspection overlays */}
      <SimulatedTargetBoxes isScanning={isScanning} />

      {/* Laser scan line */}
      <ScanLine isScanning={isScanning} />

      {/* Corner precision brackets */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
        <CornerBracket key={pos} position={pos} />
      ))}

      {/* Top Badge */}
      <AnalysingBadge isScanning={isScanning} />
    </div>
  );
}
