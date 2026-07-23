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
import { CommissioningDashboard, AssetIntelDashboard } from '@/components/modules/NewEngineDashboards';
import { ArchitecturePage } from '@/components/modules/architecture/ArchitecturePage';
import { CapacityPlanningPage } from '@/components/modules/capacity/CapacityPlanningPage';
import { CapexEnginePage } from '@/components/modules/capex/CapexEnginePage';
import { ConstructionEngine } from '@/components/modules/construction/ConstructionEngine';
import { OperationsDashboard } from '@/components/modules/operations/OperationsDashboard';
import { FinancialPage } from '@/components/modules/financial/FinancialPage';
import { ScenariosPage, ScenarioComparePage } from '@/components/modules/platform/ScenariosPage';
import { CommissioningEnginePage } from '@/components/modules/commissioning/CommissioningEnginePage';
import { AssetIntelligencePage } from '@/components/modules/assets/AssetIntelligencePage';
import { ReliabilityEnginePage } from '@/components/modules/reliability/ReliabilityEnginePage';
import { SustainabilityEnginePage } from '@/components/modules/sustainability/SustainabilityEnginePage';
import { EnergyAuditPage } from '@/components/modules/sustainability/EnergyAuditPage';
import { RenewableEconomicsPage } from '@/components/modules/sustainability/RenewableEconomicsPage';
import { ResultsEnginePage } from '@/components/modules/results/ResultsEnginePage';
import { ProjectsPage } from '@/components/modules/platform/ProjectsPage';
import { SettingsPage } from '@/components/modules/platform/SettingsPage';
import { RequirementsPage } from '@/components/modules/requirements/RequirementsPage';
import { SiteIntelligencePage } from '@/components/modules/site-intel/SiteIntelligencePage';
import { TierDashboard, FireDashboard, CduDashboard, SparesDashboard } from '@/components/modules/DesignToolsDashboards';
import { DataLibraryDashboard, TemplatesDashboard, ProjectsDashboard, KnowledgeDashboard, AuditDashboard, UsersDashboard } from '@/components/modules/PlatformDashboards';
import { DiagnosticsCenter } from '@/components/modules/DiagnosticsCenter';
import { useScenarioStore } from '@/store/scenario';
import { Calculator } from 'lucide-react';

export default function Home() {
  const { activeTab } = useSimulationStore();
  const { isComparisonMode } = useScenarioStore();

  if (isComparisonMode) {
    return <ScenarioComparisonPanel />;
  }

  const renderContent = () => {
    /* Workstream J: 'energy-audit' / 'renewable-economics' are registered in the
     * Shell nav ahead of the store's activeTab union (owned by a parallel
     * workstream) — widen to string so their cases type-check. */
    switch (activeTab as string) {
      case 'dashboard':
        return <ExecutiveDashboard />;
      case 'reliability':
        return <ReliabilityEnginePage />;
      case 'requirements':
        return <RequirementsPage />;
      case 'site':
        return <SiteIntelligencePage />;
      case 'architecture':
        return <ArchitecturePage />;
      case 'construction':
        return <ConstructionEngine />;
      case 'commissioning':
        return <CommissioningEnginePage />;
      case 'asset-health':
        return <AssetIntelligencePage />;
      case 'ops':
        return <OperationsDashboard />;
      case 'sim':
        return <SimulationDashboard />;
      case 'capex':
        return <CapexEnginePage />;
      case 'staff':
        return <StaffingDashboard />;
      case 'maint':
        return <MaintenanceDashboard />;
      case 'risk':
        return <RiskDashboard />;
      case 'report':
        return <ResultsEnginePage />;
      case 'carbon':
        return <SustainabilityEnginePage />;
      case 'energy-audit':
        return <EnergyAuditPage />;
      case 'renewable-economics':
        return <RenewableEconomicsPage />;
      case 'finance':
        return <FinancialPage />;
      case 'invest':
        return <InvestmentDashboard />;
      case 'benchmark':
        return <BenchmarkDashboard />;
      case 'montecarlo':
        /* AC1: folded into Financial as a sub-tab — deep links land there */
        return <FinancialPage initialTab="montecarlo" />;
      case 'portfolio':
        return <PortfolioDashboard />;
      case 'capacity':
        return <CapacityPlanningPage />;
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
      case 'scenarios':
        return <ScenariosPage />;
      case 'scenario-compare':
        return <ScenarioComparePage />;
      case 'projects':
        return <ProjectsPage />;
      case 'templates':
        return <TemplatesDashboard />;
      case 'data-library':
        return <DataLibraryDashboard />;
      case 'knowledge':
        return <KnowledgeDashboard />;
      case 'integrations':
        /* AD2: single integrations surface — the rebuilt Settings integrations tab */
        return <SettingsPage key="integrations" initialTab="integrations" />;
      case 'settings':
        return <SettingsPage key="settings" />;
      case 'audit':
        return <AuditDashboard />;
      case 'users':
        return <UsersDashboard />;
      case 'diagnostics':
        return <DiagnosticsCenter />;
      default: // 'sim'
        return (
          <div className="text-center space-y-4 max-w-2xl mx-auto pt-20">
            <div className="w-20 h-20 bg-rz-info/10 border border-rz-info/30 rounded flex items-center justify-center mx-auto mb-8">
              <Calculator className="w-10 h-10 text-rz-info" />
            </div>
            <h1 className="text-4xl font-bold text-white">
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
