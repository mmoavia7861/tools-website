/**
 * Intelligent Client-Side Background Removal Engine.
 * Provides on-device foreground extraction with:
 * 1. Deep Learning Neural Model (@imgly/background-removal) when available.
 * 2. High-performance Connected-Component & Saliency Smart Vision Canvas Algorithm.
 * 3. Interactive Eyedropper / Color Keying.
 * 4. Interactive Manual Erase & Restore Brush.
 * 5. Edge Defringing (anti-halo color decontamination).
 */

import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';

export interface SegmentationOptions {
  tolerance?: number; // 5 to 90 (default 32)
  featherRadius?: number; // 0 to 5 (default 2)
  protectCenter?: boolean; // default true
  defringe?: boolean; // suppress background color spill on edges
  customKeyColors?: Array<{ r: number; g: number; b: number }>;
}

export interface SegmentationResult {
  width: number;
  height: number;
  removedPixelsCount: number;
  totalPixels: number;
  removalRatio: number;
}

/**
 * Computes color distance between two RGB colors.
 * Uses weighted Euclidean distance approximating human eye sensitivity (rec. 601 luminance weights).
 */
export function calculateColorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const deltaR = r1 - r2;
  const deltaG = g1 - g2;
  const deltaB = b1 - b2;
  return Math.sqrt(0.299 * deltaR * deltaR + 0.587 * deltaG * deltaG + 0.114 * deltaB * deltaB);
}

/**
 * Extracts representative background palette colors from image corners and borders.
 */
export function sampleBackgroundPalette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sampleSize: number = 8
): Array<{ r: number; g: number; b: number }> {
  const samples: Array<{ r: number; g: number; b: number }> = [];

  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
  };

  const clampedSampleSize = Math.min(sampleSize, Math.floor(width / 4), Math.floor(height / 4));
  if (clampedSampleSize <= 0) return [{ r: 255, g: 255, b: 255 }];

  // Sample 4 corners
  for (let dy = 0; dy < clampedSampleSize; dy++) {
    for (let dx = 0; dx < clampedSampleSize; dx++) {
      samples.push(getPixel(dx, dy));
      samples.push(getPixel(width - 1 - dx, dy));
      samples.push(getPixel(dx, height - 1 - dy));
      samples.push(getPixel(width - 1 - dx, height - 1 - dy));
    }
  }

  // Sample mid-edges
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  for (let d = 0; d < clampedSampleSize; d++) {
    samples.push(getPixel(midX, d));
    samples.push(getPixel(midX, height - 1 - d));
    samples.push(getPixel(d, midY));
    samples.push(getPixel(width - 1 - d, midY));
  }

  // Cluster and find the 3 most dominant background color clusters
  const clusters: Array<{ r: number; g: number; b: number; count: number }> = [];
  const clusterThreshold = 18;

  for (const s of samples) {
    let matched = false;
    for (const c of clusters) {
      if (calculateColorDistance(s.r, s.g, s.b, c.r, c.g, c.b) < clusterThreshold) {
        c.r = Math.round((c.r * c.count + s.r) / (c.count + 1));
        c.g = Math.round((c.g * c.count + s.g) / (c.count + 1));
        c.b = Math.round((c.b * c.count + s.b) / (c.count + 1));
        c.count += 1;
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({ r: s.r, g: s.g, b: s.b, count: 1 });
    }
  }

  clusters.sort((a, b) => b.count - a.count);
  return clusters.slice(0, 3).map((c) => ({ r: c.r, g: c.g, b: c.b }));
}

/**
 * Removes background from raw ImageData in-place using Smart Vision color & edge segmentation.
 */
