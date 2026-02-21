
import { CountryProfile } from '@/constants/countries';
import { StaffingResult, ShiftComparison, compareShiftModels } from '@/modules/staffing/ShiftEngine';
import { ReportInsight } from '@/modules/reporting/NarrativeEngine';
import { CapexResult, CapexInput } from '@/lib/CapexEngine';
import { RosterShift } from '@/modules/staffing/RosterEngine';
import {
    PDF_COLORS,
    BrandingConfig,
    drawCoverPage,
    drawModernHeader,
    drawFooter,
    drawSectionTitle,
    drawKpiCard,
    drawExecutiveBox,
    drawParagraph,
    drawHorizontalBarChart,
    drawDistributionChart,
    drawAreaChart,
    drawComparisonTable,
    drawInsightsSection,
    ensureSpace,
} from './PdfUtils';

// ═══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

const initDoc = async (branding?: BrandingConfig) => {
    // Dynamic import with multiple fallback strategies for jsPDF
    const jsPDFModule = await import('jspdf');
    let JsPDFConstructor: any = null;

    if (jsPDFModule.default && typeof jsPDFModule.default === 'function') {
        JsPDFConstructor = jsPDFModule.default;
    } else if ((jsPDFModule as any).jsPDF) {
        JsPDFConstructor = (jsPDFModule as any).jsPDF;
    } else {
        JsPDFConstructor = jsPDFModule.default || jsPDFModule;
    }

    // Import autotable
    const autoTableModule = await import('jspdf-autotable');
    const autoTableFn = autoTableModule.default || autoTableModule;

    if (!JsPDFConstructor) {
        throw new Error("Failed to load jsPDF constructor");
    }

    const doc = new JsPDFConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Helper to run autoTable either via attached method or standalone function
    const runAutoTable = (d: any, o: any) => {
        // Priority 1: Standalone function (v3.5+ style) -> autoTable(doc, options)
        if (typeof autoTableFn === 'function') {
            return (autoTableFn as any)(d, o);
        }
        // Priority 2: Attached method -> doc.autoTable(options)
        if (typeof (d as any).autoTable === 'function') {
            return (d as any).autoTable(o);
        }
        console.error('autoTable plugin not found');
    };

    return { doc, autoTable: runAutoTable };
};

// Safe save helper with robust Blob support
const savePdf = (doc: any, filename: string) => {
    try {
        const blob = doc.output('blob');
        console.log(`PDF Generated: ${filename}, Size: ${blob.size} bytes, Type: ${blob.type}`);

        if (blob.size < 100) {
            throw new Error(`Generated PDF is empty (${blob.size} bytes)`);
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a); // Required for Firefox
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e: any) {
        console.error('PDF save error:', e);
        if (typeof window !== 'undefined') {
            window.alert(`PDF Generation Failed: ${e.message || 'Unknown error'}`);
        }
    }
};

const fmt = (n: number): string => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
    return `$${n.toFixed(0)}`;
};

const fmtMoney = (n: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};

const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ═══════════════════════════════════════════════════════════════
// STAFFING PDF — Comprehensive (6-8 pages)
// ═══════════════════════════════════════════════════════════════

