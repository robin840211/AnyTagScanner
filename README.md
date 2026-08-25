# TagScanner

TagScanner 是一個以瀏覽器為入口的跨裝置視覺標記掃描器。相機與圖片辨識都在目前裝置內執行，不需要上傳影像。

## 目前功能

- 手機與電腦相機即時掃描
- 後鏡頭優先與多相機切換
- 支援時顯示手電筒控制
- 圖片檔案辨識，檔案不會上傳
- QR Code、Micro QR、Data Matrix、Aztec、PDF417
- EAN-8、EAN-13、UPC-A、UPC-E
- Code 39、Code 93、Code 128、Codabar、ITF、RSS
- ArUco Original 5×5 與 MIP 36h12
- ArUco 相機及圖片多標記辨識、ID 與邊界顯示
- 辨識邊界疊圖
- 安全複製及 HTTP／HTTPS 網址開啟
- 工作階段掃描紀錄與 JSON 匯出
- 響應式手機、平板與桌面版面

ArUco 功能目前標示為 Beta。AprilTag 模式已保留介面，辨識引擎仍在開發中。

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

1. 將 repository 建立為公開 repository。
2. 推送 main 分支。
3. 在 repository 的 **Settings → Pages** 將 Source 設為 **GitHub Actions**。
4. Deploy GitHub Pages workflow 會驗證、建置並發布 out。
5. Repository Pages 會使用 https://&lt;owner&gt;.github.io/&lt;repository&gt;/。
6. &lt;owner&gt;.github.io repository 會自動改用網站根路徑。

如使用自訂網域，在 repository 的 Actions variable 新增 SITE_URL，值為完整 HTTPS 網址；例如 https://scanner.example.com/。

## 授權

TagScanner 使用 [MIT License](LICENSE)。第三方套件授權列於 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
