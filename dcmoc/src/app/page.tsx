'use client';

import { useSimulationStore } from '@/store/simulation';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { StaffingDashboard } from '@/components/modules/StaffingDashboard';
import { MaintenanceDashboard } from '@/components/modules/MaintenanceDashboard';
import { ReportDashboard } from '@/components/modules/ReportDashboard';
import { SimulationDashboard } from '@/components/modules/SimulationDashboard';
import CapexDashboard from '@/components/modules/CapexDashboard';
import RiskDashboard from '@/components/modules/RiskDashboard';
import CarbonDashboard from '@/components/modules/CarbonDashboard';
import FinancialDashboard from '@/components/modules/FinancialDashboard';
import InvestmentDashboard from '@/components/modules/InvestmentDashboard';
import BenchmarkDashboard from '@/components/modules/BenchmarkDashboard';
import MonteCarloDashboard from '@/components/modules/MonteCarloDashboard';
import PortfolioDashboard from '@/components/modules/PortfolioDashboard';
import { FaqDashboard } from '@/components/modules/FaqDashboard';
import CapacityDashboardMod from '@/components/modules/CapacityDashboard';
import PhasedFinancialDashboard from '@/components/modules/PhasedFinancialDashboard';
import TaxIncentiveDashboard from '@/components/modules/TaxIncentiveDashboard';
import DisasterRiskDashboard from '@/components/modules/DisasterRiskDashboard';
import GridReliabilityDashboard from '@/components/modules/GridReliabilityDashboard';
import TalentDashboard from '@/components/modules/TalentDashboard';
import ComplianceDashboard from '@/components/modules/ComplianceDashboard';
import AssetLifecycleDashboard from '@/components/modules/AssetLifecycleDashboard';
import CBMDashboard from '@/components/modules/CBMDashboard';
import FuelGenDashboard from '@/components/modules/FuelGenDashboard';
import { ScenarioComparisonPanel } from '@/components/modules/ScenarioComparisonPanel';
import StrategicPlanningDashboard from '@/components/modules/StrategicPlanningDashboard';
import { ExecutiveDashboard } from '@/components/modules/ExecutiveDashboard';
import { ReliabilityDashboard } from '@/components/modules/ReliabilityDashboard';
import { RequirementsDashboard, SiteIntelDashboard, ArchitectureDashboard, ConstructionDashboard, CommissioningDashboard, AssetIntelDashboard } from '@/components/modules/NewEngineDashboards';
import { TierDashboard, FireDashboard, CduDashboard, SparesDashboard } from '@/components/modules/DesignToolsDashboards';
import { useScenarioStore } from '@/store/scenario';
import { Wrench, ShieldAlert, FileText, Calculator, Activity } from 'lucide-react';

const STUB_LABELS: Record<string, string> = {
  projects: 'Projects', templates: 'Templates', 'data-library': 'Data Library',
  knowledge: 'Knowledge Base', integrations: 'Integrations', settings: 'Settings',
  audit: 'Audit Trail', users: 'User Management',
};
function ComingSoon({ tab }: { tab: string }) {
  const label = STUB_LABELS[tab] || tab;
  return (
    <div className="max-w-lg mx-auto pt-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-center mx-auto mb-5">
        <Activity className="w-6 h-6 text-cyan-500" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{label}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">This DC-OS surface is planned. Engine-backed modules are available in the sidebar — {label} is on the roadmap.</p>
    </div>
  );
}

export default function Home() {
  const { activeTab } = useSimulationStore();
  const { isComparisonMode } = useScenarioStore();

  if (isComparisonMode) {
    return <ScenarioComparisonPanel />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <ExecutiveDashboard />;
      case 'reliability':
        return <ReliabilityDashboard />;
      case 'requirements':
        return <RequirementsDashboard />;
      case 'site':
        return <SiteIntelDashboard />;
      case 'architecture':
        return <ArchitectureDashboard />;
      case 'construction':
        return <ConstructionDashboard />;
      case 'commissioning':
        return <CommissioningDashboard />;
      case 'asset-health':
        return <AssetIntelDashboard />;
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
      case 'invest':
        return <InvestmentDashboard />;
      case 'benchmark':
        return <BenchmarkDashboard />;
      case 'montecarlo':
        return <MonteCarloDashboard />;
      case 'portfolio':
        return <PortfolioDashboard />;
      case 'capacity':
        return <CapacityDashboardMod />;
      case 'phased-finance':
        return <PhasedFinancialDashboard />;
      case 'tax':
        return <TaxIncentiveDashboard />;
      case 'disaster':
        return <DisasterRiskDashboard />;
      case 'grid':
        return <GridReliabilityDashboard />;
      case 'talent':
        return <TalentDashboard />;
      case 'compliance':
        return <ComplianceDashboard />;
      case 'asset-lifecycle':
        return <AssetLifecycleDashboard />;
      case 'cbm':
        return <CBMDashboard />;
      case 'fuel-gen':
        return <FuelGenDashboard />;
      case 'faq':
        return <FaqDashboard />;
      case 'strategic':
        return <StrategicPlanningDashboard />;
      case 'tier':
        return <TierDashboard />;
      case 'fire':
        return <FireDashboard />;
      case 'cdu':
        return <CduDashboard />;
      case 'spares':
        return <SparesDashboard />;
      case 'projects':
      case 'templates':
      case 'data-library':
      case 'knowledge':
      case 'integrations':
      case 'settings':
      case 'audit':
      case 'users':
        return <ComingSoon tab={activeTab} />;
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
      <ErrorBoundary>
        {renderContent()}
      </ErrorBoundary>
    </div>
  );
}
