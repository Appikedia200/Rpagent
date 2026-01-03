/**
 * @fileoverview Browser Instance Management
 * @module automation/browser-manager/browser-instance
 *
 * Manages a single Playwright browser instance with anti-detection.
 * Integrates fingerprinting, behavioral AI, and stealth configuration.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { Workspace } from '../../shared/types/workspace.types';
import { Proxy } from '../../shared/types/proxy.types';
import { 
  HumanBehavior,
  FingerprintManager,
  MetaDetection,
} from '../stealth';
import { RealFingerprint } from '../stealth/real-fingerprint';
import { 
  detectIPGeolocation, 
  getDefaultGeolocation,
  addGeolocationVariation,
  IPGeolocationData,
} from '../stealth/ip-geolocation';
import { 
  applyProfessionalStealth, 
  applyProfessionalStealthToPage,
} from '../stealth/professional-stealth';
import { 
  getRegion,
  getVariedGeolocation,
  RegionConfig,
} from '../stealth/region-config';
import { injectBlueCursorToContext } from './blue-cursor';
import { logger } from '../../electron/utils/logger';
import { config } from '../../electron/utils/config';
import { APP_CONFIG } from '../../shared/constants/app-config';
import { getSettingsService } from '../../electron/services/settings.service';

/**
 * Get the profiles directory for persistent browser data
 */
function getProfilesDir(): string {
  const userDataPath = app?.getPath?.('userData') || process.cwd();
  return path.join(userDataPath, 'browser-profiles');
}

/**
 * Browser instance error class
 */
export class BrowserInstanceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'BrowserInstanceError';
  }
}

/**
 * Browser instance state
 */
export type BrowserInstanceState = 'idle' | 'launching' | 'active' | 'closing' | 'closed' | 'error';

/**
 * Browser instance for a single workspace
 */
export class BrowserInstance {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private state: BrowserInstanceState = 'idle';

  // Stealth modules
  private fingerprintManager: FingerprintManager;
  private humanBehavior: HumanBehavior | null = null;
  private metaDetection: MetaDetection;

  // Real browser fingerprint (extracted after launch)
  private realFingerprint: RealFingerprint | null = null;

  // Dynamic geolocation data from IP detection
  private geoData: IPGeolocationData | null = null;

  // Extracted data store
  public extractedData: Record<string, unknown> = {};

  constructor(
    public readonly workspace: Workspace,
    private readonly proxy?: Proxy
  ) {
    this.fingerprintManager = new FingerprintManager();
    this.metaDetection = new MetaDetection(this.fingerprintManager);
  }

  /**
   * Get the browser instance ID (same as workspace ID)
   */
  get id(): string {
    return this.workspace.id;
  }

  /**
   * Get the proxy ID (if any)
   */
  get proxyId(): string | undefined {
    return this.proxy?.id;
  }

  /**
   * Get the proxy host:port (if any)
   */
  get proxyInfo(): string | undefined {
    return this.proxy ? `${this.proxy.host}:${this.proxy.port}` : undefined;
  }

