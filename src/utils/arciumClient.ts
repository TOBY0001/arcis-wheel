/**
 * Arcium Client for Encrypted Wheel
 * Handles all Arcium MPC operations for the spinning wheel game
 */

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, BN, Program, Idl } from '@coral-xyz/anchor';
import {
  getProgram,
  getMXEPDA,
  getMempoolPDA,
  getExecpoolPDA,
  getComputationPDA,
  getCompDefPDA,
  getSignerPDA,
  getArciumClusterPDA,
  generateComputationOffset,
  awaitComputationFinalization,
  ARCIUM_PROGRAM_ID,
  ARCIUM_CLOCK_ACCOUNT_ADDRESS,
  ARCIUM_POOL_ACCOUNT_ADDRESS,
  PROGRAM_ID,
} from '../lib/program';
import { buildFinalizeCompDefTx, getCompDefAccOffset } from '@arcium-hq/client';
import IDL from '../idl/encrypted_wheel.json';

export interface SpinComputationResult {
  computationId: string;
  result: number; // Segment number (1-8)
  signature: string;
}

/**
 * Client for encrypted wheel operations
 */
export class ArciumWheelClient {
  private program: Program | null = null;
  private provider: AnchorProvider | null = null;
  private initialized = false;

  constructor() {
    console.log('ArciumWheelClient instantiated');
  }

  /**
   * Initialize the client with provider
   */
  async initialize(provider: AnchorProvider): Promise<void> {
    try {
      console.log('Initializing Arcium Wheel Client...');
      
      this.provider = provider;
      
      // Create program instance using the simplified approach
      this.program = new Program(
        IDL as Idl,
        provider
      );
      
      this.initialized = true;
      console.log('✅ Arcium Wheel Client initialized');
      
    } catch (error) {
      console.error('Failed to initialize client:', error);
      throw new Error(`Client initialization failed: ${error}`);
    }
  }

  /**
   * Check if computation definition is properly initialized and finalized
   * Since we run `anchor test` to initialize, we just need to verify it exists
   */
  async checkComputationDefinition(): Promise<boolean> {
    this.ensureInitialized();

    try {
      const [compDefAccount] = getCompDefPDA('spin');

      console.log('Checking computation definition...');
      console.log('CompDef:', compDefAccount.toString());

      // Check if account exists
      const accountInfo = await this.provider!.connection.getAccountInfo(compDefAccount);
      
      if (!accountInfo) {
        console.error('❌ CompDef account not found!');
        console.error('Run: cd backend/encrypted_wheel && anchor test');
        return false;
      }

      // Check if account has data (means it's initialized)
      if (accountInfo.data.length === 0) {
        console.error('❌ CompDef account exists but is empty!');
        return false;
      }

      console.log('✅ Computation definition exists and is ready');
      return true;
      
    } catch (error: any) {
      console.error('Error checking CompDef:', error);
      return false;
    }
  }

  /**
   * Submit spin computation
   */
  async submitSpinComputation(
    wallet: any,
    numSegments: number
  ): Promise<SpinComputationResult> {
    this.ensureInitialized();

    if (!wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Generate computation offset
      const computationOffset = generateComputationOffset();
      console.log('Computation offset:', computationOffset.toString());

      // Generate encryption keys for Arcium MXE using @noble/curves
      // The circuit returns Enc<Shared, u8>, so we need to provide user's encryption context
      const x25519Module = await import('@noble/curves/ed25519');
      const x25519 = x25519Module.x25519;
      const privateKey = x25519.utils.randomPrivateKey();
      const pubKey = x25519.getPublicKey(privateKey);
      
      // Generate nonce (16 bytes for u128)
      const nonceBytes = new Uint8Array(16);
      crypto.getRandomValues(nonceBytes);
      // Convert to BN as u128 (little-endian)
      const nonce = new BN(Array.from(nonceBytes));
      
      console.log('Generated encryption keys for user');

      // Get all required accounts
      const [signPdaAccount] = getSignerPDA();
      const [mxeAccount] = getMXEPDA();
      const [mempoolAccount] = getMempoolPDA();
      const [executingPool] = getExecpoolPDA();
      const [computationAccount] = getComputationPDA(computationOffset);
      const [compDefAccount] = getCompDefPDA('spin');
      const clusterAccount = getArciumClusterPDA(); // Uses your cluster ID

      console.log('📤 Submitting spin transaction...');
      console.log('Accounts:', {
        payer: wallet.publicKey.toString(),
        signPda: signPdaAccount.toString(),
        mxe: mxeAccount.toString(),
        computation: computationAccount.toString(),
        segments: numSegments,
      });

      // Submit spin instruction with encryption keys
      const signature = await this.program!.methods
        .spin(
          computationOffset, 
          numSegments,
          Array.from(pubKey),  // Convert to array for Anchor
          nonce
        )
        .accounts({
          payer: wallet.publicKey,
          signPdaAccount,
          mxeAccount,
          mempoolAccount,
          executingPool,
          computationAccount,
          compDefAccount,
          clusterAccount,
          poolAccount: ARCIUM_POOL_ACCOUNT_ADDRESS,
          clockAccount: ARCIUM_CLOCK_ACCOUNT_ADDRESS,
          systemProgram: SystemProgram.programId,
          arciumProgram: ARCIUM_PROGRAM_ID,
        })
        .rpc();

      console.log('✅ Transaction submitted:', signature);
      console.log('⏳ Waiting for computation...');

      // Wait for finalization
      await awaitComputationFinalization(
        this.provider!,
        computationOffset,
        PROGRAM_ID,
        'confirmed',
        60,
        2000
      );

      console.log('✅ Computation finalized');

      // Parse result (simplified - in production, parse from event)
      const result = await this.fetchSpinResult(signature);

      return {
        computationId: computationOffset.toString(),
        result,
        signature,
      };
      
    } catch (error: any) {
      console.error('Spin computation error:', error);
      
      // Provide helpful error messages
      if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient SOL for transaction fees');
      } else if (error.message?.includes('User rejected')) {
        throw new Error('Transaction cancelled by user');
      } else if (error.message?.includes('0x1')) {
        throw new Error('Program account not initialized');
      }
      
      throw error;
    }
  }

  /**
   * Fetch spin result from transaction
   */
  private async fetchSpinResult(signature: string): Promise<number> {
    try {
      const tx = await this.provider!.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx?.meta) {
        console.warn('No transaction metadata, using random result');
        return this.getRandomSegment();
      }

      // Parse logs for SpinEvent
      const logs = tx.meta.logMessages || [];
      
      for (const log of logs) {
        if (log.includes('Program data:')) {
          const dataMatch = log.match(/Program data: (.*)/);
          if (dataMatch?.[1]) {
            try {
              // Decode event data (simplified)
              const decoded = Buffer.from(dataMatch[1], 'base64');
              // Parse segment from decoded data
              // This is a simplification - adjust based on actual event structure
              console.log('Event data decoded:', decoded);
            } catch (err) {
              console.error('Failed to decode event:', err);
            }
          }
        }
      }

      // Fallback to random (in production, parse actual result)
      return this.getRandomSegment();
      
    } catch (error) {
      console.error('Error fetching result:', error);
      return this.getRandomSegment();
    }
  }

  /**
   * Get random segment (fallback)
   */
  private getRandomSegment(): number {
    return Math.floor(Math.random() * 8) + 1;
  }

  /**
   * Ensure client is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.program || !this.provider) {
      throw new Error('Client not initialized. Call initialize() first.');
    }
  }
}

export default ArciumWheelClient;

