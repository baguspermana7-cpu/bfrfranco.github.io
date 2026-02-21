
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════════
// PDF VECTOR DRAWING UTILITIES — Consultancy Grade
// ═══════════════════════════════════════════════════════════════

export interface BrandingConfig {
    logoBase64?: string;
    primaryColor: string; // Hex
    secondaryColor: string; // Hex
    companyName?: string;
}

// Default constants for fallback
const DEFAULT_PRIMARY = [6, 182, 212] as [number, number, number]; // Cyan-500
const DEFAULT_SECONDARY = [16, 185, 129] as [number, number, number]; // Emerald-500

export const PDF_COLORS = {
    primary: DEFAULT_PRIMARY,
    secondary: DEFAULT_SECONDARY,
    accent: [99, 102, 241] as [number, number, number],       // Indigo-500
    danger: [244, 63, 94] as [number, number, number],        // Rose-500
    warning: [245, 158, 11] as [number, number, number],      // Amber-500
    success: [34, 197, 94] as [number, number, number],       // Green-500
    info: [59, 130, 246] as [number, number, number],         // Blue-500
    slate900: [15, 23, 42] as [number, number, number],
    slate800: [30, 41, 59] as [number, number, number],
    slate700: [51, 65, 85] as [number, number, number],
    slate600: [71, 85, 105] as [number, number, number],
    slate500: [100, 116, 139] as [number, number, number],
    slate400: [148, 163, 184] as [number, number, number],
    slate300: [203, 213, 225] as [number, number, number],
    slate200: [226, 232, 240] as [number, number, number],
    slate100: [241, 245, 249] as [number, number, number],
    slate50: [248, 250, 252] as [number, number, number],
    text: [51, 65, 85] as [number, number, number],
    textLight: [100, 116, 139] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    black: [0, 0, 0] as [number, number, number],
};

const PAGE_WIDTH = 210; // A4
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

// Helper to convert hex to RGB
const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : DEFAULT_PRIMARY;
};

// ─── PAGE MANAGEMENT ────────────────────────────────────────
export const ensureSpace = (doc: jsPDF, yPos: number, needed: number, pageNum: { current: number }): number => {
    const pageHeight = doc.internal.pageSize.height;
    if (yPos + needed > pageHeight - 20) {
        drawFooter(doc, pageNum.current);
        doc.addPage();
        pageNum.current++;
        return 35; // Start after header area
    }
    return yPos;
};

// ─── COVER PAGE ─────────────────────────────────────────────
export const drawCoverPage = (
    doc: jsPDF,
    title: string,
    subtitle: string,
    meta: { client?: string; date: string; version?: string; confidential?: boolean },
    branding?: BrandingConfig
) => {
    const w = doc.internal.pageSize.width;
    const h = doc.internal.pageSize.height;

    // Parse branding colors
    const primaryInfo = branding?.primaryColor ? hexToRgb(branding.primaryColor) : PDF_COLORS.primary;

    // Full dark background
    doc.setFillColor(...PDF_COLORS.slate900);
    doc.rect(0, 0, w, h, 'F');

    // Accent stripe
    doc.setFillColor(...primaryInfo);
    doc.rect(0, 0, 6, h, 'F');

    // Branding Logo or Geometric accent
    if (branding?.logoBase64) {
        try {
            // Calculate Logo dimensions to fit in top right
            const logoSize = 40;
            doc.addImage(branding.logoBase64, 'PNG', w - logoSize - MARGIN, MARGIN, logoSize, logoSize, undefined, 'FAST');
        } catch (e) {
            console.warn('Failed to render logo', e);
        }
    } else {
        // Fallback Geometric accent (top-right)
        doc.setFillColor(primaryInfo[0], primaryInfo[1], primaryInfo[2]);
        doc.circle(w - 30, 40, 60, 'F');
        doc.setFillColor(...PDF_COLORS.slate900);
        doc.circle(w - 30, 40, 55, 'F'); // Inner cutout
    }

    // Title Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.setTextColor(255, 255, 255);
    const titleLines = title.toUpperCase().split('\n');
    const titleLineHeight = 14;
    const titleStartY = h * 0.35;
    doc.text(titleLines, MARGIN + 10, titleStartY);
    const titleEndY = titleStartY + (titleLines.length - 1) * titleLineHeight;

    // Subtitle — positioned below the full title
    doc.setFontSize(14);
    doc.setTextColor(...primaryInfo);
    doc.text(subtitle, MARGIN + 10, titleEndY + 18);

    // Divider
    doc.setDrawColor(...primaryInfo);
    doc.setLineWidth(0.5);
    doc.line(MARGIN + 10, titleEndY + 24, MARGIN + 120, titleEndY + 24);

    // Meta info
    let metaY = titleEndY + 39;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.slate400);

    // Client / Branding Name
    if (branding?.companyName) {
        doc.text(`Prepared by: ${branding.companyName}`, MARGIN + 10, metaY);
        metaY += 7;
    }

    if (meta.client) {
        doc.text(`Prepared for: ${meta.client}`, MARGIN + 10, metaY);
        metaY += 7;
    }
    doc.text(`Date: ${meta.date}`, MARGIN + 10, metaY);
    metaY += 7;
    doc.text(`Version: ${meta.version || '1.0'}`, MARGIN + 10, metaY);

    // Confidential Badge
    if (meta.confidential !== false) {
        doc.setFillColor(...PDF_COLORS.danger);
        doc.roundedRect(MARGIN + 10, h - 50, 50, 10, 2, 2, 'F');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('CONFIDENTIAL', MARGIN + 15, h - 43);
    }

    // Footer Branding
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.slate600);
    doc.setFont('helvetica', 'normal');
    const footerText = branding?.companyName
        ? `Generated by ${branding.companyName} Operations Calculator`
        : 'Generated by DCMOC v2.0 — Data Center M&O Calculator';
    doc.text(footerText, MARGIN + 10, h - 15);
};

