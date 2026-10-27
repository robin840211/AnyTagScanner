# Third-party notices

TagScanner includes the following direct runtime dependencies:

| Package | Version | License | Project |
|---|---:|---|---|
| @ar-js-org/aruco-rs | 0.1.0 | MIT | https://github.com/AR-js-org/aruco-rs |
| zxing-wasm | 3.1.6 | MIT / Apache-2.0 | https://github.com/Sec-ant/zxing-wasm |
| next | 16.4.3 | MIT | https://github.com/vercel/next.js |
| react | 19.3.1 | MIT | https://github.com/facebook/react |
| react-dom | 19.3.1 | MIT | https://github.com/facebook/react |

TagScanner also distributes a pinned `tag36h11` WebAssembly build from [apriltag-js-standalone](https://github.com/arenaxr/apriltag-js-standalone), which includes the AprilTag detector library. Its BSD 3-Clause and BSD 2-Clause notices, source commits and binary checksums are retained in [`public/vendor/apriltag`](public/vendor/apriltag/).

The barcode reader bundles ZXing-C++ commit `2c3dcfeffa7878950a58c1703c86774a428b0c91` under Apache-2.0, the ZXingWasm C++ binding under Apache-2.0, and the zxing-wasm JavaScript wrapper under MIT. License texts are distributed in `public/vendor/barcode`. The unmodified reader WASM SHA-256 is `5003fb4b88c4fbd1fd518a2fd8c8ad365c519e183a08c03a322dddfea3cea84e`.

`@zxing/library` is used only for development test fixtures, under Apache-2.0.

完整授權文字隨各 npm package 發布，安裝後可在相應的 node_modules package 目錄查閱。
