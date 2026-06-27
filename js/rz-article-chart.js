/* ============================================================================
   rz-article-chart.js — on-brand INTERACTIVE article data charts (v1.49.10)
   Part of RZ Dark System v1. Renders Chart.js charts from an inline, sourced
   config so every chartable article shows a finding-titled, interactive chart
   (hover crosshair + tooltip) with a visible Source caption + basis chip —
   driven by a validated data/article-N/ dataset (ARTICLE_DATAVIZ_STANDARD.md).

   Markup (zero CSS deps — styles are inline-set here):
     <figure class="rz-chart" data-rz-chart>
       <canvas></canvas>
       <script type="application/json" class="rz-chart-cfg">
         { "type":"line", "title":"finding sentence",
           "labels":[...], "x":"axis label", "y":"axis label",
           "series":[{"label":"...","data":[...],"accent":"signal|info|data"}],
           "source":"… citation …", "basisTag":"modelled|published|standard|vendor" }
       </script>
     </figure>

   Theme-aware (re-renders on data-theme change). Honours prefers-reduced-motion.
   Zero deps beyond Chart.js (already loaded on the page). ES5-safe.
   ============================================================================ */
(function(){
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var charts = [];   /* {el, cfg, instance} for re-theming */

  function isDark(){ return document.documentElement.getAttribute('data-theme') === 'dark'; }

  function palette(){
    var d = isDark();
    return {
      grid:  d ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      tick:  d ? '#9aa8bb' : '#64748b',
      text:  d ? '#cfd3da' : '#334155',
      tipBg: d ? '#0b1220' : '#ffffff',
      tipBd: d ? '#334155' : '#e2e8f0',
      tipTx: d ? '#e2e8f0' : '#1e293b',
      cross: d ? 'rgba(255,170,0,0.55)' : 'rgba(180,83,9,0.45)',
      accents: {
        signal: d ? '#FFAA00' : '#b45309',
        info:   d ? '#00DDFF' : '#0e7490',
        data:   d ? '#00FF88' : '#0a8a5a',
        alert:  d ? '#FF3030' : '#dc2626'
      }
    };
  }

  /* CNBC-style vertical crosshair at the active point */
  var crosshair = {
    id: 'rzCrosshair',
    afterDraw: function(chart){
      var t = chart.tooltip;
      if(!t || !t.getActiveElements || !t.getActiveElements().length) return;
      var x = t.getActiveElements()[0].element.x;
      var ya = chart.scales.y; if(!ya) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chart.chartArea.top);
      ctx.lineTo(x, chart.chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = chart.$rzCross || 'rgba(255,170,0,0.5)';
      ctx.stroke();
      ctx.restore();
    }
  };

  function buildOptions(cfg, pal){
    var fmt = function(v){ return (typeof v === 'number') ? v.toLocaleString() : v; };
    return {
      responsive: true, maintainAspectRatio: false,
      animation: false,                 /* draw immediately — reliable, and the chart's value is the hover interactivity, not a grow-in */
      animations: { colors: false, x: false, y: false },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: cfg.series.length > 1, labels: { color: pal.text, font: { family: "'IBM Plex Sans',sans-serif", size: 11 }, usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          backgroundColor: pal.tipBg, titleColor: pal.tipTx, bodyColor: pal.tipTx,
          borderColor: pal.tipBd, borderWidth: 1, padding: 10, cornerRadius: 6, displayColors: true,
          titleFont: { family: "'IBM Plex Mono',monospace", size: 11 },
          bodyFont: { family: "'IBM Plex Mono',monospace", size: 12 },
          callbacks: {
            title: function(items){ return (cfg.x ? cfg.x + ': ' : '') + (items[0] ? items[0].label : ''); },
            label: function(it){ var u = (cfg.series[it.datasetIndex] && cfg.series[it.datasetIndex].unit) || ''; var v = (it.raw && it.raw.length === 2 && typeof it.raw[0] === 'number') ? (fmt(it.raw[0]) + '–' + fmt(it.raw[1])) : fmt(it.raw); return ' ' + it.dataset.label + ': ' + v + (u ? ' ' + u : ''); }
          }
        }
      },
      scales: buildScales(cfg, pal)
    };
  }

  function mono(size, color){ return { color: color, font: { family: "'IBM Plex Mono',monospace", size: size } }; }
  function buildScales(cfg, pal){
    if(cfg.type === 'doughnut' || cfg.type === 'pie') return {};
    var sc = {
      x: { title: { display: !!cfg.x, text: cfg.x, color: pal.tick, font: { family: "'IBM Plex Mono',monospace", size: 10 } }, ticks: mono(10, pal.tick), grid: { display: false } },
      y: { beginAtZero: true, title: { display: !!cfg.y, text: cfg.y, color: pal.tick, font: { family: "'IBM Plex Mono',monospace", size: 10 } }, ticks: { color: pal.tick, font: { family: "'IBM Plex Mono',monospace", size: 10 }, callback: function(v){ return (typeof v === 'number') ? v.toLocaleString() : v; } }, grid: { color: pal.grid, lineWidth: 0.6 } }
    };
    if(cfg.series.some(function(s){ return s.axis === 'y1'; })){
      sc.y1 = { position: 'right', beginAtZero: true, title: { display: !!cfg.y1, text: cfg.y1, color: pal.tick, font: { family: "'IBM Plex Mono',monospace", size: 10 } }, ticks: mono(10, pal.tick), grid: { drawOnChartArea: false } };
    }
    return sc;
  }

  function buildData(cfg, pal){
    return {
      labels: cfg.labels,
      datasets: cfg.series.map(function(s){
        var col = pal.accents[s.accent] || pal.accents.signal;
        var base = { label: s.label, data: s.data, borderColor: col, backgroundColor: col, yAxisID: s.axis || 'y' };
        if(cfg.type === 'line'){ base.tension = 0.25; base.borderWidth = 2; base.pointRadius = 0; base.pointHoverRadius = 4; base.fill = false; }
        if(cfg.type === 'bar'){ var bar = s.colorAccents ? s.colorAccents.map(function(a){ return pal.accents[a] || col; }) : (s.colors ? s.colors : hexA(col, isDark() ? 0.8 : 0.85)); base.backgroundColor = bar; base.borderColor = bar; base.borderWidth = 1; base.borderRadius = 3; }
        if(cfg.type === 'doughnut' || cfg.type === 'pie'){ base.backgroundColor = cfg.series.length === 1 ? (s.colors || [pal.accents.signal, pal.accents.info, pal.accents.alert, pal.accents.data]) : col; base.borderColor = isDark() ? '#0E0F12' : '#fff'; base.borderWidth = 2; }
        return base;
      })
    };
  }
  function hexA(hex, a){ var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); if(!m) return hex; return 'rgba(' + parseInt(m[1],16) + ',' + parseInt(m[2],16) + ',' + parseInt(m[3],16) + ',' + a + ')'; }

  function chipClass(tag){
    tag = (tag || '').toLowerCase();
    if(tag === 'standard' || tag === 'published') return 'derived';
    if(tag === 'vendor') return 'warn';
    return 'warn'; /* modelled / illustrative / representative -> amber */
  }

  function render(el){
    var cfgEl = el.querySelector('script.rz-chart-cfg');
    var canvas = el.querySelector('canvas');
    if(!cfgEl || !canvas || typeof Chart === 'undefined') return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent); } catch(e){ return; }
    var pal = palette();

    /* finding title — prepend above the canvas */
    if(cfg.title && !el.querySelector('.rz-chart-title')){
      var h = document.createElement('div'); h.className = 'rz-chart-title'; h.textContent = cfg.title;
      el.insertBefore(h, el.firstChild);
    }
    var inst = new Chart(canvas.getContext('2d'), { type: cfg.type || 'line', data: buildData(cfg, pal), options: buildOptions(cfg, pal), plugins: [crosshair] });
    inst.$rzCross = pal.cross;

    /* source caption + basis chip */
    if(cfg.source && !el.querySelector('.rz-chart-src')){
      var cap = document.createElement('figcaption'); cap.className = 'rz-chart-src';
      var chip = document.createElement('span'); chip.className = 'rz-chart-chip ' + chipClass(cfg.basisTag);
      chip.textContent = (cfg.basisTag || 'modelled').toUpperCase();
      cap.appendChild(chip);
      cap.appendChild(document.createTextNode(' Source: ' + cfg.source));
      el.appendChild(cap);
    }
    charts.push({ el: el, cfg: cfg, instance: inst });
  }

  function reTheme(){
    var pal = palette();
    charts.forEach(function(c){
      c.instance.data = buildData(c.cfg, pal);
      c.instance.options = buildOptions(c.cfg, pal);
      c.instance.$rzCross = pal.cross;
      c.instance.update('none');
    });
  }

  function init(){
    var nodes = document.querySelectorAll('[data-rz-chart]');
    if(!nodes.length) return;
    if(typeof Chart === 'undefined'){ /* Chart.js still loading — retry shortly */ return setTimeout(init, 120); }
    [].forEach.call(nodes, render);
    /* re-theme on data-theme toggle */
    if(window.MutationObserver){
      new MutationObserver(function(muts){
        for(var i=0;i<muts.length;i++){ if(muts[i].attributeName === 'data-theme'){ reTheme(); break; } }
      }).observe(document.documentElement, { attributes: true });
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
