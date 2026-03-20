import { Router, Request, Response } from 'express';

const router = Router();

type ImageGenerationRequest = {
  style: 'neon' | 'pixel' | '3d';
  coinName: string;
  coinSymbol: string;
  coinDescription: string;
};

const getStylePrompt = (
  style: 'neon' | 'pixel' | '3d',
  coinName: string,
  coinSymbol: string,
  coinDescription: string
): string => {
  const basePrompt = `Create a memecoin logo for "${coinName}" (symbol: ${coinSymbol}). Description: ${coinDescription}.`;

  switch (style) {
    case 'neon':
      return `${basePrompt} Style: Neon cyberpunk with glowing electric blue, hot pink, and cyan colors. Futuristic, tech aesthetic with grid patterns and blockchain vibes. Square logo, 512x512px.`;
    case 'pixel':
      return `${basePrompt} Style: 8-bit pixel art, retro gaming style, 16-bit aesthetic. Bright, playful colors. Nostalgic 90s/2000s video game look. Square logo, 512x512px.`;
    case '3d':
      return `${basePrompt} Style: Modern 3D rendered logo with glossy finish, metallic gold/silver accents, luxury appearance, polished and professional. Square logo, 512x512px.`;
    default:
      return basePrompt;
  }
};

/**
 * POST /api/generate-image
 * Generate memecoin logo using Nano Banana (Gemini 3 Nano)
 */
router.post('/api/generate-image', async (req: Request, res: Response) => {
  try {
    const { style, coinName, coinSymbol, coinDescription } = req.body as ImageGenerationRequest;

    if (!style || !coinName || !coinSymbol) {
      return res.status(400).json({
        error: 'style, coinName, and coinSymbol are required',
      });
    }

    const prompt = getStylePrompt(style, coinName, coinSymbol, coinDescription);

    console.log('[Image] Generating image with style:', style);
    console.log('[Image] Prompt:', prompt.slice(0, 100) + '...');

    // TODO: Call Nano Banana API here
    // For now, return mock placeholder
    const mockImageUrl = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzExMTExMSIvPjx0ZXh0IHg9IjI1NiIgeT0iMjU2IiBmb250LXNpemU9IjQ4IiBmaWxsPSIjODZlZmFjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+JHtjb2luU3ltYm9sfTwvdGV4dD48L3N2Zz4=`;

    console.log('[Image] Generated (mock) image for:', coinSymbol);

    return res.json({
      imageUrl: mockImageUrl,
      style,
      coinSymbol,
    });
  } catch (error) {
    console.error('[Image] Generation error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate image',
    });
  }
});

export default router;
