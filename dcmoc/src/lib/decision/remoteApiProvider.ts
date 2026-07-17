/* ─── LAYER 13 · REMOTE-AI DECISION PROVIDER (stub / future) ──────────────────
 * The AI-API container. Implements the SAME DecisionProvider interface as the
 * deterministic engine, so a real AI backend can be plugged in with ZERO caller
 * changes — the dashboard/consumers depend only on `DecisionProvider`.
 *
 * NOW: not configured — `decide()` throws so the factory falls back to the
 * deterministic provider. LATER: POST the identical `DecisionRequest` JSON to a
 * server-side AI endpoint (kept behind the backend so no key ships to the
 * browser) and map the response into `DecisionResult`.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { DecisionProvider, DecisionRequest, DecisionResult } from './types';
import { DECISION_DISCLAIMER } from './types';

/** Set at build/runtime once a real endpoint exists (e.g. `/decision`). */
export const REMOTE_DECISION_ENDPOINT: string | null = null;

export const remoteApiProvider: DecisionProvider = {
    id: 'remoteApi',

    async decide(req: DecisionRequest): Promise<DecisionResult> {
        if (!REMOTE_DECISION_ENDPOINT) {
            throw new Error('remoteApiProvider: no AI endpoint configured');
        }
        const res = await fetch(REMOTE_DECISION_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });
        if (!res.ok) throw new Error(`remoteApiProvider: HTTP ${res.status}`);
        const json = await res.json();
        // The backend returns a DecisionResult-shaped payload; enforce provider +
        // disclaimer so the honesty guardrail can never be dropped by the server.
        return { ...(json as DecisionResult), provider: 'remoteApi', disclaimer: DECISION_DISCLAIMER };
    },
};
