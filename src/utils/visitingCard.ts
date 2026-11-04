/**
 * Visiting Card / Business Card Engine
 * Generates print-ready standard 3.5" x 2" cards with front & back designs,
 * high-resolution 300 DPI PNG/JPG canvas rendering, and multi-page print-ready PDF export.
 * Includes AI Design Generation, 18+ curated aesthetic styles, vector emblem generators,
 * interactive 3D preview, and instant QR vCard generator.
 */

import { PDFDocument } from 'pdf-lib';
import { buildVCardPayload } from './qr.ts';

export type CardSizeId = 'us' | 'eu';
export type CardFontId = 'sans' | 'serif' | 'mono';
export type CardOrientation = 'landscape' | 'portrait';
export type CardCornerRadius = 'none' | 'rounded' | 'extra';
export type CardFinishStyle = 'matte' | 'glass' | 'metallic';

export type CardEmblemIcon =
  | 'monogram'
  | 'cube'
  | 'spark'
  | 'shield'
  | 'hexagon'
  | 'leaf'
  | 'infinity'
  | 'pulse';

export const CARD_SIZES = {
  us: { label: 'US Standard — 3.5 × 2 in', widthPt: 252, heightPt: 144, widthPx: 1050, heightPx: 600 },
  eu: { label: 'International — 85 × 55 mm', widthPt: 85 * 72 / 25.4, heightPt: 55 * 72 / 25.4, widthPx: Math.round(85 * 300 / 25.4), heightPx: Math.round(55 * 300 / 25.4) }
} as const;

export const CARD_FONT_CSS: Record<CardFontId, string> = {
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  mono: '"JetBrains Mono", "Courier New", monospace'
};

export function getCanvasFont(font: CardFontId): string {
  return ({
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    serif: 'Georgia, Cambria, serif',
    mono: '"JetBrains Mono", Courier, monospace'
  } as const)[font];
}

export type CardThemeId =
  | 'modern-dark'
  | 'corporate-navy'
  | 'minimal-clean'
  | 'creative-gradient'
  | 'luxe-gold'
  | 'emerald-nature'
  | 'cyberpunk-neon'
  | 'art-deco-luxury'
  | 'scandinavian-zen'
  | 'neo-brutalist'
  | 'sunset-aurora'
  | 'clinical-teal'
  | 'glass-frost'
  | 'obsidian-gold'
  | 'swiss-minimal'
  | 'matrix-neon'
  | 'rose-champagne'
  | 'kraft-artisan'
  | 'custom-ai';

export type CardLayoutId =
  | 'modern'
  | 'split'
  | 'classic'
  | 'accent-border'
  | 'neo-brutalist'
  | 'minimal-zen'
  | 'executive-banner'
  | 'glass-card';

export type GraphicPatternId =
  | 'none'
  | 'cyber-grid'
  | 'radial-glow'
  | 'geometric-lines'
  | 'gold-border'
  | 'minimal-dots'
  | 'diagonal-stripe';

export type VisitingCardStyleTemplate =
  | 'modern-minimalist'
  | 'professional-bold'
  | 'creative-gradient';

export interface StyleTemplateOption {
  id: VisitingCardStyleTemplate;
  label: 'Modern Minimalist' | 'Professional Bold' | 'Creative Gradient';
  tagline: string;
  description: string;
  theme: CardThemeId;
  layout: CardLayoutId;
  pattern: GraphicPatternId;
  font: CardFontId;
  finishStyle: CardFinishStyle;
  cornerRadius: CardCornerRadius;
  previewColors: string[];
}

