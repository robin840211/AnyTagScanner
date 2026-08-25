const supportedGroups = [
  { label: '2D', value: 'QR · Data Matrix · PDF417 · Aztec' },
  { label: '1D', value: 'EAN · UPC · Code 39/93/128 · ITF' },
  { label: 'FID', value: 'ArUco · AprilTag（引擎整合中）' },
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
          ON-DEVICE / NO UPLOAD
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div>
            <p className="eyebrow">UNIVERSAL VISUAL CODE READER</p>
            <h1>
              ONE VIEW.
              <br />
              <span>EVERY MARK.</span>
            </h1>
          </div>
          <p className="intro">
            現在可讀取 QR Code 與常見條碼，ArUco、AprilTag
            引擎正在整合。影像留在目前裝置，手機與電腦皆可直接使用。
          </p>
        </div>

        <div className="scanner-layout">
          <ScannerApp />

          <aside className="format-panel" aria-label="支援格式">
            <p className="micro-label">SUPPORTED / 01</p>
            <h2>一個入口，涵蓋多種標記。</h2>
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
                <strong>LOCAL FIRST</strong>
                <p>辨識在瀏覽器內完成，不自動傳送影像或掃描內容。</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
import ScannerApp from './scanner-app';
