# Progress

## Current objective

建立可直接發布到 GitHub Pages 的跨裝置 TagScanner，先交付 QR 與一般條碼掃描，再擴充 ArUco 與 AprilTag。

## Completed

- 初始化 Git repository 與 Next.js 靜態輸出。
- 建立 GitHub Pages base path 與部署 workflow。
- 建立手機與桌面響應式掃描介面。
- 完成相機啟停、多鏡頭選擇、支援時的手電筒控制。
- 完成圖片辨識、ZXing 多格式解碼、結果疊圖、安全網址處理。
- 完成工作階段歷史、JSON 匯出、隱私與第三方授權文件。
- 建立 lint、type check、unit test 與 production build 驗證。

## Next

- 建立 ArUco WebAssembly 技術驗證與字典選擇。
- 建立 AprilTag 36h11 第一版與完整 AprilTag 3 引擎評估。
- 加入離線快取、PWA 圖示與安裝流程。
- 建立真實手機、列印標記與低光測試集。

## Acceptance direction

- GitHub Pages 專案子路徑下所有靜態資產正確載入。
- 相機在停止、離開前景與元件卸載時釋放。
- 不自動上傳或持久保存影像與掃描內容。
- 清晰 QR 與常見條碼可在手機及桌面瀏覽器完成辨識。
