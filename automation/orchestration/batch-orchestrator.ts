/**
 * @fileoverview Batch Orchestrator
 * @module automation/orchestration/batch-orchestrator
 *
 * Orchestrates browser automation across multiple browsers in batches.
 * Opens browsers in batches (e.g., 20 at a time), runs workflows on each,
 * and coordinates parallel execution.
 */

import { BrowserInstance } from '../browser-manager/browser-instance';
import { browserPool } from '../browser-manager/browser-pool';
import { WorkflowStep } from '../../shared/types/workflow.types';
import { Workspace } from '../../shared/types/workspace.types';
import { StepExecutor } from '../workflow-engine/step-executor';
import { HumanBehavior } from '../stealth/human-behavior';
import { MetaDetection } from '../stealth/meta-detection';
import { FingerprintManager } from '../stealth/fingerprint-manager';
import { logger } from '../../electron/utils/logger';
import { APP_CONFIG } from '../../shared/constants/app-config';

/**
 * Batch execution result
 */
export interface BatchExecutionResult {
  totalBrowsers: number;
  successCount: number;
  failureCount: number;
  results: BrowserWorkflowResult[];
  duration: number;
}

/**
 * Individual browser workflow result
 */
export interface BrowserWorkflowResult {
  workspaceId: string;
  workspaceName: string;
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  error?: string;
  extractedData?: Record<string, unknown>;
}

/**
 * Batch progress callback
 */
export type BatchProgressCallback = (progress: BatchProgress) => void;

/**
 * Batch progress info
 */
export interface BatchProgress {
  phase: 'launching' | 'executing' | 'completed';
  batchNumber: number;
  totalBatches: number;
  browsersLaunched: number;
  totalBrowsers: number;
  currentStep?: string;
  stepsCompleted: number;
  totalSteps: number;
}

/**
 * Batch Orchestrator class
 * Manages batch processing of browser automation
 */
export class BatchOrchestrator {
  private batchSize: number;
  private batchDelay: number;
  private stepDelay: number;

  constructor(options?: {
    batchSize?: number;
    batchDelay?: number;
    stepDelay?: number;
  }) {
    this.batchSize = options?.batchSize || APP_CONFIG.BATCH_SIZE;
    this.batchDelay = options?.batchDelay || APP_CONFIG.BATCH_DELAY;
    this.stepDelay = options?.stepDelay || APP_CONFIG.STEP_DELAY;
  }

  /**
   * Execute workflow on multiple workspaces in batches
   */
  async executeInBatches(
    workspaces: Workspace[],
    steps: WorkflowStep[],
    onProgress?: BatchProgressCallback
  ): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    const results: BrowserWorkflowResult[] = [];
    const totalBrowsers = workspaces.length;
    const totalBatches = Math.ceil(totalBrowsers / this.batchSize);
    let browsersLaunched = 0;
    let stepsCompleted = 0;
    const totalSteps = steps.length * totalBrowsers;

    logger.info('Starting batch execution', {
      totalBrowsers,
      totalBatches,
      batchSize: this.batchSize,
      stepsCount: steps.length,
    });

    // Process in batches
    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const batchStart = batchNum * this.batchSize;
      const batchEnd = Math.min(batchStart + this.batchSize, totalBrowsers);
      const batchWorkspaces = workspaces.slice(batchStart, batchEnd);

      logger.info(`Processing batch ${batchNum + 1}/${totalBatches}`, {
        batchSize: batchWorkspaces.length,
      });

      // Report progress: launching
      onProgress?.({
        phase: 'launching',
        batchNumber: batchNum + 1,
        totalBatches,
        browsersLaunched,
        totalBrowsers,
        stepsCompleted,
        totalSteps,
      });

      // Launch browsers in this batch in parallel
      const browserInstances = await this.launchBatch(batchWorkspaces);
      browsersLaunched += browserInstances.length;

      // Report progress after launch
      onProgress?.({
        phase: 'executing',
        batchNumber: batchNum + 1,
        totalBatches,
        browsersLaunched,
        totalBrowsers,
        stepsCompleted,
        totalSteps,
      });

      // Execute steps on all browsers in this batch
      // Steps are executed in sequence, but all browsers execute the same step in parallel
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];

        onProgress?.({
          phase: 'executing',
          batchNumber: batchNum + 1,
          totalBatches,
          browsersLaunched,
          totalBrowsers,
          currentStep: step.description || step.type,
          stepsCompleted,
          totalSteps,
        });

        // Execute this step on all browsers in parallel
        const stepPromises = browserInstances.map(async (instance) => {
          try {
            await this.executeStepOnBrowser(instance, step);
            return { success: true, workspaceId: instance.workspace.id };
          } catch (error) {
            logger.error('Step execution failed on browser', {
              workspaceId: instance.workspace.id,
              stepId: step.id,
              error,
            });
            return {
              success: false,
              workspaceId: instance.workspace.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        await Promise.all(stepPromises);
        stepsCompleted += browserInstances.length;

        // Wait between steps
        if (stepIndex < steps.length - 1) {
          await this.delay(this.stepDelay);
        }
      }

      // Collect results for this batch
      for (const instance of browserInstances) {
        results.push({
          workspaceId: instance.workspace.id,
          workspaceName: instance.workspace.name,
          success: true,
          stepsCompleted: steps.length,
          totalSteps: steps.length,
          extractedData: instance.extractedData,
        });
      }

      // Wait between batches
      if (batchNum < totalBatches - 1) {
        logger.info('Waiting before next batch', { delay: this.batchDelay });
        await this.delay(this.batchDelay);
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    // Report completion
    onProgress?.({
      phase: 'completed',
      batchNumber: totalBatches,
      totalBatches,
      browsersLaunched,
      totalBrowsers,
      stepsCompleted: totalSteps,
      totalSteps,
    });

    logger.info('Batch execution completed', {
      totalBrowsers,
      successCount,
      failureCount,
      duration,
    });

    return {
      totalBrowsers,
      successCount,
      failureCount,
      results,
      duration,
    };
  }

  /**
   * Launch a batch of browsers in parallel
   */
  private async launchBatch(workspaces: Workspace[]): Promise<BrowserInstance[]> {
    const instances: BrowserInstance[] = [];

    const launchPromises = workspaces.map(async (workspace) => {
      try {
        const instance = await browserPool.launch(workspace);
        instances.push(instance);
        return instance;
      } catch (error) {
        logger.error('Failed to launch browser in batch', {
          workspaceId: workspace.id,
          error,
        });
        return null;
      }
    });

    await Promise.all(launchPromises);
    return instances;
  }

  /**
   * Execute a single step on a browser instance
   */
  private async executeStepOnBrowser(
    instance: BrowserInstance,
    step: WorkflowStep
  ): Promise<void> {
    const page = instance.getPage();
    if (!page) {
      throw new Error('Browser page not available');
    }

    // Get or create human behavior and detection modules
    const humanBehavior = instance.getHumanBehavior() || new HumanBehavior(page);
    const metaDetection = instance.getMetaDetection() || new MetaDetection(new FingerprintManager());

    // Create step executor
    const executor = new StepExecutor(
      page,
      humanBehavior,
      metaDetection,
      instance.workspace.id
    );

    // Execute the step
    const result = await executor.execute(step);

    // Store extracted data
    if (result.extractedData) {
      Object.assign(instance.extractedData, result.extractedData);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a batch orchestrator instance
 */
export function createBatchOrchestrator(options?: {
  batchSize?: number;
  batchDelay?: number;
  stepDelay?: number;
}): BatchOrchestrator {
  return new BatchOrchestrator(options);
}


