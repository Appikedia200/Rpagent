/**
 * @fileoverview Blue Cursor Visual Indicator
 * @module automation/browser-manager/blue-cursor
 *
 * CRITICAL: Blue cursor is VISUAL ONLY - shows where automation is happening
 * The cursor is larger and more visible for easy tracking across multiple browsers.
 */

import { Page, BrowserContext } from 'playwright';
import { logger } from '../../electron/utils/logger';

/**
 * Blue cursor injection script - Larger and more visible
 */
const BLUE_CURSOR_SCRIPT = `
(function() {
  // Prevent duplicate injection
  if (window.__rpaBlueCursorInjected) return;
  window.__rpaBlueCursorInjected = true;
  
  // Create blue cursor element - LARGER and more visible
  const cursor = document.createElement('div');
  cursor.id = 'rpa-blue-cursor';
  cursor.style.cssText = \`
    position: fixed;
    width: 48px;
    height: 48px;
    background: radial-gradient(circle, rgba(0, 150, 255, 0.9), rgba(0, 100, 255, 0.4));
    border: 3px solid rgba(0, 200, 255, 1);
    border-radius: 50%;
    pointer-events: none;
    z-index: 2147483647;
    box-shadow: 
      0 0 20px rgba(0, 150, 255, 0.8),
      0 0 40px rgba(0, 100, 255, 0.5),
      inset 0 0 10px rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: all 0.05s ease-out;
    display: block;
    left: 50%;
    top: 50%;
  \`;
  
  // Create center dot
  const centerDot = document.createElement('div');
  centerDot.style.cssText = \`
    position: absolute;
    top: 50%;
    left: 50%;
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
  \`;
  cursor.appendChild(centerDot);
  
  // Create pulse ring
  const pulse = document.createElement('div');
  pulse.style.cssText = \`
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    border: 2px solid rgba(0, 200, 255, 0.5);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: rpaPulse 1.5s ease-out infinite;
  \`;
  cursor.appendChild(pulse);
  
  // Add animations
  const style = document.createElement('style');
  style.textContent = \`
    @keyframes rpaPulse {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
      100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
    }
    @keyframes rpaClick {
      0% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-50%, -50%) scale(0.7); background: radial-gradient(circle, rgba(0, 255, 100, 0.9), rgba(0, 200, 100, 0.4)); }
      100% { transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes rpaTyping {
      0%, 100% { border-color: rgba(0, 255, 150, 1); }
      50% { border-color: rgba(0, 200, 255, 1); }
    }
  \`;
  document.head.appendChild(style);
  
  // Add to document
  function addCursor() {
    if (document.body && !document.getElementById('rpa-blue-cursor')) {
      document.body.appendChild(cursor);
      console.log('[RPA] Blue cursor added to page');
    }
  }
  
  if (document.body) {
    addCursor();
  } else {
    document.addEventListener('DOMContentLoaded', addCursor);
  }
  
  // Also try after a delay in case of dynamic content
  setTimeout(addCursor, 500);
  setTimeout(addCursor, 1500);
  
  // Track position
  window.__rpaMouseX = window.innerWidth / 2;
  window.__rpaMouseY = window.innerHeight / 2;
  
  // Update cursor position function (called from Playwright)
  window.__rpaMoveCursor = function(x, y) {
    window.__rpaMouseX = x;
    window.__rpaMouseY = y;
    const c = document.getElementById('rpa-blue-cursor');
    if (c) {
      c.style.left = x + 'px';
      c.style.top = y + 'px';
      c.style.display = 'block';
    }
  };
  
  // Click animation function
  window.__rpaClickCursor = function() {
    const c = document.getElementById('rpa-blue-cursor');
    if (c) {
      c.style.animation = 'rpaClick 0.3s ease-out';
      setTimeout(() => { if (c) c.style.animation = ''; }, 300);
    }
  };
  
  // Typing indicator function
  window.__rpaTypingCursor = function(active) {
    const c = document.getElementById('rpa-blue-cursor');
    if (c) {
      if (active) {
        c.style.animation = 'rpaTyping 0.5s ease-in-out infinite';
        c.style.background = 'radial-gradient(circle, rgba(0, 255, 150, 0.9), rgba(0, 200, 100, 0.4))';
      } else {
        c.style.animation = '';
        c.style.background = 'radial-gradient(circle, rgba(0, 150, 255, 0.9), rgba(0, 100, 255, 0.4))';
      }
    }
  };
  
  // Listen for mouse movement (synced with Playwright)
  document.addEventListener('mousemove', (e) => {
    window.__rpaMouseX = e.clientX;
    window.__rpaMouseY = e.clientY;
    const c = document.getElementById('rpa-blue-cursor');
    if (c) {
      c.style.left = e.clientX + 'px';
      c.style.top = e.clientY + 'px';
      c.style.display = 'block';
    }
  }, true);
  
  // Click effects
  document.addEventListener('mousedown', () => {
    const c = document.getElementById('rpa-blue-cursor');
    if (c) {
      c.style.transform = 'translate(-50%, -50%) scale(0.8)';
      c.style.background = 'radial-gradient(circle, rgba(0, 255, 100, 1), rgba(0, 200, 100, 0.6))';
    }
  }, true);
  
  document.addEventListener('mouseup', () => {
    const c = document.getElementById('rpa-blue-cursor');
    if (c) {
      c.style.transform = 'translate(-50%, -50%) scale(1)';
      c.style.background = 'radial-gradient(circle, rgba(0, 150, 255, 0.9), rgba(0, 100, 255, 0.4))';
    }
  }, true);
  
  // Keyboard effects
  document.addEventListener('keydown', () => {
    const c = document.getElementById('rpa-blue-cursor');
    if (c) {
      c.style.borderColor = 'rgba(0, 255, 150, 1)';
    }
  }, true);
  
  document.addEventListener('keyup', () => {
    const c = document.getElementById('rpa-blue-cursor');
    if (c) {
      c.style.borderColor = 'rgba(0, 200, 255, 1)';
    }
  }, true);
  
  console.log('[RPA] Blue cursor script initialized');
})();
`;

