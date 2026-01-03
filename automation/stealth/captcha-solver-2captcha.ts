/**
 * @fileoverview 2Captcha Integration for CAPTCHA Solving
 * @module automation/stealth/captcha-solver-2captcha
 *
 * Integrates with 2Captcha service for solving various CAPTCHA types.
 * Supports reCAPTCHA v2, v3, hCaptcha, and image CAPTCHAs.
 */

import { Page } from 'playwright';
import { logger } from '../../electron/utils/logger';

/**
 * 2Captcha API endpoints
 */
const API_ENDPOINTS = {
  IN: 'https://2captcha.com/in.php',
  RES: 'https://2captcha.com/res.php',
};

/**
 * CAPTCHA types supported
 */
export enum CaptchaType {
  RECAPTCHA_V2 = 'recaptcha_v2',
  RECAPTCHA_V3 = 'recaptcha_v3',
  HCAPTCHA = 'hcaptcha',
  IMAGE = 'image',
  FUNCAPTCHA = 'funcaptcha',
  TURNSTILE = 'turnstile',
}

/**
 * CAPTCHA solve result
 */
export interface CaptchaSolveResult {
  success: boolean;
  token?: string;
  error?: string;
  cost?: number;
  solveTime?: number;
}

/**
 * 2Captcha solver configuration
 */
export interface TwoCaptchaConfig {
  apiKey: string;
  pollingInterval?: number;
  maxAttempts?: number;
  softId?: string;
}

/**
 * 2Captcha CAPTCHA Solver
 */
export class TwoCaptchaSolver {
  private apiKey: string;
  private pollingInterval: number;
  private maxAttempts: number;
  private softId: string;

  constructor(config: TwoCaptchaConfig) {
    this.apiKey = config.apiKey;
    this.pollingInterval = config.pollingInterval || 5000;
    this.maxAttempts = config.maxAttempts || 60;
    this.softId = config.softId || '';
  }

