
1) Pertanyaan inti: “tanpa API atau biaya, apakah bisa?”
Jawaban jujurnya:
Tanpa API berbayar: bisa.
Tanpa API sama sekali: secara praktik, tidak benar-benar.
Karena website Anda tetap harus mengambil data dari suatu sumber. Biasanya sumber gratis jatuh ke salah satu dari ini:
	• Unofficial/public endpoint
	• Scraping halaman web / CSV download
	• Bulk file historical data
Tool populer seperti yfinance sendiri secara eksplisit menyebut bahwa ia memberi akses ke API Yahoo Finance dan mengingatkan bahwa penggunaan Yahoo Finance ditujukan untuk personal use only. Repo yahoo-finance2 juga terang-terangan menyebut dirinya Unofficial API for Yahoo Finance. (GitHub)
Jadi kalau Anda bilang ke diri sendiri “tanpa API”, yang paling realistis sebenarnya adalah:
	tanpa API berbayar / tanpa kontrak vendor data / memakai sumber publik gratis
Itu feasible.

2) Opsi sumber data gratis yang realistis
Opsi A — Yahoo Finance unofficial
Ini opsi paling praktis untuk MVP.
Kelebihan
	• Banyak ticker global
	• Ada historical daily data
	• Banyak library komunitas
	• Mudah dipakai untuk website
Kekurangan
	• Tidak resmi
	• Bisa berubah sewaktu-waktu
	• Ada potensi rate limiting / blocking
	• Tidak ideal kalau nanti jadi produk besar komersial
	• yfinance sendiri mengingatkan penggunaan Yahoo untuk personal use only (GitHub)
Repo/library yang relevan
	• Python: ranaroussi/yfinance (GitHub)
	• Node/TypeScript: gadicc/yahoo-finance2 (GitHub)
Cocok untuk
	• Prototype
	• Internal tool
	• Personal website
	• Validasi ide

Opsi B — Stooq
Stooq menyediakan free historical market data dan juga halaman data historis per simbol, plus bulk historical files. Hasil pencarian menunjukkan ada file historical data gratis dengan update yang masih aktif. (Stooq)
Kelebihan
	• Gratis
	• Historical oriented
	• Cocok untuk cache / local storage
	• Bisa dipakai sebagai fallback source
Kekurangan
	• Coverage tidak selalu sebaik Yahoo untuk semua market
	• UX integrasi lebih “data-engineering style”
	• Ada friction seperti struktur file/download flow
Cocok untuk
	• Secondary source
	• Nightly sync historical data
	• Backup bila Yahoo gagal

Opsi C — IDX official pages / statistics
Untuk market Indonesia, Anda bisa pakai data resmi IDX sebagai cross-check / official reference, terutama untuk indeks/statistik/digital statistic. IDX memang menyediakan halaman statistik digital dan data pasar resmi. (IDX)
Kelebihan
	• Sumber resmi untuk konteks Indonesia
	• Bagus untuk verifikasi
Kekurangan
	• Tidak selalu semudah “API per ticker per date”
	• Struktur datanya mungkin perlu parsing / workflow khusus
	• Bisa kurang praktis untuk request real-time user-facing app
Cocok untuk
	• Validasi data Indonesia
	• Official comparison layer
	• Audit / confidence check

3) GitHub / open-source yang bisa dijadikan fondasi
Berikut yang paling relevan dan layak dijadikan base:
Pilihan utama
1. ranaroussi/yfinance
Kenapa berguna:
	• Mature
	• Sangat populer
	• Dokumentasi jelas
	• Mudah untuk historical pull per ticker/date range
Namun repo-nya jelas menyebut akses ke Yahoo Finance API dan mengingatkan soal personal use. (GitHub)
2. gadicc/yahoo-finance2
Kenapa sangat cocok untuk website:
	• Cocok untuk Node.js / TypeScript
	• Cocok kalau Anda build dengan Next.js
	• Mengklaim sebagai Unofficial API for Yahoo Finance (GitHub)
Pilihan pendukung
3. Repo scraper historical Yahoo
Ada repo contoh scraper seperti stock-market-scraper, tapi ini biasanya lebih rapuh dibanding pakai library komunitas yang lebih mature. Tetap bisa jadi referensi ide, tapi bukan fondasi utama.

4) Rekomendasi arsitektur terbaik untuk Anda
Kalau target Anda adalah:
	• gratis
	• tidak pakai API berbayar
	• bisa jawab harga saham per tanggal
	• nanti bisa dikembangkan jadi website beneran
maka saya sarankan:
Arsitektur MVP yang paling masuk akal
Next.js + TypeScript + yahoo-finance2 + PostgreSQL/SQLite + cron cache
Kenapa ini paling masuk akal:
	• Next.js enak untuk website + backend route sekaligus
	• TypeScript lebih maintainable
	• yahoo-finance2 sudah cocok untuk Node ecosystem (GitHub)
	• DB cache penting supaya tidak query ke source publik setiap request

5) Desain sistem: jangan ambil data langsung dari browser
Yang salah
Frontend browser langsung request ke Yahoo/stooq.
Masalahnya:
	• CORS
	• gampang diblok
	• source URL exposed
	• rate limit cepat kena
	• tidak ada kontrol fallback/cache
Yang benar
Alur request
	1. User buka website
	2. User input:
		○ ticker
		○ market
		○ tanggal
	3. Frontend kirim request ke backend Anda
	4. Backend cek DB:
		○ kalau data sudah ada → return dari DB
		○ kalau belum ada → fetch dari source publik
	5. Backend normalisasi data
	6. Backend simpan ke DB/cache
	7. Return hasil ke frontend
Jadi website Anda bukan “viewer langsung”, tetapi data broker kecil milik Anda sendiri.

6) Data model yang sebaiknya disimpan
Untuk tiap record historical price, simpan minimal:
	• symbol
	• market
	• requested_date
	• actual_trading_date
	• open
	• high
	• low
	• close
	• adjusted_close
	• volume
	• currency
	• source
	• source_confidence
	• fetched_at
	• is_market_holiday
	• notes
Kenapa requested_date dan actual_trading_date harus dipisah?
Karena user bisa minta Sabtu/Minggu/libur.
Contoh:
	• user minta: 2026-06-08
	• ternyata market tutup
	• sistem balas:
		○ requested date = 2026-06-08
		○ actual trading date used = 2026-06-05
Itu membuat hasil Anda jauh lebih “auditable”.

7) Logic bisnis yang harus Anda definisikan sejak awal
A. Apa arti “nilai saham”?
Ini harus diputuskan. Karena “nilai” bisa berarti:
	• harga close
	• harga open
	• harga last traded
	• harga adjusted close
	• harga rata-rata
	• nilai pasar = harga × shares outstanding
Untuk website publik, paling aman tampilkan:
	• Open
	• High
	• Low
	• Close
	• Adj Close
	• Volume
Lalu definisikan default:
	“Nilai saham pada tanggal X” = closing price pada sesi perdagangan tanggal tersebut.

B. Kalau tanggal bukan hari trading?
Pilih salah satu policy:
Policy 1 — Strict
“Tidak ada data, market closed.”
Policy 2 — Auto previous trading day
“Tanggal yang diminta bukan hari bursa, ditampilkan harga dari sesi terakhir sebelumnya.”
Policy 3 — Keduanya
Tampilkan keduanya:
	• requested date
	• actual trading session used
