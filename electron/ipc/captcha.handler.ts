/**
 * @fileoverview Captcha IPC Handlers
 * @module electron/ipc/captcha
 *
 * Handles IPC communication for captcha solving operations.
 */

import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/constants/ipc-channels';
import { getCaptchaSolverService, CaptchaSolverConfig } from '../../automation/services/captcha-solver.service';
import { logger } from '../utils/logger';

export function registerCaptchaHandlers(): void {
  const service = getCaptchaSolverService();

  // Configure captcha service
  ipcMain.handle(IpcChannels.CAPTCHA_CONFIGURE, async (_event, config: CaptchaSolverConfig) => {
    try {
      service.configure(config);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration failed';
      logger.error('Captcha configuration failed', { error });
      return { success: false, error: message };
    }
  });

  // Verify API key
  ipcMain.handle(IpcChannels.CAPTCHA_VERIFY, async (_event, config?: CaptchaSolverConfig) => {
    try {
      // If config provided, configure first
      if (config) {
        service.configure(config);
      }
      
      const result = await service.verify();
      logger.info('Captcha API verification result', { valid: result.valid, balance: result.balance });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      logger.error('Captcha verification failed', { error });
      return { valid: false, error: message };
    }
  });

  // Get balance
  ipcMain.handle(IpcChannels.CAPTCHA_GET_BALANCE, async () => {
    try {
      const balance = await service.getBalance();
      return { success: true, balance };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get balance';
      return { success: false, error: message };
    }
  });

  logger.info('Captcha IPC handlers registered');
}

