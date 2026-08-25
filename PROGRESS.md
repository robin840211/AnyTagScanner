# Progress

## Current objective

建立可直接發布到 GitHub Pages 的跨裝置 TagScanner；目前交付 QR、一般條碼、ArUco 與 tag36h11 AprilTag。

## Completed

- 初始化 Git repository 與 Next.js 靜態輸出。
- 建立 GitHub Pages base path 與部署 workflow。
- 建立手機與桌面響應式掃描介面。
- 完成相機啟停、多鏡頭選擇、支援時的手電筒控制。
- 完成圖片辨識、ZXing 多格式解碼、結果疊圖、安全網址處理。
- 完成工作階段歷史、JSON 匯出、隱私與第三方授權文件。
- 建立 lint、type check、unit test 與 production build 驗證。
- 完成 ArUco WebAssembly 技術驗證、Original 5×5 與 MIP 36h12 字典選擇。
- 完成 ArUco 相機與圖片多標記辨識、ID 紀錄、疊圖與合成標記回歸測試。
- 完成 tag36h11 AprilTag Web Worker／WebAssembly 相機與圖片辨識。
- 固定 AprilTag 上游 commit、二進位校驗碼及 BSD 授權，移除執行階段 CDN 依賴。

## Next

- 評估支援 tagStandard41h12 等家族的完整 AprilTag 3 自行建置流程。
- 完善離線快取版本策略、PWA 圖示與安裝流程。
- 建立真實手機、列印標記與低光測試集。

## Acceptance direction

- GitHub Pages 專案子路徑下所有靜態資產正確載入。
- 相機在停止、離開前景與元件卸載時釋放。
- 不自動上傳或持久保存影像與掃描內容。
- 清晰 QR 與常見條碼可在手機及桌面瀏覽器完成辨識。
- 合成 ArUco 標記可由 WebAssembly 引擎解碼，並在 GitHub Pages 子路徑載入。
- 合成 tag36h11 AprilTag 可由獨立 Worker 解碼，且不連線第三方 CDN。
