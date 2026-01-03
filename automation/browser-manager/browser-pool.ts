/**
 * @fileoverview Browser Pool Management
 * @module automation/browser-manager/browser-pool
 *
 * Manages a pool of browser instances for parallel automation.
 * Handles launching, closing, and retrieving browsers for workspaces.
 */

import { BrowserInstance } from './browser-instance';
import { Workspace } from '../../shared/types/workspace.types';
import { Proxy } from '../../shared/types/proxy.types';
import { logger } from '../../electron/utils/logger';
import { APP_CONFIG } from '../../shared/constants/app-config';

/**
 * Active browser information
 */
export interface ActiveBrowserInfo {
  workspaceId: string;
  workspaceName: string;
  status: 'active' | 'idle' | 'loading' | 'error';
  currentUrl: string | null;
  launchedAt: string;
  realFingerprintHash: string | null; // Real fingerprint hash from actual browser
}

/**
 * Browser pool error class
 */
export class BrowserPoolError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'BrowserPoolError';
  }
}

/**
 * Browser pool for managing multiple browser instances
 */
export class BrowserPool {
  private browsers: Map<string, BrowserInstance> = new Map();
  private launchTimes: Map<string, string> = new Map();
  private readonly maxBrowsers: number;

  constructor(maxBrowsers: number = APP_CONFIG.MAX_BROWSERS) {
    this.maxBrowsers = maxBrowsers;
  }

  /**
   * Launch a browser for a workspace
   */
  async launch(workspace: Workspace, proxy?: Proxy): Promise<BrowserInstance> {
    const startTime = Date.now();

    try {
      // Check if already launched
      if (this.browsers.has(workspace.id)) {
        const existing = this.browsers.get(workspace.id)!;
        const state = existing.getState();
        
        // Get existing browser's proxy info
        const existingProxyId = existing.proxyId;
        const newProxyId = proxy?.id;
        
        logger.debug('Browser exists check', { 
          workspaceId: workspace.id, 
          state, 
          isLaunched: existing.isLaunched(),
          existingProxyId,
          newProxyId,
          proxyChanged: existingProxyId !== newProxyId,
        });
        
        // If proxy has changed, we need to close and relaunch
        if (existingProxyId !== newProxyId) {
          logger.info('Proxy configuration changed, closing existing browser and relaunching', {
            workspaceId: workspace.id,
            oldProxyId: existingProxyId,
            newProxyId: newProxyId,
          });
          
          try {
            await existing.close();
          } catch (closeError) {
            logger.warn('Error closing existing browser', { error: closeError });
          }
          
          this.browsers.delete(workspace.id);
          this.launchTimes.delete(workspace.id);
          // Continue to launch new browser with new proxy
        } else if (state === 'active' || existing.isLaunched()) {
          logger.info('Browser already launched for workspace with same proxy, returning existing', {
            workspaceId: workspace.id,
            proxyId: existingProxyId,
          });
          return existing;
        } else if (state === 'error' || state === 'closed') {
          // Only remove if in error or closed state
          logger.debug('Removing stale browser reference', { workspaceId: workspace.id, state });
          this.browsers.delete(workspace.id);
        } else {
          // Browser is launching or in another state, wait
          logger.debug('Browser in transitional state', { workspaceId: workspace.id, state });
          return existing;
        }
      }

      // Check pool capacity
      if (this.browsers.size >= this.maxBrowsers) {
        throw new BrowserPoolError(
          `Maximum browser limit reached (${this.maxBrowsers})`
        );
      }

      logger.info('BrowserPool: Launching browser', {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        poolSize: this.browsers.size,
        hasProxy: !!proxy,
        proxyDetails: proxy ? { 
          id: proxy.id,
          host: proxy.host, 
          port: proxy.port, 
          protocol: proxy.protocol, 
          type: proxy.type,
          hasAuth: !!(proxy.username && proxy.password),
        } : 'NO PROXY',
      });

      if (!proxy) {
        logger.warn('BrowserPool: NO PROXY will be used for this browser!', {
          workspaceId: workspace.id,
          workspaceProxyId: workspace.proxyId,
        });
      }

      // Create and launch browser WITH proxy
      const browser = new BrowserInstance(workspace, proxy);
      
      try {
        await browser.launch();
      } catch (launchError) {
        logger.error('Browser launch failed in pool', {
          workspaceId: workspace.id,
          hasProxy: !!proxy,
          proxyHost: proxy?.host,
          error: launchError instanceof Error ? launchError.message : launchError,
        });
        throw launchError;
      }

      // Store in pool
      this.browsers.set(workspace.id, browser);
      this.launchTimes.set(workspace.id, new Date().toISOString());

      const duration = Date.now() - startTime;
      logger.info('Browser added to pool', {
        workspaceId: workspace.id,
        poolSize: this.browsers.size,
        duration,
      });

      return browser;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to launch browser in pool', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        workspaceId: workspace.id,
        duration,
      });

