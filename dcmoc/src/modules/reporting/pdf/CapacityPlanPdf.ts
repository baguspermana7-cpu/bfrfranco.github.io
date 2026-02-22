
import { CountryProfile } from '@/constants/countries';
import {
    PDF_COLORS, BrandingConfig,
    initDoc, savePdf, fmt, fmtMoney, today,
    drawCoverPage, drawModernHeader, drawFooter, drawSectionTitle,
    drawKpiCard, drawParagraph,
    ensureSpace,
} from '../PdfUtils';

// ═══════════════════════════════════════════════════════════════
// CAPACITY PLAN PDF — Comprehensive (8-10 pages)
// Overview, Phase Breakdown, Timeline, Utilization, Staffing/PUE,
// Infrastructure per Phase, Phased Financials, Assumptions
// ═══════════════════════════════════════════════════════════════

export const generateCapacityPlanPDF = async (
    country: CountryProfile,
    data: {
        capPlan: any; // CapacityPlanResult
        phases: any[]; // input CapacityPhase[]
        phasedFinancials?: any;
        itLoadKw: number;
    },
    branding?: BrandingConfig
) => {
    const { doc, autoTable } = await initDoc(branding);
    const pg = { current: 1 };
    const cp = data.capPlan;

    // ── Cover ──
    drawCoverPage(doc, 'Capacity Planning\n& Phased Investment', `Multi-Phase Build Strategy for ${country.name}`, {
        client: 'Infrastructure Planning',
        date: today(),
        version: '2.0'
    }, branding);

    // ══════════════════════════════════════════════════════════════
    // §EXEC: EXECUTIVE SUMMARY
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Capacity Plan Overview', `${cp.phases.length} Phases — ${fmt(cp.totalItLoadKw)} kW Total`, branding);
    let y = 35;

    drawKpiCard(doc, 14, y, 42, 24, 'Total Capacity', `${(cp.totalItLoadKw / 1000).toFixed(1)} MW`, `${cp.phases.length} phases`);
    drawKpiCard(doc, 60, y, 42, 24, 'Total CAPEX', fmt(cp.totalCapex), `$${Math.round(cp.totalCapex / cp.totalItLoadKw).toLocaleString()}/kW`);
    drawKpiCard(doc, 106, y, 42, 24, 'Scalability', `${cp.scalabilityScore}/100`, 'Phase efficiency');
    drawKpiCard(doc, 152, y, 42, 24, 'Timeline', `${cp.totalMonths} mo`, `~${(cp.totalMonths / 12).toFixed(1)} years`);
    y += 35;

    if (cp.narrative) {
        y = drawParagraph(doc, y, cp.narrative);
        y += 5;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §1 PHASE-BY-PHASE BREAKDOWN
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Phase Breakdown', 'Investment & Capacity per Phase', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Phase-by-Phase Comparison', '1', branding);

    const phaseRows = cp.phases.map((p: any, i: number) => [
        data.phases[i]?.label || `Phase ${i + 1}`,
        `${p.itLoadKw.toLocaleString()} kW`,
        fmt(p.capex),
        `$${Math.round(p.capexPerKw).toLocaleString()}`,
        `${p.headcount || p.fte || 0} FTE`,
        p.pue.toFixed(2),
        `M${data.phases[i]?.startMonth || 0}`,
        `${data.phases[i]?.buildMonths || 0} mo`,
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Phase', 'IT Load', 'CAPEX', '$/kW', 'Staff', 'PUE', 'Start', 'Build']],
        body: phaseRows,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Enhanced Phase Comparison (Revenue, ROI, Risk)
    if (cp.phaseDetails && cp.phaseDetails.length > 0) {
        y = ensureSpace(doc, y, 60, pg);
        y = drawSectionTitle(doc, y, 'Enhanced Phase Assessment', '1.1', branding);

        const detailRows = cp.phaseDetails.map((d: any) => [
            d.label,
            d.description?.substring(0, 50) || '',
            fmtMoney(d.revenueEstimate || 0),
            `${d.roiYears || 0} yr`,
            `${d.riskScore || 0}/100`,
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Phase', 'Description', 'Revenue/yr', 'ROI Years', 'Risk Score']],
            body: detailRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' } },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 4) {
                    const score = parseInt(data.cell.text[0]);
                    if (score >= 60) data.cell.styles.textColor = [220, 38, 38];
                    else if (score >= 30) data.cell.styles.textColor = [245, 158, 11];
                    else data.cell.styles.textColor = [34, 197, 94];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §2 BUILD TIMELINE
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Build Timeline', 'Construction & Commissioning Schedule', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Timeline Events', '2', branding);

    if (cp.timeline && cp.timeline.length > 0) {
        const timelineRows = cp.timeline.map((event: any) => [
            event.label,
            event.type === 'build' ? 'Construction' : 'Operational',
            `Month ${event.startMonth}`,
            `${event.endMonth - event.startMonth} mo`,
            `Month ${event.endMonth}`,
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Event', 'Type', 'Start', 'Duration', 'End']],
            body: timelineRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 1) {
                    const val = data.cell.text[0];
                    if (val === 'Construction') data.cell.styles.textColor = [245, 158, 11];
                    else data.cell.styles.textColor = [34, 197, 94];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Cumulative CAPEX and IT Load curves
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'Cumulative Investment', '2.1', branding);

    if (cp.cumulativeCapex && cp.cumulativeItLoad) {
        const cumulativeRows: any[] = [];
        const step = Math.max(1, Math.floor(cp.cumulativeCapex.length / 12));
        for (let i = 0; i < cp.cumulativeCapex.length; i += step) {
            cumulativeRows.push([
                `Month ${i}`,
                fmtMoney(cp.cumulativeCapex[i] || 0),
                `${(cp.cumulativeItLoad[i] || 0).toLocaleString()} kW`,
            ]);
        }
        // Always include last month
        const last = cp.cumulativeCapex.length - 1;
        if (last % step !== 0) {
            cumulativeRows.push([
                `Month ${last}`,
                fmtMoney(cp.cumulativeCapex[last] || 0),
                `${(cp.cumulativeItLoad[last] || 0).toLocaleString()} kW`,
            ]);
        }

        autoTable(doc, {
            startY: y,
            head: [['Month', 'Cumulative CAPEX', 'Cumulative IT Load']],
            body: cumulativeRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §3 UTILIZATION CURVE
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Utilization Analysis', 'Capacity vs Demand Projection', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Utilization Curve', '3', branding);

    if (cp.utilizationCurve && cp.utilizationCurve.length > 0) {
        const step = Math.max(1, Math.floor(cp.utilizationCurve.length / 24));
        const utilRows: any[] = [];
        for (let i = 0; i < cp.utilizationCurve.length; i += step) {
            const u = cp.utilizationCurve[i];
            utilRows.push([
                `Month ${u.month}`,
                `${u.capacityKw.toLocaleString()} kW`,
                `${u.demandKw.toLocaleString()} kW`,
                `${(u.utilization * 100).toFixed(1)}%`,
            ]);
        }
        const lastU = cp.utilizationCurve[cp.utilizationCurve.length - 1];
        if (utilRows.length === 0 || utilRows[utilRows.length - 1][0] !== `Month ${lastU.month}`) {
            utilRows.push([
                `Month ${lastU.month}`,
                `${lastU.capacityKw.toLocaleString()} kW`,
                `${lastU.demandKw.toLocaleString()} kW`,
                `${(lastU.utilization * 100).toFixed(1)}%`,
            ]);
        }

        autoTable(doc, {
            startY: y,
            head: [['Month', 'Installed Capacity', 'Simulated Demand', 'Utilization %']],
            body: utilRows,
            theme: 'grid',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
            margin: { left: 14, right: 14 },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 3) {
                    const pct = parseFloat(data.cell.text[0]);
                    if (pct >= 85) data.cell.styles.textColor = [220, 38, 38];
                    else if (pct >= 70) data.cell.styles.textColor = [245, 158, 11];
                    else data.cell.styles.textColor = [34, 197, 94];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Utilization Summary KPIs
    if (cp.utilizationCurve && cp.utilizationCurve.length > 0) {
        y = ensureSpace(doc, y, 35, pg);
        const avgUtil = cp.utilizationCurve.reduce((s: number, u: any) => s + u.utilization, 0) / cp.utilizationCurve.length;
        const maxUtil = Math.max(...cp.utilizationCurve.map((u: any) => u.utilization));
        const peakMonth = cp.utilizationCurve.find((u: any) => u.utilization === maxUtil);

        drawKpiCard(doc, 14, y, 55, 24, 'Avg Utilization', `${(avgUtil * 100).toFixed(1)}%`, 'Across all months');
        drawKpiCard(doc, 75, y, 55, 24, 'Peak Utilization', `${(maxUtil * 100).toFixed(1)}%`, `Month ${peakMonth?.month || 'N/A'}`);
        drawKpiCard(doc, 136, y, 55, 24, 'Final Capacity', `${(cp.totalItLoadKw / 1000).toFixed(1)} MW`, 'At full build-out');
        y += 32;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §4 STAFFING RAMP & PUE EVOLUTION
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Staffing & PUE Evolution', 'Resource Scaling Over Time', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Staffing Ramp', '4', branding);

    if (cp.staffingRamp && cp.staffingRamp.length > 0) {
        const staffSample = cp.staffingRamp.filter((_: any, i: number) => i % 6 === 0 || i === cp.staffingRamp.length - 1);
        const staffRows = staffSample.map((s: any) => [
            `Month ${s.month}`,
            `${s.fte} FTE`,
            s.month > 0 ? `+${Math.max(0, s.fte - (staffSample.find((p: any) => p.month < s.month)?.fte || 0))}` : '—'
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Month', 'Total FTE', 'Change']],
            body: staffRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
            margin: { left: 14, right: 80 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // PUE Evolution
    y = ensureSpace(doc, y, 60, pg);
    y = drawSectionTitle(doc, y, 'PUE Evolution', '4.1', branding);

    if (cp.pueEvolution && cp.pueEvolution.length > 0) {
        const pueSample = cp.pueEvolution.filter((_: any, i: number) => i % 6 === 0 || i === cp.pueEvolution.length - 1);
        const pueRows = pueSample.map((p: any) => [
            `Month ${p.month}`,
            p.pue.toFixed(3),
            p.pue < 1.3 ? 'Best-in-Class' : p.pue < 1.5 ? 'Above Average' : 'Standard'
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Month', 'PUE', 'Assessment']],
            body: pueRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 1: { halign: 'center' } },
            margin: { left: 14, right: 80 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §5 INFRASTRUCTURE PER PHASE
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Infrastructure Scope', 'Per-Phase Infrastructure Details', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Infrastructure per Phase', '5', branding);

    if (cp.phaseDetails && cp.phaseDetails.length > 0) {
        cp.phaseDetails.forEach((detail: any) => {
            y = ensureSpace(doc, y, 35, pg);

            // Phase header
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(14, y, 182, 8, 2, 2, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...(PDF_COLORS.slate800 as [number, number, number]));
            doc.text(detail.label, 18, y + 5.5);
            y += 12;

            // Infrastructure scope items
            if (detail.infrastructureScope && detail.infrastructureScope.length > 0) {
                const scopeRows = detail.infrastructureScope.map((item: string) => [item]);
                autoTable(doc, {
                    startY: y,
                    body: scopeRows,
                    theme: 'plain',
                    bodyStyles: { fontSize: 7, textColor: PDF_COLORS.slate700 },
                    margin: { left: 20, right: 14 }
                });
                y = (doc as any).lastAutoTable.finalY + 4;
            }

            // Risk factors
            if (detail.riskFactors && detail.riskFactors.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(...(PDF_COLORS.danger as [number, number, number]));
                doc.text('Risk Factors:', 20, y);
                y += 4;
                detail.riskFactors.forEach((rf: string) => {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    doc.setTextColor(...(PDF_COLORS.slate600 as [number, number, number]));
                    doc.text(`• ${rf}`, 24, y);
                    y += 4;
                });
                y += 4;
            }
        });
    }

    drawFooter(doc, pg.current, branding);

    // ══════════════════════════════════════════════════════════════
    // §6 PHASED FINANCIALS (if available)
    // ══════════════════════════════════════════════════════════════
    if (data.phasedFinancials) {
        doc.addPage(); pg.current++;
        drawModernHeader(doc, 'Phased Financial Analysis', 'Per-Phase & Blended Returns', branding);
        y = 35;

        const pf = data.phasedFinancials;

        drawKpiCard(doc, 14, y, 42, 24, 'Blended IRR', `${pf.blendedIRR?.toFixed(1) || 'N/A'}%`, 'Weighted by CAPEX');
        drawKpiCard(doc, 60, y, 42, 24, 'Total NPV', fmt(pf.totalNPV || 0), 'All phases');
        drawKpiCard(doc, 106, y, 42, 24, 'Payback', `${pf.weightedPayback?.toFixed(1) || 'N/A'} yr`, 'Weighted average');
        drawKpiCard(doc, 152, y, 42, 24, 'Investment', fmt(pf.totalInvestment || cp.totalCapex), 'Total CAPEX');
        y += 35;

        y = drawSectionTitle(doc, y, 'Investment Decision Matrix', '6', branding);

        if (pf.phaseResults) {
            const decisionRows = pf.phaseResults.map((pr: any) => {
                const decision = (pr.irr || 0) >= 12 ? 'GO' : (pr.irr || 0) >= 8 ? 'CONDITIONAL' : 'NO-GO';
                return [
                    pr.label,
                    fmt(pr.capex),
                    `${pr.irr?.toFixed(1) || 'N/A'}%`,
                    fmt(pr.npv || 0),
                    `${pr.payback?.toFixed(1) || 'N/A'} yr`,
                    decision,
                ];
            });

            autoTable(doc, {
                startY: y,
                head: [['Phase', 'CAPEX', 'IRR', 'NPV', 'Payback', 'Decision']],
                body: decisionRows,
                theme: 'grid',
                headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
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
    }

    // ══════════════════════════════════════════════════════════════
    // §7 KEY ASSUMPTIONS
    // ══════════════════════════════════════════════════════════════
    doc.addPage(); pg.current++;
    drawModernHeader(doc, 'Key Assumptions', 'Planning Parameters & Constraints', branding);
    y = 35;

    y = drawSectionTitle(doc, y, 'Assumptions & Parameters', '7', branding);

    if (cp.assumptions && cp.assumptions.length > 0) {
        const assumptionRows = cp.assumptions.map((a: any) => [a.category, a.assumption, a.value]);
        autoTable(doc, {
            startY: y,
            head: [['Category', 'Assumption', 'Value']],
            body: assumptionRows,
            theme: 'striped',
            headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 2: { halign: 'right' } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Summary info
    y = ensureSpace(doc, y, 40, pg);
    y = drawSectionTitle(doc, y, 'Plan Summary', '7.1', branding);

    autoTable(doc, {
        startY: y,
        head: [['Parameter', 'Value']],
        body: [
            ['Country / Region', country.name],
            ['Total IT Capacity', `${(cp.totalItLoadKw / 1000).toFixed(1)} MW (${cp.totalItLoadKw.toLocaleString()} kW)`],
            ['Number of Phases', `${cp.phases.length}`],
            ['Total CAPEX', fmtMoney(cp.totalCapex)],
            ['Average $/kW', `$${Math.round(cp.totalCapex / cp.totalItLoadKw).toLocaleString()}`],
            ['Total Build Timeline', `${cp.totalMonths} months (~${(cp.totalMonths / 12).toFixed(1)} years)`],
            ['Scalability Score', `${cp.scalabilityScore}/100`],
            ['Phase Efficiency', `${cp.phaseEfficiency}/100`],
        ],
        theme: 'striped',
        headStyles: { fillColor: PDF_COLORS.slate900, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'right' } },
        margin: { left: 14, right: 14 }
    });

    drawFooter(doc, pg.current, branding);

    savePdf(doc, `DCMOC_CapacityPlan_${country.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
