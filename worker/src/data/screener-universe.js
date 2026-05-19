/**
 * Curated static reference universe — approximate fundamentals for screening;
 * live price/chg enriched via /q at request time.
 *
 * ~120 widely-known US listings across all 11 GICS sectors (large / mid /
 * small cap). Fundamentals (marketCap USD, trailing pe, divYield % , avgVol)
 * are realistic order-of-magnitude approximations of well-known public
 * figures — they are intentionally static so the screener works with ZERO
 * API key and ZERO rate-limit exposure. Live price/chgPct are NOT stored
 * here; they are attached at request time from the /q quote layer.
 *
 * Sector strings match CFG.SECTORS in the Finance Terminal client
 * (Technology, Health Care, Financials, Consumer Discretionary, Industrials,
 *  Communication Services, Consumer Staples, Energy, Materials,
 *  Real Estate, Utilities).
 *
 * pe = null means "no meaningful trailing P/E" (unprofitable / N.M.).
 */

export const SCREENER_UNIVERSE = [
  // ── Technology ────────────────────────────────────────────────
  { sym: 'AAPL', name: 'Apple Inc.',                 sector: 'Technology', marketCap: 3300e9, pe: 33,   divYield: 0.45, avgVol: 55e6 },
  { sym: 'MSFT', name: 'Microsoft Corp.',            sector: 'Technology', marketCap: 3100e9, pe: 36,   divYield: 0.72, avgVol: 22e6 },
  { sym: 'NVDA', name: 'NVIDIA Corp.',               sector: 'Technology', marketCap: 3000e9, pe: 55,   divYield: 0.03, avgVol: 240e6 },
  { sym: 'AVGO', name: 'Broadcom Inc.',              sector: 'Technology', marketCap: 800e9,  pe: 60,   divYield: 1.20, avgVol: 25e6 },
  { sym: 'ORCL', name: 'Oracle Corp.',               sector: 'Technology', marketCap: 380e9,  pe: 38,   divYield: 1.10, avgVol: 9e6 },
  { sym: 'CRM',  name: 'Salesforce Inc.',            sector: 'Technology', marketCap: 290e9,  pe: 45,   divYield: 0.55, avgVol: 6e6 },
  { sym: 'ADBE', name: 'Adobe Inc.',                 sector: 'Technology', marketCap: 230e9,  pe: 40,   divYield: 0.00, avgVol: 3.5e6 },
  { sym: 'AMD',  name: 'Advanced Micro Devices',     sector: 'Technology', marketCap: 230e9,  pe: 48,   divYield: 0.00, avgVol: 55e6 },
  { sym: 'CSCO', name: 'Cisco Systems Inc.',         sector: 'Technology', marketCap: 200e9,  pe: 21,   divYield: 2.80, avgVol: 20e6 },
  { sym: 'ACN',  name: 'Accenture plc',              sector: 'Technology', marketCap: 215e9,  pe: 28,   divYield: 1.55, avgVol: 2.3e6 },
  { sym: 'TXN',  name: 'Texas Instruments Inc.',     sector: 'Technology', marketCap: 175e9,  pe: 34,   divYield: 2.70, avgVol: 5e6 },
  { sym: 'INTC', name: 'Intel Corp.',                sector: 'Technology', marketCap: 95e9,   pe: null, divYield: 1.30, avgVol: 50e6 },
  { sym: 'IBM',  name: 'IBM Corp.',                  sector: 'Technology', marketCap: 200e9,  pe: 30,   divYield: 3.20, avgVol: 4.5e6 },
  { sym: 'QCOM', name: 'QUALCOMM Inc.',              sector: 'Technology', marketCap: 185e9,  pe: 22,   divYield: 1.90, avgVol: 9e6 },
  { sym: 'NOW',  name: 'ServiceNow Inc.',            sector: 'Technology', marketCap: 195e9,  pe: 58,   divYield: 0.00, avgVol: 1.5e6 },
  { sym: 'PLTR', name: 'Palantir Technologies',      sector: 'Technology', marketCap: 90e9,   pe: 70,   divYield: 0.00, avgVol: 60e6 },
  { sym: 'SNOW', name: 'Snowflake Inc.',             sector: 'Technology', marketCap: 55e9,   pe: null, divYield: 0.00, avgVol: 5e6 },
  { sym: 'DDOG', name: 'Datadog Inc.',               sector: 'Technology', marketCap: 42e9,   pe: 75,   divYield: 0.00, avgVol: 4e6 },
  { sym: 'CRWD', name: 'CrowdStrike Holdings',       sector: 'Technology', marketCap: 75e9,   pe: 80,   divYield: 0.00, avgVol: 4e6 },
  { sym: 'HPQ',  name: 'HP Inc.',                    sector: 'Technology', marketCap: 32e9,   pe: 12,   divYield: 3.30, avgVol: 8e6 },

  // ── Health Care ──────────────────────────────────────────────
  { sym: 'LLY',  name: 'Eli Lilly and Co.',          sector: 'Health Care', marketCap: 780e9, pe: 60,   divYield: 0.65, avgVol: 3.5e6 },
  { sym: 'UNH',  name: 'UnitedHealth Group',         sector: 'Health Care', marketCap: 500e9, pe: 20,   divYield: 1.45, avgVol: 3e6 },
  { sym: 'JNJ',  name: 'Johnson & Johnson',          sector: 'Health Care', marketCap: 380e9, pe: 15,   divYield: 3.10, avgVol: 7e6 },
  { sym: 'MRK',  name: 'Merck & Co.',                sector: 'Health Care', marketCap: 250e9, pe: 14,   divYield: 2.90, avgVol: 9e6 },
  { sym: 'ABBV', name: 'AbbVie Inc.',                sector: 'Health Care', marketCap: 320e9, pe: 18,   divYield: 3.30, avgVol: 6e6 },
  { sym: 'TMO',  name: 'Thermo Fisher Scientific',   sector: 'Health Care', marketCap: 215e9, pe: 30,   divYield: 0.30, avgVol: 1.8e6 },
  { sym: 'ABT',  name: 'Abbott Laboratories',        sector: 'Health Care', marketCap: 200e9, pe: 33,   divYield: 1.90, avgVol: 5e6 },
  { sym: 'PFE',  name: 'Pfizer Inc.',                sector: 'Health Care', marketCap: 150e9, pe: 13,   divYield: 6.20, avgVol: 40e6 },
  { sym: 'DHR',  name: 'Danaher Corp.',              sector: 'Health Care', marketCap: 180e9, pe: 35,   divYield: 0.45, avgVol: 2.5e6 },
  { sym: 'BMY',  name: 'Bristol-Myers Squibb',       sector: 'Health Care', marketCap: 100e9, pe: 12,   divYield: 4.50, avgVol: 11e6 },
  { sym: 'AMGN', name: 'Amgen Inc.',                 sector: 'Health Care', marketCap: 145e9, pe: 26,   divYield: 3.10, avgVol: 3e6 },
  { sym: 'GILD', name: 'Gilead Sciences Inc.',       sector: 'Health Care', marketCap: 95e9,  pe: 21,   divYield: 4.10, avgVol: 6e6 },
  { sym: 'CVS',  name: 'CVS Health Corp.',           sector: 'Health Care', marketCap: 70e9,  pe: 11,   divYield: 4.30, avgVol: 9e6 },
  { sym: 'MDT',  name: 'Medtronic plc',              sector: 'Health Care', marketCap: 110e9, pe: 16,   divYield: 3.20, avgVol: 6e6 },
  { sym: 'ISRG', name: 'Intuitive Surgical Inc.',    sector: 'Health Care', marketCap: 165e9, pe: 70,   divYield: 0.00, avgVol: 1.6e6 },
  { sym: 'MRNA', name: 'Moderna Inc.',               sector: 'Health Care', marketCap: 15e9,  pe: null, divYield: 0.00, avgVol: 8e6 },

  // ── Financials ───────────────────────────────────────────────
  { sym: 'JPM',  name: 'JPMorgan Chase & Co.',       sector: 'Financials', marketCap: 620e9, pe: 12,   divYield: 2.20, avgVol: 9e6 },
  { sym: 'BAC',  name: 'Bank of America Corp.',      sector: 'Financials', marketCap: 320e9, pe: 13,   divYield: 2.50, avgVol: 40e6 },
  { sym: 'WFC',  name: 'Wells Fargo & Co.',          sector: 'Financials', marketCap: 200e9, pe: 12,   divYield: 2.60, avgVol: 18e6 },
  { sym: 'GS',   name: 'Goldman Sachs Group',        sector: 'Financials', marketCap: 165e9, pe: 16,   divYield: 2.10, avgVol: 2.5e6 },
  { sym: 'MS',   name: 'Morgan Stanley',             sector: 'Financials', marketCap: 175e9, pe: 17,   divYield: 3.10, avgVol: 8e6 },
  { sym: 'C',    name: 'Citigroup Inc.',             sector: 'Financials', marketCap: 120e9, pe: 11,   divYield: 3.20, avgVol: 14e6 },
  { sym: 'BLK',  name: 'BlackRock Inc.',             sector: 'Financials', marketCap: 145e9, pe: 23,   divYield: 2.10, avgVol: 0.7e6 },
  { sym: 'SCHW', name: 'Charles Schwab Corp.',       sector: 'Financials', marketCap: 130e9, pe: 24,   divYield: 1.50, avgVol: 9e6 },
  { sym: 'AXP',  name: 'American Express Co.',       sector: 'Financials', marketCap: 190e9, pe: 20,   divYield: 1.05, avgVol: 3e6 },
  { sym: 'V',    name: 'Visa Inc.',                  sector: 'Financials', marketCap: 560e9, pe: 31,   divYield: 0.75, avgVol: 6e6 },
  { sym: 'MA',   name: 'Mastercard Inc.',            sector: 'Financials', marketCap: 450e9, pe: 36,   divYield: 0.55, avgVol: 3e6 },
  { sym: 'BRK.B',name: 'Berkshire Hathaway B',       sector: 'Financials', marketCap: 980e9, pe: 22,   divYield: 0.00, avgVol: 4e6 },
  { sym: 'PNC',  name: 'PNC Financial Services',     sector: 'Financials', marketCap: 75e9,  pe: 14,   divYield: 3.40, avgVol: 2.5e6 },
  { sym: 'USB',  name: 'U.S. Bancorp',               sector: 'Financials', marketCap: 70e9,  pe: 13,   divYield: 4.20, avgVol: 9e6 },
  { sym: 'COF',  name: 'Capital One Financial',      sector: 'Financials', marketCap: 60e9,  pe: 14,   divYield: 1.60, avgVol: 3e6 },

  // ── Consumer Discretionary ───────────────────────────────────
  { sym: 'AMZN', name: 'Amazon.com Inc.',            sector: 'Consumer Discretionary', marketCap: 2100e9, pe: 42,   divYield: 0.00, avgVol: 40e6 },
  { sym: 'TSLA', name: 'Tesla Inc.',                 sector: 'Consumer Discretionary', marketCap: 900e9,  pe: 70,   divYield: 0.00, avgVol: 90e6 },
  { sym: 'HD',   name: 'Home Depot Inc.',            sector: 'Consumer Discretionary', marketCap: 380e9,  pe: 25,   divYield: 2.40, avgVol: 3.5e6 },
  { sym: 'MCD',  name: "McDonald's Corp.",           sector: 'Consumer Discretionary', marketCap: 210e9,  pe: 24,   divYield: 2.30, avgVol: 3e6 },
  { sym: 'NKE',  name: 'Nike Inc.',                  sector: 'Consumer Discretionary', marketCap: 115e9,  pe: 22,   divYield: 1.80, avgVol: 9e6 },
  { sym: 'LOW',  name: "Lowe's Companies Inc.",      sector: 'Consumer Discretionary', marketCap: 145e9,  pe: 21,   divYield: 1.85, avgVol: 3e6 },
  { sym: 'SBUX', name: 'Starbucks Corp.',            sector: 'Consumer Discretionary', marketCap: 105e9,  pe: 28,   divYield: 2.50, avgVol: 9e6 },
  { sym: 'BKNG', name: 'Booking Holdings Inc.',      sector: 'Consumer Discretionary', marketCap: 160e9,  pe: 30,   divYield: 0.80, avgVol: 0.35e6 },
  { sym: 'TJX',  name: 'TJX Companies Inc.',         sector: 'Consumer Discretionary', marketCap: 135e9,  pe: 28,   divYield: 1.25, avgVol: 5e6 },
  { sym: 'F',    name: 'Ford Motor Co.',             sector: 'Consumer Discretionary', marketCap: 45e9,   pe: 12,   divYield: 5.20, avgVol: 60e6 },
  { sym: 'GM',   name: 'General Motors Co.',         sector: 'Consumer Discretionary', marketCap: 55e9,   pe: 6,    divYield: 1.10, avgVol: 14e6 },
  { sym: 'ABNB', name: 'Airbnb Inc.',                sector: 'Consumer Discretionary', marketCap: 80e9,   pe: 38,   divYield: 0.00, avgVol: 5e6 },
  { sym: 'MAR',  name: 'Marriott International',      sector: 'Consumer Discretionary', marketCap: 75e9,   pe: 26,   divYield: 0.90, avgVol: 2e6 },
  { sym: 'CMG',  name: 'Chipotle Mexican Grill',     sector: 'Consumer Discretionary', marketCap: 80e9,   pe: 50,   divYield: 0.00, avgVol: 18e6 },

  // ── Industrials ──────────────────────────────────────────────
  { sym: 'CAT',  name: 'Caterpillar Inc.',           sector: 'Industrials', marketCap: 175e9, pe: 16,   divYield: 1.70, avgVol: 3e6 },
  { sym: 'BA',   name: 'Boeing Co.',                 sector: 'Industrials', marketCap: 110e9, pe: null, divYield: 0.00, avgVol: 8e6 },
  { sym: 'GE',   name: 'GE Aerospace',               sector: 'Industrials', marketCap: 200e9, pe: 35,   divYield: 0.65, avgVol: 5e6 },
  { sym: 'HON',  name: 'Honeywell International',    sector: 'Industrials', marketCap: 140e9, pe: 23,   divYield: 2.10, avgVol: 3e6 },
  { sym: 'UPS',  name: 'United Parcel Service',      sector: 'Industrials', marketCap: 110e9, pe: 18,   divYield: 4.40, avgVol: 4e6 },
  { sym: 'RTX',  name: 'RTX Corp.',                  sector: 'Industrials', marketCap: 160e9, pe: 22,   divYield: 2.20, avgVol: 6e6 },
  { sym: 'DE',   name: 'Deere & Co.',                sector: 'Industrials', marketCap: 110e9, pe: 14,   divYield: 1.50, avgVol: 1.7e6 },
  { sym: 'LMT',  name: 'Lockheed Martin Corp.',      sector: 'Industrials', marketCap: 105e9, pe: 18,   divYield: 2.60, avgVol: 1.2e6 },
  { sym: 'UNP',  name: 'Union Pacific Corp.',        sector: 'Industrials', marketCap: 145e9, pe: 22,   divYield: 2.20, avgVol: 3e6 },
  { sym: 'MMM',  name: '3M Co.',                     sector: 'Industrials', marketCap: 70e9,  pe: 17,   divYield: 2.10, avgVol: 5e6 },
  { sym: 'GD',   name: 'General Dynamics Corp.',     sector: 'Industrials', marketCap: 75e9,  pe: 20,   divYield: 2.00, avgVol: 1.2e6 },
  { sym: 'CSX',  name: 'CSX Corp.',                  sector: 'Industrials', marketCap: 65e9,  pe: 18,   divYield: 1.40, avgVol: 14e6 },
  { sym: 'EMR',  name: 'Emerson Electric Co.',       sector: 'Industrials', marketCap: 65e9,  pe: 20,   divYield: 1.85, avgVol: 3e6 },
  { sym: 'FDX',  name: 'FedEx Corp.',                sector: 'Industrials', marketCap: 65e9,  pe: 15,   divYield: 2.10, avgVol: 2.5e6 },

  // ── Communication Services ───────────────────────────────────
  { sym: 'GOOGL',name: 'Alphabet Inc. Class A',      sector: 'Communication Services', marketCap: 2200e9, pe: 26,   divYield: 0.45, avgVol: 28e6 },
  { sym: 'META', name: 'Meta Platforms Inc.',        sector: 'Communication Services', marketCap: 1400e9, pe: 28,   divYield: 0.35, avgVol: 14e6 },
  { sym: 'NFLX', name: 'Netflix Inc.',               sector: 'Communication Services', marketCap: 350e9,  pe: 42,   divYield: 0.00, avgVol: 4e6 },
  { sym: 'DIS',  name: 'Walt Disney Co.',            sector: 'Communication Services', marketCap: 200e9,  pe: 38,   divYield: 0.85, avgVol: 9e6 },
  { sym: 'CMCSA',name: 'Comcast Corp.',              sector: 'Communication Services', marketCap: 160e9,  pe: 11,   divYield: 3.10, avgVol: 18e6 },
  { sym: 'T',    name: 'AT&T Inc.',                  sector: 'Communication Services', marketCap: 150e9,  pe: 13,   divYield: 5.30, avgVol: 35e6 },
  { sym: 'VZ',   name: 'Verizon Communications',     sector: 'Communication Services', marketCap: 175e9,  pe: 16,   divYield: 6.40, avgVol: 18e6 },
  { sym: 'TMUS', name: 'T-Mobile US Inc.',           sector: 'Communication Services', marketCap: 240e9,  pe: 24,   divYield: 1.50, avgVol: 4e6 },
  { sym: 'CHTR', name: 'Charter Communications',     sector: 'Communication Services', marketCap: 50e9,   pe: 9,    divYield: 0.00, avgVol: 1.3e6 },
  { sym: 'EA',   name: 'Electronic Arts Inc.',       sector: 'Communication Services', marketCap: 38e9,   pe: 32,   divYield: 0.55, avgVol: 2.2e6 },
  { sym: 'WBD',  name: 'Warner Bros. Discovery',     sector: 'Communication Services', marketCap: 25e9,   pe: null, divYield: 0.00, avgVol: 25e6 },

  // ── Consumer Staples ─────────────────────────────────────────
  { sym: 'WMT',  name: 'Walmart Inc.',               sector: 'Consumer Staples', marketCap: 600e9, pe: 38,   divYield: 1.10, avgVol: 18e6 },
  { sym: 'COST', name: 'Costco Wholesale Corp.',     sector: 'Consumer Staples', marketCap: 400e9, pe: 52,   divYield: 0.50, avgVol: 2e6 },
  { sym: 'PG',   name: 'Procter & Gamble Co.',       sector: 'Consumer Staples', marketCap: 390e9, pe: 27,   divYield: 2.40, avgVol: 6e6 },
  { sym: 'KO',   name: 'Coca-Cola Co.',              sector: 'Consumer Staples', marketCap: 280e9, pe: 25,   divYield: 3.00, avgVol: 14e6 },
  { sym: 'PEP',  name: 'PepsiCo Inc.',               sector: 'Consumer Staples', marketCap: 230e9, pe: 23,   divYield: 3.30, avgVol: 5e6 },
  { sym: 'PM',   name: 'Philip Morris Intl.',        sector: 'Consumer Staples', marketCap: 180e9, pe: 18,   divYield: 4.40, avgVol: 5e6 },
  { sym: 'MO',   name: 'Altria Group Inc.',          sector: 'Consumer Staples', marketCap: 90e9,  pe: 9,    divYield: 7.80, avgVol: 9e6 },
  { sym: 'MDLZ', name: 'Mondelez International',      sector: 'Consumer Staples', marketCap: 90e9,  pe: 21,   divYield: 2.60, avgVol: 7e6 },
  { sym: 'CL',   name: 'Colgate-Palmolive Co.',      sector: 'Consumer Staples', marketCap: 75e9,  pe: 26,   divYield: 2.00, avgVol: 4e6 },
  { sym: 'KMB',  name: 'Kimberly-Clark Corp.',       sector: 'Consumer Staples', marketCap: 45e9,  pe: 19,   divYield: 3.60, avgVol: 2e6 },
  { sym: 'GIS',  name: 'General Mills Inc.',         sector: 'Consumer Staples', marketCap: 38e9,  pe: 15,   divYield: 3.90, avgVol: 5e6 },
  { sym: 'KHC',  name: 'Kraft Heinz Co.',            sector: 'Consumer Staples', marketCap: 40e9,  pe: 13,   divYield: 4.80, avgVol: 8e6 },

  // ── Energy ───────────────────────────────────────────────────
  { sym: 'XOM',  name: 'Exxon Mobil Corp.',          sector: 'Energy', marketCap: 480e9, pe: 14,   divYield: 3.30, avgVol: 16e6 },
  { sym: 'CVX',  name: 'Chevron Corp.',              sector: 'Energy', marketCap: 280e9, pe: 15,   divYield: 4.10, avgVol: 9e6 },
  { sym: 'COP',  name: 'ConocoPhillips',             sector: 'Energy', marketCap: 130e9, pe: 13,   divYield: 2.90, avgVol: 7e6 },
  { sym: 'SLB',  name: 'Schlumberger NV',            sector: 'Energy', marketCap: 60e9,  pe: 13,   divYield: 2.60, avgVol: 11e6 },
  { sym: 'EOG',  name: 'EOG Resources Inc.',         sector: 'Energy', marketCap: 70e9,  pe: 11,   divYield: 3.10, avgVol: 4e6 },
  { sym: 'MPC',  name: 'Marathon Petroleum Corp.',   sector: 'Energy', marketCap: 55e9,  pe: 12,   divYield: 2.20, avgVol: 3.5e6 },
  { sym: 'PSX',  name: 'Phillips 66',                sector: 'Energy', marketCap: 55e9,  pe: 13,   divYield: 3.50, avgVol: 3e6 },
  { sym: 'VLO',  name: 'Valero Energy Corp.',        sector: 'Energy', marketCap: 45e9,  pe: 11,   divYield: 3.10, avgVol: 4e6 },
  { sym: 'OXY',  name: 'Occidental Petroleum',       sector: 'Energy', marketCap: 50e9,  pe: 15,   divYield: 1.80, avgVol: 14e6 },
  { sym: 'WMB',  name: 'Williams Companies Inc.',    sector: 'Energy', marketCap: 60e9,  pe: 24,   divYield: 3.80, avgVol: 9e6 },
  { sym: 'KMI',  name: 'Kinder Morgan Inc.',         sector: 'Energy', marketCap: 55e9,  pe: 22,   divYield: 4.50, avgVol: 14e6 },
  { sym: 'DVN',  name: 'Devon Energy Corp.',         sector: 'Energy', marketCap: 28e9,  pe: 9,    divYield: 4.20, avgVol: 9e6 },

  // ── Materials ────────────────────────────────────────────────
  { sym: 'LIN',  name: 'Linde plc',                  sector: 'Materials', marketCap: 220e9, pe: 33,   divYield: 1.25, avgVol: 1.6e6 },
  { sym: 'SHW',  name: 'Sherwin-Williams Co.',       sector: 'Materials', marketCap: 90e9,  pe: 35,   divYield: 0.80, avgVol: 1.8e6 },
  { sym: 'FCX',  name: 'Freeport-McMoRan Inc.',      sector: 'Materials', marketCap: 65e9,  pe: 30,   divYield: 1.30, avgVol: 16e6 },
  { sym: 'ECL',  name: 'Ecolab Inc.',                sector: 'Materials', marketCap: 70e9,  pe: 38,   divYield: 0.90, avgVol: 1.5e6 },
  { sym: 'APD',  name: 'Air Products & Chemicals',   sector: 'Materials', marketCap: 65e9,  pe: 24,   divYield: 2.50, avgVol: 1.5e6 },
  { sym: 'NEM',  name: 'Newmont Corp.',              sector: 'Materials', marketCap: 55e9,  pe: 18,   divYield: 2.10, avgVol: 11e6 },
  { sym: 'NUE',  name: 'Nucor Corp.',                sector: 'Materials', marketCap: 35e9,  pe: 13,   divYield: 1.50, avgVol: 2.5e6 },
  { sym: 'DOW',  name: 'Dow Inc.',                   sector: 'Materials', marketCap: 35e9,  pe: 22,   divYield: 5.60, avgVol: 6e6 },
  { sym: 'DD',   name: 'DuPont de Nemours Inc.',     sector: 'Materials', marketCap: 32e9,  pe: 25,   divYield: 1.90, avgVol: 3e6 },
  { sym: 'CTVA', name: 'Corteva Inc.',               sector: 'Materials', marketCap: 42e9,  pe: 28,   divYield: 1.10, avgVol: 4e6 },

  // ── Real Estate ──────────────────────────────────────────────
  { sym: 'PLD',  name: 'Prologis Inc.',              sector: 'Real Estate', marketCap: 105e9, pe: 38,  divYield: 3.30, avgVol: 5e6 },
  { sym: 'AMT',  name: 'American Tower Corp.',       sector: 'Real Estate', marketCap: 90e9,  pe: 40,  divYield: 3.20, avgVol: 2.5e6 },
  { sym: 'EQIX', name: 'Equinix Inc.',               sector: 'Real Estate', marketCap: 85e9,  pe: 75,  divYield: 2.10, avgVol: 0.6e6 },
  { sym: 'O',    name: 'Realty Income Corp.',        sector: 'Real Estate', marketCap: 50e9,  pe: 50,  divYield: 5.40, avgVol: 5e6 },
  { sym: 'SPG',  name: 'Simon Property Group',       sector: 'Real Estate', marketCap: 55e9,  pe: 22,  divYield: 5.10, avgVol: 2e6 },
  { sym: 'PSA',  name: 'Public Storage',             sector: 'Real Estate', marketCap: 55e9,  pe: 28,  divYield: 4.10, avgVol: 1e6 },
  { sym: 'WELL', name: 'Welltower Inc.',             sector: 'Real Estate', marketCap: 75e9,  pe: 90,  divYield: 2.30, avgVol: 4e6 },
  { sym: 'CCI',  name: 'Crown Castle Inc.',          sector: 'Real Estate', marketCap: 45e9,  pe: 35,  divYield: 5.80, avgVol: 4e6 },
  { sym: 'DLR',  name: 'Digital Realty Trust',       sector: 'Real Estate', marketCap: 55e9,  pe: 60,  divYield: 3.00, avgVol: 2e6 },

  // ── Utilities ────────────────────────────────────────────────
  { sym: 'NEE',  name: 'NextEra Energy Inc.',        sector: 'Utilities', marketCap: 165e9, pe: 24,  divYield: 2.90, avgVol: 12e6 },
  { sym: 'SO',   name: 'Southern Co.',               sector: 'Utilities', marketCap: 95e9,  pe: 21,  divYield: 3.40, avgVol: 5e6 },
  { sym: 'DUK',  name: 'Duke Energy Corp.',          sector: 'Utilities', marketCap: 90e9,  pe: 20,  divYield: 3.60, avgVol: 4e6 },
  { sym: 'D',    name: 'Dominion Energy Inc.',       sector: 'Utilities', marketCap: 50e9,  pe: 24,  divYield: 4.70, avgVol: 6e6 },
  { sym: 'AEP',  name: 'American Electric Power',    sector: 'Utilities', marketCap: 55e9,  pe: 19,  divYield: 3.70, avgVol: 4e6 },
  { sym: 'EXC',  name: 'Exelon Corp.',               sector: 'Utilities', marketCap: 40e9,  pe: 17,  divYield: 3.60, avgVol: 7e6 },
  { sym: 'SRE',  name: 'Sempra',                     sector: 'Utilities', marketCap: 55e9,  pe: 19,  divYield: 3.10, avgVol: 4e6 },
  { sym: 'XEL',  name: 'Xcel Energy Inc.',           sector: 'Utilities', marketCap: 38e9,  pe: 19,  divYield: 3.40, avgVol: 4e6 },
  { sym: 'PEG',  name: 'Public Service Enterprise',  sector: 'Utilities', marketCap: 42e9,  pe: 21,  divYield: 3.00, avgVol: 3e6 },
];