Saya sarankan Policy 3.

C. Timezone
Ini penting sekali.
Harga saham tidak cukup cuma 2026-06-08, karena setiap market punya timezone berbeda.
Contoh:
	• NYSE/NASDAQ: US timezone
	• IDX: WIB
	• Tokyo: JST
Jadi untuk query by date:
	• simpan date dalam konteks exchange local date
	• jangan pakai timezone browser user sebagai patokan utama

8) Source strategy yang lebih kuat
Jangan bergantung pada satu source.
Strategi terbaik
Primary source
Yahoo unofficial via yahoo-finance2
Secondary source
Stooq historical / bulk files
Tertiary verification
IDX official pages untuk data Indonesia, bila relevan (Stooq)

9) Confidence scoring
Karena sumber gratis tidak sekuat vendor resmi, saya sarankan sistem punya confidence score.
Contoh:
	• HIGH
		○ data ditemukan dari source utama
		○ format valid
		○ OHLC lengkap
	• MEDIUM
		○ data hanya ada di fallback source
	• LOW
		○ data parsial / hasil scraping lemah / mismatch
Tampilkan juga:
	• Source: Yahoo unofficial
	• Fetched at: ...
	• Verified: no/partial
Ini membuat website Anda lebih profesional dan jujur.

10) Caching strategy — ini sangat penting
Kalau Anda tidak mau biaya, maka cache adalah jantung sistem.
Layer cache yang disarankan
Layer 1 — In-memory cache
Untuk request yang sama dalam beberapa menit
Layer 2 — Database cache
Untuk historical lookup yang sudah pernah diminta
Layer 3 — Daily backfill job
Cron job yang isi data historical populer ke database

Contoh rule cache
	• Historical data lama → cache permanen
	• Data hari ini → refresh tiap 5–15 menit
	• Data intraday → refresh lebih sering
	• Data tanggal masa lalu > 3 hari → anggap immutable
Untuk use case Anda, kalau fokusnya harga per tanggal, maka historical record lama bisa dianggap hampir statis dan disimpan lama.

11) Skema database yang saya sarankan
Table: instruments
	• id
	• symbol
	• exchange
	• country
	• currency
	• yahoo_symbol
	• stooq_symbol
	• is_active
Table: historical_prices
	• id
	• instrument_id
	• requested_date
	• trading_date
	• open
	• high
	• low
	• close
	• adj_close
	• volume
	• source
	• source_confidence
	• fetched_at
	• created_at
	• updated_at
Table: fetch_logs
	• id
	• instrument_id
	• requested_date
	• source_attempted
	• status
	• response_summary
	• created_at
Table: market_calendars
	• exchange
	• holiday_date
	• holiday_name
Dengan ini Anda bisa audit kenapa suatu tanggal gagal.

12) Fitur minimum viable product
MVP v1
	• input ticker
	• input tanggal
	• result card:
		○ symbol
		○ requested date
		○ actual trading date
		○ OHLCV
		○ source
		○ fetched time
	• handling invalid date
	• handling weekend/holiday
	• cache database
MVP v2
	• multi-market support
	• chart historical around requested date
	• compare 2 dates
	• export CSV
	• watchlist popular stocks
MVP v3
	• backfill nightly sync
	• multi-source reconciliation
	• corporate actions awareness
	• split/dividend adjusted handling
	• API endpoint milik Anda sendiri

13) Tantangan besar yang sering diremehkan
A. Delisted symbols
Ticker lama bisa sudah tidak aktif.
B. Symbol mapping
Contoh:
	• Indonesia di Yahoo biasanya suffix .JK
	• symbol source A belum tentu sama dengan source B
C. Corporate actions
Stock split, reverse split, dividend, bonus issue.
Kalau user tidak paham, mereka bisa bingung kenapa harga kelihatan “aneh”.
Makanya Anda perlu jelaskan beda:
	• Close
	• Adjusted Close
D. Market holiday calendar
Kalau tidak ada market calendar, hasil query per date akan sering membingungkan user.
E. Legal / terms risk
Karena sumber gratis ini banyak yang unofficial, jangan janji “official exchange-grade guaranteed pricing”.

14) Legal / compliance wording yang perlu ada di website
Saya sarankan pasang disclaimer seperti ini:
	Data is sourced from publicly available market data sources and may be delayed, incomplete, or subject to change. This website is for informational purposes only and does not constitute investment advice.
Kalau memakai Yahoo-based unofficial tools, disclaimer ini makin penting, karena repo yfinance jelas mengingatkan soal personal use only, dan yahoo-finance2 sendiri adalah unofficial API. (GitHub)

15) Apakah GitHub repo yang ada bisa langsung dipakai mentah-mentah?
Jawaban:
Untuk production serius: jangan langsung.
Pakai repo-repo itu sebagai:
	• data connector
	• inspirasi integration
	• fondasi fetch layer
Tetapi Anda tetap perlu menambahkan sendiri:
	• validation
	• caching
	• database
	• market calendar logic
	• fallback source
	• logging
	• monitoring
	• error handling
Jadi repo GitHub bukan “produk jadi”, tapi engine kecil di dalam sistem Anda.

16) Rekomendasi teknologi per level
Kalau Anda ingin paling cepat
Stack
	• Next.js
	• TypeScript
	• yahoo-finance2
	• SQLite
	• Vercel / VPS kecil
Ini paling cepat untuk proof of concept. (GitHub)

Kalau Anda ingin lebih kuat
Stack
	• Next.js frontend
	• Node/NestJS backend
	• PostgreSQL
	• Redis cache
	• Cron jobs
	• yahoo-finance2 + Stooq fallback
Ini lebih proper kalau nanti traffic mulai naik.

Kalau Anda nyaman Python
Stack
	• FastAPI
	• yfinance
	• PostgreSQL
	• Redis
	• Celery/cron
Tetapi kalau targetnya website modern all-in-one, Node/Next.js sering lebih praktis.

17) Build plan yang saya sarankan, tahap demi tahap
Phase 1 — Validation
Target:
	• buktikan bisa query 1 ticker, 1 date
	• tampilkan close price
Deliverable:
	• endpoint /price?symbol=AAPL&date=2026-06-08
	• return JSON
Phase 2 — Normalization
Tambahkan:
	• OHLCV
	• requested vs actual trading date
	• symbol validation
	• error handling
Phase 3 — Persistence
Tambahkan:
	• SQLite/Postgres
	• cache query result
	• fetch logs
Phase 4 — Multi-source
Tambahkan:
	• Yahoo as primary
	• Stooq as fallback
	• optional IDX cross-check for Indonesia
Phase 5 — UX polish
Tambahkan:
	• date picker
	• source label
	• market closed label
	• compare date feature
Phase 6 — Reliability
Tambahkan:
	• cron backfill
	• retry
	• rate limit
	• monitoring
	• alert for fetch failures

18) Best-practice architecture summary
Saya sarankan final blueprint seperti ini:
Frontend
	• Next.js UI
	• Search form
	• Result page
	• Simple chart
Backend
	• API routes
	• Fetch service
	• Date normalization service
	• Trading calendar service
	• Source fallback manager
Storage
	• PostgreSQL/SQLite
	• Redis optional
