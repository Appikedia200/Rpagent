/**
 * @fileoverview YouTube Channel Creation Workflow
 * @module automation/workflows/youtube-channel
 *
 * Creates a YouTube channel with auto-generated name.
 * Requires an existing Google account login.
 */

import { Page } from 'playwright';
import { HumanBehavior } from '../stealth/human-behavior';
import { generateChannelName } from '../utils/data-generator';
import { logger } from '../../electron/utils/logger';

/**
 * YouTube channel creation result
 */
export interface YouTubeChannelResult {
  success: boolean;
  channelName?: string;
  channelUrl?: string;
  error?: string;
}

/**
 * YouTube Channel Creation Workflow
 */
export class YouTubeChannelWorkflow {
  private page: Page;
  private humanBehavior: HumanBehavior;
  private channelName: string;

  constructor(page: Page, channelName?: string) {
    this.page = page;
    this.humanBehavior = new HumanBehavior(page);
    this.channelName = channelName || generateChannelName();
  }

  /**
   * Execute the YouTube channel creation workflow
   */
  async execute(): Promise<YouTubeChannelResult> {
    logger.info('Starting YouTube channel creation', { channelName: this.channelName });

    try {
      // Step 1: Navigate to YouTube Studio
      await this.navigateToStudio();

      // Step 2: Create channel if needed
      await this.createChannel();

      // Step 3: Customize channel
      await this.customizeChannel();

      // Step 4: Verify channel created
      const channelUrl = await this.verifyChannel();

      if (channelUrl) {
        logger.info('✅ YouTube channel created successfully', { 
          channelName: this.channelName,
          channelUrl 
        });

        return {
          success: true,
          channelName: this.channelName,
          channelUrl,
        };
      } else {
        return {
          success: false,
          channelName: this.channelName,
          error: 'Could not verify channel creation',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('YouTube channel creation failed', { error, channelName: this.channelName });

      return {
        success: false,
        channelName: this.channelName,
        error: errorMessage,
      };
    }
  }

  /**
   * Navigate to YouTube Studio
   */
  private async navigateToStudio(): Promise<void> {
    logger.debug('Navigating to YouTube Studio');

    await this.page.goto('https://studio.youtube.com', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await this.humanBehavior.humanWait(2000, 3000);
  }

  /**
   * Create channel if not exists
   */
  private async createChannel(): Promise<void> {
    logger.debug('Checking for channel creation prompt');

    try {
      // Look for "Create channel" button
      const createButton = await this.page.$(
        'button:has-text("Create channel"), ' +
        '[aria-label*="Create channel"], ' +
        '#create-channel-button'
      );

      if (createButton) {
        await this.humanBehavior.humanWait(500, 1000);
        await createButton.click();
        await this.page.waitForTimeout(2000);

        // Look for name input
        const nameInput = await this.page.$('input[aria-label*="name"], #channel-name-input');
        if (nameInput) {
          // Clear existing name
          await nameInput.fill('');
          await this.humanBehavior.typeHumanLike(
            'input[aria-label*="name"], #channel-name-input',
            this.channelName
          );
        }

        // Confirm creation
        const confirmButton = await this.page.$(
          'button:has-text("Create"), button:has-text("Done")'
        );
        if (confirmButton) {
          await this.humanBehavior.humanWait(300, 600);
          await confirmButton.click();
          await this.page.waitForTimeout(3000);
        }

        logger.debug('Channel creation dialog completed');
      } else {
        logger.debug('No channel creation prompt found - may already have channel');
      }
    } catch (error) {
      logger.debug('Channel creation step', { error });
    }
  }

  /**
   * Customize channel (name, description, etc.)
   */
  private async customizeChannel(): Promise<void> {
    logger.debug('Customizing channel');

    try {
      // Navigate to customization page
      const customizeLink = await this.page.$(
        'a[href*="customization"], button:has-text("Customize channel")'
      );

      if (customizeLink) {
        await customizeLink.click();
        await this.page.waitForTimeout(2000);

        // Go to basic info tab
        const basicInfoTab = await this.page.$('button:has-text("Basic info")');
        if (basicInfoTab) {
          await basicInfoTab.click();
          await this.page.waitForTimeout(1000);
        }

        // Update channel name if input exists
        const nameInput = await this.page.$('#channel-name');
        if (nameInput) {
          await nameInput.fill('');
          await this.humanBehavior.typeHumanLike('#channel-name', this.channelName);
        }

        // Add description
        const descInput = await this.page.$('#description');
        if (descInput) {
          const description = `Welcome to ${this.channelName}! Subscribe for amazing content.`;
          await this.humanBehavior.typeHumanLike('#description', description);
        }

        // Publish changes
        const publishButton = await this.page.$('button:has-text("Publish")');
        if (publishButton) {
          await this.humanBehavior.humanWait(300, 600);
          await publishButton.click();
          await this.page.waitForTimeout(2000);
        }

        logger.debug('Channel customization completed');
      }
    } catch (error) {
      logger.debug('Channel customization step', { error });
    }
  }

  /**
   * Verify channel was created and get URL
   */
  private async verifyChannel(): Promise<string | null> {
    try {
      // Navigate to YouTube to check channel
      await this.page.goto('https://www.youtube.com', { waitUntil: 'networkidle' });
      await this.humanBehavior.humanWait(1000, 2000);

      // Click on avatar
      const avatarButton = await this.page.$('#avatar-btn, button[aria-label*="Account"]');
      if (avatarButton) {
        await avatarButton.click();
        await this.page.waitForTimeout(1000);
      }

      // Look for "Your channel" link
      const channelLink = await this.page.$('a:has-text("Your channel")');
      if (channelLink) {
        const href = await channelLink.getAttribute('href');
        if (href) {
          return href.startsWith('http') ? href : `https://www.youtube.com${href}`;
        }
      }

      // Alternative: check Studio dashboard
      await this.page.goto('https://studio.youtube.com/channel', { waitUntil: 'networkidle' });
      const currentUrl = this.page.url();
      
      if (currentUrl.includes('/channel/')) {
        const channelId = currentUrl.match(/\/channel\/([^\/]+)/)?.[1];
        if (channelId) {
          return `https://www.youtube.com/channel/${channelId}`;
        }
      }

      return null;
    } catch (error) {
      logger.debug('Channel verification', { error });
      return null;
    }
  }

  /**
   * Get channel name
   */
  getChannelName(): string {
    return this.channelName;
  }
}


