/**
 * @fileoverview Account Service
 * @module electron/services/account
 *
 * Service for managing created accounts.
 * Provides encryption, real-time updates, and export functionality.
 */

import { BrowserWindow } from 'electron';
import { AccountRepository, Account, CreateAccountInput } from '../database/repositories/account.repository';
import { GeneratedAccount } from '../../automation/utils/data-generator';
import { logger } from '../utils/logger';
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels';

/**
 * Account service error
 */
export class AccountServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'AccountServiceError';
  }
}

/**
 * Account service for managing created accounts
 */
export class AccountService {
  private repository: AccountRepository;
  private initialized = false;

  constructor() {
    this.repository = new AccountRepository();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.repository.initialize();
      this.initialized = true;
      logger.info('Account service initialized');
    } catch (error) {
      logger.error('Failed to initialize account service', { error });
      throw new AccountServiceError(
        'Failed to initialize account service',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Save a generated account to the database
   */
  async saveGeneratedAccount(
    generatedAccount: GeneratedAccount,
    service: string,
    workspaceId?: string
  ): Promise<Account> {
    try {
      const input: CreateAccountInput = {
        service,
        email: generatedAccount.email,
        password: generatedAccount.password,
        firstName: generatedAccount.firstName,
        lastName: generatedAccount.lastName,
        phone: generatedAccount.phone,
        birthDate: generatedAccount.birthDate.formatted,
        address: generatedAccount.address.full,
        recoveryEmail: generatedAccount.recoveryEmail,
        username: generatedAccount.username,
        workspaceId,
        metadata: {
          gender: generatedAccount.gender,
          generatedAt: generatedAccount.createdAt,
        },
      };

      const account = await this.repository.create(input);

      // Notify UI about new account
      this.notifyAccountCreated(account);

      logger.info('Generated account saved', { 
        id: account.id, 
        email: account.email, 
        service 
      });

      return account;
    } catch (error) {
      logger.error('Failed to save generated account', { error });
      throw new AccountServiceError(
        'Failed to save generated account',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create an account manually
   */
  async createAccount(input: CreateAccountInput): Promise<Account> {
    try {
      const account = await this.repository.create(input);
      this.notifyAccountCreated(account);
      return account;
    } catch (error) {
      logger.error('Failed to create account', { error });
      throw new AccountServiceError(
        'Failed to create account',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all accounts
   */
  async getAllAccounts(): Promise<Account[]> {
    try {
      return await this.repository.findAll();
    } catch (error) {
      logger.error('Failed to get all accounts', { error });
      throw new AccountServiceError(
        'Failed to get all accounts',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get accounts by service
   */
  async getAccountsByService(service: string): Promise<Account[]> {
    try {
      return await this.repository.findByService(service);
    } catch (error) {
      logger.error('Failed to get accounts by service', { error, service });
      throw new AccountServiceError(
        'Failed to get accounts by service',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get account by ID
   */
  async getAccountById(id: string): Promise<Account | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      logger.error('Failed to get account by ID', { error, id });
      throw new AccountServiceError(
        'Failed to get account by ID',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search accounts
   */
  async searchAccounts(query: string): Promise<Account[]> {
    try {
      return await this.repository.search(query);
    } catch (error) {
      logger.error('Failed to search accounts', { error, query });
      throw new AccountServiceError(
        'Failed to search accounts',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete an account
   */
  async deleteAccount(id: string): Promise<boolean> {
    try {
      const result = await this.repository.delete(id);
      if (result) {
        this.notifyAccountDeleted(id);
      }
      return result;
    } catch (error) {
      logger.error('Failed to delete account', { error, id });
      throw new AccountServiceError(
        'Failed to delete account',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get account count
   */
  async getAccountCount(): Promise<number> {
    try {
      return await this.repository.count();
    } catch (error) {
      logger.error('Failed to get account count', { error });
      throw new AccountServiceError(
        'Failed to get account count',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get count by service
   */
  async getCountByService(service: string): Promise<number> {
    try {
      return await this.repository.countByService(service);
    } catch (error) {
      logger.error('Failed to get count by service', { error, service });
      throw new AccountServiceError(
        'Failed to get count by service',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Export accounts to CSV
   */
  async exportToCSV(): Promise<string> {
    try {
      return await this.repository.exportToCSV();
    } catch (error) {
      logger.error('Failed to export accounts to CSV', { error });
      throw new AccountServiceError(
        'Failed to export accounts to CSV',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<Record<string, number>> {
    try {
      const accounts = await this.repository.findAll();
      const stats: Record<string, number> = {};

      for (const account of accounts) {
        stats[account.service] = (stats[account.service] || 0) + 1;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get service stats', { error });
      throw new AccountServiceError(
        'Failed to get service stats',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Notify UI about new account
   */
  private notifyAccountCreated(account: Account): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(IPC_CHANNELS.EVENT_ACCOUNT_CREATED, account);
    }
  }

  /**
   * Notify UI about deleted account
   */
  private notifyAccountDeleted(id: string): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(IPC_CHANNELS.EVENT_ACCOUNT_DELETED, id);
    }
  }
}

// Singleton instance
let accountServiceInstance: AccountService | null = null;

/**
 * Get account service instance
 */
export function getAccountService(): AccountService {
  if (!accountServiceInstance) {
    accountServiceInstance = new AccountService();
  }
  return accountServiceInstance;
}


