/**
 * @fileoverview Video Watcher Workflow
 * @module automation/workflows/video-watcher
 *
 * Watch YouTube videos with:
 * - Automatic ad handling
 * - Human-like behavior
 * - Duration control
 */

import { Page } from 'playwright';
import { HumanBehavior } from '../stealth/human-behavior';
import { YouTubeAdHandler } from './youtube-ad-handler';
import { logger } from '../../electron/utils/logger';

/**
 * Video watch result
 */
export interface VideoWatchResult {
  success: boolean;
  videoUrl: string;
  requestedMinutes: number;
  actualSeconds: number;
  adsSkipped: number;
  error?: string;
}

/**
 * Video Watcher Workflow
 */
export class VideoWatcherWorkflow {
  private page: Page;
  private humanBehavior: HumanBehavior;
  private adHandler: YouTubeAdHandler;
  private adsSkipped = 0;

  constructor(page: Page) {
    this.page = page;
    this.humanBehavior = new HumanBehavior(page);
    this.adHandler = new YouTubeAdHandler(page);
  }

  /**
   * Execute the video watching workflow
   */
  async execute(videoUrl: string, durationMinutes: number): Promise<VideoWatchResult> {
    const startTime = Date.now();
    this.adsSkipped = 0;

    logger.info(`Starting video watch: ${videoUrl} for ${durationMinutes} minutes`);

    try {
      // Navigate to video
      await this.page.goto(videoUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Wait for page to settle
      await this.humanBehavior.humanWait(2000, 4000);

      // Handle any initial ads
      await this.adHandler.waitForAdsToComplete(60);

      // Ensure video is playing
      await this.ensureVideoPlaying();

      // Unmute if muted
      await this.ensureVideoUnmuted();

      // Set volume to reasonable level
      await this.setVolume(0.3);

      // Handle ads and watch video
      await this.watchWithAdHandling(durationMinutes);

      const watchDuration = Math.round((Date.now() - startTime) / 1000);

      logger.info(`✅ Finished watching video (${watchDuration} seconds, ${this.adsSkipped} ads handled)`);

      return {
        success: true,
        videoUrl,
        requestedMinutes: durationMinutes,
        actualSeconds: watchDuration,
        adsSkipped: this.adsSkipped,
      };
    } catch (error) {
      const watchDuration = Math.round((Date.now() - startTime) / 1000);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Video watching failed', { error, videoUrl });

      return {
        success: false,
        videoUrl,
        requestedMinutes: durationMinutes,
        actualSeconds: watchDuration,
        adsSkipped: this.adsSkipped,
        error: errorMessage,
      };
    }
  }

  /**
   * Watch video with continuous ad handling
   */
  private async watchWithAdHandling(durationMinutes: number): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);

