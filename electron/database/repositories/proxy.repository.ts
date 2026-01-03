/**
 * @fileoverview Proxy Repository
 * @module electron/database/repositories/proxy
 *
 * Handles all database operations for Proxy entities.
 * Implements CRUD operations with comprehensive error handling.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, RepositoryError } from './base.repository';
import {
  Proxy,
  ProxyStatus,
  ProxyProtocol,
  ProxyType,
  CreateProxyInput,
} from '../../../shared/types/proxy.types';

/**
 * Extended create input with type
 */
export interface CreateProxyInputWithType extends CreateProxyInput {
  type?: ProxyType;
}

/**
 * Database row type for proxy
 */
interface ProxyRow {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  type: string;
  username: string | null;
  password: string | null;
  country: string | null;
  city: string | null;
  status: string;
  speed: number | null;
  last_tested: string | null;
  assigned_to_workspace: string | null;
  last_used: string | null;
  usage_count: number;
  is_locked: number;
  created_at: string;
}

/**
 * Repository for proxy database operations
 */
export class ProxyRepository extends BaseRepository<Proxy> {
  constructor() {
    super('proxies', 'Proxy');
  }

  /**
   * Create a new proxy
   */
  create(input: CreateProxyInputWithType): Proxy {
    return this.execute('create', () => {
      const id = uuidv4();
      const now = this.now();

      this.prepareStatement(`
        INSERT INTO proxies (
          id, name, host, port, protocol, type, username, password,
          country, city, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.name,
        input.host,
        input.port,
        input.protocol,
        input.type ?? ProxyType.STATIC, // Default to static
        input.username ?? null,
        input.password ?? null,
        input.country ?? null,
        input.city ?? null,
        ProxyStatus.UNKNOWN,
        now
      );

      const created = this.findById(id);
      if (!created) {
        throw new RepositoryError(
          'Failed to retrieve created proxy',
          'Proxy',
          'create'
        );
      }

      return created;
    }, { name: input.name, host: input.host });
  }

  /**
   * Find proxy by ID
   */
  findById(id: string): Proxy | null {
    return this.execute('findById', () => {
      const row = this.prepareStatement(
        'SELECT * FROM proxies WHERE id = ?'
      ).get(id) as ProxyRow | undefined;

      return row ? this.mapRowToEntity(row) : null;
    }, { id });
  }

  /**
   * Find all proxies
   */
  findAll(): Proxy[] {
    return this.execute('findAll', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM proxies ORDER BY created_at DESC'
      ).all() as ProxyRow[];

      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find available proxies (online and unassigned)
   */
  findAvailable(): Proxy[] {
    return this.execute('findAvailable', () => {
      const rows = this.prepareStatement(`
        SELECT * FROM proxies 
        WHERE status = ? AND assigned_to_workspace IS NULL 
        ORDER BY speed ASC NULLS LAST
      `).all(ProxyStatus.ONLINE) as ProxyRow[];

      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find proxies by status
   */
  findByStatus(status: ProxyStatus): Proxy[] {
    return this.execute('findByStatus', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM proxies WHERE status = ? ORDER BY created_at DESC'
      ).all(status) as ProxyRow[];

      return rows.map(row => this.mapRowToEntity(row));
    }, { status });
  }

  /**
   * Update proxy status and speed
   */
  updateStatus(id: string, status: ProxyStatus, speed?: number): void {
    this.execute('updateStatus', () => {
      this.prepareStatement(`
        UPDATE proxies SET status = ?, speed = ?, last_tested = ? WHERE id = ?
      `).run(status, speed ?? null, this.now(), id);
    }, { id, status, speed });
  }

  /**
   * Assign proxy to workspace
   */
  assignToWorkspace(id: string, workspaceId: string | null): void {
    this.execute('assignToWorkspace', () => {
      this.prepareStatement(`
        UPDATE proxies SET assigned_to_workspace = ?, is_locked = 1, last_used = ? WHERE id = ?
      `).run(workspaceId, this.now(), id);
    }, { id, workspaceId });
  }

  /**
   * Unassign proxy from workspace
   */
  unassignFromWorkspace(id: string): void {
    this.execute('unassignFromWorkspace', () => {
      this.prepareStatement(`
        UPDATE proxies SET assigned_to_workspace = NULL, is_locked = 0 WHERE id = ?
      `).run(id);
    }, { id });
  }

  /**
   * Delete proxy
   */
  delete(id: string): boolean {
    return this.execute('delete', () => {
      const result = this.prepareStatement(
        'DELETE FROM proxies WHERE id = ?'
      ).run(id);

      return result.changes > 0;
    }, { id });
  }

  /**
   * Bulk import proxies
   */
  bulkImport(
    proxies: Array<{
      host: string;
      port: number;
      protocol: ProxyProtocol;
      username?: string;
      password?: string;
      country?: string;
    }>
  ): { imported: number; failed: number } {
    return this.execute('bulkImport', () => {
      let imported = 0;
      let failed = 0;

      this.transaction(() => {
        for (const proxy of proxies) {
          try {
            this.create({
              name: `${proxy.host}:${proxy.port}`,
              host: proxy.host,
              port: proxy.port,
              protocol: proxy.protocol,
              username: proxy.username,
              password: proxy.password,
              country: proxy.country,
            });
            imported++;
          } catch {
            failed++;
          }
        }
      });

      return { imported, failed };
    }, { count: proxies.length });
  }

  /**
   * Count proxies
   */
  count(): number {
    return this.execute('count', () => {
      const result = this.prepareStatement(
        'SELECT COUNT(*) as count FROM proxies'
      ).get() as { count: number };

      return result.count;
    });
  }

  /**
   * Count online proxies
   */
  countOnline(): number {
    return this.execute('countOnline', () => {
      const result = this.prepareStatement(
        'SELECT COUNT(*) as count FROM proxies WHERE status = ?'
      ).get(ProxyStatus.ONLINE) as { count: number };

      return result.count;
    });
  }

  /**
   * Calculate proxy pool health percentage
   */
  getHealthPercentage(): number {
    return this.execute('getHealthPercentage', () => {
      const total = this.count();
      if (total === 0) return 0; // No proxies = 0% health (not configured yet)

      const online = this.countOnline();
      return Math.round((online / total) * 100);
    });
  }

  /**
   * Lock/unlock a proxy to a workspace
   */
  lockToWorkspace(proxyId: string, workspaceId: string, lock: boolean): void {
    this.execute('lockToWorkspace', () => {
      this.prepareStatement(`
        UPDATE proxies 
        SET assigned_to_workspace = ?, is_locked = ?, last_used = ? 
        WHERE id = ?
      `).run(lock ? workspaceId : null, lock ? 1 : 0, this.now(), proxyId);
    }, { proxyId, workspaceId, lock });
  }

  /**
   * Find proxies by type
   */
  findByType(type: ProxyType): Proxy[] {
    return this.execute('findByType', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM proxies WHERE type = ? ORDER BY created_at DESC'
      ).all(type) as ProxyRow[];

      return rows.map(row => this.mapRowToEntity(row));
    }, { type });
  }

  /**
   * Increment usage count
   */
  incrementUsage(id: string): void {
    this.execute('incrementUsage', () => {
      this.prepareStatement(`
        UPDATE proxies SET usage_count = usage_count + 1, last_used = ? WHERE id = ?
      `).run(this.now(), id);
    }, { id });
  }

  /**
   * Map database row to Proxy entity
   */
  protected mapRowToEntity(row: unknown): Proxy {
    const r = row as ProxyRow;
    return {
      id: r.id,
      name: r.name,
      host: r.host,
      port: r.port,
      protocol: r.protocol as ProxyProtocol,
      type: (r.type as ProxyType) || ProxyType.STATIC,
      username: r.username ?? undefined,
      password: r.password ?? undefined,
      country: r.country ?? undefined,
      city: r.city ?? undefined,
      status: r.status as ProxyStatus,
      speed: r.speed ?? undefined,
      lastTested: r.last_tested ?? undefined,
      assignedToWorkspace: r.assigned_to_workspace ?? undefined,
      lastUsed: r.last_used ?? undefined,
      usageCount: r.usage_count ?? 0,
      isLocked: r.is_locked === 1,
      createdAt: r.created_at,
    };
  }
}
