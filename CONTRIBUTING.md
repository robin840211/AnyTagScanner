# Contributing

## 開發流程

1. 從 main 建立功能分支。
2. 保持影像與辨識在瀏覽器本機執行。
3. 不提交相機畫面、個人掃描內容、憑證或機密設定。
4. 新增格式或引擎時，同步更新支援格式與第三方授權。
5. 提交 Pull Request 前執行：

    npm run lint
    npm run typecheck
    npm test
    npm run build

## Pull Request

- 一個 Pull Request 聚焦一個清楚的變更。
- 說明使用者可觀察到的結果。
- 列出已實際執行的測試。
- 介面變更需同時檢查手機與桌面排列。
