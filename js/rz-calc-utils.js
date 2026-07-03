/* rz-calc-utils.js — shared calculator production-hardening helpers.
 * Cross-cutting concern (M-303: one shared engine, not per-page hardcoded):
 * numeric-input validation with error states + a generic CSV exporter. Self-
 * contained (injects its own theme-aware CSS on load), zero dependencies, ES5.
 *
 * Usage:
 *   var res = RZCalc.validateNumbers([{id:'itLoad',label:'IT load'}, ...]);
 *   RZCalc.showErrors('myValidationBox', res.errors);   // toggles [hidden]
 *   if(!res.ok) return;                                 // skip compute on error
 *   RZCalc.downloadCSV('report.csv', ['Section,Field,Value,Unit,Note'], rows);
 */
(function () {
  if (window.RZCalc) return;

  // Inject minimal, theme-aware CSS once (works with any page's --*-primary theme).
  try {
    var s = document.createElement("style");
    s.id = "rz-calc-utils-css";
    s.textContent =
      ".rz-invalid{border-color:#ef4444!important;background:rgba(239,68,68,.06)!important}" +
      ".rz-calc-validation{margin:0 0 .75rem;padding:8px 12px;border:1px solid #ef4444;border-radius:8px;" +
      "background:rgba(239,68,68,.08);color:#b91c1c;font-size:.8rem;line-height:1.5}" +
      ".rz-calc-validation b{font-weight:700}" +
      '[data-theme="dark"] .rz-calc-validation{color:#fca5a5;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.5)}';
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {}

  function el(id) { return document.getElementById(id); }

  // fields: [{id, label, optional}]. Reads min/max from element attributes.
  // Marks offenders .rz-invalid + aria-invalid; returns {ok, errors:[{id,label,msg}]}.
  function validateNumbers(fields) {
    var errors = [];
    (fields || []).forEach(function (f) {
      var e = el(f.id); if (!e) return;
      e.classList.remove("rz-invalid"); e.removeAttribute("aria-invalid");
      var raw = (e.value || "").trim();
      if (raw === "" && f.optional) return;
      var v = parseFloat(raw);
      var min = e.hasAttribute("min") ? parseFloat(e.getAttribute("min")) : -Infinity;
      var max = e.hasAttribute("max") ? parseFloat(e.getAttribute("max")) : Infinity;
      var label = f.label || f.id;
      var bad = false;
      if (raw === "" || !isFinite(v)) { errors.push({ id: f.id, label: label, msg: label + " is required" }); bad = true; }
      else if (v < min || v > max) {
        var range = (isFinite(min) ? min : "?") + "–" + (isFinite(max) ? max : "?");
        errors.push({ id: f.id, label: label, msg: label + " must be " + range }); bad = true;
      }
      if (bad) { e.classList.add("rz-invalid"); e.setAttribute("aria-invalid", "true"); }
    });
    return { ok: errors.length === 0, errors: errors };
  }

  function showErrors(boxId, errors) {
    var box = el(boxId); if (!box) return;
    if (!errors || !errors.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = "<b>Check " + errors.length + " input" + (errors.length > 1 ? "s" : "") + ":</b> " +
      errors.map(function (er) { return er.msg; }).join(" · ");
    box.hidden = false;
  }

  function csvEscape(x) {
    x = String(x == null ? "" : x);
    return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x;
  }

  // header: array of raw header lines (strings). rows: array of arrays (cells).
  function downloadCSV(filename, header, rows) {
    var lines = (header || []).slice();
    (rows || []).forEach(function (r) {
      lines.push(r.map(function (c) { return csvEscape(c); }).join(","));
    });
    var blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename || "export.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.RZCalc = {
    validateNumbers: validateNumbers,
    showErrors: showErrors,
    csvEscape: csvEscape,
    downloadCSV: downloadCSV,
  };
})();
