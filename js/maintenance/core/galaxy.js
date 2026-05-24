const { inflate } = (typeof window !== 'undefined' && window.pako) || (typeof globalThis !== 'undefined' && globalThis.pako) || {};

function decodeUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

export function decodeGalaxyRpt(data) {
  const records = [];
  let offset = 0;
  const n = data.length;

  while (offset < n) {
    if (data[offset] === 0x00 && offset + 1 < n && data[offset + 1] === 0x50) {
      let dotJsonAt = -1;
      const searchEnd = Math.min(offset + 512, n - 4);
      for (let i = offset + 1; i < searchEnd; i += 1) {
        if (data[i] === 0x2e && data[i + 1] === 0x4a && data[i + 2] === 0x53 && data[i + 3] === 0x4f && data[i + 4] === 0x4e) {
          dotJsonAt = i + 5;
          break;
        }
      }
      if (dotJsonAt < 0) {
        offset += 1;
        continue;
      }
      if (dotJsonAt + 8 > n) break;
      const view = new DataView(data.buffer, data.byteOffset + dotJsonAt, 8);
      const uncompressedSize = view.getUint32(0, true);
      const compressedSize = view.getUint32(4, true);
      const zlibStart = dotJsonAt + 8;
      if (zlibStart + compressedSize > n) break;
      const filename = decodeUtf8(data.subarray(offset + 1, dotJsonAt));
      try {
        const inflated = inflate(data.subarray(zlibStart, zlibStart + compressedSize));
        if (uncompressedSize && Math.abs(inflated.length - uncompressedSize) > 16) {
          console.warn('Galaxy RPT record size mismatch', { filename, expected: uncompressedSize, actual: inflated.length });
        }
        const json = JSON.parse(decodeUtf8(inflated));
        const codeMatch = filename.match(/_(0x[0-9A-F]+)\.JSON/i);
        records.push({
          filename,
          event_id: codeMatch ? codeMatch[1] : null,
          event_time: json.Event?.Time || '',
          object_id: json.Event?.ObjectID || '',
          serial_number: json.Event?.['Serial Number'] || '',
          num_waveforms: json.Event?.NumOfWaveforms || 0,
          waveforms: json.Waveforms || [],
          raw: json
        });
      } catch (error) {
        console.warn('Failed to decode Galaxy RPT record', { offset, error });
      }
      offset = zlibStart + compressedSize;
      continue;
    }
    offset += 1;
  }
  return records;
}

export async function readGalaxyRptFile(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const records = decodeGalaxyRpt(data);
  const incidents = clusterRecords(records, 30);
  return { fileName: file.name, records, incidents };
}

export function computeStats(record) {
  const out = {};
  for (const waveform of record.waveforms || []) {
    const waveformType = waveform.WaveformType || 'Waveform';
    for (const dataSet of waveform.DataSets || []) {
      const label = dataSet.Label || '';
      const y = dataSet.Y || [];
      if (!y.length) continue;
      const count = y.length;
      const mean = y.reduce((sum, value) => sum + value, 0) / count;
      const rms = Math.sqrt(y.reduce((sum, value) => sum + value * value, 0) / count);
      let peakMax = y[0];
      let peakMin = y[0];
      for (const value of y) {
        if (value > peakMax) peakMax = value;
        if (value < peakMin) peakMin = value;
      }
      out[`${waveformType}_${label}`] = {
        rms,
        mean,
        peak_max: peakMax,
        peak_min: peakMin,
        pp: peakMax - peakMin,
        crest_factor: rms ? Math.max(Math.abs(peakMax), Math.abs(peakMin)) / rms : 0,
        samples: count
      };
    }
  }
  return out;
}

