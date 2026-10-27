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

## Dependency and Pages CI maintenance

- Authorization: user requested all dependency bumps handled after pushing AnyTagScanner. Root owns package manifests/lock, CI/Pages workflows, Dependabot policy, scoped vendor checksum normalization, related tests, and this record. Remote publication awaits explicit push authorization under the project rule.
- Current evidence: origin/main 642e44b; ten Dependabot PRs. Main Pages run 40527302714 failed at the vendor JS checksum test (Linux LF hash 587C3B98...E3DDEA versus expected Windows CRLF hash DFD03EA3...5B201). ESLint 10 PR failed react/display-name because eslint-plugin-react uses removed APIs.
- Discussion assignment: request tagscanner-deps-plan-20261027-01, Fable / medium, conversation read-only; assess compatible updates and CI repair. Independent Opus review planned after changes; root remains sole writer.
- Prior explanation discussion: job 021ddc4307c6d412d3962a95304ba0b9, session 27230127-9cf7-4549-8e98-109da884a6b6, requested Fable / low, observed claude-fable-5-1, PASS. Sources require static export through Actions; deployment URL derives from AnyTagScanner.

- Plan confirmation: job db7b7dad2b5ed39b06bd110bfe43985c, session 69586101-67ee-494e-81e9-d33bf2bc1421, requested Fable / medium, observed claude-fable-5-1, PASS. Evidence is under D:/AgentData/claude-bridge/state/jobs/db7b7dad2b5ed39b06bd110bfe43985c/.
- Compatibility decisions: update all direct dependencies to current compatible releases; ESLint stays 9.39.5 because eslint-plugin-react 7.37.5 supports <=9 and PR #10 fails on removed getFilename; TypeScript 6.0.3 fits typescript-eslint 8.72.1 range >=4.8.4 <6.1; Node types stay on runtime major 24. Dependabot groups coupled packages and excludes the incompatible ranges. These bounds should be revisited when upstream support changes.
- Fix: pin LF for the AprilTag wrapper via scoped .gitattributes; hash working bytes against HEAD (identical) and use that checksum in test/SOURCE.md. Preserve the imported CRLF checksum in provenance. Vendor runtime logic and WASM bytes are unchanged.
- Verification: direct Node v24.19.0 invocation of npm CLI completed npm ci, lint, typecheck, 15/15 tests, audit (0 vulnerabilities), and static export with /AnyTagScanner and the actual Pages URL. Export asset checks passed, including worker/WASM and .nojekyll. Full git diff --check passed.
- Failures resolved: npm.cmd initially selected its adjacent Node 20 despite PATH override; reran clean installation with explicit Node 24 plus npm-cli.js. ZXing 0.23 fresh MultiFormatReader.decode(bitmap) skips initialization when both hints are undefined; production BrowserMultiFormatReader initializes hints and uses decodeWithState. The QR test now exercises that actual browser adapter, preserving successful decoded-text/format assertions. No application decoder workaround was added.
- Actions: checkout/setup-node v7, configure-pages v6, upload-pages-artifact/deploy-pages v5. Upload includes hidden files from out to retain .nojekyll. Local build validates exported files; hosted execution awaits publication.
- Independent review assignment: request tagscanner-deps-review-20261027-01, Opus / high, project read-only, scoped to manifests/lock, workflows, Dependabot, checksum/provenance, notices, tests, and progress. Root remains sole writer; source version stays fixed during review.
- Review transport retry: job f4364210e36af636f543c1b077809044 stopped before model execution because the full lockfile exceeded the bridge's 200000-byte context limit. Retry tagscanner-deps-review-20261027-02 excludes the lockfile and progress from the initial snapshot; reviewer may inspect targeted lock entries on disk. Evidence and source contents are retained.
- Independent review: job e4e598ac205aa932b4f7a8a67d45a439, session aa770b43-a0e7-4aa6-8345-83852e71edaf; requested Opus / high, observed claude-opus-5-5, PASS with no required fixes. Evidence: D:/AgentData/claude-bridge/state/jobs/e4e598ac205aa932b4f7a8a67d45a439/. Reviewer inspected the actual browser adapter, LF policy, lockfile entries, and package/Actions configuration.
- Publication state checked: public repository robin840211/AnyTagScanner, main branch, has_pages=false, current connection has admin/push permission. Source and review are ready for a local commit; publishing and enabling Pages remain the final scope confirmation.
- Publication authorization: user approved pushing main, closing superseded/incompatible Dependabot PRs, enabling Pages, and publishing. Keep repository AnyTagScanner and UI name TagScanner. Dependency changes are committed as b791c31; working tree was clean and remote main remained 642e44b at resumption.
- Publication handoff: root owns remote settings, push, PR state changes and live verification. Fable discussion request tagscanner-publication-guide-20261027-01 checks the complete publication explanation and naming; read-only, no source ownership. Next: enable workflow-based Pages, push, verify hosted build/deploy and live assets, then record results. Rollback uses a corrective/revert commit followed by the same deployment workflow.
- Publication guide discussion: job 22b2219801ef99d56e1488af0cc44abf, session 33ddf706-044f-4d58-925c-9211fed5d1a3, requested Fable / low, observed claude-fable-5-1, PASS. User then requested case-sensitivity assessment only while publication continues. Follow-up request tagscanner-url-case-20261027-01 is read-only; retain AnyTagScanner until a rename is authorized. Live HTTP checks: /AnyTagScanner/ = 200; /anytagscanner/ and /tagscanner/ = 404.
- Published b791c31: Pages enabled with build_type=workflow and enforced HTTPS; push to main succeeded. GitHub Actions run 40535469835 passed both build (installation, lint, typecheck, tests, export, artifact upload) and deploy. Live URL: https://robin840211.github.io/AnyTagScanner/.
- Dependabot: all PRs #1-10 are closed. #7/#10 closed automatically after ignore rules; #1-6/#8-9 were superseded by b791c31 and closed through the already-authorized GitHub CLI account. Connector state updates returned integration permission 403; no connector mutation succeeded. Open PR count is zero.
- Live verification: homepage and all 15 checked JS/CSS/manifest/service-worker/AprilTag assets returned HTTP 200; WASM MIME is application/wasm. In-app browser rendered the page, switched AprilTag mode successfully, and reported no captured warning/error logs. Phone camera scanning remains device validation.
- URL assessment: job 82aeb5ebdfd3b495a612b5016ffc6b77, resumed session 33ddf706-044f-4d58-925c-9211fed5d1a3, requested Fable / low, observed claude-fable-5-1, PASS. Recommend lowercase anytagscanner (or shorter tagscanner); rename requires user decision, origin update, redeployment and updating shared URLs. UI title stays independent. Current publication retains AnyTagScanner.
- Publication work is complete; this record-only commit preserves authorization and hosted evidence. Future main pushes run the same build/deploy workflow. Detailed publication instructions and the optional lowercase-name assessment are returned in the task report.

