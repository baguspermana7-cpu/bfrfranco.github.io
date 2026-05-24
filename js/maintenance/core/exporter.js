export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 300);
}

export function safeSheetName(name) {
  return String(name || 'Sheet')
    .replace(/[\\/?*[\]:]/g, ' ')
    .slice(0, 31)
    .trim() || 'Sheet';
}

export function exportWorkbook(filename, sheets) {
  const bytes = createWorkbookBytes(sheets);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function createWorkbookBytes(sheets) {
  const usedNames = new Set();
  const normalized = sheets.map((sheet, index) => ({
    name: uniqueSheetName(sheet.name || `Sheet ${index + 1}`, usedNames),
    rows: sheet.rows || [[]],
    widths: sheet.widths || []
  }));
  const files = buildXlsxFiles(normalized);
  return zipStore(files);
}

function uniqueSheetName(name, usedNames) {
  const base = safeSheetName(name);
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const tail = ` ${suffix}`;
    candidate = `${base.slice(0, Math.max(1, 31 - tail.length))}${tail}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export function rowsToCsv(rows) {
  return rows.map((row) => row.map((cell) => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

export function exportCsv(filename, rows) {
  downloadBlob(new Blob(['\ufeff' + rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

function buildXlsxFiles(sheets) {
  const worksheetOverrides = sheets.map((_, idx) => `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const workbookSheets = sheets.map((sheet, idx) => `<sheet name="${xml(sheet.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`).join('');
  const workbookRels = sheets.map((_, idx) => `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`).join('');
  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${worksheetOverrides}
</Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${workbookSheets}</sheets>
</workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${workbookRels}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    {
      name: 'xl/styles.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`
    }
  ];
  sheets.forEach((sheet, idx) => {
    files.push({
      name: `xl/worksheets/sheet${idx + 1}.xml`,
      content: worksheetXml(sheet)
    });
  });
  return files;
}

function worksheetXml(sheet) {
  const cols = sheet.widths.length
    ? `<cols>${sheet.widths.map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${Math.max(6, Number(w) || 12)}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rows = sheet.rows.map((row, rowIdx) => {
    const r = rowIdx + 1;
    const cells = row.map((value, colIdx) => cellXml(value, colIdx + 1, r, rowIdx === 0)).join('');
    return `<row r="${r}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${cols}
<sheetData>${rows}</sheetData>
</worksheet>`;
}

function cellXml(value, col, row, header) {
  const ref = `${colName(col)}${row}`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${header ? ' s="1"' : ''}><v>${value}</v></c>`;
  }
  const text = String(value ?? '');
  return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ''}><is><t>${xml(text)}</t></is></c>`;
}

function colName(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;'
  }[c]));
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = dosDateTime(new Date());

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(now.time), u16(now.date),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
      nameBytes, data
    ]);
    localParts.push(local);
    centralParts.push(concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(now.time), u16(now.date),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes
    ]));
    offset += local.length;
  }

  const centralOffset = offset;
  const central = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(centralOffset), u16(0)
  ]);
  return concatBytes([...localParts, central, end]);
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  };
}

function u16(value) {
  const out = new Uint8Array(2);
  out[0] = value & 0xff;
  out[1] = (value >>> 8) & 0xff;
  return out;
}

function u32(value) {
  const out = new Uint8Array(4);
  out[0] = value & 0xff;
  out[1] = (value >>> 8) & 0xff;
  out[2] = (value >>> 16) & 0xff;
  out[3] = (value >>> 24) & 0xff;
  return out;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

let CRC_TABLE = null;
function crc32(data) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
