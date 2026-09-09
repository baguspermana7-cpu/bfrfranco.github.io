import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { evaluateMeasurements } from './site-render-audit-core.mjs';

export async function probeSnapshot() {
  const url = new URL('./site-render-audit-probe.mjs', import.meta.url);
  const version = createHash('sha256').update(await fs.readFile(url))
    .update(await fs.readFile(new URL('./site-render-audit-core.mjs', import.meta.url))).digest('hex').slice(0, 16);
  const module = await import(`${url.href}?revision=${version}`);
  return { version, collect: module.collectMeasurements, verifyScrollingGaps: module.verifyScrollingGaps };
}

export function environmentFailure(message) {
  if (/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED/i.test(String(message))) return 'server-unavailable';
  if (/ConnectionClosed|Connection closed|Target closed|Session closed|browser disconnected|Protocol error/i.test(String(message))) return 'browser-unavailable';
  return null;
}

export function localTransportFailure(error, base) {
  if (error.type !== 'requestfailed' || error.policy !== 'local-read') return false;
  try { return new URL(error.url).origin === new URL(base).origin && environmentFailure(error.message) === 'server-unavailable'; }
  catch { return false; }
}

export function intentionalAnalyticsConsole(entry, network) {
  return network.some(request => request.policy === 'blocked-analytics' && request.url
    && (entry.url === request.url || entry.message.includes(request.url)));
}

export async function serverHealth(base, fetcher = fetch) {
  try {
    const response = await fetcher(new URL('index.html', base), { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return response.ok ? { available: true } : { available: false, reason: `Preflight HTTP ${response.status}` };
  } catch (error) { return { available: false, reason: `Server preflight: ${error}` }; }
}

export async function recoverBrowser(browser, launch, attempts) {
  if (attempts >= 1) return { recovered: false, reason: 'Single browser recovery exhausted' };
  try { await browser.close(); } catch (error) {
    process.stderr.write(`Closing unavailable browser: ${error}\n`);
  }
  try { return { recovered: true, browser: await launch() }; }
  catch (error) { return { recovered: false, reason: String(error) }; }
}

async function preparePage(page, row, timeout) {
  await page.setBypassServiceWorker(true);
  await page.setViewport({ width: row.width, height: 900, deviceScaleFactor: 1 });
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: row.theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(theme => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('rz_cookie_consent', 'declined');
    localStorage.setItem('cookieConsent', 'declined');
  }, row.theme);
}

export function requestPolicy(url, method, base) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return 'blocked-write';
  if (/google-analytics\.com|googletagmanager\.com|doubleclick\.net/.test(url)) return 'blocked-analytics';
  try { return new URL(url).origin === new URL(base).origin ? 'local-read' : 'external-read'; }
  catch { return 'external-read'; }
}

async function protectRequests(page, options, result) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const policy = requestPolicy(request.url(), request.method(), options.base);
    if (policy.startsWith('blocked')) result.network.push({ policy, url: request.url(), method: request.method() });
    const action = policy.startsWith('blocked') ? request.abort('blockedbyclient') : request.continue();
    action.catch(error => result.network.push({ policy: 'interception-error', detail: String(error) }));
  });
}

async function settlePage(page) {
  await page.waitForFunction(() => document.readyState === 'complete' && Boolean(document.body));
  await page.evaluate(() => document.fonts.ready);
  let stagnant = 0;
  for (let step = 0; step <= 1000; step += 1) {
    if (step === 1000) throw new Error('Full-page scroll limit reached; lazy content unverified');
    const progress = await page.evaluate(async () => {
      const before = scrollY;
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 1) return { done: true };
      scrollTo({ top: before + Math.max(200, innerHeight * 0.8), behavior: 'instant' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { before, after: scrollY, done: false };
    });
    if (progress.done) break;
    stagnant = scrollProgress(progress.before, progress.after, stagnant);
  }
  await page.evaluate(async () => {
    scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all([...document.images].filter(image => image.getClientRects().length && !image.complete).map(image =>
      new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); })));
  });
}