## Dedicated lowercase publication

- User approved the dedicated tagscanner publication repository while retaining AnyTagScanner as the source repository. Scope includes creating the publication repository, configuring Pages, committing/pushing publication changes, and verifying https://robin840211.github.io/tagscanner/.
- Root owns workflow implementation, remote changes, integration and live verification. Fable request tagscanner-publisher-plan-20261028-01 covers architecture confirmation read-only; Opus will review the actual publication workflow before push. Source baseline 66b987b; integration branch main. Publication checkout is planned at D:/GitProject/tagscanner-pages.
- Proposed operation: publication workflow resolves public source main to an immutable SHA; scheduled checks skip an unchanged deployed SHA, while manual and publisher changes force a build. Keep the current source Pages deployment intact during migration. Cross-repository credentials are unnecessary for reading public source. Record provenance in the published build.json.
- Created public robin840211/tagscanner and enabled workflow-based Pages with HTTPS before the initial push. Verified source visibility PUBLIC. Both repository descriptions and homepage fields include https://robin840211.github.io/tagscanner/; publisher description also links source, as explicitly requested.
- Fable planning job 5ed2c012e9697ea111c4412207781296 initially flagged missing explicit evidence for Pages enablement/source visibility. Both were verified through GitHub CLI; follow-up 9ba07d4d2aad686438c65b0ab6e19722 passed, session 25ab8ad8-db26-439a-b10f-064068da4dd9, observed claude-fable-5-1.
- Publisher commit ba063df implements resolve/build/deploy, immutable public-source checkout, isolated deployment permissions, provenance, and checks at minutes 17/47. YAML parsing and bash syntax checks passed. Opus review job a46fc9f4d33ccf9c9cfad995b6dd7e3c is read-only; publisher files stay fixed until it returns. Source README now links the canonical lowercase site and explains scheduled/manual publishing and inactivity limits.
