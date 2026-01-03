/**
 * @fileoverview Proxy Service
 * @module electron/services/proxy
 *
 * Business logic for proxy management operations.
 * Handles proxy creation, testing, and status management.
 */

import { ProxyRepository } from '../database/repositories/proxy.repository';
import { 
  Proxy, 
  ProxyStatus,
  ProxyProtocol,
  ProxyType,
  CreateProxyInput,
  ProxyTestResult,
} from '../../shared/types/proxy.types';
import {
  validateInput,
  CreateProxyInputSchema,
  ValidationError,
} from '../../shared/utils/validators';
import { logger } from '../utils/logger';
import { APP_CONFIG } from '../../shared/constants/app-config';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as https from 'https';
import * as net from 'net';

/**
 * Proxy service error
 */
export class ProxyServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ProxyServiceError';
  }
}

/**
 * Proxy management service
 */
export class ProxyService {
  private repository: ProxyRepository;

  constructor() {
    this.repository = new ProxyRepository();
  }

  /**
   * Create a new proxy
   */
  async create(input: CreateProxyInput): Promise<Proxy> {
    try {
      logger.info('Creating proxy', { 
        name: input.name, 
        host: input.host,
        proxyType: input.proxyType,
      });

      // Validate input
      const validated = validateInput(
        CreateProxyInputSchema,
        input,
        'CreateProxyInput'
      ) as CreateProxyInput;

      // Create proxy - map proxyType to type for repository
      const proxy = this.repository.create({
        ...validated,
        type: validated.proxyType || ProxyType.STATIC,
      });

      logger.info('Proxy created', { proxyId: proxy.id, type: proxy.type });

      return proxy;
    } catch (error) {
      logger.error('Failed to create proxy', { error, input });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ProxyServiceError(
        'Failed to create proxy',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Bulk import proxies from text
   */
  async bulkImport(data: { proxiesText: string; proxyType?: string }): Promise<{ imported: number; failed: number }> {
    try {
      const lines = data.proxiesText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const proxyType = (data.proxyType as ProxyType) || ProxyType.STATIC;
      
      logger.info('Bulk importing proxies', { lineCount: lines.length, proxyType });

      let imported = 0;
      let failed = 0;

      for (const line of lines) {
        try {
          const parsed = this.parseProxyLine(line);
          if (parsed) {
            this.repository.create({
              name: `${parsed.host}:${parsed.port}`,
              host: parsed.host,
              port: parsed.port,
              protocol: parsed.protocol,
              type: proxyType,
              username: parsed.username,
              password: parsed.password,
            });
            imported++;
          } else {
            failed++;
          }
        } catch (err) {
          logger.warn('Failed to import proxy line', { line, error: err });
          failed++;
        }
      }

      logger.info('Bulk proxy import completed', { imported, failed });
      return { imported, failed };
    } catch (error) {
      logger.error('Failed to bulk import proxies', { error });
      throw new ProxyServiceError(
        'Failed to bulk import proxies',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse a single proxy line into components
   * Supports: host:port, host:port:user:pass, protocol://host:port, protocol://user:pass@host:port
   */
  private parseProxyLine(line: string): { host: string; port: number; protocol: ProxyProtocol; username?: string; password?: string } | null {
    try {
      // Check for URL format: protocol://...
      if (line.includes('://')) {
        const url = new URL(line);
        return {
          host: url.hostname,
          port: parseInt(url.port) || (url.protocol === 'socks5:' || url.protocol === 'socks4:' ? 1080 : 8080),
          protocol: url.protocol.replace(':', '') as ProxyProtocol || ProxyProtocol.SOCKS5,
          username: url.username || undefined,
          password: url.password || undefined,
        };
      }

      // Check for host:port:user:pass format
      const parts = line.split(':');
      if (parts.length === 4) {
        return {
          host: parts[0],
          port: parseInt(parts[1]),
          protocol: ProxyProtocol.SOCKS5, // Default to SOCKS5 for static IPs
          username: parts[2],
          password: parts[3],
        };
      }

      // Check for host:port format
      if (parts.length === 2) {
        return {
          host: parts[0],
          port: parseInt(parts[1]),
          protocol: ProxyProtocol.SOCKS5,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get all proxies
   */
  async getAll(): Promise<Proxy[]> {
    try {
      return this.repository.findAll();
    } catch (error) {
      logger.error('Failed to get proxies', { error });
      throw new ProxyServiceError(
        'Failed to get proxies',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get proxy by ID
   */
  async getById(id: string): Promise<Proxy | null> {
    try {
      return this.repository.findById(id);
    } catch (error) {
      logger.error('Failed to get proxy', { error, id });
      throw new ProxyServiceError(
        'Failed to get proxy',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get available proxies
   */
  async getAvailable(): Promise<Proxy[]> {
    try {
      return this.repository.findAvailable();
    } catch (error) {
      logger.error('Failed to get available proxies', { error });
      throw new ProxyServiceError(
        'Failed to get available proxies',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Test proxy connection - ACTUALLY routes through the proxy
   */
  async test(id: string): Promise<ProxyTestResult> {
    try {
      logger.info('Testing proxy', { proxyId: id });

      const proxy = this.repository.findById(id);
      if (!proxy) {
        throw new ProxyServiceError(`Proxy not found: ${id}`);
      }

      // Update status to testing
      this.repository.updateStatus(id, ProxyStatus.TESTING);

      const startTime = Date.now();
      let status: ProxyStatus = ProxyStatus.OFFLINE;
      let speed: number | undefined;
      let error: string | undefined;
      let detectedIp: string | undefined;

      try {
        // STEP 1: Test basic TCP connectivity to the proxy host
        const tcpResult = await this.testTcpConnectivity(proxy.host, proxy.port);
        if (!tcpResult.success) {
          throw new Error(`Cannot connect to proxy server at ${proxy.host}:${proxy.port} - ${tcpResult.error}`);
        }

        // STEP 2: Test actual HTTP request through the proxy
        const httpResult = await this.testHttpThroughProxy(proxy);
        
        speed = Date.now() - startTime;

        if (httpResult.success) {
          status = ProxyStatus.ONLINE;
          detectedIp = httpResult.ip;
          logger.info('Proxy test successful', { 
            proxyId: id, 
            proxyHost: proxy.host,
            detectedIp: httpResult.ip 
          });
        } else {
          status = ProxyStatus.ERROR;
          error = httpResult.error;
        }
      } catch (testError) {
        speed = Date.now() - startTime;
        status = ProxyStatus.OFFLINE;
        error = testError instanceof Error ? testError.message : 'Connection failed';
        logger.warn('Proxy test failed', { proxyId: id, error });
      }

      // Update proxy status
      this.repository.updateStatus(id, status, speed);

      const result: ProxyTestResult = {
        proxyId: id,
        status,
        speed,
        error,
        testedAt: new Date().toISOString(),
        ip: detectedIp,
      };

      logger.info('Proxy test completed', { proxyId: id, status, speed, detectedIp });

      return result;
    } catch (error) {
      logger.error('Failed to test proxy', { error, id });
      
      // Make sure to update status even on error
      try {
        this.repository.updateStatus(id, ProxyStatus.ERROR);
      } catch {}
      
      throw new ProxyServiceError(
        'Failed to test proxy',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Test TCP connectivity to proxy server
   */
  private testTcpConnectivity(host: string, port: number): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 10000; // 10 seconds

      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ success: false, error: 'Connection timeout' });
      }, timeout);

      socket.connect(port, host, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ success: true });
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Test actual HTTP request through the proxy
   */
  private testHttpThroughProxy(proxy: Proxy): Promise<{ success: boolean; ip?: string; error?: string }> {
    return new Promise((resolve) => {
      const timeout = APP_CONFIG.PROXY_TEST_TIMEOUT || 15000;
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        resolve({ success: false, error: 'Request through proxy timed out' });
      }, timeout);

      try {
        // Build proxy URL with authentication
        let proxyUrl: string;
        const protocol = proxy.protocol?.toLowerCase() || 'http';
        
        if (proxy.username && proxy.password) {
          proxyUrl = `${protocol}://${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@${proxy.host}:${proxy.port}`;
        } else {
          proxyUrl = `${protocol}://${proxy.host}:${proxy.port}`;
        }

        logger.debug('Testing proxy with URL', { 
          proxyUrl: proxyUrl.replace(/:[^:]+@/, ':****@'), // Hide password in logs
          protocol,
        });

        // Create appropriate proxy agent based on protocol
        let agent: SocksProxyAgent | HttpsProxyAgent<string>;
        
        if (protocol === 'socks5' || protocol === 'socks4') {
          agent = new SocksProxyAgent(proxyUrl);
        } else {
          // HttpsProxyAgent works for both HTTP and HTTPS proxies when making HTTPS requests
          agent = new HttpsProxyAgent(proxyUrl);
        }

        // Make request to IP detection service
        const testUrl = 'https://api.ipify.org?format=json';
        
        const req = https.request(testUrl, { agent, timeout }, (res) => {
          if (timedOut) return;
          
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (timedOut) return;
            clearTimeout(timer);
            
            try {
              // Check if we got a valid response
              if (res.statusCode === 200) {
                const json = JSON.parse(data);
                if (json.ip) {
                  resolve({ success: true, ip: json.ip });
                } else {
                  resolve({ success: false, error: 'No IP in response' });
                }
              } else if (res.statusCode === 407) {
                resolve({ success: false, error: 'Proxy authentication failed (407)' });
              } else if (res.statusCode === 403) {
                resolve({ success: false, error: 'Proxy access forbidden (403)' });
              } else {
                resolve({ success: false, error: `HTTP ${res.statusCode}` });
              }
            } catch (parseErr) {
              resolve({ success: false, error: 'Invalid response from test server' });
            }
          });
        });

        req.on('error', (err) => {
          if (timedOut) return;
          clearTimeout(timer);
          
          // Provide meaningful error messages
          let errorMsg = err.message;
          if (err.message.includes('ECONNREFUSED')) {
            errorMsg = 'Connection refused - proxy server not accepting connections';
          } else if (err.message.includes('ETIMEDOUT')) {
            errorMsg = 'Connection timed out';
          } else if (err.message.includes('ENOTFOUND')) {
            errorMsg = 'Proxy host not found (DNS resolution failed)';
          } else if (err.message.includes('authentication')) {
            errorMsg = 'Proxy authentication failed';
          } else if (err.message.includes('SOCKS')) {
            errorMsg = `SOCKS connection error: ${err.message}`;
          }
          
          resolve({ success: false, error: errorMsg });
        });

        req.end();
      } catch (err) {
        if (timedOut) return;
        clearTimeout(timer);
        resolve({ 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    });
  }

  /**
   * Test all proxies
   */
  async testAll(): Promise<ProxyTestResult[]> {
    try {
      logger.info('Testing all proxies');
      const proxies = this.repository.findAll();
      const results: ProxyTestResult[] = [];

      // Test in batches to avoid overwhelming network
      const batchSize = 5;
      for (let i = 0; i < proxies.length; i += batchSize) {
        const batch = proxies.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(proxy => this.test(proxy.id).catch(err => ({
            proxyId: proxy.id,
            status: ProxyStatus.ERROR,
            error: err.message,
            testedAt: new Date().toISOString(),
          } as ProxyTestResult)))
        );
        results.push(...batchResults);
      }

      logger.info('All proxies tested', { 
        total: proxies.length,
        online: results.filter(r => r.status === ProxyStatus.ONLINE).length,
        offline: results.filter(r => r.status !== ProxyStatus.ONLINE).length,
      });

      return results;
    } catch (error) {
      logger.error('Failed to test all proxies', { error });
      throw new ProxyServiceError(
        'Failed to test all proxies',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete proxy
   */
  async delete(id: string): Promise<boolean> {
    try {
      logger.info('Deleting proxy', { proxyId: id });

      const deleted = this.repository.delete(id);

      if (deleted) {
        logger.info('Proxy deleted', { proxyId: id });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete proxy', { error, id });
      throw new ProxyServiceError(
        'Failed to delete proxy',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get proxy pool health percentage
   */
  async getHealthPercentage(): Promise<number> {
    try {
      return this.repository.getHealthPercentage();
    } catch (error) {
      logger.error('Failed to get proxy health', { error });
      return 0;
    }
  }

  /**
   * Get proxy count
   */
  async count(): Promise<number> {
    try {
      return this.repository.count();
    } catch (error) {
      logger.error('Failed to count proxies', { error });
      return 0;
    }
  }
}
