/**
 * @fileoverview Meta-Detection System
 * @module automation/stealth/meta-detection
 *
 * Detects when we're being detected and adapts behavior.
 * Monitors for detection signals and responds adaptively.
 */

import { Page } from 'playwright';
import { logger } from '../../electron/utils/logger';
import { FingerprintManager } from './fingerprint-manager';

/**
 * Detection signals from page analysis
 */
interface DetectionSignals {
  hasCaptcha: boolean;
  hasChallenge: boolean;
  isCloudflare: boolean;
  isBlocked: boolean;
  hasRateLimit: boolean;
  httpStatus: number;
  responseTime: number;
}

/**
 * Meta-detection system for adaptive behavior
 */
export class MetaDetection {
  private suspicionLevel: number = 0;
  private detectionHistory: DetectionSignals[] = [];
  private readonly maxHistorySize: number = 10;

  constructor(private fingerprintManager: FingerprintManager) {}

  /**
   * Check for detection signals on page
   */
  async checkDetectionSignals(page: Page, workspaceId: string): Promise<DetectionSignals> {
    const startTime = Date.now();

    try {
      const signals = await page.evaluate(() => {
        const bodyText = document.body?.textContent?.toLowerCase() || '';
        const title = document.title.toLowerCase();

        return {
          // CAPTCHA detection
          hasCaptcha: 
            document.querySelector('[class*="captcha"]') !== null ||
            document.querySelector('[id*="captcha"]') !== null ||
            document.querySelector('iframe[src*="recaptcha"]') !== null ||
            document.querySelector('iframe[src*="hcaptcha"]') !== null ||
            bodyText.includes('captcha') ||
            bodyText.includes('verify you are human'),

          // JavaScript challenge detection
          hasChallenge: 
            document.querySelector('[class*="challenge"]') !== null ||
            bodyText.includes('checking your browser') ||
            bodyText.includes('please wait'),

          // Cloudflare detection
          isCloudflare: 
            title.includes('just a moment') ||
            title.includes('attention required') ||
            bodyText.includes('checking your browser before accessing') ||
            document.querySelector('[class*="cf-"]') !== null,

          // Block page detection
          isBlocked: 
            title.includes('access denied') ||
            title.includes('forbidden') ||
            title.includes('blocked') ||
            bodyText.includes('access denied') ||
            bodyText.includes('you have been blocked') ||
            bodyText.includes('your ip has been blocked'),

          // Rate limit detection
          hasRateLimit: 
            bodyText.includes('rate limit') ||
            bodyText.includes('too many requests') ||
            bodyText.includes('please try again later') ||
            bodyText.includes('slow down'),

          httpStatus: 200, // Will be updated below
        };
      });

      const responseTime = Date.now() - startTime;

      const detectionSignals: DetectionSignals = {
        ...signals,
        responseTime,
      };

      // Update suspicion level
      this.updateSuspicionLevel(detectionSignals);

      // Store in history
      this.detectionHistory.push(detectionSignals);
      if (this.detectionHistory.length > this.maxHistorySize) {
        this.detectionHistory.shift();
      }

      // Adapt if needed
      if (this.suspicionLevel > 50) {
        await this.adaptBehavior(workspaceId);
      }

      logger.debug('Detection signals checked', {
        workspaceId,
        suspicionLevel: this.suspicionLevel,
        hasCaptcha: detectionSignals.hasCaptcha,
        isBlocked: detectionSignals.isBlocked,
      });

      return detectionSignals;
    } catch (error) {
      logger.error('Failed to check detection signals', { error, workspaceId });
      return {
        hasCaptcha: false,
        hasChallenge: false,
        isCloudflare: false,
        isBlocked: false,
        hasRateLimit: false,
        httpStatus: 0,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Update suspicion level based on signals
   */
  private updateSuspicionLevel(signals: DetectionSignals): void {
    // Increase suspicion based on signals
    if (signals.hasCaptcha) this.suspicionLevel += 25;
    if (signals.hasChallenge) this.suspicionLevel += 20;
    if (signals.isCloudflare) this.suspicionLevel += 15;
    if (signals.isBlocked) this.suspicionLevel += 40;
    if (signals.hasRateLimit) this.suspicionLevel += 30;

    // Increase for slow responses (might be targeted)
    if (signals.responseTime > 10000) this.suspicionLevel += 10;

    // Decay suspicion over time (natural decay)
    this.suspicionLevel = Math.max(0, this.suspicionLevel - 2);

    // Cap at 100
    this.suspicionLevel = Math.min(100, this.suspicionLevel);
  }

  /**
   * Adapt behavior based on suspicion level
   */
  private async adaptBehavior(workspaceId: string): Promise<void> {
    if (this.suspicionLevel > 80) {
      // Critical: Burn fingerprint and start fresh
      logger.warn('Critical detection risk - burning fingerprint', {
        workspaceId,
        suspicionLevel: this.suspicionLevel,
      });
      this.fingerprintManager.burnFingerprint(workspaceId);
      this.suspicionLevel = 0;
    } else if (this.suspicionLevel > 60) {
      // High: Log warning
      logger.warn('High detection risk - increasing caution', {
        workspaceId,
        suspicionLevel: this.suspicionLevel,
      });
    } else if (this.suspicionLevel > 40) {
      // Moderate: Note the issue
      logger.info('Moderate detection risk', {
        workspaceId,
        suspicionLevel: this.suspicionLevel,
      });
    }
  }

  /**
   * Get current suspicion level
   */
  getSuspicionLevel(): number {
    return this.suspicionLevel;
  }

  /**
   * Get detection history
   */
  getDetectionHistory(): DetectionSignals[] {
    return [...this.detectionHistory];
  }

  /**
   * Check if currently at high risk
   */
  isHighRisk(): boolean {
    return this.suspicionLevel > 60;
  }

  /**
   * Reset suspicion level
   */
  reset(): void {
    this.suspicionLevel = 0;
    this.detectionHistory = [];
  }
}