  /**
   * Launch the browser with stealth configuration and persistent profile
   */
  async launch(): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'closed') {
      throw new BrowserInstanceError(
        `Cannot launch browser in state: ${this.state}`
      );
    }

    const startTime = Date.now();
    this.state = 'launching';

    // LOG PROXY STATUS IMMEDIATELY
    logger.info('BrowserInstance.launch() called', {
      workspaceId: this.workspace.id,
      workspaceName: this.workspace.name,
      hasProxy: !!this.proxy,
      proxyDetails: this.proxy ? {
        id: this.proxy.id,
        host: this.proxy.host,
        port: this.proxy.port,
        protocol: this.proxy.protocol,
        hasAuth: !!(this.proxy.username && this.proxy.password),
      } : null,
    });

    try {
      // Get settings from database
      const settingsService = getSettingsService();
      try {
        await settingsService.initialize();
      } catch {
        // Settings not yet initialized - use defaults
      }
      const appSettings = settingsService.getAll();

      logger.info('Launching browser instance with settings', { 
        workspaceId: this.workspace.id,
        workspaceName: this.workspace.name,
        undetectableMode: appSettings.undetectableMode,
        humanBehavior: appSettings.humanBehavior,
        blockWebRTC: appSettings.blockWebRTC,
        region: appSettings.region,
      });

      // Set Playwright browsers path for production (only if exists)
      if (config.playwrightBrowsersPath && fs.existsSync(config.playwrightBrowsersPath)) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = config.playwrightBrowsersPath;
        logger.debug('Using bundled Playwright browsers', { path: config.playwrightBrowsersPath });
      } else {
        // Let Playwright use its default browser path
        logger.debug('Using default Playwright browser path');
      }

      // Create persistent profile directory for this workspace
      const profilesDir = getProfilesDir();
      const workspaceProfileDir = path.join(profilesDir, this.workspace.id);
      
      // Ensure profile directory exists
      if (!fs.existsSync(profilesDir)) {
        fs.mkdirSync(profilesDir, { recursive: true });
      }
      
      // If proxy is configured, delete old profile to ensure proxy settings are fresh
      // Old profiles may have cached proxy bypass settings that prevent proxy from working
      if (this.proxy && fs.existsSync(workspaceProfileDir)) {
        logger.info('Deleting old profile to ensure fresh proxy settings', {
          profilePath: workspaceProfileDir,
          proxyHost: this.proxy.host,
        });
        try {
          fs.rmSync(workspaceProfileDir, { recursive: true, force: true });
        } catch (e) {
          logger.warn('Failed to delete old profile, continuing anyway', { error: e });
        }
      }

      // GEOLOCATION CONFIGURATION
      // Use settings from database, fallback to workspace or "auto"
      const regionSetting = appSettings.region || this.workspace.settings?.region || 'auto';
      
      let geoData: IPGeolocationData;
      let geolocation: { latitude: number; longitude: number; accuracy: number };
      
      if (regionSetting === 'auto') {
        // AUTO-DETECT from proxy IP or actual IP
        // Use a short timeout to avoid blocking browser launch
        logger.info('Auto-detecting geolocation from IP (with 2s timeout)...');
        try {
          const geoPromise = detectIPGeolocation();
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
          
          const result = await Promise.race([geoPromise, timeoutPromise]);
          
          if (result) {
            geoData = result;
            logger.info('IP geolocation detected', {
              ip: geoData.ip,
              country: geoData.country,
              timezone: geoData.timezone,
              language: geoData.language,
            });
          } else {
            logger.warn('IP geolocation timed out, using US defaults');
            geoData = getDefaultGeolocation();
          }
        } catch (geoError) {
          logger.warn('Failed to detect IP geolocation, using default', { error: geoError });
          geoData = getDefaultGeolocation();
        }
        // Get varied geolocation (slight offset to avoid exact matches)
        geolocation = addGeolocationVariation(geoData);
      } else {
        // MANUAL REGION - use preset configuration
        const regionConfig: RegionConfig | undefined = getRegion(regionSetting);
        if (regionConfig) {
          logger.info('Using manual region config', {
            region: regionConfig.id,
            name: regionConfig.name,
            timezone: regionConfig.timezone,
          });
          // Convert RegionConfig to IPGeolocationData format
          geoData = {
            ip: '0.0.0.0', // Not used for manual
            country: regionConfig.country,
            countryCode: regionConfig.countryCode,
            city: regionConfig.name,
            region: regionConfig.name,
            timezone: regionConfig.timezone,
            timezoneOffset: regionConfig.timezoneOffset,
            latitude: regionConfig.geolocation.latitude,
            longitude: regionConfig.geolocation.longitude,
            isp: 'Unknown',
            org: 'Unknown',
            language: regionConfig.language,
            languages: regionConfig.languages,
            locale: regionConfig.locale,
            acceptLanguage: regionConfig.acceptLanguage,
            detectedAt: new Date().toISOString(),
            source: 'manual-region',
          };
          geolocation = getVariedGeolocation(regionConfig);
        } else {
          // Invalid region, fallback to auto-detect
          logger.warn('Invalid region setting, falling back to auto-detect', { regionSetting });
          geoData = await detectIPGeolocation().catch(() => getDefaultGeolocation());
          geolocation = addGeolocationVariation(geoData);
        }
      }

      // Get real user agent for current platform
      const chromeVersion = '131.0.0.0';
      const userAgent = process.platform === 'win32'
        ? `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
        : process.platform === 'darwin'
        ? `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
        : `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

      logger.info('Using persistent profile with DYNAMIC geo data', { 
        profilePath: workspaceProfileDir,
        ip: geoData.ip,
        country: geoData.country,
        timezone: geoData.timezone,
        language: geoData.language,
      });

      // Use reasonable default viewport - browser can be resized by user
      // Don't use tiny viewports - many sites don't work well with small windows
      const viewportWidth = this.workspace.viewport?.width || 1280;
      const viewportHeight = this.workspace.viewport?.height || 800;

      // Build launch options for UNDETECTABLE browsing
      // These flags are CRITICAL for passing bot detection
      const launchArgs = [
        // Basic Chromium flags
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        `--window-size=${viewportWidth},${viewportHeight}`,
        '--start-maximized',
        
        // CRITICAL: Hide all automation indicators
        '--disable-blink-features=AutomationControlled',
        
        // Remove automation extension
        '--disable-extensions',
        
        // Hide info bars
        '--disable-infobars',
        
        // Proper rendering
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        
        // Language/Region
        `--lang=${geoData.language}`,
        `--accept-lang=${geoData.acceptLanguage}`,
        
        // Disable automation-revealing features
        '--disable-features=TranslateUI,AutomationControlled,EnableAutomation',
        '--disable-automation',
        
        // Disable site isolation for iframe stealth
        '--disable-site-isolation-trials',
        
        // GPU (use real GPU for WebGL fingerprint)
        '--enable-webgl',
        '--use-gl=desktop',
        
        // Network
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        
        // User data (forces fresh profile settings)
        '--disable-default-apps',
        '--disable-sync',
        
        // Performance flags that look like a real browser
        '--enable-features=NetworkService,NetworkServiceInProcess',
        
        // Metrics
        '--metrics-recording-only',
        
        // Passwords (disable for automation)
        '--password-store=basic',
        '--use-mock-keychain',
      ];
      
      // Block WebRTC to prevent IP leaks if enabled in settings
      if (appSettings.blockWebRTC) {
        launchArgs.push(
          '--disable-webrtc-hw-decoding',
          '--disable-webrtc-hw-encoding',
          '--disable-webrtc-multiple-routes',
          '--disable-webrtc-hw-vp8-encoding',
          '--enforce-webrtc-ip-permission-check',
          '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'
        );
      }

      // Proxy configuration - EMBED CREDENTIALS IN URL for maximum compatibility
      // launchPersistentContext has known issues with separate username/password
      let proxyConfig: { server: string; username?: string; password?: string } | undefined;
      
      if (this.proxy) {
        // Always use HTTP for proxies with auth (SOCKS5 auth not supported by Chromium)
        let protocol = (this.proxy.protocol?.toLowerCase() || 'http');
        const hasAuth = !!(this.proxy.username && this.proxy.password);
        
        if ((protocol === 'socks5' || protocol === 'socks4') && hasAuth) {
          logger.warn('SOCKS5 with auth not supported by Chromium, using HTTP', {
            originalProtocol: protocol,
          });
          protocol = 'http';
        }
        
        // Build proxy server URL
        let proxyServer: string;
        
        if (hasAuth) {
          // EMBED credentials in URL: http://user:pass@host:port
          // This is more reliable than separate username/password fields
          const encodedUser = encodeURIComponent(this.proxy.username!.trim());
          const encodedPass = encodeURIComponent(this.proxy.password!.trim());
          proxyServer = `${protocol}://${encodedUser}:${encodedPass}@${this.proxy.host}:${this.proxy.port}`;
          
          logger.info('PROXY WITH EMBEDDED AUTH', {
            host: this.proxy.host,
            port: this.proxy.port,
            protocol: protocol,
            user: this.proxy.username,
          });
        } else {
          proxyServer = `${protocol}://${this.proxy.host}:${this.proxy.port}`;
        }
        
        // Build Playwright proxy config
        proxyConfig = {
          server: proxyServer,
        };
        
        // ALSO add separate credentials as fallback
        if (hasAuth) {
          proxyConfig.username = this.proxy.username!.trim();
          proxyConfig.password = this.proxy.password!.trim();
        }
        
        logger.info('FINAL PROXY CONFIG', {
          server: proxyServer.replace(/:[^:@]+@/, ':***@'), // Hide password in logs
          hasAuth: hasAuth,
        });
      } else {
        logger.warn('NO PROXY PROVIDED TO BROWSER INSTANCE', {
          workspaceId: this.workspace.id,
        });
      }

      // Store geo data for later use
      this.geoData = geoData;

      // Launch persistent context with DYNAMIC settings from IP detection
      logger.info('Launching Chromium with proxy config', { 
        hasProxy: !!proxyConfig, 
        proxyServer: proxyConfig?.server,
      });
      
      try {
        this.context = await chromium.launchPersistentContext(workspaceProfileDir, {
          headless: false,
          args: launchArgs,
          // Set viewport to null to allow window resizing and maximizing
          viewport: null,
          // Real Chrome user agent
          userAgent: userAgent,
          // Dynamic locale from IP
          locale: geoData.locale,
          // DYNAMIC timezone from IP - CRITICAL for whoer.net
          timezoneId: geoData.timezone,
          // Dynamic geolocation from IP
          geolocation: {
            latitude: geolocation.latitude,
            longitude: geolocation.longitude,
            accuracy: geolocation.accuracy,
          },
          permissions: ['geolocation', 'notifications'],
          colorScheme: 'light',
          isMobile: false,
          hasTouch: false,
          javaScriptEnabled: true,
          bypassCSP: false,
          // Dynamic accept language from IP
          extraHTTPHeaders: {
            'Accept-Language': geoData.acceptLanguage,
          },
          // PROXY CONFIGURATION - Playwright handles auth properly
          proxy: proxyConfig,
          // Timeout for browser launch (60 seconds)
          timeout: 60000,
        });
      } catch (launchError) {
        const actualError = launchError instanceof Error ? launchError.message : String(launchError);
        logger.error('Failed to launch browser context', { 
          error: actualError,
          stack: launchError instanceof Error ? launchError.stack : undefined,
          hasProxy: !!proxyConfig,
          proxyServer: proxyConfig?.server,
          proxyUsername: proxyConfig?.username ? 'SET' : 'NOT_SET',
        });
        // Pass through the ACTUAL Playwright error - don't hide it!
        throw launchError;
      }

      // Apply PROFESSIONAL stealth patches with DYNAMIC geo data
      // Wrapped in try/catch to not fail browser launch
      try {
        await applyProfessionalStealth(this.context, geoData);
      } catch (stealthError) {
        logger.warn('Stealth patches failed, continuing without them', { error: stealthError });
      }
      
      // Inject blue cursor overlay for visual feedback
      try {
        await injectBlueCursorToContext(this.context);
      } catch (cursorError) {
        logger.warn('Blue cursor injection failed', { error: cursorError });
      }

      // Get the first page or create new one
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

      // PLAYWRIGHT EMULATION - Properly emulate media and color scheme
      try {
        await this.page.emulateMedia({
          colorScheme: 'light',
          reducedMotion: 'no-preference',
          forcedColors: 'none',
        });
      } catch (emulateError) {
        logger.debug('Media emulation not fully supported', { error: emulateError });
      }

      // Apply page-level stealth with dynamic geo data
      try {
        await applyProfessionalStealthToPage(this.page, geoData);
      } catch (pageStealthError) {
        logger.warn('Page-level stealth patches failed', { error: pageStealthError });
      }

      // Initialize human behavior module
      this.humanBehavior = new HumanBehavior(this.page);

      // Skip fingerprint extraction for faster launch (do it lazily if needed)
      // This was causing startup delays

      // Navigate to initial URL if provided
      if (this.workspace.initialUrl) {
        try {
          await this.page.goto(this.workspace.initialUrl, {
            waitUntil: 'domcontentloaded', // Faster than networkidle
            timeout: APP_CONFIG.NAVIGATION_TIMEOUT,
          });

          // Check for detection (lighter version)
          await this.metaDetection.checkDetectionSignals(this.page, this.workspace.id);
        } catch (navError) {
          logger.warn('Initial navigation failed, browser still launched', { error: navError });
        }
      }

      this.state = 'active';

      const duration = Date.now() - startTime;
      logger.info('Browser instance launched with DYNAMIC anti-detection', {
        workspaceId: this.workspace.id,
        profilePath: workspaceProfileDir,
        fingerprintHash: this.realFingerprint?.combinedHash || 'unknown',
        ip: geoData.ip,
        timezone: geoData.timezone,
        country: geoData.country,
        language: geoData.language,
        duration,
      });
    } catch (error) {
      this.state = 'error';
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to launch browser instance', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        workspaceId: this.workspace.id,
        duration,
      });

      // Cleanup on failure
      await this.cleanup();

      // Pass through the ACTUAL error message from Playwright
      throw new BrowserInstanceError(
        errorMessage || 'Failed to launch browser',
        error instanceof Error ? error : undefined
      );
    }
  }


  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new BrowserInstanceError('Browser not launched');
    }

    try {
      logger.debug('Navigating to URL', { 
        workspaceId: this.workspace.id, 
        url,
      });

      await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: APP_CONFIG.NAVIGATION_TIMEOUT,
      });

      // Check for detection after navigation
      await this.metaDetection.checkDetectionSignals(this.page, this.workspace.id);

      // Simulate reading behavior
      if (this.humanBehavior && Math.random() < 0.3) {
        await this.humanBehavior.simulateReading();
      }
    } catch (error) {
      logger.error('Navigation failed', { error, url, workspaceId: this.workspace.id });
      throw new BrowserInstanceError(
        'Navigation failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(path?: string): Promise<Buffer> {
    if (!this.page) {
      throw new BrowserInstanceError('Browser not launched');
    }

    try {
      const buffer = await this.page.screenshot({
        path,
        fullPage: false,
        type: 'png',
      });

      logger.debug('Screenshot taken', { workspaceId: this.workspace.id, path });
      return buffer;
    } catch (error) {
      logger.error('Screenshot failed', { error, workspaceId: this.workspace.id });
      throw new BrowserInstanceError(
        'Screenshot failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.state === 'closed' || this.state === 'closing') {
      return;
    }

    this.state = 'closing';
    const startTime = Date.now();

    try {
      await this.cleanup();
      this.state = 'closed';

      const duration = Date.now() - startTime;
      logger.info('Browser instance closed', {
        workspaceId: this.workspace.id,
        duration,
      });
    } catch (error) {
      this.state = 'error';
      logger.error('Error closing browser instance', {
        error,
        workspaceId: this.workspace.id,
      });
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // For persistent context, we close the context which closes all pages
    if (this.context) {
      try {
        await this.context.close();
      } catch (closeError) {
        logger.debug('Context close error (expected if already closed)', { error: closeError });
      }
      this.context = null;
      this.page = null;
    }

    // Legacy browser cleanup (if used)
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (closeError) {
        logger.debug('Browser close error (expected if already closed)', { error: closeError });
      }
      this.browser = null;
    }

    this.humanBehavior = null;
  }

  /**
   * Get the page instance
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Get the context instance
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Get human behavior module
   */
  getHumanBehavior(): HumanBehavior | null {
    return this.humanBehavior;
  }

  /**
   * Get meta detection module
   */
  getMetaDetection(): MetaDetection {
    return this.metaDetection;
  }

  /**
   * Get fingerprint manager
   */
  getFingerprintManager(): FingerprintManager {
    return this.fingerprintManager;
  }

  /**
   * Get the REAL browser fingerprint (extracted after launch)
   */
  getRealFingerprint(): RealFingerprint | null {
    return this.realFingerprint;
  }

  /**
   * Get real fingerprint hash for display
   */
  getRealFingerprintHash(): string {
    return this.realFingerprint?.combinedHash || 'not-extracted';
  }

  /**
   * Get the detected IP geolocation data
   */
  getGeoData(): IPGeolocationData | null {
    return this.geoData;
  }

  /**
   * Check if browser is launched
   */
  isLaunched(): boolean {
    // With launchPersistentContext, we use context instead of browser
    return this.state === 'active' && (this.context !== null || this.browser !== null) && this.page !== null;
  }

  /**
   * Get current state
   */
  getState(): BrowserInstanceState {
    return this.state;
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string | null {
    return this.page?.url() ?? null;
  }
}

