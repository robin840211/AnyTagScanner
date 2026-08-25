'use client';

import {
  BarcodeFormat,
  BrowserCodeReader,
  BrowserMultiFormatReader,
} from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import type { Result } from '@zxing/library';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createArucoDetector } from './aruco-engine';
import type {
  ArucoDetector,
  ArucoFamily,
  ArucoMarker,
} from './aruco-engine';
import { isSafeWebUrl } from './scanner-utils';

type ScannerMode = 'auto' | 'codes' | 'aruco' | 'apriltag';
type ScanSource = 'camera' | 'image';

type ScanEntry = {
  id: string;
  text: string;
  format: string;
  scannedAt: number;
  source: ScanSource;
};

type DetectionOverlay = {
  width: number;
  height: number;
  shapes: Array<{
    points: Array<{ x: number; y: number }>;
    label?: string;
  }>;
};

const arucoFamilyLabels: Record<ArucoFamily, string> = {
  ARUCO: 'Original 5×5',
  ARUCO_MIP_36h12: 'MIP 36h12',
};

const modeOptions: Array<{
  id: ScannerMode;
  label: string;
  available: boolean;
}> = [
  { id: 'auto', label: 'AUTO CODE', available: true },
  { id: 'codes', label: 'QR / BARCODE', available: true },
  { id: 'aruco', label: 'ARUCO · BETA', available: true },
  { id: 'apriltag', label: 'APRILTAG · NEXT', available: false },
];

const cameraErrorMessages: Record<string, string> = {
  NotAllowedError: '相機權限未開啟，請在瀏覽器網站設定中允許使用相機。',
  NotFoundError: '找不到可用的相機，仍可改用圖片辨識。',
  NotReadableError: '相機目前被其他程式占用，請關閉其他相機程式後重試。',
  OverconstrainedError: '相機不支援要求的設定，請切換其他鏡頭。',
};

function formatName(format: BarcodeFormat) {
  return (BarcodeFormat[format] ?? 'UNKNOWN').replaceAll('_', ' ');
}

