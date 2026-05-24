const { inflateRaw } = (typeof window !== 'undefined' && window.pako) || (typeof globalThis !== 'undefined' && globalThis.pako) || {};

const PARAM_ATTR_KEYS = new Set([
  'Length', 'Desc', 'Access', 'Range', 'Value', 'ValuePrev', 'ValueType',
  'ItemRead', 'Unit', 'Label', 'Min', 'Max', 'Step'
]);

const VOLATILE_GROUP_PREFIXES = [
  'VS_Event', 'VS_Diag', 'VS_DiagBuff', 'VS_IMinMax', 'VS_UMinMax',
  'VS_PMinMax', 'VS_MonthMax', 'VS_Demand', 'VS_RMS', 'VS_Energy',
  'VS_Meas', 'VS_CHarm', 'VS_VHarm', 'VS_Power', 'VS_PQ',
  'VS_FaultLocator', 'VS_Sync1Diag', 'VS_VoltageInts', 'VS_SagSwell',
  'VS_Runh', 'VS_ProtStatus', 'VS_Clock', 'VS_LogicEvents',
  'VS_LED_PRINTOUT', 'VS_Recorder'
];
const VOLATILE_PARAM_PREFIXES = ['SC_', 'TC_', 'StartCnt', 'TripCnt'];
const VOLATILE_PARAM_NAMES = new Set([
  'IL1max', 'IL2max', 'IL3max', 'IL1rmsMax', 'IL2rmsMax', 'IL3rmsMax',
  'IL1min', 'IL2min', 'IL3min', 'U12max', 'U23max', 'U31max', 'Uomax',
  'UNmax', 'Uomin', 'Pmax', 'Pmin', 'Qmax', 'Qmin', 'Smax', 'Smin',
  'fmax', 'fmin', 'Io1max', 'Io2max', 'Io1min', 'Io2min', 'UintTime',
  'ActiveSignals', 'ApplTemperature', 'AddADCPlayerSequence',
  'ClearADCPlayerSequence', 'StartADCPlayer', 'RecTrigDate',
  'RecTrigTime_ms', 'RecTrigTime'
]);

const GROUP_CATEGORY = {
  VS_ProtEna: ['Protection', 'Protection function enable'],
  VS_ProtStage: ['Protection', 'Protection stage settings'],
  VS_ProtStages: ['Protection', 'Protection stage settings'],
  VS_Meas: ['Measurements', 'Live measurement/runtime values'],
  VS_RMS: ['Measurements', 'RMS values'],
  VS_Comm: ['Communication', 'Communication and protocol settings'],
  VS_Modbus: ['Communication', 'Modbus settings'],
  VS_Ethernet: ['Communication', 'Ethernet settings'],
  VS_DO: ['I/O', 'Digital output settings'],
  VS_DI: ['I/O', 'Digital input settings'],
  VS_LED: ['I/O', 'LED matrix and indications'],
  VS_Matrix: ['Logic', 'Matrix configuration'],
  VS_Logic: ['Logic', 'Logic configuration'],
  VS_Recorder: ['Records', 'Disturbance recorder settings'],
  VS_Event: ['Records', 'Event and fault logs']
};

function decodeIso(bytes) {
  return new TextDecoder('iso-8859-1').decode(bytes);
}

export function decompressEpz(arrayBuffer) {
  const u8 = new Uint8Array(arrayBuffer);
  if (u8.length < 30 || u8[0] !== 0x45 || u8[1] !== 0x50 || u8[2] !== 0x43) {
    throw new Error("Not a valid EPZ file: missing 'EPC' magic header.");
  }
  const rawDeflate = u8.subarray(28);
  const decompressed = inflateRaw(rawDeflate);
  return decodeIso(decompressed);
}

