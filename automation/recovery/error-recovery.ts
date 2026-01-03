/**
 * @fileoverview Enterprise Error Recovery System
 * @module automation/recovery/error-recovery
 * 
 * Professional-grade error recovery with auto-retry, exponential backoff,
 * circuit breakers, and intelligent failure handling.
 */

import { EventEmitter } from 'events';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
}

export interface ErrorContext {
  taskId?: string;
  workspaceId?: string;
  browserId?: string;
  stepName?: string;
  url?: string;
  selector?: string;
  timestamp: string;
  screenshot?: string;
}

export interface RecoveryAction {
  type: 'retry' | 'skip' | 'rollback' | 'notify' | 'screenshot' | 'restart';
  config?: Record<string, unknown>;
}

export interface ErrorRecord {
  id: string;
  error: Error;
  context: ErrorContext;
  attempts: number;
  resolved: boolean;
  recoveryActions: RecoveryAction[];
  createdAt: string;
  resolvedAt?: string;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'TimeoutError',
    'NetworkError',
    'ECONNRESET',
    'ECONNREFUSED',
    'Navigation timeout',
    'Waiting for selector',
    'net::ERR_CONNECTION_RESET',
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_INTERNET_DISCONNECTED',
    'Target closed',
    'Session closed',
    'Context was destroyed',
  ],
};

export class ErrorRecoverySystem extends EventEmitter {
  private retryConfig: RetryConfig;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private errorHistory: ErrorRecord[] = [];
  private maxHistorySize = 1000;

  constructor(config: Partial<RetryConfig> = {}) {
    super();
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute a function with automatic retry on failure
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext> = {},
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customConfig };
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Success - reset any circuit breaker for this context
        if (context.browserId) {
          this.recordSuccess(context.browserId);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryable(lastError, config)) {
          console.log(`[Recovery] Non-retryable error: ${lastError.message}`);
          throw lastError;
        }
        
        // Check circuit breaker
        if (context.browserId && this.isCircuitOpen(context.browserId)) {
          console.log(`[Recovery] Circuit breaker open for ${context.browserId}`);
          throw new Error(`Circuit breaker open: Too many failures for ${context.browserId}`);
        }
        
        // Record failure
        if (context.browserId) {
          this.recordFailure(context.browserId);
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelayMs
        );
        
        // Add jitter (±20%)
        const jitter = delay * 0.2 * (Math.random() * 2 - 1);
        const actualDelay = Math.round(delay + jitter);
        
        console.log(`[Recovery] Attempt ${attempt + 1}/${config.maxRetries + 1} failed: ${lastError.message}`);
        console.log(`[Recovery] Retrying in ${actualDelay}ms...`);
        
        // Emit retry event
        this.emit('retry', { attempt: attempt + 1, error: lastError, context, delay: actualDelay });
        config.onRetry?.(attempt + 1, lastError);
        
