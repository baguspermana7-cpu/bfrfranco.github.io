import { readEpzFile, diffDocuments, analyzeEpzDiffs, summarizeEpzCategories, summarizeEpzRisks, buildEpzProtectionMatrix, epzWorkbookSheets } from './core/epz.js';
import { readGalaxyRptFile, classifyEvent, deriveGalaxyPowerFlow, summarizeGalaxyReport, galaxyWorkbookSheets } from './core/galaxy.js';
import { DEFAULT_DTSC_SETTINGS, DTSC_SOURCE_BASIS, buildDtscSequence, eventAt, analyzeDtscSequence, deriveDtscHmiState, dtscWorkbookSheets } from './core/dtsc.js';
import { readDtscImportFile, dtscWorkbookSheetsWithImport } from './core/dtscImport.js';
import { exportWorkbook, exportCsv } from './core/exporter.js';
import { CORE_TOOLS, EQUIPMENT_MODULES, FAQ_ITEMS, MODULE_CONTRACT } from './core/registry.js';

const ICON_MAP = {
  'activity': 'fa-chart-line',
  'archive': 'fa-box-archive',
  'book-open': 'fa-book-open',
  'download': 'fa-download',
  'file-code': 'fa-file-code',
  'file-spreadsheet': 'fa-file-excel',
  'gauge': 'fa-gauge-high',
  'git-compare': 'fa-code-compare',
  'play': 'fa-play',
  'rotate-ccw': 'fa-rotate-left',
  'search': 'fa-magnifying-glass',
  'settings': 'fa-sliders',
  'shield-check': 'fa-shield-halved',
  'upload': 'fa-cloud-arrow-up',
  'zap': 'fa-bolt'
};
function icon(name, size = 17) {
  const fa = ICON_MAP[name] || 'fa-cube';
  return `<i class="fas ${fa}" style="font-size:${size}px;width:${size}px;height:${size}px;display:inline-block;line-height:${size}px;" aria-hidden="true"></i>`;
}

const app = document.getElementById('mdl-app');
const state = {
  active: 'overview',
  epz: { before: null, after: null, diffs: [], filter: '' },
  galaxy: { decoded: null, selected: 0 },
  dtsc: {
    settings: { ...DEFAULT_DTSC_SETTINGS },
    scenario: 'fail-return',
    sequence: buildDtscSequence(DEFAULT_DTSC_SETTINGS, 'fail-return'),
    time: 0,
    playing: false,
    runStartedAt: 0,
    runBaseTime: 0,
    imported: null
  }
};

const tools = CORE_TOOLS;

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setActive(id) {
  state.active = id;
  render();
}

function render() {
  const activeTool = tools.find((tool) => tool.id === state.active) || tools[0];
  app.innerHTML = `
    <div class="app-shell">
      <aside class="side">
        <div class="brand">
          <div class="brand-mark">${icon('settings', 22)}</div>
          <h1>Maintenance Decode Lab</h1>
          <p>Offline-first decoder, visualizer, simulator, and export tool for field maintenance files.</p>
        </div>
        <div>
          <div class="nav-section-label">Tools</div>
          <div class="tool-nav">
            ${tools.map((tool) => `
              <button class="nav-btn ${state.active === tool.id ? 'active' : ''}" data-nav="${tool.id}" aria-label="${h(tool.title)}">
                ${icon(tool.icon)}
                <span><span class="nav-title">${h(tool.title)}</span><span class="nav-sub">${h(tool.sub)}</span></span>
                <span class="status-dot ${tool.status}"></span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="side-note">
          Engineering rule: decode and visualize are allowed offline. Writing settings back to equipment must remain validated in official vendor software and site procedures.
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="top-title">
            <h2>${h(activeTool.title)}</h2>
            <p>${topSubtitle(activeTool.id)}</p>
          </div>
          <div class="chips">
            <span class="chip green">Offline-first</span>
            <span class="chip blue">Import / Decode / Export</span>
            <span class="chip amber">Viewer only</span>
          </div>
        </header>
        ${renderStatusStrip()}
        <section class="workspace">${renderActivePanel()}</section>
      </main>
    </div>
  `;
  bindShell();
  bindActivePanel();
  if (state.active === 'ups') drawSelectedWaveform();
}

function topSubtitle(id) {
  const map = {
    overview: 'One scalable shell for protection relay settings, UPS waveform reports, ATS sequence simulation, and Excel handover exports.',
    relay: 'Decode eSetup Easergy Pro / VAMPSET EPZ files without opening the official setting tool.',
    ups: 'Decode Galaxy VL exported report records and classify waveform incidents for maintenance review.',
    ats: 'Simulate DTSC-200 style source failure, stable timers, neutral timers, transfer commit, and retransfer.',
    faq: 'Implementation notes, supported formats, safety boundaries, and future expansion plan.'
  };
  return map[id] || '';
}

function renderStatusStrip() {
  const epzCount = (state.epz.before?.flat.length || 0) + (state.epz.after?.flat.length || 0);
  const upsRecords = state.galaxy.decoded?.records.length || 0;
  const totalDuration = state.dtsc.sequence.totalDuration.toFixed(1);
  return `
    <div class="status-strip">
      <div class="strip-cell"><div class="strip-label">Project root</div><div class="strip-value">Documents/maintenance tools</div></div>
      <div class="strip-cell"><div class="strip-label">Relay rows</div><div class="strip-value">${epzCount}</div></div>
      <div class="strip-cell"><div class="strip-label">UPS records</div><div class="strip-value">${upsRecords}</div></div>
      <div class="strip-cell"><div class="strip-label">ATS sim duration</div><div class="strip-value">${totalDuration}s</div></div>
      <div class="strip-cell"><div class="strip-label">Architecture</div><div class="strip-value">Registry modules</div></div>
    </div>
  `;
}

function renderActivePanel() {
  if (state.active === 'relay') return renderRelay();
  if (state.active === 'ups') return renderUps();
  if (state.active === 'ats') return renderAts();
  if (state.active === 'faq') return renderFaq();
  return renderOverview();
}

function renderOverview() {
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">${icon('activity')} System Concept</div>
            <div class="panel-sub">Scalable maintenance analysis platform</div>
          </div>
        </div>
        <div class="panel-body">
          <div class="metric-grid">
            <div class="metric-card"><div class="metric-label">Equipment modules</div><div class="metric-value">${EQUIPMENT_MODULES.length}</div><div class="metric-hint">Registry-driven tools.</div></div>
            <div class="metric-card"><div class="metric-label">File decoders</div><div class="metric-value">3</div><div class="metric-hint">EPZ, RPT, and DTSC setting imports.</div></div>
            <div class="metric-card"><div class="metric-label">Simulator</div><div class="metric-value">ATS</div><div class="metric-hint">DTSC transfer sequence model.</div></div>
            <div class="metric-card"><div class="metric-label">Future modules</div><div class="metric-value">N+</div><div class="metric-hint">Add decoder registry entries.</div></div>
          </div>
          <div class="notice">
            This first integrated version keeps every parser in browser-side core modules. That is intentional: backup files stay local, decoding is transparent, and future backend batching can reuse the same normalized data contracts.
          </div>
          <div style="height:14px"></div>
          <div class="workflow">
            <div class="workflow-step"><b>1. Import</b><p>Drop .epz, .rpt, DTSC text/config exports, or text-based DTSC PDF setting reports.</p></div>
            <div class="workflow-step"><b>2. Decode</b><p>Convert vendor backups into normalized tables, incidents, settings, and sequence steps.</p></div>
            <div class="workflow-step"><b>3. Export</b><p>Create Excel workbook for maintenance evidence, handover, and offline archive.</p></div>
          </div>
          <div class="module-grid">
            ${EQUIPMENT_MODULES.map((module) => renderModuleCard(module)).join('')}
          </div>
        </div>
      </div>
      ${renderInspector('Research basis', [
        ['Woodward', 'DTSC-200A transfer modes, transfer commit, LogicsManager'],
        ['Schneider P3', 'EPZ stores relay settings/events/fault logs'],
        ['Galaxy VL', 'UPS report export to USB for support'],
        ['Boundary', 'No write-back to equipment in this tool']
      ])}
    </div>
  `;
}

