/**
 * @fileoverview Enterprise Proxy Management System
 * @module automation/proxy/proxy-manager
 * 
 * Professional-grade proxy management with rotation, health checks,
 * load balancing, and workspace assignment.
 */

import { EventEmitter } from 'events';
import { Proxy, ProxyStatus, ProxyType, ProxyProtocol, ProxyRotationMode } from '../../shared/types/proxy.types';

export interface ProxyAssignment {
  proxyId: string;
  workspaceId: string;
  browserId?: string;
  assignedAt: number;
  locked: boolean;            // If true, only this workspace can use
  expiresAt?: number;         // For temporary assignments
}

export interface ProxyHealthCheck {
  proxyId: string;
  status: ProxyStatus;
  latency?: number;           // ms
  lastChecked: number;
  consecutiveFailures: number;
  error?: string;
}

export interface ProxyPoolConfig {
  healthCheckInterval: number;      // ms
  healthCheckTimeout: number;       // ms
  maxConsecutiveFailures: number;   // Before marking offline
  rotationStrategy: ProxyRotationMode;
  stickySessionDuration: number;    // ms - how long to keep same proxy
}

const DEFAULT_CONFIG: ProxyPoolConfig = {
  healthCheckInterval: 60000,       // 1 minute
  healthCheckTimeout: 10000,        // 10 seconds
  maxConsecutiveFailures: 3,
  rotationStrategy: ProxyRotationMode.ROUND_ROBIN,
  stickySessionDuration: 300000,    // 5 minutes
};

export class ProxyManager extends EventEmitter {
  private proxies: Map<string, Proxy> = new Map();
  private assignments: Map<string, ProxyAssignment> = new Map(); // workspaceId -> assignment
  private healthChecks: Map<string, ProxyHealthCheck> = new Map();
  private config: ProxyPoolConfig;
  private healthCheckHandle?: ReturnType<typeof setInterval>;
  private rotationIndex = 0;
  private fetchProxiesCallback?: () => Promise<Proxy[]>;
  private updateProxyCallback?: (id: string, updates: Partial<Proxy>) => Promise<void>;

  constructor(config: Partial<ProxyPoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize with callbacks
   */
  initialize(
    fetchProxies: () => Promise<Proxy[]>,
    updateProxy: (id: string, updates: Partial<Proxy>) => Promise<void>
  ): void {
    this.fetchProxiesCallback = fetchProxies;
    this.updateProxyCallback = updateProxy;
    this.startHealthChecks();
    this.loadProxies();
  }

  /**
   * Load proxies from database
   */
  async loadProxies(): Promise<void> {
    if (!this.fetchProxiesCallback) return;
    
    try {
      const proxies = await this.fetchProxiesCallback();
      this.proxies.clear();
      for (const proxy of proxies) {
        this.proxies.set(proxy.id, proxy);
      }
      console.log(`[ProxyManager] Loaded ${proxies.length} proxies`);
    } catch (error) {
      console.error('[ProxyManager] Failed to load proxies:', error);
    }
  }

  /**
   * Add a proxy to the pool
   */
  addProxy(proxy: Proxy): void {
    this.proxies.set(proxy.id, proxy);
    this.emit('proxyAdded', proxy);
  }

  /**
   * Remove a proxy from the pool
   */
  removeProxy(proxyId: string): boolean {
    const removed = this.proxies.delete(proxyId);
    if (removed) {
      this.healthChecks.delete(proxyId);
      // Remove any assignments using this proxy
      for (const [workspaceId, assignment] of this.assignments) {
        if (assignment.proxyId === proxyId) {
          this.assignments.delete(workspaceId);
        }
      }
      this.emit('proxyRemoved', proxyId);
    }
    return removed;
  }

  /**
   * Assign a proxy to a workspace (permanent for static IPs)
   */
  assignToWorkspace(
    proxyId: string,
    workspaceId: string,
    options: { locked?: boolean; browserId?: string } = {}
  ): ProxyAssignment | null {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) return null;
    
    // Check if proxy is already assigned and locked
    const existingAssignment = this.getAssignmentByProxy(proxyId);
    if (existingAssignment && existingAssignment.locked && existingAssignment.workspaceId !== workspaceId) {
      console.warn(`[ProxyManager] Proxy ${proxyId} is locked to workspace ${existingAssignment.workspaceId}`);
      return null;
    }
    
    const assignment: ProxyAssignment = {
      proxyId,
      workspaceId,
      browserId: options.browserId,
      assignedAt: Date.now(),
      locked: options.locked ?? (proxy.type === ProxyType.STATIC), // Auto-lock static IPs
    };
    
    this.assignments.set(workspaceId, assignment);
    
    // Update proxy
    proxy.assignedToWorkspace = workspaceId;
    proxy.isLocked = assignment.locked;
    this.updateProxyCallback?.(proxyId, {
      assignedToWorkspace: workspaceId,
      isLocked: assignment.locked,
    });
    
    this.emit('proxyAssigned', assignment);
    console.log(`[ProxyManager] Proxy ${proxyId} assigned to workspace ${workspaceId} (locked: ${assignment.locked})`);
    
    return assignment;
  }

