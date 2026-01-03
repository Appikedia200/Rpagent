/**
 * @fileoverview Enterprise Alert Management System
 * @module automation/alerts/alert-manager
 * 
 * Professional-grade alerting with multiple notification channels,
 * alert aggregation, and intelligent deduplication.
 */

import { EventEmitter } from 'events';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertChannel = 'ui' | 'sound' | 'desktop' | 'webhook' | 'email';
export type AlertCategory = 'task' | 'browser' | 'resource' | 'network' | 'captcha' | 'account' | 'system';

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  source: string;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  metadata?: Record<string, unknown>;
  actions?: AlertAction[];
  groupKey?: string;        // For aggregation
  count?: number;           // Number of similar alerts
}

export interface AlertAction {
  id: string;
  label: string;
  type: 'dismiss' | 'retry' | 'view' | 'custom';
  handler?: () => void | Promise<void>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    category?: AlertCategory[];
    severity?: AlertSeverity[];
    pattern?: string;           // Regex pattern for message
    source?: string[];
  };
  channels: AlertChannel[];
  throttleMs?: number;          // Min time between alerts
  aggregate?: boolean;          // Aggregate similar alerts
  enabled: boolean;
}

export interface AlertConfig {
  maxAlerts: number;
  maxAgeMs: number;
  defaultChannels: AlertChannel[];
  soundEnabled: boolean;
  desktopNotificationsEnabled: boolean;
  webhookUrl?: string;
  deduplicationWindowMs: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  maxAlerts: 500,
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  defaultChannels: ['ui', 'sound'],
  soundEnabled: true,
  desktopNotificationsEnabled: true,
  deduplicationWindowMs: 5000, // 5 seconds
};

export class AlertManager extends EventEmitter {
  private config: AlertConfig;
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private lastAlertTime: Map<string, number> = new Map(); // For throttling
  private alertBuffer: Map<string, Alert[]> = new Map(); // For aggregation

  constructor(config: Partial<AlertConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupDefaultRules();
    
    // Cleanup old alerts periodically
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Create and dispatch an alert
   */
  alert(
    title: string,
    message: string,
    options: {
      severity?: AlertSeverity;
      category?: AlertCategory;
      source?: string;
      metadata?: Record<string, unknown>;
      actions?: AlertAction[];
      groupKey?: string;
    } = {}
  ): Alert {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      message,
      severity: options.severity || 'info',
      category: options.category || 'system',
      source: options.source || 'unknown',
      timestamp: Date.now(),
      acknowledged: false,
      metadata: options.metadata,
      actions: options.actions,
      groupKey: options.groupKey || `${options.category}-${title}`,
      count: 1,
    };

    // Check for deduplication
    const existingAlert = this.findDuplicate(alert);
    if (existingAlert) {
      existingAlert.count = (existingAlert.count || 1) + 1;
      existingAlert.timestamp = Date.now();
      existingAlert.message = `${message} (×${existingAlert.count})`;
      this.emit('alertUpdated', existingAlert);
      return existingAlert;
    }

    // Add to alerts
    this.alerts.unshift(alert);
    this.trimAlerts();

    // Process rules
    this.processRules(alert);

    // Emit alert event
    this.emit('alert', alert);
    
    console.log(`[Alerts] ${alert.severity.toUpperCase()}: ${title} - ${message}`);
    
    return alert;
  }

  /**
   * Quick alert methods
   */
  info(title: string, message: string, source?: string): Alert {
    return this.alert(title, message, { severity: 'info', source });
  }

  warning(title: string, message: string, source?: string): Alert {
    return this.alert(title, message, { severity: 'warning', source });
  }

  error(title: string, message: string, source?: string): Alert {
    return this.alert(title, message, { severity: 'error', source });
  }

  critical(title: string, message: string, source?: string): Alert {
    return this.alert(title, message, { severity: 'critical', source });
  }

  /**
   * Task-specific alerts
   */
  taskFailed(taskId: string, error: string): Alert {
    return this.alert('Task Failed', error, {
      severity: 'error',
      category: 'task',
      source: taskId,
      actions: [
        { id: 'retry', label: 'Retry', type: 'retry' },
        { id: 'view', label: 'View Details', type: 'view' },
      ],
    });
  }

  taskCompleted(taskId: string, details?: string): Alert {
    return this.alert('Task Completed', details || 'Task finished successfully', {
      severity: 'info',
      category: 'task',
      source: taskId,
    });
  }