export const STYLE_TEMPLATES: StyleTemplateOption[] = [
  {
    id: 'modern-minimalist',
    label: 'Modern Minimalist',
    tagline: 'Clean, spacious, Swiss editorial',
    description: 'Light subtle background, crisp typography, and refined modern margins',
    theme: 'minimal-clean',
    layout: 'minimal-zen',
    pattern: 'minimal-dots',
    font: 'sans',
    finishStyle: 'matte',
    cornerRadius: 'rounded',
    previewColors: ['#FFFFFF', '#2563EB', '#0F172A']
  },
  {
    id: 'professional-bold',
    label: 'Professional Bold',
    tagline: 'Authoritative, executive contrast',
    description: 'Deep corporate navy & gold tones, structured executive banner, and confident presence',
    theme: 'corporate-navy',
    layout: 'executive-banner',
    pattern: 'diagonal-stripe',
    font: 'serif',
    finishStyle: 'metallic',
    cornerRadius: 'none',
    previewColors: ['#1E3A8A', '#F59E0B', '#FFFFFF']
  },
  {
    id: 'creative-gradient',
    label: 'Creative Gradient',
    tagline: 'Vibrant, dynamic glassmorphic aurora',
    description: 'Rich purple-coral gradient mesh, floating glass panel, and creative energy',
    theme: 'creative-gradient',
    layout: 'glass-card',
    pattern: 'radial-glow',
    font: 'sans',
    finishStyle: 'glass',
    cornerRadius: 'extra',
    previewColors: ['#4C1D95', '#F43F5E', '#FFFFFF']
  }
];

export function applyStyleTemplate(
  current: VisitingCardData,
  templateId: VisitingCardStyleTemplate
): VisitingCardData {
  const t = STYLE_TEMPLATES.find(s => s.id === templateId);
  if (!t) return current;
  return {
    ...current,
    selectedTemplate: t.id,
    theme: t.theme,
    layout: t.layout,
    pattern: t.pattern,
    font: t.font,
    finishStyle: t.finishStyle,
    cornerRadius: t.cornerRadius,
    customAccent: undefined,
    customBgFront: undefined,
    customBgBack: undefined,
    customText: undefined,
    customPalette: null
  };
}

export interface CardThemeDef {
  id: CardThemeId;
  name: string;
  bgFront: string;
  bgBack: string;
  primaryText: string;
  secondaryText: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
  previewColor: string;
  pattern?: GraphicPatternId;
}

export interface VisitingCardData {
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  logoDataUrl?: string | null;
  emblemIcon?: CardEmblemIcon;
  theme: CardThemeId;
  layout: CardLayoutId;
  qrType: 'none' | 'website' | 'vcard' | 'whatsapp' | 'phone' | 'email';
  pattern?: GraphicPatternId;
  customPalette?: Partial<CardThemeDef> | null;
  aiRationale?: string | null;
  size?: CardSizeId;
  font?: CardFontId;
  fontScale?: number;
  logoScale?: number;
  logoX?: number;
  logoY?: number;
  customAccent?: string;
  customBgFront?: string;
  customBgBack?: string;
  customText?: string;
  linkedIn?: string;
  instagram?: string;
  twitter?: string;
  github?: string;
  whatsapp?: string;
  orientation?: CardOrientation;
  cornerRadius?: CardCornerRadius;
  finishStyle?: CardFinishStyle;
  showBleedGuides?: boolean;
  qrSize?: number;
  qrX?: number;
  qrY?: number;
  qrColor?: string;
  nameX?: number;
  nameY?: number;
  selectedTemplate?: VisitingCardStyleTemplate;
  embedContactUrlQr?: boolean;
}

