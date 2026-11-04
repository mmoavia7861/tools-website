/**
 * Pure utility functions for video compression calculations,
 * bitrate estimation, aspect ratio preserving dimension scaling,
 * and duration formatting.
 */

export interface VideoDimensions {
  width: number;
  height: number;
}

export type CompressionPreset = 'discord' | 'whatsapp' | 'balanced' | 'extreme' | 'custom';

export interface PresetConfig {
  name: string;
  description: string;
  maxDimension: number; // e.g. 1280 (720p)
  targetBitrateKbps: number; // video bitrate in kbps
  frameRate: number; // fps
  audioBitrateKbps: number;
}

/**
 * Calculates aspect-ratio preserving dimensions with even pixel counts.
 * Encoders (H.264, VP8, VP9) require width and height to be divisible by 2.
 */
export function calculateTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): VideoDimensions {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return { width: 1280, height: 720 };
  }

  const largest = Math.max(originalWidth, originalHeight);
  if (largest <= maxDimension) {
    // Keep original but ensure even numbers
    return {
      width: originalWidth - (originalWidth % 2),
      height: originalHeight - (originalHeight % 2)
    };
  }

  const scale = maxDimension / largest;
  let scaledW = Math.round(originalWidth * scale);
  let scaledH = Math.round(originalHeight * scale);

  // Ensure divisible by 2
  scaledW = scaledW - (scaledW % 2);
  scaledH = scaledH - (scaledH % 2);

  // Guarantee minimum of 2
  return {
    width: Math.max(2, scaledW),
    height: Math.max(2, scaledH)
  };
}

/**
 * Estimates the final file size in bytes based on duration and bitrate.
 * Total bits = (videoBitrateKbps + audioBitrateKbps) * 1000 * durationSeconds.
 * Bytes = bits / 8.
 */
export function estimateCompressedSize(
  durationSeconds: number,
  videoBitrateKbps: number,
  audioBitrateKbps = 128
): number {
  if (durationSeconds <= 0) return 0;
  const totalBitrateBps = (videoBitrateKbps + audioBitrateKbps) * 1000;
  const estimatedBytes = Math.round((totalBitrateBps * durationSeconds) / 8);
  // Add ~3% overhead for container metadata (MP4/WebM headers)
  return Math.round(estimatedBytes * 1.03);
}

/**
 * Calculates the required video bitrate (in kbps) to fit within a target file size.
 */
export function calculateBitrateForTargetSize(
  targetBytes: number,
  durationSeconds: number,
  audioBitrateKbps = 96
): number {
  if (durationSeconds <= 0 || targetBytes <= 0) return 800;
  // Available bits excluding container overhead (~3%)
  const availableBits = (targetBytes * 0.97 * 8);
  const totalBitrateKbps = (availableBits / durationSeconds) / 1000;
  const videoBitrateKbps = totalBitrateKbps - audioBitrateKbps;

  // Clamp between 200 kbps and 12,000 kbps
  return Math.max(200, Math.min(12000, Math.round(videoBitrateKbps)));
}

/**
 * Formats duration in seconds to "MM:SS" or "HH:MM:SS".
 */
export function formatVideoDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const paddedSecs = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    const paddedMins = mins.toString().padStart(2, '0');
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${mins}:${paddedSecs}`;
}

/**
 * Returns preset settings based on user selection and original video details.
 */
export function getPresetConfig(
  preset: CompressionPreset,
  durationSeconds = 30
): PresetConfig {
  switch (preset) {
    case 'discord':
      // Target under 24MB (with margin for 25MB Discord limit)
      return {
        name: 'Discord / Email (Under 25 MB)',
        description: 'Optimized to fit within Discord and email attachment limits.',
        maxDimension: 1280,
        targetBitrateKbps: calculateBitrateForTargetSize(24 * 1024 * 1024, durationSeconds, 96),
        frameRate: 30,
        audioBitrateKbps: 96
      };
    case 'whatsapp':
      // Target under 15MB (WhatsApp limit is 16MB)
      return {
        name: 'WhatsApp / Chat (Under 16 MB)',
        description: 'Formatted for rapid messaging and quick mobile playback.',
        maxDimension: 854, // 480p
        targetBitrateKbps: calculateBitrateForTargetSize(14.5 * 1024 * 1024, durationSeconds, 64),
        frameRate: 25,
        audioBitrateKbps: 64
      };
    case 'extreme':
      return {
        name: 'Maximum Compression (-70% to -85%)',
        description: 'Downscale to 480p with efficient bitrate for archival.',
        maxDimension: 854,
        targetBitrateKbps: 600,
        frameRate: 24,
        audioBitrateKbps: 64
      };
    case 'balanced':
    default:
      return {
        name: 'Balanced 720p (-40% to -60%)',
        description: 'Sharp visual clarity with significant file size savings.',
        maxDimension: 1280,
        targetBitrateKbps: 1500,
        frameRate: 30,
        audioBitrateKbps: 128
      };
  }
}
