/**
 * @fileoverview Account Repository
 * @module electron/database/repositories/account
 *
 * Repository for managing created accounts in the database.
 * Stores all automatically generated account credentials.
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { BaseRepository } from './base.repository';
import { getDatabase } from '../db';
import { logger } from '../../utils/logger';

/**
 * Account entity interface
 */
export interface Account {
  id: string;
  service: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  recoveryEmail?: string;
  username?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Account creation input
 */
export interface CreateAccountInput {
  service: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  recoveryEmail?: string;
  username?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Account database row
 */
interface AccountRow {
  id: string;
  service: string;
  email: string;
  password_encrypted: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  recovery_email: string | null;
  username: string | null;
  workspace_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Encryption key (in production, use secure key management)
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'rpa-agent-default-key-change-me!';

/**
 * Account repository for database operations
 */
export class AccountRepository extends BaseRepository<Account> {
  constructor() {
    super('created_accounts', 'Account');
  }

  /**
   * Initialize the accounts table
   */
  async initialize(): Promise<void> {
    const db = getDatabase();
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS created_accounts (
        id TEXT PRIMARY KEY,
        service TEXT NOT NULL,
        email TEXT NOT NULL,
        password_encrypted TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        birth_date TEXT,
        address TEXT,
        recovery_email TEXT,
        username TEXT,
        workspace_id TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_accounts_email ON created_accounts(email);
      CREATE INDEX IF NOT EXISTS idx_accounts_service ON created_accounts(service);
      CREATE INDEX IF NOT EXISTS idx_accounts_created ON created_accounts(created_at);
      CREATE INDEX IF NOT EXISTS idx_accounts_workspace ON created_accounts(workspace_id);
    `);

    logger.info('Account repository initialized');
  }

  /**
   * Encrypt password before storage
   */
  private encrypt(text: string): string {
    try {
      const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Encryption failed', { error });
      // Fallback to base64 encoding if encryption fails
      return 'plain:' + Buffer.from(text).toString('base64');
    }
  }

  /**
   * Decrypt password from storage
   */
  private decrypt(encrypted: string): string {
    try {
      if (encrypted.startsWith('plain:')) {
        return Buffer.from(encrypted.slice(6), 'base64').toString('utf8');
      }
      
      const parts = encrypted.split(':');
      if (parts.length !== 2) return encrypted;
      
      const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error });
      return encrypted;
    }
  }

  /**
   * Create a new account
   */
  async create(input: CreateAccountInput): Promise<Account> {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO created_accounts 
      (id, service, email, password_encrypted, first_name, last_name, phone, birth_date, address, recovery_email, username, workspace_id, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.service,
      input.email,
      this.encrypt(input.password),
      input.firstName,
      input.lastName,
      input.phone || null,
      input.birthDate || null,
      input.address || null,
      input.recoveryEmail || null,
      input.username || null,
      input.workspaceId || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
      now
    );

    logger.info('Account created', { id, email: input.email, service: input.service });

    return this.findById(id) as Promise<Account>;
  }

  /**
   * Find account by ID
   */
  async findById(id: string): Promise<Account | null> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM created_accounts WHERE id = ?').get(id) as AccountRow | undefined;
    
    if (!row) return null;
    return this.mapRowToEntity(row);
  }

  /**
   * Find all accounts
   */
  async findAll(): Promise<Account[]> {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM created_accounts ORDER BY created_at DESC').all() as AccountRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find accounts by service
   */
  async findByService(service: string): Promise<Account[]> {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM created_accounts WHERE service = ? ORDER BY created_at DESC').all(service) as AccountRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find accounts by workspace
   */
  async findByWorkspace(workspaceId: string): Promise<Account[]> {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM created_accounts WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId) as AccountRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Search accounts by email or name
   */
  async search(query: string): Promise<Account[]> {
    const db = getDatabase();
    const searchPattern = `%${query}%`;
    const rows = db.prepare(`
      SELECT * FROM created_accounts 
      WHERE email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR username LIKE ?
      ORDER BY created_at DESC
    `).all(searchPattern, searchPattern, searchPattern, searchPattern) as AccountRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update account
   */
  async update(id: string, updates: Partial<CreateAccountInput>): Promise<Account | null> {
    const db = getDatabase();
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (updates.email !== undefined) {
      setClauses.push('email = ?');
      values.push(updates.email);
    }
    if (updates.password !== undefined) {
      setClauses.push('password_encrypted = ?');
      values.push(this.encrypt(updates.password));
    }
    if (updates.firstName !== undefined) {
      setClauses.push('first_name = ?');
      values.push(updates.firstName);
    }
    if (updates.lastName !== undefined) {
      setClauses.push('last_name = ?');
      values.push(updates.lastName);
    }
    if (updates.phone !== undefined) {
      setClauses.push('phone = ?');
      values.push(updates.phone);
    }
    if (updates.metadata !== undefined) {
      setClauses.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    values.push(id);

    db.prepare(`UPDATE created_accounts SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  /**
   * Delete account
   */
  async delete(id: string): Promise<boolean> {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM created_accounts WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get account count
   */
  async count(): Promise<number> {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM created_accounts').get() as { count: number };
    return row.count;
  }

  /**
   * Get count by service
   */
  async countByService(service: string): Promise<number> {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM created_accounts WHERE service = ?').get(service) as { count: number };
    return row.count;
  }

  /**
   * Export accounts to CSV format
   */
  async exportToCSV(): Promise<string> {
    const accounts = await this.findAll();
    
    const headers = ['Service', 'Email', 'Password', 'First Name', 'Last Name', 'Username', 'Phone', 'Created At'];
    const rows = accounts.map(acc => [
      acc.service,
      acc.email,
      acc.password,
      acc.firstName,
      acc.lastName,
      acc.username || '',
      acc.phone || '',
      acc.createdAt,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Map database row to entity
   */
  protected mapRowToEntity(row: unknown): Account {
    const accountRow = row as AccountRow;
    return {
      id: accountRow.id,
      service: accountRow.service,
      email: accountRow.email,
      password: this.decrypt(accountRow.password_encrypted),
      firstName: accountRow.first_name,
      lastName: accountRow.last_name,
      phone: accountRow.phone || undefined,
      birthDate: accountRow.birth_date || undefined,
      address: accountRow.address || undefined,
      recoveryEmail: accountRow.recovery_email || undefined,
      username: accountRow.username || undefined,
      workspaceId: accountRow.workspace_id || undefined,
      metadata: accountRow.metadata ? JSON.parse(accountRow.metadata) : undefined,
      createdAt: accountRow.created_at,
      updatedAt: accountRow.updated_at,
    };
  }
}
