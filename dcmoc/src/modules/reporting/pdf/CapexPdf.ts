
import { CountryProfile } from '@/constants/countries';
import { CapexResult, CapexInput } from '@/lib/CapexEngine';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawParagraph,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// CAPEX PDF — Comprehensive (6-7 pages)
// Config, KPIs, Cost Breakdown, Timeline, L2 Gantt, Full Config
// ═══════════════════════════════════════════════════════════════

export const generateCapexPDF = async (
    country: CountryProfile,
    capex: CapexResult,
    narrative: string,
    inputs: CapexInput,
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    const pg = { current: 1 };

    // ── Cover ──
    drawCoverPage(doc, 'Capital Expenditure\nReport', `Budget Estimation for ${country.name}`, {
        client: 'Finance Dept',
        date: today(),
        version: '3.1'
    }, branding);

    // ── Project Config ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Project Configuration', 'Facility Design & Inputs', branding);
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

    let col2Y = y;
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

    drawFooter(doc, pg.current, branding);

    // ── KPIs & Narrative ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Executive Summary', `Total CAPEX: ${fmtMoney(capex.total)}`, branding);
    y = 35;

    const { metrics, timeline } = capex;

    drawKpiCard(doc, 14, y, 42, 24, 'Total CAPEX', fmtMoney(capex.total), 'Estimated total');
    drawKpiCard(doc, 60, y, 42, 24, 'Cost per kW', `$${Math.round(metrics.perKw).toLocaleString()}`, metrics.perKw < 8000 ? 'Low Cost' : 'Standard');
    drawKpiCard(doc, 106, y, 42, 24, 'PUE Target', capex.pue.toFixed(2), capex.pue < 1.3 ? 'Best-in-Class' : 'Good');
    drawKpiCard(doc, 152, y, 42, 24, 'Timeline', `${timeline.totalMonths} Mo`, 'Design to Commission');
    y += 32;

    drawKpiCard(doc, 14, y, 42, 24, 'Total Racks', `${metrics.racks}`, 'IT equipment');
    drawKpiCard(doc, 60, y, 42, 24, 'Floor Space', `${Math.round(metrics.floorSpace).toLocaleString()} m²`, 'White space');
    drawKpiCard(doc, 106, y, 42, 24, 'Annual Energy', fmtMoney(metrics.annualEnergy), '@ $0.10/kWh');
    drawKpiCard(doc, 152, y, 42, 24, 'Soft Costs', fmtMoney((capex.softCosts.design || 0) + (capex.softCosts.pm || 0)), 'Design & PM');
    y += 35;

    // Narrative
    y = drawParagraph(doc, y, narrative.replace(/\*\*/g, ''));

    drawFooter(doc, pg.current, branding);

    // ── Cost Breakdown ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Cost Breakdown', 'Detailed CAPEX Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Cost Breakdown', '1', branding);

    const sortedCosts = Object.entries(capex.costs).sort(([, a], [, b]) => (b as number) - (a as number));
    const costRows: any[] = sortedCosts.map(([k, v]) => [
        k.replace(/([A-Z])/g, ' $1').trim(),
        fmtMoney(v as number),
        `${(((v as number) / capex.total) * 100).toFixed(1)}%`
    ]);
    if (capex.softCosts.design) costRows.push(['Design Fee', fmtMoney(capex.softCosts.design), `${((capex.softCosts.design / capex.total) * 100).toFixed(1)}%`]);
    if (capex.softCosts.pm) costRows.push(['PM Fee', fmtMoney(capex.softCosts.pm), `${((capex.softCosts.pm / capex.total) * 100).toFixed(1)}%`]);
    if (capex.contingency) costRows.push(['Contingency', fmtMoney(capex.contingency), `${((capex.contingency / capex.total) * 100).toFixed(1)}%`]);
    if (capex.fomTotal > 0) costRows.push(['Front-of-Meter', fmtMoney(capex.fomTotal), `${((capex.fomTotal / capex.total) * 100).toFixed(1)}%`]);
    costRows.push([{ content: 'TOTAL CAPEX', styles: { fontStyle: 'bold', fillColor: PDF_COLORS.secondary, textColor: [255, 255, 255] } },
        { content: fmtMoney(capex.total), styles: { fontStyle: 'bold', fillColor: PDF_COLORS.secondary, textColor: [255, 255, 255] } },
        { content: '100.0%', styles: { fontStyle: 'bold', fillColor: PDF_COLORS.secondary, textColor: [255, 255, 255] } }]);

    autoTable(doc, {
        startY: y,
        head: [['Cost Category', 'Amount (USD)', '% of Total']],
        body: costRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Timeline
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'Project Timeline', '1.1', branding);

    const timelineRows = timeline.phases.map((p: any) => [
        p.name,
        `Month ${p.start}`,
        `${p.end - p.start} months`,
        `Month ${p.end}`,
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Phase', 'Start', 'Duration', 'End']],
        body: timelineRows,
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §NEW: L2 GANTT SCHEDULE
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Construction Schedule', 'L2 Gantt & Sub-Phases', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'L2 Gantt Schedule', '2', branding);

    // Generate sub-phases from timeline phases
    const ganttRows: any[] = [];
    timeline.phases.forEach((p: any) => {
        ganttRows.push([{ content: p.name, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: '', styles: { fillColor: [241, 245, 249] } },
            { content: `M${p.start}`, styles: { fillColor: [241, 245, 249] } },
            { content: `${p.end - p.start} mo`, styles: { fillColor: [241, 245, 249] } },
            { content: `M${p.end}`, styles: { fillColor: [241, 245, 249] } }]);

        // Sub-phases
        if (p.name.includes('Design')) {
            ganttRows.push(['  Concept Design', '', `M${p.start}`, `${Math.ceil((p.end - p.start) * 0.3)} mo`, `M${p.start + Math.ceil((p.end - p.start) * 0.3)}`]);
            ganttRows.push(['  Detailed Design', '', `M${p.start + Math.ceil((p.end - p.start) * 0.3)}`, `${Math.ceil((p.end - p.start) * 0.5)} mo`, `M${p.start + Math.ceil((p.end - p.start) * 0.8)}`]);
            ganttRows.push(['  Permitting', '', `M${p.start + Math.ceil((p.end - p.start) * 0.5)}`, `${Math.ceil((p.end - p.start) * 0.5)} mo`, `M${p.end}`]);
        } else if (p.name.includes('Construction') || p.name.includes('Build')) {
            ganttRows.push(['  Civil & Structure', '', `M${p.start}`, `${Math.ceil((p.end - p.start) * 0.35)} mo`, `M${p.start + Math.ceil((p.end - p.start) * 0.35)}`]);
            ganttRows.push(['  M&E Installation', '', `M${p.start + Math.ceil((p.end - p.start) * 0.25)}`, `${Math.ceil((p.end - p.start) * 0.45)} mo`, `M${p.start + Math.ceil((p.end - p.start) * 0.7)}`]);
            ganttRows.push(['  Testing & Commissioning', '', `M${p.start + Math.ceil((p.end - p.start) * 0.7)}`, `${Math.ceil((p.end - p.start) * 0.3)} mo`, `M${p.end}`]);
        }
    });

    autoTable(doc, {
        startY: y,
        head: [['Phase / Sub-Phase', 'Dependencies', 'Start', 'Duration', 'End']],
        body: ganttRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §NEW: FULL CONFIGURATION PARAMETERS
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Full Configuration', 'All Sidebar Input Parameters', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Complete Configuration Parameters', '3', branding);

    autoTable(doc, {
        startY: y,
        head: [['Parameter', 'Value']],
        body: [
            ['Region / Country', country.name],
            ['IT Load', `${inputs.itLoad || 1000} kW`],
            ['Redundancy Tier', inputs.redundancy?.toUpperCase() || 'N+1'],
            ['Cooling Type', inputs.coolingType || 'Air'],
            ['Building Type', inputs.buildingType || 'Purpose Built'],
            ['Rack Density', inputs.rackType?.toUpperCase() || 'Standard'],
            ['UPS Type', inputs.upsType || 'Modular'],
            ['Generator Type', inputs.genType || 'Diesel'],
            ['Fuel Storage', `${inputs.fuelHours || 48} hours`],
            ['Fire Suppression', inputs.fireType || 'Novec'],
            ['Green Certification', inputs.greenCert || 'None'],
            ['Renewable Option', inputs.renewableOption || 'None'],
            ['Substation / FOM', inputs.includeFOM ? 'Included' : 'Excluded'],
            ['Design Fee', `${inputs.designFee || 8}%`],
            ['PM Fee', `${inputs.pmFee || 5}%`],
            ['Contingency', `${inputs.contingency || 10}%`],
        ],
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_CAPEX_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
