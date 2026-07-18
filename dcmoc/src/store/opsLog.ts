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

function load(): Partial<OpsLogState> | null {
    if (typeof window === 'undefined') return null;
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export const useOpsLog = create<OpsLogState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<OpsLogState>) => {
        set({ ...p, touched: true });
        try {
            const { actions: _a, ...rest } = get();
            localStorage.setItem(KEY, JSON.stringify(rest));
        } catch { /* */ }
    };
    return {
        ...SEED, completedPmWeeks: [], touched: false, ...(persisted ?? {}),
        actions: {
            addAlarm: (a) => commit({ alarms: [{ ...a, id: nid() }, ...get().alarms] }),
            setAlarmStatus: (id, status) => commit({ alarms: get().alarms.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            addIncident: (i) => commit({ incidents: [{ ...i, id: nid() }, ...get().incidents] }),
            setIncidentStatus: (id, status) => commit({ incidents: get().incidents.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            addTicket: (tk) => commit({ tickets: [{ ...tk, id: nid() }, ...get().tickets] }),
            setTicketStatus: (id, status) => commit({ tickets: get().tickets.map((x) => x.id === id ? { ...x, status, isExample: undefined } : x) }),
            togglePmWeek: (week) => {
                const cur = get().completedPmWeeks;
                commit({ completedPmWeeks: cur.includes(week) ? cur.filter((w) => w !== week) : [...cur, week] });
            },
            reset: () => { set({ ...SEED, completedPmWeeks: [], touched: false }); try { localStorage.removeItem(KEY); } catch { /* */ } },
        },
    };
});
