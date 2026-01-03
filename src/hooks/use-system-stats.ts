/**
 * @fileoverview System Stats Hook
 * @module hooks/use-system-stats
 *
 * Custom hook for system statistics.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ipc, isElectron } from '../lib/ipc-client';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';
import { SystemStats } from '@shared/types/ipc.types';

const defaultStats: SystemStats = {
  cpuUsage: 0,
  memoryUsage: 0,
  networkUsage: 0,
  activeBrowsers: 0,
  runningTasks: 0,
  totalWorkspaces: 0,
  proxyHealth: 0, // Default to 0 when no proxies exist
};

export function useSystemStats(refreshInterval: number = 10000) { // Reduced frequency to 10s
  const [stats, setStats] = useState<SystemStats>(defaultStats);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!isElectron()) {
      setLoading(false);
      return;
    }

    try {
      const data = await ipc.invoke<SystemStats>(IPC_CHANNELS.SYSTEM_GET_STATS);
      // Only update if values changed to prevent unnecessary re-renders
      setStats(prev => {
        if (
          prev.cpuUsage === data.cpuUsage &&
          prev.memoryUsage === data.memoryUsage &&
          prev.activeBrowsers === data.activeBrowsers &&
          prev.runningTasks === data.runningTasks
        ) {
          return prev;
        }
        return data;
      });
    } catch (err) {
      console.error('Failed to fetch system stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Delay initial fetch slightly to not block initial render
    const initialTimeout = setTimeout(fetchStats, 500);
    const interval = setInterval(fetchStats, refreshInterval);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [fetchStats, refreshInterval]);

  return { stats, loading, refresh: fetchStats };
}

