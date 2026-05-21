'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, RotateCcw, Smile, Paperclip } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { apiChat } from '@/lib/api';
import { generateId } from '@/lib/utils';
import type { Message, Bot } from '@/lib/types';

interface ChatWindowProps {
  bot: Bot;
}

type Tone = 'friendly' | 'professional' | 'sales';

const TONE_OPTIONS: Array<{ value: Tone; label: string; emoji: string }> = [
  { value: 'friendly', label: 'Friendly', emoji: '😊' },
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'sales', label: 'Sales', emoji: '🎯' },
];

const SUGGESTED_PROMPTS = [
  'What services do you offer?',
  'How can I get started?',
  'What are your pricing plans?',
  'Can you help me with support?',
];

export function ChatWindow({ bot }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: bot.welcomeMessage || `Hi! I'm ${bot.name}. How can I help you today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tone, setTone] = useState<Tone>('friendly');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const conversationHistory = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await apiChat({
        botId: bot.id,
        message: content.trim(),
        conversation: conversationHistory,
      });

      const botMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      const errMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearConversation = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: bot.welcomeMessage || `Hi! I'm ${bot.name}. How can I help you today?`,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-base">
            🤖
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{bot.name}</p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-[10px] text-slate-500">Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tone selector */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTone(opt.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
                  tone === opt.value
                    ? 'bg-white shadow-sm text-slate-800 border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{opt.emoji}</span>
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={clearConversation}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Clear conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              botName={bot.name}
              primaryColor={bot.primaryColor || '#6366f1'}
            />
          ))}
        </AnimatePresence>
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts (only when 1 message) */}
      {messages.length === 1 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
            Suggested questions
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-3 py-1.5 rounded-full transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-3 bg-white border-t border-slate-100"
      >
        <button
          type="button"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
          className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
        />
        <button
          type="button"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Smile className="w-4 h-4" />
        </button>
        <motion.button
          type="submit"
          disabled={!input.trim() || isLoading}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed rounded-xl flex items-center justify-center text-white transition-colors"
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </form>
    </div>
  );
}
