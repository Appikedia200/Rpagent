/**
 * @fileoverview CAPTCHA Solver Service
 * @module automation/services/captcha-solver
 *
 * Real integration with 2Captcha, Anti-Captcha, and CapMonster APIs.
 * Solves reCAPTCHA v2, v3, hCaptcha, and image captchas.
 */

import { logger } from '../../electron/utils/logger';

export interface CaptchaSolverConfig {
  service: '2captcha' | 'anti-captcha' | 'capmonster';
  apiKey: string;
}

export interface CaptchaSolveResult {
  success: boolean;
  solution?: string;
  error?: string;
  taskId?: string;
  cost?: number;
}

export interface ReCaptchaV2Task {
  type: 'recaptcha_v2';
  siteKey: string;
  pageUrl: string;
  isInvisible?: boolean;
}

export interface ReCaptchaV3Task {
  type: 'recaptcha_v3';
  siteKey: string;
  pageUrl: string;
  action?: string;
  minScore?: number;
}

export interface HCaptchaTask {
  type: 'hcaptcha';
  siteKey: string;
  pageUrl: string;
}

export interface ImageCaptchaTask {
  type: 'image';
  imageBase64: string;
  caseSensitive?: boolean;
}

export type CaptchaTask = ReCaptchaV2Task | ReCaptchaV3Task | HCaptchaTask | ImageCaptchaTask;

/**
 * 2Captcha API Client
 */
