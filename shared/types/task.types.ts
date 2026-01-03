/**
 * @fileoverview Task Type Definitions
 * @module shared/types/task
 *
 * Defines task-related types for workflow execution
 * including progress tracking and results.
 */

/**
 * Task status enumeration
 */
export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIAL = 'partial',
}

/**
 * Individual task result per workspace
 */
export interface TaskResult {
  workspaceId: string;
  workspaceName: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  duration: number;
  completedSteps: number;
  totalSteps: number;
}

/**
 * Task progress update
 */
export interface TaskProgress {
  taskId: string;
  workspaceId: string;
  workspaceName: string;
  progress: number;
  currentStep: string;
  currentStepIndex: number;
  completedSteps: number;
  totalSteps: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

/**
 * Aggregated task statistics
 */
export interface TaskStatistics {
  totalWorkspaces: number;
  completedWorkspaces: number;
  failedWorkspaces: number;
  averageProgress: number;
  estimatedTimeRemaining?: number;
  elapsedTime: number;
}

/**
 * Core Task entity
 */
export interface Task {
  id: string;
  name: string;
  workflowId: string;
  workflowName: string;
  targetWorkspaces: string[];
  status: TaskStatus;
  progress: number;
  totalSteps: number;
  completedSteps: number;
  statistics?: TaskStatistics;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  results: TaskResult[];
  createdAt: string;
}

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  name: string;
  workflowId: string;
  workspaceIds: string[];
}

/**
 * Task execution options
 */
export interface TaskExecutionOptions {
  parallel: boolean;
  maxConcurrent?: number;
  stopOnError: boolean;
  retryFailed: boolean;
  retryCount?: number;
}
