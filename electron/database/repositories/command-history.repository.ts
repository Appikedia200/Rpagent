/**
 * @fileoverview Command History Repository
 * @module electron/database/repositories/command-history
 *
 * Handles storing and retrieving command history.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { CommandResult } from '../../../shared/types/command.types';

/**
 * Command history entry
 */
export interface CommandHistoryEntry {
  id: string;
  command: string;
  resultType: string;
  resultMessage: string;
  resultData?: string;
  taskId?: string;
  workspaceIds?: string;
  createdAt: string;
}

/**
 * Database row type
 */
interface CommandHistoryRow {
  id: string;
  command: string;
  result_type: string;
  result_message: string;
  result_data: string | null;
  task_id: string | null;
  workspace_ids: string | null;
  created_at: string;
}

/**
 * Repository for command history
 */
export class CommandHistoryRepository extends BaseRepository<CommandHistoryEntry> {
  constructor() {
    super('command_history', 'CommandHistory');
    this.ensureTable();
  }

  /**
   * Ensure table exists
   */
  private ensureTable(): void {
    this.execute('ensureTable', () => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS command_history (
          id TEXT PRIMARY KEY,
          command TEXT NOT NULL,
          result_type TEXT NOT NULL,
          result_message TEXT NOT NULL,
          result_data TEXT,
          task_id TEXT,
          workspace_ids TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_command_history_created ON command_history(created_at DESC);
      `);
    });
  }

  /**
   * Save a command to history (with error handling)
   */
  save(command: string, result: CommandResult): CommandHistoryEntry | null {
    try {
      const id = uuidv4();
      const now = this.now();

      this.prepareStatement(`
        INSERT INTO command_history (
          id, command, result_type, result_message, result_data, task_id, workspace_ids, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        command,
        result.type,
        result.message,
        result.data ? JSON.stringify(result.data) : null,
        result.taskId ?? null,
        result.workspaceIds ? JSON.stringify(result.workspaceIds) : null,
        now
      );

      return {
        id,
        command,
        resultType: result.type,
        resultMessage: result.message,
        resultData: result.data ? JSON.stringify(result.data) : undefined,
        taskId: result.taskId,
        workspaceIds: result.workspaceIds ? JSON.stringify(result.workspaceIds) : undefined,
        createdAt: now,
      };
    } catch (error) {
      // Log but don't fail the command execution
      console.error('Failed to save command history:', error);
      return null;
    }
  }

  /**
   * Get all command history (newest first)
   */
  findAll(limit: number = 100): CommandHistoryEntry[] {
    return this.execute('findAll', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM command_history ORDER BY created_at DESC LIMIT ?'
      ).all(limit) as CommandHistoryRow[];

      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Clear all command history
   */
  clearAll(): number {
    return this.execute('clearAll', () => {
      const result = this.prepareStatement('DELETE FROM command_history').run();
      return result.changes;
    });
  }

  /**
   * Map row to entity
   */
  protected mapRowToEntity(row: unknown): CommandHistoryEntry {
    const r = row as CommandHistoryRow;
    return {
      id: r.id,
      command: r.command,
      resultType: r.result_type,
      resultMessage: r.result_message,
      resultData: r.result_data ?? undefined,
      taskId: r.task_id ?? undefined,
      workspaceIds: r.workspace_ids ?? undefined,
      createdAt: r.created_at,
    };
  }
}

