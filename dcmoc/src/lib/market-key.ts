/* ─── resolveMarketKey — CapexDashboard cityMarket value → DATA.markets key ───
 * The city-market <select> emits snake_case values (e.g. "northern_virginia");
 * DATA.markets is keyed in kebab-case with a couple of shorthand keys. Most map
 * by `_ → -`, but a few need an explicit alias. This was duplicated (and subtly
 * broken — "northern_virginia" resolved to the non-existent "northern-virginia"
 * so the flagship $215 colo rate silently fell back to the band) across three
 * surfaces; ONE resolver now, so revenue/WACC AUTO can't drift by market. */
const MARKET_ALIAS: Record<string, string> = {
    northern_virginia: 'n-virginia',
    virginia: 'n-virginia',
    malaysia: 'kuala-lumpur',
};

/** Returns the DATA.markets key ('none' when no market selected). */
export function resolveMarketKey(cityMarket: string | undefined | null): string {
    const raw = cityMarket ?? 'none';
    return MARKET_ALIAS[raw] ?? raw.replace(/_/g, '-');
}
