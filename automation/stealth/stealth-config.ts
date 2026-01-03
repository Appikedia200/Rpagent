/**
 * @fileoverview Advanced Anti-Detection Configuration
 * @module automation/stealth/stealth-config
 *
 * Makes Playwright browsers indistinguishable from real Chrome.
 * Based on research: "Fingerprinting the Fingerprinters" (Acar et al., 2018)
 */

import { BrowserContext, Page } from 'playwright';
import { logger } from '../../electron/utils/logger';

/**
 * Stealth configuration error
 */
export class StealthConfigError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'StealthConfigError';
  }
}

/**
 * Apply stealth configurations to browser context
 */
export async function applyStealthToContext(context: BrowserContext): Promise<void> {
  try {
    logger.debug('Applying stealth configuration to context');

    await context.addInitScript(() => {
      // 1. Remove webdriver flag (CRITICAL)
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // 2. Override Chrome detection
      const chrome = {
        runtime: {
          OnInstalledReason: {
            CHROME_UPDATE: 'chrome_update',
            INSTALL: 'install',
            SHARED_MODULE_UPDATE: 'shared_module_update',
            UPDATE: 'update',
          },
          OnRestartRequiredReason: {
            APP_UPDATE: 'app_update',
            OS_UPDATE: 'os_update',
            PERIODIC: 'periodic',
          },
          PlatformArch: {
            ARM: 'arm',
            ARM64: 'arm64',
            MIPS: 'mips',
            MIPS64: 'mips64',
            X86_32: 'x86-32',
            X86_64: 'x86-64',
          },
          PlatformNaclArch: {
            ARM: 'arm',
            MIPS: 'mips',
            MIPS64: 'mips64',
            X86_32: 'x86-32',
            X86_64: 'x86-64',
          },
          PlatformOs: {
            ANDROID: 'android',
            CROS: 'cros',
            LINUX: 'linux',
            MAC: 'mac',
            OPENBSD: 'openbsd',
            WIN: 'win',
          },
          RequestUpdateCheckStatus: {
            NO_UPDATE: 'no_update',
            THROTTLED: 'throttled',
            UPDATE_AVAILABLE: 'update_available',
          },
        },
        loadTimes: function() { return {}; },
        csi: function() { return {}; },
        app: {
          isInstalled: false,
          InstallState: {
            DISABLED: 'disabled',
            INSTALLED: 'installed',
            NOT_INSTALLED: 'not_installed',
          },
          RunningState: {
            CANNOT_RUN: 'cannot_run',
            READY_TO_RUN: 'ready_to_run',
            RUNNING: 'running',
          },
        },
      };
      (window as unknown as Record<string, unknown>).chrome = chrome;
      (navigator as unknown as Record<string, unknown>).chrome = chrome;

      // 3. Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: PermissionDescriptor) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ 
            state: Notification.permission,
            name: 'notifications',
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true,
          } as PermissionStatus) :
          originalQuery.call(navigator.permissions, parameters)
      );

      // 4. Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            {
              name: 'Chrome PDF Plugin',
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              0: {
                type: 'application/x-google-chrome-pdf',
                suffixes: 'pdf',
                description: 'Portable Document Format',
              },
            },
            {
              name: 'Chrome PDF Viewer',
              description: '',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              0: {
                type: 'application/pdf',
                suffixes: 'pdf',
                description: '',
              },
            },
            {
              name: 'Native Client',
              description: '',
              filename: 'internal-nacl-plugin',
              length: 2,
              0: {
                type: 'application/x-nacl',
                suffixes: '',
                description: 'Native Client Executable',
              },
              1: {
                type: 'application/x-pnacl',
                suffixes: '',
                description: 'Portable Native Client Executable',
              },
            },
          ];
          return plugins;
        },
      });

      // 5. Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // 6. Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
      });

      // 7. Override vendor
      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.',
      });

      // 8. Override hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 4 + Math.floor(Math.random() * 4),
      });

      // 9. Override device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });

      // 10. Remove automation flags
      delete (navigator as unknown as Record<string, unknown>).__playwright;
      delete (navigator as unknown as Record<string, unknown>).__pw_manual;
      delete (window as unknown as Record<string, unknown>).__playwright;
      delete (window as unknown as Record<string, unknown>).__pw_manual;

      // 11. Canvas fingerprint randomization
      const getRandomFloat = () => Math.random() * 0.0000001;
      
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type?: string) {
        const context = this.getContext('2d');
        if (context) {
          try {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] = Math.min(255, imageData.data[i] + getRandomFloat());
            }
            context.putImageData(imageData, 0, 0);
          } catch {
            // Ignore cross-origin errors
          }
        }
        return originalToDataURL.call(this, type);
      };

      // 12. WebGL fingerprint masking
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return 'Intel Inc.';
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.call(this, parameter);
      };

      // 13. Battery API spoofing
      if ('getBattery' in navigator) {
        (navigator as Navigator & { getBattery: () => Promise<unknown> }).getBattery = () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 0.8 + Math.random() * 0.2,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        });
      }

      // 14. Connection API spoofing
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          downlink: 10,
          rtt: 50,
          saveData: false,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        }),
      });

      // 15. Screen resolution normalization
      const screenWidth = 1920 + Math.floor(Math.random() * 100);
      const screenHeight = 1080 + Math.floor(Math.random() * 100);
      
      Object.defineProperty(screen, 'width', { get: () => screenWidth });
      Object.defineProperty(screen, 'height', { get: () => screenHeight });
      Object.defineProperty(screen, 'availWidth', { get: () => screenWidth });
      Object.defineProperty(screen, 'availHeight', { get: () => screenHeight - 40 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
    });

    logger.debug('Stealth configuration applied successfully');
  } catch (error) {
    logger.error('Failed to apply stealth configuration', { error });
    throw new StealthConfigError(
      'Failed to apply stealth configuration',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Apply stealth to individual page
 */
export async function applyStealthToPage(page: Page): Promise<void> {
  try {
    // Timezone is set at context level, not page level
    // This is handled in browser-instance.ts via context options

    // Set realistic geolocation
    await page.context().setGeolocation({
      latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
      longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
    });

    // Grant permissions
    await page.context().grantPermissions(['geolocation', 'notifications']);

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
    });

    logger.debug('Page-level stealth applied');
  } catch (error) {
    logger.error('Failed to apply page stealth', { error });
    throw new StealthConfigError(
      'Failed to apply page stealth',
      error instanceof Error ? error : undefined
    );
  }
}

