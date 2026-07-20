/* ─── OPS LOG STORE (Phase G) ────────────────────────────────────────────────
 * User-editable operations log (alarms / incidents / tickets) — the planning
 * tool has no telemetry, so counts derive from THIS log. Seeds are isExample-
 * chipped; untouched log ⇒ Plan Mode banner. localStorage manual pattern.
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

export type OpsPriority = 'P1' | 'P2' | 'P3' | 'P4';
export interface OpsAlarm { id: string; time: string; priority: OpsPriority; tag: string; message: string; building: string; status: 'Active' | 'Acked' | 'Cleared'; isExample?: boolean }
export interface OpsIncident { id: string; time: string; priority: OpsPriority; title: string; status: 'Open' | 'In Progress' | 'On Hold' | 'Resolved'; isExample?: boolean }
export interface OpsTicket { id: string; time: string; priority: 'High' | 'Medium' | 'Low'; title: string; status: 'Open' | 'In Progress' | 'Closed'; isExample?: boolean }

export interface OpsLogState {
    alarms: OpsAlarm[];
    incidents: OpsIncident[];
    tickets: OpsTicket[];
    completedPmWeeks: number[];
    touched: boolean;
    /** NON-persisted session flag: true once a localStorage write failed
     *  (quota / private mode). UI may render a "not saved" chip off this. */
    persistFailed: boolean;
    actions: {
        addAlarm: (a: Omit<OpsAlarm, 'id'>) => void;
        setAlarmStatus: (id: string, status: OpsAlarm['status']) => void;
        addIncident: (i: Omit<OpsIncident, 'id'>) => void;
        setIncidentStatus: (id: string, status: OpsIncident['status']) => void;
        addTicket: (tk: Omit<OpsTicket, 'id'>) => void;
        setTicketStatus: (id: string, status: OpsTicket['status']) => void;
        togglePmWeek: (week: number) => void;
        reset: () => void;
    };
}

const KEY = 'dcmoc_ops_log_v1';
/* FIFO cap per log list — entries are prepended (newest first), so slice(0, CAP)
 * trims the OLDEST entries once the cap is hit. Keeps the payload well under
 * localStorage quota. */
const CAP = 500;
let idc = 1;
const nid = () => `op_${Date.now()}_${idc++}`;

const SEED: Pick<OpsLogState, 'alarms' | 'incidents' | 'tickets'> = {
    alarms: [
        { id: 'a1', time: '10:15', priority: 'P1', tag: 'UPS-03', message: 'Output breaker OFF', building: 'B01', status: 'Active', isExample: true },
        { id: 'a2', time: '09:48', priority: 'P2', tag: 'CH-06', message: 'High discharge pressure', building: 'B02', status: 'Active', isExample: true },
        { id: 'a3', time: '09:12', priority: 'P3', tag: 'CRAC-04', message: 'High return temperature', building: 'B01', status: 'Acked', isExample: true },
    ],
    incidents: [
        { id: 'n1', time: '08:30', priority: 'P2', title: 'Cooling loop pressure transient — Zone B', status: 'In Progress', isExample: true },
        { id: 'n2', time: 'Yesterday', priority: 'P3', title: 'BMS graphics mismatch on chiller plant page', status: 'Open', isExample: true },
    ],
    tickets: [
        { id: 't1', time: '07:20', priority: 'High', title: 'Access request — vendor Cx team', status: 'Open', isExample: true },
        { id: 't2', time: 'Yesterday', priority: 'Medium', title: 'Replace CRAC-12 filter set', status: 'In Progress', isExample: true },
    ],
};

/* Versioned payload (scenario.ts pattern): v1 = { version: 1, ...state }.
 * Legacy v0 blobs were the bare state object (same field shape) — migrated
 * transparently. persistFailed is session-local and never restored. */
function load(): Partial<Omit<OpsLogState, 'actions' | 'persistFailed'>> | null {
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

export const useOpsLog = create<OpsLogState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<OpsLogState>) => {
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
                if (process.env.NODE_ENV !== 'production') console.warn('[opsLog] localStorage persist failed — changes are in-memory only', e);
            }
        }
    };
    /* SEED hygiene: examples apply ONLY when no persisted payload exists (first
     * run) — any persisted key wins over SEED below, so seeds never overwrite
     * user data on rehydrate. */
    return {
        ...SEED, completedPmWeeks: [], touched: false, ...(persisted ?? {}), persistFailed: false,
        actions: {
            addAlarm: (a) => commit({ alarms: [{ ...a, id: nid() }, ...get().alarms].slice(0, CAP) }),
            setAlarmStatus: (id, status) => commit({ alarms: get().alarms.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            addIncident: (i) => commit({ incidents: [{ ...i, id: nid() }, ...get().incidents].slice(0, CAP) }),
            setIncidentStatus: (id, status) => commit({ incidents: get().incidents.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            addTicket: (tk) => commit({ tickets: [{ ...tk, id: nid() }, ...get().tickets].slice(0, CAP) }),
            setTicketStatus: (id, status) => commit({ tickets: get().tickets.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            togglePmWeek: (week) => {
                const cur = get().completedPmWeeks;
                commit({ completedPmWeeks: cur.includes(week) ? cur.filter((w) => w !== week) : [...cur, week] });
            },
            reset: () => { set({ ...SEED, completedPmWeeks: [], touched: false }); try { localStorage.removeItem(KEY); } catch { /* */ } },
        },
    };
});
