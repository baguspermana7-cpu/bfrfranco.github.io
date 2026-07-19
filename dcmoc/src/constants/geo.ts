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
    CA: { lat: 43.6532, lng: -79.3832, capital: 'Toronto' },       // DC hub, not Ottawa
    CH: { lat: 47.3769, lng: 8.5417, capital: 'Zurich' },          // DC hub, not Bern
    CL: { lat: -33.4489, lng: -70.6693, capital: 'Santiago' },
    CN: { lat: 39.9042, lng: 116.4074, capital: 'Beijing' },
    CO: { lat: 4.711, lng: -74.0721, capital: 'Bogotá' },
    DE: { lat: 50.1109, lng: 8.6821, capital: 'Frankfurt' },       // DC hub, not Berlin
    DK: { lat: 55.6761, lng: 12.5683, capital: 'Copenhagen' },
    ES: { lat: 40.4168, lng: -3.7038, capital: 'Madrid' },
    FI: { lat: 60.1699, lng: 24.9384, capital: 'Helsinki' },
    FR: { lat: 48.8566, lng: 2.3522, capital: 'Paris' },
    GB: { lat: 51.5074, lng: -0.1278, capital: 'London' },
    ID: { lat: -6.2088, lng: 106.8456, capital: 'Jakarta' },
    IE: { lat: 53.3498, lng: -6.2603, capital: 'Dublin' },
    IN: { lat: 19.076, lng: 72.8777, capital: 'Mumbai' },          // DC hub
    IT: { lat: 45.4642, lng: 9.19, capital: 'Milan' },             // DC hub, not Rome
    JP: { lat: 35.6762, lng: 139.6503, capital: 'Tokyo' },
    KE: { lat: -1.2921, lng: 36.8219, capital: 'Nairobi' },
    KR: { lat: 37.5665, lng: 126.978, capital: 'Seoul' },
    MX: { lat: 20.5888, lng: -100.3899, capital: 'Querétaro' },    // DC hub
    MY: { lat: 1.4927, lng: 103.7414, capital: 'Johor Bahru' },    // DC hub
    NG: { lat: 6.5244, lng: 3.3792, capital: 'Lagos' },
    NL: { lat: 52.3676, lng: 4.9041, capital: 'Amsterdam' },
    NO: { lat: 59.9139, lng: 10.7522, capital: 'Oslo' },
    NZ: { lat: -36.8485, lng: 174.7633, capital: 'Auckland' },
    OM: { lat: 23.588, lng: 58.3829, capital: 'Muscat' },
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

/* ── CD3: real DC-hub cities per country (dropdown source; picking a city also
 * sets coordinates — city choice moves the map pin). 2-4 hubs per market,
 * screening-curated 2026. Custom entry stays available via the combobox. ── */
export interface DcCity { name: string; lat: number; lng: number }