Source connectors
	• Yahoo unofficial connector
	• Stooq connector
	• IDX verifier for Indonesian instruments
Jobs
	• nightly backfill
	• popular symbol prefetch
	• failed fetch retry
Governance
	• source disclaimer
	• fetch logs
	• confidence score
	• audit trail

19) My honest recommendation for your exact case
Kalau saya yang bangun untuk use case Anda, saya akan pilih:
Recommended stack
Next.js + TypeScript + yahoo-finance2 + PostgreSQL
dengan:
	• Yahoo unofficial sebagai primary
	• Stooq sebagai fallback
	• IDX official pages sebagai validation reference untuk saham Indonesia bila perlu (GitHub)
Kenapa ini paling pas
	• gratis
	• cepat dibangun
	• cocok untuk website
	• bisa scale bertahap
	• tidak perlu vendor data mahal di awal

20) Kesimpulan tegas
Bisa dilakukan?
Ya, bisa.
Tanpa biaya?
Ya, untuk MVP bisa.
Tanpa API?
Tidak sepenuhnya. Praktiknya tetap memakai sumber data publik/unofficial atau scraping/bulk historical files. (GitHub)
Ada GitHub yang sudah melakukannya?
Ya. Yang paling relevan:
	• yfinance untuk Python (GitHub)
	• yahoo-finance2 untuk Node/TS (GitHub)
Untuk production besar?
Jangan bergantung pada satu source unofficial tanpa cache, fallback, dan disclaimer.

Langkah berikut yang paling tepat adalah saya buatkan system design lengkap untuk implementasi ini dalam bentuk:
folder structure, database schema, API contract, dan flow per request.
Kalau hanya untuk tracking investasi pribadi di VOO, VTI, QQQ, SPY, SCHD, VIG, maka plan-nya bisa dibuat jauh lebih simpel daripada platform saham umum.
Dan jujurnya, untuk scope sekecil ini, Anda tidak perlu sistem besar, symbol mapping rumit, atau multi-market engine. Keenam ticker itu semua tersedia di Yahoo Finance, dan library yahoo-finance2 masih aktif dirilis pada Maret 2026, tapi tetap ini adalah unofficial API, jadi harus dianggap praktis untuk personal tracker, bukan feed resmi bursa. (Yahoo Finance)
Rekomendasi paling pas untuk Anda
Saya sarankan model seperti ini:
Website personal portfolio tracker
untuk:
	• simpan jumlah unit yang Anda beli
	• simpan tanggal beli
	• simpan harga beli
	• ambil harga terkini gratis
	• hitung P/L per ETF dan total portfolio
	• optionally ambil historical price per tanggal tertentu
Stack yang paling cocok
	• Next.js
	• TypeScript
	• PostgreSQL atau SQLite
	• yahoo-finance2 sebagai source harga
	• cron job sederhana untuk refresh data berkala
Kenapa ini paling pas:
	• sederhana
	• murah
	• cukup stabil untuk personal use
	• semua ticker Anda ada di ekosistem Yahoo Finance (Yahoo Finance)

Blueprint yang lebih tepat untuk case Anda
1. Scope yang sebaiknya dibuat
Website Anda tidak perlu jadi “market data platform”.
Cukup fokus ke 3 hal:
A. Portfolio tracking
Contoh:
	• VOO — 10 shares — avg buy $480
	• QQQ — 4 shares — avg buy $505
	• SCHD — 8 shares — avg buy $78
B. Price lookup
Website bisa jawab:
	• harga sekarang
	• harga penutupan terakhir
	• harga pada tanggal tertentu
	• change harian
	• unrealized gain/loss
C. Historical comparison
Contoh:
	• nilai portfolio pada 1 Jan 2026
	• nilai portfolio hari ini
	• performance YTD
	• return per instrument

2. Anda tidak perlu ambil data untuk semua saham
Karena ticker Anda fixed:
	• VOO
	• VTI
	• QQQ
	• SPY
	• SCHD
	• VIG
maka sistem bisa dibuat jauh lebih stabil dengan cara:
	• hardcode whitelist ticker
	• tidak perlu search bebas
	• tidak perlu symbol resolver
	• tidak perlu validasi pasar yang kompleks
Benefit
	• lebih cepat
	• lebih aman
	• lebih sedikit bug
	• lebih mudah maintain

3. Arsitektur sederhana yang saya sarankan
Frontend
Halaman:
	• Dashboard
	• Holdings
	• Transactions
	• Performance
	• Settings
Backend
API internal:
	• /api/prices/current
	• /api/prices/history
	• /api/portfolio/summary
	• /api/transactions
	• /api/holdings
Database
Tabel utama:
	• assets
	• transactions
	• daily_prices
	• portfolio_snapshots

4. Data model yang saya sarankan
Table assets
Isi hanya 6 ETF Anda:
	• id
	• symbol
	• name
	• currency
	• exchange
	• enabled
Contoh:
	• VOO
	• VTI
	• QQQ
	• SPY
	• SCHD
	• VIG

Table transactions
Simpan pembelian/penjualan Anda:
	• id
	• symbol
	• transaction_date
	• type (BUY / SELL)
	• quantity
	• price_per_share
	• fees
	• notes
Dengan ini Anda bisa hitung:
	• total shares
	• cost basis
	• average price
	• realized gain/loss

Table daily_prices
Cache historical prices:
	• id
	• symbol
	• requested_date
	• trading_date
	• open
	• high
	• low
	• close
	• adj_close
	• volume
	• source
	• fetched_at
Ini penting supaya website Anda tidak fetch terus ke Yahoo setiap kali halaman dibuka.

Table portfolio_snapshots
Untuk simpan nilai portfolio harian:
	• id
	• snapshot_date
	• total_market_value
	• total_cost_basis
	• total_unrealized_pl
	• total_return_pct
Ini membuat dashboard sangat cepat.

5. Flow yang paling efisien
Saat website dibuka
	1. Ambil holdings Anda
	2. Cek harga latest di cache
	3. Kalau cache masih fresh, pakai cache
	4. Kalau tidak fresh, refresh dari source publik
	5. Hitung total nilai portfolio

Saat Anda input transaksi baru
	1. Simpan transaksi
	2. Recalculate holdings
	3. Update average cost
	4. Refresh current valuation

Saat Anda minta “harga per tanggal”
	1. Cek dulu daily_prices
	2. Kalau belum ada, fetch historical dari Yahoo
	3. Simpan ke DB
	4. Return hasil

6. Kenapa cache wajib, walaupun cuma 6 ticker
Karena source gratis/unofficial bisa berubah atau kena limit. Repo yahoo-finance2 sendiri menegaskan Yahoo tidak menyediakan API resmi dan tidak menjamin konsistensi layanan, dan ada issue baru akhir 2025 tentang kegagalan/limit akses pada sebagian pengguna. (GitHub)
Jadi best practice untuk tracker pribadi:
Jangan:
	• fetch live ke Yahoo tiap render halaman
	• bergantung 100% pada request real-time
Lakukan:
	• cache latest quote 5–15 menit
	• cache historical per tanggal permanen
	• simpan snapshot portfolio harian

7. Definisi “nilai investasi” yang harus Anda tetapkan
Untuk tracker pribadi, saya sarankan tampilkan 4 angka utama:
Per ETF
	• Quantity
	• Average Cost
	• Current Price
	• Market Value
	• Unrealized P/L
	• Return %
