import React from 'react';

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start mb-4">
      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
        🤖
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}
