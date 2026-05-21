'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, PlayCircle, Palette } from 'lucide-react';
import { EmbedConfigurator } from '@/components/embed/EmbedConfigurator';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useBot } from '@/hooks/useBots';

interface PageProps {
  params: { id: string };
}

export default function EmbedPage({ params }: PageProps) {
  const { bot, isLoading, error } = useBot(params.id);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
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
          <Link href={`/dashboard/bots/${bot.id}/playground`}>
            <Button variant="outline" size="sm" leftIcon={<PlayCircle className="w-3.5 h-3.5" />}>
              Playground
            </Button>
          </Link>
          <Link href={`/dashboard/bots/${bot.id}/customize`}>
            <Button variant="outline" size="sm" leftIcon={<Palette className="w-3.5 h-3.5" />}>
              Customize
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Embed Widget</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure and embed <span className="font-medium text-slate-700">{bot.name}</span> on your website.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-card">
        <EmbedConfigurator bot={bot} />
      </div>
    </div>
  );
}