Portfolio total
	• Total Cost Basis
	• Total Market Value
	• Total Unrealized Gain/Loss
	• Allocation %
	• Performance vs previous close

8. Anda perlu putuskan: pakai close, last price, atau adj close?
Untuk ETF tracker personal, saya sarankan:
Default dashboard
	• gunakan current market price jika market open / ada quote terbaru
Untuk historical date
	• gunakan close
	• optionally tampilkan juga adj close
Kenapa adj close berguna:
	• lebih baik untuk analisis return historis
	• menyesuaikan event korporasi seperti distribusi/adjustment
Tetapi untuk user-facing dashboard personal, biasanya:
	• current value → latest price
	• historical comparison → close / adj close

9. Karena semua aset Anda ETF US, timezone jadi lebih mudah
Semua ticker Anda adalah ETF AS, jadi Anda bisa sederhanakan:
	• gunakan US market trading date untuk data harga
	• tampilkan timezone clearly di UI
	• jangan campur dengan timezone browser user untuk perhitungan trading session
Contoh di dashboard:
	• “Last updated based on U.S. market data”

10. Versi paling sederhana yang cukup untuk Anda
Kalau mau benar-benar lean, build hanya ini:
Halaman 1 — Portfolio Dashboard
Menampilkan:
	• total invested
	• total market value
	• total profit/loss
	• daftar keenam ETF
	• allocation pie/bar
	• daily change
Halaman 2 — Transactions
Tambah/edit:
	• date
	• symbol
	• qty
	• buy price
	• fee
Halaman 3 — Historical Lookup
Input:
	• symbol
	• date
Output:
	• OHLCV
	• trading date used
	• source
Itu saja sebenarnya sudah cukup kuat untuk kebutuhan pribadi.

11. Fitur yang saya sarankan untuk tahap 2
Setelah basic jalan, baru tambahkan:
	• dividend tracking
	• monthly contribution tracking
	• benchmark comparison
	• XIRR / money-weighted return
	• time-weighted return
	• rebalancing view
	• target allocation alert
Karena aset Anda ETF semua, fitur-fitur ini lebih berguna daripada menambah ratusan ticker.

12. Plan implementasi yang lebih komprehensif
Phase 1 — Core tracker
Bangun:
	• hardcoded 6 ETF
	• transaksi beli/jual
	• current price fetch
	• market value
	• unrealized P/L
Phase 2 — Historical engine
Bangun:
	• lookup harga per tanggal
	• cache daily historical prices
	• compare performance antar tanggal
Phase 3 — Portfolio analytics
Bangun:
	• allocation %
	• contribution by asset
	• portfolio return
	• gain/loss history
Phase 4 — Automation
Bangun:
	• daily snapshot
	• scheduled refresh
	• periodic backfill
Phase 5 — Advanced personal finance
Bangun:
	• dividend income log
	• DCA tracker
	• target asset allocation
	• rebalance suggestion

13. Rekomendasi struktur folder
Kalau pakai Next.js:
/src
  /app
    /dashboard
    /transactions
    /history
    /settings
    /api
      /prices
      /portfolio
      /transactions
  /lib
    yahoo.ts
    db.ts
    portfolio.ts
    pricing.ts
    cache.ts
  /components
    PortfolioTable.tsx
    HoldingsCard.tsx
    TransactionForm.tsx
    PerformanceChart.tsx
  /types
    portfolio.ts
    market.ts

14. Strategi source data terbaik untuk Anda
Primary
yahoo-finance2
Kenapa:
	• cocok untuk Next.js/Node
	• aktif
	• paling praktis untuk ETF AS
	• komunitasnya hidup (GitHub)
Secondary
Boleh tambahkan fallback nanti, tetapi untuk 6 ETF ini saya rasa tidak perlu di awal.
Karena untuk personal portfolio tracker, kompleksitas fallback kadang tidak sebanding dengan manfaatnya.

15. Risiko yang harus Anda pahami dari awal
Risiko 1 — Source unofficial
Yahoo route praktis, tapi bukan feed resmi. yahoo-finance2 sendiri menulis bahwa Yahoo tidak menyediakan official API dan tidak menjamin availability/consistency. (GitHub)
Risiko 2 — Rate limit / intermittent failure
Ada issue baru yang menunjukkan sebagian user mengalami masalah akses/crumb/rate limit. (GitHub)
Risiko 3 — Data mismatch minor
Kadang ada beda kecil antar source gratis.
Untuk tracker pribadi, ini biasanya masih acceptable selama:
	• Anda cache
	• Anda pakai source yang konsisten
	• Anda tidak mengklaim exchange-grade official accuracy

16. Saran paling praktis untuk Anda
Karena ini hanya untuk:
	• VOO
	• VTI
	• QQQ
	• SPY
	• SCHD
	• VIG
maka saya sarankan jangan overengineer.
Pilihan terbaik:
Build personal ETF tracker
dengan fitur:
	• manual transaction entry
	• automatic quote update
	• historical price by date
	• total P/L dashboard
	• daily snapshots
Dan jangan dulu buat:
	• stock screener
	• symbol search universal
	• multi-country support
	• public API
	• real-time streaming quotes

17. Final recommendation
Untuk case Anda, blueprint final saya:
Stack
	• Next.js
	• TypeScript
	• SQLite dulu
	• yahoo-finance2
	• Vercel atau VPS kecil
Design principle
	• whitelist 6 ticker
	• cache everything
	• store all transactions
	• compute portfolio locally
	• use latest quote for current value
	• use close price for historical date lookup
Output utama
	• dashboard total portfolio
	• per-ETF valuation
	• historical comparison
	• portfolio snapshots

18. Kesimpulan tegas
Karena aset Anda hanya 6 ETF US, sistemnya bisa dibuat:
	• lebih sederhana
	• lebih stabil
	• lebih murah
	• lebih cepat selesai

Kalau hanya untuk tracking investasi pribadi di VOO, VTI, QQQ, SPY, SCHD, VIG, maka plan-nya bisa dibuat jauh lebih simpel daripada platform saham umum.
Dan jujurnya, untuk scope sekecil ini, Anda tidak perlu sistem besar, symbol mapping rumit, atau multi-market engine. Keenam ticker itu semua tersedia di Yahoo Finance, dan library yahoo-finance2 masih aktif dirilis pada Maret 2026, tapi tetap ini adalah unofficial API, jadi harus dianggap praktis untuk personal tracker, bukan feed resmi bursa. (Yahoo Finance)
Rekomendasi paling pas untuk Anda
Saya sarankan model seperti ini:
Website personal portfolio tracker
untuk:
	• simpan jumlah unit yang Anda beli
	• simpan tanggal beli
	• simpan harga beli
	• ambil harga terkini gratis
	• hitung P/L per ETF dan total portfolio
	• optionally ambil historical price per tanggal tertentu
Stack yang paling cocok
	• Next.js
	• TypeScript
	• PostgreSQL atau SQLite
	• yahoo-finance2 sebagai source harga
	• cron job sederhana untuk refresh data berkala
Kenapa ini paling pas:
	• sederhana
	• murah
	• cukup stabil untuk personal use
	• semua ticker Anda ada di ekosistem Yahoo Finance (Yahoo Finance)