export function parseVampset(text, sourceName) {
  const doc = { sourceName, header: {}, groups: [] };
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;
  let curGroup = null;
  let curParam = null;
  let expectMulti = 0;

  while (i < lines.length) {
    const s = lines[i].trim();
    if (s.startsWith('GROUP:')) break;
    if (s && !s.startsWith('***') && s.includes(':')) {
      const idx = s.indexOf(':');
      doc.header[s.slice(0, idx).trim()] = s.slice(idx + 1).trim();
    }
    i += 1;
  }

  const flushParam = () => {
    if (curParam && curGroup && !/^\d+$/.test(curParam.name)) {
      curParam.indexInGroup = curGroup.parameters.length;
      curGroup.parameters.push(curParam);
    }
    curParam = null;
  };

  while (i < lines.length) {
    const s = lines[i].trim();
    if (s.startsWith('GROUP:')) {
      flushParam();
      if (curGroup) doc.groups.push(curGroup);
      curGroup = { name: s.slice(6).trim(), attrs: {}, parameters: [] };
      expectMulti = 0;
    } else if (s.startsWith('PARAMETER:')) {
      flushParam();
      curParam = { name: s.slice(10).trim(), attrs: {}, multiValues: [] };
      expectMulti = 0;
    } else if (curParam && s.includes(':') && PARAM_ATTR_KEYS.has(s.split(':', 1)[0])) {
      const idx = s.indexOf(':');
      const key = s.slice(0, idx).trim();
      curParam.attrs[key] = s.slice(idx + 1).trim();
      if (key === 'Value') {
        const len = parseInt(curParam.attrs.Length || '1', 10);
        expectMulti = Number.isFinite(len) && len > 1 ? len - 1 : 0;
      } else {
        expectMulti = 0;
      }
    } else if (curParam && curGroup && expectMulti > 0 && s && !/^[A-Za-z_]\w*:/.test(s)) {
      curParam.multiValues.push(s);
      expectMulti -= 1;
    } else if (curGroup && !curParam && s.includes(':')) {
      const idx = s.indexOf(':');
      const key = s.slice(0, idx).trim();
      if (key !== 'PARAMETER') curGroup.attrs[key] = s.slice(idx + 1).trim();
    }
    i += 1;
  }

  flushParam();
  if (curGroup) doc.groups.push(curGroup);
  return indexDocument(doc);
}

export function effectiveValue(param) {
  const v = param.attrs.Value;
  if (v === '' || v === undefined) return param.attrs.ValuePrev || '';
  return v;
}

export function displayValue(param) {
  const v = effectiveValue(param);
  if (param.multiValues.length) return [v, ...param.multiValues].map((x) => x.trim()).join(' / ');
  return v;
}

export function isVolatile(groupName, param) {
  const desc = param.attrs.Desc || '';
  const nameLc = `${param.name} ${desc}`.toLowerCase();
  if (VOLATILE_GROUP_PREFIXES.some((p) => groupName.startsWith(p))) return true;
  if (VOLATILE_PARAM_PREFIXES.some((p) => param.name.startsWith(p))) return true;
  if (VOLATILE_PARAM_NAMES.has(param.name)) return true;
  if (nameLc.includes('counter') || nameLc.includes('cntr')) return true;
  if (param.name === 'Time' || param.name === 'Date' || nameLc.includes('time of day')) return true;
  if (param.name.includes('rmsMax') || param.name.includes('rmsMin')) return true;
  return false;
}

export function isRuntimeOnly(param) {
  const access = (param.attrs.Access || '').trim();
  const parts = access.split(/\s+/).filter(Boolean);
  if (!parts.length) return true;
  if (parts[0] !== 'R') return true;
  if (parts.length === 1) return true;
  if (parts[1] === '-' || parts[1] === '_') return true;
  return false;
}

export function categorizeGroup(group) {
  for (const [prefix, value] of Object.entries(GROUP_CATEGORY)) {
    if (group.name.startsWith(prefix)) return { category: value[0], description: value[1] };
  }
  const name = `${group.name} ${group.attrs.Desc || ''}`.toLowerCase();
  if (name.includes('prot') || name.includes('overcurrent') || name.includes('fault')) {
    return { category: 'Protection', description: 'Protection settings' };
  }
  if (name.includes('comm') || name.includes('modbus') || name.includes('ethernet')) {
    return { category: 'Communication', description: 'Communication settings' };
  }
  if (name.includes('logic') || name.includes('matrix')) {
    return { category: 'Logic', description: 'Logic and matrix settings' };
  }
  if (name.includes('input') || name.includes('output') || name.includes('led')) {
    return { category: 'I/O', description: 'I/O and indication settings' };
  }
  return { category: 'Other', description: 'Other relay data' };
}