  /**
   * Browser-specific alerts
   */
  browserCrashed(browserId: string, reason?: string): Alert {
    return this.alert('Browser Crashed', reason || 'Browser instance terminated unexpectedly', {
      severity: 'error',
      category: 'browser',
      source: browserId,
      actions: [
        { id: 'restart', label: 'Restart', type: 'custom' },
      ],
    });
  }

  browserBlocked(browserId: string, reason: string): Alert {
    return this.alert('Browser Blocked', reason, {
      severity: 'warning',
      category: 'browser',
      source: browserId,
    });
  }

  /**
   * CAPTCHA alerts
   */
  captchaDetected(browserId: string, type: string): Alert {
    return this.alert('CAPTCHA Detected', `${type} CAPTCHA requires solving`, {
      severity: 'warning',
      category: 'captcha',
      source: browserId,
    });
  }

  captchaFailed(browserId: string, error: string): Alert {
    return this.alert('CAPTCHA Failed', error, {
      severity: 'error',
      category: 'captcha',
      source: browserId,
    });
  }

  /**
   * Resource alerts
   */
  resourceWarning(metric: string, value: number, threshold: number): Alert {
    return this.alert('Resource Warning', `${metric} at ${value.toFixed(1)}% (threshold: ${threshold}%)`, {
      severity: 'warning',
      category: 'resource',
      source: 'monitor',
    });
  }

  resourceCritical(metric: string, value: number, threshold: number): Alert {
    return this.alert('Resource Critical', `${metric} at ${value.toFixed(1)}% (threshold: ${threshold}%)`, {
      severity: 'critical',
      category: 'resource',
      source: 'monitor',
    });
  }

  /**
   * Acknowledge an alert
   */
  acknowledge(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    
    alert.acknowledged = true;
    alert.acknowledgedAt = Date.now();
    alert.acknowledgedBy = acknowledgedBy;
    
    this.emit('alertAcknowledged', alert);
    return true;
  }

  /**
   * Acknowledge all alerts
   */
  acknowledgeAll(acknowledgedBy?: string): number {
    let count = 0;
    for (const alert of this.alerts) {
      if (!alert.acknowledged) {
        alert.acknowledged = true;
        alert.acknowledgedAt = Date.now();
        alert.acknowledgedBy = acknowledgedBy;
        count++;
      }
    }
    if (count > 0) {
      this.emit('allAlertsAcknowledged');
    }
    return count;
  }

  /**
   * Get all alerts
   */
  getAlerts(options: {
    unacknowledgedOnly?: boolean;
    severity?: AlertSeverity[];
    category?: AlertCategory[];
    limit?: number;
  } = {}): Alert[] {
    let filtered = this.alerts;
    
    if (options.unacknowledgedOnly) {
      filtered = filtered.filter(a => !a.acknowledged);
    }
    
    if (options.severity?.length) {
      filtered = filtered.filter(a => options.severity!.includes(a.severity));
    }
    
    if (options.category?.length) {
      filtered = filtered.filter(a => options.category!.includes(a.category));
    }
    
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  }

  /**
   * Get unacknowledged count by severity
   */
  getUnacknowledgedCounts(): Record<AlertSeverity, number> {
    const counts: Record<AlertSeverity, number> = { info: 0, warning: 0, error: 0, critical: 0 };
    
    for (const alert of this.alerts) {
      if (!alert.acknowledged) {
        counts[alert.severity]++;
      }
    }
    
    return counts;
  }

