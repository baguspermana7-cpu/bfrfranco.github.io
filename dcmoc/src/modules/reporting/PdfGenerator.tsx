
// ═══════════════════════════════════════════════════════════════
// PDF GENERATOR — Orchestrator
// Re-exports domain PDF generators from pdf/ directory
// Contains Master Report + Country Intelligence locally
// ═══════════════════════════════════════════════════════════════

import { CountryProfile } from '@/constants/countries';
import { FinancialResult } from '@/modules/analytics/FinancialEngine';
import { RevenueResult } from '@/modules/analytics/RevenueEngine';
import { CapexResult, CapexInput } from '@/lib/CapexEngine';
import { generateCapexSectionNarrative, generateTCONarrative, generateCostWaterfallNarrative, generateMaintenanceNarrative, generateRiskNarrative, generateCarbonNarrative } from './ExecutiveSummaryGenerator';
import {
    PDF_COLORS,
    BrandingConfig,
    TocItem,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage,
    drawModernHeader,
    drawFooter,
    drawSectionTitle,
    drawKpiCard,
    drawExecutiveBox,
    drawParagraph,
    drawHorizontalBarChart,
    drawInsightsSection,
    drawTableOfContents,
    drawCostCapitulationTable,
    draw5YearTCOTable,
    ensureSpace,
} from './PdfUtils';

// ═══════════════════════════════════════════════════════════════
// RE-EXPORTS from domain PDF files
// ═══════════════════════════════════════════════════════════════

export { generateMaintenancePDF } from './pdf/MaintenancePdf';
export { generateStaffingPDF } from './pdf/StaffingPdf';
export { generateRiskPDF } from './pdf/RiskPdf';
export { generateInvestmentPDF } from './pdf/InvestmentPdf';
export { generateAssetLifecyclePDF } from './pdf/AssetLifecyclePdf';
export { generatePhasedFinancialPDF } from './pdf/PhasedFinancialPdf';
export { generateCarbonPDF } from './pdf/CarbonPdf';
export { generateFinancialPDF } from './pdf/FinancialPdf';
export { generateCapexPDF } from './pdf/CapexPdf';
export { generateCapacityPlanPDF } from './pdf/CapacityPlanPdf';
export { generateSimulationPDF } from './pdf/SimulationPdf';

// Legacy alias
export { generateSimulationPDF as generateDetailedPDF } from './pdf/SimulationPdf';

// ═══════════════════════════════════════════════════════════════
// MASTER REPORT PDF — Full Comprehensive (12-18 pages)
// ═══════════════════════════════════════════════════════════════