export const DC_CITIES: Record<string, DcCity[]> = {
    AE: [{ name: 'Abu Dhabi', lat: 24.4539, lng: 54.3773 }, { name: 'Dubai', lat: 25.2048, lng: 55.2708 }],
    AU: [{ name: 'Sydney', lat: -33.8688, lng: 151.2093 }, { name: 'Melbourne', lat: -37.8136, lng: 144.9631 }, { name: 'Canberra', lat: -35.2809, lng: 149.13 }],
    BR: [{ name: 'São Paulo', lat: -23.5505, lng: -46.6333 }, { name: 'Campinas', lat: -22.9099, lng: -47.0626 }, { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 }],
    CA: [{ name: 'Toronto', lat: 43.6532, lng: -79.3832 }, { name: 'Montréal', lat: 45.5017, lng: -73.5673 }, { name: 'Vancouver', lat: 49.2827, lng: -123.1207 }],
    CH: [{ name: 'Zurich', lat: 47.3769, lng: 8.5417 }, { name: 'Geneva', lat: 46.2044, lng: 6.1432 }],
    CL: [{ name: 'Santiago', lat: -33.4489, lng: -70.6693 }],
    CN: [{ name: 'Beijing', lat: 39.9042, lng: 116.4074 }, { name: 'Shanghai', lat: 31.2304, lng: 121.4737 }, { name: 'Guangzhou', lat: 23.1291, lng: 113.2644 }, { name: 'Ulanqab', lat: 40.9944, lng: 113.1327 }],
    CO: [{ name: 'Bogotá', lat: 4.711, lng: -74.0721 }],
    DE: [{ name: 'Frankfurt', lat: 50.1109, lng: 8.6821 }, { name: 'Berlin', lat: 52.52, lng: 13.405 }, { name: 'Munich', lat: 48.1351, lng: 11.582 }],
    DK: [{ name: 'Copenhagen', lat: 55.6761, lng: 12.5683 }, { name: 'Odense', lat: 55.4038, lng: 10.4024 }],
    ES: [{ name: 'Madrid', lat: 40.4168, lng: -3.7038 }, { name: 'Barcelona', lat: 41.3874, lng: 2.1686 }, { name: 'Zaragoza (Aragón)', lat: 41.6488, lng: -0.8891 }],
    FI: [{ name: 'Helsinki', lat: 60.1699, lng: 24.9384 }, { name: 'Hamina', lat: 60.5693, lng: 27.1878 }],
    FR: [{ name: 'Paris', lat: 48.8566, lng: 2.3522 }, { name: 'Marseille', lat: 43.2965, lng: 5.3698 }],
    GB: [{ name: 'London (Slough)', lat: 51.5074, lng: -0.1278 }, { name: 'Manchester', lat: 53.4808, lng: -2.2426 }],
    ID: [{ name: 'Jakarta', lat: -6.2088, lng: 106.8456 }, { name: 'Bekasi-Cikarang', lat: -6.3054, lng: 107.1443 }, { name: 'Batam', lat: 1.0456, lng: 104.0305 }],
    IE: [{ name: 'Dublin', lat: 53.3498, lng: -6.2603 }],
    IN: [{ name: 'Mumbai', lat: 19.076, lng: 72.8777 }, { name: 'Chennai', lat: 13.0827, lng: 80.2707 }, { name: 'Hyderabad', lat: 17.385, lng: 78.4867 }],
    IT: [{ name: 'Milan', lat: 45.4642, lng: 9.19 }, { name: 'Rome', lat: 41.9028, lng: 12.4964 }],
    JP: [{ name: 'Tokyo', lat: 35.6762, lng: 139.6503 }, { name: 'Osaka', lat: 34.6937, lng: 135.5023 }, { name: 'Inzai', lat: 35.8324, lng: 140.1456 }],
    KE: [{ name: 'Nairobi', lat: -1.2921, lng: 36.8219 }],
    KR: [{ name: 'Seoul', lat: 37.5665, lng: 126.978 }, { name: 'Busan', lat: 35.1796, lng: 129.0756 }],
    MX: [{ name: 'Querétaro', lat: 20.5888, lng: -100.3899 }, { name: 'Mexico City', lat: 19.4326, lng: -99.1332 }],
    MY: [{ name: 'Johor Bahru', lat: 1.4927, lng: 103.7414 }, { name: 'Cyberjaya', lat: 2.9213, lng: 101.6559 }, { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 }],
    NG: [{ name: 'Lagos', lat: 6.5244, lng: 3.3792 }],
    NL: [{ name: 'Amsterdam', lat: 52.3676, lng: 4.9041 }, { name: 'Eemshaven', lat: 53.4386, lng: 6.8353 }],
    NO: [{ name: 'Oslo', lat: 59.9139, lng: 10.7522 }, { name: 'Stavanger', lat: 58.9699, lng: 5.7331 }],
    NZ: [{ name: 'Auckland', lat: -36.8485, lng: 174.7633 }],
    OM: [{ name: 'Muscat', lat: 23.588, lng: 58.3829 }, { name: 'Salalah', lat: 17.0151, lng: 54.0924 }, { name: 'Duqm', lat: 19.6658, lng: 57.7044 }],
    PH: [{ name: 'Manila', lat: 14.5995, lng: 120.9842 }, { name: 'Cavite', lat: 14.4791, lng: 120.8969 }],
    PL: [{ name: 'Warsaw', lat: 52.2297, lng: 21.0122 }],
    PT: [{ name: 'Lisbon', lat: 38.7223, lng: -9.1393 }, { name: 'Sines', lat: 37.9561, lng: -8.8698 }],
    QA: [{ name: 'Doha', lat: 25.2854, lng: 51.531 }],
    SA: [{ name: 'Riyadh', lat: 24.7136, lng: 46.6753 }, { name: 'NEOM', lat: 28.0, lng: 35.0 }, { name: 'Dammam', lat: 26.3927, lng: 49.9777 }],
    SE: [{ name: 'Stockholm', lat: 59.3293, lng: 18.0686 }, { name: 'Luleå', lat: 65.5848, lng: 22.1547 }],
    SG: [{ name: 'Singapore', lat: 1.3521, lng: 103.8198 }],
    TH: [{ name: 'Bangkok', lat: 13.7563, lng: 100.5018 }, { name: 'Chonburi (EEC)', lat: 13.3611, lng: 100.9847 }],
    TW: [{ name: 'Taipei', lat: 25.033, lng: 121.5654 }, { name: 'Taoyuan', lat: 24.9936, lng: 121.301 }],
    US: [{ name: 'Ashburn, VA', lat: 39.0438, lng: -77.4874 }, { name: 'Dallas, TX', lat: 32.7767, lng: -96.797 }, { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.074 }, { name: 'Silicon Valley, CA', lat: 37.3541, lng: -121.9552 }],
    VN: [{ name: 'Ho Chi Minh City', lat: 10.8231, lng: 106.6297 }, { name: 'Hanoi', lat: 21.0278, lng: 105.8342 }],
    ZA: [{ name: 'Johannesburg', lat: -26.2041, lng: 28.0473 }, { name: 'Cape Town', lat: -33.9249, lng: 18.4241 }],
};
