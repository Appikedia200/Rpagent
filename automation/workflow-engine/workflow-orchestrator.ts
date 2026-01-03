/**
 * @fileoverview Workflow Orchestrator
 * @module automation/workflow-engine/workflow-orchestrator
 *
 * Orchestrates workflow execution across multiple browser instances.
 * Manages parallel execution, progress tracking, and result collection.
 */

import { Workflow } from '../../shared/types/workflow.types';
import { TaskProgress, TaskResult, TaskStatistics } from '../../shared/types/task.types';
import { BrowserInstance } from '../browser-manager/browser-instance';
import { StepExecutor } from './step-executor';
import { logger } from '../../electron/utils/logger';

/**
 * Orchestrator error
 */
export class OrchestratorError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: TaskProgress) => void;

/**
 * Execution options
 */
export interface ExecutionOptions {
  parallel?: boolean;
  maxConcurrent?: number;
  stopOnError?: boolean;
  taskId: string;
  visibleMode?: boolean; // Run sequentially with visible actions
}

/**
 * Orchestrates workflow execution
 */
export class WorkflowOrchestrator {
  private activeExecutions: Map<string, boolean> = new Map();
  private cancelledTasks: Set<string> = new Set();
  private pausedTasks: Set<string> = new Set();

  /**
   * Execute workflow across multiple browsers
   */
  async execute(
    workflow: Workflow,
    browsers: BrowserInstance[],
    options: ExecutionOptions,
    onProgress?: ProgressCallback
  ): Promise<TaskResult[]> {
    const startTime = Date.now();
    // Default to SEQUENTIAL execution so user can see everything
    const { taskId, parallel = false, stopOnError = false, visibleMode = true } = options;
    
    logger.info('Workflow execution mode', { parallel, visibleMode, browserCount: browsers.length });

    logger.info('Starting workflow execution', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      browserCount: browsers.length,
      stepCount: workflow.steps.length,
      taskId,
    });

    // Mark task as active
    this.activeExecutions.set(taskId, true);

