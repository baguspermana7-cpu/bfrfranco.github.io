'use client';

import { useSimulationStore } from '@/store/simulation';
import { StaffingDashboard } from '@/components/modules/StaffingDashboard';
import { MaintenanceDashboard } from '@/components/modules/MaintenanceDashboard';
import { ReportDashboard } from '@/components/modules/ReportDashboard';
import { SimulationDashboard } from '@/components/modules/SimulationDashboard';
import CapexDashboard from '@/components/modules/CapexDashboard';
import RiskDashboard from '@/components/modules/RiskDashboard';
import CarbonDashboard from '@/components/modules/CarbonDashboard';
import FinancialDashboard from '@/components/modules/FinancialDashboard';
import { Wrench, ShieldAlert, FileText, Calculator, Activity } from 'lucide-react';

export default function Home() {
  const { activeTab } = useSimulationStore();

  const renderContent = () => {
    switch (activeTab) {
      case 'sim':
        return <SimulationDashboard />;
      case 'capex':
        return <CapexDashboard />;
      case 'staff':
        return <StaffingDashboard />;
      case 'maint':
        return <MaintenanceDashboard />;
      case 'risk':
        return <RiskDashboard />;
      case 'report':
        return <ReportDashboard />;
      case 'carbon':
        return <CarbonDashboard />;
      case 'finance':
        return <FinancialDashboard />;
      default: // 'sim'
        return (
          <div className="text-center space-y-4 max-w-2xl mx-auto pt-20">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-cyan-900/50 mb-8">
              <Calculator className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Data Center M&O Calculator
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Welcome to the ResistanceZero Pro Mode simulation engine.
              Select a module from the left to begin modeling operational costs.
            </p>
            <div className="mt-8">
              <p className="text-sm text-cyan-400 mb-2">Ready to Simulate?</p>
              <button
                onClick={() => useSimulationStore.getState().actions.setActiveTab('sim')}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold shadow-lg shadow-cyan-900/50 transition-all"
              >
                Launch Scenario Mode
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-[calc(100vh-100px)]">
      {renderContent()}
    </div>
  );
}
