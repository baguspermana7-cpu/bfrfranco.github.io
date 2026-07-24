'use client';

/* ─── Node-click subsystem detail modal (Workstream S) ───────────────────────
 * Click ANY diagram node → portal modal describing that SUB-SYSTEM: the
 * engineering symbol + SYMBOL_META chip, a spec table derived from the SAME
 * layout inputs the node was drawn from (units, per-unit duty, redundancy
 * role, configuration chips from `sub`, engineering note from `hover`), a
 * per-SymbolKind DETAIL registry (what it is + governing standard), and the
 * node's loop/bus connections from the live DiagramModel edges. No second
 * estimate — every number shown was written at layout time.
 * A11y idiom copied from RedValue DiagnosticModal (portal, ESC, overlay
 * click, aria-modal, z-[120], SSR document guard).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import type { DiagBlock, DiagramModel, EdgeKind } from './layout';
import { SymbolGlyph, SYMBOL_META, type SymbolKind } from './palette';

const EDGE_LABEL: Record<EdgeKind, string> = {
    normal: 'normal power',
    backup: 'backup power',
    control: 'control / monitoring',
    coolSupply: 'cooling supply',
    coolReturn: 'cooling return',
};

/** Per-kind subsystem explainer + governing standard (chips split on ' / '). */
const DETAIL: Record<SymbolKind, { body: string; standard: string }> = {
    utility: {
        body: 'Grid point of connection — the incoming MV/HV service from the utility. Feed diversity (A/B incomers from separate substations) is the first layer of concurrent maintainability.',
        standard: 'IEC 61936',
    },
    transformer: {
        body: 'Steps the utility medium voltage down to LV (415 V) for distribution. Banks are sized so the surviving units carry the full critical load with one out; each unit has a primary disconnect switch and an LV main breaker.',
        standard: 'IEC 60076',
    },
    switchgear: {
        body: 'Metal-clad MV boards that section, protect and meter the incoming feeds. Each board carries its train\'s incomer, bus and feeder breakers with protection relays.',
        standard: 'IEC 62271',
    },
    genset: {
        body: 'Diesel standby engine-alternators, off-line until a utility outage. NFPA 110 Level 1 requirement: crank, reach voltage/frequency, and accept load within 10 s of the ATS start signal.',
        standard: 'NFPA 110 / ISO 8528',
    },
    fuel: {
        body: 'Bulk diesel storage plus day tanks sized for the autonomy target, with duplex transfer/polishing pumps and leak-detected containment.',
        standard: 'NFPA 30',
    },
    ups: {
        body: 'Double-conversion UPS modules ride through the gap between utility loss and generator pickup. Battery autonomy covers the transfer window with margin; modules are paralleled per train for redundancy.',
        standard: 'IEC 62040 / IEEE 946',
    },
    battery: {
        body: 'Stored-energy strings (VRLA/Li-ion) or a grid-scale BESS bridging outages and shaving peaks. Li-ion installations follow UL 9540/9540A thermal-runaway containment and spacing rules.',
        standard: 'IEEE 946 / UL 9540',
    },
    pdu: {
        body: 'Power distribution units transform and distribute LV power to the rack rows with branch-circuit monitoring. A/B pairs keep dual-corded IT equipment fed through any single-path failure.',
        standard: 'IEC 61439',
    },
    rack: {
        body: 'IT cabinets grouped into workload cells. Rack density (kW/rack) drives the cooling approach and the busway/PDU sizing for the hall.',
        standard: 'ASHRAE TC9.9',
    },
    fabric: {
        body: 'Spine-leaf network fabric — roughly one leaf switch per 16 racks, non-blocking east-west. AI pods add a separate high-radix GPU interconnect alongside the front-end fabric.',
        standard: 'TIA-942',
    },
    chiller: {
        body: 'Water-cooled chillers produce chilled water for the CRAH/coil loop. The fleet is split duty + standby so full capacity survives one machine failure (N+1) or a whole train (2N).',
        standard: 'AHRI 550/590',
    },
    coolingTower: {
        body: 'Evaporative towers reject condenser heat to ambient, sized on the design wet-bulb; water treatment and drift control govern consumption.',
        standard: 'CTI STD-201',
    },
    cdu: {
        body: 'Coolant distribution units isolate the technology (chip) loop from facility water, hold the supply setpoint and manage flow to the cold plates per loop.',
        standard: 'ASHRAE TC9.9',
    },
    crah: {
        body: 'Computer-room air handlers remove hall air-side heat. In liquid-cooled plants they carry the residual ~25% of heat (VRMs, DIMMs, drives, room losses) that direct-to-chip capture misses.',
        standard: 'ASHRAE TC9.9',
    },
    bms: {
        body: 'Building management + DCIM — monitoring, alarms and control sequences over BACnet/Modbus. Drives the dashed control edges in the diagram.',
        standard: 'ISO 16484-5',
    },
    itload: {
        body: 'The critical IT load itself. Heat rejected to the cooling loops equals IT power in (not IT × PUE) — the reference every loop and bus in this diagram is sized against.',
        standard: 'ASHRAE TC9.9',
    },
    breaker: {
        body: 'Circuit breaker — fault interruption plus isolation. The bus-tie breaker between the A and B buses is NORMALLY OPEN and closed only for a maintenance transfer, never paralleling sources.',
        standard: 'IEC 60947 / IEEE C37',
    },
    disconnect: {
        body: 'Off-load isolation switch providing a visible break for safe maintenance, typically fitted on transformer primaries.',
        standard: 'IEC 60947-3',
    },
    ats: {
        body: 'Automatic transfer switch — senses utility loss, signals genset start and transfers the load to generation; retransfers with a programmed delay once the utility is stable.',
        standard: 'NFPA 110 / UL 1008',
    },
    dryCooler: {
        body: 'Air-cooled (dry) heat rejection — no evaporative water use. Capacity tracks ambient dry-bulb, so the fleet carries duty + standby margin for the design day.',
        standard: 'ASHRAE TC9.9',
    },
    solarArray: {
        body: 'On-site PV array offsetting daytime facility load, tied to the plant at the MV/LV bus through the PCS.',
        standard: 'IEC 61215',
    },
    inverter: {
        body: 'Power conversion system tying PV/BESS DC to the AC bus with grid-code protection and anti-islanding.',
        standard: 'IEEE 1547 / UL 1741',
    },
    pump: {
        body: 'Circulation pumps (duty + standby sets) hold loop flow; variable-speed drives trim flow to the loop ΔT setpoint.',
        standard: 'HI / ASHRAE 90.1',
    },
    heatExchanger: {
        body: 'Plate heat exchanger separating two water loops (seawater/facility or facility/technology), transferring the full duty across a small approach temperature while isolating water chemistry.',
        standard: 'AHRI 400',
    },
};

