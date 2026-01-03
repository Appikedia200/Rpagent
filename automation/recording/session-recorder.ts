/**
 * @fileoverview Session Recording System
 * @module automation/recording/session-recorder
 * 
 * Record and replay browser automation sessions for debugging,
 * training, and workflow creation.
 */

import { Page } from 'playwright';
import { EventEmitter } from 'events';

export type RecordedEventType = 
  | 'click' | 'dblclick' | 'type' | 'keypress' | 'scroll'
  | 'navigate' | 'select' | 'check' | 'hover' | 'focus'
  | 'dragdrop' | 'screenshot' | 'wait' | 'assertion';

export interface RecordedEvent {
  id: string;
  type: RecordedEventType;
  timestamp: number;
  relativeTime: number;        // ms from session start
  selector?: string;
  xpath?: string;
  text?: string;
  value?: unknown;
  key?: string;
  modifiers?: string[];
  position?: { x: number; y: number };
  scrollDelta?: { x: number; y: number };
  url?: string;
  screenshot?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordedSession {
  id: string;
  name: string;
  description?: string;
  startUrl: string;
  events: RecordedEvent[];
  duration: number;
  browserInfo?: {
    name: string;
    version: string;
    viewport: { width: number; height: number };
  };
  createdAt: string;
  tags?: string[];
}

export interface RecordingOptions {
  captureScreenshots?: boolean;
  screenshotInterval?: number;   // ms
  captureNetwork?: boolean;
  captureConsole?: boolean;
  minTimeBetweenEvents?: number; // Debounce
  includeHover?: boolean;
  includeScroll?: boolean;
  selectorStrategy?: 'css' | 'xpath' | 'both';
}

const DEFAULT_OPTIONS: RecordingOptions = {
  captureScreenshots: false,
  screenshotInterval: 5000,
  captureNetwork: false,
  captureConsole: false,
  minTimeBetweenEvents: 50,
  includeHover: false,
  includeScroll: true,
  selectorStrategy: 'css',
};

export class SessionRecorder extends EventEmitter {
  private page: Page;
  private options: RecordingOptions;
  private recording = false;
  private session: RecordedSession | null = null;
  private startTime = 0;
  private lastEventTime = 0;
  private eventCounter = 0;
  private screenshotInterval?: ReturnType<typeof setInterval>;

  constructor(page: Page, options: RecordingOptions = {}) {
    super();
    this.page = page;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start recording
   */
  async start(name: string, description?: string): Promise<void> {
    if (this.recording) {
      throw new Error('Already recording');
    }

    this.recording = true;
    this.startTime = Date.now();
    this.lastEventTime = this.startTime;
    this.eventCounter = 0;

    this.session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      startUrl: this.page.url(),
      events: [],
      duration: 0,
      browserInfo: await this.getBrowserInfo(),
      createdAt: new Date().toISOString(),
      tags: [],
    };

    // Attach event listeners
    await this.attachListeners();

    // Start screenshot capture if enabled
    if (this.options.captureScreenshots) {
      this.screenshotInterval = setInterval(async () => {
        await this.captureScreenshot();
      }, this.options.screenshotInterval);
    }

    console.log(`[Recorder] Started recording: ${name}`);
    this.emit('started', this.session);
  }

  /**
   * Stop recording
   */
  async stop(): Promise<RecordedSession | null> {
    if (!this.recording || !this.session) {
      return null;
    }

    this.recording = false;
    this.session.duration = Date.now() - this.startTime;

    // Clear screenshot interval
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = undefined;
    }

    // Detach listeners
    await this.detachListeners();

    const finalSession = { ...this.session };
    console.log(`[Recorder] Stopped recording: ${finalSession.events.length} events captured`);
    
    this.emit('stopped', finalSession);
    return finalSession;
  }

  /**
   * Check if recording
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * Get current session
   */
  getSession(): RecordedSession | null {
    return this.session;
  }

  /**
   * Add a manual event
   */
  addEvent(event: Omit<RecordedEvent, 'id' | 'timestamp' | 'relativeTime'>): void {
    if (!this.recording || !this.session) return;
    
    const now = Date.now();
    const fullEvent: RecordedEvent = {
      id: `event_${++this.eventCounter}`,
      timestamp: now,
      relativeTime: now - this.startTime,
      ...event,
    };
    
    this.session.events.push(fullEvent);
    this.lastEventTime = now;
    this.emit('event', fullEvent);
  }