export default function ScannerApp() {
  const [mode, setMode] = useState<ScannerMode>('auto');
  const [arucoFamily, setArucoFamily] = useState<ArucoFamily>('ARUCO');
  const [cameraState, setCameraState] = useState<
    'off' | 'starting' | 'scanning' | 'image' | 'error'
  >('off');
  const [notice, setNotice] = useState('相機只會在你按下按鈕後啟用');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [lastResult, setLastResult] = useState<ScanEntry | null>(null);
  const [overlay, setOverlay] = useState<DetectionOverlay | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const arucoTimerRef = useRef<number | null>(null);
  const cameraRunRef = useRef(0);
  const arucoDetectorsRef = useRef(
    new Map<ArucoFamily, Promise<ArucoDetector>>(),
  );
  const previewUrlRef = useRef('');

  const getReader = useCallback(() => {
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 180,
        delayBetweenScanSuccess: 900,
      });
    }
    return readerRef.current;
  }, []);

  const getArucoDetector = useCallback((family: ArucoFamily) => {
    const detectors = arucoDetectorsRef.current;
    let detector = detectors.get(family);
    if (!detector) {
      detector = createArucoDetector(family).catch((error) => {
        detectors.delete(family);
        throw error;
      });
      detectors.set(family, detector);
    }
    return detector;
  }, []);

  const stopCamera = useCallback(() => {
    cameraRunRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    rawStreamRef.current?.getTracks().forEach((track) => track.stop());
    rawStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (arucoTimerRef.current !== null) {
      window.clearTimeout(arucoTimerRef.current);
      arucoTimerRef.current = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
    setCameraState((current) => (current === 'image' ? current : 'off'));
  }, []);

  const clearPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
    setPreviewUrl('');
  }, []);

  const recordResult = useCallback(
    (result: Result, source: ScanSource, width: number, height: number) => {
      const now = Date.now();
      const text = result.getText();
      const entry: ScanEntry = {
        id: `${now}-${result.getBarcodeFormat()}-${text}`,
        text,
        format: formatName(result.getBarcodeFormat()),
        scannedAt: now,
        source,
      };

      const points = result.getResultPoints().map((point) => ({
        x: point.getX(),
        y: point.getY(),
      }));

      setOverlay(
        points.length
          ? { width, height, shapes: [{ points, label: entry.format }] }
          : null,
      );
      setLastResult(entry);
      setNotice(`已辨識 ${entry.format}`);
      setHistory((current) => {
        const previous = current[0];
        if (
          previous &&
          previous.text === entry.text &&
          previous.format === entry.format &&
          now - previous.scannedAt < 1500
        ) {
          return current;
        }
        return [entry, ...current].slice(0, 20);
      });
    },
    [],
  );

  const recordArucoMarkers = useCallback(
    (
      markers: ArucoMarker[],
      source: ScanSource,
      width: number,
      height: number,
      family: ArucoFamily,
    ) => {
      const now = Date.now();
      const format = `ARUCO ${arucoFamilyLabels[family].toUpperCase()}`;
      const entries = markers.map<ScanEntry>((marker) => ({
        id: `${now}-${family}-${marker.id}`,
        text: String(marker.id),
        format,
        scannedAt: now,
        source,
      }));

      setOverlay({
        width,
        height,
        shapes: markers.map((marker) => ({
          points: marker.corners,
          label: `ID ${marker.id}`,
        })),
      });
      setLastResult(entries[0]);
      setNotice(
        markers.length === 1
          ? `已辨識 ArUco ID ${markers[0].id}`
          : `已辨識 ${markers.length} 個 ArUco 標記`,
      );
      setHistory((current) => {
        const freshEntries = entries.filter(
          (entry) =>
            !current.some(
              (previous) =>
                previous.text === entry.text &&
                previous.format === entry.format &&
                now - previous.scannedAt < 1500,
            ),
        );
        return [...freshEntries, ...current].slice(0, 20);
      });
    },
    [],
  );

  const refreshDevices = useCallback(async () => {
    try {
      const available = await BrowserCodeReader.listVideoInputDevices();
      setDevices(available);
      if (!selectedDeviceId && available.length > 0) {
        const rearCamera =
          available.find((device) =>
            /back|rear|environment|後置|背面/i.test(device.label),
          ) ?? available[0];
        setSelectedDeviceId(rearCamera.deviceId);
      }
    } catch {
      setDevices([]);
    }
  }, [selectedDeviceId]);

  const startArucoCamera = useCallback(
    async (deviceId: string | undefined, runId: number) => {
      let pendingStream: MediaStream | null = null;

      try {
        const detector = await getArucoDetector(arucoFamily);
        if (cameraRunRef.current !== runId) {
          return;
        }

        pendingStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
        });

        if (cameraRunRef.current !== runId) {
          pendingStream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          throw new Error('Video element is unavailable');
        }

        rawStreamRef.current = pendingStream;
        video.srcObject = pendingStream;
        await video.play();
        if (cameraRunRef.current !== runId) {
          return;
        }

        const videoTrack = pendingStream.getVideoTracks()[0];
        const capabilities = videoTrack?.getCapabilities() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        setTorchSupported(Boolean(capabilities?.torch));
        setCameraState('scanning');
        setNotice(`搜尋 ${arucoFamilyLabels[arucoFamily]} 標記`);
        await refreshDevices();

        const processingCanvas = document.createElement('canvas');
        const context = processingCanvas.getContext('2d', {
          willReadFrequently: true,
        });
        if (!context) {
          throw new Error('Canvas is unavailable');
        }
        let lastDetectionAt = 0;

        const processFrame = () => {
          if (
            cameraRunRef.current !== runId ||
            !rawStreamRef.current
          ) {
            return;
          }

          if (video.videoWidth && video.videoHeight) {
            const scale = Math.min(
              1,
              720 / Math.max(video.videoWidth, video.videoHeight),
            );
            const width = Math.max(1, Math.round(video.videoWidth * scale));
            const height = Math.max(1, Math.round(video.videoHeight * scale));
            if (
              processingCanvas.width !== width ||
              processingCanvas.height !== height
            ) {
              processingCanvas.width = width;
              processingCanvas.height = height;
            }
            context.drawImage(video, 0, 0, width, height);

            try {
              const imageData = context.getImageData(0, 0, width, height);
              const markers = detector.detect(width, height, imageData.data);
              if (markers.length) {
                const inverseScale = 1 / scale;
                recordArucoMarkers(
                  markers.map((marker) => ({
                    ...marker,
                    corners: marker.corners.map((point) => ({
                      x: point.x * inverseScale,
                      y: point.y * inverseScale,
                    })),
                  })),
                  'camera',
                  video.videoWidth,
                  video.videoHeight,
                  arucoFamily,
                );
                lastDetectionAt = performance.now();
              } else if (performance.now() - lastDetectionAt > 450) {
                setOverlay(null);
              }
            } catch {
              stopCamera();
              setCameraState('error');
              setNotice('ArUco 辨識引擎發生錯誤，請重新啟用相機。');
              return;
            }
          }

          arucoTimerRef.current = window.setTimeout(processFrame, 160);
        };

        processFrame();
      } catch (error) {
        pendingStream?.getTracks().forEach((track) => track.stop());
        if (cameraRunRef.current !== runId) {
          return;
        }
        const errorName =
          error instanceof DOMException || error instanceof Error
            ? error.name
            : 'UnknownError';
        stopCamera();
        setCameraState('error');
        setNotice(
          cameraErrorMessages[errorName] ??
            '無法啟用 ArUco 辨識，請檢查相機權限後重試。',
        );
      }
    },
    [
      arucoFamily,
      getArucoDetector,
      recordArucoMarkers,
      refreshDevices,
      stopCamera,
    ],
  );

  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('error');
        setNotice('此瀏覽器或目前連線方式無法使用相機，請改用 HTTPS 或圖片辨識。');
        return;
      }

      stopCamera();
      clearPreviewUrl();
      setOverlay(null);
      setCameraState('starting');
      setNotice(
        mode === 'aruco' ? '正在載入 ArUco 引擎…' : '正在啟用相機…',
      );

      const runId = cameraRunRef.current;
      if (mode === 'aruco') {
        await startArucoCamera(deviceId, runId);
        return;
      }

      try {
        const reader = getReader();
        const video = videoRef.current;
        if (!video) {
          throw new Error('Video element is unavailable');
        }

        const onResult = (result?: Result) => {
          if (!result || !video.videoWidth || !video.videoHeight) {
            return;
          }
          recordResult(
            result,
            'camera',
            video.videoWidth,
            video.videoHeight,
          );
        };

        const controls = deviceId
          ? await reader.decodeFromVideoDevice(deviceId, video, onResult)
          : await reader.decodeFromConstraints(
              {
                audio: false,
                video: {
                  facingMode: { ideal: 'environment' },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              },
              video,
              onResult,
            );

        controlsRef.current = controls;
        setTorchSupported(Boolean(controls.switchTorch));
        setCameraState('scanning');
        setNotice('將條碼或標記對準取景框');
        await refreshDevices();
      } catch (error) {
        const errorName =
          error instanceof DOMException || error instanceof Error
            ? error.name
            : 'UnknownError';
        setCameraState('error');
        setNotice(
          cameraErrorMessages[errorName] ??
            '無法啟用相機，請檢查權限或改用圖片辨識。',
        );
      }
    },
    [
      clearPreviewUrl,
      getReader,
      mode,
      recordResult,
      refreshDevices,
      startArucoCamera,
      stopCamera,
    ],
  );

  const handleDeviceChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const deviceId = event.target.value;
      setSelectedDeviceId(deviceId);
      if (cameraState === 'scanning') {
        await startCamera(deviceId);
      }
    },
    [cameraState, startCamera],
  );

  const handleImage = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      if (!file.type.startsWith('image/')) {
        setCameraState('error');
        setNotice('請選擇圖片檔案。');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setCameraState('error');
        setNotice('圖片不可超過 20 MB。');
        return;
      }

      stopCamera();
      clearPreviewUrl();
      setOverlay(null);
      setLastResult(null);

      const objectUrl = URL.createObjectURL(file);
      previewUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
      setCameraState('image');
      setNotice('正在辨識圖片…');
      const runId = cameraRunRef.current;

      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();

        if (cameraRunRef.current !== runId) {
          return;
        }

        if (mode === 'aruco') {
          const canvas = document.createElement('canvas');
          const scale = Math.min(
            1,
            1600 / Math.max(image.naturalWidth, image.naturalHeight),
          );
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext('2d', {
            willReadFrequently: true,
          });
          if (!context) {
            throw new Error('Canvas is unavailable');
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          );
          const detector = await getArucoDetector(arucoFamily);
          if (cameraRunRef.current !== runId) {
            return;
          }
          const markers = detector.detect(
            canvas.width,
            canvas.height,
            imageData.data,
          );

          if (!markers.length) {
            setOverlay(null);
            setNotice(
              `圖片中找不到 ${arucoFamilyLabels[arucoFamily]} ArUco 標記。`,
            );
            return;
          }

          const inverseScale = 1 / scale;
          recordArucoMarkers(
            markers.map((marker) => ({
              ...marker,
              corners: marker.corners.map((point) => ({
                x: point.x * inverseScale,
                y: point.y * inverseScale,
              })),
            })),
            'image',
            image.naturalWidth,
            image.naturalHeight,
            arucoFamily,
          );
          return;
        }

        const result = await getReader().decodeFromImageElement(image);
        recordResult(
          result,
          'image',
          image.naturalWidth,
          image.naturalHeight,
        );
      } catch {
        setOverlay(null);
        setNotice(
          mode === 'aruco'
            ? '無法辨識這張圖片中的 ArUco 標記。'
            : '圖片中找不到可辨識的 QR Code 或條碼。',
        );
      }
    },
    [
      arucoFamily,
      clearPreviewUrl,
      getArucoDetector,
      getReader,
      mode,
      recordArucoMarkers,
      recordResult,
      stopCamera,
    ],
  );

  const toggleTorch = useCallback(async () => {
    const nextValue = !torchOn;
    try {
      const switchTorch = controlsRef.current?.switchTorch;
      if (switchTorch) {
        await switchTorch(nextValue);
      } else {
        const videoTrack = rawStreamRef.current?.getVideoTracks()[0];
        if (!videoTrack) {
          return;
        }
        await videoTrack.applyConstraints({
          advanced: [
            { torch: nextValue } as MediaTrackConstraintSet & {
              torch: boolean;
            },
          ],
        });
      }
      setTorchOn(nextValue);
    } catch {
      setTorchSupported(false);
      setNotice('目前鏡頭不支援網頁手電筒控制。');
    }
  }, [torchOn]);

  const copyResult = useCallback(async () => {
    if (!lastResult) {
      return;
    }
    try {
      await navigator.clipboard.writeText(lastResult.text);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
    window.setTimeout(() => setCopyState('idle'), 1600);
  }, [lastResult]);

  const openResult = useCallback(() => {
    if (!lastResult || !isSafeWebUrl(lastResult.text)) {
      return;
    }
    const opened = window.open(lastResult.text, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.opener = null;
    }
  }, [lastResult]);

  const downloadHistory = useCallback(() => {
    if (!history.length) {
      return;
    }
    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tagscanner-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [history]);

  const selectMode = useCallback(
    (nextMode: ScannerMode) => {
      if (nextMode === mode) {
        return;
      }
      stopCamera();
      clearPreviewUrl();
      setMode(nextMode);
      setCameraState('off');
      setLastResult(null);
      setOverlay(null);
      setNotice(
        nextMode === 'aruco'
          ? `支援 ${arucoFamilyLabels[arucoFamily]} ArUco 標記`
          : '相機只會在你按下按鈕後啟用',
      );
    },
    [arucoFamily, clearPreviewUrl, mode, stopCamera],
  );

  const changeArucoFamily = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const family = event.target.value as ArucoFamily;
      stopCamera();
      clearPreviewUrl();
      setArucoFamily(family);
      setCameraState('off');
      setLastResult(null);
      setOverlay(null);
      setNotice(`支援 ${arucoFamilyLabels[family]} ArUco 標記`);
    },
    [clearPreviewUrl, stopCamera],
  );

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) {
      return;
    }
    const draw = () => {
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * pixelRatio));
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!overlay) {
        return;
      }

      const scale = Math.min(
        canvas.width / overlay.width,
        canvas.height / overlay.height,
      );
      const offsetX = (canvas.width - overlay.width * scale) / 2;
      const offsetY = (canvas.height - overlay.height * scale) / 2;
      const lineWidth = Math.max(3 * pixelRatio, canvas.width / 320);

      context.strokeStyle = '#c8ff32';
      context.fillStyle = '#c8ff32';
      context.lineWidth = lineWidth;
      context.shadowColor = 'rgba(200, 255, 50, 0.75)';
      context.shadowBlur = 12 * pixelRatio;

      overlay.shapes.forEach((shape) => {
        const points = shape.points.map((point) => ({
          x: offsetX + point.x * scale,
          y: offsetY + point.y * scale,
        }));
        context.beginPath();
        points.forEach((point, index) => {
          if (index === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        });
        if (points.length > 2) {
          context.closePath();
        }
        context.stroke();
        points.forEach((point) => {
          context.beginPath();
          context.arc(point.x, point.y, lineWidth * 1.4, 0, Math.PI * 2);
          context.fill();
        });

        if (shape.label && points[0]) {
          context.shadowBlur = 0;
          context.font = `700 ${12 * pixelRatio}px ui-monospace, monospace`;
          const labelWidth = context.measureText(shape.label).width;
          const labelX = points[0].x;
          const labelY = Math.max(18 * pixelRatio, points[0].y - 8 * pixelRatio);
          context.fillStyle = 'rgba(4, 7, 8, 0.88)';
          context.fillRect(
            labelX - 4 * pixelRatio,
            labelY - 14 * pixelRatio,
            labelWidth + 8 * pixelRatio,
            18 * pixelRatio,
          );
          context.fillStyle = '#c8ff32';
          context.fillText(shape.label, labelX, labelY);
          context.shadowBlur = 12 * pixelRatio;
        }
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [overlay]);

  useEffect(() => {
    const detectors = arucoDetectorsRef.current;
    const onVisibilityChange = () => {
      if (
        document.hidden &&
        (controlsRef.current || rawStreamRef.current)
      ) {
        stopCamera();
        setNotice('頁面離開前景，相機已停止。');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cameraRunRef.current += 1;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      controlsRef.current?.stop();
      rawStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (arucoTimerRef.current !== null) {
        window.clearTimeout(arucoTimerRef.current);
      }
      detectors.forEach((detectorPromise) => {
        detectorPromise.then((detector) => detector.free()).catch(() => {});
      });
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [stopCamera]);

  const cameraStateLabel = useMemo(
    () =>
      ({
        off: 'CAMERA OFF',
        starting: 'STARTING',
        scanning: 'SCANNING',
        image: 'IMAGE MODE',
        error: 'CHECK STATUS',
      })[cameraState],
    [cameraState],
  );

  return (
    <section className="scanner-card" aria-labelledby="scanner-title">
      <div className="scanner-toolbar">
        <div>
          <p className="micro-label">LIVE SCANNER</p>
          <h2 id="scanner-title">
            {lastResult ? '辨識完成' : cameraState === 'scanning' ? '掃描中' : '準備掃描'}
          </h2>
        </div>
        <span className={`camera-state state-${cameraState}`}>
          {cameraStateLabel}
        </span>
      </div>

      <div className="mode-tabs" aria-label="辨識模式">
        {modeOptions.map((option) => (
          <button
            aria-pressed={mode === option.id}
            className={`mode-tab ${mode === option.id ? 'is-active' : ''}`}
            disabled={!option.available}
            key={option.id}
            onClick={() => selectMode(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="viewfinder">
        <video
          autoPlay
          className={cameraState === 'scanning' ? 'scanner-media' : 'scanner-media is-hidden'}
          muted
          playsInline
          ref={videoRef}
        />
        {previewUrl ? (
          // The selected image is a local object URL and never leaves the device.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="scanner-media" src={previewUrl} alt="待辨識圖片" />
        ) : null}
        <canvas className="scanner-overlay" ref={overlayRef} aria-hidden="true" />
        <span className="corner corner-tl" aria-hidden="true" />
        <span className="corner corner-tr" aria-hidden="true" />
        <span className="corner corner-bl" aria-hidden="true" />
        <span className="corner corner-br" aria-hidden="true" />

        {cameraState !== 'scanning' && !previewUrl ? (
          <>
            <div className="target-grid" aria-hidden="true">
              <span />
            </div>
            <div className="camera-prompt">
              <p>{notice}</p>
              <button
                className="primary-action"
                disabled={cameraState === 'starting'}
                onClick={() => startCamera(selectedDeviceId || undefined)}
                type="button"
              >
                {cameraState === 'starting' ? '啟用中…' : '啟用相機'}
                <span aria-hidden="true">↗</span>
              </button>
              <button
                className="text-action"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                或選擇圖片辨識
              </button>
            </div>
          </>
        ) : (
          <div className="live-status" role="status" aria-live="polite">
            {notice}
          </div>
        )}
      </div>

      <input
        accept="image/*"
        className="visually-hidden"
        onChange={handleImage}
        ref={fileInputRef}
        type="file"
      />

      <div className="scanner-controls">
        {mode === 'aruco' ? (
          <label className="camera-select aruco-family-select">
            <span>ARUCO FAMILY</span>
            <select value={arucoFamily} onChange={changeArucoFamily}>
              {Object.entries(arucoFamilyLabels).map(([family, label]) => (
                <option key={family} value={family}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {devices.length > 1 ? (
          <label className="camera-select">
            <span>CAMERA</span>
            <select value={selectedDeviceId} onChange={handleDeviceChange}>
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `鏡頭 ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {torchSupported && cameraState === 'scanning' ? (
          <button className="secondary-action" onClick={toggleTorch} type="button">
            {torchOn ? '關閉手電筒' : '開啟手電筒'}
          </button>
        ) : null}
        {cameraState === 'scanning' ? (
          <button
            className="secondary-action"
            onClick={() => {
              stopCamera();
              setNotice('掃描已停止。');
            }}
            type="button"
          >
            停止相機
          </button>
        ) : null}
        {(cameraState === 'scanning' || previewUrl) && (
          <button
            className="secondary-action"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            選擇圖片
          </button>
        )}
      </div>

      {lastResult ? (
        <section className="result-card" aria-live="polite">
          <div className="result-meta">
            <span>{lastResult.format}</span>
            <time dateTime={new Date(lastResult.scannedAt).toISOString()}>
              {new Date(lastResult.scannedAt).toLocaleTimeString('zh-TW', {
                hour12: false,
              })}
            </time>
          </div>
          <p className="result-value">{lastResult.text}</p>
          <div className="result-actions">
            <button onClick={copyResult} type="button">
              {copyState === 'done'
                ? '已複製'
                : copyState === 'error'
                  ? '無法複製'
                  : '複製內容'}
            </button>
            {isSafeWebUrl(lastResult.text) ? (
              <button onClick={openResult} type="button">
                開啟網址
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {history.length ? (
        <section className="history-panel" aria-labelledby="history-title">
          <div className="history-heading">
            <div>
              <p className="micro-label">SESSION HISTORY</p>
              <h3 id="history-title">本次掃描</h3>
            </div>
            <div className="history-actions">
              <button onClick={downloadHistory} type="button">
                匯出 JSON
              </button>
              <button
                onClick={() => {
                  setHistory([]);
                  setLastResult(null);
                  setOverlay(null);
                }}
                type="button"
              >
                清除
              </button>
            </div>
          </div>
          <ol className="history-list">
            {history.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <span>{entry.format}</span>
                <p>{entry.text}</p>
                <time>{new Date(entry.scannedAt).toLocaleTimeString('zh-TW', { hour12: false })}</time>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="scanner-footer">
        <span>MODE / {mode.toUpperCase()}</span>
        <span>LOCAL PROCESSING</span>
      </div>
    </section>
  );
}
