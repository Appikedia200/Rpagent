/**
 * @fileoverview Command Type Definitions
 * @module shared/types/command
 *
 * Defines types for the Command Center interface
 * including input parsing and result handling.
 */

/**
 * Command input from user
 */
export interface CommandInput {
  raw: string;
  conversationId?: string;
  timestamp?: string;
}

/**
 * Command result type enumeration
 */
export enum CommandResultType {
  SUCCESS = 'success',
  ERROR = 'error',
  CLARIFICATION = 'clarification',
  PROGRESS = 'progress',
  INFO = 'info',
  WARNING = 'warning',
}

/**
 * Command execution result
 */
export interface CommandResult {
  type: CommandResultType;
  message: string;
  data?: CommandResultData;
  suggestions?: string[];
  taskId?: string;
  workspaceIds?: string[];
  timestamp: string;
}

/**
 * Data associated with command result
 */
export interface CommandResultData {
  workspacesCreated?: number;
  browsersLaunched?: number;
  workflowId?: string;
  taskId?: string;
  extractedData?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Message in command conversation
 */
export interface CommandMessage {
  id: string;
  type: 'user' | 'assistant' | 'progress' | 'system';
  content: string;
  result?: CommandResult;
  progress?: CommandProgressData;
  timestamp: string;
}

/**
 * Progress data for active command
 */
export interface CommandProgressData {
  taskId: string;
  workspaceId: string;
  workspaceName: string;
  progress: number;
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  status: 'running' | 'completed' | 'failed';
}

/**
 * Quick command suggestion
 */
export interface QuickCommand {
  label: string;
  command: string;
  category: string;
  description?: string;
}

/**
 * Command history entry
 */
export interface CommandHistoryEntry {
  id: string;
  command: string;
  result: CommandResultType;
  timestamp: string;
}
