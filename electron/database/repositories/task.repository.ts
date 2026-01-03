/**
 * @fileoverview Task Repository
 * @module electron/database/repositories/task
 *
 * Handles all database operations for Task entities.
 * Implements CRUD operations with comprehensive error handling.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, RepositoryError } from './base.repository';
import {
  Task,
  TaskStatus,
  TaskResult,
  TaskStatistics,
} from '../../../shared/types/task.types';

/**
 * Database row type for task
 */
interface TaskRow {
  id: string;
  name: string;
  workflow_id: string;
  workflow_name: string;
  target_workspaces: string;
  status: string;
  progress: number;
  statistics: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration: number | null;
  error: string | null;
  results: string;
  created_at: string;
}

/**
 * Repository for task database operations
 */
export class TaskRepository extends BaseRepository<Task> {
  constructor() {
    super('tasks', 'Task');
  }

  /**
   * Create a new task
   */
  create(data: {
    name: string;
    workflowId: string;
    workflowName: string;
    targetWorkspaces: string[];
  }): Task {
    return this.execute('create', () => {
      const id = uuidv4();
      const now = this.now();

      this.prepareStatement(`
        INSERT INTO tasks (
          id, name, workflow_id, workflow_name, target_workspaces,
          status, progress, results, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.name,
        data.workflowId,
        data.workflowName,
        JSON.stringify(data.targetWorkspaces),
        TaskStatus.QUEUED,
        0,
        '[]',
        now
      );

      const created = this.findById(id);
      if (!created) {
        throw new RepositoryError(
          'Failed to retrieve created task',
          'Task',
          'create'
        );
      }

      return created;
    }, { name: data.name });
  }

  /**
   * Find task by ID
   */
  findById(id: string): Task | null {
    return this.execute('findById', () => {
      const row = this.prepareStatement(
        'SELECT * FROM tasks WHERE id = ?'
      ).get(id) as TaskRow | undefined;

      return row ? this.mapRowToEntity(row) : null;
    }, { id });
  }

  /**
   * Find all tasks
   */
  findAll(): Task[] {
    return this.execute('findAll', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM tasks ORDER BY created_at DESC'
      ).all() as TaskRow[];

      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find running tasks
   */
  findRunning(): Task[] {
    return this.execute('findRunning', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC'
      ).all(TaskStatus.RUNNING) as TaskRow[];

      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find tasks by status
   */
  findByStatus(status: TaskStatus): Task[] {
    return this.execute('findByStatus', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC'
      ).all(status) as TaskRow[];

      return rows.map(row => this.mapRowToEntity(row));
    }, { status });
  }

  /**
   * Update task progress
   */
  updateProgress(id: string, progress: number, status?: TaskStatus): void {
    this.execute('updateProgress', () => {
      if (status) {
        this.prepareStatement(
          'UPDATE tasks SET progress = ?, status = ? WHERE id = ?'
        ).run(progress, status, id);
      } else {
        this.prepareStatement(
          'UPDATE tasks SET progress = ? WHERE id = ?'
        ).run(progress, id);
      }
    }, { id, progress, status });
  }

  /**
   * Update task status
   */
  updateStatus(id: string, status: TaskStatus, error?: string): void {
    this.execute('updateStatus', () => {
      const now = this.now();

      if (status === TaskStatus.RUNNING) {
        this.prepareStatement(`
          UPDATE tasks SET status = ?, started_at = ?, error = ? WHERE id = ?
        `).run(status, now, error ?? null, id);
      } else if (
        status === TaskStatus.COMPLETED ||
        status === TaskStatus.FAILED ||
        status === TaskStatus.CANCELLED
      ) {
        // Calculate duration
        const task = this.findById(id);
        let duration: number | null = null;
        if (task?.startedAt) {
          duration = new Date(now).getTime() - new Date(task.startedAt).getTime();
        }

        this.prepareStatement(`
          UPDATE tasks SET status = ?, completed_at = ?, duration = ?, error = ? WHERE id = ?
        `).run(status, now, duration, error ?? null, id);
      } else {
        this.prepareStatement(`
          UPDATE tasks SET status = ?, error = ? WHERE id = ?
        `).run(status, error ?? null, id);
      }
    }, { id, status });
  }

  /**
   * Update task statistics
   */
  updateStatistics(id: string, statistics: TaskStatistics): void {
    this.execute('updateStatistics', () => {
      this.prepareStatement(
        'UPDATE tasks SET statistics = ? WHERE id = ?'
      ).run(JSON.stringify(statistics), id);
    }, { id });
  }

  /**
   * Save task results
   */
  saveResults(id: string, results: TaskResult[]): void {
    this.execute('saveResults', () => {
      this.prepareStatement(
        'UPDATE tasks SET results = ? WHERE id = ?'
      ).run(JSON.stringify(results), id);
    }, { id, resultsCount: results.length });
  }

  /**
   * Add result to task
   */
  addResult(id: string, result: TaskResult): void {
    this.execute('addResult', () => {
      const task = this.findById(id);
      if (!task) {
        throw new RepositoryError('Task not found', 'Task', 'addResult');
      }

      const results = [...task.results, result];
      this.saveResults(id, results);
    }, { id, workspaceId: result.workspaceId });
  }

  /**
   * Delete task
   */
  delete(id: string): boolean {
    return this.execute('delete', () => {
      const result = this.prepareStatement(
        'DELETE FROM tasks WHERE id = ?'
      ).run(id);

      return result.changes > 0;
    }, { id });
  }

  /**
   * Count tasks
   */
  count(): number {
    return this.execute('count', () => {
      const result = this.prepareStatement(
        'SELECT COUNT(*) as count FROM tasks'
      ).get() as { count: number };

      return result.count;
    });
  }

  /**
   * Count running tasks
   */
  countRunning(): number {
    return this.execute('countRunning', () => {
      const result = this.prepareStatement(
        'SELECT COUNT(*) as count FROM tasks WHERE status = ?'
      ).get(TaskStatus.RUNNING) as { count: number };

      return result.count;
    });
  }

  /**
   * Clear all tasks
   */
  clearAll(): number {
    return this.execute('clearAll', () => {
      const result = this.prepareStatement('DELETE FROM tasks').run();
      return result.changes;
    });
  }

  /**
   * Clear completed tasks (COMPLETED or FAILED)
   */
  clearCompleted(): number {
    return this.execute('clearCompleted', () => {
      const result = this.prepareStatement(
        'DELETE FROM tasks WHERE status IN (?, ?, ?)'
      ).run(TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED);
      return result.changes;
    });
  }

  /**
   * Map database row to Task entity
   */
  protected mapRowToEntity(row: unknown): Task {
    const r = row as TaskRow;
    const results = JSON.parse(r.results) as TaskResult[];
    const totalSteps = results.length > 0 ? results[0].totalSteps : 0;
    const completedSteps = results.reduce((sum, result) => sum + result.completedSteps, 0);
    
    return {
      id: r.id,
      name: r.name,
      workflowId: r.workflow_id,
      workflowName: r.workflow_name,
      targetWorkspaces: JSON.parse(r.target_workspaces) as string[],
      status: r.status as TaskStatus,
      progress: r.progress,
      totalSteps,
      completedSteps,
      statistics: r.statistics
        ? (JSON.parse(r.statistics) as TaskStatistics)
        : undefined,
      startedAt: r.started_at ?? undefined,
      completedAt: r.completed_at ?? undefined,
      duration: r.duration ?? undefined,
      error: r.error ?? undefined,
      results,
      createdAt: r.created_at,
    };
  }
}
