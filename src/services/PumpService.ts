import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { PUMP_SDK } from '../sdk/PumpSDK';
import fs from 'fs';
import path from 'path';

interface CreateTokenRequest {
  name: string;
  symbol: string;
  description: string;
  imageBase64?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  buyAmount?: number;
  metadataUri: string;
}

interface CreateTokenResponse {
  mint: string;
  signature: string;
  status: 'created' | 'creating';
}

export class PumpService {
  private connection: Connection;
  private payer: Keypair;
  private rpcUrl: string;

  constructor(rpcUrl: string, walletSecretKey: string) {
    this.rpcUrl = rpcUrl;
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Decode wallet secret key from base58
    try {
      const secret = Buffer.from(walletSecretKey, 'base64');
      this.payer = Keypair.fromSecretKey(new Uint8Array(secret));
    } catch (error) {
      throw new Error(`Invalid wallet secret key: ${error}`);
    }
  }

  /**
   * Create a token on Pump.fun using create_v2
   */
  async createToken(request: CreateTokenRequest): Promise<CreateTokenResponse> {
    try {
      const mint = Keypair.generate();

      console.log('[Pump] Creating token...');
      console.log(`  Mint: ${mint.publicKey.toBase58()}`);
      console.log(`  Name: ${request.name}`);
      console.log(`  Symbol: ${request.symbol}`);

      // Build create_v2 instruction
      const instruction = await PUMP_SDK.createV2Instruction({
        mint: mint.publicKey,
        name: request.name,
        symbol: request.symbol,
        uri: request.metadataUri,
        creator: this.payer.publicKey,
        user: this.payer.publicKey,
        mayhemMode: false,
        cashback: false,
      });

      const tx = new Transaction().add(instruction);
      tx.feePayer = this.payer.publicKey;
      tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

      // Sign with both payer and mint keypair
      const signature = await sendAndConfirmTransaction(this.connection, tx, [
        this.payer,
        mint,
      ]);

      console.log(`✅ Token created: ${mint.publicKey.toBase58()}`);
      console.log(`📝 TX: ${signature}`);

      return {
        mint: mint.publicKey.toBase58(),
        signature,
        status: 'created',
      };
    } catch (error) {
      console.error('[Pump] Error creating token:', error);
      throw error;
    }
  }

  /**
   * Buy tokens after creation (optional)
   */
  async buyToken(mint: string, solAmount: number): Promise<string> {
    try {
      console.log('[Pump] Buying token...');
      console.log(`  Mint: ${mint}`);
      console.log(`  Amount: ${solAmount} SOL`);

      // This would use the buy instruction from Pump SDK
      // Implementation depends on available SDK methods
      // For now, placeholder
      throw new Error('Buy functionality not yet implemented - requires Pump SDK buy instruction');
    } catch (error) {
      console.error('[Pump] Error buying token:', error);
      throw error;
    }
  }

  /**
   * Get payer public key
   */
  getPayerPublicKey(): string {
    return this.payer.publicKey.toBase58();
  }

  /**
   * Validate metadata URI is accessible
   */
  async validateMetadataUri(uri: string): Promise<boolean> {
    try {
      const response = await fetch(uri);
      return response.ok;
    } catch {
      return false;
    }
  }
}
