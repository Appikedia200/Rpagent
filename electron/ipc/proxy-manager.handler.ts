/**
 * @fileoverview Proxy Manager IPC Handlers
 * @module electron/ipc/proxy-manager.handler
 */

import { ipcMain, BrowserWindow } from 'electron';
import { getProxyManager } from '../../automation/proxy';
import { Proxy, ProxyType } from '../../shared/types/proxy.types';

export function registerProxyManagerHandlers(mainWindow: BrowserWindow | null): void {
  const proxyManager = getProxyManager();

  // Forward proxy events to renderer
  proxyManager.on('proxyAdded', (proxy: Proxy) => {
    mainWindow?.webContents?.send('proxyManager:proxyAdded', proxy);
  });

  proxyManager.on('proxyRemoved', (proxyId: string) => {
    mainWindow?.webContents?.send('proxyManager:proxyRemoved', proxyId);
  });

  proxyManager.on('proxyAssigned', (assignment: unknown) => {
    mainWindow?.webContents?.send('proxyManager:proxyAssigned', assignment);
  });

  proxyManager.on('proxyOnline', (proxy: Proxy) => {
    mainWindow?.webContents?.send('proxyManager:proxyOnline', proxy);
  });

  proxyManager.on('proxyOffline', (proxy: Proxy) => {
    mainWindow?.webContents?.send('proxyManager:proxyOffline', proxy);
  });

  proxyManager.on('healthChecksComplete', (summary: unknown) => {
    mainWindow?.webContents?.send('proxyManager:healthChecksComplete', summary);
  });

  // Get all proxies
  ipcMain.handle('proxyManager:getAll', async () => {
    try {
      return proxyManager.getAllProxies();
    } catch (error) {
      console.error('[Proxy Manager Handler] Error getting proxies:', error);
      return [];
    }
  });

  // Get proxies by type
  ipcMain.handle('proxyManager:getByType', async (_, type: string) => {
    try {
      return proxyManager.getProxiesByType(type as ProxyType);
    } catch (error) {
      console.error('[Proxy Manager Handler] Error getting proxies by type:', error);
      return [];
    }
  });

  // Get available proxies
  ipcMain.handle('proxyManager:getAvailable', async () => {
    try {
      return proxyManager.getAvailableProxies();
    } catch (error) {
      console.error('[Proxy Manager Handler] Error getting available proxies:', error);
      return [];
    }
  });

  // Assign proxy to workspace
  ipcMain.handle('proxyManager:assign', async (_, data: {
    proxyId: string;
    workspaceId: string;
    locked?: boolean;
    browserId?: string;
  }) => {
    try {
      return proxyManager.assignToWorkspace(data.proxyId, data.workspaceId, {
        locked: data.locked,
        browserId: data.browserId,
      });
    } catch (error) {
      console.error('[Proxy Manager Handler] Error assigning proxy:', error);
      return null;
    }
  });

  // Unassign proxy from workspace
  ipcMain.handle('proxyManager:unassign', async (_, workspaceId: string) => {
    try {
      return proxyManager.unassignFromWorkspace(workspaceId);
    } catch (error) {
      console.error('[Proxy Manager Handler] Error unassigning proxy:', error);
      return false;
    }
  });

  // Get proxy for workspace
  ipcMain.handle('proxyManager:getForWorkspace', async (_, workspaceId: string) => {
    try {
      return proxyManager.getProxyForWorkspace(workspaceId);
    } catch (error) {
      console.error('[Proxy Manager Handler] Error getting proxy for workspace:', error);
      return null;
    }
  });

  // Get all assignments
  ipcMain.handle('proxyManager:getAssignments', async () => {
    try {
      return proxyManager.getAllAssignments();
    } catch (error) {
      console.error('[Proxy Manager Handler] Error getting assignments:', error);
      return [];
    }
  });

  // Run health checks
  ipcMain.handle('proxyManager:runHealthChecks', async () => {
    try {
      await proxyManager.runHealthChecks();
      return true;
    } catch (error) {
      console.error('[Proxy Manager Handler] Error running health checks:', error);
      return false;
    }
  });

  // Get health summary
  ipcMain.handle('proxyManager:getHealthSummary', async () => {
    try {
      return proxyManager.getHealthSummary();
    } catch (error) {
      console.error('[Proxy Manager Handler] Error getting health summary:', error);
      return null;
    }
  });

  // Get health check for a proxy
  ipcMain.handle('proxyManager:getHealthCheck', async (_, proxyId: string) => {
    try {
      return proxyManager.getHealthCheck(proxyId);
    } catch (error) {
      console.error('[Proxy Manager Handler] Error getting health check:', error);
      return null;
    }
  });

  // Rotate proxy for workspace
  ipcMain.handle('proxyManager:rotate', async (_, workspaceId: string) => {
    try {
      return proxyManager.rotate(workspaceId);
    } catch (error) {
      console.error('[Proxy Manager Handler] Error rotating proxy:', error);
      return null;
    }
  });

  // Start health checks
  ipcMain.handle('proxyManager:startHealthChecks', async () => {
    try {
      proxyManager.startHealthChecks();
      return true;
    } catch (error) {
      console.error('[Proxy Manager Handler] Error starting health checks:', error);
      return false;
    }
  });

  // Stop health checks
  ipcMain.handle('proxyManager:stopHealthChecks', async () => {
    try {
      proxyManager.stopHealthChecks();
      return true;
    } catch (error) {
      console.error('[Proxy Manager Handler] Error stopping health checks:', error);
      return false;
    }
  });

  console.log('[IPC] Proxy Manager handlers registered');
}

