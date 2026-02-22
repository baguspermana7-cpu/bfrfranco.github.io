
import { CountryProfile } from '@/constants/countries';
import { ReportInsight } from '../NarrativeEngine';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawInsightsSection,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// SIMULATION PDF — Comprehensive (7-8 pages)
// Executive Summary, Operational Physics, Power, Charts,
// Input Configuration, Environmental Scenarios
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
    const pg = { current: 1 };

    // ── Cover ──
    drawCoverPage(doc, 'Feasibility Simulation\n& Market Analysis', `Assessment for ${country.name} Data Center`, {
        client: 'Strategic Planning Committee',
        date: today(),
        version: '2.0'
    }, branding);

    // ══════════════════════════════════════════════════════════════
    // §EXEC: EXECUTIVE SUMMARY
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Executive Summary', 'Operational Viability Assessment', branding);
    let y = 35;

    const internal = results.monthlyInternalCost || 0;
    const vendor = results.monthlyVendorCost || 0;
    const consumables = results.totalMonthlyConsumables || 0;
    const turnover = results.turnoverCost || 0;

    drawKpiCard(doc, 14, y, 42, 24, 'Internal Staff', fmt(internal), `${results.headcount || 0} FTEs`);
    drawKpiCard(doc, 60, y, 42, 24, 'Vendor Labor', fmt(vendor), 'Contract staff', PDF_COLORS.warning);
    drawKpiCard(doc, 106, y, 42, 24, 'Parts & Spares', fmt(consumables), results.aqiImpact > 1 ? 'AQI Impact' : 'Normal');
    drawKpiCard(doc, 152, y, 42, 24, 'Turnover Loss', fmt(turnover), 'Recruitment cost', PDF_COLORS.danger);
    y += 35;

    // Insights
    y = drawSectionTitle(doc, y, 'Key Strategic Insights', '1', branding);
    y = drawInsightsSection(doc, y, insights);

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §2 INPUT CONFIGURATION
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Simulation Configuration', 'All Input Parameters', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Full Input Parameters', '2', branding);

    autoTable(doc, {
        startY: y,
        head: [['Parameter', 'Value']],
        body: [
            ['Country / Region', country.name],
            ['Simulation Year', `${simYear}`],
            ['IT Load', `${inputs.itLoad || 1000} kW`],
            ['Redundancy Tier', `Tier ${inputs.tierLevel || 3}`],
            ['Cooling Type', inputs.coolingType || 'Air'],
            ['Shift Model', inputs.shiftModel || '12h'],
            ['Maintenance Model', inputs.maintenanceModel || 'In-house'],
            ['Hybrid Ratio', inputs.hybridRatio !== undefined ? `${(inputs.hybridRatio * 100).toFixed(0)}%` : '100%'],
            ['Turnover Rate', inputs.turnoverRate !== undefined ? `${(inputs.turnoverRate * 100).toFixed(0)}%` : 'Default'],
            ['AQI Override', inputs.aqiOverride !== undefined ? `${inputs.aqiOverride}` : 'Country default'],
        ],
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Scenario AQI / Turnover KPIs
    y = ensureSpace(doc, y, 35, pg);
    y = drawSectionTitle(doc, y, 'Environmental & HR Scenarios', '2.1', branding);

    const scenarioAQI = inputs.aqiOverride || country.environment?.baselineAQI || 50;
    const scenarioTurnover = inputs.turnoverRate || 0.15;

    drawKpiCard(doc, 14, y, 55, 24, 'Scenario AQI', `${scenarioAQI}`, scenarioAQI > 100 ? 'High pollution' : scenarioAQI > 50 ? 'Moderate' : 'Clean air',
        scenarioAQI > 100 ? PDF_COLORS.danger : scenarioAQI > 50 ? PDF_COLORS.warning : PDF_COLORS.secondary);
    drawKpiCard(doc, 75, y, 55, 24, 'Turnover Rate', `${(scenarioTurnover * 100).toFixed(0)}%`, scenarioTurnover > 0.2 ? 'High attrition' : 'Normal',
        scenarioTurnover > 0.2 ? PDF_COLORS.danger : PDF_COLORS.secondary);
    drawKpiCard(doc, 136, y, 55, 24, 'Grid Carbon', `${(country.environment?.gridCarbonIntensity || 0.5).toFixed(2)}`, 'kgCO₂/kWh');
    y += 32;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §3 OPERATIONAL PHYSICS & RISK
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Operational Physics', 'Regulatory & Environmental Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Overtime & Regulatory Analysis', '3', branding);

    autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value', 'Assessment']],
        body: [
            ['Weekly OT Hours/Person', `${results.overtimeHours?.toFixed(1) || 0} hrs`, (results.overtimeHours || 0) > 12 ? 'Exceeds limit — 4x multiplier' : 'Within limits'],
            ['Headcount (Internal)', `${results.headcount || 0} FTE`, 'Active staff'],
            ['Shift Model', inputs.shiftModel || '12h', 'Current configuration'],
            ['Monthly Internal Cost', fmtMoney(internal), 'Base + OT + benefits'],
            ['Monthly Vendor Cost', fmtMoney(vendor), 'Contract labor'],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Environmental Physics
    y = ensureSpace(doc, y, 50, pg);
    y = drawSectionTitle(doc, y, 'Environmental Physics', '3.1', branding);

    autoTable(doc, {
        startY: y,
        head: [['Factor', 'Value', 'Impact']],
        body: [
            ['AQI Level', `${scenarioAQI}`, scenarioAQI > 100 ? 'Accelerated equipment wear' : 'Standard degradation'],
            ['AQI Impact Multiplier', `${results.aqiImpact?.toFixed(2) || 1}x`, results.aqiImpact > 1 ? 'Above baseline' : 'Baseline'],
            ['Filter Life Reduction', results.filterLife ? `${(results.filterLife * 100).toFixed(0)}%` : 'N/A', 'Power-law degradation model'],
            ['Consumable Penalty', fmtMoney(results.aqiConsumablePenalty || 0), 'Additional monthly cost'],
            ['Formula', 'Life = Base × (AQI_Base/AQI)^1.5', 'Environmental degradation model'],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Risk & Downtime
    y = ensureSpace(doc, y, 40, pg);
    y = drawSectionTitle(doc, y, 'Risk & Downtime Exposure', '3.2', branding);

    drawKpiCard(doc, 14, y, 55, 24, 'Availability', `${results.availability?.toFixed(3) || 99.982}%`, `Tier ${inputs.tierLevel || 3}`);
    drawKpiCard(doc, 75, y, 55, 24, 'Downtime', `${Math.round(results.downtimeMinutes || 0)} min`, 'Expected per year');
    drawKpiCard(doc, 136, y, 55, 24, 'Financial Risk', fmtMoney(results.financialRisk || 0), '@ $5k/min', PDF_COLORS.danger);
    y += 32;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §4 POWER & COOLING ANALYTICS
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Power & Cooling Analytics', 'Facility Energy Profile', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Power Chain Efficiency', '4', branding);

    const tier = inputs.tierLevel || 3;
    const itLoad = inputs.itLoad || 1000;
    const gridCarbonIntensity = country.environment?.gridCarbonIntensity ?? 0.50;
    const pue = tier === 4 ? 1.25 : 1.45;
    const totalFacility = Math.round(itLoad * pue);
    const coolingLoad = totalFacility - itLoad;
    const annualMWh = (totalFacility * 8760) / 1000;
    const annualCO2 = annualMWh * gridCarbonIntensity;

    autoTable(doc, {
        startY: y,
        head: [['Component', 'Value', 'Notes']],
        body: [
            ['IT Load', `${itLoad.toLocaleString()} kW`, 'Configured capacity'],
            ['Cooling Load', `${coolingLoad.toLocaleString()} kW`, 'PUE overhead'],
            ['Total Facility Power', `${totalFacility.toLocaleString()} kW`, `PUE: ${pue.toFixed(2)}`],
            ['Annual Energy', `${Math.round(annualMWh).toLocaleString()} MWh`, '8,760 hours/year'],
            ['Annual CO₂', `${Math.round(annualCO2).toLocaleString()} tonnes`, `@ ${gridCarbonIntensity} kgCO₂/kWh`],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Power chain efficiency visualization
    y = ensureSpace(doc, y, 30, pg);
    y = drawSectionTitle(doc, y, 'Power Distribution Chain', '4.1', branding);

    autoTable(doc, {
        startY: y,
        head: [['Stage', 'Efficiency', 'Cumulative Loss']],
        body: [
            ['Grid Input', '98%', '2%'],
            ['UPS System', '94%', '8%'],
            ['PDU Distribution', '97%', '11%'],
            ['IT Load (Delivered)', '100%', `Total overhead: ${((pue - 1) * 100).toFixed(0)}%`],
        ],
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
        margin: { left: 14, right: 80 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §5 COST BREAKDOWN
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Cost Breakdown', 'Monthly OPEX Components', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Monthly Cost Summary', '5', branding);

    const totalMonthly = internal + vendor + consumables + turnover;
    autoTable(doc, {
        startY: y,
        head: [['Category', 'Monthly Cost', '% of Total']],
        body: [
            ['Internal Staff', fmtMoney(internal), `${totalMonthly > 0 ? ((internal / totalMonthly) * 100).toFixed(1) : 0}%`],
            ['Vendor Labor', fmtMoney(vendor), `${totalMonthly > 0 ? ((vendor / totalMonthly) * 100).toFixed(1) : 0}%`],
            ['Parts & Consumables', fmtMoney(consumables), `${totalMonthly > 0 ? ((consumables / totalMonthly) * 100).toFixed(1) : 0}%`],
            ['Turnover Cost', fmtMoney(turnover), `${totalMonthly > 0 ? ((turnover / totalMonthly) * 100).toFixed(1) : 0}%`],
            [{ content: 'Total Monthly OPEX', styles: { fontStyle: 'bold', fillColor: PDF_COLORS.secondary, textColor: [255, 255, 255] } },
             { content: fmtMoney(totalMonthly), styles: { fontStyle: 'bold', fillColor: PDF_COLORS.secondary, textColor: [255, 255, 255] } },
             { content: '100%', styles: { fontStyle: 'bold', fillColor: PDF_COLORS.secondary, textColor: [255, 255, 255] } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Annualized KPIs
    y = ensureSpace(doc, y, 35, pg);
    drawKpiCard(doc, 14, y, 55, 24, 'Annual OPEX', fmtMoney(totalMonthly * 12), 'Monthly × 12');
    drawKpiCard(doc, 75, y, 55, 24, 'Cost per kW', fmtMoney(totalMonthly * 12 / (itLoad || 1)), 'Annual per kW IT');
    drawKpiCard(doc, 136, y, 55, 24, 'Staff Ratio', `${((results.headcount || 0) / ((itLoad || 1000) / 1000)).toFixed(1)}`, 'FTE per MW');
    y += 32;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §6 EMBEDDED CHARTS (if available)
    // ══════════════════════════════════════════════════════════════
    if (chartImages?.tornado || chartImages?.sankey) {
        doc.addPage(); pg.current++;
        drawModernHeader(doc, 'Visual Analysis', 'Generated Charts', branding);
        y = 35;

        if (chartImages.sankey) {
            y = drawSectionTitle(doc, y, 'Cost Flow Analysis (Sankey)', '6', branding);
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
            y = drawSectionTitle(doc, y, 'Sensitivity Analysis (Tornado)', '6.1', branding);
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
    }

    savePdf(doc, `DCMOC_Feasibility_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
