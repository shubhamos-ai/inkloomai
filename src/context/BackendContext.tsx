'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { checkApiHealth, getApiBaseUrl } from '@/lib/api';

export type BackendStatus = 'checking' | 'waking' | 'online' | 'offline';

interface BackendContextType {
  status: BackendStatus;
  isOnline: boolean;
  isWaking: boolean;
  recheck: () => Promise<boolean>;
  lastChecked: Date | null;
}

const BackendContext = createContext<BackendContextType>({
  status: 'checking',
  isOnline: false,
  isWaking: false,
  recheck: async () => false,
  lastChecked: null,
});

export function BackendProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const attemptsRef = useRef(0);

  const pingBackend = useCallback(async (): Promise<boolean> => {
    try {
      // Direct fast health ping to wake Render backend if spun down
      const ok = await checkApiHealth();
      setLastChecked(new Date());

      if (ok) {
        setStatus('online');
        attemptsRef.current = 0;
        return true;
      } else {
        attemptsRef.current += 1;
        // If it's the first few failures, Render free instances take ~30-50s to cold-start
        if (attemptsRef.current <= 15) {
          setStatus('waking');
        } else {
          setStatus('offline');
        }
        return false;
      }
    } catch {
      attemptsRef.current += 1;
      setStatus(attemptsRef.current <= 15 ? 'waking' : 'offline');
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let timer: NodeJS.Timeout | null = null;

    const runLoop = async () => {
      if (!mounted) return;
      const online = await pingBackend();

      if (!mounted) return;
      // If waking/offline, poll every 4 seconds to catch the spin-up as fast as possible
      // Once online, keep alive with a periodic ping every 45 seconds so it doesn't spin back down
      const nextDelay = online ? 45000 : 4000;
      timer = setTimeout(runLoop, nextDelay);
    };

    runLoop();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [pingBackend]);

  return (
    <BackendContext.Provider
      value={{
        status,
        isOnline: status === 'online',
        isWaking: status === 'waking' || status === 'checking',
        recheck: pingBackend,
        lastChecked,
      }}
    >
      {children}
    </BackendContext.Provider>
  );
}

export function useBackend() {
  return useContext(BackendContext);
}