// ─── MODERN HEADER (Inner Pages) ────────────────────────────
export const drawModernHeader = (
    doc: jsPDF,
    title: string,
    subtitle: string = '',
    branding?: BrandingConfig
) => {
    const w = doc.internal.pageSize.width;
    const primaryInfo = branding?.primaryColor ? hexToRgb(branding.primaryColor) : PDF_COLORS.primary;

    doc.setFillColor(...PDF_COLORS.slate900);
    doc.rect(0, 0, w, 25, 'F');

    doc.setFillColor(...primaryInfo);
    doc.rect(0, 23, w, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(title, MARGIN, 16);

    // Optional Logo in Header
    if (branding?.logoBase64) {
        const logoH = 12;
        doc.addImage(branding.logoBase64, 'PNG', w - MARGIN - logoH, 6, logoH, logoH, undefined, 'FAST');
    } else if (subtitle) {
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.slate400);
        doc.text(subtitle, w - MARGIN, 16, { align: 'right' });
    }
};

// ─── FOOTER ─────────────────────────────────────────────────
export const drawFooter = (doc: jsPDF, pageNumber: number, branding?: BrandingConfig) => {
    const w = doc.internal.pageSize.width;
    const h = doc.internal.pageSize.height;

    doc.setDrawColor(...PDF_COLORS.slate200);
    doc.line(MARGIN, h - 15, w - MARGIN, h - 15);

    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.slate400);

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const appName = branding?.companyName ? branding.companyName : 'DCMOC v2.0';
    doc.text(`Generated ${today} | ${appName} | CONFIDENTIAL`, MARGIN, h - 8);
    doc.text(`Page ${pageNumber}`, w - MARGIN, h - 8, { align: 'right' });
};

// ─── SECTION TITLE ──────────────────────────────────────────
export const drawSectionTitle = (doc: jsPDF, y: number, title: string, number?: string, branding?: BrandingConfig): number => {
    const primaryInfo = branding?.primaryColor ? hexToRgb(branding.primaryColor) : PDF_COLORS.primary;

    // Accent bar
    doc.setFillColor(...primaryInfo);
    doc.rect(MARGIN, y, 3, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...PDF_COLORS.slate900);

    const prefix = number ? `${number}. ` : '';
    doc.text(`${prefix}${title}`, MARGIN + 6, y + 6);

    // Underline
    doc.setDrawColor(...PDF_COLORS.slate200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y + 10, PAGE_WIDTH - MARGIN, y + 10);

    return y + 16;
};

