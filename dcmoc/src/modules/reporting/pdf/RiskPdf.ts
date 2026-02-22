
import { CountryProfile } from '@/constants/countries';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawExecutiveBox, drawParagraph, drawRiskHeatMap,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// RISK PDF — Comprehensive (8-10 pages)
// Matrix, Top Risks, Downtime, MTTR/MTBF, 5-Year, Environmental, Mitigation
// ═══════════════════════════════════════════════════════════════

export const generateRiskPDF = async (
    country: CountryProfile,
    riskData: any, // RiskAggregation + extended data
    narrative: string,
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    const pg = { current: 1 };

    // ── Cover ──
    drawCoverPage(doc, 'Risk & Compliance\nAssessment', `Facility Analysis for ${country.name}`, {
        client: 'Risk Management',
        date: today(),
        version: '2.0'
    }, branding);

    // ── Executive Summary ──
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Risk Executive Summary', `Normalized Score: ${riskData.normalizedScore}/100`, branding);
    let y = 35;

    drawKpiCard(doc, 14, y, 42, 24, 'Risk Score', `${riskData.normalizedScore}/100`, riskData.normalizedScore < 30 ? 'Low Risk' : riskData.normalizedScore < 60 ? 'Medium Risk' : 'High Risk',
        riskData.normalizedScore < 30 ? PDF_COLORS.secondary : riskData.normalizedScore < 60 ? PDF_COLORS.warning : PDF_COLORS.danger);
    drawKpiCard(doc, 60, y, 42, 24, 'Financial Exposure', fmtMoney(riskData.financialExposure || 0), 'Annual estimated');
    drawKpiCard(doc, 106, y, 42, 24, 'Availability', `${(riskData.availability || 99.982).toFixed(3)}%`, 'Expected uptime');
    drawKpiCard(doc, 152, y, 42, 24, 'SLA Breach Prob.', `${(riskData.slaBreachProbability * 100).toFixed(1)}%`, 'Annual probability');
    y += 35;

    // Narrative
    y = drawParagraph(doc, y, narrative);

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §1 RISK MATRIX (5x5 Grid)
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Risk Matrix', '5×5 Probability-Impact Assessment', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Risk Heat Map', '1', branding);

    // Build risks with numeric p/i for the heatmap
    const mappedRisks = (riskData.topRisks || []).map((r: any) => {
        const probMap: Record<string, number> = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
        const impactMap: Record<string, number> = { 'Low': 1, 'Medium': 2, 'High': 3, 'Catastrophic': 4 };
        return {
            title: r.title,
            probability: probMap[r.probability] || 2,
            impact: impactMap[r.impact] || 2,
            score: r.score || 0
        };
    });

    if (mappedRisks.length > 0) {
        y = drawRiskHeatMap(doc, 14, y, mappedRisks, 'Risk Probability × Impact Matrix');
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §2 TOP RISK SCENARIOS
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Top Risk Scenarios', 'Identified Threat Vectors', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Risk Scenario Register', '2', branding);

    if (riskData.topRisks && riskData.topRisks.length > 0) {
        const riskRows = riskData.topRisks.map((r: any) => [
            r.title,
            r.category || 'General',
            r.probability || 'Medium',
            r.impact || 'Medium',
            `${r.score || 0}`,
            (r.description || '').substring(0, 60),
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Risk Title', 'Category', 'Probability', 'Impact', 'Score', 'Description']],
            body: riskRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 0: { cellWidth: 35 }, 4: { halign: 'center' }, 5: { cellWidth: 50 } },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 4) {
                    const score = parseInt(data.cell.text[0]);
                    if (score >= 15) data.cell.styles.textColor = [220, 38, 38];
                    else if (score >= 10) data.cell.styles.textColor = [245, 158, 11];
                    else data.cell.styles.textColor = [34, 197, 94];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §3 DOWNTIME ANALYSIS
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Downtime & Reliability', 'Availability Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Downtime Analysis', '3', branding);

    const availability = riskData.availability || 99.982;
    const downtimeMin = riskData.downtimeMinutes || (100 - availability) / 100 * 525600;
    const financialImpact = riskData.financialExposure || downtimeMin * 5000;

    drawKpiCard(doc, 14, y, 42, 24, 'Expected Downtime', `${Math.round(downtimeMin)} min`, 'Per year');
    drawKpiCard(doc, 60, y, 42, 24, 'Availability', `${availability.toFixed(3)}%`, 'Annual target');
    drawKpiCard(doc, 106, y, 42, 24, 'Financial Impact', fmtMoney(financialImpact), '@ $5k/min');
    drawKpiCard(doc, 152, y, 42, 24, 'SLA Breach Risk', `${(riskData.slaBreachProbability * 100).toFixed(1)}%`, 'Annual probability');
    y += 35;

    // MTTR/MTBF Table
    y = drawSectionTitle(doc, y, 'Reliability Metrics (MTTR/MTBF)', '3.1', branding);

    autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value', 'Industry Benchmark', 'Assessment']],
        body: [
            ['MTBF (Mean Time Between Failures)', `${riskData.mtbf || 8760}h`, '8,760h (Tier 3)', riskData.mtbf >= 8760 ? 'Within target' : 'Below target'],
            ['MTTR (Mean Time to Repair)', `${riskData.mttr || 4}h`, '4h (SLA target)', riskData.mttr <= 4 ? 'Within target' : 'Exceeds target'],
            ['Failure Rate', `${riskData.failureRate || 0.001}/hr`, '0.001/hr', 'Standard'],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §4 5-YEAR RISK PROJECTION
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, '5-Year Risk Projection', 'Risk Trend Analysis', branding);
    y = 35;

    y = drawSectionTitle(doc, y, '5-Year Risk Score Projection', '4', branding);

    if (riskData.fiveYearProjection && riskData.fiveYearProjection.length > 0) {
        const projRows = riskData.fiveYearProjection.map((p: any) => {
            const trend = p.score > riskData.normalizedScore ? '↑' : p.score < riskData.normalizedScore ? '↓' : '→';
            return [`Year ${p.year}`, `${p.score}/100`, trend, p.label || 'Projected'];
        });

        autoTable(doc, {
            startY: y,
            head: [['Year', 'Risk Score', 'Trend', 'Assessment']],
            body: projRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §5 ENVIRONMENTAL & SUPPLY CHAIN
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Environmental & Supply Chain Risk', `${country.name} Country Profile`, branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Country-Specific Risk Metrics', '5', branding);

    const aqi = country.environment?.baselineAQI || 50;
    const gridCarbon = country.environment?.gridCarbonIntensity || 0.5;

    autoTable(doc, {
        startY: y,
        head: [['Factor', 'Value', 'Impact Assessment']],
        body: [
            ['Baseline AQI', `${aqi}`, aqi > 100 ? 'High — accelerated equipment degradation' : 'Normal range'],
            ['Grid Carbon Intensity', `${gridCarbon.toFixed(2)} kgCO₂/kWh`, gridCarbon > 0.5 ? 'Above average' : 'Below average'],
            ['Import Lead Time', `${country.id === 'ID' ? '21' : country.id === 'SG' ? '7' : '14'} days`, 'Affects spares strategy'],
            ['Natural Disaster Risk', country.id === 'ID' ? 'High (seismic/volcanic)' : 'Moderate', 'Structural hardening required'],
            ['Regulatory Environment', country.economy?.taxRate ? `${(country.economy.taxRate * 100).toFixed(0)}% tax` : 'Standard', 'Labor and data sovereignty'],
        ],
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §6 MITIGATION STRATEGIES
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Mitigation Strategies', 'Risk Remediation Recommendations', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Recommended Mitigation Actions', '6', branding);

    if (riskData.topRisks && riskData.topRisks.length > 0) {
        const mitigRows = riskData.topRisks.map((r: any) => [
            r.title,
            r.category || 'General',
            r.mitigation || 'Review and assess',
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Risk', 'Category', 'Recommended Mitigation']],
            body: mitigRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 0: { cellWidth: 40 }, 2: { cellWidth: 80 } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_RiskProfile_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
