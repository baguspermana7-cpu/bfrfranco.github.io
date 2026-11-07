'use client';

/* ─── Selection process — criteria · screening · decision (v3.25.0) ──────────
 * The site page used to be a scoreboard: weights fixed in the engine, no
 * must-have gates, and the "best site" never reached the project. This panel
 * family makes the selection a stated process: 1 Criteria (weight profile +
 * gates) → 2 Candidates → 3 Screening (gate matrix) → 4 Scoring → 5 Decision
 * (recommended site, drivers, runner-up gap, Adopt → requirements + country).
 * Every number is the engine's (models.site.score with the profile weights).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import type { CandidateSite, SiteScoreResult, FactorKey } from '@/types/site-intel';
import { weightProfiles, gateDefs, type SiteScreening, type GateResult } from '@/lib/site-screening';
import { Tooltip } from '@/components/ui/Tooltip';
import { CheckCircle2, Circle, ShieldAlert, ShieldCheck, HelpCircle, ArrowRight } from 'lucide-react';

export const PROCESS_STEPS = [
    { id: 'sec-criteria', label: '1 Criteria', tip: 'Choose the weight profile for this use case and the must-have gates. Weights are engine-published (DATA.site.weightProfiles); the balanced profile is the engine default.' },
    { id: 'sec-map', label: '2 Candidates', tip: 'Candidate sites (max 5). Each carries its own attributes; anything not entered falls back to the country research baseline.' },
    { id: 'sec-screening', label: '3 Screening', tip: 'Hard gates. A site failing any enabled gate is screened out of the ranking regardless of its weighted score. Unknown = attribute not entered (never fails a site).' },
    { id: 'sec-compare', label: '4 Scoring & Compare', tip: 'Weighted engine score (0–100) and the 8 presentation axes for every candidate that passed screening.' },
    { id: 'sec-decision', label: '5 Decision', tip: 'Recommended site = highest engine score among candidates that pass every enabled gate. Adopt writes it into Requirements (site status, city) and sets the project country.' },
] as const;

const FACTOR_LABEL: Record<FactorKey, string> = {
    power: 'Power price', grid: 'Grid reliability', seismic: 'Seismic', talent: 'Talent pool', tax: 'Tax & incentives',
    carbon: 'Grid carbon', flood: 'Flood', latency: 'Latency / market', water: 'Water stress', climate: 'Free-cooling climate',
};

export function SelectionStepper({ done, active, onJump }: { done: Record<string, boolean>; active: string; onJump: (id: string) => void }) {
    return (
        <div className="flex gap-1 overflow-x-auto rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-1" role="tablist" aria-label="Selection process">
            {PROCESS_STEPS.map((t, i) => {
                const isDone = !!done[t.id];
                const isActive = active === t.id;
                return (
                    <button key={t.id} role="tab" aria-selected={isActive} onClick={() => onJump(t.id)} title={t.tip}
                        className={`flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-[11px] font-medium ${isActive ? 'bg-rz-signal text-black' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        {isDone ? <CheckCircle2 className={`h-3.5 w-3.5 ${isActive ? 'text-black' : 'text-rz-mint'}`} /> : <Circle className="h-3.5 w-3.5 opacity-50" />}
                        {t.label}
                        {i < PROCESS_STEPS.length - 1 && <span className="ml-1 opacity-40">›</span>}
                    </button>
                );
            })}
        </div>
    );
}

export function CriteriaPanel({ profileId, onProfile, gatesEnabled, onToggleGate, screenings }: {
    profileId: string; onProfile: (id: string) => void;
    gatesEnabled: Record<string, boolean>; onToggleGate: (id: string) => void;
    screenings: Map<string, SiteScreening>;
}) {
    const profiles = weightProfiles();
    const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];
    const gates = gateDefs();
    const countBy = (gateId: string, status: GateResult['status']) =>
        Array.from(screenings.values()).filter((s) => s.gates.find((g) => g.id === gateId)?.status === status).length;
    return (
        <div id="sec-criteria" className="scroll-mt-24 grid gap-3 lg:grid-cols-2">
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Criteria weights <Tooltip content="Weight profile applied to the 10 engine factors (sum = 100 %). Pick the profile that matches the project use case; the balanced profile is the engine default and reproduces the previous scores exactly." />
                </h2>
                <label className="mb-2 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="w-24 shrink-0">Profile</span>
                    <select value={profile.id} onChange={(e) => onProfile(e.target.value)}
                        className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-100">
                        {profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                </label>
                <div className="space-y-1">
                    {(Object.keys(profile.weights) as FactorKey[]).sort((a, b) => profile.weights[b] - profile.weights[a]).map((k) => (
                        <div key={k} className="flex items-center gap-2 text-[11px]">
                            <span className="w-32 shrink-0 text-slate-600 dark:text-slate-300">{FACTOR_LABEL[k] ?? k}</span>
                            <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                <div className="h-1.5 rounded bg-rz-info" style={{ width: `${Math.round(profile.weights[k] * 100 / 0.25)}%` }} />
                            </div>
                            <span className="w-9 text-right tabular-nums text-slate-500">{Math.round(profile.weights[k] * 100)}%</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Must-have gates <Tooltip content="Hard screening criteria. A candidate failing any enabled gate is excluded from the ranking and can never be the recommended site. Thresholds are engine-published screening conventions (DATA.site.gates)." />
                </h2>
                <div className="space-y-1.5">
                    {gates.map((g) => {
                        const on = gatesEnabled[g.id] !== false;
                        const fails = countBy(g.id, 'fail'), unk = countBy(g.id, 'unknown');
                        return (
                            <label key={g.id} className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-200">
                                <input type="checkbox" checked={on} onChange={() => onToggleGate(g.id)} className="h-3.5 w-3.5 accent-rz-signal" aria-label={`Gate: ${g.label}`} />
                                <span className="flex-1">{g.label}</span>
                                {on && fails > 0 && <span className="rounded border border-rz-alert/40 px-1.5 py-0.5 text-[9px] font-semibold text-rz-alert">{fails} fail</span>}
                                {on && unk > 0 && <span className="rounded border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500">{unk} unknown</span>}
                                {!on && <span className="text-[9px] text-slate-400">off</span>}
                            </label>
                        );
                    })}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Unknown = attribute not entered for the site and no country baseline — fill it in Edit Criteria. Water gate applies only when the cooling design rejects heat through water.</p>
            </div>
        </div>
    );
}

const StatusChip = ({ g }: { g: GateResult }) => {
    const base = 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold';
    if (!g.enabled) return <span className={`${base} text-slate-400`}>off</span>;
    if (g.status === 'pass') return <span className={`${base} text-rz-mint`} title={`${g.observed} (${g.threshold})`}><ShieldCheck className="h-3 w-3" /> pass · {g.observed}</span>;
    if (g.status === 'fail') return <span className={`${base} text-rz-alert`} title={`${g.observed} (${g.threshold})`}><ShieldAlert className="h-3 w-3" /> FAIL · {g.observed}</span>;
    if (g.status === 'skipped') return <span className={`${base} text-slate-400`} title={g.observed}>n/a</span>;
    return <span className={`${base} text-slate-500`} title={g.threshold}><HelpCircle className="h-3 w-3" /> unknown</span>;
};

export function ScreeningPanel({ sites, screenings }: { sites: CandidateSite[]; screenings: Map<string, SiteScreening> }) {
    const gates = gateDefs();
    return (
        <div id="sec-screening" className="scroll-mt-24 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
            <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Screening — gate matrix <Tooltip content="Each enabled gate evaluated per candidate: pass / FAIL / unknown. Observed value shown next to the result; hover for the threshold. Source = site attribute, else country baseline." />
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                            <th className="py-1 pr-2 text-left">Gate</th>
                            {sites.map((s) => <th key={s.id} className="px-2 py-1 text-right">Site {s.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {gates.map((g) => (
                            <tr key={g.id} className="border-b border-slate-100 dark:border-slate-800/60">
                                <td className="py-1.5 pr-2 text-slate-600 dark:text-slate-300">{g.label}</td>
                                {sites.map((s) => {
                                    const r = screenings.get(s.id)?.gates.find((x) => x.id === g.id);
                                    return <td key={s.id} className="px-2 py-1.5 text-right">{r ? <StatusChip g={r} /> : '—'}</td>;
                                })}
                            </tr>
                        ))}
                        <tr>
                            <td className="py-1.5 pr-2 font-semibold text-slate-800 dark:text-slate-200">Result</td>
                            {sites.map((s) => {
                                const sc = screenings.get(s.id);
                                if (!sc) return <td key={s.id} />;
                                return <td key={s.id} className="px-2 py-1.5 text-right">
                                    {sc.passed
                                        ? <span className="rounded border border-rz-mint/40 px-1.5 py-0.5 text-[9px] font-semibold text-rz-mint">PASS{sc.unknown.length ? ` · ${sc.unknown.length} unknown` : ''}</span>
                                        : <span className="rounded border border-rz-alert/40 px-1.5 py-0.5 text-[9px] font-semibold text-rz-alert">SCREENED OUT · {sc.failed.map((f) => f.id).join(', ')}</span>}
                                </td>;
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function DecisionPanel({ sites, ranked, screenings, adoptedSiteId, onAdopt, onSelect }: {
    sites: CandidateSite[]; ranked: SiteScoreResult[]; screenings: Map<string, SiteScreening>;
    adoptedSiteId: string | null; onAdopt: (site: CandidateSite) => void; onSelect: (id: string) => void;
}) {
    const passing = ranked.filter((r) => screenings.get(r.siteId)?.passed !== false);
    const best = passing[0] ?? null;
    const bestSite = best ? sites.find((s) => s.id === best.siteId) ?? null : null;
    const runner = passing[1] ?? null;
    const runnerSite = runner ? sites.find((s) => s.id === runner.siteId) ?? null : null;
    const drivers = best ? [...best.engine.breakdown].sort((a, b) => b.contribution - a.contribution).slice(0, 3) : [];
    const weakest = best ? [...best.engine.breakdown].sort((a, b) => a.value - b.value)[0] : null;
    const unknowns = best ? screenings.get(best.siteId)?.unknown ?? [] : [];
    const adopted = adoptedSiteId && bestSite && adoptedSiteId === bestSite.id;
    const adoptedOther = adoptedSiteId && !adopted ? sites.find((s) => s.id === adoptedSiteId) : null;
    return (
        <div id="sec-decision" className="scroll-mt-24 rounded border border-rz-signal/30 bg-rz-signal/5 p-4">
            <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Decision <Tooltip content="Recommended site = highest engine score among candidates that pass every enabled gate. Drivers are the three largest weighted contributions; the runner-up gap is the score margin to the next passing candidate." />
            </h2>
            {!best || !bestSite ? (
                <p className="text-xs text-slate-600 dark:text-slate-300">No candidate passes the enabled gates. Relax a gate in Criteria or edit the failing attribute in Edit Criteria — the ranking stays empty until one candidate passes.</p>
            ) : (
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
                        <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">Recommended</span>
                            <button onClick={() => onSelect(bestSite.id)} className="text-base font-bold text-slate-900 dark:text-white underline decoration-dotted underline-offset-2">Site {bestSite.label} — {bestSite.name}</button>
                            <span className="tabular-nums text-slate-500">{best.engine.score}/100 · grade {best.engine.grade} ({best.engine.label})</span>
                            <span className="text-[10px] text-slate-500">{passing.length} of {sites.length} candidate{sites.length === 1 ? '' : 's'} pass screening</span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">Why</span>
                            <ul className="mt-0.5 list-disc pl-4">
                                {drivers.map((d) => <li key={d.key}>{FACTOR_LABEL[d.key] ?? d.key}: factor {Math.round(d.value * 100)}% × weight {Math.round(d.weight * 100)}% = {(d.contribution * 100).toFixed(1)} pts</li>)}
                                {weakest && <li className="text-slate-500">Weakest factor: {FACTOR_LABEL[weakest.key] ?? weakest.key} ({Math.round(weakest.value * 100)}%) — the lever to negotiate or mitigate.</li>}
                                {runner && runnerSite && <li className="text-slate-500">Runner-up: Site {runnerSite.label} — {runnerSite.name} at {runner.engine.score}/100 (gap {(best.engine.score - runner.engine.score).toFixed(1)} pts{best.engine.score - runner.engine.score < 3 ? ' — close call, confirm the unknowns before committing' : ''}).</li>}
                                {unknowns.length > 0 && <li className="text-slate-500">Unconfirmed gates on the recommended site: {unknowns.map((u) => u.label).join('; ')}.</li>}
                            </ul>
                        </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                        {adopted ? (
                            <span className="inline-flex items-center gap-1 rounded border border-rz-mint/40 px-2 py-1 text-[11px] font-semibold text-rz-mint"><CheckCircle2 className="h-3.5 w-3.5" /> Adopted into the project</span>
                        ) : (
                            <button onClick={() => onAdopt(bestSite)} className="inline-flex items-center gap-1.5 rounded bg-rz-signal px-3 py-1.5 text-xs font-semibold text-black hover:bg-rz-signal/90">
                                Adopt Site {bestSite.label} <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        )}
                        {adoptedOther && <span className="text-[10px] text-slate-500">Currently adopted: Site {adoptedOther.label} — {adoptedOther.name}</span>}
                        <span className="max-w-[220px] text-right text-[10px] text-slate-500">Adopt writes site status = shortlisted and the city into Requirements 1.1 and sets the project country to the site&apos;s country.</span>
                    </div>
                </div>
            )}
        </div>
    );
}