export function classifyEvent(record) {
  const stats = computeStats(record);
  const tags = [];
  let severity = 'INFO';
  const rms = (key) => (stats[key] || {}).rms || 0;
  const mains = [rms('Mains1Vol_L1'), rms('Mains1Vol_L2'), rms('Mains1Vol_L3')];
  const output = [rms('OutUpsVol_L1'), rms('OutUpsVol_L2'), rms('OutUpsVol_L3')];
  const current = [rms('OutUpsCur_L1'), rms('OutUpsCur_L2'), rms('OutUpsCur_L3')];
  const battPos = rms('BattVol_Pos');
  const battNeg = rms('BattVol_Neg');
  const ground = rms('GndVol_DC');
  const metrics = powerQualityMetrics({ mains, output, current, battPos, battNeg, ground, stats });

  const mainsPresent = Math.max(...mains) > 50;
  const mainsImbalance = mainsPresent ? Math.max(...mains) - Math.min(...mains) : 0;
  const mainsLow = mainsPresent && mains.some((v) => v > 0 && v < 200);
  const mainsLost = mainsPresent && mains.some((v) => v < 30);
  const mainsTotalLoss = Math.max(...mains) < 30;
  const outputOk = output.every((v) => v > 220);
  const outputDropped = Math.max(...output) < 30;
  const outputPartial = !outputOk && !outputDropped;
  const battOk = battPos > 270 && battPos < 320 && battNeg > 270 && battNeg < 320;
  const battLow = battPos < 270 && battPos > 50;
  const battOff = battPos < 30;
  const battDischarge = battOk && (mainsLost || mainsLow || mainsTotalLoss) && outputOk;
  const onLoad = Math.max(...current) > 20;
  const groundHigh = ground > 5;

  if (mainsTotalLoss) {
    tags.push('MAINS_TOTAL_LOSS');
    severity = 'CRITICAL';
  } else if (mainsLost) {
    tags.push('MAINS_PHASE_LOSS');
    severity = 'CRITICAL';
  } else if (mainsImbalance > 35) {
    tags.push('MAINS_IMBALANCE');
    severity = 'WARN';
  } else if (mainsLow) {
    tags.push('MAINS_UNDERVOLTAGE');
    severity = 'WARN';
  }
  if (outputDropped) {
    tags.push('OUTPUT_LOST');
    severity = 'CRITICAL';
  } else if (outputPartial) {
    tags.push('OUTPUT_DEGRADED');
    severity = 'CRITICAL';
  } else if (outputOk) {
    tags.push('OUTPUT_OK');
  }
  if (battOff) {
    tags.push('BATTERY_OFFLINE');
    severity = 'CRITICAL';
  } else if (battLow) {
    tags.push('BATTERY_LOW');
    if (severity === 'INFO') severity = 'WARN';
  }
  if (groundHigh) {
    tags.push('GND_DISTURBANCE');
    if (severity === 'INFO') severity = 'WARN';
  }
  if (battDischarge) tags.push('BATTERY_DISCHARGE');
  if (onLoad) tags.push('ON_LOAD');

  const notes = [];
  if (mainsTotalLoss) notes.push('Mains input absent on all phases.');
  else if (mainsLost) notes.push(`Mains phase loss: ${format3(mains)} V RMS.`);
  else if (mainsImbalance > 35) notes.push(`Mains imbalance: ${format3(mains)} V RMS, delta ${mainsImbalance.toFixed(0)} V.`);
  else if (mainsLow) notes.push(`Mains undervoltage: ${format3(mains)} V RMS.`);
  if (outputOk) notes.push(`UPS output nominal: ${format3(output)} V RMS.`);
  else if (outputDropped) notes.push('UPS output dropped below 30 V RMS.');
  else if (outputPartial) notes.push(`UPS output degraded: ${format3(output)} V RMS.`);
  if (battDischarge) notes.push(`Battery supporting load, DC bus approx +/-${battPos.toFixed(0)} V.`);
  else if (battLow) notes.push(`Battery voltage low: +/-${battPos.toFixed(0)} V.`);
  else if (battOff) notes.push('Battery appears offline in the captured waveform.');
  if (onLoad) notes.push(`Load current present: ${format3(current)} A RMS.`);
  if (groundHigh) notes.push(`DC ground disturbance: ${ground.toFixed(1)} V RMS.`);

  const recommendations = maintenanceRecommendations({ tags, metrics, severity });

  return { severity, tags, notes: notes.join(' '), recommendations, metrics, stats, mains, output, current, battPos, battNeg, ground };
}

