/**
 * @fileoverview IPC Channel Names - Single Source of Truth
 * @module shared/constants/ipc-channels
 *
 * Defines all Inter-Process Communication channels used between
 * Electron main process and renderer process. This ensures type-safe
 * and consistent channel naming across the entire application.
 */

export const IPC_CHANNELS = {
  // Workspace Management
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_CREATE_BULK: 'workspace:createBulk',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_GET_ALL: 'workspace:getAll',
  WORKSPACE_GET_BY_ID: 'workspace:getById',

  // Browser Control
  BROWSER_LAUNCH: 'browser:launch',
  BROWSER_CLOSE: 'browser:close',
  BROWSER_CLOSE_ALL: 'browser:closeAll',
  BROWSER_GET_ALL_ACTIVE: 'browser:getAllActive',
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_SCREENSHOT: 'browser:screenshot',

  // Proxy Management
  PROXY_CREATE: 'proxy:create',
  PROXY_GET_ALL: 'proxy:getAll',
  PROXY_GET_BY_ID: 'proxy:getById',
  PROXY_TEST: 'proxy:test',
  PROXY_TEST_ALL: 'proxy:testAll',
  PROXY_DELETE: 'proxy:delete',
  PROXY_BULK_IMPORT: 'proxy:bulkImport',
  PROXY_CREATE_CHAIN: 'proxy:createChain',

  // Workflow Management
  WORKFLOW_CREATE: 'workflow:create',
  WORKFLOW_GET_ALL: 'workflow:getAll',
  WORKFLOW_GET_BY_ID: 'workflow:getById',
  WORKFLOW_UPDATE: 'workflow:update',
  WORKFLOW_DELETE: 'workflow:delete',

  // Task Execution
  TASK_CREATE: 'task:create',
  TASK_EXECUTE: 'task:execute',
  TASK_GET_ALL: 'task:getAll',
  TASK_GET_BY_ID: 'task:getById',
  TASK_GET_RUNNING: 'task:getRunning',
  TASK_CANCEL: 'task:cancel',
  TASK_PAUSE: 'task:pause',
  TASK_RESUME: 'task:resume',
  TASK_DELETE: 'task:delete',
  TASK_CLEAR_ALL: 'task:clearAll',
  TASK_CLEAR_COMPLETED: 'task:clearCompleted',

  // Command Center
  COMMAND_EXECUTE: 'command:execute',
  COMMAND_PARSE: 'command:parse',
  COMMAND_GET_HISTORY: 'command:getHistory',
  COMMAND_CLEAR_HISTORY: 'command:clearHistory',

  // System
  SYSTEM_GET_STATS: 'system:getStats',
  SYSTEM_GET_HEALTH: 'system:getHealth',

  // Account Management
  ACCOUNT_CREATE: 'account:create',
  ACCOUNT_GET_ALL: 'account:getAll',
  ACCOUNT_GET_BY_ID: 'account:getById',
  ACCOUNT_SEARCH: 'account:search',
  ACCOUNT_DELETE: 'account:delete',
  ACCOUNT_EXPORT_CSV: 'account:exportCSV',
  ACCOUNT_GET_STATS: 'account:getStats',

  // Settings
  SETTINGS_GET_ALL: 'settings:getAll',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_GET: 'settings:get',

  // CAPTCHA Solving
  CAPTCHA_CONFIGURE: 'captcha:configure',
  CAPTCHA_VERIFY: 'captcha:verify',
  CAPTCHA_GET_BALANCE: 'captcha:getBalance',
  CAPTCHA_SOLVE: 'captcha:solve',

  // Phone Number Management
  PHONE_CONFIGURE_TELNYX: 'phone:configureTelnyx',
  PHONE_VERIFY_TELNYX: 'phone:verifyTelnyx',
  PHONE_ADD_NUMBER: 'phone:addNumber',
  PHONE_IMPORT_NUMBERS: 'phone:importNumbers',
  PHONE_REMOVE_NUMBER: 'phone:removeNumber',
  PHONE_GET_ALL: 'phone:getAll',
  PHONE_GET_AVAILABLE: 'phone:getAvailable',
  PHONE_RESERVE: 'phone:reserve',
  PHONE_RELEASE: 'phone:release',
  PHONE_GET_SMS_HISTORY: 'phone:getSMSHistory',
  PHONE_GET_STATS: 'phone:getStats',
  PHONE_FETCH_TELNYX: 'phone:fetchTelnyx',
  PHONE_PROCESS_SMS: 'phone:processSMS',

  // Events (main → renderer)
  EVENT_TASK_PROGRESS: 'event:taskProgress',
  EVENT_TASK_COMPLETED: 'event:taskCompleted',
  EVENT_TASK_FAILED: 'event:taskFailed',
  EVENT_BROWSER_STATUS: 'event:browserStatus',
  EVENT_BROWSER_SCREENSHOT: 'event:browserScreenshot',
  EVENT_NOTIFICATION: 'event:notification',
  EVENT_SYSTEM_STATS: 'event:systemStats',
  EVENT_ACCOUNT_CREATED: 'event:accountCreated',
  EVENT_ACCOUNT_DELETED: 'event:accountDeleted',
  
  // Phone Events
  PHONE_NUMBER_ADDED: 'event:phoneNumberAdded',
  PHONE_NUMBER_REMOVED: 'event:phoneNumberRemoved',
  PHONE_SMS_RECEIVED: 'event:phoneSMSReceived',
  
  // Scheduler
  SCHEDULER_CREATE: 'scheduler:create',
  SCHEDULER_GET_ALL: 'scheduler:getAll',
  SCHEDULER_GET_BY_ID: 'scheduler:getById',
  SCHEDULER_UPDATE: 'scheduler:update',
  SCHEDULER_PAUSE: 'scheduler:pause',
  SCHEDULER_RESUME: 'scheduler:resume',
  SCHEDULER_CANCEL: 'scheduler:cancel',
  
  // Monitoring
  MONITORING_GET_METRICS: 'monitoring:getMetrics',
  MONITORING_GET_ALERTS: 'monitoring:getAlerts',
  MONITORING_GET_BROWSER_METRICS: 'monitoring:getBrowserMetrics',
  MONITORING_CLEAR_ALERT: 'monitoring:clearAlert',
  MONITORING_CLEAR_ALL_ALERTS: 'monitoring:clearAllAlerts',
  
  // Queue
  QUEUE_GET_STATUS: 'queue:getStatus',
  QUEUE_PAUSE: 'queue:pause',
  QUEUE_RESUME: 'queue:resume',
  QUEUE_CLEAR: 'queue:clear',
  
  // Proxy Manager
  PROXY_MANAGER_GET_CHAINS: 'proxyManager:getChains',
  PROXY_MANAGER_CREATE_CHAIN: 'proxyManager:createChain',
  PROXY_MANAGER_TEST_CHAIN: 'proxyManager:testChain',
  PROXY_MANAGER_GET_NEXT_PROXY: 'proxyManager:getNextProxy',
} as const;

/**
 * Type for IPC channel keys
 */
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

/**
 * Alias for IPC_CHANNELS (used by handlers)
 */
export const IpcChannels = IPC_CHANNELS;
