/**
 * @fileoverview Enterprise Webhook Manager
 * @module automation/webhooks/webhook-manager
 * 
 * Professional-grade webhook handling for receiving and sending
 * HTTP callbacks with retry logic and signature verification.
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  secret?: string;              // For HMAC signature
  retries?: number;
  retryDelayMs?: number;
  timeout?: number;
  enabled: boolean;
  events: string[];             // Events to trigger on
  transform?: string;           // JS expression to transform payload
  createdAt: string;
  lastTriggered?: string;
  successCount: number;
  failureCount: number;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: unknown;
  metadata?: {
    taskId?: string;
    workspaceId?: string;
    browserId?: string;
    [key: string]: unknown;
  };
}

export interface WebhookResult {
  webhookId: string;
  success: boolean;
  statusCode?: number;
  response?: unknown;
  error?: string;
  duration: number;
  attempts: number;
  timestamp: string;
}

export interface IncomingWebhook {
  id: string;
  name: string;
  path: string;                 // URL path to listen on
  secret?: string;              // For signature verification
  handler: string;              // Command to execute
  enabled: boolean;
  createdAt: string;
  lastReceived?: string;
  receivedCount: number;
}

export interface WebhookManagerConfig {
  serverPort?: number;
  serverEnabled?: boolean;
  defaultTimeout?: number;
  defaultRetries?: number;
  maxPayloadSize?: number;
}

const DEFAULT_CONFIG: WebhookManagerConfig = {
  serverPort: 3456,
  serverEnabled: false,
  defaultTimeout: 30000,
  defaultRetries: 3,
  maxPayloadSize: 1024 * 1024, // 1MB
};

export class WebhookManager extends EventEmitter {
  private config: WebhookManagerConfig;
  private outgoingWebhooks: Map<string, WebhookConfig> = new Map();
  private incomingWebhooks: Map<string, IncomingWebhook> = new Map();
  private webhookHistory: WebhookResult[] = [];
  private maxHistorySize = 1000;
  private server?: http.Server;

  constructor(config: Partial<WebhookManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register an outgoing webhook
   */
  registerOutgoing(webhook: Omit<WebhookConfig, 'createdAt' | 'successCount' | 'failureCount'>): WebhookConfig {
    const fullWebhook: WebhookConfig = {
      ...webhook,
      createdAt: new Date().toISOString(),
      successCount: 0,
      failureCount: 0,
    };
    this.outgoingWebhooks.set(webhook.id, fullWebhook);
    console.log(`[Webhook] Registered outgoing webhook: ${webhook.name}`);
    return fullWebhook;
  }

  /**
   * Register an incoming webhook
   */
  registerIncoming(webhook: Omit<IncomingWebhook, 'createdAt' | 'receivedCount'>): IncomingWebhook {
    const fullWebhook: IncomingWebhook = {
      ...webhook,
      createdAt: new Date().toISOString(),
      receivedCount: 0,
    };
    this.incomingWebhooks.set(webhook.id, fullWebhook);
    console.log(`[Webhook] Registered incoming webhook: ${webhook.name} at ${webhook.path}`);
    return fullWebhook;
  }

  /**
   * Unregister a webhook
   */
  unregister(id: string): boolean {
    const outgoing = this.outgoingWebhooks.delete(id);
    const incoming = this.incomingWebhooks.delete(id);
    return outgoing || incoming;
  }

  /**
   * Get all webhooks
   */
  getAllOutgoing(): WebhookConfig[] {
    return Array.from(this.outgoingWebhooks.values());
  }

  getAllIncoming(): IncomingWebhook[] {
    return Array.from(this.incomingWebhooks.values());
  }

  /**
   * Trigger webhooks for an event
   */
  async trigger(event: string, data: unknown, metadata?: Record<string, unknown>): Promise<WebhookResult[]> {
    const results: WebhookResult[] = [];
    
    for (const webhook of this.outgoingWebhooks.values()) {
      if (!webhook.enabled || !webhook.events.includes(event)) continue;
      
      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
        metadata,
      };
      
      const result = await this.sendWebhook(webhook, payload);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Send a webhook
   */
  async sendWebhook(webhook: WebhookConfig, payload: WebhookPayload): Promise<WebhookResult> {
    const startTime = Date.now();
    const maxRetries = webhook.retries ?? this.config.defaultRetries ?? 3;
    const retryDelay = webhook.retryDelayMs ?? 1000;
    
    let lastError: Error | null = null;
    let statusCode: number | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Transform payload if needed
        const transformedPayload = webhook.transform 
          ? this.transformPayload(payload, webhook.transform)
          : payload;
        
        const result = await this.makeRequest(webhook, transformedPayload);
        statusCode = result.statusCode;
        
        if (result.statusCode >= 200 && result.statusCode < 300) {
          const webhookResult: WebhookResult = {
            webhookId: webhook.id,
            success: true,
            statusCode: result.statusCode,
            response: result.body,
            duration: Date.now() - startTime,
            attempts: attempt,
            timestamp: new Date().toISOString(),
          };
          
          webhook.successCount++;
          webhook.lastTriggered = new Date().toISOString();
          this.recordHistory(webhookResult);
          this.emit('webhookSuccess', webhookResult);
          
          return webhookResult;
        }
        
        lastError = new Error(`HTTP ${result.statusCode}`);
        
      } catch (error) {
        lastError = error as Error;
      }
      
      // Wait before retry
      if (attempt < maxRetries) {
        await this.sleep(retryDelay * attempt);
      }
    }
    
    // All retries failed
    const failureResult: WebhookResult = {
      webhookId: webhook.id,
      success: false,
      statusCode,
      error: lastError?.message,
      duration: Date.now() - startTime,
      attempts: maxRetries,
      timestamp: new Date().toISOString(),
    };
    
    webhook.failureCount++;
    this.recordHistory(failureResult);
    this.emit('webhookFailure', failureResult);
    
    return failureResult;
  }

  /**
   * Make HTTP request
   */
  private makeRequest(
    webhook: WebhookConfig,
    payload: unknown
  ): Promise<{ statusCode: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const url = new URL(webhook.url);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const data = JSON.stringify(payload);
      const signature = webhook.secret 
        ? this.generateSignature(data, webhook.secret)
        : undefined;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data).toString(),
        'User-Agent': 'RPA-Agent-Webhook/1.0',
        ...webhook.headers,
      };
      
      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: webhook.method,
        headers,
        timeout: webhook.timeout ?? this.config.defaultTimeout,
      };
      
      const req = httpModule.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let parsedBody: unknown = body;
          try {
            parsedBody = JSON.parse(body);
          } catch {
            // Keep as string
          }
          resolve({ statusCode: res.statusCode || 0, body: parsedBody });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(data);
      req.end();
    });
  }

  /**
   * Generate HMAC signature
   */
  private generateSignature(payload: string, secret: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Transform payload with JS expression
   */
  private transformPayload(payload: WebhookPayload, transform: string): unknown {
    try {
      const fn = new Function('payload', `return ${transform}`);
      return fn(payload);
    } catch (error) {
      console.error('[Webhook] Transform error:', error);
      return payload;
    }
  }

  /**
   * Start webhook server for incoming webhooks
   */
  startServer(port?: number): void {
    if (this.server) {
      console.warn('[Webhook] Server already running');
      return;
    }
    
    const serverPort = port ?? this.config.serverPort ?? 3456;
    
    this.server = http.createServer((req, res) => {
      this.handleIncomingRequest(req, res);
    });
    
    this.server.listen(serverPort, () => {
      console.log(`[Webhook] Server listening on port ${serverPort}`);
      this.emit('serverStarted', serverPort);
    });
  }

  /**
   * Stop webhook server
   */
  stopServer(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
      console.log('[Webhook] Server stopped');
      this.emit('serverStopped');
    }
  }

  /**
   * Handle incoming webhook request
   */
  private handleIncomingRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';
    
    // Find matching webhook
    const webhook = Array.from(this.incomingWebhooks.values())
      .find(w => w.enabled && url.startsWith(w.path));
    
    if (!webhook) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Webhook not found' }));
      return;
    }
    
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > (this.config.maxPayloadSize || 1024 * 1024)) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
      }
    });
    
    req.on('end', () => {
      // Verify signature if secret is set
      if (webhook.secret) {
        const signature = req.headers['x-webhook-signature'] as string;
        if (!signature || !this.verifySignature(body, signature, webhook.secret)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }
      }
      
      // Parse payload
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        payload = body;
      }
      
      // Update webhook stats
      webhook.receivedCount++;
      webhook.lastReceived = new Date().toISOString();
      
      // Emit event for handler
      this.emit('webhookReceived', {
        webhookId: webhook.id,
        handler: webhook.handler,
        payload,
        headers: req.headers,
        timestamp: new Date().toISOString(),
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, received: new Date().toISOString() }));
    });
  }

  /**
   * Record webhook history
   */
  private recordHistory(result: WebhookResult): void {
    this.webhookHistory.unshift(result);
    if (this.webhookHistory.length > this.maxHistorySize) {
      this.webhookHistory = this.webhookHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get webhook history
   */
  getHistory(limit?: number): WebhookResult[] {
    return limit ? this.webhookHistory.slice(0, limit) : this.webhookHistory;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.webhookHistory = [];
  }

  /**
   * Get webhook stats
   */
  getStats(): {
    outgoing: { total: number; enabled: number; successRate: number };
    incoming: { total: number; enabled: number; totalReceived: number };
  } {
    const outgoing = Array.from(this.outgoingWebhooks.values());
    const incoming = Array.from(this.incomingWebhooks.values());
    
    const totalSuccess = outgoing.reduce((sum, w) => sum + w.successCount, 0);
    const totalFailure = outgoing.reduce((sum, w) => sum + w.failureCount, 0);
    const totalAttempts = totalSuccess + totalFailure;
    
    return {
      outgoing: {
        total: outgoing.length,
        enabled: outgoing.filter(w => w.enabled).length,
        successRate: totalAttempts > 0 ? totalSuccess / totalAttempts : 0,
      },
      incoming: {
        total: incoming.length,
        enabled: incoming.filter(w => w.enabled).length,
        totalReceived: incoming.reduce((sum, w) => sum + w.receivedCount, 0),
      },
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Destroy manager
   */
  destroy(): void {
    this.stopServer();
    this.outgoingWebhooks.clear();
    this.incomingWebhooks.clear();
    this.webhookHistory = [];
    this.removeAllListeners();
  }
}

// Singleton instance
let webhookManagerInstance: WebhookManager | null = null;

export function getWebhookManager(config?: Partial<WebhookManagerConfig>): WebhookManager {
  if (!webhookManagerInstance) {
    webhookManagerInstance = new WebhookManager(config);
  }
  return webhookManagerInstance;
}

export function destroyWebhookManager(): void {
  if (webhookManagerInstance) {
    webhookManagerInstance.destroy();
    webhookManagerInstance = null;
  }
}

