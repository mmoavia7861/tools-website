/**
 * Pure utility functions for PDF page reordering, rotation,
 * coordinate transformations (UI to PDF bottom-left origin),
 * and color conversions for pdf-lib rendering.
 */

export interface NormalizedElement {
  id: string;
  type: 'text' | 'signature' | 'stamp' | 'image' | 'highlight' | 'whiteout' | 'rectangle';
  pageIndex: number;
  // Normalized 0-1 relative to page width and height
  x: number; 
  y: number; 
  width: number; // relative 0-1
  height: number; // relative 0-1
  // For text
  text?: string;
  fontSize?: number; // pt (e.g. 14)
  fontFamily?: 'Helvetica' | 'HelveticaBold' | 'TimesRoman' | 'Courier';
  color?: string; // hex #rrggbb
  backgroundColor?: string; // hex or 'transparent'
  opacity?: number; // 0 to 1 for translucent highlight
  // For signature / stamp
  imageDataUrl?: string; // PNG data URL
  stampType?: 'APPROVED' | 'CONFIDENTIAL' | 'REJECTED' | 'DATE' | 'CHECK';
}

export interface PdfCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts UI screen/normalized top-left coordinates to PDF page bottom-left coordinates.
 * In PDF, (0,0) is bottom-left. In DOM/UI, (0,0) is top-left.
 */
export function convertNormalizedToPdfCoords(
  normX: number,
  normY: number,
  normWidth: number,
  normHeight: number,
  pageWidth: number,
  pageHeight: number
): PdfCoords {
  const width = Math.max(1, normWidth * pageWidth);
  const height = Math.max(1, normHeight * pageHeight);
  const x = Math.max(0, normX * pageWidth);
  // In DOM: top is normY * pageHeight.
  // In PDF: bottom of element is pageHeight - (normY * pageHeight) - height.
  const y = Math.max(0, pageHeight - (normY * pageHeight) - height);

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100
  };
}

/**
 * Converts a hex color string (#RRGGBB or #RGB) into normalized RGB (0-1) for pdf-lib.
 */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255
  };
}

/**
 * Reorders an array by moving item from sourceIndex to targetIndex without mutating input.
 */
export function reorderArray<T>(list: T[], sourceIndex: number, targetIndex: number): T[] {
  if (
    sourceIndex < 0 ||
    sourceIndex >= list.length ||
    targetIndex < 0 ||
    targetIndex >= list.length ||
    sourceIndex === targetIndex
  ) {
    return [...list];
  }
  const result = [...list];
  const [removed] = result.splice(sourceIndex, 1);
  result.splice(targetIndex, 0, removed);
  return result;
}

/**
 * Normalizes rotation angle into 0, 90, 180, or 270 degrees.
 */
export function normalizeRotation(angle: number): number {
  const mod = ((angle % 360) + 360) % 360;
  if (mod >= 315 || mod < 45) return 0;
  if (mod >= 45 && mod < 135) return 90;
  if (mod >= 135 && mod < 225) return 180;
  return 270;
}

/**
 * Factory for creating a new text element on a page.
 */
export function createDefaultTextElement(
  pageIndex: number,
  initialText = 'Click to edit text',
  x = 0.2,
  y = 0.3
): NormalizedElement {
  return {
    id: `txt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: 'text',
    pageIndex,
    x,
    y,
    width: 0.35,
    height: 0.06,
    text: initialText,
    fontSize: 16,
    fontFamily: 'HelveticaBold',
    color: '#0F172A',
    backgroundColor: 'transparent'
  };
}

/**
 * Factory for creating a signature element.
 */
export function createSignatureElement(
  pageIndex: number,
  imageDataUrl: string,
  x = 0.5,
  y = 0.7,
  width = 0.3,
  height = 0.12
): NormalizedElement {
  return {
    id: `sig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: 'signature',
    pageIndex,
    x,
    y,
    width,
    height,
    imageDataUrl
  };
}