export function scrollProgress(before, after, stagnant) {
  const next = after > before + 1 ? 0 : stagnant + 1;
  if (next >= 3) throw new Error('Scroll did not advance; internal scrolling unverified');
  return next;
}

export function auditErrorFinding(error, environment = null) {
  const uncertain = /ProtocolError|Protocol error|TimeoutError|timed?\s*out|timeout|deadline exceeded|scroll.*unverified/i.test(String(error));
  return { rule: environment ? 'environment-unavailable' : uncertain ? 'audit-incomplete' : 'navigation-or-audit-error',
    status: environment || uncertain ? 'UNVERIFIED' : 'FAIL', detail: String(error) };
}

async function contrastAudit(page, axeSource) {
  if (!axeSource) return { status: 'NOT_REQUESTED', violations: [], incomplete: [] };
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } });
    return { status: result.violations.length ? 'FAIL' : result.incomplete.length ? 'UNVERIFIED' : 'PASS',
      violations: result.violations, incomplete: result.incomplete };
  });
}

export function resultStatus(result) {
  if (result.blocked?.length) return 'UNVERIFIED';
  if (result.findings.some(finding => finding.status === 'FAIL')) return 'FAIL';
  if (result.findings.some(finding => finding.status === 'UNVERIFIED')) return 'UNVERIFIED';
  return 'PASS';
}

async function inspectPage(page, row, options, result) {
  await preparePage(page, row, options.timeout);
  const response = await page.goto(new URL(row.path.split('/').map(encodeURIComponent).join('/'), options.base).href,
    { waitUntil: 'load', timeout: options.timeout });
  result.finalUrl = page.url();
  result.httpStatus = response?.status() ?? null;
  if (!response || !response.ok()) throw new Error(`Navigation HTTP ${result.httpStatus}`);
  const expected = new URL(row.path.split('/').map(encodeURIComponent).join('/'), options.base);
  if (new URL(page.url()).pathname !== expected.pathname || new URL(page.url()).origin !== expected.origin) {
    result.findings.push({ rule: 'unexpected-redirect', status: 'UNVERIFIED', detail: page.url() });
  }
  await settlePage(page);
  const probe = await probeSnapshot();
  result.probeVersion = probe.version;
  result.measurements = await page.evaluate(probe.collect);
  const gapChecks = await page.evaluate(probe.verifyScrollingGaps, result.measurements.layout.blankGaps);
  result.measurements.layout.interactiveGapChecks = gapChecks;
  result.measurements.layout.blankGaps = gapChecks.filter(gap => !gap.verified);
  result.blocked = result.measurements.blocked;
  result.findings.push(...evaluateMeasurements(result.measurements));
  if (!result.measurements.bodyTextLength) result.findings.push({ rule: 'empty-body', status: 'UNVERIFIED' });
  if (result.measurements.actualTheme !== row.theme) result.findings.push({ rule: 'theme-not-confirmed', status: 'UNVERIFIED', detail: result.measurements.actualTheme });
  if (row.labels.includes('editorial') && !result.measurements.layout.proseBoxes.length) result.findings.push({ rule: 'editorial-prose-not-found', status: 'UNVERIFIED' });
  if (result.measurements.frames.length) result.findings.push({ rule: 'iframe-content-unverified', status: 'UNVERIFIED', detail: result.measurements.frames });
  result.contrast = await contrastAudit(page, options.axeSource);
  if (['FAIL', 'UNVERIFIED'].includes(result.contrast.status)) result.findings.push({ rule: 'axe-contrast', status: result.contrast.status, detail: result.contrast });
}

