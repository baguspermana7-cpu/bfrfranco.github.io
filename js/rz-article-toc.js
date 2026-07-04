/* ============================================================================
   rz-article-toc.js — shared article Table of Contents + scrollspy (v1.50.36)
   Extracted from the per-page inline copy (33 pages carried a ~3.6KB duplicate
   of this script). Builds the desktop sidebar (#tocSidebarList) and the mobile
   drawer (#tocMobileList / #tocMobileToggle / #tocMobileDrawer /
   #tocMobileBackdrop / #tocDrawerClose) from `.article-body h2` (auto-assigns
   deterministic `toc-section-N` ids when missing), smooth-scrolls with a -80px
   offset, and scrollspy-highlights the active section via IntersectionObserver.
   Idempotent + safe on pages without the TOC markup. ES5, zero deps.
   ============================================================================ */
(function () {
  'use strict';
  function init() {
    var sidebarList = document.getElementById('tocSidebarList');
    var mobileList = document.getElementById('tocMobileList');
    if (!sidebarList && !mobileList) return;                 /* page has no TOC markup */
    if (sidebarList && sidebarList.childElementCount) return; /* an inline copy already built it */

    var sections = document.querySelectorAll('.article-body h2[id], .article-content h2[id]');
    if (!sections.length) {
      var allH2s = document.querySelectorAll('.article-body h2, .article-content h2');
      [].forEach.call(allH2s, function (h2, i) {
        if (!h2.id) h2.id = 'toc-section-' + (i + 1);
      });
      sections = document.querySelectorAll('.article-body h2[id], .article-content h2[id]');
    }
    if (!sections.length) return;

    var tocToggle = document.getElementById('tocMobileToggle');
    var tocDrawer = document.getElementById('tocMobileDrawer');
    if (tocDrawer && !tocDrawer.getAttribute('role')) {
      tocDrawer.setAttribute('role', 'navigation');
      tocDrawer.setAttribute('aria-label', 'Table of contents');
    }
    var tocSidebarEl = document.getElementById('tocSidebar');
    if (tocSidebarEl && !tocSidebarEl.getAttribute('role')) {
      tocSidebarEl.setAttribute('role', 'navigation');
      tocSidebarEl.setAttribute('aria-label', 'Table of contents');
    }
    var tocBackdrop = document.getElementById('tocMobileBackdrop');
    var tocClose = document.getElementById('tocDrawerClose');

    var tocData = [];
    [].forEach.call(sections, function (h2, i) {
      var id = h2.getAttribute('id');
      var numMatch = id.match(/\d+/);
      var num = numMatch ? numMatch[0] : String(i + 1);
      var text = h2.textContent.replace(/^\s*\d+[\.\s]*/, '').replace(/#\s*$/, '').trim();
      tocData.push({ id: id, num: num, text: text });
    });

    function closeMobileDrawer() {
      if (tocDrawer) tocDrawer.classList.remove('open');
      if (tocBackdrop) tocBackdrop.classList.remove('visible');
    }

    function buildList(container, isMobile) {
      if (!container) return;
      tocData.forEach(function (item) {
        var li = document.createElement('li');
        if (!isMobile) li.className = 'toc-sidebar-item';
        var a = document.createElement('a');
        a.href = '#' + item.id;
        a.setAttribute('data-section', item.id);
        if (isMobile) {
          a.textContent = item.num + '. ' + item.text;
        } else {
          a.className = 'toc-sidebar-link';
          a.innerHTML = '<span class="toc-sidebar-num">' + item.num + '</span>' + item.text;
        }
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var target = document.getElementById(item.id);
          if (target) window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
          if (isMobile) closeMobileDrawer();
        });
        li.appendChild(a);
        container.appendChild(li);
      });
    }

    buildList(sidebarList, false);
    buildList(mobileList, true);

    var currentSection = null;
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = entry.target.getAttribute('id');
            if (currentSection !== id) {
              currentSection = id;
              if (sidebarList) {
                [].forEach.call(sidebarList.querySelectorAll('.toc-sidebar-link'), function (link) {
                  link.classList.toggle('active', link.getAttribute('data-section') === id);
                });
              }
            }
          }
        });
      }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
      [].forEach.call(sections, function (s) { observer.observe(s); });
    }

    if (tocToggle) tocToggle.addEventListener('click', function () {
      tocDrawer.classList.toggle('open');
      tocBackdrop.classList.toggle('visible');
    });
    if (tocBackdrop) tocBackdrop.addEventListener('click', closeMobileDrawer);
    if (tocClose) tocClose.addEventListener('click', closeMobileDrawer);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