export const generateMasterReportPDF = async (
    country: CountryProfile,
    data: any,
    branding?: BrandingConfig,
    chartImages?: { tornado?: string; sankey?: string }
) => {
    const { doc, autoTable } = await initDoc(branding);
    const { inputs, capex, financial, staffing, maintenance, risk, insights } = data;
    const pg = { current: 1 };

    // ── Cover ──
    drawCoverPage(doc, 'Master Operational Report\n& Exact Feasibility Study', `M&O Assessment for ${country.name}`, {
        client: 'Executive Board',
        date: today(),
        version: '2.0'
    }, branding);
    doc.addPage(); pg.current++;

    // ── Table of Contents ──
    drawModernHeader(doc, 'Table of Contents', 'Master Document Structure', branding);
    let y = 35;

    const tocItems: TocItem[] = [
        { reason: 'High-Level Overview', source: 'Simulation Engine', validation: 'Exec Gen', pages: '3-4' },
        { reason: 'Investment Breakdown', source: 'Capex Engine', validation: 'Cost Capitulation', pages: '5-6' },
        { reason: 'TCO & Cashflow', source: 'Financial Engine', validation: 'NPV/IRR Formula', pages: '7-8' },
        { reason: 'Operational Strategy', source: 'Shift & Roster Engine', validation: 'Cost Modeling', pages: '9-10' },
        { reason: 'Predictive vs SFG20', source: 'Maintenance Engine', validation: 'Life Cycle Cost', pages: '11-12' },
        { reason: 'Security & Reliability', source: 'Risk Engine', validation: 'Matrix Model', pages: '13-14' },
        { reason: 'Investment Analysis', source: 'Investment Engine', validation: 'DSCR/IRR Model', pages: '15-16' },
        { reason: 'Asset Lifecycle', source: 'Lifecycle Engine', validation: 'Depreciation Schedule', pages: '17-18' },
    ];

    y = drawTableOfContents(doc, y, tocItems, 'Sections inside this Data Center Report');
    drawFooter(doc, pg.current, branding);
    doc.addPage(); pg.current++;

    // ── Executive Summary ──
    drawModernHeader(doc, 'Executive Summary', 'C-Suite Narrative', branding);
    y = 35;

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

    execY = ensureSpace(doc, execY, 60, pg);
    execY = drawSectionTitle(doc, execY, 'Maintenance & Risk Stance', '1.3', branding);
    execY = drawParagraph(doc, execY, generateMaintenanceNarrative(maintenance?.strategy, maintenance?.sla, maintenance?.spares));
    execY += 5;
    execY = drawParagraph(doc, execY, generateRiskNarrative(risk?.aggregation));

    drawFooter(doc, pg.current, branding);
    doc.addPage(); pg.current++;

    // ── Cost Capitulation ──
    drawModernHeader(doc, 'Capital Expenditure Detail', 'Cost Capitulation Matrix', branding);
    y = 35;
    y = drawCostCapitulationTable(doc, y, capex.costs, capex.softCosts, capex.contingency, capex.fomTotal, capex.total);
    drawFooter(doc, pg.current, branding);
    doc.addPage(); pg.current++;

    // ── 5-Year TCO ──
    drawModernHeader(doc, 'Operational Expenditure', '5-Year Tabular View', branding);
    y = 35;
    y = draw5YearTCOTable(doc, y, financial.cashflows, capex.total);
    drawFooter(doc, pg.current, branding);
    doc.addPage(); pg.current++;

    // ── Charts ──
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
            y = ensureSpace(doc, y, 100, pg);
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
        drawFooter(doc, pg.current, branding);
        doc.addPage(); pg.current++;
    }

    // ── Operations & Roster ──
    drawModernHeader(doc, 'Shift & Roster Strategy', 'Detailed Personnel Plan', branding);
    y = 35;
    if (staffing?.results) {
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

    drawFooter(doc, pg.current, branding);
    doc.addPage(); pg.current++;

    // ── Investment Analysis Summary (if available) ──
    if (data.investment) {
        drawModernHeader(doc, 'Investment Analysis', 'Capital Structure & Returns', branding);
        y = 35;

        const inv = data.investment;
        drawKpiCard(doc, 14, y, 35, 24, 'WACC', `${inv.wacc?.toFixed(1) || 'N/A'}%`, 'Weighted avg');
        drawKpiCard(doc, 53, y, 35, 24, 'Equity IRR', `${inv.equityIRR?.toFixed(1) || 'N/A'}%`, 'Levered return');
        drawKpiCard(doc, 92, y, 35, 24, 'MOIC', `${inv.moic?.toFixed(2) || 'N/A'}x`, 'Multiple');
        drawKpiCard(doc, 131, y, 35, 24, 'Min DSCR', `${inv.minDSCR?.toFixed(2) || 'N/A'}x`, 'Debt coverage');
        drawKpiCard(doc, 170, y, 24, 24, 'Ready', `${inv.readinessScore || 0}`, '/100');
        y += 35;

        if (inv.valuation) {
            y = drawSectionTitle(doc, y, 'Valuation Summary', '7.0', branding);
            autoTable(doc, {
                startY: y,
                head: [['Method', 'Value']],
                body: [
                    ['EV/EBITDA Multiple', fmtMoney(inv.valuation.evEbitda || 0)],
                    ['Cap Rate Approach', fmtMoney(inv.valuation.capRate || 0)],
                    ['$/kW Comparable', fmtMoney(inv.valuation.perKw || 0)],
                ],
                theme: 'striped',
                headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                columnStyles: { 1: { halign: 'right' } },
                margin: { left: 14, right: 14 }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        drawFooter(doc, pg.current, branding);
        doc.addPage(); pg.current++;
    }

    // ── Asset Lifecycle Summary (if available) ──
    if (data.assetLifecycle) {
        drawModernHeader(doc, 'Asset Lifecycle', 'Depreciation & Replacement Summary', branding);
        y = 35;

        const al = data.assetLifecycle;
        const ps = al.portfolioSummary || {};
        drawKpiCard(doc, 14, y, 42, 24, 'Total Assets', fmtMoney(ps.totalAcquisitionCost || 0), 'Acquisition cost');
        drawKpiCard(doc, 60, y, 42, 24, '25-Year Cost', fmtMoney(ps.total25YearCost || 0), 'Lifecycle total');
        drawKpiCard(doc, 106, y, 42, 24, 'Annual Refresh', fmtMoney(ps.averageAnnualRefresh || 0), 'Average/year');
        drawKpiCard(doc, 152, y, 42, 24, 'Peak Year', `Year ${ps.peakReplacementYear || 'N/A'}`, 'Highest cost');
        y += 35;

        if (al.replacementTimeline && al.replacementTimeline.length > 0) {
            y = drawSectionTitle(doc, y, 'Replacement Timeline (Top Years)', '8.0', branding);
            const topYears = al.replacementTimeline
                .filter((r: any) => r.assets && r.assets.length > 0)
                .slice(0, 10);
            const replRows = topYears.map((r: any) => [
                `Year ${r.year}`,
                `${r.assets?.length || 0} items`,
                fmtMoney(r.totalCost || 0),
            ]);
            autoTable(doc, {
                startY: y,
                head: [['Year', 'Assets', 'Cost']],
                body: replRows,
                theme: 'striped',
                headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                columnStyles: { 2: { halign: 'right' } },
                margin: { left: 14, right: 14 }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        drawFooter(doc, pg.current, branding);
        doc.addPage(); pg.current++;
    }

    // ── GO/NO-GO Recommendation ──
    drawModernHeader(doc, 'Investment Recommendation', 'GO / NO-GO Decision Framework', branding);
    y = 35;

    const goChecks = [
        { label: 'IRR exceeds WACC (10%)', pass: financial.irr > 10 },
        { label: 'NPV is positive', pass: financial.npv > 0 },
        { label: 'Payback < 7 years', pass: financial.paybackPeriodYears < 7 },
        { label: 'Break-even occupancy < 60%', pass: financial.breakEvenOccupancy < 60 },
        { label: 'Profitability Index > 1.0', pass: financial.profitabilityIndex > 1.0 },
    ];
    const passCount = goChecks.filter(c => c.pass).length;
    const recommendation = passCount >= 4 ? 'GO' : passCount >= 2 ? 'CONDITIONAL GO' : 'NO-GO';
    const recColor: [number, number, number] = passCount >= 4 ? [5, 150, 105] : passCount >= 2 ? [217, 119, 6] : [220, 38, 38];

    doc.setFillColor(...recColor);
    doc.roundedRect(14, y, 180, 20, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(`RECOMMENDATION: ${recommendation}`, 104, y + 13, { align: 'center' });
    y += 30;

    y = drawSectionTitle(doc, y, 'Decision Criteria', '9.0', branding);
    goChecks.forEach(check => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...(check.pass ? [5, 150, 105] as [number, number, number] : [220, 38, 38] as [number, number, number]));
        doc.text(check.pass ? '✓' : '✗', 18, y + 1);
        doc.setTextColor(...PDF_COLORS.slate900);
        doc.text(check.label, 26, y + 1);
        doc.setTextColor(...(check.pass ? [5, 150, 105] as [number, number, number] : [220, 38, 38] as [number, number, number]));
        doc.text(check.pass ? 'PASS' : 'FAIL', 160, y + 1);
        y += 8;
    });

    y += 10;
    y = drawParagraph(doc, y, `Based on the analysis across CAPEX, financial returns, risk assessment, and operational readiness, this project receives a ${recommendation} recommendation. ${passCount >= 4 ? 'All key investment criteria are met.' : passCount >= 2 ? 'Some criteria require attention before final approval.' : 'Critical metrics fall below acceptable thresholds.'}`);

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_MasterReport_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ═══════════════════════════════════════════════════════════════
// COUNTRY INTELLIGENCE PDF — Tax, Disaster, Grid, Talent (4-6 pages)
// ═══════════════════════════════════════════════════════════════

export const generateCountryIntelPDF = async (
    country: CountryProfile,
    data: {
        taxResult: any;
        disasterResult: any;
        gridResult: any;
        talentResult: any;
        itLoadKw: number;
        totalCapex: number;
        totalFTE: number;
        annualStaffCost: number;
    },
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    const pg = { current: 1 };

    // ── Cover ──
    drawCoverPage(doc, 'Country Intelligence\nReport', `Market Assessment for ${country.name}`, {
        client: 'Site Selection Committee',
        date: today(),
        version: '1.0'
    }, branding);

    doc.addPage(); pg.current++;

    // ── Tax & Incentive Analysis ──
    drawModernHeader(doc, 'Tax & Incentive Analysis', `${country.name} — Fiscal Environment`, branding);
    let y = 35;

    const tax = data.taxResult;
    if (tax) {
        drawKpiCard(doc, 14, y, 42, 24, 'Total Savings', fmt(tax.totalIncentiveValue), 'NPV of incentives');
        drawKpiCard(doc, 60, y, 42, 24, 'Effective Tax Y1', `${(tax.effectiveTaxTimeline[0] * 100).toFixed(1)}%`, `vs ${(country.economy.taxRate * 100).toFixed(1)}% standard`);
        drawKpiCard(doc, 106, y, 42, 24, 'NPV Uplift', fmt(tax.npvWithIncentives - tax.npvWithoutIncentives), 'With incentives');
        drawKpiCard(doc, 152, y, 42, 24, 'IRR Uplift', `+${(tax.irrWithIncentives - tax.irrWithoutIncentives).toFixed(1)}%`, `${tax.irrWithIncentives.toFixed(1)}% with incentives`);
        y += 35;

        y = drawSectionTitle(doc, y, 'Tax Holiday Timeline', '1.0', branding);
        const taxRows = tax.effectiveTaxTimeline.slice(0, 10).map((rate: number, i: number) => [
            `Year ${i + 1}`,
            `${(country.economy.taxRate * 100).toFixed(1)}%`,
            `${(rate * 100).toFixed(1)}%`,
            fmt(tax.yearlyTaxSavings[i] || 0),
        ]);
        autoTable(doc, {
            startY: y,
            head: [['Period', 'Standard Rate', 'Effective Rate', 'Tax Savings']],
            body: taxRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900 },
            styles: { fontSize: 8, cellPadding: 2 },
            margin: { left: 14, right: 14 },
            columnStyles: { 3: { halign: 'right', textColor: [5, 150, 105] } }
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        if (tax.incentiveSummary && tax.incentiveSummary.length > 0) {
            y = ensureSpace(doc, y, 40, pg);
            y = drawExecutiveBox(doc, y, 'Available Incentive Programs',
                tax.incentiveSummary.join('\n'),
                'success'
            );
        }

        if (country.taxIncentives?.freeTradeZones && country.taxIncentives.freeTradeZones.length > 0) {
            y = ensureSpace(doc, y, 20, pg);
            y = drawParagraph(doc, y, `Free Trade Zones: ${country.taxIncentives.freeTradeZones.join(', ')}. Import duty savings: ${fmt(tax.ftzBenefits)}.`);
        }
    }

    drawFooter(doc, pg.current, branding);
    doc.addPage(); pg.current++;

    // ── Natural Disaster Risk ──
    drawModernHeader(doc, 'Natural Disaster Risk', `${country.name} — Hazard Profile`, branding);
    y = 35;

    const disaster = data.disasterResult;
    if (disaster) {
        drawKpiCard(doc, 14, y, 42, 24, 'Risk Score', `${disaster.compositeScore}/100`, disaster.riskCategory);
        drawKpiCard(doc, 60, y, 42, 24, 'Insurance/Yr', fmt(disaster.annualInsuranceCost), 'Adjusted premium');
        drawKpiCard(doc, 106, y, 42, 24, 'Structural +', fmt(disaster.structuralCostAdder), 'CAPEX hardening');
        drawKpiCard(doc, 152, y, 42, 24, 'Revenue @ Risk', fmt(disaster.revenueAtRisk), `${disaster.businessInterruptionDays} days interruption`);
        y += 35;

        y = drawSectionTitle(doc, y, 'Risk Factor Breakdown', '2.0', branding);
        const riskRows = disaster.riskBreakdown.map((r: any) => [
            r.type, `${r.score}/100`, r.impact
        ]);
        autoTable(doc, {
            startY: y,
            head: [['Hazard Type', 'Score', 'Impact Assessment']],
            body: riskRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900 },
            styles: { fontSize: 8, cellPadding: 2 },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        if (disaster.mitigationOptions && disaster.mitigationOptions.length > 0) {
            y = ensureSpace(doc, y, 60, pg);
            y = drawSectionTitle(doc, y, 'Mitigation Recommendations', '2.1', branding);
            const mitigRows = disaster.mitigationOptions.map((m: any) => [
                m.name, fmt(m.cost), fmt(m.annualBenefit), `${m.roiPercent}%`
            ]);
            autoTable(doc, {
                startY: y,
                head: [['Measure', 'Cost', 'Annual Benefit', 'ROI']],
                body: mitigRows,
                theme: 'striped',
                headStyles: { fillColor: PDF_COLORS.slate900 },
                styles: { fontSize: 8, cellPadding: 2 },
                margin: { left: 14, right: 14 },
                columnStyles: { 3: { halign: 'right', textColor: [5, 150, 105] } }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }
    }

    drawFooter(doc, pg.current, branding);
    doc.addPage(); pg.current++;

    // ── Grid Reliability ──
    drawModernHeader(doc, 'Grid Reliability Index', `${country.name} — Power Infrastructure`, branding);
    y = 35;

    const grid = data.gridResult;
    if (grid) {
        drawKpiCard(doc, 14, y, 35, 24, 'Grid Score', `${grid.reliabilityScore}`, `Grade ${grid.reliabilityGrade}`);
        drawKpiCard(doc, 53, y, 35, 24, 'Outage Hrs/Yr', `${(grid.annualOutageMinutes / 60).toFixed(1)}`, `${grid.annualExpectedOutages} events`);
        drawKpiCard(doc, 92, y, 35, 24, 'Gen Capacity', `${grid.requiredGenCapacity} kW`, `${grid.recommendedFuelHours}h fuel`);
        drawKpiCard(doc, 131, y, 35, 24, 'Fuel Cost/Yr', fmt(grid.annualFuelCost), 'Backup operations');
        drawKpiCard(doc, 170, y, 24, 24, 'Solar', `${grid.solarViabilityScore}`, '/100');
        y += 35;

        y = drawSectionTitle(doc, y, 'Grid Risk Cost Breakdown', '3.0', branding);
        if (grid.costBreakdown) {
            const gridCostRows = grid.costBreakdown.map((item: any) => [item.label, fmtMoney(item.value)]);
            gridCostRows.push(['Total Grid-Adjusted OPEX', fmtMoney(grid.gridRiskAdjustedOpex)]);
            autoTable(doc, {
                startY: y,
                head: [['Cost Component', 'Annual Cost']],
                body: gridCostRows,
                theme: 'striped',
                headStyles: { fillColor: PDF_COLORS.slate900 },
                styles: { fontSize: 8, cellPadding: 2 },
                margin: { left: 14, right: 14 },
                columnStyles: { 1: { halign: 'right' } }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        y = ensureSpace(doc, y, 40, pg);
        y = drawExecutiveBox(doc, y, 'Backup Power Architecture',
            `Grid Feed ${grid.dualFeedRecommendation ? '(Dual A+B)' : '(Single)'} → ATS → UPS (${data.itLoadKw} kW)\n` +
            `Generator: ${grid.requiredGenCapacity} kW (${grid.recommendedFuelHours}h fuel reserve)\n` +
            `Availability with Backup: ${grid.availabilityWithBackup.toFixed(3)}%\n` +
            `BESS ROI: ${grid.batteryStorageROI < 50 ? `${grid.batteryStorageROI} year payback` : 'Not recommended'}`,
            'info'
        );
    }

    drawFooter(doc, pg.current, branding);
    doc.addPage(); pg.current++;

    // ── Talent Availability ──
    drawModernHeader(doc, 'Talent Availability Index', `${country.name} — Workforce Assessment`, branding);
    y = 35;

    const talent = data.talentResult;
    if (talent) {
        drawKpiCard(doc, 14, y, 42, 24, 'Talent Score', `${talent.talentScore}/100`, talent.hiringDifficulty);
        drawKpiCard(doc, 60, y, 42, 24, 'Salary Premium', `+${((talent.adjustedSalaryMultiplier - 1) * 100).toFixed(0)}%`, fmt(talent.adjustedAnnualStaffCost - data.annualStaffCost) + '/yr extra');
        drawKpiCard(doc, 106, y, 42, 24, 'Time to Staff', `${talent.timeToFullStaff} mo`, 'Months to full team');
        drawKpiCard(doc, 152, y, 42, 24, 'Turnover', `${(talent.adjustedTurnoverRate * 100).toFixed(0)}%`, fmt(talent.annualTurnoverCost) + '/yr');
        y += 35;

        y = drawSectionTitle(doc, y, 'Talent Factor Analysis', '4.0', branding);
        if (talent.talentBreakdown) {
            const talentRows = talent.talentBreakdown.map((item: any) => [item.metric, item.value, item.impact]);
            autoTable(doc, {
                startY: y,
                head: [['Factor', 'Value', 'Impact']],
                body: talentRows,
                theme: 'striped',
                headStyles: { fillColor: PDF_COLORS.slate900 },
                styles: { fontSize: 8, cellPadding: 2 },
                margin: { left: 14, right: 14 }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        y = ensureSpace(doc, y, 50, pg);
        y = drawSectionTitle(doc, y, 'Annual Staff Cost Impact', '4.1', branding);
        const costImpactRows = [
            ['Base Annual Staff Cost', fmtMoney(data.annualStaffCost)],
            [`+ Salary Premium (${((talent.adjustedSalaryMultiplier - 1) * 100).toFixed(0)}%)`, `+${fmtMoney(talent.adjustedAnnualStaffCost - data.annualStaffCost)}`],
            ['+ Turnover Cost', `+${fmtMoney(talent.annualTurnoverCost)}`],
            ['+ Training Cost', `+${fmtMoney(talent.annualTrainingCost)}`],
            ['+ Recruitment Cost', `+${fmtMoney(talent.totalRecruitmentCost)}`],
            ['Talent-Adjusted Total', fmtMoney(talent.adjustedAnnualStaffCost + talent.annualTurnoverCost + talent.annualTrainingCost)],
        ];
        autoTable(doc, {
            startY: y,
            head: [['Component', 'Amount']],
            body: costImpactRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900 },
            styles: { fontSize: 8, cellPadding: 2 },
            margin: { left: 14, right: 14 },
            columnStyles: { 1: { halign: 'right' } }
        });
    }

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_CountryIntel_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
