import {
  BarcodeFormat,
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  QRCodeWriter,
  RGBLuminanceSource,
} from '@zxing/library';
import { ARucoDetector, initSync } from '@ar-js-org/aruco-rs';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSafeWebUrl } from '../app/scanner-utils';

describe('safe web URL validation', () => {
  it.each([
    ['https://example.com/path', true],
    ['http://localhost:3000', true],
    ['javascript:alert(1)', false],
    ['data:text/html,unsafe', false],
    ['not a url', false],
  ])('classifies %s', (value, expected) => {
    expect(isSafeWebUrl(value)).toBe(expected);
  });
});

describe('ZXing integration', () => {
  it('round-trips a generated QR code', () => {
    const expected = 'https://example.com/tagscanner';
    const size = 256;
    const matrix = new QRCodeWriter().encode(
      expected,
      BarcodeFormat.QR_CODE,
      size,
      size,
      new Map(),
    );
    const luminances = new Uint8ClampedArray(size * size);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        luminances[y * size + x] = matrix.get(x, y) ? 0 : 255;
      }
    }

    const source = new RGBLuminanceSource(luminances, size, size);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const result = new MultiFormatReader().decode(bitmap);

    expect(result.getBarcodeFormat()).toBe(BarcodeFormat.QR_CODE);
    expect(result.getText()).toBe(expected);
  });
});

describe('ArUco WebAssembly integration', () => {
  it('detects a generated Original ArUco marker', () => {
    const wasmPath = new URL(
      '../node_modules/@ar-js-org/aruco-rs/aruco_rs_bg.wasm',
      import.meta.url,
    );
    const wasmBytes = Uint8Array.from(readFileSync(wasmPath));
    initSync({ module: wasmBytes.buffer });

    const width = 240;
    const height = 240;
    const pixels = new Uint8Array(width * height * 4).fill(255);
    const markerBits = Array.from({ length: 5 }, () => [1, 0, 0, 0, 0]);
    const cellSize = 24;
    const offset = 36;

    for (let cellY = 0; cellY < 7; cellY += 1) {
      for (let cellX = 0; cellX < 7; cellX += 1) {
        const isBorder =
          cellX === 0 || cellY === 0 || cellX === 6 || cellY === 6;
        const value = isBorder
          ? 0
          : markerBits[cellY - 1][cellX - 1] * 255;

        for (let pixelY = 0; pixelY < cellSize; pixelY += 1) {
          for (let pixelX = 0; pixelX < cellSize; pixelX += 1) {
            const x = offset + cellX * cellSize + pixelX;
            const y = offset + cellY * cellSize + pixelY;
            const index = (y * width + x) * 4;
            pixels[index] = value;
            pixels[index + 1] = value;
            pixels[index + 2] = value;
            pixels[index + 3] = 255;
          }
        }
      }
    }

    const detector = new ARucoDetector('ARUCO');
    const markers = detector.detect_image(width, height, pixels) as Array<{
      id: number;
      distance: number;
    }>;
    detector.free();

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ id: 0, distance: 0 });

    const mipDetector = new ARucoDetector('ARUCO_MIP_36h12');
    const blankPixels = new Uint8Array(width * height * 4).fill(255);
    expect(mipDetector.detect_image(width, height, blankPixels)).toEqual([]);
    mipDetector.free();
  });
});
