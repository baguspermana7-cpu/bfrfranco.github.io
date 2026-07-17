import { create } from 'zustand';

/* ─── Layer-13 AI overlay config ──────────────────────────────────────────────
 * Optional. When the user plugs in an AI API (OpenAI-compatible) the decision
 * layer routes through it; otherwise the built-in deterministic RZ engine runs
 * everything. The key lives ONLY in the user's browser (localStorage) — it is
 * never sent anywhere except the endpoint the user configured, never committed,
 * never logged. This is a user-entered, user-owned credential.
 * ──────────────────────────────────────────────────────────────────────────── */

export type AiProvider = 'openai' | 'anthropic' | 'custom';

export interface AiConfig {
    enabled: boolean;
    provider: AiProvider;
    endpoint: string;   // chat-completions URL
    apiKey: string;
    model: string;
}

export interface AiConfigStore extends AiConfig {
    setConfig: (patch: Partial<AiConfig>) => void;
    save: (cfg: Omit<AiConfig, 'enabled'>) => void;
    clear: () => void;
}

const KEY = 'dcmoc-ai-config';
const DEFAULT_ENDPOINTS: Record<AiProvider, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
    custom: '',
};
const DEFAULT_MODELS: Record<AiProvider, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-latest',
    custom: '',
};

const EMPTY: AiConfig = { enabled: false, provider: 'openai', endpoint: DEFAULT_ENDPOINTS.openai, apiKey: '', model: DEFAULT_MODELS.openai };

function load(): AiConfig {
    try {
        if (typeof window === 'undefined') return EMPTY;
        const raw = localStorage.getItem(KEY);
        if (!raw) return EMPTY;
        const p = JSON.parse(raw) as Partial<AiConfig>;
        return { ...EMPTY, ...p, enabled: !!(p.enabled && p.endpoint && p.apiKey) };
    } catch { return EMPTY; }
}
function persist(c: AiConfig) {
    try { if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* quota */ }
}

/** Read the current config synchronously (for the non-React decision provider). */
export function readAiConfig(): AiConfig { return load(); }
export { DEFAULT_ENDPOINTS, DEFAULT_MODELS };

export const useAiConfigStore = create<AiConfigStore>((set, get) => ({
    ...load(),
    setConfig: (patch) => { const next = { ...pick(get()), ...patch }; persist(next); set(next); },
    save: (cfg) => {
        const enabled = !!(cfg.endpoint && cfg.apiKey);
        const next: AiConfig = { ...cfg, enabled };
        persist(next); set(next);
    },
    clear: () => { const next = { ...EMPTY }; persist(next); set(next); },
}));

function pick(s: AiConfigStore): AiConfig {
    return { enabled: s.enabled, provider: s.provider, endpoint: s.endpoint, apiKey: s.apiKey, model: s.model };
}
