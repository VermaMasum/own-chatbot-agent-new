'use client';

import React from 'react';
import { CopyButton } from '@/components/ui/CopyButton';

interface CodeSnippetProps {
  code: string;
  language?: string;
}

export function CodeSnippet({ code, language = 'html' }: CodeSnippetProps) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-xs text-slate-400 font-mono ml-1">{language}</span>
        </div>
        <CopyButton text={code} size="sm" />
      </div>
      <div className="bg-slate-900 p-4 overflow-x-auto">
        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
          {code}
        </pre>
      </div>
    </div>
  );
}
