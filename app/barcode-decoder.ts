import {
  readBarcodes,
  type ReaderOptions,
  type ReadInputBarcodeFormat,
  type ReadResult,
} from 'zxing-wasm/reader';
import {
  validateBarcodeFrame,
  type BarcodeDecodeOptions,
  type BarcodeDetection,
  type BarcodePoint,
} from './barcode-types';

type FormatGroup = {
  read: ReadInputBarcodeFormat[];
  /** Result formats zxing-cpp may report for the requested variants. */
  accept: string[];
};

// zxing-wasm 3 treats a symbology root such as `QRCode` or `DataBar` as every
// variant, so standard modes name each variant explicitly.
const STANDARD_QR: FormatGroup = {
  read: ['QRCodeModel2'],
  accept: ['QRCode', 'QRCodeModel2'],
};
const EXTENDED_QR: FormatGroup = {
  read: ['MicroQRCode', 'RMQRCode'],
  accept: ['MicroQRCode', 'RMQRCode'],
};
// Auto mode keeps the 2D formats the previous runtime read. PDF417 has no
// separate standard variant, so its root is requested and MicroPDF417 results
// are only accepted when extended; AztecRune stays excluded.
const AUTO_MATRIX: FormatGroup = {
  read: ['DataMatrix', 'AztecCode', 'PDF417'],
  accept: ['DataMatrix', 'Aztec', 'AztecCode', 'PDF417', 'CompactPDF417'],
};
const EXTENDED_AUTO_MATRIX: FormatGroup = {
  read: [],
  accept: ['MicroPDF417'],
};
const STANDARD_LINEAR: FormatGroup = {
  read: [
    'Code128',
    'Code39Std',
    'Code93',
    'Codabar',
    'ITF',
    'EAN13',
    'EAN8',
    'UPCA',
    'UPCE',
  ],
  accept: [
    'Code128',
    'Code39',
    'Code39Std',
    'Code93',
    'Codabar',
    'ITF',
    'ITF14',
    'EAN13',
    'EAN8',
    'ISBN',
    'UPCA',
    'UPCE',
  ],
};
const EXTENDED_LINEAR: FormatGroup = {
  read: [
    'DataBarOmni',
    'DataBarStk',
    'DataBarStkOmni',
    'DataBarLtd',
    'DataBarExp',
    'DataBarExpStk',
  ],
  accept: [
    'DataBar',
    'DataBarOmni',
    'DataBarStk',
    'DataBarStkOmni',
    'DataBarLtd',
    'DataBarExp',
    'DataBarExpStk',
  ],
};

const SAMPLE_TARGET = 16_384;
const MIN_MEAN_CHROMA = 2;
const MIN_CHANNEL_DEVIATION = 4;

function formatGroups({ mode, extended }: BarcodeDecodeOptions): FormatGroup[] {
  const groups: FormatGroup[] = [];
  if (mode !== 'barcode') {
    groups.push(STANDARD_QR, ...(extended ? [EXTENDED_QR] : []));
  }
  if (mode !== 'qr') {
    groups.push(STANDARD_LINEAR, ...(extended ? [EXTENDED_LINEAR] : []));
  }
  if (mode === 'auto') {
    groups.push(AUTO_MATRIX, ...(extended ? [EXTENDED_AUTO_MATRIX] : []));
  }
  return groups;
}

/** `linearOnly` limits a pass to 1D formats, used for inverted planes. */
export function createReaderOptions(
  options: BarcodeDecodeOptions,
  linearOnly = false,
): ReaderOptions {
  const groups = formatGroups(options).filter(
    (group) =>
      !linearOnly || group === STANDARD_LINEAR || group === EXTENDED_LINEAR,
  );
  return {
    formats: groups.flatMap((group) => group.read),
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    binarizer: 'LocalAverage',
    isPure: false,
    returnErrors: false,
    maxNumberOfSymbols: 8,
  };
}

export function acceptedFormats(options: BarcodeDecodeOptions): Set<string> {
  return new Set(formatGroups(options).flatMap((group) => group.accept));
}

