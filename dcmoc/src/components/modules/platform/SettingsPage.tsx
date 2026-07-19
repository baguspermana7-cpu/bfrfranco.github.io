'use client';

/* ─── Settings — 3 menus: General · Data · Integrations (Phase R) ────────────
 * Every control is FUNCTIONAL: theme binds the real ThemeProvider, defaults
 * apply through the shared writers, data resets clear the real stores,
 * integration "Test" performs a real fetch reachability check (no-cors HEAD;
 * result honestly labeled). Secrets never stored — secretRef label only.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSettingsStore, type IntegrationConfig, type IntegrationKind } from '@/store/settings';
import { useTheme } from '@/components/providers/ThemeProvider';
import { writeSharedCountry } from '@/lib/requirementsMappings';
import { useRequirementsStore } from '@/store/requirements';
import { useSitesStore } from '@/store/sites';
import { useConstructionTracking } from '@/store/constructionTracking';
import { useCxTracking } from '@/store/cxTracking';
import { useFinancialTracking } from '@/store/financialTracking';
import { useOpsLog } from '@/store/opsLog';
import { useSustainability } from '@/store/sustainability';
import { useSimulationStore } from '@/store/simulation';
import { COUNTRIES } from '@/constants/countries';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { Settings as SettingsIcon, Plug, Database, Trash2 } from 'lucide-react';

const KINDS: { value: IntegrationKind; label: string; note: string }[] = [
    { value: 'webhook', label: 'Webhook (outbound)', note: 'test = reachability ping' },
    { value: 'rest-api', label: 'REST API (read)', note: 'test = reachability ping' },
    { value: 'bms-readonly', label: 'BMS read-only feed', note: 'requires deployment integration' },
    { value: 'export-schedule', label: 'Scheduled export', note: 'runs while the app is open' },
];

export function SettingsPage() {
    const s = useSettingsStore();
    const { theme, setTheme } = useTheme();
    const [tab, setTab] = React.useState<'general' | 'data' | 'integrations'>('general');
    const [toast, setToast] = React.useState<string | null>(null);
    const show = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

    const reqReset = useRequirementsStore((x) => x.actions.reset);
    const sitesReset = useSitesStore((x) => x.resetToDefaults);
    const ctReset = useConstructionTracking((x) => x.actions.reset);
    const cxReset = useCxTracking((x) => x.actions.reset);
    const finReset = useFinancialTracking((x) => x.actions.reset);
    const opsReset = useOpsLog((x) => x.actions.reset);
    const susReset = useSustainability((x) => x.actions.reset);
    const country = useSimulationStore((x) => x.selectedCountry);

    const testIntegration = async (i: IntegrationConfig) => {
        if (!i.url) { s.actions.setIntegrationResult(i.id, 'unconfigured', 'no URL set'); return; }
        try {
            // no-cors reachability ping — an opaque response still proves reachability
            await fetch(i.url, { method: 'HEAD', mode: 'no-cors' });
            s.actions.setIntegrationResult(i.id, 'reachable', 'endpoint reachable (opaque response — CORS-limited check)');
            show('Endpoint reachable');
        } catch {
            s.actions.setIntegrationResult(i.id, 'error', 'fetch failed — endpoint unreachable from this browser');
            show('Endpoint unreachable');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 shadow-lg"><SettingsIcon className="h-6 w-6 text-white" /></div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">General · Data · Integrations — every control functional (secrets never stored)</p>
                </div>
                <div className="ml-auto flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                    {([['general', 'General'], ['data', 'Data'], ['integrations', 'Integrations']] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                    ))}
                </div>
            </div>

            {tab === 'general' && (
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-3">
                        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Organization & Defaults</h2>
                        <label className="block">
                            <span className="text-[10px] font-semibold uppercase text-slate-500">Organization name</span>
                            <input className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-violet-500 text-slate-900 dark:text-slate-100"
                                value={s.general.orgName} onChange={(e) => s.actions.setGeneral({ orgName: e.target.value })} placeholder="Shown on PDF exports" />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-semibold uppercase text-slate-500">Default country</span>
                            <div className="mt-0.5 flex gap-1.5">
                                <CountrySelect className="flex-1" value={s.general.defaultCountryId} onChange={(v) => s.actions.setGeneral({ defaultCountryId: v })} />
                                <button onClick={() => { writeSharedCountry(s.general.defaultCountryId); show(`Country applied: ${COUNTRIES[s.general.defaultCountryId]?.name}`); }}
                                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Apply now</button>
                            </div>
                            <span className="text-[9px] text-slate-400">Current: {country?.name ?? '—'} · Apply writes both sim + capex stores (shared writer)</span>
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-semibold uppercase text-slate-500">Default currency (display)</span>
                            <select className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-violet-500 text-slate-900 dark:text-slate-100"
                                value={s.general.defaultCurrency} onChange={(e) => s.actions.setGeneral({ defaultCurrency: e.target.value })}>
                                {['USD', 'EUR', 'IDR', 'SGD', 'JPY'].map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <span className="text-[9px] text-slate-400">Seeds the Requirements currency default for new projects</span>
                        </label>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Appearance</h2>
                        <div className="flex gap-1.5">
                            {(['light', 'dark'] as const).map((t) => (
                                <button key={t} onClick={() => setTheme(t)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${theme === t ? 'bg-violet-600 text-white' : 'border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                    {t === 'light' ? '☀ Light' : '☾ Dark'}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1.5 text-[9px] text-slate-400">Binds the real ThemeProvider (same as the sidebar toggle).</p>
                    </div>
                </div>
            )}

            {tab === 'data' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                    <h2 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Database className="h-3.5 w-3.5" /> Store Resets</h2>
                    <p className="mb-2 text-[10px] text-amber-500">⚠ Each reset clears that store's local data immediately (irreversible).</p>
                    <div className="grid gap-1.5 md:grid-cols-3">
                        {([
                            ['Requirements', () => reqReset()],
                            ['Candidate Sites', () => sitesReset(country?.id ?? 'ID')],
                            ['Construction tracking', () => ctReset()],
                            ['Commissioning tracking', () => cxReset()],
                            ['Financial ledger', () => finReset()],
                            ['Ops log', () => opsReset()],
                            ['Sustainability entries', () => susReset()],
                        ] as const).map(([label, fn]) => (
                            <button key={label} onClick={() => { fn(); show(`${label} reset`); }}
                                className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-[11px] text-slate-600 dark:text-slate-300 hover:border-rose-400 hover:text-rose-400">
                                Reset {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'integrations' && (
                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {s.integrations.map((i) => (
                            <div key={i.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="flex items-center gap-2">
                                    <Plug className="h-3.5 w-3.5 text-violet-500" />
                                    <input className="flex-1 bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none"
                                        value={i.name} onChange={(e) => s.actions.upsertIntegration({ ...i, name: e.target.value })} />
                                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${i.status === 'reachable' ? 'bg-emerald-500/15 text-emerald-500' : i.status === 'error' ? 'bg-rose-500/15 text-rose-500' : 'bg-slate-500/15 text-slate-400'}`}>{i.status}</span>
                                </div>
                                <div className="mt-1.5 space-y-1 text-[10px]">
                                    <select className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1.5 py-1 text-slate-600 dark:text-slate-300"
                                        value={i.kind} onChange={(e) => s.actions.upsertIntegration({ ...i, kind: e.target.value as IntegrationKind })}>
                                        {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                                    </select>
                                    <input className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1.5 py-1 text-slate-600 dark:text-slate-300 placeholder:text-slate-400"
                                        placeholder="https://endpoint…" value={i.url} onChange={(e) => s.actions.upsertIntegration({ ...i, url: e.target.value, status: e.target.value ? 'configured' : 'unconfigured' })} />
                                    <input className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1.5 py-1 text-slate-600 dark:text-slate-300 placeholder:text-slate-400"
                                        placeholder="secret ref label (never the secret itself)" value={i.secretRef} onChange={(e) => s.actions.upsertIntegration({ ...i, secretRef: e.target.value })} />
                                    {i.lastTestAt && <p className="text-[9px] text-slate-400">Last test {new Date(i.lastTestAt).toLocaleTimeString()}: {i.lastTestNote}</p>}
                                </div>
                                <div className="mt-2 flex gap-1.5">
                                    <button onClick={() => testIntegration(i)} className="flex-1 rounded-lg bg-violet-600 py-1 text-[10px] font-semibold text-white hover:bg-violet-500">Test reachability</button>
                                    <button onClick={() => s.actions.removeIntegration(i.id)} className="rounded-lg border border-rose-400/40 px-2 py-1 text-rose-400"><Trash2 className="h-3 w-3" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => s.actions.upsertIntegration({ id: `int_${Date.now()}`, kind: 'webhook', name: 'New integration', enabled: true, url: '', secretRef: '', status: 'unconfigured', lastTestAt: null, lastTestNote: '' })}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400">＋ Add Integration</button>
                    <p className="text-[10px] text-slate-400">Honest scope: reachability tests run from this browser (CORS-limited); backend-bound kinds (BMS feed) show their real status until a deployment integration exists. Secrets are configured at deploy time — only reference labels are stored here.</p>
                </div>
            )}

            {toast && <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 dark:bg-slate-700 px-3 py-2 text-xs text-white shadow-xl">{toast}</div>}
        </div>
    );
}
