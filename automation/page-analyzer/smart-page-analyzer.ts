/**
 * @fileoverview Smart Page Analyzer
 * @module automation/page-analyzer/smart-page-analyzer
 *
 * Analyzes page content to find interactive elements.
 * This is how professional RPA agents "see" the page before acting.
 */

import { Page, ElementHandle } from 'playwright';
import { logger } from '../../electron/utils/logger';

/**
 * Detected element info
 */
export interface DetectedElement {
  selector: string;
  type: 'button' | 'input' | 'link' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'other';
  text: string;
  placeholder?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
  isVisible: boolean;
  isEnabled: boolean;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}

/**
 * Page analysis result
 */
export interface PageAnalysis {
  url: string;
  title: string;
  forms: FormInfo[];
  buttons: DetectedElement[];
  inputs: DetectedElement[];
  links: DetectedElement[];
  interactiveElements: DetectedElement[];
}

/**
 * Form info
 */
export interface FormInfo {
  id?: string;
  action?: string;
  method?: string;
  fields: DetectedElement[];
  submitButton?: DetectedElement;
}

/**
 * Smart Page Analyzer
 * Reads and understands page structure before interacting
 */
export class SmartPageAnalyzer {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Analyze the entire page
   */
  async analyzePage(): Promise<PageAnalysis> {
    logger.debug('Analyzing page', { url: this.page.url() });

    const [title, forms, buttons, inputs, links] = await Promise.all([
      this.page.title(),
      this.analyzeForms(),
      this.findButtons(),
      this.findInputs(),
      this.findLinks(),
    ]);

    const interactiveElements = [...buttons, ...inputs, ...links];

    return {
      url: this.page.url(),
      title,
      forms,
      buttons,
      inputs,
      links,
      interactiveElements,
    };
  }

