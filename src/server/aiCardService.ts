import { GoogleGenAI, Type } from '@google/genai';
import { CardLayoutId, GraphicPatternId } from '../utils/visitingCard.ts';

export interface GenerateCardStyleRequest {
  prompt: string;
  companyName?: string;
  jobTitle?: string;
}

export interface GeneratedCardStyle {
  themeName: string;
  tagline: string;
  layout: CardLayoutId;
  palette: {
    bgFront: string;
    bgBack: string;
    primaryText: string;
    secondaryText: string;
    accent: string;
    badgeBg: string;
    badgeText: string;
    previewColor: string;
  };
  pattern: GraphicPatternId;
  rationale: string;
}

/**
 * Curated preset archetypes for deterministic high-aesthetic fallbacks
 */
const STYLE_ARCHETYPES: Array<{
  keywords: string[];
  style: GeneratedCardStyle;
}> = [
  {
    keywords: ['cyber', 'neon', 'crypto', 'web3', 'tech', 'ai', 'game', 'future', 'robot'],
    style: {
      themeName: 'Cyberpunk Tokyo Neon',
      tagline: 'Architecting Intelligent Autonomous Systems',
      layout: 'neo-brutalist',
      palette: {
        bgFront: '#080C15',
        bgBack: '#04060A',
        primaryText: '#00F0FF',
        secondaryText: '#7088A5',
        accent: '#F43F5E',
        badgeBg: 'rgba(0, 240, 255, 0.15)',
        badgeText: '#00F0FF',
        previewColor: '#080C15'
      },
      pattern: 'cyber-grid',
      rationale: 'High-contrast midnight synthwave with electric cyan typography and digital grid structure.'
    }
  },
  {
    keywords: ['luxury', 'real estate', 'gold', 'realty', 'wealth', 'estate', 'onyx', 'executive', 'vip'],
    style: {
      themeName: 'Monaco Onyx & Champagne Gold',
      tagline: 'Exclusive Portfolio Management & Prime Real Estate',
      layout: 'accent-border',
      palette: {
        bgFront: '#121214',
        bgBack: '#0A0A0B',
        primaryText: '#FAF7F0',
        secondaryText: '#C0B39D',
        accent: '#D4AF37',
        badgeBg: 'rgba(212, 175, 55, 0.15)',
        badgeText: '#F3E5AB',
        previewColor: '#121214'
      },
      pattern: 'gold-border',
      rationale: 'Refined deep noir background framed by brushed champagne metallic accents and serif typography.'
    }
  },
  {
    keywords: ['minimal', 'zen', 'architect', 'interior', 'ceramic', 'nordic', 'scandinavian', 'clean'],
    style: {
      themeName: 'Scandinavian Nordic Clay',
      tagline: 'Thoughtful Spatial Design & Modern Human Architecture',
      layout: 'minimal-zen',
      palette: {
        bgFront: '#F5F2EC',
        bgBack: '#E8E2D5',
        primaryText: '#23211E',
        secondaryText: '#6D6559',
        accent: '#7D5333',
        badgeBg: 'rgba(125, 83, 51, 0.12)',
        badgeText: '#7D5333',
        previewColor: '#F5F2EC'
      },
      pattern: 'minimal-dots',
      rationale: 'Organic textured stone tones, generous negative whitespace, and restrained typography.'
    }
  },
  {
    keywords: ['doctor', 'clinic', 'medical', 'dental', 'health', 'pharma', 'care', 'hospital'],
    style: {
      themeName: 'Precision Medical Teal',
      tagline: 'Compassionate Care Grounded in Advanced Clinical Science',
      layout: 'split',
      palette: {
        bgFront: '#0F2C35',
        bgBack: '#081B22',
        primaryText: '#F0FDFA',
        secondaryText: '#99F6E4',
        accent: '#14B8A6',
        badgeBg: 'rgba(20, 184, 166, 0.18)',
        badgeText: '#2DD4BF',
        previewColor: '#0F2C35'
      },
      pattern: 'geometric-lines',
      rationale: 'Calming surgical teal with pristine white typography providing reassurance and clinical precision.'
    }
  },
  {
    keywords: ['law', 'attorney', 'legal', 'finance', 'fund', 'capital', 'advisory', 'consulting'],
    style: {
      themeName: 'Mayfair Navy & Brass',
      tagline: 'Strategic Counsel & Fiduciary Integrity',
      layout: 'classic',
      palette: {
        bgFront: '#152238',
        bgBack: '#0C1524',
        primaryText: '#FFFFFF',
        secondaryText: '#B8C7DC',
        accent: '#D4AF37',
        badgeBg: 'rgba(212, 175, 55, 0.2)',
        badgeText: '#E6CA65',
        previewColor: '#152238'
      },
      pattern: 'diagonal-stripe',
      rationale: 'Timeless deep Oxford navy paired with burnished brass accents, conveying authority and stability.'
    }
  },
  {
    keywords: ['coffee', 'bakery', 'restaurant', 'artisan', 'craft', 'bar', 'culinary', 'food'],
    style: {
      themeName: 'Artisan Espresso & Terracotta',
      tagline: 'Handcrafted Roast Profiles & Mindful Flavors',
      layout: 'modern',
      palette: {
        bgFront: '#2B1B17',
        bgBack: '#1B110E',
        primaryText: '#FDFBF7',
        secondaryText: '#D7C2B2',
        accent: '#E07A5F',
        badgeBg: 'rgba(224, 122, 95, 0.2)',
        badgeText: '#F4A261',
        previewColor: '#2B1B17'
      },
      pattern: 'radial-glow',
      rationale: 'Rich roasted cacao backdrop accented with warm terracotta tones and welcoming craft aesthetic.'
    }
  }
];

