/**
 * @fileoverview Repository Index
 * @module electron/database/repositories
 *
 * Re-exports all repositories for convenient importing.
 */

export { BaseRepository, RepositoryError } from './base.repository';
export { WorkspaceRepository } from './workspace.repository';
export { ProxyRepository } from './proxy.repository';
export { WorkflowRepository } from './workflow.repository';
export { TaskRepository } from './task.repository';

