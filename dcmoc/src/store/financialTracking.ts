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

function load(): Partial<FinancialTrackingState> | null {
    if (typeof window === 'undefined') return null;
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export const useFinancialTracking = create<FinancialTrackingState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<FinancialTrackingState>) => {
        set({ ...p, touched: true });
        try { const { actions: _a, ...rest } = get(); localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* */ }
    };
    return {
        ...SEED, touched: false, ...(persisted ?? {}),
        actions: {
            addTxn: (t) => commit({ transactions: [{ ...t, id: nid() }, ...get().transactions].slice(0, 300) }),
            setTxnStatus: (id, status) => commit({ transactions: get().transactions.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            addInvoice: (i) => commit({ invoices: [{ ...i, id: nid() }, ...get().invoices].slice(0, 200) }),
            setInvoiceStatus: (id, status) => commit({ invoices: get().invoices.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            addRevision: (r) => commit({ revisions: [{ ...r, id: nid() }, ...get().revisions] }),
            toggleRevision: (id) => commit({ revisions: get().revisions.map((x) => x.id === id ? { ...x, approved: !x.approved, isExample: undefined } : x) }),
            reset: () => { set({ ...SEED, touched: false }); try { localStorage.removeItem(KEY); } catch { /* */ } },
        },
    };
});
