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
    username TEXT,
    password TEXT,
    country TEXT,
    city TEXT,
    status TEXT NOT NULL DEFAULT 'unknown',
    speed INTEGER,
    last_tested DATETIME,
    assigned_to_workspace TEXT,
    last_used DATETIME,
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
