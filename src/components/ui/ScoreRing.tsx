'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

type ScoreColour = {
  stroke: string;
  text: string;
  label: string;
};

function getScoreColour(score: number): ScoreColour {
  if (score >= 90) {
    return { stroke: '#10b981', text: 'text-emerald-400', label: 'APPROVED' };
  }
  if (score >= 75) {
    return { stroke: '#3b82f6', text: 'text-blue-400', label: 'SATISFACTORY' };
  }
  if (score >= 50) {
    return { stroke: '#f59e0b', text: 'text-amber-400', label: 'NEEDS REVIEW' };
  }
  return { stroke: '#E50914', text: 'text-[#E50914]', label: 'REJECTED' };
}

export default function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  showLabel = true,
}: ScoreRingProps) {
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));
  const colour = getScoreColour(clampedScore);

  const radius = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const dashOffset = useMemo(
    () => circumference - (clampedScore / 100) * circumference,
    [circumference, clampedScore]
  );

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`Compliance Score: ${clampedScore} out of 100`}
        role="img"
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#262626"
          strokeWidth={strokeWidth}
        />

        {/* Animated progress arc */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={colour.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform={`rotate(-90 ${cx} ${cy})`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }}
        />

        {/* Score Number */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: size * 0.22,
            fontFamily: 'inherit',
            fontWeight: 800,
            fill: '#ffffff',
          }}
        >
          {clampedScore}
        </text>
      </svg>

      {showLabel && (
        <span
          className={`text-xs font-bold uppercase tracking-wider ${colour.text}`}
        >
          {colour.label}
        </span>
      )}
    </div>
  );
}
