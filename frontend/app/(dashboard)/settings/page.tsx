'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  Trash2,
  Save,
  Eye,
  EyeOff,
  CreditCard,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getInitials } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [notifications, setNotifications] = useState({
    newMessage: true,
    weeklyReport: true,
    botUpdates: false,
    marketing: false,
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    success('Profile updated successfully');
    setIsSaving(false);
  };

  const handleSavePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      error('New passwords do not match');
      return;
    }
    if (passwordForm.new.length < 8) {
      error('Password must be at least 8 characters');
      return;
    }
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    success('Password changed successfully');
    setPasswordForm({ current: '', new: '', confirm: '' });
    setIsSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="space-y-5">
            {/* Avatar section */}
            <Card>
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
                  {user ? getInitials(user.name) : 'U'}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">{user?.name}</h3>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                  <div className="flex gap-2 mt-2">
                    <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                      Change avatar
                    </button>
                    <span className="text-slate-300">·</span>
                    <button className="text-xs text-slate-400 hover:text-slate-600">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Profile form */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-5">Personal Information</h3>
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  leftIcon={<User className="w-4 h-4" />}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  leftIcon={<Mail className="w-4 h-4" />}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Timezone
                  </label>
                  <select className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option>UTC-5 Eastern Time</option>
                    <option>UTC-8 Pacific Time</option>
                    <option>UTC+0 GMT</option>
                    <option>UTC+5:30 IST</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-5">
                <Button
                  onClick={handleSaveProfile}
                  isLoading={isSaving}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Save Changes
                </Button>
              </div>
            </Card>

            {/* Danger zone */}
            <Card className="border-red-100">
              <h3 className="text-sm font-semibold text-red-600 mb-1">Danger Zone</h3>
              <p className="text-xs text-slate-500 mb-4">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />}>
                Delete Account
              </Button>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-5">
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-5">Change Password</h3>
              <div className="space-y-4">
                <Input
                  label="Current Password"
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
                <Input
                  label="New Password"
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
                <Input
                  label="Confirm New Password"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>
              <div className="flex justify-end mt-5">
                <Button onClick={handleSavePassword} isLoading={isSaving}>
                  Update Password
                </Button>
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <Shield className="w-4.5 h-4.5 w-[18px] h-[18px] text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Two-Factor Authentication</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Enable 2FA</Button>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Active Sessions</h3>
              <div className="space-y-3">
                {[
                  { device: 'Chrome on Windows', location: 'New York, US', current: true, time: 'Active now' },
                  { device: 'Safari on iPhone', location: 'New York, US', current: false, time: '2 days ago' },
                ].map((session, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Globe className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-700">{session.device}</p>
                        <p className="text-[10px] text-slate-400">{session.location} · {session.time}</p>
                      </div>
                    </div>
                    {session.current ? (
                      <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    ) : (
                      <button className="text-xs text-red-500 hover:text-red-600 font-medium">
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 mb-5">Email Notifications</h3>
            <div className="space-y-4">
              {[
                {
                  key: 'newMessage' as const,
                  title: 'New Message Alerts',
                  desc: 'Get notified when your bot receives messages',
                },
                {
                  key: 'weeklyReport' as const,
                  title: 'Weekly Reports',
                  desc: 'Summary of your bot performance every week',
                },
                {
                  key: 'botUpdates' as const,
                  title: 'Bot Updates',
                  desc: 'Notifications about bot model improvements',
                },
                {
                  key: 'marketing' as const,
                  title: 'Marketing Emails',
                  desc: 'Tips, feature announcements, and promotions',
                },
              ].map(({ key, title, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, [key]: !notifications[key] })}
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      notifications[key] ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        notifications[key] ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => success('Notification preferences saved')} size="sm">
                Save Preferences
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <div className="space-y-5">
            {/* Current plan */}
            <Card className="border-indigo-100 bg-indigo-50/30">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-900">Pro Plan</h3>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                      Current
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    <span className="text-2xl font-bold text-slate-900">$29</span>/month
                  </p>
                  <ul className="space-y-1">
                    {['10 bots', '50,000 messages/month', 'Advanced analytics', 'Priority support'].map((f) => (
                      <li key={f} className="text-xs text-slate-600 flex items-center gap-2">
                        <span className="w-1 h-1 bg-indigo-500 rounded-full" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="outline" size="sm">Upgrade Plan</Button>
              </div>
            </Card>

            {/* Payment method */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Payment Method</h3>
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-10 h-7 bg-slate-800 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">Visa ending in 4242</p>
                  <p className="text-xs text-slate-500">Expires 04/2026</p>
                </div>
                <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  Update
                </button>
              </div>
            </Card>

            {/* Billing history */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Billing History</h3>
              <div className="space-y-2">
                {[
                  { date: 'Apr 1, 2026', amount: '$29.00', status: 'Paid' },
                  { date: 'Mar 1, 2026', amount: '$29.00', status: 'Paid' },
                  { date: 'Feb 1, 2026', amount: '$29.00', status: 'Paid' },
                ].map((invoice, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{invoice.date}</p>
                      <p className="text-[10px] text-slate-400">Pro Plan Monthly</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-800">{invoice.amount}</span>
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {invoice.status}
                      </span>
                      <button className="text-xs text-slate-400 hover:text-slate-600">
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
