/**
 * @fileoverview Enterprise Resource Monitoring System
 * @module automation/monitoring/resource-monitor
 * 
 * Professional-grade resource monitoring with CPU/RAM tracking,
 * browser metrics, and performance alerts.
 */

import { EventEmitter } from 'events';
import * as os from 'os';

export interface ResourceMetrics {
  timestamp: number;
  cpu: {
    usage: number;          // 0-100 percentage
    cores: number;
    model: string;
  };
  memory: {
    total: number;          // bytes
    used: number;           // bytes
    free: number;           // bytes
    usagePercent: number;   // 0-100
  };
  browsers: BrowserMetrics[];
  system: {
    uptime: number;         // seconds
    platform: string;
    arch: string;
    hostname: string;
  };
}

export interface BrowserMetrics {
  browserId: string;
  workspaceId?: string;
  pid?: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  pages: number;
  status: 'active' | 'idle' | 'loading';
  lastActivity: number;
}

export interface AlertThreshold {
  metric: 'cpu' | 'memory' | 'browserMemory';
  operator: 'gt' | 'lt' | 'eq';
  value: number;
  duration: number;        // seconds to sustain before alert
  severity: 'info' | 'warning' | 'critical';
}

export interface Alert {
  id: string;
  threshold: AlertThreshold;
  triggeredAt: number;
  currentValue: number;
  message: string;
  resolved: boolean;
  resolvedAt?: number;
}

export interface MonitorConfig {
  pollingInterval: number;    // ms
  historySize: number;        // number of samples to keep
  alertThresholds: AlertThreshold[];
}

const DEFAULT_CONFIG: MonitorConfig = {
  pollingInterval: 5000,      // 5 seconds
  historySize: 360,           // 30 minutes at 5s interval
  alertThresholds: [
    { metric: 'cpu', operator: 'gt', value: 90, duration: 30, severity: 'warning' },
    { metric: 'cpu', operator: 'gt', value: 95, duration: 10, severity: 'critical' },
    { metric: 'memory', operator: 'gt', value: 85, duration: 60, severity: 'warning' },
    { metric: 'memory', operator: 'gt', value: 95, duration: 30, severity: 'critical' },
  ],
};

export class ResourceMonitor extends EventEmitter {
  private config: MonitorConfig;
  private history: ResourceMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private thresholdSustained: Map<string, number> = new Map(); // Threshold ID -> start time
  private intervalHandle?: ReturnType<typeof setInterval>;
  private browserMetricsCallback?: () => Promise<BrowserMetrics[]>;
  private lastCpuInfo?: { idle: number; total: number };

  constructor(config: Partial<MonitorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start monitoring
   */
  start(browserMetricsCallback?: () => Promise<BrowserMetrics[]>): void {
    if (this.intervalHandle) return;
    
    this.browserMetricsCallback = browserMetricsCallback;
    
    // Initial collection
    this.collectMetrics();
    
    // Start polling
    this.intervalHandle = setInterval(() => {
      this.collectMetrics();
    }, this.config.pollingInterval);
    
    console.log('[Monitor] Resource monitoring started');
    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
      console.log('[Monitor] Resource monitoring stopped');
      this.emit('stopped');
    }
  }

