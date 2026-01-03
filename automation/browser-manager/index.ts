/**
 * @fileoverview Browser Manager Index
 * @module automation/browser-manager
 *
 * Re-exports browser management functionality.
 */

export { 
  BrowserInstance, 
  BrowserInstanceError,
} from './browser-instance';

export type { BrowserInstanceState } from './browser-instance';

export { 
  BrowserPool, 
  BrowserPoolError,
  browserPool,
} from './browser-pool';

export type { ActiveBrowserInfo } from './browser-pool';

export {
  injectBlueCursor,
  injectBlueCursorToContext,
  moveCursorTo,
  showClickAnimation,
  showTypingIndicator,
  syncCursorWithMouse,
  showStatusOverlay,
  hideStatusOverlay,
} from './blue-cursor';