Blueprint yang lebih tepat untuk case Anda
1. Scope yang sebaiknya dibuat
Website Anda tidak perlu jadi “market data platform”.
Cukup fokus ke 3 hal:
A. Portfolio tracking
Contoh:
	• VOO — 10 shares — avg buy $480
	• QQQ — 4 shares — avg buy $505
	• SCHD — 8 shares — avg buy $78
B. Price lookup
Website bisa jawab:
	• harga sekarang
	• harga penutupan terakhir
	• harga pada tanggal tertentu
	• change harian
	• unrealized gain/loss
C. Historical comparison
Contoh:
	• nilai portfolio pada 1 Jan 2026
	• nilai portfolio hari ini
	• performance YTD
	• return per instrument

2. Anda tidak perlu ambil data untuk semua saham
Karena ticker Anda fixed:
	• VOO
	• VTI
	• QQQ
	• SPY
	• SCHD
	• VIG
maka sistem bisa dibuat jauh lebih stabil dengan cara:
	• hardcode whitelist ticker
	• tidak perlu search bebas
	• tidak perlu symbol resolver
	• tidak perlu validasi pasar yang kompleks
Benefit
	• lebih cepat
	• lebih aman
	• lebih sedikit bug
	• lebih mudah maintain

3. Arsitektur sederhana yang saya sarankan
Frontend
Halaman:
	• Dashboard
	• Holdings
	• Transactions
	• Performance
	• Settings
Backend
API internal:
	• /api/prices/current
	• /api/prices/history
	• /api/portfolio/summary
	• /api/transactions
	• /api/holdings
Database
Tabel utama:
	• assets
	• transactions
	• daily_prices
	• portfolio_snapshots

4. Data model yang saya sarankan
Table assets
Isi hanya 6 ETF Anda:
	• id
	• symbol
	• name
	• currency
	• exchange
	• enabled
Contoh:
	• VOO
	• VTI
	• QQQ
	• SPY
	• SCHD
	• VIG

Table transactions
Simpan pembelian/penjualan Anda:
	• id
	• symbol
	• transaction_date
	• type (BUY / SELL)
	• quantity
	• price_per_share
	• fees
	• notes
Dengan ini Anda bisa hitung:
	• total shares
	• cost basis
	• average price
	• realized gain/loss

Table daily_prices
Cache historical prices:
	• id
	• symbol
	• requested_date
	• trading_date
	• open
	• high
	• low
	• close
	• adj_close
	• volume
	• source
	• fetched_at
Ini penting supaya website Anda tidak fetch terus ke Yahoo setiap kali halaman dibuka.

Table portfolio_snapshots
Untuk simpan nilai portfolio harian:
	• id
	• snapshot_date
	• total_market_value
	• total_cost_basis
	• total_unrealized_pl
	• total_return_pct
Ini membuat dashboard sangat cepat.

5. Flow yang paling efisien
Saat website dibuka
	1. Ambil holdings Anda
	2. Cek harga latest di cache
	3. Kalau cache masih fresh, pakai cache
	4. Kalau tidak fresh, refresh dari source publik
	5. Hitung total nilai portfolio

Saat Anda input transaksi baru
	1. Simpan transaksi
	2. Recalculate holdings
	3. Update average cost
	4. Refresh current valuation

Saat Anda minta “harga per tanggal”
	1. Cek dulu daily_prices
	2. Kalau belum ada, fetch historical dari Yahoo
	3. Simpan ke DB
	4. Return hasil

6. Kenapa cache wajib, walaupun cuma 6 ticker
Karena source gratis/unofficial bisa berubah atau kena limit. Repo yahoo-finance2 sendiri menegaskan Yahoo tidak menyediakan API resmi dan tidak menjamin konsistensi layanan, dan ada issue baru akhir 2025 tentang kegagalan/limit akses pada sebagian pengguna. (GitHub)
Jadi best practice untuk tracker pribadi:
Jangan:
	• fetch live ke Yahoo tiap render halaman
	• bergantung 100% pada request real-time
Lakukan:
	• cache latest quote 5–15 menit
	• cache historical per tanggal permanen
	• simpan snapshot portfolio harian

7. Definisi “nilai investasi” yang harus Anda tetapkan
Untuk tracker pribadi, saya sarankan tampilkan 4 angka utama:
Per ETF
	• Quantity
	• Average Cost
	• Current Price
	• Market Value
	• Unrealized P/L
	• Return %
Portfolio total
	• Total Cost Basis
	• Total Market Value
	• Total Unrealized Gain/Loss
	• Allocation %
	• Performance vs previous close

8. Anda perlu putuskan: pakai close, last price, atau adj close?
Untuk ETF tracker personal, saya sarankan:
Default dashboard
	• gunakan current market price jika market open / ada quote terbaru
Untuk historical date
	• gunakan close
	• optionally tampilkan juga adj close
Kenapa adj close berguna:
	• lebih baik untuk analisis return historis
	• menyesuaikan event korporasi seperti distribusi/adjustment
Tetapi untuk user-facing dashboard personal, biasanya:
	• current value → latest price
	• historical comparison → close / adj close

9. Karena semua aset Anda ETF US, timezone jadi lebih mudah
Semua ticker Anda adalah ETF AS, jadi Anda bisa sederhanakan:
	• gunakan US market trading date untuk data harga
	• tampilkan timezone clearly di UI
	• jangan campur dengan timezone browser user untuk perhitungan trading session
Contoh di dashboard:
	• “Last updated based on U.S. market data”

10. Versi paling sederhana yang cukup untuk Anda
Kalau mau benar-benar lean, build hanya ini:
Halaman 1 — Portfolio Dashboard
Menampilkan:
	• total invested
	• total market value
	• total profit/loss
	• daftar keenam ETF
	• allocation pie/bar
	• daily change
Halaman 2 — Transactions
Tambah/edit:
	• date
	• symbol
	• qty
	• buy price
	• fee
Halaman 3 — Historical Lookup
Input:
	• symbol
	• date
Output:
	• OHLCV
	• trading date used
	• source
Itu saja sebenarnya sudah cukup kuat untuk kebutuhan pribadi.

11. Fitur yang saya sarankan untuk tahap 2
Setelah basic jalan, baru tambahkan:
	• dividend tracking
	• monthly contribution tracking
	• benchmark comparison
	• XIRR / money-weighted return
	• time-weighted return
	• rebalancing view
	• target allocation alert
Karena aset Anda ETF semua, fitur-fitur ini lebih berguna daripada menambah ratusan ticker.

12. Plan implementasi yang lebih komprehensif
Phase 1 — Core tracker
Bangun:
	• hardcoded 6 ETF
	• transaksi beli/jual
	• current price fetch
	• market value
	• unrealized P/L
Phase 2 — Historical engine
Bangun:
	• lookup harga per tanggal
	• cache daily historical prices
	• compare performance antar tanggal
Phase 3 — Portfolio analytics
Bangun:
	• allocation %
	• contribution by asset
	• portfolio return
	• gain/loss history
Phase 4 — Automation
Bangun:
	• daily snapshot
	• scheduled refresh
	• periodic backfill
Phase 5 — Advanced personal finance
Bangun:
	• dividend income log
	• DCA tracker
	• target asset allocation
	• rebalance suggestion

