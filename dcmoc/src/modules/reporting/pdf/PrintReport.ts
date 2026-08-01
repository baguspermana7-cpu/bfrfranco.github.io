/* ─── STANDARD PDF RENDERER — print-window HTML (min-standard reference) ─────
 * The owner's min standard ("OPEX Report" reference PDF) is produced by the
 * opex-calculator print-window technique: styled HTML → window.print(). jsPDF
 * hand-drawing cannot match it, so every DCMOC page export renders through
 * THIS module. Takes the same PillarReport contract as PillarPdf plus the
 * optional donut/assessment extras from the reference.
 * Structure: header (title+date+org+headline) → KPI cards → Configuration →
 * sections (colored titles, navy-header tables, optional donut) → callouts →
 * Executive Assessment (profile chip) → Action Items (priority chips) →
 * summary band → note + disclaimer + footer.
 * ──────────────────────────────────────────────────────────────────────── */

import type { PillarReport, PillarKpi, PillarSection } from './PillarPdf';

export interface ReportDonutSlice { label: string; value: number; color: string }
export interface ReportAssessment { label: string; color?: string; valueLine: string; narrative: string }
export interface StandardReport extends PillarReport {
    donut?: { title: string; unitLabel: string; slices: ReportDonutSlice[] };
    assessment?: ReportAssessment;
    headline?: PillarKpi;               // hero value chip in the header
}

const NAVY = '#1e3a5f';
const SECTION_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#22d3ee', '#ef4444', '#14b8a6', '#0ea5e9', '#d97706'];
const TONES = {
    info: { bg: '#eff6ff', border: '#bfdbfe', title: '#1e40af' },
    good: { bg: '#ecfdf5', border: '#a7f3d0', title: '#065f46' },
    warn: { bg: '#fffbeb', border: '#fde68a', title: '#92400e' },
} as const;

const esc = (v: unknown): string =>
    String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const secTitle = (t: string, color: string): string =>
    `<h2 style="font-size:13px;color:${NAVY};margin:18px 0 8px;padding-left:8px;border-left:4px solid ${color};">${esc(t)}</h2>`;

function kpiCard(k: PillarKpi, hero: boolean): string {
    const bg = hero ? NAVY : '#f8fafc';
    const fg = hero ? '#fbbf24' : NAVY;
    return `<div style="flex:1;background:${bg};${hero ? 'color:white;border:none;' : 'border:1px solid #e5e7eb;'}border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:9px;${hero ? 'opacity:.7;' : 'color:#94a3b8;'}text-transform:uppercase;letter-spacing:1px;">${esc(k.label)}</div>
        <div style="font-size:18px;font-weight:700;color:${fg};font-family:monospace;margin:3px 0;">${esc(k.value)}</div>
        <div style="font-size:9.5px;${hero ? 'opacity:.8;' : 'color:#94a3b8;'}">${esc(k.sub ?? '')}</div>
    </div>`;
}

