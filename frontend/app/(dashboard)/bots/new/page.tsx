import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CreateBotForm } from '@/components/bots/CreateBotForm';

export default function NewBotPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/dashboard/bots"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Bots
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8">
        <CreateBotForm />
      </div>
    </div>
  );
}
