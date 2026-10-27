import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  prepareZXingModule as prepareReader,
  readBarcodes,
  type ReadResult,
} from 'zxing-wasm/reader';
import {
  prepareZXingModule as prepareWriter,
  writeBarcode,
} from 'zxing-wasm/writer';
import {
  analyzeChannels,
  createReaderOptions,
  decodeBarcodeFrame,
  mergeDetections,
  toBarcodeDetections,
} from '../app/barcode-decoder';
import type {
  BarcodeDecodeOptions,
  BarcodePoint,
} from '../app/barcode-types';

type Rgb = [number, number, number];
type Quad = [BarcodePoint, BarcodePoint, BarcodePoint, BarcodePoint];
type Modules = {
  width: number;
  height: number;
  dark(x: number, y: number): boolean;
};
type Frame = { width: number; height: number; pixels: Uint8ClampedArray };

const require = createRequire(import.meta.url);
const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];
const AUTO: BarcodeDecodeOptions = { mode: 'auto', extended: false };
// 28 alphanumerics force QR version 2, whose alignment pattern lets the
// detector resolve true perspective instead of a parallelogram estimate.
const QR_TEXT = 'TAGSCANNER-QR-ALIGNMENT-0001';
const CODE128_TEXT = 'TAG-128-OK';

function wasmBinary(specifier: string): ArrayBuffer {
  const file = readFileSync(require.resolve(specifier));
  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;
}

async function symbolModules(
  text: string,
  format:
    | 'QRCode'
    | 'MicroQRCode'
    | 'Code128'
    | 'DataMatrix'
    | 'AztecCode'
    | 'PDF417',
): Promise<Modules> {
  const written = await writeBarcode(text, { format });
  expect(written.error).toBe('');
  const { data, width, height } = written.symbol;
  // Every probed module is dark: QR/DataMatrix/PDF417/Code128 start at the
  // top-left corner, while Aztec's bullseye centre is dark.
  const probe =
    format === 'AztecCode'
      ? data[(height >> 1) * width + (width >> 1)]
      : data[0];
  // Symbol polarity is undocumented; a uniform border would be a quiet zone.
  const border: number[] = [];
  for (let x = 0; x < width; x += 1) {
    border.push(data[x], data[(height - 1) * width + x]);
  }
  for (let y = 0; y < height; y += 1) {
    border.push(data[y * width], data[y * width + width - 1]);
  }
  if (!border.every((value) => value === border[0])) {
    return { width, height, dark: (x, y) => data[y * width + x] === probe };
  }
  const darkValue = data.find((value) => value !== border[0]);
  let [left, top, right, bottom] = [width, height, 0, 0];
  data.forEach((value, index) => {
    if (value === darkValue) {
      left = Math.min(left, index % width);
      right = Math.max(right, index % width);
      top = Math.min(top, Math.floor(index / width));
      bottom = Math.max(bottom, Math.floor(index / width));
    }
  });
  return {
    width: right - left + 1,
    height: bottom - top + 1,
    dark: (x, y) => data[(y + top) * width + x + left] === darkValue,
  };
}

type SymbolFormat = Parameters<typeof symbolModules>[1];

/** Homography mapping the unit square onto a TL, TR, BR, BL quad. */
function squareToQuad([p0, p1, p2, p3]: Quad): number[] {
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
    1,
  ];
}

function invert3([a, b, c, d, e, f, g, h, i]: number[]): number[] {
  const determinant =
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ].map((value) => value / determinant);
}

function render(
  modules: Modules,
  quad: Quad,
  width: number,
  height: number,
  dark: Rgb = BLACK,
  light: Rgb = WHITE,
  into?: Frame,
): Frame {
  const m = invert3(squareToQuad(quad));
  // With `into`, only the symbol area is painted onto the existing frame.
  const pixels = into?.pixels ?? new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w = m[6] * px + m[7] * py + m[8];
      const u = (m[0] * px + m[1] * py + m[2]) / w;
      const v = (m[3] * px + m[4] * py + m[5]) / w;
      const inside = u >= 0 && u < 1 && v >= 0 && v < 1;
      if (into && !inside) {
        continue;
      }
      const isDark =
        inside &&
        modules.dark(
          Math.floor(u * modules.width),
          Math.floor(v * modules.height),
        );
      pixels.set([...(isDark ? dark : light), 255], (y * width + x) * 4);
    }
  }
  return { width, height, pixels };
}

