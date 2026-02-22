
import { CountryProfile } from '@/constants/countries';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawExecutiveBox, drawParagraph,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// PHASED FINANCIAL PDF — Comprehensive (8-10 pages)
// Phase Summary, Blended Cashflow, Scenario Comparison, IDC, Cross-Module
// ═══════════════════════════════════════════════════════════════

export const generatePhasedFinancialPDF = async (
    country: CountryProfile,
    phasedData: {
        phaseResults: any[];
        blendedIRR: number;
        totalNPV: number;
        weightedPayback: number;
        totalInvestment: number;
        profitabilityIndex: number;
        scenarios?: any[];
        idcData?: any[];
        totalIDC?: number;
        crossModuleAdjustments?: any[];
        blendedCashflows?: any[];
        narrative?: string;
    },
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    const pg = { current: 1 };
    const pd = phasedData;

    // ── Cover ──
    drawCoverPage(doc, 'Phased Financial Analysis\n& Investment Timing', `Multi-Phase Strategy for ${country.name}`, {
        client: 'Finance & Strategy',
        date: today(),
        version: '1.0',
        confidential: true
    }, branding);

    // ── Executive Summary ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Executive Summary', 'Phased Investment Overview', branding);
    let y = 35;

    const irrColor: [number, number, number] = pd.blendedIRR > 15 ? PDF_COLORS.secondary : pd.blendedIRR > 8 ? PDF_COLORS.warning : PDF_COLORS.danger;
    drawKpiCard(doc, 14, y, 35, 24, 'Blended IRR', `${pd.blendedIRR?.toFixed(1) || 'N/A'}%`, 'Weighted by CAPEX', irrColor);
    drawKpiCard(doc, 53, y, 35, 24, 'Total NPV', fmtMoney(pd.totalNPV || 0), 'Combined phases', pd.totalNPV > 0 ? PDF_COLORS.secondary : PDF_COLORS.danger);
    drawKpiCard(doc, 92, y, 35, 24, 'Payback', `${pd.weightedPayback?.toFixed(1) || 'N/A'} yr`, 'Weighted average');
    drawKpiCard(doc, 131, y, 30, 24, 'Investment', fmt(pd.totalInvestment), 'Total CAPEX');
    drawKpiCard(doc, 165, y, 29, 24, 'PI', `${pd.profitabilityIndex?.toFixed(2) || 'N/A'}x`, 'Profitability');
    y += 35;

    // Narrative
    if (pd.narrative) {
        y = drawParagraph(doc, y, pd.narrative);
        y += 5;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §1 PHASE SUMMARY
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Phase Summary', 'Investment Decision Matrix', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Per-Phase Investment Decision', '1', branding);

    if (pd.phaseResults && pd.phaseResults.length > 0) {
        const phaseRows = pd.phaseResults.map((pr: any) => {
            const decision = (pr.irr || 0) >= 12 ? 'GO' : (pr.irr || 0) >= 8 ? 'CONDITIONAL' : 'NO-GO';
            return [
                pr.label || `Phase ${pr.id || '?'}`,
                fmtMoney(pr.capex || 0),
                `${pr.irr?.toFixed(1) || 'N/A'}%`,
                fmtMoney(pr.npv || 0),
                `${pr.payback?.toFixed(1) || 'N/A'} yr`,
                decision,
            ];
        });

        autoTable(doc, {
            startY: y,
            head: [['Phase', 'CAPEX', 'IRR', 'NPV', 'Payback', 'Decision']],
            body: phaseRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }
            },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 5) {
                    const val = data.cell.text[0];
                    if (val === 'GO') { data.cell.styles.textColor = [34, 197, 94]; data.cell.styles.fontStyle = 'bold'; }
                    else if (val === 'CONDITIONAL') { data.cell.styles.textColor = [245, 158, 11]; data.cell.styles.fontStyle = 'bold'; }
                    else { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §2 BLENDED CASHFLOW
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Blended Cashflow', 'Combined Phase Projection', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Blended Cashflow Table', '2', branding);

    if (pd.blendedCashflows && pd.blendedCashflows.length > 0) {
        const cfRows = pd.blendedCashflows.slice(0, 15).map((cf: any) => [
            `Year ${cf.year}`,
            fmtMoney(cf.revenue || 0),
            fmtMoney(cf.opex || 0),
            fmtMoney((cf.revenue || 0) - (cf.opex || 0)),
            fmtMoney(cf.cumulativeCashflow || 0),
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Year', 'Revenue', 'OPEX', 'Net Cashflow', 'Cumulative']],
            body: cfRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: {
                1: { halign: 'right', textColor: [5, 150, 105] },
                2: { halign: 'right', textColor: [220, 38, 38] },
                3: { halign: 'right' },
                4: { halign: 'right' },
            },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 4) {
                    const text = data.cell.text[0];
                    const val = parseFloat(text.replace(/[^-\d.]/g, ''));
                    data.cell.styles.textColor = val >= 0 ? [5, 150, 105] : [220, 38, 38];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §3 SCENARIO COMPARISON
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Scenario Comparison', 'Conservative / Base / Aggressive', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Scenario Analysis', '3', branding);

    if (pd.scenarios && pd.scenarios.length > 0) {
        const scenarioRows = pd.scenarios.map((s: any) => [
            s.name || s.label || 'N/A',
            `${s.irr?.toFixed(1) || 'N/A'}%`,
            fmtMoney(s.npv || 0),
            `${s.payback?.toFixed(1) || 'N/A'} yr`,
            fmtMoney(s.capex || pd.totalInvestment || 0),
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Scenario', 'IRR', 'NPV', 'Payback', 'CAPEX']],
            body: scenarioRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }
            },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // Scenario Parameters
        y = ensureSpace(doc, y, 50, pg);
        y = drawSectionTitle(doc, y, 'Scenario Parameters', '3.1', branding);

        const paramRows = pd.scenarios.map((s: any) => [
            s.name || s.label || 'N/A',
            `${(s.revenueMultiplier || 1).toFixed(2)}x`,
            `${(s.capexMultiplier || 1).toFixed(2)}x`,
            `${s.occupancyDelay || 0} months`,
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Scenario', 'Revenue Multiplier', 'CAPEX Multiplier', 'Occupancy Delay']],
            body: paramRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §4 CONSTRUCTION FINANCING (IDC)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Construction Financing', 'Interest During Construction (IDC)', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'IDC Breakdown by Phase', '4', branding);

    if (pd.idcData && pd.idcData.length > 0) {
        const idcRows = pd.idcData.map((idc: any) => [
            idc.label || idc.phase || 'N/A',
            fmtMoney(idc.capex || 0),
            `${idc.drawMonths || 0} mo`,
            fmtMoney(idc.monthlyDraw || 0),
            fmtMoney(idc.idcAmount || 0),
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Phase', 'CAPEX', 'Draw Period', 'Monthly Draw', 'IDC Amount']],
            body: idcRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: {
                1: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }
            },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // IDC Summary
    if (pd.totalIDC !== undefined) {
        y = drawExecutiveBox(doc, y, 'Construction Financing Summary',
            `Total Interest During Construction (IDC): ${fmtMoney(pd.totalIDC)}. ` +
            `Effective total CAPEX including IDC: ${fmtMoney(pd.totalInvestment + pd.totalIDC)}.`,
            'info');
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §5 CROSS-MODULE ADJUSTMENTS
    // ══════════════════════════════════════════════════════════════
    if (pd.crossModuleAdjustments && pd.crossModuleAdjustments.length > 0) {
        doc.addPage(); pg.current++;
        drawModernHeader(doc, 'Cross-Module Adjustments', 'External Factor Impacts', branding);
        y = 35;

        y = drawSectionTitle(doc, y, 'Cross-Module Adjustments', '5', branding);

        const adjRows = pd.crossModuleAdjustments.map((adj: any) => [
            adj.adjustment || adj.name || 'N/A',
            adj.sourceModule || adj.source || 'N/A',
            adj.impact || adj.description || 'N/A',
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Adjustment', 'Source Module', 'Impact on Returns']],
            body: adjRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            margin: { left: 14, right: 14 }
        });

        drawFooter(doc, pg.current, branding);
    }

    savePdf(doc, `DCMOC_PhasedFinancial_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
