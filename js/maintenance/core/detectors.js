export async function inspectFile(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  return inspectBytes(data, file.name || 'unnamed');
}

export function inspectBytes(data, fileName = '') {
  const lowerName = fileName.toLowerCase();
  const epz = inspectEpz(data, lowerName);
  const rpt = inspectGalaxyRpt(data, lowerName);
  const best = [epz, rpt].sort((a, b) => b.score - a.score)[0];
  if (best.score > 0) return best;
  return {
    fileName,
    bytes: data.length,
    format: 'Unknown',
    confidence: 'LOW',
    score: 0,
    evidence: ['No supported signature detected.'],
    warnings: ['Use official vendor software or add a detector before relying on this file.']
  };
}

function inspectEpz(data, lowerName) {
  const magic = data.length >= 3 && data[0] === 0x45 && data[1] === 0x50 && data[2] === 0x43;
  const ext = lowerName.endsWith('.epz');
  const score = (magic ? 80 : 0) + (ext ? 15 : 0) + (data.length > 30 ? 5 : 0);
  const evidence = [];
  const warnings = [];
  if (magic) evidence.push('EPC magic header present at byte 0.');
  if (ext) evidence.push('File extension is .epz.');
  if (data.length <= 30) warnings.push('File is very small for a compressed EPZ payload.');
  return {
    fileName: lowerName,
    bytes: data.length,
    format: 'Easergy P3 / VAMPSET EPZ',
    confidence: confidence(score),
    score,
    evidence,
    warnings
  };
}

function inspectGalaxyRpt(data, lowerName) {
  const ext = lowerName.endsWith('.rpt');
  const embeddedJsonRecords = countEmbeddedJsonRecords(data);
  const score = (embeddedJsonRecords > 0 ? 70 : 0) + (embeddedJsonRecords > 1 ? 10 : 0) + (ext ? 15 : 0);
  const evidence = [];
  const warnings = [];
  if (ext) evidence.push('File extension is .rpt.');
  if (embeddedJsonRecords) evidence.push(`${embeddedJsonRecords} embedded .JSON record marker(s) detected.`);
  if (ext && !embeddedJsonRecords) warnings.push('RPT extension exists, but no embedded .JSON/zlib record marker was detected.');
  return {
    fileName: lowerName,
    bytes: data.length,
    format: 'Schneider Galaxy VL RPT',
    confidence: confidence(score),
    score,
    evidence,
    warnings
  };
}

function countEmbeddedJsonRecords(data) {
  let count = 0;
  for (let offset = 0; offset < data.length - 12; offset += 1) {
    if (data[offset] !== 0x00 || data[offset + 1] !== 0x50) continue;
    const searchEnd = Math.min(offset + 512, data.length - 4);
    for (let i = offset + 1; i < searchEnd; i += 1) {
      if (data[i] === 0x2e && data[i + 1] === 0x4a && data[i + 2] === 0x53 && data[i + 3] === 0x4f && data[i + 4] === 0x4e) {
        count += 1;
        offset = i + 5;
        break;
      }
    }
  }
  return count;
}

function confidence(score) {
  if (score >= 85) return 'HIGH';
  if (score >= 55) return 'MEDIUM';
  return 'LOW';
}