export async function auditRow(browser, row, options) {
  const result = { ...row, status: 'UNVERIFIED', reason: null, findings: [], runtimeErrors: [], network: [], blocked: [], screenshots: [],
    startedAt: new Date().toISOString() };
  let context;
  let page;
  let timer;
  try {
    context = await browser.createBrowserContext();
    page = await context.newPage();
    page.on('pageerror', error => result.runtimeErrors.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const entry = { type: 'console', message: message.text(), url: message.location().url };
      if (/Failed to load resource|CORS policy|net::ERR_|Content Security Policy/.test(entry.message)) result.network.push({ ...entry, policy: 'network-console' });
      else result.runtimeErrors.push(entry);
    });
    page.on('requestfailed', request => {
      const entry = { type: 'requestfailed', url: request.url(), message: request.failure()?.errorText, policy: requestPolicy(request.url(), request.method(), options.base) };
      if (entry.policy === 'local-read') result.runtimeErrors.push(entry);
      else result.network.push(entry);
    });
    page.on('response', response => {
      if (response.status() < 400) return;
      const entry = { type: 'http-error', url: response.url(), status: response.status(), policy: requestPolicy(response.url(), response.request().method(), options.base) };
      if (entry.policy === 'local-read') result.runtimeErrors.push(entry);
      else result.network.push(entry);
    });
    await protectRequests(page, options, result);
    await Promise.race([inspectPage(page, row, options, result), new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Page audit deadline exceeded')), Math.min(options.timeout + 5000, 20000));
    })]);
  } catch (error) {
    result.environment = environmentFailure(error);
    if (result.environment === 'server-unavailable' && (await serverHealth(options.base)).available) result.environment = null;
    result.findings.push(auditErrorFinding(error, result.environment));
  } finally {
    clearTimeout(timer);
    for (const error of result.runtimeErrors) {
      const environment = localTransportFailure(error, options.base) && !(await serverHealth(options.base)).available ? 'server-unavailable' : null;
      if (environment) result.environment ||= environment;
      result.findings.push({ rule: environment ? 'environment-network' : 'runtime-error', status: environment ? 'UNVERIFIED' : 'FAIL', detail: error });
    }
    for (const entry of result.network.filter(item => item.policy === 'network-console')) {
      if (intentionalAnalyticsConsole(entry, result.network)) continue;
      result.findings.push({ rule: /Content Security Policy|Refused to execute|violates.*directive/i.test(entry.message)
        ? 'csp-blocked-content' : 'network-console-unverified', status: 'UNVERIFIED', detail: entry });
    }
    const external = result.network.filter(entry => !['blocked-analytics', 'network-console'].includes(entry.policy));
    if (external.length) result.findings.push({ rule: 'network-or-write-blocked-unverified', status: 'UNVERIFIED', detail: external });
    result.status = resultStatus(result);
    if (result.environment) result.status = 'UNVERIFIED';
    if (page && (result.status !== 'PASS' || options.captureAll) && !result.environment) await captureDefects(page, result, options);
    if (context) {
      try { await context.close(); } catch (error) {
        result.findings.push({ rule: 'context-close-error', status: 'FAIL', detail: String(error) });
        result.status = result.environment ? 'UNVERIFIED' : resultStatus(result);
      }
    }
  }
  result.finishedAt = new Date().toISOString();
  return result;
}

async function captureDefects(page, result, options) {
  try {
    const filename = `${options.id}.png`;
    await page.screenshot({ path: `${options.out}/${filename}`, timeout: 5000 });
    result.screenshots.push(filename);
    const target = result.findings.find(finding => finding.target && !['body', 'html'].includes(finding.target))?.target;
    if (target) {
      const element = await page.$(target);
      if (element) {
        await element.scrollIntoView();
        const detail = `${options.id}-defect.png`;
        await page.screenshot({ path: `${options.out}/${detail}`, timeout: 5000 });
        result.screenshots.push(detail);
      }
    }
  } catch (error) {
    result.findings.push({ rule: 'screenshot-error', status: 'FAIL', detail: String(error) });
    result.status = resultStatus(result);
  }
}

export async function writeJson(filename, value) {
  const temporary = `${filename}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporary, filename);
}
