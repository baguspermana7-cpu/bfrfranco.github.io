import { DEFAULT_DTSC_SETTINGS, buildDtscSequence, dtscWorkbookSheets } from './dtsc.js';

const FIELD_PATTERNS = [
  ['s1OutageDelay', ['s1 outage', 'source 1 outage', 'utility outage', 'outage timer s1', 'outage delay s1']],
  ['s2StartDelay', ['s2 start', 'source 2 start', 'generator start', 'genset start', 'start delay s2']],
  ['s2StableDelay', ['s2 stable', 'source 2 stable', 'generator stable', 'genset stable', 'stable timer s2']],
  ['transferDelayS1S2', ['transfer delay s1->s2', 'transfer delay s1 to s2', 's1 to s2 transfer delay', 'transfer pause s1->s2']],
  ['neutralTimeToS2', ['neutral timer s1->s2', 'neutral time to s2', 'neutral s1 to s2', 'delayed neutral to s2']],
  ['s1ReturnStableDelay', ['s1 return stable', 'source 1 return stable', 'utility return stable', 'stable timer s1']],
  ['transferDelayS2S1', ['transfer delay s2->s1', 'transfer delay s2 to s1', 's2 to s1 transfer delay', 'transfer pause s2->s1']],
  ['neutralTimeToS1', ['neutral timer s2->s1', 'neutral time to s1', 'neutral s2 to s1', 'delayed neutral to s1']],
  ['s2CooldownDelay', ['s2 cooldown', 'source 2 cooldown', 'generator cooldown', 'genset cooldown', 'cooldown timer s2']]
];

export async function readDtscImportFile(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) {
    const text = await extractPdfText(await file.arrayBuffer());
    return parseDtscText(text, file.name, 'pdf');
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = decodeMaybeText(bytes);
  if (text.printableRatio < 0.75) {
    return {
      sourceName: file.name,
      sourceType: 'binary',
      confidence: 'LOW',
      score: 10,
      settings: { ...DEFAULT_DTSC_SETTINGS },
      fields: [],
      warnings: [
        'File appears binary/proprietary. Provide 2-3 known-good exports plus screenshots/PDF reports to map the format safely.',
        'Simulator remains on default values until this binary format is reverse-mapped and validated.'
      ],
      evidence: ['Binary file accepted for inspection only; no setting values were applied.'],
      textPreview: ''
    };
  }
  return parseDtscText(text.text, file.name, 'text/config');
}

export async function extractPdfText(arrayBuffer) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error('PDF.js library not loaded — refresh the page.');
  // Worker is configured once in maintenance-decode-lab.html
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages.join('\n');
}

export function parseDtscText(text, sourceName = 'DTSC-200 export', sourceType = 'text') {
  const normalizedText = normalizeText(text);
  const settings = { ...DEFAULT_DTSC_SETTINGS };
  const fields = [];
  const warnings = [];
  const evidence = [];

  for (const [key, aliases] of FIELD_PATTERNS) {
    const match = findNumberForAliases(normalizedText, aliases);
    if (match) {
      settings[key] = match.value;
      fields.push({ key, label: labelForKey(key), value: match.value, unit: match.unit || 's', source: match.line });
    }
  }

  const transition = parseTransitionType(normalizedText);
  if (transition) {
    settings.transitionType = transition.value;
    fields.push({ key: 'transitionType', label: 'Transition type', value: transition.value, unit: '', source: transition.line });
  }

  const transferCommit = parseBooleanSetting(normalizedText, ['transfer commit', 'commit transfer']);
  if (transferCommit) {
    settings.transferCommit = transferCommit.value;
    fields.push({ key: 'transferCommit', label: 'Transfer commit', value: transferCommit.value ? 'YES' : 'NO', unit: '', source: transferCommit.line });
  }

  const scenario = inferScenario(normalizedText);
  const score = Math.min(100, 20 + fields.length * 9 + (normalizedText.includes('dtsc') ? 10 : 0) + (normalizedText.includes('woodward') ? 10 : 0));
  if (!fields.length) warnings.push('No DTSC-200 timer/transfer setting labels were recognized. Check whether the PDF is scanned or the export uses uncommon labels.');
  if (sourceType === 'pdf' && text.trim().length < 100) warnings.push('PDF yielded very little text. If it is scanned image PDF, OCR is required before precise parsing.');
  if (!fields.some((field) => field.key === 'transitionType')) warnings.push('Transition type was not found; delayed neutral default remains applied.');
  if (!fields.some((field) => field.key === 'transferCommit')) warnings.push('Transfer commit was not found; YES default remains applied.');

  evidence.push(`${fields.length} DTSC setting field(s) recognized.`);
  if (scenario) evidence.push(`Scenario inferred from text: ${scenario}.`);

  const sequence = buildDtscSequence(settings, scenario || 'fail-return');
  return {
    sourceName,
    sourceType,
    confidence: confidence(score),
    score,
    settings,
    scenario: scenario || 'fail-return',
    sequence,
    fields,
    warnings,
    evidence,
    textPreview: text.trim().slice(0, 1200)
  };
}

