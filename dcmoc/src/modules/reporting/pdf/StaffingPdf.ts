
import { CountryProfile } from '@/constants/countries';
import { StaffingResult } from '@/modules/staffing/ShiftEngine';
import { RosterShift } from '@/modules/staffing/RosterEngine';
import { ReportInsight } from '@/modules/reporting/NarrativeEngine';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawExecutiveBox, drawParagraph, drawHorizontalBarChart,
    drawComparisonTable, drawInsightsSection, drawMultiYearStaffingTable,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// STAFFING PDF — Comprehensive (10-14 pages)
// All tabs: Overview, Comparison, 5-Year Projection, Efficiency, Cost, Roster, Insights
// ═══════════════════════════════════════════════════════════════

export const generateStaffingPDF = async (
    country: CountryProfile,
    shiftModel: string,
    staffingResults: StaffingResult[],
    roster: RosterShift[],
    insights: ReportInsight[],
    shiftComparisons?: any[],
    fiveYearProjection?: any,
    efficiencyMetrics?: any,
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    const pg = { current: 1 };

    // ── Cover ──
    drawCoverPage(doc, 'Staffing Strategy &\nOperational Roster', `Analysis for ${country.name} Region`, {
        client: 'Internal Assessment',
        date: today(),
        version: '3.0',
        confidential: true
    }, branding);

    // ══════════════════════════════════════════════════════════════
    // EXECUTIVE SUMMARY
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Executive Summary', 'Staffing & Cost Analysis', branding);
    let y = 35;

    const totalHeads = staffingResults.reduce((acc, r) => acc + r.headcount, 0);
    const totalCost = staffingResults.reduce((acc, r) => acc + r.monthlyCost, 0);
    const avgRate = totalHeads > 0 ? totalCost / totalHeads : 0;

    drawKpiCard(doc, 14, y, 42, 24, 'Total Headcount', `${totalHeads}`, 'FTEs across all shifts');
    drawKpiCard(doc, 60, y, 42, 24, 'Monthly OPEX', fmt(totalCost), 'Gross salary + burden');
    drawKpiCard(doc, 106, y, 42, 24, 'Avg Cost / Head', fmt(avgRate), 'Monthly blended rate');
    drawKpiCard(doc, 152, y, 42, 24, 'Shift Model', shiftModel === '8h' ? '8-Hour' : '12-Hour', 'Rotation pattern');
    y += 35;

    // Narrative
    const primaryInsight = insights.find(i => i.severity === 'high') || insights[0];
    if (primaryInsight) {
        y = drawExecutiveBox(doc, y, `Strategic Recommendation: ${primaryInsight.title}`,
            primaryInsight.recommendation, primaryInsight.severity === 'high' ? 'warning' : 'info');
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §1 ROLE BREAKDOWN (Tab 1: Overview)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Role Breakdown', 'Detailed Staffing Table', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Staffing by Role', '1', branding);

    const roleRows = staffingResults.map(r => [
        r.role,
        `${r.headcount}`,
        `${r.onShiftCount}`,
        shiftModel === '8h' ? 'Continental' : '4on/4off',
        fmtMoney(r.breakdown.baseSalaries),
        fmtMoney(r.breakdown.shiftAllowance),
        fmtMoney(r.breakdown.overtime),
        fmtMoney(r.monthlyCost),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Role', 'HC', 'On-Shift', 'Schedule', 'Base Salary', 'Shift Allow.', 'OT', 'Total Cost']],
        body: roleRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
            1: { halign: 'center' }, 2: { halign: 'center' },
            4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }
        },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Schedule Pattern
    y = ensureSpace(doc, y, 40, pg);
    const patternName = shiftModel === '8h' ? '8-Hour Continental (3-Shift)' : '12-Hour 4on/4off (2-Shift)';
    const cycleLength = shiftModel === '8h' ? 28 : 8;
    const workDays = shiftModel === '8h' ? 20 : 4;
    const shiftDuration = shiftModel === '8h' ? '8 hours' : '12 hours';
    const teams = shiftModel === '8h' ? 4 : 4;
    y = drawExecutiveBox(doc, y, `Active Pattern: ${patternName}`,
        `Cycle Length: ${cycleLength} days | Work Days: ${workDays} per cycle | Shift Duration: ${shiftDuration} | Teams: ${teams}`,
        'info');

    // Cost Breakdown Chart
    y = ensureSpace(doc, y, 80, pg);
    y = drawSectionTitle(doc, y, 'Cost Distribution by Role', '1.1', branding);
    y = drawHorizontalBarChart(doc, 14, y, 180, staffingResults.map(r => ({
        label: r.role,
        value: r.monthlyCost,
        color: r.role.includes('Engineer') ? PDF_COLORS.secondary : PDF_COLORS.primary
    })), 'Monthly Cost Distribution by Role');

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §2 SHIFT COMPARISON (Tab 2: 8h vs 12h)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Shift Model Comparison', '8-Hour vs 12-Hour Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Shift Model Comparison (8h vs 12h)', '2', branding);

    if (shiftComparisons && shiftComparisons.length > 0) {
        y = drawComparisonTable(doc, y, shiftComparisons, `8-Hour vs 12-Hour Model (${country.name})`);
    } else {
        // Generate basic comparison data
        const basicComparison = [
            { metric: 'Teams Required', value8h: '4 teams', value12h: '4 teams', winner: 'tie' as const },
            { metric: 'Weekly Hours per Person', value8h: '40h', value12h: '42h', winner: '8h' as const },
            { metric: 'Overtime Risk', value8h: 'Low', value12h: 'Medium-High', winner: '8h' as const },
            { metric: 'Handover Frequency', value8h: '3/day', value12h: '2/day', winner: '12h' as const },
            { metric: 'Knowledge Continuity', value8h: 'Standard', value12h: 'Better', winner: '12h' as const },
        ];
        y = drawComparisonTable(doc, y, basicComparison, `8-Hour vs 12-Hour Model (${country.name})`);
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §3 5-YEAR PROJECTION
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, '5-Year Staffing Projection', 'Cost & Headcount Forecast', branding);
    y = 35;

    y = drawSectionTitle(doc, y, '5-Year Staffing Cost Projection', '3', branding);

    const escalation = country.economy?.laborEscalation ?? 0.05;
    const turnoverRate = 0.1;

    y = drawMultiYearStaffingTable(doc, y, totalHeads, totalCost, escalation, turnoverRate, 5);

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §4 EFFICIENCY METRICS
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Efficiency & Sensitivity', 'Operational Metrics', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Efficiency Metrics', '4', branding);

    const utilizationRate = efficiencyMetrics?.utilizationRate || 0.82;
    const totalHeadsForCost = staffingResults.reduce((acc, r) => acc + r.headcount, 0) || 1;
    const costPerMW = totalCost / totalHeadsForCost;
    const otRatio = efficiencyMetrics?.otRatio || 0.05;
    const shrinkageLoss = efficiencyMetrics?.shrinkageLoss || 0.08;

    drawKpiCard(doc, 14, y, 42, 24, 'Utilization Rate', `${(utilizationRate * 100).toFixed(0)}%`, 'Productive vs total hours');
    drawKpiCard(doc, 60, y, 42, 24, 'Cost / Head', fmt(costPerMW * 12), 'Annual per-head cost');
    drawKpiCard(doc, 106, y, 42, 24, 'OT Ratio', `${(otRatio * 100).toFixed(1)}%`, 'Overtime vs regular');
    drawKpiCard(doc, 152, y, 42, 24, 'Shrinkage', `${(shrinkageLoss * 100).toFixed(1)}%`, 'Leave + absence');
    y += 35;

    // Headcount Sensitivity
    y = drawSectionTitle(doc, y, 'Headcount Sensitivity Analysis', '4.1', branding);

    const sensitivityRows = [-20, -10, 0, 10, 20].map(pct => {
        const adjustedHC = Math.max(1, totalHeads + Math.round(totalHeads * pct / 100));
        const adjustedCost = totalCost * (adjustedHC / totalHeads);
        return [
            `${pct >= 0 ? '+' : ''}${pct}%`,
            `${adjustedHC} FTE`,
            fmtMoney(adjustedCost),
            fmtMoney(adjustedCost * 12),
            fmtMoney((adjustedCost - totalCost) * 12),
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['HC Change', 'Headcount', 'Monthly Cost', 'Annual Cost', 'Delta vs Base']],
        body: sensitivityRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.row.index === 2) {
                data.cell.styles.fillColor = [219, 234, 254]; // Highlight base
            }
        }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §5 SHIFT ROSTER (Tab: Roster)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Operational Roster', 'Shift Pattern Visualization', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Shift Rotation Schedule', '5', branding);

    const teams2 = Array.from(new Set(roster.map(r => r.team)));
    const tableData = teams2.map(team => {
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
        headStyles: { fillColor: PDF_COLORS.slate900 },
        styles: { fontSize: 8, cellPadding: 3 },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §6 STRATEGIC INSIGHTS
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Strategic Insights', 'Key Recommendations', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Strategic Insights & Recommendations', '6', branding);
    y = drawInsightsSection(doc, y, insights);

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_Staffing_Report_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