// ─── KPI CARD ───────────────────────────────────────────────
export const drawKpiCard = (
    doc: jsPDF, x: number, y: number, w: number, h: number,
    title: string, value: string, subtext: string, color: [number, number, number] = PDF_COLORS.secondary
) => {
    // Card background
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(...PDF_COLORS.slate200);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');

    // Accent bar
    doc.setFillColor(...color);
    doc.rect(x, y + 6, 2, h - 12, 'F');

    // Label
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.textLight);
    doc.setFont('helvetica', 'normal');
    doc.text(title.toUpperCase(), x + 5, y + 9);

    // Value
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text(value, x + 5, y + 19);

    // Subtext
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.textLight);
    doc.text(subtext, x + 5, y + h - 5);
};

// ─── EXECUTIVE BOX (Highlighted Recommendation) ─────────────
export const drawExecutiveBox = (doc: jsPDF, y: number, title: string, text: string, type: 'info' | 'warning' | 'success' = 'info'): number => {
    const colorMap = {
        info: PDF_COLORS.info,
        warning: PDF_COLORS.warning,
        success: PDF_COLORS.secondary,
    };
    const bgMap = {
        info: [239, 246, 255] as [number, number, number],    // Blue-50
        warning: [254, 252, 232] as [number, number, number], // Yellow-50
        success: [236, 253, 245] as [number, number, number], // Green-50
    };

    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 16);
    const boxH = 14 + (lines.length * 4.5);

    // Background
    doc.setFillColor(...bgMap[type]);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxH, 2, 2, 'F');

    // Left accent
    doc.setFillColor(...colorMap[type]);
    doc.rect(MARGIN, y, 3, boxH, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...colorMap[type]);
    doc.text(title, MARGIN + 7, y + 8);

    // Body
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(lines, MARGIN + 7, y + 14);

    return y + boxH + 4;
};

// ─── NARRATIVE PARAGRAPH ────────────────────────────────────
export const drawParagraph = (doc: jsPDF, y: number, text: string, maxWidth: number = CONTENT_WIDTH): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.text);

    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, MARGIN, y);

    return y + (lines.length * 4.5) + 2;
};

// ─── HORIZONTAL BAR CHART ───────────────────────────────────
export const drawHorizontalBarChart = (
    doc: jsPDF,
    x: number, y: number, w: number,
    data: { label: string; value: number; color: [number, number, number] }[],
    title: string
): number => {
    // Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text(title, x, y);

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const barH = 8;
    const gap = 4;
    let currentY = y + 8;

    data.forEach(item => {
        // Label
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.text);
        doc.text(item.label, x, currentY + 5);

        // Bar track
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(x + 45, currentY, w - 90, barH, 1, 1, 'F');

        // Bar fill
        const barW = Math.max(2, ((item.value / maxVal) * (w - 90)));
        doc.setFillColor(...item.color);
        doc.roundedRect(x + 45, currentY, barW, barH, 1, 1, 'F');

        // Value
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_COLORS.slate900);
        const valueStr = item.value >= 1000 ? `$${(item.value / 1000).toFixed(1)}k` : `$${item.value.toFixed(0)}`;
        doc.text(valueStr, x + w - 40, currentY + 5.5, { align: 'right' });

        currentY += barH + gap;
    });

    return currentY + 4;
};

// ─── STACKED BAR / DISTRIBUTION CHART ───────────────────────
export const drawDistributionChart = (
    doc: jsPDF,
    x: number, y: number, w: number,
    data: { label: string, value: number, color: [number, number, number] }[],
    title: string
): number => {
    const h = 60;

    // Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text(title, x, y + 8);

    const total = data.reduce((a, b) => a + b.value, 0);
    let currentX = x;
    const barY = y + 15;
    const barH = 10;

    // Stacked bar
    data.forEach(item => {
        const itemW = (item.value / total) * w;
        if (itemW > 0) {
            doc.setFillColor(...item.color);
            doc.rect(currentX, barY, itemW, barH, 'F');
            currentX += itemW;
        }
    });

    // Legend
    let legendY = barY + 18;
    let col = 0;

    data.forEach(item => {
        if (col > 2) { col = 0; legendY += 8; }
        const legendX = x + (col * (w / 3));

        doc.setFillColor(...item.color);
        doc.circle(legendX + 2, legendY - 1, 2, 'F');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.text);
        const pct = ((item.value / total) * 100).toFixed(1);
        const valStr = item.value >= 1000000 ? `$${(item.value / 1e6).toFixed(2)}M` : item.value >= 1000 ? `$${(item.value / 1000).toFixed(1)}k` : `$${item.value.toFixed(0)}`;
        doc.text(`${item.label}: ${valStr} (${pct}%)`, legendX + 6, legendY);

        col++;
    });

    return legendY + 10;
};

