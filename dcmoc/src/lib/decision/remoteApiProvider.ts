/* ─── LAYER 13 · REMOTE-AI DECISION PROVIDER (runtime-configurable) ───────────
 * The AI-API container. Same DecisionProvider interface as the deterministic
 * engine. When the user has plugged in an AI API (store/aiConfig), decide()
 * POSTs the DecisionRequest to their OpenAI-compatible endpoint and maps the
 * reply into a DecisionResult. On ANY failure (unconfigured, CORS, HTTP, parse,
 * timeout) it throws so the factory falls back to the deterministic engine —
 * the deterministic result is always the guarantee.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { DecisionProvider, DecisionRequest, DecisionResult } from './types';
import { DECISION_DISCLAIMER } from './types';
import { readAiConfig } from '@/store/aiConfig';

/** True when the user has configured + enabled an AI endpoint. */
export function remoteConfigured(): boolean {
    const c = readAiConfig();
    return !!(c.enabled && c.endpoint && c.apiKey);
}

const SYSTEM_PROMPT =
    'You are the DC-OS Layer-13 data-center decision engine. Given a JSON snapshot of ' +
    'engine outputs (CAPEX, OPEX, financial, reliability, carbon, site, capacity) plus ' +
    'constraints and objectives, return ONLY valid JSON of the form ' +
    '{"summary":string,"recommendations":[{"title":string,"detail":string,"confidence":number,"tags":string[]}],' +
    '"rationale":[{"engine":string,"observation":string,"rule":string,"conclusion":string,"severity":"info"|"warn"|"critical"}],' +
    '"metrics":{"feasible":boolean,"confidence":number}}. ' +
    'Recommendations must be concrete DC engineering/feasibility guidance grounded in the numbers. No prose outside the JSON.';

async function callOpenAiCompatible(req: DecisionRequest, signal: AbortSignal): Promise<unknown> {
    const c = readAiConfig();
    const isAnthropic = c.provider === 'anthropic';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: string;
    if (isAnthropic) {
        headers['x-api-key'] = c.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
        body = JSON.stringify({
            model: c.model, max_tokens: 1200,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: JSON.stringify(req) }],
        });
    } else {
        headers['Authorization'] = `Bearer ${c.apiKey}`;
        body = JSON.stringify({
            model: c.model, temperature: 0.2, response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(req) }],
        });
    }
    const res = await fetch(c.endpoint, { method: 'POST', headers, body, signal });
    if (!res.ok) throw new Error(`remoteApiProvider: HTTP ${res.status}`);
    const json = await res.json();
    const text = isAnthropic
        ? (json?.content?.[0]?.text ?? '')
        : (json?.choices?.[0]?.message?.content ?? '');
    if (!text) throw new Error('remoteApiProvider: empty completion');
    return JSON.parse(text);
}

export const remoteApiProvider: DecisionProvider = {
    id: 'remoteApi',
    async decide(req: DecisionRequest): Promise<DecisionResult> {
        if (!remoteConfigured()) throw new Error('remoteApiProvider: no AI endpoint configured');
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20000);
        try {
            const parsed = (await callOpenAiCompatible(req, ctrl.signal)) as Partial<DecisionResult>;
            if (!parsed || !Array.isArray(parsed.recommendations)) throw new Error('remoteApiProvider: malformed');
            const ctx = req.context;
            return {
                summary: parsed.summary || 'AI decision',
                recommendations: parsed.recommendations,
                rationale: parsed.rationale || [],
                metrics: { feasible: parsed.metrics?.feasible ?? true, confidence: parsed.metrics?.confidence ?? 0.6 },
                provider: 'remoteApi',
                generatedFor: { itLoadKw: ctx.inputs.itLoadKw, tier: ctx.inputs.tier, region: ctx.inputs.region },
                disclaimer: DECISION_DISCLAIMER,
            };
        } finally { clearTimeout(t); }
    },
};
