/**
 * @fileoverview Enterprise Workflow Template Library
 * @module automation/templates/template-library
 * 
 * Pre-built workflow templates for common automation tasks
 * with customizable parameters and best practices.
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  parameters: TemplateParameter[];
  steps: TemplateStep[];
  requirements?: string[];
  tips?: string[];
  author?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory = 
  | 'account-creation' 
  | 'social-media' 
  | 'data-extraction' 
  | 'form-filling' 
  | 'testing'
  | 'monitoring'
  | 'ecommerce'
  | 'productivity'
  | 'custom';

export interface TemplateParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  description?: string;
}

export interface TemplateStep {
  id: string;
  type: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  onError?: 'continue' | 'retry' | 'fail';
  retries?: number;
  timeout?: number;
  condition?: string;          // Expression for conditional execution
}

// Pre-built templates
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // Gmail Account Creation
  {
    id: 'gmail-account-creation',
    name: 'Gmail Account Creation',
    description: 'Create Gmail accounts with random or specified details. Handles CAPTCHA and phone verification.',
    category: 'account-creation',
    icon: '📧',
    tags: ['gmail', 'google', 'email', 'account'],
    difficulty: 'intermediate',
    estimatedTime: '2-5 minutes per account',
    version: '2.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-12-01',
    parameters: [
      { name: 'firstName', label: 'First Name', type: 'string', required: false, description: 'Leave empty for random' },
      { name: 'lastName', label: 'Last Name', type: 'string', required: false, description: 'Leave empty for random' },
      { name: 'birthYear', label: 'Birth Year', type: 'number', required: false, default: 1995, validation: { min: 1950, max: 2005 } },
      { name: 'gender', label: 'Gender', type: 'select', required: false, options: [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'other', label: 'Other' },
      ]},
      { name: 'useCaptchaSolver', label: 'Use CAPTCHA Solver', type: 'boolean', required: false, default: true },
      { name: 'recoveryEmail', label: 'Recovery Email', type: 'string', required: false },
    ],
    steps: [
      { id: '1', type: 'NAVIGATE', name: 'Go to Gmail', config: { url: 'https://accounts.google.com/signup' } },
      { id: '2', type: 'WAIT', name: 'Wait for page', config: { duration: 2000 } },
      { id: '3', type: 'TYPE_TEXT', name: 'Enter first name', config: { selector: 'input[name="firstName"]', text: '${firstName}' } },
      { id: '4', type: 'TYPE_TEXT', name: 'Enter last name', config: { selector: 'input[name="lastName"]', text: '${lastName}' } },
      { id: '5', type: 'CLICK', name: 'Click next', config: { selector: 'button[type="submit"]' } },
      { id: '6', type: 'WAIT', name: 'Wait for DOB page', config: { duration: 2000 } },
      { id: '7', type: 'FILL_FORM', name: 'Fill date of birth', config: { fields: { month: '${birthMonth}', day: '${birthDay}', year: '${birthYear}' } } },
      { id: '8', type: 'SELECT', name: 'Select gender', config: { selector: '#gender', value: '${gender}' } },
      { id: '9', type: 'CLICK', name: 'Continue', config: { selector: 'button[type="submit"]' } },
      { id: '10', type: 'CUSTOM', name: 'Handle email selection', config: { workflow: 'gmail_signup' } },
    ],
    requirements: ['2Captcha API key for CAPTCHA solving', 'Telnyx account for phone verification'],
    tips: ['Use residential proxies for best success rate', 'Space out account creation to avoid detection'],
  },

  // YouTube Channel Creation
  {
    id: 'youtube-channel-creation',
    name: 'YouTube Channel Creation',
    description: 'Create YouTube channels with custom branding. Requires an existing Google account.',
    category: 'social-media',
    icon: '▶️',
    tags: ['youtube', 'channel', 'video', 'google'],
    difficulty: 'beginner',
    estimatedTime: '1-2 minutes',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-12-01',
    parameters: [
      { name: 'channelName', label: 'Channel Name', type: 'string', required: true },
      { name: 'channelHandle', label: 'Channel Handle', type: 'string', required: false, description: '@handle' },
      { name: 'channelDescription', label: 'Description', type: 'string', required: false },
      { name: 'category', label: 'Category', type: 'select', required: false, options: [
        { value: 'entertainment', label: 'Entertainment' },
        { value: 'gaming', label: 'Gaming' },
        { value: 'education', label: 'Education' },
        { value: 'music', label: 'Music' },
      ]},
    ],
    steps: [
      { id: '1', type: 'NAVIGATE', name: 'Go to YouTube Studio', config: { url: 'https://studio.youtube.com' } },
      { id: '2', type: 'WAIT', name: 'Wait for load', config: { duration: 3000 } },
      { id: '3', type: 'CLICK', name: 'Create channel', config: { selector: '[aria-label="Create channel"]' }, onError: 'continue' },
      { id: '4', type: 'TYPE_TEXT', name: 'Enter channel name', config: { selector: 'input[name="channelName"]', text: '${channelName}' } },
      { id: '5', type: 'CLICK', name: 'Confirm', config: { selector: 'button[type="submit"]' } },
    ],
    requirements: ['Logged in Google account'],
  },

  // Web Scraping - Product Data
  {
    id: 'product-scraper',
    name: 'E-commerce Product Scraper',
    description: 'Extract product data from e-commerce websites including title, price, description, and images.',
    category: 'data-extraction',
    icon: '🛒',
    tags: ['scraping', 'ecommerce', 'products', 'data'],
    difficulty: 'intermediate',
    estimatedTime: '10-30 seconds per page',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-12-01',
    parameters: [
      { name: 'startUrl', label: 'Start URL', type: 'string', required: true },
      { name: 'titleSelector', label: 'Title Selector', type: 'string', required: true, default: 'h1.product-title' },
      { name: 'priceSelector', label: 'Price Selector', type: 'string', required: true, default: '.price' },
      { name: 'descriptionSelector', label: 'Description Selector', type: 'string', required: false },
      { name: 'imageSelector', label: 'Image Selector', type: 'string', required: false, default: 'img.product-image' },
      { name: 'maxPages', label: 'Max Pages', type: 'number', required: false, default: 10 },
      { name: 'outputFormat', label: 'Output Format', type: 'select', required: false, default: 'json', options: [
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' },
      ]},
    ],
    steps: [
      { id: '1', type: 'NAVIGATE', name: 'Go to URL', config: { url: '${startUrl}' } },
      { id: '2', type: 'WAIT', name: 'Wait for content', config: { selector: '${titleSelector}', timeout: 10000 } },
      { id: '3', type: 'EXTRACT', name: 'Extract title', config: { selector: '${titleSelector}', type: 'text', saveTo: 'title' } },
      { id: '4', type: 'EXTRACT', name: 'Extract price', config: { selector: '${priceSelector}', type: 'text', saveTo: 'price' } },
      { id: '5', type: 'EXTRACT', name: 'Extract description', config: { selector: '${descriptionSelector}', type: 'text', saveTo: 'description' }, onError: 'continue' },
      { id: '6', type: 'EXTRACT', name: 'Extract images', config: { selector: '${imageSelector}', type: 'src', multiple: true, saveTo: 'images' }, onError: 'continue' },
      { id: '7', type: 'SAVE_DATA', name: 'Save results', config: { format: '${outputFormat}' } },
    ],
    tips: ['Adjust selectors based on the target website', 'Use delays between requests to avoid rate limiting'],
  },

  // Form Auto-Fill
  {
    id: 'form-autofill',
    name: 'Generic Form Auto-Fill',
    description: 'Automatically fill out any web form with provided or generated data.',
    category: 'form-filling',
    icon: '📝',
    tags: ['form', 'autofill', 'data-entry'],
    difficulty: 'beginner',
    estimatedTime: '10-30 seconds',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-12-01',
    parameters: [
      { name: 'formUrl', label: 'Form URL', type: 'string', required: true },
      { name: 'formData', label: 'Form Data', type: 'object', required: true, description: 'Key-value pairs of field names and values' },
      { name: 'submitSelector', label: 'Submit Button Selector', type: 'string', required: false, default: 'button[type="submit"]' },
      { name: 'autoSubmit', label: 'Auto Submit', type: 'boolean', required: false, default: false },
    ],
    steps: [
      { id: '1', type: 'NAVIGATE', name: 'Go to form', config: { url: '${formUrl}' } },
      { id: '2', type: 'WAIT', name: 'Wait for form', config: { selector: 'form', timeout: 10000 } },
      { id: '3', type: 'FILL_FORM', name: 'Fill form fields', config: { data: '${formData}' } },
      { id: '4', type: 'CLICK', name: 'Submit form', config: { selector: '${submitSelector}' }, condition: '${autoSubmit}' },
    ],
  },

  // Social Media - Twitter/X Post
  {
    id: 'twitter-post',
    name: 'Twitter/X Post Creator',
    description: 'Automatically post tweets/threads on Twitter/X.',
    category: 'social-media',
    icon: '🐦',
    tags: ['twitter', 'x', 'social', 'post'],
    difficulty: 'beginner',
    estimatedTime: '30 seconds',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-12-01',
    parameters: [
      { name: 'tweetText', label: 'Tweet Text', type: 'string', required: true, validation: { max: 280 } },
      { name: 'mediaUrls', label: 'Media URLs', type: 'array', required: false },
      { name: 'scheduledTime', label: 'Schedule For', type: 'string', required: false, description: 'ISO date string' },
    ],
    steps: [
      { id: '1', type: 'NAVIGATE', name: 'Go to Twitter', config: { url: 'https://twitter.com/compose/tweet' } },
      { id: '2', type: 'WAIT', name: 'Wait for composer', config: { selector: '[data-testid="tweetTextarea_0"]', timeout: 10000 } },
      { id: '3', type: 'TYPE_TEXT', name: 'Enter tweet', config: { selector: '[data-testid="tweetTextarea_0"]', text: '${tweetText}' } },
      { id: '4', type: 'CLICK', name: 'Post tweet', config: { selector: '[data-testid="tweetButton"]' } },
      { id: '5', type: 'WAIT', name: 'Confirm posted', config: { duration: 2000 } },
    ],
    requirements: ['Logged in Twitter account'],
  },

  // Website Monitoring
  {
    id: 'website-uptime-monitor',
    name: 'Website Uptime Monitor',
    description: 'Check if a website is accessible and measure response time.',
    category: 'monitoring',
    icon: '📡',
    tags: ['monitoring', 'uptime', 'health-check'],
    difficulty: 'beginner',
    estimatedTime: '5-10 seconds',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-12-01',
    parameters: [
      { name: 'targetUrl', label: 'Target URL', type: 'string', required: true },
      { name: 'expectedText', label: 'Expected Text', type: 'string', required: false, description: 'Text that should appear on the page' },
      { name: 'timeout', label: 'Timeout (ms)', type: 'number', required: false, default: 30000 },
      { name: 'alertOnFailure', label: 'Alert on Failure', type: 'boolean', required: false, default: true },
    ],
    steps: [
      { id: '1', type: 'SET_VARIABLE', name: 'Record start time', config: { name: 'startTime', value: '${_timestamp}' } },
      { id: '2', type: 'NAVIGATE', name: 'Load website', config: { url: '${targetUrl}', timeout: '${timeout}' } },
      { id: '3', type: 'SET_VARIABLE', name: 'Record end time', config: { name: 'endTime', value: '${_timestamp}' } },
      { id: '4', type: 'ASSERT', name: 'Check expected text', config: { text: '${expectedText}' }, condition: '${expectedText}', onError: 'continue' },
      { id: '5', type: 'CALCULATE', name: 'Calculate response time', config: { expression: '${endTime} - ${startTime}', saveTo: 'responseTime' } },
      { id: '6', type: 'LOG', name: 'Log results', config: { message: 'Response time: ${responseTime}ms' } },
    ],
  },

  // Screenshot Capture
  {
    id: 'screenshot-capture',
    name: 'Full Page Screenshot',
    description: 'Capture full-page screenshots of websites for archival or comparison.',
    category: 'productivity',
    icon: '📸',
    tags: ['screenshot', 'capture', 'archive'],
    difficulty: 'beginner',
    estimatedTime: '5-15 seconds',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-12-01',
    parameters: [
      { name: 'targetUrl', label: 'Target URL', type: 'string', required: true },
      { name: 'fullPage', label: 'Full Page', type: 'boolean', required: false, default: true },
      { name: 'format', label: 'Format', type: 'select', required: false, default: 'png', options: [
        { value: 'png', label: 'PNG' },
        { value: 'jpeg', label: 'JPEG' },
        { value: 'pdf', label: 'PDF' },
      ]},
      { name: 'waitTime', label: 'Wait Before Capture (ms)', type: 'number', required: false, default: 2000 },
    ],
    steps: [
      { id: '1', type: 'NAVIGATE', name: 'Load page', config: { url: '${targetUrl}' } },
      { id: '2', type: 'WAIT', name: 'Wait for rendering', config: { duration: '${waitTime}' } },
      { id: '3', type: 'SCREENSHOT', name: 'Capture screenshot', config: { fullPage: '${fullPage}', format: '${format}' } },
    ],
  },

  // Login Automation
  {
    id: 'generic-login',
    name: 'Generic Website Login',
    description: 'Automate login to any website with username/password authentication.',
    category: 'productivity',
    icon: '🔐',
    tags: ['login', 'auth', 'password'],
    difficulty: 'beginner',
    estimatedTime: '10-20 seconds',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-12-01',
    parameters: [
      { name: 'loginUrl', label: 'Login URL', type: 'string', required: true },
      { name: 'username', label: 'Username/Email', type: 'string', required: true },
      { name: 'password', label: 'Password', type: 'string', required: true },
      { name: 'usernameSelector', label: 'Username Field Selector', type: 'string', required: false, default: 'input[type="email"], input[name="username"], input[name="email"]' },
      { name: 'passwordSelector', label: 'Password Field Selector', type: 'string', required: false, default: 'input[type="password"]' },
      { name: 'submitSelector', label: 'Submit Button Selector', type: 'string', required: false, default: 'button[type="submit"]' },
      { name: 'successIndicator', label: 'Success Indicator', type: 'string', required: false, description: 'Selector that appears after successful login' },
    ],
    steps: [
      { id: '1', type: 'NAVIGATE', name: 'Go to login page', config: { url: '${loginUrl}' } },
      { id: '2', type: 'WAIT', name: 'Wait for form', config: { selector: '${usernameSelector}', timeout: 10000 } },
      { id: '3', type: 'TYPE_TEXT', name: 'Enter username', config: { selector: '${usernameSelector}', text: '${username}' } },
      { id: '4', type: 'TYPE_TEXT', name: 'Enter password', config: { selector: '${passwordSelector}', text: '${password}' } },
      { id: '5', type: 'CLICK', name: 'Click login', config: { selector: '${submitSelector}' } },
      { id: '6', type: 'WAIT', name: 'Wait for login', config: { selector: '${successIndicator}', timeout: 15000 }, condition: '${successIndicator}' },
    ],
  },
];

export class TemplateLibrary {
  private templates: Map<string, WorkflowTemplate> = new Map();
  private customTemplates: Map<string, WorkflowTemplate> = new Map();

  constructor() {
    // Load built-in templates
    for (const template of WORKFLOW_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Get all templates
   */
  getAll(): WorkflowTemplate[] {
    return [...this.templates.values(), ...this.customTemplates.values()];
  }

  /**
   * Get template by ID
   */
  get(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id) || this.customTemplates.get(id);
  }

  /**
   * Get templates by category
   */
  getByCategory(category: TemplateCategory): WorkflowTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Search templates
   */
  search(query: string): WorkflowTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Add custom template
   */
  addCustom(template: Omit<WorkflowTemplate, 'createdAt' | 'updatedAt'>): WorkflowTemplate {
    const now = new Date().toISOString();
    const fullTemplate: WorkflowTemplate = {
      ...template,
      createdAt: now,
      updatedAt: now,
    };
    this.customTemplates.set(template.id, fullTemplate);
    return fullTemplate;
  }

  /**
   * Remove custom template
   */
  removeCustom(id: string): boolean {
    return this.customTemplates.delete(id);
  }

  /**
   * Create workflow from template with parameters
   */
  instantiate(templateId: string, parameters: Record<string, unknown>): TemplateStep[] {
    const template = this.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Merge default parameters
    const params: Record<string, unknown> = {};
    for (const param of template.parameters) {
      params[param.name] = parameters[param.name] ?? param.default;
    }

    // Clone and interpolate steps
    return template.steps.map(step => ({
      ...step,
      config: this.interpolateConfig(step.config, params),
    }));
  }

  /**
   * Interpolate config values with parameters
   */
  private interpolateConfig(config: Record<string, unknown>, params: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        result[key] = value.replace(/\$\{([^}]+)\}/g, (_, name) => {
          const paramValue = params[name];
          return paramValue !== undefined ? String(paramValue) : '';
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateConfig(value as Record<string, unknown>, params);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Get categories with counts
   */
  getCategories(): Array<{ category: TemplateCategory; count: number; icon: string }> {
    const categoryIcons: Record<TemplateCategory, string> = {
      'account-creation': '👤',
      'social-media': '📱',
      'data-extraction': '📊',
      'form-filling': '📝',
      'testing': '🧪',
      'monitoring': '📡',
      'ecommerce': '🛒',
      'productivity': '⚡',
      'custom': '🔧',
    };

    const counts = new Map<TemplateCategory, number>();
    for (const template of this.getAll()) {
      counts.set(template.category, (counts.get(template.category) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([category, count]) => ({
      category,
      count,
      icon: categoryIcons[category],
    }));
  }
}

// Singleton instance
let libraryInstance: TemplateLibrary | null = null;

export function getTemplateLibrary(): TemplateLibrary {
  if (!libraryInstance) {
    libraryInstance = new TemplateLibrary();
  }
  return libraryInstance;
}

