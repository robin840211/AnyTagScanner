'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { BarcodeDetector } from './barcode-engine';
import { AprilTagDetector } from './apriltag-engine';
import { ARUCO_FAMILY_DEFINITIONS, createArucoDetector } from './aruco-engine';
import type { ArucoDetector, ArucoFamily } from './aruco-engine';
import { createOpenCvDetectionSnippet } from './opencv-reference';
import type { OpenCvDictionaryName } from './opencv-reference';
import { isSafeWebUrl, paginateScanText } from './scanner-utils';
import { ScanTracker } from './scan-tracker';

type Mode = 'auto' | 'qr' | 'barcode' | 'aruco' | 'apriltag';
type CameraState = 'off' | 'starting' | 'scanning' | 'image' | 'error';
type Config = { mode: Mode; family: ArucoFamily; extended: boolean };
type Detection = { text: string; format: string; points: { x: number; y: number }[]; opencvDictionary?: OpenCvDictionaryName };
type Entry = Detection & { id: string; scannedAt: number; source: 'camera' | 'image' };
type Overlay = { width: number; height: number; shapes: Detection[] };
const modes: { id: Mode; label: string }[] = [
  { id: 'auto', label: 'QR＋條碼' }, { id: 'qr', label: 'QR' }, { id: 'barcode', label: '條碼' },
  { id: 'aruco', label: 'ArUco' }, { id: 'apriltag', label: 'AprilTag' },
];
const cameraErrors: Record<string, string> = {
  NotAllowedError: '請在瀏覽器網站設定中允許使用相機。',
  NotFoundError: '找不到相機，請選擇圖片辨識。',
  NotReadableError: '相機正被占用，請關閉其他相機程式後重試。',
  OverconstrainedError: '請切換其他鏡頭後重試。',
};

