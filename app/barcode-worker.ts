import { prepareZXingModule } from 'zxing-wasm/reader';
import { decodeBarcodeFrame } from './barcode-decoder';
import {
  isBarcodeDecodeOptions,
  type BarcodeWorkerRequest,
  type BarcodeWorkerResponse,
} from './barcode-types';

type WorkerScope = {
  location: { href: string };
  postMessage(message: BarcodeWorkerResponse): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
};

const scope = self as unknown as WorkerScope;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// The reader WASM is copied next to this bundle; never fall back to a CDN.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm')
        ? new URL('./zxing_reader.wasm', scope.location.href).href
        : prefix + path,
  },
  fireImmediately: true,
}).then(
  () => scope.postMessage({ type: 'ready' }),
  (error: unknown) =>
    scope.postMessage({ type: 'init-error', error: errorMessage(error) }),
);

async function handleDecode(request: Partial<BarcodeWorkerRequest>) {
  const id = request.id as number;
  try {
    if (
      !(request.pixels instanceof Uint8ClampedArray) ||
      !isBarcodeDecodeOptions(request.options)
    ) {
      throw new TypeError('Malformed barcode decode request');
    }
    const detections = await decodeBarcodeFrame(
      request.width as number,
      request.height as number,
      request.pixels,
      request.options,
    );
    scope.postMessage({ type: 'result', id, detections });
  } catch (error) {
    // A WASM abort leaves the module unusable; the client must restart.
    const fatal =
      error instanceof WebAssembly.RuntimeError ||
      /abort/i.test(errorMessage(error));
    scope.postMessage({ type: 'error', id, error: errorMessage(error), fatal });
  }
}

scope.addEventListener('message', (event) => {
  const request = event.data as Partial<BarcodeWorkerRequest> | null;
  if (request?.type === 'decode' && Number.isInteger(request.id)) {
    void handleDecode(request);
  }
});