function sectionTable(s: PillarSection): string {
    const tH = 'padding:6px 8px;text-align:left;font-size:10px;';
    const head = s.head.map((h) => `<th scope="col" style="${tH}">${esc(h)}</th>`).join('');
    const rows = s.rows.map((r, i) =>
        `<tr${i % 2 ? ' style="background:#f9fafb;"' : ''}>${r.map((c) =>
            `<td style="padding:5px 8px;font-size:10.5px;border-bottom:1px solid #f1f5f9;">${esc(c)}</td>`).join('')}</tr>`
    ).join('');
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <tr style="background:${NAVY};color:white;">${head}</tr>${rows}</table>`;
}

/* SVG donut ported from the opex-calculator reference renderer. */
function svgDonut(d: NonNullable<StandardReport['donut']>): string {
    const size = 230;
    const items = d.slices.filter((s) => s.value > 0);
    const total = items.reduce((a, s) => a + s.value, 0);
    if (!total) return '';
    const legendH = 14 * items.length + 8;
    const r = size * 0.32, cx = size / 2, cy = size * 0.38;
    let angle = -Math.PI / 2;
    let svg = `<svg width="${size}" height="${size * 0.75 + legendH + 10}" xmlns="http://www.w3.org/2000/svg" role="img">`;
    items.forEach((s) => {
        const pct = s.value / total;
        const a1 = angle, a2 = angle + pct * 2 * Math.PI, la = pct > 0.5 ? 1 : 0;
        const ir = r * 0.55;
        svg += `<path d="M${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} A${r},${r} 0 ${la},1 ${cx + r * Math.cos(a2)},${cy + r * Math.sin(a2)} L${cx + ir * Math.cos(a2)},${cy + ir * Math.sin(a2)} A${ir},${ir} 0 ${la},0 ${cx + ir * Math.cos(a1)},${cy + ir * Math.sin(a1)} Z" fill="${s.color}" opacity="0.85"/>`;
        angle = a2;
    });
    const fmt = total >= 1e6 ? `$${(total / 1e6).toFixed(1)}M` : total >= 1e3 ? `$${(total / 1e3).toFixed(0)}K` : `${Math.round(total)}`;
    svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="14" font-weight="700" fill="${NAVY}" font-family="monospace">${esc(fmt)}</text>`;
    svg += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="#6b7280">${esc(d.unitLabel)}</text>`;
    const ly = size * 0.75 + 10;
    items.forEach((s, i) => {
        const yy = ly + i * 14;
        svg += `<rect x="10" y="${yy}" width="8" height="8" rx="2" fill="${s.color}"/>`;
        svg += `<text x="22" y="${yy + 8}" font-size="8.5" fill="#374151">${esc(s.label)} ${((s.value / total) * 100).toFixed(1)}%</text>`;
    });
    return svg + '</svg>';
}

export function renderStandardReport(r: StandardReport): string {
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    let ci = 0;
    const nextColor = () => SECTION_COLORS[ci++ % SECTION_COLORS.length];

    const kpisHtml = r.kpis.length
        ? `<div style="display:flex;gap:10px;margin:14px 0;">${r.kpis.slice(0, 4).map((k, i) => kpiCard(k, i === 0)).join('')}</div>`
        + (r.kpis.length > 4 ? `<div style="display:flex;gap:10px;margin:0 0 14px;">${r.kpis.slice(4, 8).map((k) => kpiCard(k, false)).join('')}</div>` : '')
        : '';

    const configHtml = r.config?.length
        ? secTitle('Configuration', nextColor()) + `<table style="width:100%;font-size:11px;">${
            Array.from({ length: Math.ceil(r.config.length / 2) }, (_, row) => {
                const a = r.config![row * 2], b = r.config![row * 2 + 1];
                return `<tr>
                    <td style="padding:4px 0;color:#94a3b8;width:150px;">${esc(a[0])}</td><td style="padding:4px 0;font-weight:600;">${esc(a[1])}</td>
                    ${b ? `<td style="padding:4px 0;color:#94a3b8;width:150px;">${esc(b[0])}</td><td style="padding:4px 0;font-weight:600;">${esc(b[1])}</td>` : '<td></td><td></td>'}
                </tr>`;
            }).join('')}</table>`
        : '';

    const donutHtml = r.donut ? `<div style="text-align:center;margin:8px 0;">${svgDonut(r.donut)}</div>` : '';

    const sectionsHtml = r.sections.map((s) => secTitle(s.title, nextColor()) + sectionTable(s)).join('');

    const calloutsHtml = (r.callouts ?? []).map((c) => {
        const t = TONES[c.tone ?? 'info'];
        return `<div style="background:${t.bg};border:1px solid ${t.border};border-radius:10px;padding:12px;margin:10px 0;">
            <div style="font-size:12px;font-weight:700;color:${t.title};margin-bottom:5px;">${esc(c.title)}</div>
            <p style="font-size:11px;line-height:1.6;color:#374151;margin:0;">${esc(c.body)}</p>
        </div>`;
    }).join('');

    const assessHtml = r.assessment ? `
        <h2 style="font-size:15px;color:${NAVY};border-bottom:3px solid ${NAVY};padding-bottom:6px;margin:20px 0 12px;">Executive Assessment</h2>
        <div style="display:flex;gap:12px;margin-bottom:12px;">
            <div style="flex:0 0 140px;background:${r.assessment.color ?? '#0284c7'};color:white;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:1px;">Profile</div>
                <div style="font-size:15px;font-weight:800;margin:4px 0;">${esc(r.assessment.label)}</div>
                <div style="font-size:11px;opacity:.9;">${esc(r.assessment.valueLine)}</div>
            </div>
            <div style="flex:1;font-size:11.5px;line-height:1.65;color:#374151;">${esc(r.assessment.narrative)}</div>
        </div>` : '';

    const actionsHtml = r.actions?.length
        ? secTitle('Prioritized Action Items', nextColor()) + `<table style="width:100%;border-collapse:collapse;">${
            r.actions.map((a) => {
                const p = a.priority === 'HIGH' ? '#dc2626' : a.priority === 'MEDIUM' ? '#d97706' : '#059669';
                return `<tr><td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;width:70px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${p};color:white;font-size:9px;font-weight:700;">${esc(a.priority)}</span></td>
                    <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${esc(a.action)}</td></tr>`;
            }).join('')}</table>`
        : '';

    const bandHtml = r.summaryBand?.length
        ? `<div style="display:flex;gap:8px;background:${NAVY};border-radius:10px;padding:12px;margin:18px 0 10px;">${
            r.summaryBand.map((k) => `<div style="flex:1;text-align:center;color:white;">
                <div style="font-size:13px;font-weight:700;font-family:monospace;">${esc(k.value)}</div>
                <div style="font-size:7.5px;opacity:.65;text-transform:uppercase;letter-spacing:.5px;">${esc(k.label)}</div>
            </div>`).join('')}</div>`
        : '';

    const headline = r.headline ?? r.kpis[0];

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(r.title)} — ${dateStr}</title>
    <style>
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:12mm 15mm;}}
        table{page-break-inside:auto;}tr{page-break-inside:avoid;}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#111827;margin:0;padding:20px 26px;font-size:12px;}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${NAVY};padding-bottom:10px;">
        <div>
            <div style="font-size:20px;font-weight:800;color:${NAVY};">${esc(r.title)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">DC-OS · ${esc(r.layer)} · ${esc(r.project)} · Generated ${dateStr}${r.orgName ? ` · ${esc(r.orgName)}` : ''}</div>
        </div>
        ${headline ? `<div style="background:${NAVY};color:#fbbf24;border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">${esc(headline.label)}</div>
            <div style="font-size:16px;font-weight:800;font-family:monospace;">${esc(headline.value)}</div>
        </div>` : ''}
    </div>
    ${kpisHtml}${configHtml}${sectionsHtml}${donutHtml}${calloutsHtml}${assessHtml}${actionsHtml}${bandHtml}
    ${r.note ? `<p style="font-size:10px;color:#64748b;line-height:1.5;margin:10px 0;">${esc(r.note)}</p>` : ''}
    <div style="border-top:1px solid #e5e7eb;margin-top:14px;padding-top:8px;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
        <span>Planning estimates — engine-computed from the placed requirements; not a quotation. DC-OS · resistancezero.com</span>
        <span>CONFIDENTIAL</span>
    </div>
    </body></html>`;
}

/** Open the standard report in a print window. Returns false when popup blocked. */
export function openStandardReport(r: StandardReport): boolean {
    if (typeof window === 'undefined') return false;
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(renderStandardReport(r));
    w.document.close();
    window.setTimeout(() => { try { w.print(); } catch { /* window closed */ } }, 500);
    return true;
}
