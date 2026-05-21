'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGetBots, apiGetBot, apiDeleteBot } from '@/lib/api';
import type { Bot } from '@/lib/types';

export function useBots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGetBots();
      setBots(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bots');
      setBots([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const deleteBot = useCallback(
    async (id: string) => {
      try {
        await apiDeleteBot(id);
        setBots((prev) => prev.filter((b) => b.id !== id));
        return true;
      } catch (err) {
        throw err;
      }
    },
    []
  );

  return { bots, isLoading, error, refetch: fetchBots, deleteBot };
}

export function useBot(id: string) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBot = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGetBot(id);
      setBot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bot');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBot();
  }, [fetchBot]);

  return { bot, isLoading, error, refetch: fetchBot, setBot };
}