function indexDocument(doc) {
  const flat = [];
  for (const group of doc.groups) {
    const groupMeta = categorizeGroup(group);
    group.category = groupMeta.category;
    group.categoryDescription = groupMeta.description;
    for (const param of group.parameters) {
      const setting = !isVolatile(group.name, param) && !isRuntimeOnly(param);
      const row = {
        key: `${group.name}::${param.name}`,
        group: group.name,
        groupDesc: group.attrs.Desc || groupMeta.description,
        category: groupMeta.category,
        name: param.name,
        desc: param.attrs.Desc || '',
        value: displayValue(param),
        unit: param.attrs.Unit || '',
        range: param.attrs.Range || '',
        access: param.attrs.Access || '',
        volatile: isVolatile(group.name, param),
        runtimeOnly: isRuntimeOnly(param),
        setting
      };
      param._row = row;
      flat.push(row);
    }
  }
  doc.flat = flat;
  doc.settings = flat.filter((r) => r.setting);
  doc.runtime = flat.filter((r) => !r.setting);
  return doc;
}

export function diffDocuments(beforeDoc, afterDoc) {
  const beforeMap = new Map((beforeDoc?.flat || []).map((row) => [row.key, row]));
  const afterMap = new Map((afterDoc?.flat || []).map((row) => [row.key, row]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const diffs = [];
  for (const key of [...keys].sort()) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);
    if (!before && after) {
      diffs.push({ kind: 'added', ...after, before: '', after: after.value });
    } else if (before && !after) {
      diffs.push({ kind: 'removed', ...before, before: before.value, after: '' });
    } else if (before.value !== after.value) {
      diffs.push({
        kind: 'changed',
        ...after,
        before: before.value,
        after: after.value
      });
    }
  }
  return diffs;
}

export function analyzeEpzDiffs(diffs = []) {
  return diffs.map((diff) => {
    const text = `${diff.group} ${diff.name} ${diff.desc}`.toLowerCase();
    const beforeNum = numberFromValue(diff.before);
    const afterNum = numberFromValue(diff.after);
    let severity = 'INFO';
    let issue = 'Changed setting';
    let recommendation = 'Review the change against the approved protection setting sheet.';

    if (diff.kind === 'removed') {
      severity = 'WARN';
      issue = 'Setting removed';
      recommendation = 'Confirm the parameter is intentionally removed by firmware/model change, not lost during export/import.';
    } else if (text.includes('ip address') || text.includes('ethernet') || text.includes('modbus') || text.includes('communication')) {
      severity = 'WARN';
      issue = 'Communication setting changed';
      recommendation = 'Verify SCADA/BMS addressing, gateway mapping, and cyber/asset register before commissioning.';
    } else if (text.includes('ena') || text.includes('enable')) {
      if (String(diff.after).trim() === '0') {
        severity = 'CRITICAL';
        issue = 'Protection function disabled';
        recommendation = 'Do not energize until protection disable is justified by relay coordination and site MOC.';
      } else {
        severity = 'WARN';
        issue = 'Protection function enabled';
        recommendation = 'Confirm pickup/delay coordination for this newly enabled stage.';
      }
    } else if (Number.isFinite(beforeNum) && Number.isFinite(afterNum)) {
      const deltaPct = beforeNum === 0 ? 0 : ((afterNum - beforeNum) / Math.abs(beforeNum)) * 100;
      if (text.includes('delay') && afterNum < beforeNum) {
        severity = Math.abs(deltaPct) > 20 ? 'CRITICAL' : 'WARN';
        issue = 'Protection delay reduced';
        recommendation = 'Check selectivity margin with upstream/downstream devices before applying reduced trip delay.';
      } else if ((text.includes('start') || text.includes('pickup') || text.includes('threshold')) && afterNum < beforeNum) {
        severity = Math.abs(deltaPct) > 20 ? 'CRITICAL' : 'WARN';
        issue = 'Pickup threshold reduced';
        recommendation = 'Validate load inrush, transformer energization, motor start, and fault coordination margin.';
      } else if ((text.includes('start') || text.includes('pickup') || text.includes('threshold')) && afterNum > beforeNum) {
        severity = deltaPct > 20 ? 'WARN' : 'INFO';
        issue = 'Pickup threshold increased';
        recommendation = 'Confirm sensitivity remains adequate for minimum fault current and arc-flash assumptions.';
      }
    }

    return {
      severity,
      issue,
      category: diff.category,
      group: diff.group,
      name: diff.name,
      before: diff.before,
      after: diff.after,
      unit: diff.unit,
      delta: issue === 'Communication setting changed' ? '' : formatDelta(beforeNum, afterNum),
      recommendation
    };
  });
}

