'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color?: string;
  index?: number;
}

export function StatsCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  color = 'indigo',
  index = 0,
}: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0;

  const colorMap: Record<string, { icon: string; text: string }> = {
    indigo: { icon: 'bg-indigo-50', text: 'text-indigo-600' },
    emerald: { icon: 'bg-emerald-50', text: 'text-emerald-600' },
    violet: { icon: 'bg-violet-50', text: 'text-violet-600' },
    amber: { icon: 'bg-amber-50', text: 'text-amber-600' },
    blue: { icon: 'bg-blue-50', text: 'text-blue-600' },
    rose: { icon: 'bg-rose-50', text: 'text-rose-600' },
  };

  const { icon: iconBg, text: iconText } = colorMap[color] || colorMap.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-2xl border border-slate-100 p-6 shadow-card"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', iconBg)}>
          <span className={iconText}>{icon}</span>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
        {change !== undefined && (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                isPositive ? 'text-emerald-600' : 'text-red-500'
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {Math.abs(change)}%
            </span>
            {changeLabel && (
              <span className="text-xs text-slate-400">{changeLabel}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
