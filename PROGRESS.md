# Progress

詳細開發紀錄保留在 git 歷史；此檔只記錄目前狀態與待辦。

## Current objective

可直接發布到 GitHub Pages 的跨裝置 TagScanner：QR、一般條碼、ArUco 與 tag36h11 AprilTag，全部在瀏覽器本機辨識。

## Status

- 網站：https://robin840211.github.io/tagscanner/ ；單一 repo `robin840211/tagscanner`，推送 `main` 會由 Deploy GitHub Pages workflow 驗證（lint、typecheck、test、build）並發布。
- 舊發布 repo 已改名 `tagscanner-publisher-old` 並封存，舊網址 `/AnyTagScanner/` 已失效。
- 驗證：lint、typecheck、64 項測試通過，`npm audit` 無已知漏洞。
- 解碼：zxing-wasm（Web Worker）處理 QR／條碼，aruco-rs（WASM）處理 ArUco，AprilTag 使用固定上游 commit 的 WASM；皆為本機資產，無執行階段 CDN。
- 即時掃描：共用相機串流切換模式不重開鏡頭、350ms 疊圖過期、持續出現的同一標記只保留一筆歷史、停止／背景／卸載時釋放相機。
- PWA：manifest、正式圖示（any／maskable）、apple-touch-icon、favicon、社群預覽圖（`og.png`）與離線 Service Worker。
- 依賴策略：Dependabot 每週檢查；刻意保留 eslint 9、TypeScript 6.0、@types/node 24，升級前需確認相容性。
- GitHub 設定：Dependabot 安全更新、secret scanning 與 push protection、Private vulnerability reporting 已啟用。

## Next

- 評估 `DICT_4X4_50`、`DICT_5X5_100`、`DICT_6X6_250` 等常用 OpenCV ArUco 字典；未通過實測前不列為支援。
- 建立真實手機（Android／iPhone）、列印標記、透視與低光測試集；實機相機權限、背景返回與 FPS 尚待驗證。
- 在 GitHub Settings → General 手動上傳社群預覽圖（可使用 `public/og.png`，API 無法設定）。
- Service Worker 對 `public/vendor/*` 等非雜湊資產採 cache-first，更新後需遞增 `CACHE_NAME`；可改為 stale-while-revalidate。

## Acceptance direction

- GitHub Pages 專案子路徑下所有靜態資產正確載入。
- 相機在停止、離開前景與元件卸載時釋放。
- 不自動上傳或持久保存影像與掃描內容。
- 清晰 QR 與常見條碼可在手機及桌面瀏覽器完成辨識。
- 合成 ArUco 與 tag36h11 AprilTag 可由 WASM 引擎解碼，且不連線第三方 CDN。
