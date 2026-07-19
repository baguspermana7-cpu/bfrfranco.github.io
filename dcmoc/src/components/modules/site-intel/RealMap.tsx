'use client';

/* ─── REAL MAP (PHASE CA) — MapLibre GL + OpenFreeMap vector tiles ───────────
 * Real geographic map (owner: "harus map tampilan beneran"). No API key:
 * OpenFreeMap public tiles (production-allowed, attribution auto-added by
 * MapLibre). maplibre-gl is DYNAMICALLY imported — loads only when the Site
 * tab renders. Offline/tile-failure → the schematic SVG fallback renders
 * (honest chip). Site pins use REAL WGS84 coords (legacy schematic 0-1 values
 * are migrated via resolveSiteCoords to the country/city anchor).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import type { CandidateSite } from '@/types/site-intel';
import { resolveSiteCoords } from '@/constants/geo';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export function RealMap({ sites, selectedId, onSelect, height = 300 }: {
    sites: CandidateSite[];
    selectedId: string | null;
    onSelect?: (id: string) => void;
    height?: number;
}) {
    const ref = React.useRef<HTMLDivElement>(null);
    const mapRef = React.useRef<unknown>(null);
    const markersRef = React.useRef<unknown[]>([]);
    const [failed, setFailed] = React.useState(false);
    const [ready, setReady] = React.useState(false);

    /* init map once */
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const maplibre = (await import('maplibre-gl')).default;
                await import('maplibre-gl/dist/maplibre-gl.css' as string).catch(() => { /* css side-effect */ });
                if (cancelled || !ref.current) return;
                const map = new maplibre.Map({
                    container: ref.current,
                    style: STYLE_URL,
                    center: [106.8456, -6.2088],
                    zoom: 3,
                    attributionControl: { compact: true },
                });
                map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
                map.on('error', () => { if (!cancelled) setFailed(true); });
                map.on('load', () => { if (!cancelled) setReady(true); });
                mapRef.current = map;
            } catch {
                if (!cancelled) setFailed(true);
            }
        })();
        return () => {
            cancelled = true;
            try { (mapRef.current as { remove?: () => void } | null)?.remove?.(); } catch { /* torn down */ }
        };
    }, []);

    /* markers follow sites/selection */
    React.useEffect(() => {
        if (!ready || !mapRef.current) return;
        (async () => {
            const maplibre = (await import('maplibre-gl')).default;
            const map = mapRef.current as InstanceType<typeof maplibre.Map>;
            for (const m of markersRef.current) (m as { remove: () => void }).remove();
            markersRef.current = [];
            const bounds = new maplibre.LngLatBounds();
            sites.forEach((s, i) => {
                const { lat, lng } = resolveSiteCoords(s.lat, s.lng, s.countryId, i);
                const el = document.createElement('button');
                el.setAttribute('aria-label', s.name);
                el.style.cssText = `width:26px;height:26px;border-radius:50%;border:2.5px solid #fff;cursor:pointer;
                    background:${s.id === selectedId ? '#8b5cf6' : '#0ea5e9'};color:#fff;font-size:11px;font-weight:800;
                    box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;`;
                el.textContent = s.label;
                el.onclick = () => onSelect?.(s.id);
                const marker = new maplibre.Marker({ element: el })
                    .setLngLat([lng, lat])
                    .setPopup(new maplibre.Popup({ offset: 18, closeButton: false }).setHTML(
                        `<div style="font:12px system-ui;color:#0f172a"><b>${s.name}</b><br/>${s.city || s.countryId}</div>`))
                    .addTo(map);
                markersRef.current.push(marker);
                bounds.extend([lng, lat]);
            });
            if (sites.length > 0) map.fitBounds(bounds, { padding: 60, maxZoom: 9, duration: 600 });
        })();
    }, [ready, sites, selectedId, onSelect]);

    if (failed) return null;   // parent renders the schematic fallback

    return (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/60">
            <div ref={ref} style={{ height }} className="w-full" />
            <span className="absolute left-2 top-2 z-10 rounded bg-slate-900/80 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                🌍 Peta geografis nyata · OpenFreeMap
            </span>
        </div>
    );
}
