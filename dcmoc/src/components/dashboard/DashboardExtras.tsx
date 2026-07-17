'use client';

import React from 'react';
import { Database, BrainCircuit, Boxes, FileText, CheckCircle2, Rocket, Plus, Zap, Download, UserPlus, Settings, AlertTriangle, ArrowRight } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

/* ── Data Flow & Digital Thread rail ── */
const FLOW = [
    { label: 'Input Data', icon: Database }, { label: 'Engines', icon: BrainCircuit }, { label: 'Models', icon: Boxes },
    { label: 'Outputs', icon: FileText }, { label: 'Decisions', icon: CheckCircle2 }, { label: 'Actions', icon: Rocket },
];
export function DataFlowRail() {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Data Flow &amp; Digital Thread</h2>
            <div className="flex items-center justify-between gap-0.5 flex-wrap">
                {FLOW.map((f, i) => {
                    const Icon = f.icon;
                    return (
                        <React.Fragment key={f.label}>
                            <div className="flex flex-col items-center gap-1 flex-1 min-w-[44px]">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/15 to-violet-500/10 border border-white/10 flex items-center justify-center">
                                    <Icon className="w-4 h-4 text-cyan-400" />
                                </div>
                                <span className="text-[8px] text-slate-500 text-center leading-tight">{f.label}</span>
                            </div>
                            {i < FLOW.length - 1 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0 mb-4" />}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Quick Actions ── */
const ACTIONS = [
    { label: 'New Scenario', icon: Plus, desc: 'Create a new design scenario to compare configurations side-by-side.' },
    { label: 'Run Optimization', icon: Zap, desc: 'Re-run the CAPEX engine and Layer-13 AI decision with current inputs.' },
    { label: 'Generate Report', icon: FileText, desc: 'Export a full Executive PDF report covering all 13 engine outputs.' },
    { label: 'Export Dashboard', icon: Download, desc: 'Download the dashboard summary as a PDF document.' },
    { label: 'Invite Stakeholder', icon: UserPlus, desc: 'Share this project with a stakeholder via a secure invite link.' },
    { label: 'System Settings', icon: Settings, desc: 'Open application settings, preferences, and data sources.' },
];
export function QuickActions({ onAction }: { onAction?: (a: string) => void }) {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                        <button
                            key={a.label}
                            onClick={() => onAction?.(a.label)}
                            title={a.desc}
                            className="group flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300 transition-all hover:bg-cyan-500/10 hover:border-cyan-400/60 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:shadow-lg hover:shadow-cyan-900/20"
                        >
                            <Icon className="w-3.5 h-3.5 transition-colors group-hover:text-cyan-400" />
                            <span className="transition-colors group-hover:text-cyan-400">{a.label}</span>
                            <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
                                <Tooltip content={a.desc} />
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Alerts & Notifications (rule-derived from engine outputs) ── */
export interface Alert { level: 'warn' | 'info' | 'critical'; title: string; detail: string; }
export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
    const tone: Record<string, string> = { critical: 'text-rose-400 border-rose-500/30', warn: 'text-amber-400 border-amber-500/30', info: 'text-cyan-400 border-cyan-500/30' };
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Alerts &amp; Notifications</h2>
            <div className="space-y-2">
                {alerts.length === 0 && <p className="text-[11px] text-slate-500">No active alerts — configuration within envelopes.</p>}
                {alerts.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-lg border ${tone[a.level]} bg-white/[0.02] p-2`}>
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                            <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{a.title}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{a.detail}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
