/**
 * @fileoverview Task Queue IPC Handlers
 * @module electron/ipc/queue.handler
 */

import { ipcMain, BrowserWindow } from 'electron';
import { getTaskQueue, TaskPriority, QueuedTask } from '../../automation/queue';

export function registerQueueHandlers(mainWindow: BrowserWindow | null): void {
  const queue = getTaskQueue();
  
  if (!queue) {
    console.warn('[Queue Handler] Queue not initialized');
    return;
  }

  // Forward queue events to renderer
  queue.on('taskQueued', (task: QueuedTask) => {
    mainWindow?.webContents?.send('queue:taskQueued', task);
  });

  queue.on('taskStarted', (task: QueuedTask) => {
    mainWindow?.webContents?.send('queue:taskStarted', task);
  });

  queue.on('taskCompleted', (task: QueuedTask) => {
    mainWindow?.webContents?.send('queue:taskCompleted', task);
  });

  queue.on('taskFailed', (task: QueuedTask) => {
    mainWindow?.webContents?.send('queue:taskFailed', task);
  });

  // Enqueue a new task
  ipcMain.handle('queue:enqueue', async (_, data: {
    command: string;
    priority?: string;
    workspaceId?: string;
    dependencies?: string[];
    maxRetries?: number;
  }) => {
    try {
      const priority = data.priority 
        ? TaskPriority[data.priority.toUpperCase() as keyof typeof TaskPriority] 
        : TaskPriority.NORMAL;
      
      const task = queue.enqueue(data.command, {
        priority,
        workspaceId: data.workspaceId,
        dependencies: data.dependencies,
        maxRetries: data.maxRetries,
      });
      
      return task;
    } catch (error) {
      console.error('[Queue Handler] Error enqueueing task:', error);
      throw error;
    }
  });

  // Enqueue batch
  ipcMain.handle('queue:enqueueBatch', async (_, tasks: Array<{
    command: string;
    priority?: string;
    workspaceId?: string;
  }>) => {
    try {
      const mappedTasks = tasks.map(t => ({
        command: t.command,
        priority: t.priority 
          ? TaskPriority[t.priority.toUpperCase() as keyof typeof TaskPriority]
          : TaskPriority.NORMAL,
        workspaceId: t.workspaceId,
      }));
      
      return queue.enqueueBatch(mappedTasks);
    } catch (error) {
      console.error('[Queue Handler] Error enqueueing batch:', error);
      throw error;
    }
  });

  // Cancel a task
  ipcMain.handle('queue:cancel', async (_, taskId: string) => {
    try {
      return queue.cancel(taskId);
    } catch (error) {
      console.error('[Queue Handler] Error cancelling task:', error);
      return false;
    }
  });

  // Cancel all tasks
  ipcMain.handle('queue:cancelAll', async () => {
    try {
      return queue.cancelAll();
    } catch (error) {
      console.error('[Queue Handler] Error cancelling all tasks:', error);
      return 0;
    }
  });

  // Get queue stats
  ipcMain.handle('queue:getStats', async () => {
    try {
      return queue.getStats();
    } catch (error) {
      console.error('[Queue Handler] Error getting stats:', error);
      return null;
    }
  });

  // Get task by ID
  ipcMain.handle('queue:getTask', async (_, taskId: string) => {
    try {
      return queue.getTask(taskId);
    } catch (error) {
      console.error('[Queue Handler] Error getting task:', error);
      return null;
    }
  });

  // Get tasks by status
  ipcMain.handle('queue:getByStatus', async (_, status: string) => {
    try {
      return queue.getTasksByStatus(status as QueuedTask['status']);
    } catch (error) {
      console.error('[Queue Handler] Error getting tasks by status:', error);
      return [];
    }
  });

  // Pause queue
  ipcMain.handle('queue:pause', async () => {
    try {
      queue.pause();
      return true;
    } catch (error) {
      console.error('[Queue Handler] Error pausing queue:', error);
      return false;
    }
  });

  // Resume queue
  ipcMain.handle('queue:resume', async (_, maxConcurrent?: number) => {
    try {
      queue.resume(maxConcurrent);
      return true;
    } catch (error) {
      console.error('[Queue Handler] Error resuming queue:', error);
      return false;
    }
  });

  // Clear history
  ipcMain.handle('queue:clearHistory', async () => {
    try {
      queue.clearHistory();
      return true;
    } catch (error) {
      console.error('[Queue Handler] Error clearing history:', error);
      return false;
    }
  });

  console.log('[IPC] Queue handlers registered');
}

