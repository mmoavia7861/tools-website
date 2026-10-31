/**
 * Image to PDF Conversion Utility.
 * Converts PNG and JPEG images into a consolidated PDF document on-device using pdf-lib.
 * 100% private: no remote uploading required.
 */

import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';

export type PageSizeOption = 'fit' | 'a4' | 'letter';
export type PageOrientationOption = 'auto' | 'portrait' | 'landscape';
export type PageMarginOption = 'none' | 'small' | 'big';

export interface ImageInputItem {
  id: string;
  name: string;
  data: Uint8Array;
  format: 'png' | 'jpeg';
  width?: number;
  height?: number;
  previewUrl: string;
  size: number;
  rotation?: number; // 0, 90, 180, 270 degrees
  grayscale?: boolean;
}

export interface ConvertOptions {
  pageSize?: PageSizeOption;
  orientation?: PageOrientationOption;
  margin?: PageMarginOption;
  addPageNumbers?: boolean;
  pageNumberPosition?: 'bottom-center' | 'bottom-right';
  watermarkText?: string;
  watermarkOpacity?: number;
}

// Standard dimensions in points (72 points = 1 inch)
const SIZES: Record<'a4' | 'letter', { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612.0, height: 792.0 }
};

const MARGINS: Record<PageMarginOption, number> = {
  none: 0,
  small: 20,
  big: 40
};

/**
 * Creates a PDF from an array of image buffers.
 */
export async function convertImagesToPdf(
  images: Array<{ data: Uint8Array; format: 'png' | 'jpeg'; rotation?: number }>,
  options: ConvertOptions = {}
): Promise<Uint8Array> {
  if (!images || images.length === 0) {
    throw new Error('At least one image is required to generate a PDF.');
  }

  const {
    pageSize = 'fit',
    orientation = 'auto',
    margin = 'none',
    addPageNumbers = false,
    pageNumberPosition = 'bottom-center',
    watermarkText = '',
    watermarkOpacity = 0.2
  } = options;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setProducer('RankNova Image to PDF Converter & Editor');
  pdfDoc.setCreator('RankNova');

  const font = (addPageNumbers || watermarkText)
    ? await pdfDoc.embedFont(StandardFonts.Helvetica)
    : null;

  const marginPt = MARGINS[margin];
  const totalPages = images.length;

  for (let i = 0; i < images.length; i++) {
    const imgItem = images[i];
    let embeddedImage;
    if (imgItem.format === 'png') {
      embeddedImage = await pdfDoc.embedPng(imgItem.data);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imgItem.data);
    }

    const { width: rawW, height: rawH } = embeddedImage;
    const rot = (imgItem.rotation || 0) % 360;
    const isSideways = rot === 90 || rot === 270;

    // Effective image width/height after rotation
    const imgW = isSideways ? rawH : rawW;
    const imgH = isSideways ? rawW : rawH;

    let targetPageW = imgW;
    let targetPageH = imgH;

    if (pageSize === 'fit') {
      targetPageW = imgW + marginPt * 2;
      targetPageH = imgH + marginPt * 2;
    } else {
      const baseSize = SIZES[pageSize];
      let isLandscape = false;

      if (orientation === 'landscape') {
        isLandscape = true;
      } else if (orientation === 'portrait') {
        isLandscape = false;
      } else {
        isLandscape = imgW > imgH;
      }

      targetPageW = isLandscape ? Math.max(baseSize.width, baseSize.height) : Math.min(baseSize.width, baseSize.height);
      targetPageH = isLandscape ? Math.min(baseSize.width, baseSize.height) : Math.max(baseSize.width, baseSize.height);
    }

    const page = pdfDoc.addPage([targetPageW, targetPageH]);

    // Calculate image fitting with margins
    const availableW = targetPageW - marginPt * 2;
    const availableH = targetPageH - marginPt * 2;

    const scale = Math.min(availableW / imgW, availableH / imgH);
    const drawW = rawW * scale;
    const drawH = rawH * scale;

    // Center image on page
    const centerX = targetPageW / 2;
    const centerY = targetPageH / 2;

    page.drawImage(embeddedImage, {
      x: centerX - (isSideways ? (rot === 90 ? -drawH / 2 : drawH / 2) : drawW / 2),
      y: centerY - (isSideways ? (rot === 90 ? drawW / 2 : -drawW / 2) : drawH / 2),
      width: drawW,
      height: drawH,
      rotate: degrees(rot)
    });

    // Optional Watermark text
    if (watermarkText && watermarkText.trim() !== '' && font) {
      const trimmedWatermark = watermarkText.trim();
      const textWidth = font.widthOfTextAtSize(trimmedWatermark, 36);
      page.drawText(trimmedWatermark, {
        x: targetPageW / 2 - textWidth / 2,
        y: targetPageH / 2,
        size: 36,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: watermarkOpacity,
        rotate: degrees(45)
      });
    }

    // Optional Page Numbers
    if (addPageNumbers && font) {
      const pageText = `${i + 1} / ${totalPages}`;
      const textSize = 9;
      const textWidth = font.widthOfTextAtSize(pageText, textSize);

      let textX = targetPageW / 2 - textWidth / 2;
      if (pageNumberPosition === 'bottom-right') {
        textX = targetPageW - textWidth - 24;
      }

      page.drawText(pageText, {
        x: textX,
        y: 14,
        size: textSize,
        font,
        color: rgb(0.35, 0.35, 0.35)
      });
    }
  }

  return await pdfDoc.save();
}