      // Pass through the ACTUAL error message
      throw new BrowserPoolError(
        errorMessage || 'Failed to launch browser',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Close a browser by workspace ID
   */
  async close(workspaceId: string): Promise<void> {
    const browser = this.browsers.get(workspaceId);
    if (!browser) {
      logger.debug('No browser found for workspace', { workspaceId });
      return;
    }

    try {
      await browser.close();
      this.browsers.delete(workspaceId);
      this.launchTimes.delete(workspaceId);

      logger.info('Browser removed from pool', {
        workspaceId,
        poolSize: this.browsers.size,
      });
    } catch (error) {
      logger.error('Error closing browser', { error, workspaceId });
      // Remove from pool even on error
      this.browsers.delete(workspaceId);
      this.launchTimes.delete(workspaceId);
    }
  }

  /**
   * Close all browsers
   */
  async closeAll(): Promise<void> {
    logger.info('Closing all browsers', { count: this.browsers.size });

    const closePromises = Array.from(this.browsers.values()).map(browser =>
      browser.close().catch(error => {
        logger.error('Error closing browser during closeAll', { error });
      })
    );

    await Promise.all(closePromises);
    this.browsers.clear();
    this.launchTimes.clear();

    logger.info('All browsers closed');
  }

  /**
   * Get browser by workspace ID
   */
  get(workspaceId: string): BrowserInstance | undefined {
    return this.browsers.get(workspaceId);
  }

  /**
   * Get all browser instances
   */
  getAll(): BrowserInstance[] {
    return Array.from(this.browsers.values());
  }

  /**
   * Get all active browser information
   */
  getAllActive(): ActiveBrowserInfo[] {
    return Array.from(this.browsers.entries()).map(([id, browser]) => {
      let status: 'active' | 'idle' | 'loading' | 'error' = 'idle';
      const state = browser.getState();

      if (state === 'active') status = 'active';
      else if (state === 'launching') status = 'loading';
      else if (state === 'error') status = 'error';

      return {
        workspaceId: id,
        workspaceName: browser.workspace.name,
        status,
        currentUrl: browser.getCurrentUrl(),
        launchedAt: this.launchTimes.get(id) ?? new Date().toISOString(),
        realFingerprintHash: browser.getRealFingerprintHash() || null,
      };
    });
  }

  /**
   * Get number of active browsers
   */
  getCount(): number {
    return this.browsers.size;
  }

  /**
   * Check if pool has available slots
   */
  hasAvailableSlots(): boolean {
    return this.browsers.size < this.maxBrowsers;
  }

  /**
   * Get available slot count
   */
  getAvailableSlots(): number {
    return this.maxBrowsers - this.browsers.size;
  }

  /**
   * Check if a browser exists for workspace
   */
  has(workspaceId: string): boolean {
    return this.browsers.has(workspaceId);
  }
}

/**
 * Singleton browser pool instance
 */
export const browserPool = new BrowserPool();
