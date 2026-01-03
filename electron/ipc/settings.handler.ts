/**
 * @fileoverview Settings IPC Handlers
 * @module electron/ipc/settings
 *
 * Handles IPC communication for settings operations.
 */

import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/constants/ipc-channels';
import { getSettingsService, AppSettings } from '../services/settings.service';
import { logger } from '../utils/logger';

export function registerSettingsHandlers(): void {
  const service = getSettingsService();

  // Get all settings
  ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, async () => {
    try {
      await service.initialize();
      return { success: true, settings: service.getAll() };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get settings';
      logger.error('Failed to get settings', { error });
      return { success: false, error: message };
    }
  });

  // Save all settings
  ipcMain.handle(IpcChannels.SETTINGS_SAVE, async (_event, settings: Partial<AppSettings>) => {
    try {
      await service.initialize();
      await service.setMultiple(settings);
      logger.info('Settings saved successfully');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      logger.error('Failed to save settings', { error });
      return { success: false, error: message };
    }
  });

  // Reset to defaults
  ipcMain.handle(IpcChannels.SETTINGS_RESET, async () => {
    try {
      await service.initialize();
      await service.resetToDefaults();
      return { success: true, settings: service.getAll() };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset settings';
      logger.error('Failed to reset settings', { error });
      return { success: false, error: message };
    }
  });

  // Get single setting
  ipcMain.handle(IpcChannels.SETTINGS_GET, async (_event, key: keyof AppSettings) => {
    try {
      await service.initialize();
      return { success: true, value: service.get(key) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get setting';
      return { success: false, error: message };
    }
  });

  logger.info('Settings IPC handlers registered');
}

