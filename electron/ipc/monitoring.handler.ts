import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';
import { browserPool } from '../../automation/browser-manager/browser-pool';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface BrowserMetric {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  cpu: number;
  memory: number;
  url: string;
  lastActivity: string;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
}

// Store alerts in memory
const alerts: Alert[] = [];

// Helper to add alerts
export function addAlert(type: Alert['type'], message: string): void {
  const alert: Alert = {
    id: uuidv4(),
    type,
    message,
    timestamp: new Date().toISOString(),
    resolved: false,
  };
  alerts.unshift(alert);
  
  // Keep only last 100 alerts
  while (alerts.length > 100) {
    alerts.pop();
  }
  
  logger.info(`Alert added: [${type}] ${message}`);
}

export function registerMonitoringHandlers(): void {
  logger.info('Registering monitoring handlers');

  // Get real-time browser metrics
  ipcMain.handle('monitoring:getBrowserMetrics', async (): Promise<BrowserMetric[]> => {
    const metrics: BrowserMetric[] = [];
    
    try {
      // Get all active browser instances from the pool
      const allBrowsers = browserPool.getAll();
      
      for (const browser of allBrowsers) {
        const page = browser.getPage();
        let url = '';
        let status: 'active' | 'idle' | 'error' = 'idle';
        
        try {
          if (page) {
            url = page.url();
            // Consider browser active if it has a non-empty URL
            status = url && url !== 'about:blank' ? 'active' : 'idle';
          }
        } catch (error) {
          status = 'error';
        }
        
        metrics.push({
          id: browser.id,
          name: `Browser ${browser.id.substring(0, 8)}`,
          status,
          cpu: Math.random() * 15 + 5, // Simulated - would need process-level access for real CPU
          memory: Math.floor(Math.random() * 200 + 100), // Simulated - would need process-level access
          url: url || 'about:blank',
          lastActivity: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Failed to get browser metrics:', error);
    }
    
    return metrics;
  });

  // Get all metrics (includes system metrics)
  ipcMain.handle(IPC_CHANNELS.MONITORING_GET_METRICS, async () => {
    const browsers = browserPool.getAll();
    const activeBrowsers = browsers.filter(b => {
      try {
        return b.getPage() !== null;
      } catch {
        return false;
      }
    }).length;
    
    return {
      cpu: Math.random() * 30 + 10, // Would use os-utils or similar for real values
      memory: Math.random() * 40 + 30,
      activeBrowsers,
      totalBrowsers: browsers.length,
      runningTasks: 0, // Would connect to task service
      uptime: process.uptime() * 1000,
    };
  });

  // Get alerts
  ipcMain.handle('monitoring:getAlerts', async (): Promise<Alert[]> => {
    return alerts.filter(a => !a.resolved);
  });

  // Clear single alert
  ipcMain.handle('monitoring:clearAlert', async (_event, alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
    return { success: true };
  });

  // Clear all alerts
  ipcMain.handle('monitoring:clearAllAlerts', async () => {
    alerts.forEach(a => a.resolved = true);
    return { success: true };
  });


  logger.info('Monitoring handlers registered');
}

// Export for use in other parts of the app
export { addAlert as createSystemAlert };
