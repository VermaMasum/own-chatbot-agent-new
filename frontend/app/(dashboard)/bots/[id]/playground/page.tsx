'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Code2, Palette, ExternalLink } from 'lucide-react';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { useBot } from '@/hooks/useBots';
import { getDomainFromUrl } from '@/lib/utils';

interface PageProps {
  params: { id: string };
}

export default function PlaygroundPage({ params }: PageProps) {
  const { bot, isLoading, error } = useBot(params.id);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-[600px] rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-slate-500">Bot not found</p>
        <Link href="/dashboard/bots" className="mt-3 text-sm text-indigo-600 hover:underline">
          Back to bots
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard/bots"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Bots
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/bots/${bot.id}/embed`}>
            <Button variant="outline" size="sm" leftIcon={<Code2 className="w-3.5 h-3.5" />}>
              Embed
            </Button>
          </Link>
          <Link href={`/dashboard/bots/${bot.id}/customize`}>
            <Button variant="outline" size="sm" leftIcon={<Palette className="w-3.5 h-3.5" />}>
              Customize
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat window */}
        <div className="lg:col-span-2 h-[600px]">
          <ChatWindow bot={bot} />
        </div>

        {/* Bot info panel */}
        <div className="space-y-4">
          {/* Bot info */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Bot Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Name</p>
                <p className="text-sm font-medium text-slate-800">{bot.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Website</p>
                <a
                  href={bot.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                >
                  {getDomainFromUrl(bot.websiteUrl)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <StatusBadge status={bot.status} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Business Type</p>
                <p className="text-sm text-slate-700 capitalize">
                  {bot.businessType.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>

          {/* Usage tips */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-indigo-900 mb-3">Playground Tips</h3>
            <ul className="space-y-2">
              {[
                'Test different question types',
                'Try the tone selectors above the chat',
                'Use suggested prompts to explore',
                'Clear conversation to reset context',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-indigo-700">
                  <span className="w-4 h-4 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Performance</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Messages', value: bot.messagesCount ?? 0 },
                { label: 'Avg Response', value: '1.2s' },
                { label: 'Satisfaction', value: '94%' },
                { label: 'Resolved', value: '78%' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-base font-bold text-slate-900">{value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