    while (Date.now() < endTime) {
      // Check for ads every 3-5 seconds
      const checkInterval = 3000 + Math.random() * 2000;
      await this.page.waitForTimeout(checkInterval);

      // Handle any ads
      const adDetected = await this.adHandler.skipAdIfPresent();
      if (adDetected) {
        this.adsSkipped++;
      }

      // Ensure video is still playing
      await this.ensureVideoPlaying();

      // Random human actions (5% chance)
      if (Math.random() < 0.05) {
        await this.performRandomAction();
      }

      // Check if video ended
      const videoEnded = await this.isVideoEnded();
      if (videoEnded) {
        logger.info('Video ended naturally');
        break;
      }
    }
  }

  /**
   * Ensure video is playing
   */
  private async ensureVideoPlaying(): Promise<void> {
    try {
      const isPaused = await this.page.evaluate(() => {
        const video = document.querySelector('video');
        return video?.paused ?? true;
      });

      if (isPaused) {
        logger.debug('Video paused, resuming...');

        // Try large play button
        const largePlay = await this.page.$('.ytp-large-play-button');
        if (largePlay && await largePlay.isVisible()) {
          await largePlay.click();
          await this.page.waitForTimeout(500);
          return;
        }

        // Try clicking video
        const video = await this.page.$('video');
        if (video) {
          await video.click();
        }
      }
    } catch (error) {
      logger.debug('Error ensuring video playing', { error });
    }
  }

  /**
   * Ensure video is unmuted
   */
  private async ensureVideoUnmuted(): Promise<void> {
    try {
      const isMuted = await this.page.evaluate(() => {
        const video = document.querySelector('video');
        return video?.muted ?? false;
      });

      if (isMuted) {
        logger.debug('Video muted, unmuting...');
        const muteButton = await this.page.$('.ytp-mute-button');
        if (muteButton) {
          await muteButton.click();
          await this.page.waitForTimeout(300);
        }
      }
    } catch (error) {
      logger.debug('Error ensuring video unmuted', { error });
    }
  }

  /**
   * Set video volume
   */
  private async setVolume(level: number): Promise<void> {
    try {
      await this.page.evaluate((vol) => {
        const video = document.querySelector('video');
        if (video) {
          video.volume = vol;
        }
      }, level);
    } catch (error) {
      logger.debug('Error setting volume', { error });
    }
  }

  /**
   * Check if video has ended
   */
  private async isVideoEnded(): Promise<boolean> {
    try {
      return await this.page.evaluate(() => {
        const video = document.querySelector('video');
        if (!video) return false;
        return video.ended || (video.currentTime >= video.duration - 1);
      });
    } catch {
      return false;
    }
  }

  /**
   * Perform random human-like action
   */
  private async performRandomAction(): Promise<void> {
    const actions = [
      // Move mouse randomly
      async () => {
        const x = 200 + Math.random() * 800;
        const y = 200 + Math.random() * 400;
        await this.humanBehavior.moveMouseHumanLike(x, y);
      },

      // Scroll down briefly
      async () => {
        await this.page.evaluate(() => window.scrollBy(0, 100 + Math.random() * 150));
        await this.humanBehavior.humanWait(1000, 2000);
        await this.page.evaluate(() => window.scrollBy(0, -150));
      },

      // Hover over progress bar
      async () => {
        const progressBar = await this.page.$('.ytp-progress-bar');
        if (progressBar) {
          const box = await progressBar.boundingBox();
          if (box) {
            await this.humanBehavior.moveMouseHumanLike(
              box.x + Math.random() * box.width,
              box.y + box.height / 2
            );
            await this.humanBehavior.humanWait(500, 1000);
          }
        }
      },

      // Just wait (thinking)
      async () => {
        await this.humanBehavior.humanWait(2000, 5000);
      },
    ];

    const action = actions[Math.floor(Math.random() * actions.length)];
    try {
      await action();
    } catch {
      // Ignore errors in random actions
    }
  }

  /**
   * Like the video
   */
  async likeVideo(): Promise<boolean> {
    try {
      const likeButton = await this.page.$('button[aria-label*="like"][aria-pressed="false"]');
      if (likeButton) {
        const box = await likeButton.boundingBox();
        if (box) {
          await this.humanBehavior.moveMouseHumanLike(
            box.x + box.width / 2,
            box.y + box.height / 2
          );
          await this.humanBehavior.humanWait(200, 500);
          await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          logger.info('Liked video');
          return true;
        }
      }
    } catch (error) {
      logger.debug('Failed to like video', { error });
    }
    return false;
  }

  /**
   * Subscribe to channel
   */
  async subscribeToChannel(): Promise<boolean> {
    try {
      const subscribeButton = await this.page.$('button[aria-label*="Subscribe"]:not([aria-label*="Subscribed"])');
      if (subscribeButton) {
        const box = await subscribeButton.boundingBox();
        if (box) {
          await this.humanBehavior.moveMouseHumanLike(
            box.x + box.width / 2,
            box.y + box.height / 2
          );
          await this.humanBehavior.humanWait(200, 500);
          await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          logger.info('Subscribed to channel');
          return true;
        }
      }
    } catch (error) {
      logger.debug('Failed to subscribe', { error });
    }
    return false;
  }

  /**
   * Post a comment
   */
  async postComment(comment: string): Promise<boolean> {
    try {
      // Scroll to comments
      await this.page.evaluate(() => window.scrollBy(0, 400));
      await this.humanBehavior.humanWait(1000, 2000);

      // Click comment box
      const commentPlaceholder = await this.page.$('#placeholder-area, #simplebox-placeholder');
      if (commentPlaceholder) {
        await commentPlaceholder.click();
        await this.humanBehavior.humanWait(500, 1000);

        // Type comment
        const commentInput = await this.page.$('#contenteditable-root, #comment-input textarea');
        if (commentInput) {
          await this.humanBehavior.typeHumanLike('#contenteditable-root, #comment-input textarea', comment);
          await this.humanBehavior.humanWait(500, 1000);

          // Click submit
          const submitButton = await this.page.$('#submit-button button, #comment-input button[aria-label*="Comment"]');
          if (submitButton) {
            await submitButton.click();
            logger.info('Posted comment');
            return true;
          }
        }
      }
    } catch (error) {
      logger.debug('Failed to post comment', { error });
    }
    return false;
  }
}


