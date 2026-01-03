/**
 * @fileoverview Direct Task Command Parser
 * @module automation/workflow-parser/command-parser
 *
 * Parses natural language commands into structured workflow steps.
 * Uses pattern matching (NOT AI) for direct task execution.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  WorkflowStep, 
  WorkflowStepType,
  ParsedCommand,
} from '../../shared/types/workflow.types';
import { logger } from '../../electron/utils/logger';

/**
 * Command pattern definition
 */
interface CommandPattern {
  patterns: RegExp[];
  stepType: WorkflowStepType;
  configExtractor: (match: RegExpMatchArray, fullText: string) => Record<string, unknown>;
  description: (match: RegExpMatchArray) => string;
}

/**
 * Command parsing error
 */
export class CommandParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandParseError';
  }
}

/**
 * Word to number mapping
 */
const WORD_TO_NUMBER: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1,
  two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, hundred: 100,
};

/**
 * Direct task command parser
 * Converts natural language commands to workflow steps
 */
export class CommandParser {
  private patterns: CommandPattern[];

  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * Convert word number to digit
   */
  private wordToNumber(word: string): number | null {
    const normalized = word.toLowerCase().trim();
    if (WORD_TO_NUMBER[normalized] !== undefined) {
      return WORD_TO_NUMBER[normalized];
    }
    // Try parsing as digit
    const num = parseInt(normalized, 10);
    if (!isNaN(num)) {
      return num;
    }
    return null;
  }

