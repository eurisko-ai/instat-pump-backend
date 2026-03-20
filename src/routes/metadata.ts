import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database/DataSource';
import { TokenMetadata } from '../entities/TokenMetadata';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * POST /api/metadata
 * Store token metadata and return metadata URI
 */
router.post('/api/metadata', async (req: Request, res: Response) => {
  try {
    const { name, symbol, description, imageBase64, twitter, telegram, website } = req.body;

    // Validate required fields
    if (!name || !symbol || !description || !imageBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const metadataRepo = AppDataSource.getRepository(TokenMetadata);

    // Create metadata record
    const metadata = metadataRepo.create({
      name,
      symbol,
      description,
      imageBase64,
      twitter,
      telegram,
      website,
      status: 'pending',
      metadataUri: '', // Will be set after storing
    });

    await metadataRepo.save(metadata);

    // Generate metadata URI pointing to this service
    const metadataUri = `${process.env.METADATA_BASE_URL}/${metadata.id}`;
    metadata.metadataUri = metadataUri;
    await metadataRepo.save(metadata);

    res.status(201).json({
      id: metadata.id,
      metadataUri,
      status: metadata.status,
    });
  } catch (error) {
    console.error('[Metadata] Error:', error);
    res.status(500).json({ error: 'Failed to store metadata' });
  }
});

/**
 * GET /metadata/:id
 * Serve metadata JSON for on-chain storage
 */
router.get('/metadata/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const metadataRepo = AppDataSource.getRepository(TokenMetadata);

    const metadata = await metadataRepo.findOne({ where: { id } });
    if (!metadata) {
      return res.status(404).json({ error: 'Metadata not found' });
    }

    // Return Pump.fun metadata format
    const metadataJson = {
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      image: metadata.imageBase64, // base64 data URI or IPFS URL
      showName: true,
      createdOn: metadata.createdAt.toISOString(),
      ...(metadata.twitter && { twitter: metadata.twitter }),
      ...(metadata.telegram && { telegram: metadata.telegram }),
      ...(metadata.website && { website: metadata.website }),
    };

    res.setHeader('Content-Type', 'application/json');
    res.json(metadataJson);
  } catch (error) {
    console.error('[Metadata] Error fetching:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

export default router;