function renderModuleCard(module) {
  return `
    <button class="module-card" data-nav="${h(module.route)}" aria-label="Open ${h(module.model)} module">
      <div class="module-icon">${icon(module.icon, 19)}</div>
      <div>
        <div class="module-kicker">${h(module.family)} / ${h(module.vendor)}</div>
        <h3>${h(module.model)}</h3>
        <p>${h(module.confidence)}</p>
        <div class="cap-list">${module.capabilities.map((cap) => `<span>${h(cap)}</span>`).join('')}</div>
        <div class="module-safety">${h(module.safetyBoundary)}</div>
      </div>
    </button>
  `;
}

function renderRelay() {
  const before = state.epz.before;
  const after = state.epz.after;
  const activeDoc = after || before;
  const diffs = state.epz.diffs || [];
  const rows = activeDoc ? filterRows(activeDoc.flat, state.epz.filter).slice(0, 350) : [];
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">${icon('shield-check')} Easergy P3 EPZ Decoder</div>
            <div class="panel-sub">Supports single file review or before/after diff.</div>
          </div>
          <div class="btn-row">
            <button class="btn" data-action="relay-reset" aria-label="Reset relay decoder">${icon('rotate-ccw')} Reset</button>
            <button class="btn primary" data-action="relay-export" aria-label="Export Excel report" ${activeDoc ? '' : 'disabled'}>${icon('file-spreadsheet')} Export Excel</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="grid-3">
            ${dropBox('relay-before', 'Before EPZ', before?.sourceName || 'Drop or click to import baseline .epz')}
            ${dropBox('relay-after', 'After EPZ', after?.sourceName || 'Drop or click to import revised .epz')}
            <div class="summary-tile"><div class="metric-label">Diff count</div><div class="metric-value">${diffs.length}</div><div class="metric-hint">Changed, added, removed parameters.</div></div>
          </div>
          <div style="height:14px"></div>
          ${activeDoc ? renderRelayResults(rows, diffs) : '<div class="empty">Import an EPZ file to decode relay settings.</div>'}
        </div>
      </div>
      ${renderInspector('Relay decode contract', [
        ['Format', 'EPC magic + raw deflate payload'],
        ['Parser', 'VAMPSET text groups and parameters'],
        ['Filters', 'Volatile/runtime rows separated from settings'],
        ['Safety', 'Review/export only; do not write settings from this app']
      ])}
    </div>
  `;
}

function renderRelayResults(rows, diffs) {
  const activeDoc = state.epz.after || state.epz.before;
  const risks = analyzeEpzDiffs(diffs);
  const riskSummary = summarizeEpzRisks(risks);
  const categorySummary = summarizeEpzCategories(activeDoc);
  const protectionMatrix = buildEpzProtectionMatrix(activeDoc, diffs);
  return `
    ${renderRelayEvidence(activeDoc, categorySummary)}
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-label">Groups</div><div class="metric-value">${activeDoc.groups.length}</div><div class="metric-hint">Parsed menu groups.</div></div>
      <div class="metric-card"><div class="metric-label">Settings</div><div class="metric-value">${activeDoc.settings.length}</div><div class="metric-hint">Writable/non-runtime candidates.</div></div>
      <div class="metric-card"><div class="metric-label">Runtime</div><div class="metric-value">${activeDoc.runtime.length}</div><div class="metric-hint">Counters, logs, measurements.</div></div>
      <div class="metric-card"><div class="metric-label">Risk flags</div><div class="metric-value">${riskSummary.bySeverity.CRITICAL}/${riskSummary.bySeverity.WARN}</div><div class="metric-hint">Critical / warning setting changes.</div></div>
    </div>
    ${renderRelayRiskTiles(riskSummary)}
    ${protectionMatrix.length ? renderProtectionMatrix(protectionMatrix.slice(0, 80)) : ''}
    ${categorySummary.length ? renderCategorySummary(categorySummary) : ''}
    <div class="btn-row" style="margin-bottom:10px">
      <input id="relayFilter" value="${h(state.epz.filter)}" placeholder="Search group, parameter, description, value..." aria-label="Filter relay parameters" style="flex:1;min-height:38px;border:1px solid var(--line-strong);border-radius:7px;padding:8px 10px">
      <button class="btn" data-action="relay-csv" aria-label="Export CSV">${icon('download')} Export CSV</button>
    </div>
    ${diffs.length ? renderDiffTable(diffs.slice(0, 180)) : ''}
    ${risks.length ? renderRiskReview(risks.slice(0, 180)) : ''}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Category</th><th>Group</th><th>Parameter</th><th>Description</th><th>Value</th><th>Unit</th><th>Range</th><th>Kind</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${h(r.category)}</td><td>${h(r.group)}</td><td><b>${h(r.name)}</b></td><td>${h(r.desc)}</td><td>${h(r.value)}</td><td>${h(r.unit)}</td><td>${h(r.range)}</td><td>${r.setting ? '<span class="pill ok">Setting</span>' : '<span class="pill">Runtime</span>'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderRelayEvidence(activeDoc, categorySummary) {
  const topCategories = categorySummary.slice(0, 4).map((item) => `${item.category}: ${item.settings}/${item.parameters}`).join(' · ');
  return `
    <div class="evidence-panel">
      <div class="evidence-card">
        <div class="metric-label">Active source</div>
        <div class="evidence-value">${h(activeDoc.sourceName)}</div>
        <div class="metric-hint">Decoded through EPC magic header and raw deflate payload.</div>
      </div>
      <div class="evidence-card">
        <div class="metric-label">Parser confidence</div>
        <div class="evidence-value">HIGH</div>
        <div class="metric-hint">VAMPSET GROUP/PARAMETER structure detected and indexed.</div>
      </div>
      <div class="evidence-card">
        <div class="metric-label">Setting separation</div>
        <div class="evidence-value">${activeDoc.settings.length} / ${activeDoc.flat.length}</div>
        <div class="metric-hint">Runtime/volatile rows are excluded from setting-risk rules.</div>
      </div>
      <div class="evidence-card">
        <div class="metric-label">Top categories</div>
        <div class="evidence-value small">${h(topCategories || '-')}</div>
        <div class="metric-hint">Format: settings / total parameters.</div>
      </div>
    </div>
  `;
}

function renderRelayRiskTiles(summary) {
  if (!summary.byIssue.length) return '<div class="notice">No EPZ diff risk flags yet. Import both before and after files to run engineering change review.</div><div style="height:12px"></div>';
  return `
    <div class="risk-tile-grid">
      ${summary.byIssue.slice(0, 6).map((item) => `<div class="risk-tile"><span>${h(item.issue)}</span><b>${item.count}</b></div>`).join('')}
    </div>
  `;
}

function renderProtectionMatrix(matrix) {
  return `
    <div class="subsection">
      <div class="subsection-head">
        <div>
          <div class="panel-title">${icon('shield-check')} Protection matrix</div>
          <div class="panel-sub">Commissioning view of protection groups, key settings, and diff severity.</div>
        </div>
      </div>
      <div class="protection-matrix">
        ${matrix.map((row) => `
          <div class="protection-row ${h(row.severity.toLowerCase())}">
            <div>
              <div class="matrix-kicker">${h(row.severity)} · ${row.changed} changed</div>
              <div class="matrix-title">${h(row.group)}</div>
              <div class="metric-hint">${h(row.description || '-')}</div>
            </div>
            <div><span>Enable</span><b>${h(row.enable || '-')}</b></div>
            <div><span>Pickup / threshold</span><b>${h(row.pickup || '-')}</b></div>
            <div><span>Delay</span><b>${h(row.delay || '-')}</b></div>
            <div><span>Curve</span><b>${h(row.curve || '-')}</b></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCategorySummary(categories) {
  return `
    <div class="subsection">
      <div class="subsection-head"><div class="panel-title">${icon('archive')} Category summary</div></div>
      <div class="category-bars">
        ${categories.map((item) => {
          const pct = item.parameters ? Math.round((item.settings / item.parameters) * 100) : 0;
          return `<div class="category-bar">
            <div><b>${h(item.category)}</b><span>${item.groups} groups · ${item.settings} settings · ${item.runtime} runtime</span></div>
            <div class="mini-bar"><span style="width:${pct}%"></span></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderRiskReview(risks) {
  return `
    <div class="subsection">
      <div class="subsection-head"><div class="panel-title">${icon('gauge')} Engineering risk review</div><div class="panel-sub">Rule-based triage for commissioning review, not an approval engine.</div></div>
      <div class="table-wrap" style="border:0;border-radius:0">
        <table>
          <thead><tr><th>Severity</th><th>Issue</th><th>Group</th><th>Parameter</th><th>Before</th><th>After</th><th>Delta</th><th>Recommendation</th></tr></thead>
          <tbody>${risks.map((risk) => `<tr><td><span class="pill ${risk.severity}">${h(risk.severity)}</span></td><td>${h(risk.issue)}</td><td>${h(risk.group)}</td><td>${h(risk.name)}</td><td>${h(risk.before)}</td><td>${h(risk.after)}</td><td>${h(risk.delta)}</td><td>${h(risk.recommendation)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDiffTable(diffs) {
  return `
    <div class="subsection">
      <div class="subsection-head"><div class="panel-title">${icon('git-compare')} Configuration changes</div></div>
      <div class="table-wrap" style="border:0;border-radius:0">
        <table>
          <thead><tr><th>Kind</th><th>Group</th><th>Parameter</th><th>Before</th><th>After</th></tr></thead>
          <tbody>${diffs.map((d) => `<tr><td><span class="pill blue">${h(d.kind)}</span></td><td>${h(d.group)}</td><td>${h(d.name)}</td><td>${h(d.before)}</td><td>${h(d.after)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderUps() {
  const decoded = state.galaxy.decoded;
  const incidents = decoded?.incidents || [];
  const selected = incidents[state.galaxy.selected]?.[0] || null;
  const classification = selected ? classifyEvent(selected) : null;
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">${icon('zap')} Galaxy VL RPT Analyzer</div>
            <div class="panel-sub">Inferred binary container: embedded .JSON records with zlib payloads.</div>
          </div>
          <div class="btn-row">
            <button class="btn" data-action="ups-reset" aria-label="Reset UPS analyzer">${icon('rotate-ccw')} Reset</button>
            <button class="btn primary" data-action="ups-export" aria-label="Export Excel report" ${decoded ? '' : 'disabled'}>${icon('file-spreadsheet')} Export Excel</button>
          </div>
        </div>
        <div class="panel-body">
          ${dropBox('ups-file', 'Galaxy VL .rpt', decoded?.fileName || 'Drop or click to import exported UPS report')}
          <div style="height:14px"></div>
          ${decoded ? renderUpsResults(decoded, classification) : '<div class="empty">Import a Galaxy VL RPT file to decode incidents and waveform records.</div>'}
        </div>
      </div>
      ${renderInspector('UPS selected incident', selected ? [
        ['Time', selected.event_time],
        ['Severity', classification.severity],
        ['Tags', classification.tags.join(', ') || '-'],
        ['Mains V', classification.mains.map((v) => v.toFixed(0)).join('/')],
        ['Output V', classification.output.map((v) => v.toFixed(0)).join('/')],
        ['Output imbalance', `${classification.metrics.outputImbalancePct.toFixed(2)}%`],
        ['Current imbalance', `${classification.metrics.currentImbalancePct.toFixed(2)}%`],
        ['Battery symmetry', `${classification.metrics.batterySymmetryPct.toFixed(2)}%`],
        ['Battery +', classification.battPos.toFixed(1) + ' V'],
        ['Narrative', classification.notes || '-']
      ] : [
        ['Status', 'No file imported'],
        ['Expected', '.rpt exported report'],
        ['Output', 'Incidents, waveform stats, Excel']
      ])}
    </div>
  `;
}

function renderUpsResults(decoded, classification) {
  const incidents = decoded.incidents;
  const metrics = classification?.metrics;
  const evidence = summarizeGalaxyReport(decoded);
  return `
    ${renderUpsEvidence(evidence)}
    ${classification ? renderUpsPowerFlow(classification) : ''}
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-label">Records</div><div class="metric-value">${decoded.records.length}</div><div class="metric-hint">Decoded JSON waveform records.</div></div>
      <div class="metric-card"><div class="metric-label">Incidents</div><div class="metric-value">${incidents.length}</div><div class="metric-hint">Clustered by 30 second gap.</div></div>
      <div class="metric-card"><div class="metric-label">Serial</div><div class="metric-value" style="font-size:16px">${h(decoded.records[0]?.serial_number || '-')}</div><div class="metric-hint">From report event metadata.</div></div>
      <div class="metric-card"><div class="metric-label">Selected</div><div class="metric-value">${classification?.severity || '-'}</div><div class="metric-hint">${h(classification?.tags.join(', ') || 'No selection')}</div></div>
    </div>
    <div class="metric-grid compact">
      <div class="metric-card"><div class="metric-label">Output regulation</div><div class="metric-value">${metrics ? metrics.outputRegulationPct.toFixed(2) : '-'}%</div><div class="metric-hint">Average output vs 230 V nominal.</div></div>
      <div class="metric-card"><div class="metric-label">Output imbalance</div><div class="metric-value">${metrics ? metrics.outputImbalancePct.toFixed(2) : '-'}%</div><div class="metric-hint">Phase spread / average voltage.</div></div>
      <div class="metric-card"><div class="metric-label">Current imbalance</div><div class="metric-value">${metrics ? metrics.currentImbalancePct.toFixed(2) : '-'}%</div><div class="metric-hint">Phase current distribution.</div></div>
      <div class="metric-card"><div class="metric-label">Battery symmetry</div><div class="metric-value">${metrics ? metrics.batterySymmetryPct.toFixed(2) : '-'}%</div><div class="metric-hint">Positive vs negative DC bus.</div></div>
    </div>
    ${classification ? renderUpsEngineeringBasis(classification) : ''}
    ${classification?.recommendations?.length ? renderRecommendations(classification.recommendations) : ''}
    <div class="table-wrap" style="margin-bottom:12px">
      <table>
        <thead><tr><th>#</th><th>Time</th><th>Records</th><th>Severity</th><th>Tags</th><th>Mains V</th><th>Output V</th><th>Out Imb</th><th>Current A</th><th>Cur Imb</th><th>Battery</th></tr></thead>
        <tbody>
          ${incidents.map((cluster, idx) => {
            const c = classifyEvent(cluster[0]);
            return `<tr class="${idx === state.galaxy.selected ? 'selected' : ''}" data-incident="${idx}" style="cursor:pointer">
              <td>${idx + 1}</td><td>${h(cluster[0].event_time)}</td><td>${cluster.length}</td><td><span class="pill ${c.severity}">${c.severity}</span></td><td>${h(c.tags.join(', '))}</td><td>${c.mains.map((v) => v.toFixed(0)).join('/')}</td><td>${c.output.map((v) => v.toFixed(0)).join('/')}</td><td>${c.metrics.outputImbalancePct.toFixed(2)}%</td><td>${c.current.map((v) => v.toFixed(0)).join('/')}</td><td>${c.metrics.currentImbalancePct.toFixed(2)}%</td><td>${c.battPos.toFixed(0)} / ${c.battNeg.toFixed(0)} V</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="canvas-card">
      <canvas class="wave-canvas" id="waveCanvas" width="1200" height="360"></canvas>
    </div>
  `;
}

function renderUpsEvidence(evidence) {
  return `
    <div class="evidence-panel">
      <div class="evidence-card">
        <div class="metric-label">Report source</div>
        <div class="evidence-value">${h(evidence.fileName)}</div>
        <div class="metric-hint">${h(evidence.method)}</div>
      </div>
      <div class="evidence-card">
        <div class="metric-label">Parser confidence</div>
        <div class="evidence-value">${h(evidence.confidence)}</div>
        <div class="metric-hint">Confidence is based on successfully inflated embedded JSON records.</div>
      </div>
      <div class="evidence-card">
        <div class="metric-label">Report window</div>
        <div class="evidence-value small">${h(evidence.start || '-')} &rarr; ${h(evidence.end || '-')}</div>
        <div class="metric-hint">Timestamps are taken from report event metadata.</div>
      </div>
      <div class="evidence-card">
        <div class="metric-label">UPS serial</div>
        <div class="evidence-value">${h(evidence.serial || '-')}</div>
        <div class="metric-hint">Use for matching site asset register and Schneider support cases.</div>
      </div>
    </div>
  `;
}

function renderUpsPowerFlow(classification) {
  const flow = deriveGalaxyPowerFlow(classification);
  const blocks = [flow.mains, flow.rectifier, flow.dcBus, flow.inverter, flow.load];
  return `
    <div class="ups-flow">
      <div class="ups-flow-title">
        <div>
          <div class="metric-label">Power flow mimic</div>
          <div class="flow-headline">${h(classification.severity)} · ${h(classification.tags.join(', ') || 'NO TAGS')}</div>
        </div>
        <span class="pill ${classification.severity}">${h(classification.severity)}</span>
      </div>
      <div class="ups-flow-line">
        ${blocks.map((block, idx) => `
          <div class="flow-node ${h(block.tone)}">
            <span>${h(block.label)}</span>
            <b>${h(block.state)}</b>
            <small>${h(block.value)}</small>
          </div>
          ${idx < blocks.length - 1 ? '<div class="flow-connector"></div>' : ''}
        `).join('')}
      </div>
      <div class="metric-hint">${h(classification.notes || 'No classifier note for selected incident.')}</div>
    </div>
  `;
}

function renderUpsEngineeringBasis(classification) {
  const stats = classification.stats || {};
  const rows = [
    ['Mains V RMS', classification.mains.map((v) => v.toFixed(1)).join(' / '), 'Input source health and upstream event correlation.'],
    ['Output V RMS', classification.output.map((v) => v.toFixed(1)).join(' / '), 'UPS inverter/static switch output to load.'],
    ['Output regulation', `${classification.metrics.outputRegulationPct.toFixed(2)}%`, 'Average output voltage compared with 230 V nominal.'],
    ['Current crest factor max', classification.metrics.currentCrestFactorMax.toFixed(2), 'Peak/RMS current shape indicator from waveform samples.'],
    ['Ground RMS', `${classification.metrics.groundRms.toFixed(2)} V`, 'DC ground disturbance review basis.'],
    ['Waveform sample basis', `${Object.keys(stats).length} channel stats`, 'RMS, peak, peak-to-peak, crest factor are calculated per decoded channel.']
  ];
  return `
    <div class="subsection">
      <div class="subsection-head">
        <div>
          <div class="panel-title">${icon('gauge')} Power quality basis</div>
          <div class="panel-sub">Calculated from decoded waveform samples, not manually entered values.</div>
        </div>
      </div>
      <div class="basis-grid">
        ${rows.map(([label, value, note]) => `
          <div class="basis-card">
            <span>${h(label)}</span>
            <b>${h(value)}</b>
            <small>${h(note)}</small>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderRecommendations(items) {
  return `
    <div class="recommendation-box">
      <div class="panel-title">${icon('search')} Maintenance recommendations</div>
      <ul>${items.map((item) => `<li>${h(item)}</li>`).join('')}</ul>
    </div>
  `;
}

function renderAts() {
  const sequence = state.dtsc.sequence;
  const now = eventAt(sequence, state.dtsc.time);
  const analysis = analyzeDtscSequence(sequence);
  const hmi = deriveDtscHmiState(sequence, state.dtsc.time);
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">${icon('git-compare')} Woodward DTSC-200 Transfer Simulator</div>
            <div class="panel-sub">Accelerated maintenance simulator: numeric timer value is simulated as seconds.</div>
          </div>
          <div class="btn-row">
            <button class="btn primary" data-action="ats-play" aria-label="${state.dtsc.playing ? 'Stop' : 'Run'} ATS simulation">${icon(state.dtsc.playing ? 'rotate-ccw' : 'play')} ${state.dtsc.playing ? 'Stop' : 'Run'}</button>
            <button class="btn" data-action="ats-reset" aria-label="Reset ATS simulation">${icon('rotate-ccw')} Reset</button>
            <button class="btn" data-action="ats-export" aria-label="Export ATS Excel">${icon('file-spreadsheet')} Export</button>
          </div>
        </div>
        <div class="panel-body">
          ${dropBox('dtsc-file', 'DTSC-200 config / PDF', state.dtsc.imported?.sourceName || 'Drop original export, text config, or text-based PDF setting report')}
          <div style="height:14px"></div>
          ${state.dtsc.imported ? renderDtscImportEvidence(state.dtsc.imported) : ''}
          ${state.dtsc.imported ? '<div style="height:14px"></div>' : ''}
          ${renderAtsMimic(hmi)}
          <div style="height:14px"></div>
          ${renderAtsSummary(analysis)}
          <div style="height:14px"></div>
          ${renderAtsControls()}
          <div style="height:14px"></div>
          ${renderAtsTimeline(sequence, now)}
        </div>
      </div>
      ${renderInspector('DTSC basis and state', [
        ['Current step', now?.title || '-'],
        ['Time', `${state.dtsc.time.toFixed(1)} / ${sequence.totalDuration.toFixed(1)} s`],
        ['Transition', state.dtsc.settings.transitionType],
        ['Transfer commit', state.dtsc.settings.transferCommit ? 'YES' : 'NO'],
        ['QF1 S1 incomer', hmi.breakers.s1.position],
        ['QF2 S2 incomer', hmi.breakers.s2.position],
        ['Load bus', hmi.bus.label],
        ['Active requirement', hmi.requirement.label],
        ['Requirement remaining', `${hmi.requirement.remainingSeconds.toFixed(1)} s`],
        ['Import confidence', state.dtsc.imported?.confidence || 'Manual/default'],
        ['Imported fields', state.dtsc.imported?.fields.length || 0],
        ['Outage to S2', `${analysis.outageToS2Seconds.toFixed(1)} s`],
        ['S1->S2 interruption', `${analysis.loadInterruptionToS2Seconds.toFixed(1)} s`],
        ['S2->S1 interruption', `${analysis.loadInterruptionToS1Seconds.toFixed(1)} s`],
        ['Compressed timers', '1 displayed minute can be simulated as 1 second'],
        ['Basis', DTSC_SOURCE_BASIS.join(' ')]
      ])}
    </div>
  `;
}

function renderDtscImportEvidence(imported) {
  return `
    <div class="import-evidence">
      <div>
        <div class="metric-label">Import confidence</div>
        <div class="evidence-title">${h(imported.confidence)} · ${imported.fields.length} fields recognized</div>
        <div class="metric-hint">${h(imported.evidence.join(' '))}</div>
      </div>
      ${imported.warnings.length ? `<div class="evidence-warnings">${imported.warnings.map((warning) => `<div>${h(warning)}</div>`).join('')}</div>` : ''}
      <div class="table-wrap evidence-table">
        <table>
          <thead><tr><th>Setting</th><th>Value</th><th>Unit</th><th>Source line</th></tr></thead>
          <tbody>${imported.fields.map((field) => `<tr><td>${h(field.label)}</td><td>${h(field.value)}</td><td>${h(field.unit)}</td><td>${h(field.source)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAtsSummary(analysis) {
  return `
    <div class="metric-grid compact">
      <div class="metric-card"><div class="metric-label">Outage to S2</div><div class="metric-value">${analysis.outageToS2Seconds.toFixed(1)}s</div><div class="metric-hint">Until emergency source closes to load.</div></div>
      <div class="metric-card"><div class="metric-label">S1-&gt;S2 interruption</div><div class="metric-value">${analysis.loadInterruptionToS2Seconds.toFixed(1)}s</div><div class="metric-hint">Open / neutral interval before S2 close.</div></div>
      <div class="metric-card"><div class="metric-label">S2-&gt;S1 interruption</div><div class="metric-value">${analysis.loadInterruptionToS1Seconds.toFixed(1)}s</div><div class="metric-hint">Open / neutral interval during retransfer.</div></div>
      <div class="metric-card"><div class="metric-label">Validation notes</div><div class="metric-value">${analysis.warnings.length}</div><div class="metric-hint">${h(analysis.warnings[0] || '-')}</div></div>
    </div>
  `;
}

function renderAtsMimic(hmi) {
  const req = hmi.requirement;
  return `
    <div class="ats-hmi">
      <div class="hmi-titlebar">
        <div>
          <div class="metric-label">DTSC-200 ATS HMI</div>
          <div class="hmi-step">${h(hmi.event?.title || '-')}</div>
        </div>
        <div class="hmi-mode">
          <span class="pill blue">AUTO</span>
          <span class="pill ${hmi.bus.tone}">BUS ${h(hmi.bus.label)}</span>
          <span class="pill ${req.status === 'TIMING' ? 'warn' : 'ok'}">${h(req.status)}</span>
        </div>
      </div>
      <div class="hmi-layout">
        ${renderSourceHmi('s1', hmi.sources.s1, hmi.breakers.s1)}
        <div class="single-line">
          <div class="feed feed-s1 ${hmi.breakers.s1.closed ? 'energized' : ''}">
            <div class="feed-label">S1 INCOMER</div>
            <div class="v-line"></div>
            ${renderBreakerSymbol(hmi.breakers.s1)}
          </div>
          <div class="load-bus ${hmi.bus.energized ? 'energized' : 'dead'} ${hmi.bus.tone}">
            <div class="busbar"></div>
            <div class="bus-readout">
              <div class="metric-label">Load bus</div>
              <div>${h(hmi.bus.label)}</div>
              <small>${h(hmi.bus.detail)}</small>
            </div>
          </div>
          <div class="feed feed-s2 ${hmi.breakers.s2.closed ? 'energized' : ''}">
            <div class="feed-label">S2 INCOMER</div>
            <div class="v-line"></div>
            ${renderBreakerSymbol(hmi.breakers.s2)}
          </div>
        </div>
        ${renderSourceHmi('s2', hmi.sources.s2, hmi.breakers.s2)}
      </div>
      <div class="hmi-bottom">
        <div class="requirement-card">
          <div class="requirement-head">
            <div>
              <div class="metric-label">Active stabilization / permissive requirement</div>
              <div class="requirement-title">${h(req.label)}</div>
            </div>
            <div class="requirement-time">${req.remainingSeconds.toFixed(1)}s left</div>
          </div>
          <div class="progress-track"><div style="width:${Math.round(req.progress * 100)}%"></div></div>
          <div class="metric-hint">${h(req.detail)} Required ${req.requiredSeconds.toFixed(1)}s, elapsed ${Math.max(0, (req.requiredSeconds - req.remainingSeconds)).toFixed(1)}s.</div>
        </div>
        <div class="permissive-grid">
          ${hmi.permissives.map((item) => `<div class="permissive ${h(item.tone)}"><span>${h(item.label)}</span><b>${h(item.state)}</b></div>`).join('')}
        </div>
      </div>
      <div class="alarm-strip">
        ${hmi.alarms.map((alarm) => `<div>${h(alarm)}</div>`).join('')}
      </div>
    </div>
  `;
}

function renderSourceHmi(side, source, breaker) {
  const healthyClass = source.healthy || source.stable ? 'ok' : 'crit';
  return `
    <div class="hmi-source ${side} ${healthyClass}">
      <div class="source-head">
        <div>
          <div class="metric-label">${h(source.label)}</div>
          <div class="source-status">${h(source.status)}</div>
        </div>
        <span class="lamp ${healthyClass}"></span>
      </div>
      <div class="source-readouts">
        <div><span>V/F</span><b>${h(source.voltageFrequency)}</b></div>
        ${side === 's2' ? `<div><span>Start cmd</span><b>${source.startCommand ? 'ACTIVE' : 'OFF'}</b></div>` : `<div><span>Return stable</span><b>${source.returnStable ? 'PASSED' : source.returnTiming ? 'TIMING' : 'N/A'}</b></div>`}
        <div><span>${h(breaker.label)}</span><b>${h(breaker.position)}</b></div>
      </div>
    </div>
  `;
}

function renderBreakerSymbol(breaker) {
  const className = breaker.transition ? 'transition' : breaker.closed ? 'closed' : 'open';
  return `
    <div class="breaker-symbol ${className}">
      <span></span>
      <b>${h(breaker.position)}</b>
    </div>
  `;
}

function renderAtsControls() {
  const s = state.dtsc.settings;
  const input = (key, label) => `<div class="field"><label>${label}</label><input type="number" min="0" step="0.1" data-ats="${key}" value="${h(s[key])}" aria-label="${label}"></div>`;
  return `
    <div class="settings-block">
      <div class="subsection-head"><div><div class="panel-title">${icon('settings')} Simulator settings</div><div class="panel-sub">Displayed as field timer values; simulation runs accelerated in seconds.</div></div></div>
      <div class="form-grid">
        <div class="field"><label>Scenario</label><select data-ats-scenario aria-label="Simulation scenario">
          <option value="fail-return" ${state.dtsc.scenario === 'fail-return' ? 'selected' : ''}>Utility fail then return</option>
          <option value="fail-only" ${state.dtsc.scenario === 'fail-only' ? 'selected' : ''}>Utility fail only</option>
          <option value="momentary" ${state.dtsc.scenario === 'momentary' ? 'selected' : ''}>Momentary dip restore</option>
        </select></div>
        <div class="field"><label>Transition type</label><select data-ats="transitionType" aria-label="Transition type">
          <option value="open" ${s.transitionType === 'open' ? 'selected' : ''}>Open</option>
          <option value="delayed" ${s.transitionType === 'delayed' ? 'selected' : ''}>Delayed neutral</option>
          <option value="closed" ${s.transitionType === 'closed' ? 'selected' : ''}>Closed transition</option>
        </select></div>
        <div class="field"><label>Transfer commit</label><select data-ats="transferCommit" aria-label="Transfer commit">
          <option value="true" ${s.transferCommit ? 'selected' : ''}>YES</option>
          <option value="false" ${!s.transferCommit ? 'selected' : ''}>NO</option>
        </select></div>
        ${input('s1OutageDelay', 'S1 outage delay')}
        ${input('s2StartDelay', 'S2 start delay')}
        ${input('s2StableDelay', 'S2 stable delay')}
        ${input('transferDelayS1S2', 'Transfer delay S1->S2')}
        ${input('neutralTimeToS2', 'Neutral time to S2')}
        ${input('s1ReturnStableDelay', 'S1 return stable')}
        ${input('transferDelayS2S1', 'Transfer delay S2->S1')}
        ${input('neutralTimeToS1', 'Neutral time to S1')}
        ${input('s2CooldownDelay', 'S2 cooldown')}
      </div>
    </div>
  `;
}

function renderAtsTimeline(sequence, now) {
  return `
    <div class="timeline">
      ${sequence.events.map((event) => `<div class="timeline-item ${event === now ? 'now' : ''}">
        <div class="timecode">${event.start.toFixed(1)}-${event.end.toFixed(1)}s</div>
        <div><div class="timeline-title">${h(event.title)}</div><div class="timeline-detail">${h(event.detail)}</div></div>
      </div>`).join('')}
    </div>
  `;
}

function renderFaq() {
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div><div class="panel-title">${icon('book-open')} FAQ and scalable design</div><div class="panel-sub">Project knowledge base for maintenance users and future developers.</div></div>
        </div>
        <div class="panel-body">
          <div class="faq-list">
            ${FAQ_ITEMS.map((item) => `<div class="faq-item"><h3>${h(item.question)}</h3><p>${h(item.answer)}</p></div>`).join('')}
          </div>
        </div>
      </div>
      ${renderInspector('Future module contract', MODULE_CONTRACT)}
    </div>
  `;
}

function dropBox(id, title, subtitle) {
  return `
    <label class="dropzone" data-drop="${id}" aria-label="Upload ${title}">
      <input type="file" data-file="${id}" hidden aria-label="${title}">
      <div>
        ${icon('upload', 24)}
        <strong>${h(title)}</strong>
        <span>${h(subtitle)}</span>
      </div>
    </label>
  `;
}

function renderInspector(title, rows) {
  return `
    <aside class="panel inspector">
      <div class="panel-head"><div class="panel-title">${icon('archive')} ${h(title)}</div></div>
      <div class="panel-body">
        <div class="kv-list">
          ${rows.map(([key, value]) => `<div class="kv"><span>${h(key)}</span><span>${h(value)}</span></div>`).join('')}
        </div>
      </div>
    </aside>
  `;
}

function filterRows(rows, filter) {
  const q = filter.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => [r.category, r.group, r.name, r.desc, r.value, r.unit, r.range].join(' ').toLowerCase().includes(q));
}

function bindShell() {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => setActive(btn.dataset.nav));
  });
}

function bindActivePanel() {
  bindDrops();
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action));
  });
  const relayFilter = document.getElementById('relayFilter');
  if (relayFilter) {
    relayFilter.addEventListener('input', (event) => {
      state.epz.filter = event.target.value;
      render();
    });
  }
  document.querySelectorAll('[data-incident]').forEach((row) => {
    row.addEventListener('click', () => {
      state.galaxy.selected = Number(row.dataset.incident);
      render();
    });
  });
  document.querySelectorAll('[data-ats]').forEach((input) => {
    input.addEventListener('change', () => {
      let value = input.value;
      if (input.dataset.ats === 'transferCommit') value = value === 'true';
      else if (input.type === 'number') value = Number(value);
      state.dtsc.settings[input.dataset.ats] = value;
      rebuildAts();
    });
  });
  const scenario = document.querySelector('[data-ats-scenario]');
  if (scenario) {
    scenario.addEventListener('change', () => {
      state.dtsc.scenario = scenario.value;
      rebuildAts();
    });
  }
}

function bindDrops() {
  document.querySelectorAll('[data-file]').forEach((input) => {
    input.addEventListener('change', async () => {
      if (input.files?.[0]) await handleFile(input.dataset.file, input.files[0]);
    });
  });
  document.querySelectorAll('[data-drop]').forEach((zone) => {
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('drag');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', async (event) => {
      event.preventDefault();
      zone.classList.remove('drag');
      const file = event.dataTransfer.files?.[0];
      if (file) await handleFile(zone.dataset.drop, file);
    });
  });
}

async function handleFile(slot, file) {
  try {
    if (slot === 'relay-before') state.epz.before = await readEpzFile(file);
    if (slot === 'relay-after') state.epz.after = await readEpzFile(file);
    if (slot.startsWith('relay')) state.epz.diffs = state.epz.before && state.epz.after ? diffDocuments(state.epz.before, state.epz.after) : [];
    if (slot === 'ups-file') {
      const decoded = await readGalaxyRptFile(file);
      if (!decoded.records.length) throw new Error('No valid Galaxy VL records found in this file.');
      state.galaxy.decoded = decoded;
      state.galaxy.selected = 0;
    }
    if (slot === 'dtsc-file') {
      const imported = await readDtscImportFile(file);
      state.dtsc.imported = imported;
      state.dtsc.settings = { ...imported.settings };
      state.dtsc.scenario = imported.scenario;
      state.dtsc.sequence = imported.sequence;
      state.dtsc.time = 0;
      state.dtsc.playing = false;
    }
    render();
  } catch (error) {
    const errorBanner = document.createElement('div');
    errorBanner.className = 'mdl-error-banner';
    errorBanner.textContent = error.message;
    errorBanner.setAttribute('role', 'alert');
    document.querySelector('#mdl-app')?.prepend(errorBanner);
    setTimeout(() => errorBanner.remove(), 6000);
  }
}

function handleAction(action) {
  if (action === 'relay-reset') {
    state.epz = { before: null, after: null, diffs: [], filter: '' };
    render();
  }
  if (action === 'relay-export') {
    exportWorkbook('easergy_p3_epz_report.xlsx', epzWorkbookSheets(state.epz.before, state.epz.after, state.epz.diffs));
  }
  if (action === 'relay-csv') {
    const doc = state.epz.after || state.epz.before;
    const rows = [['Category', 'Group', 'Parameter', 'Description', 'Value', 'Unit', 'Range'], ...(doc?.flat || []).map((r) => [r.category, r.group, r.name, r.desc, r.value, r.unit, r.range])];
    exportCsv('easergy_p3_configuration.csv', rows);
  }
  if (action === 'ups-reset') {
    state.galaxy = { decoded: null, selected: 0 };
    render();
  }
  if (action === 'ups-export') {
    exportWorkbook('galaxy_vl_rpt_analysis.xlsx', galaxyWorkbookSheets(state.galaxy.decoded));
  }
  if (action === 'ats-play') {
    state.dtsc.playing = !state.dtsc.playing;
    state.dtsc.lastPaint = 0;
    if (state.dtsc.playing && state.dtsc.time >= state.dtsc.sequence.totalDuration) state.dtsc.time = 0;
    state.dtsc.runStartedAt = Date.now();
    state.dtsc.runBaseTime = state.dtsc.time;
    render();
    if (state.dtsc.playing) requestAnimationFrame(tickDtsc);
  }
  if (action === 'ats-reset') {
    state.dtsc.time = 0;
    state.dtsc.playing = false;
    render();
  }
  if (action === 'ats-export') {
    exportWorkbook('woodward_dtsc200_sequence.xlsx', state.dtsc.imported ? dtscWorkbookSheetsWithImport(state.dtsc.sequence, state.dtsc.imported) : dtscWorkbookSheets(state.dtsc.sequence));
  }
}

function rebuildAts() {
  state.dtsc.sequence = buildDtscSequence(state.dtsc.settings, state.dtsc.scenario);
  state.dtsc.time = 0;
  state.dtsc.playing = false;
  render();
}

function tickDtsc(ts = 0) {
  if (state.active !== 'ats' || !state.dtsc.playing) return;
  const nowMs = Date.now();
  state.dtsc.time = state.dtsc.runBaseTime + Math.max(0, (nowMs - state.dtsc.runStartedAt) / 1000);
  if (state.dtsc.time >= state.dtsc.sequence.totalDuration) {
    state.dtsc.time = state.dtsc.sequence.totalDuration;
    state.dtsc.playing = false;
    render();
    return;
  }
  if (!state.dtsc.lastPaint || ts - state.dtsc.lastPaint > 250) {
    state.dtsc.lastPaint = ts;
    render();
  }
  requestAnimationFrame(tickDtsc);
}

function drawSelectedWaveform() {
  const canvas = document.getElementById('waveCanvas');
  const decoded = state.galaxy.decoded;
  const record = decoded?.incidents?.[state.galaxy.selected]?.[0];
  if (!canvas || !record) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f1d2b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  const sets = [];
  for (const waveform of record.waveforms || []) {
    for (const dataSet of waveform.DataSets || []) {
      if (['L1', 'L2', 'L3'].includes(dataSet.Label) && dataSet.Y?.length && sets.length < 6) {
        sets.push({ name: `${waveform.WaveformType} ${dataSet.Label}`, y: dataSet.Y });
      }
    }
  }
  const colors = ['#4da3ff', '#54d39a', '#f5a742', '#d16bff', '#ff6868', '#37d4d8'];
  const all = sets.flatMap((s) => s.y);
  const min = Math.min(...all, -1);
  const max = Math.max(...all, 1);
  sets.forEach((set, idx) => {
    ctx.strokeStyle = colors[idx % colors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    set.y.forEach((value, i) => {
      const x = (i / Math.max(1, set.y.length - 1)) * canvas.width;
      const y = canvas.height - ((value - min) / (max - min || 1)) * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = colors[idx % colors.length];
    ctx.fillText(set.name, 18, 22 + idx * 18);
  });
}

render();