  /**
   * Attach event listeners to page
   */
  private async attachListeners(): Promise<void> {
    // Inject recording script
    await this.page.exposeFunction('__rpaRecordEvent', (event: Partial<RecordedEvent>) => {
      this.handleRecordedEvent(event);
    });

    await this.page.addInitScript(() => {
      const recordEvent = (window as any).__rpaRecordEvent;
      
      // Generate CSS selector for element
      function getSelector(element: Element): string {
        if (element.id) {
          return `#${element.id}`;
        }
        
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.split(' ').filter(c => c.trim());
          if (classes.length > 0) {
            const selector = `${element.tagName.toLowerCase()}.${classes.join('.')}`;
            if (document.querySelectorAll(selector).length === 1) {
              return selector;
            }
          }
        }
        
        // Use nth-child
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(element) + 1;
          const parentSelector = getSelector(parent);
          return `${parentSelector} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
        }
        
        return element.tagName.toLowerCase();
      }
      
      // Click handler
      document.addEventListener('click', (e) => {
        const target = e.target as Element;
        recordEvent({
          type: 'click',
          selector: getSelector(target),
          position: { x: e.clientX, y: e.clientY },
          text: (target as HTMLElement).innerText?.substring(0, 100),
        });
      }, true);
      
      // Double click handler
      document.addEventListener('dblclick', (e) => {
        const target = e.target as Element;
        recordEvent({
          type: 'dblclick',
          selector: getSelector(target),
          position: { x: e.clientX, y: e.clientY },
        });
      }, true);
      
      // Input handler
      let inputTimeout: any;
      document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => {
          recordEvent({
            type: 'type',
            selector: getSelector(target),
            value: target.type === 'password' ? '***' : target.value,
          });
        }, 300); // Debounce
      }, true);
      
      // Select handler
      document.addEventListener('change', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'SELECT') {
          recordEvent({
            type: 'select',
            selector: getSelector(target),
            value: (target as HTMLSelectElement).value,
          });
        } else if (target.tagName === 'INPUT') {
          const inputTarget = target as HTMLInputElement;
          if (inputTarget.type === 'checkbox' || inputTarget.type === 'radio') {
            recordEvent({
              type: 'check',
              selector: getSelector(target),
              value: inputTarget.checked,
            });
          }
        }
      }, true);
      
      // Scroll handler
      let scrollTimeout: any;
      document.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          recordEvent({
            type: 'scroll',
            scrollDelta: { x: window.scrollX, y: window.scrollY },
          });
        }, 200);
      }, true);
      
      // Keyboard handler for special keys
      document.addEventListener('keydown', (e) => {
        if (['Enter', 'Tab', 'Escape', 'Backspace', 'Delete'].includes(e.key)) {
          const target = e.target as Element;
          recordEvent({
            type: 'keypress',
            selector: getSelector(target),
            key: e.key,
            modifiers: [
              e.ctrlKey && 'ctrl',
              e.shiftKey && 'shift',
              e.altKey && 'alt',
              e.metaKey && 'meta',
            ].filter(Boolean) as string[],
          });
        }
      }, true);
    });

    // Navigation handler
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) {
        this.addEvent({
          type: 'navigate',
          url: frame.url(),
        });
      }
    });
  }

  /**
   * Handle recorded event from page
   */
  private handleRecordedEvent(event: Partial<RecordedEvent>): void {
    if (!this.recording || !this.session) return;
    
    const now = Date.now();
    
    // Debounce
    if (now - this.lastEventTime < (this.options.minTimeBetweenEvents || 50)) {
      return;
    }
    
    // Skip hover if not enabled
    if (event.type === 'hover' && !this.options.includeHover) {
      return;
    }
    
    // Skip scroll if not enabled
    if (event.type === 'scroll' && !this.options.includeScroll) {
      return;
    }
    
    const fullEvent: RecordedEvent = {
      id: `event_${++this.eventCounter}`,
      timestamp: now,
      relativeTime: now - this.startTime,
      type: event.type || 'click',
      ...event,
    };
    
    this.session.events.push(fullEvent);
    this.lastEventTime = now;
    this.emit('event', fullEvent);
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(): Promise<void> {
    if (!this.recording || !this.session) return;
    
    try {
      const screenshot = await this.page.screenshot({ 
        type: 'jpeg', 
        quality: 50,
        fullPage: false,
      });
      
      this.addEvent({
        type: 'screenshot',
        screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      });
    } catch (error) {
      console.error('[Recorder] Screenshot error:', error);
    }
  }

  /**
   * Detach event listeners
   */
  private async detachListeners(): Promise<void> {
    // Remove exposed function and listeners
    // Note: In practice, the init script persists, but stopping recording
    // prevents events from being captured
  }

  /**
   * Get browser info
   */
  private async getBrowserInfo(): Promise<RecordedSession['browserInfo']> {
    const viewport = this.page.viewportSize();
    return {
      name: 'Chromium',
      version: 'latest',
      viewport: viewport || { width: 1280, height: 720 },
    };
  }
}

/**
 * Session Player - Replay recorded sessions
 */
export class SessionPlayer extends EventEmitter {
  private page: Page;
  private session: RecordedSession;
  private playing = false;
  private paused = false;
  private currentEventIndex = 0;
  private playbackSpeed = 1;

  constructor(page: Page, session: RecordedSession) {
    super();
    this.page = page;
    this.session = session;
  }

  /**
   * Play the session
   */
  async play(speed: number = 1): Promise<void> {
    if (this.playing) return;
    
    this.playing = true;
    this.paused = false;
    this.playbackSpeed = speed;
    this.currentEventIndex = 0;
    
    console.log(`[Player] Playing session: ${this.session.name}`);
    this.emit('started');
    
    // Navigate to start URL
    await this.page.goto(this.session.startUrl);
    await this.page.waitForLoadState('networkidle');
    
    // Play events
    for (let i = 0; i < this.session.events.length; i++) {
      if (!this.playing) break;
      
      while (this.paused) {
        await this.sleep(100);
      }
      
      const event = this.session.events[i];
      const nextEvent = this.session.events[i + 1];
      
      this.currentEventIndex = i;
      this.emit('event', event, i);
      
      await this.playEvent(event);
      
      // Wait for relative timing
      if (nextEvent) {
        const delay = (nextEvent.relativeTime - event.relativeTime) / this.playbackSpeed;
        if (delay > 0 && delay < 30000) { // Cap at 30s
          await this.sleep(delay);
        }
      }
    }
    
    this.playing = false;
    console.log('[Player] Playback complete');
    this.emit('completed');
  }

  /**
   * Play a single event
   */
  private async playEvent(event: RecordedEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'click':
          if (event.selector) {
            await this.page.click(event.selector, { timeout: 5000 });
          } else if (event.position) {
            await this.page.mouse.click(event.position.x, event.position.y);
          }
          break;
          
        case 'dblclick':
          if (event.selector) {
            await this.page.dblclick(event.selector, { timeout: 5000 });
          }
          break;
          
        case 'type':
          if (event.selector && event.value) {
            await this.page.fill(event.selector, String(event.value));
          }
          break;
          
        case 'keypress':
          if (event.key) {
            await this.page.keyboard.press(event.key);
          }
          break;
          
        case 'select':
          if (event.selector && event.value) {
            await this.page.selectOption(event.selector, String(event.value));
          }
          break;
          
        case 'check':
          if (event.selector) {
            if (event.value) {
              await this.page.check(event.selector);
            } else {
              await this.page.uncheck(event.selector);
            }
          }
          break;
          
        case 'scroll':
          if (event.scrollDelta) {
            await this.page.evaluate(({ x, y }) => {
              window.scrollTo(x, y);
            }, event.scrollDelta);
          }
          break;
          
        case 'navigate':
          if (event.url) {
            await this.page.goto(event.url);
            await this.page.waitForLoadState('networkidle');
          }
          break;
          
        case 'hover':
          if (event.selector) {
            await this.page.hover(event.selector);
          }
          break;
          
        case 'wait':
          // Wait events are handled by timing
          break;
          
        case 'screenshot':
          // Skip screenshots during playback
          break;
      }
    } catch (error) {
      console.warn(`[Player] Event failed:`, event.type, error);
      this.emit('eventError', event, error);
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.paused = true;
    this.emit('paused');
  }

  /**
   * Resume playback
   */
  resume(): void {
    this.paused = false;
    this.emit('resumed');
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.playing = false;
    this.paused = false;
    this.emit('stopped');
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.1, Math.min(10, speed));
  }

  /**
   * Get current progress
   */
  getProgress(): { current: number; total: number; percent: number } {
    const total = this.session.events.length;
    return {
      current: this.currentEventIndex,
      total,
      percent: total > 0 ? (this.currentEventIndex / total) * 100 : 0,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convert recorded session to workflow steps
 */
export function sessionToWorkflow(session: RecordedSession): Array<{
  type: string;
  config: Record<string, unknown>;
}> {
  const steps: Array<{ type: string; config: Record<string, unknown> }> = [];
  
  // Add navigate step
  steps.push({
    type: 'NAVIGATE',
    config: { url: session.startUrl },
  });
  
  for (const event of session.events) {
    switch (event.type) {
      case 'click':
        if (event.selector) {
          steps.push({
            type: 'CLICK',
            config: { selector: event.selector },
          });
        }
        break;
        
      case 'type':
        if (event.selector && event.value) {
          steps.push({
            type: 'TYPE_TEXT',
            config: { selector: event.selector, text: String(event.value) },
          });
        }
        break;
        
      case 'select':
        if (event.selector && event.value) {
          steps.push({
            type: 'SELECT',
            config: { selector: event.selector, value: String(event.value) },
          });
        }
        break;
        
      case 'navigate':
        if (event.url) {
          steps.push({
            type: 'NAVIGATE',
            config: { url: event.url },
          });
        }
        break;
        
      case 'keypress':
        if (event.key === 'Enter') {
          steps.push({
            type: 'PRESS_KEY',
            config: { key: 'Enter' },
          });
        }
        break;
    }
  }
  
  return steps;
}

