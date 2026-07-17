'use client';

import React from 'react';
import { Search, Sparkles, ChevronDown } from 'lucide-react';

const TABS = ['Executive Overview', 'Engineering', 'Construction', 'Operations', 'Financial', 'Analytics', 'Reports'];

/** DC-OS dashboard top bar: project selector + view tabs + search + AI Assistant. */
export function DashTopBar({ project, activeTab, onTab }: { project: string; activeTab: string; onTab: (t: string) => void }) {
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
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-xs font-medium">
                    <Sparkles className="w-3.5 h-3.5" /> AI Assistant
                </button>
            </div>
        </div>
    );
}

export default DashTopBar;
