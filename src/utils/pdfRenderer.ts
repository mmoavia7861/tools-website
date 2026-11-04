/**
 * Client-side PDF page rendering helper using pdfjs-dist.
 * Renders individual PDF pages to high-resolution data URLs or onto canvases.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using CDN fallback so it runs without complex bundler worker chunk setup
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

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
      useSystemFonts: true,
      isEvalSupported: false
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
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn(`Could not render PDF page ${pageIndex} via pdfjs:`, err);
    // Graceful fallback: render a clean vector placeholder sheet
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(40, 40, 520, 30);
    ctx.fillRect(40, 90, 400, 20);
    ctx.fillRect(40, 130, 480, 20);
    ctx.fillRect(40, 170, 320, 20);
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${pageIndex + 1}`, 300, 400);
    return canvas.toDataURL('image/png');
  }
}