  /**
   * Unassign a proxy from a workspace
   */
  unassignFromWorkspace(workspaceId: string): boolean {
    const assignment = this.assignments.get(workspaceId);
    if (!assignment) return false;
    
    const proxy = this.proxies.get(assignment.proxyId);
    if (proxy) {
      proxy.assignedToWorkspace = undefined;
      proxy.isLocked = false;
      this.updateProxyCallback?.(assignment.proxyId, {
        assignedToWorkspace: undefined,
        isLocked: false,
      });
    }
    
    this.assignments.delete(workspaceId);
    this.emit('proxyUnassigned', { workspaceId, proxyId: assignment.proxyId });
    
    return true;
  }

  /**
   * Get proxy for a workspace
   */
  getProxyForWorkspace(workspaceId: string): Proxy | null {
    // Check if already assigned
    const assignment = this.assignments.get(workspaceId);
    if (assignment) {
      const proxy = this.proxies.get(assignment.proxyId);
      if (proxy && proxy.status !== ProxyStatus.OFFLINE) {
        return proxy;
      }
    }
    
    // Get next available proxy based on rotation strategy
    return this.getNextAvailableProxy(workspaceId);
  }

  /**
   * Get next available proxy based on rotation strategy
   */
  private getNextAvailableProxy(workspaceId?: string): Proxy | null {
    const available = this.getAvailableProxies();
    if (available.length === 0) return null;
    
    let proxy: Proxy;
    
    switch (this.config.rotationStrategy) {
      case ProxyRotationMode.ROUND_ROBIN:
        this.rotationIndex = (this.rotationIndex + 1) % available.length;
        proxy = available[this.rotationIndex];
        break;
        
      case ProxyRotationMode.RANDOM:
        proxy = available[Math.floor(Math.random() * available.length)];
        break;
        
      case ProxyRotationMode.LEAST_USED:
        proxy = available.sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0))[0];
        break;
        
      case ProxyRotationMode.FAILOVER:
        // Use first online proxy
        proxy = available.find(p => p.status === ProxyStatus.ONLINE) || available[0];
        break;
        
