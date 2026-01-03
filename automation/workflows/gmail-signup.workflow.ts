/**
 * @fileoverview Gmail Signup Workflow - Fast & Reliable
 * @module automation/workflows/gmail-signup
 *
 * Professional-grade Gmail account creation.
 * Uses direct field filling for reliability - no human simulation that causes stalling.
 */

import { Page } from 'playwright';
import { generateCompleteAccount, GeneratedAccount } from '../utils/data-generator';
import { getAccountService } from '../../electron/services/account.service';
import { showStatusOverlay, hideStatusOverlay } from '../browser-manager/blue-cursor';
import { logger } from '../../electron/utils/logger';
import { getCaptchaSolverService } from '../services/captcha-solver.service';
import { getPhoneNumberService, PhoneNumber } from '../services/phone-number.service';

export interface GmailSignupResult {
  success: boolean;
  account?: GeneratedAccount;
  email?: string;
  error?: string;
  step?: string;
}

type PageState = 
  | 'name_page'
  | 'birthday_page'
  | 'email_page'
  | 'password_page'
  | 'phone_page'
  | 'recovery_page'
  | 'terms_page'
  | 'captcha_page'
  | 'blocked_page'
  | 'success_page'
  | 'error_page'
  | 'unknown';

/**
 * Gmail Signup Workflow - Fast and Reliable
 */
export class GmailSignupWorkflow {
  private page: Page;
  private account: GeneratedAccount;
  private maxAttempts = 30;
  private reservedPhone: PhoneNumber | null = null;
  private workspaceId?: string;

  constructor(page: Page) {
    this.page = page;
    
    // Generate account immediately
    const tempAccount = generateCompleteAccount();
    const username = tempAccount.firstName.toLowerCase() + 
      tempAccount.lastName.toLowerCase().slice(0, 3) + 
      Math.floor(Math.random() * 9999);
    
    this.account = {
      ...tempAccount,
      username: username,
      email: `${username}@gmail.com`
    };
    
    logger.info('Generated account', { email: this.account.email, name: this.account.fullName });
  }

  async execute(workspaceId?: string): Promise<GmailSignupResult> {
    this.workspaceId = workspaceId;
    
    logger.info('🚀 Starting Gmail signup', { email: this.account.email });

    try {
      await this.page.bringToFront();
      
      // Navigate to signup
      await showStatusOverlay(this.page, '📧 Opening Google Signup...', 'action');
      await this.page.goto('https://accounts.google.com/signup', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      await this.page.waitForTimeout(1500);

      // Main loop
      let attempts = 0;
      let lastState: PageState = 'unknown';
      let stuckCount = 0;
      
      while (attempts < this.maxAttempts) {
        attempts++;
        
        await this.page.bringToFront();
        const currentState = await this.detectPageState();
        
        logger.info(`State: ${currentState} (attempt ${attempts})`);
        await this.showStateStatus(currentState);
        
        // Success check
        if (currentState === 'success_page') {
          logger.info('✅ Account created successfully!');
          await showStatusOverlay(this.page, '✅ Account Created!', 'success');
          break;
        }
        
        // Error checks
        if (currentState === 'error_page' || currentState === 'blocked_page') {
          logger.warn(`Stopping: ${currentState}`);
          break;
        }
        
        if (currentState === 'captcha_page') {
          const solved = await this.solveCaptcha();
          if (!solved) {
            await showStatusOverlay(this.page, '⚠️ CAPTCHA - Solve manually', 'info');
            break;
          }
          continue;
        }
        
        // Perform action
        const success = await this.performAction(currentState);
        
        // Stuck detection
        if (currentState === lastState && !success) {
          stuckCount++;
          if (stuckCount >= 3) {
            logger.warn('Stuck, forcing next');
            await this.forceClickNext();
            stuckCount = 0;
          }
        } else {
          stuckCount = 0;
        }
        
        lastState = currentState;
        await this.page.waitForTimeout(1500);
      }

      // Save account
      await hideStatusOverlay(this.page);
      
      try {
        const accountService = getAccountService();
        await accountService.initialize();
        await accountService.saveGeneratedAccount(this.account, 'gmail', workspaceId);
      } catch (e) {
        logger.warn('Failed to save account', { error: e });
      }

      return {
        success: true,
        account: this.account,
        email: this.account.email,
      };
    } catch (error) {
      logger.error('Gmail signup failed', { error });
      await hideStatusOverlay(this.page);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        account: this.account,
      };
    }
  }

