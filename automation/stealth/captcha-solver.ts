/**
 * @fileoverview CAPTCHA Solver - Automated CAPTCHA Resolution
 * @module automation/stealth/captcha-solver
 *
 * Integrates with CAPTCHA solving services:
 * - 2Captcha
 * - Anti-Captcha
 * - CapSolver
 *
 * Supports:
 * - reCAPTCHA v2/v3
 * - hCaptcha
 * - FunCaptcha
 * - Image CAPTCHA
 * - Text CAPTCHA
 */

import { Page } from 'playwright';

/**
 * CAPTCHA solver configuration
 */
interface CaptchaSolverConfig {
  service: 'none' | '2captcha' | 'anticaptcha' | 'capsolver';
  apiKey: string;
  timeout: number;
  pollingInterval: number;
}

/**
 * CAPTCHA detection result
 */
interface CaptchaDetection {
  type: 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha' | 'funcaptcha' | 'image' | 'text' | 'none';
  siteKey?: string;
  action?: string;
  data?: string;
  pageUrl: string;
}

/**
 * CAPTCHA solution result
 */
interface CaptchaSolution {
  success: boolean;
  token?: string;
  error?: string;
  cost?: number;
  solveTime?: number;
}

const DEFAULT_CONFIG: CaptchaSolverConfig = {
  service: 'none',
  apiKey: '',
  timeout: 120000,
  pollingInterval: 5000,
};

/**
 * CaptchaSolver class for automated CAPTCHA resolution
 */
export class CaptchaSolver {
  private config: CaptchaSolverConfig;

