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
- 開發模式不註冊離線 Service Worker，並允許本機 loopback 預覽，避免舊版 HMR 資源干擾開發驗證。
- 首頁與掃描器改為功能性文案，主要列出常用條碼及 OpenCV 相容標記。
- ArUco／AprilTag 結果顯示 OpenCV 字典名稱，並提供可複製的 Python 偵測範例。

## Next

- 評估 `DICT_4X4_50`、`DICT_5X5_100`、`DICT_6X6_250` 等常用 OpenCV ArUco 字典的瀏覽器引擎；未通過實測前不列為支援。
- 建立功能性社群預覽、正式方形 PWA 圖示與安裝流程。
- 建立真實手機、列印標記與低光測試集。

## Acceptance direction

- GitHub Pages 專案子路徑下所有靜態資產正確載入。
- 相機在停止、離開前景與元件卸載時釋放。
- 不自動上傳或持久保存影像與掃描內容。
- 清晰 QR 與常見條碼可在手機及桌面瀏覽器完成辨識。
- 合成 ArUco 標記可由 WebAssembly 引擎解碼，並在 GitHub Pages 子路徑載入。
- 合成 tag36h11 AprilTag 可由獨立 Worker 解碼，且不連線第三方 CDN。

## 2026-10-27 handoff assessment

- Goal: read the complete chat handoff, remove chat_tmp.txt as explicitly requested, and assess readiness for GitHub Pages testing.
- Scope: inspect sources and existing checks; retain pre-existing changes; no feature implementation or remote publication.
- Handoff: core QR/barcode, ArUco Original/MIP, and AprilTag tag36h11 scanning is implemented; common OpenCV dictionaries, PWA assets, and physical-device testing remain follow-ups.
- Initial state: HEAD 4a47f01; no Git remote. Existing apriltag_wasm.js change is CRLF-only (normalized text equals HEAD); working-file SHA-256 matches SOURCE.md, committed LF bytes have a different checksum. Preserve this change for separate provenance handling.
- Coordination: root owns PROGRESS.md and the authorized chat_tmp.txt removal. Fable discuss request tagscanner-readiness-20261027-01 is read-only, conversation context, no file ownership; validates assessment and next-step priorities. Requested model fable / medium; completed; observed model and evidence below.
- Quota: official Claude observation 2026-10-27T09:26:22.082Z, five-hour utilization 18%, seven-day 5%, allowed.
- Verification: bundled Node v24.19.0; lint PASS, typecheck PASS, tests 15/15 PASS, production static export with /tagscanner base path PASS. Eleven referenced subpath assets resolved in out; .nojekyll, service worker, manifest, AprilTag worker/JS/WASM, and bundled ArUco WASM are present. Exported AprilTag bytes match the working files.
- Whitespace check: full git diff --check reports 21 CRLF trailing-whitespace entries in the pre-existing vendor JS; no logical difference. This assessment leaves the vendor file unchanged and unstaged.
- Discussion: job 83a7e6d6ffe0f9547fc548279a70c110, session 1d839fbc-3356-42f0-ade2-99d78db12e5c, gate PASS; requested fable / medium, observed claude-fable-5-1, no observed fallback. Evidence: D:/AgentData/claude-bridge/state/jobs/83a7e6d6ffe0f9547fc548279a70c110/. Root accepts prototype readiness and follow-up priorities. Workflow already derives base path from repository name; actual hosted asset loading remains a deployment check. Existing project rules require committing this progress record. Device-dependent camera/torch behavior remains subject to physical-device testing.
- Outcome: current functionality is suitable for GitHub Pages prototype testing. Publishing requires a selected remote repository and Pages configuration. Reconcile vendor line-ending policy and SOURCE.md checksum when preparing publication; this discrepancy does not change JavaScript behavior.
- Next priorities: Android/iPhone camera permissions, start/stop/background/restart and image decoding; printed ArUco Original and AprilTag 36h11 under perspective/low light; production offline/update behavior. Common OpenCV dictionary expansion and PWA/social assets can follow device feedback.
- Scope completed: chat_tmp.txt was untracked, read and removed at the user's request; source features unchanged; no remote push. This run supplies local automated/build evidence; browser and physical-device results remain from the earlier handoff or pending.