function rect(left: number, top: number, right: number, bottom: number): Quad {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function decode(frame: Frame, options: BarcodeDecodeOptions = AUTO) {
  return decodeBarcodeFrame(frame.width, frame.height, frame.pixels, options);
}

function expectNear(actual: BarcodePoint[], expected: Quad, tolerance: number) {
  expect(actual).toHaveLength(4);
  actual.forEach((point, index) => {
    expect(
      Math.hypot(point.x - expected[index].x, point.y - expected[index].y),
    ).toBeLessThanOrEqual(tolerance);
  });
}

function noise(width: number, height: number, seed: number, color: boolean) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) & 255;
  };
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const gray = next();
    pixels[offset] = gray;
    pixels[offset + 1] = color ? next() : gray;
    pixels[offset + 2] = color ? next() : gray;
    pixels[offset + 3] = 255;
  }
  return { width, height, pixels };
}

let qr: Modules;
let code128: Modules;

beforeAll(async () => {
  await prepareReader({
    overrides: { wasmBinary: wasmBinary('zxing-wasm/reader/zxing_reader.wasm') },
    fireImmediately: true,
  });
  await prepareWriter({
    overrides: { wasmBinary: wasmBinary('zxing-wasm/writer/zxing_writer.wasm') },
    fireImmediately: true,
  });
  qr = await symbolModules(QR_TEXT, 'QRCode');
  code128 = await symbolModules(CODE128_TEXT, 'Code128');
}, 60_000);

describe('barcode reader options', () => {
  const formats = (options: BarcodeDecodeOptions) =>
    createReaderOptions(options).formats ?? [];

  it('never requests symbology roots that pull in hidden variants', () => {
    for (const mode of ['auto', 'qr', 'barcode'] as const) {
      for (const extended of [false, true]) {
        const requested = formats({ mode, extended });
        expect(requested).not.toContain('QRCode');
        expect(requested).not.toContain('DataBar');
        expect(requested).not.toContain('EANUPC');
      }
    }
  });

  it('limits standard modes to standard QR and common 1D formats', () => {
    const auto = formats(AUTO);
    expect(auto).toEqual(expect.arrayContaining(['QRCodeModel2', 'Code128']));
    expect(auto.some((format) => /Micro|RMQR|DataBar/.test(format))).toBe(
      false,
    );
    expect(formats({ mode: 'qr', extended: false })).toEqual(['QRCodeModel2']);
    expect(formats({ mode: 'barcode', extended: false })).not.toContain(
      'QRCodeModel2',
    );
  });

  it('keeps DataMatrix, Aztec and PDF417 in auto mode only', () => {
    const matrix = ['DataMatrix', 'AztecCode', 'PDF417'];
    expect(formats(AUTO)).toEqual(expect.arrayContaining(matrix));
    for (const mode of ['qr', 'barcode'] as const) {
      const requested: string[] = formats({ mode, extended: true });
      expect(matrix.some((format) => requested.includes(format))).toBe(false);
    }
  });

  it('adds Micro QR, rMQR and DataBar only when extended', () => {
    expect(formats({ mode: 'qr', extended: true })).toEqual(
      expect.arrayContaining(['MicroQRCode', 'RMQRCode']),
    );
    expect(formats({ mode: 'barcode', extended: true })).toEqual(
      expect.arrayContaining(['DataBarOmni', 'DataBarExp']),
    );
    expect(formats({ mode: 'qr', extended: true })).not.toContain(
      'DataBarOmni',
    );
  });
});

