/* PLN Java-Bali — Jawa Tengah + DIY 20 kV DC-feeder overlay v2026-04-30
 * Source: public DC operator filings (Telkomsigma, Lintasarta, PLN Icon+, Edge),
 *   DCD APAC pipeline 2024, Cushman & Wakefield Indonesia DC Reports 2023/2024,
 *   Wikipedia infoboxes for plant geocoding, OSM Nominatim for industrial estate
 *   centroids (Tegal, Pekalongan, Solo, Klaten, Wonogiri, Cilacap, Kendal),
 *   PLN UID Jateng-DIY tariff filings.
 * Coverage: feeders connecting to known DC operators or major industrial intakes
 *   across Jawa Tengah province + Daerah Istimewa Yogyakarta. Jateng has modest
 *   DC presence — primarily Telkom NeuCentriX edge sites + a few Lintasarta /
 *   Biznet / Edge facilities in Semarang and Yogyakarta. The bulk of the load
 *   on this overlay is industrial (textile, cement, refinery captive offtake).
 * NOT a full distribution map — curated for visualization only. ~17 nodes, ~14 edges.
 *
 * Confidence:
 *   high   - operator press release / regulatory filing with explicit address
 *   medium - operator website lists area, geocoded to estate
 *   low    - inferred from peering/sales material, placed at city/estate centroid
 *
 * feed_from references substation IDs in /js/pln-java-grid-data.js. Where a 150 kV
 * intermediate is needed but not present in the base file, it is injected here with
 * `injected: true`.
 */