/**
 * Returns archetype based on keyword search with word-boundary awareness
 */
function getMatchingArchetype(prompt: string): GeneratedCardStyle {
  const lowerPrompt = (prompt || '').toLowerCase();
  for (const item of STYLE_ARCHETYPES) {
    const matches = item.keywords.some((k) => {
      if (k.length <= 2) {
        // Short words like 'ai' require word boundary
        return new RegExp(`\\b${k}\\b`, 'i').test(lowerPrompt);
      }
      return lowerPrompt.includes(k);
    });
    if (matches) {
      return item.style;
    }
  }

  return {
    themeName: 'AI Modern Slate & Indigo',
    tagline: 'Designing the Future with Purpose & Precision',
    layout: 'modern',
    palette: {
      bgFront: '#0F172A',
      bgBack: '#020617',
      primaryText: '#F8FAFC',
      secondaryText: '#94A3B8',
      accent: '#6366F1',
      badgeBg: 'rgba(99, 102, 241, 0.18)',
      badgeText: '#A5B4FC',
      previewColor: '#0F172A'
    },
    pattern: 'radial-glow',
    rationale: 'Clean contemporary slate canvas paired with electric indigo accents and balanced visual hierarchy.'
  };
}

/**
 * Generates bespoke AI visiting card styling via Gemini 3.8 Flash,
 * with graceful heuristic fallback when unconfigured or on timeout.
 */
export async function generateCardStyleWithAi(
  req: GenerateCardStyleRequest
): Promise<GeneratedCardStyle> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const promptText = `
You are a world-class graphic designer specializing in bespoke corporate stationery and luxury business cards.
Generate a complete, high-impact design styling tailored to the following business:
User Prompt / Aesthetic: "${req.prompt}"
Company: "${req.companyName || 'Brand'}"
Title: "${req.jobTitle || 'Founder'}"

Select cohesive hexadecimal color codes with exceptional contrast (dark cards should have very light primary text, light cards should have dark primary text).
Valid layouts: 'modern', 'split', 'classic', 'accent-border', 'neo-brutalist', 'minimal-zen', 'executive-banner'.
Valid patterns: 'cyber-grid', 'radial-glow', 'geometric-lines', 'gold-border', 'minimal-dots', 'diagonal-stripe'.

Output JSON matching the requested schema.
`;

      // 4.5 second timeout safeguard so UI never freezes
      const fetchAiPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              themeName: { type: Type.STRING, description: 'Creative name of this theme (e.g. Neo Tokyo Cyan)' },
              tagline: { type: Type.STRING, description: 'Snappy marketing tagline tailored to the business' },
              layout: {
                type: Type.STRING,
                description: 'modern, split, classic, accent-border, neo-brutalist, minimal-zen, or executive-banner'
              },
              pattern: {
                type: Type.STRING,
                description: 'cyber-grid, radial-glow, geometric-lines, gold-border, minimal-dots, or diagonal-stripe'
              },
              rationale: { type: Type.STRING, description: '1-sentence design justification' },
              palette: {
                type: Type.OBJECT,
                properties: {
                  bgFront: { type: Type.STRING, description: 'Hex code for front background' },
                  bgBack: { type: Type.STRING, description: 'Hex code for back background' },
                  primaryText: { type: Type.STRING, description: 'Hex code for high-contrast primary text' },
                  secondaryText: { type: Type.STRING, description: 'Hex code for secondary details' },
                  accent: { type: Type.STRING, description: 'Vibrant brand accent color' },
                  badgeBg: { type: Type.STRING, description: 'Background for job title pill' },
                  badgeText: { type: Type.STRING, description: 'Text color for job title pill' }
                },
                required: ['bgFront', 'bgBack', 'primaryText', 'secondaryText', 'accent', 'badgeBg', 'badgeText']
              }
            },
            required: ['themeName', 'tagline', 'layout', 'pattern', 'rationale', 'palette']
          }
        }
      });

      let timerId: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error('AI Request Timeout')), 3500);
      });

      const response = await Promise.race([fetchAiPromise, timeoutPromise]);
      if (timerId) clearTimeout(timerId);
      const parsed = JSON.parse(response.text || '{}');

      if (parsed.palette && parsed.palette.bgFront && parsed.palette.primaryText) {
        return {
          themeName: parsed.themeName || 'AI Custom Style',
          tagline: parsed.tagline || 'Elevating Standards Through Innovation',
          layout: (parsed.layout as CardLayoutId) || 'modern',
          palette: {
            ...parsed.palette,
            previewColor: parsed.palette.bgFront
          },
          pattern: (parsed.pattern as GraphicPatternId) || 'radial-glow',
          rationale: parsed.rationale || 'Tailored color harmony and typography balance generated by Gemini AI.'
        };
      }
    } catch (err) {
      console.warn('Gemini AI card generation handled fallback:', err);
    }
  }

  // Graceful Keyword-Matching Archetype Engine
  return getMatchingArchetype(req.prompt);
}
