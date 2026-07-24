/* ─── chart-utils (Workstream Q) ─────────────────────────────────────────────
 * Country-comparison charts show the top-N benchmark countries — but the
 * OWNER'S selected (Requirements) country must ALWAYS appear, even when its
 * score sits outside the top-N (bug: Oman missing from "Talent Score by
 * Country"). Appends the selected row when absent; callers already highlight
 * the selected code.
 * ──────────────────────────────────────────────────────────────────────── */

export function topNWithSelected<T extends { code: string }>(
    rows: T[],
    selectedId: string | undefined | null,
    n = 15,
): T[] {
    const top = rows.slice(0, n);
    if (selectedId && !top.some((r) => r.code === selectedId)) {
        const sel = rows.find((r) => r.code === selectedId);
        if (sel) top.push(sel);
    }
    return top;
}
