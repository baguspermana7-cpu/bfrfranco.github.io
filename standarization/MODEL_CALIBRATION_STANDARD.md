# MODEL CALIBRATION STANDARD — engine constants vs the real world

> Arc-1, 2026-07-20. Single source: `rz-engine.js DATA.calibrationSpec`
> (blok `@@CALIB_START`, setelah `@@CORPUS_END`). Dua konsumen, SATU semantik:
> 1. **Ship gate** `tools/test-model-calibration.mjs` (severity `fail` = exit 1)
> 2. **DCMOC UI** — section "Model Calibration — engine vs dunia nyata" di
>    Industry Benchmarks (`dcmoc/src/lib/calibration.ts` +
>    `BenchmarkDashboard.tsx`), verdict chips + trace nodes `calib.*`.

---

## 1. Metodologi

- **Band mereferensikan persentil korpus LIVE** (`DATA.benchmarksCorpus`,
  distribusi p10–p90 per metric × segment, setiap fakta ber-`source_url` +
  kutipan verbatim). Band TIDAK PERNAH berupa angka beku — regen korpus
  otomatis menggeser band.
- **Interpolasi persentil**: piecewise-linear antar titik p10/p25/p50/p75/p90,
  clamp [10, 90]. SATU algoritma — `pctileOf` di `dcmoc/src/lib/calibration.ts`
  (dipakai UI korpus + kalibrasi) dan port identiknya di gate.
- **Scope jujur — validasi AGREGAT saja.** Fakta korpus tidak disimpan sebagai
  pasangan per dokumen (mis. investment & capacity dari dokumen berbeda), maka
  kalibrasi per-proyek TIDAK feasible dan tidak diklaim.
- **Severity dua tier**: `fail` = drift memblok ship (gate exit 1);
  `warn` = dilaporkan tapi tidak pernah memblok (kejujuran n-kecil).
- **Verdict UI**: semua check lolos → `in-band` (tier fail) / `indicative`
  (tier warn); ada check gagal → `drift` (chip rose). Identik dengan semantik
  gate: fail-tier drift = gate merah, warn-tier drift = warn tercetak.

## 2. Empat mapping + band + justifikasi

| id | severity | engine ↔ corpus | rule & band | justifikasi band |
|---|---|---|---|---|
| `pue.design.vs.fleet` | fail | `DATA.pueMatrix` (design-basis Uptime 2026) ↔ `pue` | Tiap cooling-class tier3 ∈ [p10 pooled hyperscale∪research, p90 pooled ∪spec]; **sharp rule**: best design (liquid tier4) ≤ MEDIAN fleet hyperscale | Design-basis vs fleet-trailing: gap 5–15% EXPECTED (design margin) → band = guard distribusi fleet, bukan klaim akurasi titik. Screening design tidak boleh mengalahkan median fleet best-in-class. |
| `capex.aggregate.ratio` | fail | `DATA.capexPerMw.liquidCooledTier3` (raw-build T&T/JLL/C&W 2026) ↔ `investment_busd` / `capacity_mw` | corpus p50($/MW total-project) ÷ engine raw-build $/MW ∈ [1.0, 4.0] per segment (finance/pm), n≥5 | Total project = land + IT + contingency + build ≈ 1–4× raw build. AACE Class-4 ±30% hanya catatan basis estimasi engine, BUKAN kriteria. |
| `wue.binned` | warn | `DATA.waterFootprint.wueBase` (ASHRAE screening) ↔ `wue` | High-bin: evaporative ∈ [p50, p90] research; low-bin: aircooled/dlc/immersion ≤ p25 | n kecil → indicative only; binned high(>1.0)/low(<0.2 L/kWh) = order-of-magnitude sanity, bukan kalibrasi per tipe. Iklim tidak terstratifikasi. |
| `energy.capacity.coherence` | warn | implied CF = `energy_gwh` ÷ (`capacity_mw` × 8.76) | CF tersirat per segment (research) ∈ (2%, 100%] | Downgrade jujur dari rencana "fleet-PUE inference": tanpa energi IT per dokumen, PUE tidak dapat diinferensikan sahih. Disclosure mencampur pipeline vs operasi — CF rendah wajar. |

Baseline lolos saat penetapan (2026-07-20, gate 19/0):
liquid t3 1.15 ≈ p69 fleet hyperscale (n=30) · air t3 1.5 ≈ p81 ·
best liquid t4 1.10 ≤ p50 fleet 1.12 · capex ratio finance
$20.7M/MW ÷ $13.0M/MW = 1.59, pm 1.10 · WUE bins OK · CF research 8.6%.
(Angka INI informasional — band yang mengikat adalah persentil live.)

## 3. Kebijakan drift (owner policy)

**Regen korpus dapat menggeser verdict — temuan DILAPORKAN, band tidak
dilonggarkan.** Saat gate merah setelah regen korpus atau perubahan konstanta:
1. JANGAN edit band/rule agar hijau ("silently loosening" = pelanggaran).
2. Investigasi: konstanta engine usang? korpus berubah komposisi? bug ekstraksi?
3. Laporkan temuan di CHANGELOG (+ owner bila konstanta engine perlu refresh
   bersumber). Perubahan band HANYA via revisi spec yang terdokumentasi di sini
   dengan justifikasi baru.

## 4. Tidak dapat dikalibrasi (notMappable — dinyatakan eksplisit)

- `renewable_share` — scope beda: corpus campur PPA off-site vs on-site; engine screening on-site only.
- `staffing` — tidak ada fakta korpus FTE/labor cost.
- `availability/uptime` — tidak ada fakta empiris downtime; `tierAvailability` = definisi standar Uptime, bukan pengukuran.
- `capex per-project` — fakta investment & MW tidak berpasangan per dokumen — hanya validasi agregat yang jujur.

## 5. Definition of Done

Setiap perubahan pada konstanta engine yang tercakup mapping
(`DATA.pueMatrix`, `DATA.capexPerMw`, `DATA.waterFootprint.wueBase`),
pada `DATA.calibrationSpec`, atau regen korpus (`@@CORPUS` block) **WAJIB**:
- [ ] `node tools/test-model-calibration.mjs` → ALL GREEN (fail-tier 0)
- [ ] Warn-tier yang berubah status dicatat (CHANGELOG) — tidak memblok
- [ ] Auto-link chain standar tetap jalan (`build-engine-catalog.mjs` →
      `test-value-bindings.mjs`) — spec ber-`DATA.sources` entry
- [ ] UI DCMOC tidak di-hardcode: section Model Calibration membaca
      `calibrationSpec` live — TIDAK ada angka band ditulis di komponen
