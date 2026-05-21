'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function CopyButton({ text, className, size = 'md' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fail silently
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all duration-150',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        copied
          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200',
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
          Copied!
        </>
      ) : (
        <>
          <Copy className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
          Copy
        </>
      )}
    </button>
  );
}
