/**
 * @fileoverview System IPC Handlers
 * @module electron/ipc/system
 *
 * Handles IPC communication for system operations.
 */

import { ipcMain } from 'electron';
import os from 'os';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { browserPool } from '../../automation/browser-manager';
import { WorkspaceService } from '../services/workspace.service';
import { TaskService } from '../services/task.service';
import { ProxyService } from '../services/proxy.service';
import { SystemStats, SystemHealth } from '../../shared/types/ipc.types';
import { logger } from '../utils/logger';

let workspaceService: WorkspaceService | null = null;
let taskService: TaskService | null = null;
let proxyService: ProxyService | null = null;

function getWorkspaceService(): WorkspaceService {
  if (!workspaceService) {
    workspaceService = new WorkspaceService();
  }
  return workspaceService;
}

function getTaskService(): TaskService {
  if (!taskService) {
    taskService = new TaskService();
  }
  return taskService;
}

function getProxyService(): ProxyService {
  if (!proxyService) {
    proxyService = new ProxyService();
  }
  return proxyService;
}

/**
 * Register system IPC handlers
 */
export function registerSystemHandlers(): void {
  logger.debug('Registering system IPC handlers');

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_STATS, async (): Promise<SystemStats> => {
    const cpuUsage = await getCpuUsage();
    const memoryUsage = getMemoryUsage();
    const activeBrowsers = browserPool.getCount();
    const runningTasks = await getTaskService().countRunning();
    const totalWorkspaces = await getWorkspaceService().count();
    const proxyHealth = await getProxyService().getHealthPercentage();

    return {
      cpuUsage,
      memoryUsage,
      networkUsage: 0,
      activeBrowsers,
      runningTasks,
      totalWorkspaces,
      proxyHealth,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_HEALTH, async (): Promise<SystemHealth> => {
    return {
      status: 'healthy',
      database: true,
      automation: browserPool.hasAvailableSlots(),
      proxies: (await getProxyService().getHealthPercentage()) > 50,
      lastCheck: new Date().toISOString(),
    };
  });

  logger.debug('System IPC handlers registered');
}

/**
 * Get CPU usage percentage
 */
async function getCpuUsage(): Promise<number> {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times) as (keyof typeof cpu.times)[]) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  return Math.round(((totalTick - totalIdle) / totalTick) * 100);
}

/**
 * Get memory usage percentage
 */
function getMemoryUsage(): number {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return Math.round(((totalMem - freeMem) / totalMem) * 100);
}