window.PLN_JAVA_GRID_JATENG = {
  version: '2026-04-30',
  province: 'jateng',

  // ============================================================
  // NODES
  // ============================================================
  nodes: [
    // -------- INJECTED 150 kV INTERMEDIATES (not in base data) --------
    // Semarang Timur GI 150 kV — anchors Semarang DC + Kawasan Industri Wijayakusuma load.
    // Loop-fed from GITET Ungaran 500/150.
    { id: 'semarang_timur_150', name: 'GI Semarang Timur', kind: 'station', voltage: 150, mva: 300, year: 2002,
      prov: 'jateng', lat: -6.9700, lng: 110.4500, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: anchors Semarang DC cluster + Tambak Lorok evacuation; fed from GITET Ungaran.' },

    // Solo / Surakarta GI 150 kV — anchors Sukoharjo / Klaten industrial corridor.
    { id: 'solo_150', name: 'GI Solo (Surakarta)', kind: 'station', voltage: 150, mva: 250, year: 2000,
      prov: 'jateng', lat: -7.5660, lng: 110.8290, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: Solo metro + Sukoharjo industrial; fed from GITET Boyolali 500/150.' },

    // Yogyakarta GI 150 kV — DIY metro distribution anchor.
    { id: 'yogyakarta_150', name: 'GI Yogyakarta', kind: 'station', voltage: 150, mva: 250, year: 1998,
      prov: 'jateng', lat: -7.7950, lng: 110.3690, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: DIY metro + Sleman/Bantul edge load; fed from GITET Pedan via Klaten.' },

    // Kendal Industrial GI 150 kV — Kawasan Industri Kendal (KIK) feeder root.
    { id: 'kendal_industrial_150', name: 'GI Kendal Industrial', kind: 'station', voltage: 150, mva: 300, year: 2018,
      prov: 'jateng', lat: -6.9200, lng: 110.2050, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: Kawasan Industri Kendal (KIK) Sembcorp JV; fed from GITET Ungaran via Weleri.' },

    // -------- 20 kV DC FEEDER ENDPOINTS — SEMARANG --------
    // Telkomsigma Semarang (NeuCentriX edge) — Telkom legacy carrier hotel near Pandanaran.
    { id: 'telkomsigma_semarang', name: 'Telkomsigma Semarang', kind: 'dc', operator: 'Telkomsigma', mw: 4,
      voltage: 20, capacity_kVA: 5000, year: 2014, prov: 'jateng',
      lat: -6.9890, lng: 110.4200, confidence: 'medium',
      feed_from: 'semarang_timur_150',
      notes: 'Telkom carrier hotel Semarang; ~4 MW IT load, address approximated to Telkom Pandanaran.' },

    // NeuCentriX Semarang (Telkom edge node).
    { id: 'neucentrix_semarang', name: 'NeuCentriX Semarang', kind: 'dc', operator: 'NeuCentriX (Telkom)', mw: 2,
      voltage: 20, capacity_kVA: 2500, year: 2020, prov: 'jateng',
      lat: -6.9920, lng: 110.4220, confidence: 'medium',
      feed_from: 'semarang_timur_150',
      notes: 'Telkom edge connectivity hub Semarang; co-located with Telkomsigma.' },

    // Lintasarta Semarang.
    { id: 'lintasarta_semarang', name: 'Lintasarta Semarang', kind: 'dc', operator: 'Lintasarta', mw: 2,
      voltage: 20, capacity_kVA: 2500, year: 2017, prov: 'jateng',
      lat: -6.9870, lng: 110.4180, confidence: 'low',
      feed_from: 'semarang_timur_150',
      notes: 'Lintasarta regional edge; address approximated to Semarang centroid.' },

    // -------- 20 kV — YOGYAKARTA / DIY --------
    // PLN Icon+ Yogyakarta (PLN's ICT subsidiary edge node).
    { id: 'iconplus_yogyakarta', name: 'PLN Icon+ Yogyakarta', kind: 'dc', operator: 'PLN Icon+', mw: 3,
      voltage: 20, capacity_kVA: 4000, year: 2019, prov: 'jateng',
      lat: -7.7820, lng: 110.3670, confidence: 'medium',
      feed_from: 'yogyakarta_150',
      notes: 'Icon+ regional Telco data center; ~3 MW IT load.' },

    // NeuCentriX Yogyakarta.
    { id: 'neucentrix_yogyakarta', name: 'NeuCentriX Yogyakarta', kind: 'dc', operator: 'NeuCentriX (Telkom)', mw: 2,
      voltage: 20, capacity_kVA: 2500, year: 2021, prov: 'jateng',
      lat: -7.7900, lng: 110.3720, confidence: 'medium',
      feed_from: 'yogyakarta_150',
      notes: 'Telkom edge node Yogyakarta; ~2 MW.' },

    // Lintasarta Yogyakarta (regional edge).
    { id: 'lintasarta_yogyakarta', name: 'Lintasarta Yogyakarta', kind: 'dc', operator: 'Lintasarta', mw: 2,
      voltage: 20, capacity_kVA: 2500, year: 2018, prov: 'jateng',
      lat: -7.7970, lng: 110.3700, confidence: 'low',
      feed_from: 'yogyakarta_150',
      notes: 'Lintasarta regional edge; address approximated to Yogyakarta centroid.' },

    // -------- MAJOR INDUSTRIAL INTAKES (representative) --------
    // Kawasan Industri Kendal (KIK) — Sembcorp / Jababeka JV, textile + electronics.
    { id: 'ind_kendal_kik', name: 'Kawasan Industri Kendal (KIK)', kind: 'industrial', mw: 220,
      voltage: 20, capacity_kVA: 260000, year: 2016, prov: 'jateng',
      lat: -6.9230, lng: 110.2080, confidence: 'medium',
      feed_from: 'kendal_industrial_150',
      notes: 'KIK Sembcorp-Jababeka JV; textile, electronics, food processing.' },

    // Tegal Industrial (metalworking + textile).
    { id: 'ind_tegal', name: 'Tegal Industrial Belt', kind: 'industrial', mw: 80,
      voltage: 20, capacity_kVA: 95000, year: 1990, prov: 'jateng',
      lat: -6.8690, lng: 109.1400, confidence: 'low',
      feed_from: 'osm_way_689263666',
      notes: 'Tegal metalworking + textile cluster; address approximated to Tegal centroid, fed from GITET Batang ring.' },

    // Pekalongan textile cluster.
    { id: 'ind_pekalongan', name: 'Pekalongan Textile Cluster', kind: 'industrial', mw: 70,
      voltage: 20, capacity_kVA: 80000, year: 1985, prov: 'jateng',
      lat: -6.8890, lng: 109.6750, confidence: 'low',
      feed_from: 'osm_way_689263666',
      notes: 'Pekalongan batik + textile mills; address approximated to Pekalongan centroid, fed from GITET Batang ring.' },

    // Solo / Sukoharjo industrial (Sritex + supporting textile mills).
    { id: 'ind_sukoharjo', name: 'Solo-Sukoharjo Industrial', kind: 'industrial', mw: 180,
      voltage: 20, capacity_kVA: 210000, year: 1990, prov: 'jateng',
      lat: -7.6780, lng: 110.8330, confidence: 'medium',
      feed_from: 'solo_150',
      notes: 'Sukoharjo textile (Sritex), Karanganyar industrial; address near Sritex Solo Baru.' },

    // Klaten manufacturing cluster.
    { id: 'ind_klaten', name: 'Klaten Manufacturing', kind: 'industrial', mw: 90,
      voltage: 20, capacity_kVA: 105000, year: 1995, prov: 'jateng',
      lat: -7.7050, lng: 110.6060, confidence: 'low',
      feed_from: 'solo_150',
      notes: 'Klaten metalworking + ceramics; address approximated to Klaten centroid.' },

    // Wonogiri quarry + cement (ex-PLTA Wonogiri area industrial offtake).
    { id: 'ind_wonogiri', name: 'Wonogiri Quarry Industrial', kind: 'industrial', mw: 40,
      voltage: 20, capacity_kVA: 50000, year: 2000, prov: 'jateng',
      lat: -7.8100, lng: 110.9220, confidence: 'low',
      feed_from: 'solo_150',
      notes: 'Wonogiri limestone quarry + cement processing; address approximated.' },

    // Cilacap Pertamina captive — refinery has its own captive but pulls peaking from PLN.
    { id: 'ind_cilacap_pertamina', name: 'Pertamina Cilacap Refinery Intake', kind: 'industrial', mw: 280,
      voltage: 20, capacity_kVA: 320000, year: 1976, prov: 'jateng',
      lat: -7.7160, lng: 109.0230, confidence: 'medium',
      feed_from: 'osm_way_629512849',
      notes: 'Pertamina RU IV Cilacap refinery; PLN peaking + emergency intake, primary load on captive.' }
  ],

  // ============================================================
  // EDGES (20 kV feeder + injected 150 kV uplinks)
  // ============================================================
  edges: [
    // -------- INJECTED 150 kV UPLINKS (fed from base-data 500 kV GITETs) --------
    { from: 'osm_way_166633831',  to: 'semarang_timur_150',     voltage: 150, km: 18, type: 'uplink' },
    { from: 'osm_way_1308433899', to: 'solo_150',               voltage: 150, km: 16, type: 'uplink' },
    { from: 'osm_way_1308433899', to: 'yogyakarta_150',         voltage: 150, km: 42, type: 'uplink' },
    { from: 'osm_way_166633831',  to: 'kendal_industrial_150',  voltage: 150, km: 22, type: 'uplink' },

    // -------- 20 kV — Semarang cluster --------
    { from: 'semarang_timur_150', to: 'telkomsigma_semarang',   voltage: 20, km: 2.4, type: 'feeder' },
    { from: 'semarang_timur_150', to: 'neucentrix_semarang',    voltage: 20, km: 2.5, type: 'feeder' },
    { from: 'semarang_timur_150', to: 'lintasarta_semarang',    voltage: 20, km: 2.6, type: 'feeder' },

    // -------- 20 kV — Yogyakarta / DIY cluster --------
    { from: 'yogyakarta_150',     to: 'iconplus_yogyakarta',    voltage: 20, km: 1.4, type: 'feeder' },
    { from: 'yogyakarta_150',     to: 'neucentrix_yogyakarta',  voltage: 20, km: 1.5, type: 'feeder' },
    { from: 'yogyakarta_150',     to: 'lintasarta_yogyakarta',  voltage: 20, km: 1.6, type: 'feeder' },

    // -------- 20 kV — Kendal industrial --------
    { from: 'kendal_industrial_150', to: 'ind_kendal_kik',      voltage: 20, km: 1.2, type: 'industrial' },

    // -------- 20 kV — Solo / Sukoharjo / Klaten / Wonogiri --------
    { from: 'solo_150',           to: 'ind_sukoharjo',          voltage: 20, km: 4.5, type: 'industrial' },
    { from: 'solo_150',           to: 'ind_klaten',             voltage: 20, km: 18,  type: 'industrial' },
    { from: 'solo_150',           to: 'ind_wonogiri',           voltage: 20, km: 28,  type: 'industrial' },

    // -------- 20 kV — Tegal / Pekalongan (north-coast textile belt) --------
    { from: 'osm_way_689263666',  to: 'ind_tegal',              voltage: 20, km: 38,  type: 'industrial' },
    { from: 'osm_way_689263666',  to: 'ind_pekalongan',         voltage: 20, km: 12,  type: 'industrial' },

    // -------- 20 kV — Cilacap refinery --------
    { from: 'osm_way_629512849',  to: 'ind_cilacap_pertamina',  voltage: 20, km: 4.0, type: 'industrial' }
  ]
};
