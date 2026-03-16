# Route And Data Map

## Routes

### Public

1. `prototype/index.html`
2. `prototype/methodology.html`
3. `prototype/affiliate.html`
4. `prototype/terms.html`
5. `/` via `server.mjs`

### Direct-open app

1. `prototype/app.html`
2. `prototype/entity.html`

### Entity route

1. `prototype/entity.html?kind=ticker&id=BBCA`
2. `prototype/entity.html?kind=investor&id=lo-kheng-hong`
3. `prototype/entity.html?kind=group&id=salim-group`

## Entity coverage

### Authored ticker entities

1. `BBCA`
2. `BBRI`
3. `TLKM`
4. `BMRI`
5. `BBNI`
6. `ASII`
7. `TINS`
8. `ITMG`
9. `GIAA`
10. `BUMI`

### Authored investor entities

1. `lo-kheng-hong`
2. `government-of-norway`
3. `uob-kay-hian-pte-ltd`
4. `happy-hapsoro`
5. `pt-danantara-asset-management`
6. `bpjs-ketenagakerjaan`
7. `blackrock-funds`
8. `vanguard-funds`
9. `banpu-mineral-singapore-pte-ltd`
10. `jardine-cycle-carriage-ltd`

### Authored group entities

1. `salim-group`
2. `bakrie-group`
3. `lippo-group`

### Fallback entity support

If an entity is linked from sample tables but not fully authored, `entity.js` generates a fallback page from:

1. computed screener rows from authored ticker pages when possible
2. `heatmap`
3. `hiddenPositions`
4. `norwayPositions`

## Data blocks inside `mock-data.js`

1. `meta`
2. `landingStats`
3. `featureCards`
4. `overview`
5. `funds`
6. `freeFloat`
7. `hiddenPositions`
8. `norwayPositions`
9. `network`
10. `heatmap`
11. `methodology`
12. `affiliate`
13. `sectorExposure`
14. `spotlights`
15. `entities`
16. `tickerAnalytics`
17. `searchIndex`
18. `searchables`

## Derived data at runtime

`assets/utils.js` computes the following structures at runtime:

1. Search corpus merged from `searchIndex`, `entities`, `freeFloat`, and `heatmap`
2. Free-float rows recomputed from authored ticker `holderTable` entries
3. Synthetic aggregate free-float rows for non-authored symbols
4. Weighted sector exposure from authored ticker holder tables with `marketCap`
5. Local AI-answer summaries used by the dashboard question panel
6. Investor-led and ticker-led network scenarios with overlap evidence
