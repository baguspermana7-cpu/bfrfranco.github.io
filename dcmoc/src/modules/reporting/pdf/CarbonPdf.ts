
import { CountryProfile } from '@/constants/countries';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawExecutiveBox, drawParagraph, drawDistributionChart,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// CARBON PDF — Comprehensive (6-8 pages)
// Emissions, Scopes, Energy Breakdown, PUE, Reduction, Net-Zero
// ═══════════════════════════════════════════════════════════════

export const generateCarbonPDF = async (
    country: CountryProfile,
    carbonData: any, // CarbonResult
    narrative: string,
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    const pg = { current: 1 };

    // ── Cover ──
    drawCoverPage(doc, 'Carbon & ESG\nFootprint Report', `Sustainability Profile for ${country.name}`, {
        client: 'Sustainability Office',
        date: today(),
        version: '2.0'
    }, branding);

    // ── Executive Summary ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'ESG Executive Summary', `Rating: ${carbonData.efficiencyRating}`, branding);
    let y = 35;

    drawKpiCard(doc, 14, y, 42, 24, 'Emissions', `${Math.round(carbonData.annualEmissionsTonCO2)} tCO₂`, 'Scope 1+2+3');
    drawKpiCard(doc, 60, y, 42, 24, 'Effective PUE', `${carbonData.pueEfficiency.toFixed(2)}`, 'Design target');
    drawKpiCard(doc, 106, y, 42, 24, 'Tax Exposure', fmt(carbonData.carbonTaxExposureUSD), 'Potential liability');
    drawKpiCard(doc, 152, y, 42, 24, 'Renewable', `${carbonData.renewableReductionPct}%`, 'Offset %');
    y += 35;

    y = drawParagraph(doc, y, narrative);

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §1 EMISSIONS BREAKDOWN
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Emissions Breakdown', 'GHG Protocol Scope Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'GHG Protocol Scopes', '1', branding);

    const distData = [
        { label: 'Scope 1 (Direct)', value: carbonData.scope1, color: PDF_COLORS.danger },
        { label: 'Scope 2 (Grid)', value: carbonData.scope2, color: PDF_COLORS.warning },
        { label: 'Scope 3 (Supply)', value: carbonData.scope3, color: PDF_COLORS.accent },
    ];
    y = drawDistributionChart(doc, 14, y, 180, distData, 'Annual Emissions by Scope');

    // Scope Detail Table
    y = ensureSpace(doc, y, 50, pg);
    autoTable(doc, {
        startY: y,
        head: [['Scope', 'Description', 'Annual tCO₂', '% of Total']],
        body: [
            ['Scope 1', 'Direct emissions (diesel generators, refrigerants)', `${carbonData.scope1.toFixed(1)}`, `${(carbonData.scope1 / carbonData.annualEmissionsTonCO2 * 100).toFixed(1)}%`],
            ['Scope 2', 'Indirect — grid electricity', `${carbonData.scope2.toFixed(1)}`, `${(carbonData.scope2 / carbonData.annualEmissionsTonCO2 * 100).toFixed(1)}%`],
            ['Scope 3', 'Supply chain & embedded', `${carbonData.scope3.toFixed(1)}`, `${(carbonData.scope3 / carbonData.annualEmissionsTonCO2 * 100).toFixed(1)}%`],
            [{ content: 'Total', styles: { fontStyle: 'bold' } }, '', { content: `${carbonData.annualEmissionsTonCO2.toFixed(1)}`, styles: { fontStyle: 'bold' } }, { content: '100%', styles: { fontStyle: 'bold' } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §2 ENERGY BREAKDOWN (NEW)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Energy Consumption', 'Facility Power Breakdown', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Energy Breakdown', '2', branding);

    autoTable(doc, {
        startY: y,
        head: [['Component', 'Annual MWh', '% of Total']],
        body: [
            ['IT Equipment', `${carbonData.itEnergyMWh.toFixed(0)}`, `${(carbonData.itEnergyMWh / carbonData.annualEnergyMWh * 100).toFixed(1)}%`],
            ['Cooling Systems', `${carbonData.coolingEnergyMWh.toFixed(0)}`, `${(carbonData.coolingEnergyMWh / carbonData.annualEnergyMWh * 100).toFixed(1)}%`],
            ['Distribution Losses', `${carbonData.lossEnergyMWh.toFixed(0)}`, `${(carbonData.lossEnergyMWh / carbonData.annualEnergyMWh * 100).toFixed(1)}%`],
            [{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: `${carbonData.annualEnergyMWh.toFixed(0)}`, styles: { fontStyle: 'bold' } }, { content: '100%', styles: { fontStyle: 'bold' } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // PUE Benchmark (NEW)
    y = ensureSpace(doc, y, 50, pg);
    y = drawSectionTitle(doc, y, 'PUE Benchmark Analysis', '2.1', branding);

    const designPUE = carbonData.pueEfficiency;
    const industryAvg = 1.58;
    const bestInClass = 1.10;

    autoTable(doc, {
        startY: y,
        head: [['Metric', 'PUE Value', 'Assessment']],
        body: [
            ['Design PUE', designPUE.toFixed(2), designPUE < 1.3 ? 'Best-in-Class' : designPUE < 1.5 ? 'Above Average' : 'Standard'],
            ['Industry Average', industryAvg.toFixed(2), 'Uptime Institute 2024'],
            ['Best-in-Class', bestInClass.toFixed(2), 'Hyperscaler benchmark'],
            [{ content: `Gap vs Industry`, styles: { fontStyle: 'bold' } },
             { content: `${(industryAvg - designPUE).toFixed(2)}`, styles: { fontStyle: 'bold' } },
             { content: designPUE < industryAvg ? `${((1 - designPUE/industryAvg) * 100).toFixed(0)}% better` : `${((designPUE/industryAvg - 1) * 100).toFixed(0)}% worse`, styles: { fontStyle: 'bold' } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'center' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §3 REDUCTION SCENARIOS
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Carbon Reduction Scenarios', 'Investment Pathways', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Carbon Reduction Investment Scenarios', '3', branding);

    const scenarios = carbonData.reductionScenarios.map((s: any) => [
        s.name,
        fmtMoney(s.investmentUSD),
        `${Math.round(s.annualSavingsTonCO2)} tCO₂/yr`,
        fmtMoney(s.annualSavingsUSD),
        s.paybackYears > 0 ? `${s.paybackYears} yrs` : 'Immediate/PPA'
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Initiative', 'Investment', 'CO₂ Abatement', 'Annual Savings', 'Payback']],
        body: scenarios,
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §4 NET-ZERO TRAJECTORY (NEW)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Net-Zero Trajectory', 'Decarbonization Roadmap', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Net-Zero Emissions Target', '4', branding);

    const currentEmissions = carbonData.annualEmissionsTonCO2;
    autoTable(doc, {
        startY: y,
        head: [['Year', 'Emissions Target (tCO₂)', 'Reduction %', 'Strategy']],
        body: [
            ['2025 (Current)', `${Math.round(currentEmissions)}`, '0%', 'Baseline measurement'],
            ['2030', `${Math.round(currentEmissions * 0.55)}`, '45%', 'Green PPA + efficiency'],
            ['2040', `${Math.round(currentEmissions * 0.15)}`, '85%', 'Full renewable + carbon capture'],
            ['2050', '0', '100%', 'Net-zero achieved'],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Milestones
    y = ensureSpace(doc, y, 40, pg);
    y = drawSectionTitle(doc, y, 'Key Milestones', '4.1', branding);

    drawKpiCard(doc, 14, y, 55, 24, 'Current Emissions', `${Math.round(currentEmissions)} tCO₂`, 'Annual baseline', PDF_COLORS.danger);
    drawKpiCard(doc, 75, y, 55, 24, '2030 Target', `${Math.round(currentEmissions * 0.55)} tCO₂`, '45% reduction', PDF_COLORS.warning);
    drawKpiCard(doc, 136, y, 55, 24, 'Net-Zero Year', '2050', 'Target date', PDF_COLORS.secondary);

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_CarbonESG_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
