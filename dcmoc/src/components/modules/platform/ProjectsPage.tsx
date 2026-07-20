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
import { useProjectsStore, restoreSnapshot, type ProjectBundle } from '@/store/projects';
import { useScenarioStore } from '@/store/scenario';
import { useAuthStore } from '@/store/auth';
import { listCloud, loadCloud, removeCloud, share, unshare, uploadProject, CLOUD_TABLE_MISSING, type CloudProjectMeta } from '@/lib/cloudProjects';
import { rzData } from '@/lib/rz-engine';
import { writeSharedItLoad, writeSharedCooling, writeSharedCountry } from '@/lib/requirementsMappings';
import { COUNTRIES } from '@/constants/countries';
import { FolderOpen, Plus, Trash2, Save, ChevronRight, Cloud, Download, Share2, Copy, RefreshCw, Link2 } from 'lucide-react';
import { PlatformHeader, KpiChips } from './ScenariosPage';

/* ── Arc-4: local→cloud mapping (kecil, hanya id + waktu upload terakhir) ── */
const CLOUD_MAP_KEY = 'dcmoc_cloud_map';
type CloudMap = Record<string, { cloudId: string; at: number }>;
function readCloudMap(): CloudMap {
    if (typeof window === 'undefined') return {};
    try {
        const p = JSON.parse(localStorage.getItem(CLOUD_MAP_KEY) || '{}');
        return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch { return {}; }
}
function writeCloudMap(m: CloudMap): void {
    try { localStorage.setItem(CLOUD_MAP_KEY, JSON.stringify(m)); } catch { /* quota — badge saja yang hilang */ }
}

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
    const user = useAuthStore((s) => s.user);
    const readOnly = useProjectsStore((s) => s.readOnly);
    const [name, setName] = React.useState('');

    /* ── Arc-4 cloud state (opsional; localStorage tetap primer) ── */
    const [cloudItems, setCloudItems] = React.useState<CloudProjectMeta[] | null>(null);
    const [cloudErr, setCloudErr] = React.useState<string | null>(null);
    const [cloudMsg, setCloudMsg] = React.useState<string | null>(null);
    const [cloudBusy, setCloudBusy] = React.useState<string | null>(null);
    const [cloudMap, setCloudMap] = React.useState<CloudMap>({});
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const refreshCloud = React.useCallback(async () => {
        setCloudBusy('list');
        setCloudErr(null);
        const res = await listCloud();
        setCloudBusy(null);
        if (res.ok) setCloudItems(res.data);
        else { setCloudItems(null); setCloudErr(res.error); }
    }, []);

    React.useEffect(() => {
        if (!user) return;
        setCloudMap(readCloudMap());
        void refreshCloud();
    }, [user, refreshCloud]);

    const handleUploadToCloud = async (p: ProjectBundle) => {
        setCloudBusy(`up:${p.id}`);
        setCloudErr(null); setCloudMsg(null);
        const existing = cloudMap[p.id]?.cloudId ?? null;
        let res = await uploadProject(p, existing);
        // row cloud lama sudah dihapus? — fallback jujur: buat row baru
        if (!res.ok && existing && res.error !== CLOUD_TABLE_MISSING) res = await uploadProject(p, null);
        setCloudBusy(null);
        if (!res.ok) { setCloudErr(res.error); return; }
        const next: CloudMap = { ...cloudMap, [p.id]: { cloudId: res.data.id, at: Date.now() } };
        setCloudMap(next); writeCloudMap(next);
        setCloudMsg(`"${p.name}" tersimpan ke cloud (cadangan — bukan sinkron otomatis).`);
        void refreshCloud();
    };

    const handleLoadCloud = async (item: CloudProjectMeta) => {
        if (useProjectsStore.getState().readOnly) { setCloudErr('Mode lihat-saja aktif — keluar dari share view dulu.'); return; }
        setCloudBusy(`load:${item.id}`);
        setCloudErr(null); setCloudMsg(null);
        const res = await loadCloud(item.id);
        setCloudBusy(null);
        if (!res.ok) { setCloudErr(res.error); return; }
        // jalur restore KANONIK dari store/projects.ts — bukan jalur baru
        restoreSnapshot(res.data.snapshot);
        setCloudMsg(`"${res.data.name}" dimuat dari cloud ke state aktif — "Save as Project" bila ingin menyimpannya sebagai project lokal.`);
    };

    const handleRemoveCloud = async (item: CloudProjectMeta) => {
        if (typeof window !== 'undefined' && !window.confirm(`Hapus "${item.name}" dari cloud? Data lokal tidak tersentuh.`)) return;
        setCloudBusy(`del:${item.id}`);
        setCloudErr(null); setCloudMsg(null);
        const res = await removeCloud(item.id);
        setCloudBusy(null);
        if (!res.ok) { setCloudErr(res.error); return; }
        const next: CloudMap = Object.fromEntries(Object.entries(cloudMap).filter(([, v]) => v.cloudId !== item.id));
        setCloudMap(next); writeCloudMap(next);
        void refreshCloud();
    };

    const handleShare = async (item: CloudProjectMeta) => {
        setCloudBusy(`share:${item.id}`);
        setCloudErr(null); setCloudMsg(null);
        const res = await share(item.id);
        setCloudBusy(null);
        if (!res.ok) { setCloudErr(res.error); return; }
        void refreshCloud();
    };

    const handleUnshare = async (item: CloudProjectMeta) => {
        setCloudBusy(`unshare:${item.id}`);
        setCloudErr(null); setCloudMsg(null);
        const res = await unshare(item.id);
        setCloudBusy(null);
        if (!res.ok) { setCloudErr(res.error); return; }
        setCloudMsg('Share dicabut — link lama langsung mati.');
        void refreshCloud();
    };

    const handleCopyShareUrl = async (item: CloudProjectMeta) => {
        if (!item.share_token) return;
        const url = `${origin}/dcmoc/?share=${item.share_token}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(item.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            setCloudErr('Gagal menyalin ke clipboard — salin URL secara manual dari kotak di kartu.');
        }
    };

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
            <PlatformHeader icon={FolderOpen} title="Saved Projects" sub="Full-state project bundles — every engine store snapshotted & restorable (the workflow spine)" tone="from-cyan-500 to-blue-600" />

            <KpiChips items={[
                { label: 'Total Projects', value: `${projects.projects.length}/10`, sub: 'local bundles' },
                { label: 'Active', value: projects.activeProjectId ? (projects.projects.find((p) => p.id === projects.activeProjectId)?.name.slice(0, 14) ?? '—') : 'unsaved', sub: 'current configuration' },
                { label: 'Engines Ready', value: `${doneCount}/9`, sub: 'lifecycle completion' },
                { label: 'Scenarios', value: String(scenarios.length), sub: 'input-only snapshots' },
                { label: 'Countries', value: String(new Set(projects.projects.map((p) => p.countryId)).size || (country ? 1 : 0)), sub: 'covered' },
            ]} />

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
                        {projects.projects.map((p) => {
                            /* DA3 honest snapshot — kartu ACTIVE membaca live sim saat
                             * render; kartu tersimpan = snapshot berlabel tanggal; amber
                             * kalau snapshot beda dari project aktif (countryId/itLoad). */
                            const isActive = p.id === projects.activeProjectId;
                            const differs = p.countryId !== (country?.id ?? '') || p.itLoadKw !== simInputs.itLoad;
                            return (
                            <div key={p.id} className={`rounded-2xl border p-3 ${isActive ? 'border-violet-500 bg-violet-600/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'}`}>
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{p.name}</span>
                                    {isActive && <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">Active</span>}
                                </div>
                                <div className="mt-0.5 text-[10px] text-slate-500">
                                    {isActive
                                        ? `${(simInputs.itLoad / 1000).toFixed(1)} MW · ${country?.name ?? '—'}`
                                        : `${(p.itLoadKw / 1000).toFixed(1)} MW · ${COUNTRIES[p.countryId]?.name ?? p.countryId}`}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                    {isActive ? (
                                        <span title="Nilai kartu ini dibaca dari simulasi live saat render (bukan snapshot)" className="rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-emerald-500">live sim</span>
                                    ) : (
                                        <span title="Nilai kartu ini dari snapshot tersimpan — bukan state live" className="rounded bg-slate-500/15 px-1 py-0.5 text-[8px] font-semibold text-slate-500 dark:text-slate-400">saved snapshot · {new Date(p.updatedAt).toLocaleDateString()}</span>
                                    )}
                                    {isActive && differs && (
                                        <span title={`Snapshot tersimpan (${COUNTRIES[p.countryId]?.name ?? p.countryId} · ${(p.itLoadKw / 1000).toFixed(1)} MW) beda dari state live — klik Update untuk sinkron`}
                                            className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">snapshot ≠ live — Update</span>
                                    )}
                                    {!isActive && differs && (
                                        <span title={`Snapshot ${COUNTRIES[p.countryId]?.name ?? p.countryId} · ${(p.itLoadKw / 1000).toFixed(1)} MW ≠ project aktif (${country?.name ?? '—'} · ${(simInputs.itLoad / 1000).toFixed(1)} MW)`}
                                            className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">differs from current project</span>
                                    )}
                                    {user && cloudMap[p.id] && (
                                        <span title={`Terakhir diunggah ke cloud ${new Date(cloudMap[p.id].at).toLocaleString()} — cadangan manual, BUKAN sinkron otomatis`}
                                            className="rounded bg-cyan-500/15 px-1 py-0.5 text-[8px] font-semibold text-cyan-500">☁ tersinkron {new Date(cloudMap[p.id].at).toLocaleString()}</span>
                                    )}
                                </div>
                                <div className="mt-2 flex gap-1.5">
                                    <button onClick={() => projects.openProject(p.id)}
                                        className="flex-1 rounded-lg bg-violet-600 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500">Open (restores all stores)</button>
                                    {user && (
                                        <button onClick={() => void handleUploadToCloud(p)}
                                            disabled={cloudBusy === `up:${p.id}`}
                                            title="Simpan salinan project ini ke cloud (cadangan opsional — localStorage tetap primer)"
                                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2 py-1.5 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50">
                                            <Cloud className="h-3.5 w-3.5" /> {cloudBusy === `up:${p.id}` ? 'Mengunggah…' : 'Simpan ke cloud'}
                                        </button>
                                    )}
                                    <button onClick={() => projects.deleteProject(p.id)}
                                        className="rounded-lg border border-rose-400/40 px-2 py-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Cloud (opsional) — Arc-4; hanya render saat login ── */}
            {user && (
                <div>
                    <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Cloud className="h-3.5 w-3.5" /> Cloud (opsional)
                        <button onClick={() => void refreshCloud()} disabled={cloudBusy === 'list'}
                            title="Muat ulang daftar cloud"
                            className="ml-1 rounded border border-slate-300 dark:border-slate-700 p-0.5 text-slate-500 hover:border-cyan-400 disabled:opacity-50">
                            <RefreshCw className={`h-3 w-3 ${cloudBusy === 'list' ? 'animate-spin' : ''}`} />
                        </button>
                    </h2>
                    <p className="mb-2 text-[10px] text-slate-500">
                        localStorage tetap penyimpanan utama; cloud = cadangan opsional; tidak ada sinkron otomatis.
                    </p>

                    {cloudErr && (
                        <div className="mb-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-400">
                            {cloudErr}
                            {cloudErr === CLOUD_TABLE_MISSING && (
                                <> — <a href="/setup-supabase.html" target="_blank" rel="noopener noreferrer" className="underline font-semibold">buka setup-supabase ↗</a></>
                            )}
                        </div>
                    )}
                    {cloudMsg && (
                        <div className="mb-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-600 dark:text-emerald-400">{cloudMsg}</div>
                    )}

                    {cloudItems && cloudItems.length === 0 && !cloudErr && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 text-center text-[11px] text-slate-500">
                            Belum ada project di cloud — pakai tombol “☁ Simpan ke cloud” pada kartu project lokal di atas.
                        </div>
                    )}
                    {cloudItems && cloudItems.length > 0 && (
                        <div className="grid gap-3 md:grid-cols-2">
                            {cloudItems.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                    <div className="flex items-center gap-2">
                                        <Cloud className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
                                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.name}</span>
                                        {item.share_token && (
                                            <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-500">shared</span>
                                        )}
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-slate-500">
                                        diperbarui {new Date(item.updated_at).toLocaleString()} · v{item.version}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        <button onClick={() => void handleLoadCloud(item)}
                                            disabled={cloudBusy === `load:${item.id}` || readOnly}
                                            title="Ambil bundle dari cloud, validasi, lalu restore ke semua store (jalur restore kanonik)"
                                            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
                                            <Download className="h-3.5 w-3.5" /> {cloudBusy === `load:${item.id}` ? 'Memuat…' : 'Muat'}
                                        </button>
                                        {!item.share_token ? (
                                            <button onClick={() => void handleShare(item)}
                                                disabled={cloudBusy === `share:${item.id}`}
                                                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2.5 py-1.5 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50">
                                                <Share2 className="h-3.5 w-3.5" /> {cloudBusy === `share:${item.id}` ? 'Membuat…' : 'Share'}
                                            </button>
                                        ) : (
                                            <button onClick={() => void handleUnshare(item)}
                                                disabled={cloudBusy === `unshare:${item.id}`}
                                                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-2.5 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">
                                                <Link2 className="h-3.5 w-3.5" /> {cloudBusy === `unshare:${item.id}` ? 'Mencabut…' : 'Cabut share'}
                                            </button>
                                        )}
                                        <button onClick={() => void handleRemoveCloud(item)}
                                            disabled={cloudBusy === `del:${item.id}`}
                                            title="Hapus dari cloud (data lokal tidak tersentuh)"
                                            className="rounded-lg border border-rose-400/40 px-2 py-1.5 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    {item.share_token && (
                                        <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
                                            <div className="flex items-center gap-1.5">
                                                <code className="min-w-0 flex-1 truncate text-[10px] text-slate-600 dark:text-slate-300">{origin}/dcmoc/?share={item.share_token}</code>
                                                <button onClick={() => void handleCopyShareUrl(item)}
                                                    className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-[10px] text-slate-600 dark:text-slate-300 hover:border-cyan-400">
                                                    <Copy className="h-3 w-3" /> {copiedId === item.id ? 'Tersalin ✓' : 'Salin'}
                                                </button>
                                            </div>
                                            <div className="mt-1 text-[9px] text-slate-500">
                                                siapa pun dengan link bisa MELIHAT salinan (bukan live, bukan edit)
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

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
