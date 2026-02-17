import type { Dimension, MaturityLevel } from './scoring';

// Helper to generate Radar Chart SVG string
const radarSVG = (values: Dimension[], size: number): string => {
    const pad = 70;
    const totalW = size + pad * 2;
    const totalH = size + pad * 2;
    const cx = totalW / 2;
    const cy = totalH / 2;
    const maxR = size * 0.32;
    const n = values.length;
    const step = (2 * Math.PI) / n;
    const start = -Math.PI / 2;

    let svg = `<svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" style="background:#0f172a;border-radius:12px;">`;
    svg += `<text x="${cx}" y="18" fill="#64748b" font-size="9" font-family="Arial,sans-serif" text-anchor="middle">MATURITY PROFILE</text>`;

    // Grid rings
    for (let ring = 1; ring <= 5; ring++) {
        const r = (ring / 5) * maxR;
        let pts = '';
        for (let i = 0; i < n; i++) {
            const a = start + i * step;
            pts += `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)} `;
        }
        svg += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>`;
        svg += `<text x="${cx + 4}" y="${cy - r + 10}" fill="rgba(255,255,255,0.25)" font-size="8" font-family="Arial,sans-serif">${ring}</text>`;
    }

    // Axis lines
    values.forEach((_, i) => {
        const a = start + i * step;
        const r = maxR;
        svg += `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    });

    // Data polygon
    let dataPts = '';
    values.forEach((v, i) => {
        const a = start + i * step;
        const r = (v.value / 5) * maxR;
        dataPts += `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)} `;
    });
    svg += `<polygon points="${dataPts}" fill="rgba(59,130,246,0.25)" stroke="rgba(96,165,250,0.9)" stroke-width="2"/>`;

    // Data dots & Labels
    values.forEach((v, i) => {
        const a = start + i * step;
        const r = (v.value / 5) * maxR;
        svg += `<circle cx="${cx + r * Math.cos(a)}" cy="${cy + r * Math.sin(a)}" r="3" fill="#60a5fa" stroke="white" stroke-width="1"/>`;

        const lR = maxR + 20;
        const x = cx + lR * Math.cos(a);
        const y = cy + lR * Math.sin(a);
        let anchor = 'middle';
        if (Math.cos(a) > 0.3) anchor = 'start';
        else if (Math.cos(a) < -0.3) anchor = 'end';

        // Score circle
        const bx = anchor === 'start' ? x - 12 : anchor === 'end' ? x + 12 : x;
        const by = Math.abs(Math.sin(a)) > 0.8 ? (Math.sin(a) > 0 ? y + 14 : y - 10) : y;
        svg += `<circle cx="${bx}" cy="${by - 1}" r="8" fill="rgba(59,130,246,0.3)" stroke="rgba(96,165,250,0.5)" stroke-width="1"/>`;
        svg += `<text x="${bx}" y="${by + 2}" fill="#60a5fa" font-size="9" font-weight="700" font-family="Arial,sans-serif" text-anchor="middle">${v.value}</text>`;

        // Label text
        const lx = anchor === 'start' ? bx + 14 : anchor === 'end' ? bx - 14 : x;
        const ly = Math.abs(Math.sin(a)) > 0.8 ? by : y;
        svg += `<text x="${lx}" y="${ly + 3}" fill="#cbd5e1" font-size="9" font-family="Arial,sans-serif" text-anchor="${anchor}">${v.label}</text>`;
    });

    svg += '</svg>';
    return svg;
};