export const CARD_THEMES: Record<CardThemeId, CardThemeDef> = {
  'modern-dark': {
    id: 'modern-dark',
    name: 'Modern Slate',
    bgFront: '#0F172A',
    bgBack: '#020617',
    primaryText: '#F8FAFC',
    secondaryText: '#94A3B8',
    accent: '#38BDF8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeText: '#38BDF8',
    previewColor: '#0F172A',
    pattern: 'radial-glow'
  },
  'corporate-navy': {
    id: 'corporate-navy',
    name: 'Corporate Navy',
    bgFront: '#1E3A8A',
    bgBack: '#172554',
    primaryText: '#FFFFFF',
    secondaryText: '#BFDBFE',
    accent: '#F59E0B',
    badgeBg: 'rgba(245, 158, 11, 0.18)',
    badgeText: '#F59E0B',
    previewColor: '#1E3A8A',
    pattern: 'diagonal-stripe'
  },
  'minimal-clean': {
    id: 'minimal-clean',
    name: 'Minimal Clean',
    bgFront: '#FFFFFF',
    bgBack: '#F8FAFC',
    primaryText: '#0F172A',
    secondaryText: '#64748B',
    accent: '#2563EB',
    badgeBg: '#EFF6FF',
    badgeText: '#2563EB',
    previewColor: '#FFFFFF',
    pattern: 'none'
  },
  'creative-gradient': {
    id: 'creative-gradient',
    name: 'Creative Aura',
    bgFront: '#4C1D95',
    bgBack: '#2E1065',
    primaryText: '#FFFFFF',
    secondaryText: '#DDD6FE',
    accent: '#F43F5E',
    badgeBg: 'rgba(244, 63, 94, 0.2)',
    badgeText: '#FDA4AF',
    previewColor: '#4C1D95',
    pattern: 'radial-glow'
  },
  'luxe-gold': {
    id: 'luxe-gold',
    name: 'Executive Onyx & Gold',
    bgFront: '#18181B',
    bgBack: '#09090B',
    primaryText: '#FAFAFA',
    secondaryText: '#A1A1AA',
    accent: '#EAB308',
    badgeBg: 'rgba(234, 179, 8, 0.15)',
    badgeText: '#FACC15',
    previewColor: '#18181B',
    pattern: 'gold-border'
  },
  'emerald-nature': {
    id: 'emerald-nature',
    name: 'Forest Emerald',
    bgFront: '#064E3B',
    bgBack: '#022C22',
    primaryText: '#ECFDF5',
    secondaryText: '#A7F3D0',
    accent: '#34D399',
    badgeBg: 'rgba(52, 211, 153, 0.18)',
    badgeText: '#34D399',
    previewColor: '#064E3B',
    pattern: 'geometric-lines'
  },
  'cyberpunk-neon': {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk 2077',
    bgFront: '#090D16',
    bgBack: '#04070D',
    primaryText: '#F8FAFC',
    secondaryText: '#94A3B8',
    accent: '#06B6D4',
    badgeBg: 'rgba(6, 182, 212, 0.18)',
    badgeText: '#22D3EE',
    previewColor: '#090D16',
    pattern: 'cyber-grid'
  },
  'art-deco-luxury': {
    id: 'art-deco-luxury',
    name: 'Art Deco Noir & Brass',
    bgFront: '#141416',
    bgBack: '#0B0B0C',
    primaryText: '#FDFBF7',
    secondaryText: '#C5B497',
    accent: '#D4AF37',
    badgeBg: 'rgba(212, 175, 55, 0.15)',
    badgeText: '#E6CA65',
    previewColor: '#141416',
    pattern: 'gold-border'
  },
  'scandinavian-zen': {
    id: 'scandinavian-zen',
    name: 'Scandinavian Oat & Clay',
    bgFront: '#F5F2EB',
    bgBack: '#EBE5D8',
    primaryText: '#2A2723',
    secondaryText: '#6D6559',
    accent: '#8C5E3C',
    badgeBg: 'rgba(140, 94, 60, 0.12)',
    badgeText: '#8C5E3C',
    previewColor: '#F5F2EB',
    pattern: 'minimal-dots'
  },
  'neo-brutalist': {
    id: 'neo-brutalist',
    name: 'Stark Neo-Brutalist',
    bgFront: '#FFFDF0',
    bgBack: '#F4E04D',
    primaryText: '#000000',
    secondaryText: '#333333',
    accent: '#000000',
    badgeBg: '#000000',
    badgeText: '#FFFDF0',
    previewColor: '#F4E04D',
    pattern: 'geometric-lines'
  },
  'sunset-aurora': {
    id: 'sunset-aurora',
    name: 'Sunset Coral & Violet',
    bgFront: '#31103F',
    bgBack: '#1A0624',
    primaryText: '#FFFFFF',
    secondaryText: '#FBCFE8',
    accent: '#FB7185',
    badgeBg: 'rgba(251, 113, 133, 0.22)',
    badgeText: '#FECDD3',
    previewColor: '#31103F',
    pattern: 'radial-glow'
  },
  'clinical-teal': {
    id: 'clinical-teal',
    name: 'Clinical Health Teal',
    bgFront: '#0F2F38',
    bgBack: '#081D23',
    primaryText: '#F0FDFA',
    secondaryText: '#99F6E4',
    accent: '#14B8A6',
    badgeBg: 'rgba(20, 184, 166, 0.18)',
    badgeText: '#2DD4BF',
    previewColor: '#0F2F38',
    pattern: 'geometric-lines'
  },
  'glass-frost': {
    id: 'glass-frost',
    name: 'Frosted Glassmorphism',
    bgFront: '#0F172A',
    bgBack: '#1E293B',
    primaryText: '#F8FAFC',
    secondaryText: '#94A3B8',
    accent: '#38BDF8',
    badgeBg: 'rgba(56, 189, 248, 0.18)',
    badgeText: '#7DD3FC',
    previewColor: '#38BDF8',
    pattern: 'radial-glow'
  },
  'obsidian-gold': {
    id: 'obsidian-gold',
    name: 'Obsidian & 24K Gold',
    bgFront: '#0A0A0B',
    bgBack: '#141416',
    primaryText: '#FFFFFF',
    secondaryText: '#D1D5DB',
    accent: '#D4AF37',
    badgeBg: 'rgba(212, 175, 55, 0.2)',
    badgeText: '#FDE047',
    previewColor: '#D4AF37',
    pattern: 'gold-border'
  },
  'swiss-minimal': {
    id: 'swiss-minimal',
    name: 'Swiss Architectural',
    bgFront: '#FAFAFA',
    bgBack: '#09090B',
    primaryText: '#09090B',
    secondaryText: '#52525B',
    accent: '#DC2626',
    badgeBg: '#FEE2E2',
    badgeText: '#991B1B',
    previewColor: '#DC2626',
    pattern: 'minimal-dots'
  },
  'matrix-neon': {
    id: 'matrix-neon',
    name: 'Matrix Cyber Emerald',
    bgFront: '#050D0A',
    bgBack: '#020504',
    primaryText: '#ECFDF5',
    secondaryText: '#6EE7B7',
    accent: '#10B981',
    badgeBg: 'rgba(16, 185, 129, 0.2)',
    badgeText: '#34D399',
    previewColor: '#10B981',
    pattern: 'cyber-grid'
  },
  'rose-champagne': {
    id: 'rose-champagne',
    name: 'Rose & Champagne',
    bgFront: '#23121F',
    bgBack: '#150A13',
    primaryText: '#FFF1F2',
    secondaryText: '#FDA4AF',
    accent: '#FB7185',
    badgeBg: 'rgba(251, 113, 133, 0.2)',
    badgeText: '#FECDD3',
    previewColor: '#FB7185',
    pattern: 'radial-glow'
  },
  'kraft-artisan': {
    id: 'kraft-artisan',
    name: 'Organic Kraft & Walnut',
    bgFront: '#EFE7DA',
    bgBack: '#E3D7C5',
    primaryText: '#261C14',
    secondaryText: '#5C4B3C',
    accent: '#78350F',
    badgeBg: 'rgba(120, 53, 15, 0.12)',
    badgeText: '#78350F',
    previewColor: '#B45309',
    pattern: 'minimal-dots'
  },
  'custom-ai': {
    id: 'custom-ai',
    name: 'AI Smart Palette',
    bgFront: '#111827',
    bgBack: '#030712',
    primaryText: '#F9FAFB',
    secondaryText: '#9CA3AF',
    accent: '#6366F1',
    badgeBg: 'rgba(99, 102, 241, 0.18)',
    badgeText: '#818CF8',
    previewColor: '#6366F1',
    pattern: 'radial-glow'
  }
};

