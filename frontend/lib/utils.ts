import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'inactive':
      return 'text-slate-500 bg-slate-50 border-slate-200';
    case 'building':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-slate-500 bg-slate-50 border-slate-200';
  }
}

export function getBusinessTypeIcon(businessType: string): string {
  const icons: Record<string, string> = {
    ecommerce: '🛒',
    saas: '💻',
    healthcare: '🏥',
    education: '📚',
    finance: '💰',
    real_estate: '🏠',
    restaurant: '🍽️',
    agency: '🎯',
    consulting: '💼',
    other: '🤖',
  };
  return icons[businessType.toLowerCase()] || '🤖';
}

export function generateMockAnalytics(days: number = 7): Array<{ date: string; messages: number; users: number }> {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      messages: Math.floor(Math.random() * 200) + 50,
      users: Math.floor(Math.random() * 80) + 20,
    });
  }
  return data;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(el);
      resolve();
    } catch (err) {
      document.body.removeChild(el);
      reject(err);
    }
  });
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateUrl(url: string): boolean {
  try {
    const u = url.startsWith('http') ? url : `https://${url}`;
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export const BUSINESS_TYPES = [
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'saas', label: 'SaaS / Software' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'finance', label: 'Finance' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'restaurant', label: 'Restaurant / Food' },
  { value: 'agency', label: 'Agency / Marketing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
];
