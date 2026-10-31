/**
 * PDF Editing Utilities.
 * Enables visual page reordering, individual page rotation, page deletion,
 * text watermarks, and footer page numbering on existing PDF files using pdf-lib.
 * 100% on-device client processing.
 */

import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';

export interface PageEditState {
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
  deleted?: boolean;
}

export interface EditPdfOptions {
  pageStates: PageEditState[]; // ordered array of kept pages with rotations
  watermarkText?: string;
  watermarkOpacity?: number;
  addPageNumbers?: boolean;
  pageNumberPosition?: 'bottom-center' | 'bottom-right' | 'top-right';
}

/**
 * Loads an existing PDF and produces an edited PDF according to pageStates and options.
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
    watermarkText = '',
    watermarkOpacity = 0.25,
    addPageNumbers = false,
    pageNumberPosition = 'bottom-center'
  } = options;

  // Filter out any marked deleted
  const activePages = pageStates.filter((p) => !p.deleted);

  if (activePages.length === 0) {
    throw new Error('At least one page must be retained in the PDF document.');
  }

  const newDoc = await PDFDocument.create();
  newDoc.setProducer('RankNova PDF Editor (Private On-Device)');
  newDoc.setCreator('RankNova');

  const font = (watermarkText || addPageNumbers)
    ? await newDoc.embedFont(StandardFonts.Helvetica)
    : null;

  // Extract the original page indices in new requested order
  const indicesToCopy = activePages.map((p) => p.originalIndex);
  const copiedPages = await newDoc.copyPages(sourceDoc, indicesToCopy);

  const totalPages = copiedPages.length;

  for (let i = 0; i < totalPages; i++) {
    const page = copiedPages[i];
    const state = activePages[i];

    // Apply rotation
    const currentRot = page.getRotation().angle;
    const finalRot = (currentRot + (state.rotation || 0)) % 360;
    page.setRotation(degrees(finalRot));

    const { width, height } = page.getSize();
    const isSideways = finalRot === 90 || finalRot === 270;
    const effectiveWidth = isSideways ? height : width;
    const effectiveHeight = isSideways ? width : height;

    // Apply optional watermark text
    if (watermarkText && watermarkText.trim() !== '' && font) {
      const text = watermarkText.trim();
      const fontSize = 38;
      const textWidth = font.widthOfTextAtSize(text, fontSize);

      page.drawText(text, {
        x: effectiveWidth / 2 - textWidth / 2,
        y: effectiveHeight / 2,
        size: fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: watermarkOpacity,
        rotate: degrees(45)
      });
    }

    // Apply optional page numbers
    if (addPageNumbers && font) {
      const pageStr = `${i + 1} / ${totalPages}`;
      const fontSize = 9;
      const textWidth = font.widthOfTextAtSize(pageStr, fontSize);

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
        font,
        color: rgb(0.35, 0.35, 0.35)
      });
    }

    newDoc.addPage(page);
  }

  return await newDoc.save({ useObjectStreams: true });
}
