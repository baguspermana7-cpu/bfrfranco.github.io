'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFx } from '@/lib/fx';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { useScenarioStore, SavedScenario } from '@/store/scenario';
import { useCapexStore } from '@/store/capex';
import { useTheme } from '@/components/providers/ThemeProvider';
import type { LucideIcon } from 'lucide-react';
import {
    Calculator,
    Building,
    Users,
    Wrench,
    ShieldAlert,
    FileText,
    Leaf,
    TrendingUp,
    Save,
    Trash2,
    Upload,
    X,
    FolderOpen,
    Sun,
    Moon,
    ArrowLeft,
    Landmark,
    Target,
    Dices,
    Layers,
    GitCompare,
    Receipt,
    CloudLightning,
    Zap,
    GraduationCap,
    Check,
    LogOut,
    HelpCircle,
    ClipboardCheck,
    LineChart,
    Activity,
    Fuel,
    Menu,
    MapPin,
    LayoutDashboard,
    Boxes,
    HardHat,
    CheckCircle2,
    ShieldCheck,
    BrainCircuit,
    ChevronRight,
    Flame,
    Waves,
    Package,
} from 'lucide-react';
import clsx from 'clsx';
import { getPUE } from '@/constants/pue';
import { useAuthStore } from '@/store/auth';
import { useProjectsStore } from '@/store/projects';
import { LoginScreen } from '@/components/ui/LoginScreen';
import { Explain } from '@/components/ui/Explain';

interface ShellProps {
    children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
    const user = useAuthStore((s) => s.user);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        // Check if zustand persist already finished hydrating
        if (useAuthStore.persist.hasHydrated()) {
            setHydrated(true);
            return;
        }
        // Otherwise wait for it
        const unsub = useAuthStore.persist.onFinishHydration(() => {
            setHydrated(true);
        });
        return unsub;
    }, []);

    // Wait for zustand persist to finish rehydrating from localStorage
    if (!hydrated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    return <ShellContent user={user}>{children}</ShellContent>;
}