  /**
   * Initialize command patterns
   */
  private initializePatterns(): CommandPattern[] {
    return [
      // Browser count pattern
      {
        patterns: [
          /create\s+(\d+)\s+browsers?/i,
          /open\s+(\d+)\s+browsers?/i,
          /launch\s+(\d+)\s+browsers?/i,
          /start\s+(\d+)\s+browsers?/i,
        ],
        stepType: WorkflowStepType.WAIT, // Placeholder - handled separately
        configExtractor: () => ({}),
        description: () => 'Create browsers',
      },

      // Navigation patterns
      {
        patterns: [
          /(?:navigate|go|visit|open)\s+(?:to\s+)?(?:the\s+)?(?:url\s+)?['"]?([^\s'"]+)['"]?/i,
          /(?:navigate|go|visit|open)\s+(?:to\s+)?(?:the\s+)?(?:website\s+)?['"]?([^\s'"]+)['"]?/i,
        ],
        stepType: WorkflowStepType.NAVIGATE,
        configExtractor: (match) => ({
          url: this.normalizeUrl(match[1]),
          waitUntil: 'networkidle',
        }),
        description: (match) => `Navigate to ${match[1]}`,
      },

      // Click patterns
      {
        patterns: [
          /click\s+(?:on\s+)?(?:the\s+)?['"]?([^'"]+)['"]?\s+button/i,
          /click\s+(?:on\s+)?(?:the\s+)?button\s+['"]?([^'"]+)['"]?/i,
          /click\s+(?:on\s+)?(?:the\s+)?['"]?([^'"]+)['"]?/i,
          /press\s+(?:the\s+)?['"]?([^'"]+)['"]?\s+button/i,
        ],
        stepType: WorkflowStepType.CLICK,
        configExtractor: (match) => ({
          selector: this.textToSelector(match[1]),
        }),
        description: (match) => `Click ${match[1]}`,
      },

      // Type/Input patterns
      {
        patterns: [
          /type\s+['"]([^'"]+)['"]\s+(?:in|into)\s+(?:the\s+)?([^\s]+)/i,
          /enter\s+['"]([^'"]+)['"]\s+(?:in|into)\s+(?:the\s+)?([^\s]+)/i,
          /input\s+['"]([^'"]+)['"]\s+(?:in|into)\s+(?:the\s+)?([^\s]+)/i,
          /fill\s+(?:the\s+)?([^\s]+)\s+with\s+['"]([^'"]+)['"]/i,
        ],
        stepType: WorkflowStepType.TYPE_TEXT,
        configExtractor: (match) => {
          // Handle both patterns: "type X in Y" and "fill Y with X"
          const isReversed = match[0].toLowerCase().startsWith('fill');
          return {
            selector: this.textToSelector(isReversed ? match[1] : match[2]),
            text: isReversed ? match[2] : match[1],
          };
        },
        description: (_match) => `Type text`,
      },

      // Form filling patterns
      {
        patterns: [
          /(?:fill|complete)\s+(?:the\s+)?(?:signup|sign[\s-]?up|registration)\s+form/i,
          /(?:fill|complete)\s+(?:the\s+)?(?:login|sign[\s-]?in)\s+form/i,
          /(?:fill|complete)\s+(?:the\s+)?form/i,
        ],
        stepType: WorkflowStepType.FILL_FORM,
        configExtractor: () => ({
          fields: [],
        }),
        description: () => 'Fill form',
      },

      // Gmail/Google account creation - uses dedicated workflow
      // Also matches when user mentions gmail/google anywhere in command context
      {
        patterns: [
          /create\s+(?:an?\s+)?(?:new\s+)?(?:gmail|google)\s+account/i,
          /create\s+(?:an?\s+)?account\s+(?:on|with|for)\s+(?:gmail|google)/i,
          /(?:gmail|google)\s+account\s+creation/i,
          /sign\s*up\s+(?:on|for|with)\s+(?:gmail|google)/i,
          // Match "create account" when gmail.com is mentioned anywhere in the command
          /create\s+(?:an?\s+)?(?:new\s+)?account.*(?=.*gmail)/i,
        ],
        stepType: WorkflowStepType.EXECUTE_SCRIPT,
        configExtractor: () => ({
          workflow: 'gmail_signup',
          description: 'Create Gmail account with random details',
        }),
        description: () => 'Create Gmail account with random details',
      },

      // Generic account creation - ONLY for non-Gmail sites
      {
        patterns: [
          /register\s+(?:new\s+)?(?:on|with|at)\s+(?!gmail|google)/i,
          /sign\s*up\s+(?:on|with|at)\s+(?!gmail|google)/i,
        ],
        stepType: WorkflowStepType.FILL_FORM,
        configExtractor: () => ({
          fields: [
            { selector: 'input[name="firstName"], input[id*="first"], input[placeholder*="First"]', value: '{{randomFirstName}}' },
            { selector: 'input[name="lastName"], input[id*="last"], input[placeholder*="Last"]', value: '{{randomLastName}}' },
            { selector: 'input[type="email"], input[name="email"], input[id*="email"]', value: '{{randomEmail}}' },
            { selector: 'input[type="password"], input[name="password"]', value: '{{randomPassword}}' },
          ],
          useRandomData: true,
        }),
        description: () => 'Create account with random details',
      },

      // YouTube channel creation - uses dedicated workflow
      {
        patterns: [
          /create\s+(?:a\s+)?(?:new\s+)?(?:youtube|yt)\s+channel/i,
        ],
        stepType: WorkflowStepType.EXECUTE_SCRIPT,
        configExtractor: () => ({
          workflow: 'youtube_channel',
          description: 'Create YouTube channel',
        }),
        description: () => 'Create YouTube channel',
      },

      // Watch video pattern
      {
        patterns: [
          /watch\s+(?:the\s+)?(?:video\s+)?(?:at\s+)?['"]?([^\s'"]+)['"]?\s+(?:for\s+)?(\d+)\s*(?:min(?:ute)?s?|m)/i,
          /watch\s+['"]?([^\s'"]+)['"]?\s+(?:for\s+)?(\d+)\s*(?:min(?:ute)?s?|m)/i,
        ],
        stepType: WorkflowStepType.EXECUTE_SCRIPT,
        configExtractor: (match) => ({
          workflow: 'watch_video',
          videoUrl: match[1],
          durationMinutes: parseInt(match[2], 10),
        }),
        description: (match) => `Watch video for ${match[2]} minutes`,
      },

      // Like video pattern
      {
        patterns: [
          /like\s+(?:the\s+)?(?:video|this)/i,
        ],
        stepType: WorkflowStepType.EXECUTE_SCRIPT,
        configExtractor: () => ({
          workflow: 'like_video',
          script: `
            const likeButton = document.querySelector('button[aria-label*="like"]');
            if (likeButton) likeButton.click();
          `,
        }),
        description: () => 'Like video',
      },

      // Subscribe pattern
      {
        patterns: [
          /subscribe\s+(?:to\s+)?(?:the\s+)?(?:channel)?/i,
        ],
        stepType: WorkflowStepType.EXECUTE_SCRIPT,
        configExtractor: () => ({
          workflow: 'subscribe_channel',
          script: `
            const subButton = document.querySelector('button[aria-label*="Subscribe"]');
            if (subButton) subButton.click();
          `,
        }),
        description: () => 'Subscribe to channel',
      },

      // Post comment pattern
      {
        patterns: [
          /(?:post|leave|write)\s+(?:a\s+)?comment\s+['"]([^'"]+)['"]/i,
          /comment\s+['"]([^'"]+)['"]/i,
        ],
        stepType: WorkflowStepType.EXECUTE_SCRIPT,
        configExtractor: (match) => ({
          workflow: 'post_comment',
          comment: match[1],
        }),
        description: () => 'Post comment',
      },

      // Wait patterns
      {
        patterns: [
          /wait\s+(?:for\s+)?(\d+)\s*(?:ms|milliseconds?|seconds?|s)?/i,
          /pause\s+(?:for\s+)?(\d+)\s*(?:ms|milliseconds?|seconds?|s)?/i,
          /delay\s+(?:for\s+)?(\d+)\s*(?:ms|milliseconds?|seconds?|s)?/i,
        ],
        stepType: WorkflowStepType.WAIT,
        configExtractor: (match, fullText) => {
          let duration = parseInt(match[1], 10);
          // Convert seconds to ms if needed
          if (/seconds?|s\b/i.test(fullText)) {
            duration *= 1000;
          }
          return { duration };
        },
        description: (match) => `Wait ${match[1]}`,
      },

      // Wait for selector patterns
      {
        patterns: [
          /wait\s+(?:for|until)\s+(?:the\s+)?(?:element\s+)?['"]([^'"]+)['"]/i,
          /wait\s+(?:for|until)\s+(?:the\s+)?([^\s]+)\s+(?:appears?|shows?|loads?)/i,
        ],
        stepType: WorkflowStepType.WAIT_FOR_SELECTOR,
        configExtractor: (match) => ({
          selector: this.textToSelector(match[1]),
          timeout: 30000,
        }),
        description: (match) => `Wait for ${match[1]}`,
      },

      // Scroll patterns
      {
        patterns: [
          /scroll\s+(down|up)/i,
          /scroll\s+(?:to\s+)?(?:the\s+)?(bottom|top)/i,
        ],
        stepType: WorkflowStepType.SCROLL,
        configExtractor: (match) => {
          const direction = match[1].toLowerCase();
          return {
            direction: direction === 'up' || direction === 'top' ? 'up' : 'down',
            amount: direction === 'bottom' || direction === 'top' ? 10000 : 500,
          };
        },
        description: (match) => `Scroll ${match[1]}`,
      },

      // Screenshot patterns
      {
        patterns: [
          /(?:take|capture)\s+(?:a\s+)?screenshot/i,
          /screenshot/i,
        ],
        stepType: WorkflowStepType.SCREENSHOT,
        configExtractor: () => ({
          fullPage: false,
        }),
        description: () => 'Take screenshot',
      },

      // Extract data patterns
      {
        patterns: [
          /extract\s+(?:the\s+)?(?:data|text|content)\s+from\s+['"]?([^'"]+)['"]?/i,
          /get\s+(?:the\s+)?(?:data|text|content)\s+from\s+['"]?([^'"]+)['"]?/i,
          /scrape\s+['"]?([^'"]+)['"]?/i,
        ],
        stepType: WorkflowStepType.EXTRACT,
        configExtractor: (match) => ({
          data: [{
            name: 'extracted',
            selector: this.textToSelector(match[1]),
          }],
        }),
        description: (match) => `Extract data from ${match[1]}`,
      },

      // Execute script patterns
      {
        patterns: [
          /(?:run|execute)\s+(?:the\s+)?script\s+['"]([^'"]+)['"]/i,
          /(?:run|execute)\s+(?:javascript|js)\s*:\s*['"]?([^'"]+)['"]?/i,
        ],
        stepType: WorkflowStepType.EXECUTE_SCRIPT,
        configExtractor: (match) => ({
          script: match[1],
        }),
        description: () => 'Execute script',
      },

      // Key press patterns
      {
        patterns: [
          /press\s+(?:the\s+)?(?:key\s+)?(?:['"])?(\w+)(?:['"])?/i,
          /hit\s+(?:the\s+)?(?:key\s+)?(?:['"])?(\w+)(?:['"])?/i,
        ],
        stepType: WorkflowStepType.PRESS_KEY,
        configExtractor: (match) => ({
          key: this.normalizeKey(match[1]),
        }),
        description: (match) => `Press ${match[1]}`,
      },

      // Hover patterns
      {
        patterns: [
          /hover\s+(?:over\s+)?(?:the\s+)?['"]?([^'"]+)['"]?/i,
          /mouse\s+over\s+(?:the\s+)?['"]?([^'"]+)['"]?/i,
        ],
        stepType: WorkflowStepType.HOVER,
        configExtractor: (match) => ({
          selector: this.textToSelector(match[1]),
        }),
        description: (match) => `Hover over ${match[1]}`,
      },
    ];
  }

  /**
   * Parse command into workflow structure
   */
  parse(userInput: string): ParsedCommand {
    const startTime = Date.now();

    try {
      logger.info('Parsing command', { length: userInput.length });

      // Split by comma, newline, "and then", "then", and standalone "and"
      const lines = userInput
        .split(/[,\n]|(?:\s+and\s+then\s+)|(?:\s+then\s+)|(?:\s+and\s+(?=create|open|launch|visit|go|navigate|click|type|fill|wait|scroll|press|hover|extract))/i)
        .map(l => l.trim())
        .filter(Boolean);

      const steps: WorkflowStep[] = [];
      let browsers = 1;
      const dataSource: Record<string, unknown[]> = {};

      // Detect if Gmail is mentioned anywhere in the command
      const isGmailContext = /gmail|google\s*account/i.test(userInput);
      const hasAccountCreation = /create\s+(?:an?\s+)?(?:new\s+)?account/i.test(userInput);
      
      for (const line of lines) {
        // Skip gmail.com navigation if we're doing Gmail account creation
        // (the gmail_signup workflow handles navigation itself)
        if (isGmailContext && hasAccountCreation && /(?:visit|navigate|go|open).*gmail\.com/i.test(line)) {
          logger.debug('Skipping gmail.com navigation - gmail_signup workflow handles it');
          continue;
        }
        // Check for simple browser launch commands first (no count specified)
        // "launch browser", "open browser", "start browser", "create browser"
        const simpleBrowserMatch = line.match(/^(?:create|open|launch|start)\s+(?:a\s+)?(?:new\s+)?browsers?$/i);
        if (simpleBrowserMatch) {
          browsers = Math.max(browsers, 1); // At least 1 browser
          logger.debug('Simple browser launch command', { browsers: 1 });
          continue;
        }

        // Check for browser count (supports both digits and words like "three", "a", "an")
        const browserMatch = line.match(/(?:create|open|launch|start)\s+(\w+)\s+(?:new\s+)?browsers?/i);
        if (browserMatch) {
          const count = this.wordToNumber(browserMatch[1]);
          if (count !== null) {
            browsers = Math.min(100, Math.max(1, count));
            logger.debug('Browser count set', { browsers, from: browserMatch[1] });
            continue;
          }
        }
        
        // Handle "launch X browser" without 's' (singular)
        const singleBrowserMatch = line.match(/(?:create|open|launch|start)\s+(\d+)\s+browser(?!s)/i);
        if (singleBrowserMatch) {
          browsers = Math.min(100, Math.max(1, parseInt(singleBrowserMatch[1])));
          logger.debug('Single browser count', { browsers });
          continue;
        }

        // Check for workspace count (alias)
        const workspaceMatch = line.match(/(?:create|open)\s+(\w+)\s+workspaces?/i);
        if (workspaceMatch) {
          const count = this.wordToNumber(workspaceMatch[1]);
          if (count !== null) {
            browsers = Math.min(100, Math.max(1, count));
            continue;
          }
        }

        // Special handling: if Gmail is in context and user says "create account", use gmail workflow
        if (isGmailContext && /create\s+(?:an?\s+)?(?:new\s+)?account/i.test(line)) {
          logger.info('Gmail context detected, using gmail_signup workflow');
          steps.push({
            id: uuidv4(),
            type: WorkflowStepType.EXECUTE_SCRIPT,
            description: 'Create Gmail account with random details',
            config: { workflow: 'gmail_signup' },
            enabled: true,
          });
          continue;
        }

        // Try to match against patterns
        const step = this.matchPattern(line);
        if (step) {
          steps.push(step);
        } else {
          logger.debug('Unmatched command line', { line });
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Command parsed', {
        browsers,
        stepCount: steps.length,
        duration,
      });

      return {
        browsers,
        steps,
        dataSource: Object.keys(dataSource).length > 0 ? dataSource : undefined,
        rawCommand: userInput,
      };
    } catch (error) {
      logger.error('Command parsing failed', { error, userInput });
      throw new CommandParseError(
        `Failed to parse command: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Match a line against patterns
   */
  private matchPattern(line: string): WorkflowStep | null {
    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = line.match(regex);
        if (match) {
          return {
            id: uuidv4(),
            type: pattern.stepType,
            description: pattern.description(match),
            config: pattern.configExtractor(match, line),
            enabled: true,
          };
        }
      }
    }
    return null;
  }

  /**
   * Normalize URL (add protocol if missing)
   */
  private normalizeUrl(url: unknown): string {
    // Safety check - ensure we have a string
    if (url === null || url === undefined) {
      return 'https://google.com';
    }
    
    // If it's an object, try to extract URL or convert to string
    if (typeof url === 'object') {
      logger.warn('normalizeUrl received object instead of string', { url });
      // Try to find a url property
      const urlObj = url as Record<string, unknown>;
      if (urlObj.url && typeof urlObj.url === 'string') {
        url = urlObj.url;
      } else {
        return 'https://google.com';
      }
    }
    
    // Ensure it's a string
    let urlStr = String(url).trim();
    
    // Remove any [object Object] artifacts
    if (urlStr.includes('[object') || urlStr.includes('Object]')) {
      logger.error('URL contains object artifact, using default', { urlStr });
      return 'https://google.com';
    }
    
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      return `https://${urlStr}`;
    }
    return urlStr;
  }

  /**
   * Convert text description to CSS selector
   */
  private textToSelector(text: string): string {
    text = text.trim().toLowerCase();

    // Common element mappings
    const elementMappings: Record<string, string> = {
      'submit': 'button[type="submit"], input[type="submit"]',
      'submit button': 'button[type="submit"], input[type="submit"]',
      'login button': 'button:has-text("Login"), button:has-text("Sign in")',
      'sign in': 'button:has-text("Sign in"), a:has-text("Sign in")',
      'sign up': 'button:has-text("Sign up"), a:has-text("Sign up")',
      'create account': 'button:has-text("Create"), a:has-text("Create account")',
      'email': 'input[type="email"], input[name="email"], input[id*="email"]',
      'email field': 'input[type="email"], input[name="email"]',
      'password': 'input[type="password"], input[name="password"]',
      'password field': 'input[type="password"]',
      'username': 'input[name="username"], input[id*="username"], input[name="user"]',
      'username field': 'input[name="username"]',
      'search': 'input[type="search"], input[name="q"], input[name="search"]',
      'search box': 'input[type="search"], input[name="q"]',
      'first name': 'input[name="firstName"], input[name="first_name"], input[id*="first"]',
      'last name': 'input[name="lastName"], input[name="last_name"], input[id*="last"]',
      'phone': 'input[type="tel"], input[name="phone"]',
      'next': 'button:has-text("Next"), button:has-text("Continue")',
      'continue': 'button:has-text("Continue"), button:has-text("Next")',
      'accept': 'button:has-text("Accept"), button:has-text("Agree")',
      'close': 'button:has-text("Close"), button[aria-label="Close"]',
    };

    if (elementMappings[text]) {
      return elementMappings[text];
    }

    // Check if it's already a selector
    if (text.startsWith('.') || text.startsWith('#') || text.startsWith('[')) {
      return text;
    }

    // Try to create a reasonable selector
    // Check for ID pattern
    if (text.includes('id=') || text.includes('#')) {
      const idMatch = text.match(/(?:id=|#)([^\s]+)/);
      if (idMatch) {
        return `#${idMatch[1]}`;
      }
    }

    // Check for class pattern
    if (text.includes('class=') || text.includes('.')) {
      const classMatch = text.match(/(?:class=|\.)([^\s]+)/);
      if (classMatch) {
        return `.${classMatch[1]}`;
      }
    }

    // Default to text-based selector
    return `text="${text}"`;
  }

  /**
   * Normalize key name
   */
  private normalizeKey(key: string): string {
    const keyMappings: Record<string, string> = {
      'enter': 'Enter',
      'return': 'Enter',
      'tab': 'Tab',
      'escape': 'Escape',
      'esc': 'Escape',
      'space': 'Space',
      'backspace': 'Backspace',
      'delete': 'Delete',
      'up': 'ArrowUp',
      'down': 'ArrowDown',
      'left': 'ArrowLeft',
      'right': 'ArrowRight',
      'home': 'Home',
      'end': 'End',
      'pageup': 'PageUp',
      'pagedown': 'PageDown',
    };

    const normalized = key.toLowerCase();
    return keyMappings[normalized] || key;
  }

  /**
   * Get suggestions for incomplete commands
   */
  getSuggestions(partialCommand: string): string[] {
    const suggestions: string[] = [];
    const lower = partialCommand.toLowerCase().trim();

    const commandTemplates = [
      'Create 5 browsers',
      'Navigate to https://example.com',
      'Click the "Login" button',
      'Type "username" in email field',
      'Fill the signup form',
      'Wait 2 seconds',
      'Scroll down',
      'Take screenshot',
      'Extract data from ".result"',
      'Press Enter',
    ];

    for (const template of commandTemplates) {
      if (template.toLowerCase().includes(lower) || lower.length < 3) {
        suggestions.push(template);
      }
    }

    return suggestions.slice(0, 5);
  }
}
