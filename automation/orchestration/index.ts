/**
 * @fileoverview Orchestration Index
 * @module automation/orchestration
 *
 * Exports orchestration utilities for batch browser automation.
 */

export {
  BatchOrchestrator,
  createBatchOrchestrator,
} from './batch-orchestrator';

export type {
  BatchExecutionResult,
  BrowserWorkflowResult,
  BatchProgressCallback,
  BatchProgress,
} from './batch-orchestrator';


