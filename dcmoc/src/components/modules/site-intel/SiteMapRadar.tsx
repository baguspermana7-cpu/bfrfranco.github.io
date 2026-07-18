'use client';

/* ─── Site location map (stylized SVG, no map lib) + 8-axis radar (Phase B) ── */

import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';
import type { CandidateSite, SiteScoreResult, AxisKey } from '@/types/site-intel';
import { AXIS_LABELS } from '@/types/site-intel';

const MAP_STYLES = ['Map', 'Satellite', 'Hybrid', '3D Terrain'] as const;
const SITE_COLORS = ['#a78bfa', '#22d3ee', '#34d399', '#f59e0b', '#fb7185'];

export function SiteMapPanel({ sites, results, selectedId, onSelect }: {
    sites: CandidateSite[]; results: SiteScoreResult[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
    const [style, setStyle] = React.useState<(typeof MAP_STYLES)[number]>('Map');
    const skin = {
        Map: { bg: '#0b1424', land: '#12203a', grid: '#1e3a5f' },
        Satellite: { bg: '#0a0f14', land: '#17251c', grid: '#233c2c' },
        Hybrid: { bg: '#0b1220', land: '#182338', grid: '#25415f' },
        '3D Terrain': { bg: '#100f1c', land: '#221f38', grid: '#37325c' },
    }[style];
    const score = (id: string) => results.find((r) => r.siteId === id);
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
            <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Site Location & Overview</h2>
                <div className="flex gap-1">
                    {MAP_STYLES.map((s) => (
                        <button key={s} onClick={() => setStyle(s)}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${style === s ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-violet-600/10'}`}>{s}</button>
                    ))}
                </div>
            </div>
            <svg viewBox="0 0 100 62" className="w-full rounded-xl" style={{ background: skin.bg }}>
                {/* schematic coast + grid (stylized, not geographic) */}
                <path d="M0,44 C18,38 30,48 46,42 C64,35 78,46 100,40 L100,62 L0,62 Z" fill={skin.land} />
                <path d="M0,44 C18,38 30,48 46,42 C64,35 78,46 100,40" fill="none" stroke={skin.grid} strokeWidth="0.4" />
                {[15, 35, 55, 75].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="62" stroke={skin.grid} strokeWidth="0.15" />)}
                {[15, 30, 45].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke={skin.grid} strokeWidth="0.15" />)}
                {sites.map((s, i) => {
                    const x = 8 + s.lng * 84; const y = 8 + s.lat * 46;
                    const r = score(s.id);
                    const sel = s.id === selectedId;
                    return (
                        <g key={s.id} className="cursor-pointer" onClick={() => onSelect(s.id)}>
                            {sel && <circle cx={x} cy={y} r="4.5" fill={SITE_COLORS[i]} opacity="0.25"><animate attributeName="r" values="3.5;5.5;3.5" dur="2s" repeatCount="indefinite" /></circle>}
                            <circle cx={x} cy={y} r="2.4" fill={SITE_COLORS[i]} stroke="#fff" strokeWidth="0.5" />
                            <text x={x} y={y + 0.9} textAnchor="middle" fontSize="2.6" fontWeight="700" fill="#0b1020">{s.label}</text>
                            <text x={x} y={y - 4} textAnchor="middle" fontSize="2.4" fill="#e2e8f0">{s.name}{r ? ` · ${r.engine.score}` : ''}</text>
                        </g>
                    );
                })}
                <text x="2" y="60" fontSize="2" fill="#64748b">Schematic site plot — not to geographic scale</text>
            </svg>
        </div>
    );
}

export function SiteRadarPanel({ sites, results }: { sites: CandidateSite[]; results: SiteScoreResult[] }) {
    const axes = Object.keys(AXIS_LABELS) as AxisKey[];
    const data = axes.map((k) => {
        const row: Record<string, string | number> = { axis: AXIS_LABELS[k] };
        results.forEach((r) => {
            const site = sites.find((s) => s.id === r.siteId);
            if (site) row[`Site ${site.label}`] = r.axes[k];
        });
        return row;
    });
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Site Intelligence Score Breakdown</h2>
            <p className="mb-1 text-[9px] text-slate-400">8-axis presentation view — authoritative Total Score = engine models.site.score</p>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={data} outerRadius="72%">
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#64748b' }} />
                        {results.map((r, i) => {
                            const site = sites.find((s) => s.id === r.siteId);
                            if (!site) return null;
                            return <Radar key={r.siteId} name={`Site ${site.label}`} dataKey={`Site ${site.label}`}
                                stroke={SITE_COLORS[i]} fill={SITE_COLORS[i]} fillOpacity={0.12} strokeWidth={1.5} />;
                        })}
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export { SITE_COLORS };