describe('barcode result filtering', () => {
  const square = {
    topLeft: { x: 10, y: 10 },
    topRight: { x: 60, y: 10 },
    bottomRight: { x: 60, y: 60 },
    bottomLeft: { x: 10, y: 60 },
  };
  const result = (overrides: Partial<ReadResult>) =>
    ({
      isValid: true,
      error: '',
      text: 'ok',
      format: 'QRCodeModel2',
      position: square,
      ...overrides,
    }) as unknown as ReadResult;

  it('keeps valid results with TL TR BR BL points', () => {
    expect(toBarcodeDetections([result({})], AUTO, 100, 100)).toEqual([
      {
        text: 'ok',
        format: 'QRCodeModel2',
        points: [
          { x: 10, y: 10 },
          { x: 60, y: 10 },
          { x: 60, y: 60 },
          { x: 10, y: 60 },
        ],
      },
    ]);
  });

  it('drops invalid, errored, excluded and malformed results', () => {
    const rejected = [
      result({ isValid: false }),
      result({ error: 'ChecksumError' }),
      result({ text: '' }),
      result({ format: 'MicroQRCode' }),
      result({ format: 'DataBarOmni' }),
      result({ format: 'MicroPDF417' }),
      result({ format: 'AztecRune' }),
      result({ position: { ...square, topLeft: { x: Number.NaN, y: 0 } } }),
      result({ position: { ...square, bottomRight: { x: 900, y: 60 } } }),
      result({
        position: { ...square, topRight: square.bottomRight, bottomRight: square.topRight },
      }),
    ];
    expect(toBarcodeDetections(rejected, AUTO, 100, 100)).toEqual([]);
  });

  it('merges duplicates at the same place but keeps other locations', () => {
    const at = (x: number, text = 'ok') => ({
      text,
      format: 'Code128',
      points: [
        { x, y: 10 },
        { x: x + 100, y: 10 },
        { x: x + 100, y: 40 },
        { x, y: 40 },
      ],
    });
    expect(mergeDetections([at(10)], [at(13), at(300), at(10, 'other')])).toEqual(
      [at(10), at(300), at(10, 'other')],
    );
  });

  it('ranks the RGB channel with the strongest contrast first', () => {
    const pixels = new Uint8ClampedArray(64 * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) {
      pixels.set([255, 255, offset % 8 === 0 ? 0 : 255, 255], offset);
    }
    expect(analyzeChannels(pixels).order[0]).toBe(2);
  });
});

describe('barcode frame validation', () => {
  it.each([
    [0, 10, 0],
    [10.5, 10, 420],
    [10, 10, 399],
    [5000, 1, 20_000],
  ])('rejects %sx%s with %s bytes', async (width, height, length) => {
    await expect(
      decodeBarcodeFrame(width, height, new Uint8ClampedArray(length), AUTO),
    ).rejects.toThrow(RangeError);
  });
});