      default:
        proxy = available[0];
    }
    
    // Auto-assign if workspace provided
    if (workspaceId) {
      this.assignToWorkspace(proxy.id, workspaceId);
    }
    
    // Update usage count
    proxy.usageCount = (proxy.usageCount || 0) + 1;
    proxy.lastUsed = new Date().toISOString();
    
    return proxy;
  }

  /**
   * Get all available (online and not locked) proxies
   */
  getAvailableProxies(): Proxy[] {
    return Array.from(this.proxies.values()).filter(p => 
      p.status !== ProxyStatus.OFFLINE &&
      p.status !== ProxyStatus.ERROR &&
      !p.isLocked
    );
  }

  /**
   * Get all proxies
   */
  getAllProxies(): Proxy[] {
    return Array.from(this.proxies.values());
  }

  /**
   * Get proxies by type
   */
  getProxiesByType(type: ProxyType): Proxy[] {
    return Array.from(this.proxies.values()).filter(p => p.type === type);
  }

  /**
   * Get assignment by proxy ID
   */
  private getAssignmentByProxy(proxyId: string): ProxyAssignment | undefined {
    for (const assignment of this.assignments.values()) {
      if (assignment.proxyId === proxyId) {
        return assignment;
      }
    }
    return undefined;
  }

  /**
   * Get all assignments
   */
  getAllAssignments(): ProxyAssignment[] {
    return Array.from(this.assignments.values());
  }

  /**
   * Start health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckHandle) return;
    
    this.healthCheckHandle = setInterval(async () => {
      await this.runHealthChecks();
    }, this.config.healthCheckInterval);
    
    // Initial check
    setTimeout(() => this.runHealthChecks(), 5000);
    
    console.log('[ProxyManager] Health checks started');
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckHandle) {
      clearInterval(this.healthCheckHandle);
      this.healthCheckHandle = undefined;
      console.log('[ProxyManager] Health checks stopped');
    }
  }

  /**
   * Run health checks on all proxies
   */
  async runHealthChecks(): Promise<void> {
    const proxies = Array.from(this.proxies.values());
    console.log(`[ProxyManager] Running health checks on ${proxies.length} proxies`);
    
    const checks = proxies.map(proxy => this.checkProxyHealth(proxy));
    await Promise.all(checks);
    
    this.emit('healthChecksComplete', this.getHealthSummary());
  }

  /**
   * Check single proxy health
   */
  private async checkProxyHealth(proxy: Proxy): Promise<ProxyHealthCheck> {
    const startTime = Date.now();
    let check = this.healthChecks.get(proxy.id);
    
    if (!check) {
      check = {
        proxyId: proxy.id,
        status: ProxyStatus.UNKNOWN,
        lastChecked: startTime,
        consecutiveFailures: 0,
      };
    }
    
    try {
      // Simple connectivity test
      const latency = await this.testProxyConnectivity(proxy);
      
      check.status = ProxyStatus.ONLINE;
      check.latency = latency;
      check.consecutiveFailures = 0;
      check.error = undefined;
      
      // Update proxy status
      if (proxy.status !== ProxyStatus.ONLINE) {
        proxy.status = ProxyStatus.ONLINE;
        proxy.speed = latency;
        proxy.lastTested = new Date().toISOString();
        this.updateProxyCallback?.(proxy.id, { 
          status: ProxyStatus.ONLINE, 
          speed: latency,
          lastTested: proxy.lastTested,
        });
        this.emit('proxyOnline', proxy);
      }
      
    } catch (error) {
      check.consecutiveFailures++;
      check.error = (error as Error).message;
      
      if (check.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        check.status = ProxyStatus.OFFLINE;
        
        if (proxy.status !== ProxyStatus.OFFLINE) {
          proxy.status = ProxyStatus.OFFLINE;
          this.updateProxyCallback?.(proxy.id, { status: ProxyStatus.OFFLINE });
          this.emit('proxyOffline', proxy);
          console.warn(`[ProxyManager] Proxy ${proxy.id} marked offline after ${check.consecutiveFailures} failures`);
        }
      } else {
        check.status = ProxyStatus.ERROR;
      }
    }
    
    check.lastChecked = Date.now();
    this.healthChecks.set(proxy.id, check);
    
    return check;
  }

  /**
   * Test proxy connectivity
   */
  private async testProxyConnectivity(proxy: Proxy): Promise<number> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // Use dynamic import for http/https
      import('http').then(http => {
        const req = http.request({
          host: proxy.host,
          port: proxy.port,
          method: 'CONNECT',
          path: 'www.google.com:443',
          timeout: this.config.healthCheckTimeout,
          headers: proxy.username ? {
            'Proxy-Authorization': 'Basic ' + Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64'),
          } : {},
        });
        
        req.on('connect', () => {
          const latency = Date.now() - startTime;
          req.destroy();
          resolve(latency);
        });
        
        req.on('error', (err) => {
          reject(err);
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Connection timeout'));
        });
        
        req.end();
      }).catch(reject);
    });
  }

  /**
   * Format proxy URL for Playwright
   */
  formatProxyUrl(proxy: Proxy): string {
    const protocol = proxy.protocol || ProxyProtocol.HTTP;
    const auth = proxy.username && proxy.password 
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : '';
    return `${protocol}://${auth}${proxy.host}:${proxy.port}`;
  }

  /**
   * Get proxy configuration for Playwright
   */
  getPlaywrightProxyConfig(proxy: Proxy): {
    server: string;
    username?: string;
    password?: string;
  } {
    return {
      server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
      username: proxy.username,
      password: proxy.password,
    };
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    total: number;
    online: number;
    offline: number;
    error: number;
    unknown: number;
    avgLatency: number;
  } {
    const checks = Array.from(this.healthChecks.values());
    const online = checks.filter(c => c.status === ProxyStatus.ONLINE);
    const latencies = online.filter(c => c.latency).map(c => c.latency!);
    
    return {
      total: this.proxies.size,
      online: online.length,
      offline: checks.filter(c => c.status === ProxyStatus.OFFLINE).length,
      error: checks.filter(c => c.status === ProxyStatus.ERROR).length,
      unknown: checks.filter(c => c.status === ProxyStatus.UNKNOWN).length,
      avgLatency: latencies.length > 0 
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
        : 0,
    };
  }

  /**
   * Get health check for a proxy
   */
  getHealthCheck(proxyId: string): ProxyHealthCheck | undefined {
    return this.healthChecks.get(proxyId);
  }

  /**
   * Force rotation to next proxy
   */
  rotate(workspaceId: string): Proxy | null {
    this.unassignFromWorkspace(workspaceId);
    return this.getProxyForWorkspace(workspaceId);
  }

  /**
   * Destroy manager
   */
  destroy(): void {
    this.stopHealthChecks();
    this.proxies.clear();
    this.assignments.clear();
    this.healthChecks.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
let proxyManagerInstance: ProxyManager | null = null;

export function getProxyManager(config?: Partial<ProxyPoolConfig>): ProxyManager {
  if (!proxyManagerInstance) {
    proxyManagerInstance = new ProxyManager(config);
  }
  return proxyManagerInstance;
}

export function destroyProxyManager(): void {
  if (proxyManagerInstance) {
    proxyManagerInstance.destroy();
    proxyManagerInstance = null;
  }
}

