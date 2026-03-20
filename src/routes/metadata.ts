import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database/DataSource';
import { TokenMetadata } from '../entities/TokenMetadata';

const router = Router();

type GeneratedMetadata = {
  name: string;
  symbol: string;
  description: string;
};

const ensureSymbol = (symbol: string, name: string): string => {
  const clean = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length >= 3 && clean.length <= 6) return clean;

  const fromName = (name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 6);

  if (fromName.length >= 3) return fromName;

  const padded = (clean || fromName || 'PUMP').padEnd(3, 'X');
  return padded.slice(0, 6);
};

const parseJsonResponse = (raw: string): Partial<GeneratedMetadata> | null => {
  if (!raw) return null;

  const jsonBlockMatch = raw.match(/\{[\s\S]*\}/);
  const payload = jsonBlockMatch ? jsonBlockMatch[0] : raw;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

/**
 * POST /api/generate-metadata
 * Generate coin metadata from page content via Ollama
 */
router.post('/api/generate-metadata', async (req: Request, res: Response) => {
  try {
    const { pageContent } = req.body as { pageContent?: string };

    if (!pageContent || typeof pageContent !== 'string') {
      return res.status(400).json({ error: 'pageContent is required' });
    }

    const prompt = [
      'Analyze this page content and generate a memecoin name, symbol, and description.',
      'Return ONLY valid JSON in this exact format: {"name":"...","symbol":"...","description":"..."}',
      'Rules: symbol must be uppercase, 3-6 characters, derived from the name.',
      '',
      'Page content:',
      pageContent,
    ].join('\n');

    const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
        },
      }),
    });

    if (!ollamaResponse.ok) {
      const text = await ollamaResponse.text();
      console.error('[Metadata] Ollama error:', text);
      return res.status(502).json({ error: 'Failed to generate metadata from Ollama' });
    }

    const data = (await ollamaResponse.json()) as { response?: string };
    const parsed = parseJsonResponse(data.response || '');

    if (!parsed?.name || !parsed?.description) {
      return res.status(500).json({ error: 'Invalid response returned by Ollama' });
    }

    const name = String(parsed.name).trim();
    const description = String(parsed.description).trim();
    const symbol = ensureSymbol(String(parsed.symbol || ''), name);

    const metadata: GeneratedMetadata = {
      name,
      symbol,
      description,
    };

    res.json(metadata);
  } catch (error) {
    console.error('[Metadata] Generate error:', error);
    res.status(500).json({ error: 'Failed to generate metadata' });
  }
});

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