        if (attempt < config.maxRetries) {
          await this.sleep(actualDelay);
        }
      }
    }
    
    // All retries exhausted
    const errorRecord = this.recordError(lastError!, {
      ...context,
      timestamp: new Date().toISOString(),
    });
    
    this.emit('exhausted', { error: lastError, context, attempts: config.maxRetries + 1 });
    console.error(`[Recovery] All ${config.maxRetries + 1} attempts failed:`, lastError);
    
    throw new RetryExhaustedError(
      `Operation failed after ${config.maxRetries + 1} attempts: ${lastError!.message}`,
      lastError!,
      errorRecord
    );
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error: Error, config: RetryConfig = this.retryConfig): boolean {
    const errorString = `${error.name}: ${error.message}`;
    return config.retryableErrors.some(pattern => 
      errorString.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Execute with circuit breaker protection
   */
  async withCircuitBreaker<T>(
    key: string,
    operation: () => Promise<T>,
    config: CircuitBreakerConfig = { failureThreshold: 5, successThreshold: 2, timeout: 30000 }
  ): Promise<T> {
    if (this.isCircuitOpen(key)) {
      // Check if timeout has passed
      const state = this.circuitBreakers.get(key)!;
      if (Date.now() - state.lastFailure > config.timeout) {
        state.state = 'half-open';
      } else {
        throw new CircuitOpenError(`Circuit breaker is open for ${key}`);
      }
    }
    
    try {
      const result = await operation();
      this.recordSuccess(key, config);
      return result;
    } catch (error) {
      this.recordFailure(key, config);
      throw error;
    }
  }

  /**
   * Get recovery suggestions for an error
   */
  getSuggestions(error: Error): RecoveryAction[] {
    const suggestions: RecoveryAction[] = [];
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('timeout') || message.includes('network')) {
      suggestions.push(
        { type: 'retry', config: { delay: 5000 } },
        { type: 'screenshot' }
      );
    }
    
    // Selector not found
    if (message.includes('selector') || message.includes('element')) {
      suggestions.push(
        { type: 'retry', config: { delay: 2000 } },
        { type: 'screenshot' },
        { type: 'skip' }
      );
    }
    
    // Browser crashed
    if (message.includes('target closed') || message.includes('session closed')) {
      suggestions.push(
        { type: 'restart' },
        { type: 'notify' }
      );
    }
    
    // CAPTCHA detected
    if (message.includes('captcha') || message.includes('unusual traffic')) {
      suggestions.push(
        { type: 'notify' },
        { type: 'skip' }
      );
    }
    
    return suggestions;
  }

  /**
   * Record an error for history
   */
  private recordError(error: Error, context: ErrorContext): ErrorRecord {
    const record: ErrorRecord = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error,
      context,
      attempts: 0,
      resolved: false,
      recoveryActions: this.getSuggestions(error),
      createdAt: new Date().toISOString(),
    };
    
    this.errorHistory.unshift(record);
    
    // Trim history
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
    
    this.emit('error', record);
    return record;
  }

  /**
   * Get error history
   */
  getErrorHistory(limit = 100): ErrorRecord[] {
    return this.errorHistory.slice(0, limit);
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Check if circuit is open
   */
  private isCircuitOpen(key: string): boolean {
    const state = this.circuitBreakers.get(key);
    return state?.state === 'open';
  }

  /**
   * Record a success for circuit breaker
   */
  private recordSuccess(key: string, config?: CircuitBreakerConfig): void {
    let state = this.circuitBreakers.get(key);
    
    if (!state) {
      state = { state: 'closed', failures: 0, successes: 0, lastFailure: 0 };
      this.circuitBreakers.set(key, state);
    }
    
    state.successes++;
    state.failures = 0;
    
    // Close circuit if half-open and enough successes
    if (state.state === 'half-open' && config && state.successes >= config.successThreshold) {
      state.state = 'closed';
      this.emit('circuitClosed', key);
    }
  }

  /**
   * Record a failure for circuit breaker
   */
  private recordFailure(key: string, config?: CircuitBreakerConfig): void {
    let state = this.circuitBreakers.get(key);
    
    if (!state) {
      state = { state: 'closed', failures: 0, successes: 0, lastFailure: 0 };
      this.circuitBreakers.set(key, state);
    }
    
    state.failures++;
    state.successes = 0;
    state.lastFailure = Date.now();
    
    // Open circuit if threshold reached
    if (config && state.failures >= config.failureThreshold) {
      state.state = 'open';
      this.emit('circuitOpen', key);
      console.warn(`[Recovery] Circuit breaker opened for ${key}`);
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus(key: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(key);
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(key: string): void {
    this.circuitBreakers.delete(key);
  }

  /**
   * Helper: Sleep for a duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailure: number;
}

export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly originalError: Error,
    public readonly errorRecord: ErrorRecord
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// Singleton instance
let recoveryInstance: ErrorRecoverySystem | null = null;

export function getRecoverySystem(config?: Partial<RetryConfig>): ErrorRecoverySystem {
  if (!recoveryInstance) {
    recoveryInstance = new ErrorRecoverySystem(config);
  }
  return recoveryInstance;
}

