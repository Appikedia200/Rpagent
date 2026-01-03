/**
 * @fileoverview Auto-scaling System
 * @module automation/scaling/auto-scaler
 * 
 * Automatically scale browser instances based on workload,
 * system resources, and task queue depth.
 */

import { EventEmitter } from 'events';
import * as os from 'os';

export interface ScalingRule {
  id: string;
  name: string;
  metric: 'queue_depth' | 'cpu_usage' | 'memory_usage' | 'task_wait_time' | 'browser_count';
  operator: 'gt' | 'lt' | 'eq';
  threshold: number;
  action: 'scale_up' | 'scale_down';
  scaleAmount: number;
  cooldownMs: number;          // Min time between scaling actions
  enabled: boolean;
}

export interface ScalingConfig {
  minBrowsers: number;
  maxBrowsers: number;
  targetUtilization: number;   // Target CPU/memory % (0-100)
  scaleUpCooldown: number;     // ms
  scaleDownCooldown: number;   // ms
  metricsPollingInterval: number; // ms
  enableAutoScaling: boolean;
}

export interface ScalingMetrics {
  timestamp: number;
  browserCount: number;
  queueDepth: number;
  runningTasks: number;
  cpuUsage: number;
  memoryUsage: number;
  avgTaskWaitTime: number;
  avgTaskDuration: number;
}

export interface ScalingEvent {
  id: string;
  type: 'scale_up' | 'scale_down';
  ruleId?: string;
  previousCount: number;
  newCount: number;
  reason: string;
  timestamp: number;
}

const DEFAULT_CONFIG: ScalingConfig = {
  minBrowsers: 1,
  maxBrowsers: 50,
  targetUtilization: 70,
  scaleUpCooldown: 30000,      // 30 seconds
  scaleDownCooldown: 120000,   // 2 minutes
  metricsPollingInterval: 5000, // 5 seconds
  enableAutoScaling: true,
};

const DEFAULT_RULES: ScalingRule[] = [
  {
    id: 'rule_queue_depth_high',
    name: 'Scale up when queue is deep',
    metric: 'queue_depth',
    operator: 'gt',
    threshold: 10,
    action: 'scale_up',
    scaleAmount: 2,
    cooldownMs: 30000,
    enabled: true,
  },
  {
    id: 'rule_queue_depth_low',
    name: 'Scale down when queue is empty',
    metric: 'queue_depth',
    operator: 'eq',
    threshold: 0,
    action: 'scale_down',
    scaleAmount: 1,
    cooldownMs: 120000,
    enabled: true,
  },
  {
    id: 'rule_cpu_high',
    name: 'Scale down when CPU is high',
    metric: 'cpu_usage',
    operator: 'gt',
    threshold: 85,
    action: 'scale_down',
    scaleAmount: 2,
    cooldownMs: 60000,
    enabled: true,
  },
  {
    id: 'rule_memory_high',
    name: 'Scale down when memory is high',
    metric: 'memory_usage',
    operator: 'gt',
    threshold: 85,
    action: 'scale_down',
    scaleAmount: 2,
    cooldownMs: 60000,
    enabled: true,
  },
  {
    id: 'rule_wait_time_high',
    name: 'Scale up when tasks wait too long',
    metric: 'task_wait_time',
    operator: 'gt',
    threshold: 30000, // 30 seconds
    action: 'scale_up',
    scaleAmount: 3,
    cooldownMs: 30000,
    enabled: true,
  },
];

export class AutoScaler extends EventEmitter {
  private config: ScalingConfig;
  private rules: ScalingRule[] = [];
  private metricsHistory: ScalingMetrics[] = [];
  private scalingHistory: ScalingEvent[] = [];
  private lastScaleUp = 0;
  private lastScaleDown = 0;
  private lastRuleTriggered: Map<string, number> = new Map();
  private pollingInterval?: ReturnType<typeof setInterval>;
  private currentBrowserCount = 0;
  
  // Callbacks
  private getMetricsCallback?: () => Promise<Partial<ScalingMetrics>>;
  private scaleCallback?: (count: number) => Promise<void>;

  constructor(config: Partial<ScalingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = [...DEFAULT_RULES];
  }

