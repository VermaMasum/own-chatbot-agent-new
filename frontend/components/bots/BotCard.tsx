'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Globe,
  MoreVertical,
  PlayCircle,
  Code2,
  Palette,
  Trash2,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { formatRelativeTime, getDomainFromUrl, getBusinessTypeIcon } from '@/lib/utils';
import type { Bot } from '@/lib/types';

interface BotCardProps {
  bot: Bot;
  onDelete?: (id: string) => void;
}

export function BotCard({ bot, onDelete }: BotCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="bg-white rounded-2xl border border-slate-100 shadow-card hover:shadow-card-hover transition-shadow group"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
              {getBusinessTypeIcon(bot.businessType)}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{bot.name}</h3>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                <Globe className="w-3 h-3" />
                <span className="truncate">{getDomainFromUrl(bot.websiteUrl)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={bot.status} />
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-20">
                    <Link
                      href={`/dashboard/bots/${bot.id}/playground`}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <PlayCircle className="w-4 h-4" /> Playground
                    </Link>
                    <Link
                      href={`/dashboard/bots/${bot.id}/embed`}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Code2 className="w-4 h-4" /> Embed
                    </Link>
                    <Link
                      href={`/dashboard/bots/${bot.id}/customize`}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Palette className="w-4 h-4" /> Customize
                    </Link>
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete?.(bot.id);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 py-3 border-y border-slate-50">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-slate-700">{bot.messagesCount ?? 0}</span>
            <span>messages</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatRelativeTime(bot.createdAt)}</span>
          </div>
        </div>

        {/* Business type */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs bg-slate-50 border border-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">
            {bot.businessType.replace('_', ' ')}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/bots/${bot.id}/playground`}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-medium rounded-lg transition-colors"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Playground
          </Link>
          <Link
            href={`/dashboard/bots/${bot.id}/embed`}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium rounded-lg transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            Embed
          </Link>
          <Link
            href={`/dashboard/bots/${bot.id}/customize`}
            className="flex items-center justify-center w-8 h-8 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
          >
            <Palette className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
