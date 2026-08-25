import type { OpenCvDictionaryName } from './opencv-reference';

export const ARUCO_FAMILY_DEFINITIONS = {
  ARUCO: {
    label: 'Original 5×5',
    opencvDictionary: 'DICT_ARUCO_ORIGINAL',
  },
  ARUCO_MIP_36h12: {
    label: 'MIP 36h12（進階）',
    opencvDictionary: 'DICT_ARUCO_MIP_36h12',
  },
} as const satisfies Record<
  string,
  { label: string; opencvDictionary: OpenCvDictionaryName }
>;

export type ArucoFamily = keyof typeof ARUCO_FAMILY_DEFINITIONS;

export type ArucoMarker = {
  id: number;
  corners: Array<{ x: number; y: number }>;
  distance: number;
};

export type ArucoDetector = {
  detect(
    width: number,
    height: number,
    pixels: Uint8Array | Uint8ClampedArray,
  ): ArucoMarker[];
  free(): void;
};

let modulePromise: Promise<typeof import('@ar-js-org/aruco-rs')> | null = null;

function isMarker(value: unknown): value is ArucoMarker {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ArucoMarker>;
  return (
    Number.isInteger(candidate.id) &&
    typeof candidate.distance === 'number' &&
    Array.isArray(candidate.corners) &&
    candidate.corners.length >= 4 &&
    candidate.corners.every(
      (point) =>
        point &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y),
    )
  );
}

async function loadModule() {
  if (!modulePromise) {
    modulePromise = import('@ar-js-org/aruco-rs').then(async (arucoModule) => {
      await arucoModule.default();
      return arucoModule;
    });
  }
  return modulePromise;
}

export async function createArucoDetector(
  family: ArucoFamily,
): Promise<ArucoDetector> {
  const arucoModule = await loadModule();
  const detector = new arucoModule.ARucoDetector(family);

  return {
    detect(width, height, pixels) {
      const bytes =
        pixels instanceof Uint8Array
          ? pixels
          : new Uint8Array(
              pixels.buffer,
              pixels.byteOffset,
              pixels.byteLength,
            );
      const result: unknown = detector.detect_image(width, height, bytes);
      return Array.isArray(result) ? result.filter(isMarker) : [];
    },
    free() {
      detector.free();
    },
  };
}
