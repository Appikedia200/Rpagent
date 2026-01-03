/**
 * @fileoverview Workflow Engine Index
 * @module automation/workflow-engine
 *
 * Re-exports workflow engine functionality.
 */

export { StepExecutor, StepExecutionError } from './step-executor';
export type { StepExecutionResult } from './step-executor';
export { 
  WorkflowOrchestrator, 
  OrchestratorError, 
  workflowOrchestrator,
} from './workflow-orchestrator';
export type { ExecutionOptions, ProgressCallback } from './workflow-orchestrator';

