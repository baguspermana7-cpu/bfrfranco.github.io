/* ─── Country geo anchors (CA2) ──────────────────────────────────────────────
 * Capital-city coordinates (WGS84) per countries.ts profile — used to seed
 * candidate-site pins on the REAL map and to migrate legacy schematic 0-1
 * coordinates. Source: standard national-capital coordinates (public geodata).
 * ──────────────────────────────────────────────────────────────────────── */

export interface GeoAnchor { lat: number; lng: number; capital: string }

export const COUNTRY_GEO: Record<string, GeoAnchor> = {
    AE: { lat: 24.4539, lng: 54.3773, capital: 'Abu Dhabi' },
    AU: { lat: -35.2809, lng: 149.13, capital: 'Canberra' },
    BR: { lat: -15.7939, lng: -47.8828, capital: 'Brasília' },
    CL: { lat: -33.4489, lng: -70.6693, capital: 'Santiago' },
    CN: { lat: 39.9042, lng: 116.4074, capital: 'Beijing' },
    CO: { lat: 4.711, lng: -74.0721, capital: 'Bogotá' },
    DE: { lat: 50.1109, lng: 8.6821, capital: 'Frankfurt' },       // DC hub, not Berlin
    FR: { lat: 48.8566, lng: 2.3522, capital: 'Paris' },
    GB: { lat: 51.5074, lng: -0.1278, capital: 'London' },
    ID: { lat: -6.2088, lng: 106.8456, capital: 'Jakarta' },
    IE: { lat: 53.3498, lng: -6.2603, capital: 'Dublin' },
    IN: { lat: 19.076, lng: 72.8777, capital: 'Mumbai' },          // DC hub
    JP: { lat: 35.6762, lng: 139.6503, capital: 'Tokyo' },
    KE: { lat: -1.2921, lng: 36.8219, capital: 'Nairobi' },
    KR: { lat: 37.5665, lng: 126.978, capital: 'Seoul' },
    MX: { lat: 20.5888, lng: -100.3899, capital: 'Querétaro' },    // DC hub
    MY: { lat: 1.4927, lng: 103.7414, capital: 'Johor Bahru' },    // DC hub
    NG: { lat: 6.5244, lng: 3.3792, capital: 'Lagos' },
    NL: { lat: 52.3676, lng: 4.9041, capital: 'Amsterdam' },
    NZ: { lat: -36.8485, lng: 174.7633, capital: 'Auckland' },
    PH: { lat: 14.5995, lng: 120.9842, capital: 'Manila' },
    PL: { lat: 52.2297, lng: 21.0122, capital: 'Warsaw' },
    PT: { lat: 38.7223, lng: -9.1393, capital: 'Lisbon' },
    QA: { lat: 25.2854, lng: 51.531, capital: 'Doha' },
    SA: { lat: 24.7136, lng: 46.6753, capital: 'Riyadh' },
    SE: { lat: 59.3293, lng: 18.0686, capital: 'Stockholm' },
    SG: { lat: 1.3521, lng: 103.8198, capital: 'Singapore' },
    TH: { lat: 13.7563, lng: 100.5018, capital: 'Bangkok' },
    TW: { lat: 25.033, lng: 121.5654, capital: 'Taipei' },
    US: { lat: 39.0438, lng: -77.4874, capital: 'Ashburn, VA' },   // DC hub, not DC
    VN: { lat: 10.8231, lng: 106.6297, capital: 'Ho Chi Minh City' },
    ZA: { lat: -26.2041, lng: 28.0473, capital: 'Johannesburg' },
};

/** True when a stored coordinate pair is a legacy schematic (0-1 normalized) value. */
export function isSchematicCoord(lat: number, lng: number): boolean {
    return lat >= 0 && lat <= 1 && lng >= 0 && lng <= 1;
}

/** Real coordinates for a site: keeps real WGS84, migrates legacy schematic
 *  values to the country anchor with a small per-index jitter so pins spread. */
export function resolveSiteCoords(lat: number, lng: number, countryId: string, index = 0): { lat: number; lng: number } {
    if (!isSchematicCoord(lat, lng) && Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    const g = COUNTRY_GEO[countryId] ?? COUNTRY_GEO.ID;
    const jitter = 0.045 * (index + 1);
    return { lat: g.lat + jitter * (index % 2 === 0 ? 1 : -1), lng: g.lng + jitter };
}
