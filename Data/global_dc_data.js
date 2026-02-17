/**
 * Global Data Center Capacity Database 2025-2026
 *
 * Sources (with confidence tiers):
 * ─────────────────────────────────────────────────────────────────────────────
 * [T1] Synergy Research Group — Hyperscale Market Tracker Q3 2025
 * [T1] Company Annual Reports / SEC Filings / Earnings Calls (Equinix Q4 2025,
 *       Digital Realty Q3 2025, NTT, GDS, VNET, Keppel, CoreSite/American Tower)
 * [T2] CBRE — Global Data Center Trends 2025 & North America H1 2025
 * [T2] JLL — 2026 Global Data Center Outlook & North America Midyear 2025
 * [T2] Cushman & Wakefield — 2025 Global Data Center Market Comparison,
 *       EMEA H1 2025, APAC H2 2025
 * [T2] Datacenter Dynamics, DatacenterKnowledge, Data Center Frontier
 * [T3] Blackridge Research, Brightlio, Cargoson, RankRed, Visual Capitalist
 * [T3] Arizton, Mordor Intelligence, MarketsAndMarkets, ResearchAndMarkets
 *
 * Compiled: 2026-02-17
 * Methodology notes:
 * - MW figures represent IT load capacity (not total facility power) unless noted
 * - Where only total facility power was available, IT load estimated at ~70% of total
 * - Some hyperscaler capacities are estimated from capex, Synergy proportional data,
 *   and company disclosures; exact figures are proprietary
 * - "est." suffix denotes analyst/synthesized estimates with medium confidence
 * - Country-level MW aggregates include colocation, hyperscale, and enterprise DCs
 * - Facility counts from Cargoson (Nov 2025), cross-referenced with CBRE/JLL
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: TOP DATA CENTER OPERATORS WORLDWIDE
// ═══════════════════════════════════════════════════════════════════════════════

const globalDCOperators = [
  // ─── HYPERSCALERS (Self-built infrastructure) ───────────────────────────────
  {
    rank: 1,
    company: 'Amazon Web Services (AWS)',
    hq: 'United States',
    type: 'Hyperscale',
    totalCapacityMW: 7500,          // est. based on Synergy 58% share of hyperscale with MSFT+GOOG
    capacityNote: 'Estimated from Synergy proportional share; exact figure proprietary',
    facilities: 130,                // est. across 38 regions, 100+ AZs
    countries: 27,
    regions: 38,
    keyMarkets: ['Northern Virginia', 'Oregon', 'Ohio', 'Ireland', 'Frankfurt', 'Singapore', 'Tokyo', 'Mumbai', 'Sao Paulo', 'Sydney'],
    capex2025B: 105,                // ~$105B planned
    source: 'Synergy Research Q3 2025, AWS infrastructure page, DCK Jan 2026'
  },
  {
    rank: 2,
    company: 'Microsoft Azure',
    hq: 'United States',
    type: 'Hyperscale',
    totalCapacityMW: 7000,          // est.; 400+ DCs, 70+ regions
    capacityNote: 'Estimated; Microsoft disclosed 400+ DCs globally as of Q4 2025',
    facilities: 400,
    countries: 60,
    regions: 70,
    keyMarkets: ['Northern Virginia', 'Chicago', 'San Antonio', 'Dublin', 'Amsterdam', 'Singapore', 'Phoenix', 'Atlanta', 'Wisconsin'],
    capex2025B: 95,
    source: 'Microsoft FY2025 annual report, Synergy Research, DCK Jan 2026'
  },
  {
    rank: 3,
    company: 'Google Cloud',
    hq: 'United States',
    type: 'Hyperscale',
    totalCapacityMW: 5500,          // est. from Synergy 58% combined share
    capacityNote: 'Estimated from Synergy proportional data; 42 regions, 127 AZs',
    facilities: 100,                // est. across 42 regions
    countries: 25,
    regions: 42,
    keyMarkets: ['The Dalles (Oregon)', 'Council Bluffs (Iowa)', 'Hamina (Finland)', 'Singapore', 'Taiwan', 'Netherlands', 'Chile', 'London'],
    capex2025B: 75,
    source: 'Synergy Research Q3 2025, Google Cloud infrastructure page'
  },
  {
    rank: 4,
    company: 'Meta Platforms',
    hq: 'United States',
    type: 'Hyperscale',
    totalCapacityMW: 4500,          // est.; targeting 10+ GW by 2026
    capacityNote: '30 operational DCs; massive expansion to 10+ GW announced for 2026',
    facilities: 30,
    countries: 6,
    regions: 15,
    keyMarkets: ['Prineville (Oregon)', 'Altoona (Iowa)', 'Fort Worth (Texas)', 'Lulea (Sweden)', 'Clonee (Ireland)', 'Louisiana (Hyperion)'],
    capex2025B: 72,
    source: 'Meta Q3 2025 earnings, DCK Jan 2026, Synergy Research'
  },
  {
    rank: 5,
    company: 'Alibaba Cloud',
    hq: 'China',
    type: 'Hyperscale',
    totalCapacityMW: 2800,          // est. from China market share + international
    capacityNote: 'China AI cloud market leader; 87 AZs across 29 regions',
    facilities: 85,                 // est.
    countries: 15,
    regions: 29,
    keyMarkets: ['Hangzhou', 'Shanghai', 'Beijing', 'Zhangjiakou', 'Singapore', 'Kuala Lumpur', 'Jakarta', 'Tokyo', 'Mumbai'],
    capex2025B: 23,
    source: 'Alibaba FY2025 earnings, SCMP, Mordor Intelligence'
  },
  {
    rank: 6,
    company: 'Oracle',
    hq: 'United States',
    type: 'Hyperscale',
    totalCapacityMW: 2200,          // est.; 147 active DCs + 64 under development
    capacityNote: '147 active cloud regions/DCs; 64 under development; Stargate partner',
    facilities: 147,
    countries: 40,
    regions: 50,
    keyMarkets: ['Abilene (Texas)', 'Ashburn (Virginia)', 'Phoenix', 'Chicago', 'London', 'Amsterdam', 'Tokyo', 'Sao Paulo'],
    capex2025B: 25,
    source: 'Oracle Q2 FY2026 earnings, DCK Jan 2026'
  },
  {
    rank: 7,
    company: 'Tencent Cloud',
    hq: 'China',
    type: 'Hyperscale',
    totalCapacityMW: 1800,          // est.
    capacityNote: 'Major China hyperscaler; 8 DCs in Southeast Asia alone',
    facilities: 70,                 // est.
    countries: 12,
    regions: 25,
    keyMarkets: ['Shenzhen', 'Shanghai', 'Beijing', 'Guangzhou', 'Singapore', 'Tokyo', 'Frankfurt', 'Silicon Valley'],
    capex2025B: 15,
    source: 'Tencent annual report, SCMP, DCD'
  },
  {
    rank: 8,
    company: 'ByteDance / Volcano Engine',
    hq: 'China',
    type: 'Hyperscale',
    totalCapacityMW: 1200,          // est.
    capacityNote: '14.8% of China AI cloud market; aggressive expansion',
    facilities: 40,                 // est.
    countries: 8,
    regions: 15,
    keyMarkets: ['Beijing', 'Shanghai', 'Singapore', 'Virginia', 'Jakarta', 'Dublin'],
    capex2025B: 14,
    source: 'SCMP, Dataconomy Jan 2026, DCD'
  },
  {
    rank: 9,
    company: 'Apple',
    hq: 'United States',
    type: 'Hyperscale',
    totalCapacityMW: 1000,          // est.
    capacityNote: 'Primarily self-built; Mesa AZ campus 1.3M sqft',
    facilities: 12,                 // est. owned + leased
    countries: 5,
    regions: 8,
    keyMarkets: ['Mesa (Arizona)', 'Maiden (North Carolina)', 'Reno (Nevada)', 'Waukee (Iowa)', 'Viborg (Denmark)'],
    capex2025B: 8,
    source: 'Apple sustainability report, Brightlio'
  },

  // ─── COLOCATION / WHOLESALE OPERATORS ───────────────────────────────────────
  {
    rank: 10,
    company: 'Equinix',
    hq: 'United States',
    type: 'Colocation',
    totalCapacityMW: 3000,          // est. total portfolio; 3GW developable capacity announced
    capacityNote: '260 DCs, 33 countries; 3GW total developable capacity; doubling by 2029',
    facilities: 260,
    countries: 33,
    keyMarkets: ['Northern Virginia', 'Silicon Valley', 'Dallas', 'Amsterdam', 'Frankfurt', 'London', 'Singapore', 'Tokyo', 'Sydney', 'Sao Paulo'],
    capex2025B: 4.2,
    source: 'Equinix Q4 2025 earnings (Feb 2026), Equinix newsroom'
  },
  {
    rank: 11,
    company: 'Digital Realty',
    hq: 'United States',
    type: 'Colocation / Wholesale',
    totalCapacityMW: 2760,
    capacityNote: '2,760 MW existing + 3,500 MW buildable as of Q1 2025',
    facilities: 300,
    countries: 25,
    keyMarkets: ['Northern Virginia', 'Dallas', 'Chicago', 'Silicon Valley', 'Amsterdam', 'Frankfurt', 'London', 'Singapore', 'Tokyo', 'Marseille'],
    capex2025B: 3.8,
    source: 'Digital Realty Q3 2025 earnings, Wikipedia, investor.digitalrealty.com'
  },
  {
    rank: 12,
    company: 'NTT Global Data Centers',
    hq: 'Japan',
    type: 'Colocation / Wholesale',
    totalCapacityMW: 2100,
    capacityNote: '2,100 MW critical IT load; 150+ facilities across 20+ countries',
    facilities: 150,
    countries: 20,
    keyMarkets: ['Tokyo', 'Osaka', 'London', 'Frankfurt', 'Amsterdam', 'Virginia', 'Mumbai', 'Singapore', 'Sydney', 'Jakarta'],
    capex2025B: 3.5,
    source: 'NTT GDC website, Caeled Jan 2025, DCD'
  },
  {
    rank: 13,
    company: 'Vantage Data Centers',
    hq: 'United States',
    type: 'Hyperscale / Wholesale',
    totalCapacityMW: 2600,
    capacityNote: '2.6GW planned+existing globally; Shackelford TX 1.4GW project',
    facilities: 35,
    countries: 6,
    keyMarkets: ['Northern Virginia', 'Phoenix', 'Santa Clara', 'Montreal', 'Zurich', 'Berlin', 'Johannesburg', 'Melbourne'],
    capex2025B: 5.0,
    source: 'Data Centre Magazine, DCK, Vantage press releases'
  },
  {
    rank: 14,
    company: 'AirTrunk',
    hq: 'Australia',
    type: 'Hyperscale',
    totalCapacityMW: 1800,
    capacityNote: '1.8GW total; 11 sites APAC; acquired by Blackstone Sep 2024',
    facilities: 11,
    countries: 4,
    keyMarkets: ['Sydney', 'Melbourne', 'Singapore', 'Tokyo', 'Hong Kong'],
    capex2025B: 3.0,
    source: 'DCD, DCPulse, Blackstone press release'
  },
  {
    rank: 15,
    company: 'Lumen Technologies',
    hq: 'United States',
    type: 'Colocation / Enterprise',
    totalCapacityMW: 1200,
    capacityNote: '55 facilities across North America and Europe',
    facilities: 55,
    countries: 8,
    keyMarkets: ['Denver', 'Minneapolis', 'Phoenix', 'London', 'Amsterdam', 'Singapore'],
    capex2025B: 1.5,
    source: 'Lumen IR, SparkCo analysis'
  },
  {
    rank: 16,
    company: 'CyrusOne',
    hq: 'United States',
    type: 'Colocation / Wholesale',
    totalCapacityMW: 1000,
    capacityNote: '55+ DCs; ~1GW power capacity',
    facilities: 55,
    countries: 3,
    keyMarkets: ['Dallas', 'Houston', 'Northern Virginia', 'Phoenix', 'Chicago', 'London', 'Frankfurt', 'Amsterdam'],
    capex2025B: 2.0,
    source: 'CyrusOne website, BusinessWire, DCD'
  },
  {
    rank: 17,
    company: 'QTS Realty Trust (Blackstone)',
    hq: 'United States',
    type: 'Hyperscale / Wholesale',
    totalCapacityMW: 950,
    capacityNote: '63 DCs; 9.35M sqft; Atlanta campus 278 MW flagship',
    facilities: 63,
    countries: 2,
    keyMarkets: ['Atlanta', 'Dallas', 'Chicago', 'Northern Virginia', 'Phoenix', 'Hillsboro', 'Eemshaven (Netherlands)'],
    capex2025B: 2.5,
    source: 'QTS website, Blackridge Research'
  },
  {
    rank: 18,
    company: 'VNET Group (21Vianet)',
    hq: 'China',
    type: 'Colocation / Wholesale',
    totalCapacityMW: 783,
    capacityNote: '783 MW wholesale in service + 306 MW under construction as of Q3 2025',
    facilities: 52,                 // 52,288 retail cabinets
    countries: 1,
    keyMarkets: ['Beijing', 'Shanghai', 'Shenzhen', 'Hebei', 'Inner Mongolia'],
    capex2025B: 1.0,
    source: 'VNET Q3 2025 earnings release'
  },
  {
    rank: 19,
    company: 'GDS Holdings',
    hq: 'China',
    type: 'Colocation / Hyperscale',
    totalCapacityMW: 750,
    capacityNote: '102 self-developed DCs in China; SE Asia expansion via DayOne (750MW committed)',
    facilities: 102,
    countries: 5,
    keyMarkets: ['Shanghai', 'Beijing', 'Shenzhen', 'Guangzhou', 'Johor', 'Batam', 'Nongsa'],
    capex2025B: 2.0,
    source: 'GDS Q2 2025 earnings, EqualOcean, investors.gds-services.com'
  },
  {
    rank: 20,
    company: 'Keppel Data Centres',
    hq: 'Singapore',
    type: 'Colocation / Wholesale',
    totalCapacityMW: 650,
    capacityNote: '35 facilities; 650MW capacity; targeting 1.2GW',
    facilities: 35,
    countries: 8,
    keyMarkets: ['Singapore', 'Dublin', 'London', 'Amsterdam', 'Johor', 'Sydney', 'Jakarta'],
    capex2025B: 1.5,
    source: 'Keppel DC website, DCD, Data Centre Magazine'
  },
  {
    rank: 21,
    company: 'Switch (DigitalBridge)',
    hq: 'United States',
    type: 'Hyperscale / Wholesale',
    totalCapacityMW: 650,
    capacityNote: 'Citadel Campus 650MW — largest operational DC in the world',
    facilities: 8,
    countries: 2,
    keyMarkets: ['Las Vegas (Citadel)', 'Las Vegas (SuperNAP)', 'Reno', 'Grand Rapids', 'Atlanta', 'Milan'],
    capex2025B: 1.8,
    source: 'Switch website, Blackridge Research, Data Center Frontier'
  },
  {
    rank: 22,
    company: 'Yondr Group',
    hq: 'Netherlands',
    type: 'Hyperscale / Wholesale',
    totalCapacityMW: 450,
    capacityNote: '450MW+ built capacity; 550MW Dallas campus planned',
    facilities: 10,
    countries: 6,
    keyMarkets: ['Northern Virginia', 'Dallas', 'London', 'Frankfurt', 'Paris', 'Johannesburg'],
    capex2025B: 2.5,
    source: 'Yondr Group website, DCD'
  },
  {
    rank: 23,
    company: 'Iron Mountain Data Centers',
    hq: 'United States',
    type: 'Colocation',
    totalCapacityMW: 400,           // est.
    capacityNote: '30+ locations globally; NJE-1 facility 25.6 MW',
    facilities: 30,
    countries: 10,
    keyMarkets: ['Northern Virginia', 'New Jersey', 'Phoenix', 'Denver', 'Amsterdam', 'London', 'Singapore', 'Frankfurt'],
    capex2025B: 1.2,
    source: 'Iron Mountain website, Blackridge Research, DCD'
  },
  {
    rank: 24,
    company: 'STACK Infrastructure',
    hq: 'United States',
    type: 'Hyperscale / Wholesale',
    totalCapacityMW: 380,           // est.
    capacityNote: 'Major US wholesale provider; expanding to SE Asia and Europe',
    facilities: 25,
    countries: 5,
    keyMarkets: ['Northern Virginia', 'Dallas', 'Chicago', 'Silicon Valley', 'Atlanta', 'Milan', 'Johor'],
    capex2025B: 1.5,
    source: 'STACK website, ResearchAndMarkets US DC Colocation 2025-2030'
  },
  {
    rank: 25,
    company: 'Compass Datacenters',
    hq: 'United States',
    type: 'Hyperscale / Wholesale',
    totalCapacityMW: 360,
    capacityNote: '360MW Red Oak (DFW) + 320MW Mississippi campus',
    facilities: 15,
    countries: 3,
    keyMarkets: ['Dallas-Fort Worth', 'Northern Virginia', 'Phoenix', 'Mississippi', 'Montreal', 'Toronto'],
    capex2025B: 2.0,
    source: 'Compass website, DCD, DCK'
  },
  {
    rank: 26,
    company: 'CoreSite (American Tower)',
    hq: 'United States',
    type: 'Colocation',
    totalCapacityMW: 253,
    capacityNote: '28 DCs; 253.1 MW; 3.6M sqft net rentable; subsidiary of American Tower',
    facilities: 28,
    countries: 1,
    keyMarkets: ['Northern Virginia', 'Silicon Valley', 'Los Angeles', 'Denver', 'Chicago', 'New York/New Jersey', 'Boston'],
    capex2025B: 0.8,
    source: 'CoreSite/American Tower Q3 2025 earnings'
  },
  {
    rank: 27,
    company: 'Flexential',
    hq: 'United States',
    type: 'Colocation / Hybrid',
    totalCapacityMW: 220,
    capacityNote: '220+ MW; 3M sqft across US',
    facilities: 40,
    countries: 1,
    keyMarkets: ['Portland', 'Denver', 'Dallas', 'Charlotte', 'Tampa', 'Nashville', 'Austin'],
    capex2025B: 0.5,
    source: 'Flexential website, Brightlio'
  },
  {
    rank: 28,
    company: 'Aligned Data Centers',
    hq: 'United States',
    type: 'Hyperscale / Wholesale',
    totalCapacityMW: 200,           // est.
    capacityNote: 'Known for adaptive cooling; major US markets',
    facilities: 12,
    countries: 1,
    keyMarkets: ['Northern Virginia', 'Dallas', 'Phoenix', 'Chicago', 'Salt Lake City'],
    capex2025B: 1.0,
    source: 'Aligned website, US DC Colocation Market 2025-2030'
  },
  {
    rank: 29,
    company: 'Scala Data Centers',
    hq: 'Brazil',
    type: 'Hyperscale / Colocation',
    totalCapacityMW: 180,           // est.
    capacityNote: 'Largest independent DC provider in Latin America',
    facilities: 15,
    countries: 3,
    keyMarkets: ['Sao Paulo', 'Rio de Janeiro', 'Santiago', 'Bogota'],
    capex2025B: 0.8,
    source: 'Scala website, APAC/LATAM market reports'
  },
  {
    rank: 30,
    company: 'EdgeConneX',
    hq: 'United States',
    type: 'Edge / Colocation',
    totalCapacityMW: 170,           // est. from 80+ DC portfolio
    capacityNote: '80+ DCs across 50+ markets worldwide',
    facilities: 80,
    countries: 20,
    keyMarkets: ['Northern Virginia', 'Portland', 'Amsterdam', 'Jakarta', 'Santiago', 'Lima', 'Dublin'],
    capex2025B: 0.7,
    source: 'EdgeConneX website, GlobeNewsWire'
  },
  {
    rank: 31,
    company: 'DataBank',
    hq: 'United States',
    type: 'Colocation / Edge',
    totalCapacityMW: 150,           // est.
    capacityNote: 'Major US edge/colo provider; DigitalBridge portfolio',
    facilities: 65,
    countries: 1,
    keyMarkets: ['Dallas', 'Minneapolis', 'Salt Lake City', 'Atlanta', 'Denver', 'Pittsburgh'],
    capex2025B: 0.4,
    source: 'DataBank website, US DC reports'
  },
  {
    rank: 32,
    company: 'Chindata / WinTriX DC',
    hq: 'China',
    type: 'Hyperscale',
    totalCapacityMW: 650,           // est. combined portfolio
    capacityNote: 'Merged with Bridge Data Centres to form WinTriX DC (Bain Capital)',
    facilities: 30,
    countries: 5,
    keyMarkets: ['Beijing', 'Datong', 'Hebei', 'Johor', 'Cyberjaya', 'Mumbai'],
    capex2025B: 1.2,
    source: 'DCD, GlobeNewsWire, Bain Capital'
  },
  {
    rank: 33,
    company: 'ST Telemedia Global DC (STT GDC)',
    hq: 'Singapore',
    type: 'Colocation / Wholesale',
    totalCapacityMW: 500,           // est.
    capacityNote: 'Major APAC operator; Temasek-backed',
    facilities: 40,
    countries: 10,
    keyMarkets: ['Singapore', 'London', 'Bangkok', 'Mumbai', 'Guangzhou', 'Seoul', 'Jakarta'],
    capex2025B: 1.0,
    source: 'STT GDC website, Data Centre Magazine APAC Top 10'
  },
  {
    rank: 34,
    company: 'Sabey Data Centers',
    hq: 'United States',
    type: 'Colocation / Wholesale',
    totalCapacityMW: 130,
    capacityNote: 'Intergate campuses; 70+ MW Seattle facility',
    facilities: 5,
    countries: 1,
    keyMarkets: ['Seattle', 'New York', 'Ashburn'],
    capex2025B: 0.3,
    source: 'Sabey website, Brightlio, RankRed'
  },
  {
    rank: 35,
    company: 'Princeton Digital Group',
    hq: 'Singapore',
    type: 'Hyperscale / Colocation',
    totalCapacityMW: 300,           // est.
    capacityNote: 'Warburg Pincus-backed; rapid APAC expansion',
    facilities: 20,
    countries: 5,
    keyMarkets: ['Jakarta', 'Mumbai', 'Tokyo', 'Shanghai', 'Singapore'],
    capex2025B: 0.8,
    source: 'Princeton Digital website, Data Centre Magazine'
  }
];


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: DATA CENTER CAPACITY BY COUNTRY
// ═══════════════════════════════════════════════════════════════════════════════

const dcCapacityByCountry = [
  {
    rank: 1,
    country: 'United States',
    totalCapacityMW: 28500,
    capacityNote: 'Approx. 50% of global capacity; 8,155 MW primary colo market H1 2025',
    facilities: 5427,
    keyCities: ['Northern Virginia (5,600 MW)', 'Dallas-Fort Worth (1,500 MW)', 'Phoenix (2,800 MW)', 'Chicago (692 MW)', 'Silicon Valley', 'Atlanta', 'Portland'],
    growthRateYoY: 17.0,
    growthNote: 'CBRE: 43.4% YoY primary market supply growth H1 2025; 17% CAGR through 2030',
    source: 'CBRE N.America H1 2025, JLL 2026 Outlook, Brightlio'
  },
  {
    rank: 2,
    country: 'China',
    totalCapacityMW: 7050,
    capacityNote: '7,050 MW IT load 2025; 18,320 MW to be added 2025-2030',
    facilities: 449,
    keyCities: ['Beijing (28.7% share)', 'Shanghai', 'Shenzhen', 'Guangzhou', 'Hangzhou', 'Hohhot (Inner Mongolia)', 'Guiyang (Guizhou)'],
    growthRateYoY: 12.0,
    growthNote: 'CAGR ~6% to 9,370 MW by 2030; "East Data West Computing" program',
    source: 'Mordor Intelligence, Arizton, NextMSC, Cargoson'
  },
  {
    rank: 3,
    country: 'United Kingdom',
    totalCapacityMW: 2590,
    capacityNote: '2,590 MW in 2025; projected 4,750 MW by 2030',
    facilities: 523,
    keyCities: ['London (1,189 MW operational, 1,678 MW pipeline)', 'Slough', 'Manchester', 'Edinburgh'],
    growthRateYoY: 14.0,
    growthNote: 'London largest EMEA market; 83% YoY pipeline growth',
    source: 'C&W EMEA H1 2025, CBRE Global Trends 2025'
  },
  {
    rank: 4,
    country: 'Germany',
    totalCapacityMW: 1800,
    capacityNote: 'FLAPD anchor market; 120+ DCs in Frankfurt region alone',
    facilities: 529,
    keyCities: ['Frankfurt (900+ MW)', 'Berlin', 'Munich', 'Hamburg', 'Dusseldorf'],
    growthRateYoY: 13.7,
    growthNote: 'Frankfurt: 13.7% annual inventory growth — highest in FLAPD',
    source: 'C&W EMEA H1 2025, CBRE Global Trends 2025'
  },
  {
    rank: 5,
    country: 'Japan',
    totalCapacityMW: 1700,
    capacityNote: 'Tokyo projected 1,489 MW by 2026; APAC #1 planned capacity at 1.6GW',
    facilities: 222,
    keyCities: ['Tokyo (1,300+ MW)', 'Osaka', 'Inzai', 'Chiba'],
    growthRateYoY: 10.0,
    growthNote: 'Tokyo top APAC planned capacity; 35% already committed',
    source: 'CBRE Global Trends 2025, C&W APAC H2 2025'
  },
  {
    rank: 6,
    country: 'Ireland',
    totalCapacityMW: 1500,
    capacityNote: 'Dublin projected 1,471 MW by 2026; EMEA hyperscale hub',
    facilities: 55,
    keyCities: ['Dublin (1,200+ MW)'],
    growthRateYoY: 11.0,
    growthNote: 'Crossed 1GW operational threshold; grid constraints emerging',
    source: 'C&W EMEA H1 2025, JLL 2026 Outlook'
  },
  {
    rank: 7,
    country: 'Netherlands',
    totalCapacityMW: 1200,
    capacityNote: 'Expected 1,480 MW by 2030; Amsterdam is FLAP anchor',
    facilities: 298,
    keyCities: ['Amsterdam (800+ MW)', 'Schiphol-Rijk', 'Eemshaven'],
    growthRateYoY: 8.0,
    growthNote: 'Moratorium debates; growth shifting to Eemshaven',
    source: 'C&W EMEA H1 2025, CBRE, Digital Realty NL expansion'
  },
  {
    rank: 8,
    country: 'Australia',
    totalCapacityMW: 1200,
    capacityNote: 'AirTrunk 1.2GW+ planned across 5 campuses; Sydney 1,123 MW by 2026',
    facilities: 314,
    keyCities: ['Sydney (700+ MW)', 'Melbourne (500+ MW)', 'Canberra', 'Perth'],
    growthRateYoY: 15.0,
    growthNote: 'AirTrunk MEL2 352MW; strong hyperscale demand',
    source: 'CBRE, C&W APAC H2 2025, DCPulse'
  },
  {
    rank: 9,
    country: 'Singapore',
    totalCapacityMW: 1100,
    capacityNote: 'Projected 1,091 MW by 2026; most power-constrained market globally',
    facilities: 99,
    keyCities: ['Singapore (all city-state)'],
    growthRateYoY: 4.4,
    growthNote: 'Vacancy <2%; <7.2 MW available late 2024; new green DC approvals',
    source: 'CBRE Global 2025, C&W APAC, BusinessWire Singapore Portfolio 2025'
  },
  {
    rank: 10,
    country: 'France',
    totalCapacityMW: 1000,
    capacityNote: 'Paris market 11.2% annual growth — 2nd highest in FLAPD',
    facilities: 322,
    keyCities: ['Paris (700+ MW)', 'Marseille', 'Lyon'],
    growthRateYoY: 11.2,
    growthNote: 'Sovereign AI cloud driving demand',
    source: 'C&W EMEA H1 2025, CBRE'
  },
  {
    rank: 11,
    country: 'India',
    totalCapacityMW: 950,
    capacityNote: '678 MW additional capacity through 2025; 20.5% CAGR — highest in APAC',
    facilities: 153,
    keyCities: ['Mumbai (335 MW under construction)', 'Chennai', 'Hyderabad', 'Pune', 'Delhi NCR', 'Bengaluru'],
    growthRateYoY: 20.5,
    growthNote: 'Mumbai 62% capacity expansion; fastest-growing major market',
    source: 'CBRE Global 2025, C&W APAC H2 2025, Mordor Intelligence'
  },
  {
    rank: 12,
    country: 'Canada',
    totalCapacityMW: 850,
    capacityNote: 'Growing hyperscale + colo market; Quebec hydropower advantage',
    facilities: 337,
    keyCities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary'],
    growthRateYoY: 12.0,
    growthNote: 'Montreal: clean energy hub for hyperscalers',
    source: 'CBRE N.America H1 2025, JLL, Cargoson'
  },
  {
    rank: 13,
    country: 'Brazil',
    totalCapacityMW: 550,
    capacityNote: 'Sao Paulo 493 MW inventory; LATAM leader',
    facilities: 197,
    keyCities: ['Sao Paulo (493 MW)', 'Rio de Janeiro', 'Fortaleza'],
    growthRateYoY: 15.0,
    growthNote: '127% supply increase 2020-2022; continued strong growth',
    source: 'C&W Americas, CBRE, Scala Data Centers'
  },
  {
    rank: 14,
    country: 'South Korea',
    totalCapacityMW: 500,
    capacityNote: 'Growing cloud market; Samsung SDS + hyperscaler demand',
    facilities: 43,
    keyCities: ['Seoul', 'Busan', 'Incheon'],
    growthRateYoY: 10.0,
    growthNote: 'Alibaba Cloud second DC launched Jun 2025',
    source: 'CBRE APAC, Mordor Intelligence, Cargoson'
  },
  {
    rank: 15,
    country: 'Hong Kong',
    totalCapacityMW: 480,
    capacityNote: 'Dense colo market; connectivity hub for China',
    facilities: 122,
    keyCities: ['Tseung Kwan O', 'Chai Wan', 'Kwai Chung', 'Tuen Mun'],
    growthRateYoY: 6.0,
    growthNote: 'Land-constrained; some demand shifting to GBA',
    source: 'C&W APAC H2 2025, Cargoson'
  },
  {
    rank: 16,
    country: 'Italy',
    totalCapacityMW: 400,
    capacityNote: 'Milan added to FLAPD-M; growing hyperscale hub',
    facilities: 168,
    keyCities: ['Milan', 'Rome', 'Turin'],
    growthRateYoY: 12.0,
    growthNote: 'Milan joining FLAPD markets as 6th anchor',
    source: 'C&W EMEA H1 2025, Switch Milan'
  },
  {
    rank: 17,
    country: 'Malaysia',
    totalCapacityMW: 380,
    capacityNote: '41 existing + 48 upcoming DCs; Johor emerging as major hub',
    facilities: 41,
    keyCities: ['Johor (700-900 MW planned)', 'Kuala Lumpur', 'Cyberjaya', 'Selangor'],
    growthRateYoY: 25.0,
    growthNote: 'Fastest-growing SE Asian market; Johor "spillover" from Singapore',
    source: 'GlobeNewsWire Malaysia DB 2025, C&W APAC, GDS/DayOne'
  },
  {
    rank: 18,
    country: 'Indonesia',
    totalCapacityMW: 350,
    capacityNote: 'Rapidly growing; Jakarta main hub + Batam for Singapore overflow',
    facilities: 88,
    keyCities: ['Jakarta', 'Batam', 'Bekasi', 'Surabaya'],
    growthRateYoY: 18.0,
    growthNote: 'Digital sovereignty + GDS/Princeton Digital expansion',
    source: 'C&W APAC, Arizton APAC, Mordor Intelligence'
  },
  {
    rank: 19,
    country: 'Switzerland',
    totalCapacityMW: 280,
    capacityNote: 'Data sovereignty hub; financial services focus',
    facilities: 121,
    keyCities: ['Zurich', 'Geneva', 'Winterthur'],
    growthRateYoY: 7.0,
    growthNote: 'High density per capita; Vantage Zurich campus',
    source: 'C&W EMEA, Cargoson'
  },
  {
    rank: 20,
    country: 'Sweden',
    totalCapacityMW: 250,
    capacityNote: 'Cool climate + clean energy; Meta Lulea, Google new region',
    facilities: 95,
    keyCities: ['Stockholm', 'Lulea', 'Hamina-adjacent'],
    growthRateYoY: 10.0,
    growthNote: 'Nordic clean energy advantage; Google launching Sweden region 2025',
    source: 'C&W EMEA, CBRE Nordics'
  },
  {
    rank: 21,
    country: 'Spain',
    totalCapacityMW: 220,
    capacityNote: 'Emerging Southern European hub; Madrid main market',
    facilities: 144,
    keyCities: ['Madrid', 'Barcelona'],
    growthRateYoY: 15.0,
    growthNote: 'Growing hyperscale interest; subsea cable landings',
    source: 'C&W EMEA, Cargoson'
  },
  {
    rank: 22,
    country: 'Poland',
    totalCapacityMW: 200,
    capacityNote: 'CEE hub; Warsaw primary market',
    facilities: 144,
    keyCities: ['Warsaw', 'Krakow', 'Poznan'],
    growthRateYoY: 14.0,
    growthNote: 'Emerging European nearshore market',
    source: 'C&W EMEA, Cargoson'
  },
  {
    rank: 23,
    country: 'Chile',
    totalCapacityMW: 180,
    capacityNote: 'Santiago 148 MW inventory; LATAM #2 after Brazil',
    facilities: 59,
    keyCities: ['Santiago (148 MW)'],
    growthRateYoY: 12.0,
    growthNote: 'Google new region; clean energy advantage',
    source: 'C&W Americas, CBRE LATAM'
  },
  {
    rank: 24,
    country: 'Mexico',
    totalCapacityMW: 170,
    capacityNote: 'Growing nearshore market; Queretaro emerging DC hub',
    facilities: 173,
    keyCities: ['Queretaro', 'Mexico City', 'Monterrey'],
    growthRateYoY: 14.0,
    growthNote: 'Alibaba Cloud new region; nearshore US demand',
    source: 'C&W Americas, Cargoson, SCMP (Alibaba Mexico)'
  },
  {
    rank: 25,
    country: 'South Africa',
    totalCapacityMW: 120,
    capacityNote: 'Johannesburg primary market; African continent hub',
    facilities: 25,
    keyCities: ['Johannesburg', 'Cape Town'],
    growthRateYoY: 16.0,
    growthNote: 'Google Cloud South Africa launch 2025; Vantage + Yondr presence',
    source: 'C&W EMEA/MEA, Vantage press releases'
  },
  {
    rank: 26,
    country: 'UAE',
    totalCapacityMW: 110,
    capacityNote: 'Dubai + Abu Dhabi; Middle East digital hub',
    facilities: 20,
    keyCities: ['Dubai', 'Abu Dhabi'],
    growthRateYoY: 18.0,
    growthNote: 'Sovereign AI + MENA hub positioning',
    source: 'JLL 2026 Outlook (emerging ME markets), C&W'
  },
  {
    rank: 27,
    country: 'Russia',
    totalCapacityMW: 350,
    capacityNote: 'Domestic market; limited international connectivity post-2022',
    facilities: 251,
    keyCities: ['Moscow', 'St. Petersburg', 'Novosibirsk'],
    growthRateYoY: 5.0,
    growthNote: 'Domestic cloud migration; international operators largely exited',
    source: 'Cargoson, iKS-Consulting'
  },
  {
    rank: 28,
    country: 'Thailand',
    totalCapacityMW: 130,
    capacityNote: 'Growing SE Asian market; Google $2B commitment',
    facilities: 42,
    keyCities: ['Bangkok', 'Chonburi'],
    growthRateYoY: 15.0,
    growthNote: 'Google 10-year $2B commitment; Alibaba 3rd DC',
    source: 'C&W APAC, SCMP, GlobeNewsWire'
  }
];


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: MAJOR INDIVIDUAL DATA CENTER FACILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const majorDCFacilities = [
  // ─── MEGA CAMPUSES (500+ MW) ────────────────────────────────────────────────
  {
    rank: 1,
    facility: 'Meta Altoona Campus',
    company: 'Meta Platforms',
    city: 'Altoona',
    country: 'United States',
    state: 'Iowa',
    capacityMW: 1401,
    type: 'Hyperscale',
    tier: 'Custom (Tier III equivalent)',
    yearOpened: 2014,
    yearExpanded: 2024,
    notes: 'Multiple buildings; estimated 1,401 MW total IT load',
    source: 'Blackridge Research, Brightlio'
  },
  {
    rank: 2,
    facility: 'Meta Prineville Campus',
    company: 'Meta Platforms',
    city: 'Prineville',
    country: 'United States',
    state: 'Oregon',
    capacityMW: 1289,
    type: 'Hyperscale',
    tier: 'Custom (Tier III equivalent)',
    yearOpened: 2011,
    yearExpanded: 2025,
    notes: '3.2M sqft operational; expanding to 4.6M sqft',
    source: 'Blackridge Research, Brightlio'
  },
  {
    rank: 3,
    facility: 'Stargate Campus (Phase 1)',
    company: 'Oracle / OpenAI / Vantage',
    city: 'Abilene',
    country: 'United States',
    state: 'Texas',
    capacityMW: 1200,
    type: 'Hyperscale / AI',
    tier: 'Tier IV (planned)',
    yearOpened: 2025,
    yearExpanded: null,
    notes: '1.2 GW; 450K+ NVIDIA GB200 GPUs planned; $15B+ investment',
    source: 'DCK Jan 2026, OpenAI/Oracle press releases'
  },
  {
    rank: 4,
    facility: 'Meta Hyperion Campus',
    company: 'Meta Platforms',
    city: 'Richland Parish',
    country: 'United States',
    state: 'Louisiana',
    capacityMW: 1000,
    type: 'Hyperscale / AI',
    tier: 'Custom',
    yearOpened: 2026,
    yearExpanded: null,
    notes: '$27B; scaling to 5 GW; 4M sqft on 2,250-acre site',
    source: 'Meta announcement, DCK Jan 2026'
  },
  {
    rank: 5,
    facility: 'Meta Prometheus Campus',
    company: 'Meta Platforms',
    city: 'Columbus',
    country: 'United States',
    state: 'Ohio',
    capacityMW: 1000,
    type: 'Hyperscale / AI',
    tier: 'Custom',
    yearOpened: 2026,
    yearExpanded: null,
    notes: '1 GW operational target 2026',
    source: 'DCK Jan 2026'
  },
  {
    rank: 6,
    facility: 'Switch Citadel Campus',
    company: 'Switch (DigitalBridge)',
    city: 'Reno / Tahoe',
    country: 'United States',
    state: 'Nevada',
    capacityMW: 650,
    type: 'Hyperscale / Wholesale',
    tier: 'Tier IV',
    yearOpened: 2017,
    yearExpanded: 2024,
    notes: 'Largest operational DC in world; 7.2M sqft; 2,000 acres; 100% renewable',
    source: 'Switch website, Blackridge Research, Data Center Frontier'
  },
  {
    rank: 7,
    facility: 'Microsoft Quincy Campus',
    company: 'Microsoft',
    city: 'Quincy',
    country: 'United States',
    state: 'Washington',
    capacityMW: 622,
    type: 'Hyperscale',
    tier: 'Custom (Tier III+)',
    yearOpened: 2007,
    yearExpanded: 2025,
    notes: '270 acres; Gen 2-5 buildings; hydropower access',
    source: 'Brightlio, Blackridge Research'
  },
  {
    rank: 8,
    facility: 'Vantage Shackelford County Campus',
    company: 'Vantage Data Centers',
    city: 'Shackelford County',
    country: 'United States',
    state: 'Texas',
    capacityMW: 1400,
    type: 'Hyperscale',
    tier: 'Tier III (planned)',
    yearOpened: 2026,
    yearExpanded: null,
    notes: '$25B+ investment; largest Vantage project to date',
    source: 'Data Centre Magazine, Vantage press release Aug 2025'
  },

  // ─── LARGE CAMPUSES (200-500 MW) ────────────────────────────────────────────
  {
    rank: 9,
    facility: 'CWL1 Data Centre',
    company: 'Vantage Data Centers',
    city: 'Newport',
    country: 'United Kingdom',
    state: 'Wales',
    capacityMW: 400,
    type: 'Hyperscale',
    tier: 'Tier III',
    yearOpened: 2024,
    yearExpanded: null,
    notes: '1.85M sqft; 400kV grid connection',
    source: 'RankRed, Vantage website'
  },
  {
    rank: 10,
    facility: 'QTS Atlanta Metro (ATL1)',
    company: 'QTS Realty Trust (Blackstone)',
    city: 'Atlanta',
    country: 'United States',
    state: 'Georgia',
    capacityMW: 278,
    type: 'Hyperscale / Wholesale',
    tier: 'Tier III+',
    yearOpened: 2011,
    yearExpanded: 2024,
    notes: '990K sqft; 99-acre site; flagship campus',
    source: 'Blackridge Research, QTS website'
  },
  {
    rank: 11,
    facility: 'Switch SuperNAP',
    company: 'Switch (DigitalBridge)',
    city: 'Las Vegas',
    country: 'United States',
    state: 'Nevada',
    capacityMW: 280,
    type: 'Hyperscale / Colocation',
    tier: 'Tier IV',
    yearOpened: 2010,
    yearExpanded: 2023,
    notes: '3.5M sqft; Tier IV Gold certified',
    source: 'Switch website, Blackridge Research'
  },
  {
    rank: 12,
    facility: 'QTS Excalibur Project',
    company: 'QTS Realty Trust (Blackstone)',
    city: 'Fayetteville',
    country: 'United States',
    state: 'Georgia',
    capacityMW: 250,
    type: 'Hyperscale',
    tier: 'Tier III (planned)',
    yearOpened: 2023,
    yearExpanded: 2032,
    notes: '615 acres; 7M sqft total when complete (16 buildings); buildout through 2032',
    source: 'Data Center Frontier, Blackridge Research'
  },
  {
    rank: 13,
    facility: 'Yotta NM1',
    company: 'Yotta Infrastructure',
    city: 'Navi Mumbai',
    country: 'India',
    state: 'Maharashtra',
    capacityMW: 250,
    type: 'Hyperscale / Colocation',
    tier: 'Tier IV',
    yearOpened: 2019,
    yearExpanded: 2024,
    notes: '30,000 racks; 250 MW total facility power; 820K sqft',
    source: 'Blackridge Research, RankRed'
  },
  {
    rank: 14,
    facility: 'AirTrunk MEL1',
    company: 'AirTrunk',
    city: 'Melbourne',
    country: 'Australia',
    state: 'Victoria',
    capacityMW: 280,
    type: 'Hyperscale',
    tier: 'Tier III',
    yearOpened: 2020,
    yearExpanded: 2024,
    notes: 'Part of 630 MW total Melbourne portfolio with MEL2',
    source: 'DCPulse, AirTrunk website'
  },
  {
    rank: 15,
    facility: 'AirTrunk SYD1',
    company: 'AirTrunk',
    city: 'Sydney',
    country: 'Australia',
    state: 'New South Wales',
    capacityMW: 220,
    type: 'Hyperscale',
    tier: 'Tier III',
    yearOpened: 2018,
    yearExpanded: 2024,
    notes: 'First AirTrunk facility; major APAC hyperscale hub',
    source: 'AirTrunk website, DCD'
  },

  // ─── LARGE FACILITIES (100-200 MW) ──────────────────────────────────────────
  {
    rank: 16,
    facility: 'China Telecom Inner Mongolia Info Park',
    company: 'China Telecom',
    city: 'Hohhot',
    country: 'China',
    state: 'Inner Mongolia',
    capacityMW: 150,
    type: 'Hyperscale / Cloud',
    tier: 'Tier III',
    yearOpened: 2013,
    yearExpanded: 2023,
    notes: '10.76M sqft; largest DC complex in the world by area',
    source: 'Blackridge Research, RankRed'
  },
  {
    rank: 17,
    facility: 'China Mobile Hohhot',
    company: 'China Mobile',
    city: 'Hohhot',
    country: 'China',
    state: 'Inner Mongolia',
    capacityMW: 140,
    type: 'Hyperscale / Cloud',
    tier: 'Tier III',
    yearOpened: 2014,
    yearExpanded: 2023,
    notes: '7.75M sqft; cloud computing focus',
    source: 'RankRed, Brightlio'
  },
  {
    rank: 18,
    facility: 'Compass Red Oak Campus',
    company: 'Compass Datacenters',
    city: 'Red Oak (Dallas-Fort Worth)',
    country: 'United States',
    state: 'Texas',
    capacityMW: 360,
    type: 'Hyperscale / Wholesale',
    tier: 'Tier III',
    yearOpened: 2023,
    yearExpanded: 2026,
    notes: 'Multi-phase; 360 MW at full build-out',
    source: 'Compass website, DCD, DCK'
  },
  {
    rank: 19,
    facility: 'Apple Mesa Data Center',
    company: 'Apple',
    city: 'Mesa',
    country: 'United States',
    state: 'Arizona',
    capacityMW: 150,
    type: 'Hyperscale',
    tier: 'Custom',
    yearOpened: 2018,
    yearExpanded: 2023,
    notes: '1.3M sqft; 50 MW solar; formerly GT Advanced Technologies sapphire plant',
    source: 'RankRed, Apple sustainability report'
  },
  {
    rank: 20,
    facility: 'Lakeside Technology Center',
    company: 'Digital Realty',
    city: 'Chicago',
    country: 'United States',
    state: 'Illinois',
    capacityMW: 100,
    type: 'Colocation / Wholesale',
    tier: 'Tier III',
    yearOpened: 1999,
    yearExpanded: 2022,
    notes: '1.1M sqft; 8-story former printing facility; iconic colo DC',
    source: 'Blackridge Research, RankRed, Digital Realty'
  },
  {
    rank: 21,
    facility: 'Tulip Data Center',
    company: 'Tulip Telecom',
    city: 'Bengaluru',
    country: 'India',
    state: 'Karnataka',
    capacityMW: 100,
    type: 'Colocation',
    tier: 'Tier III/IV',
    yearOpened: 2015,
    yearExpanded: 2023,
    notes: '950K sqft; one of Asia\'s largest single-building DCs',
    source: 'RankRed, Brightlio'
  },
  {
    rank: 22,
    facility: 'Yondr Northern Virginia Campus',
    company: 'Yondr Group',
    city: 'Northern Virginia',
    country: 'United States',
    state: 'Virginia',
    capacityMW: 336,
    type: 'Hyperscale',
    tier: 'Tier III',
    yearOpened: 2024,
    yearExpanded: 2026,
    notes: '96 MW Phase 1 complete; 336 MW at full build-out',
    source: 'Yondr Group press release, DCD'
  },
  {
    rank: 23,
    facility: 'NTT Tokyo 1 Data Center',
    company: 'NTT Global Data Centers',
    city: 'Tokyo',
    country: 'Japan',
    state: 'Kanto',
    capacityMW: 120,
    type: 'Colocation / Wholesale',
    tier: 'Tier III+',
    yearOpened: 2019,
    yearExpanded: 2024,
    notes: 'One of NTT\'s flagship APAC facilities',
    source: 'NTT GDC website, Caeled'
  },
  {
    rank: 24,
    facility: 'Equinix SV5 / SV11',
    company: 'Equinix',
    city: 'San Jose',
    country: 'United States',
    state: 'California',
    capacityMW: 110,
    type: 'Colocation',
    tier: 'Tier III+',
    yearOpened: 2012,
    yearExpanded: 2024,
    notes: 'Silicon Valley flagship; interconnection hub',
    source: 'Equinix website'
  },
  {
    rank: 25,
    facility: 'Intergate Seattle',
    company: 'Sabey Data Centers',
    city: 'Seattle',
    country: 'United States',
    state: 'Washington',
    capacityMW: 70,
    type: 'Colocation / Wholesale',
    tier: 'Tier III',
    yearOpened: 2011,
    yearExpanded: 2023,
    notes: '900K sqft; modular/green design; multi-building campus',
    source: 'RankRed, Sabey website'
  },
  {
    rank: 26,
    facility: 'Utah Data Center (IC)',
    company: 'US Intelligence Community',
    city: 'Bluffdale',
    country: 'United States',
    state: 'Utah',
    capacityMW: 65,
    type: 'Government / Enterprise',
    tier: 'Tier III',
    yearOpened: 2014,
    yearExpanded: null,
    notes: '1M sqft; 1.5M sqft total campus; 65 MW estimated',
    source: 'Brightlio, RankRed'
  },
  {
    rank: 27,
    facility: 'CoreSite VA3',
    company: 'CoreSite (American Tower)',
    city: 'Reston',
    country: 'United States',
    state: 'Virginia',
    capacityMW: 60,
    type: 'Colocation',
    tier: 'Tier III',
    yearOpened: 2017,
    yearExpanded: 2023,
    notes: '940K sqft; Northern Virginia interconnection hub',
    source: 'RankRed, CoreSite website'
  },
  {
    rank: 28,
    facility: 'Keppel Singapore T27',
    company: 'Keppel Data Centres',
    city: 'Singapore',
    country: 'Singapore',
    state: null,
    capacityMW: 52,
    type: 'Colocation',
    tier: 'Tier III Uptime Certified',
    yearOpened: 2021,
    yearExpanded: null,
    notes: 'One of Singapore\'s most efficient DCs; tropical cooling innovation',
    source: 'Keppel DC website, BusinessWire Singapore Portfolio 2025'
  },
  {
    rank: 29,
    facility: 'Iron Mountain NJE-1',
    company: 'Iron Mountain',
    city: 'Edison',
    country: 'United States',
    state: 'New Jersey',
    capacityMW: 26,
    type: 'Colocation',
    tier: 'Tier III',
    yearOpened: 2016,
    yearExpanded: 2022,
    notes: '830K sqft; former secure vault converted to DC',
    source: 'RankRed, Iron Mountain website'
  },
  {
    rank: 30,
    facility: 'Google Hamina',
    company: 'Google',
    city: 'Hamina',
    country: 'Finland',
    state: null,
    capacityMW: 120,
    type: 'Hyperscale',
    tier: 'Custom',
    yearOpened: 2011,
    yearExpanded: 2024,
    notes: 'Former paper mill; seawater cooling from Gulf of Finland',
    source: 'Google sustainability report, DCD'
  },
  {
    rank: 31,
    facility: 'Equinix AM5 / AM17',
    company: 'Equinix',
    city: 'Amsterdam',
    country: 'Netherlands',
    state: null,
    capacityMW: 55,
    type: 'Colocation',
    tier: 'Tier III+',
    yearOpened: 2017,
    yearExpanded: 2024,
    notes: 'AMS-IX peering point; European interconnection hub',
    source: 'Equinix website'
  },
  {
    rank: 32,
    facility: 'Equinix FR5 / FR9',
    company: 'Equinix',
    city: 'Frankfurt',
    country: 'Germany',
    state: 'Hesse',
    capacityMW: 48,
    type: 'Colocation',
    tier: 'Tier III+',
    yearOpened: 2015,
    yearExpanded: 2024,
    notes: 'DE-CIX adjacent; financial services hub',
    source: 'Equinix website'
  },
  {
    rank: 33,
    facility: 'Meta Lulea',
    company: 'Meta Platforms',
    city: 'Lulea',
    country: 'Sweden',
    state: 'Norrbotten',
    capacityMW: 120,
    type: 'Hyperscale',
    tier: 'Custom',
    yearOpened: 2013,
    yearExpanded: 2023,
    notes: 'Arctic climate; 100% renewable hydro power; Node Pole',
    source: 'Meta sustainability report, DCD'
  },
  {
    rank: 34,
    facility: 'Microsoft Dublin Campus',
    company: 'Microsoft',
    city: 'Dublin',
    country: 'Ireland',
    state: 'Leinster',
    capacityMW: 200,
    type: 'Hyperscale',
    tier: 'Custom (Tier III+)',
    yearOpened: 2009,
    yearExpanded: 2024,
    notes: 'Multiple buildings; Azure Europe West anchor',
    source: 'Microsoft Azure infrastructure, DCD'
  },
  {
    rank: 35,
    facility: 'Vantage Port Washington (Stargate II)',
    company: 'Vantage / OpenAI / Oracle',
    city: 'Port Washington',
    country: 'United States',
    state: 'Wisconsin',
    capacityMW: 1000,
    type: 'Hyperscale / AI',
    tier: 'Tier III (planned)',
    yearOpened: 2026,
    yearExpanded: null,
    notes: '$15B; 4 DC buildings; nearly 1 GW AI compute capacity',
    source: 'DCK, Oracle/OpenAI/Vantage announcement Oct 2025'
  }
];


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: GLOBAL MARKET SUMMARY STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

const globalDCSummary = {
  asOfDate: '2025-Q3',
  compiledDate: '2026-02-17',

  globalCapacity: {
    totalInstalledGW: 122.2,         // Synergy Research Q1 2025
    totalLiveITCapacityMW: 52000,    // est. mid-2025 interpolation
    projectedLiveITMW2026: 66504,    // JLL 2026 Outlook
    projectedTotalGW2030: 200,       // JLL
    newCapacityToAdd2026_2030GW: 100 // JLL
  },

  hyperscaleMetrics: {
    totalHyperscaleDCs: 1297,        // Synergy Q3 2025
    hyperscaleShareOfCapacity: 0.44, // 44% of global capacity
    hyperscaleShareGrowthFrom2017: 0.20, // was 20% in 2017
    topThreeShareAWSMSFTGOOG: 0.58,  // 58% of hyperscale capacity
    hyperscaleCapexQ32025B: 142,     // $142B quarterly
    projectedHyperscaleCapex2026B: 600, // $600B+ annual
    capacityDoublingPeriodQuarters: 12, // ~3 years
    pipelineFacilities: 770
  },

  regionalBreakdown: {
    americas: {
      shareOfGlobal: 0.50,
      supplyCAGR2030: 0.17,
      usShareOfAmericas: 0.90,
      primaryMarketSupplyMW_H12025: 8155,
      constructionPipelineGW: 7.8,
      absorptionH12025MW: 2200
    },
    apac: {
      currentCapacityGW: 32,
      projectedCapacityGW2030: 57,
      growthCAGR: 0.12,
      coloGrowthRate: 0.19,
      chinaMarketShare: 0.3458,
      indiaCAGR: 0.205
    },
    emea: {
      operationalCapacityGW_H12025: 10.3,
      yearOnYearGrowth: 0.21,
      underConstructionGW: 2.6,
      planningStageGW: 11.5,
      totalPipelineGW: 14.1,
      pipelineAnnualGrowth: 0.43,
      newSupplyToAddGW: 13,
      growthCAGR: 0.10,
      FLAPDshareOfRegion: 0.45
    }
  },

  investmentOutlook: {
    totalInvestmentRequired2030T: 3.0,   // $3 trillion (JLL)
    realEstateAssetCreationT: 1.2,       // $1.2 trillion
    tenantITInfraSpendT: '1-2',          // $1-2 trillion
    topFourCapex2025B: 370,              // MSFT+GOOG+AMZN+META
    projectedCapex2026B: 600             // All hyperscalers
  },

  keyConstraints: [
    'Power availability — primary bottleneck in most major markets',
    'Grid connection delays (2-5 years in parts of Europe)',
    'Singapore: <4 MW available, <2% vacancy (most constrained globally)',
    'Northern Virginia: 80% increase in under-construction but still 3% vacancy',
    'Skilled labor shortage for construction and operations',
    'Water usage concerns in arid regions (Phoenix, Middle East)',
    'Permitting and regulatory complexity increasing globally'
  ],

  sources: [
    'Synergy Research Group — Hyperscale Market Tracker Q3 2025',
    'CBRE — Global Data Center Trends 2025',
    'CBRE — North America Data Center Trends H1 2025',
    'JLL — 2026 Global Data Center Outlook',
    'JLL — North America Data Center Report Midyear 2025',
    'Cushman & Wakefield — 2025 Global Data Center Market Comparison',
    'Cushman & Wakefield — EMEA Data Centre Update H1 2025',
    'Cushman & Wakefield — APAC Data Centre Update H2 2025',
    'Company earnings: Equinix Q4 2025, Digital Realty Q3 2025, NTT, GDS Q2 2025, VNET Q3 2025',
    'Datacenter Dynamics, DatacenterKnowledge, Data Center Frontier',
    'Blackridge Research, Cargoson (Nov 2025), RankRed, Brightlio',
    'Mordor Intelligence, Arizton, MarketsAndMarkets, ResearchAndMarkets'
  ]
};


// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS (compatible with both ES modules and script tags)
// ═══════════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    globalDCOperators,
    dcCapacityByCountry,
    majorDCFacilities,
    globalDCSummary
  };
}
