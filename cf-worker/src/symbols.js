// Symbol universes mirrored from Apps/finance-terminal/index.html so the gateway's
// aggregate endpoints return the sym+name the client expects (client merges color/icon
// locally). Keep in sync if the client lists change.

export const SECTOR_ETFS = [
  { sym: "XLK", name: "Technology" },
  { sym: "XLV", name: "Healthcare" },
  { sym: "XLF", name: "Financials" },
  { sym: "XLY", name: "Consumer Disc." },
  { sym: "XLI", name: "Industrials" },
  { sym: "XLC", name: "Comm. Services" },
  { sym: "XLP", name: "Consumer Staples" },
  { sym: "XLE", name: "Energy" },
  { sym: "XLB", name: "Materials" },
  { sym: "XLRE", name: "Real Estate" },
  { sym: "XLU", name: "Utilities" },
];

export const FUTURES_PROXIES = [
  { sym: "SPY", name: "S&P 500 (ES)" },
  { sym: "QQQ", name: "Nasdaq 100 (NQ)" },
  { sym: "DIA", name: "Dow Jones (YM)" },
  { sym: "IWM", name: "Russell 2000 (RTY)" },
  { sym: "USO", name: "Crude Oil (CL)" },
  { sym: "GLD", name: "Gold (GC)" },
  { sym: "SLV", name: "Silver (SI)" },
  { sym: "UNG", name: "Natural Gas (NG)" },
  { sym: "IEF", name: "US 10Y Bond (ZN)" },
  { sym: "TLT", name: "US 30Y Bond (ZB)" },
  { sym: "FXE", name: "Euro FX (6E)" },
  { sym: "VIXY", name: "VIX (VX)" },
];

// Treasury / bond ETFs for the Economy tab's "yields" list.
export const BOND_ETFS = [
  { sym: "SHY", name: "1-3 Year Treasury" },
  { sym: "IEF", name: "7-10 Year Treasury" },
  { sym: "TLT", name: "20+ Year Treasury" },
  { sym: "TIP", name: "TIPS (Inflation)" },
  { sym: "LQD", name: "Investment Grade Corp" },
  { sym: "HYG", name: "High Yield Corp" },
  { sym: "AGG", name: "Total Bond Market" },
];

// Currencies shown in the Economy tab FX table (USD base).
export const ECON_CURRENCIES = [
  "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "CNY", "INR", "KRW", "SGD",
  "HKD", "MXN", "BRL", "ZAR", "SEK", "NOK", "NZD", "TWD", "THB", "IDR",
];

// Stock-screener universe (large/mega-cap US names) — mirrors the client list.
export const SCREENER_UNIVERSE = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "JPM", "V",
  "JNJ", "WMT", "PG", "MA", "UNH", "HD", "DIS", "PYPL", "ADBE", "CRM",
  "NFLX", "INTC", "AMD", "CSCO", "PEP", "KO", "MRK", "ABT", "TMO", "AVGO",
  "TXN", "QCOM", "COST", "DHR", "LLY", "NKE", "MCD", "LOW", "ORCL", "ACN",
  "IBM", "GE", "CAT", "BA", "UPS", "RTX", "DE", "MMM", "HON", "COIN",
  "PLTR", "SQ", "UBER", "ABNB", "SNAP", "RBLX", "DDOG", "CRWD", "ZS", "NET",
];

