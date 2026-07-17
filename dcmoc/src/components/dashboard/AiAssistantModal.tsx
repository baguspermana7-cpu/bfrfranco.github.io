'use client';

import React from 'react';
import { X, Sparkles, ShieldCheck, Cpu, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAiConfigStore, DEFAULT_ENDPOINTS, DEFAULT_MODELS, type AiProvider } from '@/store/aiConfig';
import { decide, activeProviderId } from '@/lib/decision';

/* Layer-13 AI Assistant config. Optional: plug in an AI API to run the decision
 * layer through it; leave empty and the built-in deterministic RZ engine runs
 * everything. The key stays in this browser only. */
export function AiAssistantModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const cfg = useAiConfigStore();
    const [provider, setProvider] = React.useState<AiProvider>(cfg.provider);
    const [endpoint, setEndpoint] = React.useState(cfg.endpoint);
    const [model, setModel] = React.useState(cfg.model);
    const [apiKey, setApiKey] = React.useState(cfg.apiKey);
    const [test, setTest] = React.useState<{ state: 'idle' | 'running' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' });

    React.useEffect(() => {
        if (open) { setProvider(cfg.provider); setEndpoint(cfg.endpoint); setModel(cfg.model); setApiKey(cfg.apiKey); setTest({ state: 'idle' }); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;
    const usingAi = cfg.enabled;

    const onProvider = (p: AiProvider) => { setProvider(p); setEndpoint(DEFAULT_ENDPOINTS[p]); setModel(DEFAULT_MODELS[p]); };
    const onSave = () => { cfg.save({ provider, endpoint, apiKey, model }); onClose(); };
    const onClear = () => { cfg.clear(); setApiKey(''); setTest({ state: 'idle' }); };

    const onTest = async () => {
        cfg.save({ provider, endpoint, apiKey, model }); // apply first so the provider reads it
        setTest({ state: 'running' });
        try {
            const r = await decide({
                context: { inputs: { itLoadKw: 3000, tier: 3, coolingType: 'air', region: 'US' }, capex: { totalUsd: 5e7, perKw: 12000 }, carbon: { pue: 1.5 } },
                objectives: ['maxRoi'],
            });
            const used = activeProviderId();
            if (used === 'remoteApi' && r.provider === 'remoteApi') setTest({ state: 'ok', msg: `Connected — ${model} answered.` });
            else setTest({ state: 'fail', msg: 'AI endpoint unreachable (CORS/HTTP/timeout) — the built-in RZ engine will run instead.' });
        } catch {
            setTest({ state: 'fail', msg: 'Test failed — the built-in RZ engine will run instead.' });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div role="dialog" aria-modal="true" aria-label="AI Assistant configuration"
                className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1424] text-slate-100 shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></span>
                        <h2 className="text-sm font-bold">AI Assistant</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-white/10" aria-label="Close"><X className="w-4 h-4 text-slate-400" /></button>
                </div>

                <div className="p-5 space-y-4">
                    {/* status chip */}
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${usingAi ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                        {usingAi ? <Sparkles className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
                        {usingAi ? `Routing through ${cfg.provider} · ${cfg.model}` : 'Using the built-in deterministic RZ Decision Engine'}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Optional. Plug in an AI API and the Layer-13 decision layer routes through it. Leave it empty and the
                        built-in RZ engine (deterministic, always-on) runs every recommendation and optimization. If the AI
                        endpoint is unreachable, it automatically falls back to the RZ engine.
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                        {(['openai', 'anthropic', 'custom'] as AiProvider[]).map((p) => (
                            <button key={p} onClick={() => onProvider(p)}
                                className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${provider === p ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-300' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
                                {p === 'openai' ? 'OpenAI' : p === 'anthropic' ? 'Anthropic' : 'Custom'}
                            </button>
                        ))}
                    </div>

                    <label className="block">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">Endpoint</span>
                        <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://…/v1/chat/completions"
                            className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2 text-xs focus:outline-none focus:border-cyan-400/50" />
                    </label>
                    <label className="block">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">Model</span>
                        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini"
                            className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2 text-xs focus:outline-none focus:border-cyan-400/50" />
                    </label>
                    <label className="block">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">API key</span>
                        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-… (stored only in this browser)" autoComplete="off"
                            className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2 text-xs focus:outline-none focus:border-cyan-400/50" />
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><ShieldCheck className="w-3 h-3" /> Kept in localStorage on this device only — never sent anywhere except your endpoint.</span>
                    </label>

                    {test.state !== 'idle' && (
                        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] ${test.state === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : test.state === 'fail' ? 'bg-amber-500/10 text-amber-300' : 'bg-white/5 text-slate-300'}`}>
                            {test.state === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin mt-0.5" /> : test.state === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />}
                            <span>{test.state === 'running' ? 'Testing endpoint…' : test.msg}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/10">
                    <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-200">Use built-in engine</button>
                    <div className="flex items-center gap-2">
                        <button onClick={onTest} disabled={!endpoint || !apiKey} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300 hover:border-cyan-400/40 disabled:opacity-40">Test</button>
                        <button onClick={onSave} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AiAssistantModal;