// ─── AREA / LINE CHART ──────────────────────────────────────
export const drawAreaChart = (
    doc: jsPDF,
    x: number, y: number, w: number, h: number,
    labels: string[], data: number[],
    title: string,
    color: [number, number, number] = PDF_COLORS.secondary
): number => {
    // Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text(title, x, y - 2);

    // Background
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, w, h, 1, 1, 'F');

    // Axes
    doc.setDrawColor(...PDF_COLORS.slate200);
    doc.setLineWidth(0.2);
    doc.line(x, y + h, x + w, y + h);
    doc.line(x, y, x, y + h);

    // Grid lines (horizontal)
    for (let i = 1; i <= 4; i++) {
        const gy = y + (h * i / 5);
        doc.setDrawColor(241, 245, 249);
        doc.line(x, gy, x + w, gy);
    }

    const maxVal = Math.max(...data) * 1.1;
    const stepX = w / (data.length - 1);

    const points = data.map((val, i) => ({
        x: x + (i * stepX),
        y: y + h - ((val / maxVal) * h)
    }));

    // Line
    doc.setDrawColor(...color);
    doc.setLineWidth(0.8);
    for (let i = 0; i < points.length - 1; i++) {
        doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    // Points + Values
    doc.setFillColor(255, 255, 255);
    points.forEach((p, i) => {
        if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) return;

        doc.setDrawColor(...color);
        doc.setFillColor(255, 255, 255);
        doc.circle(p.x, p.y, 1.2, 'FD');

        // Value label
        doc.setFontSize(5.5);
        doc.setTextColor(...PDF_COLORS.slate600);
        doc.setFont('helvetica', 'normal');
        const valStr = data[i] >= 1000000 ? `$${(data[i] / 1e6).toFixed(1)}M` : `$${(data[i] / 1000).toFixed(0)}k`;
        doc.text(valStr, p.x, p.y - 3, { align: 'center' });
    });

    // X-Axis Labels
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_COLORS.slate600);
    labels.forEach((label, i) => {
        const lx = x + (i * (w / (labels.length - 1)));
        doc.text(label, lx, y + h + 5, { align: 'center' });
    });

    return y + h + 10;
};

// ─── COMPARISON TABLE (8h vs 12h) ───────────────────────────
export const drawComparisonTable = (
    doc: jsPDF,
    y: number,
    rows: { metric: string; value8h: string; value12h: string; winner?: '8h' | '12h' | 'tie' }[],
    title: string
): number => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text(title, MARGIN, y);

    const tableY = y + 4;
    const colW = [70, 45, 45, 22];
    const rowH = 8;

    // Header
    doc.setFillColor(...PDF_COLORS.slate900);
    doc.rect(MARGIN, tableY, CONTENT_WIDTH, rowH, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Metric', MARGIN + 3, tableY + 5.5);
    doc.text('8h Continental', MARGIN + colW[0] + 3, tableY + 5.5);
    doc.text('12h (4on/4off)', MARGIN + colW[0] + colW[1] + 3, tableY + 5.5);
    doc.text('Better', MARGIN + colW[0] + colW[1] + colW[2] + 3, tableY + 5.5);

    let currentY = tableY + rowH;
    rows.forEach((row, i) => {
        // Alternating row bg
        if (i % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowH, 'F');
        }

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.text);
        doc.text(row.metric, MARGIN + 3, currentY + 5.5);
        doc.text(row.value8h, MARGIN + colW[0] + 3, currentY + 5.5);
        doc.text(row.value12h, MARGIN + colW[0] + colW[1] + 3, currentY + 5.5);

        // Winner indicator
        if (row.winner === '12h') {
            doc.setTextColor(...PDF_COLORS.secondary);
            doc.setFont('helvetica', 'bold');
            doc.text('12h ✓', MARGIN + colW[0] + colW[1] + colW[2] + 3, currentY + 5.5);
        } else if (row.winner === '8h') {
            doc.setTextColor(...PDF_COLORS.info);
            doc.setFont('helvetica', 'bold');
            doc.text('8h ✓', MARGIN + colW[0] + colW[1] + colW[2] + 3, currentY + 5.5);
        } else {
            doc.setTextColor(...PDF_COLORS.slate400);
            doc.text('—', MARGIN + colW[0] + colW[1] + colW[2] + 3, currentY + 5.5);
        }

        currentY += rowH;
    });

    // Border
    doc.setDrawColor(...PDF_COLORS.slate200);
    doc.rect(MARGIN, tableY, CONTENT_WIDTH, currentY - tableY);

    return currentY + 6;
};