13. Rekomendasi struktur folder
Kalau pakai Next.js:
/src
  /app
    /dashboard
    /transactions
    /history
    /settings
    /api
      /prices
      /portfolio
      /transactions
  /lib
    yahoo.ts
    db.ts
    portfolio.ts
    pricing.ts
    cache.ts
  /components
    PortfolioTable.tsx
    HoldingsCard.tsx
    TransactionForm.tsx
    PerformanceChart.tsx
  /types
    portfolio.ts
    market.ts

14. Strategi source data terbaik untuk Anda
Primary
yahoo-finance2
Kenapa:
	• cocok untuk Next.js/Node
	• aktif
	• paling praktis untuk ETF AS
	• komunitasnya hidup (GitHub)
Secondary
Boleh tambahkan fallback nanti, tetapi untuk 6 ETF ini saya rasa tidak perlu di awal.
Karena untuk personal portfolio tracker, kompleksitas fallback kadang tidak sebanding dengan manfaatnya.

15. Risiko yang harus Anda pahami dari awal
Risiko 1 — Source unofficial
Yahoo route praktis, tapi bukan feed resmi. yahoo-finance2 sendiri menulis bahwa Yahoo tidak menyediakan official API dan tidak menjamin availability/consistency. (GitHub)
Risiko 2 — Rate limit / intermittent failure
Ada issue baru yang menunjukkan sebagian user mengalami masalah akses/crumb/rate limit. (GitHub)
Risiko 3 — Data mismatch minor
Kadang ada beda kecil antar source gratis.
Untuk tracker pribadi, ini biasanya masih acceptable selama:
	• Anda cache
	• Anda pakai source yang konsisten
	• Anda tidak mengklaim exchange-grade official accuracy

16. Saran paling praktis untuk Anda
Karena ini hanya untuk:
	• VOO
	• VTI
	• QQQ
	• SPY
	• SCHD
	• VIG
maka saya sarankan jangan overengineer.
Pilihan terbaik:
Build personal ETF tracker
dengan fitur:
	• manual transaction entry
	• automatic quote update
	• historical price by date
	• total P/L dashboard
	• daily snapshots
Dan jangan dulu buat:
	• stock screener
	• symbol search universal
	• multi-country support
	• public API
	• real-time streaming quotes

17. Final recommendation
Untuk case Anda, blueprint final saya:
Stack
	• Next.js
	• TypeScript
	• SQLite dulu
	• yahoo-finance2
	• Vercel atau VPS kecil
Design principle
	• whitelist 6 ticker
	• cache everything
	• store all transactions
	• compute portfolio locally
	• use latest quote for current value
	• use close price for historical date lookup
Output utama
	• dashboard total portfolio
	• per-ETF valuation
	• historical comparison
	• portfolio snapshots

18. Kesimpulan tegas
Karena aset Anda hanya 6 ETF US, sistemnya bisa dibuat:
	• lebih sederhana
	• lebih stabil
	• lebih murah
	• lebih cepat selesai

Baik. Saya upgrade grand plan-nya menjadi master blueprint yang lebih matang, lebih strategis, dan lebih siap dibangun nyata.
Saya akan anggap constraint final Anda adalah:
	• hanya untuk personal investment tracker
	• aset hanya:
		○ VOO
		○ VTI
		○ QQQ
		○ SPY
		○ SCHD
		○ VIG
	• local database only
	• tidak pakai API berbayar
	• source harga eksternal hanya sebagai data ingestion layer
	• sistem harus tetap berguna walaupun source eksternal gagal sementara
	• target utamanya adalah akurasi praktis, auditability, maintainability, dan longevity
Di bawah ini adalah versi grand plan yang sudah ditingkatkan.

GRAND PLAN — Personal ETF Investment Tracker
1. Vision sistem
Sistem ini bukan sekadar “website lihat harga ETF”.
Sistem ini harus menjadi:
local-first personal investment operating system
untuk memonitor, merekam, memverifikasi, dan menganalisis investasi Anda di 6 ETF inti.
Outcome utama
Sistem harus bisa menjawab dengan jelas dan konsisten:
	• berapa total uang yang sudah saya invest?
	• berapa jumlah unit saya saat ini?
	• berapa average cost saya?
	• berapa nilai portofolio saya saat ini?
	• berapa unrealized gain/loss saya?
	• berapa nilai portofolio saya pada tanggal tertentu?
	• bagaimana performa tiap ETF dari waktu ke waktu?
	• data harga mana yang dipakai, dari tanggal berapa, dan kapan terakhir di-refresh?

2. Strategic design philosophy
2.1 Local-first, not source-first
Semua tampilan dan perhitungan harus berbasis database lokal.
Source eksternal bukan pusat sistem.
Source eksternal hanyalah:
	• pengisi data harga
	• pelengkap data historis
	• penyegar quote
Artinya:
	• transaksi = lokal
	• holdings = hasil kalkulasi lokal
	• valuation = lokal
	• snapshots = lokal
	• audit trail = lokal
Kalau source harga gagal, sistem tetap harus:
	• bisa dibuka
	• bisa menunjukkan status terakhir
	• bisa menghitung holdings
	• bisa menampilkan snapshot sebelumnya
	• hanya menandai bahwa data harga belum fresh

2.2 Portfolio ledger over market feed
Prioritas utama sistem ini bukan kecepatan quote, tetapi ketepatan ledger investasi.
Artinya:
	• fondasi utama adalah transaksi
	• harga pasar hanya dipakai untuk valuation
	• jangan membiarkan UI “terlihat benar” tetapi tidak bisa diaudit balik ke transaksi
Jadi grand plan harus memposisikan:
Transaction ledger > Holdings engine > Pricing engine > Snapshot engine > Dashboard

2.3 Reliability over overengineering
Karena scope hanya 6 ETF, sistem harus:
	• kuat
	• jelas
	• mudah dirawat
	• tidak dibuat terlalu abstrak
Kita tidak butuh:
	• multi-user tenancy
	• universal stock search
	• high-frequency trading logic
	• websocket streaming
	• cloud-native microservices
Tetapi kita tetap butuh:
	• data integrity
	• deterministic calculations
	• audit logs
	• graceful degradation
	• backup and recovery

3. Final system mission statement
Saya sarankan mission statement internal sistem ini seperti:
	A local-first personal ETF tracker that maintains a complete investment ledger, price cache, and historical portfolio record, with clear traceability between transactions, holdings, market data, and valuation outputs.
Kalau dari awal mindset-nya ini, keputusan desain akan lebih konsisten.

4. Core product pillars
Grand plan ini harus dibangun di atas 5 pilar.
Pillar 1 — Investment Ledger
Semua transaksi beli/jual dicatat rapi, immutable-ish, auditable.
Pillar 2 — Holdings Truth Engine
Jumlah unit, average cost, cost basis, dan allocation dihitung secara konsisten dari ledger.
Pillar 3 — Market Data Cache Engine
Harga terbaru dan harga historis disimpan lokal dan dipakai ulang, bukan di-fetch terus.
Pillar 4 — Valuation & Snapshot Engine
Portofolio bisa dinilai pada saat ini maupun pada tanggal historis tertentu.
Pillar 5 — Operations & Recovery Layer
Ada logging, sync history, stale warning, backup, dan rebuild tools.