  private async detectPageState(): Promise<PageState> {
    try {
      const url = this.page.url();
      
      if (url.includes('myaccount.google.com') || url.includes('mail.google.com')) {
        return 'success_page';
      }
      
      if (url.includes('/sorry/')) {
        return 'blocked_page';
      }
      
      const state = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        
        const hasFirstName = !!document.querySelector('input[name="firstName"]');
        const hasMonth = !!document.querySelector('select#month');
        const hasUsername = !!document.querySelector('input[name="Username"]');
        const hasPassword = !!document.querySelector('input[name="Passwd"]');
        const hasPhone = !!document.querySelector('input[type="tel"]');
        const hasRecovery = !!document.querySelector('input[name="recoveryEmail"]');
        const hasCaptcha = text.includes("i'm not a robot") || 
                          !!document.querySelector('[data-sitekey]') ||
                          !!document.querySelector('.g-recaptcha');
        const isBlocked = text.includes('unusual traffic');
        const hasAgree = text.includes('i agree');
        const hasWelcome = text.includes('welcome');
        const hasError = text.includes('something went wrong');
        
        return { hasFirstName, hasMonth, hasUsername, hasPassword, hasPhone, hasRecovery, hasCaptcha, isBlocked, hasAgree, hasWelcome, hasError };
      });
      
      if (state.isBlocked) return 'blocked_page';
      if (state.hasWelcome) return 'success_page';
      if (state.hasError) return 'error_page';
      if (state.hasCaptcha) return 'captcha_page';
      if (state.hasFirstName) return 'name_page';
      if (state.hasMonth) return 'birthday_page';
      if (state.hasUsername) return 'email_page';
      if (state.hasPassword) return 'password_page';
      if (state.hasPhone) return 'phone_page';
      if (state.hasRecovery) return 'recovery_page';
      if (state.hasAgree) return 'terms_page';
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async showStateStatus(state: PageState): Promise<void> {
    const messages: Record<PageState, string> = {
      'name_page': `✍️ Filling: ${this.account.firstName} ${this.account.lastName}`,
      'birthday_page': `📅 Birthday: ${this.account.birthDate.month}/${this.account.birthDate.day}/${this.account.birthDate.year}`,
      'email_page': `📧 Username: ${this.account.username}`,
      'password_page': '🔐 Setting password...',
      'phone_page': '📱 Phone verification...',
      'recovery_page': '📬 Recovery email...',
      'terms_page': '📜 Accepting terms...',
      'captcha_page': '🤖 Solving CAPTCHA...',
      'blocked_page': '⚠️ IP Blocked',
      'success_page': '✅ Success!',
      'error_page': '❌ Error',
      'unknown': '⏳ Processing...',
    };
    
    await showStatusOverlay(this.page, messages[state], 'action');
  }

  private async performAction(state: PageState): Promise<boolean> {
    switch (state) {
      case 'name_page': return await this.fillName();
      case 'birthday_page': return await this.fillBirthday();
      case 'email_page': return await this.fillEmail();
      case 'password_page': return await this.fillPassword();
      case 'phone_page': return await this.handlePhone();
      case 'recovery_page': return await this.handleRecovery();
      case 'terms_page': return await this.acceptTerms();
      default: return false;
    }
  }

