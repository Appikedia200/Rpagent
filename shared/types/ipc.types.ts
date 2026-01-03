/**
 * @fileoverview IPC Type Definitions
 * @module shared/types/ipc
 *
 * Defines types for Inter-Process Communication between
 * Electron main and renderer processes.
 */

import type { CreateWorkspaceInput, UpdateWorkspaceInput, BulkCreateWorkspaceInput } from './workspace.types';
import type { CreateProxyInput, BulkProxyImport } from './proxy.types';
import type { CreateWorkflowInput } from './workflow.types';
import type { CreateTaskInput } from './task.types';
import type { CommandInput } from './command.types';

/**
 * Generic IPC response wrapper
 */
export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Workspace IPC payloads
 */
export interface WorkspaceIPCPayloads {
  create: { input: CreateWorkspaceInput };
  createBulk: { input: BulkCreateWorkspaceInput };
  update: { id: string; input: UpdateWorkspaceInput };
  delete: { id: string };
  getAll: void;
  getById: { id: string };
}

/**
 * Browser IPC payloads
 */
export interface BrowserIPCPayloads {
  launch: { workspaceId: string };
  close: { workspaceId: string };
  closeAll: void;
  getAllActive: void;
  navigate: { workspaceId: string; url: string };
  screenshot: { workspaceId: string; path?: string };
}

/**
 * Proxy IPC payloads
 */
export interface ProxyIPCPayloads {
  create: { input: CreateProxyInput };
  getAll: void;
  getById: { id: string };
  test: { id: string };
  delete: { id: string };
  bulkImport: { input: BulkProxyImport };
}

/**
 * Workflow IPC payloads
 */
export interface WorkflowIPCPayloads {
  create: { input: CreateWorkflowInput };
  getAll: void;
  getById: { id: string };
  update: { id: string; input: Partial<CreateWorkflowInput> };
  delete: { id: string };
}

/**
 * Task IPC payloads
 */
export interface TaskIPCPayloads {
  create: { input: CreateTaskInput };
  execute: { taskId: string };
  getAll: void;
  getById: { id: string };
  getRunning: void;
  cancel: { id: string };
  pause: { id: string };
  resume: { id: string };
}

/**
 * Command IPC payloads
 */
export interface CommandIPCPayloads {
  execute: { input: CommandInput };
  parse: { command: string };
}

/**
 * System statistics
 */
export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  networkUsage: number;
  activeBrowsers: number;
  runningTasks: number;
  totalWorkspaces: number;
  proxyHealth: number;
}

/**
 * System health status
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  database: boolean;
  automation: boolean;
  proxies: boolean;
  lastCheck: string;
}

/**
 * Active browser information
 */
export interface ActiveBrowser {
  workspaceId: string;
  workspaceName: string;
  status: 'active' | 'idle' | 'loading' | 'error';
  currentUrl?: string;
  launchedAt: string;
}

/**
 * Notification event
 */
export interface NotificationEvent {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
