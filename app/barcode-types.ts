export type BarcodeMode = 'auto' | 'qr' | 'barcode';

export type BarcodeDecodeOptions = {
  mode: BarcodeMode;
  /** Adds Micro QR, rMQR and DataBar; they stay excluded otherwise. */
  extended: boolean;
  /**
   * Runs every fallback pass (inverted luma, all RGB channels) even after a
   * hit and merges the distinct detections; meant for periodic frames.
   */
  exhaustive?: boolean;
};

export type BarcodePoint = { x: number; y: number };

export type BarcodeDetection = {
  text: string;
  format: string;
  /** Symbol boundary in top-left, top-right, bottom-right, bottom-left order. */
  points: BarcodePoint[];
};

export type BarcodeWorkerRequest = {
  type: 'decode';
  id: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  options: BarcodeDecodeOptions;
};

export type BarcodeWorkerResponse =
  | { type: 'ready' }
  | { type: 'init-error'; error: string }
  | { type: 'result'; id: number; detections: BarcodeDetection[] }
  | { type: 'error'; id: number; error: string; fatal: boolean };

export const MAX_BARCODE_FRAME_SIDE = 4096;

export function validateBarcodeFrame(
  width: number,
  height: number,
  pixels: { length: number },
): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_BARCODE_FRAME_SIDE ||
    height > MAX_BARCODE_FRAME_SIDE
  ) {
    throw new RangeError(`Invalid barcode frame size ${width}x${height}`);
  }
  if (pixels.length !== width * height * 4) {
    throw new RangeError(
      `Barcode frame needs ${width * height * 4} RGBA bytes, got ${pixels.length}`,
    );
  }
}

export function isBarcodeDecodeOptions(
  value: unknown,
): value is BarcodeDecodeOptions {
  const options = value as Partial<BarcodeDecodeOptions> | null;
  return (
    !!options &&
    (options.mode === 'auto' ||
      options.mode === 'qr' ||
      options.mode === 'barcode') &&
    typeof options.extended === 'boolean' &&
    (options.exhaustive === undefined ||
      typeof options.exhaustive === 'boolean')
  );
}
