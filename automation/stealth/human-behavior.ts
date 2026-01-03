/**
 * @fileoverview Human Behavior Simulation
 * @module automation/stealth/human-behavior
 *
 * Simulates realistic human behavior for anti-detection.
 * Based on research: "I'm not a human: Breaking the Google reCAPTCHA" (Sivakorn et al., 2016)
 */

import { Page } from 'playwright';
import BezierEasing from 'bezier-easing';
import { logger } from '../../electron/utils/logger';
import { APP_CONFIG } from '../../shared/constants/app-config';
import { moveCursorTo, showClickAnimation, showTypingIndicator } from '../browser-manager/blue-cursor';

/**
 * Human behavior simulation class
 */
export class HumanBehavior {
  private readonly page: Page;
  private mouseX: number = 0;
  private mouseY: number = 0;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Generate normally distributed random number
   */
  private normalRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z * stdDev + mean;
  }

  /**
   * Random delay within range (normal distribution)
   */
  private randomDelay(min: number, max: number): number {
    const mean = (min + max) / 2;
    const stdDev = (max - min) / 6;
    const delay = this.normalRandom(mean, stdDev);
    return Math.max(min, Math.min(max, delay));
  }

  /**
   * Wait for a human-like delay
   */
  async humanWait(minMs: number = 500, maxMs: number = 2000): Promise<void> {
    const delay = this.randomDelay(minMs, maxMs);
    await this.page.waitForTimeout(delay);
  }

  /**
   * Human-like typing with realistic delays and blue cursor indicator
   */
  async typeHumanLike(selector: string, text: string): Promise<void> {
    try {
      logger.debug('Human-like typing', { selector, length: text.length });

      // Bring page to front to ensure visible updates
      await this.page.bringToFront();
      await this.page.waitForTimeout(100);

      // Click to focus with slight delay
      await this.clickHumanLike(selector);
      await this.humanWait(300, 600);

      // Show typing indicator on blue cursor
      await showTypingIndicator(this.page, true);

      // Type each character with variable delays
      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Get keystroke delay based on character type
        let delay = this.getKeystrokeDelay(char, text[i - 1]);

        // Add variation
        delay = this.randomDelay(delay * 0.8, delay * 1.2);

        await this.page.keyboard.type(char);
        await this.page.waitForTimeout(delay);

        // Occasional typos and corrections (2% chance)
        if (Math.random() < 0.02 && i < text.length - 1) {
          await this.page.waitForTimeout(this.randomDelay(50, 150));
          await this.page.keyboard.press('Backspace');
          await this.page.waitForTimeout(this.randomDelay(100, 300));
        }

        // Occasional pauses for "thinking" (5% chance)
        if (Math.random() < 0.05) {
          await showTypingIndicator(this.page, false);
          await this.humanWait(500, 1500);
          await showTypingIndicator(this.page, true);
        }
      }

      // Turn off typing indicator
      await showTypingIndicator(this.page, false);

      logger.debug('Completed human-like typing');
    } catch (error) {
      await showTypingIndicator(this.page, false);
      logger.error('Human-like typing failed', { error, selector });
      throw error;
    }
  }

  /**
   * Get keystroke delay based on character patterns
   */
  private getKeystrokeDelay(currentChar: string, previousChar?: string): number {
    const baseDelay = APP_CONFIG.TYPING_BASE_DELAY;

    // Common bigram delays (based on typing research)
    const bigramDelays: Record<string, number> = {
      th: 80, he: 85, in: 90, er: 95, an: 100,
      re: 105, on: 95, at: 90, en: 100, nd: 110,
      ti: 95, es: 100, or: 95, te: 100, of: 90,
    };

    if (previousChar) {
      const bigram = (previousChar + currentChar).toLowerCase();
      if (bigramDelays[bigram]) {
        return bigramDelays[bigram];
      }
    }

    // Slower for shift key characters
    if (/[A-Z!@#$%^&*()_+{}|:"<>?]/.test(currentChar)) {
      return baseDelay * 1.3;
    }

    // Slower for numbers
    if (/[0-9]/.test(currentChar)) {
      return baseDelay * 1.1;
    }

    return baseDelay;
  }

  /**
   * Human-like mouse movement using Bezier curves
   * Now syncs with blue cursor indicator
   */
  async moveMouseHumanLike(targetX: number, targetY: number): Promise<void> {
    try {
      const steps = Math.floor(this.randomDelay(
        APP_CONFIG.MOUSE_MOVEMENT_STEPS_MIN,
        APP_CONFIG.MOUSE_MOVEMENT_STEPS_MAX
      ));
      
      const easing = BezierEasing(0.25, 0.1, 0.25, 1.0);

      // Generate control points for Bezier curve
      const cp1x = this.mouseX + (targetX - this.mouseX) * 0.25 + (Math.random() - 0.5) * 100;
      const cp1y = this.mouseY + (targetY - this.mouseY) * 0.25 + (Math.random() - 0.5) * 100;
      const cp2x = this.mouseX + (targetX - this.mouseX) * 0.75 + (Math.random() - 0.5) * 100;
      const cp2y = this.mouseY + (targetY - this.mouseY) * 0.75 + (Math.random() - 0.5) * 100;

      for (let i = 0; i <= steps; i++) {
        const t = easing(i / steps);

        // Cubic Bezier formula
        const x = Math.pow(1 - t, 3) * this.mouseX +
                  3 * Math.pow(1 - t, 2) * t * cp1x +
                  3 * (1 - t) * Math.pow(t, 2) * cp2x +
                  Math.pow(t, 3) * targetX;

        const y = Math.pow(1 - t, 3) * this.mouseY +
                  3 * Math.pow(1 - t, 2) * t * cp1y +
                  3 * (1 - t) * Math.pow(t, 2) * cp2y +
                  Math.pow(t, 3) * targetY;

        // Move both real mouse and blue cursor indicator
        await this.page.mouse.move(x, y);
        await moveCursorTo(this.page, x, y);

        // Variable speed (faster in middle, slower at start/end)
        const speed = Math.sin((i / steps) * Math.PI) * 10 + 5;
        await this.page.waitForTimeout(this.randomDelay(speed * 0.8, speed * 1.2));
      }

      this.mouseX = targetX;
      this.mouseY = targetY;
    } catch (error) {
      logger.error('Human-like mouse movement failed', { error, targetX, targetY });
      throw error;
    }
  }

  /**
   * Human-like click with movement and blue cursor animation
   */
  async clickHumanLike(selector: string): Promise<void> {
    try {
      // Bring page to front for visible updates
      await this.page.bringToFront();
      
      // Wait for element to be visible
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
      
      const element = await this.page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      const box = await element.boundingBox();
      if (!box) {
        throw new Error(`Element not visible: ${selector}`);
      }

      // Calculate random point within element (more towards center)
      const x = box.x + box.width * (0.3 + Math.random() * 0.4);
      const y = box.y + box.height * (0.3 + Math.random() * 0.4);

      // Move mouse humanistically (blue cursor follows)
      await this.moveMouseHumanLike(x, y);

      // Small pause before click
      await this.humanWait(50, 150);

      // Show click animation on blue cursor
      await showClickAnimation(this.page);

      // Perform actual click
      await this.page.mouse.click(x, y);

      // Small pause after click
      await this.humanWait(100, 300);

      logger.debug('Human-like click completed', { selector });
    } catch (error) {
      logger.error('Human-like click failed', { error, selector });
      throw error;
    }
  }

  /**
   * Human-like scrolling
   */
  async scrollHumanLike(direction: 'up' | 'down' = 'down'): Promise<void> {
    try {
      const scrollAmount = direction === 'down'
        ? this.normalRandom(APP_CONFIG.SCROLL_DISTANCE_MEAN, APP_CONFIG.SCROLL_DISTANCE_STD)
        : -this.normalRandom(APP_CONFIG.SCROLL_DISTANCE_MEAN, APP_CONFIG.SCROLL_DISTANCE_STD);

      const steps = Math.floor(this.randomDelay(5, 15));
      const stepAmount = scrollAmount / steps;

      for (let i = 0; i < steps; i++) {
        await this.page.evaluate((scroll: number) => {
          window.scrollBy({
            top: scroll,
            behavior: 'smooth',
          });
        }, stepAmount);

        await this.page.waitForTimeout(this.randomDelay(20, 80));
      }

      // Pause after scroll (reading)
      await this.humanWait(300, 1000);

      logger.debug('Human-like scroll completed', { direction });
    } catch (error) {
      logger.error('Human-like scroll failed', { error, direction });
      throw error;
    }
  }

  /**
   * Simulate reading behavior
   */
  async simulateReading(): Promise<void> {
    try {
      const actions = Math.floor(this.randomDelay(2, 4));

      for (let i = 0; i < actions; i++) {
        const action = Math.floor(Math.random() * 4);

        switch (action) {
          case 0: // Small scroll
            await this.scrollHumanLike(Math.random() > 0.5 ? 'down' : 'up');
            break;

          case 1: // Mouse movement
            const x = Math.random() * 1920;
            const y = Math.random() * 1080;
            await this.moveMouseHumanLike(x, y);
            break;

          case 2: // Reading pause
            await this.humanWait(2000, 5000);
            break;

          case 3: // Hover over element
            const elements = await this.page.$$('a, button, input');
            if (elements.length > 0) {
              const randomElement = elements[Math.floor(Math.random() * elements.length)];
              const box = await randomElement.boundingBox();
              if (box) {
                await this.moveMouseHumanLike(
                  box.x + box.width / 2,
                  box.y + box.height / 2
                );
                await this.humanWait(500, 1500);
              }
            }
            break;
        }
      }

      logger.debug('Reading simulation completed');
    } catch (error) {
      logger.error('Reading simulation failed', { error });
      throw error;
    }
  }

  /**
   * Random behavior (looks more human)
   */
  async randomBehavior(): Promise<void> {
    const behaviors = [
      () => this.scrollHumanLike('down'),
      () => this.scrollHumanLike('up'),
      () => this.moveMouseHumanLike(
        this.randomDelay(100, 1000),
        this.randomDelay(100, 800)
      ),
      () => this.humanWait(500, 2000),
    ];

    const count = Math.floor(this.randomDelay(1, 3));
    for (let i = 0; i < count; i++) {
      const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
      await behavior();
    }
  }
}