function ShellContent({ children, user }: { children: React.ReactNode; user: { email: string; role: string } }) {
    const logout = useAuthStore((s) => s.logout);
    const { selectedCountry, activeTab, inputs, actions } = useSimulationStore();
    const projectName = useRequirementsStore((s) => s.overview.projectName);
    const projCurrency = useRequirementsStore((s) => s.overview.currency);
    const fx = useFx();
    const scenarioStore = useScenarioStore();
    const capexStore = useCapexStore();
    const { theme, setTheme } = useTheme();
    const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId) ?? null);

    const [scenarioName, setScenarioName] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [expandedEngines, setExpandedEngines] = useState<number[]>([]);
    const [vintageBannerDismissed, setVintageBannerDismissed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('dcmoc-vintage-banner-dismissed') === '1';
        }
        return false;
    });

    const handleDismissVintageBanner = () => {
        setVintageBannerDismissed(true);
        localStorage.setItem('dcmoc-vintage-banner-dismissed', '1');
    };

    // ── Resizable sidebar (lg+ only; mobile drawer keeps w-64) ──
    const SIDEBAR_DEFAULT = 256;
    const SIDEBAR_MIN = 200;
    const SIDEBAR_MAX = 420;
    const clampSidebarW = (w: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w));
    const [sidebarW, setSidebarW] = useState(SIDEBAR_DEFAULT);
    const dragRef = useRef<{ startX: number; startW: number } | null>(null);

    useEffect(() => {
        // Lazy init from localStorage post-mount (avoids SSR hydration mismatch)
        const saved = localStorage.getItem('dcmoc-sidebar-w');
        if (saved) {
            const n = parseInt(saved, 10);
            if (!Number.isNaN(n)) setSidebarW(Math.min(420, Math.max(200, n)));
        }
    }, []);

    const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = { startX: e.clientX, startW: sidebarW };
    };
    const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = dragRef.current;
        if (!d) return;
        setSidebarW(clampSidebarW(d.startW + e.clientX - d.startX));
    };
    const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = dragRef.current;
        if (!d) return;
        dragRef.current = null;
        const final = clampSidebarW(d.startW + e.clientX - d.startX);
        setSidebarW(final);
        localStorage.setItem('dcmoc-sidebar-w', String(final));
    };
    const onResizeReset = () => {
        setSidebarW(SIDEBAR_DEFAULT);
        localStorage.setItem('dcmoc-sidebar-w', String(SIDEBAR_DEFAULT));
    };

    const navItems: { label: string; icon: LucideIcon; id: typeof activeTab; section?: string }[] = [
        { label: 'CAPEX Engine', icon: Building, id: 'capex' },
        { label: 'Operations Overview', icon: Activity, id: 'ops' },
        { label: 'Staff Model Config', icon: Calculator, id: 'sim' },
        { label: 'Staffing', icon: Users, id: 'staff' },
        { label: 'Maintenance', icon: Wrench, id: 'maint' },
        { label: 'Risk Analysis', icon: ShieldAlert, id: 'risk' },
        { label: 'Reliability Engine', icon: ShieldCheck, id: 'reliability' },
        { label: 'Requirements & Workload', icon: ClipboardCheck, id: 'requirements' },
        { label: 'Site Intelligence', icon: MapPin, id: 'site' },
        { label: 'Architecture Engine', icon: Boxes, id: 'architecture' },
        { label: 'Construction Engine', icon: HardHat, id: 'construction' },
        { label: 'Commissioning Engine', icon: CheckCircle2, id: 'commissioning' },
        { label: 'Asset Intelligence', icon: Activity, id: 'asset-health' },
        { label: 'Sustainability Engine', icon: Leaf, id: 'carbon' },
        { label: 'Financial', icon: TrendingUp, id: 'finance' },
        { label: 'Investment', icon: Landmark, id: 'invest' },
        { label: 'Capacity Planning', icon: Layers, id: 'capacity', section: 'planning' },
        { label: 'Phased Finance', icon: Calculator, id: 'phased-finance', section: 'planning' },
        { label: 'Benchmarks', icon: Target, id: 'benchmark', section: 'analytics' },
        { label: 'Monte Carlo', icon: Dices, id: 'montecarlo', section: 'analytics' },
        { label: 'Portfolio', icon: Layers, id: 'portfolio', section: 'analytics' },
        { label: 'Tax & Incentives', icon: Receipt, id: 'tax', section: 'country-intel' },
        { label: 'Disaster Risk', icon: CloudLightning, id: 'disaster', section: 'country-intel' },
        { label: 'Grid Reliability', icon: Zap, id: 'grid', section: 'country-intel' },
        { label: 'Talent Index', icon: GraduationCap, id: 'talent', section: 'country-intel' },
        { label: 'Compliance', icon: ClipboardCheck, id: 'compliance', section: 'country-intel' },
        { label: 'Asset Lifecycle', icon: LineChart, id: 'asset-lifecycle', section: 'planning' },
        { label: 'CBM / DCIM', icon: Activity, id: 'cbm', section: 'planning' },
        { label: 'Strategic Planning', icon: MapPin, id: 'strategic', section: 'planning' },
        { label: 'Fuel & Generator', icon: Fuel, id: 'fuel-gen' },
        { label: 'Tier Classification', icon: ShieldCheck, id: 'tier' },
        { label: 'Fire Suppression', icon: Flame, id: 'fire' },
        { label: 'CDU / Liquid Cooling', icon: Waves, id: 'cdu' },
        { label: 'Spares Optimization', icon: Package, id: 'spares' },
        { label: 'Results Engine', icon: FileText, id: 'report' },
    ];

    // ── DC-OS 13-engine lifecycle tree: the 23 modules REGROUPED (not deleted)
    //    under the reference-image engines. Empty engines show a "planned" chip. ──
    const leaf = (id: typeof activeTab) => navItems.find((n) => n.id === id)!;
    const ENGINE_GROUPS: { num: number; label: string; icon: LucideIcon; childIds: (typeof activeTab)[] }[] = [
        { num: 1, label: 'Requirements', icon: ClipboardCheck, childIds: ['requirements'] },
        { num: 2, label: 'Site Intelligence', icon: MapPin, childIds: ['site', 'tax', 'disaster', 'grid', 'talent', 'compliance'] },
        { num: 3, label: 'Architecture', icon: Boxes, childIds: ['architecture', 'fire'] },
        { num: 4, label: 'Capacity Planning', icon: Layers, childIds: ['capacity', 'fuel-gen', 'cdu'] },
        { num: 5, label: 'CAPEX Engine', icon: Building, childIds: ['capex'] },
        { num: 6, label: 'Construction', icon: HardHat, childIds: ['construction', 'phased-finance'] },
        { num: 7, label: 'Commissioning', icon: CheckCircle2, childIds: ['commissioning'] },
        { num: 8, label: 'Operations', icon: Wrench, childIds: ['ops', 'sim', 'staff', 'maint'] },
        { num: 9, label: 'Asset Intelligence', icon: Activity, childIds: ['asset-health', 'asset-lifecycle', 'cbm', 'spares'] },
        { num: 10, label: 'Reliability', icon: ShieldCheck, childIds: ['risk', 'reliability'] },
        { num: 11, label: 'Sustainability', icon: Leaf, childIds: ['carbon'] },
        { num: 12, label: 'Financial', icon: TrendingUp, childIds: ['finance', 'invest', 'portfolio', 'benchmark', 'strategic'] },
        { num: 13, label: 'AI Decision Engine', icon: BrainCircuit, childIds: [] },
    ];
    // Per-engine accent (reference: color-coded number badges 1–13)
    const ENGINE_COLORS: Record<number, string> = {
        1: '#22d3ee', 2: '#34d399', 3: '#a78bfa', 4: '#fbbf24', 5: '#60a5fa', 6: '#fb923c',
        7: '#2dd4bf', 8: '#38bdf8', 9: '#818cf8', 10: '#fb7185', 11: '#4ade80', 12: '#10b981', 13: '#e879f9',
    };
    // PLATFORM + SUPPORT sections (route to engine-backed where possible, else stub tabs)
    const PLATFORM: { label: string; icon: LucideIcon; id?: typeof activeTab; action?: () => void }[] = [
        { label: 'Projects', icon: FolderOpen, id: 'projects' },
        { label: 'Scenarios', icon: Layers, id: 'scenarios' },
        { label: 'Scenario Comparison', icon: Layers, id: 'scenario-compare' },
        { label: 'Templates', icon: Boxes, id: 'templates' },
        { label: 'Data Library', icon: FileText, id: 'data-library' },
        { label: 'Knowledge Base', icon: HelpCircle, id: 'knowledge' },
    ];
    const SUPPORT: { label: string; icon: LucideIcon; id: typeof activeTab }[] = [
        { label: 'Integrations', icon: Zap, id: 'integrations' },
        { label: 'Settings', icon: Wrench, id: 'settings' },
        { label: 'Audit Trail', icon: ClipboardCheck, id: 'audit' },
        { label: 'User Management', icon: Users, id: 'users' },
    ];

    const engineOfActive = ENGINE_GROUPS.find((g) => g.childIds.includes(activeTab))?.num;
    const isEngineOpen = (num: number) => expandedEngines.includes(num) || engineOfActive === num;
    const toggleEngine = (num: number) =>
        setExpandedEngines((prev) => prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]);

    // Save current state as scenario
    const handleSaveScenario = () => {
        if (!scenarioName.trim()) return;
        const totalStaff = inputs.headcount_ShiftLead + inputs.headcount_Engineer +
            inputs.headcount_Technician + inputs.headcount_Admin + inputs.headcount_Janitor;
        scenarioStore.saveScenario({
            name: scenarioName.trim(),
            countryId: selectedCountry?.id || 'ID',
            simInputs: { ...inputs },
            capexInputs: { ...capexStore.inputs },
            summary: {
                monthlyOpex: 0,
                annualCapex: capexStore.results?.total || 0,
                totalStaff,
                pue: getPUE(inputs.coolingType),
            },
        });
        setScenarioName('');
    };

    // Load a scenario back into stores
    const handleLoadScenario = (scenario: SavedScenario) => {
        actions.setInputs(scenario.simInputs);
        capexStore.setInputs(scenario.capexInputs);
        if (scenario.countryId) {
            actions.selectCountry(scenario.countryId);
        }
        scenarioStore.closePanel();
    };

    const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const fmtMoney = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;

    return (
        <div
            className="min-h-screen flex bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans selection:bg-cyan-500/30 transition-colors duration-300"
            style={{ '--sbw': `${sidebarW}px` } as React.CSSProperties}
        >
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={clsx(
                    "w-64 lg:w-[var(--sbw)] border-r border-slate-200 dark:border-white/5 bg-white/95 dark:bg-[#0b1020]/95 backdrop-blur-xl flex flex-col fixed h-full z-40 transition-all duration-300",
                    // On large screens: always visible. On small screens: slide in/out
                    "lg:translate-x-0",
                    sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
                )}
                aria-label="Sidebar navigation"
            >
                <div className="border-b border-slate-200 dark:border-slate-800">
                    <a
                        href="/index.html"
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Portfolio
                    </a>
                    <div className="px-5 pb-4 pt-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/40 shrink-0">
                                <BrainCircuit className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 leading-none">
                                    DC-OS
                                    <span className="text-[9px] bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded font-semibold">PRO</span>
                                </h1>
                                <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate mt-0.5">Data Center Intelligence Platform</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    <nav className="space-y-1" aria-label="Main navigation">
                        {/* ── PLATFORM ── */}
                        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 px-2" aria-hidden="true">
                            Platform
                        </div>
                        {/* DC-OS: Executive Overview landing */}
                        <div className="flex items-center">
                            <button
                                onClick={() => { actions.setActiveTab('dashboard'); setSidebarOpen(false); }}
                                title="Dashboard"
                                aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                                className={clsx(
                                    "flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                                    activeTab === 'dashboard'
                                        ? "bg-cyan-600 text-white shadow-sm shadow-cyan-900/30"
                                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.04]"
                                )}
                            >
                                <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                                Dashboard
                            </button>
                            <Explain k="tab-dashboard" />
                        </div>
                        {PLATFORM.map((p) => {
                            const PIcon = p.icon;
                            const active = !!p.id && activeTab === p.id;
                            return (
                                <button
                                    key={p.label}
                                    onClick={() => { if (p.action) p.action(); else if (p.id) { actions.setActiveTab(p.id); setSidebarOpen(false); } }}
                                    title={p.label}
                                    aria-current={active ? 'page' : undefined}
                                    className={clsx(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                                        active ? "bg-slate-200 dark:bg-white/[0.06] text-cyan-700 dark:text-cyan-400 font-medium"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/[0.04] hover:text-cyan-700 dark:hover:text-cyan-400"
                                    )}
                                >
                                    <PIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{p.label}</span>
                                    {p.label === 'Scenarios' && scenarioStore.scenarios.length > 0 && (
                                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-400">{scenarioStore.scenarios.length}</span>
                                    )}
                                </button>
                            );
                        })}
                        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 mt-4 px-2" aria-hidden="true">
                            Engines · 13-Layer Lifecycle
                        </div>
                        {ENGINE_GROUPS.map((g) => {
                            const open = isEngineOpen(g.num);
                            const hasChildren = g.childIds.length > 0;
                            const active = g.childIds.includes(activeTab);
                            const GroupIcon = g.icon;
                            return (
                                <div key={g.num}>
                                    <button
                                        onClick={() => { if (hasChildren) toggleEngine(g.num); }}
                                        title={g.label}
                                        aria-expanded={hasChildren ? open : undefined}
                                        disabled={!hasChildren}
                                        className={clsx(
                                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                            hasChildren ? "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer" : "cursor-default",
                                            active ? "text-cyan-700 dark:text-cyan-400" : "text-slate-600 dark:text-slate-300"
                                        )}
                                    >
                                        <span className="text-[10px] font-mono font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 text-white" style={{ background: ENGINE_COLORS[g.num] }}>{g.num}</span>
                                        <GroupIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                        <span className="flex-1 text-left truncate">{g.label}</span>
                                        {!hasChildren && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">soon</span>}
                                        {hasChildren && <ChevronRight className={clsx("w-3.5 h-3.5 shrink-0 transition-transform", open && "rotate-90")} aria-hidden="true" />}
                                    </button>
                                    {hasChildren && open && (
                                        <div className="ml-[1.35rem] mt-0.5 mb-1 space-y-0.5 border-l border-slate-200 dark:border-slate-800 pl-2">
                                            {g.childIds.map((id) => {
                                                const item = leaf(id);
                                                const ItemIcon = item.icon;
                                                return (
                                                    <div key={id} className="flex items-center">
                                                        <button
                                                            onClick={() => { actions.setActiveTab(id); setSidebarOpen(false); }}
                                                            title={item.label}
                                                            aria-current={activeTab === id ? 'page' : undefined}
                                                            className={clsx(
                                                                "flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
                                                                "hover:bg-slate-200/50 dark:hover:bg-slate-800/50",
                                                                activeTab === id
                                                                    ? "bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 font-medium"
                                                                    : "text-slate-600 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-400"
                                                            )}
                                                        >
                                                            <ItemIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                            <span className="truncate">{item.label}</span>
                                                        </button>
                                                        <Explain k={`tab-${id}`} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {/* Reports (cross-cutting — renders engine-sourced results) */}
                        <div className="flex items-center mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => { actions.setActiveTab('report'); setSidebarOpen(false); }}
                                title="Reports"
                                aria-current={activeTab === 'report' ? 'page' : undefined}
                                className={clsx(
                                    "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                    "hover:bg-slate-200/50 dark:hover:bg-slate-800/50",
                                    activeTab === 'report'
                                        ? "bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400"
                                        : "text-slate-600 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-400"
                                )}
                            >
                                <FileText className="w-4 h-4" aria-hidden="true" />
                                Reports
                            </button>
                            <Explain k="tab-report" />
                        </div>

                        {/* ── SUPPORT ── */}
                        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 mt-4 px-2" aria-hidden="true">
                            Support
                        </div>
                        {SUPPORT.map((s) => {
                            const SIcon = s.icon;
                            const active = activeTab === s.id;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => { actions.setActiveTab(s.id); setSidebarOpen(false); }}
                                    title={s.label}
                                    aria-current={active ? 'page' : undefined}
                                    className={clsx(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                                        active ? "bg-slate-200 dark:bg-white/[0.06] text-cyan-700 dark:text-cyan-400 font-medium"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/[0.04] hover:text-cyan-700 dark:hover:text-cyan-400"
                                    )}
                                >
                                    <SIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{s.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20 space-y-2">
                    {/* Theme Toggle */}
                    <div className="flex bg-slate-200 dark:bg-slate-900 rounded-lg p-1 border border-slate-300 dark:border-slate-800">
                        <button
                            onClick={() => setTheme('light')}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all",
                                theme === 'light'
                                    ? "bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                            title="Light Mode (Presentation)"
                            aria-label="Switch to light mode"
                            aria-pressed={theme === 'light'}
                        >
                            <Sun className="w-3.5 h-3.5" />
                            <span className="sr-only">Light</span>
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all",
                                theme === 'dark'
                                    ? "bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                            title="Dark Mode (Standard)"
                            aria-label="Switch to dark mode"
                            aria-pressed={theme === 'dark'}
                        >
                            <Moon className="w-3.5 h-3.5" />
                            <span className="sr-only">Dark</span>
                        </button>
                    </div>

                    <button
                        onClick={scenarioStore.togglePanel}
                        className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 w-full transition-colors rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                    >
                        <FolderOpen className="w-4 h-4" />
                        Scenarios
                        {scenarioStore.scenarios.length > 0 && (
                            <span className="ml-auto bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 px-1.5 py-0.5 rounded text-[10px]">
                                {scenarioStore.scenarios.length}
                            </span>
                        )}
                    </button>

                    <div className="flex items-center">
                        <button
                            onClick={() => actions.setActiveTab('faq')}
                            className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex-1 transition-colors rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                        >
                            <HelpCircle className="w-4 h-4" />
                            FAQ
                        </button>
                        <Explain k="tab-faq" />
                    </div>

                    <div className="flex items-center justify-between px-3 py-2 mt-1 border-t border-slate-200 dark:border-slate-800 pt-3">
                        <div className="text-[10px] text-slate-500 truncate">
                            {user.role === 'root' ? 'Administrator' : 'Pro User'}
                        </div>
                        <button
                            onClick={logout}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-500 transition-colors"
                            title="Sign Out"
                            aria-label="Sign out"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Resize handle (lg+ only) — drag to resize, double-click to reset */}
                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize sidebar"
                    title="Drag to resize · double-click to reset"
                    className="hidden lg:block absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-violet-500/40 z-50 touch-none"
                    onPointerDown={onResizePointerDown}
                    onPointerMove={onResizePointerMove}
                    onPointerUp={onResizePointerUp}
                    onDoubleClick={onResizeReset}
                />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 lg:ml-[var(--sbw)] min-h-screen relative overflow-x-hidden pt-16">
                {/* Top Navbar */}
                <header className="h-16 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md fixed top-0 left-0 right-0 lg:left-[var(--sbw)] z-20 flex items-center px-4 lg:px-8 justify-between bg-white/80 dark:bg-slate-900/80 transition-colors duration-300">
                    <div className="flex items-center gap-3">
                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setSidebarOpen(prev => !prev)}
                            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Toggle sidebar navigation"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="text-sm breadcrumbs text-slate-500 dark:text-slate-400">
                            <button className="hidden sm:inline text-slate-400 dark:text-slate-600 hover:text-violet-500" onClick={() => actions.setActiveTab('projects')}>Projects</button>
                            <span className="hidden sm:inline"> / </span>
                            {activeProject && (<>
                                <span className="hidden sm:inline max-w-[160px] truncate align-bottom text-violet-500 font-medium">{activeProject.name}</span>
                                <span className="hidden sm:inline"> / </span>
                            </>)}
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{activeTab === 'dashboard' ? 'Executive Overview' : navItems.find(n => n.id === activeTab)?.label || SUPPORT.find(s => s.id === activeTab)?.label || PLATFORM.find(p => p.id === activeTab)?.label || 'Overview'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full border border-emerald-500/20">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-500">SYSTEM ONLINE</span>
                        </div>
                    </div>
                </header>

                {/* #336 — PROJECT CONTEXT BAR (owner: every page must show WHICH
                  * project it is working on — live from the shared stores; the old
                  * static data-vintage note shrinks into a hover title). */}
                {!vintageBannerDismissed && (
                    <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400"
                        title="Data vintage: 2026-Q1 · benchmarks: Uptime Institute 2025, JLL/CBRE 2025 · costs in USD">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                            <span className="font-semibold text-violet-600 dark:text-violet-300 truncate">
                                {projectName || 'Untitled Project'}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-medium text-slate-600 dark:text-slate-300">{selectedCountry?.name ?? '—'}</span>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="tabular-nums">{(inputs.itLoad / 1000).toFixed(inputs.itLoad >= 100000 ? 0 : 1)} MW IT</span>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span>Tier {inputs.tierLevel}</span>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="capitalize">{inputs.coolingType}</span>
                            {projCurrency && projCurrency !== 'USD' && fx.rates[projCurrency] && (
                                <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-600 dark:text-cyan-400"
                                    title={`Kurs ${fx.source === 'live' ? 'LIVE via gateway /fx' : 'snapshot engine (offline fallback)'} · ${fx.asOf}`}>
                                    {projCurrency} {fx.rates[projCurrency]?.toLocaleString()} /USD · {fx.source}
                                </span>
                            )}
                            <span className="hidden sm:inline text-[10px] text-slate-400 dark:text-slate-500">· data 2026-Q1 ⓘ</span>
                        </span>
                        <button
                            onClick={handleDismissVintageBanner}
                            className="shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            aria-label="Dismiss project context bar"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
                <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </main>

            {/* Floating FAQ / Manual button */}
            {activeTab !== 'faq' && (
                <button
                    onClick={() => actions.setActiveTab('faq')}
                    className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-3 py-2.5 bg-slate-800 dark:bg-slate-700 border border-slate-600 dark:border-slate-500 text-slate-200 rounded-full shadow-xl hover:bg-cyan-700 dark:hover:bg-cyan-700 transition-colors text-xs font-medium"
                    title="Open FAQ / Manual"
                    aria-label="Open FAQ and manual"
                >
                    <HelpCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">FAQ / Manual</span>
                </button>
            )}

            {/* Scenario Slide-out Panel */}
            {scenarioStore.isPanelOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30 backdrop-blur-sm" onClick={scenarioStore.closePanel} />

                    {/* Panel */}
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="scenario-panel-title"
                        className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 z-40 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
                            <h2 id="scenario-panel-title" className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FolderOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                                Scenario Manager
                            </h2>
                            <button onClick={scenarioStore.closePanel} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" aria-label="Close scenario manager">
                                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                            </button>
                        </div>

                        {/* Save New */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                            <label htmlFor="scenario-name-input" className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-2 block">Save Current Configuration</label>
                            <div className="flex gap-2">
                                <input
                                    id="scenario-name-input"
                                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    placeholder="Scenario name..."
                                    value={scenarioName}
                                    onChange={e => setScenarioName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveScenario()}
                                />
                                <button
                                    onClick={handleSaveScenario}
                                    disabled={!scenarioName.trim()}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    Save
                                </button>
                            </div>
                        </div>

                        {/* Compare Button */}
                        {scenarioStore.comparisonIds.length >= 2 && (
                            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-purple-50 dark:bg-purple-900/20">
                                <button
                                    onClick={scenarioStore.enterComparisonMode}
                                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <GitCompare className="w-4 h-4" />
                                    Compare Selected ({scenarioStore.comparisonIds.length})
                                </button>
                            </div>
                        )}

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {scenarioStore.scenarios.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 text-sm">
                                    No saved scenarios yet.<br />Save your first configuration above.
                                </div>
                            ) : (
                                scenarioStore.scenarios.map(s => {
                                    const isSelected = scenarioStore.comparisonIds.includes(s.id);
                                    return (
                                        <div key={s.id} className={clsx(
                                            "p-3 rounded-xl border bg-white dark:bg-slate-800/30 hover:border-cyan-500/50 dark:hover:border-slate-700 transition-colors group shadow-sm dark:shadow-none",
                                            isSelected ? "border-purple-400 dark:border-purple-600 ring-1 ring-purple-400/30" : "border-slate-200 dark:border-slate-800"
                                        )}>
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-start gap-2">
                                                    {/* Comparison checkbox */}
                                                    <button
                                                        onClick={() => scenarioStore.toggleComparisonSelection(s.id)}
                                                        className={clsx(
                                                            "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                                            isSelected
                                                                ? "bg-purple-600 border-purple-600 text-white"
                                                                : "border-slate-300 dark:border-slate-600 hover:border-purple-400"
                                                        )}
                                                    >
                                                        {isSelected && <Check className="w-3 h-3" />}
                                                    </button>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{s.name}</h3>
                                                        <span className="text-[10px] text-slate-500">{fmtDate(s.timestamp)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleLoadScenario(s)}
                                                        className="p-1.5 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 rounded text-cyan-600 dark:text-cyan-400 transition-colors"
                                                        title="Load scenario"
                                                    >
                                                        <Upload className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => scenarioStore.deleteScenario(s.id)}
                                                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/50 rounded text-red-600 dark:text-red-400 transition-colors"
                                                        title="Delete scenario"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-[10px] ml-6">
                                                <div>
                                                    <span className="text-slate-500 block">Country</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{s.countryId}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block">Staff</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{s.summary.totalStaff}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block">CAPEX</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{fmtMoney(s.summary.annualCapex)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
