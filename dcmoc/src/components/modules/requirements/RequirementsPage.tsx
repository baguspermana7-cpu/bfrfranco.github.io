'use client';

/* ─── Requirements & Workload Engine — page shell (Phase A) ──────────────────
 * Header (Save Draft / Validate / Save & Continue) + sub-tab strip 1.1–1.7
 * (scroll-spy section nav) + main column + sticky insights rail + footer
 * lifecycle strip. Faithful to the DC-OS reference (1.requirement.png).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { useRequirementsDerived } from './useRequirementsDerived';
import { ProjectOverviewSection } from './sections/ProjectOverviewSection';
import { WorkloadProfileSection } from './sections/WorkloadProfileSection';
import { GrowthPlanSection, AvailabilitySection, BusinessPrioritySection } from './sections/GrowthAvailabilitySections';
import { SummarySection } from './sections/SummarySection';
import { InfrastructureOptionsSection } from './sections/InfrastructureOptionsSection';
import { InsightsRail } from './InsightsRail';
import { ClipboardList, Check, ChevronRight } from 'lucide-react';

const TABS = [
    { id: 'sec-overview', label: '1.1 Project Overview' },
    { id: 'sec-workload', label: '1.2 Workload Profile' },
    { id: 'sec-growth', label: '1.3 Capacity & Growth' },
    { id: 'sec-availability', label: '1.4 Reliability & SLA' },
    { id: 'sec-business', label: '1.5 Business & Financial' },
    { id: 'sec-infra', label: '1.6 Infrastructure & Site' },
    { id: 'sec-summary', label: '1.7 Summary' },
];

export function RequirementsPage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const markSaved = useRequirementsStore((s) => s.actions.markSaved);
    const lastSavedAt = useRequirementsStore((s) => s.lastSavedAt);
    const derived = useRequirementsDerived();
    const [activeSec, setActiveSec] = React.useState(TABS[0].id);
    const [toast, setToast] = React.useState<string | null>(null);

    /* hydration gate (persisted store → avoid SSR/CSR mismatch) */
    const [hydrated, setHydrated] = React.useState(false);
    React.useEffect(() => {
        if (useRequirementsStore.persist.hasHydrated()) { setHydrated(true); return; }
        return useRequirementsStore.persist.onFinishHydration(() => setHydrated(true));
    }, []);

    /* scroll-spy */
    React.useEffect(() => {
        const obs = new IntersectionObserver((entries) => {
            const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (vis[0]) setActiveSec(vis[0].target.id);
        }, { rootMargin: '-15% 0px -70% 0px' });
        TABS.forEach((t) => { const el = document.getElementById(t.id); if (el) obs.observe(el); });
        return () => obs.disconnect();
    }, [hydrated]);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
    const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

    if (!hydrated) {
        return <div className="p-8 text-center text-sm text-slate-500">Loading requirements…</div>;
    }

    return (
        <div className="space-y-4">
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded bg-rz-mint/15 border border-rz-mint/30">
                        <ClipboardList className="h-6 w-6 text-rz-mint" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Requirements & Workload Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Define customer needs, workload characteristics, SLA, growth and business objectives</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { markSaved(); showToast('Draft saved'); }}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-rz-mint">
                        Save Draft
                    </button>
                    <button onClick={() => { scrollTo('sec-summary'); showToast(`Validation: ${derived.validation?.flags.length ?? 0} flag(s)`); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-rz-data/50 px-3 py-2 text-xs font-medium text-rz-data hover:bg-rz-data/10">
                        <Check className="h-3.5 w-3.5" /> Validate
                    </button>
                    <button onClick={() => { markSaved(); setActiveTab('site'); }}
                        className="inline-flex items-center gap-1 rounded-lg bg-rz-signal px-3 py-2 text-xs font-semibold text-rz-base hover:bg-rz-signal/80">
                        Save & Continue <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* sub-tab strip */}
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-1">
                {TABS.map((t) => (
                    <button key={t.id} onClick={() => scrollTo(t.id)}
                        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${activeSec === t.id
                            ? 'bg-rz-mint text-rz-base'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-rz-mint/10'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* content grid */}
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-4">
                    <ProjectOverviewSection />
                    <WorkloadProfileSection totalRacks={derived.totalRacks} />
                    <GrowthPlanSection derived={derived} />
                    <AvailabilitySection derived={derived} />
                    <BusinessPrioritySection derived={derived} />
                    <InfrastructureOptionsSection />
                    <SummarySection derived={derived} />
                </div>
                <InsightsRail derived={derived} />
            </div>

            {/* footer lifecycle strip */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-4 py-2.5">
                <span className="text-[11px] text-slate-500">Step <b className="text-slate-900 dark:text-white">1 of 9</b>: Requirements
                    {lastSavedAt && <span className="ml-2 text-[10px] text-slate-400">saved {new Date(lastSavedAt).toLocaleTimeString()}</span>}
                </span>
                <div className="flex items-center gap-1.5">
                    {Array.from({ length: 9 }, (_, i) => (
                        <span key={i} className={`h-1.5 rounded-full ${i === 0 ? 'w-5 bg-rz-mint' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`} />
                    ))}
                </div>
                <button onClick={() => setActiveTab('site')} className="inline-flex items-center gap-1 text-[11px] font-medium text-rz-mint hover:text-rz-mint/80">
                    Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>

            {toast && (
                <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 dark:bg-slate-700 px-3 py-2 text-xs text-white shadow-xl">{toast}</div>
            )}
        </div>
    );
}
