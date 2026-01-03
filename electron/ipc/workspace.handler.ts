/**
 * @fileoverview Workspace IPC Handlers
 * @module electron/ipc/workspace
 *
 * Handles IPC communication for workspace operations.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { WorkspaceService } from '../services/workspace.service';
import { logger } from '../utils/logger';

let service: WorkspaceService | null = null;

function getService(): WorkspaceService {
  if (!service) {
    service = new WorkspaceService();
  }
  return service;
}

/**
 * Register workspace IPC handlers
 */
export function registerWorkspaceHandlers(): void {
  logger.debug('Registering workspace IPC handlers');

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CREATE, async (_, data) => {
    return await getService().create(data);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CREATE_BULK, async (_, data) => {
    return await getService().createBulk(data);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_ALL, async () => {
    return await getService().getAll();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_BY_ID, async (_, data) => {
    return await getService().getById(data.id);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_UPDATE, async (_, data) => {
    return await getService().update(data.id, data.input);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE, async (_, data) => {
    return await getService().delete(data.id);
  });

  // Proxy assignment handlers
  ipcMain.handle('workspace:assignProxy', async (_, data: { workspaceId: string; proxyId: string }) => {
    return await getService().assignProxy(data.workspaceId, data.proxyId);
  });

  ipcMain.handle('workspace:unassignProxy', async (_, data: { workspaceId: string }) => {
    return await getService().unassignProxy(data.workspaceId);
  });

  logger.debug('Workspace IPC handlers registered');
}
