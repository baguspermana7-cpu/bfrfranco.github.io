'use client';

import React from 'react';
import { Search, Sparkles, ChevronDown } from 'lucide-react';
import { AiAssistantModal } from './AiAssistantModal';
import { useAiConfigStore } from '@/store/aiConfig';

const TABS = ['Executive Overview', 'Engineering', 'Construction', 'Operations', 'Financial', 'Analytics', 'Reports'];

/** DC-OS dashboard top bar: project selector + view tabs + search + AI Assistant. */
export function DashTopBar({ project, activeTab, onTab }: { project: string; activeTab: string; onTab: (t: string) => void }) {
    const [aiOpen, setAiOpen] = React.useState(false);
    const aiEnabled = useAiConfigStore((s) => s.enabled);
    return (
        <div className="flex items-center gap-3 flex-wrap mb-4">
            {/* Project selector */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Project</span>
                <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {project}
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">Active</span>
            </div>

            {/* View tabs */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/60 p-0.5 mx-auto">
                {TABS.map((t) => (
                    <button
                        key={t}
                        data-dashtab={t}
                        onClick={() => onTab(t)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === t
                            ? 'bg-cyan-600 text-white'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Search + AI */}
            <div className="flex items-center gap-2 ml-auto">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 text-slate-400 text-xs">
                    <Search className="w-3.5 h-3.5" />
                    <span>Global Search</span>
                    <kbd className="text-[9px] px-1 rounded bg-slate-100 dark:bg-white/10">⌘K</kbd>
                </div>
                <button
                    onClick={() => setAiOpen(true)}
                    title="Configure the Layer-13 AI Assistant (optional) — defaults to the built-in RZ engine"
                    className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-xs font-medium transition-transform hover:-translate-y-0.5 active:translate-y-0 hover:shadow-lg hover:shadow-violet-900/30"
                >
                    <Sparkles className="w-3.5 h-3.5" /> AI Assistant
                    {aiEnabled && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0f1424]" title="AI endpoint connected" />}
                </button>
            </div>
            <AiAssistantModal open={aiOpen} onClose={() => setAiOpen(false)} />
        </div>
    );
}

export default DashTopBar;