  /**
   * Initialize with callbacks
   */
  initialize(
    getMetrics: () => Promise<Partial<ScalingMetrics>>,
    scale: (count: number) => Promise<void>
  ): void {
    this.getMetricsCallback = getMetrics;
    this.scaleCallback = scale;
  }

  /**
   * Start auto-scaling
   */
  start(): void {
    if (this.pollingInterval) return;
    
    this.pollingInterval = setInterval(async () => {
      await this.evaluate();
    }, this.config.metricsPollingInterval);
    
    console.log('[AutoScaler] Started');
    this.emit('started');
  }

  /**
   * Stop auto-scaling
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
      console.log('[AutoScaler] Stopped');
      this.emit('stopped');
    }
  }

  /**
   * Evaluate scaling rules
   */
  async evaluate(): Promise<void> {
    if (!this.config.enableAutoScaling) return;
    if (!this.getMetricsCallback) return;
    
    // Collect metrics
    const partialMetrics = await this.getMetricsCallback();
    const systemMetrics = this.getSystemMetrics();
    
    const metrics: ScalingMetrics = {
      timestamp: Date.now(),
      browserCount: partialMetrics.browserCount || this.currentBrowserCount,
      queueDepth: partialMetrics.queueDepth || 0,
      runningTasks: partialMetrics.runningTasks || 0,
      cpuUsage: systemMetrics.cpuUsage,
      memoryUsage: systemMetrics.memoryUsage,
      avgTaskWaitTime: partialMetrics.avgTaskWaitTime || 0,
      avgTaskDuration: partialMetrics.avgTaskDuration || 0,
    };
    
    this.currentBrowserCount = metrics.browserCount;
    this.recordMetrics(metrics);
    
    // Evaluate each rule
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      
      const shouldTrigger = this.evaluateRule(rule, metrics);
      if (shouldTrigger) {
        await this.executeRule(rule, metrics);
      }
    }
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(rule: ScalingRule, metrics: ScalingMetrics): boolean {
    // Check cooldown
    const lastTriggered = this.lastRuleTriggered.get(rule.id) || 0;
    if (Date.now() - lastTriggered < rule.cooldownMs) {
      return false;
    }
    
    // Get metric value
    let value: number;
    switch (rule.metric) {
      case 'queue_depth':
        value = metrics.queueDepth;
        break;
      case 'cpu_usage':
        value = metrics.cpuUsage;
        break;
      case 'memory_usage':
        value = metrics.memoryUsage;
        break;
      case 'task_wait_time':
        value = metrics.avgTaskWaitTime;
        break;
      case 'browser_count':
        value = metrics.browserCount;
        break;
      default:
        return false;
    }
    
    // Evaluate condition
    switch (rule.operator) {
      case 'gt':
        return value > rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  /**
   * Execute scaling action
   */
  private async executeRule(rule: ScalingRule, metrics: ScalingMetrics): Promise<void> {
    const now = Date.now();
    
    // Check global cooldowns
    if (rule.action === 'scale_up' && now - this.lastScaleUp < this.config.scaleUpCooldown) {
      return;
    }
    if (rule.action === 'scale_down' && now - this.lastScaleDown < this.config.scaleDownCooldown) {
      return;
    }
    
    // Calculate new count
    const currentCount = metrics.browserCount;
    let newCount: number;
    
    if (rule.action === 'scale_up') {
      newCount = Math.min(currentCount + rule.scaleAmount, this.config.maxBrowsers);
    } else {
      newCount = Math.max(currentCount - rule.scaleAmount, this.config.minBrowsers);
    }
    
    // Don't scale if already at limit
    if (newCount === currentCount) {
      return;
    }
    
    // Execute scaling
    console.log(`[AutoScaler] ${rule.action}: ${currentCount} -> ${newCount} (${rule.name})`);
    
    try {
      if (this.scaleCallback) {
        await this.scaleCallback(newCount);
      }
      
      // Record event
      const event: ScalingEvent = {
        id: `scale_${Date.now()}`,
        type: rule.action,
        ruleId: rule.id,
        previousCount: currentCount,
        newCount,
        reason: rule.name,
        timestamp: now,
      };
      
      this.scalingHistory.unshift(event);
      if (this.scalingHistory.length > 100) {
        this.scalingHistory = this.scalingHistory.slice(0, 100);
      }
      
      // Update cooldowns
      if (rule.action === 'scale_up') {
        this.lastScaleUp = now;
      } else {
        this.lastScaleDown = now;
      }
      this.lastRuleTriggered.set(rule.id, now);
      
      this.currentBrowserCount = newCount;
      this.emit('scaled', event);
      
    } catch (error) {
      console.error('[AutoScaler] Scaling failed:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): { cpuUsage: number; memoryUsage: number } {
    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
    
    // CPU usage (simplified - uses load average on Unix, 0 on Windows)
    const cpus = os.cpus();
    let cpuUsage = 0;
    
    if (cpus.length > 0) {
      const loadAvg = os.loadavg()[0]; // 1 minute load average
      cpuUsage = (loadAvg / cpus.length) * 100;
    }
    
    return {
      cpuUsage: Math.min(100, Math.max(0, cpuUsage)),
      memoryUsage: Math.round(memoryUsage * 10) / 10,
    };
  }

  /**
   * Record metrics
   */
  private recordMetrics(metrics: ScalingMetrics): void {
    this.metricsHistory.unshift(metrics);
    if (this.metricsHistory.length > 360) { // 30 minutes at 5s interval
      this.metricsHistory = this.metricsHistory.slice(0, 360);
    }
    this.emit('metrics', metrics);
  }

  /**
   * Add a scaling rule
   */
  addRule(rule: Omit<ScalingRule, 'id'>): ScalingRule {
    const fullRule: ScalingRule = {
      id: `rule_${Date.now()}`,
      ...rule,
    };
    this.rules.push(fullRule);
    return fullRule;
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update a rule
   */
  updateRule(ruleId: string, updates: Partial<ScalingRule>): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): ScalingRule[] {
    return this.rules;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): ScalingMetrics[] {
    return limit ? this.metricsHistory.slice(0, limit) : this.metricsHistory;
  }

  /**
   * Get scaling history
   */
  getScalingHistory(limit?: number): ScalingEvent[] {
    return limit ? this.scalingHistory.slice(0, limit) : this.scalingHistory;
  }

  /**
   * Update config
   */
  updateConfig(updates: Partial<ScalingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get config
   */
  getConfig(): ScalingConfig {
    return { ...this.config };
  }

  /**
   * Get current status
   */
  getStatus(): {
    enabled: boolean;
    browserCount: number;
    lastScaleUp: number;
    lastScaleDown: number;
    activeRules: number;
  } {
    return {
      enabled: this.config.enableAutoScaling,
      browserCount: this.currentBrowserCount,
      lastScaleUp: this.lastScaleUp,
      lastScaleDown: this.lastScaleDown,
      activeRules: this.rules.filter(r => r.enabled).length,
    };
  }

  /**
   * Manual scale
   */
  async manualScale(count: number): Promise<void> {
    const targetCount = Math.max(
      this.config.minBrowsers,
      Math.min(this.config.maxBrowsers, count)
    );
    
    if (this.scaleCallback) {
      await this.scaleCallback(targetCount);
      
      const event: ScalingEvent = {
        id: `scale_${Date.now()}`,
        type: targetCount > this.currentBrowserCount ? 'scale_up' : 'scale_down',
        previousCount: this.currentBrowserCount,
        newCount: targetCount,
        reason: 'Manual scaling',
        timestamp: Date.now(),
      };
      
      this.scalingHistory.unshift(event);
      this.currentBrowserCount = targetCount;
      this.emit('scaled', event);
    }
  }

  /**
   * Destroy
   */
  destroy(): void {
    this.stop();
    this.rules = [];
    this.metricsHistory = [];
    this.scalingHistory = [];
    this.removeAllListeners();
  }
}

// Singleton instance
let autoScalerInstance: AutoScaler | null = null;

export function getAutoScaler(config?: Partial<ScalingConfig>): AutoScaler {
  if (!autoScalerInstance) {
    autoScalerInstance = new AutoScaler(config);
  }
  return autoScalerInstance;
}

export function destroyAutoScaler(): void {
  if (autoScalerInstance) {
    autoScalerInstance.destroy();
    autoScalerInstance = null;
  }
}

