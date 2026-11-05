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
    return { stroke: '#16a34a', text: 'text-green-600', label: 'Excellent' };
  }
  if (score >= 75) {
    return { stroke: '#2563eb', text: 'text-blue-600', label: 'Good' };
  }
  if (score >= 50) {
    return { stroke: '#f97316', text: 'text-orange-500', label: 'Fair' };
  }
  return { stroke: '#dc2626', text: 'text-red-600', label: 'Poor' };
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
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`Score: ${clampedScore} out of 100`}
        role="img"
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
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
            fontWeight: 700,
            fill: colour.stroke,
          }}
        >
          {clampedScore}
        </text>
      </svg>

      {showLabel && (
        <span className={`text-xs font-semibold tracking-wide ${colour.text}`}>
          {colour.label}
        </span>
      )}
    </div>
  );
}
