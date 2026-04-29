/* PLN Java-Bali — Jakarta+Banten 20 kV DC-feeder overlay v2026-04-29
 * Source: public DC operator filings, DCD pipeline announcements, Cushman & Wakefield
 *   Indonesia DC Reports 2023/2024, Structure Research APAC DC Census, operator websites
 *   (dci-indonesia.com, gds-services.com, princetondg.com, equinix.com, services.global.ntt,
 *   bdxworld.com, edgeconnex.com), OSM/Wikipedia for site geocoding.
 * Coverage: feeders connecting to known DC operators or major industrial intakes in
 *   Jakarta DKI + Banten province (Cikarang/Cibitung sit on the Bekasi/Jabar boundary
 *   but are operationally fed from the Jakarta-Banten 150 kV ring, so listed here).
 * NOT a full distribution map — curated for visualization only. ~30 nodes, ~30 edges.
 *
 * Confidence:
 *   high   - operator press release / regulatory filing with explicit address
 *   medium - operator website lists area (e.g., "Cibitung campus"), geocoded to estate
 *   low    - inferred from peering/sales material, placed at industrial-estate centroid
 *
 * feed_from references substation IDs in /js/pln-java-grid-data.js. Where a 150 kV
 * intermediate is needed but not present in the base file, it is injected here with
 * `injected: true` so the overlay can render a complete feeder path.
 */
