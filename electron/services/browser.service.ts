/**
 * @fileoverview Browser Service
 * @module electron/services/browser
 *
 * Business logic for browser automation operations.
 * Handles browser launching, closing, and management.
 */

import { browserPool, ActiveBrowserInfo } from '../../automation/browser-manager';
import { WorkspaceRepository } from '../database/repositories/workspace.repository';
import { ProxyRepository } from '../database/repositories/proxy.repository';
import { WorkspaceStatus } from '../../shared/types/workspace.types';
import { Proxy } from '../../shared/types/proxy.types';
import { APP_CONFIG } from '../../shared/constants/app-config';
import { logger } from '../utils/logger';

/**
 * Browser service error
 */
export class BrowserServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'BrowserServiceError';
  }
}

/**
 * Browser management service
 */
export class BrowserService {
  private workspaceRepo: WorkspaceRepository;
  private proxyRepo: ProxyRepository;

  constructor() {
    this.workspaceRepo = new WorkspaceRepository();
    this.proxyRepo = new ProxyRepository();
  }

  /**
   * Launch browser for workspace
   */
  async launch(workspaceId: string): Promise<void> {
    try {
      logger.info('BrowserService: Starting browser launch', { workspaceId });

      // Get workspace FRESH from database
      const workspace = this.workspaceRepo.findById(workspaceId);
      if (!workspace) {
        throw new BrowserServiceError(`Workspace not found: ${workspaceId}`);
      }

      logger.info('BrowserService: Workspace loaded', { 
        workspaceId, 
        workspaceName: workspace.name,
        proxyId: workspace.proxyId,
        hasProxyAssigned: !!workspace.proxyId,
      });

      // Get proxy if assigned
      let proxy: Proxy | undefined;
      if (workspace.proxyId) {
        proxy = this.proxyRepo.findById(workspace.proxyId) ?? undefined;
        logger.info('BrowserService: Proxy loaded', { 
          proxyId: workspace.proxyId,
          proxyFound: !!proxy,
          proxyDetails: proxy ? { host: proxy.host, port: proxy.port, protocol: proxy.protocol } : null,
        });
      } else {
        logger.warn('BrowserService: No proxy assigned to workspace', { workspaceId });
      }

      // Update workspace status
      this.workspaceRepo.updateStatus(workspaceId, WorkspaceStatus.LOADING);

      // Launch browser WITH proxy
      logger.info('BrowserService: Calling browserPool.launch', { 
        workspaceId, 
        hasProxy: !!proxy,
        proxyHost: proxy?.host,
      });
      await browserPool.launch(workspace, proxy);

      // Update workspace status
      this.workspaceRepo.updateStatus(workspaceId, WorkspaceStatus.ACTIVE);

      logger.info('BrowserService: Browser launched successfully', { 
        workspaceId,
        usedProxy: !!proxy,
        proxyHost: proxy?.host,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('BrowserService: Failed to launch browser', { 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        workspaceId 
      });

      // Update workspace status to error
      try {
        this.workspaceRepo.updateStatus(workspaceId, WorkspaceStatus.ERROR);
      } catch {
        // Ignore status update error
      }

      // Pass through the ACTUAL error message, not a generic one
      throw new BrowserServiceError(
        errorMessage || 'Failed to launch browser',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Launch browsers for multiple workspaces in batches
   * Uses batch processing to avoid overwhelming system resources
   */
  async launchMultiple(workspaceIds: string[]): Promise<{ launched: number; failed: number; batches: number; errors: string[] }> {
    const batchSize = APP_CONFIG.BATCH_SIZE || 20;
    const batchDelay = APP_CONFIG.BATCH_DELAY || 3000;
    const totalBatches = Math.ceil(workspaceIds.length / batchSize);
    
    let launched = 0;
    let failed = 0;
    const errors: string[] = [];

    logger.info('Starting batch browser launch', {
      total: workspaceIds.length,
      batchSize,
      totalBatches,
    });

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const batchStart = batchNum * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, workspaceIds.length);
      const batchIds = workspaceIds.slice(batchStart, batchEnd);

      logger.info(`Launching batch ${batchNum + 1}/${totalBatches}`, {
        batchSize: batchIds.length,
      });

      // Launch browsers in this batch in parallel
      const launchPromises = batchIds.map(async (id) => {
        try {
          await this.launch(id);
          return { success: true, id, error: null };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Failed to launch browser for workspace', { 
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            workspaceId: id 
          });
          return { success: false, id, error: errorMessage };
        }
      });

      const results = await Promise.all(launchPromises);
      launched += results.filter(r => r.success).length;
      failed += results.filter(r => !r.success).length;
      
      // Collect error messages
      results.filter(r => !r.success && r.error).forEach(r => {
        errors.push(r.error as string);
      });

      // Wait between batches
      if (batchNum < totalBatches - 1) {
        logger.info(`Waiting ${batchDelay}ms before next batch`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    logger.info('Batch browser launch completed', { 
      launched, 
      failed, 
      batches: totalBatches,
      errors,
    });
    
    return { launched, failed, batches: totalBatches, errors };
  }

  /**
   * Close browser for workspace
   */
  async close(workspaceId: string): Promise<void> {
    try {
      logger.info('Closing browser', { workspaceId });

      await browserPool.close(workspaceId);

      // Update workspace status
      this.workspaceRepo.updateStatus(workspaceId, WorkspaceStatus.IDLE);

      logger.info('Browser closed', { workspaceId });
    } catch (error) {
      logger.error('Failed to close browser', { error, workspaceId });
      throw new BrowserServiceError(
        'Failed to close browser',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Close all browsers
   */
  async closeAll(): Promise<void> {
    try {
      logger.info('Closing all browsers');

      // Get all active workspace IDs before closing
      const activeBrowsers = browserPool.getAllActive();
      const workspaceIds = activeBrowsers.map(b => b.workspaceId);

      await browserPool.closeAll();

      // Update all workspace statuses
      for (const id of workspaceIds) {
        try {
          this.workspaceRepo.updateStatus(id, WorkspaceStatus.IDLE);
        } catch {
          // Ignore individual status update errors
        }
      }

      logger.info('All browsers closed');
    } catch (error) {
      logger.error('Failed to close all browsers', { error });
      throw new BrowserServiceError(
        'Failed to close all browsers',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all active browsers
   */
  async getAllActive(): Promise<ActiveBrowserInfo[]> {
    try {
      return browserPool.getAllActive();
    } catch (error) {
      logger.error('Failed to get active browsers', { error });
      throw new BrowserServiceError(
        'Failed to get active browsers',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Navigate browser to URL
   */
  async navigate(workspaceId: string, url: string): Promise<void> {
    try {
      const browser = browserPool.get(workspaceId);
      if (!browser) {
        throw new BrowserServiceError(`No browser found for workspace: ${workspaceId}`);
      }

      await browser.navigate(url);

      logger.debug('Browser navigated', { workspaceId, url });
    } catch (error) {
      logger.error('Failed to navigate browser', { error, workspaceId, url });
      throw new BrowserServiceError(
        'Failed to navigate browser',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(workspaceId: string, path?: string): Promise<Buffer> {
    try {
      const browser = browserPool.get(workspaceId);
      if (!browser) {
        throw new BrowserServiceError(`No browser found for workspace: ${workspaceId}`);
      }

      const buffer = await browser.screenshot(path);

      logger.debug('Screenshot taken', { workspaceId, path });
      return buffer;
    } catch (error) {
      logger.error('Failed to take screenshot', { error, workspaceId });
      throw new BrowserServiceError(
        'Failed to take screenshot',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get active browser count
   */
  getActiveBrowserCount(): number {
    return browserPool.getCount();
  }

  /**
   * Check if browser pool has available slots
   */
  hasAvailableSlots(): boolean {
    return browserPool.hasAvailableSlots();
  }

  /**
   * Get available slot count
   */
  getAvailableSlots(): number {
    return browserPool.getAvailableSlots();
  }
}
