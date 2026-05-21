import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

interface MessageBubbleProps {
  message: Message;
  botName?: string;
  primaryColor?: string;
}

export function MessageBubble({ message, botName = 'Bot', primaryColor = '#6366f1' }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const timeStr = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-end gap-2 justify-end mb-4"
      >
        <div className="max-w-[75%]">
          <div
            className="rounded-2xl rounded-br-md px-4 py-3 text-white text-sm leading-relaxed"
            style={{ backgroundColor: primaryColor }}
          >
            {message.content}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-right pr-1">{timeStr}</p>
        </div>
        <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0 mb-4">
          U
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-end gap-2 justify-start mb-4"
    >
      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs flex-shrink-0 mb-4">
        🤖
      </div>
      <div className="max-w-[75%]">
        <p className="text-[10px] text-slate-400 mb-1 pl-1">{botName}</p>
        <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm text-sm text-slate-800 leading-relaxed">
          {message.content}
        </div>
        <p className="text-[10px] text-slate-400 mt-1 pl-1">{timeStr}</p>
      </div>
    </motion.div>
  );
}