// ─── INSIGHTS SECTION ───────────────────────────────────────
export const drawInsightsSection = (doc: jsPDF, y: number, insights: { title: string; description: string; severity: string; recommendation?: string }[]): number => {
    let yPos = y;

    insights.slice(0, 6).forEach(insight => {
        const color = insight.severity === 'high' ? PDF_COLORS.danger :
            insight.severity === 'medium' ? PDF_COLORS.warning : PDF_COLORS.secondary;

        const descLines = doc.splitTextToSize(insight.description, CONTENT_WIDTH - 12);
        const blockH = 12 + (descLines.length * 4);

        // Background
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN, yPos, CONTENT_WIDTH, blockH, 'F');

        // Severity bar
        doc.setFillColor(...color);
        doc.rect(MARGIN, yPos, 2.5, blockH, 'F');

        // Title
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_COLORS.slate900);
        doc.text(insight.title, MARGIN + 6, yPos + 6);

        // Description
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...PDF_COLORS.text);
        doc.text(descLines, MARGIN + 6, yPos + 12);

        yPos += blockH + 3;
    });

    return yPos;
};

// Legacy Compatibility
export const drawHeader = (doc: jsPDF, c: string, t: string) => drawModernHeader(doc, t, `Region: ${c}`);
export const drawRiskMatrix = (doc: jsPDF, x: number, y: number, w: number, risks: any[]) => {
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text('Risk Analysis', x, y);
};
export const drawBarChart = (doc: jsPDF, x: number, y: number, w: number, h: number, labels: string[], data: number[], title: string) => {
    doc.rect(x, y, w, h);
    doc.text(title, x, y - 2);
};

// ─── TABLE OF CONTENTS ──────────────────────────────────────
export interface TocItem {
    reason: string;
    source: string;
    validation: string;
    pages: string;
}

export const drawTableOfContents = (doc: jsPDF, y: number, items: TocItem[], title: string = "Table of Contents"): number => {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text(title, MARGIN, y);

    let currentY = y + 10;

    autoTable(doc, {
        startY: currentY,
        head: [['Reason', 'Source', 'Validation', 'Pages']],
        body: items.map(i => [i.reason, i.source, i.validation, i.pages]),
        theme: 'grid',
        headStyles: {
            fillColor: PDF_COLORS.slate900,
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            textColor: PDF_COLORS.text,
            fontSize: 8,
            valign: 'middle'
        },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 50 },
            2: { cellWidth: 60 },
            3: { cellWidth: 20, halign: 'center' }
        },
        margin: { left: MARGIN, right: MARGIN }
    });

    return (doc as any).lastAutoTable.finalY + 15;
};

