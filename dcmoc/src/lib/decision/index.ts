/* ─── LAYER 13 · DECISION ENGINE FACTORY ──────────────────────────────────────
 * Selects the provider. Prefers the remote AI provider when configured, else the
 * deterministic rule engine. Consumers call `decide(req)` and never care which
 * provider ran — swapping in a real AI later is a one-line factory change.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { DecisionProvider, DecisionRequest, DecisionResult } from './types';
import { deterministicProvider } from './deterministicProvider';
import { remoteApiProvider, remoteConfigured } from './remoteApiProvider';

export * from './types';
export { deterministicProvider } from './deterministicProvider';
export { remoteConfigured } from './remoteApiProvider';

/** Active provider: the user's AI endpoint when configured + enabled, else the
 *  built-in deterministic RZ engine (which is always the fallback). */
export function getDecisionProvider(): DecisionProvider {
    return remoteConfigured() ? remoteApiProvider : deterministicProvider;
}

/** Which brain will actually run — for UI status chips. */
export function activeProviderId(): 'deterministic' | 'remoteApi' {
    return remoteConfigured() ? 'remoteApi' : 'deterministic';
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
