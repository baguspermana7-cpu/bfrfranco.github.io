/* ============================================================================
   rz-command-palette.js — shared site search + command palette (v1.50.20)
   Replaces the per-page inline Fuse.js search copies. Self-contained:
   - creates the modal markup if the page lacks it (styles live in styles.css /
     styles-index.css — .search-* selectors, present in both stylesheets)
   - binds #navSearchBtn, Ctrl/Cmd+K, "/" (outside inputs), Esc, arrows+Enter
   - Fuse.js (lazy CDN) over search-index.json (title/description/keywords/category)
   - recents (localStorage), category chips, match highlighting, hover preview
   - NEW: a "commands" group (theme toggle + quick navigation) shown alongside
     recents and matched while typing (">"-style but plain substring)
   Guard: does nothing if window.__rzPalette is already set (pages that still
   carry a working inline copy must NOT load this file). ES5, zero deps.
   ============================================================================ */
(function () {
  'use strict';
  if (window.__rzPalette) return;
  window.__rzPalette = true;

  var RECENT_KEY = 'rz-search-recent';
  var fuse = null, searchData = null, focusedIdx = -1, activeFilter = 'all', lastResults = [];
  var sections = null;   /* deep search: [{t: heading, u: "page.html#id", a: article title}] */
  var overlay, modal, input, resultsEl, chipsEl, previewEl;

  /* ---- commands (beyond search) ---- */
  var COMMANDS = [
    { title: 'Toggle dark / light mode', kbd: 'theme', run: function () {
        var t = document.getElementById('themeToggle');
        if (t) { t.click(); return; }
        var cur = document.documentElement.getAttribute('data-theme');
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
      } },
    { title: 'Go: Home', url: 'index.html' },
    { title: 'Go: All articles', url: 'articles.html' },
    { title: 'Go: DC Solutions', url: 'datacenter-solutions.html' },
    { title: 'Go: Glossary', url: 'glossary.html' },
    { title: 'Go: Insights', url: 'insights.html' }
  ];

  function ensureMarkup() {
    overlay = document.getElementById('searchOverlay');
    modal = document.getElementById('searchModal');
    previewEl = document.getElementById('searchPreview');
    if (!modal) {
      var wrap = document.createElement('div');
      wrap.innerHTML =
        '<div class="search-overlay" id="searchOverlay" style="display:none;"></div>' +
        '<div class="search-modal" id="searchModal" style="display:none;">' +
        '<div class="search-input-wrapper">' +
        '<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '<input type="text" class="search-input" id="searchInput" placeholder="Search articles, calculators, tools..." autocomplete="off" aria-label="Search">' +
        '<kbd class="search-kbd">ESC</kbd></div>' +
        '<div class="search-chips" id="searchChips">' +
        '<button class="search-chip active" data-filter="all">All</button>' +
        '<button class="search-chip" data-filter="articles">Articles</button>' +
        '<button class="search-chip" data-filter="calculators">Calculators</button>' +
        '<button class="search-chip" data-filter="tools">Tools</button></div>' +
        '<div class="search-results" id="searchResults"></div></div>' +
        '<div class="search-preview" id="searchPreview"></div>';
      while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
      overlay = document.getElementById('searchOverlay');
      modal = document.getElementById('searchModal');
      previewEl = document.getElementById('searchPreview');
    }
    input = document.getElementById('searchInput');
    resultsEl = document.getElementById('searchResults');
    chipsEl = document.getElementById('searchChips');
  }

  function getRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; } }
  function saveRecent(q) {
    if (!q || q.length < 2) return;
    var arr = getRecent().filter(function (x) { return x !== q; });
    arr.unshift(q); if (arr.length > 3) arr = arr.slice(0, 3);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function clearRecent() { try { localStorage.removeItem(RECENT_KEY); } catch (e) {} }
  function escapeHtml(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s)); return d.innerHTML; }

  function commandRow(c, i) {
    return '<a href="' + (c.url || '#') + '" class="search-result-item rz-cmd" data-cmd="' + i + '">' +
      '<div class="search-result-icon tool">&#8984;</div>' +
      '<div class="search-result-info">' +
      '<div class="search-result-category">Command</div>' +
      '<div class="search-result-title">' + c.title + '</div>' +
      '</div></a>';
  }
  function bindCommandRows() {
    resultsEl.querySelectorAll('.rz-cmd').forEach(function (el) {
      var c = COMMANDS[parseInt(el.getAttribute('data-cmd'), 10)];
      if (c && c.run) el.addEventListener('click', function (ev) { ev.preventDefault(); c.run(); closeSearch(); });
    });
  }

  function renderRecent() {
    var html = '<div class="search-recent"><div class="search-recent-header">' +
      '<span class="search-recent-label">Commands</span></div>';
    COMMANDS.forEach(function (c, i) { html += commandRow(c, i); });
    html += '</div>';
    var recent = getRecent();
    if (recent.length) {
      html += '<div class="search-recent"><div class="search-recent-header">' +
        '<span class="search-recent-label">Recent</span>' +
        '<button class="search-recent-clear" id="clearRecent">Clear</button></div>';
      recent.forEach(function (q) {
        html += '<div class="search-recent-item" data-query="' + q.replace(/"/g, '&quot;') + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
          '<span>' + escapeHtml(q) + '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="search-empty">Type to search across all content</div>';
    }
    resultsEl.innerHTML = html;
    bindCommandRows();
    var clearBtn = document.getElementById('clearRecent');
    if (clearBtn) clearBtn.addEventListener('click', function () { clearRecent(); renderRecent(); });
    resultsEl.querySelectorAll('.search-recent-item').forEach(function (el) {
      el.addEventListener('click', function () {
        input.value = el.getAttribute('data-query');
        input.dispatchEvent(new Event('input'));
      });
    });
  }

  function openSearch() {
    overlay.style.display = '';
    modal.style.display = '';
    overlay.classList.add('active');
    modal.classList.add('active');
    input.value = '';
    input.focus();
    focusedIdx = -1; activeFilter = 'all'; lastResults = [];
    updateChips(); hidePreview(); renderRecent();
    if (!searchData) {
      var initFuse = function (data) {
        searchData = data;
        fuse = new Fuse(data, {
          keys: [
            { name: 'title', weight: 0.4 },
            { name: 'description', weight: 0.25 },
            { name: 'keywords', weight: 0.25 },
            { name: 'category', weight: 0.1 }
          ],
          threshold: 0.35, includeScore: true, includeMatches: true, minMatchCharLength: 2
        });
      };
      var loadData = function () {
        fetch('search-index.json').then(function (r) { return r.json(); }).then(initFuse).catch(function () {});
        /* deep search corpus (section headings with static ids) — optional, best-effort */
        fetch('search-sections.json').then(function (r) { return r.json(); }).then(function (d) { sections = d; }).catch(function () {});
      };
      if (typeof Fuse === 'undefined') {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0';
        s.onload = loadData;
        document.head.appendChild(s);
      } else { loadData(); }
    }
  }

  function closeSearch() {
    overlay.classList.remove('active');
    modal.classList.remove('active');
    input.blur(); hidePreview();
    setTimeout(function () {
      if (!overlay.classList.contains('active')) overlay.style.display = 'none';
      if (!modal.classList.contains('active')) modal.style.display = 'none';
    }, 300);
  }

  function getIconClass(cat) {
    cat = (cat || '').toLowerCase();
    if (cat === 'calculator') return 'calc';
    if (cat === 'tool') return 'tool';
    if (cat === 'policy') return 'policy';
    if (cat === 'sustainability') return 'sustainability';
    if (cat === 'geopolitics') return 'geopolitics';
    if (cat === 'analysis') return 'analysis';
    if (cat === 'leadership') return 'leadership';
    if (cat === 'business') return 'business';
    return '';
  }
  function getIconLabel(item) {
    if (item.url && item.url.indexOf('article-') === 0) {
      var n = item.url.replace('article-', '').replace('.html', '');
      return (n.length < 2 ? '0' + n : n);
    }
    var cat = (item.category || '').toLowerCase();
    if (cat === 'calculator') return '&#9889;';
    if (cat === 'tool') return '&#9881;';
    return '&#9733;';
  }
  function getCatFilter(cat) {
    cat = (cat || '').toLowerCase();
    if (cat === 'calculator') return 'calculators';
    if (cat === 'tool') return 'tools';
    return 'articles';
  }

  function highlightText(text, matches, key) {
    if (!matches || !matches.length) return text;
    var found = null;
    for (var i = 0; i < matches.length; i++) if (matches[i].key === key) { found = matches[i]; break; }
    if (!found || !found.indices || !found.indices.length) return text;
    var indices = found.indices.sort(function (a, b) { return a[0] - b[0]; });
    var result = '', last = 0;
    indices.forEach(function (p) {
      if (p[0] > last) result += text.substring(last, p[0]);
      result += '<mark class="search-highlight">' + text.substring(p[0], p[1] + 1) + '</mark>';
      last = p[1] + 1;
    });
    if (last < text.length) result += text.substring(last);
    return result;
  }

  function filterResults(results) {
    if (activeFilter === 'all') return results;
    return results.filter(function (r) { return getCatFilter(r.item.category) === activeFilter; });
  }

  function matchedCommands(q) {
    q = q.toLowerCase();
    return COMMANDS.map(function (c, i) { return { c: c, i: i }; })
      .filter(function (x) { return x.c.title.toLowerCase().indexOf(q) !== -1; });
  }

  /* deep search: section headings, ranked by earliest match position */
  function matchedSections(q) {
    if (!sections || q.length < 3) return [];
    q = q.toLowerCase();
    var hits = [];
    for (var i = 0; i < sections.length; i++) {
      var pos = sections[i].t.toLowerCase().indexOf(q);
      if (pos !== -1) hits.push({ s: sections[i], pos: pos });
    }
    hits.sort(function (a, b) { return a.pos - b.pos; });
    return hits.slice(0, 3).map(function (h) { return h.s; });
  }
  function sectionRow(s) {
    return '<a href="' + s.u + '" class="search-result-item rz-section">' +
      '<div class="search-result-icon">&#167;</div>' +
      '<div class="search-result-info">' +
      '<div class="search-result-category">Section &#183; ' + escapeHtml(s.a) + '</div>' +
      '<div class="search-result-title">' + escapeHtml(s.t) + '</div>' +
      '</div></a>';
  }

  function renderResults(results) {
    var filtered = filterResults(results);
    var q = input.value.trim();
    var cmds = activeFilter === 'all' ? matchedCommands(q) : [];
    var secs = activeFilter === 'all' ? matchedSections(q) : [];
    if (!filtered.length && !cmds.length && !secs.length) {
      resultsEl.innerHTML = '<div class="search-empty">No results found</div>';
      focusedIdx = -1; hidePreview(); return;
    }
    var html = '';
    cmds.slice(0, 2).forEach(function (x) { html += commandRow(x.c, x.i); });
    filtered.slice(0, 6).forEach(function (r, i) {
      var item = r.item;
      html += '<a href="' + item.url + '" class="search-result-item" data-idx="' + i + '">' +
        '<div class="search-result-icon ' + getIconClass(item.category) + '">' + getIconLabel(item) + '</div>' +
        '<div class="search-result-info">' +
        '<div class="search-result-category">' + (item.category || '') + '</div>' +
        '<div class="search-result-title">' + highlightText(item.title, r.matches, 'title') + '</div>' +
        '<div class="search-result-desc">' + highlightText(item.description, r.matches, 'description') + '</div>' +
        '</div></a>';
    });
    secs.forEach(function (s) { html += sectionRow(s); });
    resultsEl.innerHTML = html;
    focusedIdx = -1;
    bindCommandRows();
    attachHoverListeners(filtered);
  }

  function attachHoverListeners(filtered) {
    resultsEl.querySelectorAll('.search-result-item[data-idx]').forEach(function (el) {
      var idx = parseInt(el.getAttribute('data-idx'), 10);
      el.addEventListener('mouseenter', function () { showPreview(filtered[idx], el); });
      el.addEventListener('mouseleave', function () { hidePreview(); });
      el.addEventListener('click', function () { saveRecent(input.value.trim()); });
    });
  }

  function showPreview(r, anchorEl) {
    if (!previewEl || !r) return;
    var item = r.item;
    var imgHtml = item.image ? '<img class="search-preview-img" src="' + item.image + '" alt="">' : '';
    var timeHtml = item.readingTime ? '<div class="search-preview-badge"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + item.readingTime + ' min</div>' : '';
    previewEl.innerHTML = imgHtml + '<div class="search-preview-text">' +
      '<div class="search-preview-cat">' + (item.category || '') + '</div>' +
      '<div class="search-preview-title">' + item.title + '</div>' +
      '<div class="search-preview-desc">' + item.description + '</div>' + timeHtml + '</div>';
    var modalRect = modal.getBoundingClientRect();
    var itemRect = anchorEl.getBoundingClientRect();
    var tipLeft = modalRect.right + 10;
    var tipTop = itemRect.top;
    if (tipLeft + 270 > window.innerWidth) tipLeft = modalRect.left - 270;
    if (tipTop + 100 > window.innerHeight) tipTop = window.innerHeight - 110;
    previewEl.style.left = tipLeft + 'px';
    previewEl.style.top = tipTop + 'px';
    previewEl.classList.add('visible');
  }
  function hidePreview() { if (previewEl) { previewEl.innerHTML = ''; previewEl.classList.remove('visible'); } }

  function updateChips() {
    if (!chipsEl) return;
    chipsEl.querySelectorAll('.search-chip').forEach(function (chip) {
      chip.classList.toggle('active', chip.getAttribute('data-filter') === activeFilter);
    });
  }
  function updateFocus() {
    var items = resultsEl.querySelectorAll('.search-result-item');
    items.forEach(function (el, i) {
      el.classList.toggle('focused', i === focusedIdx);
      if (i === focusedIdx) {
        el.scrollIntoView({ block: 'nearest' });
        var idx = el.getAttribute('data-idx');
        if (idx !== null) {
          var filtered = filterResults(lastResults);
          if (filtered[parseInt(idx, 10)]) showPreview(filtered[parseInt(idx, 10)], el);
        }
      }
    });
  }

  function isTypingContext(e) {
    var t = e.target;
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
  }

  function init() {
    ensureMarkup();
    if (!modal || !input || !resultsEl) return;

    var searchBtn = document.getElementById('navSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', openSearch);
    if (overlay) overlay.addEventListener('click', closeSearch);

    if (chipsEl) chipsEl.addEventListener('click', function (e) {
      var chip = e.target.closest('.search-chip');
      if (!chip) return;
      activeFilter = chip.getAttribute('data-filter');
      updateChips();
      if (lastResults.length) renderResults(lastResults);
    });

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (modal.classList.contains('active')) closeSearch(); else openSearch();
        return;
      }
      if (e.key === '/' && !modal.classList.contains('active') && !isTypingContext(e)) {
        e.preventDefault(); openSearch(); return;
      }
      if (!modal.classList.contains('active')) return;
      if (e.key === 'Escape') { closeSearch(); return; }
      var items = resultsEl.querySelectorAll('.search-result-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault(); focusedIdx = Math.min(focusedIdx + 1, items.length - 1); updateFocus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); focusedIdx = Math.max(focusedIdx - 1, 0); updateFocus();
      } else if (e.key === 'Enter' && focusedIdx >= 0 && items[focusedIdx]) {
        e.preventDefault(); saveRecent(input.value.trim()); items[focusedIdx].click();
      }
    });

    input.addEventListener('input', function () {
      var query = input.value.trim();
      if (query.length < 2 || !fuse) {
        lastResults = []; focusedIdx = -1; hidePreview();
        if (query.length === 0) renderRecent();
        else resultsEl.innerHTML = '<div class="search-empty">Type to search across all content</div>';
        return;
      }
      lastResults = fuse.search(query);
      renderResults(lastResults);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
