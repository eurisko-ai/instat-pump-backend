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
    const { pageTitle, pageContent, pageDescription } = req.body as { 
      pageTitle?: string; 
      pageContent?: string;
      pageDescription?: string;
    };

    if (!pageContent || typeof pageContent !== 'string') {
      return res.status(400).json({ error: 'pageContent is required' });
    }

    const prompt = [
      'You are a memecoin creator analyzing news/web content. Your task is to extract the MAIN TOPIC and create a fun memecoin based on it.',
      '',
      'CRITICAL: Focus on the PRIMARY subject/event of the content, NOT secondary mentions or people mentioned in passing.',
      '',
      'Page Title: ' + (pageTitle || 'Untitled'),
      'Page Description: ' + (pageDescription || 'None'),
      '',
      'INSTRUCTIONS:',
      '1. Identify the MAIN TOPIC or PRIMARY SUBJECT of this content (ignore secondary mentions)',
      '2. Think about what this story is REALLY about - the core theme or event',
      '3. Create a memecoin NAME that captures the essence of this main topic (1-3 words, fun, creative)',
      '4. Create a SYMBOL derived from the name (3-6 uppercase letters)',
      '5. Write a brief DESCRIPTION explaining the memecoin concept related to the main topic',
      '',
      'EXAMPLES:',
      '- Article about "Tech CEO arrested": Main topic = tech scandal/justice → "JusticeCode" or "TechFail"',
      '- Article about "Celebrity dies": Main topic = tribute/legacy → "LegacyMem" or "TributeCoin"',
      '- Article about "Stock market crash": Main topic = market chaos → "CrashTest" or "MarketDoom"',
      '',
      'Return ONLY valid JSON in this exact format:',
      '{"name":"CoinName","symbol":"COIN","description":"Description here"}',
      '',
      'PAGE CONTENT:',
      pageContent.slice(0, 3000),
    ].join('\n');

    let parsed: Partial<GeneratedMetadata> | null = null;

    // Try Ollama first
    try {
      console.log('[Metadata] Attempting Ollama analysis...');
      // Use host.docker.internal on Docker for Mac/Windows, or 127.0.0.1:11434 on Linux host network
      const ollamaUrl = process.env.OLLAMA_URL || 'http://host.docker.internal:11434/api/generate';
      console.log('[Metadata] Ollama URL:', ollamaUrl);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const ollamaResponse = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'phi:latest',
          prompt,
          stream: false,
          options: { temperature: 0.7 },
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);

      if (ollamaResponse.ok) {
        const data = (await ollamaResponse.json()) as { response?: string };
        parsed = parseJsonResponse(data.response || '');
        console.log('[Metadata] Ollama analysis complete:', parsed);
      } else {
        console.log('[Metadata] Ollama unavailable, using fallback');
      }
    } catch (error) {
      console.log('[Metadata] Ollama connection failed, using fallback:', error);
    }

    // Fallback: mock metadata if Ollama fails
    if (!parsed?.name || !parsed?.symbol || !parsed?.description) {
      console.log('[Metadata] Using mock metadata fallback');
      const words = (pageTitle || pageContent || 'Crypto')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 2);
      
      const mockName = words.length > 0 
        ? words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
        : 'CryptoMeme';
      
      const mockSymbol = mockName.slice(0, 4).toUpperCase().padEnd(3, 'X').slice(0, 6);

      parsed = {
        name: mockName,
        symbol: mockSymbol,
        description: `A memecoin inspired by: ${(pageTitle || pageContent).slice(0, 50)}...`,
      };
    }

    const name = String(parsed.name || '').trim();
    const description = String(parsed.description || '').trim();
    const symbol = ensureSymbol(String(parsed.symbol || ''), name);

    const metadata: GeneratedMetadata = {
      name,
      symbol,
      description,
    };

    console.log('[Metadata] Generated mock metadata:', metadata);
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
