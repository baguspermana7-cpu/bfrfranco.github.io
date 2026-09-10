/* ============================================================================
 * rz-pdf-export.js — one document shell for every PDF the site issues.
 * ----------------------------------------------------------------------------
 * Owner comment (22): "export to PDF with a mature template, partial or whole",
 * starting from cdu-checklist.html but required across all the engines.
 *
 * What this replaces, measured 2026-09-10: 24 pages offer a PDF. Twenty-one of them
 * are a bare `onclick="window.print()"` — no cover, no provenance, no section choice,
 * and whatever the screen stylesheet happens to do at print size. The remaining
 * three build a real document, and each builds it again from scratch:
 * datahallAI.html and dc-conventional.html carry their own exportTechSpecPdf /
 * exportBodPdf, and changelog.html its own. js/rz-design-studio.js already shares the
 * DIALOG half (document type, scope, note, snapshot, trace) and then hands off to a
 * per-page generate(); the document half was never shared. This is that half.
 *
 * The shell follows standarization/PDF_EXPORT_STANDARD.md rather than taste: its
 * palette is that document's table, its skeleton is that document's structure
 * template, and its footer is the line the standard prescribes. Where the standard is
 * explicit this module is not configurable — an accent colour is, a body text colour
 * is not, because the standard says in capitals never to set body text to the muted
 * greys and a shared shell is the place to make that impossible.
 *
 * PARTIAL OR WHOLE. buildDocument() takes the sections the caller wants and nothing
 * else. Section discovery is DOM-driven (discoverSections), so a page adopts this by
 * declaring which of its own elements are sections, not by maintaining a second list
 * that drifts from the page.
 *
 * THE ESCAPE RULE IS NOT OPTIONAL. standarization/PDF_EXPORT_STANDARD.md records the
 * 2026-05-09 incident where an unescaped `</script>` inside a JS-built print template
 * terminated the parent document's script block and broke five calculator pages. Every
 * string this module emits goes through escapeScript(), and the gate asserts callers
 * hand their section HTML through it too.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var VERSION = '1.1.0';   /* v1.1.0 adds adopt() */

  /* standarization/PDF_EXPORT_STANDARD.md "Color Palette". Body text is fixed at the
     primary ink on purpose: the standard bans the muted greys for body copy. */
  var PALETTE = {
    ink: '#1f2937',          /* body paragraphs, table cells */
    heading: '#1e3a5f',      /* h1, h2, section headers */
    subheading: '#374151',   /* h3, labels */
    secondary: '#6b7280',    /* captions, footnotes */
    muted: '#94a3b8',        /* methodology notes ONLY */
    tableHeadBg: '#f8fafc',
    tableBorder: '#e5e7eb',
    accentDefault: '#1e3a5f'
  };

  function isStr(x) { return typeof x === 'string'; }

  /* `</script>` inside a string that will be written into another document ends the
     PARENT script block, not the child's. See the 2026-05-09 incident in the standard. */
  function escapeScript(html) {
    return isStr(html) ? html.replace(/<\/script/gi, '<\\/script') : '';
  }

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function today(d) {
    var dt = d instanceof Date ? d : new Date();
    var m = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    return dt.getDate() + ' ' + m[dt.getMonth()] + ' ' + dt.getFullYear();
  }

  /* ---- section discovery ---------------------------------------------------
     A page declares its own sections in its own markup. The label is taken from the
     first heading inside, so a renamed heading renames the export option and the two
     cannot drift. */
  function discoverSections(rootEl, selector) {
    var doc = rootEl || (root.document && root.document.body);
    if (!doc || !doc.querySelectorAll) { return []; }
    var nodes = doc.querySelectorAll(selector || '[data-rz-doc-section]');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var id = el.getAttribute('data-rz-doc-section') || el.id;
      if (!id) { continue; }
      var declared = el.getAttribute('data-rz-doc-label');
      var head = el.querySelector('h2, h3, h1');
      var label = declared || (head ? head.textContent : id);
      out.push({ id: id, label: String(label).replace(/\s+/g, ' ').trim(), el: el });
    }
    return out;
  }

  /* ---- the document shell -------------------------------------------------- */
  function styleSheet(accent) {
    return '@page{margin:15mm}'
      + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.rzp-section{break-inside:auto}.rzp-section h2{break-after:avoid}'
      + 'table{break-inside:auto}tr{break-inside:avoid}}'
      + 'body{font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:0 auto;padding:36px;'
      + 'color:' + PALETTE.ink + ';font-size:11px;line-height:1.5}'
      + '.rzp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;'
      + 'border-bottom:2px solid ' + accent + ';padding-bottom:10px;margin-bottom:18px}'
      + '.rzp-head h1{margin:0 0 3px;font-size:18px;color:' + PALETTE.heading + '}'
      + '.rzp-sub{color:' + PALETTE.secondary + ';font-size:10px}'
      + '.rzp-brand{text-align:right;font-size:10px;color:' + PALETTE.secondary + ';white-space:nowrap}'
      + '.rzp-brand strong{display:block;font-size:11px;letter-spacing:.08em;color:' + PALETTE.heading + '}'
      + '.rzp-meta{width:100%;border-collapse:collapse;margin:0 0 18px}'
      + '.rzp-meta th,.rzp-meta td{border:1px solid ' + PALETTE.tableBorder + ';padding:4px 7px;text-align:left;vertical-align:top}'
      + '.rzp-meta th{background:' + PALETTE.tableHeadBg + ';color:' + PALETTE.subheading + ';font-weight:600;width:22%}'
      + '.rzp-section{margin:0 0 18px}'
      + '.rzp-section h2{margin:0 0 7px;font-size:13px;color:' + PALETTE.heading + ';'
      + 'border-left:3px solid ' + accent + ';padding-left:7px}'
      + '.rzp-section h3{margin:10px 0 4px;font-size:11px;color:' + PALETTE.subheading + '}'
      + '.rzp-section table{width:100%;border-collapse:collapse;margin:6px 0}'
      + '.rzp-section th,.rzp-section td{border:1px solid ' + PALETTE.tableBorder + ';padding:3px 6px;text-align:left}'
      + '.rzp-section th{background:' + PALETTE.tableHeadBg + ';color:' + PALETTE.subheading + '}'
      + '.rzp-section img,.rzp-section svg{max-width:100%;height:auto}'
      + '.rzp-omitted{margin:14px 0 0;padding:7px 9px;border:1px solid ' + PALETTE.tableBorder + ';'
      + 'background:' + PALETTE.tableHeadBg + ';color:' + PALETTE.secondary + ';font-size:9px}'
      + '.rzp-foot{margin-top:22px;padding-top:12px;border-top:2px solid ' + accent + ';'
      + 'text-align:center;font-size:9px;color:' + PALETTE.muted + '}';
  }

  /**
   * spec = {
   *   title, subtitle, accent, generatedAt,
   *   meta:      [[label, value], ...]     -> the provenance table
   *   sections:  [{ id, label, html }]     -> ONLY the ones the operator chose
   *   omitted:   [{ id, label }]           -> named on the page, so a partial export says so
   *   footerNote
   * }
   */
  function buildDocument(spec) {
    var s = spec || {};
    var accent = isStr(s.accent) && /^#[0-9a-fA-F]{3,8}$/.test(s.accent) ? s.accent : PALETTE.accentDefault;
    var date = isStr(s.generatedAt) ? s.generatedAt : today();
    var title = esc(s.title || 'ResistanceZero document');
    var out = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + title + ' — ' + esc(date) + '</title>'
      + '<style>' + styleSheet(accent) + '</style></head><body>';

    out += '<header class="rzp-head"><div><h1>' + title + '</h1>';
    if (s.subtitle) { out += '<div class="rzp-sub">' + esc(s.subtitle) + '</div>'; }
    out += '<div class="rzp-sub">' + esc(date) + '</div></div>'
      + '<div class="rzp-brand"><strong>RESISTANCEZERO</strong>resistancezero.com</div></header>';

    var meta = Array.isArray(s.meta) ? s.meta : [];
    if (meta.length) {
      out += '<table class="rzp-meta"><tbody>';
      for (var i = 0; i < meta.length; i++) {
        out += '<tr><th>' + esc(meta[i][0]) + '</th><td>' + esc(meta[i][1]) + '</td></tr>';
      }
      out += '</tbody></table>';
    }

    var sections = Array.isArray(s.sections) ? s.sections : [];
    for (var j = 0; j < sections.length; j++) {
      var sec = sections[j] || {};
      out += '<section class="rzp-section" id="' + esc(sec.id || ('s' + j)) + '">'
        + '<h2>' + esc(sec.label || '') + '</h2>'
        + escapeScript(isStr(sec.html) ? sec.html : '')
        + '</section>';
    }

    /* A partial export that does not say it is partial is a document that misleads the
       next reader. The omitted sections are named, not merely counted. */
    var omitted = Array.isArray(s.omitted) ? s.omitted : [];
    if (omitted.length) {
      var names = [];
      for (var k = 0; k < omitted.length; k++) { names.push(esc(omitted[k].label || omitted[k].id)); }
      out += '<p class="rzp-omitted">Partial export — ' + omitted.length + ' section'
        + (omitted.length === 1 ? '' : 's') + ' of this document were not selected and are not included here: '
        + names.join('; ') + '.</p>';
    }

    out += '<div class="rzp-foot">resistancezero.com &middot; Generated ' + esc(date)
      + ' &middot; All calculations performed client-side';
    if (s.footerNote) { out += ' &middot; ' + esc(s.footerNote); }
    out += '</div></body></html>';
    return escapeScript(out);
  }

  /* ---- printing ------------------------------------------------------------ */
  function open(html, opts) {
    var o = opts || {};
    var win = null;
    try { win = root.open('', '_blank'); } catch (e) { win = null; }
    if (!win) {
      if (typeof o.onBlocked === 'function') { o.onBlocked(); }
      return null;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    try { win.focus(); } catch (e2) {}
    root.setTimeout(function () { try { win.print(); } catch (e3) {} }, o.delay || 600);
    return win;
  }

  /* ---- adoption ------------------------------------------------------------
     Wiring a page used to mean ~60 lines of registration copied into it, which is how the site
     ended up with three hand-built PDF builders in the first place. adopt() is the whole of it:
     the page says which of its elements are sections and what its provenance is, and gets the
     dialog, the picker and the shell. Anything a page needs to say for itself — its title, its
     accent, what its numbers are and are not — stays a parameter, because that is the part a
     shared module must not invent. */
  function adopt(config) {
    var cfg = config || {};
    function sections() {
      return discoverSections(root.document, cfg.sectionSelector).map(function (sec) {
        return { id: sec.id, label: sec.label, selected: true };
      });
    }
    function snapshot() {
      var found = discoverSections(root.document, cfg.sectionSelector);
      var base = { 'Document': cfg.subtitle || cfg.title, 'Sections available': String(found.length) };
      var extra = typeof cfg.snapshot === 'function' ? cfg.snapshot(found) : (cfg.snapshot || {});
      for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) { base[k] = extra[k]; } }
      return base;
    }
    function generate(issue) {
      var found = discoverSections(root.document, cfg.sectionSelector);
      var byId = {};
      for (var i = 0; i < found.length; i++) { byId[found[i].id] = found[i]; }
      var chosen = (issue && issue.sections && issue.sections.length) ? issue.sections : found;
      var snap = snapshot(), meta = [];
      for (var key in snap) { if (Object.prototype.hasOwnProperty.call(snap, key)) { meta.push([key, snap[key]]); } }
      if (issue && issue.revisionNote) { meta.push(['Revision note', issue.revisionNote]); }
      var html = buildDocument({
        title: cfg.title,
        subtitle: cfg.subtitle,
        accent: cfg.accent,
        meta: meta,
        sections: chosen.map(function (choice) {
          var src = byId[choice.id];
          return { id: choice.id, label: choice.label || (src ? src.label : choice.id),
            html: src ? escapeScript(src.el.innerHTML) : '' };
        }),
        omitted: (issue && issue.omittedSections) || [],
        footerNote: cfg.footerNote
      });
      open(html, { onBlocked: function () {
        try { root.alert('Pop-up blocked \u2014 allow pop-ups for this site to export the PDF.'); } catch (e) {}
      } });
    }
    function register() {
      if (!root.RZDesignStudio || !root.document.getElementById(cfg.triggerId)) { return false; }
      root.RZDesignStudio.register({
        id: cfg.id, triggerId: cfg.triggerId,
        title: cfg.title + ' \u2014 PDF export',
        subtitle: cfg.dialogSubtitle || 'Issue the whole document, or only the sections you need.',
        provenance: cfg.provenance,
        documentTypes: cfg.documentTypes || ['technical-specification'],
        scopes: cfg.scopes || ['current'],
        sections: sections, snapshot: snapshot, generate: generate
      });
      return true;
    }
    if (!register()) { root.addEventListener('load', register); }
    return { sections: sections, snapshot: snapshot, generate: generate };
  }

  var API = {
    version: VERSION,
    adopt: adopt,
    PALETTE: PALETTE,
    escapeScript: escapeScript,
    discoverSections: discoverSections,
    buildDocument: buildDocument,
    open: open
  };
  if (Object.freeze) { Object.freeze(API); Object.freeze(PALETTE); }
  root.RZPdfExport = API;
}(typeof window !== 'undefined' ? window : this));
