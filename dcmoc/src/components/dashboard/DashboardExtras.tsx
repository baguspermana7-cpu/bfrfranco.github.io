'use client';

import React from 'react';
import { Database, BrainCircuit, Boxes, FileText, CheckCircle2, Rocket, Plus, Zap, Download, UserPlus, Settings, AlertTriangle } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { rzModels } from '@/lib/rz-engine';

/* ── Data Flow & Digital Thread rail — LIVE: each stage shows its real count
 *    from the current project + engine state, with a flowing pulse (not static). ── */
export interface FlowStats { inputs?: number; outputs?: number; decisions?: number }
export function DataFlowRail({ stats }: { stats?: FlowStats }) {
    const modelCount = Object.keys(rzModels() || {}).length;
    const FLOW: { label: string; icon: React.ElementType; count: number | null; hint: string }[] = [
        { label: 'Input Data', icon: Database, count: stats?.inputs ?? null, hint: 'configured project parameters' },
        { label: 'Engines', icon: BrainCircuit, count: 13, hint: '13-layer lifecycle engines' },
        { label: 'Models', icon: Boxes, count: modelCount, hint: 'shared rz-engine model namespaces' },
        { label: 'Outputs', icon: FileText, count: stats?.outputs ?? null, hint: 'computed KPIs on this dashboard' },
        { label: 'Decisions', icon: CheckCircle2, count: stats?.decisions ?? null, hint: 'Layer-13 AI recommendations' },
        { label: 'Actions', icon: Rocket, count: 6, hint: 'quick actions available' },
    ];
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Data Flow &amp; Digital Thread</h2>
                <span className="inline-flex items-center gap-1 text-[9px] text-cyan-500"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />live</span>
            </div>
            <div className="flex items-start justify-between gap-0.5 flex-wrap">
                {FLOW.map((f, i) => {
                    const Icon = f.icon;
                    return (
                        <React.Fragment key={f.label}>
                            <div className="group flex flex-col items-center gap-1 flex-1 min-w-[44px]" title={`${f.label} — ${f.hint}`}>
                                <div className="relative w-9 h-9 rounded-lg bg-rz-info/10 border border-white/10 flex items-center justify-center transition-colors group-hover:border-rz-info/50">
                                    <Icon className="w-4 h-4 text-cyan-400" />
                                    {f.count != null && <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-cyan-500 text-[8px] font-bold text-white flex items-center justify-center tabular-nums">{f.count}</span>}
                                </div>
                                <span className="text-[8px] text-slate-500 text-center leading-tight">{f.label}</span>
                            </div>
                            {i < FLOW.length - 1 && (
                                <div className="shrink-0 mt-3.5 flex gap-[3px]" aria-hidden="true">
                                    {[0, 1, 2].map((k) => <span key={k} className="w-1 h-1 rounded-full bg-cyan-500/70 animate-pulse" style={{ animationDelay: `${i * 200 + k * 160}ms`, animationDuration: '1.2s' }} />)}
                                </div>
                            )}
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