export function deriveGalaxyPowerFlow(classification) {
  if (!classification) return null;
  const tags = classification.tags || [];
  const outputOk = tags.includes('OUTPUT_OK');
  const outputLost = tags.includes('OUTPUT_LOST') || tags.includes('OUTPUT_DEGRADED');
  const mainsBad = tags.includes('MAINS_TOTAL_LOSS') || tags.includes('MAINS_PHASE_LOSS');
  const mainsWarn = tags.includes('MAINS_UNDERVOLTAGE') || tags.includes('MAINS_IMBALANCE');
  const batteryBad = tags.includes('BATTERY_OFFLINE') || tags.includes('BATTERY_LOW');
  const batteryDischarge = tags.includes('BATTERY_DISCHARGE');
  const onLoad = tags.includes('ON_LOAD');
  return {
    mains: {
      label: 'Mains input',
      state: mainsBad ? 'LOST' : mainsWarn ? 'DEGRADED' : 'AVAILABLE',
      tone: mainsBad ? 'crit' : mainsWarn ? 'warn' : 'ok',
      value: `${format3(classification.mains)} V RMS`
    },
    rectifier: {
      label: 'Rectifier / charger',
      state: mainsBad ? 'NOT SUPPLIED' : mainsWarn ? 'VERIFY' : 'SUPPLIED',
      tone: mainsBad ? 'warn' : mainsWarn ? 'warn' : 'ok',
      value: mainsBad ? 'Input unavailable' : 'Input present'
    },
    dcBus: {
      label: 'DC bus',
      state: batteryBad ? 'ABNORMAL' : batteryDischarge ? 'DISCHARGE SUPPORT' : 'NORMAL',
      tone: batteryBad ? 'crit' : batteryDischarge ? 'warn' : 'ok',
      value: `+${classification.battPos.toFixed(0)} / -${classification.battNeg.toFixed(0)} V`
    },
    inverter: {
      label: 'Inverter output',
      state: outputOk ? 'ONLINE' : outputLost ? 'LOAD IMPACT' : 'VERIFY',
      tone: outputOk ? 'ok' : 'crit',
      value: `${format3(classification.output)} V RMS`
    },
    load: {
      label: 'Load',
      state: onLoad ? 'ON LOAD' : 'LIGHT / NO LOAD',
      tone: outputOk && onLoad ? 'ok' : outputLost ? 'crit' : 'idle',
      value: `${format3(classification.current)} A RMS`
    }
  };
}

export function summarizeGalaxyReport(decoded) {
  const records = decoded?.records || [];
  const incidents = decoded?.incidents || [];
  const first = records[0];
  const last = records[records.length - 1];
  return {
    fileName: decoded?.fileName || '',
    records: records.length,
    incidents: incidents.length,
    serial: first?.serial_number || '',
    start: first?.event_time || '',
    end: last?.event_time || '',
    confidence: records.length ? 'HIGH' : 'LOW',
    method: records.length ? 'Embedded .JSON records with zlib payloads decoded' : 'No valid waveform record decoded'
  };
}

function format3(values) {
  return values.map((v) => v.toFixed(0)).join('/');
}

export function powerQualityMetrics({ mains, output, current, battPos, battNeg, ground, stats }) {
  const nominalOutput = 230;
  const outputAvg = average(output);
  const mainsAvg = average(mains);
  const currentAvg = average(current);
  return {
    nominalOutput,
    mainsAvg,
    outputAvg,
    currentAvg,
    mainsImbalancePct: imbalancePct(mains),
    outputImbalancePct: imbalancePct(output),
    currentImbalancePct: imbalancePct(current),
    outputRegulationPct: outputAvg ? ((outputAvg - nominalOutput) / nominalOutput) * 100 : 0,
    batterySymmetryPct: average([battPos, battNeg]) ? (Math.abs(battPos - battNeg) / average([battPos, battNeg])) * 100 : 0,
    groundRms: ground,
    currentCrestFactorMax: Math.max(
      stats.OutUpsCur_L1?.crest_factor || 0,
      stats.OutUpsCur_L2?.crest_factor || 0,
      stats.OutUpsCur_L3?.crest_factor || 0
    )
  };
}

