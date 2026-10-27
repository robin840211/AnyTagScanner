export type AprilTagMarker = {
  id: number;
  corners: Array<{ x: number; y: number }>;
  center: { x: number; y: number };
};

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};

type WorkerResponse = {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
};

function isAprilTagMarker(value: unknown): value is AprilTagMarker {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const marker = value as Partial<AprilTagMarker>;
  return (
    Number.isInteger(marker.id) &&
    Array.isArray(marker.corners) &&
    marker.corners.length === 4 &&
    marker.corners.every(
      (point) =>
        point && Number.isFinite(point.x) && Number.isFinite(point.y),
    ) &&
    Boolean(
      marker.center &&
        Number.isFinite(marker.center.x) &&
        Number.isFinite(marker.center.y),
    )
  );
}

export function rgbaToGrayscale(
  pixels: Uint8Array | Uint8ClampedArray,
): Uint8Array {
  if (pixels.byteLength % 4 !== 0) {
    throw new Error('RGBA image data must contain four channels per pixel');
  }
  const grayscale = new Uint8Array(pixels.byteLength / 4);
  for (let source = 0, target = 0; source < pixels.length; source += 4) {
    grayscale[target] = Math.round(
      pixels[source] * 0.299 +
        pixels[source + 1] * 0.587 +
        pixels[source + 2] * 0.114,
    );
    target += 1;
  }
  return grayscale;
}

export class AprilTagDetector {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private nextRequestId = 1;
  private closed = false;
  readonly ready: Promise<unknown>;

  constructor() {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    this.worker = new Worker(`${basePath}/vendor/apriltag/worker.js`);
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleWorkerError);
    this.worker.addEventListener('messageerror', this.handleWorkerError);
    this.ready = this.request('init');
  }

  private readonly handleMessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pending.delete(response.id);
    if (response.ok) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error ?? 'AprilTag worker error'));
    }
  };

  private readonly handleWorkerError = () => {
    this.closed = true;
    this.rejectPending(new Error('AprilTag worker failed'));
    this.worker.terminate();
  };

  private rejectPending(error: Error) {
    this.pending.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pending.clear();
  }

  private request(
    type: 'init' | 'detect' | 'destroy',
    payload: Record<string, unknown> = {},
    transfer: Transferable[] = [],
  ): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new Error('AprilTag detector is closed'));
    }

    const id = this.nextRequestId;
    this.nextRequestId += 1;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('AprilTag worker timed out'));
      }, 15_000);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.worker.postMessage({ id, type, ...payload }, transfer);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(
          error instanceof Error
            ? error
            : new Error('Unable to contact AprilTag worker'),
        );
      }
    });
  }

  async detect(
    width: number,
    height: number,
    pixels: Uint8Array | Uint8ClampedArray,
  ): Promise<AprilTagMarker[]> {
    await this.ready;
    const grayscale = rgbaToGrayscale(pixels);
    const result = await this.request(
      'detect',
      { width, height, pixels: grayscale.buffer },
      [grayscale.buffer],
    );
    return Array.isArray(result) ? result.filter(isAprilTagMarker) : [];
  }

  free() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.rejectPending(new Error('AprilTag detector is closed'));
    this.worker.terminate();
  }
}
