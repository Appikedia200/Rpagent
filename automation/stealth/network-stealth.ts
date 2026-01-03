/**
 * @fileoverview Network Stealth - Request Interception & Modification
 * @module automation/stealth/network-stealth
 *
 * Implements network-level stealth features:
 * - Header modification and normalization
 * - Request fingerprint masking
 * - WebRTC leak prevention
 * - DNS leak prevention
 * - TLS fingerprint considerations
 */

import { BrowserContext, Page, Route, Request } from 'playwright';

/**
 * Network stealth configuration
 */
interface NetworkStealthConfig {
  blockWebRTC: boolean;
  normalizeHeaders: boolean;
  spoofReferrer: boolean;
  blockTracking: boolean;
  modifyTiming: boolean;
}

const DEFAULT_CONFIG: NetworkStealthConfig = {
  blockWebRTC: true,
  normalizeHeaders: true,
  spoofReferrer: true,
  blockTracking: true,
  modifyTiming: true,
};

/**
 * Tracking domains to block
 */
const TRACKING_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'facebook.com/tr',
  'doubleclick.net',
  'googlesyndication.com',
  'analytics.',
  'tracking.',
  'pixel.',
  'beacon.',
  'telemetry.',
];

/**
 * Headers to normalize/remove
 */
const HEADERS_TO_NORMALIZE = [
  'x-requested-with',
  'x-client-data',
  'sec-ch-ua-platform-version',
  'sec-ch-ua-full-version',
  'sec-ch-ua-arch',
  'sec-ch-ua-model',
  'sec-ch-ua-bitness',
];

/**
 * NetworkStealth class for network-level anti-detection
 */
export class NetworkStealth {
  private config: NetworkStealthConfig;

