/**
 * @fileoverview Phone Number Service
 * @module automation/services/phone-number
 *
 * Manages phone numbers for SMS verification.
 * Supports Telnyx, Twilio, and manual number lists.
 * Receives SMS via webhooks and provides codes to automation.
 */

import { logger } from '../../electron/utils/logger';
import { EventEmitter } from 'events';

export interface PhoneNumber {
  id: string;
  number: string;           // E.164 format: +1234567890
  provider: 'telnyx' | 'twilio' | 'manual';
  status: 'available' | 'in_use' | 'blocked' | 'expired';
  country: string;          // ISO 3166-1 alpha-2: US, GB, etc.
  lastUsed?: Date;
  assignedTo?: string;      // Workspace ID if in use
  createdAt: Date;
}

export interface ReceivedSMS {
  id: string;
  to: string;               // Phone number that received
  from: string;             // Sender
  body: string;             // Message content
  code?: string;            // Extracted verification code
  receivedAt: Date;
  processed: boolean;
}

export interface WebhookConfig {
  enabled: boolean;
  url?: string;             // Generated webhook URL
  secret?: string;          // Webhook signature secret
}

export interface TelnyxConfig {
  apiKey: string;
  messagingProfileId?: string;
}

/**
 * Phone Number Service
 * Manages phone numbers and receives SMS for verification
 */
export class PhoneNumberService extends EventEmitter {
  private numbers: Map<string, PhoneNumber> = new Map();
  private receivedSMS: Map<string, ReceivedSMS[]> = new Map(); // number -> SMS list
  private pendingVerifications: Map<string, (code: string) => void> = new Map();
  private telnyxConfig: TelnyxConfig | null = null;
  private webhookConfig: WebhookConfig = { enabled: false };
  private webhookPort = 3847; // Default webhook port

  constructor() {
    super();
  }

  /**
   * Configure Telnyx API
   */
  configureTelnyx(config: TelnyxConfig): void {
    this.telnyxConfig = config;
    logger.info('Telnyx configured');
  }