  /**
   * Solve reCAPTCHA v2
   */
  async solveRecaptchaV2(
    page: Page,
    siteKey: string,
    pageUrl: string,
    invisible = false
  ): Promise<CaptchaSolveResult> {
    const startTime = Date.now();

    try {
      logger.info('Solving reCAPTCHA v2', { siteKey, pageUrl, invisible });

      // Submit CAPTCHA to 2Captcha
      const params = new URLSearchParams({
        key: this.apiKey,
        method: 'userrecaptcha',
        googlekey: siteKey,
        pageurl: pageUrl,
        invisible: invisible ? '1' : '0',
        json: '1',
      });

      if (this.softId) {
        params.append('soft_id', this.softId);
      }

      const submitResponse = await fetch(`${API_ENDPOINTS.IN}?${params}`);
      const submitResult = await submitResponse.json();

      if (submitResult.status !== 1) {
        throw new Error(`2Captcha submit error: ${submitResult.request}`);
      }

      const captchaId = submitResult.request;
      logger.debug('CAPTCHA submitted', { captchaId });

      // Poll for result
      const token = await this.pollForResult(captchaId);

      const solveTime = Date.now() - startTime;
      logger.info('reCAPTCHA v2 solved', { solveTime });

      // Inject token into page
      await this.injectRecaptchaToken(page, token);

      return {
        success: true,
        token,
        solveTime,
      };
    } catch (error) {
      logger.error('Failed to solve reCAPTCHA v2', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        solveTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Solve reCAPTCHA v3
   */
  async solveRecaptchaV3(
    _page: Page,
    siteKey: string,
    pageUrl: string,
    action = 'verify',
    minScore = 0.3
  ): Promise<CaptchaSolveResult> {
    const startTime = Date.now();

    try {
      logger.info('Solving reCAPTCHA v3', { siteKey, pageUrl, action });

      const params = new URLSearchParams({
        key: this.apiKey,
        method: 'userrecaptcha',
        googlekey: siteKey,
        pageurl: pageUrl,
        version: 'v3',
        action,
        min_score: String(minScore),
        json: '1',
      });

      const submitResponse = await fetch(`${API_ENDPOINTS.IN}?${params}`);
      const submitResult = await submitResponse.json();

      if (submitResult.status !== 1) {
        throw new Error(`2Captcha submit error: ${submitResult.request}`);
      }

      const captchaId = submitResult.request;
      const token = await this.pollForResult(captchaId);

      const solveTime = Date.now() - startTime;
      logger.info('reCAPTCHA v3 solved', { solveTime });

      return {
        success: true,
        token,
        solveTime,
      };
    } catch (error) {
      logger.error('Failed to solve reCAPTCHA v3', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        solveTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Solve hCaptcha
   */
  async solveHCaptcha(
    page: Page,
    siteKey: string,
    pageUrl: string
  ): Promise<CaptchaSolveResult> {
    const startTime = Date.now();

    try {
      logger.info('Solving hCaptcha', { siteKey, pageUrl });

      const params = new URLSearchParams({
        key: this.apiKey,
        method: 'hcaptcha',
        sitekey: siteKey,
        pageurl: pageUrl,
        json: '1',
      });

      const submitResponse = await fetch(`${API_ENDPOINTS.IN}?${params}`);
      const submitResult = await submitResponse.json();

      if (submitResult.status !== 1) {
        throw new Error(`2Captcha submit error: ${submitResult.request}`);
      }

      const captchaId = submitResult.request;
      const token = await this.pollForResult(captchaId);

      const solveTime = Date.now() - startTime;
      logger.info('hCaptcha solved', { solveTime });

      // Inject token
      await this.injectHCaptchaToken(page, token);

      return {
        success: true,
        token,
        solveTime,
      };
    } catch (error) {
      logger.error('Failed to solve hCaptcha', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        solveTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Solve Cloudflare Turnstile
   */
  async solveTurnstile(
    _page: Page,
    siteKey: string,
    pageUrl: string
  ): Promise<CaptchaSolveResult> {
    const startTime = Date.now();

    try {
      logger.info('Solving Turnstile', { siteKey, pageUrl });

      const params = new URLSearchParams({
        key: this.apiKey,
        method: 'turnstile',
        sitekey: siteKey,
        pageurl: pageUrl,
        json: '1',
      });

      const submitResponse = await fetch(`${API_ENDPOINTS.IN}?${params}`);
      const submitResult = await submitResponse.json();

      if (submitResult.status !== 1) {
        throw new Error(`2Captcha submit error: ${submitResult.request}`);
      }

      const captchaId = submitResult.request;
      const token = await this.pollForResult(captchaId);

      const solveTime = Date.now() - startTime;
      logger.info('Turnstile solved', { solveTime });

      return {
        success: true,
        token,
        solveTime,
      };
    } catch (error) {
      logger.error('Failed to solve Turnstile', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        solveTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Solve image CAPTCHA
   */
  async solveImageCaptcha(
    imageBase64: string,
    options?: {
      caseSensitive?: boolean;
      numeric?: boolean;
      minLength?: number;
      maxLength?: number;
      phrase?: boolean;
      calc?: boolean;
    }
  ): Promise<CaptchaSolveResult> {
    const startTime = Date.now();

    try {
      logger.info('Solving image CAPTCHA');

      const params = new URLSearchParams({
        key: this.apiKey,
        method: 'base64',
        body: imageBase64,
        json: '1',
      });

      if (options?.caseSensitive) params.append('regsense', '1');
      if (options?.numeric) params.append('numeric', '1');
      if (options?.minLength) params.append('min_len', String(options.minLength));
      if (options?.maxLength) params.append('max_len', String(options.maxLength));
      if (options?.phrase) params.append('phrase', '1');
      if (options?.calc) params.append('calc', '1');

      const submitResponse = await fetch(API_ENDPOINTS.IN, {
        method: 'POST',
        body: params,
      });
      const submitResult = await submitResponse.json();

      if (submitResult.status !== 1) {
        throw new Error(`2Captcha submit error: ${submitResult.request}`);
      }

      const captchaId = submitResult.request;
      const token = await this.pollForResult(captchaId);

      const solveTime = Date.now() - startTime;
      logger.info('Image CAPTCHA solved', { solveTime });

      return {
        success: true,
        token,
        solveTime,
      };
    } catch (error) {
      logger.error('Failed to solve image CAPTCHA', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        solveTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Auto-detect and solve CAPTCHA on page
   */
  async autoSolve(page: Page): Promise<CaptchaSolveResult> {
    const pageUrl = page.url();

    try {
      // Check for reCAPTCHA
      const recaptchaKey = await this.detectRecaptcha(page);
      if (recaptchaKey) {
        logger.info('Detected reCAPTCHA', { siteKey: recaptchaKey });
        return await this.solveRecaptchaV2(page, recaptchaKey, pageUrl);
      }

      // Check for hCaptcha
      const hcaptchaKey = await this.detectHCaptcha(page);
      if (hcaptchaKey) {
        logger.info('Detected hCaptcha', { siteKey: hcaptchaKey });
        return await this.solveHCaptcha(page, hcaptchaKey, pageUrl);
      }

      // Check for Turnstile
      const turnstileKey = await this.detectTurnstile(page);
      if (turnstileKey) {
        logger.info('Detected Turnstile', { siteKey: turnstileKey });
        return await this.solveTurnstile(page, turnstileKey, pageUrl);
      }

      logger.debug('No CAPTCHA detected on page');
      return { success: true };
    } catch (error) {
      logger.error('Auto-solve failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Detect reCAPTCHA on page
   */
  private async detectRecaptcha(page: Page): Promise<string | null> {
    try {
      const siteKey = await page.evaluate(() => {
        // Check for reCAPTCHA v2
        const recaptchaDiv = document.querySelector('.g-recaptcha');
        if (recaptchaDiv) {
          return recaptchaDiv.getAttribute('data-sitekey');
        }

        // Check for invisible reCAPTCHA
        const invisibleRecaptcha = document.querySelector('[data-sitekey]');
        if (invisibleRecaptcha) {
          return invisibleRecaptcha.getAttribute('data-sitekey');
        }

        // Check for reCAPTCHA in iframe
        const iframe = document.querySelector('iframe[src*="recaptcha"]') as HTMLIFrameElement;
        if (iframe?.src) {
          const match = iframe.src.match(/[?&]k=([^&]+)/);
          if (match) return match[1];
        }

        // Check grecaptcha object
        const w = window as unknown as { grecaptcha?: { enterprise?: unknown } };
        if (w.grecaptcha) {
          // Try to find site key in page scripts
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            const match = script.textContent?.match(/sitekey['":\s]+['"]([^'"]+)['"]/i);
            if (match) return match[1];
          }
        }

        return null;
      });

      return siteKey;
    } catch {
      return null;
    }
  }

  /**
   * Detect hCaptcha on page
   */
  private async detectHCaptcha(page: Page): Promise<string | null> {
    try {
      const siteKey = await page.evaluate(() => {
        const hcaptchaDiv = document.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
        if (hcaptchaDiv) {
          return hcaptchaDiv.getAttribute('data-sitekey') || 
                 hcaptchaDiv.getAttribute('data-hcaptcha-sitekey');
        }

        const iframe = document.querySelector('iframe[src*="hcaptcha"]') as HTMLIFrameElement;
        if (iframe?.src) {
          const match = iframe.src.match(/sitekey=([^&]+)/);
          if (match) return match[1];
        }

        return null;
      });

      return siteKey;
    } catch {
      return null;
    }
  }

  /**
   * Detect Cloudflare Turnstile on page
   */
  private async detectTurnstile(page: Page): Promise<string | null> {
    try {
      const siteKey = await page.evaluate(() => {
        const turnstileDiv = document.querySelector('.cf-turnstile, [data-turnstile-sitekey]');
        if (turnstileDiv) {
          return turnstileDiv.getAttribute('data-sitekey') || 
                 turnstileDiv.getAttribute('data-turnstile-sitekey');
        }

        return null;
      });

      return siteKey;
    } catch {
      return null;
    }
  }

  /**
   * Poll for CAPTCHA result
   */
  private async pollForResult(captchaId: string): Promise<string> {
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      await this.delay(this.pollingInterval);

      const params = new URLSearchParams({
        key: this.apiKey,
        action: 'get',
        id: captchaId,
        json: '1',
      });

      const response = await fetch(`${API_ENDPOINTS.RES}?${params}`);
      const result = await response.json();

      if (result.status === 1) {
        return result.request;
      }

      if (result.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`2Captcha error: ${result.request}`);
      }

      attempts++;
      logger.debug('Waiting for CAPTCHA solution', { attempts, captchaId });
    }

    throw new Error('CAPTCHA solve timeout');
  }

  /**
   * Inject reCAPTCHA token into page
   */
  private async injectRecaptchaToken(page: Page, token: string): Promise<void> {
    await page.evaluate((t) => {
      // Set g-recaptcha-response textarea
      const textarea = document.querySelector('#g-recaptcha-response, [name="g-recaptcha-response"]') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = t;
        textarea.style.display = 'block';
      }

      // Also try to call the callback if exists
      const w = window as unknown as { 
        ___grecaptcha_cfg?: { clients?: Array<{ 
          hl?: { l?: { l?: { callback?: (token: string) => void } } } 
        }> };
        grecaptcha?: { execute?: () => void };
      };
      
      if (w.___grecaptcha_cfg?.clients) {
        for (const client of w.___grecaptcha_cfg.clients) {
          if (client?.hl?.l?.l?.callback) {
            client.hl.l.l.callback(t);
          }
        }
      }
    }, token);
  }

  /**
   * Inject hCaptcha token into page
   */
  private async injectHCaptchaToken(page: Page, token: string): Promise<void> {
    await page.evaluate((t) => {
      // Set h-captcha-response textarea
      const textarea = document.querySelector('[name="h-captcha-response"], #h-captcha-response') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = t;
      }

      // Also set g-recaptcha-response for compatibility
      const gTextarea = document.querySelector('[name="g-recaptcha-response"]') as HTMLTextAreaElement;
      if (gTextarea) {
        gTextarea.value = t;
      }
    }, token);
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<number> {
    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        action: 'getbalance',
        json: '1',
      });

      const response = await fetch(`${API_ENDPOINTS.RES}?${params}`);
      const result = await response.json();

      if (result.status === 1) {
        return parseFloat(result.request);
      }

      throw new Error(`Failed to get balance: ${result.request}`);
    } catch (error) {
      logger.error('Failed to get 2Captcha balance', { error });
      return 0;
    }
  }

  /**
   * Report incorrect CAPTCHA solution
   */
  async reportIncorrect(captchaId: string): Promise<void> {
    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        action: 'reportbad',
        id: captchaId,
        json: '1',
      });

      await fetch(`${API_ENDPOINTS.RES}?${params}`);
      logger.info('Reported incorrect CAPTCHA', { captchaId });
    } catch (error) {
      logger.error('Failed to report incorrect CAPTCHA', { error });
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global solver instance (initialized with API key from settings)
let globalSolver: TwoCaptchaSolver | null = null;

/**
 * Initialize the global 2Captcha solver
 */
export function initializeTwoCaptcha(apiKey: string): TwoCaptchaSolver {
  globalSolver = new TwoCaptchaSolver({ apiKey });
  return globalSolver;
}

/**
 * Get the global 2Captcha solver
 */
export function getTwoCaptchaSolver(): TwoCaptchaSolver | null {
  return globalSolver;
}

