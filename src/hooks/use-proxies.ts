/**
 * @fileoverview Proxies Hook
 * @module hooks/use-proxies
 *
 * Custom hook for proxy management with real IPC communication.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ipc, isElectron } from '@/lib/ipc-client';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';
import { Proxy, CreateProxyInput, ProxyTestResult } from '@shared/types/proxy.types';

interface UseProxiesReturn {
  proxies: Proxy[];
  loading: boolean;
  error: string | null;
  loadProxies: () => Promise<void>;
  createProxy: (input: CreateProxyInput) => Promise<Proxy | null>;
  deleteProxy: (id: string) => Promise<boolean>;
  testProxy: (id: string) => Promise<ProxyTestResult | null>;
  testAllProxies: () => Promise<ProxyTestResult[]>;
  bulkImport: (proxiesText: string, proxyType?: 'static' | 'residential') => Promise<number>;
}

export function useProxies(): UseProxiesReturn {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProxies = useCallback(async () => {
    if (!isElectron()) {
      setLoading(false);
      setError('Not running in Electron');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await ipc.invoke<Proxy[]>(IPC_CHANNELS.PROXY_GET_ALL);
      setProxies(result || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proxies');
      setProxies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProxy = useCallback(async (input: CreateProxyInput): Promise<Proxy | null> => {
    if (!isElectron()) return null;
    try {
      const proxy = await ipc.invoke<Proxy>(IPC_CHANNELS.PROXY_CREATE, input);
      await loadProxies();
      return proxy;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proxy');
      return null;
    }
  }, [loadProxies]);

  const deleteProxy = useCallback(async (id: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.PROXY_DELETE, { id });
      await loadProxies();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete proxy');
      return false;
    }
  }, [loadProxies]);

  const testProxy = useCallback(async (id: string): Promise<ProxyTestResult | null> => {
    if (!isElectron()) return null;
    try {
      const result = await ipc.invoke<ProxyTestResult>(IPC_CHANNELS.PROXY_TEST, { id });
      await loadProxies();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test proxy');
      return null;
    }
  }, [loadProxies]);

  const testAllProxies = useCallback(async (): Promise<ProxyTestResult[]> => {
    if (!isElectron()) return [];
    setLoading(true);
    try {
      const results = await ipc.invoke<ProxyTestResult[]>(IPC_CHANNELS.PROXY_TEST_ALL);
      await loadProxies();
      return results || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test proxies');
      return [];
    } finally {
      setLoading(false);
    }
  }, [loadProxies]);

  const bulkImport = useCallback(async (proxiesText: string, proxyType: 'static' | 'residential' = 'static'): Promise<number> => {
    if (!isElectron()) return 0;
    try {
      const result = await ipc.invoke<{ imported: number }>(IPC_CHANNELS.PROXY_BULK_IMPORT, { proxiesText, proxyType });
      await loadProxies();
      return result?.imported || 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import proxies');
      return 0;
    }
  }, [loadProxies]);

  useEffect(() => {
    loadProxies();
  }, [loadProxies]);

  return {
    proxies,
    loading,
    error,
    loadProxies,
    createProxy,
    deleteProxy,
    testProxy,
    testAllProxies,
    bulkImport,
  };
}


