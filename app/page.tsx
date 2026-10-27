import ScannerApp from './scanner-app';

export default function Home() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <h1><span className="brand-mark" aria-hidden="true">⌗</span>tagscanner</h1>
        <p>QR · 條碼 · 視覺標記</p>
      </header>
      <ScannerApp />
      <footer className="privacy-statement">掃描與影像資料僅在此瀏覽器內處理，不會上傳。</footer>
    </main>
  );
}
