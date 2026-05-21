import type {
  AuthResponse,
  Bot,
  BotTemplate,
  BuildRequest,
  ChatRequest,
  ChatResponse,
  PublishRequest,
} from './types';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000') + '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('chatbot_token');
}

function getAuthHeaders(): HeadersInit {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP error ${res.status}`;
    try {
      const data = await res.json();
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// Auth endpoints
export async function apiSignup(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function apiLogin(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function apiGetMe(): Promise<{ user: import('./types').User }> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

// Templates
export async function apiGetTemplates(): Promise<BotTemplate[]> {
  const res = await fetch(`${BASE_URL}/templates`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<BotTemplate[]>(res);
}

// Bots
export async function apiGetBots(): Promise<Bot[]> {
  const res = await fetch(`${BASE_URL}/bots`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Bot[]>(res);
}

export async function apiGetBot(id: string): Promise<Bot> {
  const res = await fetch(`${BASE_URL}/bots/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Bot>(res);
}

export async function apiBuildBot(data: BuildRequest): Promise<{ botId: string; bot: Bot }> {
  const res = await fetch(`${BASE_URL}/build`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ botId: string; bot: Bot }>(res);
}

export async function apiPublishBot(data: PublishRequest): Promise<{ bot: Bot }> {
  const res = await fetch(`${BASE_URL}/publish`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ bot: Bot }>(res);
}

export async function apiChat(data: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<ChatResponse>(res);
}

export async function apiUpdateBot(
  id: string,
  data: Partial<Bot>
): Promise<{ bot: Bot }> {
  const res = await fetch(`${BASE_URL}/bots/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ bot: Bot }>(res);
}

export async function apiDeleteBot(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/bots/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse<{ success: boolean }>(res);
}

export function getEmbedScriptUrl(botId: string): string {
  return `/embed/${botId}.js`;
}

export function generateEmbedScript(
  botId: string,
  config: {
    primaryColor?: string;
    position?: string;
    label?: string;
    greeting?: string;
  }
): string {
  const params = new URLSearchParams({
    color: config.primaryColor || '#6366f1',
    position: config.position || 'bottom-right',
    label: config.label || 'Chat with us',
    greeting: config.greeting || 'Hi! How can I help you today?',
  });

  return `<script>
  (function(w,d,s,o,f,js,fjs){
    w['ChatbotWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','cw','${window.location.protocol}//${window.location.hostname}:3000/embed/${botId}.js'));
  cw('init', { botId: '${botId}', ${Object.entries(config)
    .map(([k, v]) => `${k}: '${v}'`)
    .join(', ')} });
</script>`;
}
