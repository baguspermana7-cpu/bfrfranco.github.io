/**
 * Market-news aggregation source (free, key-optional).
 *
 * Source fallback order (most-reliable-no-key first):
 *   1. GDELT doc/doc ArtList — no key, JSON, reliable from datacenter IPs.
 *   2. Yahoo Finance RSS     — no key, XML (regex-parsed, no DOMParser in Workers).
 *   3. Finnhub general news  — ONLY if env.FINNHUB_KEY; skipped silently otherwise.
 *
 * First non-empty source wins. If all are empty/fail → throws.
 *
 * Returns: array of { title, url, src, ts, summary }
 *   ts  = epoch milliseconds
 *   src = publisher / domain
 *   Newest-first, ~20 items, deduped by url.
 */

import { fetchJSON, fetchText } from './_util.js';

const TIMEOUT_MS = 7000;
const MAX_ITEMS = 20;

/**
 * fetchNews(topic, env)
 *   topic — free-text query (defaults handled by caller; falls back to
 *           "stock market" for GDELT if empty).
 *   env   — Worker env (only env.FINNHUB_KEY is read, optionally).
 */
export async function fetchNews(topic, env) {
  const errors = [];

  // Source 1: GDELT (no key)
  try {
    const items = await fetchGdelt(topic);
    if (items.length > 0) return finalize(items);
  } catch (e) {
    errors.push('gdelt: ' + (e.message || String(e)));
  }

  // Source 2: Yahoo Finance RSS (no key)
  try {
    const items = await fetchYahooRss();
    if (items.length > 0) return finalize(items);
  } catch (e) {
    errors.push('yahoo-rss: ' + (e.message || String(e)));
  }

  // Source 3: Finnhub (only if key present)
  if (env && env.FINNHUB_KEY) {
    try {
      const items = await fetchFinnhubNews(env.FINNHUB_KEY);
      if (items.length > 0) return finalize(items);
    } catch (e) {
      errors.push('finnhub: ' + (e.message || String(e)));
    }
  }

  throw new Error('all news sources failed or empty: ' + errors.join(' | '));
}

/**
 * finalize(items) — dedup by url, drop invalid, sort newest-first, cap MAX_ITEMS.
 */
function finalize(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || !it.url || !it.title) continue;
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    out.push({
      title: it.title,
      url: it.url,
      src: it.src || '',
      ts: Number.isFinite(it.ts) ? it.ts : Date.now(),
      summary: it.summary || it.title,
    });
  }
  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, MAX_ITEMS);
}

/* ───────────────────────── GDELT ───────────────────────── */

/**
 * GDELT doc/doc ArtList. seendate format: YYYYMMDDTHHMMSSZ.
 */
async function fetchGdelt(topic) {
  const query = String(topic || '').trim() || 'stock market';
  const url =
    'https://api.gdeltproject.org/api/v2/doc/doc?query=' +
    encodeURIComponent(query) +
    '&mode=ArtList&format=json&maxrecords=25&sort=DateDesc';

  const j = await fetchJSON(url, TIMEOUT_MS);
  const arts = j && Array.isArray(j.articles) ? j.articles : [];

  return arts
    .filter(a => a && a.title && a.url)
    .map(a => ({
      title: String(a.title).trim(),
      url: String(a.url).trim(),
      src: a.domain ? String(a.domain) : domainOf(a.url),
      ts: parseGdeltDate(a.seendate),
      summary: String(a.title).trim(),
    }));
}

/**
 * parseGdeltDate('20260519T090000Z') → epoch ms. Falls back to Date.parse,
 * then to Date.now() if unparseable.
 */
function parseGdeltDate(s) {
  if (typeof s === 'string') {
    const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (m) {
      const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      if (Number.isFinite(ms)) return ms;
    }
    const p = Date.parse(s);
    if (Number.isFinite(p)) return p;
  }
  return Date.now();
}

/* ──────────────────────── Yahoo RSS ──────────────────────── */

/**
 * Yahoo Finance RSS 2.0. Workers has no DOMParser — extract <item> blocks
 * with a robust regex, strip CDATA, decode the 5 common XML entities.
 */
async function fetchYahooRss() {
  const url = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US';
  let xml;
  try {
    xml = await fetchText(url, TIMEOUT_MS);
  } catch (e) {
    // Secondary Yahoo RSS endpoint.
    xml = await fetchText('https://finance.yahoo.com/news/rssindex', TIMEOUT_MS);
  }
  return parseRss(xml);
}

/**
 * parseRss(xml) — pull <item>…</item> blocks; from each extract title, link,
 * pubDate, description. CDATA-stripped and entity-decoded.
 */
export function parseRss(xml) {
  if (typeof xml !== 'string' || !xml) return [];
  const items = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  const blocks = xml.match(itemRe) || [];
  for (const block of blocks) {
    const title = tag(block, 'title');
    const link = tag(block, 'link');
    if (!title || !link) continue;
    const pub = tag(block, 'pubDate');
    const desc = tag(block, 'description');
    const tsParsed = pub ? Date.parse(pub) : NaN;
    items.push({
      title,
      url: link,
      src: domainOf(link),
      ts: Number.isFinite(tsParsed) ? tsParsed : Date.now(),
      summary: desc || title,
    });
  }
  return items;
}

/**
 * tag(block, name) — return decoded inner text of first <name>…</name>,
 * stripping CDATA wrappers. Returns '' when absent.
 */
function tag(block, name) {
  const re = new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i');
  const m = block.match(re);
  if (!m) return '';
  let v = m[1];
  v = v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decodeEntities(v.trim());
}

/**
 * decodeEntities — the 5 standard XML entities + numeric &#39;.
 * &amp; decoded LAST so e.g. "&amp;lt;" → "&lt;" (not "<").
 */
function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/* ──────────────────────── Finnhub ──────────────────────── */

/**
 * Finnhub general news. Response: [{ headline, url, source, datetime, summary }]
 * datetime is epoch SECONDS.
 */
async function fetchFinnhubNews(key) {
  const url =
    'https://finnhub.io/api/v1/news?category=general&token=' +
    encodeURIComponent(key);
  const j = await fetchJSON(url, TIMEOUT_MS);
  const arr = Array.isArray(j) ? j : [];
  return arr
    .filter(a => a && a.headline && a.url)
    .map(a => ({
      title: String(a.headline).trim(),
      url: String(a.url).trim(),
      src: a.source ? String(a.source) : domainOf(a.url),
      ts: typeof a.datetime === 'number' ? a.datetime * 1000 : Date.now(),
      summary: a.summary ? String(a.summary).trim() : String(a.headline).trim(),
    }));
}

/* ──────────────────────── shared ──────────────────────── */

/**
 * domainOf(url) — hostname (sans leading www.), '' if unparseable.
 */
function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
