export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  avatar?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Bot {
  id: string;
  name: string;
  websiteUrl: string;
  businessType: string;
  status: 'active' | 'inactive' | 'building' | 'error';
  createdAt: string;
  updatedAt?: string;
  messagesCount?: number;
  embedInstalls?: number;
  tone?: 'friendly' | 'professional' | 'sales';
  welcomeMessage?: string;
  primaryColor?: string;
  widgetPosition?: 'bottom-right' | 'bottom-left';
  avatarType?: 'emoji' | 'letter';
  avatar?: string;
  greeting?: string;
}

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  businessType: string;
  icon: string;
  prompts: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatRequest {
  botId: string;
  message: string;
  conversation: Array<{ role: string; content: string }>;
}

export interface ChatResponse {
  reply: string;
}

export interface BuildRequest {
  url: string;
  botName: string;
  businessType: string;
}

export interface PublishRequest {
  botId: string;
  name?: string;
  tone?: string;
  primaryColor?: string;
  widgetPosition?: string;
  welcomeMessage?: string;
}

export interface EmbedConfig {
  botId: string;
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  label: string;
  greeting: string;
  avatarEmoji?: string;
}

export interface AnalyticsData {
  date: string;
  messages: number;
  users: number;
}

export interface TopQuestion {
  question: string;
  count: number;
  percentage: number;
}

export interface BotActivity {
  botId: string;
  botName: string;
  messages: number;
  users: number;
  avgResponseTime: number;
  status: 'active' | 'inactive';
}

export interface ApiError {
  message: string;
  status?: number;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface StatsCardData {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: string;
  color: string;
}
