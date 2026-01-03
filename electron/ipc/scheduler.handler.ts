import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { CommandService } from '../services/command.service';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface ScheduleConfig {
  type: 'once' | 'interval' | 'daily' | 'weekly' | 'cron';
  runAt?: string;
  intervalMs?: number;
  timeOfDay?: { hour: number; minute: number };
  dayOfWeek?: number;
  cronExpression?: string;
}

interface StoredScheduledTask {
  id: string;
  name: string;
  command: string;
  scheduleType: 'once' | 'interval' | 'daily' | 'weekly' | 'cron';
  scheduleValue: string;
  schedule: ScheduleConfig;
  enabled: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  createdAt: string;
}

// In-memory storage for scheduled tasks
const scheduledTasks = new Map<string, StoredScheduledTask>();
const taskTimers = new Map<string, NodeJS.Timeout>();

// Command service instance
let commandService: CommandService | null = null;

function getCommandService(): CommandService {
  if (!commandService) {
    commandService = new CommandService();
  }
  return commandService;
}

function calculateNextRun(task: StoredScheduledTask): string {
  const now = new Date();
  switch (task.schedule.type) {
    case 'interval': {
      const intervalMs = task.schedule.intervalMs || 3600000;
      return new Date(now.getTime() + intervalMs).toISOString();
    }
    case 'daily': {
      const next = new Date(now);
      next.setHours(task.schedule.timeOfDay?.hour || 9, task.schedule.timeOfDay?.minute || 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
    case 'weekly': {
      const next = new Date(now);
      const targetDay = task.schedule.dayOfWeek || 0;
      const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
      next.setDate(now.getDate() + daysUntil);
      next.setHours(task.schedule.timeOfDay?.hour || 9, task.schedule.timeOfDay?.minute || 0, 0, 0);
      return next.toISOString();
    }
    case 'once': {
      return task.schedule.runAt || now.toISOString();
    }
    default:
      return now.toISOString();
  }
}

function scheduleTaskExecution(task: StoredScheduledTask): void {
  // Clear existing timer if any
  const existingTimer = taskTimers.get(task.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
    taskTimers.delete(task.id);
  }
  
  if (!task.enabled) return;
  
  const nextRun = new Date(task.nextRun || calculateNextRun(task));
  const now = new Date();
  const delay = Math.max(0, nextRun.getTime() - now.getTime());
  
  logger.info(`Scheduling task "${task.name}" to run in ${Math.round(delay / 1000)}s`);
  
  const timer = setTimeout(async () => {
    await executeScheduledTask(task);
  }, delay);
  
  taskTimers.set(task.id, timer);
}

async function executeScheduledTask(task: StoredScheduledTask): Promise<void> {
  const storedTask = scheduledTasks.get(task.id);
  if (!storedTask || !storedTask.enabled) return;
  
  logger.info(`Executing scheduled task: ${task.name}`);
  storedTask.status = 'running';
  storedTask.lastRun = new Date().toISOString();
  
  try {
    const service = getCommandService();
    await service.execute({ raw: task.command });
    
    storedTask.status = 'completed';
    storedTask.runCount++;
    logger.info(`Scheduled task "${task.name}" completed successfully`);
  } catch (error) {
    logger.error(`Scheduled task "${task.name}" failed:`, error);
    storedTask.status = 'failed';
  }
  
  // Schedule next run for recurring tasks
  if (task.schedule.type !== 'once' && storedTask.enabled) {
    storedTask.nextRun = calculateNextRun(storedTask);
    storedTask.status = 'pending';
    scheduleTaskExecution(storedTask);
  }
}

export function registerSchedulerHandlers(): void {
  logger.info('Registering scheduler handlers');

  // Create scheduled task
  ipcMain.handle('scheduler:create', async (_event, input: {
    name: string;
    command: string;
    schedule: ScheduleConfig;
    enabled?: boolean;
  }) => {
    const id = uuidv4();
    
    const scheduleType = input.schedule.type;
    let scheduleValue = '';
    
    switch (scheduleType) {
      case 'daily':
        scheduleValue = `${input.schedule.timeOfDay?.hour || 9}:${String(input.schedule.timeOfDay?.minute || 0).padStart(2, '0')}`;
        break;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        scheduleValue = `${days[input.schedule.dayOfWeek || 0]} ${input.schedule.timeOfDay?.hour || 9}:${String(input.schedule.timeOfDay?.minute || 0).padStart(2, '0')}`;
        break;
      case 'interval':
        const ms = input.schedule.intervalMs || 3600000;
        if (ms >= 86400000) {
          scheduleValue = `${Math.floor(ms / 86400000)}d`;
        } else if (ms >= 3600000) {
          scheduleValue = `${Math.floor(ms / 3600000)}h`;
        } else {
          scheduleValue = `${Math.floor(ms / 60000)}m`;
        }
        break;
      case 'once':
        scheduleValue = input.schedule.runAt || '';
        break;
      case 'cron':
        scheduleValue = input.schedule.cronExpression || '';
        break;
    }
    
    const task: StoredScheduledTask = {
      id,
      name: input.name,
      command: input.command,
      scheduleType,
      scheduleValue,
      schedule: input.schedule,
      enabled: input.enabled !== false,
      status: 'pending',
      runCount: 0,
      createdAt: new Date().toISOString(),
    };
    
    task.nextRun = calculateNextRun(task);
    scheduledTasks.set(id, task);
    
    // Schedule the task if enabled
    if (task.enabled) {
      scheduleTaskExecution(task);
    }
    
    logger.info(`Created scheduled task: ${task.name} (${id})`);
    return task;
  });

  // Get all scheduled tasks
  ipcMain.handle('scheduler:getAll', async () => {
    return Array.from(scheduledTasks.values());
  });

  // Get single scheduled task
  ipcMain.handle(IPC_CHANNELS.SCHEDULER_GET_BY_ID, async (_event, id: string) => {
    return scheduledTasks.get(id);
  });

  // Pause scheduled task
  ipcMain.handle('scheduler:pause', async (_event, id: string) => {
    const task = scheduledTasks.get(id);
    if (task) {
      task.enabled = false;
      task.status = 'paused';
      
      // Clear timer
      const timer = taskTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        taskTimers.delete(id);
      }
      
      logger.info(`Paused scheduled task: ${task.name}`);
    }
    return task;
  });

  // Resume scheduled task
  ipcMain.handle('scheduler:resume', async (_event, id: string) => {
    const task = scheduledTasks.get(id);
    if (task) {
      task.enabled = true;
      task.status = 'pending';
      task.nextRun = calculateNextRun(task);
      
      // Re-schedule the task
      scheduleTaskExecution(task);
      
      logger.info(`Resumed scheduled task: ${task.name}`);
    }
    return task;
  });

  // Cancel/delete scheduled task
  ipcMain.handle('scheduler:cancel', async (_event, id: string) => {
    const task = scheduledTasks.get(id);
    if (task) {
      // Clear timer
      const timer = taskTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        taskTimers.delete(id);
      }
      
      scheduledTasks.delete(id);
      logger.info(`Deleted scheduled task: ${task.name}`);
    }
    return { success: true };
  });

  // Update scheduled task
  ipcMain.handle(IPC_CHANNELS.SCHEDULER_UPDATE, async (_event, id: string, updates: Partial<StoredScheduledTask>) => {
    const task = scheduledTasks.get(id);
    if (task) {
      Object.assign(task, updates);
      logger.info(`Updated scheduled task: ${task.name}`);
    }
    return task;
  });

  logger.info('Scheduler handlers registered');
}
