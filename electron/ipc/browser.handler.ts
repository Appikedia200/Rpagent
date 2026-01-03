/**
 * @fileoverview Browser IPC Handlers
 * @module electron/ipc/browser
 *
 * Handles IPC communication for browser operations.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { BrowserService } from '../services/browser.service';
import { logger } from '../utils/logger';

let service: BrowserService | null = null;

function getService(): BrowserService {
  if (!service) {
    service = new BrowserService();
  }
  return service;
}

/**
 * Register browser IPC handlers
 */
export function registerBrowserHandlers(): void {
  logger.debug('Registering browser IPC handlers');

  ipcMain.handle(IPC_CHANNELS.BROWSER_LAUNCH, async (_, data) => {
    try {
      logger.info('IPC: Browser launch requested', { workspaceId: data.workspaceId });
      await getService().launch(data.workspaceId);
      logger.info('IPC: Browser launch succeeded', { workspaceId: data.workspaceId });
      return { success: true };
    } catch (error) {
      logger.error('IPC: Browser launch FAILED', { 
        workspaceId: data.workspaceId, 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return error to frontend instead of throwing
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Browser launch failed' 
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_CLOSE, async (_, data) => {
    await getService().close(data.workspaceId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_CLOSE_ALL, async () => {
    await getService().closeAll();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_GET_ALL_ACTIVE, async () => {
    const activeBrowsers = await getService().getAllActive();
    
    // Map to frontend BrowserSession format
    return activeBrowsers.map(browser => ({
      workspaceId: browser.workspaceId,
      workspaceName: browser.workspaceName,
      status: browser.status === 'active' ? 'running' : 
              browser.status === 'loading' ? 'running' : 
              browser.status,
      url: browser.currentUrl || 'about:blank',
      cpu: Math.round(Math.random() * 15 + 5), // TODO: Get real CPU usage
      memory: Math.round(Math.random() * 200 + 100), // TODO: Get real memory usage
      launchedAt: browser.launchedAt,
    }));
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_NAVIGATE, async (_, data) => {
    await getService().navigate(data.workspaceId, data.url);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_SCREENSHOT, async (_, data) => {
    const buffer = await getService().screenshot(data.workspaceId, data.path);
    return buffer.toString('base64');
  });

  logger.debug('Browser IPC handlers registered');
}
