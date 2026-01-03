/**
 * @fileoverview Database Initialization and Management
 * @module electron/database/db
 *
 * Manages SQLite database connection, initialization, and migrations.
 * Uses better-sqlite3 for synchronous, performant database operations.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { logger } from '../utils/logger';
import { APP_CONFIG } from '../../shared/constants/app-config';

/**
 * Database singleton instance
 */
let db: Database.Database | null = null;

/**
 * Database error class
 */
export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Get the database file path
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, APP_CONFIG.DATABASE_NAME);
}

/**
 * Initialize the database connection and run migrations
 * @returns The initialized database instance
 * @throws {DatabaseError} When initialization fails
 */
export async function initializeDatabase(): Promise<Database.Database> {
  const startTime = Date.now();
  
  try {
    logger.info('Initializing database...');
    
    const dbPath = getDatabasePath();
    const dbDir = path.dirname(dbPath);

    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info('Created database directory', { path: dbDir });
    }

    // Initialize database connection
    db = new Database(dbPath);
    
    // Configure database for optimal performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    
    logger.info('Database connection established', { path: dbPath });

    // Run migrations
    await runMigrations(db);

    const duration = Date.now() - startTime;
    logger.info('Database initialized successfully', { duration });

    return db;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Database initialization failed', { 
      error, 
      duration 
    });
    throw new DatabaseError(
      'Failed to initialize database',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Embedded migrations - avoids file system issues in packaged apps
 */
const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: '001_initial',
    sql: `
-- Initial Database Schema
-- Creates all core tables for RPA Agent

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    proxy_id TEXT,
    profile_id TEXT,
    fingerprint_id TEXT,
    initial_url TEXT,
    viewport_width INTEGER DEFAULT 1920,
    viewport_height INTEGER DEFAULT 1080,
    user_agent TEXT,
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME,
    FOREIGN KEY (proxy_id) REFERENCES proxies(id) ON DELETE SET NULL
);

-- Proxies table
CREATE TABLE IF NOT EXISTS proxies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    protocol TEXT NOT NULL DEFAULT 'http',
    type TEXT NOT NULL DEFAULT 'static',
    username TEXT,
    password TEXT,
    country TEXT,
    city TEXT,
    status TEXT NOT NULL DEFAULT 'unknown',
    speed INTEGER,
    last_tested DATETIME,
    assigned_to_workspace TEXT,
    last_used DATETIME,
    usage_count INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to_workspace) REFERENCES workspaces(id) ON DELETE SET NULL
);

-- Proxy chains table
CREATE TABLE IF NOT EXISTS proxy_chains (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    proxy_ids TEXT NOT NULL DEFAULT '[]',
    rotation_mode TEXT NOT NULL DEFAULT 'round-robin',
    health_check_interval INTEGER DEFAULT 60000,
    current_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    browsers INTEGER DEFAULT 1,
    steps TEXT NOT NULL DEFAULT '[]',
    data_source TEXT,
    variables TEXT,
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    target_workspaces TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    statistics TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    duration INTEGER,
    error TEXT,
    results TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Fingerprints table
CREATE TABLE IF NOT EXISTS fingerprints (
    id TEXT PRIMARY KEY,
    workspace_id TEXT UNIQUE,
    fingerprint_data TEXT NOT NULL,
    browser_version TEXT,
    os_version TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    use_count INTEGER DEFAULT 0,
    is_burned INTEGER DEFAULT 0,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Command history table
CREATE TABLE IF NOT EXISTS command_history (
    id TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    result_type TEXT NOT NULL,
    result_message TEXT,
    task_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Credentials store table (encrypted)
CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    service TEXT NOT NULL,
    username TEXT,
    password_encrypted TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Session store table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    cookies TEXT,
    local_storage TEXT,
    session_storage TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON workspaces(created_at);
CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
CREATE INDEX IF NOT EXISTS idx_proxies_protocol ON proxies(protocol);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_fingerprints_workspace ON fingerprints(workspace_id);
CREATE INDEX IF NOT EXISTS idx_fingerprints_burned ON fingerprints(is_burned);
CREATE INDEX IF NOT EXISTS idx_command_history_created ON command_history(created_at);
CREATE INDEX IF NOT EXISTS idx_credentials_workspace ON credentials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
    `
  }
];

/**
 * Safely add a column to a table if it doesn't exist
 */
function addColumnIfNotExists(
  database: Database.Database,
  table: string,
  column: string,
  definition: string
): boolean {
  try {
    // Check if column exists
    const tableInfo = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    const columnExists = tableInfo.some(col => col.name === column);
    
    if (!columnExists) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      logger.info(`Added column ${column} to ${table}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.warn(`Could not add column ${column} to ${table}`, { error });
    return false;
  }
}

/**
 * Run database migrations
 */
async function runMigrations(database: Database.Database): Promise<void> {
  try {
    logger.info('Running database migrations...');

    // Create migrations tracking table
    database.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    let appliedCount = 0;

    for (const migration of MIGRATIONS) {
      // Check if migration was already applied
      const executed = database
        .prepare('SELECT 1 FROM migrations WHERE name = ?')
        .get(migration.name);

      if (!executed) {
        // Run migration in transaction
        database.transaction(() => {
          database.exec(migration.sql);
          database
            .prepare('INSERT INTO migrations (name) VALUES (?)')
            .run(migration.name);
        })();

        logger.info('Applied migration', { name: migration.name });
        appliedCount++;
      }
    }

    // Apply column migrations for existing databases
    // These are safe to run multiple times
    addColumnIfNotExists(database, 'proxies', 'type', "TEXT DEFAULT 'static'");
    addColumnIfNotExists(database, 'proxies', 'assigned_to_workspace', 'TEXT');
    addColumnIfNotExists(database, 'proxies', 'last_used', 'DATETIME');
    addColumnIfNotExists(database, 'proxies', 'usage_count', 'INTEGER DEFAULT 0');
    addColumnIfNotExists(database, 'proxies', 'is_locked', 'INTEGER DEFAULT 0');
    addColumnIfNotExists(database, 'workspaces', 'proxy_id', 'TEXT');

    logger.info('Migrations completed', { applied: appliedCount });
  } catch (error) {
    logger.error('Migration failed', { error });
    throw new DatabaseError(
      'Failed to run migrations',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get the database instance
 * @throws {DatabaseError} When database is not initialized
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new DatabaseError('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
      db = null;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database', { error });
    }
  }
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return db !== null;
}
