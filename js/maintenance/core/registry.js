export const EQUIPMENT_MODULES = [
  {
    id: 'relay',
    family: 'Protection Relay',
    vendor: 'Schneider Electric',
    model: 'Easergy P3 / VAMPSET EPZ',
    navTitle: 'Relay EPZ',
    navSub: 'Easergy P3 setting decoder',
    icon: 'shield-check',
    route: 'relay',
    status: 'idle',
    formats: ['.epz'],
    capabilities: ['import', 'decode', 'filter', 'diff', 'xlsx', 'csv'],
    confidence: 'Implemented from local prototype plus eSetup Easergy Pro setting-file behavior.',
    safetyBoundary: 'Read-only. Do not write relay settings from this tool.',
    normalizedOutputs: ['header', 'groups', 'parameters', 'settings', 'runtime rows', 'before/after diffs']
  },
  {
    id: 'ups',
    family: 'UPS',
    vendor: 'Schneider Electric',
    model: 'Galaxy VL RPT',
    navTitle: 'UPS RPT',
    navSub: 'Galaxy VL report analyzer',
    icon: 'zap',
    route: 'ups',
    status: 'idle',
    formats: ['.rpt'],
    capabilities: ['import', 'decode', 'incident clustering', 'waveform visualization', 'xlsx'],
    confidence: 'Inferred from exported RPT sample structure: embedded .JSON filenames and zlib records.',
    safetyBoundary: 'Analysis only. Service-only data and official troubleshooting remain Schneider/vendor scope.',
    normalizedOutputs: ['records', 'incidents', 'waveforms', 'classifications', 'RMS statistics']
  },
  {
    id: 'ats',
    family: 'ATS Controller',
    vendor: 'Woodward',
    model: 'DTSC-200',
    navTitle: 'ATS Simulator',
    navSub: 'Woodward DTSC-200 sequence',
    icon: 'git-compare',
    route: 'ats',
    status: 'ok',
    formats: ['manual settings', 'text/config export', 'text-based PDF setting report', 'binary inspection only'],
    capabilities: ['import', 'setting translation', 'simulate', 'animate', 'timeline', 'xlsx'],
    confidence: 'Simulator is built from DTSC transfer timer behavior. Text/PDF import is label-based and auditable; proprietary binary requires sample-corpus mapping before values are trusted.',
    safetyBoundary: 'Training and planning model only. Not a certified ATS controller emulator.',
    normalizedOutputs: ['import evidence', 'settings', 'sequence events', 'sequence performance', 'current state', 'exportable timeline']
  }
];

export const CORE_TOOLS = [
  { id: 'overview', icon: 'activity', title: 'Overview', sub: 'Unified maintenance lab', status: 'ok' },
  ...EQUIPMENT_MODULES.map((m) => ({
    id: m.route,
    icon: m.icon,
    title: m.navTitle,
    sub: m.navSub,
    status: m.status
  })),
  { id: 'faq', icon: 'book-open', title: 'FAQ / Basis', sub: 'Scalable architecture notes', status: 'ok' }
];

export const FAQ_ITEMS = [
  {
    question: 'Kenapa dibuat modular?',
    answer: 'Agar relay, UPS, ATS, breaker trip unit, genset controller, dan future tools bisa ditambah sebagai module registry tanpa rewrite shell.'
  },
  {
    question: 'Apakah ini menggantikan software vendor?',
    answer: 'Tidak. Tool ini untuk offline decode, visualization, evidence export, dan simulation. Write-back/settings upload tetap harus divalidasi dengan software vendor dan prosedur site.'
  },
  {
    question: 'Apa format yang sudah didukung?',
    answer: 'Easergy P3 EPZ dengan EPC + raw deflate payload, Galaxy VL RPT berbasis sequence zlib-compressed JSON records, dan DTSC-200 ATS simulator dengan import text/config atau PDF setting report yang masih berbasis ekstraksi teks.'
  },
  {
    question: 'Apakah file asli DTSC-200 bisa diterjemahkan akurat?',
    answer: 'Bisa akurat untuk export text/config atau PDF yang teksnya bisa diekstrak karena setiap field disimpan bersama source line dan confidence score. Untuk binary/proprietary export, tool hanya melakukan inspection sampai ada 2-3 sample known-good plus screenshot/PDF pembanding untuk membuat mapping format yang valid.'
  },
  {
    question: 'Bagaimana scalability backend/frontend?',
    answer: 'Core parser berada di src/core sebagai domain services. UI hanya membaca normalized output. CLI validator memakai core yang sama sehingga nanti local backend batch parser bisa ditambah tanpa mengubah kontrak data UI.'
  },
  {
    question: 'Bagaimana import file BIN UPS lain?',
    answer: 'Module baru bisa ditambah dengan detector signature, parser binary, normalized records, visualizer, dan exporter. Jika format proprietary tidak terdokumentasi, parser harus berbasis sample corpus dan validation matrix.'
  },
  {
    question: 'Apa yang dimaksud backend-style CLI?',
    answer: 'Script di folder scripts bisa membuat sample fixture, menjalankan parser core di Node, dan menghasilkan workbook valid. Ini menjadi fondasi batch decode folder dan backend lokal berikutnya.'
  },
  {
    question: 'Bagaimana FAQ field maintenance dipakai?',
    answer: 'FAQ ini akan bertambah per equipment: supported files, how-to export dari equipment, known limitations, alarm interpretation, and safety boundary.'
  }
];

export const MODULE_CONTRACT = [
  ['detect(file)', 'vendor/model/format confidence'],
  ['decode(file)', 'normalized domain records'],
  ['visualize(records)', 'table, mimic, chart, inspector'],
  ['simulate(settings)', 'timeline/state machine when applicable'],
  ['export(records)', 'Excel sheets and audit notes'],
  ['validate(fixtures)', 'repeatable parser and workbook checks']
];
