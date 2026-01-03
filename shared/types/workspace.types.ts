/**
 * @fileoverview Workspace Type Definitions
 * @module shared/types/workspace
 *
 * Defines the core Workspace entity and related types used
 * throughout the application for browser workspace management.
 */

/**
 * Workspace status enumeration
 */
export enum WorkspaceStatus {
  IDLE = 'idle',
  ACTIVE = 'active',
  LOADING = 'loading',
  ERROR = 'error',
  PAUSED = 'paused',
}

/**
 * Viewport configuration for browser windows
 */
export interface Viewport {
  width: number;
  height: number;
}

/**
 * Workspace settings for anti-detection configuration
 */
export interface WorkspaceSettings {
  region?: string; // 'auto' for IP detection, or region ID like 'us-east'
}

/**
 * Core Workspace entity
 * Represents a browser automation workspace with configuration
 */
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  status: WorkspaceStatus;
  
  // Proxy assignment - PERMANENT for static IPs
  proxyId?: string;           // Assigned proxy ID
  proxyIp?: string;           // Cached IP for quick display
  proxyLocked?: boolean;      // If true, this workspace ONLY uses this proxy
  
  profileId?: string;
  fingerprintId?: string;
  initialUrl?: string;
  viewport: Viewport;
  userAgent?: string;
  tags: string[];
  settings?: WorkspaceSettings;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
  
  // Account tracking - for FarmOS integration
  accountEmail?: string;       // Gmail/account created with this workspace
  youtubeChannelId?: string;   // YouTube channel ID if created
}

/**
 * Input for creating a new workspace
 */
export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  proxyId?: string;
  profileId?: string;
  initialUrl?: string;
  viewport?: Viewport;
  userAgent?: string;
  tags?: string[];
}

/**
 * Input for updating an existing workspace
 */
export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  status?: WorkspaceStatus;
  proxyId?: string;
  profileId?: string;
  initialUrl?: string;
  viewport?: Viewport;
  userAgent?: string;
  tags?: string[];
}

/**
 * Workspace with additional runtime information
 */
export interface WorkspaceWithStatus extends Workspace {
  isLaunched: boolean;
  currentUrl?: string;
  screenshotPath?: string;
}

/**
 * Bulk workspace creation input
 */
export interface BulkCreateWorkspaceInput {
  count: number;
  namePrefix?: string;
  proxyId?: string;
  initialUrl?: string;
  viewport?: Viewport;
}
