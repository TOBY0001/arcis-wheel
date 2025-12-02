/**
 * Main exports for Encrypted Wheel client
 * Import everything you need from this single file
 */

// Program configuration and PDAs
export {
  PROGRAM_ID,
  ARCIUM_PROGRAM_ID,
  ARCIUM_CLOCK_ACCOUNT_ADDRESS,
  ARCIUM_POOL_ACCOUNT_ADDRESS,
  CLUSTER_ID,
  getProgram,
  getConnection,
  getMXEPDA,
  getMempoolPDA,
  getExecpoolPDA,
  getComputationPDA,
  getCompDefPDA,
  getSignerPDA,
  getClusterPDA,
  getArciumClusterPDA,
  generateComputationOffset,
  getMXEPublicKey,
  awaitComputationFinalization,
} from './program';

// Types
export type {
  EncryptedWheel,
} from '../types/encrypted_wheel';

// Client
export { default as ArciumWheelClient } from '../utils/arciumClient';
export type { SpinComputationResult } from '../utils/arciumClient';

// Helpers
export {
  parseEncryptedOutput,
  decodeSpinResult,
  bnToNumber,
  numberToBN,
  generateRandomSeed,
  parseProgramLogs,
  confirmTransactionWithRetry,
  formatPublicKey,
  accountExists,
  getAccountDataSafe,
  retryWithBackoff,
} from '../utils/arciumHelpers';

