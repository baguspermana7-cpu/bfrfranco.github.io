'use client';

import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '@/store/simulation';
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
} from 'lucide-react';
import clsx from 'clsx';
import { getPUE } from '@/constants/pue';
import { useAuthStore } from '@/store/auth';
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
    const scenarioStore = useScenarioStore();
    const capexStore = useCapexStore();
    const { theme, setTheme } = useTheme();

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

    const navItems: { label: string; icon: LucideIcon; id: typeof activeTab; section?: string }[] = [
        { label: 'CAPEX Config', icon: Building, id: 'capex' },
        { label: 'Staff Model Config', icon: Calculator, id: 'sim' },
        { label: 'Staffing', icon: Users, id: 'staff' },
        { label: 'Maintenance', icon: Wrench, id: 'maint' },
        { label: 'Risk Analysis', icon: ShieldAlert, id: 'risk' },
        { label: 'Reliability (RAM)', icon: ShieldCheck, id: 'reliability' },
        { label: 'Carbon / ESG', icon: Leaf, id: 'carbon' },
        { label: 'Financial', icon: TrendingUp, id: 'finance' },
        { label: 'Investment', icon: Landmark, id: 'invest' },
        { label: 'Capacity Plan', icon: Layers, id: 'capacity', section: 'planning' },
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
        { label: 'Report', icon: FileText, id: 'report' },
    ];

    // ── DC-OS 13-engine lifecycle tree: the 23 modules REGROUPED (not deleted)
    //    under the reference-image engines. Empty engines show a "planned" chip. ──
    const leaf = (id: typeof activeTab) => navItems.find((n) => n.id === id)!;
    const ENGINE_GROUPS: { num: number; label: string; icon: LucideIcon; childIds: (typeof activeTab)[] }[] = [
        { num: 1, label: 'Requirements', icon: ClipboardCheck, childIds: ['sim'] },
        { num: 2, label: 'Site Intelligence', icon: MapPin, childIds: ['tax', 'disaster', 'grid', 'talent', 'compliance'] },
        { num: 3, label: 'Architecture', icon: Boxes, childIds: [] },
        { num: 4, label: 'Capacity Planning', icon: Layers, childIds: ['capacity', 'fuel-gen'] },
        { num: 5, label: 'CAPEX Engine', icon: Building, childIds: ['capex'] },
        { num: 6, label: 'Construction', icon: HardHat, childIds: ['phased-finance'] },
        { num: 7, label: 'Commissioning', icon: CheckCircle2, childIds: [] },
        { num: 8, label: 'Operations', icon: Wrench, childIds: ['staff', 'maint'] },
        { num: 9, label: 'Asset Intelligence', icon: Activity, childIds: ['asset-lifecycle', 'cbm'] },
        { num: 10, label: 'Reliability', icon: ShieldCheck, childIds: ['risk', 'reliability'] },
        { num: 11, label: 'Sustainability', icon: Leaf, childIds: ['carbon'] },
        { num: 12, label: 'Financial', icon: TrendingUp, childIds: ['finance', 'invest', 'montecarlo', 'portfolio', 'benchmark', 'strategic'] },
        { num: 13, label: 'AI Decision Engine', icon: BrainCircuit, childIds: [] },
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
        <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans selection:bg-cyan-500/30 transition-colors duration-300">
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
                    "w-64 border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl flex flex-col fixed h-full z-40 transition-all duration-300",
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
                    <div className="px-6 pb-5 pt-2">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            <img src="/dcmoc/favicon-portfolio.png" alt="DCMOC" className="w-8 h-8 rounded" />
                            DCMOC
                            <span className="text-xs bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 px-1.5 py-0.5 rounded ml-auto">PRO</span>
                        </h1>
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    <nav className="space-y-1" aria-label="Main navigation">
                        {/* DC-OS: Executive Overview landing */}
                        <div className="flex items-center mb-2">
                            <button
                                onClick={() => { actions.setActiveTab('dashboard'); setSidebarOpen(false); }}
                                aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                                className={clsx(
                                    "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all",
                                    activeTab === 'dashboard'
                                        ? "bg-cyan-600 text-white shadow-sm shadow-cyan-900/30"
                                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                                )}
                            >
                                <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                                Dashboard
                            </button>
                            <Explain k="tab-dashboard" />
                        </div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2 block px-2" aria-hidden="true">
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
                                        aria-expanded={hasChildren ? open : undefined}
                                        disabled={!hasChildren}
                                        className={clsx(
                                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                            hasChildren ? "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer" : "cursor-default",
                                            active ? "text-cyan-700 dark:text-cyan-400" : "text-slate-600 dark:text-slate-300"
                                        )}
                                    >
                                        <span className="text-[10px] font-mono text-slate-400 w-4 text-right shrink-0">{g.num}</span>
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
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 lg:ml-64 min-h-screen relative overflow-x-hidden pt-16">
                {/* Top Navbar */}
                <header className="h-16 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md fixed top-0 left-0 right-0 lg:left-64 z-20 flex items-center px-4 lg:px-8 justify-between bg-white/80 dark:bg-slate-900/80 transition-colors duration-300">
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
                            <span className="hidden sm:inline text-slate-400 dark:text-slate-600">App</span>
                            <span className="hidden sm:inline"> / </span>
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{activeTab === 'dashboard' ? 'Executive Overview' : navItems.find(n => n.id === activeTab)?.label || 'Simulation'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full border border-emerald-500/20">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-500">SYSTEM ONLINE</span>
                        </div>
                    </div>
                </header>

                {/* Data-vintage banner */}
                {!vintageBannerDismissed && (
                    <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                            <span className="font-medium text-slate-600 dark:text-slate-300">Data vintage: 2026-Q1</span>
                            {' · '}benchmarks: Uptime Institute 2025, JLL/CBRE 2025
                            {' · '}costs in USD
                        </span>
                        <button
                            onClick={handleDismissVintageBanner}
                            className="shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            aria-label="Dismiss data vintage notice"
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
