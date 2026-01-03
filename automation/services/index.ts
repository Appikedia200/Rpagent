/**
 * @fileoverview Automation Services Index
 * @module automation/services
 *
 * Re-exports all automation services.
 */

export {
  CaptchaSolverService,
  getCaptchaSolverService,
  type CaptchaSolverConfig,
  type CaptchaSolveResult,
  type CaptchaTask,
  type ReCaptchaV2Task,
  type ReCaptchaV3Task,
  type HCaptchaTask,
  type ImageCaptchaTask,
} from './captcha-solver.service';

export {
  PhoneNumberService,
  getPhoneNumberService,
  type PhoneNumber,
  type ReceivedSMS,
  type WebhookConfig,
  type TelnyxConfig,
} from './phone-number.service';