/**
 * Standard business card dimensions in points (72 points = 1 inch).
 * 3.5 inches x 2.0 inches = 252 pt x 144 pt.
 */
export const CARD_WIDTH_PT = 252;
export const CARD_HEIGHT_PT = 144;

/**
 * Default sample card information
 */
export const DEFAULT_CARD_DATA: VisitingCardData = {
  fullName: 'Alexander Vance',
  jobTitle: 'Founder & Principal Architect',
  companyName: 'Nova Dynamics',
  tagline: 'Engineering Tomorrow, Today.',
  phone: '+1 (415) 890-2341',
  email: 'alexander@novadynamics.io',
  website: 'https://novadynamics.io',
  address: '100 Montgomery St, San Francisco, CA',
  theme: 'glass-frost',
  layout: 'glass-card',
  qrType: 'website',
  pattern: 'radial-glow',
  emblemIcon: 'monogram',
  size: 'us',
  font: 'sans',
  fontScale: 1,
  logoScale: 1,
  logoX: 88,
  logoY: 16,
  orientation: 'landscape',
  cornerRadius: 'rounded',
  finishStyle: 'glass',
  showBleedGuides: false,
  qrSize: 150,
  qrX: 85,
  qrY: 68,
  qrColor: '#0F172A',
  nameX: 7,
  nameY: 27,
  linkedIn: 'linkedin.com/in/alex-vance',
  twitter: '@alexvance_tech',
  selectedTemplate: 'modern-minimalist',
  embedContactUrlQr: true
};

