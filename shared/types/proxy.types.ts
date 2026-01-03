/**
 * @fileoverview Proxy Type Definitions
 * @module shared/types/proxy
 *
 * Defines proxy-related types for managing proxy servers
 * and proxy chains for browser automation.
 */

/**
 * Proxy protocol enumeration
 */
export enum ProxyProtocol {
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS4 = 'socks4',
  SOCKS5 = 'socks5',
}

/**
 * Proxy type enumeration - for categorization
 */
export enum ProxyType {
  STATIC = 'static',           // Fixed IP - always same IP
  RESIDENTIAL = 'residential', // Rotating residential IPs
  DATACENTER = 'datacenter',   // Datacenter IPs
  MOBILE = 'mobile',           // Mobile IPs
}

/**
 * Proxy status enumeration
 */
export enum ProxyStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  TESTING = 'testing',
  ERROR = 'error',
  UNKNOWN = 'unknown',
}

/**
 * Core Proxy entity
 * Represents a proxy server configuration
 */
export interface Proxy {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  type: ProxyType;              // Static, Residential, Datacenter, Mobile
  username?: string;
  password?: string;
  country?: string;
  city?: string;
  status: ProxyStatus;
  speed?: number;
  lastTested?: string;
  assignedToWorkspace?: string; // Permanently assigned workspace ID
  lastUsed?: string;
  createdAt: string;
  // Usage tracking
  usageCount?: number;          // How many times used
  isLocked?: boolean;           // If true, only assigned workspace can use
}

/**
 * Input for creating a new proxy
 */
export interface CreateProxyInput {
  name: string;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  proxyType?: ProxyType;         // Static, Residential, Datacenter, Mobile
  username?: string;
  password?: string;
  country?: string;
  city?: string;
}

/**
 * Proxy chain for rotation
 */
export interface ProxyChain {
  id: string;
  name: string;
  proxyIds: string[];
  rotationMode: ProxyRotationMode;
  healthCheckInterval: number;
  currentIndex: number;
  createdAt: string;
}

/**
 * Proxy rotation mode
 */
export enum ProxyRotationMode {
  ROUND_ROBIN = 'round-robin',
  RANDOM = 'random',
  FAILOVER = 'failover',
  LEAST_USED = 'least-used',
}

/**
 * Bulk proxy import format
 */
export interface BulkProxyImport {
  proxies: Array<{
    host: string;
    port: number;
    protocol: ProxyProtocol;
    username?: string;
    password?: string;
    country?: string;
  }>;
  saveAsChain?: boolean;
  chainName?: string;
}

/**
 * Proxy test result
 */
export interface ProxyTestResult {
  proxyId: string;
  status: ProxyStatus;
  speed?: number;
  error?: string;
  testedAt: string;
  ip?: string;  // The actual IP detected through the proxy
}
