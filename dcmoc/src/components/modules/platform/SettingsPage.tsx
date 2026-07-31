'use client';

/* ─── Settings — reference layout (Phase R + AD) ─────────────────────────────
 * setting.png parity: sub-tab strip · KPI chip row · "Quick Settings" rows
 * (icon + title + subtitle + right control) · "System Preferences" card grid
 * (every card links to a REAL surface) · right rail (Platform Information w/
 * real version/engine/storage, Recent Activity = real store change log,
 * Need Help). Every control FUNCTIONAL; secrets never stored.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { CURRENCY_LIST } from '@/lib/screening';
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
import { useProjectsStore } from '@/store/projects';
import { useScenarioStore } from '@/store/scenario';
import { rzData } from '@/lib/rz-engine';
import { COUNTRIES } from '@/constants/countries';
import { CountrySelect } from '@/components/ui/CountrySelect';
import {
    Settings as SettingsIcon, Plug, Database, Trash2, Building2, Globe2, Coins,
    SunMoon, Shield, Users, ScrollText, DownloadCloud, HelpCircle, BookOpen, Search,
} from 'lucide-react';
import { Tooltip as InfoTip } from '@/components/ui/Tooltip';

/* ─── Explanation tooltip texts ─── */
const SET_TIP = {
    // overview KPI chips
    kpiProjects: 'Saved full-state project bundles in this browser (local storage).',
    kpiScenarios: 'Saved input-only scenario snapshots.',
    kpiIntegrations: 'Configured outbound connections (webhooks, REST, BMS feeds, scheduled exports) and how many are currently reachable.',
    kpiEngineData: 'Version of the loaded RZ engine DATA reference — the single source for all model constants.',
    kpiStorage: 'Browser local-storage used by DCMOC out of the total quota this browser grants the site.',
    // sections + quick settings
    quickSettings: 'Frequently changed platform settings. Every control is live and writes immediately.',
    orgName: 'Organization name printed on the header of every PDF export. Display only.',
    defaultCountry: 'The default project country. Apply writes it to both the simulation and CAPEX stores (electricity price, grid carbon, tax, labor).',
    defaultCurrency: 'Currency used to seed the Requirements currency for new projects. Display formatting only.',
    theme: 'Light or dark appearance — binds the same ThemeProvider as the sidebar toggle.',
    systemPreferences: 'Shortcuts into data management, integrations, users, audit, backup and security surfaces.',
    // right rail
    platformInfo: 'Runtime build and environment details for this DCMOC instance.',
    recentActivity: 'Chronological log of the settings changes you have made this session.',
    needHelp: 'Links to the FAQ and knowledge base covering every engine and workflow.',
    // general tab
    orgDefaults: 'Organization identity and default project parameters seeded into new projects.',
    appearance: 'Light / dark theme selection — same as the sidebar toggle.',
    genOrgName: 'Organization name shown on PDF export headers. Display only.',
    genCountry: 'Default country. Apply writes both the simulation and CAPEX stores through the shared writer.',
    genCurrency: 'Seeds the Requirements currency default for new projects. Display formatting only.',
    // data tab
    backup: 'Download every dcmoc* local-storage key (projects, scenarios, tracking stores, settings) as one JSON file.',
    storeResets: 'Clear an individual store’s local data. Each reset is immediate and irreversible.',
    // integrations tab
    intTotal: 'Total number of integrations configured.',
    intReachable: 'Integrations whose endpoint responded to the last reachability test.',
    intConfigured: 'Integrations that have an endpoint URL set but are not yet confirmed reachable.',
    intErrors: 'Integrations whose last test failed — endpoint unreachable from this browser.',
    colIntegration: 'Integration name and type icon.',
    colKind: 'Integration kind — webhook, REST read, BMS read-only feed or scheduled export.',
    colStatus: 'Current state: reachable, configured, error or unconfigured.',
    colLastTest: 'Time of the most recent reachability test.',
    colActions: 'Run a reachability test, or delete the integration.',
    intDetails: 'Configure the selected integration. Secrets are never stored here — only a reference label.',
    fName: 'Display name for this integration.',
    fKind: 'Connection type — determines how the test (and, at deploy time, the transport) behaves.',
    fEndpoint: 'The URL this integration targets. Setting it marks the integration as configured.',
    fSecret: 'A reference label for the secret (e.g. a vault key name) — never the secret value itself.',
} as const;

