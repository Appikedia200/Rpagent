/**
 * @fileoverview Workspace Service
 * @module electron/services/workspace
 *
 * Business logic for workspace management operations.
 * Handles creation, updates, and status management.
 */

import { 
  WorkspaceRepository 
} from '../database/repositories/workspace.repository';
import { 
  Workspace, 
  WorkspaceStatus,
  CreateWorkspaceInput, 
  UpdateWorkspaceInput,
  BulkCreateWorkspaceInput,
} from '../../shared/types/workspace.types';
import { 
  validateInput, 
  CreateWorkspaceInputSchema,
  BulkCreateWorkspaceInputSchema,
  ValidationError,
} from '../../shared/utils/validators';
import { logger } from '../utils/logger';

/**
 * Service error class
 */
export class WorkspaceServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'WorkspaceServiceError';
  }
}

/**
 * Workspace management service
 */
export class WorkspaceService {
  private repository: WorkspaceRepository;

  constructor() {
    this.repository = new WorkspaceRepository();
  }

  /**
   * Get all available (unassigned) proxies based on current settings
   */
  async getAvailableProxies(): Promise<any[]> {
    try {
      const { getSettingsService } = require('./settings.service');
      const { ProxyRepository } = require('../database/repositories/proxy.repository');
      const { ProxyType } = require('../../shared/types/proxy.types');
      
      const settingsService = getSettingsService();
      const proxyRepo = new ProxyRepository();
      
      const proxyMode = settingsService.get('proxyMode') || 'static';
      const targetType = proxyMode === 'static' ? ProxyType.STATIC : ProxyType.RESIDENTIAL;
      
      // Get proxies by type that are not assigned
      let proxies = proxyRepo.findByType(targetType)
        .filter((p: any) => !p.assignedToWorkspace);
      
      // If none found by type, try all unassigned proxies
      if (proxies.length === 0) {
        proxies = proxyRepo.findAll()
          .filter((p: any) => !p.assignedToWorkspace);
      }
      
      logger.info('Available proxies for allocation', {
        mode: proxyMode,
        targetType,
        available: proxies.length,
        proxies: proxies.map((p: any) => ({ id: p.id, host: p.host, type: p.type })),
      });
      
      return proxies;
    } catch (error) {
      logger.error('Failed to get available proxies', { error });
      return [];
    }
  }

