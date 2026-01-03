/**
 * @fileoverview Workflow Step Executor
 * @module automation/workflow-engine/step-executor
 *
 * Executes individual workflow steps with human-like behavior.
 * Integrates with anti-detection modules for realistic automation.
 */

import { Page } from 'playwright';
import { WorkflowStep, WorkflowStepType } from '../../shared/types/workflow.types';
import { HumanBehavior } from '../stealth/human-behavior';
import { MetaDetection } from '../stealth/meta-detection';
import { SmartPageAnalyzer } from '../page-analyzer/smart-page-analyzer';
import { getTwoCaptchaSolver } from '../stealth/captcha-solver-2captcha';
import { VideoWatcherWorkflow } from '../workflows/video-watcher.workflow';
import { GmailSignupWorkflow } from '../workflows/gmail-signup.workflow';
import { YouTubeChannelWorkflow } from '../workflows/youtube-channel.workflow';
import { generateRandomData } from '../utils/data-generator';
import { logger } from '../../electron/utils/logger';
import { APP_CONFIG } from '../../shared/constants/app-config';

/**
 * Step execution error
 */
export class StepExecutionError extends Error {
  constructor(
    message: string,
    public readonly stepId: string,
    public readonly stepType: WorkflowStepType,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StepExecutionError';
  }
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  duration: number;
  extractedData?: Record<string, unknown>;
  error?: string;
}

/**
 * Executes workflow steps with human-like behavior
 */
export class StepExecutor {
  private readonly page: Page;
  private readonly humanBehavior: HumanBehavior;
  private readonly metaDetection: MetaDetection;
  private readonly pageAnalyzer: SmartPageAnalyzer;
  private readonly workspaceId: string;
  private extractedData: Record<string, unknown> = {};

  constructor(
    page: Page,
    humanBehavior: HumanBehavior,
    metaDetection: MetaDetection,
    workspaceId: string
  ) {
    this.page = page;
    this.humanBehavior = humanBehavior;
    this.metaDetection = metaDetection;
    this.pageAnalyzer = new SmartPageAnalyzer(page);
    this.workspaceId = workspaceId;
  }

