'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({
  title = 'No bots yet',
  description = "You haven't created any chatbots yet. Build your first one in minutes.",
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-4 text-center"
    >
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center">
          <Bot className="w-10 h-10 text-indigo-500" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-8 leading-relaxed">{description}</p>

      {action && (
        <>
          {action.href ? (
            <Link href={action.href}>
              <Button leftIcon={<Plus className="w-4 h-4" />}>{action.label}</Button>
            </Link>
          ) : (
            <Button onClick={action.onClick} leftIcon={<Plus className="w-4 h-4" />}>
              {action.label}
            </Button>
          )}
        </>
      )}
    </motion.div>
  );
}
