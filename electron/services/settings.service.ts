/**
 * @fileoverview Settings Service
 * @module electron/services/settings
 *
 * Persists and manages application settings.
 * All settings are saved to database and loaded on startup.
 */

import { getDatabase } from '../database/db';
import { logger } from '../utils/logger';
import { getCaptchaSolverService } from '../../automation/services/captcha-solver.service';

export interface AppSettings {
  // General
  maxConcurrentBrowsers: number;
  defaultTimeout: number;
  headlessMode: boolean;
  autoSave: boolean;
  
  // Anti-Detection
  region: string;
  humanBehavior: boolean;
  undetectableMode: boolean;
  blockWebRTC: boolean;
  
  // Proxy Allocation
  proxyMode: 'static' | 'residential';  // Which pool to use
  autoAllocate: boolean;                // Auto-assign proxies on browser creation
  rotateOnNewSession: boolean;          // For residential mode
  enableProxy: boolean;
  proxyRotation: string;
  
  // Notifications
  taskComplete: boolean;
  taskError: boolean;
  systemAlerts: boolean;
  
  // Storage
  dataRetention: number;
  autoCleanup: boolean;
  
  // CAPTCHA
  captchaService: string;
  captchaApiKey: string;
  
  // Telnyx
  telnyxApiKey: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  maxConcurrentBrowsers: 10,
  defaultTimeout: 30000,
  headlessMode: false,
  autoSave: true,
  region: 'auto',
  humanBehavior: true,
  undetectableMode: true,
  blockWebRTC: true,
  proxyMode: 'static',
  autoAllocate: true,           // Auto-allocate proxies when launching browsers
  rotateOnNewSession: false,
  enableProxy: true,            // Enable proxy by default
  proxyRotation: 'session',
  taskComplete: true,
  taskError: true,
  systemAlerts: true,
  dataRetention: 30,
  autoCleanup: true,
  captchaService: 'none',
  captchaApiKey: '',
  telnyxApiKey: '',
};

class SettingsService {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private initialized = false;

  /**
   * Initialize the settings service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const db = getDatabase();
      
      // Create settings table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Load existing settings
      const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];
      
      for (const row of rows) {
        try {
          const value = JSON.parse(row.value);
          if (row.key in this.settings) {
            (this.settings as any)[row.key] = value;
          }
        } catch {
          // Keep default value
        }
      }

      // Apply CAPTCHA settings if configured
      if (this.settings.captchaService !== 'none' && this.settings.captchaApiKey) {
        this.applyCaptchaSettings();
      }

      this.initialized = true;
      logger.info('Settings service initialized', { settings: this.getPublicSettings() });
    } catch (error) {
      logger.error('Failed to initialize settings service', { error });
      throw error;
    }
  }

  /**
   * Get all settings
   */
  getAll(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Get a specific setting
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  /**
   * Update a single setting
   */
  async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    this.settings[key] = value;
    await this.persistSetting(key, value);
    
    // Apply side effects
    if (key === 'captchaService' || key === 'captchaApiKey') {
      this.applyCaptchaSettings();
    }
  }

  /**
   * Update multiple settings at once
   */
  async setMultiple(updates: Partial<AppSettings>): Promise<void> {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (key in this.settings) {
          (this.settings as any)[key] = value;
          stmt.run(key, JSON.stringify(value));
        }
      }
    });

    transaction();
    
    // Apply side effects
    if ('captchaService' in updates || 'captchaApiKey' in updates) {
      this.applyCaptchaSettings();
    }

    logger.info('Settings updated', { updates: Object.keys(updates) });
  }

  /**
   * Reset to defaults
   */
  async resetToDefaults(): Promise<void> {
    const db = getDatabase();
    db.exec('DELETE FROM app_settings');
    this.settings = { ...DEFAULT_SETTINGS };
    logger.info('Settings reset to defaults');
  }

  /**
   * Persist a single setting
   */
  private async persistSetting(key: string, value: unknown): Promise<void> {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(key, JSON.stringify(value));
  }

  /**
   * Apply CAPTCHA settings to the solver service
   */
  private applyCaptchaSettings(): void {
    if (this.settings.captchaService !== 'none' && this.settings.captchaApiKey) {
      const serviceMap: Record<string, '2captcha' | 'anti-captcha' | 'capmonster'> = {
        '2captcha': '2captcha',
        'anticaptcha': 'anti-captcha',
        'capsolver': 'capmonster',
      };

      const captchaService = getCaptchaSolverService();
      captchaService.configure({
        service: serviceMap[this.settings.captchaService] || '2captcha',
        apiKey: this.settings.captchaApiKey,
      });
      
      logger.info('CAPTCHA service configured', { service: this.settings.captchaService });
    }
  }

  /**
   * Get public settings (hide sensitive keys)
   */
  private getPublicSettings(): Partial<AppSettings> {
    return {
      ...this.settings,
      captchaApiKey: this.settings.captchaApiKey ? '***' : '',
      telnyxApiKey: this.settings.telnyxApiKey ? '***' : '',
    };
  }
}

// Singleton instance
let settingsServiceInstance: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new SettingsService();
  }
  return settingsServiceInstance;
}

export { SettingsService };

