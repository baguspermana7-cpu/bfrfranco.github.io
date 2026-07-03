// Local gateway test harness. Start the worker first:
//   cd cf-worker && npx wrangler dev --local --port 8787
// then:  node test/gateway.test.mjs  [baseUrl]
// Asserts every endpoint returns the {ok:true,data} envelope with the client-expected
// shape. Exits non-zero on any failure.

const BASE = process.argv[2] || "http://127.0.0.1:8787";
let pass = 0, fail = 0;
const fails = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; fails.push(name + (detail ? ` — ${detail}` : "")); console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

async function get(path) {
  const r = await fetch(BASE + path);
  const j = await r.json().catch(() => null);
  return { status: r.status, j };
}

const isArr = Array.isArray;
const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

async function main() {
  console.log(`\nrz-finance-gateway endpoint tests → ${BASE}\n`);

  // envelope
  let r = await get("/healthz");
  ok("/healthz envelope", r.j && r.j.ok === true, JSON.stringify(r.j));

  r = await get("/sectors");
  ok("/sectors ok+array", r.j && r.j.ok === true && isArr(r.j.data), `status ${r.status}`);
  ok("/sectors row fields", r.j.data && r.j.data[0] && has(r.j.data[0], "sym") && has(r.j.data[0], "name") && has(r.j.data[0], "chgPct"), JSON.stringify(r.j.data && r.j.data[0]));

  r = await get("/economy");
  ok("/economy yields+currencies", r.j && r.j.ok && r.j.data && isArr(r.j.data.yields) && isArr(r.j.data.currencies), JSON.stringify(r.j && r.j.data && Object.keys(r.j.data)));
  ok("/economy yield fields", r.j.data && r.j.data.yields[0] && has(r.j.data.yields[0], "sym") && has(r.j.data.yields[0], "chgPct"), JSON.stringify(r.j.data && r.j.data.yields && r.j.data.yields[0]));

  r = await get("/futures");
  ok("/futures ok+array", r.j && r.j.ok && isArr(r.j.data) && r.j.data.length >= 8, `len ${r.j && r.j.data && r.j.data.length}`);

  r = await get("/q?syms=AAPL,MSFT,NVDA");
  ok("/q array + fields", r.j && r.j.ok && isArr(r.j.data) && r.j.data[0] && has(r.j.data[0], "prevClose"), JSON.stringify(r.j && r.j.data && r.j.data[0]));

  r = await get("/candles?sym=AAPL&tf=3M");
  ok("/candles {candles[{t,o,h,l,c,v}]}", r.j && r.j.ok && r.j.data && isArr(r.j.data.candles) && r.j.data.candles.length > 5 && has(r.j.data.candles[0], "o") && has(r.j.data.candles[0], "t"), `len ${r.j && r.j.data && r.j.data.candles && r.j.data.candles.length}`);

  r = await get("/crypto");
  ok("/crypto {global,coins}", r.j && r.j.ok && r.j.data && r.j.data.global && isArr(r.j.data.coins) && r.j.data.coins.length > 10, `coins ${r.j && r.j.data && r.j.data.coins && r.j.data.coins.length}`);

  r = await get("/fx");
  ok("/fx {rates}", r.j && r.j.ok && r.j.data && r.j.data.rates && typeof r.j.data.rates.EUR === "number", JSON.stringify(r.j && r.j.data && r.j.data.rates && Object.keys(r.j.data.rates).slice(0, 3)));

  r = await get("/fx-history?from=USD&to=EUR&days=30");
  ok("/fx-history {points[{d,v}]}", r.j && r.j.ok && r.j.data && isArr(r.j.data.points) && r.j.data.points[0] && has(r.j.data.points[0], "d") && has(r.j.data.points[0], "v"), `len ${r.j && r.j.data && r.j.data.points && r.j.data.points.length}`);

  r = await get("/news?topic=market");
  ok("/news array {title,url,ts}", r.j && r.j.ok && isArr(r.j.data) && (r.j.data.length === 0 || (has(r.j.data[0], "title") && has(r.j.data[0], "ts"))), `len ${r.j && r.j.data && r.j.data.length}`);

  r = await get("/analyze?sym=AAPL&tf=3M");
  const a = r.j && r.j.data;
  ok("/analyze indicators+gauge+signals", r.j && r.j.ok && a && a.indicators && a.gauge && a.signals && a.prediction && isArr(a.prediction.rationale), JSON.stringify(a && Object.keys(a)));
  ok("/analyze gauge score 0-100", a && a.gauge && typeof a.gauge.score === "number" && a.gauge.score >= 0 && a.gauge.score <= 100 && typeof a.gauge.label === "string", JSON.stringify(a && a.gauge));
  ok("/analyze rsi14 present", a && a.indicators && (a.indicators.rsi14 === null || typeof a.indicators.rsi14 === "number"), JSON.stringify(a && a.indicators && a.indicators.rsi14));

  r = await get("/screener?minMcap=200e9");
  ok("/screener array + fields", r.j && r.j.ok && isArr(r.j.data) && r.j.data[0] && has(r.j.data[0], "marketCap") && has(r.j.data[0], "pe") && has(r.j.data[0], "divYield"), `len ${r.j && r.j.data && r.j.data.length}`);

  // failure path
  r = await get("/quote");            // missing required param
  ok("/quote missing param → ok:false", r.j && r.j.ok === false && r.status === 400, `status ${r.status} ${JSON.stringify(r.j)}`);
  r = await get("/nope");
  ok("/nope → 404 ok:false", r.j && r.j.ok === false && r.status === 404, `status ${r.status}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
  console.log("ALL GREEN");
}
main().catch((e) => { console.error("harness error:", e); process.exit(2); });
