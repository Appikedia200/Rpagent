/**
 * @fileoverview Undetectable Stealth Configuration
 * @module automation/stealth/undetectable-stealth
 *
 * Comprehensive anti-detection patches that pass browserscan.net,
 * Cloudflare, and other detection systems.
 *
 * These patches:
 * 1. Remove ALL automation flags
 * 2. Fix WebDriver detection
 * 3. Fix Chrome DevTools Protocol detection
 * 4. Fix headless detection
 * 5. Fix Playwright/Puppeteer signatures
 * 6. Properly handle permissions
 */

import { BrowserContext, Page } from 'playwright';
import { RegionConfig, getRandomUserAgent, getVariedGeolocation } from './region-config';
import { logger } from '../../electron/utils/logger';

/**
 * Apply comprehensive stealth to browser context
 */
export async function applyUndetectableStealth(
  context: BrowserContext,
  region: RegionConfig
): Promise<void> {
  logger.info('Applying undetectable stealth patches', { region: region.id });

  // Set extra HTTP headers to match real browser
  await context.setExtraHTTPHeaders({
    'Accept-Language': region.acceptLanguage,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-CH-UA': '"Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
    'Upgrade-Insecure-Requests': '1',
  });

  // Add init script to every page
  await context.addInitScript(getStealthScript(region));
}

/**
 * Apply stealth to individual page
 */
export async function applyUndetectableStealthToPage(
  page: Page,
  _region: RegionConfig
): Promise<void> {
  // Additional page-level patches (region used for future extensions)
  await page.addInitScript(getPageStealthScript());
}

/**
 * Get the main stealth script
 */