  /**
   * Find the best element matching a description
   */
  async findElementByDescription(description: string): Promise<DetectedElement | null> {
    const normalizedDesc = description.toLowerCase().trim();
    
    // Strategy 1: Try common selectors
    const commonSelectors = this.getSelectorsForDescription(normalizedDesc);
    
    for (const selector of commonSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            return this.elementToDetected(element, selector);
          }
        }
      } catch {
        // Selector didn't match, try next
      }
    }

    // Strategy 2: Search by text content
    const textElement = await this.findByText(normalizedDesc);
    if (textElement) return textElement;

    // Strategy 3: Search all interactive elements
    const allElements = await this.findAllInteractiveElements();
    for (const elem of allElements) {
      const elemText = (elem.text + ' ' + (elem.placeholder || '') + ' ' + (elem.ariaLabel || '')).toLowerCase();
      if (elemText.includes(normalizedDesc) || normalizedDesc.includes(elemText)) {
        return elem;
      }
    }

    return null;
  }

  /**
   * Find element ready to click for a given action
   */
  async findClickTarget(action: string): Promise<{ selector: string; element: DetectedElement } | null> {
    const analysis = await this.analyzePage();
    const normalizedAction = action.toLowerCase();

    // For "next" or "continue" buttons
    if (normalizedAction.includes('next') || normalizedAction.includes('continue')) {
      const nextButton = analysis.buttons.find(b => 
        b.text.toLowerCase().includes('next') || 
        b.text.toLowerCase().includes('continue') ||
        b.ariaLabel?.toLowerCase().includes('next')
      );
      if (nextButton) return { selector: nextButton.selector, element: nextButton };
    }

    // For "create account" or "sign up"
    if (normalizedAction.includes('create') || normalizedAction.includes('sign up') || normalizedAction.includes('register')) {
      const createButton = analysis.buttons.find(b =>
        b.text.toLowerCase().includes('create') ||
        b.text.toLowerCase().includes('sign up') ||
        b.text.toLowerCase().includes('register')
      ) || analysis.links.find(l =>
        l.text.toLowerCase().includes('create') ||
        l.text.toLowerCase().includes('sign up')
      );
      if (createButton) return { selector: createButton.selector, element: createButton };
    }

    // For "submit" or "login"
    if (normalizedAction.includes('submit') || normalizedAction.includes('login') || normalizedAction.includes('sign in')) {
      const submitButton = analysis.buttons.find(b =>
        b.text.toLowerCase().includes('submit') ||
        b.text.toLowerCase().includes('login') ||
        b.text.toLowerCase().includes('sign in') ||
        b.type === 'button'
      );
      if (submitButton) return { selector: submitButton.selector, element: submitButton };
    }

    // For "skip"
    if (normalizedAction.includes('skip')) {
      const skipButton = analysis.buttons.find(b =>
        b.text.toLowerCase().includes('skip')
      );
      if (skipButton) return { selector: skipButton.selector, element: skipButton };
    }

    // For "agree" or "accept"
    if (normalizedAction.includes('agree') || normalizedAction.includes('accept')) {
      const agreeButton = analysis.buttons.find(b =>
        b.text.toLowerCase().includes('agree') ||
        b.text.toLowerCase().includes('accept') ||
        b.text.toLowerCase().includes('i agree')
      );
      if (agreeButton) return { selector: agreeButton.selector, element: agreeButton };
    }

    return null;
  }

  /**
   * Find the best input field for a given field type
   */
  async findInputField(fieldType: string): Promise<DetectedElement | null> {
    const normalizedType = fieldType.toLowerCase();
    const inputs = await this.findInputs();

    // Map common field types to selectors
    const fieldMappings: Record<string, (i: DetectedElement) => boolean> = {
      'first name': (i) => 
        i.name?.toLowerCase().includes('first') ||
        i.id?.toLowerCase().includes('first') ||
        i.placeholder?.toLowerCase().includes('first') ||
        i.ariaLabel?.toLowerCase().includes('first') || false,
      
      'last name': (i) =>
        i.name?.toLowerCase().includes('last') ||
        i.id?.toLowerCase().includes('last') ||
        i.placeholder?.toLowerCase().includes('last') ||
        i.ariaLabel?.toLowerCase().includes('last') || false,
      
      'email': (i) =>
        i.type === 'input' && (
          i.name?.toLowerCase().includes('email') ||
          i.id?.toLowerCase().includes('email') ||
          i.placeholder?.toLowerCase().includes('email') ||
          i.name?.toLowerCase().includes('username')
        ) || false,
      
      'password': (i) =>
        i.type === 'input' && (
          i.name?.toLowerCase().includes('pass') ||
          i.id?.toLowerCase().includes('pass') ||
          i.placeholder?.toLowerCase().includes('pass')
        ) || false,
      
      'phone': (i) =>
        i.name?.toLowerCase().includes('phone') ||
        i.id?.toLowerCase().includes('phone') ||
        i.placeholder?.toLowerCase().includes('phone') ||
        i.name?.toLowerCase().includes('tel') || false,
      
      'username': (i) =>
        i.name?.toLowerCase().includes('user') ||
        i.id?.toLowerCase().includes('user') ||
        i.placeholder?.toLowerCase().includes('user') || false,
    };

    // Try to find by field type
    for (const [type, matcher] of Object.entries(fieldMappings)) {
      if (normalizedType.includes(type)) {
        const match = inputs.find(matcher);
        if (match) return match;
      }
    }

    // Generic search
    return inputs.find(i => 
      i.name?.toLowerCase().includes(normalizedType) ||
      i.id?.toLowerCase().includes(normalizedType) ||
      i.placeholder?.toLowerCase().includes(normalizedType)
    ) || null;
  }

  /**
   * Wait for page to be ready for interaction
   */
  async waitForPageReady(timeout: number = 10000): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout });
    
    // Wait for any overlays/modals to appear
    await this.page.waitForTimeout(500);
    
    // Check if there's a loading indicator
    try {
      await this.page.waitForSelector('[class*="loading"], [class*="spinner"]', {
        state: 'hidden',
        timeout: 5000,
      });
    } catch {
      // No loading indicator found, continue
    }
  }

  /**
   * Get selectors for a description
   */
  private getSelectorsForDescription(description: string): string[] {
    const selectors: string[] = [];

    // Button selectors
    if (description.includes('button') || description.includes('click') || description.includes('submit')) {
      selectors.push(
        `button:has-text("${description}")`,
        `input[type="submit"][value*="${description}" i]`,
        `button[aria-label*="${description}" i]`,
        `[role="button"]:has-text("${description}")`
      );
    }

    // Input selectors
    if (description.includes('email') || description.includes('name') || description.includes('password')) {
      selectors.push(
        `input[name*="${description}" i]`,
        `input[id*="${description}" i]`,
        `input[placeholder*="${description}" i]`,
        `input[aria-label*="${description}" i]`
      );
    }

    // Link selectors
    selectors.push(
      `a:has-text("${description}")`,
      `[role="link"]:has-text("${description}")`
    );

    // Generic text selectors
    selectors.push(
      `text="${description}"`,
      `text=${description}`
    );

    return selectors;
  }

  /**
   * Find element by text content
   */
  private async findByText(text: string): Promise<DetectedElement | null> {
    try {
      const element = await this.page.$(`text="${text}"`);
      if (element && await element.isVisible()) {
        return this.elementToDetected(element, `text="${text}"`);
      }

      // Try partial match
      const partialElement = await this.page.$(`text=${text}`);
      if (partialElement && await partialElement.isVisible()) {
        return this.elementToDetected(partialElement, `text=${text}`);
      }
    } catch {
      // Text not found
    }
    return null;
  }

  /**
   * Find all forms on the page
   */
  private async analyzeForms(): Promise<FormInfo[]> {
    const forms: FormInfo[] = [];

    const formElements = await this.page.$$('form');
    
    for (const form of formElements) {
      const id = await form.getAttribute('id');
      const action = await form.getAttribute('action');
      const method = await form.getAttribute('method');

      const fieldElements = await form.$$('input, select, textarea');
      const fields: DetectedElement[] = [];

      for (const field of fieldElements) {
        const detected = await this.elementToDetected(field, '');
        if (detected) fields.push(detected);
      }

      const submitBtn = await form.$('button[type="submit"], input[type="submit"]');
      const submitButton = submitBtn ? await this.elementToDetected(submitBtn, '') : undefined;

      forms.push({
        id: id || undefined,
        action: action || undefined,
        method: method || undefined,
        fields,
        submitButton: submitButton || undefined,
      });
    }

    return forms;
  }

  /**
   * Find all buttons
   */
  private async findButtons(): Promise<DetectedElement[]> {
    const buttons: DetectedElement[] = [];
    const selectors = [
      'button',
      'input[type="button"]',
      'input[type="submit"]',
      '[role="button"]',
      'a.btn',
      'a.button',
    ];

    for (const selector of selectors) {
      const elements = await this.page.$$(selector);
      for (const el of elements) {
        const detected = await this.elementToDetected(el, selector);
        if (detected && detected.isVisible) {
          buttons.push(detected);
        }
      }
    }

    return buttons;
  }

  /**
   * Find all inputs
   */
  private async findInputs(): Promise<DetectedElement[]> {
    const inputs: DetectedElement[] = [];
    const elements = await this.page.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');

    for (const el of elements) {
      const detected = await this.elementToDetected(el, '');
      if (detected) {
        inputs.push(detected);
      }
    }

    return inputs;
  }

  /**
   * Find all links
   */
  private async findLinks(): Promise<DetectedElement[]> {
    const links: DetectedElement[] = [];
    const elements = await this.page.$$('a[href]');

    for (const el of elements) {
      const detected = await this.elementToDetected(el, 'a');
      if (detected && detected.isVisible) {
        links.push(detected);
      }
    }

    return links;
  }

  /**
   * Find all interactive elements
   */
  private async findAllInteractiveElements(): Promise<DetectedElement[]> {
    const [buttons, inputs, links] = await Promise.all([
      this.findButtons(),
      this.findInputs(),
      this.findLinks(),
    ]);
    return [...buttons, ...inputs, ...links];
  }

  /**
   * Convert element to detected element info
   */
  private async elementToDetected(
    element: ElementHandle,
    fallbackSelector: string
  ): Promise<DetectedElement | null> {
    try {
      const tagName = await element.evaluate(el => (el as HTMLElement).tagName.toLowerCase());
      const type = await element.getAttribute('type');
      const text = await element.innerText().catch(() => '');
      const placeholder = await element.getAttribute('placeholder');
      const name = await element.getAttribute('name');
      const id = await element.getAttribute('id');
      const ariaLabel = await element.getAttribute('aria-label');
      const isVisible = await element.isVisible();
      const isEnabled = await element.isEnabled();
      const boundingBox = await element.boundingBox();

      // Build selector
      let selector = fallbackSelector;
      if (id) {
        selector = `#${id}`;
      } else if (name) {
        selector = `[name="${name}"]`;
      } else if (ariaLabel) {
        selector = `[aria-label="${ariaLabel}"]`;
      }

      // Determine element type
      let elementType: DetectedElement['type'] = 'other';
      if (tagName === 'button' || type === 'button' || type === 'submit') {
        elementType = 'button';
      } else if (tagName === 'input') {
        if (type === 'checkbox') elementType = 'checkbox';
        else if (type === 'radio') elementType = 'radio';
        else elementType = 'input';
      } else if (tagName === 'a') {
        elementType = 'link';
      } else if (tagName === 'select') {
        elementType = 'select';
      } else if (tagName === 'textarea') {
        elementType = 'textarea';
      }

      return {
        selector,
        type: elementType,
        text: text.trim().slice(0, 100),
        placeholder: placeholder || undefined,
        name: name || undefined,
        id: id || undefined,
        ariaLabel: ariaLabel || undefined,
        isVisible,
        isEnabled,
        boundingBox,
      };
    } catch (error) {
      logger.debug('Failed to analyze element', { error });
      return null;
    }
  }
}

/**
 * Create a page analyzer for a given page
 */
export function createPageAnalyzer(page: Page): SmartPageAnalyzer {
  return new SmartPageAnalyzer(page);
}

