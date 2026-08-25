import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { rgbaToGrayscale } from '../app/apriltag-engine';

describe('AprilTag image conversion', () => {
  it('converts RGBA pixels using luminance weights', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
      255, 0, 0, 255,
    ]);
    expect(rgbaToGrayscale(pixels)).toEqual(
      new Uint8Array([0, 255, 76]),
    );
  });

  it('rejects incomplete pixels', () => {
    expect(() => rgbaToGrayscale(new Uint8Array([0, 0, 0]))).toThrow(
      'four channels',
    );
  });
});

describe('AprilTag vendored runtime', () => {
  it.each([
    [
      'apriltag_wasm.js',
      'DFD03EA330012975FF3185872053229F5C638FD4EBD228FD80C0C7218A15B201',
    ],
    [
      'apriltag_wasm.wasm',
      '0283215C40F3BCD265D2650AEB0D4419E87222830FE8A31A1978401A4CAC77AA',
    ],
  ])('matches the pinned checksum for %s', (fileName, expected) => {
    const file = readFileSync(
      new URL(`../public/vendor/apriltag/${fileName}`, import.meta.url),
    );
    expect(createHash('sha256').update(file).digest('hex').toUpperCase()).toBe(
      expected,
    );
  });

  it('loads the worker without a third-party runtime URL', () => {
    const worker = readFileSync(
      new URL('../public/vendor/apriltag/worker.js', import.meta.url),
      'utf8',
    );
    expect(worker).not.toMatch(/https?:\/\//);
    expect(worker).toContain("importScripts('apriltag_wasm.js')");
  });

  it('decodes a generated tag36h11 ID 0 marker', async () => {
    type DetectorModule = {
      cwrap(
        name: string,
        returnType: string | null,
        argumentTypes: string[],
      ): (...arguments_: number[]) => number;
      getValue(pointer: number, type: string): number;
      HEAPU8: Uint8Array;
    };
    type DetectorFactory = (options: {
      wasmBinary: Uint8Array;
    }) => Promise<DetectorModule>;

    const scriptUrl = new URL(
      '../public/vendor/apriltag/apriltag_wasm.js',
      import.meta.url,
    );
    const wasmUrl = new URL(
      '../public/vendor/apriltag/apriltag_wasm.wasm',
      import.meta.url,
    );
    const scriptPath = fileURLToPath(scriptUrl);
    const moduleObject: { exports: unknown } = { exports: {} };
    const processStub = {
      argv: ['node', scriptPath],
      versions: process.versions,
      on() {},
      exit(code: number) {
        throw new Error(`AprilTag runtime exited with ${code}`);
      },
    };
    const context = {
      console,
      process: processStub,
      require: createRequire(pathToFileURL(scriptPath)),
      __dirname: dirname(scriptPath),
      __filename: scriptPath,
      WebAssembly,
      TextDecoder,
      Uint8Array,
      Int8Array,
      Int16Array,
      Int32Array,
      Uint16Array,
      Uint32Array,
      Float32Array,
      Float64Array,
      ArrayBuffer,
      Promise,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      module: moduleObject,
      exports: moduleObject.exports,
    };
    vm.runInNewContext(readFileSync(scriptUrl, 'utf8'), context, {
      filename: scriptPath,
    });

    const factory = moduleObject.exports as DetectorFactory;
    const detector = await factory({
      wasmBinary: Uint8Array.from(readFileSync(wasmUrl)),
    });
    const call = detector.cwrap.bind(detector);
    call('atagjs_init', 'number', [])();
    call(
      'atagjs_set_detector_options',
      'number',
      ['number', 'number', 'number', 'number', 'number', 'number', 'number'],
    )(2, 0, 1, 1, 0, 0, 0);

    const rows = [
      '0000000000',
      '0111111110',
      '0100101010',
      '0110001010',
      '0110011110',
      '0101011110',
      '0110100110',
      '0111101110',
      '0111111110',
      '0000000000',
    ];
    const width = 400;
    const height = 400;
    const cellSize = 40;
    const grayscale = new Uint8Array(width * height).fill(255);
    rows.forEach((row, cellY) => {
      [...row].forEach((bit, cellX) => {
        if (bit !== '1') {
          return;
        }
        for (let pixelY = 0; pixelY < cellSize; pixelY += 1) {
          const start =
            (cellY * cellSize + pixelY) * width + cellX * cellSize;
          grayscale.fill(0, start, start + cellSize);
        }
      });
    });

    const imagePointer = call(
      'atagjs_set_img_buffer',
      'number',
      ['number', 'number', 'number'],
    )(width, height, width);
    detector.HEAPU8.set(grayscale, imagePointer);
    const resultPointer = call('atagjs_detect', 'number', [])();
    const resultLength = detector.getValue(resultPointer, 'i32');
    const stringPointer = detector.getValue(resultPointer + 4, 'i32');
    const detections = JSON.parse(
      new TextDecoder().decode(
        detector.HEAPU8.subarray(
          stringPointer,
          stringPointer + resultLength,
        ),
      ),
    ) as Array<{ id: number; corners: unknown[] }>;
    call('atagjs_destroy', 'number', [])();

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({ id: 0 });
    expect(detections[0].corners).toHaveLength(4);
  });
});
