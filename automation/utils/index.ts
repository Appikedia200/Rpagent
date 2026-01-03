/**
 * @fileoverview Automation Utilities Index
 * @module automation/utils
 *
 * Central export for all automation utilities.
 */

export {
  generateCompleteAccount,
  generateAccountBatch,
  generateRandomData,
  generateStrongPassword,
  generatePhoneNumber,
  generateAddress,
  generateBirthDate,
  generateChannelName,
  generateVideoComment,
} from './data-generator';

export type {
  GeneratedAccount,
  GeneratedAddress,
  GeneratedBirthDate,
} from './data-generator';


