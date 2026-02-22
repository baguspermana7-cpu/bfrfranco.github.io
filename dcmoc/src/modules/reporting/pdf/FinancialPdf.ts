
import { CountryProfile } from '@/constants/countries';
import { FinancialResult } from '@/modules/analytics/FinancialEngine';
import { RevenueResult } from '@/modules/analytics/RevenueEngine';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawExecutiveBox, drawParagraph, drawHorizontalBarChart,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// FINANCIAL PDF — Comprehensive (8-10 pages)
// Parameters, KPIs, Cashflow Table, Charts, OPEX Breakdown, Sensitivity, Break-Even
// ═══════════════════════════════════════════════════════════════

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
    const pg = { current: 1 };

    // ── Cover ──
    drawCoverPage(doc, 'Financial Feasibility\n& Revenue Analysis', `Investment Case for ${country.name}`, {
        client: 'CFO / Investment Comm.',
        date: today(),
        version: '2.0'
    }, branding);

    // ── Financial Parameters ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Financial & Revenue Parameters', 'Assumption Guidelines', branding);
    let y = 35;

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

    let col1Y = y;
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

    let col2Y = y;
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
        { label: 'Break-even Occupancy', value: `${financials.breakEvenOccupancy}%` },
        { label: 'Total NRC', value: fmtMoney(revenue.totalNRC) },
        { label: 'TCV', value: fmtMoney(revenue.contractValue) },
    ]);

    drawFooter(doc, pg.current, branding);

    // ── Executive Summary KPIs ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Financial Executive Summary', 'Key Investment & Revenue Metrics', branding);
    y = 35;

    drawKpiCard(doc, 14, y, 42, 24, 'NPV', fmtMoney(financials.npv), 'Net Present Value', financials.npv > 0 ? PDF_COLORS.secondary : PDF_COLORS.danger);
    drawKpiCard(doc, 60, y, 42, 24, 'IRR', `${financials.irr.toFixed(1)}%`, financials.irr > finInputs.discountRate * 100 ? 'Exceeds hurdle' : 'Below hurdle');
    drawKpiCard(doc, 106, y, 42, 24, 'Payback', `${financials.paybackPeriodYears.toFixed(1)} yrs`, `Discounted: ${financials.discountedPaybackYears} yrs`);
    drawKpiCard(doc, 152, y, 42, 24, 'ROI', `${financials.roiPercent.toFixed(0)}%`, `PI: ${financials.profitabilityIndex.toFixed(2)}x`);
    y += 32;

    drawKpiCard(doc, 14, y, 42, 24, 'Total NRC', fmtMoney(revenue.totalNRC), 'One-time fees');
    drawKpiCard(doc, 60, y, 42, 24, 'Lifetime MRC', fmtMoney(revenue.totalMRC_lifetime), `Over ${revInputs.contractYears} yrs`);
    drawKpiCard(doc, 106, y, 42, 24, 'TCV', fmtMoney(revenue.contractValue), 'Total Contract Value');
    drawKpiCard(doc, 152, y, 42, 24, 'Effective Rate', `$${revenue.effectiveRate.toFixed(0)}/kW/mo`, 'Blended rate');
    y += 35;

    y = drawExecutiveBox(doc, y, 'Financial Verdict',
        financials.npv > 0
            ? `Strong investment case. Positive NPV of ${fmtMoney(financials.npv)} indicates value creation above the discount rate.`
            : `Caution advised. Negative NPV of ${fmtMoney(financials.npv)} suggests returns may not meet capital cost requirements.`,
        financials.npv > 0 ? 'success' : 'warning'
    );

    drawFooter(doc, pg.current, branding);

    // ── Charts ──
    if (chartImages?.cashflow || chartImages?.waterfall || chartImages?.mrc) {
        doc.addPage(); pg.current++;
        drawModernHeader(doc, 'Visual Analysis', 'Cashflow & Revenue Charts', branding);
        y = 35;

        if (chartImages.cashflow) {
            y = drawSectionTitle(doc, y, 'Cumulative Cashflow Projection', '1', branding);
            try {
                const imgProps = doc.getImageProperties(chartImages.cashflow);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(chartImages.cashflow, 'PNG', 15, y, pdfWidth, pdfHeight);
                y += pdfHeight + 10;
            } catch (e) { console.warn('Error adding cashflow image', e); }
        }

        if (chartImages.waterfall) {
            y = ensureSpace(doc, y, 90, pg);
            y = drawSectionTitle(doc, y, 'Revenue Waterfall', '2', branding);
            try {
                const imgProps = doc.getImageProperties(chartImages.waterfall);
                const pdfWidth = 180;
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(chartImages.waterfall, 'PNG', 15, y, pdfWidth, pdfHeight);
                y += pdfHeight + 10;
            } catch (e) { console.warn('Error adding waterfall image', e); }
        }

        drawFooter(doc, pg.current, branding);
    }

    // ── Detailed Cashflow Table ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Detailed Cashflow & Revenue', 'Year-by-Year Projection', branding);
    y = 35;

    const cfRows = financials.cashflows.map((c, idx) => {
        const revYr = revenue.yearDetails?.[idx];
        return [
            `Y${c.year}`,
            fmtMoney(c.revenue),
            fmtMoney(-c.opex),
            fmtMoney(c.ebitda),
            fmtMoney(c.netIncome),
            revYr ? `${(revYr.occupancy * 100).toFixed(0)}%` : '—',
            fmtMoney(c.cumulativeCashflow)
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Period', 'Revenue', 'OPEX', 'EBITDA', 'Net Income', 'Occ%', 'Cum. CF']],
        body: cfRows,
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 1 },
        margin: { left: 14, right: 14 },
        columnStyles: {
            1: { halign: 'right', textColor: [5, 150, 105] },
            2: { halign: 'right', textColor: [220, 38, 38] },
            3: { halign: 'right', fontStyle: 'bold' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right', fontStyle: 'bold' },
        }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §NEW: OPEX BREAKDOWN
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'OPEX Breakdown', 'Operating Cost Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'OPEX Category Breakdown', '5', branding);

    const energyCost = annualOpex * 0.45;
    const staffCost = annualOpex * 0.30;
    const maintCost = annualOpex * 0.12;
    const insuranceCost = annualOpex * 0.05;
    const overheadCost = annualOpex * 0.08;

    autoTable(doc, {
        startY: y,
        head: [['Category', 'Annual Amount', '% of Total']],
        body: [
            ['Energy & Utilities', fmtMoney(energyCost), '45%'],
            ['Staffing & Labor', fmtMoney(staffCost), '30%'],
            ['Maintenance & Repairs', fmtMoney(maintCost), '12%'],
            ['Insurance', fmtMoney(insuranceCost), '5%'],
            ['Overhead & Admin', fmtMoney(overheadCost), '8%'],
            [{ content: 'Total Annual OPEX', styles: { fontStyle: 'bold' } },
             { content: fmtMoney(annualOpex), styles: { fontStyle: 'bold' } },
             { content: '100%', styles: { fontStyle: 'bold' } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // OPEX Bar Chart
    y = ensureSpace(doc, y, 70, pg);
    y = drawHorizontalBarChart(doc, 14, y, 180, [
        { label: 'Energy & Utilities', value: energyCost, color: PDF_COLORS.warning },
        { label: 'Staffing & Labor', value: staffCost, color: PDF_COLORS.primary },
        { label: 'Maintenance', value: maintCost, color: PDF_COLORS.secondary },
        { label: 'Insurance', value: insuranceCost, color: PDF_COLORS.accent },
        { label: 'Overhead', value: overheadCost, color: PDF_COLORS.slate400 },
    ], 'Annual OPEX Distribution');

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §NEW: SENSITIVITY ANALYSIS
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Sensitivity Analysis', 'NPV/IRR Under Varying Assumptions', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'NPV Sensitivity Matrix', '6', branding);

    const capexVars = [-20, -10, 0, 10, 20];
    const revVars = [-20, -10, 0, 10, 20];
    const matrixHead = ['CAPEX \\ Revenue', ...revVars.map(v => `${v >= 0 ? '+' : ''}${v}%`)];
    const matrixBody = capexVars.map(cv => {
        const row: any[] = [{ content: `${cv >= 0 ? '+' : ''}${cv}%`, styles: { fontStyle: 'bold' } }];
        revVars.forEach(rv => {
            const adjCapex = capexTotal * (1 + cv / 100);
            const adjRevPerKw = finInputs.revenuePerKwMonth * (1 + rv / 100);
            const annualRev = adjRevPerKw * 12 * itLoadKw;
            const roughNPV = (annualRev - annualOpex) * finInputs.projectLifeYears * 0.7 - adjCapex;
            const color: [number, number, number] = roughNPV > 0 ? [34, 197, 94] : [220, 38, 38];
            row.push({ content: fmt(roughNPV), styles: { textColor: color, fontSize: 6.5, halign: 'center' as const } });
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
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Break-Even Occupancy
    y = ensureSpace(doc, y, 50, pg);
    y = drawSectionTitle(doc, y, 'Break-Even Occupancy Analysis', '6.1', branding);

    const occLevels = [30, 40, 50, 60, 70, 80, 90, 100];
    const beRows = occLevels.map(occ => {
        const annualRev = finInputs.revenuePerKwMonth * 12 * itLoadKw * (occ / 100);
        const netCF = annualRev - annualOpex;
        const roughNPV = netCF * finInputs.projectLifeYears * 0.7 - capexTotal;
        const isBreakEven = occ === financials.breakEvenOccupancy;
        return [
            `${occ}%`,
            fmtMoney(annualRev),
            fmtMoney(netCF),
            fmt(roughNPV),
            isBreakEven ? '← Break-Even' : roughNPV > 0 ? 'Profitable' : 'Loss',
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['Occupancy %', 'Annual Revenue', 'Net Cashflow', 'Est. NPV', 'Status']],
        body: beRows,
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 4) {
                const txt = data.cell.text[0];
                if (txt.includes('Break-Even')) { data.cell.styles.textColor = [59, 130, 246]; data.cell.styles.fontStyle = 'bold'; }
                else if (txt === 'Profitable') data.cell.styles.textColor = [34, 197, 94];
                else data.cell.styles.textColor = [220, 38, 38];
            }
        }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    y = drawExecutiveBox(doc, y, 'Break-Even Analysis',
        `The facility breaks even at ${financials.breakEvenOccupancy}% occupancy. Operations above this threshold generate positive returns.`,
        'info');

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_Financials_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
