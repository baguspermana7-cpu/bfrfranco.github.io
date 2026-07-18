'use client';

/* ─── Projects — workflow spine page (Phase N, tab 'projects') ───────────────
 * Project cards (full store-family bundles) + create/open/update/delete +
 * lifecycle progress dots per project (derived live from the ACTIVE state
 * for the open project; stored KPIs for others). Templates = engine preset
 * bundles (cx scenarios) applied through the shared writers.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore } from '@/store/requirements';
import { useProjectsStore } from '@/store/projects';
import { useScenarioStore } from '@/store/scenario';
import { rzData } from '@/lib/rz-engine';
import { writeSharedItLoad, writeSharedCooling, writeSharedCountry } from '@/lib/requirementsMappings';
import { COUNTRIES } from '@/constants/countries';
import { FolderOpen, Plus, Trash2, Save, ChevronRight } from 'lucide-react';

const LIFECYCLE: { id: string; label: string; tab: string }[] = [
    { id: 'req', label: 'Requirements', tab: 'requirements' },
    { id: 'site', label: 'Site', tab: 'site' },
    { id: 'arch', label: 'Architecture', tab: 'architecture' },
    { id: 'cap', label: 'Capacity', tab: 'capacity' },
    { id: 'capex', label: 'CAPEX', tab: 'capex' },
    { id: 'constr', label: 'Construction', tab: 'construction' },
    { id: 'cx', label: 'Commissioning', tab: 'commissioning' },
    { id: 'ops', label: 'Operations', tab: 'ops' },
    { id: 'fin', label: 'Financial', tab: 'finance' },
];

export function ProjectsPage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const simInputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const capexResults = useCapexStore((s) => s.results);
    const req = useRequirementsStore();
    const projects = useProjectsStore();
    const scenarios = useScenarioStore((s) => s.scenarios);
    const [name, setName] = React.useState('');

    /* live lifecycle completion for the ACTIVE configuration (documented booleans) */
    const completion: Record<string, boolean> = {
        req: req.overview.projectName.trim().length > 0 && req.business.budgetUsd != null,
        site: true,                                     // a scenario-bound site always exists
        arch: true,                                     // architecture derives live
        cap: simInputs.capacityPhases.length > 0,
        capex: !!capexResults,
        constr: !!capexResults,
        cx: !!capexResults,
        ops: true,
        fin: !!capexResults,
    };
    const doneCount = LIFECYCLE.filter((l) => completion[l.id]).length;

    /* templates = engine cx scenario presets (engine-real bundles) */
    const templates = React.useMemo(() => {
        const sc = rzData()?.commissioning?.cx?.rich?.scenarios as Record<string, { itLoad: number; coolingType: string; redundancy: string }> | undefined;
        if (!sc) return [];
        const coolMap: Record<string, 'air' | 'inrow' | 'rdhx' | 'liquid'> = { air: 'air', inrow: 'inrow', rdhx: 'rdhx', dlc: 'liquid', immersion: 'liquid' };
        return Object.entries(sc).slice(0, 6).map(([key, v]) => ({
            key,
            label: key.replace(/_/g, ' '),
            itLoadKw: v.itLoad,
            cooling: coolMap[v.coolingType] ?? 'air',
            redundancy: v.redundancy,
        }));
    }, []);

    const applyTemplate = (t: { itLoadKw: number; cooling: 'air' | 'inrow' | 'rdhx' | 'liquid'; redundancy: string; label: string }) => {
        writeSharedItLoad(t.itLoadKw);
        writeSharedCooling(t.cooling);
        const red = t.redundancy === '2N+1' ? '2N+1' : t.redundancy === '2N' ? '2N' : 'N+1';
        useSimulationStore.getState().actions.setInputs({ powerRedundancy: red as 'N+1' | '2N' | '2N+1' });
        setActiveTab('requirements');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg"><FolderOpen className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Projects</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Full-state project bundles — every engine store snapshotted & restorable (the workflow spine)</p>
                    </div>
                </div>
            </div>

            {/* active configuration + lifecycle strip */}
            <div className="rounded-2xl border border-violet-500/30 bg-violet-600/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            Active configuration{projects.activeProjectId ? ` — ${projects.projects.find((p) => p.id === projects.activeProjectId)?.name ?? ''}` : ' (unsaved)'}
                        </div>
                        <div className="text-[11px] text-slate-500">{(simInputs.itLoad / 1000).toFixed(1)} MW · {simInputs.coolingType} · {simInputs.powerRedundancy} · Tier {simInputs.tierLevel} · {country?.name ?? '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name…"
                            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-violet-500 text-slate-900 dark:text-slate-100" />
                        <button onClick={() => { projects.saveCurrentAs(name || undefined as unknown as string); setName(''); }}
                            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"><Plus className="h-3.5 w-3.5" /> Save as Project</button>
                        {projects.activeProjectId && (
                            <button onClick={projects.updateActive}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400"><Save className="h-3.5 w-3.5" /> Update</button>
                        )}
                    </div>
                </div>
                {/* lifecycle strip */}
                <div className="mt-3 flex flex-wrap items-center gap-1">
                    {LIFECYCLE.map((l, i) => (
                        <React.Fragment key={l.id}>
                            <button onClick={() => setActiveTab(l.tab as never)}
                                className={`rounded-full border px-2 py-1 text-[10px] font-medium transition-colors ${completion[l.id]
                                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:border-violet-400'}`}>
                                {i + 1}. {l.label} {completion[l.id] ? '✓' : ''}
                            </button>
                            {i < LIFECYCLE.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-700" />}
                        </React.Fragment>
                    ))}
                    <span className="ml-2 text-[10px] text-slate-500">{doneCount}/9 engines ready</span>
                </div>
            </div>

            {/* saved projects */}
            <div>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Saved Projects ({projects.projects.length}/10)</h2>
                {projects.projects.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 text-center text-xs text-slate-500">
                        No projects saved yet — configure the engines, then “Save as Project”.
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {projects.projects.map((p) => (
                            <div key={p.id} className={`rounded-2xl border p-3 ${p.id === projects.activeProjectId ? 'border-violet-500 bg-violet-600/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'}`}>
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{p.name}</span>
                                    {p.id === projects.activeProjectId && <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">Active</span>}
                                </div>
                                <div className="mt-0.5 text-[10px] text-slate-500">{(p.itLoadKw / 1000).toFixed(1)} MW · {COUNTRIES[p.countryId]?.name ?? p.countryId} · updated {new Date(p.updatedAt).toLocaleDateString()}</div>
                                <div className="mt-2 flex gap-1.5">
                                    <button onClick={() => projects.openProject(p.id)}
                                        className="flex-1 rounded-lg bg-violet-600 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500">Open (restores all stores)</button>
                                    <button onClick={() => projects.deleteProject(p.id)}
                                        className="rounded-lg border border-rose-400/40 px-2 py-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* templates */}
            <div>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Template Library <span className="text-[9px] normal-case text-slate-400">engine preset bundles (cx scenarios) — applied through the shared writers</span></h2>
                <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                    {templates.map((t) => (
                        <button key={t.key} onClick={() => applyTemplate(t)}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-2.5 text-left hover:border-violet-400">
                            <div className="truncate text-[11px] font-semibold capitalize text-slate-900 dark:text-white">{t.label}</div>
                            <div className="text-[9px] text-slate-500">{(t.itLoadKw / 1000).toFixed(1)} MW · {t.cooling} · {t.redundancy}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* scenarios link */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 text-[11px] text-slate-500">
                Lightweight input-only snapshots live in <b>Scenarios</b> ({scenarios.length} saved) — projects here bundle EVERY store (tracking logs included).
            </div>
        </div>
    );
}
