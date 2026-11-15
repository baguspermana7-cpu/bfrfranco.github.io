/**
 * tab-loader.js — load a datahallAI tab's modules on first use (PRD-P09 FR-P09-2). ES5, dual-target (Node gate + browser).
 *
 *   RZDatahallTabLoader.create(registry, io) -> loader
 *     registry = { tabId: [script url, ...] }           modules of a tab, loaded in this order
 *     io       = { load(url) -> Promise, dispatch(name, detail) }   default: <script> injection + document CustomEvent
 *   loader.ensureTab(id) -> Promise    single flight per tab; resolves when every module loaded, then dispatches
 *                                      'rz:tab-ready' {id}. A failure rejects, dispatches 'rz:tab-error' {id, url, message}
 *                                      and is NOT cached: the next call retries (urls that already loaded are not refetched).
 *   loader.isReady(id), loader.tabs()
 * Gates wait for 'rz:tab-ready' (tools/lib/cockpit-tabs.mjs activateTab, FR-P09-6), never for a timer.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RZDatahallTabLoader = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  function browserIO() {
    var doc = root && root.document;
    return {
      load: function (url) {
        return new Promise(function (res, rej) {
          var s = doc.createElement('script');
          s.src = url; s.async = false;
          s.onload = function () { res(); };
          s.onerror = function () { if (s.parentNode) s.parentNode.removeChild(s); rej(new Error('failed to load ' + url)); };
          doc.head.appendChild(s);
        });
      },
      dispatch: function (name, detail) {
        var ev;
        try { ev = new root.CustomEvent(name, { detail: detail }); } catch (e) { ev = doc.createEvent('CustomEvent'); ev.initCustomEvent(name, false, false, detail); }
        doc.dispatchEvent(ev);
      }
    };
  }

  function create(registry, io) {
    io = io || browserIO();
    var inflight = {}, ready = {}, loaded = {};
    function loadUrl(url) {
      if (loaded[url]) return loaded[url];
      var p = io.load(url);
      loaded[url] = p;
      p.then(null, function () { if (loaded[url] === p) delete loaded[url]; });
      return p;
    }
    function ensureTab(id) {
      if (!Object.prototype.hasOwnProperty.call(registry, id)) return Promise.reject(new Error('unknown tab "' + id + '"'));
      if (inflight[id]) return inflight[id];
      var urls = registry[id].slice(), i = 0, failedUrl = null;
      var p = new Promise(function (res, rej) {
        function next() {
          if (i >= urls.length) return res();
          var u = urls[i++];
          loadUrl(u).then(next, function (e) { failedUrl = u; rej(e); });
        }
        next();
      }).then(function () {
        ready[id] = true;
        io.dispatch('rz:tab-ready', { id: id });
      }, function (e) {
        delete inflight[id];
        io.dispatch('rz:tab-error', { id: id, url: failedUrl, message: String(e && e.message || e) });
        throw e;
      });
      inflight[id] = p;
      return p;
    }
    return {
      ensureTab: ensureTab,
      isReady: function (id) { return !!ready[id]; },
      tabs: function () { return Object.keys(registry); }
    };
  }
  return { create: create, version: '3.61.0' };
});