  constructor(config: Partial<CaptchaSolverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if CAPTCHA solving is enabled
   */
  isEnabled(): boolean {
    return this.config.service !== 'none' && !!this.config.apiKey;
  }

  /**
   * Detect CAPTCHA on page
   */
  async detectCaptcha(page: Page): Promise<CaptchaDetection> {
    const pageUrl = page.url();

    // Check for reCAPTCHA v2
    const recaptchaV2 = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="recaptcha"]') as HTMLIFrameElement | null;
      const div = document.querySelector('.g-recaptcha');
      if (iframe || div) {
        const siteKey = div?.getAttribute('data-sitekey') || 
          (iframe?.src ? iframe.src.match(/k=([^&]+)/)?.[1] : undefined);
        return { found: true, siteKey };
      }
      return { found: false };
    });

    if (recaptchaV2.found) {
      return {
        type: 'recaptcha-v2',
        siteKey: recaptchaV2.siteKey,
        pageUrl,
      };
    }

    // Check for reCAPTCHA v3
    const recaptchaV3 = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const match = script.src?.match(/recaptcha.*render=([^&]+)/);
        if (match && match[1] !== 'explicit') {
          return { found: true, siteKey: match[1] };
        }
      }
      return { found: false };
    });

    if (recaptchaV3.found) {
      return {
        type: 'recaptcha-v3',
        siteKey: recaptchaV3.siteKey,
        pageUrl,
      };
    }

    // Check for hCaptcha
    const hcaptcha = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="hcaptcha"]') as HTMLIFrameElement | null;
      const div = document.querySelector('.h-captcha');
      if (iframe || div) {
        const siteKey = div?.getAttribute('data-sitekey') ||
          (iframe?.src ? iframe.src.match(/sitekey=([^&]+)/)?.[1] : undefined);
        return { found: true, siteKey };
      }
      return { found: false };
    });

    if (hcaptcha.found) {
      return {
        type: 'hcaptcha',
        siteKey: hcaptcha.siteKey,
        pageUrl,
      };
    }

    // Check for FunCaptcha
    const funcaptcha = await page.evaluate(() => {
      const div = document.querySelector('#funcaptcha');
      const script = document.querySelector('script[src*="funcaptcha"]');
      if (div || script) {
        const siteKey = div?.getAttribute('data-pkey');
        return { found: true, siteKey };
      }
      return { found: false };
    });

    if (funcaptcha.found) {
      return {
        type: 'funcaptcha',
        siteKey: funcaptcha.siteKey ?? undefined,
        pageUrl,
      };
    }

    return { type: 'none', pageUrl };
  }

  /**
   * Solve detected CAPTCHA
   */
  async solveCaptcha(detection: CaptchaDetection): Promise<CaptchaSolution> {
    if (!this.isEnabled()) {
      return {
        success: false,
        error: 'CAPTCHA solving service not configured',
      };
    }

    if (detection.type === 'none') {
      return { success: true };
    }

    const startTime = Date.now();

    try {
      switch (this.config.service) {
        case '2captcha':
          return await this.solveWith2Captcha(detection, startTime);
        case 'anticaptcha':
          return await this.solveWithAntiCaptcha(detection, startTime);
        case 'capsolver':
          return await this.solveWithCapSolver(detection, startTime);
        default:
          return {
            success: false,
            error: `Unknown service: ${this.config.service}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        solveTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Solve with 2Captcha
   */
  private async solveWith2Captcha(
    detection: CaptchaDetection,
    startTime: number
  ): Promise<CaptchaSolution> {
    const baseUrl = 'https://2captcha.com';

    // Create task
    const createParams = new URLSearchParams({
      key: this.config.apiKey,
      json: '1',
    });

    if (detection.type === 'recaptcha-v2') {
      createParams.append('method', 'userrecaptcha');
      createParams.append('googlekey', detection.siteKey || '');
      createParams.append('pageurl', detection.pageUrl);
    } else if (detection.type === 'recaptcha-v3') {
      createParams.append('method', 'userrecaptcha');
      createParams.append('version', 'v3');
      createParams.append('googlekey', detection.siteKey || '');
      createParams.append('pageurl', detection.pageUrl);
      createParams.append('action', detection.action || 'verify');
    } else if (detection.type === 'hcaptcha') {
      createParams.append('method', 'hcaptcha');
      createParams.append('sitekey', detection.siteKey || '');
      createParams.append('pageurl', detection.pageUrl);
    } else {
      return {
        success: false,
        error: `Unsupported CAPTCHA type: ${detection.type}`,
      };
    }

    const createResponse = await fetch(`${baseUrl}/in.php?${createParams}`);
    const createResult = await createResponse.json();

    if (createResult.status !== 1) {
      return {
        success: false,
        error: createResult.request || 'Failed to create task',
      };
    }

    const taskId = createResult.request;

    // Poll for result
    while (Date.now() - startTime < this.config.timeout) {
      await this.sleep(this.config.pollingInterval);

      const resultParams = new URLSearchParams({
        key: this.config.apiKey,
        action: 'get',
        id: taskId,
        json: '1',
      });

      const resultResponse = await fetch(`${baseUrl}/res.php?${resultParams}`);
      const result = await resultResponse.json();

      if (result.status === 1) {
        return {
          success: true,
          token: result.request,
          solveTime: Date.now() - startTime,
        };
      }

      if (result.request !== 'CAPCHA_NOT_READY') {
        return {
          success: false,
          error: result.request,
          solveTime: Date.now() - startTime,
        };
      }
    }

    return {
      success: false,
      error: 'Timeout waiting for solution',
      solveTime: Date.now() - startTime,
    };
  }

  /**
   * Solve with Anti-Captcha
   */
  private async solveWithAntiCaptcha(
    detection: CaptchaDetection,
    startTime: number
  ): Promise<CaptchaSolution> {
    const baseUrl = 'https://api.anti-captcha.com';

    // Build task based on CAPTCHA type
    let task: Record<string, unknown>;

    if (detection.type === 'recaptcha-v2') {
      task = {
        type: 'RecaptchaV2TaskProxyless',
        websiteURL: detection.pageUrl,
        websiteKey: detection.siteKey,
      };
    } else if (detection.type === 'recaptcha-v3') {
      task = {
        type: 'RecaptchaV3TaskProxyless',
        websiteURL: detection.pageUrl,
        websiteKey: detection.siteKey,
        minScore: 0.7,
        pageAction: detection.action || 'verify',
      };
    } else if (detection.type === 'hcaptcha') {
      task = {
        type: 'HCaptchaTaskProxyless',
        websiteURL: detection.pageUrl,
        websiteKey: detection.siteKey,
      };
    } else {
      return {
        success: false,
        error: `Unsupported CAPTCHA type: ${detection.type}`,
      };
    }

    // Create task
    const createResponse = await fetch(`${baseUrl}/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: this.config.apiKey,
        task,
      }),
    });

    const createResult = await createResponse.json();

    if (createResult.errorId !== 0) {
      return {
        success: false,
        error: createResult.errorDescription || 'Failed to create task',
      };
    }

    const taskId = createResult.taskId;

    // Poll for result
    while (Date.now() - startTime < this.config.timeout) {
      await this.sleep(this.config.pollingInterval);

      const resultResponse = await fetch(`${baseUrl}/getTaskResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: this.config.apiKey,
          taskId,
        }),
      });

      const result = await resultResponse.json();

      if (result.status === 'ready') {
        return {
          success: true,
          token: result.solution?.gRecaptchaResponse || result.solution?.token,
          cost: result.cost,
          solveTime: Date.now() - startTime,
        };
      }

      if (result.errorId !== 0) {
        return {
          success: false,
          error: result.errorDescription,
          solveTime: Date.now() - startTime,
        };
      }
    }

    return {
      success: false,
      error: 'Timeout waiting for solution',
      solveTime: Date.now() - startTime,
    };
  }

  /**
   * Solve with CapSolver
   */
  private async solveWithCapSolver(
    detection: CaptchaDetection,
    startTime: number
  ): Promise<CaptchaSolution> {
    const baseUrl = 'https://api.capsolver.com';

    // Build task based on CAPTCHA type
    let task: Record<string, unknown>;

    if (detection.type === 'recaptcha-v2') {
      task = {
        type: 'ReCaptchaV2TaskProxyLess',
        websiteURL: detection.pageUrl,
        websiteKey: detection.siteKey,
      };
    } else if (detection.type === 'recaptcha-v3') {
      task = {
        type: 'ReCaptchaV3TaskProxyLess',
        websiteURL: detection.pageUrl,
        websiteKey: detection.siteKey,
        pageAction: detection.action || 'verify',
      };
    } else if (detection.type === 'hcaptcha') {
      task = {
        type: 'HCaptchaTaskProxyLess',
        websiteURL: detection.pageUrl,
        websiteKey: detection.siteKey,
      };
    } else {
      return {
        success: false,
        error: `Unsupported CAPTCHA type: ${detection.type}`,
      };
    }

    // Create task
    const createResponse = await fetch(`${baseUrl}/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: this.config.apiKey,
        task,
      }),
    });

    const createResult = await createResponse.json();

    if (createResult.errorId !== 0) {
      return {
        success: false,
        error: createResult.errorDescription || 'Failed to create task',
      };
    }

    const taskId = createResult.taskId;

    // Poll for result
    while (Date.now() - startTime < this.config.timeout) {
      await this.sleep(this.config.pollingInterval);

      const resultResponse = await fetch(`${baseUrl}/getTaskResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: this.config.apiKey,
          taskId,
        }),
      });

      const result = await resultResponse.json();

      if (result.status === 'ready') {
        return {
          success: true,
          token: result.solution?.gRecaptchaResponse || result.solution?.token,
          solveTime: Date.now() - startTime,
        };
      }

      if (result.errorId !== 0) {
        return {
          success: false,
          error: result.errorDescription,
          solveTime: Date.now() - startTime,
        };
      }
    }

    return {
      success: false,
      error: 'Timeout waiting for solution',
      solveTime: Date.now() - startTime,
    };
  }

  /**
   * Apply solved CAPTCHA token to page
   */
  async applySolution(page: Page, detection: CaptchaDetection, token: string): Promise<void> {
    if (detection.type === 'recaptcha-v2' || detection.type === 'recaptcha-v3') {
      await page.evaluate((token) => {
        // Set the response in the hidden textarea
        const textarea = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = token;
          textarea.style.display = 'none';
        }

        // Also set in all response textareas (for multiple captchas)
        document.querySelectorAll('[name="g-recaptcha-response"]').forEach((el) => {
          (el as HTMLTextAreaElement).value = token;
        });

        // Trigger callback if exists
        // @ts-expect-error - grecaptcha callback
        if (window.___grecaptcha_cfg?.clients) {
          // @ts-expect-error - grecaptcha callback
          Object.values(window.___grecaptcha_cfg.clients).forEach((client: unknown) => {
            // @ts-expect-error - callback access
            if (client?.callback) {
              // @ts-expect-error - callback invocation
              client.callback(token);
            }
          });
        }
      }, token);
    } else if (detection.type === 'hcaptcha') {
      await page.evaluate((token) => {
        // Set the response
        const input = document.querySelector('[name="h-captcha-response"]') as HTMLInputElement;
        if (input) {
          input.value = token;
        }

        const textarea = document.querySelector('[name="g-recaptcha-response"]') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = token;
        }

        // Trigger callback
        // @ts-expect-error - hcaptcha callback
        if (window.hcaptcha?.getRespKey) {
          // @ts-expect-error - hcaptcha callback
          const widgetId = window.hcaptcha.getRespKey();
          // @ts-expect-error - hcaptcha callback
          window.hcaptcha.execute(widgetId, { async: false });
        }
      }, token);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