/**
 * Inject blue cursor overlay into a page
 */
export async function injectBlueCursor(page: Page): Promise<void> {
  try {
    // Inject the script
    await page.evaluate(BLUE_CURSOR_SCRIPT);
    
    // Verify injection
    const hasControl = await page.evaluate(() => {
      return typeof (window as any).__rpaMoveCursor === 'function';
    });
    
    if (hasControl) {
      logger.debug('Blue cursor injected and verified');
    } else {
      logger.warn('Blue cursor injection may have failed');
    }
  } catch (error) {
    logger.warn('Failed to inject blue cursor', { error });
  }
}

/**
 * Inject blue cursor into all pages in a context
 */
export async function injectBlueCursorToContext(context: BrowserContext): Promise<void> {
  try {
    // Add init script for all new pages
    await context.addInitScript(BLUE_CURSOR_SCRIPT);
    
    // Inject into existing pages
    const pages = context.pages();
    for (const page of pages) {
      await injectBlueCursor(page);
    }
    
    // Inject into new pages automatically
    context.on('page', async (page) => {
      // Wait for page to be ready
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await injectBlueCursor(page);
    });
    
    logger.info('Blue cursor setup for context');
  } catch (error) {
    logger.error('Failed to setup blue cursor for context', { error });
  }
}

/**
 * Move cursor to position with animation
 */
export async function moveCursorTo(page: Page, x: number, y: number): Promise<void> {
  try {
    await page.evaluate(({ x, y }) => {
      if (typeof (window as any).__rpaMoveCursor === 'function') {
        (window as any).__rpaMoveCursor(x, y);
      }
    }, { x, y });
  } catch {
    // Ignore errors (page might be navigating)
  }
}

