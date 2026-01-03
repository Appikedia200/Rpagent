/**
 * @fileoverview Account IPC Handler
 * @module electron/ipc/account
 *
 * Handles IPC communication for account management.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { AccountService, getAccountService } from '../services/account.service';
import { logger } from '../utils/logger';

let accountService: AccountService | null = null;

/**
 * Get the account service instance (lazy initialization)
 */
function getService(): AccountService {
  if (!accountService) {
    accountService = getAccountService();
  }
  return accountService;
}

/**
 * Register account IPC handlers
 */
export function registerAccountHandlers(): void {
  // Get all accounts
  ipcMain.handle(IPC_CHANNELS.ACCOUNT_GET_ALL, async () => {
    try {
      const service = getService();
      await service.initialize();
      return await service.getAllAccounts();
    } catch (error) {
      logger.error('IPC: Failed to get all accounts', { error });
      throw error;
    }
  });

  // Get account by ID
  ipcMain.handle(IPC_CHANNELS.ACCOUNT_GET_BY_ID, async (_event, id: string) => {
    try {
      const service = getService();
      await service.initialize();
      return await service.getAccountById(id);
    } catch (error) {
      logger.error('IPC: Failed to get account by ID', { error, id });
      throw error;
    }
  });

  // Search accounts
  ipcMain.handle(IPC_CHANNELS.ACCOUNT_SEARCH, async (_event, query: string) => {
    try {
      const service = getService();
      await service.initialize();
      return await service.searchAccounts(query);
    } catch (error) {
      logger.error('IPC: Failed to search accounts', { error, query });
      throw error;
    }
  });

  // Delete account
  ipcMain.handle(IPC_CHANNELS.ACCOUNT_DELETE, async (_event, id: string) => {
    try {
      const service = getService();
      await service.initialize();
      return await service.deleteAccount(id);
    } catch (error) {
      logger.error('IPC: Failed to delete account', { error, id });
      throw error;
    }
  });

  // Export to CSV
  ipcMain.handle(IPC_CHANNELS.ACCOUNT_EXPORT_CSV, async () => {
    try {
      const service = getService();
      await service.initialize();
      return await service.exportToCSV();
    } catch (error) {
      logger.error('IPC: Failed to export accounts to CSV', { error });
      throw error;
    }
  });

  // Get account statistics
  ipcMain.handle(IPC_CHANNELS.ACCOUNT_GET_STATS, async () => {
    try {
      const service = getService();
      await service.initialize();
      const [count, stats] = await Promise.all([
        service.getAccountCount(),
        service.getServiceStats(),
      ]);
      return { totalCount: count, byService: stats };
    } catch (error) {
      logger.error('IPC: Failed to get account stats', { error });
      throw error;
    }
  });

  logger.info('Account IPC handlers registered');
}


