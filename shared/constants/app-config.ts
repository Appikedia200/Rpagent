/**
 * @fileoverview Application Configuration Constants
 * @module shared/constants/app-config
 *
 * Centralized configuration constants used throughout the application.
 * These values are shared between main and renderer processes.
 */

export const APP_CONFIG = {
  /** Application metadata */
  APP_NAME: 'RPA Agent',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'Enterprise RPA Agent for mass browser automation',

  /** Browser automation limits */
  MAX_BROWSERS: 100,
  DEFAULT_VIEWPORT_WIDTH: 480, // Smaller for tiling multiple browsers
  DEFAULT_VIEWPORT_HEIGHT: 360,
  TILED_VIEWPORT_WIDTH: 480, // For batch mode with many browsers
  TILED_VIEWPORT_HEIGHT: 360,
  FULL_VIEWPORT_WIDTH: 1280, // For single browser mode
  FULL_VIEWPORT_HEIGHT: 800,
  DEFAULT_TIMEOUT: 30000,
  NAVIGATION_TIMEOUT: 60000,
  
  /** Batch processing */
  BATCH_SIZE: 20, // Number of browsers to launch at once
  BATCH_DELAY: 3000, // Delay between batches (ms)
  STEP_DELAY: 1000, // Delay between workflow steps

  /** Database configuration */
  DATABASE_NAME: 'rpa-agent.db',
  FINGERPRINT_DB_NAME: 'fingerprints.db',

  /** Logging configuration */
  LOG_FILE_NAME: 'app.log',
  LOG_MAX_SIZE: 10 * 1024 * 1024, // 10 MB
  LOG_MAX_FILES: 5,

  /** Fingerprint rotation */
  FINGERPRINT_ROTATION_DAYS: 30,

  /** Network timeouts */
  PROXY_TEST_TIMEOUT: 10000,
  CAPTCHA_SOLVE_TIMEOUT: 120000,

  /** Behavioral AI configuration */
  TYPING_BASE_DELAY: 120, // ms
  MOUSE_MOVEMENT_STEPS_MIN: 50,
  MOUSE_MOVEMENT_STEPS_MAX: 100,
  SCROLL_DISTANCE_MEAN: 500, // px
  SCROLL_DISTANCE_STD: 150,

  /** Rate limiting */
  MIN_ACTION_DELAY: 100, // ms
  MAX_ACTION_DELAY: 500, // ms

  /** UI configuration */
  SIDEBAR_COLLAPSED_WIDTH: 64,
  SIDEBAR_EXPANDED_WIDTH: 256,
} as const;

/**
 * Environment-specific configuration
 */
export const ENV_CONFIG = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