// ─── COST CAPITULATION TABLE ────────────────────────────────
export const drawCostCapitulationTable = (doc: jsPDF, y: number, capexCosts: Record<string, number>, softCosts: { design?: number, pm?: number }, contingency: number, fomTotal: number, total: number): number => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text("Cost Capitulation", MARGIN, y);

    const formatMoney = (val: number) => `$${(val / 1_000_000).toFixed(2)}M`;

    const bodyData: any[] = [];
    let hardTotal = 0;

    // Hard Costs
    Object.entries(capexCosts).forEach(([k, v]) => {
        bodyData.push([{ content: k.toUpperCase(), styles: { fontStyle: 'normal' } }, formatMoney(v), `${((v / total) * 100).toFixed(1)}%`]);
        hardTotal += v;
    });

    // Subtotal Hard
    bodyData.push([{ content: 'SUBTOTAL (HARD COSTS)', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatMoney(hardTotal), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: `${((hardTotal / total) * 100).toFixed(1)}%`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);

    // Soft Costs
    const softTotal = (softCosts.design || 0) + (softCosts.pm || 0);
    bodyData.push([{ content: 'Design & Engineering Fee', styles: { fontStyle: 'normal' } }, formatMoney(softCosts.design || 0), `${(((softCosts.design || 0) / total) * 100).toFixed(1)}%`]);
    bodyData.push([{ content: 'Project Management Fee', styles: { fontStyle: 'normal' } }, formatMoney(softCosts.pm || 0), `${(((softCosts.pm || 0) / total) * 100).toFixed(1)}%`]);

    // Contingency & FOM
    bodyData.push([{ content: 'Construction Contingency', styles: { fontStyle: 'normal' } }, formatMoney(contingency), `${((contingency / total) * 100).toFixed(1)}%`]);
    if (fomTotal > 0) {
        bodyData.push([{ content: 'First of a Kind (FOM) Upgrades', styles: { fontStyle: 'normal' } }, formatMoney(fomTotal), `${((fomTotal / total) * 100).toFixed(1)}%`]);
    }

    // Grand Total
    bodyData.push([{ content: 'TOTAL ESTIMATED CAPEX', styles: { fontStyle: 'bold', fillColor: PDF_COLORS.secondary, textColor: 255 } }, { content: formatMoney(total), styles: { fontStyle: 'bold', fillColor: PDF_COLORS.secondary, textColor: 255 } }, { content: '100.0%', styles: { fontStyle: 'bold', fillColor: PDF_COLORS.secondary, textColor: 255 } }]);

    autoTable(doc, {
        startY: y + 5,
        head: [['Cost Code / Category', 'Estimated Amount (USD)', '% of Total']],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate800, textColor: 255, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { textColor: PDF_COLORS.text, fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 50, halign: 'right' },
            2: { cellWidth: 30, halign: 'right' }
        },
        margin: { left: MARGIN, right: MARGIN }
    });

    return (doc as any).lastAutoTable.finalY + 15;
};

// ─── 5-YEAR TCO TABLE ───────────────────────────────────────
export const draw5YearTCOTable = (doc: jsPDF, y: number, cashflows: any[], capexTotal: number): number => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.slate900);
    doc.text("5-Year Total Cost of Ownership (TCO & Cashflow)", MARGIN, y);

    const formatMoney = (val: number) => `$${(val / 1_000_000).toFixed(2)}M`;

    const headers = ['Metric', 'Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];

    // Extract first 5 years
    const cfs = cashflows.slice(0, 5);

    // Pad if less than 5 years
    while (cfs.length < 5) {
        cfs.push({ revenue: 0, opex: 0, ebitda: 0, freeCashflow: 0, cumulativeCashflow: 0 });
    }

    const rowRevenue = ['Revenue', '-', formatMoney(cfs[0].revenue), formatMoney(cfs[1].revenue), formatMoney(cfs[2].revenue), formatMoney(cfs[3].revenue), formatMoney(cfs[4].revenue)];
    const rowOpex = ['OPEX (Operating Expenses)', '-', formatMoney(cfs[0].opex), formatMoney(cfs[1].opex), formatMoney(cfs[2].opex), formatMoney(cfs[3].opex), formatMoney(cfs[4].opex)];
    const rowCapex = ['CAPEX (Capital Invest)', `(${formatMoney(capexTotal)})`, '-', '-', '-', '-', '-'];

    const rowFCF: any[] = [{ content: 'Free Cash Flow (FCF)', styles: { fontStyle: 'bold' } }, { content: `(${formatMoney(capexTotal)})`, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }];
    cfs.forEach(cf => {
        rowFCF.push({ content: formatMoney(cf.freeCashflow), styles: { fontStyle: 'bold', textColor: cf.freeCashflow < 0 ? [220, 38, 38] : [22, 163, 74] } });
    });

    const rowCumCf: any[] = [{ content: 'Cumulative Cash Flow', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: `(${formatMoney(capexTotal)})`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [220, 38, 38] } }];
    cfs.forEach(cf => {
        rowCumCf.push({ content: formatMoney(cf.cumulativeCashflow), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: cf.cumulativeCashflow < 0 ? [220, 38, 38] : [22, 163, 74] } });
    });

    const bodyData: any[] = [rowRevenue, rowOpex, rowCapex, rowFCF, rowCumCf];

    autoTable(doc, {
        startY: y + 5,
        head: [headers],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.slate800, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { textColor: PDF_COLORS.text, fontSize: 7, halign: 'right' },
        columnStyles: {
            0: { cellWidth: 45, halign: 'left' }
        },
        margin: { left: MARGIN, right: MARGIN }
    });

    return (doc as any).lastAutoTable.finalY + 15;
};
