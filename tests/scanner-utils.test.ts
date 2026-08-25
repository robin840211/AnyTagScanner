import {
  BarcodeFormat,
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  QRCodeWriter,
  RGBLuminanceSource,
} from '@zxing/library';
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