/**
 * 1-Click Curated Presets for instant professional designs
 */
export interface CardPreset {
  id: string;
  name: string;
  industry: string;
  description: string;
  data: Partial<VisitingCardData>;
}

export const CARD_PRESETS: CardPreset[] = [
  {
    id: 'tech-founder',
    name: 'Tech Co-Founder',
    industry: 'AI / Software',
    description: 'Sleek dark glassmorphism with electric cyan accents',
    data: {
      fullName: 'Elena Rostova',
      jobTitle: 'Co-Founder & CEO',
      companyName: 'Synthetix AI',
      tagline: 'Autonomous Intelligence Systems',
      phone: '+1 (415) 992-1082',
      email: 'elena@synthetix.ai',
      website: 'https://synthetix.ai',
      address: 'South Park, San Francisco, CA',
      theme: 'glass-frost',
      layout: 'glass-card',
      emblemIcon: 'spark',
      pattern: 'radial-glow',
      font: 'sans',
      qrType: 'vcard',
      cornerRadius: 'rounded'
    }
  },
  {
    id: 'creative-director',
    name: 'Creative Director',
    industry: 'Design & Agency',
    description: 'Swiss editorial minimalism with bold crimson accent',
    data: {
      fullName: 'Julian Mercer',
      jobTitle: 'Head of Brand & Design',
      companyName: 'Mercer Studio',
      tagline: 'Distinctive Visual Architecture',
      phone: '+1 (212) 480-9931',
      email: 'julian@mercer.studio',
      website: 'https://mercer.studio',
      address: 'SoHo, New York, NY',
      theme: 'swiss-minimal',
      layout: 'modern',
      emblemIcon: 'cube',
      pattern: 'minimal-dots',
      font: 'sans',
      qrType: 'website',
      cornerRadius: 'none'
    }
  },
  {
    id: 'luxury-realty',
    name: 'Luxury Real Estate',
    industry: 'High-End Realty',
    description: 'Obsidian black with polished 24K gold foil trim',
    data: {
      fullName: 'Marcus Sterling',
      jobTitle: 'Private Estate Advisor',
      companyName: 'Sterling & Co. Luxe',
      tagline: 'Curating Rare Architectural Estates',
      phone: '+1 (310) 775-4300',
      email: 'm.sterling@sterlingluxe.com',
      website: 'https://sterlingluxe.com',
      address: 'Rodeo Drive, Beverly Hills, CA',
      theme: 'obsidian-gold',
      layout: 'accent-border',
      emblemIcon: 'shield',
      pattern: 'gold-border',
      font: 'serif',
      qrType: 'vcard',
      cornerRadius: 'none'
    }
  },
  {
    id: 'physician',
    name: 'Medical Specialist',
    industry: 'Healthcare & Clinic',
    description: 'Calming clinical teal with crisp professional typography',
    data: {
      fullName: 'Dr. Sarah Lin, M.D.',
      jobTitle: 'Chief of Cardiothoracic Medicine',
      companyName: 'Beacon Health Center',
      tagline: 'Compassionate Precision Medicine',
      phone: '+1 (617) 555-0194',
      email: 'dr.lin@beaconhealth.org',
      website: 'https://beaconhealth.org',
      address: 'Longwood Medical Area, Boston, MA',
      theme: 'clinical-teal',
      layout: 'classic',
      emblemIcon: 'pulse',
      pattern: 'geometric-lines',
      font: 'sans',
      qrType: 'vcard',
      cornerRadius: 'rounded'
    }
  },
  {
    id: 'corporate-law',
    name: 'Corporate Attorney',
    industry: 'Legal & Executive',
    description: 'Deep navy authority with amber badge and structured layout',
    data: {
      fullName: 'Harrison Cole, Esq.',
      jobTitle: 'Senior Managing Partner',
      companyName: 'Cole & Whitmore LLP',
      tagline: 'Corporate Advisory & Cross-Border M&A',
      phone: '+1 (202) 884-2100',
      email: 'hcole@cw-law.com',
      website: 'https://cw-law.com',
      address: 'K Street NW, Washington, D.C.',
      theme: 'corporate-navy',
      layout: 'executive-banner',
      emblemIcon: 'monogram',
      pattern: 'diagonal-stripe',
      font: 'serif',
      qrType: 'vcard',
      cornerRadius: 'none'
    }
  },
  {
    id: 'cyber-security',
    name: 'Cybersecurity Architect',
    industry: 'Security & Web3',
    description: 'Dark cyber grid with matrix emerald neon glow',
    data: {
      fullName: 'Dante Novak',
      jobTitle: 'Principal Security Researcher',
      companyName: 'ZeroKey Labs',
      tagline: 'Zero-Trust Infrastructure & Cryptography',
      phone: '+1 (512) 330-9124',
      email: 'dante@zerokey.io',
      website: 'https://zerokey.io',
      address: 'Austin Tech Corridor, Austin, TX',
      theme: 'matrix-neon',
      layout: 'neo-brutalist',
      emblemIcon: 'hexagon',
      pattern: 'cyber-grid',
      font: 'mono',
      qrType: 'website',
      cornerRadius: 'none'
    }
  },
  {
    id: 'artisan-roaster',
    name: 'Artisan Coffee Roaster',
    industry: 'Specialty Goods',
    description: 'Warm organic kraft paper with rich roasted walnut tones',
    data: {
      fullName: 'Maya Lindqvist',
      jobTitle: 'Master Roaster & Founder',
      companyName: 'Solstice Coffee Works',
      tagline: 'Ethically Sourced Single-Origin Beans',
      phone: '+1 (503) 221-8890',
      email: 'maya@solsticecoffee.com',
      website: 'https://solsticecoffee.com',
      address: 'Eastside Industrial, Portland, OR',
      theme: 'kraft-artisan',
      layout: 'minimal-zen',
      emblemIcon: 'leaf',
      pattern: 'minimal-dots',
      font: 'serif',
      qrType: 'vcard',
      cornerRadius: 'rounded'
    }
  },
  {
    id: 'architect-urbanist',
    name: 'Architect & Urbanist',
    industry: 'Architecture',
    description: 'Scandinavian clay and oat palette with structured grid',
    data: {
      fullName: 'Liam Thorne',
      jobTitle: 'Principal Urban Architect',
      companyName: 'Atelier Nordic',
      tagline: 'Sustainable Spaces & Biophilic Design',
      phone: '+44 20 7946 0912',
      email: 'liam@ateliernordic.com',
      website: 'https://ateliernordic.com',
      address: 'Clerkenwell, London, UK',
      theme: 'scandinavian-zen',
      layout: 'split',
      emblemIcon: 'infinity',
      pattern: 'minimal-dots',
      font: 'sans',
      qrType: 'vcard',
      cornerRadius: 'rounded'
    }
  }
];

