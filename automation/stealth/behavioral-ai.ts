/**
 * @fileoverview Behavioral AI - Human-like Behavior Simulation
 * @module automation/stealth/behavioral-ai
 *
 * Implements research-grade human behavior simulation including:
 * - Bezier curve mouse movements
 * - Natural typing patterns with errors
 * - Micro-pauses and hesitations
 * - Scroll behavior patterns
 * - Click timing variations
 */

import { Page, ElementHandle } from 'playwright';
import BezierEasing from 'bezier-easing';
import { jStat } from 'jstat';

/**
 * Behavioral configuration options
 */
interface BehavioralConfig {
  typingSpeed: {
    min: number;
    max: number;
    errorRate: number;
  };
  mouse: {
    speed: number;
    jitter: number;
    overshoot: boolean;
  };
  scroll: {
    speed: number;
    smoothness: number;
  };
  delays: {
    click: { min: number; max: number };
    between: { min: number; max: number };
  };
}

const DEFAULT_CONFIG: BehavioralConfig = {
  typingSpeed: {
    min: 50,
    max: 150,
    errorRate: 0.02,
  },
  mouse: {
    speed: 1.0,
    jitter: 2,
    overshoot: true,
  },
  scroll: {
    speed: 1.0,
    smoothness: 0.8,
  },
  delays: {
    click: { min: 50, max: 150 },
    between: { min: 100, max: 500 },
  },
};

/**
 * BehavioralAI class for human-like behavior simulation
 */
export class BehavioralAI {
  private page: Page;
  private config: BehavioralConfig;
  private lastMousePosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(page: Page, config: Partial<BehavioralConfig> = {}) {
    this.page = page;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Type text with human-like patterns
   */
  async typeText(text: string, options: { 
    element?: ElementHandle | string;
    mistakes?: boolean;
  } = {}): Promise<void> {
    const { element, mistakes = true } = options;

    // Focus element if provided
    if (element) {
      if (typeof element === 'string') {
        await this.page.click(element);
      } else {
        await element.click();
      }
      await this.randomDelay(100, 300);
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Simulate occasional typos
      if (mistakes && Math.random() < this.config.typingSpeed.errorRate) {
        const wrongChar = this.getAdjacentKey(char);
        await this.page.keyboard.type(wrongChar);
        await this.randomDelay(100, 200);
        await this.page.keyboard.press('Backspace');
        await this.randomDelay(50, 100);
      }

      // Type the character
      await this.page.keyboard.type(char);

      // Variable delay between keystrokes
      const delay = this.getTypingDelay(char, text[i + 1]);
      await this.randomDelay(delay * 0.8, delay * 1.2);

      // Occasional pause mid-typing
      if (Math.random() < 0.05) {
        await this.randomDelay(200, 500);
      }
    }
  }

  /**
   * Move mouse along a natural bezier curve
   */
  async moveMouse(
    targetX: number,
    targetY: number,
    options: { steps?: number; overshoot?: boolean } = {}
  ): Promise<void> {
    const { steps = 25, overshoot = this.config.mouse.overshoot } = options;
    const { x: startX, y: startY } = this.lastMousePosition;

    // Calculate distance
    const distance = Math.sqrt(
      Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2)
    );

    // Generate bezier control points for natural curve
    const controlPoints = this.generateControlPoints(
      startX, startY, targetX, targetY
    );

    // Create bezier easing function
    const easing = BezierEasing(
      controlPoints.cp1x,
      controlPoints.cp1y,
      controlPoints.cp2x,
      controlPoints.cp2y
    );

    // Add overshoot if enabled
    let finalX = targetX;
    let finalY = targetY;
    if (overshoot && distance > 100) {
      const overshootAmount = Math.min(distance * 0.1, 20);
      finalX = targetX + (Math.random() - 0.5) * overshootAmount;
      finalY = targetY + (Math.random() - 0.5) * overshootAmount;
    }

    // Animate movement
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const easedT = easing(t);

      const x = startX + (finalX - startX) * easedT;
      const y = startY + (finalY - startY) * easedT;

      // Add jitter
      const jitterX = (Math.random() - 0.5) * this.config.mouse.jitter;
      const jitterY = (Math.random() - 0.5) * this.config.mouse.jitter;

      await this.page.mouse.move(x + jitterX, y + jitterY);

      // Variable speed based on position in curve
      const delay = this.calculateMouseDelay(t, distance);
      await this.sleep(delay);
    }

    // Correct overshoot
    if (overshoot && (finalX !== targetX || finalY !== targetY)) {
      await this.sleep(50);
      await this.page.mouse.move(targetX, targetY);
    }

