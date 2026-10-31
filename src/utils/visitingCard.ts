/**
 * Visiting Card / Business Card Engine
 * Generates print-ready standard 3.5" x 2" cards with front & back designs,
 * high-resolution 300 DPI PNG canvas rendering, and multi-page print-ready PDF export.
 * Includes AI Design Generation, 12+ curated aesthetic styles, and QR vCard generator.
 */

import { PDFDocument } from 'pdf-lib';
import { buildVCardPayload } from './qr.ts';

export type CardSizeId = 'us' | 'eu';
export type CardFontId = 'sans' | 'serif' | 'mono';

export const CARD_SIZES = {
  us: { label: 'US Standard — 3.5 × 2 in', widthPt: 252, heightPt: 144, widthPx: 1050, heightPx: 600 },
  eu: { label: 'International — 85 × 55 mm', widthPt: 85 * 72 / 25.4, heightPt: 55 * 72 / 25.4, widthPx: Math.round(85 * 300 / 25.4), heightPx: Math.round(55 * 300 / 25.4) }
} as const;

export const CARD_FONT_CSS: Record<CardFontId, string> = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'Courier New, monospace'
};

export function getCanvasFont(font: CardFontId): string {
  return ({ sans: 'Arial, sans-serif', serif: 'Georgia, serif', mono: 'Courier New, monospace' } as const)[font];
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
  | 'custom-ai';

export type CardLayoutId =
  | 'modern'
  | 'split'
  | 'classic'
  | 'accent-border'
  | 'neo-brutalist'
  | 'minimal-zen'
  | 'executive-banner';

export type GraphicPatternId =
  | 'none'
  | 'cyber-grid'
  | 'radial-glow'
  | 'geometric-lines'
  | 'gold-border'
  | 'minimal-dots'
  | 'diagonal-stripe';

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
  theme: CardThemeId;
  layout: CardLayoutId;
  qrType: 'none' | 'website' | 'vcard';
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
  fullName: 'Your Name',
  jobTitle: 'Your Profession',
  companyName: 'Your Company',
  tagline: 'Your Brand. Your Story.',
  phone: '+1 (555) 123-4567',
  email: 'hello@example.com',
  website: 'https://example.com',
  address: 'Your City, Country',
  theme: 'modern-dark',
  layout: 'modern',
  qrType: 'website',
  pattern: 'radial-glow',
  size: 'us',
  font: 'sans',
  fontScale: 1,
  logoScale: 1,
  logoX: 88,
  logoY: 16
};

/**
 * Resolves active theme definition including any AI custom palette overrides.
 */
export function resolveCardTheme(card: VisitingCardData): CardThemeDef {
  const base = CARD_THEMES[card.theme] || CARD_THEMES['modern-dark'];
  const theme = card.theme === 'custom-ai' && card.customPalette
    ? { ...base, ...card.customPalette, id: 'custom-ai' as CardThemeId,
        name: card.customPalette.name || 'Custom Palette' }
    : base;
  if (card.customAccent && /^#[0-9a-fA-F]{6}$/.test(card.customAccent)) {
    return { ...theme, accent: card.customAccent, badgeText: card.customAccent };
  }
  return theme;
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
 * Compiles Front and Back card image data into a print-ready 2-page PDF document.
 */
export async function createVisitingCardPdf(
  frontPngDataUrl: string,
  backPngDataUrl: string,
  size: CardSizeId = 'us'
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const { widthPt, heightPt } = CARD_SIZES[size];

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
