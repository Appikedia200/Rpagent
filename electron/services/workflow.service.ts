/**
 * @fileoverview Workflow Service
 * @module electron/services/workflow
 *
 * Business logic for workflow management operations.
 * Handles workflow creation, retrieval, and updates.
 */

import { WorkflowRepository } from '../database/repositories/workflow.repository';
import { Workflow, CreateWorkflowInput } from '../../shared/types/workflow.types';
import {
  validateInput,
  CreateWorkflowInputSchema,
  ValidationError,
} from '../../shared/utils/validators';
import { logger } from '../utils/logger';

/**
 * Workflow service error
 */
export class WorkflowServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'WorkflowServiceError';
  }
}

/**
 * Workflow management service
 */
export class WorkflowService {
  private repository: WorkflowRepository;

  constructor() {
    this.repository = new WorkflowRepository();
  }

  /**
   * Create a new workflow
   */
  async create(input: CreateWorkflowInput): Promise<Workflow> {
    try {
      logger.info('Creating workflow', { name: input.name });

      // Validate input
      const validated = validateInput(
        CreateWorkflowInputSchema,
        input,
        'CreateWorkflowInput'
      ) as unknown as CreateWorkflowInput;

      // Create workflow
      const workflow = this.repository.create(validated);

      logger.info('Workflow created', {
        workflowId: workflow.id,
        name: workflow.name,
        steps: workflow.steps.length,
      });

      return workflow;
    } catch (error) {
      logger.error('Failed to create workflow', { error, name: input.name });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new WorkflowServiceError(
        'Failed to create workflow',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all workflows
   */
  async getAll(): Promise<Workflow[]> {
    try {
      return this.repository.findAll();
    } catch (error) {
      logger.error('Failed to get workflows', { error });
      throw new WorkflowServiceError(
        'Failed to get workflows',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get workflow by ID
   */
  async getById(id: string): Promise<Workflow | null> {
    try {
      return this.repository.findById(id);
    } catch (error) {
      logger.error('Failed to get workflow', { error, id });
      throw new WorkflowServiceError(
        'Failed to get workflow',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update workflow
   */
  async update(id: string, input: Partial<CreateWorkflowInput>): Promise<Workflow> {
    try {
      logger.info('Updating workflow', { workflowId: id });

      const workflow = this.repository.update(id, input);

      logger.info('Workflow updated', { workflowId: id });

      return workflow;
    } catch (error) {
      logger.error('Failed to update workflow', { error, id });
      throw new WorkflowServiceError(
        'Failed to update workflow',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete workflow
   */
  async delete(id: string): Promise<boolean> {
    try {
      logger.info('Deleting workflow', { workflowId: id });

      const deleted = this.repository.delete(id);

      if (deleted) {
        logger.info('Workflow deleted', { workflowId: id });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete workflow', { error, id });
      throw new WorkflowServiceError(
        'Failed to delete workflow',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get workflow count
   */
  async count(): Promise<number> {
    try {
      return this.repository.count();
    } catch (error) {
      logger.error('Failed to count workflows', { error });
      return 0;
    }
  }
}
