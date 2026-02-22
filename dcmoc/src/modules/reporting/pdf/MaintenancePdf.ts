
import { CountryProfile } from '@/constants/countries';
import { ASSETS } from '@/constants/assets';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawExecutiveBox, drawParagraph, drawHorizontalBarChart,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// MAINTENANCE PDF — Comprehensive (12-15 pages)
// All 5 tabs: Assets, Schedule, Strategy, SLA, Spares
// ═══════════════════════════════════════════════════════════════

export const generateMaintenancePDF = async (
    country: CountryProfile,
    strategyData: { strategies: any[]; recommended: string; recommendationReason: string; fiveYearSavings: number },
    slaData: { tiers: any[]; recommended: string; analysis: string },
    sparesData: { items: any[]; totalInventoryValue: number; totalAnnualConsumptionCost: number; totalHoldingCost: number; totalAnnualSparesBudget: number; criticalSpares: number; recommendations: string[] },
    schedule: any[],
    assets?: any[],
    analystNotes?: string,
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    let currentPage = 1;
    const pg = { current: currentPage };
    const assetList = assets || [];

    // ── Cover Page ──
    drawCoverPage(doc, 'Maintenance Strategy\n& Reliability Analysis', `Operational Plan for ${country.name}`, {
        client: 'Ops Director',
        date: today(),
        version: '3.0'
    }, branding);

    // ── Executive Summary ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Executive Summary', 'Maintenance Strategy Overview', branding);
    let y = 35;

    const totalAnnualBudget = strategyData.strategies.find(s => s.id === strategyData.recommended)?.totalAnnualCost || 0;
    const totalEvents = schedule.length;
    const totalHours = schedule.reduce((acc: number, e: any) => acc + (e.durationHours || 0), 0);
    const activeAssets = assetList.reduce((acc: number, a: any) => acc + (a.count || 0), 0);

    drawKpiCard(doc, 14, y, 42, 24, 'Annual Budget', fmtMoney(totalAnnualBudget), 'Recommended strategy');
    drawKpiCard(doc, 60, y, 42, 24, 'Events / Hours', `${totalEvents} / ${Math.round(totalHours)}h`, 'Annual maintenance');
    drawKpiCard(doc, 106, y, 42, 24, 'Active Assets', `${activeAssets}`, 'Total asset count');
    drawKpiCard(doc, 152, y, 42, 24, '5-Year Savings', fmtMoney(strategyData.fiveYearSavings), 'vs worst strategy');
    y += 35;

    // Narrative
    if (analystNotes) {
        y = drawParagraph(doc, y, analystNotes);
        y += 5;
    }

    y = drawExecutiveBox(doc, y, `Recommended Strategy: ${strategyData.recommended.toUpperCase()}`,
        strategyData.recommendationReason, 'success');

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §1 ASSET INVENTORY (Tab 1: Assets)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Asset Inventory', 'Facility Equipment Register', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Asset Register', '1', branding);

    // Build asset table rows with ASSETS metadata
    const assetRows = assetList.map((a: any) => {
        const template = ASSETS.find(t => t.id === a.assetId);
        if (!template) return null;
        const taskCount = template.maintenanceTasks?.length || 0;
        const annualHours = template.maintenanceTasks?.reduce((sum, t) => {
            const freq = t.frequency === 'Monthly' ? 12 : t.frequency === 'Quarterly' ? 4 : t.frequency === 'Bi-Annual' ? 2 : 1;
            return sum + t.standardHours * freq * a.count;
        }, 0) || 0;
        return [
            template.category,
            template.name,
            `${a.count}`,
            template.defaultRedundancy,
            `${Math.round(annualHours)}h`,
            `${taskCount} tasks`
        ];
    }).filter(Boolean);

    autoTable(doc, {
        startY: y,
        head: [['Category', 'Asset', 'Qty', 'Redundancy', 'Maint Hrs/yr', 'Tasks']],
        body: assetRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 0: { cellWidth: 30 }, 4: { halign: 'right' }, 5: { halign: 'center' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Asset Consumables
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'Asset Consumables & AQI Degradation', '1.1', branding);

    const consumableRows: any[] = [];
    assetList.forEach((a: any) => {
        const template = ASSETS.find(t => t.id === a.assetId);
        if (!template?.consumables) return;
        template.consumables.forEach(c => {
            const aqiFactor = (country.environment?.baselineAQI || 50) > 100 ? 0.7 : 1.0;
            consumableRows.push([
                template.name,
                c.name,
                `${c.baseLifeMonths} mo`,
                `${Math.round(c.baseLifeMonths * aqiFactor)} mo`,
                fmtMoney(c.costPerUnit),
                `${a.count * Math.ceil(12 / (c.baseLifeMonths * aqiFactor))}`,
            ]);
        });
    });

    if (consumableRows.length > 0) {
        autoTable(doc, {
            startY: y,
            head: [['Asset', 'Consumable', 'Base Life', 'Adj. Life', 'Unit Cost', 'Annual Qty']],
            body: consumableRows.slice(0, 30),
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §2 MAINTENANCE SCHEDULE (Tab 2: Schedule)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Maintenance Schedule', 'Annual Plan & Calendar', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Monthly Event Distribution', '2', branding);

    // Monthly heatmap data
    const monthlyEvents: Record<string, number[]> = {};
    schedule.forEach((e: any) => {
        const cat = e.task?.category || 'General';
        if (!monthlyEvents[cat]) monthlyEvents[cat] = new Array(12).fill(0);
        const monthIdx = Math.floor(((e.weekNumber || 1) - 1) / 4.33);
        monthlyEvents[cat][Math.min(11, Math.max(0, monthIdx))]++;
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const heatmapRows = Object.entries(monthlyEvents).map(([cat, counts]) => [
        cat, ...counts.map(c => c > 0 ? `${c}` : '—')
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Category', ...months]],
        body: heatmapRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 7 },
        bodyStyles: { fontSize: 7, halign: 'center' },
        columnStyles: { 0: { halign: 'left', cellWidth: 30 } },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index > 0) {
                const val = parseInt(data.cell.text[0]);
                if (val >= 10) data.cell.styles.fillColor = [254, 202, 202];
                else if (val >= 5) data.cell.styles.fillColor = [254, 243, 199];
                else if (val >= 1) data.cell.styles.fillColor = [220, 252, 231];
            }
        }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Schedule Detail Table
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'Schedule Detail (Top 50 Events)', '2.1', branding);

    const scheduleRows = schedule.slice(0, 50).map((e: any) => [
        e.assetName || 'N/A',
        e.task?.name || 'N/A',
        `W${e.weekNumber || 0}`,
        `${e.durationHours || 0}h`,
        `${e.techniciansRequired || 1}`,
        e.task?.criticality || 'Optimal'
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Asset', 'Task', 'Week', 'Duration', 'Techs', 'Criticality']],
        body: scheduleRows,
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 50 },
            5: { halign: 'center' }
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 5) {
                const val = data.cell.text[0];
                if (val === 'Statutory') data.cell.styles.textColor = [220, 38, 38];
                else if (val === 'Optimal') data.cell.styles.textColor = [245, 158, 11];
                else data.cell.styles.textColor = [34, 197, 94];
            }
        }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §3 STRATEGY COMPARISON (Tab 3: Strategy)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Strategy Comparison', 'Reactive vs Planned vs Predictive', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Strategy Cost & Reliability Analysis', '3', branding);

    const strategyRows = strategyData.strategies.map(s => [
        s.label || s.id,
        fmtMoney(s.annualLaborCost || 0),
        fmtMoney(s.annualPartsCost || 0),
        fmtMoney(s.annualDowntimeCost || 0),
        `${s.unplannedFailures || 0}`,
        fmtMoney(s.fiveYearNPV || 0),
        `${s.reliabilityIndex || 0}/100`,
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Strategy', 'Labor/yr', 'Parts/yr', 'Downtime Cost', 'Unplanned', '5-Yr NPV', 'Reliability']],
        body: strategyRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
            1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
            4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'center' }
        },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Strategy Recommendation Box
    y = drawExecutiveBox(doc, y, `Recommendation: ${strategyData.recommended.toUpperCase()} Maintenance`,
        `${strategyData.recommendationReason} Projected 5-year savings of ${fmtMoney(strategyData.fiveYearSavings)} compared to the least efficient strategy.`,
        'success');

    // Strategy cost comparison chart
    y = ensureSpace(doc, y, 80, pg);
    y = drawHorizontalBarChart(doc, 14, y, 180, strategyData.strategies.map(s => ({
        label: s.label || s.id,
        value: s.totalAnnualCost || 0,
        color: s.id === strategyData.recommended ? PDF_COLORS.secondary : PDF_COLORS.slate400
    })), 'Total Annual Cost by Strategy');

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §4 SLA TIER COMPARISON (Tab 4: SLA)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'SLA Tier Comparison', 'Vendor Service Level Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'SLA Tier Analysis', '4', branding);

    const slaRows = slaData.tiers.map((t: any) => [
        t.label || t.id,
        t.responseTime || 'N/A',
        fmtMoney(t.annualCost || 0),
        t.coverageScope || 'Standard',
        fmtMoney(t.riskExposure || 0),
        fmtMoney(t.breakEvenDowntimeCost || 0),
        fmtMoney(t.netAnnualCost || 0),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Tier', 'Response', 'Annual Cost', 'Coverage', 'Risk Exposure', 'Break-Even', 'Net Cost']],
        body: slaRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
            2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
            if (data.section === 'body') {
                const tier = slaData.tiers[data.row.index];
                if (tier?.recommended || tier?.id === slaData.recommended) {
                    data.cell.styles.fillColor = [220, 252, 231];
                }
            }
        }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // SLA Analysis
    y = drawExecutiveBox(doc, y, `Recommended Tier: ${slaData.recommended.toUpperCase()}`,
        slaData.analysis, 'info');

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §5 SPARE PARTS INVENTORY (Tab 5: Spares)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Spare Parts Inventory', 'Inventory Optimization & ABC Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Spare Parts Register', '5', branding);

    const sparesRows = sparesData.items.slice(0, 40).map((item: any) => [
        item.partName || item.name || 'N/A',
        item.category || 'General',
        item.criticality || 'Minor',
        `${item.quantity || 0}`,
        fmtMoney(item.unitCost || 0),
        item.leadTimeDays ? `${item.leadTimeDays}d` : 'N/A',
        `${item.reorderPoint || 0}`,
        fmtMoney(item.holdingCost || 0),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Part', 'Category', 'Criticality', 'Qty', 'Unit Cost', 'Lead Time', 'Reorder Pt', 'Holding Cost']],
        body: sparesRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 7 },
        bodyStyles: { fontSize: 6.5 },
        columnStyles: {
            0: { cellWidth: 35 },
            4: { halign: 'right' }, 7: { halign: 'right' }
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 2) {
                const val = data.cell.text[0];
                if (val === 'Critical') data.cell.styles.textColor = [220, 38, 38];
                else if (val === 'Major') data.cell.styles.textColor = [245, 158, 11];
            }
        }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ABC Classification Summary
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'ABC Classification Summary', '5.1', branding);

    const criticalItems = sparesData.items.filter((i: any) => i.criticality === 'Critical');
    const majorItems = sparesData.items.filter((i: any) => i.criticality === 'Major');
    const minorItems = sparesData.items.filter((i: any) => i.criticality === 'Minor');

    const classAValue = criticalItems.reduce((acc: number, i: any) => acc + (i.unitCost || 0) * (i.quantity || 0), 0);
    const classBValue = majorItems.reduce((acc: number, i: any) => acc + (i.unitCost || 0) * (i.quantity || 0), 0);
    const classCValue = minorItems.reduce((acc: number, i: any) => acc + (i.unitCost || 0) * (i.quantity || 0), 0);

    drawKpiCard(doc, 14, y, 55, 24, 'Class A (Critical)', `${criticalItems.length} items`, fmtMoney(classAValue), PDF_COLORS.danger);
    drawKpiCard(doc, 75, y, 55, 24, 'Class B (Major)', `${majorItems.length} items`, fmtMoney(classBValue), PDF_COLORS.warning);
    drawKpiCard(doc, 136, y, 55, 24, 'Class C (Minor)', `${minorItems.length} items`, fmtMoney(classCValue), PDF_COLORS.secondary);
    y += 35;

    // Recommendations
    if (sparesData.recommendations && sparesData.recommendations.length > 0) {
        y = ensureSpace(doc, y, 40, pg);
        const recText = sparesData.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n');
        y = drawExecutiveBox(doc, y, 'Inventory Recommendations', recText, 'info');
    }

    // Spares Budget Summary
    y = ensureSpace(doc, y, 40, pg);
    y = drawSectionTitle(doc, y, 'Spares Budget Summary', '5.2', branding);

    drawKpiCard(doc, 14, y, 55, 24, 'Inventory Value', fmtMoney(sparesData.totalInventoryValue), 'Capital locked in spares', PDF_COLORS.accent);
    drawKpiCard(doc, 75, y, 55, 24, 'Annual Holding', fmtMoney(sparesData.totalHoldingCost), '15% of inventory value', PDF_COLORS.warning);
    drawKpiCard(doc, 136, y, 55, 24, 'Annual Budget', fmtMoney(sparesData.totalAnnualSparesBudget), 'Consumption + holding', PDF_COLORS.secondary);

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_Maintenance_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