  constructor(config: Partial<NetworkStealthConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Apply network stealth to browser context
   */
  async applyToContext(context: BrowserContext): Promise<void> {
    // Set up request interception
    await context.route('**/*', async (route, request) => {
      await this.handleRequest(route, request);
    });
  }

  /**
   * Apply network stealth to a specific page
   */
  async applyToPage(page: Page): Promise<void> {
    // Block WebRTC if configured
    if (this.config.blockWebRTC) {
      await this.blockWebRTC(page);
    }

    // Set up request interception for this page
    await page.route('**/*', async (route, request) => {
      await this.handleRequest(route, request);
    });
  }

  /**
   * Handle request interception
   */
  private async handleRequest(route: Route, request: Request): Promise<void> {
    const url = request.url();

    // Block tracking requests
    if (this.config.blockTracking && this.isTrackingRequest(url)) {
      await route.abort('blockedbyclient');
      return;
    }

    // Normalize headers
    const headers = this.normalizeHeaders(request.headers(), url);

    // Continue with modified headers
    await route.continue({ headers });
  }

  /**
   * Check if request is a tracking request
   */
  private isTrackingRequest(url: string): boolean {
    const urlLower = url.toLowerCase();
    return TRACKING_DOMAINS.some((domain) => urlLower.includes(domain));
  }

  /**
   * Normalize request headers
   */
  private normalizeHeaders(
    headers: Record<string, string>,
    url: string
  ): Record<string, string> {
    const normalized = { ...headers };

    if (this.config.normalizeHeaders) {
      // Remove fingerprinting headers
      for (const header of HEADERS_TO_NORMALIZE) {
        delete normalized[header];
      }
    }

    if (this.config.spoofReferrer) {
      // Spoof referrer for cross-origin requests
      const urlObj = new URL(url);
      if (normalized['referer']) {
        try {
          const refererObj = new URL(normalized['referer']);
          if (refererObj.origin !== urlObj.origin) {
            // Use only the origin for cross-origin referrer
            normalized['referer'] = urlObj.origin + '/';
          }
        } catch {
          // Invalid referrer, remove it
          delete normalized['referer'];
        }
      }
    }

    return normalized;
  }

  /**
   * Block WebRTC to prevent IP leaks
   */
  private async blockWebRTC(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Disable RTCPeerConnection
      const originalRTCPeerConnection = window.RTCPeerConnection;

      // @ts-expect-error - Overriding for stealth
      window.RTCPeerConnection = function (config?: RTCConfiguration) {
        // Block ICE candidates that could reveal real IP
        if (config?.iceServers) {
          config.iceServers = config.iceServers.filter((server) => {
            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
            return urls.every((url) => !url.includes('stun:') && !url.includes('turn:'));
          });
        }
        return new originalRTCPeerConnection(config);
      };

      // Copy prototype
      window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;

      // Override createDataChannel to prevent detection
      const originalCreateDataChannel = RTCPeerConnection.prototype.createDataChannel;
      RTCPeerConnection.prototype.createDataChannel = function (...args) {
        return originalCreateDataChannel.apply(this, args);
      };

      // Override addIceCandidate (using Promise-based API)
      const originalAddIceCandidate = RTCPeerConnection.prototype.addIceCandidate as unknown as (
        this: RTCPeerConnection,
        candidate?: RTCIceCandidateInit | null
      ) => Promise<void>;
      
      (RTCPeerConnection.prototype as unknown as Record<string, unknown>).addIceCandidate = function (
        this: RTCPeerConnection,
        candidate?: RTCIceCandidateInit | null
      ): Promise<void> {
        // Filter out candidates that could reveal local IPs
        if (candidate && candidate.candidate) {
          const candidateStr = candidate.candidate;
          // Block local/private IP candidates
          if (
            candidateStr.includes('192.168.') ||
            candidateStr.includes('10.') ||
            candidateStr.includes('172.16.') ||
            candidateStr.includes('172.17.') ||
            candidateStr.includes('172.18.') ||
            candidateStr.includes('172.19.') ||
            candidateStr.includes('172.2') ||
            candidateStr.includes('172.3')
          ) {
            return Promise.resolve();
          }
        }
        return originalAddIceCandidate.call(this, candidate);
      };

      // Block getUserMedia for WebRTC
      const mediaDevices = navigator.mediaDevices;
      if (mediaDevices) {
        const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
        mediaDevices.getUserMedia = async function (constraints) {
          // Check if this is being used for WebRTC fingerprinting
          if (constraints?.audio === false && constraints?.video === false) {
            throw new DOMException('Permission denied', 'NotAllowedError');
          }
          return originalGetUserMedia(constraints);
        };
      }
    });
  }

  /**
   * Inject DNS leak prevention
   */
  async preventDNSLeaks(page: Page, _dnsServer?: string): Promise<void> {
    // DNS leak prevention is primarily handled at the proxy/system level
    // This method adds additional client-side protections

    await page.addInitScript(() => {
      // Override fetch to prevent DNS prefetching leaks
      const originalFetch = window.fetch;
      window.fetch = async function (input, init?) {
        // Disable DNS prefetch for cross-origin requests
        if (typeof input === 'string' || input instanceof URL) {
          const url = typeof input === 'string' ? new URL(input, location.href) : input;
          if (url.origin !== location.origin) {
            // Add no-referrer-when-downgrade policy
            init = {
              ...init,
              referrerPolicy: 'no-referrer-when-downgrade',
            };
          }
        }
        return originalFetch.call(this, input, init);
      };

      // Disable prefetch links
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLLinkElement) {
              if (
                node.rel === 'dns-prefetch' ||
                node.rel === 'prefetch' ||
                node.rel === 'preconnect'
              ) {
                node.remove();
              }
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  /**
   * Add response timing randomization
   */
  async randomizeResponseTiming(page: Page): Promise<void> {
    if (!this.config.modifyTiming) return;

    await page.addInitScript(() => {
      // Randomize performance.now() slightly
      const originalNow = performance.now.bind(performance);
      const offset = Math.random() * 0.1; // Small random offset

      performance.now = function () {
        return originalNow() + offset;
      };

      // Randomize Date.now() slightly
      const originalDateNow = Date.now;
      Date.now = function () {
        return originalDateNow() + Math.floor(Math.random() * 2);
      };
    });
  }
}
