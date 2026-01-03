/**
 * @fileoverview Base Repository Class
 * @module electron/database/repositories/base
 *
 * Provides common database operations and patterns
 * for all entity repositories.
 */

import Database, { Statement } from 'better-sqlite3';
import { getDatabase } from '../db';
import { logger } from '../../utils/logger';

/**
 * Repository error class
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly entity: string,
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/**
 * Base repository with common database operations
 */
export abstract class BaseRepository<T> {
  protected db: Database.Database;
  protected readonly tableName: string;
  protected readonly entityName: string;

  constructor(tableName: string, entityName: string) {
    this.tableName = tableName;
    this.entityName = entityName;
    this.db = getDatabase();
  }

  /**
   * Execute a database operation with error handling and logging
   */
  protected execute<R>(
    operation: string,
    fn: () => R,
    context?: Record<string, unknown>
  ): R {
    const startTime = Date.now();
    
    try {
      const result = fn();
      const duration = Date.now() - startTime;
      
      logger.debug(`${this.entityName} repository: ${operation}`, {
        duration,
        ...context,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`${this.entityName} repository: ${operation} failed`, {
        error,
        duration,
        ...context,
      });
      
      throw new RepositoryError(
        `Failed to ${operation}`,
        this.entityName,
        operation,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Prepare and cache a statement
   */
  protected prepareStatement(sql: string): Statement {
    return this.db.prepare(sql);
  }

  /**
   * Run an operation in a transaction
   */
  protected transaction<R>(fn: () => R): R {
    return this.db.transaction(fn)();
  }

  /**
   * Get current ISO timestamp
   */
  protected now(): string {
    return new Date().toISOString();
  }

  /**
   * Abstract method to map database row to entity
   */
  protected abstract mapRowToEntity(row: unknown): T;
}