function maintenanceRecommendations({ tags, metrics, severity }) {
  const items = [];
  if (tags.includes('MAINS_TOTAL_LOSS')) items.push('Correlate with utility incomer breaker, ATS status, upstream MV/LV feeder event, and UPS on-battery log.');
  if (tags.includes('MAINS_PHASE_LOSS')) items.push('Check phase fuse/MCB, input contactor, terminal torque, and phase voltage at UPS input.');
  if (tags.includes('MAINS_IMBALANCE')) items.push('Measure phase-to-phase and phase-to-neutral voltage under load; inspect loose neutral or upstream imbalance.');
  if (tags.includes('OUTPUT_LOST') || tags.includes('OUTPUT_DEGRADED')) items.push('Treat as load-impacting event: compare bypass/static switch state, output breaker status, and downstream PDU alarms.');
  if (tags.includes('BATTERY_DISCHARGE')) items.push('Review battery runtime, DC bus voltage trend, battery age, and charger status after mains recovery.');
  if (tags.includes('BATTERY_LOW') || tags.includes('BATTERY_OFFLINE')) items.push('Inspect battery breaker/fuse, string voltage, battery communication, and pending battery self-test alarms.');
  if (metrics.outputImbalancePct > 3) items.push('Output voltage imbalance above 3%; verify load distribution and downstream phase loading.');
  if (metrics.currentImbalancePct > 20) items.push('Current imbalance above 20%; compare rack/PDU phase distribution and single-phase load concentration.');
  if (metrics.groundRms > 5) items.push('Investigate DC ground disturbance and insulation monitoring before clearing the event as nuisance.');
  if (!items.length && severity === 'INFO') items.push('Waveform values look nominal; archive the report and correlate with site alarm history.');
  return items;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function imbalancePct(values) {
  const avg = average(values.filter((value) => value > 0));
  if (!avg) return 0;
  return ((Math.max(...values) - Math.min(...values)) / avg) * 100;
}

export function clusterRecords(records, gapSeconds = 30) {
  const sorted = [...records].sort((a, b) => String(a.event_time).localeCompare(String(b.event_time)));
  const clusters = [];
  let current = [];
  let lastT = null;
  for (const record of sorted) {
    const t = new Date(record.event_time).getTime() / 1000;
    if (lastT === null || !Number.isFinite(t) || t - lastT <= gapSeconds) {
      current.push(record);
    } else {
      if (current.length) clusters.push(current);
      current = [record];
    }
    lastT = t;
  }
  if (current.length) clusters.push(current);
  return clusters;
}

export function galaxyWorkbookSheets(decoded) {
  const records = decoded?.records || [];
  const incidents = decoded?.incidents || [];
  const evidence = summarizeGalaxyReport(decoded);
  const summaryRows = [
    ['Galaxy VL UPS Report Analysis'],
    ['File', evidence.fileName],
    ['Records', evidence.records],
    ['Incidents', evidence.incidents],
    ['UPS serial', evidence.serial],
    ['Date start', evidence.start],
    ['Date end', evidence.end],
    ['Parser confidence', evidence.confidence],
    ['Decode method', evidence.method],
    [],
    ['Note', 'Viewer only. RPT format is inferred from exported report structure and must be validated against Schneider service tools.']
  ];
  const incidentRows = [
    ['#', 'Start Time', 'Records', 'Severity', 'Tags', 'Narrative', 'Recommendations', 'Mains L1/L2/L3 V', 'Output L1/L2/L3 V', 'Output Imbalance %', 'Current L1/L2/L3 A', 'Current Imbalance %', 'Batt+ V', 'Batt Symmetry %', 'Ground V'],
    ...incidents.map((cluster, idx) => {
      const c = classifyEvent(cluster[0]);
      return [
        idx + 1,
        cluster[0]?.event_time || '',
        cluster.length,
        c.severity,
        c.tags.join(', '),
        c.notes,
        c.recommendations.join(' '),
        format3(c.mains),
        format3(c.output),
        c.metrics.outputImbalancePct.toFixed(2),
        format3(c.current),
        c.metrics.currentImbalancePct.toFixed(2),
        c.battPos.toFixed(1),
        c.metrics.batterySymmetryPct.toFixed(2),
        c.ground.toFixed(2)
      ];
    })
  ];
  const recordRows = [
    ['Time', 'Event ID', 'Object ID', 'Serial', 'Severity', 'Tags', 'Waveforms', 'Mains V', 'Mains Imbalance %', 'Output V', 'Output Regulation %', 'Output Imbalance %', 'Current A', 'Current Imbalance %', 'Current Crest Factor Max', 'Batt+ V', 'Batt- V', 'Batt Symmetry %', 'Ground V'],
    ...records.map((record) => {
      const c = classifyEvent(record);
      return [
        record.event_time,
        record.event_id,
        record.object_id,
        record.serial_number,
        c.severity,
        c.tags.join(', '),
        record.num_waveforms,
        format3(c.mains),
        c.metrics.mainsImbalancePct.toFixed(2),
        format3(c.output),
        c.metrics.outputRegulationPct.toFixed(2),
        c.metrics.outputImbalancePct.toFixed(2),
        format3(c.current),
        c.metrics.currentImbalancePct.toFixed(2),
        c.metrics.currentCrestFactorMax.toFixed(2),
        c.battPos.toFixed(1),
        c.battNeg.toFixed(1),
        c.metrics.batterySymmetryPct.toFixed(2),
        c.ground.toFixed(2)
      ];
    })
  ];
  const powerRows = [
    ['Incident', 'Block', 'State', 'Tone', 'Value', 'Basis'],
    ...incidents.flatMap((cluster, idx) => {
      const c = classifyEvent(cluster[0]);
      const flow = deriveGalaxyPowerFlow(c);
      return Object.values(flow).map((block) => [idx + 1, block.label, block.state, block.tone, block.value, c.notes]);
    })
  ];
  const waveformRows = [
    ['Record Time', 'Waveform', 'Channel', 'RMS', 'Mean', 'Peak Max', 'Peak Min', 'Peak-to-peak', 'Crest Factor', 'Samples'],
    ...records.flatMap((record) => {
      const stats = computeStats(record);
      return Object.entries(stats).map(([key, value]) => {
        const split = key.split('_');
        return [
          record.event_time,
          split[0] || '',
          split.slice(1).join('_') || '',
          value.rms.toFixed(3),
          value.mean.toFixed(3),
          value.peak_max.toFixed(3),
          value.peak_min.toFixed(3),
          value.pp.toFixed(3),
          value.crest_factor.toFixed(3),
          value.samples
        ];
      });
    })
  ];
  return [
    { name: 'Summary', rows: summaryRows, widths: [24, 80] },
    { name: 'Incidents', rows: incidentRows, widths: [8, 22, 10, 12, 42, 80, 90, 18, 18, 16, 18, 16, 12, 16, 12] },
    { name: 'Power Flow', rows: powerRows, widths: [10, 24, 18, 10, 24, 90] },
    { name: 'Waveform Stats', rows: waveformRows, widths: [22, 20, 14, 14, 14, 14, 14, 14, 14, 10] },
    { name: 'Records', rows: recordRows, widths: [22, 12, 16, 18, 12, 42, 10, 18, 16, 18, 16, 16, 18, 16, 18, 12, 12, 16, 12] }
  ];
}