5. Scope boundaries
Agar sistem tetap disiplin, grand plan harus jelas apa yang masuk dan apa yang tidak masuk.
5.1 In scope
	• 6 ETF fixed
	• buy/sell transaction logging
	• current holdings
	• average cost / cost basis
	• current valuation
	• historical price lookup
	• historical portfolio valuation
	• snapshot harian
	• local DB
	• manual and scheduled sync
	• stale data handling
	• backup / restore local DB
5.2 Out of scope for v1
	• options
	• margin
	• short selling
	• multi-currency portfolio analytics kompleks
	• broker integration otomatis
	• dividend tax engine detail
	• public API
	• real-time streaming quotes
	• mobile sync
	• multi-device replication

6. User journeys the system must support
Grand plan yang baik harus dimulai dari user journey.
Journey A — Add investment transaction
User menambahkan transaksi BUY atau SELL, lalu sistem:
	• simpan transaksi
	• validasi symbol
	• validasi quantity
	• validasi sell tidak melebihi holding jika policy melarang
	• update holdings
	• update dashboard summary
	• tandai snapshot perlu direfresh
Journey B — Open dashboard
Saat dashboard dibuka:
	• baca holdings dari DB
	• baca latest quotes dari DB
	• kalau quote masih fresh, pakai
	• kalau quote stale dan internet tersedia, coba refresh
	• tampilkan market value dan P/L
	• jika refresh gagal, tampilkan cached value + stale indicator
Journey C — Ask historical value on date X
Saat user pilih tanggal:
	• cek daily_prices lokal
	• kalau ada, pakai
	• kalau belum ada, fetch source
	• normalize requested date vs trading date
	• simpan
	• hitung nilai tiap ETF pada tanggal itu
	• hitung total portfolio value pada tanggal itu
Journey D — Rebuild from scratch
Jika ada data issue:
	• sistem bisa rebuild holdings dari transactions
	• sistem bisa regenerate snapshots
	• sistem bisa re-fetch missing prices
	• tanpa merusak transaction ledger
Journey E — Offline usage
Kalau internet mati:
	• holdings tetap bisa dilihat
	• snapshot history tetap bisa dilihat
	• last known prices tetap bisa dipakai
	• UI memberi tahu data belum fresh

7. Operating model
Saya sarankan sistem ini punya 3 lapisan operasi.
7.1 Transactional layer
Berisi:
	• assets
	• transactions
	• optional lots
Ini layer paling sakral.
Jangan ada proses harga yang boleh merusak ledger transaksi.
7.2 Market data layer
Berisi:
	• latest quotes
	• daily prices
	• market calendar
	• sync logs
Ini layer yang boleh berubah terus, tetapi harus terdokumentasi.
7.3 Analytical layer
Berisi:
	• holdings summaries
	• portfolio snapshots
	• performance outputs
Ini adalah layer hasil olahan, dan harus bisa di-rebuild dari layer di bawahnya.

8. Data architecture maturity model
Grand plan terbaik bukan hanya tabel, tetapi urutan kedewasaan data.
Level 1 — Ledger maturity
Pastikan transaksi kuat dulu.
Level 2 — Price cache maturity
Pastikan harga tersimpan lokal dengan benar.
Level 3 — Valuation maturity
Pastikan perhitungan market value dan P/L benar.
Level 4 — Historical maturity
Pastikan nilai historis bisa dihitung.
Level 5 — Operational maturity
Pastikan ada logging, stale handling, backup, rebuild.
Jangan lompat ke analytics canggih sebelum 1–3 matang.

9. Grand architecture
9.1 Logical architecture
Sistem terdiri dari:
UI layer
	• dashboard
	• holdings
	• transactions
	• history
	• performance
	• system tools
Application services
	• transaction service
	• holdings service
	• pricing service
	• snapshot service
	• sync service
	• backup service
Data layer
	• SQLite local DB
External ingestion
	• Yahoo unofficial connector

9.2 Rule utama
UI tidak pernah bicara langsung ke Yahoo.
Semua lewat application services dan semua hasil masuk DB dulu.
Ini rule yang harus tidak boleh dilanggar.

10. Source of truth hierarchy
Ini sangat penting.
Hierarchy
1. Transactions
Sumber kebenaran untuk posisi investasi.
2. Assets master
Sumber kebenaran untuk allowed symbols.
3. Latest quotes / daily prices
Sumber kebenaran untuk market pricing lokal.
4. Snapshots
Sumber kebenaran untuk point-in-time analytical views.
Kalau ada konflik:
	• transactions menang atas holdings cache
	• daily_prices menang atas UI temporary response
	• snapshot bisa direbuild, jadi snapshot bukan sacred source

11. Database strategy refinement
11.1 Local DB philosophy
Database lokal bukan “sementara”.
Database lokal adalah permanent portfolio ledger.
Maka desain harus mendukung:
	• tahan lama
	• mudah dibackup
	• mudah dipindah
	• mudah dipulihkan
	• bisa diperiksa manual bila perlu
11.2 SQLite role split
Saya sarankan conceptual split seperti ini walau tetap satu file DB:
Core ledger data
	• assets
	• transactions
	• holdings_lots optional
Market data cache
	• latest_quotes
	• daily_prices
	• market_calendar
Analytics
	• portfolio_snapshots
	• portfolio_snapshot_items
Operations
	• sync_jobs
	• sync_job_items
	• app_settings

12. Calculation doctrine
Salah satu bagian terpenting dari grand plan adalah doktrin kalkulasi.
12.1 Holdings doctrine
Holdings harus selalu bisa dihitung ulang dari transactions.
Jangan bergantung pada angka holdings yang ditulis manual.
12.2 Cost basis doctrine
Untuk v1, gunakan weighted average cost sebagai angka utama dashboard.
Kenapa:
	• sederhana
	• cukup akurat untuk personal tracking
	• cepat dihitung
	• stabil
Tetapi struktur sistem harus siap ditingkatkan ke FIFO jika dibutuhkan nanti.
12.3 Valuation doctrine
Pisahkan jelas:
	• current valuation
	• historical valuation
Current valuation
Pakai latest quote cache.
Historical valuation
Pakai daily close price.
12.4 Price-date doctrine
Selalu simpan:
	• requested date
	• actual trading date used
Karena ini yang membuat hasil historis bisa dipercaya.

13. Temporal strategy
Time logic sering menjadi sumber bug.
Grand plan harus tegas di sini.
13.1 Date categories
Gunakan tiga kategori:
Trade dates
Tanggal transaksi investasi.
Market dates
Tanggal sesi perdagangan ETF.
System timestamps
Waktu event teknis seperti sync, create, update.
13.2 Rule
Jangan campur:
	• trade_date
	• trading_date
	• fetched_at
Masing-masing harus punya arti yang jelas.
13.3 Portfolio valuation on weekends/holidays
Kalau user minta tanggal non-trading day:
	• sistem tidak boleh pura-pura ada harga hari itu
	• sistem harus transparan bahwa yang dipakai adalah previous trading date

