'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, AlignRight, AlignLeft, MessageSquare, Type } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { WidgetPreview } from './WidgetPreview';
import { CodeSnippet } from './CodeSnippet';
import type { Bot } from '@/lib/types';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#1e293b',
];

interface EmbedConfiguratorProps {
  bot: Bot;
}

export function EmbedConfigurator({ bot }: EmbedConfiguratorProps) {
  const [config, setConfig] = useState({
    primaryColor: bot.primaryColor || '#6366f1',
    position: (bot.widgetPosition || 'bottom-right') as 'bottom-right' | 'bottom-left',
    label: 'Chat with us',
    greeting: bot.welcomeMessage || `Hi! I'm ${bot.name}. How can I help you today?`,
    botName: bot.name,
  });

  const embedScript = `<!-- BotForge Chat Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['BotForge']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','bf','http://localhost:3000/embed/${bot.id}.js'));
  bf('init', {
    botId: '${bot.id}',
    primaryColor: '${config.primaryColor}',
    position: '${config.position}',
    label: '${config.label}',
    greeting: '${config.greeting}'
  });
</script>
<!-- End BotForge Widget -->`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Configuration panel */}
      <div className="space-y-6">
        {/* Color picker */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
            <Palette className="w-4 h-4 text-indigo-500" />
            Primary Color
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setConfig({ ...config, primaryColor: color })}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  config.primaryColor === color
                    ? 'border-slate-800 scale-110 shadow-md'
                    : 'border-transparent hover:border-slate-400'
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

        {/* Position */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
            <AlignRight className="w-4 h-4 text-indigo-500" />
            Widget Position
          </label>
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

        {/* Label */}
        <Input
          label="Button Label"
          value={config.label}
          onChange={(e) => setConfig({ ...config, label: e.target.value })}
          placeholder="Chat with us"
          leftIcon={<MessageSquare className="w-4 h-4" />}
        />

        {/* Greeting */}
        <Input
          label="Greeting Message"
          value={config.greeting}
          onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
          placeholder="Hi! How can I help you today?"
          leftIcon={<Type className="w-4 h-4" />}
        />
      </div>

      {/* Preview + Code */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Live Preview</h3>
          <WidgetPreview config={config} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Embed Code</h3>
          <CodeSnippet code={embedScript} />
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <h4 className="text-sm font-semibold text-indigo-900 mb-3">Installation Steps</h4>
          <ol className="space-y-2">
            {[
              'Copy the embed code above',
              'Paste it just before the closing </body> tag on your website',
              'The chat widget will appear on your website immediately',
              'Customize colors and messages as needed',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-indigo-700">
                <span className="w-5 h-5 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
