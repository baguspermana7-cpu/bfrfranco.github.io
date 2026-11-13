/* replay-worker.js — PRD-P05 FR-P05-2: parse a trend file off the UI thread.
   in  {type:'parse', text, name, timeColumn?}
   out {type:'progress', pct} … {type:'parsed', result} | {type:'error', line, message, code?, candidates?} */
/* global importScripts, self */
importScripts('replay-core.js');
self.onmessage = function (e) {
  var m = e.data || {};
  if (m.type !== 'parse') { return; }
  self.postMessage({ type: 'progress', pct: 10 });
  var r;
  try { r = self.RZDatahallAIReplay.parse(m.text, { name: m.name, timeColumn: m.timeColumn }); }
  catch (err) { r = { ok: false, line: 0, message: 'Cannot read the file: ' + String(err && err.message).slice(0, 120) }; }
  self.postMessage({ type: 'progress', pct: 100 });
  if (!r.ok) { self.postMessage({ type: 'error', line: r.line, message: r.message, code: r.code, candidates: r.candidates }); return; }
  self.postMessage({ type: 'parsed', result: r });
};
