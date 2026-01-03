/**
 * @fileoverview Enterprise Task Queue System
 * @module automation/queue/task-queue
 * 
 * Professional-grade priority queue for task execution with
 * concurrency control, rate limiting, and fair scheduling.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export enum TaskPriority {
  CRITICAL = 0,   // Highest - execute immediately
  HIGH = 1,       // High - execute as soon as possible
  NORMAL = 2,     // Normal - default priority
  LOW = 3,        // Low - execute when resources available
  BACKGROUND = 4, // Lowest - only when idle
}

export interface QueuedTask {
  id: string;
  command: string;
  priority: TaskPriority;
  workspaceId?: string;
  dependencies?: string[]; // Task IDs that must complete first
  status: 'queued' | 'waiting' | 'running' | 'completed' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
  metadata?: Record<string, unknown>;
}

export interface QueueConfig {
  maxConcurrent: number;       // Max concurrent tasks
  maxQueueSize: number;        // Max queue size (0 = unlimited)
  rateLimit?: {                // Rate limiting
    maxPerMinute: number;
    maxPerHour: number;
  };
  defaultRetries: number;      // Default retry count
  taskTimeout: number;         // Task timeout in ms
}

export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  avgWaitTime: number;
  avgExecutionTime: number;
  throughputPerMinute: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 10,
  maxQueueSize: 1000,
  defaultRetries: 2,
  taskTimeout: 300000, // 5 minutes
};

export class TaskQueue extends EventEmitter {
  private queue: QueuedTask[] = [];
  private running: Map<string, QueuedTask> = new Map();
  private completed: QueuedTask[] = [];
  private config: QueueConfig;
  private processing = false;
  private rateLimitWindow: number[] = [];
  private executeCallback: (task: QueuedTask) => Promise<unknown>;

  constructor(
    executeCallback: (task: QueuedTask) => Promise<unknown>,
    config: Partial<QueueConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.executeCallback = executeCallback;
    
    // Start processing loop
    this.startProcessingLoop();
    
    // Clean up rate limit window periodically
    setInterval(() => {
      const oneMinuteAgo = Date.now() - 60000;
      this.rateLimitWindow = this.rateLimitWindow.filter(t => t > oneMinuteAgo);
    }, 30000);
  }

  /**
   * Add a task to the queue
   */
  enqueue(
    command: string,
    options: {
      priority?: TaskPriority;
      workspaceId?: string;
      dependencies?: string[];
      maxRetries?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): QueuedTask {
    // Check queue size limit
    if (this.config.maxQueueSize > 0 && this.queue.length >= this.config.maxQueueSize) {
      throw new Error(`Queue is full (max: ${this.config.maxQueueSize})`);
    }

    const task: QueuedTask = {
      id: uuidv4(),
      command,
      priority: options.priority ?? TaskPriority.NORMAL,
      workspaceId: options.workspaceId,
      dependencies: options.dependencies,
      status: 'queued',
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.defaultRetries,
      createdAt: Date.now(),
      metadata: options.metadata,
    };

    // Insert in priority order
    const insertIndex = this.queue.findIndex(t => t.priority > task.priority);
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    this.emit('taskQueued', task);
    console.log(`[Queue] Task queued: ${task.id} (priority: ${TaskPriority[task.priority]})`);

    return task;
  }

  /**
   * Enqueue multiple tasks at once
   */
  enqueueBatch(
    tasks: Array<{ command: string; priority?: TaskPriority; workspaceId?: string }>
  ): QueuedTask[] {
    return tasks.map(t => this.enqueue(t.command, {
      priority: t.priority,
      workspaceId: t.workspaceId,
    }));
  }

  /**
   * Cancel a queued task
   */
  cancel(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.id === taskId);
    if (index !== -1) {
      const [task] = this.queue.splice(index, 1);
      task.status = 'cancelled';
      this.emit('taskCancelled', task);
      return true;
    }
    return false;
  }

  /**
   * Cancel all queued tasks
   */
  cancelAll(): number {
    const count = this.queue.length;
    for (const task of this.queue) {
      task.status = 'cancelled';
      this.emit('taskCancelled', task);
    }
    this.queue = [];
    return count;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const completed = this.completed.filter(t => t.status === 'completed');
    const failed = this.completed.filter(t => t.status === 'failed');
    
    const waitTimes = completed
      .filter(t => t.startedAt)
      .map(t => t.startedAt! - t.createdAt);
    
    const executionTimes = completed
      .filter(t => t.startedAt && t.completedAt)
      .map(t => t.completedAt! - t.startedAt!);
    
    const oneMinuteAgo = Date.now() - 60000;
    const recentCompleted = completed.filter(t => t.completedAt && t.completedAt > oneMinuteAgo);
    
    return {
      queued: this.queue.length,
      running: this.running.size,
      completed: completed.length,
      failed: failed.length,
      avgWaitTime: waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0,
      avgExecutionTime: executionTimes.length > 0 ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length : 0,
      throughputPerMinute: recentCompleted.length,
    };
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): QueuedTask | undefined {
    return (
      this.queue.find(t => t.id === taskId) ||
      this.running.get(taskId) ||
      this.completed.find(t => t.id === taskId)
    );
  }

  /**
   * Get all tasks by status
   */
  getTasksByStatus(status: QueuedTask['status']): QueuedTask[] {
    if (status === 'queued' || status === 'waiting') {
      return this.queue.filter(t => t.status === status);
    }
    if (status === 'running') {
      return Array.from(this.running.values());
    }
    return this.completed.filter(t => t.status === status);
  }

  /**
   * Check if rate limit allows execution
   */
  private canExecute(): boolean {
    if (!this.config.rateLimit) return true;
    
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    
    const lastMinute = this.rateLimitWindow.filter(t => t > oneMinuteAgo);
    const lastHour = this.rateLimitWindow.filter(t => t > oneHourAgo);
    
    return (
      lastMinute.length < this.config.rateLimit.maxPerMinute &&
      lastHour.length < this.config.rateLimit.maxPerHour
    );
  }

  /**
   * Check if a task's dependencies are satisfied
   */
  private areDependenciesSatisfied(task: QueuedTask): boolean {
    if (!task.dependencies || task.dependencies.length === 0) return true;
    
    return task.dependencies.every(depId => {
      const dep = this.completed.find(t => t.id === depId);
      return dep && dep.status === 'completed';
    });
  }

  /**
   * Get next task to execute
   */
  private getNextTask(): QueuedTask | undefined {
    // Find first task that can be executed
    for (let i = 0; i < this.queue.length; i++) {
      const task = this.queue[i];
      if (task.status === 'queued' && this.areDependenciesSatisfied(task)) {
        return task;
      }
      if (task.status === 'queued' && !this.areDependenciesSatisfied(task)) {
        task.status = 'waiting';
      }
    }
    return undefined;
  }

  /**
   * Start the processing loop
   */
  private startProcessingLoop(): void {
    setInterval(async () => {
      await this.processQueue();
    }, 100); // Check queue every 100ms
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    if (this.running.size >= this.config.maxConcurrent) return;
    if (!this.canExecute()) return;
    
    this.processing = true;
    
    try {
      while (
        this.running.size < this.config.maxConcurrent &&
        this.queue.length > 0 &&
        this.canExecute()
      ) {
        const task = this.getNextTask();
        if (!task) break;
        
        // Remove from queue
        const index = this.queue.indexOf(task);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        
        // Execute task (don't await - run concurrently)
        this.executeTask(task).catch(console.error);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: QueuedTask): Promise<void> {
    task.status = 'running';
    task.startedAt = Date.now();
    this.running.set(task.id, task);
    this.rateLimitWindow.push(Date.now());
    
    this.emit('taskStarted', task);
    console.log(`[Queue] Task started: ${task.id}`);
    
    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.config.taskTimeout);
      });
      
      // Execute with timeout
      const result = await Promise.race([
        this.executeCallback(task),
        timeoutPromise,
      ]);
      
      task.status = 'completed';
      task.completedAt = Date.now();
      task.result = result;
      
      this.emit('taskCompleted', task);
      console.log(`[Queue] Task completed: ${task.id}`);
      
    } catch (error) {
      const err = error as Error;
      console.error(`[Queue] Task failed: ${task.id}`, err);
      
      // Retry logic
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = 'queued';
        
        // Add back to queue with delay
        setTimeout(() => {
          const insertIndex = this.queue.findIndex(t => t.priority > task.priority);
          if (insertIndex === -1) {
            this.queue.push(task);
          } else {
            this.queue.splice(insertIndex, 0, task);
          }
          this.emit('taskRetrying', task);
        }, 1000 * task.retryCount); // Exponential backoff
        
        console.log(`[Queue] Task retrying (${task.retryCount}/${task.maxRetries}): ${task.id}`);
      } else {
        task.status = 'failed';
        task.completedAt = Date.now();
        task.error = err.message;
        this.emit('taskFailed', task);
      }
    } finally {
      this.running.delete(task.id);
      
      // Add to completed history
      this.completed.unshift(task);
      if (this.completed.length > 1000) {
        this.completed = this.completed.slice(0, 1000);
      }
    }
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.config.maxConcurrent = 0;
    this.emit('paused');
  }

  /**
   * Resume queue processing
   */
  resume(maxConcurrent = 10): void {
    this.config.maxConcurrent = maxConcurrent;
    this.emit('resumed');
  }

  /**
   * Clear completed/failed tasks
   */
  clearHistory(): void {
    this.completed = [];
  }

  /**
   * Destroy the queue
   */
  destroy(): void {
    this.queue = [];
    this.running.clear();
    this.completed = [];
    this.removeAllListeners();
  }
}

// Singleton instance
let queueInstance: TaskQueue | null = null;

export function getTaskQueue(
  executeCallback?: (task: QueuedTask) => Promise<unknown>,
  config?: Partial<QueueConfig>
): TaskQueue {
  if (!queueInstance && executeCallback) {
    queueInstance = new TaskQueue(executeCallback, config);
  }
  return queueInstance!;
}

export function destroyTaskQueue(): void {
  if (queueInstance) {
    queueInstance.destroy();
    queueInstance = null;
  }
}