const KINDS: { value: IntegrationKind; label: string; note: string }[] = [
    { value: 'webhook', label: 'Webhook (outbound)', note: 'test = reachability ping' },
    { value: 'rest-api', label: 'REST API (read)', note: 'test = reachability ping' },
    { value: 'bms-readonly', label: 'BMS read-only feed', note: 'requires deployment integration' },
    { value: 'export-schedule', label: 'Scheduled export', note: 'runs while the app is open' },
];

function QuickRow({ icon: Icon, title, sub, tip, children }: { icon: React.ElementType; title: string; sub: string; tip?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rz-mint/10"><Icon className="h-4 w-4 text-rz-mint" /></div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-0.5 text-xs font-semibold text-slate-900 dark:text-white">{title}{tip && <InfoTip content={tip} />}</div>
                <div className="truncate text-[10px] text-slate-500">{sub}</div>
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

export function SettingsPage({ initialTab }: { initialTab?: 'overview' | 'general' | 'data' | 'integrations' } = {}) {
    const s = useSettingsStore();
    const { theme, setTheme } = useTheme();
    const setActiveTab = useSimulationStore((x) => x.actions.setActiveTab);
    const [tab, setTab] = React.useState<'overview' | 'general' | 'data' | 'integrations'>(initialTab ?? 'overview');
    const [toast, setToast] = React.useState<string | null>(null);
    const [intFilter, setIntFilter] = React.useState('');
    const [selInt, setSelInt] = React.useState<string | null>(null);
    const [storage, setStorage] = React.useState<{ used: number; quota: number } | null>(null);
    const show = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

    const reqReset = useRequirementsStore((x) => x.actions.reset);
    const sitesReset = useSitesStore((x) => x.resetToDefaults);
    const ctReset = useConstructionTracking((x) => x.actions.reset);
    const cxReset = useCxTracking((x) => x.actions.reset);
    const finReset = useFinancialTracking((x) => x.actions.reset);
    const opsReset = useOpsLog((x) => x.actions.reset);
    const susReset = useSustainability((x) => x.actions.reset);
    const country = useSimulationStore((x) => x.selectedCountry);
    const projects = useProjectsStore((x) => x.projects);
    const scenarios = useScenarioStore((x) => x.scenarios);

    React.useEffect(() => {
        try {
            navigator.storage?.estimate?.().then((e) => setStorage({ used: e.usage ?? 0, quota: e.quota ?? 0 }));
        } catch { /* unsupported */ }
    }, []);

    const testIntegration = async (i: IntegrationConfig) => {
        if (!i.url) { s.actions.setIntegrationResult(i.id, 'unconfigured', 'no URL set'); return; }
        try {
            await fetch(i.url, { method: 'HEAD', mode: 'no-cors' });
            s.actions.setIntegrationResult(i.id, 'reachable', 'endpoint reachable (opaque response — CORS-limited check)');
            show('Endpoint reachable');
        } catch {
            s.actions.setIntegrationResult(i.id, 'error', 'fetch failed — endpoint unreachable from this browser');
            show('Endpoint unreachable');
        }
    };

    const exportBackup = () => {
        try {
            const dump: Record<string, unknown> = {};
            for (let k = 0; k < localStorage.length; k++) {
                const key = localStorage.key(k);
                if (key?.startsWith('dcmoc')) dump[key] = localStorage.getItem(key);
            }
            const blob = new Blob([JSON.stringify(dump, null, 1)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `dcmoc-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click(); URL.revokeObjectURL(a.href);
            s.actions.logActivity('Backup exported');
            show('Backup exported');
        } catch { show('Backup failed'); }
    };

    const reachable = s.integrations.filter((i) => i.status === 'reachable').length;
    const engineOk = !!rzData()?.version;
    const kpis = [
        { label: 'Projects', value: String(projects.length), sub: 'local bundles', tip: SET_TIP.kpiProjects },
        { label: 'Scenarios', value: String(scenarios.length), sub: 'saved', tip: SET_TIP.kpiScenarios },
        { label: 'Integrations', value: `${s.integrations.length}`, sub: `${reachable} reachable`, tip: SET_TIP.kpiIntegrations },
        { label: 'Engine Data', value: engineOk ? `v${rzData()?.version}` : '—', sub: engineOk ? 'loaded' : 'loading', tip: SET_TIP.kpiEngineData },
        { label: 'Local Storage', value: storage ? `${(storage.used / 1e6).toFixed(1)} MB` : '—', sub: storage ? `of ${(storage.quota / 1e9).toFixed(1)} GB quota` : 'estimating', tip: SET_TIP.kpiStorage },
    ];

    const sysCards: { icon: React.ElementType; title: string; sub: string; onClick: () => void; chip?: string }[] = [
        { icon: Database, title: 'Data Management', sub: 'Per-store resets + backup', onClick: () => setTab('data') },
        { icon: Plug, title: 'Integrations', sub: `${s.integrations.length} configured`, onClick: () => setTab('integrations') },
        { icon: Users, title: 'User Management', sub: 'Roles & access', onClick: () => setActiveTab('users' as never) },
        { icon: ScrollText, title: 'Audit Trail', sub: 'Change history', onClick: () => setActiveTab('audit' as never) },
        { icon: DownloadCloud, title: 'Backup & Export', sub: 'Download all local data (JSON)', onClick: exportBackup },
        { icon: Shield, title: 'Security', sub: 'Auth via site session — secrets never stored', onClick: () => show('Auth is handled by the site login; DCMOC stores no credentials'), chip: 'info' },
    ];

    const filteredInts = s.integrations.filter((i) => !intFilter || i.name.toLowerCase().includes(intFilter.toLowerCase()) || i.kind.includes(intFilter.toLowerCase()));
    const sel = s.integrations.find((i) => i.id === selInt) ?? null;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded bg-rz-elevated border border-rz-2"><SettingsIcon className="h-6 w-6 text-rz-info" /></div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage platform configuration, preferences and system settings</p>
                </div>
                <div className="ml-auto flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                    {([['overview', 'Overview'], ['general', 'General'], ['data', 'Data Management'], ['integrations', 'Integrations']] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-rz-mint text-rz-base' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                    ))}
                </div>
            </div>

            {tab === 'overview' && (
                <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                    <div className="min-w-0 space-y-4">
                        {/* KPI chip row */}
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                            {kpis.map((k) => (
                                <div key={k.label} title={`${k.label}: ${k.value} — ${k.sub}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                    <div className="flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-slate-500">{k.label}<InfoTip content={k.tip} /></div>
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                    <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                                </div>
                            ))}
                        </div>

                        {/* Quick Settings */}
                        <div>
                            <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quick Settings <InfoTip content={SET_TIP.quickSettings} /></h2>
                            <div className="space-y-2">
                                <QuickRow icon={Building2} title="Organization" sub="Shown on every PDF export header" tip={SET_TIP.orgName}>
                                    <input className="w-44 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-rz-mint text-slate-900 dark:text-slate-100"
                                        value={s.general.orgName} onChange={(e) => s.actions.setGeneral({ orgName: e.target.value })} placeholder="Organization name" />
                                </QuickRow>
                                <QuickRow icon={Globe2} title="Default Country" sub={`Current project country: ${country?.name ?? '—'} · Apply writes sim + capex`} tip={SET_TIP.defaultCountry}>
                                    <div className="flex w-56 gap-1.5">
                                        <CountrySelect className="flex-1" value={s.general.defaultCountryId} onChange={(v) => s.actions.setGeneral({ defaultCountryId: v })} />
                                        <button onClick={() => { writeSharedCountry(s.general.defaultCountryId); show(`Applied: ${COUNTRIES[s.general.defaultCountryId]?.name}`); }}
                                            className="rounded-lg bg-rz-mint px-2 py-1 text-[10px] font-semibold text-rz-base hover:bg-rz-mint/80">Apply</button>
                                    </div>
                                </QuickRow>
                                <QuickRow icon={Coins} title="Default Currency" sub="Seeds the Requirements currency for new projects" tip={SET_TIP.defaultCurrency}>
                                    <select className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-rz-mint text-slate-900 dark:text-slate-100"
                                        value={s.general.defaultCurrency} onChange={(e) => s.actions.setGeneral({ defaultCurrency: e.target.value })}>
                                        {CURRENCY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </QuickRow>
                                <QuickRow icon={SunMoon} title="Theme & Appearance" sub="Binds the real ThemeProvider (same as the sidebar toggle)" tip={SET_TIP.theme}>
                                    <div className="flex gap-1">
                                        {(['light', 'dark'] as const).map((t) => (
                                            <button key={t} onClick={() => { setTheme(t); s.actions.logActivity(`Theme → ${t}`); }}
                                                className={`rounded-lg px-2.5 py-1 text-[10px] font-medium ${theme === t ? 'bg-rz-mint text-rz-base' : 'border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                                {t === 'light' ? '☀ Light' : '☾ Dark'}
                                            </button>
                                        ))}
                                    </div>
                                </QuickRow>
                            </div>
                        </div>

                        {/* System Preferences grid */}
                        <div>
                            <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">System Preferences <InfoTip content={SET_TIP.systemPreferences} /></h2>
                            <div className="grid gap-2 md:grid-cols-3">
                                {sysCards.map((c) => (
                                    <button key={c.title} onClick={c.onClick} title={`${c.title} — ${c.sub}`}
                                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 text-left hover:border-rz-mint/60">
                                        <c.icon className="mb-1.5 h-4 w-4 text-rz-mint" />
                                        <div className="text-xs font-semibold text-slate-900 dark:text-white">{c.title}</div>
                                        <div className="text-[10px] text-slate-500">{c.sub}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* right rail */}
                    <div className="space-y-3">
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                            <h3 className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Platform Information <InfoTip content={SET_TIP.platformInfo} /></h3>
                            <div className="space-y-1 text-[11px]">
                                {[
                                    ['Platform', 'DC-OS · DCMOC'],
                                    ['Site version', (typeof window !== 'undefined' && (window as unknown as { RZ_VERSION?: string }).RZ_VERSION) || '—'],
                                    ['Engine DATA', engineOk ? `v${rzData()?.version}` : 'loading…'],
                                    ['Environment', 'static export · local-first'],
                                ].map(([l, v]) => (
                                    <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span className="font-medium text-slate-800 dark:text-slate-200">{v}</span></div>
                                ))}
                                {storage && storage.quota > 0 && (
                                    <div title={`${(storage.used / 1e6).toFixed(1)} MB used of ${(storage.quota / 1e9).toFixed(1)} GB`}>
                                        <div className="mb-0.5 flex justify-between text-[10px]"><span className="text-slate-500">Storage</span><span className="text-slate-400">{((storage.used / storage.quota) * 100).toFixed(1)}%</span></div>
                                        <div className="h-1.5 rounded bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded bg-rz-mint" style={{ width: `${Math.min(100, (storage.used / storage.quota) * 100)}%` }} /></div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                            <h3 className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recent Activity <InfoTip content={SET_TIP.recentActivity} /> <span className="text-[8px] normal-case text-cyan-500">real change log</span></h3>
                            {(s.activity ?? []).length === 0 && <p className="text-[10px] text-slate-400">No settings changes yet.</p>}
                            <div className="space-y-1">
                                {(s.activity ?? []).slice(0, 8).map((a, i) => (
                                    <div key={i} className="flex items-baseline gap-2 text-[10px]">
                                        <span className="shrink-0 tabular-nums text-slate-400">{new Date(a.ts).toLocaleTimeString()}</span>
                                        <span className="text-slate-600 dark:text-slate-300">{a.msg}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded border border-rz-mint/30 bg-rz-mint/5 p-3">
                            <h3 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-rz-mint"><HelpCircle className="h-3.5 w-3.5" /> Need help? <InfoTip content={SET_TIP.needHelp} /></h3>
                            <p className="mb-2 text-[10px] text-slate-500">FAQ and the knowledge base cover every engine and workflow.</p>
                            <div className="flex gap-1.5">
                                <button onClick={() => setActiveTab('faq' as never)} className="flex-1 rounded-lg bg-rz-mint py-1.5 text-[10px] font-semibold text-rz-base hover:bg-rz-mint/80">Open FAQ</button>
                                <button onClick={() => setActiveTab('knowledge' as never)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 text-[10px] text-slate-600 dark:text-slate-300 hover:border-rz-mint"><BookOpen className="mr-1 inline h-3 w-3" />Knowledge</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'general' && (
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-3">
                        <h2 className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Organization & Defaults <InfoTip content={SET_TIP.orgDefaults} /></h2>
                        <label className="block">
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase text-slate-500">Organization name <InfoTip content={SET_TIP.genOrgName} /></span>
                            <input className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-rz-mint text-slate-900 dark:text-slate-100"
                                value={s.general.orgName} onChange={(e) => s.actions.setGeneral({ orgName: e.target.value })} placeholder="Shown on PDF exports" />
                        </label>
                        <label className="block">
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase text-slate-500">Default country <InfoTip content={SET_TIP.genCountry} /></span>
                            <div className="mt-0.5 flex gap-1.5">
                                <CountrySelect className="flex-1" value={s.general.defaultCountryId} onChange={(v) => s.actions.setGeneral({ defaultCountryId: v })} />
                                <button onClick={() => { writeSharedCountry(s.general.defaultCountryId); show(`Country applied: ${COUNTRIES[s.general.defaultCountryId]?.name}`); }}
                                    className="rounded-lg bg-rz-mint px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-mint/80">Apply now</button>
                            </div>
                            <span className="text-[9px] text-slate-400">Current: {country?.name ?? '—'} · Apply writes both sim + capex stores (shared writer)</span>
                        </label>
                        <label className="block">
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase text-slate-500">Default currency (display) <InfoTip content={SET_TIP.genCurrency} /></span>
                            <select className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-rz-mint text-slate-900 dark:text-slate-100"
                                value={s.general.defaultCurrency} onChange={(e) => s.actions.setGeneral({ defaultCurrency: e.target.value })}>
                                {CURRENCY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <span className="text-[9px] text-slate-400">Seeds the Requirements currency default for new projects</span>
                        </label>
                    </div>
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Appearance <InfoTip content={SET_TIP.appearance} /></h2>
                        <div className="flex gap-1.5">
                            {(['light', 'dark'] as const).map((t) => (
                                <button key={t} onClick={() => setTheme(t)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${theme === t ? 'bg-rz-mint text-rz-base' : 'border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                    {t === 'light' ? '☀ Light' : '☾ Dark'}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1.5 text-[9px] text-slate-400">Binds the real ThemeProvider (same as the sidebar toggle).</p>
                    </div>
                </div>
            )}

            {tab === 'data' && (
                <div className="space-y-3">
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><DownloadCloud className="h-3.5 w-3.5" /> Backup <InfoTip content={SET_TIP.backup} /></h2>
                        <button onClick={exportBackup} className="rounded-lg bg-rz-mint px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-mint/80">Download all local data (JSON)</button>
                        <p className="mt-1 text-[9px] text-slate-400">Exports every dcmoc* localStorage key — projects, scenarios, tracking stores, settings.</p>
                    </div>
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Database className="h-3.5 w-3.5" /> Store Resets <InfoTip content={SET_TIP.storeResets} /></h2>
                        <p className="mb-2 text-[10px] text-amber-500">⚠ Each reset clears that store&apos;s local data immediately (irreversible).</p>
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
                                <button key={label} onClick={() => { fn(); s.actions.logActivity(`${label} reset`); show(`${label} reset`); }}
                                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-[11px] text-slate-600 dark:text-slate-300 hover:border-rose-400 hover:text-rose-400">
                                    Reset {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'integrations' && (
                <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                    <div className="min-w-0 space-y-3">
                        {/* KPI row */}
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { label: 'Total', value: s.integrations.length, tip: SET_TIP.intTotal },
                                { label: 'Reachable', value: reachable, tip: SET_TIP.intReachable },
                                { label: 'Configured', value: s.integrations.filter((i) => i.status === 'configured').length, tip: SET_TIP.intConfigured },
                                { label: 'Errors', value: s.integrations.filter((i) => i.status === 'error').length, tip: SET_TIP.intErrors },
                            ].map((k) => (
                                <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 text-center">
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                    <div className="flex items-center justify-center gap-0.5 text-[9px] uppercase text-slate-500">{k.label}<InfoTip content={k.tip} /></div>
                                </div>
                            ))}
                        </div>
                        {/* filter bar */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                                <input className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-rz-mint text-slate-900 dark:text-slate-100"
                                    placeholder="Search integrations…" value={intFilter} onChange={(e) => setIntFilter(e.target.value)} />
                            </div>
                            <button onClick={() => { const id = `int_${Date.now()}`; s.actions.upsertIntegration({ id, kind: 'webhook', name: 'New integration', enabled: true, url: '', secretRef: '', status: 'unconfigured', lastTestAt: null, lastTestNote: '' }); setSelInt(id); }}
                                className="rounded-lg bg-rz-mint px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-mint/80">＋ Add Custom Integration</button>
                        </div>
                        {/* table */}
                        <div className="overflow-hidden rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                            <table className="w-full text-xs">
                                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400">
                                    <th className="px-3 py-2 text-left"><span className="flex items-center gap-1">Integration <InfoTip content={SET_TIP.colIntegration} /></span></th>
                                    <th className="text-left"><span className="flex items-center gap-1">Kind <InfoTip content={SET_TIP.colKind} /></span></th>
                                    <th className="text-left"><span className="flex items-center gap-1">Status <InfoTip content={SET_TIP.colStatus} /></span></th>
                                    <th className="text-left"><span className="flex items-center gap-1">Last test <InfoTip content={SET_TIP.colLastTest} /></span></th>
                                    <th className="px-2 text-right"><span className="flex items-center justify-end gap-1">Actions <InfoTip content={SET_TIP.colActions} /></span></th>
                                </tr></thead>
                                <tbody>
                                    {filteredInts.length === 0 && (
                                        <tr><td colSpan={5} className="px-3 py-6 text-center text-[11px] text-slate-400">No integrations yet — add one to connect BMS/DCIM feeds, webhooks or scheduled exports.</td></tr>
                                    )}
                                    {filteredInts.map((i) => (
                                        <tr key={i.id} onClick={() => setSelInt(i.id)}
                                            className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/60 ${selInt === i.id ? 'bg-rz-mint/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                                            <td className="px-3 py-2"><span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200"><Plug className="h-3.5 w-3.5 text-rz-mint" />{i.name}</span></td>
                                            <td className="text-slate-500">{KINDS.find((k) => k.value === i.kind)?.label ?? i.kind}</td>
                                            <td><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${i.status === 'reachable' ? 'bg-rz-data/15 text-rz-data' : i.status === 'error' ? 'bg-rose-500/15 text-rose-500' : i.status === 'configured' ? 'bg-cyan-500/15 text-cyan-500' : 'bg-slate-500/15 text-slate-400'}`}>{i.status}</span></td>
                                            <td className="text-[10px] text-slate-400">{i.lastTestAt ? new Date(i.lastTestAt).toLocaleTimeString() : '—'}</td>
                                            <td className="px-2 text-right">
                                                <button onClick={(e) => { e.stopPropagation(); testIntegration(i); }} className="mr-1 rounded border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500 hover:border-rz-mint">Test</button>
                                                <button onClick={(e) => { e.stopPropagation(); s.actions.removeIntegration(i.id); if (selInt === i.id) setSelInt(null); }} className="rounded border border-rose-400/40 px-1.5 py-0.5 text-rose-400"><Trash2 className="h-3 w-3" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-slate-400">Honest scope: reachability tests run from this browser (CORS-limited); backend-bound kinds (BMS feed) show their real status until a deployment integration exists. Secrets are configured at deploy time — only reference labels are stored here.</p>
                    </div>

                    {/* detail rail */}
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <h3 className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Integration Details <InfoTip content={SET_TIP.intDetails} /></h3>
                        {!sel && <p className="text-[10px] text-slate-400">Select an integration to configure it.</p>}
                        {sel && (
                            <div className="space-y-2 text-[10px]">
                                <label className="block">
                                    <span className="inline-flex items-center gap-0.5 font-semibold uppercase text-slate-500">Name <InfoTip content={SET_TIP.fName} /></span>
                                    <input className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                                        value={sel.name} onChange={(e) => s.actions.upsertIntegration({ ...sel, name: e.target.value })} />
                                </label>
                                <label className="block">
                                    <span className="inline-flex items-center gap-0.5 font-semibold uppercase text-slate-500">Kind <InfoTip content={SET_TIP.fKind} /></span>
                                    <select className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                                        value={sel.kind} onChange={(e) => s.actions.upsertIntegration({ ...sel, kind: e.target.value as IntegrationKind })}>
                                        {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                                    </select>
                                    <span className="text-[9px] text-slate-400">{KINDS.find((k) => k.value === sel.kind)?.note}</span>
                                </label>
                                <label className="block">
                                    <span className="inline-flex items-center gap-0.5 font-semibold uppercase text-slate-500">Endpoint URL <InfoTip content={SET_TIP.fEndpoint} /></span>
                                    <input className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                                        placeholder="https://endpoint…" value={sel.url}
                                        onChange={(e) => s.actions.upsertIntegration({ ...sel, url: e.target.value, status: e.target.value ? 'configured' : 'unconfigured' })} />
                                </label>
                                <label className="block">
                                    <span className="inline-flex items-center gap-0.5 font-semibold uppercase text-slate-500">Secret reference <InfoTip content={SET_TIP.fSecret} /></span>
                                    <input className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                                        placeholder="ref label only — never the secret" value={sel.secretRef}
                                        onChange={(e) => s.actions.upsertIntegration({ ...sel, secretRef: e.target.value })} />
                                </label>
                                {sel.lastTestAt && <p className="text-[9px] text-slate-400">Last test {new Date(sel.lastTestAt).toLocaleString()}: {sel.lastTestNote}</p>}
                                <div className="flex gap-1.5 pt-1">
                                    <button onClick={() => testIntegration(sel)} className="flex-1 rounded-lg bg-rz-mint py-1.5 font-semibold text-rz-base hover:bg-rz-mint/80">Test Connection</button>
                                    <button onClick={() => { s.actions.removeIntegration(sel.id); setSelInt(null); }} className="rounded-lg border border-rose-400/40 px-2 py-1.5 text-rose-400"><Trash2 className="h-3 w-3" /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {toast && <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 dark:bg-slate-700 px-3 py-2 text-xs text-white shadow-xl">{toast}</div>}
        </div>
    );
}
