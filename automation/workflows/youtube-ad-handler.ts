/**
 * @fileoverview YouTube Ad Handler
 * @module automation/workflows/youtube-ad-handler
 *
 * Handles all types of YouTube ads:
 * 1. Skippable ads (skip after 5 seconds)
 * 2. Unskippable ads (wait through them)
 * 3. Overlay ads (close them)
 * 4. Bumper ads (6 seconds, unskippable)
 */

import { Page } from 'playwright';
import { HumanBehavior } from '../stealth/human-behavior';
import { logger } from '../../electron/utils/logger';

/**
 * Ad type enumeration
 */
export type YouTubeAdType = 'skippable' | 'unskippable' | 'overlay' | 'bumper' | null;

/**
 * Ad detection result
 */
interface AdDetectionResult {
  type: YouTubeAdType;
  hasSkipButton: boolean;
  isAdPlaying: boolean;
  hasCountdown: boolean;
  hasOverlay: boolean;
  adText: string;
  remainingSeconds: number | null;
}

/**
 * YouTube Ad Handler class
 */
export class YouTubeAdHandler {
  private page: Page;
  private humanBehavior: HumanBehavior;

  constructor(page: Page) {
    this.page = page;
    this.humanBehavior = new HumanBehavior(page);
  }

  /**
   * Main ad handling loop
   * Runs continuously while video is playing
   */
  async handleAds(durationMinutes: number): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);

    logger.info('Starting ad handling loop', { durationMinutes });

    while (Date.now() < endTime) {
      // Check for ads every 2 seconds
      await this.page.waitForTimeout(2000);

      // Detect ad type and handle accordingly
      const detection = await this.detectAdType();

      if (detection.type) {
        logger.debug('Ad detected', { type: detection.type, adText: detection.adText });

        switch (detection.type) {
          case 'skippable':
            await this.handleSkippableAd();
            break;
          case 'unskippable':
            await this.handleUnskippableAd(detection.remainingSeconds || 15);
            break;
          case 'overlay':
            await this.handleOverlayAd();
            break;
          case 'bumper':
            await this.handleBumperAd();
            break;
        }
      }

      // Verify video is still playing
      await this.ensureVideoPlaying();

      // Random human-like actions (10% chance per loop)
      if (Math.random() < 0.1) {
        await this.randomHumanAction();
      }
    }

    logger.info('Ad handling loop completed');
  }

  /**
   * Detect what type of ad is showing
   */
  async detectAdType(): Promise<AdDetectionResult> {
    try {
      const result = await this.page.evaluate(() => {
        // Skip button (appears after 5 seconds on skippable ads)
        const skipButton = document.querySelector(
          '.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, [class*="skip-button"]'
        );

        // Ad is playing indicator
        const adPlaying = document.querySelector(
          '.ad-showing, .video-ads, .ytp-ad-player-overlay'
        );

        // Ad module (another indicator)
        const adModule = document.querySelector('.ytp-ad-module');

        // Ad countdown (unskippable ads)
        const adCountdown = document.querySelector(
          '.ytp-ad-text, .ytp-ad-preview-text, .ytp-ad-duration-remaining'
        );

        // Overlay ad close button
        const overlayClose = document.querySelector(
          '.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container'
        );

        // Get countdown text
        const adText = adCountdown?.textContent || '';

        // Parse remaining seconds from text like "Ad will end in 15" or ":15"
        let remainingSeconds: number | null = null;
        const timeMatch = adText.match(/(\d+)/);
        if (timeMatch) {
          remainingSeconds = parseInt(timeMatch[1], 10);
        }

        return {
          hasSkipButton: !!skipButton && (skipButton as HTMLElement).offsetParent !== null,
          isAdPlaying: !!adPlaying || !!adModule,
          hasCountdown: !!adCountdown,
          hasOverlay: !!overlayClose,
          adText,
          remainingSeconds,
        };
      });

      // Determine ad type
      let type: YouTubeAdType = null;

      if (result.hasOverlay) {
        type = 'overlay';
      } else if (result.hasSkipButton) {
        type = 'skippable';
      } else if (result.isAdPlaying && result.hasCountdown) {
        // Bumper ads are 6 seconds or less
        if (result.remainingSeconds !== null && result.remainingSeconds <= 6) {
          type = 'bumper';
        } else {
          type = 'unskippable';
        }
      } else if (result.isAdPlaying) {
        // Ad playing but no clear type - assume skippable and wait for button
        type = 'skippable';
      }

      return { ...result, type };
    } catch (error) {
      logger.debug('Ad detection failed', { error });
      return {
        type: null,
        hasSkipButton: false,
        isAdPlaying: false,
        hasCountdown: false,
        hasOverlay: false,
        adText: '',
        remainingSeconds: null,
      };
    }
  }

  /**
   * Handle skippable ads - wait for skip button, then click it
   */
  async handleSkippableAd(): Promise<void> {
    logger.info('Handling skippable ad, waiting for skip button...');

    try {
      // Wait up to 10 seconds for skip button to become visible
      const skipButton = await this.page.waitForSelector(
        '.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, [class*="skip-button"]:not([style*="display: none"])',
        { timeout: 10000, state: 'visible' }
      );

      if (skipButton) {
        // Human-like delay before clicking
        await this.humanBehavior.humanWait(500, 1500);

        // Get button position
        const box = await skipButton.boundingBox();
        if (box) {
          // Move mouse in curved path to button
          await this.humanBehavior.moveMouseHumanLike(
            box.x + box.width / 2,
            box.y + box.height / 2
          );

          // Small pause before click
          await this.humanBehavior.humanWait(100, 300);

          // Click
          await this.page.mouse.click(
            box.x + box.width / 2,
            box.y + box.height / 2
          );

          logger.info('✅ Skipped ad successfully');
        } else {
          // Fallback: just click the button
          await skipButton.click();
          logger.info('✅ Skipped ad (fallback click)');
        }
      }
    } catch (error) {
      logger.debug('Skip button not found or ad ended', { error });
    }
  }

  /**
   * Handle unskippable ads - just wait through them
   */
  async handleUnskippableAd(durationSeconds: number): Promise<void> {
    logger.info(`Handling unskippable ad, waiting ${durationSeconds} seconds...`);

    // Add buffer time to ensure ad completes
    const waitTime = (durationSeconds + 2) * 1000;
    await this.page.waitForTimeout(waitTime);

    logger.info('✅ Unskippable ad completed');
  }

  /**
   * Handle overlay ads - click the close button
   */
  async handleOverlayAd(): Promise<void> {
    logger.info('Handling overlay ad, closing...');

    try {
      const closeButton = await this.page.$(
        '.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container'
      );

      if (closeButton) {
        const box = await closeButton.boundingBox();
        if (box) {
          // Move to button with human-like movement
          await this.humanBehavior.moveMouseHumanLike(
            box.x + box.width / 2,
            box.y + box.height / 2
          );

          await this.humanBehavior.humanWait(100, 300);
          await this.page.mouse.click(
            box.x + box.width / 2,
            box.y + box.height / 2
          );

          logger.info('✅ Closed overlay ad');
        }
      }
    } catch (error) {
      logger.debug('Could not close overlay ad', { error });
    }
  }

  /**
   * Handle bumper ads (6 seconds, unskippable) - just wait
   */
  async handleBumperAd(): Promise<void> {
    logger.info('Handling bumper ad (6 seconds), waiting...');
    await this.page.waitForTimeout(7000);
    logger.info('✅ Bumper ad completed');
  }

  /**
   * Ensure video is still playing
   */
  async ensureVideoPlaying(): Promise<void> {
    try {
      const isPaused = await this.page.evaluate(() => {
        const video = document.querySelector('video');
        return video?.paused ?? true;
      });

      if (isPaused) {
        logger.debug('Video paused, attempting to resume...');

        // Try clicking large play button first
        const largePlayButton = await this.page.$('.ytp-large-play-button');
        if (largePlayButton) {
          await largePlayButton.click();
          await this.page.waitForTimeout(500);
        } else {
          // Click video element directly
          const video = await this.page.$('video');
          if (video) {
            await video.click();
          }
        }

        await this.page.waitForTimeout(1000);
      }
    } catch (error) {
      logger.debug('Error ensuring video playing', { error });
    }
  }

  /**
   * Random human-like actions while watching
   */
  async randomHumanAction(): Promise<void> {
    const action = Math.floor(Math.random() * 5);

    try {
      switch (action) {
        case 0:
          // Do nothing (most common)
          await this.humanBehavior.humanWait(3000, 8000);
          break;

        case 1:
          // Scroll down to comments briefly
          await this.page.evaluate(() => window.scrollBy(0, 200 + Math.random() * 200));
          await this.humanBehavior.humanWait(1500, 3000);
          await this.page.evaluate(() => window.scrollBy(0, -200));
          break;

        case 2:
          // Move mouse randomly within video area
          const videoBox = await this.page.$('video');
          if (videoBox) {
            const box = await videoBox.boundingBox();
            if (box) {
              const x = box.x + Math.random() * box.width;
              const y = box.y + Math.random() * box.height;
              await this.humanBehavior.moveMouseHumanLike(x, y);
            }
          }
          break;

        case 3:
          // Hover near like button (but don't click)
          const likeButton = await this.page.$('button[aria-label*="like"], #top-level-buttons-computed button');
          if (likeButton) {
            const box = await likeButton.boundingBox();
            if (box) {
              await this.humanBehavior.moveMouseHumanLike(
                box.x + box.width / 2,
                box.y + box.height / 2
              );
              await this.humanBehavior.humanWait(800, 1500);
            }
          }
          break;

        case 4:
          // Small scroll and back
          await this.humanBehavior.scrollHumanLike('down');
          await this.humanBehavior.humanWait(500, 1500);
          await this.humanBehavior.scrollHumanLike('up');
          break;
      }
    } catch (error) {
      // Ignore errors in random actions
      logger.debug('Random action failed', { error });
    }
  }

  /**
   * Skip a single ad if present
   */
  async skipAdIfPresent(): Promise<boolean> {
    const detection = await this.detectAdType();

    if (detection.type === 'skippable') {
      await this.handleSkippableAd();
      return true;
    } else if (detection.type === 'overlay') {
      await this.handleOverlayAd();
      return true;
    }

    return false;
  }

  /**
   * Wait for all ads to complete
   */
  async waitForAdsToComplete(maxWaitSeconds: number = 120): Promise<void> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;

    while (Date.now() - startTime < maxWaitMs) {
      const detection = await this.detectAdType();

      if (!detection.type) {
        // No ad detected, we're done
        return;
      }

      // Handle the current ad
      switch (detection.type) {
        case 'skippable':
          await this.handleSkippableAd();
          break;
        case 'unskippable':
          await this.handleUnskippableAd(detection.remainingSeconds || 15);
          break;
        case 'overlay':
          await this.handleOverlayAd();
          break;
        case 'bumper':
          await this.handleBumperAd();
          break;
      }

      // Brief pause before checking again
      await this.page.waitForTimeout(1000);
    }

    logger.warn('Max wait time reached for ads');
  }
}


