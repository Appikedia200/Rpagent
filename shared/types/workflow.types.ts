/**
 * @fileoverview Workflow Type Definitions
 * @module shared/types/workflow
 *
 * Defines workflow-related types for automation sequences
 * including steps, conditions, and data sources.
 */

/**
 * Workflow step type enumeration
 */
export enum WorkflowStepType {
  NAVIGATE = 'navigate',
  CLICK = 'click',
  FILL_FORM = 'fillForm',
  TYPE_TEXT = 'typeText',
  SELECT_OPTION = 'selectOption',
  WAIT = 'wait',
  WAIT_FOR_SELECTOR = 'waitForSelector',
  WAIT_FOR_NAVIGATION = 'waitForNavigation',
  EXTRACT = 'extract',
  SCREENSHOT = 'screenshot',
  EXECUTE_SCRIPT = 'executeScript',
  CONDITION = 'condition',
  LOOP = 'loop',
  SCROLL = 'scroll',
  HOVER = 'hover',
  UPLOAD_FILE = 'uploadFile',
  DOWNLOAD_FILE = 'downloadFile',
  PRESS_KEY = 'pressKey',
  SOLVE_CAPTCHA = 'solveCaptcha',
}

/**
 * Error handling strategy for steps
 */
export interface StepErrorHandling {
  onError: 'continue' | 'stop' | 'retry' | 'skip';
  retryCount?: number;
  retryDelay?: number;
  fallbackAction?: string;
}

/**
 * Form field definition for FILL_FORM step
 */
export interface FormField {
  selector: string;
  value: string;
  type?: 'text' | 'password' | 'email' | 'tel' | 'number';
}

/**
 * Extract data definition
 */
export interface ExtractItem {
  name: string;
  selector: string;
  attribute?: string;
  multiple?: boolean;
}

/**
 * Workflow step configuration (varies by step type)
 */
export interface WorkflowStepConfig {
  // Index signature for Record<string, unknown> compatibility
  [key: string]: unknown;
  
  // Navigate
  url?: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';

  // Click, Type, Select
  selector?: string;
  text?: string;
  value?: string;
  option?: string;

  // Wait
  duration?: number;
  timeout?: number;

  // Form
  fields?: FormField[];

  // Extract
  data?: ExtractItem[];

  // Screenshot
  path?: string;
  fullPage?: boolean;

  // Script
  script?: string;

  // Condition
  condition?: string;
  thenSteps?: WorkflowStep[];
  elseSteps?: WorkflowStep[];

  // Loop
  iterations?: number;
  dataKey?: string;
  loopSteps?: WorkflowStep[];

  // Scroll
  direction?: 'up' | 'down';
  amount?: number;

  // Upload
  filePath?: string;

  // Press Key
  key?: string;
  modifiers?: string[];
}

/**
 * Individual workflow step
 */
export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  description?: string;
  config: WorkflowStepConfig;
  errorHandling?: StepErrorHandling;
  enabled: boolean;
}

/**
 * Core Workflow entity
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  browsers: number;
  steps: WorkflowStep[];
  dataSource?: Record<string, unknown[]>;
  variables?: Record<string, string>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new workflow
 */
export interface CreateWorkflowInput {
  name: string;
  description?: string;
  browsers: number;
  steps: WorkflowStep[];
  dataSource?: Record<string, unknown[]>;
  variables?: Record<string, string>;
  tags?: string[];
}

/**
 * Parsed command result
 */
export interface ParsedCommand {
  browsers: number;
  steps: WorkflowStep[];
  dataSource?: Record<string, unknown[]>;
  rawCommand: string;
}