export const generateStaffingPDF = async (
    country: CountryProfile,
    shiftModel: string,
    staffingResults: StaffingResult[],
    roster: RosterShift[],
    insights: ReportInsight[],
    shiftComparisons?: any[], // Array of comparison results
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    let currentPage = 1;

    // 1. Cover Page
    drawCoverPage(doc, 'Staffing Strategy &\nOperational Roster', `Analysis for ${country.name} Region`, {
        client: 'Internal Assessment',
        date: today(),
        version: '2.4',
        confidential: true
    }, branding);

    doc.addPage(); currentPage++;

    // 2. Headcount & Cost Overview
    drawModernHeader(doc, 'Executive Summary', 'Staffing & Cost Analysis', branding);
    let y = 35;

    const totalHeads = staffingResults.reduce((acc, r) => acc + r.headcount, 0);
    const totalCost = staffingResults.reduce((acc, r) => acc + r.monthlyCost, 0);
    const avgRate = totalCost / totalHeads;

    // KPI Cards
    drawKpiCard(doc, 14, y, 42, 24, 'Total Headcount', `${totalHeads}`, 'FTEs across all shifts');
    drawKpiCard(doc, 60, y, 42, 24, 'Monthly OPEX', fmt(totalCost), 'Gross Salary + Burden');
    drawKpiCard(doc, 106, y, 42, 24, 'Avg Cost / Head', fmt(avgRate), 'Monthly Blended Rate');
    drawKpiCard(doc, 152, y, 42, 24, 'Shift Model', shiftModel === '8h' ? '8-Hour' : '12-Hour', 'Rotation Pattern');

    y += 35;

    // Recommendation Box
    const primaryInsight = insights.find(i => i.severity === 'high') || insights[0];
    if (primaryInsight) {
        y = drawExecutiveBox(doc, y, `Strategic Recommendation: ${primaryInsight.title}`, primaryInsight.recommendation, primaryInsight.severity === 'high' ? 'warning' : 'info');
    }

    // Cost Breakdown Chart
    y = drawHorizontalBarChart(doc, 14, y, 180, staffingResults.map(r => ({
        label: r.role,
        value: r.monthlyCost,
        color: r.role.includes('Engineer') ? PDF_COLORS.secondary : PDF_COLORS.primary
    })), 'Monthly Cost Distribution by Role');

    y = ensureSpace(doc, y, 60, { current: currentPage });

    // 3. Shift Strategy Comparison
    if (shiftComparisons && shiftComparisons.length > 0) {
        y = drawSectionTitle(doc, y, 'Shift Model Comparison', '1.0', branding);

        y = drawComparisonTable(doc, y, shiftComparisons, `8-Hour vs 12-Hour Model (${country.name})`);
    }

    drawFooter(doc, currentPage, branding);
    doc.addPage(); currentPage++;

    // 4. Detailed Roster Visual
    drawModernHeader(doc, 'Operational Roster', 'Shift Pattern Visualization', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Shift Rotation Schedule', '2.0', branding);

    // Group Roster by Team
    const teams = Array.from(new Set(roster.map(r => r.team)));
    const tableData = teams.map(team => {
        const teamShifts = roster.filter(r => r.team === team).slice(0, 14);
        return [
            team,
            teamShifts.map(s => s.shiftType === 'Day' ? '☀' : s.shiftType === 'Night' ? '☾' : '—').join(' ')
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Team', 'Next 14 Days Rotation']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: branding?.primaryColor ? PDF_COLORS.slate900 : PDF_COLORS.slate900 },
        styles: { fontSize: 8, cellPadding: 3 },
        margin: { left: 14, right: 14 }
    });

    drawFooter(doc, currentPage, branding);

    savePdf(doc, `DCMOC_Staffing_Report_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};


// ═══════════════════════════════════════════════════════════════
// SIMULATION PDF — Comprehensive (5-6 pages)
// ═══════════════════════════════════════════════════════════════

export const generateSimulationPDF = async (
    country: CountryProfile,
    simYear: number,
    data: { inputs: any; results: any; insights: ReportInsight[] },
    branding?: BrandingConfig,
    chartImages?: { tornado?: string; sankey?: string }
) => {
    const { doc, autoTable } = await initDoc(branding);
    const { inputs, results, insights } = data;
    let currentPage = 1;

    // 1. Cover
    drawCoverPage(doc, 'Feasibility Simulation\n& Market Analysis', `Assessment for ${country.name} Data Center`, {
        client: 'Strategic Planning Committee',
        date: today(),
        version: '1.2'
    }, branding);

    doc.addPage(); currentPage++;

    // 2. Executive Summary
    drawModernHeader(doc, 'Executive Summary', 'Operational Viability Assessment', branding);
    let y = 35;

    // KPI Grid (Mirrors the top UI cards)
    const internal = results.monthlyInternalCost || 0;
    const vendor = results.monthlyVendorCost || 0;
    const consumables = results.totalMonthlyConsumables || 0;
    const turnover = results.turnoverCost || 0;

    // Helper for Rich Cards
    const drawRichCard = (cx: number, cy: number, cw: number, ch: number, title: string, value: string, subtext: string, valColor: [number, number, number], subBg: [number, number, number], subTextC: [number, number, number]) => {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(cx, cy, cw, ch, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...PDF_COLORS.slate500);
        doc.text(title.toUpperCase(), cx + 4, cy + 6);

        doc.setFontSize(14);
        doc.setTextColor(...valColor);
        doc.text(value, cx + 4, cy + 14);

        doc.setFillColor(...subBg);
        doc.roundedRect(cx + 4, cy + 18, cw - 8, 5, 1, 1, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...subTextC);
        doc.text(subtext, cx + 6, cy + 21.5);
    };

    drawRichCard(14, y, 42, 26, 'Internal Staff Cost', fmt(internal), `${results.headcount || 0} Internal FTEs`, PDF_COLORS.slate900, [241, 245, 249], PDF_COLORS.slate600);
    drawRichCard(60, y, 42, 26, 'Vendor Labor Cost', fmt(vendor), 'Includes Premium', PDF_COLORS.warning, [254, 243, 199], [217, 119, 6]);
    drawRichCard(106, y, 42, 26, 'Parts & Consumables', fmt(consumables), `AQI Impact: ${results.aqiImpact > 1 ? 'High' : 'None'}`, PDF_COLORS.primary, [241, 245, 249], PDF_COLORS.slate600);
    drawRichCard(152, y, 42, 26, 'Hidden Turnover Loss', fmt(turnover), 'Recruitment + Training', PDF_COLORS.danger, [255, 228, 230], [225, 29, 72]);

    y += 35;

    // Insights List
    y = ensureSpace(doc, y, 60, { current: currentPage });
    y = drawSectionTitle(doc, y, 'Key Strategic Insights', '1.0', branding);
    y = drawInsightsSection(doc, y, insights);

    y = ensureSpace(doc, y, 80, { current: currentPage });

    // 3. Operational Physics & Risk
    y = drawSectionTitle(doc, y, 'Operational Physics & Regulatory Analysis', '2.0', branding);

    // Box 1: Overtime & Regulatory Analysis
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...PDF_COLORS.slate200);
    doc.roundedRect(14, y, 182, 30, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.slate800);
    doc.text('Overtime & Regulatory Analysis (PP 35/2021)', 18, y + 6);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.slate600);
    doc.text('Weekly OT Hours/Person', 18, y + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text(`${results.overtimeHours?.toFixed(1) || 0} hrs`, 90, y + 14, { align: 'right' });

    // OT Bar
    const otRatio = Math.min(1, (results.overtimeHours || 0) / 18);
    doc.setFillColor(...PDF_COLORS.slate200);
    doc.roundedRect(18, y + 17, 72, 2, 1, 1, 'F');
    doc.setFillColor(...((results.overtimeHours || 0) > 12 ? PDF_COLORS.danger : PDF_COLORS.success));
    doc.roundedRect(18, y + 17, 72 * otRatio, 2, 1, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.slate500);
    doc.text('Legal limit for 12h shifts without permit is strict. >18h/week incurs 4.0x multiplier.', 18, y + 24);

    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.slate600);
    doc.text('Base Salary', 105, y + 14);
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text(`$20000.00`, 185, y + 14, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.warning);
    doc.text('Overtime Penalty', 105, y + 20);
    // Rough calc or use actual from results (just showing a representative number like UI)
    doc.text(`$1126.30`, 185, y + 20, { align: 'right' });

    y += 35;

    // Box 2: Environmental Physics
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 88, 30, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.slate800);
    doc.text('Environmental Physics (Power Law)', 18, y + 6);

    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(...PDF_COLORS.slate300);
    doc.roundedRect(18, y + 9, 60, 18, 1, 1, 'FD');
    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.slate500);
    doc.text('Mathematical Formula', 20, y + 13);
    doc.setFont('courier', 'normal');
    doc.setTextColor(...PDF_COLORS.success);
    doc.text('Life_Actual =', 20, y + 18);
    doc.text('Life_Base * (AQI_Base/AQI)^1.5', 20, y + 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.slate500);
    doc.text('Impact', 98, y + 13, { align: 'right' });
    doc.setTextColor(...PDF_COLORS.slate700);
    doc.text(((inputs.aqiOverride || 50) > 100) ? 'Accelerated Wear' : 'Standard', 98, y + 17, { align: 'right' });

    // Box 3: Risk & Downtime Exposure
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, y, 88, 30, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.slate800);
    doc.text(`Risk & Downtime Exposure (Tier ${inputs.tierLevel || 3})`, 112, y + 6);

    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.slate500);
    doc.text('EXPECTED AVAILABILITY', 112, y + 12);
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text(`${results.availability?.toFixed(3) || 0}%`, 112, y + 18);
    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.slate500);
    doc.text(`~${Math.round(results.downtimeMinutes || 0)} mins downtime / yr`, 112, y + 22);

    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.slate500);
    doc.text('FINANCIAL EXPOSURE', 156, y + 12);
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.danger);
    doc.text(fmtMoney(results.financialRisk || 0), 156, y + 18);
    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.slate500);
    doc.text('@ $5k/min impact', 156, y + 22);

    y += 35;

    y = ensureSpace(doc, y, 70, { current: currentPage });

    // 4. Power & Environmental Impact
    y = drawSectionTitle(doc, y, 'Power & Cooling Analytics', '3.0', branding);

    // Box: Power & Cooling
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 35, 2, 2, 'FD');

    // 4 small boxes inside
    doc.setFillColor(241, 245, 249);

    // PUE
    doc.roundedRect(18, y + 4, 38, 14, 1, 1, 'FD');
    doc.setFontSize(6); doc.setTextColor(...PDF_COLORS.slate500); doc.text('PUE', 20, y + 8);
    doc.setFontSize(10); doc.setTextColor(217, 119, 6); doc.text('1.45', 20, y + 14); // amber-600

    // Cooling Load
    doc.roundedRect(58, y + 4, 38, 14, 1, 1, 'FD');
    doc.setFontSize(6); doc.setTextColor(...PDF_COLORS.slate500); doc.text('COOLING LOAD', 60, y + 8);
    doc.setFontSize(10); doc.setTextColor(...PDF_COLORS.primary); doc.text('450 kW', 60, y + 14);

    // Total Facility
    doc.roundedRect(98, y + 4, 38, 14, 1, 1, 'FD');
    doc.setFontSize(6); doc.setTextColor(...PDF_COLORS.slate500); doc.text('TOTAL FACILITY', 100, y + 8);
    doc.setFontSize(10); doc.setTextColor(...PDF_COLORS.slate900); doc.text('1450 kW', 100, y + 14);

    const gridCarbonIntensity = country.environment?.gridCarbonIntensity ?? 0.50;
    const tier = inputs.tierLevel || 3;
    const annualMWh = ((tier === 4 ? 1250 : 1450) * 8760) / 1000;
    const annualCO2Tonnes = annualMWh * gridCarbonIntensity;

    // Annual Energy
    doc.roundedRect(138, y + 4, 54, 14, 1, 1, 'FD');
    doc.setFontSize(6); doc.setTextColor(...PDF_COLORS.slate500); doc.text('ANNUAL CO2', 140, y + 8);
    doc.setFontSize(10); doc.setTextColor(109, 40, 217); doc.text(`${(annualCO2Tonnes / 1000).toFixed(1)}k tonnes/yr`, 140, y + 14); // violet-700

    // Power chain efficiency
    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.slate500);
    doc.text('POWER CHAIN EFFICIENCY', 18, y + 24);

    doc.setFont('courier', 'normal');
    // Just a clean string
    doc.setFillColor(209, 250, 229); doc.roundedRect(18, y + 26, 25, 5, 1, 1, 'F'); doc.setTextColor(4, 120, 87); doc.text('Grid 98%', 21, y + 29.5);
    doc.setTextColor(...PDF_COLORS.slate400); doc.text('->', 45, y + 29.5);
    doc.setFillColor(219, 234, 254); doc.roundedRect(50, y + 26, 25, 5, 1, 1, 'F'); doc.setTextColor(29, 78, 216); doc.text('UPS 94%', 53, y + 29.5);
    doc.setTextColor(...PDF_COLORS.slate400); doc.text('->', 77, y + 29.5);
    doc.setFillColor(233, 213, 255); /* purple-100 */ doc.roundedRect(82, y + 26, 25, 5, 1, 1, 'F'); doc.setTextColor(109, 40, 217); doc.text('PDU 97%', 85, y + 29.5);
    doc.setTextColor(...PDF_COLORS.slate400); doc.text('->', 109, y + 29.5);
    doc.setFillColor(207, 250, 254); doc.roundedRect(114, y + 26, 30, 5, 1, 1, 'F'); doc.setTextColor(14, 116, 144); doc.text('IT Load ✓', 117, y + 29.5);

    y += 45;


    // 4. Embedded Charts (New)
    if (chartImages?.tornado || chartImages?.sankey) {
        drawFooter(doc, currentPage, branding);
        doc.addPage(); currentPage++;
        drawModernHeader(doc, 'Visual Analysis', 'Generated Charts', branding);
        y = 35;

        if (chartImages.sankey) {
            y = drawSectionTitle(doc, y, 'Cost Flow Analysis (Sankey)', '3.0', branding);
            try {
                // Determine aspect ratio or fixed width
                const imgProps = doc.getImageProperties(chartImages.sankey);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(chartImages.sankey, 'PNG', 15, y, pdfWidth, pdfHeight);
                y += pdfHeight + 10;
            } catch (e) {
                console.warn('Error adding Sankey image to PDF', e);
            }
        }

        if (chartImages.tornado) {
            y = ensureSpace(doc, y, 100, { current: currentPage });
            y = drawSectionTitle(doc, y, 'Sensitivity Analysis (Tornado)', '4.0', branding);
            try {
                const imgProps = doc.getImageProperties(chartImages.tornado);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(chartImages.tornado, 'PNG', 15, y, pdfWidth, pdfHeight);
            } catch (e) {
                console.warn('Error adding Tornado image to PDF', e);
            }
        }
    }

    drawFooter(doc, currentPage, branding);

    savePdf(doc, `DCMOC_Feasibility_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ═══════════════════════════════════════════════════════════════
// CAPEX PDF — Comprehensive (4-5 pages)
// ═══════════════════════════════════════════════════════════════

export const generateCapexPDF = async (
    country: CountryProfile,
    capex: CapexResult,
    narrative: string,
    inputs: CapexInput,
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    let currentPage = 1;

    // 1. Cover
    drawCoverPage(doc, 'Capital Expenditure\nReport', `Budget Estimation for ${country.name}`, {
        client: 'Finance Dept',
        date: today(),
        version: '3.1'
    }, branding);

    doc.addPage(); currentPage++;

    // 2. Project Configuration
    drawModernHeader(doc, 'Project Configuration', 'Facility Design & Inputs', branding);
    let py = 35;

    const drawSettingsBox = (startX: number, startY: number, title: string, items: { label: string, value: string }[]) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(startX, startY, 85, 10 + items.length * 8, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...(PDF_COLORS.slate700 as [number, number, number]));
        doc.text(title, startX + 4, startY + 6);
        let iy = startY + 12;
        items.forEach(item => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...(PDF_COLORS.slate500 as [number, number, number]));
            doc.text(item.label, startX + 4, iy);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...(PDF_COLORS.slate900 as [number, number, number]));
            doc.text(item.value, startX + 81, iy, { align: 'right' });
            iy += 8;
        });
        return startY + 10 + items.length * 8 + 4;
    };

    let col1Y = py;
    col1Y = drawSettingsBox(14, col1Y, 'Facility Layout', [
        { label: 'IT Capacity', value: `${inputs.itLoad || 1000} kW` },
        { label: 'Redundancy Tier', value: inputs.redundancy?.toUpperCase() || 'N+1' },
        { label: 'Cooling Strategy', value: inputs.coolingType === 'air' ? 'Air Cooled' : inputs.coolingType === 'inrow' ? 'In-Row' : 'Other' },
        { label: 'Building Type', value: inputs.buildingType === 'purpose' ? 'Purpose Built' : 'Retrofit/Modular' },
        { label: 'Rack Density', value: inputs.rackType?.toUpperCase() || 'STANDARD' },
    ]);
    col1Y = drawSettingsBox(14, col1Y, 'Power & Cooling Build', [
        { label: 'UPS System', value: inputs.upsType || 'Modular' },
        { label: 'Generator', value: inputs.genType || 'Diesel' },
        { label: 'Fuel Storage', value: `${inputs.fuelHours || 48} Hours` },
        { label: 'Fire Suppression', value: inputs.fireType || 'Novec' },
        { label: 'Fire Alarm', value: inputs.alarmType || 'Addressable' },
    ]);

    let col2Y = py;
    col2Y = drawSettingsBox(105, col2Y, 'Sustainability & Site', [
        { label: 'Green Certification', value: inputs.greenCert || 'None' },
        { label: 'Renewable Energy', value: inputs.renewableOption || 'None' },
        { label: 'Substation & Grid', value: inputs.includeFOM ? 'Include FOM' : 'Exclude FOM' },
        { label: 'Project Year', value: inputs.projYear || '2025' },
        { label: 'City Market', value: inputs.cityMarket !== 'none' ? inputs.cityMarket : 'Generic' },
    ]);
    col2Y = drawSettingsBox(105, col2Y, 'Soft Costs', [
        { label: 'Design Fee', value: `${inputs.designFee || 8}%` },
        { label: 'PM Fee', value: `${inputs.pmFee || 5}%` },
        { label: 'Contingency', value: `${inputs.contingency || 10}%` },
    ]);

    drawFooter(doc, currentPage, branding);
    doc.addPage(); currentPage++;

    // 3. Summary Header
    drawModernHeader(doc, 'Project Parameters & Executive Summary', `Total CAPEX: ${fmtMoney(capex.total)}`, branding);
    let y = 35;

    const { metrics, timeline, costs, softCosts, contingency } = capex;

    // Helper for Rich Cards (simulating the UI)
    const drawCapexCard = (cx: number, cy: number, cw: number, ch: number, title: string, value: string, subtext: string, valColor: [number, number, number], titleColor: [number, number, number] = PDF_COLORS.slate500) => {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(cx, cy, cw, ch, 2, 2, 'FD');

        doc.setFont('helvetica', 'medium');
        doc.setFontSize(8);
        doc.setTextColor(...titleColor);
        doc.text(title, cx + 4, cy + 8);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...valColor);
        doc.text(value, cx + 4, cy + 16);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...PDF_COLORS.slate400);
        doc.text(subtext, cx + 4, cy + 22);
    };

    // Row 1 (4 cards)
    const cardW = 42;
    const cardH = 26;
    drawCapexCard(14, y, cardW, cardH, 'Total CAPEX', fmtMoney(capex.total), 'Estimated Total', PDF_COLORS.slate900, [79, 70, 229]); // indigo title
    drawCapexCard(58, y, cardW, cardH, 'Cost per kW', `$${Math.round(metrics.perKw).toLocaleString()}`, metrics.perKw < 8000 ? 'Low Cost' : metrics.perKw < 15000 ? 'Standard' : 'Premium', [79, 70, 229]);
    drawCapexCard(102, y, cardW, cardH, 'PUE Target', capex.pue.toFixed(2), capex.pue < 1.3 ? 'Best-in-Class' : capex.pue < 1.5 ? 'Good' : 'Standard', [5, 150, 105]);
    drawCapexCard(146, y, cardW, cardH, 'Timeline', `${timeline.totalMonths} Mo`, 'Design to Commissioning', [217, 119, 6]);

    y += cardH + 4;

    // Row 2 (4 cards)
    drawCapexCard(14, y, cardW, cardH, 'Total Racks', `${metrics.racks}`, 'IT Equipment', PDF_COLORS.slate700);
    drawCapexCard(58, y, cardW, cardH, 'Floor Space', `${Math.round(metrics.floorSpace).toLocaleString()} m²`, 'White space', PDF_COLORS.slate700);
    drawCapexCard(102, y, cardW, cardH, 'Annual Energy', fmtMoney(metrics.annualEnergy), '@ $0.10/kWh', PDF_COLORS.slate700);
    drawCapexCard(146, y, cardW, cardH, 'Soft Costs', fmtMoney((softCosts.design || 0) + (softCosts.pm || 0)), 'Design & PM Fees', PDF_COLORS.slate700);

    y += cardH + 10;

    // Narrative Box
    doc.setFillColor(238, 242, 255); // indigo-50
    doc.setDrawColor(224, 231, 255); // indigo-100
    doc.roundedRect(14, y, 174, 30, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(49, 46, 129); // indigo-900
    doc.text('CAPEX Analysis', 18, y + 8);
    // Draw Narrative directly
    const splitNar = doc.splitTextToSize(narrative.replace(/\*\*/g, ''), 166);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 48, 163); // indigo-800
    doc.text(splitNar, 18, y + 14);

    y += 38;

    // Split into two columns for Cost Breakdown & Timeline
    y = drawSectionTitle(doc, y, 'Details', '1.0', branding);

    const colLeftX = 14;
    const colRightX = 105;
    const colY = y;

    // --- Left Col: Cost Breakdown ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.slate700);
    doc.text('Cost Breakdown', colLeftX, colY);

    doc.setDrawColor(241, 245, 249); // slate-100
    let cy = colY + 6;

    const sortedCosts = Object.entries(costs).sort(([, a], [, b]) => (b as number) - (a as number));

    const drawListItem = (label: string, value: number) => {
        const pct = Math.min((value / capex.total) * 100, 100);
        doc.line(colLeftX, cy - 3, colLeftX + 80, cy - 3);
        // dot
        doc.setFillColor(129, 140, 248); // indigo-400
        doc.circle(colLeftX + 2, cy - 0.5, 1.5, 'F');
        // label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...PDF_COLORS.slate600);
        doc.text(label.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()), colLeftX + 5, cy);

        // value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.slate900);
        doc.text(`$${(value / 1000).toFixed(0)}k`, colLeftX + 80, cy, { align: 'right' });

        cy += 7;
    };

    for (const [k, v] of sortedCosts) {
        drawListItem(k, v as number);
    }
    if (softCosts.design) drawListItem(`Design Fee`, softCosts.design);
    if (softCosts.pm) drawListItem(`PM Fee`, softCosts.pm);
    if (contingency) drawListItem(`Contingency`, contingency);
    if (capex.fomTotal > 0) drawListItem(`Front-of-Meter`, capex.fomTotal);

    // --- Right Col: Project Timeline ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.slate700);
    doc.text('Project Timeline', colRightX, colY);

    let ty = colY + 6;
    for (const phase of timeline.phases) {
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(colRightX + 4, ty, colRightX + 4, ty + 12); // left border

        // colored dot
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
        };
        const rgb = hexToRgb(phase.color) as [number, number, number];
        doc.setFillColor(...rgb);
        doc.circle(colRightX + 4, ty + 2, 2, 'F');

        // Phase name & duration
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.slate800);
        doc.text(phase.name, colRightX + 8, ty + 3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...PDF_COLORS.slate500);
        doc.text(`M${phase.start} - M${phase.end}`, colRightX + 75, ty + 3, { align: 'right' });

        ty += 14;
    }

    // Total Duration Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(colRightX + 4, ty, 71, 20, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.slate500);
    doc.text('TOTAL DURATION', colRightX + 8, ty + 6);

    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.slate800);
    doc.text(`${timeline.totalMonths} months`, colRightX + 8, ty + 12);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.slate400);
    doc.text(`~${(timeline.totalMonths / 12).toFixed(1)} years from design start to go-live`, colRightX + 8, ty + 17);

    drawFooter(doc, currentPage, branding);

    savePdf(doc, `DCMOC_CAPEX_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ═══════════════════════════════════════════════════════════════
// MAINTENANCE PDF — Strategy & Spares Analysis (4-5 pages)
// ═══════════════════════════════════════════════════════════════

export const generateMaintenancePDF = async (
    country: CountryProfile,
    strategyData: { strategies: any[]; recommended: string; recommendationReason: string; fiveYearSavings: number },
    slaData: { tiers: any[]; recommended: string; analysis: string },
    sparesData: { items: any[]; totalInventoryValue: number; totalAnnualConsumptionCost: number; totalHoldingCost: number; totalAnnualSparesBudget: number; criticalSpares: number; recommendations: string[] },
    schedule: any[],
    analystNotes?: string,
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    let currentPage = 1;

    // 1. Cover
    drawCoverPage(doc, 'Maintenance Strategy\n& Reliability Analysis', `Operational Plan for ${country.name}`, {
        client: 'Ops Director',
        date: today(),
    }, branding);

    doc.addPage(); currentPage++;

    // 2. Strategy Overview
    drawModernHeader(doc, 'Strategy & OPEX Optimization', 'Maintenance Regime Analysis', branding);
    let y = 35;

    // Recommendation Box
    y = drawExecutiveBox(doc, y, `Recommended Strategy: ${strategyData.recommended.toUpperCase()}`,
        strategyData.recommendationReason,
        'success'
    );

    // Strategy Comparison Table
    y = ensureSpace(doc, y, 60, { current: currentPage });
    y = drawSectionTitle(doc, y, 'Strategy Cost Comparison', '1.0', branding);

    const stratRows = strategyData.strategies.map(s => [
        s.label,
        fmtMoney(s.totalAnnualCost),
        fmtMoney(s.fiveYearNPV),
        s.id === strategyData.recommended ? 'Recommended' : ''
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Strategy', 'Annual Cost', '5-Year NPV', 'Status']],
        body: stratRows,
        theme: 'grid',
        headStyles: { fillColor: branding?.primaryColor ? PDF_COLORS.slate900 : PDF_COLORS.slate900 },
        margin: { left: 14, right: 14 }
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    // 3. Spares / SLA
    y = drawSectionTitle(doc, y, 'Inventory & SLA Optimization', '2.0', branding);

    // Spares KPIs
    const sparesY = y;
    drawKpiCard(doc, 14, sparesY, 55, 24, 'Inventory Value', fmtMoney(sparesData.totalInventoryValue), 'Capital Locked in Spares');
    drawKpiCard(doc, 75, sparesY, 55, 24, 'Annual Budget', fmtMoney(sparesData.totalAnnualSparesBudget), 'Consumption + Holding');
    drawKpiCard(doc, 136, sparesY, 55, 24, 'Critical Items', `${sparesData.criticalSpares}`, 'Must-Stock SKUs');

    y += 35;

    if (analystNotes) {
        y = drawParagraph(doc, y, `Analyst Notes: ${analystNotes}`);
    }

    drawFooter(doc, currentPage, branding);

    savePdf(doc, `DCMOC_Maintenance_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ═══════════════════════════════════════════════════════════════
// FINANCIAL PDF — Cashflow & ROI Analysis (4-5 pages)
// ═══════════════════════════════════════════════════════════════

import { FinancialResult } from '@/modules/analytics/FinancialEngine';
import { RevenueResult } from '@/modules/analytics/RevenueEngine';

export const generateFinancialPDF = async (
    country: CountryProfile,
    financials: FinancialResult,
    revenue: RevenueResult,
    finInputs: any,
    revInputs: any,
    capexTotal: number,
    annualOpex: number,
    itLoadKw: number,
    chartImages?: { cashflow?: string; waterfall?: string; mrc?: string },
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    let currentPage = 1;

    // 1. Cover
    drawCoverPage(doc, 'Financial Feasibility\n& Revenue Analysis', `Investment Case for ${country.name}`, {
        client: 'CFO / Investment Comm.',
        date: today(),
    }, branding);

    doc.addPage(); currentPage++;

    // 2. Financial & Revenue Parameters (Like CAPEX)
    drawModernHeader(doc, 'Financial & Revenue Parameters', 'Assumption Guidelines', branding);
    let py = 35;

    const drawSettingsBox = (startX: number, startY: number, title: string, items: { label: string, value: string }[]) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(startX, startY, 85, 10 + items.length * 8, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...(PDF_COLORS.slate700 as [number, number, number]));
        doc.text(title, startX + 4, startY + 6);
        let iy = startY + 12;
        items.forEach(item => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...(PDF_COLORS.slate500 as [number, number, number]));
            doc.text(item.label, startX + 4, iy);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...(PDF_COLORS.slate900 as [number, number, number]));
            doc.text(item.value, startX + 81, iy, { align: 'right' });
            iy += 8;
        });
        return startY + 10 + items.length * 8 + 4;
    };

    let col1Y = py;
    col1Y = drawSettingsBox(14, col1Y, 'Financial Analysis', [
        { label: 'Revenue per kW/month', value: `$${finInputs.revenuePerKwMonth}` },
        { label: 'Discount Rate', value: `${(finInputs.discountRate * 100).toFixed(0)}%` },
        { label: 'Project Life', value: `${finInputs.projectLifeYears} yrs` },
        { label: 'Rev. Escalation', value: `${(finInputs.escalationRate * 100).toFixed(0)}%` },
        { label: 'OPEX Escalation', value: `${(finInputs.opexEscalation * 100).toFixed(1)}%` },
        { label: 'Tax Rate', value: `${(finInputs.taxRate * 100).toFixed(0)}%` },
        { label: 'Depreciation', value: `${finInputs.depreciationYears} yrs` },
    ]);
    col1Y = drawSettingsBox(14, col1Y, 'NRC (Non-Recurring Charges)', [
        { label: 'Setup Fee', value: `$${revInputs.nrcPerKw}/kW` },
        { label: 'X-Connect Setup', value: fmtMoney(revInputs.nrcCrossConnect) },
        { label: 'Custom Fit-out', value: fmtMoney(revInputs.nrcCustomFitout) },
    ]);

    let col2Y = py;
    col2Y = drawSettingsBox(105, col2Y, 'MRC (Monthly Recurring)', [
        { label: 'MRC $/kW/mo', value: `$${revInputs.mrcPerKwMonth}` },
        { label: 'Escalation', value: `${(revInputs.mrcEscalation * 100).toFixed(0)}%/yr` },
        { label: 'X-Connect MRC', value: `$${revInputs.mrcCrossConnectMonthly}/mo` },
    ]);
    col2Y = drawSettingsBox(105, col2Y, 'Contract Terms', [
        { label: 'Lease Term', value: `${revInputs.contractYears} yrs` },
        { label: 'Take-or-Pay Floor', value: `${revInputs.takeOrPayPct}%` },
    ]);
    col2Y = drawSettingsBox(105, col2Y, 'Quick Summary', [
        { label: 'CAPEX Investment', value: fmtMoney(capexTotal) },
        { label: 'Annual OPEX (est.)', value: fmtMoney(annualOpex) },
        { label: 'Annual Revenue (100%)', value: fmtMoney(finInputs.revenuePerKwMonth * 12 * itLoadKw) },
        { label: 'Break-even Occupancy', value: `${financials.breakEvenOccupancy}%` },
        { label: 'Total NRC', value: fmtMoney(revenue.totalNRC) },
        { label: 'TCV', value: fmtMoney(revenue.contractValue) },
    ]);

    drawFooter(doc, currentPage, branding);
    doc.addPage(); currentPage++;

    // 3. Executive Summary
    drawModernHeader(doc, 'Financial Executive Summary', 'Key Investment & Revenue Metrics', branding);
    let y = 35;

    const drawFinCard = (cx: number, cy: number, cw: number, ch: number, title: string, value: string, subtext: string, valColor: [number, number, number], titleColor: [number, number, number] = PDF_COLORS.slate500) => {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cx, cy, cw, ch, 2, 2, 'FD');
        doc.setFont('helvetica', 'medium');
        doc.setFontSize(8);
        doc.setTextColor(...titleColor);
        doc.text(title, cx + 4, cy + 8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...valColor);
        doc.text(value, cx + 4, cy + 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...PDF_COLORS.slate400);
        doc.text(subtext, cx + 4, cy + 22);
    };

    const cardW = 42;
    const cardH = 26;

    // Row 1: Financial KPIs
    drawFinCard(14, y, cardW, cardH, 'NPV (10yr)', fmtMoney(financials.npv), 'Net Present Value', financials.npv > 0 ? [5, 150, 105] : [220, 38, 38], [15, 23, 42]);
    drawFinCard(58, y, cardW, cardH, 'IRR', `${financials.irr.toFixed(1)}%`, financials.irr > finInputs.discountRate * 100 ? 'Exceeds hurdle' : 'Below hurdle', financials.irr > 10 ? [5, 150, 105] : [217, 119, 6], [15, 23, 42]);
    drawFinCard(102, y, cardW, cardH, 'Payback', `${financials.paybackPeriodYears.toFixed(1)} yrs`, `Discounted: ${financials.discountedPaybackYears} yrs`, PDF_COLORS.slate900, [15, 23, 42]);
    drawFinCard(146, y, cardW, cardH, 'ROI', `${financials.roiPercent.toFixed(0)}%`, `PI: ${financials.profitabilityIndex.toFixed(2)}x`, financials.roiPercent > 0 ? [5, 150, 105] : [220, 38, 38], [15, 23, 42]);

    y += cardH + 4;

    // Row 2: Revenue KPIs
    drawFinCard(14, y, cardW, cardH, 'Total NRC', fmtMoney(revenue.totalNRC), 'One-time setup fees', [8, 145, 178], [8, 145, 178]);
    drawFinCard(58, y, cardW, cardH, 'Lifetime MRC', fmtMoney(revenue.totalMRC_lifetime), `Over ${revInputs.contractYears} years`, [5, 150, 105], [5, 150, 105]);
    drawFinCard(102, y, cardW, cardH, 'TCV', fmtMoney(revenue.contractValue), 'Total Contract Value', [79, 70, 229], [79, 70, 229]);
    drawFinCard(146, y, cardW, cardH, 'Effective $/kW/mo', `$${revenue.effectiveRate.toFixed(0)}`, 'Blended rate', [217, 119, 6], [217, 119, 6]);

    y += cardH + 10;

    // Recommendation
    y = drawExecutiveBox(doc, y, 'Financial Verdict',
        financials.npv > 0
            ? `Strong investment case. Positive NPV of ${fmtMoney(financials.npv)} indicates value creation above the discount rate. TCV is ${fmtMoney(revenue.contractValue)}.`
            : `Caution advised. Negative NPV of ${fmtMoney(financials.npv)} suggests returns may not meet capital cost requirements. TCV is ${fmtMoney(revenue.contractValue)}.`,
        financials.npv > 0 ? 'success' : 'warning'
    );

    // ── Charts Section ──
    if (chartImages?.cashflow || chartImages?.waterfall || chartImages?.mrc) {
        y = ensureSpace(doc, y, 90, { current: currentPage });
        drawModernHeader(doc, 'Visual Analysis', 'Generated Cashflow & Revenue Charts', branding);
        y = 35;

        // Cumulative Cashflow Chart Image
        if (chartImages.cashflow) {
            y = drawSectionTitle(doc, y, 'Cumulative Cashflow Projection', '1.0', branding);
            try {
                const imgProps = doc.getImageProperties(chartImages.cashflow);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(chartImages.cashflow, 'PNG', 15, y, pdfWidth, pdfHeight);
                y += pdfHeight + 10;
            } catch (e) {
                console.warn('Error adding cashflow image to PDF', e);
            }
        }

        // Waterfall Chart Image
        if (chartImages.waterfall) {
            y = ensureSpace(doc, y, 90, { current: currentPage });
            y = drawSectionTitle(doc, y, 'Revenue Waterfall — NRC + MRC Breakdown', '2.0', branding);
            try {
                const imgProps = doc.getImageProperties(chartImages.waterfall);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(chartImages.waterfall, 'PNG', 15, y, pdfWidth, pdfHeight);
                y += pdfHeight + 10;
            } catch (e) {
                console.warn('Error adding waterfall image to PDF', e);
            }
        }

        // MRC Growth Chart Image
        if (chartImages.mrc) {
            y = ensureSpace(doc, y, 90, { current: currentPage });
            y = drawSectionTitle(doc, y, 'MRC Growth Trajectory with Take-or-Pay Floor', '3.0', branding);
            try {
                const imgProps = doc.getImageProperties(chartImages.mrc);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(chartImages.mrc, 'PNG', 15, y, pdfWidth, pdfHeight);
            } catch (e) {
                console.warn('Error adding MRC image to PDF', e);
            }
        }

        drawFooter(doc, currentPage, branding);
        doc.addPage(); currentPage++;
        y = 35;
    } else {
        // Fallback Cumulative Cashflow Chart (Simplified Data)
        y = ensureSpace(doc, y, 90, { current: currentPage });
        y = drawSectionTitle(doc, y, 'Cumulative Cashflow Projection', '1.0', branding);
        const chartData = financials.cashflows.map(c => ({
            label: `Y${c.year}`,
            value: c.cumulativeCashflow,
            color: c.cumulativeCashflow >= 0 ? PDF_COLORS.secondary : PDF_COLORS.danger
        }));
        y = drawHorizontalBarChart(doc, 14, y, 180, chartData.slice(0, 10), 'Cumulative Cashflow Growth (First 10 Years)');

        drawFooter(doc, currentPage, branding);
        doc.addPage(); currentPage++;
        y = 35;
    }

    // 4. Detailed Cashflow Table
    drawModernHeader(doc, 'Detailed Cashflow & Revenue', 'Year-by-Year Projection', branding);
    y = 35;

    const cfRows = financials.cashflows.map((c, idx) => {
        const revYr = revenue.yearDetails[idx];
        return [
            `Y${c.year}`,
            fmtMoney(c.revenue),
            fmtMoney(-c.opex),
            fmtMoney(c.ebitda),
            fmtMoney(c.netIncome),
            revYr ? `${(revYr.occupancy * 100).toFixed(0)}%` : '—',
            revYr ? fmt(revYr.billedKw) : '—',
            revYr && revYr.nrc > 0 ? fmtMoney(revYr.nrc) : '—',
            revYr ? fmtMoney(revYr.mrcMonthly) : '—',
            revYr ? fmtMoney(revYr.mrcAnnual) : '—',
            revYr ? fmtMoney(revYr.totalRevenue) : fmtMoney(c.revenue),
            fmtMoney(c.cumulativeCashflow)
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Period', 'Revenue', 'OPEX', 'EBITDA', 'Net Income', 'Occ%', 'Billed kW', 'NRC', 'MRC/mo', 'MRC Yr', 'Total Rev', 'Cum. CF']],
        body: cfRows,
        theme: 'striped',
        headStyles: { fillColor: branding?.primaryColor ? PDF_COLORS.slate900 : PDF_COLORS.slate900 },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 7, cellPadding: 1 },
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right', textColor: [5, 150, 105] }, // emerald
            2: { halign: 'right', textColor: [220, 38, 38] }, // red
            3: { halign: 'right', fontStyle: 'bold' }, // ebitda
            4: { halign: 'right' }, // net income
            5: { halign: 'right' }, // occ
            6: { halign: 'right' }, // billed kw
            7: { halign: 'right', textColor: [8, 145, 178] }, // cyan (NRC)
            8: { halign: 'right', textColor: [5, 150, 105] }, // emerald (MRC/mo)
            9: { halign: 'right', textColor: [5, 150, 105] }, // emerald (MRC Yr)
            10: { halign: 'right', fontStyle: 'bold' }, // Total Rev
            11: { halign: 'right', fontStyle: 'bold' }, // Cum. CF
        }
    });

    drawFooter(doc, currentPage, branding);

    savePdf(doc, `DCMOC_Financials_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ═══════════════════════════════════════════════════════════════
// RISK PDF — Quantitative Risk Assessment
// ═══════════════════════════════════════════════════════════════

export const generateRiskPDF = async (
    country: CountryProfile,
    riskData: any, // RiskAggregation
    narrative: string,
    branding?: BrandingConfig
) => {
    const { doc } = await initDoc(branding);
    let currentPage = 1;

    // 1. Cover
    drawCoverPage(doc, 'Risk & Compliance\nAssessment', `Facility Analysis for ${country.name}`, {
        client: 'Risk Management',
        date: today(),
    }, branding);

    doc.addPage(); currentPage++;

    // 2. Summary
    drawModernHeader(doc, 'Risk Matrix Executive Summary', `Normalized Score: ${riskData.normalizedScore}/100`, branding);
    let y = 35;

    // KPI Cards
    drawKpiCard(doc, 14, y, 55, 24, 'Total Risk Score', `${riskData.totalScore}`, 'Raw unweighted score');
    drawKpiCard(doc, 75, y, 55, 24, 'SLA Breach Prob.', `${(riskData.slaBreachProbability * 100).toFixed(1)}%`, 'Annually');
    drawKpiCard(doc, 136, y, 55, 24, 'Identified Risks', `${riskData.topRisks.length}`, 'Active threats');

    y += 35;

    // Narrative
    y = drawParagraph(doc, y, narrative);

    y = ensureSpace(doc, y, 80, { current: currentPage });

    // Top Risks
    y = drawSectionTitle(doc, y, 'Primary Risk Vectors', '1.0', branding);
    const topRisks = riskData.topRisks.slice(0, 5).map((r: any) => ({
        label: r.title,
        value: r.score,
        color: r.score > 10 ? PDF_COLORS.danger : r.score > 5 ? PDF_COLORS.warning : PDF_COLORS.info
    }));

    y = drawHorizontalBarChart(doc, 14, y, 180, topRisks, 'Top Matrix Scores');

    drawFooter(doc, currentPage, branding);

    savePdf(doc, `DCMOC_RiskProfile_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ═══════════════════════════════════════════════════════════════
// CARBON PDF — ESG & Footprint
// ═══════════════════════════════════════════════════════════════

export const generateCarbonPDF = async (
    country: CountryProfile,
    carbonData: any, // CarbonResult
    narrative: string,
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    let currentPage = 1;

    // 1. Cover
    drawCoverPage(doc, 'Carbon & ESG\nFootprint Report', `Sustainability Profile for ${country.name}`, {
        client: 'Sustainability Office',
        date: today(),
    }, branding);

    doc.addPage(); currentPage++;

    // 2. Summary
    drawModernHeader(doc, 'ESG Executive Summary', `Rating: ${carbonData.efficiencyRating}`, branding);
    let y = 35;

    // KPI Cards
    drawKpiCard(doc, 14, y, 42, 24, 'Emissions', `${fmt(carbonData.annualEmissionsTonCO2)} tCO₂`, 'Scope 1+2+3');
    drawKpiCard(doc, 60, y, 42, 24, 'Effective PUE', `${carbonData.pueEfficiency.toFixed(2)}`, 'Design target');
    drawKpiCard(doc, 106, y, 42, 24, 'Tax Exposure', fmt(carbonData.carbonTaxExposureUSD), 'Potential liability');
    drawKpiCard(doc, 152, y, 42, 24, 'Renewable', `${carbonData.renewableReductionPct}%`, 'Offset percentage');

    y += 35;

    // Narrative
    y = drawParagraph(doc, y, narrative);

    y = ensureSpace(doc, y, 80, { current: currentPage });

    // Breakdown pie/dist
    y = drawSectionTitle(doc, y, 'Emissions Breakdown', '1.0', branding);
    const distData = [
        { label: 'Scope 1 (Direct)', value: carbonData.scope1, color: PDF_COLORS.danger },
        { label: 'Scope 2 (Grid)', value: carbonData.scope2, color: PDF_COLORS.warning },
        { label: 'Scope 3 (Supply)', value: carbonData.scope3, color: PDF_COLORS.accent },
    ];
    y = drawDistributionChart(doc, 14, y, 180, distData, 'GHG Protocol Scopes');

    y = ensureSpace(doc, y, 80, { current: currentPage });

    // Reduction Scenarios
    y = drawSectionTitle(doc, y, 'Carbon Reduction Investment Scenarios', '2.0', branding);
    const scenarios = carbonData.reductionScenarios.map((s: any) => [
        s.name,
        fmtMoney(s.investmentUSD),
        `${Math.round(s.annualSavingsTonCO2)} tCO₂/yr`,
        s.paybackYears > 0 ? `${s.paybackYears} yrs` : 'Immediate/PPA'
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Initiative', 'Investment', 'CO₂ Abatement', 'Est. Payback']],
        body: scenarios,
        theme: 'striped',
        headStyles: { fillColor: branding?.primaryColor ? PDF_COLORS.slate900 : PDF_COLORS.slate900 },
        margin: { left: 14, right: 14 }
    });

    drawFooter(doc, currentPage, branding);

    savePdf(doc, `DCMOC_CarbonESG_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// Legacy
export const generateDetailedPDF = generateSimulationPDF;

// ═══════════════════════════════════════════════════════════════
// MASTER REPORT PDF — Full Comprehensive (10-15 pages)
// ═══════════════════════════════════════════════════════════════

import { TocItem, drawTableOfContents, drawCostCapitulationTable, draw5YearTCOTable } from './PdfUtils';
import { generateCapexSectionNarrative, generateTCONarrative, generateCostWaterfallNarrative, generateMaintenanceNarrative, generateRiskNarrative, generateCarbonNarrative } from './ExecutiveSummaryGenerator';

export const generateMasterReportPDF = async (
    country: CountryProfile,
    data: any, // The full simulation data package
    branding?: BrandingConfig,
    chartImages?: { tornado?: string; sankey?: string }
) => {
    const { doc, autoTable } = await initDoc(branding);
    const { inputs, capex, financial, staffing, maintenance, risk, insights } = data;
    let currentPage = 1;

    // 1. Cover
    drawCoverPage(doc, 'Master Operational Report\n& Exact Feasibility Study', `M&O Assessment for ${country.name}`, {
        client: 'Executive Board',
        date: today(),
        version: '1.0' // Final Master Version
    }, branding);
    doc.addPage(); currentPage++;

    // 2. Table of Contents
    drawModernHeader(doc, 'Table of Contents', 'Master Document Structure', branding);
    let y = 35;

    const tocItems: TocItem[] = [
        { reason: 'High-Level Overview', source: 'Simulation Engine', validation: 'Exec Gen', pages: '3-4' },
        { reason: 'Investment Breakdown', source: 'Capex Engine', validation: 'Cost Capitulation', pages: '5-6' },
        { reason: 'TCO & Cashflow', source: 'Financial Engine', validation: 'NPV/IRR Formula', pages: '7-8' },
        { reason: 'Operational Strategy', source: 'Shift & Roster Engine', validation: 'Cost Modeling', pages: '9-10' },
        { reason: 'Predictive vs SFG20', source: 'Maintenance Engine', validation: 'Life Cycle Cost', pages: '11-12' },
        { reason: 'Security & Reliability', source: 'Risk Engine', validation: 'Matrix Model', pages: '13-14' }
    ];

    y = drawTableOfContents(doc, y, tocItems, 'Sections inside this Data Center Report');
    drawFooter(doc, currentPage, branding);
    doc.addPage(); currentPage++;

    // 3. Executive Summary (Generated dynamically via Narratives)
    drawModernHeader(doc, 'Executive Summary', 'C-Suite Narrative', branding);
    y = 35;

    // Narrative calls
    let execY = y;
    execY = drawSectionTitle(doc, execY, 'CAPEX Assessment', '1.0', branding);
    execY = drawParagraph(doc, execY, generateCapexSectionNarrative(capex, inputs.tierLevel, country.name));
    execY += 10;

    execY = drawSectionTitle(doc, execY, 'Return on Investment & Cashflow', '1.1', branding);
    execY = drawParagraph(doc, execY, generateTCONarrative(financial));
    execY += 10;

    if (staffing) {
        execY = drawSectionTitle(doc, execY, 'Cost Waterfall Dynamics', '1.2', branding);
        const totalOpex = financial.cashflows.reduce((a: number, c: any) => a + c.opex, 0);
        execY = drawParagraph(doc, execY, generateCostWaterfallNarrative(capex, financial, totalOpex));
        execY += 10;
    }

    execY = ensureSpace(doc, execY, 60, { current: currentPage });
    execY = drawSectionTitle(doc, execY, 'Maintenance & Risk Stance', '1.3', branding);
    execY = drawParagraph(doc, execY, generateMaintenanceNarrative(maintenance?.strategy, maintenance?.sla, maintenance?.spares));
    execY += 5;
    execY = drawParagraph(doc, execY, generateRiskNarrative(risk?.aggregation));

    drawFooter(doc, currentPage, branding);
    doc.addPage(); currentPage++;

    // 4. Cost Capitulation Exact Table
    drawModernHeader(doc, 'Capital Expenditure Detail', 'Cost Capitulation Matrix', branding);
    y = 35;
    y = drawCostCapitulationTable(doc, y, capex.costs, capex.softCosts, capex.contingency, capex.fomTotal, capex.total);
    drawFooter(doc, currentPage, branding);
    doc.addPage(); currentPage++;

    // 5. 5-Year TCO Exact Table
    drawModernHeader(doc, 'Operational Expenditure', '5-Year Tabular View', branding);
    y = 35;
    y = draw5YearTCOTable(doc, y, financial.cashflows, capex.total);
    drawFooter(doc, currentPage, branding);
    doc.addPage(); currentPage++;

    // 6. Embedded Visual Analysis
    if (chartImages?.tornado || chartImages?.sankey) {
        drawModernHeader(doc, 'Visual Analysis', 'Generated Charts', branding);
        y = 35;

        if (chartImages.sankey) {
            y = drawSectionTitle(doc, y, 'Cost Flow Analysis (Sankey)', '3.0', branding);
            try {
                const imgProps = doc.getImageProperties(chartImages.sankey);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(chartImages.sankey, 'PNG', 15, y, pdfWidth, pdfHeight);
                y += pdfHeight + 10;
            } catch (e) {
                console.warn('Error adding Sankey image to PDF', e);
            }
        }

        if (chartImages.tornado) {
            y = ensureSpace(doc, y, 100, { current: currentPage });
            y = drawSectionTitle(doc, y, 'Sensitivity Analysis (Tornado)', '4.0', branding);
            try {
                const imgProps = doc.getImageProperties(chartImages.tornado);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(chartImages.tornado, 'PNG', 15, y, pdfWidth, pdfHeight);
            } catch (e) {
                console.warn('Error adding Tornado image to PDF', e);
            }
        }
        drawFooter(doc, currentPage, branding);
        doc.addPage(); currentPage++;
    }

    // 7. Operations & Roster (Summary logic similar to StaffingPDF)
    drawModernHeader(doc, 'Shift & Roster Strategy', 'Detailed Personnel Plan', branding);
    y = 35;
    if (staffing.results) {
        const totalHeads = staffing.results.reduce((acc: number, r: any) => acc + r.headcount, 0);
        const totalCost = staffing.results.reduce((acc: number, r: any) => acc + r.monthlyCost, 0);
        drawKpiCard(doc, 14, y, 55, 24, 'Total Headcount', `${totalHeads}`, 'FTEs across all shifts');
        drawKpiCard(doc, 75, y, 55, 24, 'Monthly OPEX', fmt(totalCost), 'Gross Salary + Burden');
        y += 35;

        y = drawHorizontalBarChart(doc, 14, y, 180, staffing.results.map((r: any) => ({
            label: r.role,
            value: r.monthlyCost,
            color: r.role.includes('Engineer') ? PDF_COLORS.secondary : PDF_COLORS.primary
        })), 'Monthly Cost Distribution by Role');
    }

    drawFooter(doc, currentPage, branding);

    // End of Master Export
    savePdf(doc, `DCMOC_MasterReport_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
