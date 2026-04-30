/* PLN Java-Bali — Jawa Timur 20 kV DC-feeder overlay v2026-04-30
 * Source: public DC operator filings (Telkomsigma, Lintasarta, Edge, NeuCentriX,
 *   Equinix peering MX-IX SUB), DCD APAC pipeline 2024, Cushman & Wakefield
 *   Indonesia DC Reports 2023/2024, Wikipedia infoboxes for plant geocoding,
 *   OSM Nominatim for industrial estate centroids (Gresik, Sidoarjo, Pasuruan,
 *   Mojokerto, Tuban, Probolinggo), PT Petrokimia Gresik annual report,
 *   PT Semen Indonesia (Tuban) sustainability report.
 * Coverage: feeders connecting to known DC operators or major industrial intakes
 *   across Jawa Timur. Surabaya is a secondary DC market behind Jakarta — primary
 *   colo is Telkomsigma, NeuCentriX, Lintasarta, plus Equinix peering point at
 *   MX-IX SUB. The bulk of overlay load is heavy industry (Petrokimia Gresik,
 *   Semen Indonesia Tuban, Pertamina TPPI Tuban, Paiton coal terminal).
 * NOT a full distribution map — curated for visualization only. ~24 nodes, ~20 edges.
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
window.PLN_JAVA_GRID_JATIM = {
  version: '2026-04-30',
  province: 'jatim',

  // ============================================================
  // NODES
  // ============================================================
  nodes: [
    // -------- INJECTED 150 kV INTERMEDIATES (not in base data) --------
    // Surabaya Selatan GI 150 kV — anchors south Surabaya DC + Rungkut industrial.
    { id: 'surabaya_selatan_150', name: 'GI Surabaya Selatan', kind: 'station', voltage: 150, mva: 500, year: 1995,
      prov: 'jatim', lat: -7.3340, lng: 112.7370, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: anchors Surabaya south metro DC cluster; loop-fed from GITET Krian.' },

    // Surabaya Timur GI 150 kV — anchors east Surabaya CBD + port.
    { id: 'surabaya_timur_150', name: 'GI Surabaya Timur', kind: 'station', voltage: 150, mva: 500, year: 1998,
      prov: 'jatim', lat: -7.2580, lng: 112.7820, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: Surabaya CBD + Tanjung Perak port load; loop-fed from GITET Krian.' },

    // Sidoarjo GI 150 kV — anchors Sidoarjo petrochemical + manufacturing.
    { id: 'sidoarjo_150', name: 'GI Sidoarjo', kind: 'station', voltage: 150, mva: 300, year: 2000,
      prov: 'jatim', lat: -7.4470, lng: 112.7180, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: Sidoarjo petrochemical + Waru industrial; fed from GITET Krian.' },

    // Mojokerto GI 150 kV — anchors NgORO industrial estate.
    { id: 'mojokerto_150', name: 'GI Mojokerto', kind: 'station', voltage: 150, mva: 250, year: 2005,
      prov: 'jatim', lat: -7.4720, lng: 112.4360, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: NgORO Industrial Estate Mojokerto; fed from GITET Krian via Bambe.' },

    // Probolinggo GI 150 kV — anchors Paiton coal terminal + Probolinggo industrial.
    { id: 'probolinggo_150', name: 'GI Probolinggo', kind: 'station', voltage: 150, mva: 200, year: 1997,
      prov: 'jatim', lat: -7.7530, lng: 113.2110, tier: 1, confidence: 'medium',
      injected: true, notes: 'Injected: Probolinggo industrial + Paiton terminal load; fed from GITET Paiton.' },

    // -------- 20 kV DC FEEDER ENDPOINTS — SURABAYA --------
    // Telkomsigma Surabaya (Telkom legacy carrier hotel, Ketintang area).
    { id: 'telkomsigma_surabaya', name: 'Telkomsigma Surabaya', kind: 'dc', operator: 'Telkomsigma', mw: 8,
      voltage: 20, capacity_kVA: 10000, year: 2012, prov: 'jatim',
      lat: -7.3140, lng: 112.7280, confidence: 'medium',
      feed_from: 'surabaya_selatan_150',
      notes: 'Telkom Ketintang carrier hotel; ~8 MW IT load Tier III.' },

    // NeuCentriX Surabaya (Telkom edge).
    { id: 'neucentrix_surabaya', name: 'NeuCentriX Surabaya', kind: 'dc', operator: 'NeuCentriX (Telkom)', mw: 4,
      voltage: 20, capacity_kVA: 5000, year: 2019, prov: 'jatim',
      lat: -7.3160, lng: 112.7300, confidence: 'medium',
      feed_from: 'surabaya_selatan_150',
      notes: 'Telkom edge connectivity hub Surabaya; ~4 MW.' },

    // Lintasarta Surabaya.
    { id: 'lintasarta_surabaya', name: 'Lintasarta Surabaya', kind: 'dc', operator: 'Lintasarta', mw: 5,
      voltage: 20, capacity_kVA: 6000, year: 2015, prov: 'jatim',
      lat: -7.2780, lng: 112.7490, confidence: 'medium',
      feed_from: 'surabaya_timur_150',
      notes: 'Lintasarta Surabaya regional DC; ~5 MW IT load.' },

    // Equinix peering at MX-IX SUB (Equinix joined Indonesia 2022 via JK1; SUB peering = IX, not full DC).
    // Listed because Equinix services Surabaya via partner facility in CBD.
    { id: 'eqix_sub_peer', name: 'Equinix MX-IX SUB Peering', kind: 'dc', operator: 'Equinix (peering)', mw: 1,
      voltage: 20, capacity_kVA: 1500, year: 2020, prov: 'jatim',
      lat: -7.2580, lng: 112.7470, confidence: 'low',
      feed_from: 'surabaya_timur_150',
      notes: 'Equinix peering / IX presence in Surabaya CBD partner colo; not a full Equinix-owned DC. Address approximated.' },

    // PLN Icon+ Surabaya.
    { id: 'iconplus_surabaya', name: 'PLN Icon+ Surabaya', kind: 'dc', operator: 'PLN Icon+', mw: 4,
      voltage: 20, capacity_kVA: 5000, year: 2018, prov: 'jatim',
      lat: -7.2820, lng: 112.7510, confidence: 'medium',
      feed_from: 'surabaya_timur_150',
      notes: 'Icon+ regional Telco DC Surabaya; ~4 MW.' },

    // DCI / Princeton — these have NOT publicly announced Surabaya facilities as of 2026-04-30.
    // Intentionally excluded.

    // -------- MAJOR INDUSTRIAL INTAKES (representative) --------
    // PT Petrokimia Gresik — fertilizer + chemical, captive cogen + PLN peaking.
    { id: 'ind_petrokimia_gresik', name: 'PT Petrokimia Gresik', kind: 'industrial', mw: 320,
      voltage: 20, capacity_kVA: 370000, year: 1972, prov: 'jatim',
      lat: -7.1610, lng: 112.6590, confidence: 'medium',
      feed_from: 'osm_way_311479837',
      notes: 'Petrokimia Gresik fertilizer + sulfuric acid; captive 200 MW cogen + PLN intake.' },

    // PT Semen Indonesia Gresik (legacy plant, partial closure 2020 but still active).
    { id: 'ind_semen_gresik', name: 'PT Semen Indonesia Gresik', kind: 'industrial', mw: 90,
      voltage: 20, capacity_kVA: 105000, year: 1957, prov: 'jatim',
      lat: -7.1530, lng: 112.6510, confidence: 'medium',
      feed_from: 'osm_way_311479837',
      notes: 'Semen Indonesia legacy Gresik plant; primary cement output now from Tuban.' },

    // PT Semen Indonesia Tuban (primary plant, ~14 Mt/y).
    { id: 'ind_semen_tuban', name: 'PT Semen Indonesia Tuban', kind: 'industrial', mw: 280,
      voltage: 20, capacity_kVA: 320000, year: 1994, prov: 'jatim',
      lat: -6.8800, lng: 111.8950, confidence: 'medium',
      feed_from: 'osm_way_398909640',
      notes: 'Semen Indonesia Tuban — 4 production lines, ~14 Mt/y capacity; fed from GITET Ngimbang via Tuban GI.' },

    // Sidoarjo Petrochemical (PT Tjiwi Kimia Mojokerto adjacent + Lapindo legacy).
    { id: 'ind_sidoarjo_petrochem', name: 'Sidoarjo Petrochemical Belt', kind: 'industrial', mw: 220,
      voltage: 20, capacity_kVA: 260000, year: 1985, prov: 'jatim',
      lat: -7.4500, lng: 112.7200, confidence: 'medium',
      feed_from: 'sidoarjo_150',
      notes: 'Sidoarjo + Waru industrial corridor; mixed petrochem, plastics, food processing.' },

    // Pasuruan industrial (PIER Pandaan).
    { id: 'ind_pasuruan_pier', name: 'PIER Pasuruan Industrial Estate', kind: 'industrial', mw: 180,
      voltage: 20, capacity_kVA: 210000, year: 1990, prov: 'jatim',
      lat: -7.6000, lng: 112.8500, confidence: 'medium',
      feed_from: 'osm_way_1419292543',
      notes: 'PIER Pandaan / Pasuruan industrial estate; auto-parts, electronics, food.' },

    // Mojokerto NgORO industrial.
    { id: 'ind_mojokerto_ngoro', name: 'NgORO Industrial Park Mojokerto', kind: 'industrial', mw: 140,
      voltage: 20, capacity_kVA: 165000, year: 1995, prov: 'jatim',
      lat: -7.4750, lng: 112.4400, confidence: 'medium',
      feed_from: 'mojokerto_150',
      notes: 'NgORO Industrial Park; mixed manufacturing, electronics, food.' },

    // PLTU Paiton coal terminal (industrial offtake adjacent to plant complex).
    { id: 'ind_paiton_terminal', name: 'Paiton Coal Terminal Industrial', kind: 'industrial', mw: 60,
      voltage: 20, capacity_kVA: 70000, year: 1994, prov: 'jatim',
      lat: -7.7160, lng: 113.5790, confidence: 'medium',
      feed_from: 'probolinggo_150',
      notes: 'Auxiliary load for Paiton coal terminal handling + nearby industrial; primary plant load on internal.' },

    // PLTU Tanjung Awar-Awar industrial (Tuban coal terminal aux load).
    { id: 'ind_tj_awar', name: 'Tanjung Awar-Awar Coal Terminal', kind: 'industrial', mw: 40,
      voltage: 20, capacity_kVA: 50000, year: 2012, prov: 'jatim',
      lat: -6.8090, lng: 111.9960, confidence: 'medium',
      feed_from: 'osm_way_398909640',
      notes: 'Coal terminal handling + auxiliary load adjacent to PLTU Tanjung Awar-Awar Tuban.' },

    // Banyuwangi Ijen geothermal industrial offtake (PLTP Ijen + Asembagus sugar).
    { id: 'ind_banyuwangi_geo', name: 'Banyuwangi Ijen Industrial', kind: 'industrial', mw: 35,
      voltage: 20, capacity_kVA: 42000, year: 2018, prov: 'jatim',
      lat: -8.0580, lng: 114.2410, confidence: 'low',
      feed_from: 'osm_way_299352934',
      notes: 'Ijen geothermal aux + Asembagus sugar mill; address approximated to Banyuwangi centroid, fed from GITET Paiton ring.' },

    // Tanjung Perak port (Surabaya port industrial intake).
    { id: 'ind_tj_perak', name: 'Tanjung Perak Port Surabaya', kind: 'industrial', mw: 80,
      voltage: 20, capacity_kVA: 95000, year: 1980, prov: 'jatim',
      lat: -7.2050, lng: 112.7400, confidence: 'medium',
      feed_from: 'surabaya_timur_150',
      notes: 'Tanjung Perak container terminal + cold-storage cluster.' },

    // Madura cable feeder (submarine 150 kV → Bangkalan 20 kV industrial).
    { id: 'ind_madura', name: 'Madura Bangkalan Industrial', kind: 'industrial', mw: 50,
      voltage: 20, capacity_kVA: 60000, year: 2009, prov: 'jatim',
      lat: -7.0290, lng: 112.7470, confidence: 'low',
      feed_from: 'surabaya_timur_150',
      notes: 'Madura Suramadu corridor industrial; light manufacturing + salt processing. Fed via Suramadu submarine 150 kV cable.' }
  ],

  // ============================================================
  // EDGES (20 kV feeder + injected 150 kV uplinks)
  // ============================================================
  edges: [
    // -------- INJECTED 150 kV UPLINKS (fed from base-data 500 kV GITETs) --------
    { from: 'osm_way_265568001',  to: 'surabaya_selatan_150',   voltage: 150, km: 14, type: 'uplink' },
    { from: 'osm_way_265568001',  to: 'surabaya_timur_150',     voltage: 150, km: 18, type: 'uplink' },
    { from: 'osm_way_265568001',  to: 'sidoarjo_150',           voltage: 150, km: 12, type: 'uplink' },
    { from: 'osm_way_265568001',  to: 'mojokerto_150',          voltage: 150, km: 22, type: 'uplink' },
    { from: 'osm_way_299352934',  to: 'probolinggo_150',        voltage: 150, km: 18, type: 'uplink' },

    // -------- 20 kV — Surabaya south cluster --------
    { from: 'surabaya_selatan_150', to: 'telkomsigma_surabaya', voltage: 20, km: 2.2, type: 'feeder' },
    { from: 'surabaya_selatan_150', to: 'neucentrix_surabaya',  voltage: 20, km: 2.3, type: 'feeder' },

    // -------- 20 kV — Surabaya east / CBD cluster --------
    { from: 'surabaya_timur_150', to: 'lintasarta_surabaya',    voltage: 20, km: 2.6, type: 'feeder' },
    { from: 'surabaya_timur_150', to: 'eqix_sub_peer',          voltage: 20, km: 2.8, type: 'feeder' },
    { from: 'surabaya_timur_150', to: 'iconplus_surabaya',      voltage: 20, km: 2.9, type: 'feeder' },
    { from: 'surabaya_timur_150', to: 'ind_tj_perak',           voltage: 20, km: 6.5, type: 'industrial' },
    { from: 'surabaya_timur_150', to: 'ind_madura',             voltage: 20, km: 28,  type: 'industrial' },

    // -------- 20 kV — Gresik cluster --------
    { from: 'osm_way_311479837',  to: 'ind_petrokimia_gresik',  voltage: 20, km: 1.5, type: 'industrial' },
    { from: 'osm_way_311479837',  to: 'ind_semen_gresik',       voltage: 20, km: 2.0, type: 'industrial' },

    // -------- 20 kV — Sidoarjo / Pasuruan / Mojokerto --------
    { from: 'sidoarjo_150',       to: 'ind_sidoarjo_petrochem', voltage: 20, km: 1.8, type: 'industrial' },
    { from: 'osm_way_1419292543', to: 'ind_pasuruan_pier',      voltage: 20, km: 12,  type: 'industrial' },
    { from: 'mojokerto_150',      to: 'ind_mojokerto_ngoro',    voltage: 20, km: 1.4, type: 'industrial' },

    // -------- 20 kV — Tuban (cement + coal terminal) --------
    { from: 'osm_way_398909640',  to: 'ind_semen_tuban',        voltage: 20, km: 36,  type: 'industrial' },
    { from: 'osm_way_398909640',  to: 'ind_tj_awar',            voltage: 20, km: 28,  type: 'industrial' },

    // -------- 20 kV — Probolinggo / Paiton / Banyuwangi --------
    { from: 'probolinggo_150',    to: 'ind_paiton_terminal',    voltage: 20, km: 4.5, type: 'industrial' },
    { from: 'osm_way_299352934',  to: 'ind_banyuwangi_geo',     voltage: 20, km: 78,  type: 'industrial' }
  ]
};
