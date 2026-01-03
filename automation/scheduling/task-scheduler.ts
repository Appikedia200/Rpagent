/**
 * @fileoverview Enterprise Task Scheduler
 * @module automation/scheduling/task-scheduler
 * 
 * Professional-grade task scheduling system with cron support,
 * recurring tasks, and time-based execution.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledTask {
  id: string;
  name: string;
  command: string;
  schedule: TaskSchedule;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  maxRuns?: number; // null = infinite
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface TaskSchedule {
  type: 'once' | 'interval' | 'cron' | 'daily' | 'weekly';
  // For 'once' - specific datetime
  runAt?: string;
  // For 'interval' - milliseconds
  intervalMs?: number;
  // For 'cron' - cron expression
  cronExpression?: string;
  // For 'daily' - time of day
  timeOfDay?: { hour: number; minute: number };
  // For 'weekly' - day of week (0-6) and time
  dayOfWeek?: number;
  // Timezone
  timezone?: string;
}

export interface SchedulerEvents {
  taskScheduled: (task: ScheduledTask) => void;
  taskStarted: (task: ScheduledTask) => void;
  taskCompleted: (task: ScheduledTask) => void;
  taskFailed: (task: ScheduledTask, error: Error) => void;
  taskCancelled: (taskId: string) => void;
}

export class TaskScheduler extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private executeCallback: (command: string, taskId: string) => Promise<void>;
  
  constructor(executeCallback: (command: string, taskId: string) => Promise<void>) {
    super();
    this.executeCallback = executeCallback;
    this.startSchedulerLoop();
  }

  /**
   * Schedule a new task
   */
  scheduleTask(input: Omit<ScheduledTask, 'id' | 'runCount' | 'status' | 'createdAt'>): ScheduledTask {
    const task: ScheduledTask = {
      id: uuidv4(),
      ...input,
      runCount: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      nextRun: this.calculateNextRun(input.schedule),
    };

    this.tasks.set(task.id, task);
    this.scheduleExecution(task);
    
    this.emit('taskScheduled', task);
    console.log(`[Scheduler] Task scheduled: ${task.name} - Next run: ${task.nextRun}`);
    
    return task;
  }

  /**
   * Get all scheduled tasks
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a specific task
   */
  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Cancel a scheduled task
   */
  cancelTask(id: string): boolean {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    
    const deleted = this.tasks.delete(id);
    if (deleted) {
      this.emit('taskCancelled', id);
      console.log(`[Scheduler] Task cancelled: ${id}`);
    }
    return deleted;
  }

  /**
   * Pause a task
   */
  pauseTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    
    task.status = 'paused';
    task.enabled = false;
    return true;
  }

  /**
   * Resume a paused task
   */
  resumeTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    
    task.status = 'pending';
    task.enabled = true;
    task.nextRun = this.calculateNextRun(task.schedule);
    this.scheduleExecution(task);
    
    return true;
  }

  /**
   * Update a task's schedule
   */
  updateSchedule(id: string, schedule: TaskSchedule): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    
    // Cancel existing timer
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    
    task.schedule = schedule;
    task.nextRun = this.calculateNextRun(schedule);
    
    if (task.enabled) {
      this.scheduleExecution(task);
    }
    
    return true;
  }

  /**
   * Calculate the next run time based on schedule
   */
  private calculateNextRun(schedule: TaskSchedule): string | undefined {
    const now = new Date();
    
    switch (schedule.type) {
      case 'once':
        return schedule.runAt;
        
      case 'interval':
        if (schedule.intervalMs) {
          return new Date(now.getTime() + schedule.intervalMs).toISOString();
        }
        break;
        
      case 'daily':
        if (schedule.timeOfDay) {
          const next = new Date(now);
          next.setHours(schedule.timeOfDay.hour, schedule.timeOfDay.minute, 0, 0);
          if (next <= now) {
            next.setDate(next.getDate() + 1);
          }
          return next.toISOString();
        }
        break;
        
      case 'weekly':
        if (schedule.dayOfWeek !== undefined && schedule.timeOfDay) {
          const next = new Date(now);
          const daysUntilTarget = (schedule.dayOfWeek - now.getDay() + 7) % 7;
          next.setDate(now.getDate() + (daysUntilTarget || 7));
          next.setHours(schedule.timeOfDay.hour, schedule.timeOfDay.minute, 0, 0);
          return next.toISOString();
        }
        break;
        
      case 'cron':
        // Simplified cron parsing for common patterns
        return this.parseCronExpression(schedule.cronExpression || '');
    }
    
    return undefined;
  }

  /**
   * Parse cron expression (simplified)
   */
  private parseCronExpression(expression: string): string | undefined {
    // Support basic patterns: "0 * * * *" (hourly), "0 0 * * *" (daily at midnight)
    const parts = expression.split(' ');
    if (parts.length !== 5) return undefined;
    
    const [minute, hour] = parts;
    const now = new Date();
    const next = new Date(now);
    
    // Handle hourly
    if (hour === '*' && minute !== '*') {
      next.setMinutes(parseInt(minute), 0, 0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
      return next.toISOString();
    }
    
    // Handle daily
    if (hour !== '*' && minute !== '*') {
      next.setHours(parseInt(hour), parseInt(minute), 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next.toISOString();
    }
    
    // Default: run in 1 hour
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }

  /**
   * Schedule the execution of a task
   */
  private scheduleExecution(task: ScheduledTask): void {
    if (!task.enabled || !task.nextRun) return;
    
    const delay = new Date(task.nextRun).getTime() - Date.now();
    if (delay < 0) {
      // Past due - run immediately
      this.executeTask(task);
      return;
    }
    
    // Cap at 24 hours (we'll reschedule in the loop)
    const cappedDelay = Math.min(delay, 24 * 60 * 60 * 1000);
    
    const timer = setTimeout(() => {
      if (delay <= cappedDelay) {
        this.executeTask(task);
      } else {
        // Reschedule with remaining time
        task.nextRun = new Date(new Date(task.nextRun!).getTime()).toISOString();
        this.scheduleExecution(task);
      }
    }, cappedDelay);
    
    this.timers.set(task.id, timer);
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    if (!task.enabled) return;
    
    // Check max runs
    if (task.maxRuns && task.runCount >= task.maxRuns) {
      task.status = 'completed';
      this.cancelTask(task.id);
      return;
    }
    
    task.status = 'running';
    task.lastRun = new Date().toISOString();
    this.emit('taskStarted', task);
    
    console.log(`[Scheduler] Executing task: ${task.name}`);
    
    try {
      await this.executeCallback(task.command, task.id);
      
      task.runCount++;
      task.status = 'pending';
      
      // Schedule next run if recurring
      if (task.schedule.type !== 'once') {
        task.nextRun = this.calculateNextRun(task.schedule);
        this.scheduleExecution(task);
      } else {
        task.status = 'completed';
      }
      
      this.emit('taskCompleted', task);
      console.log(`[Scheduler] Task completed: ${task.name}`);
      
    } catch (error) {
      task.status = 'failed';
      this.emit('taskFailed', task, error as Error);
      console.error(`[Scheduler] Task failed: ${task.name}`, error);
      
      // Retry logic for recurring tasks
      if (task.schedule.type !== 'once') {
        task.nextRun = this.calculateNextRun(task.schedule);
        this.scheduleExecution(task);
      }
    }
  }

  /**
   * Background loop to check for due tasks
   */
  private startSchedulerLoop(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const task of this.tasks.values()) {
        if (!task.enabled || task.status === 'running') continue;
        
        if (task.nextRun && new Date(task.nextRun).getTime() <= now) {
          // Check if we don't already have a timer
          if (!this.timers.has(task.id)) {
            this.executeTask(task);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Cleanup all timers
   */
  destroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.tasks.clear();
  }
}

// Singleton instance
let schedulerInstance: TaskScheduler | null = null;

export function getScheduler(executeCallback?: (command: string, taskId: string) => Promise<void>): TaskScheduler {
  if (!schedulerInstance && executeCallback) {
    schedulerInstance = new TaskScheduler(executeCallback);
  }
  return schedulerInstance!;
}

export function destroyScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.destroy();
    schedulerInstance = null;
  }
}

