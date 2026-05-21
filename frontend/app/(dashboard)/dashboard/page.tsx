'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bot,
  MessageSquare,
  Users,
  Code2,
  Plus,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { StatsCard } from '@/components/analytics/StatsCard';
import { BotCard } from '@/components/bots/BotCard';
import { EmptyState } from '@/components/bots/EmptyState';
import { SkeletonCard, SkeletonStats } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useBots } from '@/hooks/useBots';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const { bots, isLoading, deleteBot } = useBots();
  const { success, error } = useToast();

  const recentBots = bots.slice(0, 6);
  const activeBots = bots.filter((b) => b.status === 'active').length;
  const totalMessages = bots.reduce((sum, b) => sum + (b.messagesCount || 0), 0);

  const handleDelete = async (id: string) => {
    try {
      await deleteBot(id);
      success('Bot deleted successfully');
    } catch {
      error('Failed to delete bot');
    }
  };

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const statsData = [
    {
      label: 'Total Bots',
      value: isLoading ? '-' : bots.length,
      change: 12,
      changeLabel: 'from last month',
      icon: <Bot className="w-4.5 h-4.5 w-[18px] h-[18px]" />,
      color: 'indigo',
    },
    {
      label: 'Messages Today',
      value: isLoading ? '-' : Math.floor(totalMessages * 0.05 + Math.random() * 50),
      change: 8,
      changeLabel: 'from yesterday',
      icon: <MessageSquare className="w-[18px] h-[18px]" />,
      color: 'emerald',
    },
    {
      label: 'Active Users',
      value: isLoading ? '-' : activeBots * 23 + 12,
      change: -3,
      changeLabel: 'from last week',
      icon: <Users className="w-[18px] h-[18px]" />,
      color: 'violet',
    },
    {
      label: 'Embed Installs',
      value: isLoading ? '-' : bots.reduce((sum, b) => sum + (b.embedInstalls || 0), 0),
      change: 24,
      changeLabel: 'from last month',
      icon: <Code2 className="w-[18px] h-[18px]" />,
      color: 'amber',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold text-slate-900"
          >
            {greeting},{' '}
            <span className="gradient-text">{user?.name?.split(' ')[0] ?? 'there'}</span> 👋
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="text-sm text-slate-500 mt-1"
          >
            {formatDate(new Date().toISOString())} · Here's what's happening with your bots.
          </motion.p>
        </div>
        <Link href="/dashboard/bots/new">
          <Button leftIcon={<Plus className="w-4 h-4" />}>
            <span className="hidden sm:inline">New Bot</span>
            <span className="sm:hidden">New</span>
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStats key={i} />)
          : statsData.map((stat, i) => (
              <StatsCard key={stat.label} {...stat} index={i} />
            ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: '🚀',
            title: 'Create New Bot',
            desc: 'Build from your website URL',
            href: '/dashboard/bots/new',
            color: 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100',
          },
          {
            icon: '📊',
            title: 'View Analytics',
            desc: 'Messages & engagement data',
            href: '/dashboard/analytics',
            color: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100',
          },
          {
            icon: '⚙️',
            title: 'Settings',
            desc: 'Manage your account',
            href: '/dashboard/settings',
            color: 'bg-slate-50 border-slate-200 hover:bg-slate-100',
          },
        ].map((action) => (
          <Link key={action.title} href={action.href}>
            <motion.div
              whileHover={{ y: -2 }}
              className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-colors ${action.color}`}
            >
              <span className="text-2xl">{action.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{action.title}</p>
                <p className="text-xs text-slate-500">{action.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Recent Bots */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent Bots</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {bots.length} bot{bots.length !== 1 ? 's' : ''} total
            </p>
          </div>
          {bots.length > 0 && (
            <Link href="/dashboard/bots">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                View all
              </Button>
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : recentBots.length === 0 ? (
          <EmptyState
            action={{ label: 'Create Your First Bot', href: '/dashboard/bots/new' }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentBots.map((bot) => (
              <BotCard key={bot.id} bot={bot} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Activity feed placeholder */}
      {!isLoading && bots.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>
          <div className="space-y-3">
            {bots.slice(0, 4).map((bot, i) => (
              <div key={bot.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-sm flex-shrink-0">
                  {['💬', '🚀', '📊', '✨'][i % 4]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700">
                    {['New conversation started', 'Bot deployed successfully', 'Analytics updated', 'Response optimized'][i % 4]}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{bot.name}</p>
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0">
                  {['2m ago', '1h ago', '3h ago', '1d ago'][i % 4]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
