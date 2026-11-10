# js/vendor — self-hosted third-party scripts

Bytes are copied unmodified from the npm registry tarball; never edit or re-minify them.
`tools/test-sw-precache.mjs` recomputes each sha256 below and fails on drift.

| file | package | sha256 | licence |
|---|---|---|---|
| chart.umd.min.js | chart.js@4.4.1 `dist/chart.umd.js` | 74401d738dd3e03ee5dfb3b6841210fe2c4ead8a960c4011ca4ba0b78a9fd8f3 | MIT, chart-LICENSE.md |
| chartjs-plugin-annotation.min.js | chartjs-plugin-annotation@3.1.0 `dist/chartjs-plugin-annotation.min.js` | ff03786a60f6c93ccacfe0fbb6c2e3c671d7930856a3689f2f393113d8d655ec | MIT, chartjs-plugin-annotation-LICENSE.md |
| three-r170.min.js | three@0.170.0 | — | MIT, three-LICENSE.txt |

Why (P25): the 9 calculators that draw charts loaded Chart.js from jsDelivr, so a visitor offline,
or behind a CDN outage, got a calculator with no charts. Self-hosted, the service worker can keep it.
