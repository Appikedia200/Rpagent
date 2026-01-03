/**
 * @fileoverview Command IPC Handlers
 * @module electron/ipc/command
 *
 * Handles IPC communication for command execution.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { CommandService } from '../services/command.service';
import { logger } from '../utils/logger';

let service: CommandService | null = null;

function getService(): CommandService {
  if (!service) {
    service = new CommandService();
  }
  return service;
}

/**
 * Register command IPC handlers
 */
export function registerCommandHandlers(mainWindow: BrowserWindow): void {
  logger.debug('Registering command IPC handlers');

  // Set main window for progress updates
  getService().setMainWindow(mainWindow);

  ipcMain.handle(IPC_CHANNELS.COMMAND_EXECUTE, async (_, data) => {
    return await getService().execute(data);
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_PARSE, async (_, data) => {
    return getService().getSuggestions(data.command);
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_GET_HISTORY, async (_, data) => {
    const limit = data?.limit ?? 100;
    return getService().getHistory(limit);
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_CLEAR_HISTORY, async () => {
    return getService().clearHistory();
  });

  logger.debug('Command IPC handlers registered');
}
