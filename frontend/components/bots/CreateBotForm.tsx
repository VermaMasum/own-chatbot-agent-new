'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Bot, CheckCircle2, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { apiBuildBot, apiPublishBot } from '@/lib/api';
import { validateUrl, BUSINESS_TYPES, getBusinessTypeIcon } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import type { Bot as BotType } from '@/lib/types';

type Step = 'form' | 'building' | 'success';

const BUILD_MESSAGES = [
  'Connecting to website...',
  'Scraping website content...',
  'Analyzing business data...',
  'Extracting key information...',
  'Training AI model...',
  'Optimizing responses...',
  'Finalizing bot configuration...',
];

export function CreateBotForm() {
  const router = useRouter();
  const { success, error } = useToast();

  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({
    url: '',
    botName: '',
    businessType: 'other',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildMessage, setBuildMessage] = useState(BUILD_MESSAGES[0]);
  const [createdBot, setCreatedBot] = useState<BotType | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.url) {
      newErrors.url = 'Website URL is required';
    } else if (!validateUrl(formData.url)) {
      newErrors.url = 'Please enter a valid URL';
    }
    if (!formData.botName.trim()) {
      newErrors.botName = 'Bot name is required';
    } else if (formData.botName.trim().length < 2) {
      newErrors.botName = 'Bot name must be at least 2 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStep('building');
    setBuildProgress(0);

    // Simulate progress
    let msgIndex = 0;
    const interval = setInterval(() => {
      setBuildProgress((prev) => {
        const next = prev + Math.random() * 15;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        return next;
      });
      msgIndex = Math.min(msgIndex + 1, BUILD_MESSAGES.length - 1);
      setBuildMessage(BUILD_MESSAGES[msgIndex]);
    }, 800);

    try {
      const url = formData.url.startsWith('http') ? formData.url : `https://${formData.url}`;
      const result = await apiBuildBot({
        url,
        botName: formData.botName,
        businessType: formData.businessType,
      });
      clearInterval(interval);
      setBuildProgress(100);
      setBuildMessage('Bot built successfully!');
      setTimeout(() => {
        setCreatedBot(result.bot);
        setStep('success');
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setStep('form');
      error(err instanceof Error ? err.message : 'Failed to build bot');
    }
  };

  const handlePublish = async () => {
    if (!createdBot) return;
    setIsPublishing(true);
    try {
      await apiPublishBot({ botId: createdBot.id });
      success('Bot published successfully!');
      router.push('/dashboard/bots');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to publish bot');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <AnimatePresence mode="wait">
        {step === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Create Your AI Bot</h2>
              <p className="text-sm text-slate-500">
                Enter your website URL and we'll build a custom AI chatbot trained on your content.
              </p>
            </div>

            <form onSubmit={handleBuild} className="space-y-5">
              <Input
                label="Website URL"
                type="text"
                placeholder="https://yourwebsite.com"
                value={formData.url}
                onChange={(e) => {
                  setFormData({ ...formData, url: e.target.value });
                  if (errors.url) setErrors({ ...errors, url: '' });
                }}
                error={errors.url}
                leftIcon={<Globe className="w-4 h-4" />}
                hint="We'll scrape your website to train the AI"
              />

              <Input
                label="Bot Name"
                type="text"
                placeholder="e.g. Sarah - Customer Support"
                value={formData.botName}
                onChange={(e) => {
                  setFormData({ ...formData, botName: e.target.value });
                  if (errors.botName) setErrors({ ...errors, botName: '' });
                }}
                error={errors.botName}
                leftIcon={<Bot className="w-4 h-4" />}
              />

              <Select
                label="Business Type"
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                options={BUSINESS_TYPES}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                leftIcon={<Sparkles className="w-4 h-4" />}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Build My Bot
              </Button>
            </form>
          </motion.div>
        )}

        {step === 'building' && (
          <motion.div
            key="building"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-8"
          >
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="#e0e7ff"
                  strokeWidth="5"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - buildProgress / 100)}`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-indigo-600">
                  {Math.round(buildProgress)}%
                </span>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-slate-900 mb-2">Building Your Bot</h3>
            <p className="text-sm text-slate-500 mb-6">{buildMessage}</p>

            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                animate={{ width: `${buildProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="mt-6 space-y-2">
              {BUILD_MESSAGES.slice(0, Math.ceil((buildProgress / 100) * BUILD_MESSAGES.length)).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-xs text-slate-500"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  {msg}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'success' && createdBot && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
              className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </motion.div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">Bot Built Successfully!</h2>
            <p className="text-sm text-slate-500 mb-8">
              Your bot <span className="font-semibold text-slate-700">{createdBot.name}</span> is
              ready to be deployed.
            </p>

            {/* Preview card */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 mb-8 text-left">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-lg">
                  {getBusinessTypeIcon(createdBot.businessType)}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{createdBot.name}</h4>
                  <p className="text-xs text-slate-500 capitalize">
                    {createdBot.businessType.replace('_', ' ')} · Ready to deploy
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white rounded-xl p-3 border border-slate-100">
                  <p className="text-lg font-bold text-slate-900">AI</p>
                  <p className="text-xs text-slate-500">Powered</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100">
                  <p className="text-lg font-bold text-slate-900">24/7</p>
                  <p className="text-xs text-slate-500">Available</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handlePublish}
                isLoading={isPublishing}
                size="lg"
                className="w-full"
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Publish Bot
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full"
                onClick={() => router.push(`/dashboard/bots/${createdBot.id}/playground`)}
              >
                Test in Playground
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
