/**
 * @fileoverview Workflow IPC Handlers
 * @module electron/ipc/workflow
 *
 * Handles IPC communication for workflow operations.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { WorkflowService } from '../services/workflow.service';
import { logger } from '../utils/logger';

let service: WorkflowService | null = null;

function getService(): WorkflowService {
  if (!service) {
    service = new WorkflowService();
  }
  return service;
}

/**
 * Register workflow IPC handlers
 */
export function registerWorkflowHandlers(): void {
  logger.debug('Registering workflow IPC handlers');

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_CREATE, async (_, data) => {
    return await getService().create(data);
  });

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_GET_ALL, async () => {
    return await getService().getAll();
  });

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_GET_BY_ID, async (_, data) => {
    return await getService().getById(data.id);
  });

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_UPDATE, async (_, data) => {
    return await getService().update(data.id, data.input);
  });

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_DELETE, async (_, data) => {
    return await getService().delete(data.id);
  });

  logger.debug('Workflow IPC handlers registered');
}
