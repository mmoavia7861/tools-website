/**
 * PDF Editing Utilities.
 * Enables visual page reordering, individual page rotation, page deletion,
 * custom text annotations, digital signature stamping, stamps,
 * text watermarks, and footer page numbering on existing PDF files using pdf-lib.
 * 100% on-device client processing.
 */

import { PDFDocument, degrees, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import {
  type NormalizedElement,
  convertNormalizedToPdfCoords,
  hexToRgb01
} from './pdfEditorUtils';

export interface PageEditState {
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
  deleted?: boolean;
}

export interface EditPdfOptions {
  pageStates: PageEditState[]; // ordered array of kept pages with rotations
  annotations?: NormalizedElement[]; // Text and signature annotations across pages
  watermarkText?: string;
  watermarkOpacity?: number;
  addPageNumbers?: boolean;
  pageNumberPosition?: 'bottom-center' | 'bottom-right' | 'top-right';
  /** Real changes to AcroForm PDF text fields (not ordinary page text). */
  textFieldUpdates?: Record<string, string>;
}

/**
 * Loads an existing PDF and produces an edited PDF according to pageStates,
 * per-page annotations (text, signatures, stamps), and document-level options.
 */
export async function editExistingPdf(
  sourcePdfBytes: Uint8Array,
  options: EditPdfOptions
): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: false });

  if (sourceDoc.isEncrypted) {
    throw new Error('This PDF is password-protected and cannot be edited without credentials.');
  }

  const {
    pageStates,
    annotations = [],
    watermarkText = '',
    watermarkOpacity = 0.25,
    addPageNumbers = false,
    pageNumberPosition = 'bottom-center',
    textFieldUpdates = {}
  } = options;

  // Filter out any marked deleted
  const activePages = pageStates.filter((p) => !p.deleted);

  if (activePages.length === 0) {
    throw new Error('At least one page must be retained in the PDF document.');
  }

  // Update native AcroForm fields in the source before copying pages.
  // Flatten first so the updated appearances are real, visible PDF page
  // content even after page reordering/copying strips the form structure.
  const requestedFields = Object.entries(textFieldUpdates);
  if (requestedFields.length > 0) {
    try {
      const form = sourceDoc.getForm();
      for (const [name, value] of requestedFields) {
        if (value.length > 2000) throw new Error('Form field value is too long.');
        const field = form.getTextField(name);
        if (field.isReadOnly()) throw new Error('A PDF form field is read-only: ' + name);
        field.setText(value);
      }
      form.flatten();
    } catch (err) {
      throw new Error(err instanceof Error ? 'Could not edit PDF form fields: ' + err.message : 'Could not edit PDF form fields.');
    }
  }

  const newDoc = await PDFDocument.create();
  newDoc.setProducer('RankNova PDF Editor (Private On-Device)');
  newDoc.setCreator('RankNova');

  // Embed standard fonts once
  const helveticaFont = await newDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await newDoc.embedFont(StandardFonts.HelveticaBold);
  const timesFont = await newDoc.embedFont(StandardFonts.TimesRoman);
  const courierFont = await newDoc.embedFont(StandardFonts.Courier);

  const getFontByName = (name?: string) => {
    switch (name) {
      case 'HelveticaBold':
        return helveticaBoldFont;
      case 'TimesRoman':
        return timesFont;
      case 'Courier':
        return courierFont;
      case 'Helvetica':
      default:
        return helveticaFont;
    }
  };

  // Cache embedded signature images to avoid duplicate embedding
  const embeddedImageCache = new Map<string, any>();

  // Extract the original page indices in new requested order
  const indicesToCopy = activePages.map((p) => p.originalIndex);
  const copiedPages = await newDoc.copyPages(sourceDoc, indicesToCopy);

  const totalPages = copiedPages.length;

  for (let i = 0; i < totalPages; i++) {
    const page: PDFPage = copiedPages[i];
    const state = activePages[i];

    // Apply rotation
    const currentRot = page.getRotation().angle;
    const finalRot = (currentRot + (state.rotation || 0)) % 360;
    page.setRotation(degrees(finalRot));

    const { width, height } = page.getSize();
    const isSideways = finalRot === 90 || finalRot === 270;
    const effectiveWidth = isSideways ? height : width;
    const effectiveHeight = isSideways ? width : height;
    // Map points in the rotated, displayed page back to source PDF coordinates.
    // Apply the inverse screen rotation to each added text/image so overlays stay upright.
    const mapPoint = (x: number, y: number) => {
      switch (finalRot) {
        case 90: return { x: width - y, y: x };
        case 180: return { x: width - x, y: height - y };
        case 270: return { x: y, y: height - x };
        default: return { x, y };
      }
    };

    // 1. Draw page-specific annotations for page i
    const pageAnnotations = annotations.filter((ann) => ann.pageIndex === i);

    for (const ann of pageAnnotations) {
      const coords = convertNormalizedToPdfCoords(
        ann.x,
        ann.y,
        ann.width,
        ann.height,
        effectiveWidth,
        effectiveHeight
      );
      const corners = [
        mapPoint(coords.x, coords.y),
        mapPoint(coords.x + coords.width, coords.y),
        mapPoint(coords.x, coords.y + coords.height),
        mapPoint(coords.x + coords.width, coords.y + coords.height)
      ];
      const rect = {
        x: Math.min(...corners.map(p => p.x)),
        y: Math.min(...corners.map(p => p.y)),
        width: Math.max(...corners.map(p => p.x)) - Math.min(...corners.map(p => p.x)),
        height: Math.max(...corners.map(p => p.y)) - Math.min(...corners.map(p => p.y))
      };

      if (ann.type === 'text' && ann.text && ann.text.trim() !== '') {
        const textFont = getFontByName(ann.fontFamily);
        const fontSize = ann.fontSize || 14;
        const colorRgb = hexToRgb01(ann.color || '#000000');

        // Optional highlight/background box
        if (ann.backgroundColor && ann.backgroundColor !== 'transparent') {
          const bgRgb = hexToRgb01(ann.backgroundColor);
          page.drawRectangle({
            x: rect.x - 2,
            y: rect.y - 2,
            width: rect.width + 4,
            height: rect.height + 4,
            color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
            opacity: 0.85
          });
        }

        // Draw text lines
        const lines = ann.text.split('\n');
        const lineHeight = fontSize * 1.25;

        lines.forEach((line, lineIdx) => {
          if (!line.trim()) return;
          const anchor = mapPoint(coords.x, coords.y + coords.height - fontSize - (lineIdx * lineHeight));
          page.drawText(line, {
            x: anchor.x, y: anchor.y, rotate: degrees(finalRot),
            size: fontSize,
            font: textFont,
            color: rgb(colorRgb.r, colorRgb.g, colorRgb.b)
          });
        });
      } else if (ann.type === 'highlight' || ann.type === 'whiteout' || ann.type === 'rectangle') {
        const c = hexToRgb01(ann.color || '#FACC15');
        if (ann.type === 'rectangle') {
          page.drawRectangle({
            x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            borderColor: rgb(c.r, c.g, c.b), borderWidth: 2
          });
        } else {
          const shade = ann.type === 'whiteout' ? { r: 1, g: 1, b: 1 } : c;
          page.drawRectangle({
            x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            color: rgb(shade.r, shade.g, shade.b),
            opacity: ann.type === 'whiteout' ? 1 : Math.max(0.05, Math.min(0.8, ann.opacity ?? 0.28))
          });
        }
      } else if ((ann.type === 'signature' || ann.type === 'image') && ann.imageDataUrl) {
        try {
          let embeddedImage = embeddedImageCache.get(ann.imageDataUrl);
          if (!embeddedImage) {
            // Convert data URL to binary bytes
            const base64Data = ann.imageDataUrl.split(',')[1];
            if (base64Data) {
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let k = 0; k < binaryString.length; k++) {
                bytes[k] = binaryString.charCodeAt(k);
              }
              embeddedImage = await newDoc.embedPng(bytes);
              embeddedImageCache.set(ann.imageDataUrl, embeddedImage);
            }
          }

          if (embeddedImage) {
            const anchor = mapPoint(coords.x, coords.y);
            page.drawImage(embeddedImage, {
              x: anchor.x,
              y: anchor.y,
              width: coords.width,
              height: coords.height,
              rotate: degrees(finalRot)
            });
          }
        } catch (imgErr) {
          console.error('Could not embed signature image on page', i, imgErr);
          throw new Error('Image or signature could not be embedded. Please reselect it and try again.');
        }
      }
    }

    // 2. Apply optional watermark text
    if (watermarkText && watermarkText.trim() !== '') {
      const text = watermarkText.trim();
      const fontSize = 38;
      const textWidth = helveticaBoldFont.widthOfTextAtSize(text, fontSize);

      page.drawText(text, {
        x: effectiveWidth / 2 - textWidth / 2,
        y: effectiveHeight / 2,
        size: fontSize,
        font: helveticaBoldFont,
        color: rgb(0.5, 0.5, 0.5),
        opacity: watermarkOpacity,
        rotate: degrees(45)
      });
    }

    // 3. Apply optional page numbers
    if (addPageNumbers) {
      const pageStr = `${i + 1} / ${totalPages}`;
      const fontSize = 9;
      const textWidth = helveticaFont.widthOfTextAtSize(pageStr, fontSize);

      let textX = effectiveWidth / 2 - textWidth / 2;
      let textY = 16;

      if (pageNumberPosition === 'bottom-right') {
        textX = effectiveWidth - textWidth - 24;
      } else if (pageNumberPosition === 'top-right') {
        textX = effectiveWidth - textWidth - 24;
        textY = effectiveHeight - 24;
      }

      page.drawText(pageStr, {
        x: textX,
        y: textY,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0.35, 0.35, 0.35)
      });
    }

    newDoc.addPage(page);
  }

  return await newDoc.save({ useObjectStreams: true });
}
