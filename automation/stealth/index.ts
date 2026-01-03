/**
 * @fileoverview Stealth Module Index
 * @module automation/stealth
 *
 * Re-exports all stealth-related functionality.
 */

export { applyStealthToContext, applyStealthToPage, StealthConfigError } from './stealth-config';
export { HumanBehavior } from './human-behavior';
export { FingerprintManager } from './fingerprint-manager';
export { MetaDetection } from './meta-detection';
export { BehavioralAI } from './behavioral-ai';
export { NetworkStealth } from './network-stealth';
export { CaptchaSolver } from './captcha-solver';
export { 
  TwoCaptchaSolver, 
  initializeTwoCaptcha, 
  getTwoCaptchaSolver,
  CaptchaType,
} from './captcha-solver-2captcha';

export {
  extractRealFingerprint,
  cacheFingerprint,
  getCachedFingerprint,
  getFingerprintDisplayHash,
  fingerprintsMatch,
} from './real-fingerprint';

export type { RealFingerprint } from './real-fingerprint';

export {
  getCurrentRegion,
  setCurrentRegion,
  getRegion,
  getAllRegions,
  getRandomUserAgent,
  getVariedGeolocation,
  REGIONS,
} from './region-config';

export type { RegionConfig } from './region-config';

export {
  detectIPGeolocation,
  getDefaultGeolocation,
  getCachedGeolocation,
  addGeolocationVariation,
} from './ip-geolocation';

export type { IPGeolocationData } from './ip-geolocation';

export {
  applyProfessionalStealth,
  applyProfessionalStealthToPage,
} from './professional-stealth';

