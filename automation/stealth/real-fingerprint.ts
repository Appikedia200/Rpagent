/**
 * @fileoverview Real Browser Fingerprint Extraction
 * @module automation/stealth/real-fingerprint
 *
 * IMPORTANT: This extracts the REAL fingerprint from the browser,
 * NOT a fake generated one. Real fingerprints are what Cloudflare and
 * other detection systems see. We capture them for reference/logging.
 *
 * The key insight: Playwright's Chromium already HAS a real fingerprint.
 * We don't need to fake it - we just need to NOT expose automation flags.
 */

import { Page } from 'playwright';
import { logger } from '../../electron/utils/logger';

/**
 * Real browser fingerprint data
 */
export interface RealFingerprint {
  // Canvas fingerprint (most important for detection)
  canvasHash: string;
  
  // WebGL fingerprint
  webglVendor: string;
  webglRenderer: string;
  webglHash: string;
  
  // Audio fingerprint
  audioHash: string;
  
  // Navigator properties (real values from browser)
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  hardwareConcurrency: number;
  deviceMemory: number;
  
  // Screen properties
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  pixelRatio: number;
  
  // Timezone
  timezone: string;
  timezoneOffset: number;
  
  // Plugins and features
  pluginCount: number;
  
  // Combined hash for quick comparison
  combinedHash: string;
  
  // Extraction timestamp
  extractedAt: string;
}

/**
 * Extract the REAL fingerprint from a browser page
 * This captures what detection systems actually see
 */
export async function extractRealFingerprint(page: Page): Promise<RealFingerprint> {
  logger.info('Extracting real browser fingerprint...');

  const fingerprint = await page.evaluate(() => {
    // Helper to create hash from string
    function simpleHash(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16).padStart(8, '0');
    }

    // Canvas fingerprint - THE most important fingerprint
    function getCanvasFingerprint(): string {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'no-canvas';

        // Draw text with specific font
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Cwm fjordbank glyphs vext quiz', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Cwm fjordbank glyphs vext quiz', 4, 17);

        // Get data URL and hash it
        const dataUrl = canvas.toDataURL();
        return simpleHash(dataUrl);
      } catch {
        return 'canvas-error';
      }
    }

    // WebGL fingerprint
    function getWebGLFingerprint(): { vendor: string; renderer: string; hash: string } {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return { vendor: 'no-webgl', renderer: 'no-webgl', hash: 'no-webgl' };

        const glAny = gl as WebGLRenderingContext;
        const debugInfo = glAny.getExtension('WEBGL_debug_renderer_info');
        
        let vendor = 'unknown';
        let renderer = 'unknown';
        
        if (debugInfo) {
          vendor = glAny.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
          renderer = glAny.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
        }

        return {
          vendor,
          renderer,
          hash: simpleHash(vendor + renderer),
        };
      } catch {
        return { vendor: 'error', renderer: 'error', hash: 'error' };
      }
    }

    // Audio fingerprint
    function getAudioFingerprint(): string {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return 'no-audio';

        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const analyser = context.createAnalyser();
        const gain = context.createGain();
        const processor = context.createScriptProcessor(4096, 1, 1);

        oscillator.type = 'triangle';
        oscillator.frequency.value = 10000;
        gain.gain.value = 0;

        oscillator.connect(analyser);
        analyser.connect(processor);
        processor.connect(gain);
        gain.connect(context.destination);

        // Get frequency data
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(frequencyData);

        context.close();

        // Hash the frequency data
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
          sum += Math.abs(frequencyData[i]);
        }
        return simpleHash(sum.toString());
      } catch {
        return 'audio-error';
      }
    }

    // Get all fingerprint data
    const canvas = getCanvasFingerprint();
    const webgl = getWebGLFingerprint();
    const audio = getAudioFingerprint();

    const data = {
      canvasHash: canvas,
      webglVendor: webgl.vendor,
      webglRenderer: webgl.renderer,
      webglHash: webgl.hash,
      audioHash: audio,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: Array.from(navigator.languages),
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      deviceMemory: (navigator as any).deviceMemory || 8,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      pluginCount: navigator.plugins?.length || 0,
    };

    // Create combined hash
    const combined = [
      data.canvasHash,
      data.webglHash,
      data.audioHash,
      data.userAgent,
      data.platform,
      data.screenWidth,
      data.screenHeight,
    ].join('|');

    return {
      ...data,
      combinedHash: simpleHash(combined),
    };
  });

  const result: RealFingerprint = {
    ...fingerprint,
    extractedAt: new Date().toISOString(),
  };

  logger.info('Real fingerprint extracted', {
    canvasHash: result.canvasHash,
    webglRenderer: result.webglRenderer.substring(0, 30) + '...',
    combinedHash: result.combinedHash,
  });

  return result;
}

/**
 * Store fingerprint for a workspace
 */
const fingerprintCache = new Map<string, RealFingerprint>();

export function cacheFingerprint(workspaceId: string, fingerprint: RealFingerprint): void {
  fingerprintCache.set(workspaceId, fingerprint);
}

export function getCachedFingerprint(workspaceId: string): RealFingerprint | undefined {
  return fingerprintCache.get(workspaceId);
}

/**
 * Get a short display hash for UI
 */
export function getFingerprintDisplayHash(fingerprint: RealFingerprint): string {
  return fingerprint.combinedHash;
}

/**
 * Compare two fingerprints for similarity
 * Returns true if they appear to be from the same browser profile
 */
export function fingerprintsMatch(a: RealFingerprint, b: RealFingerprint): boolean {
  return (
    a.canvasHash === b.canvasHash &&
    a.webglHash === b.webglHash &&
    a.userAgent === b.userAgent
  );
}