export function isPlausibleQuad(
  points: BarcodePoint[],
  width: number,
  height: number,
): boolean {
  const margin = Math.max(4, Math.max(width, height) * 0.02);
  const inside = points.every(
    ({ x, y }) =>
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= -margin &&
      y >= -margin &&
      x <= width + margin &&
      y <= height + margin,
  );
  if (points.length !== 4 || !inside) {
    return false;
  }
  const span = Math.max(
    ...points.map((point, index) => {
      const next = points[(index + 1) % 4];
      return Math.hypot(next.x - point.x, next.y - point.y);
    }),
  );
  if (span < 2) {
    return false;
  }
  // Linear symbols can be nearly flat; only reject clear self-intersections.
  let positive = false;
  let negative = false;
  points.forEach((a, index) => {
    const b = points[(index + 1) % 4];
    const c = points[(index + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    positive ||= cross > span;
    negative ||= cross < -span;
  });
  return !(positive && negative);
}

export function toBarcodeDetections(
  results: ReadResult[],
  options: BarcodeDecodeOptions,
  width: number,
  height: number,
): BarcodeDetection[] {
  const accepted = acceptedFormats(options);
  return results.flatMap((result) => {
    if (
      !result.isValid ||
      result.error ||
      !result.text ||
      !accepted.has(result.format)
    ) {
      return [];
    }
    const { topLeft, topRight, bottomRight, bottomLeft } = result.position;
    const points = [topLeft, topRight, bottomRight, bottomLeft].map(
      ({ x, y }) => ({ x, y }),
    );
    return isPlausibleQuad(points, width, height)
      ? [{ text: result.text, format: result.format, points }]
      : [];
  });
}

function nextPrime(value: number): number {
  for (let candidate = Math.max(2, value); ; candidate += 1) {
    let prime = true;
    for (let divisor = 2; divisor * divisor <= candidate; divisor += 1) {
      if (candidate % divisor === 0) {
        prime = false;
        break;
      }
    }
    if (prime) {
      return candidate;
    }
  }
}

function center(points: BarcodePoint[]): BarcodePoint {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function diagonal([a, b, c, d]: BarcodePoint[]): number {
  return Math.max(
    Math.hypot(c.x - a.x, c.y - a.y),
    Math.hypot(d.x - b.x, d.y - b.y),
  );
}

/**
 * Appends `extra` detections unless the same text and format already sits at
 * a nearby centre; identical codes at different locations are all kept.
 */
export function mergeDetections(
  base: BarcodeDetection[],
  extra: BarcodeDetection[],
): BarcodeDetection[] {
  const merged = [...base];
  for (const detection of extra) {
    const position = center(detection.points);
    const duplicate = merged.some((existing) => {
      const other = center(existing.points);
      const radius = Math.max(
        8,
        0.25 * Math.max(diagonal(existing.points), diagonal(detection.points)),
      );
      return (
        existing.text === detection.text &&
        existing.format === detection.format &&
        Math.hypot(other.x - position.x, other.y - position.y) <= radius
      );
    });
    if (!duplicate) {
      merged.push(detection);
    }
  }
  return merged;
}

/** Index of the zxing luma plane in {@link analyzeChannels} statistics. */
export const LUMA_PLANE = 3;

function luma(r: number, g: number, b: number): number {
  // Same weights zxing-wasm uses for its own RGBA to grayscale conversion.
  return (306 * r + 601 * g + 117 * b + 512) >> 10;
}

/**
 * Samples R, G, B and luma (index 3) statistics; a prime stride avoids
 * aliasing with bar pitch. `negative` marks planes whose dominant level is
 * darker than their mid-range, i.e. light features on a dark background.
 */
export function analyzeChannels(pixels: Uint8ClampedArray): {
  order: number[];
  deviation: number[];
  negative: boolean[];
  meanChroma: number;
} {
  const pixelCount = pixels.length / 4;
  const ideal = Math.floor(pixelCount / SAMPLE_TARGET);
  const stride = ideal < 11 ? 1 : nextPrime(ideal);
  const sums = [0, 0, 0, 0];
  const squares = [0, 0, 0, 0];
  const minimum = [255, 255, 255, 255];
  const maximum = [0, 0, 0, 0];
  let chroma = 0;
  let samples = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    const offset = pixel * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const values = [r, g, b, luma(r, g, b)];
    values.forEach((value, plane) => {
      sums[plane] += value;
      squares[plane] += value * value;
      minimum[plane] = Math.min(minimum[plane], value);
      maximum[plane] = Math.max(maximum[plane], value);
    });
    chroma += Math.max(r, g, b) - Math.min(r, g, b);
    samples += 1;
  }
  const mean = sums.map((sum) => sum / samples);
  const deviation = mean.map((value, plane) =>
    Math.sqrt(Math.max(0, squares[plane] / samples - value ** 2)),
  );
  return {
    order: [0, 1, 2].sort((a, b) => deviation[b] - deviation[a]),
    deviation,
    negative: mean.map(
      (value, plane) => value < (minimum[plane] + maximum[plane]) / 2,
    ),
    meanChroma: chroma / samples,
  };
}

function fillPlane(
  source: Uint8ClampedArray,
  plane: number,
  invert: boolean,
  target: Uint8ClampedArray,
): void {
  for (let offset = 0; offset < source.length; offset += 4) {
    const raw =
      plane === LUMA_PLANE
        ? luma(source[offset], source[offset + 1], source[offset + 2])
        : source[offset + plane];
    const value = invert ? 255 - raw : raw;
    target[offset] = value;
    target[offset + 1] = value;
    target[offset + 2] = value;
    target[offset + 3] = 255;
  }
}

/**
 * Decodes one RGBA frame. Every call builds fresh reader options, so no
 * detector state (such as partial DataBar pairs) survives between frames.
 *
 * Passes: default luma; then, unless every plane is flat, inverted luma for
 * 1D formats (zxing's tryInvert does not cover them) and the strongest RGB
 * channel of chromatic frames, inverted when its contrast is negative.
 * Standard frames stop at the first pass with results (at most 3 reads).
 * Exhaustive frames run every pass, add the other two channels and merge all
 * discoveries (at most 5 reads), so a black code cannot mask a colour one.
 */
export async function decodeBarcodeFrame(
  width: number,
  height: number,
  pixels: Uint8Array | Uint8ClampedArray,
  options: BarcodeDecodeOptions,
): Promise<BarcodeDetection[]> {
  validateBarcodeFrame(width, height, pixels);
  const rgba =
    pixels instanceof Uint8ClampedArray
      ? pixels
      : new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length);
  const fullOptions = createReaderOptions(options);
  const linearOptions = createReaderOptions(options, true);
  const read = async (data: Uint8ClampedArray, linearOnly: boolean) =>
    toBarcodeDetections(
      await readBarcodes(
        { width, height, data } as unknown as ImageData,
        linearOnly ? linearOptions : fullOptions,
      ),
      options,
      width,
      height,
    );

  let found = await read(rgba, false);
  if (found.length > 0 && !options.exhaustive) {
    return found;
  }
  const stats = analyzeChannels(rgba);
  if (Math.max(...stats.deviation) < MIN_CHANNEL_DEVIATION) {
    return found;
  }
  const passes: Array<{ plane: number; invert: boolean; linear: boolean }> =
    [];
  if (linearOptions.formats?.length) {
    passes.push({ plane: LUMA_PLANE, invert: true, linear: true });
  }
  if (stats.meanChroma >= MIN_MEAN_CHROMA) {
    const channels = options.exhaustive ? stats.order : stats.order.slice(0, 1);
    for (const channel of channels) {
      if (stats.deviation[channel] >= MIN_CHANNEL_DEVIATION) {
        passes.push({
          plane: channel,
          invert: stats.negative[channel],
          linear: false,
        });
      }
    }
  }
  const buffer = new Uint8ClampedArray(rgba.length);
  for (const pass of passes) {
    fillPlane(rgba, pass.plane, pass.invert, buffer);
    const detections = await read(buffer, pass.linear);
    if (!options.exhaustive && detections.length > 0) {
      return detections;
    }
    found = mergeDetections(found, detections);
  }
  return found;
}
