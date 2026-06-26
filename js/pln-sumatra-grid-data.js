/* PLN Sumatra Interconnected Grid — curated dataset v2026-06-26
 * ----------------------------------------------------------------------------
 * The Sumatra 150/275 kV interconnected system (north→south backbone) plus the
 * separate Batam-Bintan (Barelang) 150 kV island grid operated by PLN Batam
 * (b'right PLN Batam), which is NOT synchronously tied to the mainland.
 *
 * Sources (curated, NOT a full topology crawl — for visualization):
 *   RUPTL PLN 2025-2034 ; PLN Annual Report 2024 ; PLN UIP Sumbagut/Sumbagsel
 *   filings ; Wikipedia plant infoboxes for geocoding ; public DC-operator
 *   filings (Batam/Medan/Palembang edge clusters). Coordinates are city/plant
 *   centroids — approximate. confidence: high=published address/filing,
 *   medium=area geocoded, low=inferred/centroid.
 *
 * Medco note: Medco Power operates the Panaran gas-fired plants in Batam and
 * holds gas assets feeding power in South Sumatra/Riau (tagged operator:'Medco').
 *
 * Schema mirrors js/pln-java-grid-data*.js: nodes[{id,name,kind,voltage,...,lat,lng}],
 * edges[{from,to,voltage,...}]. kind = station | plant | dc.
 */
