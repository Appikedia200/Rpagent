/**
 * @fileoverview Electron Main Process Entry Point
 * @module electron/main
 *
 * Main entry point for the Electron application.
 * Handles window creation, database initialization, and IPC setup.
 */

import { app, BrowserWindow, session, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import { initializeDatabase, closeDatabase } from './database/db';
import { registerAllHandlers } from './ipc';
import { browserPool } from '../automation/browser-manager';
import { logger } from './utils/logger';
import { config } from './utils/config';

// Register custom protocol scheme before app is ready
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'app', 
    privileges: { 
      secure: true, 
      standard: true, 
      supportFetchAPI: true,
      corsEnabled: true,
    } 
  }
]);

/**
 * Main application window
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Create the main application window
 */
async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#0a0a0a',
    show: true, // Show immediately
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle page load errors
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logger.error('Page failed to load', { errorCode, errorDescription });
    mainWindow?.show(); // Show anyway so user sees something
  });

  // Load content - splash first for instant feedback
  try {
    if (config.isDevelopment) {
      logger.info('Loading development URL');
      await mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } else {
      logger.info('Loading production build via app:// protocol');
      // Load main app directly - splash is inline
      await mainWindow.loadURL('app://./index.html');
    }
  } catch (error) {
    logger.error('Failed to load content', { error });
    mainWindow.show();
  }
}

/**
 * Get MIME type for file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.txt': 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Register custom protocol handler for serving app files
 */
function registerAppProtocol(): void {
  const outDir = path.join(__dirname, '../../out');
  
  protocol.handle('app', (request) => {
    let urlPath = request.url.replace('app://', '');
    
    // Remove query strings and hash
    urlPath = urlPath.split('?')[0].split('#')[0];
    
    // Handle root path
    if (urlPath === '' || urlPath === '/') {
      urlPath = '/index.html';
    }
    
    // If path doesn't have extension, treat as directory and add index.html
    if (!path.extname(urlPath)) {
      urlPath = urlPath.endsWith('/') ? `${urlPath}index.html` : `${urlPath}/index.html`;
    }
    
    // Build full file path
    const filePath = path.join(outDir, urlPath);
    
    logger.debug('Protocol request', { url: request.url, filePath });
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.warn('File not found', { filePath });
        // Return 404 page or error
        return new Response('Not Found', { status: 404 });
      }
      
      const fileContent = fs.readFileSync(filePath);
      const mimeType = getMimeType(filePath);
      
      return new Response(fileContent, {
        headers: { 'Content-Type': mimeType },
      });
    } catch (error) {
      logger.error('Protocol handler error', { error, filePath });
      return new Response('Internal Error', { status: 500 });
    }
  });
  
  logger.info('App protocol registered', { outDir });
}

/**
 * Initialize application
 */
async function initialize(): Promise<void> {
  try {
    // Register custom protocol
    if (!config.isDevelopment) {
      registerAppProtocol();
    }

    // CSP
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' app:; " +
            "script-src 'self' app: 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' app: 'unsafe-inline'; " +
            "img-src 'self' app: data: blob:; " +
            "font-src 'self' app: data:; " +
            "connect-src 'self' app: ws://localhost:* http://localhost:* http://ip-api.com https://ipinfo.io https://ipwhois.app;"
          ],
        },
      });
    });

    // Set Playwright path
    if (config.playwrightBrowsersPath) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = config.playwrightBrowsersPath;
    }

    // Initialize database
    await initializeDatabase();

    // Create window
    await createWindow();

    // Register IPC handlers
    if (mainWindow) {
      registerAllHandlers(mainWindow);
    }
  } catch (error) {
    logger.error('Initialization failed', { error });
    app.quit();
  }
}

/**
 * Cleanup on quit
 */
async function cleanup(): Promise<void> {
  logger.info('Cleaning up...');

  try {
    // Close all browsers
    await browserPool.closeAll();
    logger.info('All browsers closed');

    // Close database
    closeDatabase();
    logger.info('Database closed');
  } catch (error) {
    logger.error('Cleanup error', { error });
  }
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.warn('Another instance is already running');
  app.quit();
} else {
  // Handle second instance
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  // App ready
  app.whenReady().then(initialize);

  // Handle app activation (macOS)
  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
}

// Window all closed
app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Before quit
app.on('before-quit', async () => {
  await cleanup();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});