/**
 * Resolves active theme definition including any AI custom palette overrides.
 */
export function resolveCardTheme(card: VisitingCardData): CardThemeDef {
  const base = CARD_THEMES[card.theme] || CARD_THEMES['modern-dark'];
  const theme =
    card.theme === 'custom-ai' && card.customPalette
      ? {
          ...base,
          ...card.customPalette,
          id: 'custom-ai' as CardThemeId,
          name: card.customPalette.name || 'Custom Palette'
        }
      : base;
  const isHex = (value?: string) => Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
  return {
    ...theme,
    ...(isHex(card.customAccent) && { accent: card.customAccent!, badgeText: card.customAccent! }),
    ...(isHex(card.customBgFront) && { bgFront: card.customBgFront! }),
    ...(isHex(card.customBgBack) && { bgBack: card.customBgBack! }),
    ...(isHex(card.customText) && { primaryText: card.customText! })
  };
}

/**
 * On-device design suggestions. Return an existing curated template for instant offline execution.
 */
export function suggestCardStyle(prompt: string): Pick<VisitingCardData, 'theme' | 'layout' | 'pattern'> {
  const p = prompt.toLowerCase().slice(0, 500);
  if (/luxury|premium|real estate|realty|gold|jewel|executive|law/.test(p)) {
    return { theme: 'luxe-gold', layout: 'executive-banner', pattern: 'gold-border' };
  }
  if (/medical|health|clinic|doctor|dental|hospital/.test(p)) {
    return { theme: 'clinical-teal', layout: 'classic', pattern: 'geometric-lines' };
  }
  if (/nature|organic|eco|garden|green|forest|coffee/.test(p)) {
    return { theme: 'emerald-nature', layout: 'minimal-zen', pattern: 'minimal-dots' };
  }
  if (/minimal|architect|simple|scandinavi|zen|neutral/.test(p)) {
    return { theme: 'scandinavian-zen', layout: 'minimal-zen', pattern: 'none' };
  }
  if (/cyber|game|gaming|web3|neon|crypto|matrix/.test(p)) {
    return { theme: 'cyberpunk-neon', layout: 'neo-brutalist', pattern: 'cyber-grid' };
  }
  if (/glass|modern|startup|tech|software|saas/.test(p)) {
    return { theme: 'glass-frost', layout: 'glass-card', pattern: 'radial-glow' };
  }
  if (/creative|design|artist|fashion|beauty/.test(p)) {
    return { theme: 'sunset-aurora', layout: 'accent-border', pattern: 'radial-glow' };
  }
  return { theme: 'corporate-navy', layout: 'modern', pattern: 'diagonal-stripe' };
}

