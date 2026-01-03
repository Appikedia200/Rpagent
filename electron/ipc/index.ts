/**
 * @fileoverview IPC Handler Registration
 * @module electron/ipc
 *
 * Centralizes registration of all IPC handlers.
 */

import { BrowserWindow } from 'electron';
import { registerWorkspaceHandlers } from './workspace.handler';
import { registerBrowserHandlers } from './browser.handler';
import { registerProxyHandlers } from './proxy.handler';
import { registerWorkflowHandlers } from './workflow.handler';
import { registerTaskHandlers } from './task.handler';
import { registerCommandHandlers } from './command.handler';
import { registerSystemHandlers } from './system.handler';
import { registerAccountHandlers } from './account.handler';
import { registerCaptchaHandlers } from './captcha.handler';
import { registerPhoneNumberHandlers } from './phone-number.handler';
import { registerSettingsHandlers } from './settings.handler';
import { registerSchedulerHandlers } from './scheduler.handler';
import { registerMonitoringHandlers } from './monitoring.handler';
import { registerQueueHandlers } from './queue.handler';
import { registerProxyManagerHandlers } from './proxy-manager.handler';
import { logger } from '../utils/logger';

/**
 * Register all IPC handlers
 */
export function registerAllHandlers(mainWindow: BrowserWindow): void {
  logger.info('Registering all IPC handlers');

  registerWorkspaceHandlers();
  registerBrowserHandlers();
  registerProxyHandlers();
  registerWorkflowHandlers();
  registerTaskHandlers(mainWindow);
  registerCommandHandlers(mainWindow);
  registerSystemHandlers();
  registerAccountHandlers();
  registerCaptchaHandlers();
  registerPhoneNumberHandlers(mainWindow);
  registerSettingsHandlers();
  
  // New enterprise features
  registerSchedulerHandlers();
  registerMonitoringHandlers();
  registerQueueHandlers(mainWindow);
  registerProxyManagerHandlers(mainWindow);

  logger.info('All IPC handlers registered');
}
