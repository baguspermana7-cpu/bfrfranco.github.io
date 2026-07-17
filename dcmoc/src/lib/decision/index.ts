/* ─── LAYER 13 · DECISION ENGINE FACTORY ──────────────────────────────────────
 * Selects the provider. Prefers the remote AI provider when configured, else the
 * deterministic rule engine. Consumers call `decide(req)` and never care which
 * provider ran — swapping in a real AI later is a one-line factory change.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { DecisionProvider, DecisionRequest, DecisionResult } from './types';
import { deterministicProvider } from './deterministicProvider';
import { remoteApiProvider, REMOTE_DECISION_ENDPOINT } from './remoteApiProvider';

export * from './types';
export { deterministicProvider } from './deterministicProvider';

/** Active provider: remote AI if an endpoint is configured, else deterministic. */
export function getDecisionProvider(): DecisionProvider {
    return REMOTE_DECISION_ENDPOINT ? remoteApiProvider : deterministicProvider;
}

/** Convenience: decide with automatic provider selection + safe fallback. */
export async function decide(req: DecisionRequest): Promise<DecisionResult> {
    const provider = getDecisionProvider();
    try {
        return await provider.decide(req);
    } catch {
        // Remote failed / unconfigured → deterministic guarantee.
        return deterministicProvider.decide(req);
    }
}
