import {
  isBarcodeDecodeOptions,
  validateBarcodeFrame,
  type BarcodeDecodeOptions,
  type BarcodeDetection,
  type BarcodeWorkerRequest,
  type BarcodeWorkerResponse,
} from './barcode-types';

export type {
  BarcodeDecodeOptions,
  BarcodeDetection,
  BarcodeMode,
  BarcodePoint,
} from './barcode-types';

const READY_TIMEOUT_MS = 20_000;
const DETECT_TIMEOUT_MS = 8_000;

type Deferred<T> = {
  resolve(value: T): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};

/**
 * Worker client for the local zxing-wasm reader. It runs at most one request
 * at a time and never queues frames. Any worker failure, timeout or `free()`
 * terminates the worker and rejects outstanding work; recover by creating a
 * new instance.
 */
export class BarcodeDetector {
  readonly ready: Promise<unknown>;
  private readonly worker: Worker | null;
  private readyDeferred: Deferred<unknown> | null = null;
  private pending: (Deferred<BarcodeDetection[]> & { id: number }) | null =
    null;
  private nextRequestId = 1;
  private failure: Error | null = null;

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => this.fail(new Error('Barcode worker did not start in time')),
        READY_TIMEOUT_MS,
      );
      this.readyDeferred = { resolve, reject, timeout };
    });
    // Callers may never await `ready`; failures still surface via detect().
    this.ready.catch(() => undefined);

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    let worker: Worker;
    try {
      worker = new Worker(`${basePath}/vendor/barcode/worker.js`);
    } catch (error) {
      // fail() clears the ready timer and rejects `ready`; detect() rejects.
      this.worker = null;
      this.fail(
        error instanceof Error
          ? error
          : new Error('Unable to start barcode worker'),
      );
      return;
    }
    this.worker = worker;
    worker.addEventListener('message', this.handleMessage);
    worker.addEventListener('error', this.handleWorkerError);
    worker.addEventListener('messageerror', this.handleWorkerError);
  }

  private readonly handleMessage = (
    event: MessageEvent<BarcodeWorkerResponse>,
  ) => {
    const response = event.data;
    if (response.type === 'ready') {
      if (this.readyDeferred) {
        clearTimeout(this.readyDeferred.timeout);
        this.readyDeferred.resolve(undefined);
        this.readyDeferred = null;
      }
      return;
    }
    if (response.type === 'init-error') {
      this.fail(new Error(`Barcode engine failed to load: ${response.error}`));
      return;
    }
    const pending = this.pending;
    if (!pending || pending.id !== response.id) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pending = null;
    if (response.type === 'result') {
      pending.resolve(
        Array.isArray(response.detections) ? response.detections : [],
      );
      return;
    }
    const error = new Error(response.error || 'Barcode worker error');
    pending.reject(error);
    if (response.fatal) {
      this.fail(error);
    }
  };

  private readonly handleWorkerError = () => {
    this.fail(new Error('Barcode worker failed'));
  };

  private fail(error: Error) {
    if (this.failure) {
      return;
    }
    this.failure = error;
    if (this.readyDeferred) {
      clearTimeout(this.readyDeferred.timeout);
      this.readyDeferred.reject(error);
      this.readyDeferred = null;
    }
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(error);
      this.pending = null;
    }
    this.worker?.terminate();
  }

  async detect(
    width: number,
    height: number,
    pixels: Uint8Array | Uint8ClampedArray,
    options: BarcodeDecodeOptions,
  ): Promise<BarcodeDetection[]> {
    validateBarcodeFrame(width, height, pixels);
    if (!isBarcodeDecodeOptions(options)) {
      throw new TypeError('Invalid barcode decode options');
    }
    await this.ready;
    const worker = this.worker;
    if (this.failure || !worker) {
      throw this.failure ?? new Error('Barcode worker is unavailable');
    }
    if (this.pending) {
      throw new Error('Barcode detection is already in progress');
    }

    const id = this.nextRequestId;
    this.nextRequestId += 1;
    const frame = new Uint8ClampedArray(pixels);
    const request: BarcodeWorkerRequest = {
      type: 'decode',
      id,
      width,
      height,
      pixels: frame,
      options: {
        mode: options.mode,
        extended: options.extended,
        exhaustive: options.exhaustive === true,
      },
    };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => this.fail(new Error('Barcode worker timed out')),
        DETECT_TIMEOUT_MS,
      );
      this.pending = { id, resolve, reject, timeout };
      try {
        worker.postMessage(request, [frame.buffer]);
      } catch (error) {
        this.fail(
          error instanceof Error
            ? error
            : new Error('Unable to contact barcode worker'),
        );
      }
    });
  }

  free() {
    this.fail(new Error('Barcode detector was freed'));
  }
}
