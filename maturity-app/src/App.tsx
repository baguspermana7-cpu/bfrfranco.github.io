import { useRef, useState } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { InputPanel } from './components/Input/InputPanel';
import { MaturityRadar } from './components/Visuals/MaturityRadar';
import { WaterfallAnalysis } from './components/Visuals/WaterfallAnalysis';
import { SensitivityTornado } from './components/Visuals/SensitivityTornado';
import { NarrativeReport } from './components/Panels/NarrativeReport';
import { RiskCostPanel } from './components/Panels/RiskCostPanel';
import { PrintLayout } from './components/PDFExport/PrintLayout';
import { useMaturity } from './context/MaturityContext';
import { printReport } from './utils/pdfGenerator';
import { Download, Save } from 'lucide-react';

function Dashboard() {
  const { state, derived, actions } = useMaturity();
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await printReport(state, derived);
    } catch (error) {
      console.error("Export failed", error);
      alert("Export failed. See console.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-5 space-y-6">
          {/* Facility Metadata Input */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Assessment Metadata</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Facility Name"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                value={state.facilityMeta.name}
                onChange={(e) => actions.updateFacilityMeta('name', e.target.value)}
              />
              <input
                type="text"
                placeholder="Location"
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                value={state.facilityMeta.location}
                onChange={(e) => actions.updateFacilityMeta('location', e.target.value)}
              />
            </div>
          </div>

          <InputPanel />
        </div>

        {/* Right Column: Visuals & Report */}
        <div className="lg:col-span-7 space-y-6">
          {/* Action Bar */}
          <div className="flex justify-end gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors">
              <Save size={16} /> Save Draft
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-accent-blue hover:bg-blue-600 rounded-lg text-sm font-medium text-white transition-colors shadow-lg shadow-blue-900/20"
            >
              <Download size={16} />
              {isExporting ? 'Generating PDF...' : 'Export Report'}
            </button>
          </div>

          {/* Score Card */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/60 p-6 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <div className="text-4xl font-bold text-white mb-1">{Math.round(derived.compositeScore)}</div>
              <div className="text-sm text-accent-blue font-medium px-2 py-0.5 bg-blue-500/10 rounded-full">{derived.maturityLevel.label}</div>
              <div className="text-xs text-slate-500 mt-2">Composite Score</div>
            </div>
            <div className="bg-slate-800/60 p-6 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <div className="text-4xl font-bold text-white mb-1">{derived.gaps.length > 0 ? derived.gaps[0].dimension.label : 'None'}</div>
              <div className="text-sm text-amber-500 font-medium px-2 py-0.5 bg-amber-500/10 rounded-full">Top Priority</div>
              <div className="text-xs text-slate-500 mt-2">Improvement Focus</div>
            </div>
          </div>

          {/* Tabs / Visuals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MaturityRadar />
            <WaterfallAnalysis />
          </div>

          <SensitivityTornado />

          {/* Risk Panel */}
          <RiskCostPanel />

          {/* Narrative Report */}
          <NarrativeReport />
        </div>
      </div>

      {/* Hidden Print Layout */}
      <PrintLayout ref={printRef} />
    </>
  );
}

function App() {
  return (
    <MainLayout>
      <Dashboard />
    </MainLayout>
  );
}

export default App;
