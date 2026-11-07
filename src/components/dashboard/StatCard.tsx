'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  colour?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
}

const colourMap: Record<
  NonNullable<StatCardProps['colour']>,
  { bg: string; text: string; badge: string }
> = {
  red:    { bg: 'bg-red-950/70',     text: 'text-[#E50914]',   badge: 'bg-red-900/40 text-red-300 border border-red-700/50' },
  blue:   { bg: 'bg-blue-950/70',    text: 'text-blue-400',    badge: 'bg-blue-900/40 text-blue-300 border border-blue-700/50' },
  green:  { bg: 'bg-emerald-950/70', text: 'text-emerald-400', badge: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50' },
  orange: { bg: 'bg-amber-950/70',   text: 'text-amber-400',   badge: 'bg-amber-900/40 text-amber-300 border border-amber-700/50' },
  purple: { bg: 'bg-purple-950/70',  text: 'text-purple-400',  badge: 'bg-purple-900/40 text-purple-300 border border-purple-700/50' },
};

export default function StatCard({
  title,
  value,
  icon,
  trend,
  colour = 'red',
}: StatCardProps) {
  const c = colourMap[colour] || colourMap.red;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-[#181818] rounded-xl border border-white/10 p-6 shadow-xl hover:border-white/20 transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg border border-white/5 ${c.bg} ${c.text}`}>
          {icon}
        </div>

        {/* Trend badge */}
        {trend && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.badge}`}>
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
        className="mt-4 text-3xl font-extrabold text-white tracking-tight"
      >
        {value}
      </motion.p>

      {/* Title */}
      <p className="mt-1 text-sm font-medium text-neutral-400">{title}</p>
    </motion.div>
  );
}
