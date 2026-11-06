'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  colour?: 'red' | 'green' | 'orange' | 'purple';
}

const colourMap: Record<
  NonNullable<StatCardProps['colour']>,
  { bg: string; icon: string; glow: string }
> = {
  red:    { bg: 'bg-[#E50914]/15',    icon: '#E50914',    glow: 'shadow-[0_0_20px_rgba(229,9,20,0.3)]' },
  green:  { bg: 'bg-emerald-500/15',  icon: '#10B981',    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]' },
  orange: { bg: 'bg-orange-500/15',   icon: '#F97316',    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]' },
  purple: { bg: 'bg-purple-500/15',   icon: '#A855F7',    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]' },
};

export default function StatCard({
  title,
  value,
  icon,
  trend,
  colour = 'red',
}: StatCardProps) {
  const c = colourMap[colour];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`bg-black/50 rounded-xl border border-white/10 p-5 backdrop-blur-sm hover:border-white/20 transition-all ${c.glow}`}
    >
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}
          style={{ color: c.icon }}
        >
          {icon}
        </div>

        {/* Trend badge */}
        {trend && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/10 text-neutral-400">
            {trend}
          </span>
        )}
      </div>

      {/* Value */}
      <motion.p
        key={String(value)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mt-4 text-3xl font-bold text-white tracking-tight"
      >
        {value}
      </motion.p>

      {/* Title */}
      <p className="mt-1 text-sm font-medium text-neutral-500">{title}</p>
    </motion.div>
  );
}