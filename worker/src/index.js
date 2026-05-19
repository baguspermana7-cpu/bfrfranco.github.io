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

export default {
  async fetch(request) {
    try {
      const { method } = request;
      const { pathname } = new URL(request.url);

      if (method === 'OPTIONS') return handleOptions();

      if (pathname === '/health') return handleHealth();

      return json(null, { status: 404, error: 'not found' });
    } catch (e) {
      return json(null, { status: 500, error: String(e) });
    }
  },
};
