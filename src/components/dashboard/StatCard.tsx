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
  { bg: string; icon: string; border: string }
> = {
  red:    { bg: 'bg-red-50 text-red-600',    icon: '#E50914', border: 'border-red-100 hover:border-red-200' },
  green:  { bg: 'bg-emerald-50 text-emerald-600', icon: '#10B981', border: 'border-emerald-100 hover:border-emerald-200' },
  orange: { bg: 'bg-amber-50 text-amber-600',  icon: '#F59E0B', border: 'border-amber-100 hover:border-amber-200' },
  purple: { bg: 'bg-purple-50 text-purple-600', icon: '#9333EA', border: 'border-purple-100 hover:border-purple-200' },
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
      className={`bg-white rounded-2xl border ${c.border} p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] transition-all`}
    >
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg}`}
        >
          {icon}
        </div>

        {/* Trend badge */}
        {trend && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#E8E2D9] text-neutral-600">
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
        className="mt-4 text-3xl font-extrabold text-neutral-900 tracking-tight"
      >
        {value}
      </motion.p>

      {/* Title */}
      <p className="mt-1 text-xs font-medium text-neutral-500">{title}</p>
    </motion.div>
  );
}