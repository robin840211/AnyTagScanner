import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarcodeDetector } from '../app/barcode-engine';
import { AprilTagDetector } from '../app/apriltag-engine';

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  terminated = false;
  messages: { id: number }[] = [];
  constructor() { super(); FakeWorker.instances.push(this); }
  postMessage(message: { id: number }) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  emit(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data })); }
}
const pixels = () => new Uint8ClampedArray(4 * 4 * 4);
const options = { mode: 'auto', extended: false } as const;

beforeEach(() => { vi.useFakeTimers(); FakeWorker.instances = []; vi.stubGlobal('Worker', FakeWorker); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('barcode worker lifecycle', () => {
  it('releases pending initialization immediately when freed', async () => {
    const detector = new BarcodeDetector();
    const pending = detector.detect(4, 4, pixels(), options);
    const rejected = expect(pending).rejects.toThrow('freed');
    detector.free();
    await rejected;
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops overlapping requests without queueing or corrupting the active result', async () => {
    const detector = new BarcodeDetector(), worker = FakeWorker.instances[0];
    worker.emit({ type: 'ready' });
    const pending = detector.detect(4, 4, pixels(), options);
    await Promise.resolve();
    await expect(detector.detect(4, 4, pixels(), options)).rejects.toThrow('already in progress');
    expect(worker.messages).toHaveLength(1);
    worker.emit({ type: 'result', id: worker.messages[0].id, detections: [] });
    expect(await pending).toEqual([]);
    detector.free();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('terminates a stalled decoder and allows a new decoder to recover', async () => {
    const first = new BarcodeDetector(), stalled = FakeWorker.instances[0];
    stalled.emit({ type: 'ready' });
    const pending = first.detect(4, 4, pixels(), options);
    const rejected = expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(8001);
    await rejected;
    expect(stalled.terminated).toBe(true);
    const second = new BarcodeDetector(), recovered = FakeWorker.instances[1];
    recovered.emit({ type: 'ready' });
    const next = second.detect(4, 4, pixels(), options);
    await Promise.resolve();
    recovered.emit({ type: 'result', id: recovered.messages[0].id, detections: [{ text: 'ok', format: 'QRCode', points: [] }] });
    expect((await next)[0].text).toBe('ok');
    second.free(); expect(vi.getTimerCount()).toBe(0);
  });

  it('settles initialization failures without leaving a timeout behind', async () => {
    const detector = new BarcodeDetector();
    FakeWorker.instances[0].emit({ type: 'init-error', error: 'Missing WASM' });
    await expect(detector.ready).rejects.toThrow('Missing WASM');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles a synchronous Worker construction error', async () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('Worker unavailable'); } });
    const detector = new BarcodeDetector();
    await expect(detector.ready).rejects.toThrow('Worker unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });
});

it('releases an AprilTag worker immediately during initialization', async () => {
  const detector = new AprilTagDetector();
  const rejected = expect(detector.ready).rejects.toThrow('closed');
  detector.free();
  await rejected;
  expect(FakeWorker.instances[0].terminated).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
