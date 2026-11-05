'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  colour?: 'blue' | 'green' | 'orange' | 'purple';
}

const colourMap: Record<
  NonNullable<StatCardProps['colour']>,
  { bg: string; text: string; badge: string }
> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  badge: 'bg-green-100 text-green-700' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
};

export default function StatCard({
  title,
  value,
  icon,
  trend,
  colour = 'blue',
}: StatCardProps) {
  const c = colourMap[colour];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
          {icon}
        </div>

        {/* Trend badge */}
        {trend && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.badge}`}>
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
        className="mt-4 text-3xl font-bold text-slate-900 tracking-tight"
      >
        {value}
      </motion.p>

      {/* Title */}
      <p className="mt-1 text-sm font-medium text-slate-500">{title}</p>
    </motion.div>
  );
}
