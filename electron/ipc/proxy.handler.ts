/**
 * @fileoverview Proxy IPC Handlers
 * @module electron/ipc/proxy
 *
 * Handles IPC communication for proxy operations.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { ProxyService } from '../services/proxy.service';
import { logger } from '../utils/logger';

let service: ProxyService | null = null;

function getService(): ProxyService {
  if (!service) {
    service = new ProxyService();
  }
  return service;
}

/**
 * Register proxy IPC handlers
 */
export function registerProxyHandlers(): void {
  logger.debug('Registering proxy IPC handlers');

  ipcMain.handle(IPC_CHANNELS.PROXY_CREATE, async (_, data) => {
    return await getService().create(data);
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_GET_ALL, async () => {
    return await getService().getAll();
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_GET_BY_ID, async (_, data) => {
    return await getService().getById(data.id);
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_TEST, async (_, data) => {
    return await getService().test(data.id);
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_TEST_ALL, async () => {
    return await getService().testAll();
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_DELETE, async (_, data) => {
    return await getService().delete(data.id);
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_BULK_IMPORT, async (_, data) => {
    return await getService().bulkImport(data);
  });

  logger.debug('Proxy IPC handlers registered');
}
