'use client';

import React, { useState } from 'react';
import { X, MessageCircle, Send, Minus } from 'lucide-react';

interface WidgetPreviewProps {
  config: {
    primaryColor: string;
    position: 'bottom-right' | 'bottom-left';
    label: string;
    greeting: string;
    botName: string;
  };
}

export function WidgetPreview({ config }: WidgetPreviewProps) {
  const [isOpen, setIsOpen] = useState(true);

  const positionClasses =
    config.position === 'bottom-right'
      ? 'bottom-4 right-4'
      : 'bottom-4 left-4';

  return (
    <div className="relative w-full h-80 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl overflow-hidden border border-slate-200">
      {/* Mock browser chrome */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 bg-slate-100 rounded-md px-3 py-1 text-[10px] text-slate-400 text-center">
          yourwebsite.com
        </div>
      </div>

      {/* Mock page content */}
      <div className="p-4 space-y-2">
        <div className="h-3 bg-slate-300 rounded-full w-3/4" />
        <div className="h-3 bg-slate-300 rounded-full w-full" />
        <div className="h-3 bg-slate-300 rounded-full w-5/6" />
        <div className="h-3 bg-slate-200 rounded-full w-2/3 mt-4" />
        <div className="h-3 bg-slate-200 rounded-full w-full" />
        <div className="h-3 bg-slate-200 rounded-full w-3/4" />
      </div>

      {/* Widget */}
      <div className={`absolute ${positionClasses} flex flex-col items-end gap-2`}>
        {/* Chat window */}
        {isOpen && (
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-100 w-52 overflow-hidden"
            style={{ borderTop: `3px solid ${config.primaryColor}` }}
          >
            {/* Widget header */}
            <div
              className="px-3 py-2.5 flex items-center justify-between"
              style={{ backgroundColor: config.primaryColor }}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px]">
                  🤖
                </div>
                <span className="text-[11px] font-semibold text-white truncate max-w-[80px]">
                  {config.botName}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white"
                >
                  <Minus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Greeting */}
            <div className="p-3">
              <div className="flex items-start gap-1.5">
                <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                  🤖
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl rounded-tl-none p-2 text-[10px] text-slate-700 leading-relaxed">
                  {config.greeting}
                </div>
              </div>

              {/* Input */}
              <div className="flex items-center gap-1.5 mt-3 border border-slate-200 rounded-xl px-2 py-1.5">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 text-[10px] text-slate-400 bg-transparent focus:outline-none"
                  readOnly
                />
                <div
                  className="w-5 h-5 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  <Send className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-full shadow-lg text-white text-[11px] font-medium transition-transform hover:scale-105"
          style={{ backgroundColor: config.primaryColor }}
        >
          {isOpen ? <X className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
          {!isOpen && config.label}
        </button>
      </div>
    </div>
  );
}
