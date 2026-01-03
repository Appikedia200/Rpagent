/**
 * @fileoverview Application Configuration
 * @module electron/utils/config
 *
 * Loads environment variables and provides type-safe configuration.
 */

import dotenv from 'dotenv';
import path from 'path';
import { app } from 'electron';
import { APP_CONFIG } from '../../shared/constants/app-config';

// Load environment variables
dotenv.config();

/**
 * Application configuration interface
 */
export interface AppConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  logLevel: string;
  maxBrowsers: number;
  databasePath: string;
  fingerprintDbPath: string;
  playwrightBrowsersPath: string;
  captchaApiKey?: string;
  captchaService?: string;
  farmosApiUrl?: string;
  farmosApiKey?: string;
}

/**
 * Get the configuration object
 */
function loadConfig(): AppConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  let userDataPath: string;
  try {
    userDataPath = app.getPath('userData');
  } catch {
    userDataPath = process.cwd();
  }

  let resourcesPath: string;
  try {
    resourcesPath = process.resourcesPath || process.cwd();
  } catch {
    resourcesPath = process.cwd();
  }

  return {
    isDevelopment,
    isProduction,
    logLevel: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    maxBrowsers: parseInt(process.env.MAX_BROWSERS || String(APP_CONFIG.MAX_BROWSERS), 10),
    databasePath: path.join(userDataPath, APP_CONFIG.DATABASE_NAME),
    fingerprintDbPath: path.join(userDataPath, APP_CONFIG.FINGERPRINT_DB_NAME),
    playwrightBrowsersPath: isProduction
      ? path.join(resourcesPath, 'playwright-browsers')
      : '',
    captchaApiKey: process.env.CAPTCHA_API_KEY,
    captchaService: process.env.CAPTCHA_SERVICE || '2captcha',
    farmosApiUrl: process.env.FARMOS_API_URL,
    farmosApiKey: process.env.FARMOS_API_KEY,
  };
}

/**
 * Application configuration singleton
 */
export const config = loadConfig();

/**
 * Refresh configuration (useful after environment changes)
 */
export function refreshConfig(): AppConfig {
  Object.assign(config, loadConfig());
  return config;
}
