import { handleFx, handleFxHistory, handleQuotes, handleCandles, handleNews, handleSectors, handleEconomy, handleFutures, handleScreener, handleCrypto } from './handlers.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Finnhub-Secret',
};

function json(data, { status = 200, error = null, cached = false } = {}) {
  const body = JSON.stringify({
    ok: error == null,
    data: data ?? null,
    error: error ?? null,
    ts: Date.now(),
    cached,
  });
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function handleHealth() {
  return json({ status: 'ok', name: 'rz-finance-gateway' });
}

/* ═══════════════════════════════════════════════════════════════
   Task 1.9 — cron pre-warm + stale hardening (fixes B-003)

   prewarm(env) warms the hottest caches in parallel. Each source is
   failure-isolated via Promise.allSettled so ONE failing upstream
   never aborts the others and a cron tick NEVER throws. Each handler
   is already KV-TTL-gated AND stale-on-error, so a tick is a cheap
   no-op while caches are fresh (free upstream quota is preserved).

   Symbols mirror the client CFG.INDICES quote batch so the Overview
   tab opens against a warm `q:SPY,QQQ,DIA,IWM,GLD,TLT,USO,VGK` key.
   ═══════════════════════════════════════════════════════════════ */

const PREWARM_INDEX_SYMS = ['SPY', 'QQQ', 'DIA', 'IWM', 'GLD', 'TLT', 'USO', 'VGK'];

export async function prewarm(env) {
  return Promise.allSettled([
    handleFx(env),
    handleFxHistory(env, 'USD', 'EUR', 30),
    handleQuotes(env, PREWARM_INDEX_SYMS),
    handleNews(env, 'market'),
    handleCrypto(env),
    handleSectors(env),
    handleFutures(env),
  ]);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const { method } = request;
      const { pathname } = new URL(request.url);

      if (method === 'OPTIONS') return handleOptions();

      if (pathname === '/health') return handleHealth();

      if (pathname === '/fx') {
        try {
          const { data, cached } = await handleFx(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'fx: ' + String(e) });
        }
      }

      if (pathname === '/fx-history') {
        const p = new URL(request.url).searchParams;
        try {
          const { data, cached } = await handleFxHistory(env, p.get('from') || 'USD', p.get('to') || 'EUR', +p.get('days') || 30);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'fx-history: ' + String(e) });
        }
      }

      if (pathname === '/q') {
        const syms = (new URL(request.url)).searchParams.get('syms');
        try {
          const { data, cached } = await handleQuotes(env, (syms || '').split(',').filter(Boolean));
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'q: ' + String(e) });
        }
      }

      if (pathname === '/candles') {
        const p = (new URL(request.url)).searchParams;
        try {
          const { data, cached } = await handleCandles(env, p.get('sym'), p.get('tf') || '3M');
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'candles: ' + String(e) });
        }
      }

      if (pathname === '/news') {
        const t = (new URL(request.url)).searchParams.get('topic');
        try {
          const { data, cached } = await handleNews(env, t || 'market');
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'news: ' + String(e) });
        }
      }

      if (pathname === '/sectors') {
        try {
          const { data, cached } = await handleSectors(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'sectors: ' + String(e) });
        }
      }

      if (pathname === '/economy') {
        try {
          const { data, cached } = await handleEconomy(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'economy: ' + String(e) });
        }
      }

      if (pathname === '/futures') {
        try {
          const { data, cached } = await handleFutures(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'futures: ' + String(e) });
        }
      }

      if (pathname === '/crypto') {
        try {
          const { data, cached } = await handleCrypto(env);
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'crypto: ' + String(e) });
        }
      }

      if (pathname === '/screener') {
        const p = (new URL(request.url)).searchParams;
        try {
          const { data, cached } = await handleScreener(env, {
            preset: p.get('preset'),
            minMcap: +p.get('minMcap') || 0,
            maxPe: +p.get('maxPe') || 0,
            sector: p.get('sector') || '',
            minDiv: +p.get('minDiv') || 0,
            dayChange: p.get('dayChange') || '',
          });
          return json(data, { cached: !!cached });
        } catch (e) {
          return json(null, { status: 502, error: 'screener: ' + String(e) });
        }
      }

      return json(null, { status: 404, error: 'not found' });
    } catch (e) {
      return json(null, { status: 500, error: String(e) });
    }
  },

  // Task 1.9 — cron handler (wrangler.toml [triggers] crons = */2 * * * *).
  // Fans the warm-up out via prewarm() inside ctx.waitUntil so the tick
  // never blocks/throws (Promise.allSettled isolates per-source failures).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(prewarm(env));
  },
};
