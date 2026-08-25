/* global AprilTagWasm */

importScripts('apriltag_wasm.js');

let detectorPromise;

function createDetector() {
  if (!detectorPromise) {
    detectorPromise = AprilTagWasm().then((module) => {
      const init = module.cwrap('atagjs_init', 'number', []);
      const destroy = module.cwrap('atagjs_destroy', 'number', []);
      const configure = module.cwrap(
        'atagjs_set_detector_options',
        'number',
        ['number', 'number', 'number', 'number', 'number', 'number', 'number'],
      );
      const setImageBuffer = module.cwrap(
        'atagjs_set_img_buffer',
        'number',
        ['number', 'number', 'number'],
      );
      const detect = module.cwrap('atagjs_detect', 'number', []);

      init();
      configure(2, 0, 1, 1, 0, 0, 0);

      return { module, destroy, setImageBuffer, detect };
    });
  }
  return detectorPromise;
}

async function detectTags(width, height, pixelBuffer) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 4096 ||
    height > 4096
  ) {
    throw new Error('Invalid image dimensions');
  }

  const pixels = new Uint8Array(pixelBuffer);
  if (pixels.byteLength !== width * height) {
    throw new Error('Invalid grayscale image data');
  }

  const detector = await createDetector();
  const imagePointer = detector.setImageBuffer(width, height, width);
  detector.module.HEAPU8.set(pixels, imagePointer);

  const resultPointer = detector.detect();
  const resultLength = detector.module.getValue(resultPointer, 'i32');
  if (!resultLength) {
    return [];
  }

  const stringPointer = detector.module.getValue(resultPointer + 4, 'i32');
  const bytes = detector.module.HEAPU8.subarray(
    stringPointer,
    stringPointer + resultLength,
  );
  return JSON.parse(new TextDecoder().decode(bytes));
}

self.addEventListener('message', async (event) => {
  const { id, type } = event.data ?? {};
  if (!Number.isInteger(id)) {
    return;
  }

  try {
    if (type === 'init') {
      await createDetector();
      self.postMessage({ id, ok: true, result: true });
      return;
    }

    if (type === 'detect') {
      const result = await detectTags(
        event.data.width,
        event.data.height,
        event.data.pixels,
      );
      self.postMessage({ id, ok: true, result });
      return;
    }

    if (type === 'destroy') {
      if (detectorPromise) {
        const detector = await detectorPromise;
        detector.destroy();
      }
      self.postMessage({ id, ok: true, result: true });
      self.close();
      return;
    }

    throw new Error('Unknown worker request');
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'AprilTag worker error',
    });
  }
});
