import { ARucoDetector, initSync } from '@ar-js-org/aruco-rs';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSafeWebUrl, paginateScanText } from '../app/scanner-utils';
import { ARUCO_FAMILY_DEFINITIONS } from '../app/aruco-engine';
import { createOpenCvDetectionSnippet } from '../app/opencv-reference';

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

describe('result pagination', () => {
  it('preserves line breaks within each viewport-sized page', () => {
    expect(paginateScanText('BEGIN:VCARD\r\nFN:Robin\r\nEND:VCARD', true)).toEqual(['BEGIN:VCARD\nFN:Robin\nEND:VCARD']);
    const lines = Array.from({ length: 20 }, (_, index) => 'Line ' + index);
    const pages = paginateScanText(lines.join('\n'), true);
    expect(pages.every(page => page.split('\n').length <= 3)).toBe(true);
    expect(pages.join('\n')).toBe(lines.join('\n'));
  });
  it('bounds long wide-character text and preserves its content', () => {
    const value = '辨識內容'.repeat(200);
    const pages = paginateScanText(value, true);
    expect(pages.every(page => Array.from(page).length <= 54)).toBe(true);
    expect(pages.join('')).toBe(value);
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

describe('OpenCV compatibility reference', () => {
  it('maps the browser ArUco families to explicit OpenCV dictionaries', () => {
    expect(ARUCO_FAMILY_DEFINITIONS).toMatchObject({
      ARUCO: { opencvDictionary: 'DICT_ARUCO_ORIGINAL' },
      ARUCO_MIP_36h12: { opencvDictionary: 'DICT_ARUCO_MIP_36h12' },
    });
  });

  it('creates a current ArucoDetector Python example', () => {
    const snippet = createOpenCvDetectionSnippet('DICT_APRILTAG_36h11');
    expect(snippet).toContain('cv2.aruco.DICT_APRILTAG_36h11');
    expect(snippet).toContain('cv2.aruco.ArucoDetector(dictionary)');
    expect(snippet).toContain('detector.detectMarkers(image)');
  });
});
