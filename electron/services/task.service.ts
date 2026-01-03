/**
 * @fileoverview Task Service
 * @module electron/services/task
 *
 * Business logic for task management and execution.
 * Orchestrates workflow execution across browsers.
 */

import { BrowserWindow } from 'electron';
import { TaskRepository } from '../database/repositories/task.repository';
import { WorkflowRepository } from '../database/repositories/workflow.repository';
import { WorkspaceRepository } from '../database/repositories/workspace.repository';
import { ProxyRepository } from '../database/repositories/proxy.repository';
import { 
  Task, 
  TaskStatus, 
  TaskProgress,
  CreateTaskInput,
} from '../../shared/types/task.types';
import { browserPool } from '../../automation/browser-manager';
import { workflowOrchestrator } from '../../automation/workflow-engine';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { logger } from '../utils/logger';
import { WorkspaceStatus } from '../../shared/types/workspace.types';

/**
 * Task service error
 */
export class TaskServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'TaskServiceError';
  }
}

/**
 * Task management and execution service
 */
export class TaskService {
  private taskRepo: TaskRepository;
  private workflowRepo: WorkflowRepository;
  private workspaceRepo: WorkspaceRepository;
  private proxyRepo: ProxyRepository;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.taskRepo = new TaskRepository();
    this.workflowRepo = new WorkflowRepository();
    this.workspaceRepo = new WorkspaceRepository();
    this.proxyRepo = new ProxyRepository();
  }

  /**
   * Set main window for IPC communication
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Create a new task
   */
  async create(input: CreateTaskInput): Promise<Task> {
    try {
      logger.info('Creating task', { 
        name: input.name,
        workflowId: input.workflowId,
        workspaces: input.workspaceIds.length,
      });

      // Get workflow
      const workflow = this.workflowRepo.findById(input.workflowId);
      if (!workflow) {
        throw new TaskServiceError(`Workflow not found: ${input.workflowId}`);
      }

      // Create task
      const task = this.taskRepo.create({
        name: input.name,
        workflowId: input.workflowId,
        workflowName: workflow.name,
        targetWorkspaces: input.workspaceIds,
      });

      logger.info('Task created', { taskId: task.id });

      return task;
    } catch (error) {
      logger.error('Failed to create task', { error, input });
      throw new TaskServiceError(
        'Failed to create task',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Launch browser for a workspace (only if not already launched)
   */
  private async launchBrowserForWorkspace(workspaceId: string): Promise<boolean> {
    try {
      // Check if already launched - if so, just return true
      const existing = browserPool.get(workspaceId);
      if (existing && existing.isLaunched()) {
        logger.debug('Browser already launched for workspace', { workspaceId });
        return true;
      }

      const workspace = this.workspaceRepo.findById(workspaceId);
      if (!workspace) {
        logger.warn('Workspace not found', { workspaceId });
        return false;
      }

      // Get proxy if assigned
      const proxy = workspace.proxyId
        ? this.proxyRepo.findById(workspace.proxyId) ?? undefined
        : undefined;

      // Update workspace status
      this.workspaceRepo.updateStatus(workspaceId, WorkspaceStatus.LOADING);

      // Launch browser
      await browserPool.launch(workspace, proxy);

      // Update workspace status
      this.workspaceRepo.updateStatus(workspaceId, WorkspaceStatus.ACTIVE);

      logger.info('Browser launched for workspace', { workspaceId });
      return true;
    } catch (error) {
      logger.error('Failed to launch browser for workspace', { 
        error: error instanceof Error ? error.message : error, 
        workspaceId 
      });
      try {
        this.workspaceRepo.updateStatus(workspaceId, WorkspaceStatus.ERROR);
      } catch {
        // Ignore
      }
      return false;
    }
  }

  /**
   * Execute a task
   */
  async execute(taskId: string): Promise<void> {
    try {
      logger.info('Executing task', { taskId });

      // Get task
      const task = this.taskRepo.findById(taskId);
      if (!task) {
        throw new TaskServiceError(`Task not found: ${taskId}`);
      }

      // Get workflow
      const workflow = this.workflowRepo.findById(task.workflowId);
      if (!workflow) {
        throw new TaskServiceError(`Workflow not found: ${task.workflowId}`);
      }

      // Update task status
      this.taskRepo.updateStatus(taskId, TaskStatus.RUNNING);

      // Auto-launch browsers for target workspaces if not already running
      logger.info('Launching browsers for task', { 
        taskId, 
        workspaces: task.targetWorkspaces.length 
      });

      // Launch all browsers in parallel
      const launchResults = await Promise.all(
        task.targetWorkspaces.map(workspaceId => this.launchBrowserForWorkspace(workspaceId))
      );
      
      const launchedCount = launchResults.filter(Boolean).length;
      logger.info('Browser launch results', { 
        taskId, 
        launchedCount,
        total: task.targetWorkspaces.length,
      });

      // Wait for browsers to be fully ready - with retries
      let browsers: NonNullable<ReturnType<typeof browserPool.get>>[] = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500 + attempt * 500));
        
        browsers = task.targetWorkspaces
          .map(id => browserPool.get(id))
          .filter((b): b is NonNullable<typeof b> => {
            if (!b) return false;
            const state = b.getState();
            const hasPage = !!b.getPage();
            return (state === 'active' || b.isLaunched()) && hasPage;
          });
        
        if (browsers.length > 0) {
          logger.info(`Found ${browsers.length} ready browsers on attempt ${attempt + 1}`);
          break;
        }
      }

      logger.info('Browsers ready for task', { 
        taskId, 
        launched: browsers.length,
        requested: task.targetWorkspaces.length,
        browserStates: task.targetWorkspaces.map(id => {
          const b = browserPool.get(id);
          return { id, exists: !!b, state: b?.getState(), hasPage: !!b?.getPage() };
        }),
      });

      if (browsers.length === 0) {
        throw new TaskServiceError('Failed to launch any browsers for task execution. Check system resources and try again.');
      }

      logger.info('Starting workflow execution', {
        taskId,
        browsers: browsers.length,
        steps: workflow.steps.length,
        stepDetails: workflow.steps.map(s => ({ type: s.type, desc: s.description })),
      });

      // Execute workflow
      const results = await workflowOrchestrator.execute(
        workflow,
        browsers,
        { taskId, parallel: true, stopOnError: false },
        (progress: TaskProgress) => {
          // Update task progress
          this.taskRepo.updateProgress(taskId, progress.progress);

          // Send progress to renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(
              IPC_CHANNELS.EVENT_TASK_PROGRESS,
              progress
            );
          }
        }
      );

      // Save results
      this.taskRepo.saveResults(taskId, results);

      // Update task status
      const allSuccessful = results.every(r => r.success);
      const anySuccessful = results.some(r => r.success);

      let finalStatus: TaskStatus;
      if (allSuccessful) {
        finalStatus = TaskStatus.COMPLETED;
      } else if (anySuccessful) {
        finalStatus = TaskStatus.PARTIAL;
      } else {
        finalStatus = TaskStatus.FAILED;
      }

      this.taskRepo.updateStatus(taskId, finalStatus);

      // Send completion event
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(
          IPC_CHANNELS.EVENT_TASK_COMPLETED,
          { taskId, status: finalStatus, results }
        );
      }

      logger.info('Task execution completed', {
        taskId,
        status: finalStatus,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });
    } catch (error) {
      logger.error('Task execution failed', { error, taskId });

      // Update task status
      this.taskRepo.updateStatus(
        taskId,
        TaskStatus.FAILED,
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Send failure event
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(
          IPC_CHANNELS.EVENT_TASK_FAILED,
          { 
            taskId, 
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
      }

      throw new TaskServiceError(
        'Task execution failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all tasks
   */
  async getAll(): Promise<Task[]> {
    try {
      return this.taskRepo.findAll();
    } catch (error) {
      logger.error('Failed to get tasks', { error });
      throw new TaskServiceError(
        'Failed to get tasks',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get task by ID
   */
  async getById(id: string): Promise<Task | null> {
    try {
      return this.taskRepo.findById(id);
    } catch (error) {
      logger.error('Failed to get task', { error, id });
      throw new TaskServiceError(
        'Failed to get task',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get running tasks
   */
  async getRunning(): Promise<Task[]> {
    try {
      return this.taskRepo.findRunning();
    } catch (error) {
      logger.error('Failed to get running tasks', { error });
      throw new TaskServiceError(
        'Failed to get running tasks',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Cancel a task
   */
  async cancel(taskId: string): Promise<void> {
    try {
      logger.info('Cancelling task', { taskId });

      // Signal orchestrator to cancel
      workflowOrchestrator.cancelTask(taskId);

      // Update task status
      this.taskRepo.updateStatus(taskId, TaskStatus.CANCELLED);

      logger.info('Task cancelled', { taskId });
    } catch (error) {
      logger.error('Failed to cancel task', { error, taskId });
      throw new TaskServiceError(
        'Failed to cancel task',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Pause a task
   */
  async pause(taskId: string): Promise<void> {
    try {
      logger.info('Pausing task', { taskId });

      // Signal orchestrator to pause
      workflowOrchestrator.pauseTask(taskId);

      // Update task status
      this.taskRepo.updateStatus(taskId, TaskStatus.PAUSED);

      logger.info('Task paused', { taskId });
    } catch (error) {
      logger.error('Failed to pause task', { error, taskId });
      throw new TaskServiceError(
        'Failed to pause task',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Resume a task
   */
  async resume(taskId: string): Promise<void> {
    try {
      logger.info('Resuming task', { taskId });

      // Signal orchestrator to resume
      workflowOrchestrator.resumeTask(taskId);

      // Update task status
      this.taskRepo.updateStatus(taskId, TaskStatus.RUNNING);

      logger.info('Task resumed', { taskId });
    } catch (error) {
      logger.error('Failed to resume task', { error, taskId });
      throw new TaskServiceError(
        'Failed to resume task',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get running task count
   */
  async countRunning(): Promise<number> {
    try {
      return this.taskRepo.countRunning();
    } catch (error) {
      logger.error('Failed to count running tasks', { error });
      return 0;
    }
  }

  /**
   * Delete a specific task
   */
  async delete(taskId: string): Promise<boolean> {
    try {
      logger.info('Deleting task', { taskId });
      return this.taskRepo.delete(taskId);
    } catch (error) {
      logger.error('Failed to delete task', { error, taskId });
      throw new TaskServiceError(
        'Failed to delete task',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clear all tasks
   */
  async clearAll(): Promise<number> {
    try {
      logger.info('Clearing all tasks');
      const count = this.taskRepo.clearAll();
      logger.info('Cleared all tasks', { count });
      return count;
    } catch (error) {
      logger.error('Failed to clear all tasks', { error });
      throw new TaskServiceError(
        'Failed to clear all tasks',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clear completed tasks
   */
  async clearCompleted(): Promise<number> {
    try {
      logger.info('Clearing completed tasks');
      const count = this.taskRepo.clearCompleted();
      logger.info('Cleared completed tasks', { count });
      return count;
    } catch (error) {
      logger.error('Failed to clear completed tasks', { error });
      throw new TaskServiceError(
        'Failed to clear completed tasks',
        error instanceof Error ? error : undefined
      );
    }
  }
}
