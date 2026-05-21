'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Bot } from 'lucide-react';
import { BotCard } from '@/components/bots/BotCard';
import { EmptyState } from '@/components/bots/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/Modal';
import { useBots } from '@/hooks/useBots';
import { useToast } from '@/contexts/ToastContext';
import type { Bot as BotType } from '@/lib/types';

const STATUS_FILTERS = ['all', 'active', 'inactive', 'building'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function BotsPage() {
  const { bots, isLoading, error, deleteBot } = useBots();
  const { success, error: showError } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deletingBot, setDeletingBot] = useState<BotType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredBots = bots.filter((bot) => {
    const matchesSearch =
      search === '' ||
      bot.name.toLowerCase().includes(search.toLowerCase()) ||
      bot.businessType.toLowerCase().includes(search.toLowerCase()) ||
      bot.websiteUrl.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async () => {
    if (!deletingBot) return;
    setIsDeleting(true);
    try {
      await deleteBot(deletingBot.id);
      success(`"${deletingBot.name}" has been deleted`);
      setDeletingBot(null);
    } catch {
      showError('Failed to delete bot. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Bots</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isLoading ? 'Loading...' : `${bots.length} bot${bots.length !== 1 ? 's' : ''} created`}
          </p>
        </div>
        <Link href="/dashboard/bots/new">
          <Button leftIcon={<Plus className="w-4 h-4" />}>Create New Bot</Button>
        </Link>
      </div>

      {/* Filters */}
      {!isLoading && bots.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search bots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
            <Bot className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">Failed to load bots</p>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <EmptyState
          action={{ label: 'Create Your First Bot', href: '/dashboard/bots/new' }}
        />
      ) : filteredBots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">No bots match your search</p>
          <p className="text-xs text-slate-400">Try adjusting your filters</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); }}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filteredBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onDelete={(id) => setDeletingBot(bots.find((b) => b.id === id) || null)}
            />
          ))}
        </motion.div>
      )}

      <ConfirmModal
        isOpen={!!deletingBot}
        onClose={() => setDeletingBot(null)}
        onConfirm={handleDelete}
        title="Delete Bot"
        description={`Are you sure you want to delete "${deletingBot?.name}"? This action cannot be undone and will remove all associated data.`}
        confirmLabel="Delete Bot"
        isLoading={isDeleting}
      />
    </div>
  );
}
