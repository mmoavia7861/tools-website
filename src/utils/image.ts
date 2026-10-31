/**
 * Image inspection, magic-byte validation, and background-flattening utilities.
 */

export type SupportedImageFormat = 'png' | 'jpeg' | 'webp';

export interface ImageValidationResult {
  valid: boolean;
  format?: SupportedImageFormat;
  mimeType?: string;
  error?: string;
  size: number;
}

/**
 * Validates image buffer magic bytes against PNG, JPEG, and WebP specifications.
 * Prevents file-extension spoofing and parser abuse.
 */
export function validateImageSignature(buffer: Uint8Array, maxBytes = 15 * 1024 * 1024): ImageValidationResult {
  const size = buffer.byteLength;

  if (size === 0) {
    return { valid: false, error: 'The uploaded image is empty.', size };
  }

  if (size > maxBytes) {
    return {
      valid: false,
      error: `Image exceeds maximum allowed size of ${(maxBytes / (1024 * 1024)).toFixed(0)}MB.`,
      size
    };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, format: 'png', mimeType: 'image/png', size };
  }

  // JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { valid: true, format: 'jpeg', mimeType: 'image/jpeg', size };
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, format: 'webp', mimeType: 'image/webp', size };
  }

  return {
    valid: false,
    error: 'Unsupported or corrupted image format. Please upload a valid PNG, JPEG, or WebP file.',
    size
  };
}

/**
 * Checks image dimensions to defend against decompression bombs.
 * Max allowed width/height: 4096px, Max pixel count: 16,777,216.
 */
export function checkImageDimensionSafety(width: number, height: number): { safe: boolean; error?: string } {
  const MAX_DIM = 4096;
  const MAX_PIXELS = 16_777_216;

  if (width <= 0 || height <= 0) {
    return { safe: false, error: 'Invalid image dimensions.' };
  }

  if (width > MAX_DIM || height > MAX_DIM) {
    return { safe: false, error: `Image dimensions (${width}x${height}) exceed the maximum limit of ${MAX_DIM}px.` };
  }

  if (width * height > MAX_PIXELS) {
    return { safe: false, error: 'Total image pixel count exceeds safe processing threshold.' };
  }

  return { safe: true };
}

/**
 * In-browser canvas helper to flatten a transparent PNG cutout onto a solid background for JPEG export.
 * JPEG does not support alpha channel transparency, so a solid color is required.
 */
export async function flattenImageToJpeg(
  sourceImageUrl: string,
  backgroundColorHex = '#FFFFFF',
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to acquire 2D rendering canvas context.'));
          return;
        }

        // Fill background color
        ctx.fillStyle = backgroundColorHex;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw image cutout on top
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to encode flattened JPEG blob.'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image into canvas for background flattening.'));
    };

    img.src = sourceImageUrl;
  });
}
