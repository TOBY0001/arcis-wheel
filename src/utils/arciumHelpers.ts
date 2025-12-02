/**
 * Arcium encryption and helper utilities
 * Handles encryption, decryption, and MPC-related operations
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Note: Encryption/decryption is handled directly in arciumClient.ts
// These helper functions are not currently used but kept for potential future use

/**
 * Parse encrypted output from computation result
 */
export function parseEncryptedOutput(
  encryptedStruct: any
): { key: Uint8Array; nonce: BN; ciphertext: Uint8Array } {
  return {
    key: new Uint8Array(encryptedStruct.encryptionKey),
    nonce: encryptedStruct.nonce,
    ciphertext: new Uint8Array(encryptedStruct.ciphertexts[0]),
  };
}

/**
 * Decode spin result from encrypted output
 */
export function decodeSpinResult(decryptedData: Uint8Array): number {
  // The decrypted data should be a u8 representing the segment (1-8)
  // Adjust this based on your actual data format
  if (decryptedData.length === 0) {
    throw new Error('Invalid decrypted data');
  }
  
  return decryptedData[0];
}

/**
 * Convert BN to number safely
 */
export function bnToNumber(bn: BN): number {
  return bn.toNumber();
}

/**
 * Convert number to BN
 */
export function numberToBN(num: number): BN {
  return new BN(num);
}

/**
 * Generate random seed for computation
 */
export function generateRandomSeed(): Uint8Array {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return seed;
}

/**
 * Parse program logs for events
 */
export function parseProgramLogs(logs: string[]): any[] {
  const events: any[] = [];
  
  for (const log of logs) {
    if (log.includes('Program data:')) {
      try {
        // Extract base64 data
        const dataMatch = log.match(/Program data: (.*)/);
        if (dataMatch && dataMatch[1]) {
          // Decode base64
          const decoded = Buffer.from(dataMatch[1], 'base64');
          events.push(decoded);
        }
      } catch (err) {
        console.error('Failed to parse log:', log, err);
      }
    }
  }
  
  return events;
}

/**
 * Wait for transaction confirmation with retry
 */
export async function confirmTransactionWithRetry(
  connection: Connection,
  signature: string,
  maxRetries: number = 30,
  retryDelay: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await connection.getSignatureStatus(signature);
      
      if (status?.value?.confirmationStatus === 'confirmed' || 
          status?.value?.confirmationStatus === 'finalized') {
        return true;
      }
      
      if (status?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
    }
  }
  
  throw new Error('Transaction confirmation timeout');
}

/**
 * Format public key for display
 */
export function formatPublicKey(pubkey: PublicKey, length: number = 4): string {
  const str = pubkey.toString();
  return `${str.slice(0, length)}...${str.slice(-length)}`;
}

/**
 * Check if account exists
 */
export async function accountExists(
  connection: Connection,
  account: PublicKey
): Promise<boolean> {
  try {
    const accountInfo = await connection.getAccountInfo(account);
    return accountInfo !== null;
  } catch (error) {
    console.error('Error checking account:', error);
    return false;
  }
}

/**
 * Get account data safely
 */
export async function getAccountDataSafe<T>(
  connection: Connection,
  account: PublicKey,
  parser: (data: Buffer) => T
): Promise<T | null> {
  try {
    const accountInfo = await connection.getAccountInfo(account);
    if (!accountInfo) {
      return null;
    }
    return parser(accountInfo.data);
  } catch (error) {
    console.error('Error fetching account data:', error);
    return null;
  }
}

/**
 * Retry async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

