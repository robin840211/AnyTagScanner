# TagScanner

[開啟網站](https://robin840211.github.io/tagscanner/)

TagScanner 使用瀏覽器相機或圖片辨識常用條碼與視覺標記。辨識在目前裝置內執行，不需要上傳影像。

## 目前功能

- 手機與電腦相機即時掃描
- 後鏡頭優先與多相機切換
- 支援時顯示手電筒控制
- 圖片檔案辨識
- QR Code、Data Matrix、Aztec、PDF417；Micro QR／rMQR 可於擴充格式開啟
- EAN-8、EAN-13、UPC-A、UPC-E
- Code 39、Code 93、Code 128、Codabar、ITF；DataBar（RSS）可於擴充格式開啟
- QR 與條碼合併辨識，或分別選擇 QR／條碼模式
- 支援旋轉、反相與具足夠色彩對比的條碼
- 掃描中直接切換模式，相機保持開啟
- OpenCV `DICT_ARUCO_ORIGINAL` 與 `DICT_ARUCO_MIP_36h12`
- ArUco 相機及圖片多標記辨識、ID 與邊界顯示
- OpenCV `DICT_APRILTAG_36h11` 相機及圖片多標記辨識
- 辨識結果顯示 OpenCV 字典名稱，並可複製 Python 偵測範例
- 四角辨識邊界疊圖；標記離開畫面後框線自動消失
- 安全複製及 HTTP／HTTPS 網址開啟
- 工作階段最近 100 筆掃描紀錄與 JSON 匯出；持續出現的同一標記保留一筆
- 響應式手機、平板與桌面版面

ArUco 與 AprilTag 功能目前標示為 Beta。主要建議使用 `DICT_ARUCO_ORIGINAL` 或 `DICT_APRILTAG_36h11`。MIP 36h12 保留作為既有相容選項。

目前尚未支援 OpenCV 的 4×4、5×5、6×6、7×7 ArUco 字典，也未支援 AprilTag 16h5、25h9、36h10。介面不會將這些格式標示為可辨識。

## 隱私

- 相機串流只提供給目前瀏覽器分頁。
- 選擇的圖片使用裝置內部暫存網址處理。
- 掃描內容預設只保留在目前工作階段。
- 不包含分析追蹤、帳號系統或遠端資料庫。
- 掃描到網址時不會自動開啟，且只允許明確開啟 HTTP／HTTPS 網址。

## 瀏覽器需求

- GitHub Pages 或其他 HTTPS 靜態網站
- 支援 MediaDevices.getUserMedia() 的瀏覽器
- 本機開發可使用 localhost

相機、手電筒、鏡頭標籤與安裝功能會依瀏覽器和裝置有所差異。沒有相機或相機權限時，仍可使用圖片辨識。

ArUco 標記需要完整黑色外框與足夠留白；列印、反光、傾斜和低光會影響辨識結果。

AprilTag 需使用 tag36h11 家族；其他家族即使外觀相近也不會得到正確結果。

## 本機使用

需要 Node.js 24 以上版本。

    npm ci
    npm run dev

開啟 http://localhost:3000。

## 驗證

    npm run lint
    npm run typecheck
    npm test
    npm run build

靜態輸出位於 out。

## GitHub Pages

正式網站為 https://robin840211.github.io/tagscanner/，發布流程位於 [tagscanner repository](https://github.com/robin840211/tagscanner)。原始碼持續在此 repo 維護。

推送 `main` 後，發布 repo 每 7 天（台灣時間週一 03:17）檢查版本，有更新時執行檢查、建置與發布。GitHub 排程可能延遲；需要立即發布時，至 [Publish TagScanner](https://github.com/robin840211/tagscanner/actions/workflows/publish.yml) 按 **Run workflow**，選擇 `main`。

公開發布 repo 連續 60 天沒有活動時，GitHub 可能停用排程，可在 Actions 頁面重新啟用。

### 在自己的 repo 發布

1. 將 repository 建立為公開 repository。
2. 推送 main 分支。
3. 在 repository 的 **Settings → Pages** 將 Source 設為 **GitHub Actions**。
4. Deploy GitHub Pages workflow 會驗證、建置並發布 out。
5. Repository Pages 會使用 https://&lt;owner&gt;.github.io/&lt;repository&gt;/。
6. &lt;owner&gt;.github.io repository 會自動改用網站根路徑。

如使用自訂網域，在 repository 的 Actions variable 新增 SITE_URL，值為完整 HTTPS 網址；例如 https://scanner.example.com/。

## 授權

TagScanner 使用 [MIT License](LICENSE)。第三方套件授權列於 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
