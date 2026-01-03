/**
 * @fileoverview Task IPC Handlers
 * @module electron/ipc/task
 *
 * Handles IPC communication for task operations.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { TaskService } from '../services/task.service';
import { logger } from '../utils/logger';

let service: TaskService | null = null;

function getService(): TaskService {
  if (!service) {
    service = new TaskService();
  }
  return service;
}

/**
 * Register task IPC handlers
 */
export function registerTaskHandlers(mainWindow: BrowserWindow): void {
  logger.debug('Registering task IPC handlers');

  // Set main window for progress updates
  getService().setMainWindow(mainWindow);

  ipcMain.handle(IPC_CHANNELS.TASK_CREATE, async (_, data) => {
    return await getService().create(data);
  });

  ipcMain.handle(IPC_CHANNELS.TASK_EXECUTE, async (_, data) => {
    // Execute asynchronously
    getService().execute(data.taskId).catch(error => {
      logger.error('Task execution failed in handler', { error, taskId: data.taskId });
    });
    return { success: true, message: 'Task execution started' };
  });

  ipcMain.handle(IPC_CHANNELS.TASK_GET_ALL, async () => {
    return await getService().getAll();
  });

  ipcMain.handle(IPC_CHANNELS.TASK_GET_BY_ID, async (_, data) => {
    return await getService().getById(data.id);
  });

  ipcMain.handle(IPC_CHANNELS.TASK_GET_RUNNING, async () => {
    return await getService().getRunning();
  });

  ipcMain.handle(IPC_CHANNELS.TASK_CANCEL, async (_, data) => {
    await getService().cancel(data.id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TASK_PAUSE, async (_, data) => {
    await getService().pause(data.id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TASK_RESUME, async (_, data) => {
    await getService().resume(data.id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, async (_, data) => {
    const deleted = await getService().delete(data.id);
    return { success: deleted };
  });

  ipcMain.handle(IPC_CHANNELS.TASK_CLEAR_ALL, async () => {
    const count = await getService().clearAll();
    return { success: true, count };
  });

  ipcMain.handle(IPC_CHANNELS.TASK_CLEAR_COMPLETED, async () => {
    const count = await getService().clearCompleted();
    return { success: true, count };
  });

  logger.debug('Task IPC handlers registered');
}