export default function ScannerApp() {
  const [config, setConfig] = useState<Config>({ mode: 'auto', family: 'ARUCO', extended: false });
  const configRef = useRef(config);
  const [cameraState, setCameraState] = useState<CameraState>('off');
  const [notice, setNotice] = useState('將條碼或標記放入畫面');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [preview, setPreview] = useState('');
  const [history, setHistory] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [copyLabel, setCopyLabel] = useState('複製內容');
  const [tab, setTab] = useState<'result' | 'history' | 'formats'>('result');
  const [historyPage, setHistoryPage] = useState(0);
  const [textPage, setTextPage] = useState(0);
  const [metrics, setMetrics] = useState({ video: 0, decode: 0 });
  const [compact, setCompact] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const streamEpoch = useRef(0);
  const generation = useRef(0);
  const alive = useRef(true);
  const busy = useRef(false);
  const previewRef = useRef('');
  const imageRef = useRef<HTMLImageElement | null>(null);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tracker = useRef(new ScanTracker());
  const barcode = useRef<BarcodeDetector | null>(null);
  const april = useRef<AprilTagDetector | null>(null);
  const aruco = useRef(new Map<ArucoFamily, Promise<ArucoDetector>>());

  const clearOverlay = useCallback(() => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = null;
    setOverlay(null);
  }, []);
  const clearPreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = ''; imageRef.current = null; setPreview('');
  }, []);
  const stopCamera = useCallback(() => {
    streamEpoch.current++; generation.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    clearOverlay(); tracker.current.reset();
    setTorch(false); setTorchAvailable(false); setCameraState('off');
    setMetrics({ video: 0, decode: 0 });
  }, [clearOverlay]);

  const decode = useCallback(async (frame: ImageData, options: Config, exhaustive: boolean): Promise<Detection[]> => {
    const { width, height, data } = frame;
    if (options.mode === 'aruco') {
      let pending = aruco.current.get(options.family);
      if (!pending) { pending = createArucoDetector(options.family); aruco.current.set(options.family, pending); }
      try {
        const detector = await pending;
        return detector.detect(width, height, data).map(marker => ({
          text: String(marker.id), format: 'ArUco ' + ARUCO_FAMILY_DEFINITIONS[options.family].label,
          points: marker.corners, opencvDictionary: ARUCO_FAMILY_DEFINITIONS[options.family].opencvDictionary,
        }));
      } catch (error) { aruco.current.delete(options.family); throw error; }
    }
    if (options.mode === 'apriltag') {
      const detector = april.current ?? (april.current = new AprilTagDetector());
      try {
        return (await detector.detect(width, height, data)).map(marker => ({
          text: String(marker.id), format: 'AprilTag 36h11', points: marker.corners, opencvDictionary: 'DICT_APRILTAG_36h11',
        }));
      } catch (error) {
        if (april.current === detector) april.current = null;
        detector.free(); throw error;
      }
    }
    const detector = barcode.current ?? (barcode.current = new BarcodeDetector());
    try {
      return await detector.detect(width, height, data, { mode: options.mode, extended: options.extended, exhaustive });
    } catch (error) {
      if (barcode.current === detector) barcode.current = null;
      detector.free(); throw error;
    }
  }, []);

  const accept = useCallback((detections: Detection[], width: number, height: number, source: 'camera' | 'image') => {
    const now = Date.now();
    const { visible, fresh } = tracker.current.observe(detections, now, source === 'image');
    if (visible.length) {
      setOverlay({ width, height, shapes: visible });
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      if (source === 'camera') overlayTimer.current = setTimeout(() => setOverlay(null), 350);
      setNotice('已辨識 ' + visible.length + ' 個標記');
    } else if (source === 'image') {
      clearOverlay(); setNotice('未找到標記，請嘗試其他模式或更清晰的圖片。');
    } else setNotice('掃描中');
    if (fresh.length) {
      const entries = fresh.map((item, index) => ({ ...item, id: now + '-' + index, scannedAt: now, source }));
      setHistory(current => [...entries, ...current].slice(0, 100));
      setSelected(entries[0]); setTextPage(0); setCopyLabel('複製內容');
    }
  }, [clearOverlay]);

  const scanImage = useCallback(async (image: HTMLImageElement, token: number) => {
    while (busy.current && alive.current && token === generation.current) {
      await new Promise(resolve => setTimeout(resolve, 16));
    }
    if (!alive.current || token !== generation.current) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    busy.current = true;
    try {
      const results = await decode(context.getImageData(0, 0, canvas.width, canvas.height), { ...configRef.current }, true);
      if (alive.current && token === generation.current) accept(results, canvas.width, canvas.height, 'image');
    } catch {
      if (alive.current && token === generation.current) setNotice('辨識暫時失敗，請重新選擇圖片。');
    } finally {
      busy.current = false;
    }
  }, [accept, decode]);

  const changeConfig = (patch: Partial<Config>) => {
    configRef.current = { ...configRef.current, ...patch }; setConfig(configRef.current);
    const token = ++generation.current;
    clearOverlay(); setNotice('辨識模式已切換');
    if (imageRef.current) void scanImage(imageRef.current, token);
  };

  const startCamera = useCallback(async (requestedDevice = '') => {
    stopCamera(); clearPreview();
    const token = streamEpoch.current;
    setCameraState('starting'); setNotice('正在啟用相機…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS');
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false, video: {
          ...(requestedDevice ? { deviceId: { exact: requestedDevice } } : { facingMode: { ideal: 'environment' } }),
          width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 },
        },
      });
      if (!alive.current || token !== streamEpoch.current) { next.getTracks().forEach(track => track.stop()); return; }
      stream.current = next;
      const video = videoRef.current;
      if (!video) { next.getTracks().forEach(track => track.stop()); return; }
      video.srcObject = next; await video.play();
      if (!alive.current || token !== streamEpoch.current) return;
      const track = next.getVideoTracks()[0];
      track.onended = () => { if (stream.current === next) { stopCamera(); setNotice('相機已中斷，請重新啟用。'); } };
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setTorchAvailable(Boolean(capabilities?.torch)); setDeviceId(track.getSettings().deviceId ?? requestedDevice);
      setCameraState('scanning'); setNotice('掃描中');
      try {
        const available = await navigator.mediaDevices.enumerateDevices();
        if (alive.current && token === streamEpoch.current) setDevices(available.filter(device => device.kind === 'videoinput'));
      } catch { /* Device labels are optional. */ }
    } catch (error) {
      if (!alive.current || token !== streamEpoch.current) return;
      stopCamera(); setCameraState('error');
      setNotice(error instanceof DOMException ? cameraErrors[error.name] ?? '相機啟用失敗，請重試。' : '請使用 HTTPS 或 localhost 開啟相機。');
    }
  }, [clearPreview, stopCamera]);

  useEffect(() => {
    if (cameraState !== 'scanning') return;
    const video = videoRef.current; if (!video) return;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return;
    let cancelled = false, callback = 0, lastTime = -1, lastAttempt = 0, retryAfter = 0;
    let attempts = 0, frames = 0, decoded = 0, measuredAt = performance.now();
    const nativeFrames = typeof video.requestVideoFrameCallback === 'function';
    const schedule = () => { callback = nativeFrames ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick); };
    const tick = (now: number) => {
      if (cancelled) return;
      schedule();
      if (video.currentTime === lastTime || video.readyState < 2) return;
      lastTime = video.currentTime; frames++;
      if (now - measuredAt >= 1000) {
        const seconds = (now - measuredAt) / 1000;
        setMetrics({ video: Math.round(frames / seconds), decode: Math.round(decoded / seconds) });
        measuredAt = now; frames = 0; decoded = 0;
      }
      if (busy.current || now < retryAfter || now - lastAttempt < 40) return;
      lastAttempt = now;
      const options = { ...configRef.current }, token = generation.current;
      const exhaustive = ++attempts % 8 === 0;
      const edge = options.mode === 'aruco' || options.mode === 'apriltag' ? 960 : exhaustive ? 1920 : 1280;
      const scale = Math.min(1, edge / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      busy.current = true;
      void decode(frame, options, exhaustive).then(results => {
        if (!cancelled && token === generation.current) { decoded++; accept(results, frame.width, frame.height, 'camera'); }
      }).catch(() => {
        if (!cancelled && token === generation.current) {
          clearOverlay(); retryAfter = performance.now() + 1000; setNotice('辨識器重新載入中…');
        }
      }).finally(() => { busy.current = false; });
    };
    schedule();
    return () => { cancelled = true; if (nativeFrames) video.cancelVideoFrameCallback(callback); else cancelAnimationFrame(callback); };
  }, [accept, cameraState, clearOverlay, decode]);

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    stopCamera(); clearPreview();
    const url = URL.createObjectURL(file); previewRef.current = url;
    setPreview(url); setCameraState('image'); setNotice('圖片辨識中…');
    const image = new Image(); image.src = url;
    try {
      await image.decode();
      if (!alive.current || previewRef.current !== url) return;
      imageRef.current = image;
      await scanImage(image, generation.current);
    } catch {
      if (alive.current && previewRef.current === url) setNotice('圖片無法讀取，請選擇其他圖片。');
    }
  };
  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0]; if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      if (track === stream.current?.getVideoTracks()[0]) setTorch(!torch);
    } catch { setTorchAvailable(false); setNotice('此鏡頭無法控制手電筒。'); }
  };

  useEffect(() => {
    const canvas = overlayRef.current; if (!canvas) return;
    const draw = () => {
      const context = canvas.getContext('2d'); if (!context) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio)); canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      context.clearRect(0, 0, canvas.width, canvas.height); if (!overlay) return;
      const scale = Math.min(canvas.width / overlay.width, canvas.height / overlay.height);
      const ox = (canvas.width - overlay.width * scale) / 2, oy = (canvas.height - overlay.height * scale) / 2;
      context.strokeStyle = '#c8ff32'; context.lineWidth = 2 * ratio;
      for (const shape of overlay.shapes) {
        context.beginPath();
        shape.points.forEach((point, index) => {
          if (index === 0) context.moveTo(ox + point.x * scale, oy + point.y * scale);
          else context.lineTo(ox + point.x * scale, oy + point.y * scale);
        });
        if (shape.points.length > 2) context.closePath();
        context.stroke();
      }
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(canvas);
    return () => observer.disconnect();
  }, [overlay]);

  useEffect(() => {
    alive.current = true;
    const streamToken = streamEpoch;
    const decodeToken = generation;
    const detectors = aruco.current;
    const onHidden = () => {
      if (document.hidden && !previewRef.current) {
        stopCamera(); setNotice('頁面離開前景，相機已停止。');
      }
    };
    const query = window.matchMedia('(max-width: 700px), (max-height: 650px)');
    const resize = () => setCompact(query.matches);
    resize(); query.addEventListener('change', resize); document.addEventListener('visibilitychange', onHidden);
    return () => {
      alive.current = false; streamToken.current++; decodeToken.current++;
      document.removeEventListener('visibilitychange', onHidden); query.removeEventListener('change', resize);
      stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      barcode.current?.free(); barcode.current = null; april.current?.free(); april.current = null;
      detectors.forEach(pending => { void pending.then(detector => detector.free()).catch(() => {}); }); detectors.clear();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, [stopCamera]);

  const copy = async (python = false) => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(python && selected.opencvDictionary ? createOpenCvDetectionSnippet(selected.opencvDictionary) : selected.text);
      setCopyLabel(python ? '已複製 Python 範例' : '已複製');
    } catch { setCopyLabel('複製失敗，請重試'); }
  };
  const exportHistory = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = 'tagscanner-' + new Date().toISOString().slice(0, 10) + '.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const pageSize = compact ? 1 : 4, pageCount = Math.max(1, Math.ceil(history.length / pageSize));
  const activePage = Math.min(historyPage, pageCount - 1);
  const textChunks = paginateScanText(selected?.text ?? '', compact), textPages = textChunks.length;
  const activeTextPage = Math.min(textPage, textPages - 1), live = cameraState === 'scanning';

  return (
    <div className="scanner-workspace">
      <section className="camera-panel" aria-label="掃描器">
        <div className="mode-tabs" aria-label="辨識模式">
          {modes.map(option => <button type="button" key={option.id} aria-pressed={config.mode === option.id} onClick={() => changeConfig({ mode: option.id })}>{option.label}</button>)}
        </div>
        <div className="scan-options">
          {config.mode === 'aruco' ? <label>字典 <select aria-label="ArUco 字典" value={config.family} onChange={event => changeConfig({ family: event.target.value as ArucoFamily })}>
            {Object.entries(ARUCO_FAMILY_DEFINITIONS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select></label> : config.mode === 'apriltag' ? <span>AprilTag 36h11</span> : <label className="check-option"><input type="checkbox" checked={config.extended} onChange={event => changeConfig({ extended: event.target.checked })} />擴充格式（Micro QR／DataBar）</label>}
          <span className="fps" title="每秒實際收到的影格／完成的辨識次數">{live ? metrics.video + ' 畫面 · ' + metrics.decode + ' 辨識 /s' : cameraState === 'image' ? '圖片模式' : '相機待命'}</span>
        </div>
        <div className="viewfinder">
          <video autoPlay muted playsInline ref={videoRef} className={'scanner-media ' + (live ? '' : 'is-hidden')} />
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="待辨識圖片" className="scanner-media" />
          )}
          <canvas ref={overlayRef} className="scanner-overlay" aria-hidden="true" data-shapes={overlay?.shapes.length ?? 0} />
          {!live && !preview && <div className="camera-prompt"><span className="target-icon" aria-hidden="true">⌗</span><p>相機或圖片，立即辨識</p><button className="primary-action" type="button" disabled={cameraState === 'starting'} onClick={() => void startCamera(deviceId)}>{cameraState === 'starting' ? '啟用中…' : '啟用相機'}</button></div>}
        </div>
        <div className="scanner-controls">
          {devices.length > 1 && <select aria-label="相機" value={deviceId} onChange={event => { setDeviceId(event.target.value); if (live) void startCamera(event.target.value); }}>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || '鏡頭 ' + (index + 1)}</option>)}</select>}
          {(live || cameraState === 'starting') ? <button type="button" onClick={() => { stopCamera(); setNotice('相機已停止'); }}>停止相機</button> : preview ? <button type="button" onClick={() => void startCamera(deviceId)}>啟用相機</button> : null}
          <button type="button" onClick={() => fileRef.current?.click()}>選擇圖片</button>
          {torchAvailable && live && <button type="button" onClick={() => void toggleTorch()}>{torch ? '關閉手電筒' : '開啟手電筒'}</button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImage} />
        </div>
        <p className="scan-status" role="status">{notice}</p>
      </section>
      <aside className="details-panel" aria-label="辨識資訊">
        <div className="detail-tabs" aria-label="資訊頁籤">
          <button type="button" aria-pressed={tab === 'result'} onClick={() => setTab('result')}>結果</button>
          <button type="button" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>紀錄 {history.length}</button>
          <button type="button" aria-pressed={tab === 'formats'} onClick={() => setTab('formats')}>格式</button>
        </div>
        {tab === 'result' && <div className="result-content">
          {selected ? <>
            <div className="result-meta"><strong>{selected.format}</strong><time>{new Date(selected.scannedAt).toLocaleTimeString('zh-TW', { hour12: false })}</time></div>
            <p className="result-value">{textChunks[activeTextPage]}</p>
            {textPages > 1 && <div className="pagination"><button disabled={activeTextPage === 0} onClick={() => setTextPage(activeTextPage - 1)}>上一段</button><span>{activeTextPage + 1} / {textPages}</span><button disabled={activeTextPage + 1 >= textPages} onClick={() => setTextPage(activeTextPage + 1)}>下一段</button></div>}
            <div className="result-actions"><button type="button" onClick={() => void copy()}>{copyLabel}</button>{isSafeWebUrl(selected.text) && <button type="button" onClick={() => window.open(selected.text, '_blank', 'noopener,noreferrer')}>開啟網址</button>}{selected.opencvDictionary && <button type="button" onClick={() => void copy(true)}>複製 Python 範例</button>}</div>
          </> : <div className="empty-result"><span aria-hidden="true">↗</span><h2>等待辨識</h2><p>辨識內容會顯示於此</p></div>}
        </div>}
        {tab === 'history' && <div className="history-content">
          <div className="history-actions"><button type="button" disabled={!history.length} onClick={exportHistory}>匯出 JSON</button><button type="button" disabled={!history.length} onClick={() => { setHistory([]); setSelected(null); setHistoryPage(0); tracker.current.reset(); }}>清除</button></div>
          <ol className="history-list">{history.slice(activePage * pageSize, (activePage + 1) * pageSize).map(entry => <li key={entry.id}><button type="button" onClick={() => { setSelected(entry); setTextPage(0); setTab('result'); }}><strong>{entry.format}</strong><span>{Array.from(entry.text).slice(0, compact ? 24 : 48).join('')}{entry.text.length > (compact ? 24 : 48) ? '…' : ''}</span></button></li>)}</ol>
          {!history.length && <p className="muted">尚無掃描紀錄</p>}
          {pageCount > 1 && <div className="pagination"><button disabled={activePage === 0} onClick={() => setHistoryPage(activePage - 1)}>上一頁</button><span>{activePage + 1} / {pageCount}</span><button disabled={activePage + 1 >= pageCount} onClick={() => setHistoryPage(activePage + 1)}>下一頁</button></div>}
        </div>}
        {tab === 'formats' && <div className="formats-content"><p><strong>2D</strong>QR · Data Matrix · Aztec · PDF417</p><p><strong>1D</strong>EAN · UPC · Code 39 / 93 / 128 · ITF · Codabar</p><p><strong>TAG</strong>ArUco Original / MIP 36h12 · AprilTag 36h11</p><p className="muted">Micro QR 與 DataBar 可從「擴充格式」開啟。</p></div>}
      </aside>
    </div>
  );
}