// Helper to generate Gap Analysis SVG string
const gapBarSVG = (_values: Dimension[], gaps: any[], _compositeScore: number, _maturityLabel: string): string => {
    const w = 340, barH = 22, gap = 6, topPad = 36, bottomPad = 30;
    const sortedGaps = [...gaps].sort((a, b) => b.priority - a.priority);
    const h = topPad + sortedGaps.length * (barH + gap) + bottomPad;
    const labelW = 90, barStart = labelW + 8, barMaxW = w - barStart - 40;

    let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="background:#0f172a;border-radius:12px;">`;
    svg += `<text x="${w / 2}" y="18" fill="#64748b" font-size="9" font-family="Arial,sans-serif" text-anchor="middle">GAP &amp; PRIORITY ANALYSIS</text>`;

    // Scale markers
    for (let s = 1; s <= 5; s++) {
        const x = barStart + (s / 5) * barMaxW;
        svg += `<line x1="${x}" y1="${topPad - 4}" x2="${x}" y2="${topPad + sortedGaps.length * (barH + gap) - gap}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
        svg += `<text x="${x}" y="${topPad - 8}" fill="rgba(255,255,255,0.3)" font-size="7" font-family="Arial,sans-serif" text-anchor="middle">${s}</text>`;
    }

    const colors: Record<number, string> = { 5: '#22c55e', 4: '#3b82f6', 3: '#f59e0b', 2: '#ea580c', 1: '#ef4444' };

    sortedGaps.forEach((g, i) => {
        const y = topPad + i * (barH + gap);
        const scoreW = (g.value / 5) * barMaxW;
        const gapW = (g.gap / 5) * barMaxW;

        svg += `<text x="${labelW}" y="${y + barH / 2 + 3}" fill="#cbd5e1" font-size="9" font-family="Arial,sans-serif" text-anchor="end">${g.dimension.label}</text>`;
        svg += `<rect x="${barStart}" y="${y}" width="${barMaxW}" height="${barH}" rx="4" fill="rgba(255,255,255,0.04)"/>`;
        svg += `<rect x="${barStart}" y="${y}" width="${scoreW}" height="${barH}" rx="4" fill="${colors[Math.round(g.value)] || '#3b82f6'}" opacity="0.7"/>`;

        if (g.gap > 0) {
            svg += `<rect x="${barStart + scoreW}" y="${y}" width="${gapW}" height="${barH}" rx="0" fill="rgba(239,68,68,0.12)"/>`;
            svg += `<text x="${barStart + scoreW + gapW / 2}" y="${y + barH / 2 + 3}" fill="#f87171" font-size="7" font-family="Arial,sans-serif" text-anchor="middle" opacity="0.8">-${g.gap}</text>`;
        }

        svg += `<text x="${barStart + scoreW - 4}" y="${y + barH / 2 + 3}" fill="white" font-size="9" font-weight="700" font-family="Arial,sans-serif" text-anchor="end">${g.value}</text>`;
        svg += `<text x="${barStart + barMaxW + 4}" y="${y + barH / 2 + 3}" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="start">${g.priority.toFixed(2)}</text>`;
    });

    // Legend
    const ly = topPad + sortedGaps.length * (barH + gap) + 8;
    svg += `<rect x="${barStart}" y="${ly}" width="8" height="8" rx="2" fill="#3b82f6" opacity="0.7"/>`;
    svg += `<text x="${barStart + 12}" y="${ly + 7}" fill="#94a3b8" font-size="7" font-family="Arial,sans-serif">Current Score</text>`;
    svg += `<rect x="${barStart + 80}" y="${ly}" width="8" height="8" rx="2" fill="rgba(239,68,68,0.3)"/>`;
    svg += `<text x="${barStart + 92}" y="${ly + 7}" fill="#94a3b8" font-size="7" font-family="Arial,sans-serif">Gap to Level 5</text>`;
    svg += `<text x="${w - 6}" y="${ly + 7}" fill="#64748b" font-size="7" font-family="Arial,sans-serif" text-anchor="end">Priority →</text>`;
    svg += '</svg>';
    return svg;
};

// Generates the narrative text (Logic from article-1.html)
const generateNarrative = (score: number, maturity: MaturityLevel, _weightedSum: number, values: Dimension[], _gaps: any[], rmi: number, isoStage: string): string => {
    // Basic logic port
    const strongest = [...values].sort((a, b) => b.value - a.value)[0];
    const weakest = [...values].sort((a, b) => a.value - b.value)[0];
    const criticalCount = values.filter(d => d.value <= 2).length;

    let benchRef = '';
    if (score >= 82) benchRef = 'exceeds the Tier IV industry benchmark (82)';
    else if (score >= 65) benchRef = 'meets or exceeds the Tier III benchmark (65)';
    else if (score >= 45) benchRef = 'aligns with the Tier II benchmark range (45)';
    else if (score >= 25) benchRef = 'falls within the Tier I benchmark range (25)';
    else benchRef = 'falls below the Tier I baseline';

    let html = `<div style="page-break-before:auto;margin-top:24px;">
        <h2 style="font-size:16px;color:#1e3a5f;border-bottom:3px solid #1e3a5f;padding-bottom:6px;margin-bottom:14px;">Executive Assessment & Recommendations</h2>
        
        <div style="background:#f8fafc;border-left:4px solid ${maturity.color};padding:12px;margin-bottom:16px;font-size:11px;line-height:1.5;">
            <strong>Overall Assessment:</strong> This facility achieves a composite maturity score of <strong style="color:${maturity.color}">${score}/100</strong> (Level ${maturity.level} — ${maturity.label}), which ${benchRef}.
            The Risk Mitigation Index (RMI) stands at <strong>${rmi.toFixed(1)}%</strong>, indicating the facility's current effectiveness in mitigating operational risks.
            <br><br>
            <strong>ISO 55001 Alignment:</strong> The facility is currently in the <strong>${isoStage}</strong> stage of the asset management lifecycle.
        </div>

        <div style="display:flex;gap:12px;margin-bottom:16px;">
            <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:10px;">
                <div style="font-size:10px;font-weight:700;color:#10b981;margin-bottom:4px;">STRENGTHS</div>
                <div style="font-size:11px;">${strongest.label} leads at ${strongest.value}/5.</div>
            </div>
            <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:10px;">
                <div style="font-size:10px;font-weight:700;color:#ef4444;margin-bottom:4px;">VULNERABILITIES</div>
                <div style="font-size:11px;">${weakest.label} trails at ${weakest.value}/5. ${criticalCount > 0 ? `${criticalCount} dimensions critical.` : ''}</div>
            </div>
        </div>
    </div>`;
    return html;
};