class TwoCaptchaClient {
  private apiKey: string;
  private baseUrl = 'https://2captcha.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Verify API key is valid and check balance
   */
  async verifyApiKey(): Promise<{ valid: boolean; balance?: number; error?: string }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/res.php?key=${this.apiKey}&action=getbalance&json=1`
      );
      
      const data = await response.json();
      
      if (data.status === 1) {
        return { valid: true, balance: parseFloat(data.request) };
      } else {
        return { valid: false, error: data.request || 'Invalid API key' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      return { valid: false, error: message };
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<number> {
    const result = await this.verifyApiKey();
    return result.balance || 0;
  }

  /**
   * Submit a reCAPTCHA v2 task
   */
  async solveReCaptchaV2(task: ReCaptchaV2Task): Promise<CaptchaSolveResult> {
    try {
      // Submit task
      const submitUrl = new URL(`${this.baseUrl}/in.php`);
      submitUrl.searchParams.set('key', this.apiKey);
      submitUrl.searchParams.set('method', 'userrecaptcha');
      submitUrl.searchParams.set('googlekey', task.siteKey);
      submitUrl.searchParams.set('pageurl', task.pageUrl);
      submitUrl.searchParams.set('json', '1');
      if (task.isInvisible) {
        submitUrl.searchParams.set('invisible', '1');
      }

      const submitResponse = await fetch(submitUrl.toString());
      const submitData = await submitResponse.json();

      if (submitData.status !== 1) {
        return { success: false, error: submitData.request };
      }

      const taskId = submitData.request;
      logger.info('2Captcha task submitted', { taskId });

      // Poll for result
      return await this.pollForResult(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Submit a reCAPTCHA v3 task
   */
  async solveReCaptchaV3(task: ReCaptchaV3Task): Promise<CaptchaSolveResult> {
    try {
      const submitUrl = new URL(`${this.baseUrl}/in.php`);
      submitUrl.searchParams.set('key', this.apiKey);
      submitUrl.searchParams.set('method', 'userrecaptcha');
      submitUrl.searchParams.set('googlekey', task.siteKey);
      submitUrl.searchParams.set('pageurl', task.pageUrl);
      submitUrl.searchParams.set('version', 'v3');
      submitUrl.searchParams.set('json', '1');
      if (task.action) {
        submitUrl.searchParams.set('action', task.action);
      }
      if (task.minScore) {
        submitUrl.searchParams.set('min_score', task.minScore.toString());
      }

      const submitResponse = await fetch(submitUrl.toString());
      const submitData = await submitResponse.json();

      if (submitData.status !== 1) {
        return { success: false, error: submitData.request };
      }

      return await this.pollForResult(submitData.request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Submit an hCaptcha task
   */
  async solveHCaptcha(task: HCaptchaTask): Promise<CaptchaSolveResult> {
    try {
      const submitUrl = new URL(`${this.baseUrl}/in.php`);
      submitUrl.searchParams.set('key', this.apiKey);
      submitUrl.searchParams.set('method', 'hcaptcha');
      submitUrl.searchParams.set('sitekey', task.siteKey);
      submitUrl.searchParams.set('pageurl', task.pageUrl);
      submitUrl.searchParams.set('json', '1');

      const submitResponse = await fetch(submitUrl.toString());
      const submitData = await submitResponse.json();

      if (submitData.status !== 1) {
        return { success: false, error: submitData.request };
      }

      return await this.pollForResult(submitData.request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Submit an image captcha task
   */
  async solveImageCaptcha(task: ImageCaptchaTask): Promise<CaptchaSolveResult> {
    try {
      const submitUrl = new URL(`${this.baseUrl}/in.php`);
      submitUrl.searchParams.set('key', this.apiKey);
      submitUrl.searchParams.set('method', 'base64');
      submitUrl.searchParams.set('body', task.imageBase64);
      submitUrl.searchParams.set('json', '1');
      if (task.caseSensitive) {
        submitUrl.searchParams.set('regsense', '1');
      }

      const submitResponse = await fetch(submitUrl.toString());
      const submitData = await submitResponse.json();

      if (submitData.status !== 1) {
        return { success: false, error: submitData.request };
      }

      return await this.pollForResult(submitData.request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Poll for captcha solution
   */
  private async pollForResult(taskId: string, maxAttempts = 60): Promise<CaptchaSolveResult> {
    const resultUrl = new URL(`${this.baseUrl}/res.php`);
    resultUrl.searchParams.set('key', this.apiKey);
    resultUrl.searchParams.set('action', 'get');
    resultUrl.searchParams.set('id', taskId);
    resultUrl.searchParams.set('json', '1');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      try {
        const response = await fetch(resultUrl.toString());
        const data = await response.json();

        if (data.status === 1) {
          logger.info('2Captcha solved', { taskId });
          return { success: true, solution: data.request, taskId };
        }

        if (data.request !== 'CAPCHA_NOT_READY') {
          return { success: false, error: data.request, taskId };
        }

        logger.debug('Captcha not ready, waiting...', { attempt, taskId });
      } catch (error) {
        logger.warn('Poll error', { error, attempt });
      }
    }

    return { success: false, error: 'Timeout waiting for solution', taskId };
  }

  /**
   * Report bad captcha (for refund)
   */
  async reportBad(taskId: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/res.php?key=${this.apiKey}&action=reportbad&id=${taskId}&json=1`;
      const response = await fetch(url);
      const data = await response.json();
      return data.status === 1;
    } catch {
      return false;
    }
  }
}

/**
 * Anti-Captcha API Client
 */