export function summarizeEpzCategories(doc) {
  const categories = new Map();
  for (const row of doc?.flat || []) {
    if (!categories.has(row.category)) {
      categories.set(row.category, {
        category: row.category,
        groups: new Set(),
        parameters: 0,
        settings: 0,
        runtime: 0
      });
    }
    const item = categories.get(row.category);
    item.groups.add(row.group);
    item.parameters += 1;
    if (row.setting) item.settings += 1;
    else item.runtime += 1;
  }
  return [...categories.values()]
    .map((item) => ({ ...item, groups: item.groups.size }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function summarizeEpzRisks(risks = []) {
  const bySeverity = { CRITICAL: 0, WARN: 0, INFO: 0 };
  const byIssue = new Map();
  for (const risk of risks) {
    bySeverity[risk.severity] = (bySeverity[risk.severity] || 0) + 1;
    byIssue.set(risk.issue, (byIssue.get(risk.issue) || 0) + 1);
  }
  return {
    bySeverity,
    byIssue: [...byIssue.entries()].map(([issue, count]) => ({ issue, count })).sort((a, b) => b.count - a.count)
  };
}

export function buildEpzProtectionMatrix(doc, diffs = []) {
  const risks = analyzeEpzDiffs(diffs);
  const riskByGroup = new Map();
  const changedByGroup = new Map();
  for (const diff of diffs || []) {
    changedByGroup.set(diff.group, (changedByGroup.get(diff.group) || 0) + 1);
  }
  for (const risk of risks) {
    const current = riskByGroup.get(risk.group);
    if (!current || severityRank(risk.severity) > severityRank(current.severity)) {
      riskByGroup.set(risk.group, risk);
    }
  }

  const groups = new Map();
  for (const row of doc?.settings || []) {
    if (row.category !== 'Protection' && !isProtectionLike(row)) continue;
    if (!groups.has(row.group)) {
      groups.set(row.group, {
        group: row.group,
        description: row.groupDesc,
        settings: [],
        enable: '',
        pickup: '',
        delay: '',
        curve: '',
        changed: 0,
        severity: 'INFO',
        recommendation: 'No high-risk diff rule triggered for this protection group.'
      });
    }
    groups.get(row.group).settings.push(row);
  }

  for (const item of groups.values()) {
    item.enable = bestRoleValue(item.settings, ['enable', 'ena', 'enabled']);
    item.pickup = bestRoleValue(item.settings, ['pickup', 'start', 'threshold']);
    item.delay = bestRoleValue(item.settings, ['delay', 'time', 'operate']);
    item.curve = bestRoleValue(item.settings, ['curve', 'characteristic', 'char']);
    item.changed = changedByGroup.get(item.group) || 0;
    const risk = riskByGroup.get(item.group);
    if (risk) {
      item.severity = risk.severity;
      item.recommendation = risk.recommendation;
    }
  }

  return [...groups.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.changed - a.changed || a.group.localeCompare(b.group));
}

function numberFromValue(value) {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function formatDelta(beforeNum, afterNum) {
  if (!Number.isFinite(beforeNum) || !Number.isFinite(afterNum)) return '';
  const delta = afterNum - beforeNum;
  const pct = beforeNum === 0 ? '' : ` (${((delta / Math.abs(beforeNum)) * 100).toFixed(1)}%)`;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}${pct}`;
}

export async function readEpzFile(file) {
  const text = decompressEpz(await file.arrayBuffer());
  return parseVampset(text, file.name);
}

function isProtectionLike(row) {
  const text = `${row.group} ${row.groupDesc} ${row.name} ${row.desc}`.toLowerCase();
  return text.includes('prot') || text.includes('overcurrent') || text.includes('fault') || text.includes('pickup') || text.includes('trip');
}

function bestRoleValue(rows, keywords) {
  const exact = rows.find((row) => keywords.some((keyword) => roleText(row).includes(keyword)));
  if (!exact) return '';
  return `${exact.name}: ${exact.value}${exact.unit ? ` ${exact.unit}` : ''}`;
}

function roleText(row) {
  return `${row.name} ${row.desc}`.toLowerCase();
}

function severityRank(severity) {
  return ({ CRITICAL: 3, WARN: 2, INFO: 1 })[severity] || 0;
}

export function epzWorkbookSheets(beforeDoc, afterDoc, diffs) {
  const activeDoc = afterDoc || beforeDoc;
  const risks = analyzeEpzDiffs(diffs);
  const categories = summarizeEpzCategories(activeDoc);
  const matrix = buildEpzProtectionMatrix(activeDoc, diffs);
  const summary = [
    ['Easergy P3 / eSetup EPZ Offline Report'],
    ['Source before', beforeDoc?.sourceName || ''],
    ['Source after', afterDoc?.sourceName || ''],
    ['Groups', activeDoc?.groups.length || 0],
    ['Settings rows', activeDoc?.settings.length || 0],
    ['Runtime rows filtered', activeDoc?.runtime.length || 0],
    ['Diff count', diffs?.length || 0],
    ['Critical risks', risks.filter((risk) => risk.severity === 'CRITICAL').length],
    ['Warnings', risks.filter((risk) => risk.severity === 'WARN').length],
    [],
    ['Note', 'Viewer only. Validate settings in official Schneider software before writing to relay.']
  ];
  const diffRows = [
    ['Kind', 'Category', 'Group', 'Parameter', 'Description', 'Before', 'After', 'Unit', 'Range', 'Access'],
    ...(diffs || []).map((d) => [d.kind, d.category, d.group, d.name, d.desc, d.before, d.after, d.unit, d.range, d.access])
  ];
  const configRows = [
    ['Category', 'Group', 'Parameter', 'Description', 'Value', 'Unit', 'Range', 'Access', 'Setting', 'Volatile'],
    ...(activeDoc?.flat || []).map((r) => [r.category, r.group, r.name, r.desc, r.value, r.unit, r.range, r.access, r.setting ? 'YES' : 'NO', r.volatile ? 'YES' : 'NO'])
  ];
  const groupRows = [
    ['Category', 'Group', 'Description', 'Parameters'],
    ...(activeDoc?.groups || []).map((g) => [g.category, g.name, g.attrs.Desc || g.categoryDescription, g.parameters.length])
  ];
  const riskRows = [
    ['Severity', 'Issue', 'Category', 'Group', 'Parameter', 'Before', 'After', 'Delta', 'Unit', 'Recommendation'],
    ...risks.map((risk) => [risk.severity, risk.issue, risk.category, risk.group, risk.name, risk.before, risk.after, risk.delta, risk.unit, risk.recommendation])
  ];
  const categoryRows = [
    ['Category', 'Groups', 'Parameters', 'Settings', 'Runtime / volatile', 'Interpretation'],
    ...categories.map((item) => [item.category, item.groups, item.parameters, item.settings, item.runtime, categoryInterpretation(item.category)])
  ];
  const matrixRows = [
    ['Severity', 'Group', 'Description', 'Settings', 'Changed rows', 'Enable', 'Pickup / threshold', 'Delay / operate time', 'Curve', 'Recommendation'],
    ...matrix.map((row) => [row.severity, row.group, row.description, row.settings.length, row.changed, row.enable, row.pickup, row.delay, row.curve, row.recommendation])
  ];
  return [
    { name: 'Summary', rows: summary, widths: [24, 80] },
    { name: 'Risk Review', rows: riskRows, widths: [12, 28, 18, 30, 26, 18, 18, 16, 10, 90] },
    { name: 'Category Summary', rows: categoryRows, widths: [18, 12, 12, 12, 18, 68] },
    { name: 'Protection Matrix', rows: matrixRows, widths: [12, 30, 42, 10, 12, 28, 28, 28, 20, 90] },
    { name: 'Diff', rows: diffRows, widths: [12, 18, 30, 26, 42, 28, 28, 10, 20, 12] },
    { name: 'Configuration', rows: configRows, widths: [18, 30, 26, 42, 28, 10, 20, 12, 10, 10] },
    { name: 'Groups Index', rows: groupRows, widths: [18, 32, 48, 12] }
  ];
}

function categoryInterpretation(category) {
  return ({
    Protection: 'Protection stages and enable/pickup/delay values need coordination review before applying.',
    Communication: 'SCADA/BMS addressing, gateway, and protocol mapping need site register validation.',
    Measurements: 'Runtime measurement values are evidence only, not settings for write-back.',
    'I/O': 'Digital input/output and indication mapping can affect trip/alarm wiring behavior.',
    Logic: 'Logic/matrix rows can change control behavior and should be reviewed against schematics.',
    Records: 'Event/fault/recorder rows are useful evidence but usually volatile/runtime.'
  })[category] || 'General relay configuration data.';
}