/**
 * Generates a standard vCard string from visiting card data
 */
export function generateCardVCardPayload(card: VisitingCardData): string {
  const parts = card.fullName.trim().split(' ');
  const firstName = parts[0] || 'Name';
  const lastName = parts.slice(1).join(' ') || 'Surname';

  return buildVCardPayload({
    firstName,
    lastName,
    organization: card.companyName,
    title: card.jobTitle,
    phone: card.phone,
    email: card.email,
    website: card.website,
    street: card.address
  });
}

/**
 * Normalizes a user-provided contact URL to ensure valid protocol for QR code scanning.
 */
export function normalizeContactUrl(url: string | undefined | null): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return 'https://ranknova.app';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Generates the QR payload targeting the user's provided contact URL.
 */
export function getContactUrlQrPayload(card: VisitingCardData): string {
  return normalizeContactUrl(card.website);
}

/**
 * Toggles automatic QR code generation & embedding for the user's provided contact URL.
 */
export function toggleContactUrlQr(card: VisitingCardData, enabled: boolean): VisitingCardData {
  if (enabled) {
    return {
      ...card,
      embedContactUrlQr: true,
      qrType: 'website'
    };
  }
  return {
    ...card,
    embedContactUrlQr: false,
    qrType: 'none'
  };
}

/**
 * Draw vector geometric emblems directly on canvas (crisp at 300 DPI)
 */