  /**
   * Clear all alerts
   */
  clearAll(): void {
    this.alerts = [];
    this.emit('alertsCleared');
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledged(): number {
    const before = this.alerts.length;
    this.alerts = this.alerts.filter(a => !a.acknowledged);
    return before - this.alerts.length;
  }

  /**
   * Add an alert rule
   */
  addRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...rule,
    };
    this.rules.push(newRule);
    return newRule;
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
   * Get all rules
   */
  getRules(): AlertRule[] {
    return this.rules;
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Find duplicate alert for deduplication
   */
  private findDuplicate(alert: Alert): Alert | undefined {
    const windowStart = Date.now() - this.config.deduplicationWindowMs;
    
    return this.alerts.find(a => 
      a.groupKey === alert.groupKey &&
      a.timestamp > windowStart &&
      !a.acknowledged
    );
  }

  /**
   * Process alert rules
   */
  private processRules(alert: Alert): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (!this.matchesRule(alert, rule)) continue;
      
      // Check throttling
      const throttleKey = `${rule.id}-${alert.groupKey}`;
      if (rule.throttleMs) {
        const lastTime = this.lastAlertTime.get(throttleKey);
        if (lastTime && Date.now() - lastTime < rule.throttleMs) {
          continue; // Throttled
        }
        this.lastAlertTime.set(throttleKey, Date.now());
      }
      
      // Dispatch to channels
      for (const channel of rule.channels) {
        this.dispatchToChannel(alert, channel);
      }
    }
  }

  /**
   * Check if alert matches rule
   */
  private matchesRule(alert: Alert, rule: AlertRule): boolean {
    const { condition } = rule;
    
    if (condition.category?.length && !condition.category.includes(alert.category)) {
      return false;
    }
    
    if (condition.severity?.length && !condition.severity.includes(alert.severity)) {
      return false;
    }
    
    if (condition.source?.length && !condition.source.includes(alert.source)) {
      return false;
    }
    
    if (condition.pattern) {
      const regex = new RegExp(condition.pattern, 'i');
      if (!regex.test(alert.message)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Dispatch alert to channel
   */
  private dispatchToChannel(alert: Alert, channel: AlertChannel): void {
    switch (channel) {
      case 'ui':
        // Already emitted via event
        break;
        
      case 'sound':
        if (this.config.soundEnabled) {
          this.emit('playSound', alert.severity);
        }
        break;
        
      case 'desktop':
        if (this.config.desktopNotificationsEnabled) {
          this.emit('desktopNotification', {
            title: alert.title,
            body: alert.message,
            icon: this.getSeverityIcon(alert.severity),
          });
        }
        break;
        
      case 'webhook':
        if (this.config.webhookUrl) {
          this.sendWebhook(alert).catch(console.error);
        }
        break;
        
      case 'email':
        // Implement email sending
        this.emit('sendEmail', alert);
        break;
    }
  }

  /**
   * Send webhook
   */
  private async sendWebhook(alert: Alert): Promise<void> {
    if (!this.config.webhookUrl) return;
    
    try {
      // Using dynamic import to avoid issues in renderer
      const https = await import('https');
      const url = new URL(this.config.webhookUrl);
      
      const data = JSON.stringify({
        id: alert.id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        category: alert.category,
        timestamp: alert.timestamp,
        metadata: alert.metadata,
      });
      
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      console.error('[Alerts] Webhook failed:', error);
    }
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: AlertSeverity): string {
    switch (severity) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'critical': return '🚨';
    }
  }

  /**
   * Setup default rules
   */
  private setupDefaultRules(): void {
    // Critical alerts always get desktop notification
    this.addRule({
      name: 'Critical Desktop Notification',
      condition: { severity: ['critical'] },
      channels: ['ui', 'sound', 'desktop'],
      enabled: true,
    });
    
    // Error alerts get sound
    this.addRule({
      name: 'Error Sound',
      condition: { severity: ['error'] },
      channels: ['ui', 'sound'],
      throttleMs: 5000,
      enabled: true,
    });
    
    // Aggregate task failures
    this.addRule({
      name: 'Task Failure Aggregation',
      condition: { category: ['task'], severity: ['error'] },
      channels: ['ui'],
      aggregate: true,
      enabled: true,
    });
  }

  /**
   * Trim alerts to max size
   */
  private trimAlerts(): void {
    if (this.alerts.length > this.config.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.config.maxAlerts);
    }
  }

  /**
   * Cleanup old alerts
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.config.maxAgeMs;
    const before = this.alerts.length;
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
    
    const removed = before - this.alerts.length;
    if (removed > 0) {
      console.log(`[Alerts] Cleaned up ${removed} old alerts`);
    }
  }

  /**
   * Destroy manager
   */
  destroy(): void {
    this.alerts = [];
    this.rules = [];
    this.lastAlertTime.clear();
    this.alertBuffer.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
let alertManagerInstance: AlertManager | null = null;

export function getAlertManager(config?: Partial<AlertConfig>): AlertManager {
  if (!alertManagerInstance) {
    alertManagerInstance = new AlertManager(config);
  }
  return alertManagerInstance;
}

export function destroyAlertManager(): void {
  if (alertManagerInstance) {
    alertManagerInstance.destroy();
    alertManagerInstance = null;
  }
}