function getStealthScript(region: RegionConfig): string {
  const userAgent = getRandomUserAgent(region);
  const geolocation = getVariedGeolocation(region);

  return `
    // =============================================
    // UNDETECTABLE STEALTH PATCHES
    // Passes browserscan.net, Cloudflare, etc.
    // =============================================

    (() => {
      'use strict';

      // =============================================
      // 1. REMOVE WEBDRIVER FLAG
      // =============================================
      
      // Delete webdriver property
      delete Object.getPrototypeOf(navigator).webdriver;
      
      // Override getter to return undefined
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
      });

      // =============================================
      // 2. FIX NAVIGATOR PROPERTIES
      // =============================================

      // Override userAgent to match real Chrome
      Object.defineProperty(navigator, 'userAgent', {
        get: () => '${userAgent}',
        configurable: true,
      });

      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
        configurable: true,
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => Object.freeze(${JSON.stringify(region.languages)}),
        configurable: true,
      });

      Object.defineProperty(navigator, 'language', {
        get: () => '${region.language}',
        configurable: true,
      });

      // Hardware concurrency (realistic value)
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => ${Math.floor(Math.random() * 4) + 4}, // 4-8 cores
        configurable: true,
      });

      // Device memory (realistic value)
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => ${[4, 8, 16][Math.floor(Math.random() * 3)]},
        configurable: true,
      });

      // Max touch points (0 for desktop)
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
        configurable: true,
      });

      // Vendor
      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.',
        configurable: true,
      });

      // =============================================
      // 3. FIX PLUGINS (must not be empty)
      // =============================================

      const mockPlugins = {
        length: 5,
        item: (index) => mockPlugins[index] || null,
        namedItem: (name) => {
          for (let i = 0; i < mockPlugins.length; i++) {
            if (mockPlugins[i]?.name === name) return mockPlugins[i];
          }
          return null;
        },
        refresh: () => {},
        0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        2: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        3: { name: 'Chromium PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        4: { name: 'Chromium PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      };

      Object.defineProperty(navigator, 'plugins', {
        get: () => mockPlugins,
        configurable: true,
      });

      // =============================================
      // 4. FIX CHROME OBJECT
      // =============================================

      // Chrome object must exist and have proper structure
      if (!window.chrome) {
        window.chrome = {};
      }

      window.chrome.runtime = {
        id: undefined,
        connect: () => {},
        sendMessage: () => {},
        onMessage: { addListener: () => {}, removeListener: () => {} },
        onConnect: { addListener: () => {}, removeListener: () => {} },
      };

      window.chrome.loadTimes = () => ({
        requestTime: Date.now() / 1000 - Math.random() * 100,
        startLoadTime: Date.now() / 1000 - Math.random() * 50,
        commitLoadTime: Date.now() / 1000 - Math.random() * 10,
        finishDocumentLoadTime: Date.now() / 1000 - Math.random() * 5,
        finishLoadTime: Date.now() / 1000,
        firstPaintTime: Date.now() / 1000 - Math.random() * 3,
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other',
        wasFetchedViaSpdy: false,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2',
      });

      window.chrome.csi = () => ({
        onloadT: Date.now(),
        startE: Date.now() - Math.random() * 1000,
        pageT: Math.random() * 1000,
        tran: 15,
      });

      // =============================================
      // 5. FIX PERMISSIONS API
      // =============================================

      const originalQuery = Permissions.prototype.query;
      Permissions.prototype.query = function(parameters) {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return originalQuery.call(this, parameters);
      };

      // =============================================
      // 6. FIX IFRAME CONTENTWINDOW
      // =============================================

      // Make sure iframes have proper contentWindow
      const originalCreateElement = document.createElement.bind(document);
      document.createElement = function(tagName, options) {
        const element = originalCreateElement(tagName, options);
        if (tagName.toLowerCase() === 'iframe') {
          Object.defineProperty(element, 'contentWindow', {
            get: function() {
              return null;
            },
            configurable: true,
          });
        }
        return element;
      };

      // =============================================
      // 7. FIX WEBGL VENDOR/RENDERER
      // =============================================

      const getParameterProxy = new Proxy(WebGLRenderingContext.prototype.getParameter, {
        apply: function(target, thisArg, args) {
          const param = args[0];
          const debugInfo = thisArg.getExtension('WEBGL_debug_renderer_info');
          
          if (debugInfo) {
            if (param === debugInfo.UNMASKED_VENDOR_WEBGL) {
              return 'Google Inc. (NVIDIA)';
            }
            if (param === debugInfo.UNMASKED_RENDERER_WEBGL) {
              return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)';
            }
          }
          
          return Reflect.apply(target, thisArg, args);
        },
      });

      WebGLRenderingContext.prototype.getParameter = getParameterProxy;

      // Also for WebGL2
      if (typeof WebGL2RenderingContext !== 'undefined') {
        WebGL2RenderingContext.prototype.getParameter = getParameterProxy;
      }

      // =============================================
      // 8. FIX STACK TRACES
      // =============================================

      // Remove playwright/puppeteer from stack traces
      const originalError = Error;
      Error = function(...args) {
        const error = new originalError(...args);
        if (error.stack) {
          error.stack = error.stack
            .split('\\n')
            .filter(line => 
              !line.includes('playwright') && 
              !line.includes('puppeteer') &&
              !line.includes('__playwright') &&
              !line.includes('__puppeteer')
            )
            .join('\\n');
        }
        return error;
      };
      Error.prototype = originalError.prototype;

      // =============================================
      // 9. FIX TIMEZONE (match region)
      // =============================================

      const targetTimezone = '${region.timezone}';
      
      // Override Date.prototype.getTimezoneOffset
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function() {
        return ${region.timezoneOffset * -1}; // Invert for JavaScript convention
      };

      // Override Intl.DateTimeFormat to use correct timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      Intl.DateTimeFormat = function(locales, options) {
        options = options || {};
        if (!options.timeZone) {
          options.timeZone = targetTimezone;
        }
        return new originalDateTimeFormat(locales, options);
      };
      Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;
      Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;

      // =============================================
      // 10. FIX AUTOMATION FLAGS
      // =============================================

      // Remove all automation-related properties
      const propsToDelete = [
        '__webdriver_evaluate',
        '__selenium_evaluate', 
        '__webdriver_script_function',
        '__webdriver_script_func',
        '__webdriver_script_fn',
        '__fxdriver_evaluate',
        '__driver_unwrapped',
        '__webdriver_unwrapped',
        '__driver_evaluate',
        '__selenium_unwrapped',
        '__fxdriver_unwrapped',
        '_Selenium_IDE_Recorder',
        '_selenium',
        'calledSelenium',
        '$cdc_asdjflasutopfhvcZLmcfl_',
        '$chrome_asyncScriptInfo',
        '__$webdriverAsyncExecutor',
        'webdriver',
        '__nightmare',
        '__phantomas',
        '_phantom',
        'phantom',
        'callPhantom',
        '__testing',
      ];

      for (const prop of propsToDelete) {
        try {
          delete window[prop];
        } catch (e) {}
        try {
          window[prop] = undefined;
        } catch (e) {}
      }

      // Remove from document as well
      for (const prop of propsToDelete) {
        try {
          delete document[prop];
        } catch (e) {}
      }

      // =============================================
      // 11. FIX MEDIA DEVICES
      // =============================================

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        navigator.mediaDevices.enumerateDevices = async function() {
          const devices = await originalEnumerateDevices();
          // Return realistic devices
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

      // =============================================
      // 12. GEOLOCATION OVERRIDE
      // =============================================

      if (navigator.geolocation) {
        const mockPosition = {
          coords: {
            latitude: ${geolocation.latitude},
            longitude: ${geolocation.longitude},
            accuracy: ${geolocation.accuracy},
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        };

        navigator.geolocation.getCurrentPosition = function(success, error, options) {
          setTimeout(() => success(mockPosition), Math.random() * 100 + 50);
        };

        navigator.geolocation.watchPosition = function(success, error, options) {
          setTimeout(() => success(mockPosition), Math.random() * 100 + 50);
          return Math.floor(Math.random() * 1000);
        };
      }

      // =============================================
      // 13. BATTERY API (randomize values)
      // =============================================

      if (navigator.getBattery) {
        navigator.getBattery = async () => ({
          charging: Math.random() > 0.3,
          chargingTime: Infinity,
          dischargingTime: Infinity,
          level: 0.5 + Math.random() * 0.5,
          onchargingchange: null,
          onchargingtimechange: null,
          ondischargingtimechange: null,
          onlevelchange: null,
        });
      }

      // =============================================
      // 14. CONNECTION API
      // =============================================

      if (navigator.connection) {
        Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g' });
        Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 + Math.floor(Math.random() * 100) });
        Object.defineProperty(navigator.connection, 'downlink', { get: () => 5 + Math.random() * 5 });
        Object.defineProperty(navigator.connection, 'saveData', { get: () => false });
      }

      console.log('[Stealth] Anti-detection patches applied for region: ${region.name}');
    })();
  `;
}

/**
 * Additional page-level stealth script
 */
function getPageStealthScript(): string {
  return `
    (() => {
      // Ensure these patches persist after navigation
      if (window.__stealthApplied) return;
      window.__stealthApplied = true;

      // Fix for some detection that checks function toString
      const originalToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        if (this === Function.prototype.toString) {
          return 'function toString() { [native code] }';
        }
        if (this === navigator.webdriver?.valueOf) {
          return 'function valueOf() { [native code] }';
        }
        return originalToString.call(this);
      };
    })();
  `;
}

