
import { CountryProfile } from '@/constants/countries';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawExecutiveBox, drawParagraph,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// INVESTMENT PDF — Comprehensive (12-16 pages)
// All 6 tabs: Capitalization, Returns/DSCR, Valuation, IPO/Acquisition, Readiness, Sensitivity
// ═══════════════════════════════════════════════════════════════

export const generateInvestmentPDF = async (
    country: CountryProfile,
    investmentData: any, // InvestmentResult
    inputs: any, // InvestmentInputs
    financials: any, // FinancialResult
    capexTotal: number,
    itLoadKw: number,
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    const pg = { current: 1 };
    const inv = investmentData;

    // ── Cover ──
    drawCoverPage(doc, 'Investment Analysis\n& Capital Structure', `Investment Case for ${country.name}`, {
        client: 'Investment Committee',
        date: today(),
        version: '1.0',
        confidential: true
    }, branding);

    // ── Executive Summary ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Executive Summary', 'Investment Thesis Overview', branding);
    let y = 35;

    drawKpiCard(doc, 14, y, 28, 24, 'Total CAPEX', fmtMoney(capexTotal), 'Investment', PDF_COLORS.accent);
    drawKpiCard(doc, 46, y, 28, 24, 'Debt', fmtMoney(inv.totalDebt || 0), `${((inputs.debtRatio || 0.6) * 100).toFixed(0)}%`);
    drawKpiCard(doc, 78, y, 28, 24, 'Equity', fmtMoney(inv.totalEquity || 0), `${((1 - (inputs.debtRatio || 0.6)) * 100).toFixed(0)}%`);
    drawKpiCard(doc, 110, y, 28, 24, 'WACC', `${(inv.wacc * 100).toFixed(1)}%`, 'Weighted avg');
    drawKpiCard(doc, 142, y, 24, 24, 'Eq. IRR', `${inv.equityIRR.toFixed(1)}%`, 'Return', PDF_COLORS.secondary);
    drawKpiCard(doc, 170, y, 24, 24, 'MOIC', `${inv.moic.toFixed(2)}x`, 'Multiple', PDF_COLORS.secondary);
    y += 35;

    // Narrative
    const irrLabel = inv.equityIRR > 15 ? 'strong' : inv.equityIRR > 10 ? 'adequate' : 'below threshold';
    const narrative = `This ${fmtMoney(capexTotal)} investment in ${country.name} is structured with a ${((inputs.debtRatio || 0.6) * 100).toFixed(0)}% debt / ${((1 - (inputs.debtRatio || 0.6)) * 100).toFixed(0)}% equity split. The weighted average cost of capital (WACC) is ${(inv.wacc * 100).toFixed(1)}%. Equity returns are ${irrLabel} at ${inv.equityIRR.toFixed(1)}% IRR with a ${inv.moic.toFixed(2)}x MOIC over the investment horizon. Minimum DSCR of ${inv.minDSCR.toFixed(2)}x ${inv.minDSCR >= 1.25 ? 'provides adequate debt coverage' : 'raises debt service concerns'}.`;
    y = drawParagraph(doc, y, narrative);

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §1 CAPITAL STRUCTURE (Tab 1: Capitalization)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Capital Structure', 'Debt/Equity Split & Parameters', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Capital Structure', '1', branding);

    autoTable(doc, {
        startY: y,
        head: [['Parameter', 'Value']],
        body: [
            ['Total CAPEX', fmtMoney(capexTotal)],
            ['Debt Ratio', `${((inputs.debtRatio || 0.6) * 100).toFixed(0)}%`],
            ['Total Debt', fmtMoney(inv.totalDebt || 0)],
            ['Total Equity', fmtMoney(inv.totalEquity || 0)],
            ['Interest Rate', `${((inputs.debtCostAnnual || 0.05) * 100).toFixed(1)}%`],
            ['Debt Term', `${inputs.debtTermYears || 10} years`],
            ['Equity Cost of Capital', `${((inputs.equityCostOfCapital || 0.12) * 100).toFixed(1)}%`],
            ['WACC', `${(inv.wacc * 100).toFixed(2)}%`],
            ['Annual Debt Payment', fmtMoney(inv.annualDebtPayment || 0)],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Amortization Schedule
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'Debt Amortization Schedule', '1.1', branding);

    if (inv.debtSchedule && inv.debtSchedule.length > 0) {
        const amortRows = inv.debtSchedule.map((r: any) => [
            `Year ${r.year}`,
            fmtMoney(r.openingBalance),
            fmtMoney(r.payment),
            fmtMoney(r.interest),
            fmtMoney(r.principal),
            fmtMoney(r.closingBalance),
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Year', 'Opening Bal.', 'Payment', 'Interest', 'Principal', 'Closing Bal.']],
            body: amortRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §2 RETURNS & DSCR (Tab 2)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Returns & Debt Service', 'Equity Performance Metrics', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Key Return Metrics', '2', branding);

    drawKpiCard(doc, 14, y, 42, 24, 'Equity IRR', `${inv.equityIRR.toFixed(1)}%`, 'Internal rate of return', inv.equityIRR > 15 ? PDF_COLORS.secondary : PDF_COLORS.warning);
    drawKpiCard(doc, 60, y, 42, 24, 'MOIC', `${inv.moic.toFixed(2)}x`, 'Multiple on invested capital');
    drawKpiCard(doc, 106, y, 42, 24, 'Min DSCR', `${inv.minDSCR.toFixed(2)}x`, inv.minDSCR >= 1.25 ? 'Above 1.25x threshold' : 'Below 1.25x threshold', inv.minDSCR >= 1.25 ? PDF_COLORS.secondary : PDF_COLORS.danger);
    drawKpiCard(doc, 152, y, 42, 24, 'Y1 Cash-on-Cash', `${(inv.year1CashOnCash * 100).toFixed(1)}%`, 'Year 1 yield');
    y += 35;

    // DSCR Timeline Table
    y = drawSectionTitle(doc, y, 'DSCR Timeline', '2.1', branding);

    if (inv.leveredFCFTable && inv.leveredFCFTable.length > 0) {
        const dscrRows = inv.leveredFCFTable.map((r: any) => [
            `Year ${r.year}`,
            fmtMoney(r.unleveredFCF),
            fmtMoney(r.debtService),
            fmtMoney(r.leveredFCF),
            fmtMoney(r.cumulativeLevered),
            `${(r.cashOnCashPct * 100).toFixed(1)}%`,
            `${r.dscr.toFixed(2)}x`,
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Year', 'Unlev. FCF', 'Debt Service', 'Lev. FCF', 'Cumulative', 'CoC %', 'DSCR']],
            body: dscrRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: {
                1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
                4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'center' }
            },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 6) {
                    const val = parseFloat(data.cell.text[0]);
                    if (val < 1.25) data.cell.styles.textColor = [220, 38, 38];
                    else data.cell.styles.textColor = [34, 197, 94];
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §3 VALUATION (Tab 3)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Valuation Analysis', 'Multi-Method Assessment', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Valuation Methods', '3', branding);

    if (inv.valuation) {
        autoTable(doc, {
            startY: y,
            head: [['Method', 'Implied Value', '$/kW']],
            body: [
                ['EV/EBITDA Multiple', fmtMoney(inv.valuation.evEbitda), `$${Math.round(inv.valuation.evEbitda / itLoadKw).toLocaleString()}`],
                ['Cap Rate Method', fmtMoney(inv.valuation.capRateVal), `$${Math.round(inv.valuation.capRateVal / itLoadKw).toLocaleString()}`],
                ['$/kW Implied', fmtMoney(inv.valuation.perKwVal), `$${Math.round(inv.valuation.dollarPerKw).toLocaleString()}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Exit Waterfall
    y = ensureSpace(doc, y, 50, pg);
    y = drawSectionTitle(doc, y, 'Exit Waterfall', '3.1', branding);

    autoTable(doc, {
        startY: y,
        head: [['Component', 'Value']],
        body: [
            ['Stabilized EBITDA', fmtMoney(inv.stabilizedEBITDA || 0)],
            [`Exit EV (${inputs.exitEbitdaMultiple || 15}x EBITDA)`, fmtMoney(inv.exitEV || 0)],
            ['Less: Remaining Debt', `(${fmtMoney(inv.exitRemainingDebt || 0)})`],
            [{ content: 'Equity Value at Exit', styles: { fontStyle: 'bold' } }, { content: fmtMoney(inv.exitEquityValue || 0), styles: { fontStyle: 'bold' } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Terminal Value Sensitivity
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'Terminal Value Sensitivity', '3.2', branding);

    const noi = inv.stabilizedNOI || inv.stabilizedEBITDA || 0;
    const capRates = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0];
    const termRows = capRates.map(cr => {
        const tv = noi / (cr / 100);
        const perKw = tv / itLoadKw;
        const vsCurrent = capexTotal > 0 ? ((tv / capexTotal - 1) * 100).toFixed(0) : '—';
        return [`${cr.toFixed(1)}%`, fmtMoney(tv), `$${Math.round(perKw).toLocaleString()}/kW`, `${vsCurrent}%`];
    });

    autoTable(doc, {
        startY: y,
        head: [['Cap Rate', 'Terminal Value', '$/kW', 'vs Current CAPEX']],
        body: termRows,
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §4 IPO/ACQUISITION (Tab 4)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'IPO & Acquisition Analysis', 'Exit Strategy Pricing', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'IPO / Acquisition Pricing', '4', branding);

    autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
            ['Implied IPO Price', fmtMoney(inv.ipoPrice || 0)],
            ['Control Premium', `${((inputs.controlPremiumPct || 0.2) * 100).toFixed(0)}%`],
            ['Pre-Money Valuation', fmtMoney(inv.exitEV || 0)],
            ['$/kW Implied', `$${Math.round((inv.ipoPrice || 0) / itLoadKw).toLocaleString()}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Acquisition Sensitivity
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'Acquisition Sensitivity', '4.1', branding);

    if (inv.acquisitionTable && inv.acquisitionTable.length > 0) {
        const acqRows = inv.acquisitionTable.map((r: any) => [
            `${r.multiple}x`,
            fmtMoney(r.enterpriseValue),
            fmtMoney(r.equityValue),
            `$${Math.round(r.impliedDollarPerKw).toLocaleString()}/kW`,
        ]);

        autoTable(doc, {
            startY: y,
            head: [['EV/EBITDA', 'Enterprise Value', 'Equity Value', '$/kW']],
            body: acqRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §5 INVESTMENT READINESS (Tab 5)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Investment Readiness', 'Due Diligence Checklist', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Readiness Assessment', '5', branding);

    drawKpiCard(doc, 14, y, 55, 24, 'Readiness Score', `${inv.readinessScore}/100`, inv.readinessLabel || 'N/A',
        inv.readinessScore >= 70 ? PDF_COLORS.secondary : inv.readinessScore >= 40 ? PDF_COLORS.warning : PDF_COLORS.danger);
    y += 35;

    if (inv.readinessChecks && inv.readinessChecks.length > 0) {
        const checkRows = inv.readinessChecks.map((c: any) => [
            c.label,
            c.target,
            c.actual,
            c.pass ? '✓ PASS' : '✗ FAIL',
            `${(c.weight * 100).toFixed(0)}%`,
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Criteria', 'Target', 'Actual', 'Status', 'Weight']],
            body: checkRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 4: { halign: 'center' } },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 3) {
                    const pass = data.cell.text[0].includes('PASS');
                    data.cell.styles.textColor = pass ? [34, 197, 94] : [220, 38, 38];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §6 SENSITIVITY MATRIX (Tab 6)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Sensitivity Analysis', 'Equity IRR Matrix', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Equity IRR Sensitivity Matrix', '6', branding);

    if (inv.sensitivityMatrix && inv.sensitivityMatrix.length > 0) {
        // Build pivot table: debt ratios as rows, exit multiples as columns
        const debtRatios = Array.from(new Set<number>(inv.sensitivityMatrix.map((c: any) => c.debtRatio))).sort((a, b) => a - b);
        const exitMultiples = Array.from(new Set<number>(inv.sensitivityMatrix.map((c: any) => c.exitMultiple))).sort((a, b) => a - b);

        const matrixHead = ['Debt Ratio \\ Exit Multiple', ...exitMultiples.map((m: number) => `${m}x`)];
        const matrixBody = debtRatios.map((dr: number) => {
            const row: any[] = [{ content: `${(dr * 100).toFixed(0)}%`, styles: { fontStyle: 'bold' } }];
            exitMultiples.forEach((em: number) => {
                const cell = inv.sensitivityMatrix.find((c: any) => c.debtRatio === dr && c.exitMultiple === em);
                const irr = cell ? cell.equityIRR : 0;
                const color: [number, number, number] = irr >= 20 ? [34, 197, 94] : irr >= 12 ? [245, 158, 11] : [220, 38, 38];
                row.push({ content: `${irr.toFixed(1)}%`, styles: { textColor: color, fontStyle: 'bold', halign: 'center' as const } });
            });
            return row;
        });

        autoTable(doc, {
            startY: y,
            head: [matrixHead],
            body: matrixBody,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 7, halign: 'center' },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 0: { cellWidth: 35 } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Key Variable Impacts
    y = ensureSpace(doc, y, 50, pg);
    y = drawSectionTitle(doc, y, 'Key Variable Impact Analysis', '6.1', branding);

    autoTable(doc, {
        startY: y,
        head: [['Variable', 'Impact Level', 'Description']],
        body: [
            ['Debt Ratio', 'High', 'Higher leverage amplifies equity returns but increases risk'],
            ['Exit Multiple', 'High', 'Directly impacts terminal value and MOIC'],
            ['Interest Rate', 'Medium', 'Affects debt service coverage and levered cash flow'],
            ['Occupancy Ramp', 'Medium', 'Slower ramp-up delays cash generation'],
            ['Revenue/kW', 'High', 'Primary driver of NOI and EBITDA'],
            ['OPEX Escalation', 'Low-Medium', 'Compounding effect on long-term profitability'],
        ],
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 }
    });

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_Investment_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