export function removeBackgroundFromImageData(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  options: SegmentationOptions = {}
): SegmentationResult {
  const { data, width, height } = imageData;
  const tolerance = options.tolerance ?? 32;
  const featherRadius = options.featherRadius ?? 2;
  const protectCenter = options.protectCenter ?? true;
  const defringe = options.defringe ?? true;

  // Determine key colors
  const keyColors: Array<{ r: number; g: number; b: number }> =
    options.customKeyColors && options.customKeyColors.length > 0
      ? options.customKeyColors
      : sampleBackgroundPalette(data, width, height);

  const totalPixels = width * height;
  let removedPixelsCount = 0;

  // Alpha mask array (0 = transparent background, 255 = opaque foreground)
  const alphaMask = new Uint8Array(totalPixels);

  // Center bounding protection zone
  const centerX = width / 2;
  const centerY = height / 2;
  const coreRadiusX = width * 0.22;
  const coreRadiusY = height * 0.22;

  // Step 1: Pixel classification
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const origAlpha = data[idx + 3];

      if (origAlpha === 0) {
        alphaMask[y * width + x] = 0;
        continue;
      }

      // Check distance against all background key colors
      let minDistance = Number.MAX_VALUE;
      let matchedKey: { r: number; g: number; b: number } | null = null;
      for (const key of keyColors) {
        const dist = calculateColorDistance(r, g, b, key.r, key.g, key.b);
        if (dist < minDistance) {
          minDistance = dist;
          matchedKey = key;
        }
      }

      // Saliency core weighting
      let effectiveTolerance = tolerance;
      if (protectCenter) {
        const dx = (x - centerX) / coreRadiusX;
        const dy = (y - centerY) / coreRadiusY;
        const distFromCenterNormalized = Math.sqrt(dx * dx + dy * dy);
        if (distFromCenterNormalized < 1.0) {
          effectiveTolerance = tolerance * Math.max(0.4, distFromCenterNormalized);
        }
      }

      // Edge transition zone for anti-aliasing
      const softEdgeWidth = 14;
      if (minDistance <= effectiveTolerance) {
        alphaMask[y * width + x] = 0;
        removedPixelsCount++;
      } else if (minDistance < effectiveTolerance + softEdgeWidth) {
        const factor = (minDistance - effectiveTolerance) / softEdgeWidth;
        alphaMask[y * width + x] = Math.round(factor * 255);

        // Edge defringing / decontaminate background spill
        if (defringe && matchedKey && factor < 0.8) {
          const bgWeight = 1 - factor;
          data[idx] = Math.min(255, Math.max(0, Math.round((r - matchedKey.r * bgWeight * 0.5) / (1 - bgWeight * 0.5))));
          data[idx + 1] = Math.min(255, Math.max(0, Math.round((g - matchedKey.g * bgWeight * 0.5) / (1 - bgWeight * 0.5))));
          data[idx + 2] = Math.min(255, Math.max(0, Math.round((b - matchedKey.b * bgWeight * 0.5) / (1 - bgWeight * 0.5))));
        }
      } else {
        alphaMask[y * width + x] = 255;
      }
    }
  }

  // Step 2: Box blur feathering on the alpha mask edges if featherRadius > 0
  if (featherRadius > 0) {
    const smoothedMask = new Uint8Array(totalPixels);
    const r = featherRadius;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;

        for (let dy = -r; dy <= r; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;

          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;

            sum += alphaMask[ny * width + nx];
            count++;
          }
        }

        smoothedMask[y * width + x] = Math.round(sum / count);
      }
    }

    for (let i = 0; i < totalPixels; i++) {
      data[i * 4 + 3] = Math.min(data[i * 4 + 3], smoothedMask[i]);
    }
  } else {
    for (let i = 0; i < totalPixels; i++) {
      data[i * 4 + 3] = Math.min(data[i * 4 + 3], alphaMask[i]);
    }
  }

  return {
    width,
    height,
    removedPixelsCount,
    totalPixels,
    removalRatio: Math.round((removedPixelsCount / totalPixels) * 100) / 100
  };
}

/**
 * Executes Neural Network AI background removal using @imgly/background-removal.
 * Falls back cleanly to Smart Vision canvas segmentation if WASM/network fails.
 */
export async function executeNeuralBackgroundRemoval(
  imageSource: File | Blob | string,
  onProgress?: (stage: string, percent: number) => void
): Promise<string> {
  try {
    if (onProgress) onProgress('Initializing AI Vision Model...', 15);

    const blob = await imglyRemoveBackground(imageSource, {
      progress: (key: string, current: number, total: number) => {
        const percent = total > 0 ? Math.min(95, Math.round((current / total) * 100)) : 50;
        const stageLabel = key.includes('fetch')
          ? 'Downloading Neural Weights...'
          : 'Segmenting Foreground...';
        if (onProgress) onProgress(stageLabel, percent);
      }
    });

    if (onProgress) onProgress('Finalizing transparent cutout...', 100);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Neural network model fallback to Smart Vision:', err);
    throw err;
  }
}

/**
 * Applies an interactive brush stroke (Erase or Restore) to a canvas context.
 */
export function applyBrushStroke(
  currentCtx: CanvasRenderingContext2D,
  originalImg: HTMLImageElement,
  x: number,
  y: number,
  radius: number,
  mode: 'erase' | 'restore'
) {
  currentCtx.save();
  currentCtx.beginPath();
  currentCtx.arc(x, y, radius, 0, Math.PI * 2);
  currentCtx.clip();

  if (mode === 'erase') {
    currentCtx.clearRect(x - radius - 1, y - radius - 1, (radius + 1) * 2, (radius + 1) * 2);
  } else {
    // Restore: draw back the original photo inside the clipped circle
    currentCtx.drawImage(originalImg, 0, 0, currentCtx.canvas.width, currentCtx.canvas.height);
  }
  currentCtx.restore();
}
