const supportedGroups = [
  { label: '2D', value: 'QR Code · Data Matrix · PDF417' },
  { label: '1D', value: 'EAN-8/13 · UPC-A/E · Code 128' },
  {
    label: 'TAG',
    value: 'OpenCV ArUco Original · AprilTag 36h11',
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="TagScanner 首頁">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>TAGSCANNER</span>
        </a>
        <div className="privacy-note">
          <span className="status-dot" aria-hidden="true" />
          本機處理／不自動上傳
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div>
            <p className="eyebrow">BROWSER TAG SCANNER</p>
            <h1>
              QR、條碼與
              <br />
              <span>視覺標記辨識</span>
            </h1>
          </div>
          <p className="intro">
            使用相機或圖片辨識 QR Code、常見一維條碼、OpenCV ArUco
            Original 與 AprilTag 36h11。影像只在目前裝置處理。
          </p>
        </div>

        <div className="scanner-layout">
          <ScannerApp />

          <aside className="format-panel" aria-label="支援格式">
            <p className="micro-label">常用格式</p>
            <h2>目前支援的辨識格式</h2>
            <div className="format-list">
              {supportedGroups.map((group) => (
                <div className="format-row" key={group.label}>
                  <span>{group.label}</span>
                  <p>{group.value}</p>
                </div>
              ))}
            </div>
            <div className="local-card">
              <span className="local-icon" aria-hidden="true">◎</span>
              <div>
                <strong>本機處理</strong>
                <p>相機與圖片辨識在瀏覽器內完成，不自動傳送內容。</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
import ScannerApp from './scanner-app';
