/**
 * @fileoverview Workflow Registry
 * @module automation/workflows
 *
 * Central registry of all pre-built workflows.
 * Exports workflow classes and utilities.
 */

// Pre-built workflows
export { YouTubeAdHandler } from './youtube-ad-handler';
export type { YouTubeAdType } from './youtube-ad-handler';
export { VideoWatcherWorkflow } from './video-watcher.workflow';
export type { VideoWatchResult } from './video-watcher.workflow';
export { GmailSignupWorkflow } from './gmail-signup.workflow';
export type { GmailSignupResult } from './gmail-signup.workflow';
export { YouTubeChannelWorkflow } from './youtube-channel.workflow';
export type { YouTubeChannelResult } from './youtube-channel.workflow';

// Workflow type enumeration
export enum WorkflowType {
  // Account Creation
  GMAIL_SIGNUP = 'gmail_signup',
  YOUTUBE_CHANNEL = 'youtube_channel',
  
  // Video Actions
  WATCH_VIDEO = 'watch_video',
  LIKE_VIDEO = 'like_video',
  SUBSCRIBE_CHANNEL = 'subscribe_channel',
  POST_COMMENT = 'post_comment',
  
  // Generic
  NAVIGATE = 'navigate',
  FILL_FORM = 'fill_form',
  EXTRACT_DATA = 'extract_data',
}

/**
 * Workflow metadata
 */
export interface WorkflowMeta {
  type: WorkflowType;
  name: string;
  description: string;
  category: 'account' | 'video' | 'social' | 'generic';
  requiresLogin: boolean;
}

/**
 * Available workflows with metadata
 */
export const WORKFLOW_REGISTRY: WorkflowMeta[] = [
  {
    type: WorkflowType.GMAIL_SIGNUP,
    name: 'Gmail Account Creation',
    description: 'Create a new Gmail account with auto-generated details',
    category: 'account',
    requiresLogin: false,
  },
  {
    type: WorkflowType.YOUTUBE_CHANNEL,
    name: 'YouTube Channel Creation',
    description: 'Create a YouTube channel with auto-generated name',
    category: 'account',
    requiresLogin: true,
  },
  {
    type: WorkflowType.WATCH_VIDEO,
    name: 'Watch YouTube Video',
    description: 'Watch a video with ad handling and human behavior',
    category: 'video',
    requiresLogin: false,
  },
  {
    type: WorkflowType.LIKE_VIDEO,
    name: 'Like Video',
    description: 'Like a YouTube video',
    category: 'video',
    requiresLogin: true,
  },
  {
    type: WorkflowType.SUBSCRIBE_CHANNEL,
    name: 'Subscribe to Channel',
    description: 'Subscribe to a YouTube channel',
    category: 'video',
    requiresLogin: true,
  },
  {
    type: WorkflowType.POST_COMMENT,
    name: 'Post Comment',
    description: 'Post a comment on a video',
    category: 'video',
    requiresLogin: true,
  },
  {
    type: WorkflowType.NAVIGATE,
    name: 'Navigate to URL',
    description: 'Navigate to a specified URL',
    category: 'generic',
    requiresLogin: false,
  },
  {
    type: WorkflowType.FILL_FORM,
    name: 'Fill Form',
    description: 'Fill a form with auto-generated data',
    category: 'generic',
    requiresLogin: false,
  },
  {
    type: WorkflowType.EXTRACT_DATA,
    name: 'Extract Data',
    description: 'Extract data from page elements',
    category: 'generic',
    requiresLogin: false,
  },
];

/**
 * Get workflow metadata by type
 */
export function getWorkflowMeta(type: WorkflowType): WorkflowMeta | undefined {
  return WORKFLOW_REGISTRY.find(w => w.type === type);
}

/**
 * Get workflows by category
 */
export function getWorkflowsByCategory(category: WorkflowMeta['category']): WorkflowMeta[] {
  return WORKFLOW_REGISTRY.filter(w => w.category === category);
}

