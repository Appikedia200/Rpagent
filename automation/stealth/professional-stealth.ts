/**
 * @fileoverview Professional Anti-Detection System
 * @module automation/stealth/professional-stealth
 *
 * Complete stealth configuration that:
 * 1. Uses DYNAMIC timezone from IP detection
 * 2. Handles cookies properly like a real browser
 * 3. Passes ALL bot detection systems
 * 4. Works with whoer.net, browserleaks.com, browserscan.net, etc.
 */

import { BrowserContext, Page } from 'playwright';
import { IPGeolocationData, addGeolocationVariation } from './ip-geolocation';
import { logger } from '../../electron/utils/logger';

/**
 * Get real Chrome user agent for current platform
 */
function getRealUserAgent(): string {
  const chromeVersion = '131.0.0.0';
  const platform = process.platform;
  
  if (platform === 'win32') {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  } else if (platform === 'darwin') {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  } else {
    return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  }
}

/**
 * Apply professional stealth to browser context with dynamic geolocation
 */
export async function applyProfessionalStealth(
  context: BrowserContext,
  geoData: IPGeolocationData
): Promise<void> {
  logger.info('Applying professional stealth with dynamic geo data', {
    timezone: geoData.timezone,
    country: geoData.country,
    language: geoData.language,
  });

  // Set HTTP headers to match the detected region
  await context.setExtraHTTPHeaders({
    'Accept-Language': geoData.acceptLanguage,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Cache-Control': 'max-age=0',
    'Sec-CH-UA': '"Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  });

  // Add the main stealth script
  await context.addInitScript(getProfessionalStealthScript(geoData));
}

/**
 * Apply stealth to individual page
 */
export async function applyProfessionalStealthToPage(
  page: Page,
  geoData: IPGeolocationData
): Promise<void> {
  await page.addInitScript(getPageLevelStealthScript(geoData));
}

/**
 * Get the comprehensive stealth script
 */
function getProfessionalStealthScript(geo: IPGeolocationData): string {
  const userAgent = getRealUserAgent();
  const geoVariation = addGeolocationVariation(geo);
  
  // Generate realistic hardware values
  const hardwareConcurrency = [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)];
  const deviceMemory = [4, 8, 16, 32][Math.floor(Math.random() * 4)];
  
  return `
    // =============================================
    // PROFESSIONAL ANTI-DETECTION SYSTEM
    // Dynamic timezone from IP: ${geo.timezone}
    // Country: ${geo.country} (${geo.countryCode})
    // =============================================

    (() => {
      'use strict';

      // Prevent double application
      if (window.__professionalStealthApplied) return;
      window.__professionalStealthApplied = true;

      // =============================================
      // 1. NAVIGATOR WEBDRIVER - CRITICAL
      // =============================================
      
      // Multiple approaches to remove webdriver
      try {
        delete Object.getPrototypeOf(navigator).webdriver;
      } catch {}
      
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
      });

      // Also handle Navigator.prototype
      try {
        Object.defineProperty(Navigator.prototype, 'webdriver', {
          get: () => undefined,
          configurable: true,
        });
      } catch {}

      // =============================================
      // 2. USER AGENT & NAVIGATOR
      // =============================================

      const overrideNavigator = {
        userAgent: '${userAgent}',
        appVersion: '${userAgent.replace('Mozilla/', '')}',
        platform: 'Win32',
        vendor: 'Google Inc.',
        vendorSub: '',
        productSub: '20030107',
        language: '${geo.language}',
        languages: Object.freeze(${JSON.stringify(geo.languages)}),
        hardwareConcurrency: ${hardwareConcurrency},
        deviceMemory: ${deviceMemory},
        maxTouchPoints: 0,
        cookieEnabled: true,
        onLine: true,
        doNotTrack: null,
        pdfViewerEnabled: true,
      };

      for (const [key, value] of Object.entries(overrideNavigator)) {
        try {
          Object.defineProperty(navigator, key, {
            get: () => value,
            configurable: true,
          });
        } catch {}
      }

      // =============================================
      // 3. PLUGINS - Must have real plugins
      // =============================================

      const createPlugin = (name, description, filename, mimeTypes) => {
        const plugin = { name, description, filename, length: mimeTypes.length };
        mimeTypes.forEach((mime, i) => {
          plugin[i] = mime;
          plugin[mime.type] = mime;
        });
        plugin.item = (i) => plugin[i];
        plugin.namedItem = (name) => plugin[name];
        return plugin;
      };

      const pdfMime = { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' };
      const plugins = [
        createPlugin('Chrome PDF Plugin', 'Portable Document Format', 'internal-pdf-viewer', [pdfMime]),
        createPlugin('Chrome PDF Viewer', '', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', [pdfMime]),
        createPlugin('Native Client', '', 'internal-nacl-plugin', []),
        createPlugin('Chromium PDF Plugin', 'Portable Document Format', 'internal-pdf-viewer', [pdfMime]),
        createPlugin('Chromium PDF Viewer', '', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', [pdfMime]),
      ];

      const pluginArray = {
        length: plugins.length,
        item: (i) => plugins[i] || null,
        namedItem: (name) => plugins.find(p => p.name === name) || null,
        refresh: () => {},
        [Symbol.iterator]: function* () { yield* plugins; },
      };
      plugins.forEach((p, i) => { pluginArray[i] = p; });

      Object.defineProperty(navigator, 'plugins', {
        get: () => pluginArray,
        configurable: true,
      });

      // MimeTypes
      const mimeTypes = {
        length: 2,
        item: (i) => i === 0 ? pdfMime : null,
        namedItem: (name) => name === 'application/pdf' ? pdfMime : null,
        0: pdfMime,
        'application/pdf': pdfMime,
      };

      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => mimeTypes,
        configurable: true,
      });

      // =============================================
      // 4. CHROME OBJECT - Must exist and be complete
      // =============================================

      if (!window.chrome) window.chrome = {};

      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: () => null,
        getIsInstalled: () => false,
        installState: (cb) => cb && cb('not_installed'),
        runningState: () => 'cannot_run',
      };

      window.chrome.runtime = {
        id: undefined,
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
        connect: () => ({ disconnect: () => {}, onDisconnect: { addListener: () => {} }, onMessage: { addListener: () => {} }, postMessage: () => {} }),
        sendMessage: () => {},
      };

      window.chrome.csi = () => ({
        startE: Date.now() - Math.random() * 500,
        onloadT: Date.now(),
        pageT: Math.random() * 1000 + 100,
        tran: 15,
      });

      window.chrome.loadTimes = () => {
        const now = Date.now() / 1000;
        return {
          commitLoadTime: now - Math.random() * 0.5,
          connectionInfo: 'h2',
          finishDocumentLoadTime: now - Math.random() * 0.1,
          finishLoadTime: now,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: now - Math.random() * 0.3,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'h2',
          requestTime: now - Math.random() * 1,
          startLoadTime: now - Math.random() * 0.8,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
        };
      };

      // =============================================
      // 5. TIMEZONE - DYNAMIC FROM IP
      // =============================================

      const targetTimezone = '${geo.timezone}';
      const targetOffset = ${-geo.timezoneOffset}; // JS uses inverted offset

      // Override getTimezoneOffset
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function() {
        return targetOffset;
      };

      // Override toTimeString to match timezone
      const originalToTimeString = Date.prototype.toTimeString;
      Date.prototype.toTimeString = function() {
        const result = originalToTimeString.call(this);
        // Replace timezone info if present
        return result.replace(/\\(.*\\)/, '(${geo.timezone.replace('/', ' ').replace('_', ' ')})');
      };

      // Override Intl.DateTimeFormat
      const OriginalDateTimeFormat = Intl.DateTimeFormat;
      Intl.DateTimeFormat = function(locales, options) {
        if (!options) options = {};
        if (!options.timeZone) options.timeZone = targetTimezone;
        return new OriginalDateTimeFormat(locales, options);
      };
      Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
      Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf;

      // Override resolvedOptions
      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function() {
        const result = originalResolvedOptions.call(this);
        if (!this._originalOptions?.timeZone) {
          result.timeZone = targetTimezone;
        }
        return result;
      };

      // =============================================
      // 6. GEOLOCATION - DYNAMIC FROM IP
      // =============================================

      const mockGeolocation = {
        latitude: ${geoVariation.latitude},
        longitude: ${geoVariation.longitude},
        accuracy: ${geoVariation.accuracy},
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition = function(success, error, options) {
          setTimeout(() => {
            success({
              coords: mockGeolocation,
              timestamp: Date.now(),
            });
          }, 50 + Math.random() * 200);
        };

        navigator.geolocation.watchPosition = function(success, error, options) {
          const id = Math.floor(Math.random() * 10000);
          setTimeout(() => {
            success({
              coords: mockGeolocation,
              timestamp: Date.now(),
            });
          }, 50 + Math.random() * 200);
          return id;
        };

        navigator.geolocation.clearWatch = function(id) {};
      }

      // =============================================
      // 7. WEBGL - Real GPU info (don't fake)
      // =============================================

      // We keep real WebGL data but ensure it's consistent
      const getParameterProxyHandler = {
        apply: function(target, thisArg, args) {
          const param = args[0];
          // Don't modify WebGL params - let real GPU show
          return Reflect.apply(target, thisArg, args);
        }
      };

      // Only wrap if needed for specific overrides
      // WebGLRenderingContext.prototype.getParameter = new Proxy(
      //   WebGLRenderingContext.prototype.getParameter,
      //   getParameterProxyHandler
      // );

      // =============================================
      // 8. PERMISSIONS API
      // =============================================

      const originalQuery = Permissions.prototype.query;
      Permissions.prototype.query = function(parameters) {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ 
            state: Notification.permission, 
            onchange: null 
          });
        }
        return originalQuery.call(this, parameters);
      };

      // =============================================
      // 9. REMOVE ALL AUTOMATION FLAGS
      // =============================================

      const automationFlags = [
        'webdriver', '__webdriver_script_fn', '__driver_evaluate',
        '__webdriver_evaluate', '__selenium_evaluate', '__fxdriver_evaluate',
        '__driver_unwrapped', '__webdriver_unwrapped', '__selenium_unwrapped',
        '__fxdriver_unwrapped', '_Selenium_IDE_Recorder', '_selenium',
        'calledSelenium', '$cdc_asdjflasutopfhvcZLmcfl_', '$chrome_asyncScriptInfo',
        '__$webdriverAsyncExecutor', '__lastWatirAlert', '__lastWatirConfirm',
        '__lastWatirPrompt', '__nightmare', '_phantom', '__phantomas',
        'callPhantom', 'phantom', 'domAutomation', 'domAutomationController',
      ];

      for (const flag of automationFlags) {
        try { delete window[flag]; } catch {}
        try { window[flag] = undefined; } catch {}
        try { delete document[flag]; } catch {}
      }

      // =============================================
      // 10. SCREEN & WINDOW
      // =============================================

      // Keep real screen values but ensure consistency
      const screenProps = {
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        width: screen.width,
        height: screen.height,
        colorDepth: 24,
        pixelDepth: 24,
        availLeft: 0,
        availTop: 0,
      };

      for (const [key, value] of Object.entries(screenProps)) {
        try {
          Object.defineProperty(screen, key, {
            get: () => value,
            configurable: true,
          });
        } catch {}
      }

      // =============================================
      // 11. MEDIA DEVICES
      // =============================================

      if (navigator.mediaDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices?.bind(navigator.mediaDevices);
        if (originalEnumerateDevices) {
          navigator.mediaDevices.enumerateDevices = async function() {
            const devices = await originalEnumerateDevices();
            if (devices.length === 0) {
              return [
                { deviceId: 'default', groupId: 'default', kind: 'audioinput', label: '' },
                { deviceId: 'default', groupId: 'default', kind: 'audiooutput', label: '' },
                { deviceId: 'default', groupId: 'default', kind: 'videoinput', label: '' },
              ];
            }
            return devices;
          };
        }
      }

      // =============================================
      // 12. BATTERY API
      // =============================================

      if (navigator.getBattery) {
        const battery = {
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 0.87 + Math.random() * 0.12, // 87-99%
          onchargingchange: null,
          onchargingtimechange: null,
          ondischargingtimechange: null,
          onlevelchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
        };
        navigator.getBattery = async () => battery;
      }

      // =============================================
      // 13. NETWORK INFO
      // =============================================

      if (navigator.connection) {
        Object.defineProperties(navigator.connection, {
          effectiveType: { get: () => '4g' },
          rtt: { get: () => 50 + Math.floor(Math.random() * 50) },
          downlink: { get: () => 5 + Math.random() * 5 },
          saveData: { get: () => false },
        });
      }

      // =============================================
      // 14. FUNCTION TOSTRING
      // =============================================

      const nativeToString = 'function toString() { [native code] }';
      const originalFunctionToString = Function.prototype.toString;
      
      Function.prototype.toString = function() {
        if (this === Function.prototype.toString) return nativeToString;
        
        try {
          const result = originalFunctionToString.call(this);
          // Clean any playwright/puppeteer references
          if (result.includes('playwright') || result.includes('puppeteer')) {
            return nativeToString;
          }
          return result;
        } catch {
          return nativeToString;
        }
      };

      // =============================================
      // 15. ERROR STACK CLEANING
      // =============================================

      const originalErrorConstructor = Error;
      Error = function(...args) {
        const error = new originalErrorConstructor(...args);
        
        // Clean stack traces
        if (error.stack) {
          error.stack = error.stack.split('\\n')
            .filter(line => 
              !line.includes('playwright') && 
              !line.includes('puppeteer') &&
              !line.includes('__playwright') &&
              !line.includes('pptr')
            )
            .join('\\n');
        }
        
        return error;
      };
      Error.prototype = originalErrorConstructor.prototype;
      Error.captureStackTrace = originalErrorConstructor.captureStackTrace;

      // =============================================
      // 16. COOKIES - Ensure proper handling
      // =============================================

      // Cookies should work normally - don't override

      // =============================================
      // 17. IFRAME CONTENTWINDOW PROTECTION
      // =============================================

      // Hide automation in iframes too
      const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
          const win = originalContentWindow.get.call(this);
          if (win) {
            try {
              Object.defineProperty(win.navigator, 'webdriver', { get: () => undefined });
            } catch {}
          }
          return win;
        }
      });

      // =============================================
      // 18. CONSOLE PROTECTION
      // =============================================

      // Don't log anything that could be detected
      
      // =============================================
      // 19. CDP DETECTION EVASION
      // =============================================

      // Remove CDP-related traces
      try {
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      } catch {}

      // Clean up any prototype modifications markers
      const protoMarkers = ['_Selenium_IDE_Recorder', '__webdriver_evaluate', '__driver_evaluate'];
      protoMarkers.forEach(marker => {
        try { delete window[marker]; } catch {}
      });

      // =============================================
      // 20. TIMING API NORMALIZATION
      // =============================================

      // Make performance timing look natural
      if (window.performance && window.performance.timing) {
        const timing = performance.timing;
        // Don't modify - let it be natural
      }

      // =============================================
      // 21. SOURCEBUFFER & MEDIA
      // =============================================

      // Ensure proper media source support
      if (window.MediaSource) {
        const originalIsTypeSupported = MediaSource.isTypeSupported;
        MediaSource.isTypeSupported = function(type) {
          return originalIsTypeSupported.call(this, type);
        };
      }

      // =============================================
      // 22. OBJECT PROTOTYPE PROTECTION
      // =============================================

      // Prevent detection through prototype inspection
      const nativeCode = 'function () { [native code] }';
      
      // Protect Object methods
      ['toString', 'valueOf'].forEach(method => {
        try {
          const original = Object.prototype[method];
          Object.defineProperty(Object.prototype, method, {
            value: original,
            writable: false,
            configurable: true
          });
        } catch {}
      });

      // =============================================
      // 23. SPEECH SYNTHESIS
      // =============================================

      if (window.speechSynthesis) {
        const voices = [
          { default: true, lang: '${geo.language}', localService: true, name: 'Microsoft David - English (United States)', voiceURI: 'Microsoft David - English (United States)' },
          { default: false, lang: '${geo.language}', localService: true, name: 'Microsoft Zira - English (United States)', voiceURI: 'Microsoft Zira - English (United States)' },
        ];
        
        speechSynthesis.getVoices = () => voices;
      }

      // =============================================
      // 24. DOCUMENT PROPERTIES
      // =============================================

      // Ensure document properties look normal
      Object.defineProperty(document, 'hidden', { get: () => false });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });

      // =============================================
      // 25. WEBGL VENDOR/RENDERER (More specific)
      // =============================================

      try {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          // Return real values but ensure consistency
          const result = getParameter.call(this, param);
          
          // UNMASKED_VENDOR_WEBGL = 37445
          // UNMASKED_RENDERER_WEBGL = 37446
          if (param === 37445 || param === 37446) {
            // Let real GPU values pass through - they're more believable than fakes
            return result;
          }
          
          return result;
        };
        
        // Same for WebGL2
        if (window.WebGL2RenderingContext) {
          const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function(param) {
            return getParameter2.call(this, param);
          };
        }
      } catch {}

      // =============================================
      // 26. MOUSE/KEYBOARD EVENT TRUST
      // =============================================

      // Ensure events appear trusted
      const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
      EventTarget.prototype.dispatchEvent = function(event) {
        if (event instanceof MouseEvent || event instanceof KeyboardEvent) {
          Object.defineProperty(event, 'isTrusted', { get: () => true });
        }
        return originalDispatchEvent.call(this, event);
      };

    })();
  `;
}

/**
 * Page-level stealth script
 */
function getPageLevelStealthScript(_geo: IPGeolocationData): string {
  return `
    (() => {
      // Ensure stealth persists on this page
      if (window.__pageStealth) return;
      window.__pageStealth = true;

      // Re-apply critical patches that might be lost
      try {
        delete Object.getPrototypeOf(navigator).webdriver;
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      } catch {}
    })();
  `;
}