  /**
   * Fill name - FAST and DIRECT
   */
  private async fillName(): Promise<boolean> {
    try {
      logger.info('Filling name', { first: this.account.firstName, last: this.account.lastName });
      
      // First name - direct fill, no delays
      await this.page.fill('input[name="firstName"]', this.account.firstName);
      await this.page.waitForTimeout(100);
      
      // Last name - direct fill
      await this.page.fill('input[name="lastName"]', this.account.lastName);
      await this.page.waitForTimeout(300);
      
      // Click Next
      await this.clickNext();
      return true;
    } catch (error) {
      logger.warn('Error filling name', { error });
      return false;
    }
  }

  /**
   * Fill birthday - FAST and DIRECT
   */
  private async fillBirthday(): Promise<boolean> {
    try {
      logger.info('Filling birthday');
      
      // Month dropdown
      await this.page.selectOption('select#month', String(this.account.birthDate.month));
      await this.page.waitForTimeout(100);
      
      // Day
      await this.page.fill('input#day', String(this.account.birthDate.day));
      await this.page.waitForTimeout(100);
      
      // Year
      await this.page.fill('input#year', String(this.account.birthDate.year));
      await this.page.waitForTimeout(100);
      
      // Gender
      try {
        const genderValue = this.account.gender === 'Male' ? '1' : '2';
        await this.page.selectOption('select#gender', genderValue);
      } catch {
        // Gender might not be required
      }
      
      await this.page.waitForTimeout(300);
      await this.clickNext();
      return true;
    } catch (error) {
      logger.warn('Error filling birthday', { error });
      return false;
    }
  }

  /**
   * Fill email/username
   */
  private async fillEmail(): Promise<boolean> {
    try {
      logger.info('Filling username', { username: this.account.username });
      
      await this.page.fill('input[name="Username"]', this.account.username);
      await this.page.waitForTimeout(300);
      await this.clickNext();
      
      // Check for "username taken"
      await this.page.waitForTimeout(1500);
      const pageText = await this.page.textContent('body') || '';
      
      if (pageText.toLowerCase().includes('taken') || pageText.toLowerCase().includes('already')) {
        const newUsername = this.account.firstName.toLowerCase() + Math.floor(Math.random() * 99999);
        this.account.username = newUsername;
        this.account.email = `${newUsername}@gmail.com`;
        
        logger.info('Username taken, trying', { newUsername });
        await this.page.fill('input[name="Username"]', newUsername);
        await this.clickNext();
      }
      
      return true;
    } catch (error) {
      logger.warn('Error filling username', { error });
      return false;
    }
  }

  /**
   * Fill password
   */
  private async fillPassword(): Promise<boolean> {
    try {
      logger.info('Filling password');
      
      await this.page.fill('input[name="Passwd"]', this.account.password);
      await this.page.waitForTimeout(100);
      
      // Try confirm password
      try {
        const confirmSelector = 'input[name="PasswdAgain"], input[name="ConfirmPasswd"]';
        const confirmInput = await this.page.$(confirmSelector);
        if (confirmInput) {
          await this.page.fill(confirmSelector, this.account.password);
        }
      } catch {
        // May not have confirm field
      }
      
      await this.page.waitForTimeout(300);
      await this.clickNext();
      return true;
    } catch (error) {
      logger.warn('Error filling password', { error });
      return false;
    }
  }

  /**
   * Handle phone page
   */
  private async handlePhone(): Promise<boolean> {
    try {
      logger.info('Handling phone page');
      
      // Try Skip first
      const skipClicked = await this.clickSkip();
      if (skipClicked) return true;
      
      // Try phone number from pool
      const phoneService = getPhoneNumberService();
      const numbers = phoneService.getAvailableNumbers();
      
      if (numbers.length > 0) {
        this.reservedPhone = phoneService.reserveNumber(this.workspaceId || 'default');
        
        if (this.reservedPhone) {
          await this.page.fill('input[type="tel"]', this.reservedPhone.number);
          await this.clickNext();
          
          await showStatusOverlay(this.page, '📱 Waiting for SMS...', 'action');
          
          try {
            const code = await phoneService.waitForVerificationCode(this.reservedPhone.number, 120000);
            const codeInput = await this.page.$('input[name="code"], input[type="tel"]');
            if (codeInput) {
              await codeInput.fill(code);
              await this.clickNext();
              return true;
            }
          } catch {
            logger.warn('No SMS code received');
          }
          
          phoneService.releaseNumber(this.reservedPhone.id);
          this.reservedPhone = null;
        }
      }
      
      // Can't skip and no phone - wait
      await this.page.waitForTimeout(2000);
      return false;
    } catch (error) {
      logger.warn('Error handling phone', { error });
      return false;
    }
  }

