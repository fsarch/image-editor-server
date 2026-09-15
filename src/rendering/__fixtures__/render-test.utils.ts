import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

export interface DecodedImage {
  width: number;
  height: number;
  // RGBA, 4 bytes per pixel, row-major.
  data: Buffer;
}

/** Decodes a PNG buffer into raw RGBA pixel data via @napi-rs/canvas (no extra image-decoding dependency needed). */
export async function decodePng(buffer: Buffer): Promise<DecodedImage> {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);

  return { width: image.width, height: image.height, data: Buffer.from(imageData.data) };
}

/** Reads the RGBA value of one pixel out of a DecodedImage. */
export function pixelAt(image: DecodedImage, x: number, y: number): [number, number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2], image.data[offset + 3]];
}

/** Parses a "#rrggbb" string into an [r,g,b,255] tuple, for comparing against pixelAt(). */
export function hexColor(hex: string): [number, number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    255,
  ];
}

export interface CompareResult {
  matches: boolean;
  diffPixels: number;
  totalPixels: number;
  reason?: string;
}

export function compareImages(
  actual: DecodedImage,
  expected: DecodedImage,
  options: { channelTolerance?: number; maxDiffPixels?: number } = {},
): CompareResult {
  const channelTolerance = options.channelTolerance ?? 4;
  const maxDiffPixels = options.maxDiffPixels ?? 0;
  const totalPixels = expected.width * expected.height;

  if (actual.width !== expected.width || actual.height !== expected.height) {
    return {
      matches: false,
      diffPixels: totalPixels,
      totalPixels,
      reason: `size mismatch: actual ${actual.width}x${actual.height} vs expected ${expected.width}x${expected.height}`,
    };
  }

  let diffPixels = 0;

  for (let i = 0; i < actual.data.length; i += 4) {
    const dr = Math.abs(actual.data[i] - expected.data[i]);
    const dg = Math.abs(actual.data[i + 1] - expected.data[i + 1]);
    const db = Math.abs(actual.data[i + 2] - expected.data[i + 2]);
    const da = Math.abs(actual.data[i + 3] - expected.data[i + 3]);

    if (dr > channelTolerance || dg > channelTolerance || db > channelTolerance || da > channelTolerance) {
      diffPixels++;
    }
  }

  return { matches: diffPixels <= maxDiffPixels, diffPixels, totalPixels };
}

/**
 * Compares a freshly rendered PNG against a checked-in baseline fixture
 * file, throwing a descriptive error on mismatch.
 *
 * If the baseline file doesn't exist yet, or UPDATE_RENDER_BASELINES=1 is
 * set, the actual output is written as the new baseline instead of being
 * compared (the same "record once, diff afterwards" convention as Jest/
 * Vitest snapshot testing) - use that to accept an intentional rendering
 * change, never to silence a failure you haven't understood.
 */
export async function expectMatchesBaseline(
  actualPngBuffer: Buffer,
  baselinePath: string,
  options?: { channelTolerance?: number; maxDiffPixels?: number },
): Promise<void> {
  if (process.env.UPDATE_RENDER_BASELINES === '1' || !existsSync(baselinePath)) {
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, actualPngBuffer);
    return;
  }

  const [actual, expected] = await Promise.all([
    decodePng(actualPngBuffer),
    decodePng(readFileSync(baselinePath)),
  ]);

  const result = compareImages(actual, expected, options);

  if (!result.matches) {
    throw new Error(
      `Rendered image does not match baseline "${baselinePath}": ` +
        (result.reason ??
          `${result.diffPixels}/${result.totalPixels} pixels differ beyond tolerance ` +
            `(allowed ${options?.maxDiffPixels ?? 0}).`) +
        ' If this change is intentional, rerun with UPDATE_RENDER_BASELINES=1 to accept the new baseline.',
    );
  }
}