    this.lastMousePosition = { x: targetX, y: targetY };
  }

  /**
   * Click with human-like behavior
   */
  async click(
    target: string | ElementHandle | { x: number; y: number },
    options: { button?: 'left' | 'right'; doubleClick?: boolean } = {}
  ): Promise<void> {
    const { button = 'left', doubleClick = false } = options;

    // Get target position
    let position: { x: number; y: number };

    if (typeof target === 'string') {
      const element = await this.page.$(target);
      if (!element) throw new Error(`Element not found: ${target}`);
      const box = await element.boundingBox();
      if (!box) throw new Error(`Element not visible: ${target}`);
      position = {
        x: box.x + box.width * (0.3 + Math.random() * 0.4),
        y: box.y + box.height * (0.3 + Math.random() * 0.4),
      };
    } else if ('x' in target && 'y' in target) {
      position = target;
    } else {
      const box = await (target as ElementHandle).boundingBox();
      if (!box) throw new Error('Element not visible');
      position = {
        x: box.x + box.width * (0.3 + Math.random() * 0.4),
        y: box.y + box.height * (0.3 + Math.random() * 0.4),
      };
    }

    // Move mouse to target
    await this.moveMouse(position.x, position.y);

    // Pre-click delay
    await this.randomDelay(
      this.config.delays.click.min,
      this.config.delays.click.max
    );

    // Perform click
    if (doubleClick) {
      await this.page.mouse.dblclick(position.x, position.y, { button });
    } else {
      await this.page.mouse.click(position.x, position.y, { button });
    }

    // Post-click delay
    await this.randomDelay(50, 150);
  }

  /**
   * Scroll with natural behavior
   */
  async scroll(
    deltaY: number,
    options: { smooth?: boolean; element?: string } = {}
  ): Promise<void> {
    const { smooth = true } = options;

    if (smooth) {
      const steps = Math.abs(deltaY) / 100;
      const stepDelta = deltaY / steps;

      for (let i = 0; i < steps; i++) {
        // Use normal distribution for natural scroll variation
        const variation = jStat.normal.sample(1, 0.1) as number;
        const actualDelta = stepDelta * variation;

        await this.page.mouse.wheel(0, actualDelta);
        await this.randomDelay(16, 32); // ~30-60 FPS
      }
    } else {
      await this.page.mouse.wheel(0, deltaY);
    }
  }

  /**
   * Wait for a random human-like pause
   */
  async humanPause(reason: 'reading' | 'thinking' | 'deciding' = 'reading'): Promise<void> {
    const delays = {
      reading: { min: 500, max: 2000 },
      thinking: { min: 1000, max: 3000 },
      deciding: { min: 200, max: 800 },
    };

    const { min, max } = delays[reason];
    await this.randomDelay(min, max);
  }

  /**
   * Generate natural bezier control points
   */
  private generateControlPoints(
    _startX: number,
    _startY: number,
    _endX: number,
    _endY: number
  ): { cp1x: number; cp1y: number; cp2x: number; cp2y: number } {
    // Randomize control points for natural curve
    const cp1x = 0.1 + Math.random() * 0.3;
    const cp1y = 0.2 + Math.random() * 0.4;
    const cp2x = 0.6 + Math.random() * 0.3;
    const cp2y = 0.8 + Math.random() * 0.2;

    return { cp1x, cp1y, cp2x, cp2y };
  }

  /**
   * Calculate mouse movement delay based on position
   */
  private calculateMouseDelay(t: number, distance: number): number {
    // Faster in the middle, slower at start/end
    const speedFactor = 4 * t * (1 - t) + 0.2;
    const baseDelay = Math.max(5, distance / 500);
    return baseDelay / speedFactor / this.config.mouse.speed;
  }

  /**
   * Get typing delay based on character context
   */
  private getTypingDelay(currentChar: string, nextChar?: string): number {
    let baseDelay = jStat.normal.sample(
      (this.config.typingSpeed.min + this.config.typingSpeed.max) / 2,
      20
    ) as number;

    // Slower for special characters
    if (!/[a-zA-Z0-9]/.test(currentChar)) {
      baseDelay *= 1.5;
    }

    // Slower after space (new word)
    if (currentChar === ' ') {
      baseDelay *= 1.3;
    }

    // Brief pause before uppercase (shift key)
    if (nextChar && /[A-Z]/.test(nextChar)) {
      baseDelay *= 1.2;
    }

    return Math.max(
      this.config.typingSpeed.min,
      Math.min(this.config.typingSpeed.max * 2, baseDelay)
    );
  }

  /**
   * Get adjacent key for simulating typos
   */
  private getAdjacentKey(char: string): string {
    const keyboard = [
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];

    const lowerChar = char.toLowerCase();
    for (let row = 0; row < keyboard.length; row++) {
      const col = keyboard[row].indexOf(lowerChar);
      if (col !== -1) {
        const adjacent: string[] = [];
        if (col > 0) adjacent.push(keyboard[row][col - 1]);
        if (col < keyboard[row].length - 1) adjacent.push(keyboard[row][col + 1]);
        if (row > 0 && keyboard[row - 1][col]) adjacent.push(keyboard[row - 1][col]);
        if (row < keyboard.length - 1 && keyboard[row + 1][col]) {
          adjacent.push(keyboard[row + 1][col]);
        }
        if (adjacent.length > 0) {
          const wrongChar = adjacent[Math.floor(Math.random() * adjacent.length)];
          return char === char.toUpperCase() ? wrongChar.toUpperCase() : wrongChar;
        }
      }
    }
    return char;
  }

  /**
   * Random delay with normal distribution
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const mean = (min + max) / 2;
    const stdDev = (max - min) / 6;
    const sampleValue = jStat.normal.sample(mean, stdDev) as number;
    const delay = Math.max(min, Math.min(max, sampleValue));
    await this.sleep(delay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