export const printReport = (state: any, derived: any) => {
    const { dimensions, facilityMeta } = state;
    const { compositeScore, weightedSum, maturityLevel, gaps, riskAnalysis } = derived;
    const score = Math.round(compositeScore);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // RMI & ISO logic reused
    let isoStage = '';
    if (score < 40) isoStage = 'Awareness';
    else if (score < 70) isoStage = 'Managed';
    else isoStage = 'Optimization';

    // Dimension Rows
    const dimRows = dimensions.map((d: Dimension) => {
        const pct = (d.value / 5) * 100;
        const contrib = ((d.value * d.weight) / 4) * 100;
        return `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${d.label}</td>
            <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e5e7eb;">${d.value}/5</td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">${(d.weight * 100).toFixed(0)}%</td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e7eb;font-family:monospace;">${contrib.toFixed(1)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;"><div style="background:#e5e7eb;border-radius:4px;height:12px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#3b82f6,#60a5fa);border-radius:4px;"></div></div></td></tr>`;
    }).join('');

    // Priority Rows
    const topGaps = [...gaps].sort((a: any, b: any) => b.priority - a.priority).filter((g: any) => g.gap > 0).slice(0, 5);
    const priorityRows = topGaps.map((p: any, i: number) =>
        `<tr><td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;">${i + 1}</td><td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${p.dimension.label}</td><td style="padding:5px 8px;text-align:center;border-bottom:1px solid #e5e7eb;">${p.dimension.value}/5</td><td style="padding:5px 8px;text-align:center;border-bottom:1px solid #e5e7eb;">${p.gap}</td><td style="padding:5px 8px;text-align:right;border-bottom:1px solid #e5e7eb;font-family:monospace;">${p.priority.toFixed(3)}</td></tr>`
    ).join('');

    // Benchmarks (Static for now, matching article-1)
    const benchmarks = [
        { tier: 'Tier I', avg: 25 },
        { tier: 'Tier II', avg: 45 },
        { tier: 'Tier III', avg: 65 },
        { tier: 'Tier IV', avg: 82 }
    ];
    const benchRows = benchmarks.map(b => {
        const isClose = Math.abs(score - b.avg) === Math.min(...benchmarks.map(x => Math.abs(score - x.avg)));
        return `<tr${isClose ? ' style="background:#eff6ff;"' : ''}><td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;">${b.tier}</td><td style="padding:5px 8px;text-align:center;border-bottom:1px solid #e5e7eb;">${b.avg}</td><td style="padding:5px 8px;text-align:center;border-bottom:1px solid #e5e7eb;">${score >= b.avg ? 'Above' : 'Below'}</td></tr>`;
    }).join('');

    // Facility HTML
    const facilityHTML = `
        <div style="margin-bottom:18px;">
            <h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #3b82f6;padding-bottom:5px;margin-bottom:10px;">Facility Context</h2>
            <table style="width:100%;font-size:11px;">
                <tr>
                    <td style="padding:4px 0;color:#6b7280;">Facility Name</td><td style="padding:4px 0;font-weight:600;">${facilityMeta.name || '-'}</td>
                    <td style="padding:4px 0;color:#6b7280;">Location</td><td style="padding:4px 0;font-weight:600;">${facilityMeta.location || '-'}</td>
                </tr>
                <tr>
                    <td style="padding:4px 0;color:#6b7280;">Date</td><td style="padding:4px 0;font-weight:600;">${facilityMeta.date}</td>
                    <td style="padding:4px 0;color:#6b7280;">Assessor</td><td style="padding:4px 0;font-weight:600;">${facilityMeta.assessor || '-'}</td>
                </tr>
            </table>
        </div>
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Maturity Report — ${dateStr}</title>
    <style>@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:15mm;}}</style></head>
    <body style="font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:0 auto;padding:36px;color:#1f2937;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:20px;">
            <div><h1 style="font-size:20px;color:#1e3a5f;margin:0;">Operational Maturity Assessment Report</h1><p style="font-size:11px;color:#6b7280;margin:4px 0 0;">Generated ${dateStr} · resistancezero.com</p></div>
            <div style="text-align:right;">
                <div style="font-size:32px;font-weight:800;color:${maturityLevel.color};font-family:monospace;">${score}</div>
                <div style="font-size:12px;color:#6b7280;">${maturityLevel.label} (Level ${maturityLevel.level})</div>
            </div>
        </div>

        <!-- Executive Summary Badges -->
        <div style="display:flex;gap:12px;margin-bottom:20px;">
            <div style="flex:1;background:${maturityLevel.color};color:white;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:11px;opacity:0.8;">Composite Score</div>
                <div style="font-size:28px;font-weight:800;">${score}/100</div>
            </div>
            <div style="flex:1;background:#1e3a5f;color:white;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:11px;opacity:0.8;">Maturity Level</div>
                <div style="font-size:22px;font-weight:700;">Level ${maturityLevel.level}</div>
                <div style="font-size:12px;opacity:0.9;">${maturityLevel.label}</div>
            </div>
            <div style="flex:1;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:11px;color:#6b7280;">Weighted Average</div>
                <div style="font-size:22px;font-weight:700;color:#1e3a5f;font-family:monospace;">${weightedSum.toFixed(2)}</div>
                <div style="font-size:11px;color:#6b7280;">out of 5.00</div>
            </div>
        </div>

        ${facilityHTML}

        <!-- Charts -->
        <div style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-start;">
            <div style="flex:1;text-align:center;">${radarSVG(dimensions, 280)}</div>
            <div style="flex:1;text-align:center;">${gapBarSVG(dimensions, gaps, score, maturityLevel.label)}</div>
        </div>

        <!-- Dimension Scores -->
        <h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #3b82f6;padding-bottom:5px;margin-bottom:10px;">Dimension Scores</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr style="background:#1e3a5f;color:white;"><th style="padding:6px 8px;text-align:left;">Dimension</th><th style="padding:6px 8px;text-align:center;">Score</th><th style="padding:6px 8px;text-align:right;">Weight</th><th style="padding:6px 8px;text-align:right;">Contribution</th><th style="padding:6px 8px;min-width:100px;">Bar</th></tr>
            ${dimRows}
            <tr style="background:#1e3a5f;color:white;font-weight:700;"><td style="padding:6px 8px;">TOTAL</td><td style="padding:6px 8px;text-align:center;">${weightedSum.toFixed(2)}</td><td style="padding:6px 8px;text-align:right;">100%</td><td style="padding:6px 8px;text-align:right;font-family:monospace;">${compositeScore.toFixed(1)}</td><td></td></tr>
        </table>

        <!-- Improvement Priorities -->
        <h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #f59e0b;padding-bottom:5px;margin:18px 0 10px;">Improvement Priorities</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr style="background:#f59e0b;color:white;"><th style="padding:5px 8px;text-align:left;">#</th><th style="padding:5px 8px;text-align:left;">Dimension</th><th style="padding:5px 8px;text-align:center;">Current</th><th style="padding:5px 8px;text-align:center;">Gap</th><th style="padding:5px 8px;text-align:right;">Priority</th></tr>
            ${priorityRows}
        </table>

        <!-- Benchmark Comparison -->
        <h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #10b981;padding-bottom:5px;margin:18px 0 10px;">Benchmark Comparison</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr style="background:#10b981;color:white;"><th style="padding:5px 8px;text-align:left;">Tier</th><th style="padding:5px 8px;text-align:center;">Typical Score</th><th style="padding:5px 8px;text-align:center;">Your Position</th></tr>
            ${benchRows}
            <tr style="background:#eff6ff;font-weight:700;"><td style="padding:5px 8px;">Your Score</td><td style="padding:5px 8px;text-align:center;font-family:monospace;color:${maturityLevel.color};">${score}</td><td style="padding:5px 8px;text-align:center;">${maturityLevel.label}</td></tr>
        </table>

        ${generateNarrative(score, maturityLevel, weightedSum, dimensions, gaps, riskAnalysis.rmi, isoStage)}

        <div style="margin-top:36px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;">
            <p>Assessment based on self-reported scores. Actual maturity may vary based on audit findings and operational evidence.</p>
            <p style="margin-top:4px;">Generated by Operational Maturity Calculator · resistancezero.com · © ${new Date().getFullYear()} Bagus Dwi Permana</p>
        </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 500);
    } else {
        alert('Please allow popups to download the PDF report.');
    }
};
