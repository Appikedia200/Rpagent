/**
 * @fileoverview Winston Logger Configuration
 * @module electron/utils/logger
 *
 * Enterprise-grade logging with Winston.
 * Provides structured logging to console and file.
 */

import winston from 'winston';
import path from 'path';
import { app } from 'electron';
import { APP_CONFIG } from '../../shared/constants/app-config';

/**
 * Get log file path
 */
function getLogPath(): string {
  try {
    return path.join(app.getPath('userData'), APP_CONFIG.LOG_FILE_NAME);
  } catch {
    // Fallback for when app is not ready
    return path.join(process.cwd(), APP_CONFIG.LOG_FILE_NAME);
  }
}

/**
 * Custom log format
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

/**
 * Console format with colors
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} ${level} ${message}`;
    
    if (Object.keys(metadata).length > 0 && metadata.error) {
      const error = metadata.error as Error;
      msg += ` - ${error.message || error}`;
    }
    
    return msg;
  })
);

/**
 * Create transports based on environment
 */
function createTransports(): winston.transport[] {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    }),
  ];

  // Add file transport in production
  if (process.env.NODE_ENV !== 'development') {
    transports.push(
      new winston.transports.File({
        filename: getLogPath(),
        format: logFormat,
        maxsize: APP_CONFIG.LOG_MAX_SIZE,
        maxFiles: APP_CONFIG.LOG_MAX_FILES,
        tailable: true,
      })
    );
  }

  return transports;
}

/**
 * Winston logger instance
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: createTransports(),
  exitOnError: false,
});

/**
 * Log levels reference:
 * - error: Runtime errors that need immediate attention
 * - warn: Warning conditions that should be noted
 * - info: General operational information
 * - debug: Detailed debugging information
 */