// Indonesian (IDX) universe — Yahoo `.JK` blue chips (LQ45 subset + StockMap sourced names).
// Finnhub's free tier does not cover IDX, so the ID screener uses Yahoo price/volume only;
// name+sector come from this static list (the client's FIN Engine mirrors it). Index: ^JKSE (IHSG).
export const IDX_UNIVERSE = [
  { sym: "BBCA.JK", name: "Bank Central Asia", sector: "Financials" },
  { sym: "BBRI.JK", name: "Bank Rakyat Indonesia", sector: "Financials" },
  { sym: "BMRI.JK", name: "Bank Mandiri", sector: "Financials" },
  { sym: "BBNI.JK", name: "Bank Negara Indonesia", sector: "Financials" },
  { sym: "TLKM.JK", name: "Telkom Indonesia", sector: "Communication" },
  { sym: "ASII.JK", name: "Astra International", sector: "Consumer Disc." },
  { sym: "UNTR.JK", name: "United Tractors", sector: "Industrials" },
  { sym: "ICBP.JK", name: "Indofood CBP", sector: "Consumer Staples" },
  { sym: "INDF.JK", name: "Indofood Sukses Makmur", sector: "Consumer Staples" },
  { sym: "KLBF.JK", name: "Kalbe Farma", sector: "Healthcare" },
  { sym: "SMGR.JK", name: "Semen Indonesia", sector: "Materials" },
  { sym: "PGAS.JK", name: "Perusahaan Gas Negara", sector: "Energy" },
  { sym: "PTBA.JK", name: "Bukit Asam", sector: "Energy" },
  { sym: "ITMG.JK", name: "Indo Tambangraya Megah", sector: "Energy" },
  { sym: "ANTM.JK", name: "Aneka Tambang", sector: "Materials" },
  { sym: "INCO.JK", name: "Vale Indonesia", sector: "Materials" },
  { sym: "TINS.JK", name: "Timah", sector: "Materials" },
  { sym: "JSMR.JK", name: "Jasa Marga", sector: "Industrials" },
  { sym: "AALI.JK", name: "Astra Agro Lestari", sector: "Consumer Staples" },
  { sym: "AUTO.JK", name: "Astra Otoparts", sector: "Consumer Disc." },
  { sym: "WIKA.JK", name: "Wijaya Karya", sector: "Industrials" },
  { sym: "WTON.JK", name: "Wijaya Karya Beton", sector: "Industrials" },
  { sym: "WEGE.JK", name: "Wijaya Karya Gedung", sector: "Industrials" },
  { sym: "GIAA.JK", name: "Garuda Indonesia", sector: "Industrials" },
  { sym: "BUMI.JK", name: "Bumi Resources", sector: "Energy" },
  // Broader LQ45 names (Yahoo .JK). Live price/momentum/liquidity via Yahoo; fundamentals/free-float
  // only where the FIN Engine has a sourced value (else scored on price factors — honest n/a).
  { sym: "ADRO.JK", name: "Alamtri Resources (Adaro)", sector: "Energy" },
  { sym: "AKRA.JK", name: "AKR Corporindo", sector: "Energy" },
  { sym: "AMRT.JK", name: "Sumber Alfaria Trijaya", sector: "Consumer Staples" },
  { sym: "ARTO.JK", name: "Bank Jago", sector: "Financials" },
  { sym: "BRPT.JK", name: "Barito Pacific", sector: "Materials" },
  { sym: "CPIN.JK", name: "Charoen Pokphand Indonesia", sector: "Consumer Staples" },
  { sym: "EMTK.JK", name: "Elang Mahkota Teknologi", sector: "Communication" },
  { sym: "EXCL.JK", name: "XL Axiata", sector: "Communication" },
  { sym: "GOTO.JK", name: "GoTo Gojek Tokopedia", sector: "Technology" },
  { sym: "HRUM.JK", name: "Harum Energy", sector: "Energy" },
  { sym: "INKP.JK", name: "Indah Kiat Pulp & Paper", sector: "Materials" },
  { sym: "INTP.JK", name: "Indocement Tunggal Prakarsa", sector: "Materials" },
  { sym: "ISAT.JK", name: "Indosat Ooredoo Hutchison", sector: "Communication" },
  { sym: "MAPI.JK", name: "Mitra Adiperkasa", sector: "Consumer Disc." },
  { sym: "MDKA.JK", name: "Merdeka Copper Gold", sector: "Materials" },
  { sym: "MEDC.JK", name: "Medco Energi Internasional", sector: "Energy" },
  { sym: "PGEO.JK", name: "Pertamina Geothermal Energy", sector: "Energy" },
  { sym: "SIDO.JK", name: "Sido Muncul", sector: "Healthcare" },
  { sym: "SRTG.JK", name: "Saratoga Investama Sedaya", sector: "Financials" },
  { sym: "TOWR.JK", name: "Sarana Menara Nusantara", sector: "Communication" },
  { sym: "TPIA.JK", name: "Chandra Asri Pacific", sector: "Materials" },
  { sym: "UNVR.JK", name: "Unilever Indonesia", sector: "Consumer Staples" },
];

// Timeframe → Yahoo range/interval (used by /candles and /analyze).
export const TF_MAP = {
  "1W": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
};
