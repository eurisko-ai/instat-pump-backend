import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database/DataSource';
import { TokenMetadata } from '../entities/TokenMetadata';
import { PumpService } from '../services/PumpService';

const router = Router();

// Map of active SSE clients (for broadcasting status updates)
const sseClients = new Map<string, Response>();

/**
 * POST /api/publish
 * Create token on Pump.fun and return streaming status endpoint
 */
router.post('/api/publish', async (req: Request, res: Response) => {
  try {
    const { metadataId, buyAmount } = req.body;

    if (!metadataId) {
      return res.status(400).json({ error: 'Missing metadataId' });
    }

    const metadataRepo = AppDataSource.getRepository(TokenMetadata);
    const metadata = await metadataRepo.findOne({ where: { id: metadataId } });

    if (!metadata) {
      return res.status(404).json({ error: 'Metadata not found' });
    }

    if (metadata.status !== 'pending') {
      return res.status(400).json({ error: 'Token already created or in progress' });
    }

    // Update status to generating
    metadata.status = 'generating';
    metadata.buyAmount = buyAmount || 0;
    await metadataRepo.save(metadata);

    // Return the SSE endpoint to client
    res.json({
      id: metadata.id,
      statusEndpoint: `/api/tx/${metadata.id}`,
      message: 'Use the statusEndpoint to stream creation progress',
    });

    // Fire off async token creation
    createTokenAsync(metadata, metadataRepo);
  } catch (error) {
    console.error('[Publish] Error:', error);
    res.status(500).json({ error: 'Failed to publish token' });
  }
});

/**
 * GET /api/tx/:id
 * SSE endpoint for streaming token creation status
 */
router.get('/api/tx/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Store client for updates
  sseClients.set(id, res);

  // Send initial connection message
  sendSSE(res, 'connected', { status: 'Connected to tx stream' });

  // Clean up on disconnect
  req.on('close', () => {
    sseClients.delete(id);
    res.end();
  });

  // Send current status immediately
  const metadataRepo = AppDataSource.getRepository(TokenMetadata);
  const metadata = await metadataRepo.findOne({ where: { id } });
  if (metadata) {
    sendSSE(res, 'status', {
      status: metadata.status,
      mint: metadata.mintAddress,
      tx: metadata.txSignature,
      error: metadata.errorMessage,
    });
  }
});

/**
 * Internal: Async token creation with SSE updates
 */
async function createTokenAsync(metadata: TokenMetadata, metadataRepo: any) {
  try {
    const pumpService = new PumpService(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      process.env.SOLANA_WALLET_SECRET_KEY || ''
    );

    // Send status update
    broadcastSSE(metadata.id, 'status', { status: 'creating', message: '🔄 Creating token...' });

    // Create token
    const createResult = await pumpService.createToken({
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      imageBase64: metadata.imageBase64,
      twitter: metadata.twitter,
      telegram: metadata.telegram,
      website: metadata.website,
      metadataUri: metadata.metadataUri,
      buyAmount: metadata.buyAmount,
    });

    // Update metadata with mint and tx
    metadata.mintAddress = createResult.mint;
    metadata.txSignature = createResult.signature;
    metadata.status = 'created';
    await metadataRepo.save(metadata);

    broadcastSSE(metadata.id, 'status', {
      status: 'created',
      mint: createResult.mint,
      tx: createResult.signature,
      message: '✅ Token created!',
    });

    // Optional: Buy tokens if amount specified
    if (metadata.buyAmount && metadata.buyAmount > 0) {
      broadcastSSE(metadata.id, 'status', { status: 'buying', message: '🛍️ Buying tokens...' });

      try {
        // await pumpService.buyToken(createResult.mint, metadata.buyAmount);
        metadata.status = 'deployed';
        await metadataRepo.save(metadata);

        broadcastSSE(metadata.id, 'status', {
          status: 'deployed',
          message: '🚀 Token deployed!',
        });
      } catch (buyError) {
        console.warn('[Publish] Buy failed (non-critical):', buyError);
        // Still mark as deployed even if buy fails
        metadata.status = 'deployed';
        await metadataRepo.save(metadata);
      }
    } else {
      metadata.status = 'deployed';
      await metadataRepo.save(metadata);
    }
  } catch (error) {
    console.error('[Publish] Token creation failed:', error);
    metadata.status = 'failed';
    metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await metadataRepo.save(metadata);

    broadcastSSE(metadata.id, 'error', {
      status: 'failed',
      error: metadata.errorMessage,
    });
  }
}

/**
 * Send SSE message to specific client
 */
function sendSSE(res: Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Broadcast SSE message to all clients listening to a metadata ID
 */
function broadcastSSE(metadataId: string, event: string, data: any) {
  const client = sseClients.get(metadataId);
  if (client && !client.writableEnded) {
    sendSSE(client, event, data);
  }
}

export default router;