  /**
   * Execute a workflow step
   */
  async execute(
    step: WorkflowStep,
    data?: Record<string, unknown>
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing step', {
        stepId: step.id,
        type: step.type,
        workspaceId: this.workspaceId,
      });

      // Check for detection before each step
      await this.metaDetection.checkDetectionSignals(this.page, this.workspaceId);

      // Check if high risk
      if (this.metaDetection.isHighRisk()) {
        throw new StepExecutionError(
          'High detection risk - aborting step',
          step.id,
          step.type
        );
      }

      // Add pre-step random behavior (30% chance)
      if (Math.random() < 0.3) {
        await this.humanBehavior.simulateReading();
      }

      // Execute the step
      await this.executeStepType(step, data);

      // Add post-step random behavior (20% chance)
      if (Math.random() < 0.2) {
        await this.humanBehavior.randomBehavior();
      }

      const duration = Date.now() - startTime;

      logger.debug('Step executed successfully', {
        stepId: step.id,
        duration,
      });

      return {
        stepId: step.id,
        success: true,
        duration,
        extractedData: this.extractedData,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Step execution failed', {
        error,
        stepId: step.id,
        type: step.type,
        duration,
      });

      // Handle error based on step configuration
      if (step.errorHandling?.onError === 'continue') {
        return {
          stepId: step.id,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }

      throw new StepExecutionError(
        `Step execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        step.id,
        step.type,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute step based on type
   */
  private async executeStepType(
    step: WorkflowStep,
    data?: Record<string, unknown>
  ): Promise<void> {
    const config = step.config;

    logger.info('Executing step type', { 
      type: step.type, 
      config,
      workspaceId: this.workspaceId,
    });

    switch (step.type) {
      case WorkflowStepType.NAVIGATE:
        await this.executeNavigate(config);
        break;

      case WorkflowStepType.CLICK:
        await this.executeClick(config);
        break;

      case WorkflowStepType.TYPE_TEXT:
        await this.executeTypeText(config, data);
        break;

      case WorkflowStepType.FILL_FORM:
        await this.executeFillForm(config, data);
        break;

      case WorkflowStepType.WAIT:
        await this.executeWait(config);
        break;

      case WorkflowStepType.WAIT_FOR_SELECTOR:
        await this.executeWaitForSelector(config);
        break;

      case WorkflowStepType.SCROLL:
        await this.executeScroll(config);
        break;

      case WorkflowStepType.SCREENSHOT:
        await this.executeScreenshot(config);
        break;

      case WorkflowStepType.EXTRACT:
        await this.executeExtract(config);
        break;

      case WorkflowStepType.EXECUTE_SCRIPT:
        await this.executeScript(config);
        break;

      case WorkflowStepType.PRESS_KEY:
        await this.executePressKey(config);
        break;

      case WorkflowStepType.HOVER:
        await this.executeHover(config);
        break;

      case WorkflowStepType.SELECT_OPTION:
        await this.executeSelectOption(config, data);
        break;

      case WorkflowStepType.SOLVE_CAPTCHA:
        await this.executeSolveCaptcha(config);
        break;

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Navigate to URL
   */
  private async executeNavigate(config: Record<string, unknown>): Promise<void> {
    let url = config.url as string;
    
    // Safety check: ensure URL is a string, not an object
    if (typeof url !== 'string') {
      logger.error('Navigate received non-string URL', { url, type: typeof url, config });
      url = String(url);
    }
    
    // Ensure URL has protocol
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    logger.info('Navigating to URL', { url });
    
    const waitUntil = (config.waitUntil as 'load' | 'domcontentloaded' | 'networkidle') || 'networkidle';

    await this.page.goto(url, {
      waitUntil,
      timeout: APP_CONFIG.NAVIGATION_TIMEOUT,
    });

    // Simulate reading page after load
    await this.humanBehavior.simulateReading();
  }

  /**
   * Click element with smart detection
   * Tries to find element by selector first, then by text/action description
   */
  private async executeClick(config: Record<string, unknown>): Promise<void> {
    const selector = config.selector as string;
    const action = config.action as string | undefined;
    const text = config.text as string | undefined;

    // First try direct selector
    try {
      const element = await this.page.$(selector);
      if (element && await element.isVisible()) {
        await this.humanBehavior.clickHumanLike(selector);
        return;
      }
    } catch {
      // Selector didn't work, try smart detection
    }

    // Try to find by action description
    if (action || text) {
      const target = await this.pageAnalyzer.findClickTarget(action || text || '');
      if (target) {
        logger.debug('Found click target via smart analysis', { 
          original: selector, 
          found: target.selector 
        });
        await this.humanBehavior.clickHumanLike(target.selector);
        return;
      }
    }

    // Try to find element by description in selector
    const foundElement = await this.pageAnalyzer.findElementByDescription(selector);
    if (foundElement && foundElement.isVisible) {
      await this.humanBehavior.clickHumanLike(foundElement.selector);
      return;
    }

    // Fallback to original selector
    await this.humanBehavior.clickHumanLike(selector);
  }

  /**
   * Type text into element with smart detection
   */
  private async executeTypeText(
    config: Record<string, unknown>,
    data?: Record<string, unknown>
  ): Promise<void> {
    const selector = config.selector as string;
    const fieldType = config.fieldType as string | undefined;
    const text = this.interpolateData(config.text as string, data);

    // Try direct selector first
    try {
      const element = await this.page.$(selector);
      if (element && await element.isVisible()) {
        await this.humanBehavior.typeHumanLike(selector, text);
        return;
      }
    } catch {
      // Selector didn't work, try smart detection
    }

    // Try to find input by field type
    if (fieldType) {
      const inputField = await this.pageAnalyzer.findInputField(fieldType);
      if (inputField && inputField.isVisible) {
        logger.debug('Found input field via smart analysis', { 
          original: selector, 
          found: inputField.selector,
          fieldType 
        });
        await this.humanBehavior.typeHumanLike(inputField.selector, text);
        return;
      }
    }

    // Try to find element by description
    const foundElement = await this.pageAnalyzer.findElementByDescription(selector);
    if (foundElement && foundElement.isVisible) {
      await this.humanBehavior.typeHumanLike(foundElement.selector, text);
      return;
    }

    // Fallback to original selector
    await this.humanBehavior.typeHumanLike(selector, text);
  }

  /**
   * Fill form fields with smart detection
   */
  private async executeFillForm(
    config: Record<string, unknown>,
    data?: Record<string, unknown>
  ): Promise<void> {
    const fields = config.fields as Array<{
      selector: string;
      value: string;
      type?: string;
    }>;

    // Analyze page forms first
    const analysis = await this.pageAnalyzer.analyzePage();
    logger.debug('Form analysis', { 
      formsFound: analysis.forms.length,
      inputsFound: analysis.inputs.length 
    });

    for (const field of fields || []) {
      const value = this.interpolateData(field.value, data);
      
      // Try direct selector first
      let selector = field.selector;
      
      try {
        const element = await this.page.$(selector);
        if (!element || !(await element.isVisible())) {
          // Try to find by field type
          if (field.type) {
            const inputField = await this.pageAnalyzer.findInputField(field.type);
            if (inputField && inputField.isVisible) {
              selector = inputField.selector;
              logger.debug('Using smart selector for form field', { 
                original: field.selector, 
                found: selector,
                type: field.type 
              });
            }
          }
        }
      } catch {
        // Use original selector
      }

      await this.humanBehavior.typeHumanLike(selector, value);
      await this.humanBehavior.humanWait(300, 800);
    }
  }

  /**
   * Wait for duration
   */
  private async executeWait(config: Record<string, unknown>): Promise<void> {
    const duration = config.duration as number;
    await this.page.waitForTimeout(duration);
  }

  /**
   * Wait for selector
   */
  private async executeWaitForSelector(config: Record<string, unknown>): Promise<void> {
    const selector = config.selector as string;
    const timeout = (config.timeout as number) || APP_CONFIG.DEFAULT_TIMEOUT;

    await this.page.waitForSelector(selector, { timeout });
  }

  /**
   * Scroll page
   */
  private async executeScroll(config: Record<string, unknown>): Promise<void> {
    const direction = (config.direction as 'up' | 'down') || 'down';
    await this.humanBehavior.scrollHumanLike(direction);
  }

  /**
   * Take screenshot
   */
  private async executeScreenshot(config: Record<string, unknown>): Promise<void> {
    const path = config.path as string | undefined;
    const fullPage = (config.fullPage as boolean) || false;

    await this.page.screenshot({
      path,
      fullPage,
      type: 'png',
    });
  }

  /**
   * Extract data from page
   */
  private async executeExtract(config: Record<string, unknown>): Promise<void> {
    const dataItems = config.data as Array<{
      name: string;
      selector: string;
      attribute?: string;
      multiple?: boolean;
    }>;

    for (const item of dataItems || []) {
      try {
        if (item.multiple) {
          const elements = await this.page.$$(item.selector);
          const values: string[] = [];
          
          for (const element of elements) {
            const value = item.attribute
              ? await element.getAttribute(item.attribute)
              : await element.textContent();
            if (value) values.push(value.trim());
          }
          
          this.extractedData[item.name] = values;
        } else {
          const element = await this.page.$(item.selector);
          if (element) {
            const value = item.attribute
              ? await element.getAttribute(item.attribute)
              : await element.textContent();
            this.extractedData[item.name] = value?.trim() || null;
          }
        }
      } catch (error) {
        logger.warn('Failed to extract data', {
          name: item.name,
          selector: item.selector,
          error,
        });
      }
    }
  }

  /**
   * Execute JavaScript or workflow
   */
  private async executeScript(config: Record<string, unknown>): Promise<void> {
    const workflow = config.workflow as string | undefined;
    
    // Handle special workflow types
    if (workflow) {
      await this.executeWorkflow(workflow, config);
      return;
    }
    
    // Regular script execution
    const script = config.script as string;
    if (script) {
      await this.page.evaluate(script);
    }
  }

  /**
   * Execute a pre-built workflow
   */
  private async executeWorkflow(
    workflowType: string,
    config: Record<string, unknown>
  ): Promise<void> {
    logger.info('Executing workflow', { workflowType, config });

    switch (workflowType) {
      case 'gmail_signup': {
        const gmailWorkflow = new GmailSignupWorkflow(this.page);
        const result = await gmailWorkflow.execute(this.workspaceId);
        if (result.account) {
          this.extractedData['createdAccount'] = result.account;
        }
        if (!result.success) {
          throw new Error(result.error || 'Gmail signup failed');
        }
        break;
      }

      case 'youtube_channel': {
        const channelName = config.channelName as string | undefined;
        const ytWorkflow = new YouTubeChannelWorkflow(this.page, channelName);
        const result = await ytWorkflow.execute();
        if (result.channelUrl) {
          this.extractedData['channelUrl'] = result.channelUrl;
          this.extractedData['channelName'] = result.channelName;
        }
        if (!result.success) {
          throw new Error(result.error || 'YouTube channel creation failed');
        }
        break;
      }

      case 'watch_video': {
        const videoUrl = config.videoUrl as string;
        const durationMinutes = (config.durationMinutes as number) || 5;
        const videoWorkflow = new VideoWatcherWorkflow(this.page);
        const result = await videoWorkflow.execute(videoUrl, durationMinutes);
        this.extractedData['watchResult'] = result;
        if (!result.success) {
          throw new Error(result.error || 'Video watching failed');
        }
        break;
      }

      case 'like_video': {
        const videoWorkflow = new VideoWatcherWorkflow(this.page);
        await videoWorkflow.likeVideo();
        break;
      }

      case 'subscribe_channel': {
        const videoWorkflow = new VideoWatcherWorkflow(this.page);
        await videoWorkflow.subscribeToChannel();
        break;
      }

      case 'post_comment': {
        const comment = config.comment as string;
        const videoWorkflow = new VideoWatcherWorkflow(this.page);
        await videoWorkflow.postComment(comment);
        break;
      }

      default:
        logger.warn('Unknown workflow type', { workflowType });
    }
  }

  /**
   * Press key
   */
  private async executePressKey(config: Record<string, unknown>): Promise<void> {
    const key = config.key as string;
    const modifiers = config.modifiers as string[] | undefined;

    if (modifiers && modifiers.length > 0) {
      const keyCombo = [...modifiers, key].join('+');
      await this.page.keyboard.press(keyCombo);
    } else {
      await this.page.keyboard.press(key);
    }

    await this.humanBehavior.humanWait(100, 300);
  }

  /**
   * Hover over element
   */
  private async executeHover(config: Record<string, unknown>): Promise<void> {
    const selector = config.selector as string;
    const element = await this.page.$(selector);
    
    if (element) {
      const box = await element.boundingBox();
      if (box) {
        await this.humanBehavior.moveMouseHumanLike(
          box.x + box.width / 2,
          box.y + box.height / 2
        );
      }
    }

    await this.humanBehavior.humanWait(500, 1500);
  }

  /**
   * Select option from dropdown
   */
  private async executeSelectOption(
    config: Record<string, unknown>,
    data?: Record<string, unknown>
  ): Promise<void> {
    const selector = config.selector as string;
    const value = this.interpolateData(config.value as string || config.option as string, data);

    await this.humanBehavior.clickHumanLike(selector);
    await this.humanBehavior.humanWait(200, 400);
    await this.page.selectOption(selector, value);
  }

  /**
   * Solve CAPTCHA on page
   */
  private async executeSolveCaptcha(config: Record<string, unknown>): Promise<void> {
    const solver = getTwoCaptchaSolver();
    
    if (!solver) {
      logger.warn('2Captcha solver not configured, skipping CAPTCHA solving');
      // Wait a bit and hope user solves it manually or it auto-resolves
      await this.humanBehavior.humanWait(3000, 5000);
      return;
    }

    const captchaType = config.captchaType as string || 'auto';
    const siteKey = config.siteKey as string | undefined;
    const pageUrl = this.page.url();

    logger.info('Solving CAPTCHA', { captchaType, pageUrl });

    let result;

    if (captchaType === 'auto') {
      // Auto-detect and solve
      result = await solver.autoSolve(this.page);
    } else if (captchaType === 'recaptcha_v2') {
      if (!siteKey) {
        throw new Error('siteKey required for reCAPTCHA v2');
      }
      result = await solver.solveRecaptchaV2(this.page, siteKey, pageUrl);
    } else if (captchaType === 'recaptcha_v3') {
      if (!siteKey) {
        throw new Error('siteKey required for reCAPTCHA v3');
      }
      const action = config.action as string || 'verify';
      result = await solver.solveRecaptchaV3(this.page, siteKey, pageUrl, action);
    } else if (captchaType === 'hcaptcha') {
      if (!siteKey) {
        throw new Error('siteKey required for hCaptcha');
      }
      result = await solver.solveHCaptcha(this.page, siteKey, pageUrl);
    } else if (captchaType === 'turnstile') {
      if (!siteKey) {
        throw new Error('siteKey required for Turnstile');
      }
      result = await solver.solveTurnstile(this.page, siteKey, pageUrl);
    } else {
      throw new Error(`Unknown CAPTCHA type: ${captchaType}`);
    }

    if (!result.success) {
      throw new Error(`CAPTCHA solve failed: ${result.error}`);
    }

    logger.info('CAPTCHA solved successfully', { solveTime: result.solveTime });

    // Wait a bit after solving
    await this.humanBehavior.humanWait(500, 1000);
  }

  /**
   * Generate random data for templates
   * Uses the comprehensive data generator
   */
  private generateRandomDataForTemplates(): Record<string, string> {
    return generateRandomData();
  }

  /**
   * Interpolate data placeholders
   */
  private interpolateData(
    template: string,
    data?: Record<string, unknown>
  ): string {
    if (!template) return template;

    // Merge with random data
    const randomData = this.generateRandomDataForTemplates();
    const mergedData = { ...randomData, ...(data || {}) };

    return template.replace(/\{\{(.+?)\}\}/g, (match, key) => {
      const value = mergedData[key.trim()];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get extracted data
   */
  getExtractedData(): Record<string, unknown> {
    return { ...this.extractedData };
  }

  /**
   * Clear extracted data
   */
  clearExtractedData(): void {
    this.extractedData = {};
  }
}