    try {
      const results: TaskResult[] = [];
      const totalSteps = workflow.steps.length;
      const completedBrowsers: string[] = [];
      const failedBrowsers: string[] = [];

      if (parallel) {
        // Execute in parallel
        const executions = browsers.map((browser, index) =>
          this.executeSingleBrowser(
            workflow,
            browser,
            index,
            taskId,
            totalSteps,
            onProgress
          )
        );

        const settled = await Promise.allSettled(executions);

        for (let i = 0; i < settled.length; i++) {
          const result = settled[i];
          const browser = browsers[i];

          if (result.status === 'fulfilled') {
            results.push(result.value);
            if (result.value.success) {
              completedBrowsers.push(browser.workspace.id);
            } else {
              failedBrowsers.push(browser.workspace.id);
            }
          } else {
            const errorResult: TaskResult = {
              workspaceId: browser.workspace.id,
              workspaceName: browser.workspace.name,
              success: false,
              error: result.reason?.message || 'Unknown error',
              duration: Date.now() - startTime,
              completedSteps: 0,
              totalSteps,
            };
            results.push(errorResult);
            failedBrowsers.push(browser.workspace.id);

            if (stopOnError) {
              logger.warn('Stopping execution due to error', { taskId });
              this.cancelTask(taskId);
              break;
            }
          }
        }
      } else {
        // Execute sequentially
        for (let i = 0; i < browsers.length; i++) {
          if (this.isTaskCancelled(taskId)) {
            logger.info('Task cancelled', { taskId });
            break;
          }

          const browser = browsers[i];
          try {
            const result = await this.executeSingleBrowser(
              workflow,
              browser,
              i,
              taskId,
              totalSteps,
              onProgress
            );
            results.push(result);

            if (result.success) {
              completedBrowsers.push(browser.workspace.id);
            } else {
              failedBrowsers.push(browser.workspace.id);
              if (stopOnError) break;
            }
          } catch (error) {
            const errorResult: TaskResult = {
              workspaceId: browser.workspace.id,
              workspaceName: browser.workspace.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              duration: Date.now() - startTime,
              completedSteps: 0,
              totalSteps,
            };
            results.push(errorResult);
            failedBrowsers.push(browser.workspace.id);

            if (stopOnError) break;
          }
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Workflow execution completed', {
        taskId,
        duration,
        total: browsers.length,
        completed: completedBrowsers.length,
        failed: failedBrowsers.length,
      });

      return results;
    } finally {
      // Cleanup
      this.activeExecutions.delete(taskId);
      this.cancelledTasks.delete(taskId);
    }
  }

  /**
   * Execute workflow on a single browser
   */
  private async executeSingleBrowser(
    workflow: Workflow,
    browser: BrowserInstance,
    browserIndex: number,
    taskId: string,
    totalSteps: number,
    onProgress?: ProgressCallback
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const workspaceId = browser.workspace.id;
    const workspaceName = browser.workspace.name;

    logger.debug('Executing workflow on browser', {
      workspaceId,
      browserIndex,
      taskId,
    });

    const page = browser.getPage();
    const humanBehavior = browser.getHumanBehavior();
    const metaDetection = browser.getMetaDetection();

    if (!page || !humanBehavior) {
      return {
        workspaceId,
        workspaceName,
        success: false,
        error: 'Browser not properly launched',
        duration: Date.now() - startTime,
        completedSteps: 0,
        totalSteps,
      };
    }

    const executor = new StepExecutor(page, humanBehavior, metaDetection, workspaceId);
    const data = this.getDataForBrowser(workflow, browserIndex);

    let completedSteps = 0;

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        // Check for cancellation
        if (this.isTaskCancelled(taskId)) {
          return {
            workspaceId,
            workspaceName,
            success: false,
            error: 'Task cancelled',
            duration: Date.now() - startTime,
            completedSteps,
            totalSteps,
          };
        }

        const step = workflow.steps[i];
        
        logger.info(`Executing step ${i + 1}/${workflow.steps.length}`, {
          stepType: step.type,
          stepDesc: step.description,
          workspaceId,
        });

        // Skip disabled steps
        if (!step.enabled) {
          completedSteps++;
          continue;
        }

        // Report progress
        if (onProgress) {
          onProgress({
            taskId,
            workspaceId,
            workspaceName,
            progress: Math.round((i / totalSteps) * 100),
            currentStep: step.description || step.type,
            currentStepIndex: i,
            completedSteps,
            totalSteps,
            status: 'running',
          });
        }

        // Execute step
        await executor.execute(step, data);
        completedSteps++;
      }

      // Final progress update
      if (onProgress) {
        onProgress({
          taskId,
          workspaceId,
          workspaceName,
          progress: 100,
          currentStep: 'Completed',
          currentStepIndex: totalSteps,
          completedSteps: totalSteps,
          totalSteps,
          status: 'completed',
        });
      }

      return {
        workspaceId,
        workspaceName,
        success: true,
        data: executor.getExtractedData(),
        duration: Date.now() - startTime,
        completedSteps: totalSteps,
        totalSteps,
      };
    } catch (error) {
      logger.error('Browser execution failed', {
        error,
        workspaceId,
        completedSteps,
        taskId,
      });

      // Report failure
      if (onProgress) {
        onProgress({
          taskId,
          workspaceId,
          workspaceName,
          progress: Math.round((completedSteps / totalSteps) * 100),
          currentStep: 'Failed',
          currentStepIndex: completedSteps,
          completedSteps,
          totalSteps,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      return {
        workspaceId,
        workspaceName,
        success: false,
        data: executor.getExtractedData(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        completedSteps,
        totalSteps,
      };
    }
  }

  /**
   * Get data for specific browser index
   */
  private getDataForBrowser(
    workflow: Workflow,
    index: number
  ): Record<string, unknown> {
    if (!workflow.dataSource) return {};

    const data: Record<string, unknown> = {};
    
    for (const [key, values] of Object.entries(workflow.dataSource)) {
      if (Array.isArray(values) && values.length > 0) {
        data[key] = values[index % values.length];
      }
    }

    // Add variables
    if (workflow.variables) {
      Object.assign(data, workflow.variables);
    }

    // Add browser index
    data._browserIndex = index;

    return data;
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): void {
    this.cancelledTasks.add(taskId);
    this.pausedTasks.delete(taskId);
    logger.info('Task marked for cancellation', { taskId });
  }

  /**
   * Pause a task
   */
  pauseTask(taskId: string): void {
    this.pausedTasks.add(taskId);
    logger.info('Task marked for pause', { taskId });
  }

  /**
   * Resume a task
   */
  resumeTask(taskId: string): void {
    this.pausedTasks.delete(taskId);
    logger.info('Task resumed', { taskId });
  }

  /**
   * Check if task is paused
   */
  isTaskPaused(taskId: string): boolean {
    return this.pausedTasks.has(taskId);
  }

  /**
   * Check if task is cancelled
   */
  private isTaskCancelled(taskId: string): boolean {
    return this.cancelledTasks.has(taskId);
  }

  /**
   * Check if task is active
   */
  isTaskActive(taskId: string): boolean {
    return this.activeExecutions.has(taskId);
  }

  /**
   * Calculate task statistics
   */
  calculateStatistics(results: TaskResult[], startTime: number): TaskStatistics {
    const completed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalProgress = results.reduce((sum, r) => {
      return sum + (r.completedSteps / r.totalSteps) * 100;
    }, 0);

    return {
      totalWorkspaces: results.length,
      completedWorkspaces: completed,
      failedWorkspaces: failed,
      averageProgress: results.length > 0 ? totalProgress / results.length : 0,
      elapsedTime: Date.now() - startTime,
    };
  }
}

/**
 * Singleton orchestrator instance
 */
export const workflowOrchestrator = new WorkflowOrchestrator();
