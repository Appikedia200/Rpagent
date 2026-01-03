/**
 * @fileoverview Workspace Repository
 * @module electron/database/repositories/workspace
 *
 * Handles all database operations for Workspace entities.
 * Implements CRUD operations with comprehensive error handling.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, RepositoryError } from './base.repository';
import {
  Workspace,
  WorkspaceStatus,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from '../../../shared/types/workspace.types';
import { APP_CONFIG } from '../../../shared/constants/app-config';

/**
 * Database row type for workspace
 */
interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  proxy_id: string | null;
  profile_id: string | null;
  fingerprint_id: string | null;
  initial_url: string | null;
  viewport_width: number;
  viewport_height: number;
  user_agent: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
  last_active_at: string | null;
}

/**
 * Repository for workspace database operations
 */
export class WorkspaceRepository extends BaseRepository<Workspace> {
  constructor() {
    super('workspaces', 'Workspace');
  }

  /**
   * Create a new workspace with auto-generated fingerprint
   */
  create(input: CreateWorkspaceInput): Workspace {
    return this.execute('create', () => {
      const id = uuidv4();
      const fingerprintId = uuidv4(); // Generate unique fingerprint ID
      const now = this.now();

      this.prepareStatement(`
        INSERT INTO workspaces (
          id, name, description, status, proxy_id, profile_id, fingerprint_id,
          initial_url, viewport_width, viewport_height, user_agent,
          tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.name,
        input.description ?? null,
        WorkspaceStatus.IDLE,
        input.proxyId ?? null,
        input.profileId ?? null,
        fingerprintId, // Each workspace gets a unique fingerprint
        input.initialUrl ?? null,
        input.viewport?.width ?? APP_CONFIG.DEFAULT_VIEWPORT_WIDTH,
        input.viewport?.height ?? APP_CONFIG.DEFAULT_VIEWPORT_HEIGHT,
        input.userAgent ?? null,
        JSON.stringify(input.tags ?? []),
        now,
        now
      );

      const created = this.findById(id);
      if (!created) {
        throw new RepositoryError(
          'Failed to retrieve created workspace',
          'Workspace',
          'create'
        );
      }

      return created;
    }, { name: input.name });
  }

  /**
   * Create multiple workspaces
   */
  createBulk(count: number, prefix?: string, proxyId?: string): Workspace[] {
    return this.execute('createBulk', () => {
      return this.transaction(() => {
        const workspaces: Workspace[] = [];
        const namePrefix = prefix ?? 'Workspace';

        for (let i = 1; i <= count; i++) {
          const workspace = this.create({
            name: `${namePrefix} ${i}`,
            proxyId,
          });
          workspaces.push(workspace);
        }

        return workspaces;
      });
    }, { count });
  }

  /**
   * Find workspace by ID
   */
  findById(id: string): Workspace | null {
    return this.execute('findById', () => {
      const row = this.prepareStatement(
        'SELECT * FROM workspaces WHERE id = ?'
      ).get(id) as WorkspaceRow | undefined;

      return row ? this.mapRowToEntity(row) : null;
    }, { id });
  }

  /**
   * Find all workspaces
   */
  findAll(): Workspace[] {
    return this.execute('findAll', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM workspaces ORDER BY created_at DESC'
      ).all() as WorkspaceRow[];

      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find workspaces by status
   */
  findByStatus(status: WorkspaceStatus): Workspace[] {
    return this.execute('findByStatus', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM workspaces WHERE status = ? ORDER BY created_at DESC'
      ).all(status) as WorkspaceRow[];

      return rows.map(row => this.mapRowToEntity(row));
    }, { status });
  }

  /**
   * Update workspace
   */
  update(id: string, input: UpdateWorkspaceInput): Workspace {
    return this.execute('update', () => {
      const updates: string[] = ['updated_at = ?'];
      const values: unknown[] = [this.now()];

      if (input.name !== undefined) {
        updates.push('name = ?');
        values.push(input.name);
      }
      if (input.description !== undefined) {
        updates.push('description = ?');
        values.push(input.description);
      }
      if (input.status !== undefined) {
        updates.push('status = ?');
        values.push(input.status);
      }
      if (input.proxyId !== undefined) {
        updates.push('proxy_id = ?');
        values.push(input.proxyId);
      }
      if (input.profileId !== undefined) {
        updates.push('profile_id = ?');
        values.push(input.profileId);
      }
      if (input.initialUrl !== undefined) {
        updates.push('initial_url = ?');
        values.push(input.initialUrl);
      }
      if (input.viewport !== undefined) {
        updates.push('viewport_width = ?', 'viewport_height = ?');
        values.push(input.viewport.width, input.viewport.height);
      }
      if (input.userAgent !== undefined) {
        updates.push('user_agent = ?');
        values.push(input.userAgent);
      }
      if (input.tags !== undefined) {
        updates.push('tags = ?');
        values.push(JSON.stringify(input.tags));
      }

      values.push(id);

      this.prepareStatement(
        `UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`
      ).run(...values);

      const updated = this.findById(id);
      if (!updated) {
        throw new RepositoryError(
          'Workspace not found after update',
          'Workspace',
          'update'
        );
      }

      return updated;
    }, { id });
  }

  /**
   * Update workspace status
   */
  updateStatus(id: string, status: WorkspaceStatus): void {
    this.execute('updateStatus', () => {
      const updates = ['status = ?', 'updated_at = ?'];
      const values = [status, this.now()];

      if (status === WorkspaceStatus.ACTIVE) {
        updates.push('last_active_at = ?');
        values.push(this.now());
      }

      values.push(id);

      this.prepareStatement(
        `UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`
      ).run(...values);
    }, { id, status });
  }

  /**
   * Delete workspace
   */
  delete(id: string): boolean {
    return this.execute('delete', () => {
      const result = this.prepareStatement(
        'DELETE FROM workspaces WHERE id = ?'
      ).run(id);

      return result.changes > 0;
    }, { id });
  }

  /**
   * Count workspaces
   */
  count(): number {
    return this.execute('count', () => {
      const result = this.prepareStatement(
        'SELECT COUNT(*) as count FROM workspaces'
      ).get() as { count: number };

      return result.count;
    });
  }

  /**
   * Count active workspaces
   */
  countActive(): number {
    return this.execute('countActive', () => {
      const result = this.prepareStatement(
        'SELECT COUNT(*) as count FROM workspaces WHERE status = ?'
      ).get(WorkspaceStatus.ACTIVE) as { count: number };

      return result.count;
    });
  }

  /**
   * Map database row to Workspace entity
   */
  protected mapRowToEntity(row: unknown): Workspace {
    const r = row as WorkspaceRow;
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      status: r.status as WorkspaceStatus,
      proxyId: r.proxy_id ?? undefined,
      profileId: r.profile_id ?? undefined,
      fingerprintId: r.fingerprint_id ?? undefined,
      initialUrl: r.initial_url ?? undefined,
      viewport: {
        width: r.viewport_width,
        height: r.viewport_height,
      },
      userAgent: r.user_agent ?? undefined,
      tags: JSON.parse(r.tags) as string[],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastActiveAt: r.last_active_at ?? undefined,
    };
  }
}
