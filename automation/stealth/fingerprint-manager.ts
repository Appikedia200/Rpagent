/**
 * @fileoverview Browser Fingerprint Management
 * @module automation/stealth/fingerprint-manager
 *
 * Manages realistic and consistent browser fingerprints.
 * Based on research: "Fingerprinting the Fingerprinters" (Acar et al., 2018)
 */

import { BrowserContext } from 'playwright';
import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';
import { logger } from '../../electron/utils/logger';
import { APP_CONFIG } from '../../shared/constants/app-config';

/**
 * Fingerprint data structure
 */
interface BrowserFingerprint {
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  navigator: {
    platform: string;
    language: string;
    languages: string[];
    hardwareConcurrency: number;
    deviceMemory: number;
  };
  timezone: string;
  webgl: {
    vendor: string;
    renderer: string;
  };
}

/**
 * Database row for fingerprint
 */
interface FingerprintRow {
  id: string;
  workspace_id: string | null;
  fingerprint_data: string;
  created_at: string;
  last_used: string | null;
  use_count: number;
  is_burned: number;
}

/**
 * Fingerprint manager for consistent browser identities
 */
export class FingerprintManager {
  private db: Database.Database;
  private fingerprintCache: Map<string, BrowserFingerprint> = new Map();

  constructor() {
    const dbPath = this.getDatabasePath();
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  /**
   * Get database path
   */
  private getDatabasePath(): string {
    try {
      return path.join(app.getPath('userData'), APP_CONFIG.FINGERPRINT_DB_NAME);
    } catch {
      return path.join(process.cwd(), APP_CONFIG.FINGERPRINT_DB_NAME);
    }
  }

  /**
   * Initialize fingerprint database
   */
  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fingerprints (
        id TEXT PRIMARY KEY,
        workspace_id TEXT UNIQUE,
        fingerprint_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME,
        use_count INTEGER DEFAULT 0,
        is_burned INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_fingerprint_workspace ON fingerprints(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_fingerprint_burned ON fingerprints(is_burned);
    `);

    logger.debug('Fingerprint database initialized');
  }

  /**
   * Get or create fingerprint for workspace
   * CRITICAL: Same workspace always uses same fingerprint
   */
  getFingerprint(workspaceId: string): BrowserFingerprint {
    // Check cache first
    if (this.fingerprintCache.has(workspaceId)) {
      return this.fingerprintCache.get(workspaceId)!;
    }

    // Check database
    const existing = this.db.prepare(
      'SELECT fingerprint_data FROM fingerprints WHERE workspace_id = ? AND is_burned = 0'
    ).get(workspaceId) as FingerprintRow | undefined;

    if (existing) {
      // Update last used
      this.db.prepare(
        'UPDATE fingerprints SET last_used = ?, use_count = use_count + 1 WHERE workspace_id = ?'
      ).run(new Date().toISOString(), workspaceId);

      const fingerprint = JSON.parse(existing.fingerprint_data) as BrowserFingerprint;
      this.fingerprintCache.set(workspaceId, fingerprint);
      return fingerprint;
    }

    // Generate new fingerprint
    const fingerprint = this.generateFingerprint();

    // Store fingerprint
    this.db.prepare(`
      INSERT INTO fingerprints (id, workspace_id, fingerprint_data, last_used)
      VALUES (?, ?, ?, ?)
    `).run(
      uuidv4(),
      workspaceId,
      JSON.stringify(fingerprint),
      new Date().toISOString()
    );

    this.fingerprintCache.set(workspaceId, fingerprint);
    logger.debug('Generated new fingerprint', { workspaceId });

    return fingerprint;
  }

  /**
   * Generate a realistic browser fingerprint
   */
  private generateFingerprint(): BrowserFingerprint {
    // Common Chrome versions
    const chromeVersions = ['131.0.0.0', '130.0.0.0', '129.0.0.0'];
    const chromeVersion = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];

    // Common resolutions
    const resolutions = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 2560, height: 1440 },
    ];
    const resolution = resolutions[Math.floor(Math.random() * resolutions.length)];

    // Common hardware configurations
    const hardwareConfigs = [
      { cores: 4, memory: 8 },
      { cores: 8, memory: 16 },
      { cores: 6, memory: 16 },
      { cores: 4, memory: 16 },
      { cores: 8, memory: 32 },
    ];
    const hardware = hardwareConfigs[Math.floor(Math.random() * hardwareConfigs.length)];

    // Common WebGL renderers
    const webglRenderers = [
      { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
      { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1060/PCIe/SSE2' },
      { vendor: 'AMD', renderer: 'AMD Radeon RX 580' },
      { vendor: 'Intel Inc.', renderer: 'Intel UHD Graphics 620' },
    ];
    const webgl = webglRenderers[Math.floor(Math.random() * webglRenderers.length)];

    // Common timezones
    const timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Phoenix',
    ];
    const timezone = timezones[Math.floor(Math.random() * timezones.length)];

    return {
      userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      viewport: {
        width: resolution.width,
        height: resolution.height,
      },
      screen: {
        width: resolution.width,
        height: resolution.height,
        colorDepth: 24,
        pixelRatio: 1,
      },
      navigator: {
        platform: 'Win32',
        language: 'en-US',
        languages: ['en-US', 'en'],
        hardwareConcurrency: hardware.cores,
        deviceMemory: hardware.memory,
      },
      timezone,
      webgl,
    };
  }

  /**
   * Apply fingerprint to browser context
   */
  async applyToContext(context: BrowserContext, workspaceId: string): Promise<void> {
    const fingerprint = this.getFingerprint(workspaceId);

    // Apply fingerprint properties via init script
    await context.addInitScript((fp: BrowserFingerprint) => {
      // Override navigator properties
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => fp.navigator.hardwareConcurrency,
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => fp.navigator.deviceMemory,
      });

      Object.defineProperty(navigator, 'platform', {
        get: () => fp.navigator.platform,
      });

      Object.defineProperty(navigator, 'language', {
        get: () => fp.navigator.language,
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => fp.navigator.languages,
      });

      // Override screen properties
      Object.defineProperty(screen, 'width', {
        get: () => fp.screen.width,
      });

      Object.defineProperty(screen, 'height', {
        get: () => fp.screen.height,
      });

      Object.defineProperty(screen, 'colorDepth', {
        get: () => fp.screen.colorDepth,
      });

      Object.defineProperty(window, 'devicePixelRatio', {
        get: () => fp.screen.pixelRatio,
      });

      // Override WebGL
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
        if (parameter === 37445) return fp.webgl.vendor;
        if (parameter === 37446) return fp.webgl.renderer;
        return getParameter.call(this, parameter);
      };
    }, fingerprint);

    logger.debug('Applied fingerprint to context', { workspaceId });
  }

  /**
   * Mark fingerprint as burned (detected)
   */
  burnFingerprint(workspaceId: string): void {
    this.db.prepare(
      'UPDATE fingerprints SET is_burned = 1 WHERE workspace_id = ?'
    ).run(workspaceId);

    this.fingerprintCache.delete(workspaceId);
    logger.info('Burned fingerprint', { workspaceId });
  }

  /**
   * Rotate old fingerprints
   */
  rotateOldFingerprints(daysOld: number = APP_CONFIG.FINGERPRINT_ROTATION_DAYS): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = this.db.prepare(`
      UPDATE fingerprints 
      SET is_burned = 1 
      WHERE last_used < ? AND is_burned = 0
    `).run(cutoffDate.toISOString());

    this.fingerprintCache.clear();
    logger.info('Rotated old fingerprints', { count: result.changes, daysOld });

    return result.changes;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    this.fingerprintCache.clear();
  }
}
