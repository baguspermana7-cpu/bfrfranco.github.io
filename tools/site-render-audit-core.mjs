export const DEFAULT_THEMES = ['light', 'dark'];
export const DEFAULT_WIDTHS = [390, 768, 1440];
export const MEASUREMENT_EPSILON = 1e-6;

export function pagePriority(page) {
  if (/^(?:article-\d+|ff-\d+|geopolitics-\d+)/i.test(page.path)) return 0;
  if (!page.path.includes('/') && page.category !== 'internal') return 1;
  if (/^id\//i.test(page.path)) return 2;
  if (/^(manual|prd)\//i.test(page.path)) return 3;
  if (page.labels.includes('subapps')) return 5;
  return page.category === 'internal' ? 6 : 4;
}

export function classifyPage(path, source, readError = null) {
  const labels = [];
  const nested = path.includes('/');
  const internal = /^(\.[^/]+|tools|Article|assets|standarization|review|backups|Automation)\//i.test(path)
    || /(?:mockup|beforeafter|style-lab|skin-gallery|setup-supabase|rz-ops-|redesign|polish)/i.test(path);
  const subapp = /^(Apps|dcmoc|dca-app|finance-terminal|games|Dunia-Emosi)\//i.test(path);
  const functionalInternal = /^(?:rz-ops-[^/]+|setup-supabase)\.html$/i.test(path);
  const buildEntry = /<script\b[^>]*\bsrc\s*=\s*["'](?:\/?src\/|[^"']*\.(?:jsx|tsx)(?:[?"']))/i.test(source);
  const editorial = /(?:^|\/)(?:article-\d+|ff-\d+|geopolitics-\d+)[^/]*\.html$/i.test(path)
    || /^(?:manual|prd)\//i.test(path)
    || /data-rz-register\s*=\s*["']editorial["']/i.test(source);
  const noindex = (source.match(/<meta\b[^>]*>/gi) || []).some(tag =>
    /name\s*=\s*["'](?:robots|googlebot)["']/i.test(tag) && /content\s*=\s*["'][^"']*\bnoindex\b/i.test(tag));
  if (!internal) labels.push('public');
  if (editorial) labels.push('editorial');
  if (nested) labels.push('nested');
  if (subapp) labels.push('subapps');
  if (noindex) labels.push('noindex');
  if (internal) labels.push('internal');
  if (buildEntry) labels.push('build-entry');
  return { path, labels, category: internal ? 'internal' : subapp ? 'subapps' : noindex ? 'noindex'
    : editorial ? 'editorial' : nested ? 'nested' : 'public', buildEntry, functionalInternal, readError };
}

function baselinePaths(inventory) {
  const patterns = [/^index\.html$/, /^article-\d/i, /^ff-\d/i, /^geopolitics-\d/i,
    /^id\//, /^manual\//, /^prd\//];
  const selected = patterns.map(pattern => inventory.find(row => pattern.test(row.path))?.path);
  for (const label of ['public', 'editorial', 'nested', 'subapps', 'noindex', 'internal']) {
    selected.push(inventory.find(row => row.labels.includes(label))?.path);
  }
  return new Set(selected.filter(Boolean));
}

export function planCoverage(inventory, options = {}) {
  const { themes = DEFAULT_THEMES, widths = DEFAULT_WIDTHS, include, baseline = false, limit, publicOnly = false, functionalNoindex = false } = options;
  const pattern = include ? new RegExp(include, 'i') : null;
  const representatives = baseline ? baselinePaths(inventory) : null;
  let selectedCount = 0;
  return inventory.flatMap(page => {
    const reason = page.buildEntry ? 'Explicitly not visually reviewed: source build-entry, not deployed HTML'
      : functionalNoindex && ((page.labels.includes('internal') && !page.functionalInternal) || !page.labels.includes('noindex')) ? 'Outside functional noindex follow-up scope'
      : publicOnly && page.labels.some(label => ['internal', 'noindex'].includes(label)) ? 'Explicitly not visually reviewed: internal/noindex'
      : pattern && !pattern.test(page.path) ? 'CLI include filter'
      : representatives && !representatives.has(page.path) ? 'Representative baseline only'
      : limit && selectedCount >= limit ? 'CLI page limit' : null;
    if (!reason) selectedCount += 1;
    return themes.flatMap(theme => widths.map(width => ({ path: page.path, theme, width,
      status: reason ? 'FILTERED' : 'PENDING', reason: reason || 'Not executed', labels: page.labels })));
  });
}

export function evaluateMeasurements(measurements) {
  const findings = [];
  const add = (rule, element, detail, status = 'FAIL') => findings.push({ rule, target: element.target, detail, status });
  for (const element of measurements.elements) {
    if (element.prose && !element.protected) {
      if (element.fontSize < 16 - MEASUREMENT_EPSILON) add('prose-font-size', element, element.fontSize);
      if (element.lineRatio === null) add('prose-line-height-unmeasured', element, 'Computed line-height is normal', 'UNVERIFIED');
      else if (element.lineRatio < 1.5 - MEASUREMENT_EPSILON) add('prose-line-height', element, element.lineRatio);
    }
    if (element.overflow?.length) add('text-overflow', element, element.overflow);
    if (!element.protected) for (const rule of element.decoration || []) add(rule, element, element.text);
  }
  for (const image of measurements.images) {
    if (image.deferred) continue;   /* lazy, below the fold, not fetched yet — see the probe */
    if (!image.complete || image.naturalWidth === 0) add('missing-image', image, image.src);
  }
  const uncontained = measurements.layout?.uncontainedOverflowBoxes;
  if (measurements.documentOverflow && (!uncontained || uncontained.length)) add('document-overflow', { target: 'html' }, measurements.documentOverflow);
  for (const gap of measurements.layout?.blankGaps || []) add('large-blank-gap', { target: 'body' }, gap);
  for (const overlap of measurements.layout?.headerOverlaps || []) add('fixed-header-hero-overlap', overlap, overlap);
  for (const box of measurements.layout?.proseBoxes || []) {
    if (box.readingColumn !== false && box.width < Math.min(240, measurements.layout.viewportWidth * 0.65)) add('narrow-prose-container', box, box);
    if (box.left < 8 || box.left + box.width > measurements.layout.viewportWidth - 8) add('prose-edge-padding', box, box);
  }
  return findings;
}

export function summarize(rows) {
  const counts = Object.fromEntries(['PASS', 'FAIL', 'UNVERIFIED', 'PENDING', 'FILTERED'].map(status =>
    [status, rows.filter(row => row.status === status).length]));
  const fullCoverage = rows.length > 0 && counts.PASS === rows.length;
  return { total: rows.length, counts, fullCoverage,
    status: counts.FAIL ? 'FAIL' : fullCoverage ? 'PASS' : 'UNVERIFIED' };
}
