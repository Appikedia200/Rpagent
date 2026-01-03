/**
 * @fileoverview Browsers Hook
 * @module hooks/use-browsers
 *
 * Custom hook for browser management with real IPC communication.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ipc, isElectron } from '@/lib/ipc-client';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';

export interface BrowserSession {
  workspaceId: string;
  workspaceName: string;
  status: 'running' | 'idle' | 'paused' | 'error';
  url: string;
  cpu: number;
  memory: number;
  screenshot?: string;
  currentTask?: string;
}

interface UseBrowsersReturn {
  sessions: BrowserSession[];
  loading: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  launchBrowser: (workspaceId: string) => Promise<boolean>;
  closeBrowser: (workspaceId: string) => Promise<boolean>;
  closeAllBrowsers: () => Promise<boolean>;
  pauseAllBrowsers: () => Promise<boolean>;
  resumeAllBrowsers: () => Promise<boolean>;
  navigate: (workspaceId: string, url: string) => Promise<boolean>;
  takeScreenshot: (workspaceId: string) => Promise<string | null>;
}

export function useBrowsers(): UseBrowsersReturn {
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!isElectron()) {
      setLoading(false);
      setError('Not running in Electron');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await ipc.invoke<BrowserSession[]>(IPC_CHANNELS.BROWSER_GET_ALL_ACTIVE);
      setSessions(result || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load browser sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const launchBrowser = useCallback(async (workspaceId: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.BROWSER_LAUNCH, { workspaceId });
      await loadSessions();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch browser');
      return false;
    }
  }, [loadSessions]);

  const closeBrowser = useCallback(async (workspaceId: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.BROWSER_CLOSE, { workspaceId });
      await loadSessions();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close browser');
      return false;
    }
  }, [loadSessions]);

  const closeAllBrowsers = useCallback(async (): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.BROWSER_CLOSE_ALL);
      await loadSessions();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close all browsers');
      return false;
    }
  }, [loadSessions]);

  const pauseAllBrowsers = useCallback(async (): Promise<boolean> => {
    // Pause functionality would need to be added to the backend
    setError('Pause functionality not yet implemented');
    return false;
  }, []);

  const resumeAllBrowsers = useCallback(async (): Promise<boolean> => {
    // Resume functionality would need to be added to the backend
    setError('Resume functionality not yet implemented');
    return false;
  }, []);

  const navigate = useCallback(async (workspaceId: string, url: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.BROWSER_NAVIGATE, { workspaceId, url });
      await loadSessions();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate');
      return false;
    }
  }, [loadSessions]);

  const takeScreenshot = useCallback(async (workspaceId: string): Promise<string | null> => {
    if (!isElectron()) return null;
    try {
      const result = await ipc.invoke<{ screenshot: string }>(IPC_CHANNELS.BROWSER_SCREENSHOT, { workspaceId });
      return result?.screenshot || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take screenshot');
      return null;
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Subscribe to browser status events
  useEffect(() => {
    if (!isElectron()) return;

    const unsubStatus = ipc.on(IPC_CHANNELS.EVENT_BROWSER_STATUS, () => {
      loadSessions();
    });

    return () => {
      unsubStatus();
    };
  }, [loadSessions]);

  return {
    sessions,
    loading,
    error,
    loadSessions,
    launchBrowser,
    closeBrowser,
    closeAllBrowsers,
    pauseAllBrowsers,
    resumeAllBrowsers,
    navigate,
    takeScreenshot,
  };
}