describe('barcode decoding with local zxing-wasm', { timeout: 30_000 }, () => {
  it('decodes a standard QR code with its symbol boundary', async () => {
    const quad = rect(76, 76, 76 + qr.width * 8, 76 + qr.height * 8);
    const detections = await decode(render(qr, quad, 320, 320));
    expect(detections).toHaveLength(1);
    expect(detections[0].text).toBe(QR_TEXT);
    expect(detections[0].format).toMatch(/^QRCode(Model2)?$/);
    expectNear(detections[0].points, quad, 12);
  });

  it('follows perspective distortion with the true quadrilateral', async () => {
    const quad: Quad = [
      { x: 70, y: 60 },
      { x: 290, y: 92 },
      { x: 272, y: 300 },
      { x: 58, y: 282 },
    ];
    const detections = await decode(render(qr, quad, 360, 360), {
      mode: 'qr',
      extended: false,
    });
    expect(detections.map(({ text }) => text)).toEqual([QR_TEXT]);
    expectNear(detections[0].points, quad, 16);
  });

  it('excludes Micro QR unless extended formats are enabled', async () => {
    const micro = await symbolModules('MQR1', 'MicroQRCode');
    const frame = render(micro, rect(80, 80, 80 + micro.width * 8, 80 + micro.height * 8), 280, 280);
    expect(await decode(frame)).toEqual([]);
    const extended = await decode(frame, { mode: 'auto', extended: true });
    expect(extended.map(({ text, format }) => [text, format])).toEqual([
      ['MQR1', 'MicroQRCode'],
    ]);
  });

  it('locates all four corners of a perspective version-1 QR without an alignment pattern', async () => {
    const small = await symbolModules('TAG1', 'QRCode');
    expect(small.width).toBe(21);
    const quad: Quad = [{ x: 70, y: 60 }, { x: 290, y: 92 }, { x: 272, y: 300 }, { x: 58, y: 282 }];
    const detections = await decode(render(small, quad, 360, 360), { mode: 'qr', extended: false });
    expect(detections.map(({ text }) => text)).toEqual(['TAG1']);
    expectNear(detections[0].points, quad, 16);
  });

  it('decodes horizontal and vertical Code 128', async () => {
    const length = code128.width * 3;
    const horizontal = rect(60, 40, 60 + length, 160);
    const across = await decode(render(code128, horizontal, length + 120, 200), {
      mode: 'barcode',
      extended: false,
    });
    expect(across.map(({ text, format }) => [text, format])).toEqual([
      [CODE128_TEXT, 'Code128'],
    ]);
    expect(Math.abs(across[0].points[0].x - 60)).toBeLessThanOrEqual(6);
    expect(Math.abs(across[0].points[1].x - (60 + length))).toBeLessThanOrEqual(6);

    const vertical: Quad = [
      { x: 160, y: 60 },
      { x: 160, y: 60 + length },
      { x: 40, y: 60 + length },
      { x: 40, y: 60 },
    ];
    const down = await decode(render(code128, vertical, 200, length + 120));
    expect(down.map(({ text }) => text)).toEqual([CODE128_TEXT]);
    const [topLeft, topRight] = down[0].points;
    // The symbol axis runs down the image, so TL->TR must be vertical.
    expect(Math.abs(topRight.y - topLeft.y)).toBeGreaterThan(length - 12);
    expect(Math.abs(topRight.x - topLeft.x)).toBeLessThan(12);
  });

  it.each([
    ['DataMatrix', 'TAG-DM-0001', 8, 8, /^DataMatrix$/],
    ['AztecCode', 'TAG-AZTEC-0001', 8, 8, /^Aztec(Code)?$/],
    // PDF417 rows are drawn taller than modules, as printed symbols are.
    ['PDF417', 'TAG-PDF417-0001', 3, 9, /^PDF417$/],
  ] as Array<[SymbolFormat, string, number, number, RegExp]>)(
    'decodes %s in auto mode only',
    async (format, text, scaleX, scaleY, expected) => {
      const modules = await symbolModules(text, format);
      const width = modules.width * scaleX;
      const height = modules.height * scaleY;
      const frame = render(
        modules,
        rect(60, 60, 60 + width, 60 + height),
        width + 120,
        height + 120,
      );
      const detections = await decode(frame);
      expect(detections.map((detection) => detection.text)).toEqual([text]);
      expect(detections[0].format).toMatch(expected);
      for (const mode of ['qr', 'barcode'] as const) {
        expect(await decode(frame, { mode, extended: false })).toEqual([]);
      }
    },
  );

  it.each([
    ['red', [255, 0, 0], WHITE],
    ['blue', [0, 0, 255], WHITE],
    ['yellow', [255, 255, 0], WHITE],
    ['inverse', WHITE, BLACK],
    ['inverse yellow on blue', [255, 255, 0], [0, 0, 160]],
  ] as Array<[string, Rgb, Rgb]>)('decodes %s Code 128', async (_, dark, light) => {
    const length = code128.width * 3;
    const frame = render(
      code128,
      rect(60, 40, 60 + length, 160),
      length + 120,
      200,
      dark,
      light,
    );
    const detections = await decode(frame, { mode: 'barcode', extended: false });
    expect(detections.map(({ text }) => text)).toEqual([CODE128_TEXT]);
  });

  it('decodes QR and Code 128 together in one frame', async () => {
    const length = code128.width * 3;
    const width = Math.max(320, length + 120);
    const frame = render(
      qr,
      rect(60, 60, 60 + qr.width * 8, 60 + qr.height * 8),
      width,
      520,
    );
    render(code128, rect(60, 340, 60 + length, 460), width, 520, BLACK, WHITE, frame);
    const detections = await decode(frame);
    expect(detections.map(({ text }) => text).sort()).toEqual(
      [QR_TEXT, CODE128_TEXT].sort(),
    );
    const formats = detections.map(({ format }) => format);
    expect(formats).toContain('Code128');
    expect(formats.some((format) => /^QRCode(Model2)?$/.test(format))).toBe(
      true,
    );
  });

  it('merges a colour-only Code 128 next to a black QR when exhaustive', async () => {
    const length = code128.width * 3;
    const width = Math.max(320, length + 120);
    const frame = render(
      qr,
      rect(60, 60, 60 + qr.width * 8, 60 + qr.height * 8),
      width,
      520,
    );
    // Green panel, then red bars of identical zxing luma (76) on top of it.
    const panel: Modules = { width: 1, height: 1, dark: () => false };
    const green: Rgb = [0, 130, 0];
    render(panel, rect(30, 310, 90 + length, 490), width, 520, green, green, frame);
    render(code128, rect(60, 340, 60 + length, 460), width, 520, [255, 0, 0], green, frame);

    const standard = await decode(frame);
    expect(standard.map(({ text }) => text)).toEqual([QR_TEXT]);
    const exhaustive = await decode(frame, {
      mode: 'auto',
      extended: false,
      exhaustive: true,
    });
    expect(exhaustive.map(({ text }) => text).sort()).toEqual(
      [QR_TEXT, CODE128_TEXT].sort(),
    );
  });

  it.each([
    ['blue', [0, 0, 255], WHITE],
    ['red', [255, 0, 0], WHITE],
    ['yellow', [255, 255, 0], WHITE],
    ['inverse', WHITE, BLACK],
    ['inverse yellow on blue', [255, 255, 0], [0, 0, 160]],
  ] as Array<[string, Rgb, Rgb]>)('decodes %s QR codes', async (_, dark, light) => {
    const quad = rect(76, 76, 76 + qr.width * 8, 76 + qr.height * 8);
    const detections = await decode(render(qr, quad, 320, 320, dark, light));
    expect(detections.map(({ text }) => text)).toEqual([QR_TEXT]);
  });

  it('recovers isoluminant QR codes through the strongest channel', async () => {
    // zxing-wasm luma is (306R + 601G + 117B + 512) >> 10: both colours are 76.
    const quad = rect(76, 76, 76 + qr.width * 8, 76 + qr.height * 8);
    const frame = render(qr, quad, 320, 320, [255, 0, 0], [0, 130, 0]);
    const lumaOnly = await readBarcodes(
      { width: 320, height: 320, data: frame.pixels } as unknown as ImageData,
      createReaderOptions(AUTO),
    );
    expect(lumaOnly).toEqual([]);
    expect((await decode(frame)).map(({ text }) => text)).toEqual([QR_TEXT]);
  });

  it('searches other channels for isoluminant Code 128 when exhaustive', async () => {
    const length = code128.width * 3;
    const frame = render(
      code128,
      rect(60, 40, 60 + length, 160),
      length + 120,
      200,
      [255, 0, 0],
      [0, 130, 0],
    );
    const detections = await decode(frame, {
      mode: 'barcode',
      extended: false,
      exhaustive: true,
    });
    expect(detections.map(({ text }) => text)).toEqual([CODE128_TEXT]);
  });

  it('keeps no state between blank, noisy and valid frames', async () => {
    const extended: BarcodeDecodeOptions = {
      mode: 'auto',
      extended: true,
      exhaustive: true,
    };
    const blank = {
      width: 320,
      height: 320,
      pixels: new Uint8ClampedArray(320 * 320 * 4).fill(255),
    };
    const quad = rect(76, 76, 76 + qr.width * 8, 76 + qr.height * 8);
    const length = code128.width * 3;
    const qrFrame = render(qr, quad, 320, 320);
    const lineFrame = render(
      code128,
      rect(60, 40, 60 + length, 160),
      length + 120,
      200,
    );

    for (let round = 0; round < 2; round += 1) {
      expect(await decode(blank, extended)).toEqual([]);
      expect(await decode(noise(320, 320, 7 + round, false), extended)).toEqual([]);
      expect(await decode(noise(320, 320, 11 + round, true), extended)).toEqual([]);
      expect((await decode(qrFrame, extended)).map(({ text }) => text)).toEqual([
        QR_TEXT,
      ]);
      expect(await decode(noise(320, 320, 13 + round, true), extended)).toEqual([]);
      expect((await decode(lineFrame, extended)).map(({ text }) => text)).toEqual([
        CODE128_TEXT,
      ]);
    }
  });
});

describe('barcode worker source', () => {
  it('loads the reader WASM from its own directory only', () => {
    const source = readFileSync(
      new URL('../app/barcode-worker.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain("'./zxing_reader.wasm'");
    expect(source).not.toMatch(/https?:\/\//);
  });
});
