/**
 * @fileoverview Input Validation Schemas
 * @module shared/utils/validators
 *
 * Zod schemas for runtime validation of inputs.
 * Ensures type safety and data integrity at runtime.
 */

import { z } from 'zod';
import { ProxyProtocol, WorkflowStepType } from '../types';

/**
 * Viewport schema
 */
export const ViewportSchema = z.object({
  width: z.number().int().min(800).max(3840),
  height: z.number().int().min(600).max(2160),
});

/**
 * Create workspace input schema
 */
export const CreateWorkspaceInputSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  proxyId: z.string().uuid().optional(),
  profileId: z.string().uuid().optional(),
  initialUrl: z.string().url().optional(),
  viewport: ViewportSchema.optional(),
  userAgent: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

/**
 * Bulk create workspace input schema
 */
export const BulkCreateWorkspaceInputSchema = z.object({
  count: z.number().int().min(1).max(100),
  namePrefix: z.string().max(50).optional(),
  proxyId: z.string().uuid().optional(),
  initialUrl: z.string().url().optional(),
  viewport: ViewportSchema.optional(),
});

/**
 * Create proxy input schema
 */
export const CreateProxyInputSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  host: z.string().min(1).max(255).trim(),
  port: z.number().int().min(1).max(65535),
  protocol: z.nativeEnum(ProxyProtocol),
  proxyType: z.string().optional(), // static, residential, datacenter, mobile
  username: z.string().max(100).optional(),
  password: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
});

/**
 * Workflow step schema
 */
export const WorkflowStepSchema: z.ZodType<unknown> = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(WorkflowStepType),
  description: z.string().max(200).optional(),
  config: z.record(z.unknown()),
  errorHandling: z.object({
    onError: z.enum(['continue', 'stop', 'retry', 'skip']),
    retryCount: z.number().int().min(0).max(10).optional(),
    retryDelay: z.number().int().min(0).max(60000).optional(),
    fallbackAction: z.string().optional(),
  }).optional(),
  enabled: z.boolean(),
});

/**
 * Create workflow input schema
 */
export const CreateWorkflowInputSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  browsers: z.number().int().min(1).max(100),
  steps: z.array(WorkflowStepSchema as z.ZodType<Record<string, unknown>>),
  dataSource: z.record(z.array(z.unknown())).optional(),
  variables: z.record(z.string()).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

/**
 * Create task input schema
 */
export const CreateTaskInputSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  workflowId: z.string().uuid(),
  workspaceIds: z.array(z.string().uuid()).min(1),
});

/**
 * Command input schema
 */
export const CommandInputSchema = z.object({
  raw: z.string().min(1).max(10000).trim(),
  conversationId: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional(),
});

/**
 * Validation error class
 */
export class ValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/**
 * Validate input against schema
 * @throws {ValidationError} When validation fails
 */
export function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  context: string
): T {
  const result = schema.safeParse(input);
  
  if (!result.success) {
    throw new ValidationError(
      `Validation failed for ${context}: ${result.error.message}`,
      result.error.issues
    );
  }
  
  return result.data;
}

