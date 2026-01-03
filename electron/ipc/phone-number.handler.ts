/**
 * @fileoverview Phone Number IPC Handlers
 * @module electron/ipc/phone-number
 *
 * Handles IPC communication for phone number management.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IpcChannels } from '../../shared/constants/ipc-channels';
import { getPhoneNumberService, PhoneNumber, TelnyxConfig } from '../../automation/services/phone-number.service';
import { logger } from '../utils/logger';

export function registerPhoneNumberHandlers(mainWindow: BrowserWindow | null): void {
  const service = getPhoneNumberService();

  // Forward events to renderer
  service.on('numberAdded', (number: PhoneNumber) => {
    mainWindow?.webContents.send(IpcChannels.PHONE_NUMBER_ADDED, number);
  });

  service.on('numberRemoved', (number: PhoneNumber) => {
    mainWindow?.webContents.send(IpcChannels.PHONE_NUMBER_REMOVED, number);
  });

  service.on('smsReceived', (sms) => {
    mainWindow?.webContents.send(IpcChannels.PHONE_SMS_RECEIVED, sms);
  });

  // Configure Telnyx
  ipcMain.handle(IpcChannels.PHONE_CONFIGURE_TELNYX, async (_event, config: TelnyxConfig) => {
    try {
      service.configureTelnyx(config);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration failed';
      logger.error('Telnyx configuration failed', { error });
      return { success: false, error: message };
    }
  });

  // Verify Telnyx API
  ipcMain.handle(IpcChannels.PHONE_VERIFY_TELNYX, async (_event, config?: TelnyxConfig) => {
    try {
      if (config) {
        service.configureTelnyx(config);
      }
      const result = await service.verifyTelnyxApiKey();
      logger.info('Telnyx verification result', { valid: result.valid });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      return { valid: false, error: message };
    }
  });

  // Add a phone number
  ipcMain.handle(IpcChannels.PHONE_ADD_NUMBER, async (_event, data: { number: string; provider?: string }) => {
    try {
      const phoneNumber = service.addNumber(data.number, (data.provider as any) || 'manual');
      return { success: true, number: phoneNumber };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add number';
      return { success: false, error: message };
    }
  });

  // Import multiple numbers
  ipcMain.handle(IpcChannels.PHONE_IMPORT_NUMBERS, async (_event, data: { numbers: string[]; provider?: string }) => {
    try {
      const imported = service.importNumbers(data.numbers, (data.provider as any) || 'manual');
      return { success: true, count: imported.length, numbers: imported };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import numbers';
      return { success: false, error: message };
    }
  });

  // Remove a phone number
  ipcMain.handle(IpcChannels.PHONE_REMOVE_NUMBER, async (_event, id: string) => {
    try {
      const success = service.removeNumber(id);
      return { success };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove number';
      return { success: false, error: message };
    }
  });

  // Get all numbers
  ipcMain.handle(IpcChannels.PHONE_GET_ALL, async () => {
    try {
      const numbers = service.getAllNumbers();
      return { success: true, numbers };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get numbers';
      return { success: false, error: message };
    }
  });

  // Get available numbers
  ipcMain.handle(IpcChannels.PHONE_GET_AVAILABLE, async () => {
    try {
      const numbers = service.getAvailableNumbers();
      return { success: true, numbers };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get available numbers';
      return { success: false, error: message };
    }
  });

  // Reserve a number
  ipcMain.handle(IpcChannels.PHONE_RESERVE, async (_event, workspaceId: string) => {
    try {
      const number = service.reserveNumber(workspaceId);
      return { success: !!number, number };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reserve number';
      return { success: false, error: message };
    }
  });

  // Release a number
  ipcMain.handle(IpcChannels.PHONE_RELEASE, async (_event, id: string) => {
    try {
      service.releaseNumber(id);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to release number';
      return { success: false, error: message };
    }
  });

  // Get SMS history
  ipcMain.handle(IpcChannels.PHONE_GET_SMS_HISTORY, async (_event, phoneNumber: string) => {
    try {
      const history = service.getSMSHistory(phoneNumber);
      return { success: true, history };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get SMS history';
      return { success: false, error: message };
    }
  });

  // Get stats
  ipcMain.handle(IpcChannels.PHONE_GET_STATS, async () => {
    try {
      const stats = service.getStats();
      return { success: true, stats };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get stats';
      return { success: false, error: message };
    }
  });

  // Fetch numbers from Telnyx
  ipcMain.handle(IpcChannels.PHONE_FETCH_TELNYX, async () => {
    try {
      const numbers = await service.fetchTelnyxNumbers();
      return { success: true, count: numbers.length, numbers };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch Telnyx numbers';
      return { success: false, error: message };
    }
  });

  // Process incoming SMS (for webhook simulation or testing)
  ipcMain.handle(IpcChannels.PHONE_PROCESS_SMS, async (_event, to: string, from: string, body: string) => {
    try {
      const sms = service.processIncomingSMS(to, from, body);
      return { success: true, sms };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process SMS';
      return { success: false, error: message };
    }
  });

  logger.info('Phone number IPC handlers registered');
}