/**
 * Show click animation
 */
export async function showClickAnimation(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      if (typeof (window as any).__rpaClickCursor === 'function') {
        (window as any).__rpaClickCursor();
      }
    });
  } catch {
    // Ignore errors
  }
}

/**
 * Show/hide typing indicator
 */
export async function showTypingIndicator(page: Page, active: boolean): Promise<void> {
  try {
    await page.evaluate((isActive) => {
      if (typeof (window as any).__rpaTypingCursor === 'function') {
        (window as any).__rpaTypingCursor(isActive);
      }
    }, active);
  } catch {
    // Ignore errors
  }
}

/**
 * Sync cursor with mouse position during movement
 */
export async function syncCursorWithMouse(
  page: Page,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  steps: number = 20
): Promise<void> {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;
    await moveCursorTo(page, x, y);
    await page.waitForTimeout(10);
  }
}

/**
 * Show status overlay on the page so user knows what's happening
 */
export async function showStatusOverlay(page: Page, message: string, type: 'info' | 'success' | 'action' = 'info'): Promise<void> {
  try {
    await page.evaluate(({ msg, msgType }) => {
      // Remove existing overlay
      const existing = document.getElementById('rpa-status-overlay');
      if (existing) existing.remove();
      
      // Create status overlay
      const overlay = document.createElement('div');
      overlay.id = 'rpa-status-overlay';
      
      const bgColor = msgType === 'success' ? 'rgba(0, 200, 100, 0.95)' 
        : msgType === 'action' ? 'rgba(0, 150, 255, 0.95)'
        : 'rgba(50, 50, 50, 0.95)';
      
      overlay.style.cssText = 
        'position: fixed;' +
        'top: 20px;' +
        'left: 50%;' +
        'transform: translateX(-50%);' +
        'background: ' + bgColor + ';' +
        'color: white;' +
        'padding: 15px 30px;' +
        'border-radius: 10px;' +
        'font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;' +
        'font-size: 16px;' +
        'font-weight: 600;' +
        'z-index: 2147483646;' +
        'box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);' +
        'display: flex;' +
        'align-items: center;' +
        'gap: 12px;' +
        'animation: rpaSlideIn 0.3s ease-out;';
      
      // Add animation style
      if (!document.getElementById('rpa-status-style')) {
        const style = document.createElement('style');
        style.id = 'rpa-status-style';
        style.textContent = 
          '@keyframes rpaSlideIn {' +
          '  from { transform: translateX(-50%) translateY(-20px); opacity: 0; }' +
          '  to { transform: translateX(-50%) translateY(0); opacity: 1; }' +
          '}' +
          '@keyframes rpaSpin {' +
          '  from { transform: rotate(0deg); }' +
          '  to { transform: rotate(360deg); }' +
          '}';
        document.head.appendChild(style);
      }
      
      // Add icon
      const icon = document.createElement('span');
      icon.style.cssText = 'font-size: 20px;';
      icon.textContent = msgType === 'success' ? '✓' : msgType === 'action' ? '>' : 'i';
      overlay.appendChild(icon);
      
      // Add message
      const text = document.createElement('span');
      text.textContent = msg;
      overlay.appendChild(text);
      
      // Add spinner for action type
      if (msgType === 'action') {
        const spinner = document.createElement('span');
        spinner.style.cssText = 'display: inline-block; width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: rpaSpin 1s linear infinite;';
        overlay.appendChild(spinner);
      }
      
      document.body.appendChild(overlay);
      
      // Auto-hide success after delay
      if (msgType === 'success') {
        setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 2000);
      }
    }, { msg: message, msgType: type });
  } catch {
    // Ignore errors
  }
}

/**
 * Hide the status overlay
 */
export async function hideStatusOverlay(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const overlay = document.getElementById('rpa-status-overlay');
      if (overlay) overlay.remove();
    });
  } catch {
    // Ignore
  }
}
