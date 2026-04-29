/* PLN Java-Bali — Jawa Barat 20 kV DC-feeder overlay v2026-04-29
 * Source: public DC operator filings, DCD pipeline announcements, Cushman & Wakefield
 *   Indonesia DC Reports 2023/2024, Structure Research APAC DC Census, BKPM Karawang
 *   industrial estate filings, Cirebon Power industrial intake datasheets, OSM/Wikipedia.
 * Coverage: feeders connecting to known DC operators or major industrial intakes within
 *   Jawa Barat province ONLY. Operators that span Jakarta-Banten + Jabar (DCI JK4/JK5
 *   in Karawang Timur) are deliberately excluded from THIS file and listed in the
 *   jakarta-banten overlay because the boundary at Cikarang/Karawang is operationally
 *   contiguous with the Jakarta-Banten 150 kV ring. This file picks up the
 *   Karawang-East / Purwakarta / Bandung / Cirebon clusters that feed from Jabar GIs.
 * NOT a full distribution map — curated for visualization only. ~25 nodes, ~25 edges.
 *
 * Confidence:
 *   high   - operator press release / regulatory filing with explicit address
 *   medium - operator website lists area, geocoded to estate
 *   low    - inferred from peering/sales material, placed at industrial-estate centroid
 *
 * feed_from references substation IDs in /js/pln-java-grid-data.js. Where a 150 kV
 * intermediate is needed but not present in the base file, it is injected here with
 * `injected: true`.
 */