  /**
   * Create a single workspace with a specific proxy (GUARANTEED proxy assignment)
   */
  async createWithProxy(name: string, proxy: any): Promise<Workspace> {
    try {
      logger.info('Creating workspace with dedicated proxy', { 
        name, 
        proxyId: proxy.id, 
        proxyHost: proxy.host,
      });

      // Create workspace with proxy
      const workspace = this.repository.create({
        name,
        proxyId: proxy.id,
      });

      // Mark proxy as assigned
      this.markProxyAsAssigned(proxy.id, workspace.id);

      logger.info('Workspace created with dedicated proxy', { 
        workspaceId: workspace.id,
        proxyId: proxy.id,
        proxyHost: proxy.host,
      });

      return workspace;
    } catch (error) {
      logger.error('Failed to create workspace with proxy', { error, name, proxyId: proxy.id });
      throw new WorkspaceServiceError(
        'Failed to create workspace with proxy',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create multiple workspaces with specific proxies (one proxy per workspace)
   */
  async createBulkWithProxies(count: number, proxies: any[], namePrefix: string = 'WS'): Promise<Workspace[]> {
    try {
      if (proxies.length < count) {
        throw new Error(`Not enough proxies: need ${count}, have ${proxies.length}`);
      }

      logger.info('Creating workspaces with dedicated proxies', { 
        count, 
        proxiesAvailable: proxies.length,
      });

      const workspaces: Workspace[] = [];
      
      for (let i = 0; i < count; i++) {
        const workspace = this.repository.create({
          name: `${namePrefix} ${Date.now()}-${i + 1}`,
          proxyId: proxies[i].id,
        });
        
        // Mark proxy as assigned
        this.markProxyAsAssigned(proxies[i].id, workspace.id);
        
        workspaces.push(workspace);
        
        logger.info('Created workspace with proxy', {
          index: i + 1,
          workspaceId: workspace.id,
          proxyId: proxies[i].id,
          proxyHost: proxies[i].host,
        });
      }

      return workspaces;
    } catch (error) {
      logger.error('Failed to create bulk workspaces with proxies', { error, count });
      throw new WorkspaceServiceError(
        'Failed to create workspaces with proxies',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a new workspace with AUTO proxy allocation
   * REQUIRES a proxy - will throw error if none available
   */
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    try {
      logger.info('Creating workspace', { name: input.name, inputProxyId: input.proxyId });

      // Validate input
      const validated = validateInput(
        CreateWorkspaceInputSchema,
        input,
        'CreateWorkspaceInput'
      ) as CreateWorkspaceInput;

      // Get or find proxy - MUST have a proxy
      let proxyIdToAssign: string;
      let proxyHost: string;
      
      if (validated.proxyId) {
        proxyIdToAssign = validated.proxyId;
        proxyHost = 'specified';
      } else {
        // Find an available proxy
        const availableProxies = await this.getAvailableProxies();
        
        if (availableProxies.length === 0) {
          throw new WorkspaceServiceError(
            'No proxies available! Please add proxies before creating browsers.'
          );
        }
        
        proxyIdToAssign = availableProxies[0].id;
        proxyHost = availableProxies[0].host;
      }

      // Create workspace with proxy
      const workspace = this.repository.create({
        ...validated,
        proxyId: proxyIdToAssign,
      });

      // Mark proxy as assigned
      this.markProxyAsAssigned(proxyIdToAssign, workspace.id);

      logger.info('Workspace created with proxy', { 
        workspaceId: workspace.id,
        name: workspace.name,
        proxyId: proxyIdToAssign,
        proxyHost,
      });

      return workspace;
    } catch (error) {
      logger.error('Failed to create workspace', { error, input });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (error instanceof WorkspaceServiceError) {
        throw error;
      }

      throw new WorkspaceServiceError(
        'Failed to create workspace',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Mark a proxy as assigned to a workspace
   */
  private markProxyAsAssigned(proxyId: string, workspaceId: string): void {
    try {
      const { ProxyRepository } = require('../database/repositories/proxy.repository');
      const proxyRepo = new ProxyRepository();
      proxyRepo.assignToWorkspace(proxyId, workspaceId);
      logger.info('Proxy marked as assigned', { proxyId, workspaceId });
    } catch (e) {
      logger.error('Failed to mark proxy as assigned', { error: e, proxyId, workspaceId });
    }
  }

  /**
   * Create multiple workspaces
   */
  async createBulk(input: BulkCreateWorkspaceInput): Promise<Workspace[]> {
    try {
      logger.info('Creating workspaces in bulk', { count: input.count });

      // Validate input
      const validated = validateInput(
        BulkCreateWorkspaceInputSchema,
        input,
        'BulkCreateWorkspaceInput'
      );

      // Create workspaces
      const workspaces = this.repository.createBulk(
        validated.count,
        validated.namePrefix,
        validated.proxyId
      );

      logger.info('Bulk workspace creation completed', { 
        count: workspaces.length,
      });

      return workspaces;
    } catch (error) {
      logger.error('Failed to create workspaces in bulk', { error, input });
      
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new WorkspaceServiceError(
        'Failed to create workspaces',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all workspaces (enriched with proxy IP info)
   */
  async getAll(): Promise<Workspace[]> {
    try {
      const workspaces = this.repository.findAll();
      
      // Enrich with proxy IP info
      const { ProxyRepository } = require('../database/repositories/proxy.repository');
      const proxyRepo = new ProxyRepository();
      
      return workspaces.map(ws => {
        if (ws.proxyId) {
          const proxy = proxyRepo.findById(ws.proxyId);
          if (proxy) {
            return {
              ...ws,
              proxyIp: `${proxy.host}:${proxy.port}`,
              proxyLocked: proxy.isLocked,
            };
          }
        }
        return ws;
      });
    } catch (error) {
      logger.error('Failed to get workspaces', { error });
      throw new WorkspaceServiceError(
        'Failed to get workspaces',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get workspace by ID
   */
  async getById(id: string): Promise<Workspace | null> {
    try {
      return this.repository.findById(id);
    } catch (error) {
      logger.error('Failed to get workspace', { error, id });
      throw new WorkspaceServiceError(
        'Failed to get workspace',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update workspace
   */
  async update(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {
    try {
      logger.info('Updating workspace', { workspaceId: id });

      const workspace = this.repository.update(id, input);

      logger.info('Workspace updated', { workspaceId: id });

      return workspace;
    } catch (error) {
      logger.error('Failed to update workspace', { error, id });
      throw new WorkspaceServiceError(
        'Failed to update workspace',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update workspace status
   */
  async updateStatus(id: string, status: WorkspaceStatus): Promise<void> {
    try {
      this.repository.updateStatus(id, status);
      logger.debug('Workspace status updated', { workspaceId: id, status });
    } catch (error) {
      logger.error('Failed to update workspace status', { error, id, status });
      throw new WorkspaceServiceError(
        'Failed to update workspace status',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete workspace
   */
  async delete(id: string): Promise<boolean> {
    try {
      logger.info('Deleting workspace', { workspaceId: id });

      const deleted = this.repository.delete(id);

      if (deleted) {
        logger.info('Workspace deleted', { workspaceId: id });
      } else {
        logger.warn('Workspace not found for deletion', { workspaceId: id });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete workspace', { error, id });
      throw new WorkspaceServiceError(
        'Failed to delete workspace',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get workspace count
   */
  async count(): Promise<number> {
    try {
      return this.repository.count();
    } catch (error) {
      logger.error('Failed to count workspaces', { error });
      throw new WorkspaceServiceError(
        'Failed to count workspaces',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get active workspace count
   */
  async countActive(): Promise<number> {
    try {
      return this.repository.countActive();
    } catch (error) {
      logger.error('Failed to count active workspaces', { error });
      throw new WorkspaceServiceError(
        'Failed to count active workspaces',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Assign a static proxy to a workspace (permanent assignment)
   */
  async assignProxy(workspaceId: string, proxyId: string): Promise<Workspace> {
    try {
      logger.info('Assigning proxy to workspace', { workspaceId, proxyId });

      // Update workspace with proxy
      const workspace = this.repository.update(workspaceId, { proxyId });
      
      // Also update the proxy to mark it as assigned (lock it)
      try {
        const { ProxyRepository } = require('../database/repositories/proxy.repository');
        const proxyRepo = new ProxyRepository();
        proxyRepo.assignToWorkspace(proxyId, workspaceId);
      } catch (e) {
        logger.warn('Could not update proxy assignment', { error: e });
      }

      logger.info('Proxy assigned to workspace', { workspaceId, proxyId });
      return workspace;
    } catch (error) {
      logger.error('Failed to assign proxy', { error, workspaceId, proxyId });
      throw new WorkspaceServiceError(
        'Failed to assign proxy to workspace',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Remove proxy assignment from workspace
   */
  async unassignProxy(workspaceId: string): Promise<Workspace> {
    try {
      logger.info('Unassigning proxy from workspace', { workspaceId });

      // Get current workspace to find assigned proxy
      const current = this.repository.findById(workspaceId);
      const oldProxyId = current?.proxyId;

      // Update workspace to remove proxy
      const workspace = this.repository.update(workspaceId, { proxyId: undefined });
      
      // Also update the proxy to unmark it
      if (oldProxyId) {
        try {
          const { ProxyRepository } = require('../database/repositories/proxy.repository');
          const proxyRepo = new ProxyRepository();
          proxyRepo.unassignFromWorkspace(oldProxyId);
        } catch (e) {
          logger.warn('Could not update proxy unassignment', { error: e });
        }
      }

      logger.info('Proxy unassigned from workspace', { workspaceId });
      return workspace;
    } catch (error) {
      logger.error('Failed to unassign proxy', { error, workspaceId });
      throw new WorkspaceServiceError(
        'Failed to unassign proxy from workspace',
        error instanceof Error ? error : undefined
      );
    }
  }
}
