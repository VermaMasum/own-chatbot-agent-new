'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronLeft, PlayCircle, Code2, Save, AlignRight, AlignLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { WidgetPreview } from '@/components/embed/WidgetPreview';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBot } from '@/hooks/useBots';
import { useToast } from '@/contexts/ToastContext';
import { apiUpdateBot } from '@/lib/api';

interface PageProps {
  params: { id: string };
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#22c55e', '#06b6d4', '#3b82f6',
  '#1e293b', '#94a3b8',
];

const EMOJI_AVATARS = ['🤖', '🤗', '💬', '✨', '🚀', '👋', '💡', '🎯', '🌟', '⚡'];

export default function CustomizePage({ params }: PageProps) {
  const { bot, isLoading, error, setBot } = useBot(params.id);
  const { success, error: showError } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [config, setConfig] = useState({
    primaryColor: '#6366f1',
    position: 'bottom-right' as 'bottom-right' | 'bottom-left',
    avatar: '🤖',
    botName: '',
    welcomeMessage: '',
    greeting: '',
  });

  // Initialize config from bot data
  React.useEffect(() => {
    if (bot) {
      setConfig({
        primaryColor: bot.primaryColor || '#6366f1',
        position: bot.widgetPosition || 'bottom-right',
        avatar: bot.avatar || '🤖',
        botName: bot.name,
        welcomeMessage: bot.welcomeMessage || `Hi! I'm ${bot.name}. How can I help?`,
        greeting: bot.greeting || `Hi! I'm ${bot.name}. How can I help you today?`,
      });
    }
  }, [bot]);

  const handleSave = async () => {
    if (!bot) return;
    setIsSaving(true);
    try {
      const result = await apiUpdateBot(bot.id, {
        name: config.botName,
        primaryColor: config.primaryColor,
        widgetPosition: config.position,
        welcomeMessage: config.welcomeMessage,
        greeting: config.greeting,
        avatar: config.avatar,
      });
      setBot(result.bot);
      success('Bot customization saved successfully!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
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
          <Link href={`/dashboard/bots/${bot.id}/embed`}>
            <Button variant="outline" size="sm" leftIcon={<Code2 className="w-3.5 h-3.5" />}>
              Embed
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Customize Bot</h2>
        <p className="text-sm text-slate-500 mt-1">
          Personalize the appearance and behavior of{' '}
          <span className="font-medium text-slate-700">{bot.name}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Config panel */}
        <div className="space-y-5">
          {/* Bot name */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Identity</h3>
            <Input
              label="Bot Display Name"
              value={config.botName}
              onChange={(e) => setConfig({ ...config, botName: e.target.value })}
              placeholder="Enter bot name"
            />
          </div>

          {/* Color theme */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Color Theme</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setConfig({ ...config, primaryColor: color })}
                  className={`w-8 h-8 rounded-lg transition-all border-2 ${
                    config.primaryColor === color
                      ? 'border-slate-800 scale-110 shadow-md'
                      : 'border-transparent hover:border-slate-300'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-1"
              />
              <Input
                value={config.primaryColor}
                onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                placeholder="#6366f1"
                className="flex-1"
              />
            </div>
          </div>

          {/* Widget position */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Widget Position</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'bottom-right', label: 'Bottom Right', Icon: AlignRight },
                { value: 'bottom-left', label: 'Bottom Left', Icon: AlignLeft },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setConfig({ ...config, position: value as 'bottom-right' | 'bottom-left' })}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    config.position === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Avatar</h3>
            <div className="flex flex-wrap gap-2">
              {EMOJI_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setConfig({ ...config, avatar: emoji })}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all border-2 ${
                    config.avatar === emoji
                      ? 'border-indigo-500 bg-indigo-50 scale-110 shadow-sm'
                      : 'border-transparent bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Messages</h3>
            <div className="space-y-4">
              <Textarea
                label="Welcome Message"
                value={config.welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                placeholder="Hi! How can I help you today?"
                rows={2}
              />
              <Textarea
                label="Widget Greeting"
                value={config.greeting}
                onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
                placeholder="Hello! Click to start a conversation..."
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sticky top-20">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Live Preview</h3>
            <WidgetPreview
              config={{
                primaryColor: config.primaryColor,
                position: config.position,
                label: 'Chat with us',
                greeting: config.greeting || config.welcomeMessage,
                botName: config.botName || bot.name,
              }}
            />
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 text-center">
                Changes are previewed in real-time. Click Save Changes to apply.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