window.PLN_JAVA_GRID_JABAR = {
  version: '2026-04-29',
  province: 'jabar',

  // ============================================================
  // NODES
  // ============================================================
  nodes: [
    // -------- INJECTED 150 kV INTERMEDIATES (not in base data) --------
    // Karawang Timur GI 150 kV — distinct from base 'karawang_150' (which is mid-city).
    // Anchors east-Karawang DCs near Suryacipta and KIIC East.
    { id: 'karawang_timur_150', name: 'GI Karawang Timur 150', kind: 'station', voltage: 150, mva: 300, year: 2010,
      prov: 'jabar', lat: -6.3650, lng: 107.4250, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: anchors Karawang-East DC + industrial cluster; fed from GI Cikampek.' },

    // Purwakarta GI 150 kV — Suryacipta City of Industry / Indotaisei.
    { id: 'purwakarta_150', name: 'GI Purwakarta', kind: 'station', voltage: 150, mva: 300, year: 2000,
      prov: 'jabar', lat: -6.5570, lng: 107.4430, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: Suryacipta + Indotaisei industrial; fed from GITET Cibatu 500/150.' },

    // Bandung Timur GI 150 kV — Bandung edge-DC anchor.
    { id: 'bandung_timur_150', name: 'GI Bandung Timur', kind: 'station', voltage: 150, mva: 300, year: 2005,
      prov: 'jabar', lat: -6.9120, lng: 107.6920, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: anchors Bandung edge-DC cluster; loop-fed from Bandung Selatan + Utara.' },

    // Cirebon Industrial GI 150 kV — Cirebon Power / Kanci.
    { id: 'cirebon_industrial_150', name: 'GI Cirebon Industrial', kind: 'station', voltage: 150, mva: 200, year: 2012,
      prov: 'jabar', lat: -6.7720, lng: 108.6200, tier: 2, confidence: 'medium',
      injected: true, notes: 'Injected: serves Cirebon Power industrial offtake; tap from PLTU Cirebon-2 154 kV bus.' },

    // -------- 20 kV DC FEEDER ENDPOINTS — KARAWANG TIMUR / PURWAKARTA --------
    // DCI JK4 — Karawang Timur, near Suryacipta.
    // Source: DCD Indonesia pipeline 2024.
    { id: 'dci_jk4', name: 'DCI JK4 (Karawang Timur)', kind: 'dc', operator: 'DCI Indonesia', mw: 50,
      voltage: 20, capacity_kVA: 55000, year: 2024, prov: 'jabar',
      lat: -6.3640, lng: 107.4280, confidence: 'medium',
      feed_from: 'karawang_timur_150',
      notes: 'Suryacipta City of Industry; 50 MW IT load.' },

    // SpaceDC JAK2 (Karawang Timur, announced 2023).
    { id: 'spacedc_jak2', name: 'SpaceDC JAK2 (Karawang Timur)', kind: 'dc', operator: 'SpaceDC', mw: 18,
      voltage: 20, capacity_kVA: 22000, year: 2025, prov: 'jabar',
      lat: -6.3680, lng: 107.4290, confidence: 'low',
      feed_from: 'karawang_timur_150',
      notes: 'Announced 18 MW, address approximated to Suryacipta centroid.' },

    // Princeton Digital Group JC3 (Karawang Timur).
    { id: 'pdg_jc3', name: 'PDG JC3 (Karawang Timur)', kind: 'dc', operator: 'Princeton Digital Group', mw: 30,
      voltage: 20, capacity_kVA: 35000, year: 2025, prov: 'jabar',
      lat: -6.3700, lng: 107.4310, confidence: 'low',
      feed_from: 'karawang_timur_150',
      notes: 'Announced 30 MW Karawang Timur expansion, address approximated.' },

    // Telkomsigma Karawang.
    { id: 'telkomsigma_karawang', name: 'Telkomsigma Karawang', kind: 'dc', operator: 'Telkomsigma', mw: 12,
      voltage: 20, capacity_kVA: 15000, year: 2020, prov: 'jabar',
      lat: -6.3300, lng: 107.3450, confidence: 'medium',
      feed_from: 'karawang_150',
      notes: 'Suryacipta-area; 12 MW IT load.' },

    // Indosat Hutchison DC Purwakarta (announced).
    { id: 'ioh_purwakarta', name: 'IOH Purwakarta DC', kind: 'dc', operator: 'Indosat Ooredoo Hutchison', mw: 10,
      voltage: 20, capacity_kVA: 12000, year: 2024, prov: 'jabar',
      lat: -6.5580, lng: 107.4450, confidence: 'low',
      feed_from: 'purwakarta_150',
      notes: 'Indotaisei area, address approximated to Purwakarta centroid.' },

    // -------- 20 kV — BANDUNG EDGE / METRO --------
    // Telkomsigma Bandung (Lembong / Geger Kalong).
    { id: 'telkomsigma_bandung', name: 'Telkomsigma Bandung', kind: 'dc', operator: 'Telkomsigma', mw: 5,
      voltage: 20, capacity_kVA: 6000, year: 2012, prov: 'jabar',
      lat: -6.9050, lng: 107.6100, confidence: 'medium',
      feed_from: 'bandung_150',
      notes: 'Telkom legacy carrier hotel; 5 MW IT load.' },

    // Biznet Bandung edge.
    { id: 'biznet_bandung', name: 'Biznet Bandung Edge', kind: 'dc', operator: 'Biznet', mw: 3,
      voltage: 20, capacity_kVA: 4000, year: 2018, prov: 'jabar',
      lat: -6.9180, lng: 107.6180, confidence: 'medium',
      feed_from: 'bandung_150',
      notes: 'Biznet metro edge node, 3 MW.' },

    // NeuCentriX Bandung (Telkom).
    { id: 'neucentrix_bandung', name: 'NeuCentriX Bandung', kind: 'dc', operator: 'NeuCentriX (Telkom)', mw: 4,
      voltage: 20, capacity_kVA: 5000, year: 2019, prov: 'jabar',
      lat: -6.9120, lng: 107.6900, confidence: 'medium',
      feed_from: 'bandung_timur_150',
      notes: 'Bandung Timur, edge connectivity hub.' },

    // Lintasarta Bandung.
    { id: 'lintasarta_bandung', name: 'Lintasarta Bandung', kind: 'dc', operator: 'Lintasarta', mw: 3,
      voltage: 20, capacity_kVA: 4000, year: 2016, prov: 'jabar',
      lat: -6.9160, lng: 107.6920, confidence: 'low',
      feed_from: 'bandung_timur_150',
      notes: 'Bandung edge, address approximated.' },

    // DTP Bandung (Data Tech Plus).
    { id: 'dtp_bandung', name: 'DTP Bandung', kind: 'dc', operator: 'Data Tech Plus', mw: 2,
      voltage: 20, capacity_kVA: 2500, year: 2020, prov: 'jabar',
      lat: -6.9100, lng: 107.6930, confidence: 'low',
      feed_from: 'bandung_timur_150',
      notes: 'Edge facility, address approximated.' },

    // -------- 20 kV — CIREBON CLUSTER --------
    // Telkom NeuCentriX Cirebon.
    { id: 'neucentrix_cirebon', name: 'NeuCentriX Cirebon', kind: 'dc', operator: 'NeuCentriX (Telkom)', mw: 2,
      voltage: 20, capacity_kVA: 2500, year: 2020, prov: 'jabar',
      lat: -6.7320, lng: 108.5520, confidence: 'medium',
      feed_from: 'cirebon_150',
      notes: 'Cirebon city centre, 2 MW edge.' },

    // -------- MAJOR INDUSTRIAL INTAKES (representative) --------
    // Suryacipta City of Industry (Karawang Timur) — auto, electronics, steel.
    { id: 'ind_suryacipta', name: 'Suryacipta City of Industry', kind: 'industrial', mw: 450,
      voltage: 20, capacity_kVA: 520000, year: 1990, prov: 'jabar',
      lat: -6.3650, lng: 107.4250, confidence: 'medium',
      feed_from: 'karawang_timur_150',
      notes: 'Karawang-East auto/electronics estate.' },

    // Indotaisei Industrial Estate (Cikampek/Purwakarta border).
    { id: 'ind_indotaisei', name: 'Indotaisei Industrial Estate', kind: 'industrial', mw: 250,
      voltage: 20, capacity_kVA: 290000, year: 1995, prov: 'jabar',
      lat: -6.4470, lng: 107.4500, confidence: 'medium',
      feed_from: 'cikampek_150',
      notes: 'Japanese-owned industrial estate, Cikampek-Purwakarta corridor.' },

    // Kota Bukit Indah (Purwakarta).
    { id: 'ind_kbi_purwakarta', name: 'Kota Bukit Indah Purwakarta', kind: 'industrial', mw: 150,
      voltage: 20, capacity_kVA: 175000, year: 1995, prov: 'jabar',
      lat: -6.5580, lng: 107.4430, confidence: 'medium',
      feed_from: 'purwakarta_150',
      notes: 'Mixed industrial + residential township.' },

    // Cirebon Power industrial intake (PLTU Cirebon + nearby cement/petrochem).
    { id: 'ind_cirebon_power', name: 'Cirebon Power Industrial Intake', kind: 'industrial', mw: 120,
      voltage: 20, capacity_kVA: 140000, year: 2012, prov: 'jabar',
      lat: -6.7700, lng: 108.6180, confidence: 'medium',
      feed_from: 'cirebon_industrial_150',
      notes: 'Industrial offtake adjacent to PLTU Cirebon-2; cement + petrochem.' },

    // Bandung industrial belt (Cimahi / Padalarang textiles).
    { id: 'ind_cimahi', name: 'Cimahi Industrial Belt', kind: 'industrial', mw: 180,
      voltage: 20, capacity_kVA: 210000, year: 1985, prov: 'jabar',
      lat: -6.8730, lng: 107.5430, confidence: 'medium',
      feed_from: 'cimahi_150',
      notes: 'Textile / garment industrial belt west of Bandung.' },

    // Majalaya textile cluster.
    { id: 'ind_majalaya', name: 'Majalaya Textile Cluster', kind: 'industrial', mw: 90,
      voltage: 20, capacity_kVA: 105000, year: 1985, prov: 'jabar',
      lat: -7.0410, lng: 107.7610, confidence: 'low',
      feed_from: 'bandung_selatan',
      notes: 'Majalaya/Banjaran textile mills; address approximated.' },

    // Jatiwangi roof-tile / cement (Mandirancan area).
    { id: 'ind_jatiwangi', name: 'Jatiwangi Industrial', kind: 'industrial', mw: 70,
      voltage: 20, capacity_kVA: 80000, year: 1990, prov: 'jabar',
      lat: -6.7430, lng: 108.2700, confidence: 'low',
      feed_from: 'mandirancan',
      notes: 'Cement + roof-tile industry, Majalengka regency; address approximated.' }
  ],

  // ============================================================
  // EDGES
  // ============================================================
  edges: [
    // -------- INJECTED 150 kV UPLINKS --------
    { from: 'cikampek_150',   to: 'karawang_timur_150',     voltage: 150, km: 8,  type: 'uplink' },
    { from: 'cibatu',         to: 'purwakarta_150',         voltage: 150, km: 28, type: 'uplink' },
    { from: 'bandung_selatan', to: 'bandung_timur_150',     voltage: 150, km: 14, type: 'uplink' },
    { from: 'bandung_utara',  to: 'bandung_timur_150',      voltage: 150, km: 12, type: 'uplink' },
    { from: 'p_cirebon2',     to: 'cirebon_industrial_150', voltage: 150, km: 2,  type: 'uplink' },

    // -------- 20 kV — Karawang Timur cluster --------
    { from: 'karawang_timur_150', to: 'dci_jk4',           voltage: 20, km: 1.5, type: 'feeder' },
    { from: 'karawang_timur_150', to: 'spacedc_jak2',      voltage: 20, km: 1.6, type: 'feeder' },
    { from: 'karawang_timur_150', to: 'pdg_jc3',           voltage: 20, km: 1.7, type: 'feeder' },
    { from: 'karawang_timur_150', to: 'ind_suryacipta',    voltage: 20, km: 1.2, type: 'industrial' },
    { from: 'karawang_150',       to: 'telkomsigma_karawang', voltage: 20, km: 2.0, type: 'feeder' },

    // -------- 20 kV — Purwakarta / Cikampek cluster --------
    { from: 'purwakarta_150',     to: 'ioh_purwakarta',    voltage: 20, km: 1.5, type: 'feeder' },
    { from: 'purwakarta_150',     to: 'ind_kbi_purwakarta', voltage: 20, km: 1.0, type: 'industrial' },
    { from: 'cikampek_150',       to: 'ind_indotaisei',    voltage: 20, km: 4.5, type: 'industrial' },

    // -------- 20 kV — Bandung metro --------
    { from: 'bandung_150',        to: 'telkomsigma_bandung', voltage: 20, km: 1.8, type: 'feeder' },
    { from: 'bandung_150',        to: 'biznet_bandung',    voltage: 20, km: 2.0, type: 'feeder' },
    { from: 'bandung_timur_150',  to: 'neucentrix_bandung', voltage: 20, km: 1.4, type: 'feeder' },
    { from: 'bandung_timur_150',  to: 'lintasarta_bandung', voltage: 20, km: 1.5, type: 'feeder' },
    { from: 'bandung_timur_150',  to: 'dtp_bandung',       voltage: 20, km: 1.6, type: 'feeder' },
    { from: 'cimahi_150',         to: 'ind_cimahi',        voltage: 20, km: 2.0, type: 'industrial' },
    { from: 'bandung_selatan',    to: 'ind_majalaya',      voltage: 20, km: 6.0, type: 'industrial' },

    // -------- 20 kV — Cirebon cluster --------
    { from: 'cirebon_150',          to: 'neucentrix_cirebon', voltage: 20, km: 1.8, type: 'feeder' },
    { from: 'cirebon_industrial_150', to: 'ind_cirebon_power', voltage: 20, km: 1.0, type: 'industrial' },

    // -------- 20 kV — Mandirancan / Majalengka --------
    { from: 'mandirancan',        to: 'ind_jatiwangi',     voltage: 20, km: 8.5, type: 'industrial' }
  ]
};