window.PLN_JAVA_GRID_JAKARTA_BANTEN = {
  version: '2026-04-29',
  province: 'jakarta-banten',

  // ============================================================
  // NODES
  // ============================================================
  nodes: [
    // -------- INJECTED 150 kV INTERMEDIATES (not in base data) --------
    // Cibitung GI 150 kV — anchors the DCI/NTT/PDG/GDS Cibitung cluster.
    // Base file has 'bekasi' (500 kV GITET) and 'cikarang_150' but no Cibitung 150.
    // PLN UID Jakarta Raya lists GI Cibitung on the MEIKARTA-Cibitung 150 kV loop.
    { id: 'cibitung_150', name: 'GI Cibitung 150', kind: 'station', voltage: 150, mva: 500, year: 2000,
      prov: 'jakarta-banten', lat: -6.2696, lng: 107.0859, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: anchors Cibitung DC cluster; fed from GITET Bekasi 500/150.' },

    // Sentul GI 150 kV — anchors Equinix JK1 + EdgeConneX Sentul.
    // Bogor regency, but on the Jakarta-Banten 150 kV ring via Cibinong.
    { id: 'sentul_150', name: 'GI Sentul', kind: 'station', voltage: 150, mva: 300, year: 2008,
      prov: 'jakarta-banten', lat: -6.5810, lng: 106.8530, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: anchors Sentul DC cluster; fed from GITET Cibinong 500/150.' },

    // Pulogadung GI 150 kV — central Jakarta industrial / Telkomsigma SCB feeder root.
    { id: 'pulogadung_150', name: 'GI Pulogadung', kind: 'station', voltage: 150, mva: 500, year: 1990,
      prov: 'jakarta-banten', lat: -6.1880, lng: 106.9080, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: central Jakarta industrial feeder root.' },

    // Sudirman / Mega Kuningan GI 150 kV — CBD core, fed from Cawang.
    { id: 'csb_150', name: 'GI CSB (Sudirman)', kind: 'station', voltage: 150, mva: 500, year: 1995,
      prov: 'jakarta-banten', lat: -6.2200, lng: 106.8230, tier: 1, confidence: 'low',
      injected: true, notes: 'Injected: CBD load centre; fed from GITET Cawang 500/150.' },

    // -------- 20 kV DC FEEDER ENDPOINTS — DCI INDONESIA --------
    // DCI is Indonesia's largest hyperscale operator; 5 buildings on Cibitung + Karawang campuses.
    // Source: dci-indonesia.com/data-centers, Cushman APAC DC Report 2024.
    { id: 'dci_jk1', name: 'DCI JK1 (Cibitung)', kind: 'dc', operator: 'DCI Indonesia', mw: 23,
      voltage: 20, capacity_kVA: 25000, year: 2014, prov: 'jakarta-banten',
      lat: -6.2697, lng: 107.0855, confidence: 'high',
      feed_from: 'cibitung_150',
      notes: 'JIPARK Cibitung; first DCI building, 15 MW phase 1 + 8 MW phase 2.' },
    { id: 'dci_jk2', name: 'DCI JK2 (Cibitung)', kind: 'dc', operator: 'DCI Indonesia', mw: 22,
      voltage: 20, capacity_kVA: 25000, year: 2017, prov: 'jakarta-banten',
      lat: -6.2701, lng: 107.0865, confidence: 'high',
      feed_from: 'cibitung_150',
      notes: 'Adjacent to JK1, JIPARK Cibitung campus.' },
    { id: 'dci_jk3', name: 'DCI JK3 (Cibitung)', kind: 'dc', operator: 'DCI Indonesia', mw: 26,
      voltage: 20, capacity_kVA: 30000, year: 2020, prov: 'jakarta-banten',
      lat: -6.2705, lng: 107.0875, confidence: 'high',
      feed_from: 'cibitung_150',
      notes: 'JIPARK Cibitung, Tier IV; serves hyperscale anchor (rumoured Microsoft/Google).' },
    { id: 'dci_jk5', name: 'DCI JK5 (Karawang)', kind: 'dc', operator: 'DCI Indonesia', mw: 75,
      voltage: 20, capacity_kVA: 80000, year: 2024, prov: 'jakarta-banten',
      lat: -6.3920, lng: 107.3050, confidence: 'medium',
      feed_from: 'karawang_150',
      notes: 'KIIC Karawang, planned 75 MW IT load; commissioning 2024-2025.' },

    // -------- NTT GLOBAL DATA CENTERS --------
    // Source: services.global.ntt/en-us/services-and-products/data-centers/jakarta
    { id: 'ntt_jkt1', name: 'NTT JKT1 (Bekasi)', kind: 'dc', operator: 'NTT GDC', mw: 6,
      voltage: 20, capacity_kVA: 7500, year: 2016, prov: 'jakarta-banten',
      lat: -6.2410, lng: 106.9920, confidence: 'medium',
      feed_from: 'bekasi',
      notes: 'Jl. Inspeksi Kalimalang Bekasi; legacy NetMagic facility.' },
    { id: 'ntt_jkt2', name: 'NTT JKT2 (Cikarang)', kind: 'dc', operator: 'NTT GDC', mw: 22,
      voltage: 20, capacity_kVA: 25000, year: 2021, prov: 'jakarta-banten',
      lat: -6.2790, lng: 107.1500, confidence: 'medium',
      feed_from: 'cikarang_150',
      notes: 'Jababeka Cikarang, Tier IV; 22 MW IT load.' },
    { id: 'ntt_jkt3', name: 'NTT JKT3 (Cikarang)', kind: 'dc', operator: 'NTT GDC', mw: 45,
      voltage: 20, capacity_kVA: 50000, year: 2024, prov: 'jakarta-banten',
      lat: -6.2810, lng: 107.1530, confidence: 'medium',
      feed_from: 'cikarang_150',
      notes: 'Jababeka phase 2; 45 MW commissioning 2024.' },

    // -------- BDx INDONESIA --------
    // Source: bdxworld.com, JV between Big Data Exchange and Indosat.
    { id: 'bdx_cgk1', name: 'BDx CGK1 (Cikarang)', kind: 'dc', operator: 'BDx Indonesia', mw: 30,
      voltage: 20, capacity_kVA: 35000, year: 2022, prov: 'jakarta-banten',
      lat: -6.2680, lng: 107.1380, confidence: 'medium',
      feed_from: 'cikarang_150',
      notes: 'Hyperscale-ready, 30 MW IT load; Indosat fiber on-net.' },
    { id: 'bdx_cgk2', name: 'BDx CGK2 (Cikarang)', kind: 'dc', operator: 'BDx Indonesia', mw: 35,
      voltage: 20, capacity_kVA: 40000, year: 2024, prov: 'jakarta-banten',
      lat: -6.2690, lng: 107.1395, confidence: 'low',
      feed_from: 'cikarang_150',
      notes: 'Phase 2 expansion, address approximated to Cikarang centroid.' },

    // -------- EQUINIX --------
    // Source: equinix.com/data-centers/asia-pacific-colocation/indonesia-colocation
    { id: 'eqix_jk1', name: 'Equinix JK1 (Sentul)', kind: 'dc', operator: 'Equinix', mw: 8,
      voltage: 20, capacity_kVA: 10000, year: 2022, prov: 'jakarta-banten',
      lat: -6.5805, lng: 106.8540, confidence: 'high',
      feed_from: 'sentul_150',
      notes: 'Sentul City Bogor; acquired from GPX 2022, 8 MW IT load.' },
    { id: 'eqix_jk2', name: 'Equinix JK2 (West Jakarta)', kind: 'dc', operator: 'Equinix', mw: 16,
      voltage: 20, capacity_kVA: 20000, year: 2024, prov: 'jakarta-banten',
      lat: -6.1680, lng: 106.7730, confidence: 'medium',
      feed_from: 'kembangan',
      notes: 'Cengkareng / Daan Mogot West Jakarta; 16 MW IT load greenfield.' },

    // -------- PRINCETON DIGITAL GROUP --------
    // Source: princetondg.com, JV with Salim Group; JC1 is in Cibitung.
    { id: 'pdg_jc1', name: 'PDG JC1 (Cibitung)', kind: 'dc', operator: 'Princeton Digital Group', mw: 22,
      voltage: 20, capacity_kVA: 25000, year: 2022, prov: 'jakarta-banten',
      lat: -6.2730, lng: 107.0820, confidence: 'medium',
      feed_from: 'cibitung_150',
      notes: 'JIIPE-adjacent Cibitung; first PDG Indonesia hyperscale, 22 MW.' },
    { id: 'pdg_jc2', name: 'PDG JC2 (Cibitung)', kind: 'dc', operator: 'Princeton Digital Group', mw: 48,
      voltage: 20, capacity_kVA: 55000, year: 2025, prov: 'jakarta-banten',
      lat: -6.2740, lng: 107.0830, confidence: 'low',
      feed_from: 'cibitung_150',
      notes: 'Announced 48 MW expansion, address approximated to Cibitung centroid.' },

    // -------- GDS / GDS HOLDINGS --------
    // Source: gds-services.com/our-data-centers/Indonesia
    { id: 'gds_jh1', name: 'GDS JH1 (Cibitung)', kind: 'dc', operator: 'GDS', mw: 12,
      voltage: 20, capacity_kVA: 15000, year: 2023, prov: 'jakarta-banten',
      lat: -6.2660, lng: 107.0900, confidence: 'medium',
      feed_from: 'cibitung_150',
      notes: 'Cibitung, GDS first Indonesia campus, 12 MW phase 1.' },

    // -------- TELKOM / TELKOMSIGMA / NEUCENTRIX --------
    { id: 'telkomsigma_scb', name: 'Telkomsigma SCB (Sudirman)', kind: 'dc', operator: 'Telkomsigma', mw: 8,
      voltage: 20, capacity_kVA: 10000, year: 2010, prov: 'jakarta-banten',
      lat: -6.2200, lng: 106.8240, confidence: 'medium',
      feed_from: 'csb_150',
      notes: 'Sentral Cyber Building, Jl. Kuningan Barat; legacy carrier hotel.' },
    { id: 'telkomsigma_serpong', name: 'Telkomsigma Serpong', kind: 'dc', operator: 'Telkomsigma', mw: 15,
      voltage: 20, capacity_kVA: 18000, year: 2014, prov: 'jakarta-banten',
      lat: -6.3220, lng: 106.6680, confidence: 'medium',
      feed_from: 'serpong_150',
      notes: 'BSD Serpong Tier IV campus; 15 MW phased build.' },
    { id: 'telkomsigma_sentul', name: 'Telkomsigma Sentul', kind: 'dc', operator: 'Telkomsigma', mw: 10,
      voltage: 20, capacity_kVA: 12000, year: 2018, prov: 'jakarta-banten',
      lat: -6.5790, lng: 106.8550, confidence: 'medium',
      feed_from: 'sentul_150',
      notes: 'Sentul City; 10 MW campus.' },

    // -------- LINTASARTA --------
    { id: 'lintasarta_jatiluhur', name: 'Lintasarta Jatiluhur', kind: 'dc', operator: 'Lintasarta', mw: 4,
      voltage: 20, capacity_kVA: 5000, year: 2012, prov: 'jakarta-banten',
      lat: -6.2300, lng: 106.9920, confidence: 'low',
      feed_from: 'bekasi',
      notes: 'Bekasi/Jatiluhur area, address approximated to Bekasi centroid.' },
    { id: 'lintasarta_tb_simatupang', name: 'Lintasarta TB Simatupang', kind: 'dc', operator: 'Lintasarta', mw: 6,
      voltage: 20, capacity_kVA: 7500, year: 2015, prov: 'jakarta-banten',
      lat: -6.2920, lng: 106.8260, confidence: 'medium',
      feed_from: 'csb_150',
      notes: 'Jl. TB Simatupang South Jakarta; 6 MW IT load.' },

    // -------- EDGECONNEX --------
    // EdgeConneX EDJK01 is at Sentul (announced 2023).
    { id: 'edgeconnex_edjk01', name: 'EdgeConneX EDJK01 (Sentul)', kind: 'dc', operator: 'EdgeConneX', mw: 36,
      voltage: 20, capacity_kVA: 40000, year: 2024, prov: 'jakarta-banten',
      lat: -6.5825, lng: 106.8520, confidence: 'medium',
      feed_from: 'sentul_150',
      notes: 'Sentul City, EdgeConneX first Indonesia DC, 36 MW IT phase 1.' },

    // -------- CHINDATA / BRIDGE DATA CENTRES --------
    { id: 'chindata_cgn1', name: 'Bridge BDC CGN1 (Cikarang)', kind: 'dc', operator: 'Bridge Data Centres', mw: 20,
      voltage: 20, capacity_kVA: 22000, year: 2023, prov: 'jakarta-banten',
      lat: -6.2820, lng: 107.1450, confidence: 'low',
      feed_from: 'cikarang_150',
      notes: 'Cikarang, address approximated to Cikarang industrial centroid.' },

    // -------- STREAM DATA CENTERS --------
    { id: 'stream_jkt1', name: 'Stream JKT1 (Cibitung)', kind: 'dc', operator: 'Stream Data Centers', mw: 18,
      voltage: 20, capacity_kVA: 20000, year: 2025, prov: 'jakarta-banten',
      lat: -6.2710, lng: 107.0870, confidence: 'low',
      feed_from: 'cibitung_150',
      notes: 'Announced Cibitung campus, 18 MW phase 1; address approximated.' },

    // -------- MAJOR INDUSTRIAL INTAKES (representative nodes) --------
    // Cikarang industrial estate (MM2100 + Jababeka + EJIP + Lippo Cikarang) — ~12 GW total.
    // Single representative node since the load is distributed across dozens of feeders.
    { id: 'ind_cikarang', name: 'Cikarang Industrial Estate (representative)', kind: 'industrial', mw: 1200,
      voltage: 20, capacity_kVA: 1400000, year: 1990, prov: 'jakarta-banten',
      lat: -6.2700, lng: 107.1400, confidence: 'medium',
      feed_from: 'cikarang_150',
      notes: 'Aggregate: MM2100 + Jababeka + EJIP + Lippo Cikarang. Shown as single node; ~12 GW estate is fed by multiple 150/20 kV GIs.' },
    { id: 'ind_kiic', name: 'KIIC Karawang (representative)', kind: 'industrial', mw: 600,
      voltage: 20, capacity_kVA: 700000, year: 1990, prov: 'jakarta-banten',
      lat: -6.3700, lng: 107.3100, confidence: 'medium',
      feed_from: 'karawang_150',
      notes: 'Karawang International Industrial City; auto OEMs (Toyota, Astra).' },
    { id: 'ind_lippo_cikarang', name: 'Lippo Cikarang Industrial', kind: 'industrial', mw: 350,
      voltage: 20, capacity_kVA: 400000, year: 1995, prov: 'jakarta-banten',
      lat: -6.3050, lng: 107.1620, confidence: 'medium',
      feed_from: 'cikarang_150',
      notes: 'Mixed industrial + Meikarta township load.' },
    { id: 'ind_pulogadung', name: 'JIEP Pulogadung Industrial', kind: 'industrial', mw: 200,
      voltage: 20, capacity_kVA: 230000, year: 1973, prov: 'jakarta-banten',
      lat: -6.1850, lng: 106.9100, confidence: 'medium',
      feed_from: 'pulogadung_150',
      notes: 'Jakarta Industrial Estate Pulogadung; legacy manufacturing.' }
  ],

  // ============================================================
  // EDGES (20 kV feeder + injected 150 kV uplinks)
  // ============================================================
  edges: [
    // -------- INJECTED 150 kV UPLINKS (fed from base-data 500 kV GITETs) --------
    { from: 'bekasi',         to: 'cibitung_150',    voltage: 150, km: 8,  type: 'uplink' },
    { from: 'cibinong',       to: 'sentul_150',      voltage: 150, km: 12, type: 'uplink' },
    { from: 'cawang',         to: 'pulogadung_150',  voltage: 150, km: 10, type: 'uplink' },
    { from: 'cawang_150',     to: 'csb_150',         voltage: 150, km: 6,  type: 'uplink' },

    // -------- 20 kV FEEDER EDGES — Cibitung cluster --------
    { from: 'cibitung_150',   to: 'dci_jk1',         voltage: 20, km: 1.2, type: 'feeder' },
    { from: 'cibitung_150',   to: 'dci_jk2',         voltage: 20, km: 1.3, type: 'feeder' },
    { from: 'cibitung_150',   to: 'dci_jk3',         voltage: 20, km: 1.4, type: 'feeder' },
    { from: 'cibitung_150',   to: 'pdg_jc1',         voltage: 20, km: 1.6, type: 'feeder' },
    { from: 'cibitung_150',   to: 'pdg_jc2',         voltage: 20, km: 1.7, type: 'feeder' },
    { from: 'cibitung_150',   to: 'gds_jh1',         voltage: 20, km: 1.5, type: 'feeder' },
    { from: 'cibitung_150',   to: 'stream_jkt1',     voltage: 20, km: 1.4, type: 'feeder' },

    // -------- 20 kV — Cikarang cluster --------
    { from: 'cikarang_150',   to: 'ntt_jkt2',        voltage: 20, km: 2.5, type: 'feeder' },
    { from: 'cikarang_150',   to: 'ntt_jkt3',        voltage: 20, km: 2.7, type: 'feeder' },
    { from: 'cikarang_150',   to: 'bdx_cgk1',        voltage: 20, km: 1.9, type: 'feeder' },
    { from: 'cikarang_150',   to: 'bdx_cgk2',        voltage: 20, km: 2.0, type: 'feeder' },
    { from: 'cikarang_150',   to: 'chindata_cgn1',   voltage: 20, km: 2.6, type: 'feeder' },
    { from: 'cikarang_150',   to: 'ind_cikarang',    voltage: 20, km: 1.5, type: 'industrial' },
    { from: 'cikarang_150',   to: 'ind_lippo_cikarang', voltage: 20, km: 4.5, type: 'industrial' },

    // -------- 20 kV — Karawang cluster --------
    { from: 'karawang_150',   to: 'dci_jk5',         voltage: 20, km: 3.2, type: 'feeder' },
    { from: 'karawang_150',   to: 'ind_kiic',        voltage: 20, km: 2.8, type: 'industrial' },

    // -------- 20 kV — Bekasi cluster --------
    { from: 'bekasi',         to: 'ntt_jkt1',        voltage: 20, km: 3.0, type: 'feeder' },
    { from: 'bekasi',         to: 'lintasarta_jatiluhur', voltage: 20, km: 4.0, type: 'feeder' },

    // -------- 20 kV — Sentul cluster --------
    { from: 'sentul_150',     to: 'eqix_jk1',        voltage: 20, km: 1.2, type: 'feeder' },
    { from: 'sentul_150',     to: 'edgeconnex_edjk01', voltage: 20, km: 1.4, type: 'feeder' },
    { from: 'sentul_150',     to: 'telkomsigma_sentul', voltage: 20, km: 1.5, type: 'feeder' },

    // -------- 20 kV — Jakarta CBD / South / West --------
    { from: 'csb_150',        to: 'telkomsigma_scb', voltage: 20, km: 0.8, type: 'feeder' },
    { from: 'csb_150',        to: 'lintasarta_tb_simatupang', voltage: 20, km: 7.0, type: 'feeder' },
    { from: 'kembangan',      to: 'eqix_jk2',        voltage: 20, km: 2.5, type: 'feeder' },
    { from: 'serpong_150',    to: 'telkomsigma_serpong', voltage: 20, km: 1.5, type: 'feeder' },

    // -------- 20 kV — Pulogadung industrial --------
    { from: 'pulogadung_150', to: 'ind_pulogadung',  voltage: 20, km: 1.0, type: 'industrial' }
  ]
};