  /**
   * Handle recovery page
   */
  private async handleRecovery(): Promise<boolean> {
    try {
      const skipClicked = await this.clickSkip();
      if (skipClicked) return true;
      
      await this.clickNext();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Accept terms
   */
  private async acceptTerms(): Promise<boolean> {
    try {
      logger.info('Accepting terms');
      
      const buttons = ['button:has-text("I agree")', 'button:has-text("Agree")', 'button:has-text("Accept")'];
      for (const sel of buttons) {
        try {
          const btn = await this.page.$(sel);
          if (btn) {
            await btn.click();
            return true;
          }
        } catch {
          continue;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Click Skip button
   */
  private async clickSkip(): Promise<boolean> {
    try {
      const selectors = [
        'button:has-text("Skip")',
        'span:has-text("Skip")',
        'a:has-text("Skip")',
        'div[role="button"]:has-text("Skip")',
      ];
      
      for (const sel of selectors) {
        try {
          const el = await this.page.$(sel);
          if (el) {
            await el.click();
            logger.info('Clicked Skip');
            return true;
          }
        } catch {
          continue;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Click Next button
   */
  private async clickNext(): Promise<void> {
    try {
      const selectors = [
        'button:has-text("Next")',
        'div[role="button"]:has-text("Next")',
        'span:has-text("Next")',
        'button[type="submit"]',
      ];
      
      for (const sel of selectors) {
        try {
          const btn = await this.page.$(sel);
          if (btn) {
            await btn.click();
            await this.page.waitForTimeout(1000);
            return;
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Force click next when stuck
   */
  private async forceClickNext(): Promise<void> {
    try {
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(500);
      
      // Also try clicking any visible button
      await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('next') || text.includes('continue')) {
            (btn as HTMLButtonElement).click();
            break;
          }
        }
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Solve CAPTCHA
   */
  private async solveCaptcha(): Promise<boolean> {
    const captchaService = getCaptchaSolverService();
    
    if (!captchaService.isConfigured()) {
      logger.warn('CAPTCHA service not configured');
      return false;
    }

    try {
      const siteKey = await this.page.evaluate(() => {
        const el = document.querySelector('[data-sitekey]');
        if (el) return el.getAttribute('data-sitekey');
        
        const iframe = document.querySelector('iframe[src*="recaptcha"]');
        if (iframe) {
          const src = iframe.getAttribute('src') || '';
          const match = src.match(/k=([^&]+)/);
          return match ? match[1] : null;
        }
        return null;
      });

      if (!siteKey) return false;

      logger.info('Solving CAPTCHA...', { siteKey });
      await showStatusOverlay(this.page, '🤖 Solving CAPTCHA...', 'action');

      const result = await captchaService.solve({
        type: 'recaptcha_v2',
        siteKey,
        pageUrl: this.page.url(),
      });

      if (result.success && result.solution) {
        await this.page.evaluate((token) => {
          const textarea = document.querySelector('textarea[name="g-recaptcha-response"]') as HTMLTextAreaElement;
          if (textarea) {
            textarea.value = token;
            textarea.style.display = 'block';
          }
          
          // @ts-ignore
          const callback = window.___grecaptcha_cfg?.clients?.[0]?.callback;
          if (callback) callback(token);
        }, result.solution);

        await this.page.waitForTimeout(1000);
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  getAccount(): GeneratedAccount {
    return this.account;
  }
}
