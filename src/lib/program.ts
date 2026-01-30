import { AnchorProvider, Program, Idl, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { EncryptedWheel } from '../types/encrypted_wheel';
import IDL_JSON from '../idl/encrypted_wheel.json';

// Cast JSON to proper IDL type
const IDL = IDL_JSON as Idl;

// Program ID deployed to devnet
export const PROGRAM_ID = new PublicKey('G6sRoE2RjEqgpX5Yzr3j4ogxQMLxUgW3uAV183cjpujm');

// Arcium Program ID (v0.6.4)
export const ARCIUM_PROGRAM_ID = new PublicKey('Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ');

// Arcium Clock Account Address (v0.6.4)
// According to migration docs, these addresses may have changed with the new program ID
// Derive from Arcium program ID using the correct seed
export function getArciumClockAccountAddress(): PublicKey {
  // Clock account is a PDA with seed "ClockAccount" under Arcium program
  const [clockPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('ClockAccount')],
    ARCIUM_PROGRAM_ID
  );
  return clockPDA;
}

export function getArciumFeePoolAccountAddress(): PublicKey {
  // FeePool account is a PDA with seed "FeePool" under Arcium program  
  const [poolPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('FeePool')],
    ARCIUM_PROGRAM_ID
  );
  return poolPDA;
}

// Export constants using the derived addresses for v0.6.4
export const ARCIUM_CLOCK_ACCOUNT_ADDRESS = getArciumClockAccountAddress();
export const ARCIUM_POOL_ACCOUNT_ADDRESS = getArciumFeePoolAccountAddress();

// Your deployed cluster ID (where your program is deployed) - v0.5.1 cluster offset
export const CLUSTER_ID = 456;

/**
 * Get the program instance
 */
export function getProgram(connection: Connection, wallet: any): Program<EncryptedWheel> {
  if (!wallet) {
    throw new Error('Wallet is required');
  }

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  return new Program(IDL, provider) as Program<EncryptedWheel>;
}

/**
 * Arcium PDA derivation functions
 */
import {
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getClusterAccAddress,
  getArciumAccountBaseSeed,
  getArciumProgramId,
} from '@arcium-hq/client';

export function getMXEPDA(): [PublicKey, number] {
  return [getMXEAccAddress(PROGRAM_ID), 0];
}

export function getMempoolPDA(): [PublicKey, number] {
  return [getMempoolAccAddress(CLUSTER_ID), 0];
}

export function getExecpoolPDA(): [PublicKey, number] {
  return [getExecutingPoolAccAddress(CLUSTER_ID), 0];
}

export function getComputationPDA(offset: BN): [PublicKey, number] {
  return [getComputationAccAddress(CLUSTER_ID, offset), 0];
}

export function getCompDefPDA(compDefName: string): [PublicKey, number] {
  // Use Arcium client to compute the correct PDA
  const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
  const offsetUint8Array = getCompDefAccOffset(compDefName);
  
  const [compDefPDA] = PublicKey.findProgramAddressSync(
    [baseSeedCompDefAcc, PROGRAM_ID.toBuffer(), offsetUint8Array],
    getArciumProgramId()
  );
  
  return [compDefPDA, 0];
}

export function getClusterPDA(): [PublicKey, number] {
  return [getClusterAccAddress(CLUSTER_ID), 0]; // Use your deployed cluster ID
}

/**
 * Get Signer PDA (ArciumSignerAccount seed)
 */
export function getSignerPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('ArciumSignerAccount')],
    PROGRAM_ID
  );
}

/**
 * Generate random computation offset
 */
export function generateComputationOffset(): BN {
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  // BN expects bytes in little-endian format when passed as Uint8Array
  return new BN(randomBytes, 'le');
}

/**
 * Get default RPC connection
 */
export function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_HOST || 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Utility to fetch MXE public key
 */
export async function getMXEPublicKey(
  provider: AnchorProvider,
  programId: PublicKey
): Promise<Uint8Array> {
  const [mxeAddress] = getMXEPDA();
  const mxeAccount = await provider.connection.getAccountInfo(mxeAddress);
  
  if (!mxeAccount) {
    throw new Error('MXE account not found');
  }

  // Parse MXE account data to extract x25519 public key
  // Assuming the public key is stored in the account data
  // You may need to adjust this based on your actual account structure
  const data = mxeAccount.data;
  
  // Skip discriminator (8 bytes) and authority (33 bytes for Option<Pubkey>)
  // Then cluster (5 bytes for Option<u32>), then x25519_pubkey
  const offset = 8 + 33 + 5 + 1; // +1 for enum discriminator
  return data.slice(offset, offset + 32);
}

/**
 * Utility to await computation finalization
 */
export async function awaitComputationFinalization(
  provider: AnchorProvider,
  computationOffset: BN,
  programId: PublicKey,
  commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed',
  maxRetries: number = 60,
  retryDelay: number = 2000
): Promise<string | null> {
  const [computationAccount] = getComputationPDA(computationOffset);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const accountInfo = await provider.connection.getAccountInfo(
        computationAccount,
        commitment
      );

      if (accountInfo) {
        // Check if computation is finalized by examining account data
        // This is a simplified check - adjust based on your actual computation account structure
        console.log(`Computation finalized after ${i + 1} attempts`);
        return 'finalized';
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } catch (error) {
      console.error('Error checking computation status:', error);
    }
  }

  throw new Error('Computation finalization timeout');
}

/**
 * Helper to get cluster account address (returns PublicKey directly)
 */
export function getArciumClusterPDA(): PublicKey {
  return getClusterAccAddress(CLUSTER_ID);
}