export function drawEmblemOnCanvas(
  ctx: CanvasRenderingContext2D,
  emblem: CardEmblemIcon | undefined,
  companyName: string,
  accentColor: string,
  bgColor: string,
  cx: number,
  cy: number,
  size: number
) {
  ctx.save();
  ctx.translate(cx, cy);

  const radius = size / 2;

  if (emblem === 'cube') {
    // 3D isometric cube
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    const r = radius * 0.9;
    const angles = [0, 60, 120, 180, 240, 300].map(a => (a * Math.PI) / 180);
    ctx.beginPath();
    angles.forEach((a, i) => {
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();

    // Inner spokes to center
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -r);
    ctx.moveTo(0, 0); ctx.lineTo(r * Math.cos(angles[1]), r * Math.sin(angles[1]));
    ctx.moveTo(0, 0); ctx.lineTo(r * Math.cos(angles[4]), r * Math.sin(angles[4]));
    ctx.stroke();
  } else if (emblem === 'spark') {
    // 4-point dynamic Nova Star
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.quadraticCurveTo(0, 0, 0, radius);
    ctx.quadraticCurveTo(0, 0, -radius, 0);
    ctx.quadraticCurveTo(0, 0, 0, -radius);
    ctx.closePath();
    ctx.fill();
  } else if (emblem === 'shield') {
    // Elegant heraldic / security shield
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.8, -radius * 0.8);
    ctx.lineTo(radius * 0.8, -radius * 0.8);
    ctx.lineTo(radius * 0.8, 0);
    ctx.bezierCurveTo(radius * 0.8, radius * 0.7, 0, radius * 0.9, 0, radius);
    ctx.bezierCurveTo(0, radius * 0.9, -radius * 0.8, radius * 0.7, -radius * 0.8, 0);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(0, -radius * 0.1, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (emblem === 'hexagon') {
    // Tech hexagon with core node
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 * Math.PI) / 180;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (emblem === 'leaf') {
    // Botanical organic leaf
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.bezierCurveTo(radius, -radius * 0.5, radius, radius * 0.5, 0, radius);
    ctx.bezierCurveTo(-radius, radius * 0.5, -radius, -radius * 0.5, 0, -radius);
    ctx.fill();

    ctx.strokeStyle = bgColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.7);
    ctx.lineTo(0, radius * 0.7);
    ctx.stroke();
  } else if (emblem === 'infinity') {
    // Smooth ribbon loop
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    const w = radius * 0.9;
    const h = radius * 0.45;
    ctx.ellipse(-w / 2, 0, w / 2, h, 0, 0, Math.PI * 2);
    ctx.ellipse(w / 2, 0, w / 2, h, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (emblem === 'pulse') {
    // Heartbeat / waveform pulse
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-radius * 0.7, 0);
    ctx.lineTo(-radius * 0.3, 0);
    ctx.lineTo(-radius * 0.15, -radius * 0.5);
    ctx.lineTo(radius * 0.1, radius * 0.5);
    ctx.lineTo(radius * 0.25, -radius * 0.2);
    ctx.lineTo(radius * 0.4, 0);
    ctx.lineTo(radius * 0.7, 0);
    ctx.stroke();
  } else {
    // Default monogram badge: Rounded square / circle with company initial
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(-radius, -radius, size, size, radius * 0.35);
    ctx.fill();

    ctx.fillStyle = bgColor;
    ctx.font = `bold ${Math.round(size * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const char = (companyName.trim().charAt(0) || 'N').toUpperCase();
    ctx.fillText(char, 0, 1);
  }

  ctx.restore();
}

/**
 * Compiles Front and Back card image data into a print-ready 2-page PDF document.
 */
export async function createVisitingCardPdf(
  frontPngDataUrl: string,
  backPngDataUrl: string,
  size: CardSizeId = 'us',
  orientation: CardOrientation = 'landscape'
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const dimensions = CARD_SIZES[size];
  const widthPt = orientation === 'portrait' ? dimensions.heightPt : dimensions.widthPt;
  const heightPt = orientation === 'portrait' ? dimensions.widthPt : dimensions.heightPt;

  const extractBase64 = (dataUrl: string) => {
    return dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  };

  const frontBytes = Uint8Array.from(atob(extractBase64(frontPngDataUrl)), (c) => c.charCodeAt(0));
  const backBytes = Uint8Array.from(atob(extractBase64(backPngDataUrl)), (c) => c.charCodeAt(0));

  const frontImage = await pdfDoc.embedPng(frontBytes);
  const backImage = await pdfDoc.embedPng(backBytes);

  // Page 1: Front
  const pageFront = pdfDoc.addPage([widthPt, heightPt]);
  pageFront.drawImage(frontImage, {
    x: 0,
    y: 0,
    width: widthPt,
    height: heightPt
  });

  // Page 2: Back
  const pageBack = pdfDoc.addPage([widthPt, heightPt]);
  pageBack.drawImage(backImage, {
    x: 0,
    y: 0,
    width: widthPt,
    height: heightPt
  });

  return await pdfDoc.save();
}

/**
 * Downloads a vCard (.vcf) file in the browser
 */
export function downloadVCardFile(card: VisitingCardData, filename?: string): void {
  const payload = generateCardVCardPayload(card);
  const blob = new Blob([payload], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = (card.fullName || 'contact').toLowerCase().replace(/[^a-z0-9]/g, '-');
  a.download = filename || `${cleanName}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports card design state to a clean JSON string
 */
export function exportCardAsJson(card: VisitingCardData): string {
  return JSON.stringify(card, null, 2);
}

/**
 * Safely parses and validates a card design JSON
 */
export function parseCardFromJson(jsonString: string): VisitingCardData | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...DEFAULT_CARD_DATA,
      ...parsed,
      theme: CARD_THEMES[parsed.theme as CardThemeId] ? parsed.theme : DEFAULT_CARD_DATA.theme
    };
  } catch {
    return null;
  }
}