  /**
   * Verify Telnyx API key
   */
  async verifyTelnyxApiKey(): Promise<{ valid: boolean; error?: string }> {
    if (!this.telnyxConfig) {
      return { valid: false, error: 'Telnyx not configured' };
    }

    try {
      const response = await fetch('https://api.telnyx.com/v2/balance', {
        headers: {
          'Authorization': `Bearer ${this.telnyxConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        logger.info('Telnyx API verified', { balance: data.data?.balance });
        return { valid: true };
      } else {
        const error = await response.json();
        return { valid: false, error: error.errors?.[0]?.detail || 'Invalid API key' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      return { valid: false, error: message };
    }
  }

  /**
   * Add a phone number manually
   */
  addNumber(number: string, provider: 'telnyx' | 'twilio' | 'manual' = 'manual', country = 'US'): PhoneNumber {
    const id = `phone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Normalize to E.164 format
    let normalized = number.replace(/\D/g, '');
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    const phoneNumber: PhoneNumber = {
      id,
      number: normalized,
      provider,
      status: 'available',
      country,
      createdAt: new Date(),
    };

    this.numbers.set(id, phoneNumber);
    this.receivedSMS.set(normalized, []);
    
    logger.info('Phone number added', { id, number: normalized });
    this.emit('numberAdded', phoneNumber);
    
    return phoneNumber;
  }

  /**
   * Import multiple numbers from a list
   */
  importNumbers(numberList: string[], provider: 'telnyx' | 'twilio' | 'manual' = 'manual'): PhoneNumber[] {
    const imported: PhoneNumber[] = [];
    
    for (const number of numberList) {
      const trimmed = number.trim();
      if (trimmed) {
        imported.push(this.addNumber(trimmed, provider));
      }
    }
    
    logger.info('Imported phone numbers', { count: imported.length });
    return imported;
  }

  /**
   * Remove a phone number
   */
  removeNumber(id: string): boolean {
    const number = this.numbers.get(id);
    if (number) {
      this.numbers.delete(id);
      this.receivedSMS.delete(number.number);
      this.emit('numberRemoved', number);
      logger.info('Phone number removed', { id });
      return true;
    }
    return false;
  }

  /**
   * Get all phone numbers
   */
  getAllNumbers(): PhoneNumber[] {
    return Array.from(this.numbers.values());
  }

  /**
   * Get available phone numbers
   */
  getAvailableNumbers(): PhoneNumber[] {
    return Array.from(this.numbers.values()).filter(n => n.status === 'available');
  }

  /**
   * Reserve a phone number for use
   */
  reserveNumber(workspaceId: string): PhoneNumber | null {
    const available = this.getAvailableNumbers();
    
    if (available.length === 0) {
      logger.warn('No available phone numbers');
      return null;
    }

    // Get the least recently used number
    const sorted = available.sort((a, b) => {
      const aTime = a.lastUsed?.getTime() || 0;
      const bTime = b.lastUsed?.getTime() || 0;
      return aTime - bTime;
    });

    const number = sorted[0];
    number.status = 'in_use';
    number.assignedTo = workspaceId;
    number.lastUsed = new Date();
    
    logger.info('Phone number reserved', { number: number.number, workspaceId });
    this.emit('numberReserved', number);
    
    return number;
  }

  /**
   * Release a reserved phone number
   */
  releaseNumber(id: string): void {
    const number = this.numbers.get(id);
    if (number) {
      number.status = 'available';
      number.assignedTo = undefined;
      logger.info('Phone number released', { id, number: number.number });
      this.emit('numberReleased', number);
    }
  }

  /**
   * Process incoming SMS from webhook
   */
  processIncomingSMS(to: string, from: string, body: string): ReceivedSMS {
    const sms: ReceivedSMS = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      to: to.replace(/\D/g, ''),
      from,
      body,
      code: this.extractVerificationCode(body),
      receivedAt: new Date(),
      processed: false,
    };

    // Store SMS
    const normalizedTo = '+' + to.replace(/\D/g, '');
    const smsList = this.receivedSMS.get(normalizedTo) || [];
    smsList.push(sms);
    this.receivedSMS.set(normalizedTo, smsList);

    logger.info('SMS received', { to: normalizedTo, code: sms.code });
    
    // Emit event for waiting verifications
    this.emit('smsReceived', sms);

    // Resolve pending verification if waiting
    const resolver = this.pendingVerifications.get(normalizedTo);
    if (resolver && sms.code) {
      resolver(sms.code);
      this.pendingVerifications.delete(normalizedTo);
      sms.processed = true;
    }

    return sms;
  }

  /**
   * Extract verification code from SMS body
   */
  private extractVerificationCode(body: string): string | undefined {
    // Common patterns for verification codes
    const patterns = [
      /(\d{6})/,                           // 6-digit code
      /(\d{4})/,                           // 4-digit code
      /code[:\s]+(\d+)/i,                  // "code: 123456"
      /G-(\d+)/,                           // Google "G-123456"
      /verification[:\s]+(\d+)/i,          // "verification: 123456"
      /is[:\s]+(\d+)/i,                    // "Your code is: 123456"
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Wait for a verification code on a phone number
   * Returns a promise that resolves when code is received
   */
  waitForVerificationCode(phoneNumber: string, timeoutMs = 120000): Promise<string> {
    const normalized = '+' + phoneNumber.replace(/\D/g, '');
    
    return new Promise((resolve, reject) => {
      // Check if we already have an unprocessed code
      const existing = this.receivedSMS.get(normalized) || [];
      const unprocessed = existing.find(sms => !sms.processed && sms.code);
      
      if (unprocessed && unprocessed.code) {
        unprocessed.processed = true;
        resolve(unprocessed.code);
        return;
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingVerifications.delete(normalized);
        reject(new Error('Verification code timeout'));
      }, timeoutMs);

      // Store resolver
      this.pendingVerifications.set(normalized, (code: string) => {
        clearTimeout(timeout);
        resolve(code);
      });

      logger.info('Waiting for verification code', { number: normalized, timeoutMs });
    });
  }

  /**
   * Get SMS history for a number
   */
  getSMSHistory(phoneNumber: string): ReceivedSMS[] {
    const normalized = '+' + phoneNumber.replace(/\D/g, '');
    return this.receivedSMS.get(normalized) || [];
  }

  /**
   * Get webhook URL for Telnyx configuration
   */
  getWebhookUrl(): string {
    // This would be configured based on user's public URL or ngrok tunnel
    return this.webhookConfig.url || `http://localhost:${this.webhookPort}/webhook/sms`;
  }

  /**
   * Configure webhook
   */
  configureWebhook(config: Partial<WebhookConfig>): void {
    this.webhookConfig = { ...this.webhookConfig, ...config };
    logger.info('Webhook configured', { url: this.webhookConfig.url });
  }

  /**
   * Get webhook configuration
   */
  getWebhookConfig(): WebhookConfig {
    return this.webhookConfig;
  }

  /**
   * Fetch phone numbers from Telnyx account
   */
  async fetchTelnyxNumbers(): Promise<PhoneNumber[]> {
    if (!this.telnyxConfig) {
      throw new Error('Telnyx not configured');
    }

    try {
      const response = await fetch('https://api.telnyx.com/v2/phone_numbers?page[size]=250', {
        headers: {
          'Authorization': `Bearer ${this.telnyxConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Telnyx numbers');
      }

      const data = await response.json();
      const imported: PhoneNumber[] = [];

      for (const num of data.data || []) {
        const phoneNumber = this.addNumber(
          num.phone_number,
          'telnyx',
          num.address?.country_code || 'US'
        );
        imported.push(phoneNumber);
      }

      logger.info('Fetched Telnyx numbers', { count: imported.length });
      return imported;
    } catch (error) {
      logger.error('Error fetching Telnyx numbers', { error });
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  getStats(): { total: number; available: number; inUse: number; blocked: number } {
    const all = Array.from(this.numbers.values());
    return {
      total: all.length,
      available: all.filter(n => n.status === 'available').length,
      inUse: all.filter(n => n.status === 'in_use').length,
      blocked: all.filter(n => n.status === 'blocked').length,
    };
  }
}

// Singleton instance
let phoneNumberServiceInstance: PhoneNumberService | null = null;

export function getPhoneNumberService(): PhoneNumberService {
  if (!phoneNumberServiceInstance) {
    phoneNumberServiceInstance = new PhoneNumberService();
  }
  return phoneNumberServiceInstance;
}