  /**
   * Collect current metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      
      // Add to history
      this.history.unshift(metrics);
      if (this.history.length > this.config.historySize) {
        this.history = this.history.slice(0, this.config.historySize);
      }
      
      // Check thresholds
      this.checkThresholds(metrics);
      
      // Emit metrics event
      this.emit('metrics', metrics);
      
    } catch (error) {
      console.error('[Monitor] Error collecting metrics:', error);
    }
  }

  /**
   * Get current metrics
   */
  async getMetrics(): Promise<ResourceMetrics> {
    const cpuUsage = this.getCpuUsage();
    const memInfo = this.getMemoryInfo();
    const browsers = await this.getBrowserMetrics();
    
    return {
      timestamp: Date.now(),
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
      },
      memory: memInfo,
      browsers,
      system: {
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
      },
    };
  }

  /**
   * Calculate CPU usage
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      totalIdle += cpu.times.idle;
      totalTick += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
    }
    
    if (!this.lastCpuInfo) {
      this.lastCpuInfo = { idle: totalIdle, total: totalTick };
      return 0;
    }
    
    const idleDelta = totalIdle - this.lastCpuInfo.idle;
    const totalDelta = totalTick - this.lastCpuInfo.total;
    
    this.lastCpuInfo = { idle: totalIdle, total: totalTick };
    
    if (totalDelta === 0) return 0;
    
    const usage = 100 - (100 * idleDelta / totalDelta);
    return Math.round(usage * 100) / 100;
  }

  /**
   * Get memory info
   */
  private getMemoryInfo(): ResourceMetrics['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    
    return {
      total,
      used,
      free,
      usagePercent: Math.round((used / total) * 10000) / 100,
    };
  }

  /**
   * Get browser metrics from callback
   */
  private async getBrowserMetrics(): Promise<BrowserMetrics[]> {
    if (this.browserMetricsCallback) {
      try {
        return await this.browserMetricsCallback();
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Check alert thresholds
   */
  private checkThresholds(metrics: ResourceMetrics): void {
    for (const threshold of this.config.alertThresholds) {
      const thresholdId = `${threshold.metric}-${threshold.operator}-${threshold.value}`;
      const value = this.getMetricValue(metrics, threshold.metric);
      const isViolated = this.isThresholdViolated(value, threshold);
      
      if (isViolated) {
        // Track sustained violation
        if (!this.thresholdSustained.has(thresholdId)) {
          this.thresholdSustained.set(thresholdId, Date.now());
        }
        
        const sustained = (Date.now() - this.thresholdSustained.get(thresholdId)!) / 1000;
        
        if (sustained >= threshold.duration && !this.alerts.has(thresholdId)) {
          // Create alert
          const alert: Alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            threshold,
            triggeredAt: Date.now(),
            currentValue: value,
            message: this.getAlertMessage(threshold, value),
            resolved: false,
          };
          
          this.alerts.set(thresholdId, alert);
          this.emit('alert', alert);
          console.warn(`[Monitor] Alert triggered: ${alert.message}`);
        }
      } else {
        // Clear sustained tracking
        this.thresholdSustained.delete(thresholdId);
        
        // Resolve existing alert
        const existingAlert = this.alerts.get(thresholdId);
        if (existingAlert && !existingAlert.resolved) {
          existingAlert.resolved = true;
          existingAlert.resolvedAt = Date.now();
          this.emit('alertResolved', existingAlert);
          console.log(`[Monitor] Alert resolved: ${existingAlert.message}`);
        }
      }
    }
  }

  /**
   * Get metric value for threshold check
   */
  private getMetricValue(metrics: ResourceMetrics, metric: AlertThreshold['metric']): number {
    switch (metric) {
      case 'cpu':
        return metrics.cpu.usage;
      case 'memory':
        return metrics.memory.usagePercent;
      case 'browserMemory':
        // Average browser memory
        if (metrics.browsers.length === 0) return 0;
        const totalMem = metrics.browsers.reduce((sum, b) => sum + b.memory.heapUsed, 0);
        return totalMem / metrics.browsers.length / (1024 * 1024); // MB
      default:
        return 0;
    }
  }

  /**
   * Check if threshold is violated
   */
  private isThresholdViolated(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case 'gt': return value > threshold.value;
      case 'lt': return value < threshold.value;
      case 'eq': return value === threshold.value;
      default: return false;
    }
  }

  /**
   * Generate alert message
   */
  private getAlertMessage(threshold: AlertThreshold, value: number): string {
    const ops = { gt: 'above', lt: 'below', eq: 'at' };
    const units = { cpu: '%', memory: '%', browserMemory: 'MB' };
    
    return `${threshold.severity.toUpperCase()}: ${threshold.metric} is ${ops[threshold.operator]} ${threshold.value}${units[threshold.metric]} (current: ${value.toFixed(1)}${units[threshold.metric]})`;
  }

  /**
   * Get metrics history
   */
  getHistory(limit?: number): ResourceMetrics[] {
    return limit ? this.history.slice(0, limit) : this.history;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  /**
   * Get all alerts (including resolved)
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts(): void {
    for (const [key, alert] of this.alerts) {
      if (alert.resolved) {
        this.alerts.delete(key);
      }
    }
  }

  /**
   * Add custom alert threshold
   */
  addThreshold(threshold: AlertThreshold): void {
    this.config.alertThresholds.push(threshold);
  }

  /**
   * Remove alert threshold
   */
  removeThreshold(metric: string, operator: string, value: number): boolean {
    const index = this.config.alertThresholds.findIndex(
      t => t.metric === metric && t.operator === operator && t.value === value
    );
    if (index !== -1) {
      this.config.alertThresholds.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    avgCpu: number;
    maxCpu: number;
    avgMemory: number;
    maxMemory: number;
    browserCount: number;
    alertCount: number;
  } {
    if (this.history.length === 0) {
      return { avgCpu: 0, maxCpu: 0, avgMemory: 0, maxMemory: 0, browserCount: 0, alertCount: 0 };
    }
    
    const cpus = this.history.map(m => m.cpu.usage);
    const mems = this.history.map(m => m.memory.usagePercent);
    
    return {
      avgCpu: cpus.reduce((a, b) => a + b, 0) / cpus.length,
      maxCpu: Math.max(...cpus),
      avgMemory: mems.reduce((a, b) => a + b, 0) / mems.length,
      maxMemory: Math.max(...mems),
      browserCount: this.history[0]?.browsers.length || 0,
      alertCount: this.getActiveAlerts().length,
    };
  }

  /**
   * Destroy monitor
   */
  destroy(): void {
    this.stop();
    this.history = [];
    this.alerts.clear();
    this.thresholdSustained.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
let monitorInstance: ResourceMonitor | null = null;

export function getResourceMonitor(config?: Partial<MonitorConfig>): ResourceMonitor {
  if (!monitorInstance) {
    monitorInstance = new ResourceMonitor(config);
  }
  return monitorInstance;
}

export function destroyResourceMonitor(): void {
  if (monitorInstance) {
    monitorInstance.destroy();
    monitorInstance = null;
  }
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration to human readable
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${Math.floor(seconds)}s`);
  
  return parts.join(' ');
}

