/**
 * @fileoverview Workflow Repository
 * @module electron/database/repositories/workflow
 *
 * Handles all database operations for Workflow entities.
 * Implements CRUD operations with comprehensive error handling.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, RepositoryError } from './base.repository';
import {
  Workflow,
  WorkflowStep,
  CreateWorkflowInput,
} from '../../../shared/types/workflow.types';

/**
 * Database row type for workflow
 */
interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  browsers: number;
  steps: string;
  data_source: string | null;
  variables: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
}

/**
 * Repository for workflow database operations
 */
export class WorkflowRepository extends BaseRepository<Workflow> {
  constructor() {
    super('workflows', 'Workflow');
  }

  /**
   * Create a new workflow
   */
  create(input: CreateWorkflowInput): Workflow {
    return this.execute('create', () => {
      const id = uuidv4();
      const now = this.now();

      this.prepareStatement(`
        INSERT INTO workflows (
          id, name, description, browsers, steps, data_source,
          variables, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.name,
        input.description ?? null,
        input.browsers,
        JSON.stringify(input.steps),
        input.dataSource ? JSON.stringify(input.dataSource) : null,
        input.variables ? JSON.stringify(input.variables) : null,
        JSON.stringify(input.tags ?? []),
        now,
        now
      );

      const created = this.findById(id);
      if (!created) {
        throw new RepositoryError(
          'Failed to retrieve created workflow',
          'Workflow',
          'create'
        );
      }

      return created;
    }, { name: input.name });
  }

  /**
   * Find workflow by ID
   */
  findById(id: string): Workflow | null {
    return this.execute('findById', () => {
      const row = this.prepareStatement(
        'SELECT * FROM workflows WHERE id = ?'
      ).get(id) as WorkflowRow | undefined;

      return row ? this.mapRowToEntity(row) : null;
    }, { id });
  }

  /**
   * Find all workflows
   */
  findAll(): Workflow[] {
    return this.execute('findAll', () => {
      const rows = this.prepareStatement(
        'SELECT * FROM workflows ORDER BY created_at DESC'
      ).all() as WorkflowRow[];

      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Update workflow
   */
  update(id: string, input: Partial<CreateWorkflowInput>): Workflow {
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
      if (input.browsers !== undefined) {
        updates.push('browsers = ?');
        values.push(input.browsers);
      }
      if (input.steps !== undefined) {
        updates.push('steps = ?');
        values.push(JSON.stringify(input.steps));
      }
      if (input.dataSource !== undefined) {
        updates.push('data_source = ?');
        values.push(JSON.stringify(input.dataSource));
      }
      if (input.variables !== undefined) {
        updates.push('variables = ?');
        values.push(JSON.stringify(input.variables));
      }
      if (input.tags !== undefined) {
        updates.push('tags = ?');
        values.push(JSON.stringify(input.tags));
      }

      values.push(id);

      this.prepareStatement(
        `UPDATE workflows SET ${updates.join(', ')} WHERE id = ?`
      ).run(...values);

      const updated = this.findById(id);
      if (!updated) {
        throw new RepositoryError(
          'Workflow not found after update',
          'Workflow',
          'update'
        );
      }

      return updated;
    }, { id });
  }

  /**
   * Delete workflow
   */
  delete(id: string): boolean {
    return this.execute('delete', () => {
      const result = this.prepareStatement(
        'DELETE FROM workflows WHERE id = ?'
      ).run(id);

      return result.changes > 0;
    }, { id });
  }

  /**
   * Count workflows
   */
  count(): number {
    return this.execute('count', () => {
      const result = this.prepareStatement(
        'SELECT COUNT(*) as count FROM workflows'
      ).get() as { count: number };

      return result.count;
    });
  }

  /**
   * Map database row to Workflow entity
   */
  protected mapRowToEntity(row: unknown): Workflow {
    const r = row as WorkflowRow;
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      browsers: r.browsers,
      steps: JSON.parse(r.steps) as WorkflowStep[],
      dataSource: r.data_source
        ? (JSON.parse(r.data_source) as Record<string, unknown[]>)
        : undefined,
      variables: r.variables
        ? (JSON.parse(r.variables) as Record<string, string>)
        : undefined,
      tags: JSON.parse(r.tags) as string[],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
