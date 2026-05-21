'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
  HelpCircle,
  Activity,
} from 'lucide-react';
import { StatsCard } from '@/components/analytics/StatsCard';
import { MessageChart } from '@/components/analytics/MessageChart';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { SkeletonStats, Skeleton } from '@/components/ui/Skeleton';
import { useBots } from '@/hooks/useBots';
import { generateMockAnalytics, formatDate } from '@/lib/utils';

const MOCK_TOP_QUESTIONS = [
  { question: 'What are your pricing plans?', count: 342, percentage: 24 },
  { question: 'How do I get started?', count: 287, percentage: 20 },
  { question: 'Do you offer a free trial?', count: 215, percentage: 15 },
  { question: 'How does the AI work?', count: 198, percentage: 14 },
  { question: 'Can I customize the chatbot?', count: 156, percentage: 11 },
  { question: 'What integrations are available?', count: 134, percentage: 9 },
  { question: 'How do I cancel my subscription?', count: 98, percentage: 7 },
];

export default function AnalyticsPage() {
  const { bots, isLoading } = useBots();

  const analyticsData = useMemo(() => generateMockAnalytics(14), []);
  const last7Days = analyticsData.slice(-7);
  const prev7Days = analyticsData.slice(0, 7);

  const totalMessages = last7Days.reduce((sum, d) => sum + d.messages, 0);
  const prevMessages = prev7Days.reduce((sum, d) => sum + d.messages, 0);
  const messagesChange = prevMessages > 0
    ? Math.round(((totalMessages - prevMessages) / prevMessages) * 100)
    : 0;

  const totalUsers = last7Days.reduce((sum, d) => sum + d.users, 0);
  const avgResponseTime = 1.2;

  const botActivity = bots.map((bot) => ({
    botId: bot.id,
    botName: bot.name,
    messages: Math.floor(Math.random() * 200 + 50),
    users: Math.floor(Math.random() * 80 + 20),
    avgResponseTime: (Math.random() * 2 + 0.5).toFixed(1),
    status: bot.status,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Last 7 days · Updated just now
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStats key={i} />)
        ) : (
          <>
            <StatsCard
              label="Total Messages"
              value={totalMessages.toLocaleString()}
              change={messagesChange}
              changeLabel="vs last week"
              icon={<MessageSquare className="w-[18px] h-[18px]" />}
              color="indigo"
              index={0}
            />
            <StatsCard
              label="Unique Users"
              value={totalUsers.toLocaleString()}
              change={14}
              changeLabel="vs last week"
              icon={<Users className="w-[18px] h-[18px]" />}
              color="emerald"
              index={1}
            />
            <StatsCard
              label="Avg Response Time"
              value={`${avgResponseTime}s`}
              change={-8}
              changeLabel="improvement"
              icon={<Clock className="w-[18px] h-[18px]" />}
              color="amber"
              index={2}
            />
            <StatsCard
              label="Resolution Rate"
              value="78%"
              change={5}
              changeLabel="vs last week"
              icon={<TrendingUp className="w-[18px] h-[18px]" />}
              color="violet"
              index={3}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main chart */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Messages & Users Over Time</CardTitle>
            <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              Last 14 days
            </span>
          </CardHeader>
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : (
            <MessageChart data={analyticsData} />
          )}
        </Card>

        {/* Top questions */}
        <Card>
          <CardHeader>
            <CardTitle>Top Questions</CardTitle>
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <div className="space-y-3">
            {MOCK_TOP_QUESTIONS.map((q, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs text-slate-700 leading-relaxed flex-1">{q.question}</p>
                  <span className="text-xs font-semibold text-slate-500 flex-shrink-0">{q.count}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${q.percentage}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bot activity table */}
      <Card>
        <CardHeader>
          <CardTitle>Bot Activity</CardTitle>
          <Activity className="w-4 h-4 text-slate-400" />
        </CardHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">No bots to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Bot Name', 'Messages', 'Users', 'Avg Response', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4 last:pr-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {botActivity.map((activity, i) => (
                  <motion.tr
                    key={activity.botId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center text-xs flex-shrink-0">
                          🤖
                        </div>
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[150px]">
                          {activity.botName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-sm text-slate-700 font-medium">
                        {activity.messages.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-sm text-slate-700">{activity.users}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-sm text-slate-700">{activity.avgResponseTime}s</span>
                    </td>
                    <td className="py-3">
                      <StatusBadge status={activity.status} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
