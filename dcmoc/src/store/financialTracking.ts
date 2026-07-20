/* ─── FINANCIAL TRACKING STORE (Phase H) ─────────────────────────────────────
 * ACTUALS plane: transactions / invoices / budget revisions — user-entered
 * (planning tool). isExample seeds scale as FRACTIONS of the live capex total
 * so they stay plausible at any project size. Plan Mode when untouched.
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

export type TxnType = 'invoice' | 'payment' | 'po';
export type TxnStatus = 'paid' | 'approved' | 'committed' | 'pending';

export interface FinancialTxn { id: string; date: string; type: TxnType; vendor: string; description: string; amountFrac: number; status: TxnStatus; isExample?: boolean }
export interface InvoiceEntry { id: string; direction: 'AP' | 'AR'; vendor: string; invoiceNo: string; dueLabel: string; amountFrac: number; status: 'outstanding' | 'overdue' | 'paid'; isExample?: boolean }
export interface BudgetRevision { id: string; description: string; amountFrac: number; approved: boolean; isExample?: boolean }

export interface FinancialTrackingState {
    transactions: FinancialTxn[];
    invoices: InvoiceEntry[];
    revisions: BudgetRevision[];
    touched: boolean;
    /** NON-persisted session flag: true once a localStorage write failed
     *  (quota / private mode). UI may render a "not saved" chip off this. */
    persistFailed: boolean;
    actions: {
        addTxn: (t: Omit<FinancialTxn, 'id'>) => void;
        setTxnStatus: (id: string, status: TxnStatus) => void;
        addInvoice: (i: Omit<InvoiceEntry, 'id'>) => void;
        setInvoiceStatus: (id: string, status: InvoiceEntry['status']) => void;
        addRevision: (r: Omit<BudgetRevision, 'id'>) => void;
        toggleRevision: (id: string) => void;
        reset: () => void;
    };
}

const KEY = 'dcmoc_financial_tracking_v1';
/* FIFO caps — entries are prepended (newest first), so slice(0, cap) trims the
 * OLDEST entries once the cap is hit. Keeps payload well under localStorage quota. */
const TXN_CAP = 500;
const INV_CAP = 200;
const REV_CAP = 200;
let idc = 1;
const nid = () => `fx_${Date.now()}_${idc++}`;

/* amountFrac = fraction of the LIVE capex total (0.004 = 0.4%) — keeps the
 * example ledger plausible at any project size. */
const SEED: Pick<FinancialTrackingState, 'transactions' | 'invoices' | 'revisions'> = {
    transactions: [
        { id: 'tx1', date: 'W-2', type: 'invoice', vendor: 'MV switchgear vendor (example)', description: 'Switchgear progress payment #2', amountFrac: 0.004, status: 'paid', isExample: true },
        { id: 'tx2', date: 'W-1', type: 'payment', vendor: 'Cooling OEM (example)', description: 'Chiller / CDU delivery', amountFrac: 0.003, status: 'paid', isExample: true },
        { id: 'tx3', date: 'W-1', type: 'invoice', vendor: 'Main contractor (example)', description: 'Construction progress claim', amountFrac: 0.005, status: 'approved', isExample: true },
        { id: 'tx4', date: 'W0', type: 'po', vendor: 'UPS vendor (example)', description: 'UPS modules — phase 2', amountFrac: 0.004, status: 'committed', isExample: true },
    ],
    invoices: [
        { id: 'iv1', direction: 'AP', vendor: 'Switchgear vendor (example)', invoiceNo: 'INV-001', dueLabel: 'due 3d', amountFrac: 0.002, status: 'outstanding', isExample: true },
        { id: 'iv2', direction: 'AP', vendor: 'Contractor (example)', invoiceNo: 'INV-002', dueLabel: 'due 12d', amountFrac: 0.0015, status: 'outstanding', isExample: true },
        { id: 'iv3', direction: 'AR', vendor: 'Anchor tenant (example)', invoiceNo: 'AR-001', dueLabel: 'due 20d', amountFrac: 0.001, status: 'outstanding', isExample: true },
    ],
    revisions: [
        { id: 'rv1', description: 'Substation scope change (example)', amountFrac: 0.01, approved: true, isExample: true },
    ],
};

/* Versioned payload (scenario.ts pattern): v1 = { version: 1, ...state }.
 * Legacy v0 blobs were the bare state object (same field shape) — migrated
 * transparently. persistFailed is session-local and never restored. */
function load(): Partial<Omit<FinancialTrackingState, 'actions' | 'persistFailed'>> | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const { version, persistFailed: _pf, ...state } = parsed;
        if (version != null && version !== 1) return null; // unknown future schema → fall back to seed
        return state;
    } catch { return null; }
}

export const useFinancialTracking = create<FinancialTrackingState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<FinancialTrackingState>) => {
        set({ ...p, touched: true });
        try {
            const { actions: _a, persistFailed: _pf, ...rest } = get();
            localStorage.setItem(KEY, JSON.stringify({ version: 1, ...rest }));
            if (get().persistFailed) set({ persistFailed: false }); // storage recovered
        } catch (e) {
            /* Quota / private-mode failure: non-fatal but NEVER silent — flag once
             * so the UI can surface it; state keeps working in-memory. */
            if (!get().persistFailed) {
                set({ persistFailed: true });
                if (process.env.NODE_ENV !== 'production') console.warn('[financialTracking] localStorage persist failed — changes are in-memory only', e);
            }
        }
    };
    /* SEED hygiene: example ledger applies ONLY when no persisted payload exists
     * (first run) — any persisted key wins over SEED below, so seeds never
     * overwrite user data on rehydrate. */
    return {
        ...SEED, touched: false, ...(persisted ?? {}), persistFailed: false,
        actions: {
            addTxn: (t) => commit({ transactions: [{ ...t, id: nid() }, ...get().transactions].slice(0, TXN_CAP) }),
            setTxnStatus: (id, status) => commit({ transactions: get().transactions.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            addInvoice: (i) => commit({ invoices: [{ ...i, id: nid() }, ...get().invoices].slice(0, INV_CAP) }),
            setInvoiceStatus: (id, status) => commit({ invoices: get().invoices.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            addRevision: (r) => commit({ revisions: [{ ...r, id: nid() }, ...get().revisions].slice(0, REV_CAP) }),
            toggleRevision: (id) => commit({ revisions: get().revisions.map((x) => x.id === id ? { ...x, approved: !x.approved, isExample: undefined } : x) }),
            reset: () => { set({ ...SEED, touched: false }); try { localStorage.removeItem(KEY); } catch { /* */ } },
        },
    };
});
