
import { CountryProfile } from '@/constants/countries';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawExecutiveBox, drawParagraph,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// ASSET LIFECYCLE PDF — Comprehensive (10-12 pages)
// All 4 views: Depreciation, Replacement Timeline, Health & Risk, Asset Detail
// ═══════════════════════════════════════════════════════════════

export const generateAssetLifecyclePDF = async (
    country: CountryProfile,
    result: any, // AssetLifecycleResult
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    const pg = { current: 1 };

    // ── Cover ──
    drawCoverPage(doc, 'Asset Lifecycle &\nDepreciation Analysis', `Portfolio Assessment for ${country.name}`, {
        client: 'Asset Management',
        date: today(),
        version: '1.0',
        confidential: true
    }, branding);

    // ── Executive Summary ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Executive Summary', 'Asset Portfolio Overview', branding);
    let y = 35;

    drawKpiCard(doc, 14, y, 42, 24, 'Total Acquisition', fmtMoney(result.totalAcquisitionCost), 'Initial CAPEX');
    drawKpiCard(doc, 60, y, 42, 24, '25-Year Lifecycle', fmtMoney(result.totalLifecycleCost25yr), 'Total lifecycle cost');
    drawKpiCard(doc, 106, y, 42, 24, 'Annual Refresh', fmtMoney(result.annualCapexRefresh), 'Average per year');
    drawKpiCard(doc, 152, y, 42, 24, 'NPV Replacements', fmtMoney(result.npvOfReplacements), 'Discounted');
    y += 35;

    // Portfolio Summary Narrative
    const ps = result.portfolioSummary;
    if (ps) {
        const narrative = `The facility operates ${result.assets.length} asset categories with a total acquisition cost of ${fmtMoney(result.totalAcquisitionCost)}. ` +
            `Peak replacement spending of ${fmtMoney(ps.peakSpendAmount)} occurs in Year ${ps.peakSpendYear}. ` +
            `The next major replacement is ${ps.nextReplacement?.name || 'N/A'} in Year ${ps.nextReplacement?.year || 'N/A'} at ${fmtMoney(ps.nextReplacement?.cost || 0)}. ` +
            `Depreciation method: ${result.depreciationMethod}.`;
        y = drawParagraph(doc, y, narrative);
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §1 ASSET INVENTORY (Tab 4: Asset Detail)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Asset Inventory', 'Complete Equipment Register', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Asset Register', '1', branding);

    const assetRows = result.assets.map((a: any) => [
        a.name,
        `${a.count}`,
        `${a.usefulLifeYears} yr`,
        fmtMoney(a.unitCost),
        fmtMoney(a.totalAcquisitionCost),
        fmtMoney(a.annualDepreciation),
        `Year ${a.replacementYear}`,
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Asset', 'Qty', 'Useful Life', 'Unit Cost', 'Total Cost', 'Annual Depr.', 'Replace Yr']],
        body: assetRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
            1: { halign: 'center' }, 2: { halign: 'center' },
            3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }
        },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §2 DEPRECIATION SCHEDULE (Tab 1)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Depreciation Schedule', `${result.depreciationMethod} Method`, branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Annual Depreciation by Category', '2', branding);

    if (result.annualDepreciationSchedule && result.annualDepreciationSchedule.length > 0) {
        // Get category names
        const categories = Object.keys(result.annualDepreciationSchedule[0].byCategory || {});

        const depRows = result.annualDepreciationSchedule.slice(0, 25).map((yr: any) => {
            const row: any[] = [`Year ${yr.year}`];
            categories.forEach(cat => {
                row.push(yr.byCategory[cat] > 0 ? fmt(yr.byCategory[cat]) : '—');
            });
            row.push(fmtMoney(yr.total));
            return row;
        });

        autoTable(doc, {
            startY: y,
            head: [['Year', ...categories.map(c => c.substring(0, 12)), 'Total']],
            body: depRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 6.5 },
            bodyStyles: { fontSize: 6.5 },
            columnStyles: Object.fromEntries(
                [...Array(categories.length + 2).keys()].slice(1).map(i => [i, { halign: 'right' as const }])
            ),
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Book Value Summary
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'Book Value & Cumulative Replacement', '2.1', branding);

    if (result.bookValueCurve && result.bookValueCurve.length > 0) {
        const bvRows = result.bookValueCurve
            .filter((_: any, i: number) => i % 5 === 0 || i === result.bookValueCurve.length - 1)
            .map((bv: any) => [
                `Year ${bv.year}`,
                fmtMoney(bv.bookValue),
                fmtMoney(bv.cumulativeReplacement),
            ]);

        autoTable(doc, {
            startY: y,
            head: [['Year', 'Book Value', 'Cumulative Replacement']],
            body: bvRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §3 REPLACEMENT TIMELINE (Tab 2)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Replacement Timeline', '25-Year CAPEX Refresh Plan', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Replacement Schedule', '3', branding);

    if (result.replacementTimeline && result.replacementTimeline.length > 0) {
        const replRows = result.replacementTimeline.map((e: any) => [
            `Year ${e.year}`,
            e.assetName,
            e.category,
            `${e.count}`,
            fmtMoney(e.cost),
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Year', 'Asset', 'Category', 'Count', 'Cost']],
            body: replRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Peak Year Highlight
    if (ps) {
        y = ensureSpace(doc, y, 30, pg);
        y = drawExecutiveBox(doc, y, `Peak Replacement Year: Year ${ps.peakSpendYear}`,
            `Peak replacement spending of ${fmtMoney(ps.peakSpendAmount)} occurs in Year ${ps.peakSpendYear}. Plan cash reserves or credit facilities accordingly.`,
            'warning');
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §4 HEALTH & RISK ASSESSMENT (Tab 3)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Asset Health Assessment', 'Risk & Condition Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Asset Health Scores', '4', branding);

    if (result.healthScores && result.healthScores.length > 0) {
        const healthRows = result.healthScores.map((h: any) => [
            h.name,
            h.category || 'N/A',
            `${h.healthPct}%`,
            h.riskLevel,
            `${h.remainingLife.toFixed(1)} yr`,
            `${(h.failureProbability * 100).toFixed(1)}%`,
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Asset', 'Category', 'Health %', 'Risk Level', 'Remaining Life', 'Failure Prob.']],
            body: healthRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 2: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 3) {
                    const val = data.cell.text[0];
                    if (val === 'critical') data.cell.styles.textColor = [220, 38, 38];
                    else if (val === 'high') data.cell.styles.textColor = [245, 158, 11];
                    else if (val === 'medium') data.cell.styles.textColor = [59, 130, 246];
                    else data.cell.styles.textColor = [34, 197, 94];
                }
                if (data.section === 'body' && data.column.index === 2) {
                    const pct = parseInt(data.cell.text[0]);
                    if (pct <= 30) data.cell.styles.fillColor = [254, 202, 202];
                    else if (pct <= 60) data.cell.styles.fillColor = [254, 243, 199];
                    else data.cell.styles.fillColor = [220, 252, 231];
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Risk Events
    if (result.riskEvents && result.riskEvents.length > 0) {
        y = ensureSpace(doc, y, 60, pg);
        y = drawSectionTitle(doc, y, 'Risk Events Timeline', '4.1', branding);

        const riskEventRows = result.riskEvents.slice(0, 15).map((e: any) => [
            `Year ${e.year}`,
            e.description,
            e.severity,
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Year', 'Event Description', 'Severity']],
            body: riskEventRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 2) {
                    const val = data.cell.text[0];
                    if (val === 'critical') data.cell.styles.textColor = [220, 38, 38];
                    else if (val === 'high') data.cell.styles.textColor = [245, 158, 11];
                    else data.cell.styles.textColor = [34, 197, 94];
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §5 FINANCIAL IMPACT
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Financial Impact', 'Replacement Strategy Comparison', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Replacement Strategy Comparison', '5', branding);

    const fi = result.financialImpact;
    if (fi) {
        drawKpiCard(doc, 14, y, 42, 24, 'Early (-2yr)', fmtMoney(fi.earlyReplacementNpv), 'Proactive NPV', PDF_COLORS.info);
        drawKpiCard(doc, 60, y, 42, 24, 'On-Time', fmtMoney(result.npvOfReplacements), 'Baseline NPV', PDF_COLORS.secondary);
        drawKpiCard(doc, 106, y, 42, 24, 'Deferred (+2yr)', fmtMoney(fi.deferredReplacementNpv), 'Deferred NPV', PDF_COLORS.warning);
        drawKpiCard(doc, 152, y, 42, 24, 'Aging Maint Cost', fmtMoney(fi.maintenanceCostOfAging), 'Extra OPEX risk', PDF_COLORS.danger);
        y += 35;

        // Strategy Recommendation
        const bestStrategy = fi.savingsFromEarly > 0 ? 'early replacement' : 'on-time replacement';
        y = drawExecutiveBox(doc, y, 'Optimal Replacement Strategy',
            `Analysis indicates ${bestStrategy} is optimal. Early replacement saves ${fmtMoney(Math.abs(fi.savingsFromEarly))} in NPV terms versus deferral, ` +
            `while avoiding an estimated ${fmtMoney(fi.maintenanceCostOfAging)} in accelerated maintenance costs from aging equipment.`,
            fi.savingsFromEarly > 0 ? 'success' : 'info');
    }

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_AssetLifecycle_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