export function dtscImportWorkbookSheets(importResult) {
  if (!importResult) return [];
  return [
    {
      name: 'Import Evidence',
      widths: [24, 80],
      rows: [
        ['Source', importResult.sourceName],
        ['Source type', importResult.sourceType],
        ['Confidence', importResult.confidence],
        ['Score', importResult.score],
        ['Recognized fields', importResult.fields.length],
        ['Evidence', importResult.evidence.join(' ')],
        ['Warnings', importResult.warnings.join(' ')],
        ['Text preview', importResult.textPreview]
      ]
    },
    {
      name: 'Imported Settings',
      widths: [28, 18, 10, 90],
      rows: [
        ['Key', 'Value', 'Unit', 'Source line'],
        ...importResult.fields.map((field) => [field.label, field.value, field.unit, field.source])
      ]
    }
  ];
}

export function dtscWorkbookSheetsWithImport(sequence, importResult) {
  return [
    ...dtscImportWorkbookSheets(importResult),
    ...dtscWorkbookSheets(sequence)
  ];
}

function decodeMaybeText(bytes) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const printable = [...text].filter((char) => char === '\n' || char === '\r' || char === '\t' || (char >= ' ' && char !== '�')).length;
  return { text, printableRatio: text.length ? printable / text.length : 0 };
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function findNumberForAliases(text, aliases) {
  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!aliases.some((alias) => lower.includes(alias))) continue;
    const valueMatch = line.match(/(?:=|:|\s)\s*(-?\d+(?:\.\d+)?)\s*(ms|msec|milliseconds|s|sec|second|seconds|min|minute|minutes)?\b/i);
    if (!valueMatch) continue;
    let value = Number(valueMatch[1]);
    const unit = (valueMatch[2] || 's').toLowerCase();
    if (unit.startsWith('ms')) value /= 1000;
    if (unit.startsWith('min')) {
      // User requested accelerated simulation: displayed minutes may be simulated as seconds.
      value = Number(valueMatch[1]);
    }
    return { value, unit: unit.startsWith('min') ? 'displayed min -> sim s' : 's', line };
  }
  return null;
}

function parseTransitionType(text) {
  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!lower.includes('transition')) continue;
    if (lower.includes('closed')) return { value: 'closed', line };
    if (lower.includes('delayed') || lower.includes('neutral')) return { value: 'delayed', line };
    if (lower.includes('open')) return { value: 'open', line };
  }
  return null;
}

function parseBooleanSetting(text, aliases) {
  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!aliases.some((alias) => lower.includes(alias))) continue;
    if (/\b(yes|on|enabled|true|1)\b/i.test(line)) return { value: true, line };
    if (/\b(no|off|disabled|false|0)\b/i.test(line)) return { value: false, line };
  }
  return null;
}

function inferScenario(text) {
  const lower = text.toLowerCase();
  if (lower.includes('momentary')) return 'momentary';
  if (lower.includes('fail only') || lower.includes('no return')) return 'fail-only';
  return null;
}

function labelForKey(key) {
  return ({
    s1OutageDelay: 'S1 outage delay',
    s2StartDelay: 'S2 start delay',
    s2StableDelay: 'S2 stable delay',
    transferDelayS1S2: 'Transfer delay S1->S2',
    neutralTimeToS2: 'Neutral time to S2',
    s1ReturnStableDelay: 'S1 return stable',
    transferDelayS2S1: 'Transfer delay S2->S1',
    neutralTimeToS1: 'Neutral time to S1',
    s2CooldownDelay: 'S2 cooldown'
  })[key] || key;
}

function confidence(score) {
  if (score >= 75) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}