14. Sync philosophy
Grand plan sinkronisasi tidak boleh naïf.
14.1 Sync is enrichment, not dependence
Sync harga adalah pengayaan data, bukan prasyarat sistem bisa hidup.
14.2 Sync modes
Harus ada 3 mode:
Manual sync
User klik refresh.
Opportunistic sync
Saat dashboard dibuka dan cache stale.
Scheduled sync
Job harian atau berkala.
14.3 Sync result categories
Setiap sync item harus berakhir sebagai:
	• success
	• partial success
	• failed
	• reused stale data
	• no data

15. Staleness model
Ini bagian yang sangat penting untuk kejujuran sistem.
15.1 Data freshness classes
Saya sarankan definisikan:
Fresh
Data quote baru dan masih dalam TTL.
Acceptable stale
Data quote agak lama tapi masih layak ditampilkan.
Expired stale
Data terlalu lama; tetap tampilkan tetapi dengan warning lebih tegas.
Missing
Tidak ada data sama sekali.
15.2 UI behavior
Jangan hanya tampilkan angka.
Tampilkan juga kualitas data:
	• updated 8 min ago
	• stale since yesterday
	• price unavailable

16. Historical pricing strategy refinement
16.1 Historical data is permanent cache
Setelah harga historis per tanggal didapat, simpan permanen.
Jangan fetch ulang tanpa alasan kuat.
16.2 Duplicate avoidance
Per asset_id + requested_date, hanya boleh satu logical answer aktif.
16.3 Historical valuation trust rule
Kalau user minta nilai portfolio tanggal lama, sistem sebaiknya:
	• pakai daily_prices yang sudah tersimpan
	• baru fetch jika missing
	• jangan fetch seluruh history tanpa perlu

17. Snapshot doctrine
Snapshot bukan sekadar performance chart.
Snapshot adalah frozen valuation record.
17.1 Purpose of snapshot
	• mempercepat dashboard
	• menyimpan state historis portofolio
	• memudahkan chart
	• memudahkan audit perubahan nilai
17.2 Snapshot types
End-of-day snapshot
Yang paling penting.
On-demand snapshot
Untuk rebuild atau validasi.
17.3 Snapshot integrity
Snapshot harus menyimpan:
	• quantity per asset
	• avg cost
	• price used
	• price date used
	• market value
	• unrealized P/L
	• allocation
Jadi snapshot tidak hanya total summary.

18. Recovery and rebuild strategy
Grand plan yang matang harus siap untuk skenario buruk.
18.1 Rebuildable components
Harus bisa direbuild:
	• holdings summary
	• portfolio snapshots
	• asset performance view
18.2 Non-rebuildable sacred data
Harus dilindungi:
	• transactions
	• assets master
	• sync logs penting
	• manually entered metadata
18.3 Recovery modes
Soft recovery
Rebuild holdings and snapshots from existing DB.
Hard recovery
Restore DB from backup.
Hybrid recovery
Restore DB lalu refresh prices terbaru.

19. Quality assurance strategy
Sistem kecil pun perlu QA doctrine.
19.1 Test categories
Ledger tests
	• BUY adds quantity
	• SELL reduces quantity
	• cannot oversell if disallowed
Cost basis tests
	• weighted average updates correctly
Pricing tests
	• quote refresh updates latest_quotes
	• historical lookup stores requested/trading date correctly
Valuation tests
	• current market value matches quantity × price
	• historical portfolio value matches per-asset sum
Recovery tests
	• rebuild snapshots does not alter transactions

20. UI information hierarchy
Grand plan UI harus memprioritaskan apa yang paling penting.
20.1 Dashboard priority
	1. total market value
	2. total cost basis
	3. unrealized gain/loss
	4. total return %
	5. data freshness
	6. per-ETF breakdown
20.2 Holdings page priority
	1. symbol
	2. units held
	3. average cost
	4. current price
	5. market value
	6. unrealized P/L
	7. allocation
20.3 Historical page priority
	1. requested date
	2. trading date used
	3. price used
	4. source
	5. fetched time
	6. resulting historical valuation
20.4 System page priority
	1. last sync
	2. failed sync items
	3. database status
	4. last backup
	5. rebuild actions

21. Governance rules
A small personal system still needs governance.
21.1 No silent overwrite
Kalau data harga diganti, update timestamp dan log harus berubah.
21.2 No hidden assumptions
Kalau market tutup, UI harus bilang market tutup.
21.3 No direct destructive delete
Transactions jangan hilang diam-diam.
21.4 Every derived value must be explainable
Setiap angka dashboard harus bisa ditelusuri ke:
	• transactions
	• prices
	• calculation rule

22. Growth roadmap without losing discipline
Walaupun v1 sederhana, grand plan harus siap untuk pertumbuhan sehat.
Phase 1 — Foundation
	• assets
	• transactions
	• latest quotes
	• dashboard current valuation
Phase 2 — Historical intelligence
	• daily prices
	• historical lookup
	• historical valuation
Phase 3 — Analytical maturity
	• snapshots
	• portfolio history
	• allocation trend
	• return trend
Phase 4 — Operational maturity
	• sync logs
	• stale indicators
	• backup tools
	• rebuild tools
Phase 5 — Advanced investment features
	• dividends
	• contributions tracking
	• benchmark view
	• rebalancing guidance
	• FIFO lots optional

23. Recommended operational cadence
Agar sistem terasa hidup tapi tidak boros:
Daily
	• refresh latest quotes
	• generate EOD snapshot
On demand
	• refresh latest quotes on dashboard open if stale
	• fetch historical date when requested
Weekly
	• DB backup validation
	• quick integrity check
Monthly
	• optional full snapshot rebuild verification
	• cleanup orphan/missing states if any

24. Architectural anti-patterns to avoid
Grand plan harus jelas soal apa yang tidak boleh dilakukan.
Jangan lakukan ini:
	• frontend query source harga langsung
	• menghitung holdings dari cached table tanpa bisa rebuild dari transactions
	• mencampur latest quote dan daily historical ke satu semantic field yang ambigu
	• hard delete transaction tanpa jejak
	• overwrite historical price tanpa update metadata
	• mengasumsikan weekend punya harga sendiri
	• mengabaikan stale state
	• menyimpan semua logic di UI layer

25. Final improved grand plan summary
Strategic summary
Bangun sistem sebagai local-first portfolio ledger and valuation engine, bukan sekadar website harga ETF.
Core structure
	• Transactions sebagai fondasi sakral
	• SQLite local DB sebagai source of truth
	• Latest quotes + daily prices sebagai local market data cache
	• Snapshots sebagai historical valuation layer
	• Sync logs + backup + rebuild tools sebagai operational backbone
Calculation doctrine
	• holdings dari transactions
	• weighted average cost untuk v1
	• current value dari latest quote
	• historical value dari daily close
	• requested date dan trading date harus dipisah
Reliability doctrine
	• source eksternal boleh gagal, sistem tetap berguna
	• stale data harus jujur ditandai
	• semua angka harus dapat diaudit
Delivery doctrine
Bangun bertahap:
	1. ledger
	2. pricing cache
	3. valuation
	4. snapshots
	5. operations/recovery

Tahap paling tepat berikutnya adalah ubah grand plan ini menjadi Master Technical Design Document yang sangat detail, dengan struktur seperti:
	• system context
	• component design
	• full database schema
	• service responsibilities
	• data flow per scenario
	• edge case matrix
	• rebuild logic
	• backup/recovery logic
	• implementation phases
	• acceptance criteria per module.
