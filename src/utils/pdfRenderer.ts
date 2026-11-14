/**
 * Client-side PDF page rendering helper using pdfjs-dist.
 * Renders individual PDF pages to high-resolution data URLs or onto canvases.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Serve the worker from our own Vite build. Using exactly the same package
// version as the PDF.js API prevents mismatched-worker errors and avoids
// downloading executable code from a third-party CDN.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface RenderPageOptions {
  scale?: number;
  rotation?: number;
}

/**
 * Renders a single PDF page to a canvas and returns the base64 PNG data URL.
 */
export async function renderPdfPageToDataUrl(
  pdfBytes: Uint8Array,
  pageIndex: number,
  options: RenderPageOptions = {}
): Promise<string> {
  const { scale = 1.5, rotation = 0 } = options;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(),
      useSystemFonts: true
    });

    const pdfDoc = await loadingTask.promise;
    const pageNum = pageIndex + 1; // 1-indexed in pdfjs
    if (pageNum > pdfDoc.numPages) {
      throw new Error(`Page index ${pageIndex} out of range`);
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale, rotation });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to create 2D canvas context');
    }

    // Fill white background before rendering
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvas,
      canvasContext: ctx,
      viewport
    };

    await page.render(renderContext).promise;
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error(`Could not render PDF page ${pageIndex}:`, err);
    // Do not display a fabricated page image. Callers can report the error
    // and preserve the original PDF bytes for download.
    throw new Error('PDF page preview failed. Please check the document and try again.');
  }
}

/** Detect selectable, horizontal text for *visual* cover-and-replace only.
 * This does not modify the PDF's underlying text operators.
 */
export interface PdfTextHit {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export async function getPdfPageTextHits(bytes: Uint8Array, pageIndex: number): Promise<PdfTextHit[]> {
  const task = pdfjsLib.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const document = await task.promise;
    const page = await document.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1, rotation: 0 });
    const content = await page.getTextContent();
    const hits: PdfTextHit[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim() || !item.width) continue;
      const matrix = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const textHeight = Math.max(5, Math.abs(item.height));
      const x = Math.max(0, matrix[4] / viewport.width);
      const y = Math.max(0, (matrix[5] - textHeight) / viewport.height);
      const width = Math.max(0.01, Math.min(1 - x, item.width / viewport.width));
      const height = Math.max(0.012, Math.min(1 - y, textHeight / viewport.height));
      if (x >= 1 || y >= 1 || width <= 0 || height <= 0) continue;
      hits.push({ text: item.str, x, y, width, height });
      if (hits.length >= 350) break;
    }
    return hits;
  } finally {
    await task.destroy();
  }
}
