'use client';

/**
 * Hook for managing accounts
 */

import { useState, useEffect, useCallback } from 'react';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';
import { isElectron, ipc } from '@/lib/ipc-client';

/**
 * Account interface
 */
export interface Account {
  id: string;
  service: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  recoveryEmail?: string;
  workspaceId?: string;
  createdAt: string;
}

/**
 * Account statistics
 */
export interface AccountStats {
  totalCount: number;
  byService: Record<string, number>;
}

/**
 * Hook for account management
 */
export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<AccountStats>({ totalCount: 0, byService: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load all accounts
   */
  const loadAccounts = useCallback(async () => {
    if (!isElectron()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [accountsData, statsData] = await Promise.all([
        ipc.invoke<Account[]>(IPC_CHANNELS.ACCOUNT_GET_ALL),
        ipc.invoke<AccountStats>(IPC_CHANNELS.ACCOUNT_GET_STATS),
      ]);
      setAccounts(accountsData || []);
      setStats(statsData || { totalCount: 0, byService: {} });
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Search accounts
   */
  const searchAccounts = useCallback(async (query: string) => {
    if (!isElectron()) return;

    if (!query.trim()) {
      await loadAccounts();
      return;
    }

    setLoading(true);
    try {
      const data = await ipc.invoke<Account[]>(IPC_CHANNELS.ACCOUNT_SEARCH, query);
      setAccounts(data || []);
    } catch (err) {
      console.error('Failed to search accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to search accounts');
    } finally {
      setLoading(false);
    }
  }, [loadAccounts]);

  /**
   * Delete an account
   */
  const deleteAccount = useCallback(async (id: string) => {
    if (!isElectron()) return false;

    try {
      const success = await ipc.invoke<boolean>(IPC_CHANNELS.ACCOUNT_DELETE, id);
      if (success) {
        setAccounts((prev) => prev.filter((acc) => acc.id !== id));
        setStats((prev) => ({
          ...prev,
          totalCount: prev.totalCount - 1,
        }));
      }
      return success;
    } catch (err) {
      console.error('Failed to delete account:', err);
      return false;
    }
  }, []);

  /**
   * Export accounts to CSV
   */
  const exportToCSV = useCallback(async () => {
    if (!isElectron()) return null;

    try {
      const csvContent = await ipc.invoke<string>(IPC_CHANNELS.ACCOUNT_EXPORT_CSV);
      return csvContent;
    } catch (err) {
      console.error('Failed to export accounts:', err);
      return null;
    }
  }, []);

  // Load accounts on mount and listen for real-time updates
  useEffect(() => {
    loadAccounts();

    if (isElectron()) {
      // Listen for account creation events
      const handleAccountCreated = (_event: unknown, account: Account) => {
        setAccounts((prev) => [account, ...prev]);
        setStats((prev) => ({
          totalCount: prev.totalCount + 1,
          byService: {
            ...prev.byService,
            [account.service]: (prev.byService[account.service] || 0) + 1,
          },
        }));
      };

      const handleAccountDeleted = (_event: unknown, id: string) => {
        setAccounts((prev) => prev.filter((acc) => acc.id !== id));
      };

      const unsubCreated = ipc.on(IPC_CHANNELS.EVENT_ACCOUNT_CREATED, handleAccountCreated as Parameters<typeof ipc.on>[1]);
      const unsubDeleted = ipc.on(IPC_CHANNELS.EVENT_ACCOUNT_DELETED, handleAccountDeleted as Parameters<typeof ipc.on>[1]);

      return () => {
        unsubCreated?.();
        unsubDeleted?.();
      };
    }
  }, [loadAccounts]);

  return {
    accounts,
    stats,
    loading,
    error,
    loadAccounts,
    searchAccounts,
    deleteAccount,
    exportToCSV,
  };
}

