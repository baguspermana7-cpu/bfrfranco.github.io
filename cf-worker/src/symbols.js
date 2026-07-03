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

// Timeframe → Yahoo range/interval (used by /candles and /analyze).
export const TF_MAP = {
  "1W": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
};