class AntiCaptchaClient {
  private apiKey: string;
  private baseUrl = 'https://api.anti-captcha.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async verifyApiKey(): Promise<{ valid: boolean; balance?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/getBalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: this.apiKey }),
      });

      const data = await response.json();

      if (data.errorId === 0) {
        return { valid: true, balance: data.balance };
      } else {
        return { valid: false, error: data.errorDescription || 'Invalid API key' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      return { valid: false, error: message };
    }
  }

  async solveReCaptchaV2(task: ReCaptchaV2Task): Promise<CaptchaSolveResult> {
    try {
      // Create task
      const createResponse = await fetch(`${this.baseUrl}/createTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: this.apiKey,
          task: {
            type: task.isInvisible ? 'RecaptchaV2TaskProxyless' : 'NoCaptchaTaskProxyless',
            websiteURL: task.pageUrl,
            websiteKey: task.siteKey,
            isInvisible: task.isInvisible,
          },
        }),
      });

      const createData = await createResponse.json();

      if (createData.errorId !== 0) {
        return { success: false, error: createData.errorDescription };
      }

      return await this.pollForResult(createData.taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  private async pollForResult(taskId: number, maxAttempts = 60): Promise<CaptchaSolveResult> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const response = await fetch(`${this.baseUrl}/getTaskResult`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientKey: this.apiKey,
            taskId: taskId,
          }),
        });

        const data = await response.json();

        if (data.status === 'ready') {
          return { 
            success: true, 
            solution: data.solution?.gRecaptchaResponse || data.solution?.text,
            taskId: taskId.toString(),
            cost: data.cost,
          };
        }

        if (data.errorId !== 0) {
          return { success: false, error: data.errorDescription };
        }
      } catch (error) {
        logger.warn('Poll error', { error, attempt });
      }
    }

    return { success: false, error: 'Timeout waiting for solution' };
  }
}

/**
 * CapMonster API Client (same API as Anti-Captcha)
 */
class CapMonsterClient extends AntiCaptchaClient {
  constructor(apiKey: string) {
    super(apiKey);
    // Override base URL
    (this as any).baseUrl = 'https://api.capmonster.cloud';
  }
}

/**
 * Unified Captcha Solver Service
 */
export class CaptchaSolverService {
  private config: CaptchaSolverConfig | null = null;
  private client: TwoCaptchaClient | AntiCaptchaClient | CapMonsterClient | null = null;

  /**
   * Configure the service
   */
  configure(config: CaptchaSolverConfig): void {
    this.config = config;
    
    switch (config.service) {
      case '2captcha':
        this.client = new TwoCaptchaClient(config.apiKey);
        break;
      case 'anti-captcha':
        this.client = new AntiCaptchaClient(config.apiKey);
        break;
      case 'capmonster':
        this.client = new CapMonsterClient(config.apiKey);
        break;
    }
    
    logger.info('Captcha solver configured', { service: config.service });
  }

  /**
   * Verify API key and get balance
   */
  async verify(): Promise<{ valid: boolean; balance?: number; error?: string }> {
    if (!this.client) {
      return { valid: false, error: 'Service not configured' };
    }
    
    return await this.client.verifyApiKey();
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<number> {
    const result = await this.verify();
    return result.balance || 0;
  }

  /**
   * Solve a captcha
   */
  async solve(task: CaptchaTask): Promise<CaptchaSolveResult> {
    if (!this.client || !this.config) {
      return { success: false, error: 'Service not configured' };
    }

    logger.info('Solving captcha', { type: task.type, service: this.config.service });

    // 2Captcha client
    if (this.client instanceof TwoCaptchaClient) {
      switch (task.type) {
        case 'recaptcha_v2':
          return await this.client.solveReCaptchaV2(task);
        case 'recaptcha_v3':
          return await this.client.solveReCaptchaV3(task);
        case 'hcaptcha':
          return await this.client.solveHCaptcha(task);
        case 'image':
          return await this.client.solveImageCaptcha(task);
      }
    }

    // Anti-Captcha / CapMonster client
    if (this.client instanceof AntiCaptchaClient) {
      if (task.type === 'recaptcha_v2') {
        return await this.client.solveReCaptchaV2(task);
      }
      return { success: false, error: 'Task type not supported for this service' };
    }

    return { success: false, error: 'Unknown client type' };
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get current config
   */
  getConfig(): CaptchaSolverConfig | null {
    return this.config;
  }
}

// Singleton instance
let captchaSolverInstance: CaptchaSolverService | null = null;

export function getCaptchaSolverService(): CaptchaSolverService {
  if (!captchaSolverInstance) {
    captchaSolverInstance = new CaptchaSolverService();
  }
  return captchaSolverInstance;
}