window.PLN_SUMATRA_GRID = {
  version: '2026-06-26',
  system: 'sumatra',
  disclaimer: 'Curated visualization from RUPTL 2025-2034 / PLN AR 2024 / public sources. Coordinates approximate; not an operational topology.',

  nodes: [
    /* ===================== NORTH (Sumbagut: Aceh + North Sumatra) ===================== */
    { id: 'banda_aceh_150', name: 'GI Banda Aceh', kind: 'station', voltage: 150, mva: 120, prov: 'Aceh', lat: 5.5483, lng: 95.3238, confidence: 'medium', notes: 'Aceh metro 150 kV anchor; northern end of the Sumatra backbone.' },
    { id: 'arun_lhokseumawe', name: 'GI Arun / Lhokseumawe', kind: 'station', voltage: 150, mva: 150, prov: 'Aceh', lat: 5.1870, lng: 97.1413, confidence: 'medium', notes: 'Arun industrial (ex-LNG) + Lhokseumawe load.' },
    { id: 'pangkalan_susu_pltu', name: 'PLTU Pangkalan Susu', kind: 'plant', fuel: 'coal', mw: 800, voltage: 275, prov: 'North Sumatra', lat: 4.1180, lng: 98.2160, confidence: 'high', notes: '2x200 + 2x200 MW coal; major North Sumatra base-load.' },
    { id: 'binjai_275', name: 'GITET Binjai', kind: 'station', voltage: 275, mva: 500, prov: 'North Sumatra', lat: 3.6000, lng: 98.4850, confidence: 'medium', notes: '275 kV backbone node west of Medan.' },
    { id: 'galang_275', name: 'GITET Galang', kind: 'station', voltage: 275, mva: 500, prov: 'North Sumatra', lat: 3.4300, lng: 99.0800, confidence: 'medium', notes: 'Medan-area 275 kV hub; Kualanamu / industrial evacuation.' },
    { id: 'medan_150', name: 'GI Medan (metro)', kind: 'station', voltage: 150, mva: 500, prov: 'North Sumatra', lat: 3.5952, lng: 98.6722, confidence: 'medium', notes: 'Medan metropolitan distribution + edge DC cluster.' },
    { id: 'belawan_pltgu', name: 'PLTGU Belawan', kind: 'plant', fuel: 'gas', mw: 1100, voltage: 150, prov: 'North Sumatra', lat: 3.7800, lng: 98.6900, confidence: 'high', notes: 'Belawan combined-cycle gas; Medan grid support.' },
    { id: 'asahan_hydro', name: 'PLTA Asahan (Sigura-gura + Tangga)', kind: 'plant', fuel: 'hydro', mw: 603, voltage: 150, prov: 'North Sumatra', lat: 2.6300, lng: 99.1200, confidence: 'high', notes: 'Asahan river hydro; Inalum smelter + grid.' },
    { id: 'medan_dc', name: 'Medan edge DC cluster', kind: 'dc', operator: 'mixed', mw: 15, voltage: 20, prov: 'North Sumatra', lat: 3.5850, lng: 98.6750, confidence: 'low', feed_from: 'medan_150', notes: 'Telkom/Lintasarta edge sites; approximate.' },

    /* ===================== CENTRE (Sumbagteng: Riau + West Sumatra + Jambi) ===================== */
    { id: 'garuda_sakti_275', name: 'GITET Garuda Sakti (Pekanbaru)', kind: 'station', voltage: 275, mva: 500, prov: 'Riau', lat: 0.4720, lng: 101.3700, confidence: 'medium', notes: 'Pekanbaru 275 kV hub; central backbone.' },
    { id: 'pekanbaru_150', name: 'GI Pekanbaru', kind: 'station', voltage: 150, mva: 300, prov: 'Riau', lat: 0.5071, lng: 101.4478, confidence: 'medium', notes: 'Riau capital metro + Dumai corridor.' },
    { id: 'balai_pungut_medco', name: 'PLTG Balai Pungut / Riau gas (Medco)', kind: 'plant', fuel: 'gas', mw: 130, voltage: 150, operator: 'Medco', prov: 'Riau', lat: 1.0500, lng: 101.5500, confidence: 'low', notes: 'Riau gas-fired generation; Medco E&P gas supply. Approximate.' },
    { id: 'padang_150', name: 'GI Padang (Pauh Limo)', kind: 'station', voltage: 150, mva: 300, prov: 'West Sumatra', lat: -0.9100, lng: 100.4600, confidence: 'medium', notes: 'West Sumatra capital; Singkarak/Maninjau hydro intake.' },
    { id: 'singkarak_hydro', name: 'PLTA Singkarak', kind: 'plant', fuel: 'hydro', mw: 175, voltage: 150, prov: 'West Sumatra', lat: -0.6200, lng: 100.5300, confidence: 'high', notes: 'Singkarak lake hydro.' },
    { id: 'ombilin_pltu', name: 'PLTU Ombilin', kind: 'plant', fuel: 'coal', mw: 200, voltage: 150, prov: 'West Sumatra', lat: -0.6800, lng: 100.7700, confidence: 'medium', notes: 'Sawahlunto coal (Ombilin field).' },
    { id: 'aur_duri_275', name: 'GITET New Aur Duri (Jambi)', kind: 'station', voltage: 275, mva: 500, prov: 'Jambi', lat: -1.6100, lng: 103.6100, confidence: 'medium', notes: 'Jambi 275 kV backbone node.' },

    /* ===================== SOUTH (Sumbagsel: South Sumatra + Bengkulu + Lampung) ===================== */
    { id: 'muara_enim_275', name: 'GITET Muara Enim', kind: 'station', voltage: 275, mva: 500, prov: 'South Sumatra', lat: -3.6600, lng: 103.7700, confidence: 'medium', notes: 'Mine-mouth hub near Bukit Asam; south backbone.' },
    { id: 'bukit_asam_pltu', name: 'PLTU Bukit Asam (Tanjung Enim)', kind: 'plant', fuel: 'coal', mw: 1900, voltage: 275, prov: 'South Sumatra', lat: -3.7300, lng: 103.7800, confidence: 'high', notes: 'Mine-mouth coal (Sumsel-8 etc.); largest South Sumatra base-load.' },
    { id: 'palembang_150', name: 'GI Palembang', kind: 'station', voltage: 150, mva: 500, prov: 'South Sumatra', lat: -2.9760, lng: 104.7750, confidence: 'medium', notes: 'South Sumatra capital metro + edge DC.' },
    { id: 'gunung_megang_medco', name: 'PLTGU Gunung Megang / Sumsel gas (Medco)', kind: 'plant', fuel: 'gas', mw: 80, voltage: 150, operator: 'Medco', prov: 'South Sumatra', lat: -3.5800, lng: 104.0500, confidence: 'low', notes: 'South Sumatra gas-fired; Medco E&P Sumatra gas supply. Approximate.' },
    { id: 'lubuk_linggau_275', name: 'GITET Lubuk Linggau', kind: 'station', voltage: 275, mva: 250, prov: 'South Sumatra', lat: -3.2960, lng: 102.8610, confidence: 'low', notes: 'West-south backbone tie toward Bengkulu.' },
    { id: 'bengkulu_150', name: 'GI Bengkulu', kind: 'station', voltage: 150, mva: 150, prov: 'Bengkulu', lat: -3.7900, lng: 102.2600, confidence: 'medium', notes: 'Bengkulu coastal load; PLTU Pulau Baai.' },
    { id: 'sutami_275', name: 'GITET Sutami (Lampung)', kind: 'station', voltage: 275, mva: 500, prov: 'Lampung', lat: -5.2900, lng: 105.5800, confidence: 'medium', notes: 'Lampung 275 kV hub; southern end of backbone.' },
    { id: 'tarahan_pltu', name: 'PLTU Tarahan', kind: 'plant', fuel: 'coal', mw: 200, voltage: 150, prov: 'Lampung', lat: -5.5300, lng: 105.3000, confidence: 'high', notes: 'Tarahan coal near Bandar Lampung.' },
    { id: 'bandar_lampung_150', name: 'GI Bandar Lampung', kind: 'station', voltage: 150, mva: 300, prov: 'Lampung', lat: -5.4290, lng: 105.2610, confidence: 'medium', notes: 'Lampung capital; future HVDC link to Java (Sumatra-Java interconnection).' },

    /* ===================== BATAM-BINTAN (Barelang) — SEPARATE ISLAND GRID ===================== */
    { id: 'batam_centre_150', name: 'GI Batam Centre', kind: 'station', voltage: 150, mva: 300, prov: 'Riau Islands', lat: 1.1180, lng: 104.0480, confidence: 'medium', island: true, notes: 'Batam island 150 kV core (b\'right PLN Batam) — separate from the mainland grid.' },
    { id: 'tanjung_uncang_150', name: 'GI Tanjung Uncang', kind: 'station', voltage: 150, mva: 250, prov: 'Riau Islands', lat: 1.0860, lng: 103.9300, confidence: 'medium', island: true, notes: 'Batam industrial/shipyard west; Barelang ring.' },
    { id: 'panaran_medco', name: 'PLTGU Panaran (Medco Power)', kind: 'plant', fuel: 'gas', mw: 165, voltage: 150, operator: 'Medco', prov: 'Riau Islands', lat: 1.0720, lng: 104.0220, confidence: 'high', island: true, notes: 'Panaran I & II gas-fired, operated by Medco Power — the Batam grid\'s key gas base-load.' },
    { id: 'tanjung_kasam_pltu', name: 'PLTU Tanjung Kasam', kind: 'plant', fuel: 'coal', mw: 110, voltage: 150, prov: 'Riau Islands', lat: 1.1300, lng: 104.1300, confidence: 'medium', island: true, notes: 'Batam coal base-load (Medco-linked operation).' },
    { id: 'batam_dc', name: 'Batam DC cluster (Nongsa / data island)', kind: 'dc', operator: 'mixed', mw: 40, voltage: 20, prov: 'Riau Islands', lat: 1.1700, lng: 104.0980, confidence: 'medium', island: true, feed_from: 'batam_centre_150', notes: 'Nongsa Digital Park subsea-cable DC hub (Singapore-adjacent); growing AI/edge load.' },
    { id: 'tanjung_uban_150', name: 'GI Tanjung Uban (Bintan)', kind: 'station', voltage: 150, mva: 120, prov: 'Riau Islands', lat: 1.0660, lng: 104.2240, confidence: 'low', island: true, notes: 'Bintan island; tied to Batam via Barelang submarine cable.' }
  ],

  edges: [
    /* 275 kV north→south backbone */
    { from: 'pangkalan_susu_pltu', to: 'binjai_275', voltage: 275 },
    { from: 'binjai_275', to: 'galang_275', voltage: 275 },
    { from: 'galang_275', to: 'garuda_sakti_275', voltage: 275, note: 'long inter-regional 275 kV' },
    { from: 'garuda_sakti_275', to: 'aur_duri_275', voltage: 275 },
    { from: 'aur_duri_275', to: 'muara_enim_275', voltage: 275 },
    { from: 'muara_enim_275', to: 'lubuk_linggau_275', voltage: 275 },
    { from: 'muara_enim_275', to: 'sutami_275', voltage: 275 },
    { from: 'bukit_asam_pltu', to: 'muara_enim_275', voltage: 275 },
    /* 150 kV regional ties */
    { from: 'binjai_275', to: 'medan_150', voltage: 150 },
    { from: 'galang_275', to: 'medan_150', voltage: 150 },
    { from: 'medan_150', to: 'belawan_pltgu', voltage: 150 },
    { from: 'asahan_hydro', to: 'galang_275', voltage: 150 },
    { from: 'banda_aceh_150', to: 'arun_lhokseumawe', voltage: 150 },
    { from: 'arun_lhokseumawe', to: 'pangkalan_susu_pltu', voltage: 150, note: 'Aceh tie to North Sumatra' },
    { from: 'garuda_sakti_275', to: 'pekanbaru_150', voltage: 150 },
    { from: 'pekanbaru_150', to: 'balai_pungut_medco', voltage: 150 },
    { from: 'garuda_sakti_275', to: 'padang_150', voltage: 150, note: 'central cross-island tie' },
    { from: 'padang_150', to: 'singkarak_hydro', voltage: 150 },
    { from: 'padang_150', to: 'ombilin_pltu', voltage: 150 },
    { from: 'muara_enim_275', to: 'palembang_150', voltage: 150 },
    { from: 'palembang_150', to: 'gunung_megang_medco', voltage: 150 },
    { from: 'lubuk_linggau_275', to: 'bengkulu_150', voltage: 150 },
    { from: 'sutami_275', to: 'bandar_lampung_150', voltage: 150 },
    { from: 'bandar_lampung_150', to: 'tarahan_pltu', voltage: 150 },
    /* Batam-Bintan island ring (separate) */
    { from: 'panaran_medco', to: 'batam_centre_150', voltage: 150, island: true },
    { from: 'batam_centre_150', to: 'tanjung_uncang_150', voltage: 150, island: true },
    { from: 'tanjung_kasam_pltu', to: 'batam_centre_150', voltage: 150, island: true },
    { from: 'batam_centre_150', to: 'batam_dc', voltage: 20, island: true },
    { from: 'tanjung_uncang_150', to: 'tanjung_uban_150', voltage: 150, island: true, note: 'Barelang submarine cable to Bintan' }
  ]
};
