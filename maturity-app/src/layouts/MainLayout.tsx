import React, { type ReactNode } from 'react';
import { Shield, TrendingUp, BarChart3, FileText, Settings, Menu } from 'lucide-react';

interface SidebarItemProps {
    icon: ReactNode;
    label: string;
    active?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active }) => (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${active ? 'bg-accent-blue/10 text-accent-blue border-r-2 border-accent-blue' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
        {icon}
        <span className="text-sm font-medium">{label}</span>
    </div>
);

export const MainLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <div className="min-h-screen bg-bg-dark text-slate-200 flex">
            {/* Sidebar - Desktop */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col fixed h-full z-10">
                <div className="p-6 border-b border-slate-800 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-accent-blue/20 flex items-center justify-center text-accent-blue">
                        <Shield size={20} />
                    </div>
                    <h1 className="font-bold text-lg tracking-tight">Ops<span className="text-accent-blue">Maturity</span></h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <SidebarItem icon={<BarChart3 size={18} />} label="Assessment" active />
                    <SidebarItem icon={<TrendingUp size={18} />} label="Projections" />
                    <SidebarItem icon={<FileText size={18} />} label="Report" />
                    <div className="pt-4 mt-4 border-t border-slate-800">
                        <SidebarItem icon={<Settings size={18} />} label="Configuration" />
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
                        <div className="font-semibold text-slate-300 mb-1">Maturity Calculator v2.0</div>
                        <div>Offline-first secure processing</div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 relative bg-bg-dark">
                {/* Header */}
                <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 bg-bg-dark/80 backdrop-blur z-20">
                    <div className="md:hidden">
                        <Menu size={24} className="text-slate-400" />
                    </div>
                    <div className="font-medium text-slate-300">Operational Maturity Assessment</div>
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-slate-500 hidden sm:block">Last saved: Just now</div>
                        <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                    </div>
                </header>

                <div className="p-6 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};