interface Connection { out: boolean; other: DiagBlock; kind: EdgeKind; label?: string }

export function NodeDetailModal({ block: b, model, onClose }: {
    block: DiagBlock; model: DiagramModel; onClose: () => void;
}) {
    React.useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onClose]);
    if (typeof document === 'undefined') return null;

    const meta = b.kind ? SYMBOL_META[b.kind] : null;
    const detail = b.kind ? DETAIL[b.kind] : null;
    const chips = (b.sub ?? '').split('·').map((s) => s.trim()).filter(Boolean);
    /* per-unit duty written into the hover at layout time (real numbers — no re-derivation) */
    const perUnit = b.hover?.match(/([\d.,]+)\s*MW\/unit/i)?.[0] ?? null;
    const standby = b.badge === 'STANDBY' || b.standby;
    const conns: Connection[] = model.edges.flatMap((e) => {
        if (e.from !== b.id && e.to !== b.id) return [];
        const out = e.from === b.id;
        const other = model.blocks.find((x) => x.id === (out ? e.to : e.from));
        return other ? [{ out, other, kind: e.kind, label: e.label }] : [];
    });

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${b.title} subsystem detail`}>
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative w-full max-w-lg rounded-xl border border-rz-info/40 bg-white dark:bg-rz-elevated shadow-2xl">
                {/* header — symbol + title + symbol-meta chip */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-rz-2 px-4 py-3">
                    <div className="flex items-center gap-3">
                        {b.kind && (
                            <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" aria-hidden="true">
                                <SymbolGlyph kind={b.kind} x={0} y={0} s={44} color="#67e8f9" />
                            </svg>
                        )}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-rz-info">Subsystem detail</div>
                            <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{b.title}</div>
                            {meta && (
                                <span className="mt-1 inline-block rounded bg-rz-info/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-rz-info">
                                    {meta.label} · {meta.category}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3 text-xs">
                    {/* what it is + governing standard */}
                    {detail && (
                        <div>
                            <p className="leading-relaxed text-slate-700 dark:text-slate-300">{detail.body}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {detail.standard.split(' / ').map((s) => (
                                    <span key={s} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:text-slate-300">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* spec table — same numbers the node was drawn from */}
                    <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Specification (as drawn)</div>
                        <div className="space-y-1">
                            {b.units != null && b.units > 0 && (
                                <div className="flex justify-between gap-3 rounded border border-slate-200 dark:border-rz-2 bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5">
                                    <span className="text-slate-500">Installed units</span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">×{b.units}</span>
                                </div>
                            )}
                            {perUnit && (
                                <div className="flex justify-between gap-3 rounded border border-slate-200 dark:border-rz-2 bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5">
                                    <span className="text-slate-500">Per-unit duty</span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">≈ {perUnit}</span>
                                </div>
                            )}
                            {b.badge && (
                                <div className="flex justify-between gap-3 rounded border border-slate-200 dark:border-rz-2 bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5">
                                    <span className="text-slate-500">Redundancy role</span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{b.badge}</span>
                                </div>
                            )}
                            {standby && (
                                <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 leading-snug text-amber-700 dark:text-amber-400">
                                    Standby unit — off-line in normal operation; starts automatically when a duty unit trips (drawn dashed in the diagram).
                                </div>
                            )}
                        </div>
                        {chips.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {chips.map((c, i) => (
                                    <span key={i} className="rounded bg-rz-info/10 px-2 py-0.5 font-mono text-[10px] text-cyan-700 dark:text-rz-info">{c}</span>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* engineering note (the hover, in full) */}
                    {b.hover && (
                        <div>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Engineering note</div>
                            <p className="leading-relaxed text-slate-700 dark:text-slate-300">{b.hover}</p>
                        </div>
                    )}
                    {/* connections — from the live diagram edges */}
                    {conns.length > 0 && (
                        <div>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Connections ({conns.length})</div>
                            <ul className="space-y-1">
                                {conns.map((c, i) => (
                                    <li key={i} className="flex items-center justify-between gap-2 rounded border border-slate-200 dark:border-rz-2 bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5">
                                        <span className="flex min-w-0 items-center gap-1.5">
                                            {c.out
                                                ? <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" aria-label="to" />
                                                : <ArrowLeft className="h-3 w-3 shrink-0 text-slate-400" aria-label="from" />}
                                            <span className="truncate font-semibold text-slate-800 dark:text-slate-200">{c.other.title}</span>
                                        </span>
                                        <span className="shrink-0 text-right font-mono text-[10px] text-slate-500">
                                            {EDGE_LABEL[c.kind]}{c.label ? ` · ${c.label}` : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
