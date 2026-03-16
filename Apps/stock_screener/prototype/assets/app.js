(function () {
  const data = window.StockMapMock;
  const utils = window.StockMapUtils;

  if (!data || !utils) {
    return;
  }

  const {
    $,
    $$,
    buildAiAnswer,
    colorByChange,
    computeSectorExposure,
    entityAnchor,
    entityHref,
    escapeHtml,
    filterFloatRows,
    formatMarketCap,
    formatPct,
    getFloatRows,
    getNetworkScenarios,
    getTickerAnalytics,
    isAllowedToken,
    riskClass,
    round2,
    searchEntities,
    toCsv
  } = utils;

  const WATCHLIST_KEY = "stockmap_watchlist";
  const state = {
    currentTab: "below15",
    sortKey: "freeFloat",
    sortDir: "asc",
    sourceFilter: "all",
    sectorFilter: "all",
    analysisTicker: "BBCA",
    currentNetworkId: "",
    charts: {}
  };

  function enableDirectAccess() {
    const token = isAllowedToken("prototype-token") ? "prototype-token" : data.meta?.allowedTokens?.[0] || "";
    if (token) {
      sessionStorage.setItem("idx_token", token);
    }
    $("#dashboard-view")?.classList.remove("hide");
    return token;
  }

  function renderSearchResults(results, items) {
    if (!results) return;

    if (!items.length) {
      results.innerHTML = '<div class="search-item">No result in prototype data.</div>';
    } else {
      results.innerHTML = items
        .map(
          (item) => `
            <div class="search-item">
              <a class="search-link" href="${entityHref(item.kind, item.id)}">
                <strong>${escapeHtml(item.label)}</strong>
                <small>${escapeHtml(item.subtitle || item.kind)}</small>
              </a>
            </div>
          `
        )
        .join("");
    }

    results.classList.add("is-open");
  }

  function attachSearch() {
    const input = $("#app-search-input");
    const results = $("#app-search-results");
    if (!input || !results) return;

    function runSearch() {
      const query = input.value.trim();
      if (!query) {
        results.classList.remove("is-open");
        return;
      }
      renderSearchResults(results, searchEntities(query, 8));
    }

    input.addEventListener("input", runSearch);
    input.addEventListener("focus", () => renderSearchResults(results, searchEntities(input.value.trim(), 8)));

    document.addEventListener("click", (event) => {
      if (event.target !== input && !results.contains(event.target)) {
        results.classList.remove("is-open");
      }
    });
  }

  function renderSidebar() {
    const container = $("#sidebar-nav");
    if (!container) return;

    const items = [
      { id: "overview-section", label: "Overview", note: "Market scan" },
      { id: "screener-section", label: "Float Screener", note: "Depth metrics" },
      { id: "network-section", label: "Network", note: "Multi-hop map" },
      { id: "analysis-section", label: "Analysis Lab", note: "Price & peers" },
      { id: "heatmap-section", label: "Heatmap", note: "Market view" },
      { id: "watchlist-section", label: "Watchlist", note: "Local storage" }
    ];

    container.innerHTML = items
      .map(
        (item, index) => `
          <button class="sidebar-item ${index === 0 ? "is-active" : ""}" data-target="${item.id}">
            <span>${escapeHtml(item.label)}</span>
            <span class="mono muted">${escapeHtml(item.note)}</span>
          </button>
        `
      )
      .join("");

    $$(".sidebar-item", container).forEach((button) => {
      button.addEventListener("click", () => {
        $$(".sidebar-item", container).forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function compareValues(a, b, key) {
    const riskWeight = { Low: 1, Medium: 2, High: 3 };
    const stringKeys = new Set(["ticker", "company", "holder", "largestStrategicHolder", "sector", "signalSummary", "coverageBand", "concentrationBand"]);

    if (stringKeys.has(key)) {
      return String(a[key] || "").localeCompare(String(b[key] || ""));
    }

    if (key === "risk") {
      return (riskWeight[a.risk] || 0) - (riskWeight[b.risk] || 0);
    }

    return Number(a[key] || 0) - Number(b[key] || 0);
  }

  function getRenderedFloatRows() {
    const rows = filterFloatRows(state.currentTab)
      .filter((row) => state.sourceFilter === "all" || row.source === state.sourceFilter)
      .filter((row) => state.sectorFilter === "all" || row.sector === state.sectorFilter)
      .slice();

    rows.sort((a, b) => {
      const compare = compareValues(a, b, state.sortKey);
      return state.sortDir === "asc" ? compare : compare * -1;
    });

    return rows;
  }

  function renderTopStats(currentRows) {
    const container = $("#app-top-stats");
    if (!container) return;

    const avgFloat = currentRows.length ? round2(currentRows.reduce((sum, row) => sum + row.freeFloat, 0) / currentRows.length) : 0;
    const avgBlindSpot = currentRows.length ? round2(currentRows.reduce((sum, row) => sum + row.blindSpot, 0) / currentRows.length) : 0;
    const highRisk = currentRows.filter((row) => row.risk === "High").length;
    const items = [
      { label: "Current View", value: String(currentRows.length) },
      { label: "Avg Float", value: formatPct(avgFloat) },
      { label: "Avg Blind Spot", value: formatPct(avgBlindSpot) },
      { label: "High Risk", value: String(highRisk) }
    ];

    container.innerHTML = items
      .map(
        (item) => `
          <div class="mini-stat">
            <div class="mini-stat-value">${escapeHtml(item.value)}</div>
            <div class="mini-stat-label">${escapeHtml(item.label)}</div>
          </div>
        `
      )
      .join("");
  }

  function renderAppLists() {
    const blocks = [
      ["#app-market-overview", data.overview.marketOverview, (item) => `
        <div class="list-row">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="code-pill tone-${escapeHtml(item.tone || "accent")}">${escapeHtml(item.code)}</span>
            <span>${escapeHtml(item.name)}</span>
          </div>
          <span class="mono muted">${escapeHtml(item.count)}</span>
        </div>
      `],
      ["#app-hot-searches", data.overview.hotSearches, (item) => `
        <div class="list-row">
          <span class="mono muted">${escapeHtml(item.rank)}</span>
          <span style="font-weight:600">${entityAnchor(item.name)}</span>
          <span class="mono muted">${escapeHtml(item.count)}</span>
        </div>
      `],
      ["#app-top-foreign", data.overview.topForeign, (item) => `
        <div class="list-row">
          <span>${entityAnchor(item.name)}</span>
          <span class="metric-pill tone-blue">${escapeHtml(item.positions)}</span>
        </div>
      `],
      ["#app-conglomerates", data.overview.conglomerates, (item) => `
        <div class="list-row">
          <span>${entityAnchor(item.name)}</span>
          <span class="mono muted">${escapeHtml(item.tickers)}</span>
        </div>
      `]
    ];

    blocks.forEach(([selector, rows, renderer]) => {
      const container = $(selector);
      if (!container) return;
      container.innerHTML = rows.map(renderer).join("");
    });
  }

  function renderSpotlights() {
    const container = $("#app-spotlights");
    if (!container) return;

    container.innerHTML = data.spotlights
      .map(
        (item) => `
          <div class="entity-related-card">
            <div class="callout-title" style="margin-bottom:8px">${escapeHtml(item.title)}</div>
            <div class="muted-copy">${escapeHtml(item.body)}</div>
          </div>
        `
      )
      .join("");
  }

  function renderFloatAnalyticsGrid(rows) {
    const container = $("#float-analytics-grid");
    if (!container) return;

    const avgFloat = rows.length ? round2(rows.reduce((sum, row) => sum + row.freeFloat, 0) / rows.length) : 0;
    const avgStrategic = rows.length ? round2(rows.reduce((sum, row) => sum + row.totalHeld, 0) / rows.length) : 0;
    const avgBlindSpot = rows.length ? round2(rows.reduce((sum, row) => sum + row.blindSpot, 0) / rows.length) : 0;
    const avgHHI = rows.length ? round2(rows.reduce((sum, row) => sum + row.hhi, 0) / rows.length) : 0;
    const deepCoverage = rows.filter((row) => row.coverageBand === "Deep").length;
    const authoredRows = rows.filter((row) => row.source === "authored").length;

    const cards = [
      { label: "Avg Free Float", value: formatPct(avgFloat) },
      { label: "Avg Strategic Held", value: formatPct(avgStrategic) },
      { label: "Avg Blind Spot", value: formatPct(avgBlindSpot) },
      { label: "Avg HHI", value: avgHHI.toFixed(0) },
      { label: "Deep Coverage", value: `${deepCoverage}/${rows.length || 0}` },
      { label: "Authored Rows", value: String(authoredRows) }
    ];

    container.innerHTML = cards
      .map(
        (item) => `
          <div class="snapshot">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `
      )
      .join("");
  }

  function updateSortHeaders() {
    $$("th[data-sort-key]").forEach((header) => {
      header.classList.remove("sort-asc", "sort-desc");
      if (header.dataset.sortKey === state.sortKey) {
        header.classList.add(state.sortDir === "asc" ? "sort-asc" : "sort-desc");
      }
    });
  }

  function renderFloatTable() {
    const tbody = $("#app-float-body");
    if (!tbody) return;

    const rows = getRenderedFloatRows();
    const note = $("#float-table-note");
    if (note) {
      const authoredCount = rows.filter((row) => row.source === "authored").length;
      const syntheticCount = rows.filter((row) => row.source === "synthetic").length;
      note.textContent = `${rows.length} rows in view. ${authoredCount} authored rows calculate strategic held, visible coverage, blind spot, HHI, and L/F mix directly from holder evidence; ${syntheticCount} rows remain aggregate estimates.`;
    }

    renderTopStats(rows);
    renderFloatAnalyticsGrid(rows);
    updateSortHeaders();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="12" class="muted-copy">No rows match the current filter.</td></tr>';
      return;
    }

    tbody.innerHTML = rows
      .map((item) => {
        const sourceTone = item.source === "authored" ? "tone-blue" : "tone-green";
        const mix = item.localPct || item.foreignPct ? `${round2(item.localPct)} / ${round2(item.foreignPct)}` : "-";
        return `
          <tr>
            <td class="mono" style="font-weight:700;color:var(--accent)"><a class="entity-inline-link" href="${entityHref("ticker", item.ticker)}">${escapeHtml(item.ticker)}</a></td>
            <td>${escapeHtml(item.company)}</td>
            <td>${escapeHtml(item.sector)}</td>
            <td class="right mono">${escapeHtml(formatMarketCap(item.marketCap))}</td>
            <td>${entityAnchor(item.largestStrategicHolder)} <span class="type-badge ${sourceTone}">${escapeHtml(item.source)}</span></td>
            <td class="right mono">${formatPct(item.totalHeld)}</td>
            <td class="right mono">${formatPct(item.freeFloat)}</td>
            <td class="right mono">${formatPct(item.visibleHeld)}</td>
            <td class="right mono">${formatPct(item.blindSpot)}</td>
            <td class="right mono">${escapeHtml(item.hhi.toFixed(0))}</td>
            <td class="right mono">${escapeHtml(mix)}</td>
            <td class="right ${riskClass(item.risk)}">${escapeHtml(item.risk)}</td>
            <td><span class="mono muted">${escapeHtml(item.signalSummary)}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  function bindFloatTabs() {
    const tabs = $$(".app-tab");
    if (!tabs.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        state.currentTab = tab.dataset.tab || "below15";
        tabs.forEach((item) => item.classList.remove("is-active"));
        tab.classList.add("is-active");
        renderFloatTable();
      });
    });

    renderFloatTable();
  }

  function bindFloatSorting() {
    $$("th[data-sort-key]").forEach((header) => {
      header.classList.add("sortable");
      header.addEventListener("click", () => {
        const key = header.dataset.sortKey;
        if (!key) return;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = ["ticker", "company", "holder", "largestStrategicHolder", "sector", "signalSummary"].includes(key) ? "asc" : "desc";
          if (key === "freeFloat") state.sortDir = "asc";
        }
        renderFloatTable();
      });
    });
  }

  function bindFloatFilters() {
    const sectorSelect = $("#float-sector-filter");
    const sourceSelect = $("#float-source-filter");
    if (!sectorSelect || !sourceSelect) return;

    const sectors = Array.from(new Set(getFloatRows().map((row) => row.sector).filter(Boolean))).sort();
    sectorSelect.innerHTML = ["<option value=\"all\">All sectors</option>", ...sectors.map((sector) => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`)].join("");
    sectorSelect.value = state.sectorFilter;
    sourceSelect.value = state.sourceFilter;

    sectorSelect.addEventListener("change", () => {
      state.sectorFilter = sectorSelect.value || "all";
      renderFloatTable();
    });

    sourceSelect.addEventListener("change", () => {
      state.sourceFilter = sourceSelect.value || "all";
      renderFloatTable();
    });
  }

  function bindFloatExport() {
    const button = $("#float-export-btn");
    if (!button) return;

    button.addEventListener("click", () => {
      const csv = toCsv(getRenderedFloatRows(), [
        { label: "Ticker", value: "ticker" },
        { label: "Company", value: "company" },
        { label: "Sector", value: "sector" },
        { label: "Market Cap", value: (row) => formatMarketCap(row.marketCap) },
        { label: "Largest Strategic Holder", value: "largestStrategicHolder" },
        { label: "Strategic Held", value: (row) => formatPct(row.totalHeld) },
        { label: "Free Float", value: (row) => formatPct(row.freeFloat) },
        { label: "Visible Coverage", value: (row) => formatPct(row.visibleHeld) },
        { label: "Blind Spot", value: (row) => formatPct(row.blindSpot) },
        { label: "HHI", value: (row) => row.hhi.toFixed(0) },
        { label: "Local Visible", value: (row) => row.localPct ? `${round2(row.localPct)}` : "" },
        { label: "Foreign Visible", value: (row) => row.foreignPct ? `${round2(row.foreignPct)}` : "" },
        { label: "Risk", value: "risk" },
        { label: "Signal", value: "signalSummary" },
        { label: "Source", value: "source" }
      ]);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stockmap-float-${state.currentTab}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  function renderPositionRows() {
    const body = $("#app-hidden-positions");
    if (!body) return;

    body.innerHTML = data.hiddenPositions
      .map(
        (row) => `
          <tr>
            <td class="mono" style="font-weight:700;color:var(--accent)"><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a></td>
            <td>${entityAnchor(row.investor)}</td>
            <td class="mono">${escapeHtml(row.type)}</td>
            <td class="mono">${escapeHtml(row.nationality)}</td>
            <td class="right mono">${escapeHtml(row.pct)}</td>
          </tr>
        `
      )
      .join("");
  }

  function bindAssistant() {
    const input = $("#assistant-query");
    const button = $("#assistant-ask-btn");
    const answer = $("#assistant-answer");

    if (!input || !button || !answer) return;

    function handleAsk() {
      answer.textContent = buildAiAnswer(input.value.trim());
    }

    button.addEventListener("click", handleAsk);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAsk();
      }
    });
  }

  function getAnalysisUniverse() {
    return Object.keys(data.tickerAnalytics || {});
  }

  function getAnalysisRecord(ticker) {
    return getTickerAnalytics(ticker) || getTickerAnalytics(getAnalysisUniverse()[0]) || null;
  }

  function renderMetricGrid(containerSelector, items) {
    const container = $(containerSelector);
    if (!container) return;
    container.innerHTML = (items || [])
      .map(
        (item) => `
          <div class="snapshot">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `
      )
      .join("");
  }

  function renderAnalysisChart(record) {
    const target = $("#analysis-price-chart");
    if (!target || !record || !window.echarts) return;

    if (!state.charts.analysisPrice) {
      state.charts.analysisPrice = window.echarts.init(target, null, { renderer: "canvas" });
      window.addEventListener("resize", () => state.charts.analysisPrice?.resize());
    }

    state.charts.analysisPrice.setOption({
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 20, top: 18, bottom: 28 },
      xAxis: {
        type: "category",
        data: record.priceHistory.map((point) => point.date),
        axisLabel: { color: "#9c9890", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#9c9890", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }
      },
      series: [
        {
          name: record.ticker,
          type: "line",
          smooth: true,
          symbolSize: 7,
          lineStyle: { width: 3, color: "#e55300" },
          itemStyle: { color: "#e55300" },
          areaStyle: { color: "rgba(229,83,0,0.12)" },
          data: record.priceHistory.map((point) => point.price)
        }
      ]
    });
  }

  function renderPeerCompare(record) {
    const body = $("#peer-compare-body");
    if (!body) return;

    body.innerHTML = (record.compare || [])
      .map(
        (row) => `
          <tr>
            <td class="mono"><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a></td>
            <td>${escapeHtml(row.company)}</td>
            <td class="right mono">${escapeHtml(row.pe)}x</td>
            <td class="right mono">${escapeHtml(row.pb)}x</td>
            <td class="right mono">${escapeHtml(row.roe)}%</td>
            <td class="right mono">${escapeHtml(row.divYield)}%</td>
            <td class="right mono">${escapeHtml(row.freeFloat)}%</td>
          </tr>
        `
      )
      .join("");
  }

  function renderAnalysisAlerts(record, floatRow) {
    const target = $("#analysis-alerts");
    if (!target) return;

    const list = [
      ...(record.alerts || []),
      floatRow ? `${record.ticker} screens at ${formatPct(floatRow.freeFloat)} free float, ${formatPct(floatRow.totalHeld)} strategic held, and ${formatPct(floatRow.blindSpot)} blind-spot float.` : "",
      floatRow ? `${record.ticker} visible holder HHI is ${floatRow.hhi.toFixed(0)} with a ${floatRow.concentrationBand.toLowerCase()} structure.` : ""
    ].filter(Boolean);

    target.innerHTML = `
      <div class="callout-title">Analyst Notes</div>
      <ul style="margin-top:10px">
        ${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    `;
  }

  function renderAnalysisPanel(ticker) {
    const record = getAnalysisRecord(ticker);
    if (!record) return;

    state.analysisTicker = record.ticker;
    const select = $("#analysis-ticker-select");
    if (select) select.value = record.ticker;

    const floatRow = getFloatRows().find((row) => row.ticker === record.ticker) || null;
    if (window.echarts) {
      renderAnalysisChart(record);
    }
    renderMetricGrid("#analysis-technical-grid", [
      ...record.technical,
      { label: "Last Price", value: record.lastPrice.toLocaleString("en-US") }
    ]);
    renderMetricGrid("#analysis-fundamentals-grid", record.fundamentals);
    renderPeerCompare(record);
    renderAnalysisAlerts(record, floatRow);
  }

  function bindAnalysisControls() {
    const select = $("#analysis-ticker-select");
    const addButton = $("#watchlist-add-btn");
    if (!select) return;

    const options = getAnalysisUniverse();
    select.innerHTML = options
      .map((ticker) => {
        const record = getAnalysisRecord(ticker);
        return `<option value="${escapeHtml(ticker)}">${escapeHtml(ticker)} - ${escapeHtml(record?.company || ticker)}</option>`;
      })
      .join("");

    if (!options.includes(state.analysisTicker)) {
      state.analysisTicker = options[0] || "BBCA";
    }

    select.value = state.analysisTicker;
    select.addEventListener("change", () => {
      renderAnalysisPanel(select.value);
    });

    if (addButton) {
      addButton.addEventListener("click", () => {
        addToWatchlist(state.analysisTicker);
      });
    }
  }

  function readWatchlist() {
    try {
      const parsed = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeWatchlist(items) {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
  }

  function addToWatchlist(ticker) {
    const items = readWatchlist();
    if (items.some((item) => item.ticker === ticker)) {
      renderWatchlist();
      return;
    }

    items.unshift({ ticker, addedAt: new Date().toISOString() });
    writeWatchlist(items);
    renderWatchlist();
  }

  function removeFromWatchlist(ticker) {
    const items = readWatchlist().filter((item) => item.ticker !== ticker);
    writeWatchlist(items);
    renderWatchlist();
  }

  function renderWatchlist() {
    const body = $("#watchlist-body");
    if (!body) return;

    const items = readWatchlist();
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="6" class="muted-copy">No watchlist items yet. Add one from the Analysis Lab.</td></tr>';
      return;
    }

    body.innerHTML = items
      .map((item) => {
        const record = getAnalysisRecord(item.ticker);
        const floatRow = getFloatRows().find((row) => row.ticker === item.ticker);
        return `
          <tr>
            <td class="mono"><a class="entity-inline-link" href="${entityHref("ticker", item.ticker)}">${escapeHtml(item.ticker)}</a></td>
            <td>${escapeHtml(record?.company || item.ticker)}</td>
            <td class="right mono">${record ? record.lastPrice.toLocaleString("en-US") : "N/A"}</td>
            <td class="right mono">${floatRow ? formatPct(floatRow.freeFloat) : "N/A"}</td>
            <td class="right ${floatRow ? riskClass(floatRow.risk) : ""}">${escapeHtml(floatRow?.risk || "N/A")}</td>
            <td>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="ghost-btn watchlist-open" type="button" data-ticker="${escapeHtml(item.ticker)}" style="padding:6px 10px">Open</button>
                <button class="ghost-btn watchlist-remove" type="button" data-ticker="${escapeHtml(item.ticker)}" style="padding:6px 10px">Remove</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function bindWatchlist() {
    const body = $("#watchlist-body");
    if (!body) return;

    body.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const ticker = target.dataset.ticker;
      if (!ticker) return;

      if (target.classList.contains("watchlist-remove")) {
        removeFromWatchlist(ticker);
        return;
      }

      if (target.classList.contains("watchlist-open")) {
        renderAnalysisPanel(ticker);
        document.getElementById("analysis-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function renderOwnershipMixChart(scenario) {
    const chart = state.charts.ownership;
    if (!chart || !scenario) return;

    const mix = scenario.mix?.length ? scenario.mix : data.overview.marketOverview.map((item) => ({ name: item.code, value: Number(String(item.count).replace(/,/g, "")) }));
    chart.setOption({
      tooltip: { trigger: "item" },
      color: ["#e55300", "#1a8754", "#2563eb", "#7c3aed"],
      series: [
        {
          type: "pie",
          radius: ["45%", "72%"],
          label: {
            formatter: "{b}",
            color: "#5c5850",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10
          },
          data: mix
        }
      ]
    });
  }

  function renderNetworkStats(scenario) {
    const statsGrid = $("#network-stat-grid");
    const snapshotGrid = $("#snapshot-grid");
    const note = $("#network-note");
    const brief = $("#network-brief");
    const edgeList = $("#network-edge-list");
    const evidenceBody = $("#network-evidence-body");

    if (note) note.textContent = scenario.note;

    if (statsGrid) {
      statsGrid.innerHTML = scenario.stats
        .map(
          (item) => `
            <div class="snapshot">
              <strong>${escapeHtml(item.value)}</strong>
              <span>${escapeHtml(item.label)}</span>
            </div>
          `
        )
        .join("");
    }

    if (snapshotGrid) {
      snapshotGrid.innerHTML = scenario.snapshots
        .map(
          (item) => `
            <div class="snapshot">
              <strong>${escapeHtml(item.value)}</strong>
              <span>${escapeHtml(item.label)}</span>
            </div>
          `
        )
        .join("");
    }

    if (brief) {
      brief.innerHTML = `
        <div class="callout-title">Scenario Brief</div>
        <p>${escapeHtml(scenario.description)}</p>
        <ul style="margin-top:10px">
          ${scenario.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      `;
    }

    if (edgeList) {
      edgeList.innerHTML = scenario.connectionHighlights
        .map(
          (item) => `
            <div class="list-row">
              <span class="mono muted">LINK</span>
              <span>${escapeHtml(item)}</span>
            </div>
          `
        )
        .join("");
    }

    if (evidenceBody) {
      evidenceBody.innerHTML = scenario.evidence
        .map(
          (row) => `
            <tr>
              <td><span class="type-badge tone-accent">${escapeHtml(row.relationType)}</span></td>
              <td>${row.href ? `<a class="entity-inline-link" href="${row.href}">${escapeHtml(row.sourceLabel)}</a>` : escapeHtml(row.sourceLabel)}</td>
              <td>${escapeHtml(row.targetLabel)}</td>
              <td class="right mono">${escapeHtml(row.pct)}</td>
              <td>${escapeHtml(row.sector)}</td>
              <td class="right mono">${formatPct(row.freeFloat || 0)}</td>
              <td>${escapeHtml(row.largestStrategicHolder)}</td>
              <td class="mono muted">${escapeHtml(row.evidence)}</td>
            </tr>
          `
        )
        .join("");
    }
  }

  function renderNetworkGraph(scenario) {
    const chart = state.charts.network;
    if (!chart || !scenario) return;

    chart.off("click");
    chart.setOption({
      animationDuration: 900,
      tooltip: {
        trigger: "item",
        formatter(params) {
          if (params.dataType === "edge") {
            const value = Number(params.data.value || 0);
            return `${params.data.source.replace(/^.*:/, "")} -> ${params.data.target.replace(/^.*:/, "")}<br>${params.data.relationType}<br>${formatPct(value)}`;
          }
          return `${params.data.name}<br>${params.data.kind}`;
        }
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          force: {
            repulsion: 220,
            edgeLength: 110,
            gravity: 0.06
          },
          emphasis: { focus: "adjacency" },
          label: {
            show: true,
            color: "#5c5850",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10
          },
          data: scenario.nodes.map((node) => ({
            ...node,
            itemStyle: {
              color: node.category === 0 ? "#e55300" : node.category === 1 ? "#2563eb" : node.category === 2 ? "#1a8754" : "#7c3aed"
            }
          })),
          links: scenario.links,
          lineStyle: { color: "rgba(0,0,0,0.12)", curveness: 0.08 }
        }
      ]
    });

    chart.on("click", (params) => {
      const href = params?.data?.href;
      if (href) {
        window.location.href = href;
      }
    });
  }

  function renderNetworkScenario(id) {
    const scenarios = getNetworkScenarios();
    if (!scenarios.length) return;

    const scenario = scenarios.find((item) => item.id === id) || scenarios[0];
    state.currentNetworkId = scenario.id;

    const select = $("#network-scenario-select");
    if (select) select.value = scenario.id;

    renderOwnershipMixChart(scenario);
    renderNetworkStats(scenario);
    renderNetworkGraph(scenario);
  }

  function bindNetworkControls() {
    const select = $("#network-scenario-select");
    const scenarios = getNetworkScenarios();
    if (!select || !scenarios.length) return;

    select.innerHTML = scenarios
      .map((scenario) => `<option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.title)}</option>`)
      .join("");

    if (!scenarios.some((scenario) => scenario.id === state.currentNetworkId)) {
      state.currentNetworkId = scenarios[0].id;
    }

    select.value = state.currentNetworkId;
    select.addEventListener("change", () => {
      renderNetworkScenario(select.value);
    });

    renderNetworkScenario(state.currentNetworkId);
  }

  function initAppCharts() {
    if (!window.echarts) {
      ["#app-ownership-chart", "#app-network-chart", "#app-heatmap-chart", "#app-sector-chart", "#analysis-price-chart"].forEach((selector) => {
        const el = $(selector);
        if (el) el.innerHTML = '<div class="muted-copy">ECharts CDN unavailable. Interactive chart not rendered.</div>';
      });
      return;
    }

    const ownershipEl = $("#app-ownership-chart");
    if (ownershipEl && !state.charts.ownership) {
      state.charts.ownership = window.echarts.init(ownershipEl, null, { renderer: "canvas" });
      window.addEventListener("resize", () => state.charts.ownership?.resize());
    }

    const networkEl = $("#app-network-chart");
    if (networkEl && !state.charts.network) {
      state.charts.network = window.echarts.init(networkEl, null, { renderer: "canvas" });
      window.addEventListener("resize", () => state.charts.network?.resize());
    }

    const heatmapEl = $("#app-heatmap-chart");
    if (heatmapEl) {
      const heatmapChart = window.echarts.init(heatmapEl, null, { renderer: "canvas" });
      heatmapChart.setOption({
        tooltip: {
          formatter(params) {
            const item = params.data;
            const sign = item.change > 0 ? "+" : "";
            return `${item.name}<br>${item.sector}<br>${sign}${item.change.toFixed(1)}%`;
          }
        },
        series: [
          {
            type: "treemap",
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              formatter(info) {
                const item = info.data;
                const sign = item.change > 0 ? "+" : "";
                return `${item.name}\n${sign}${item.change.toFixed(1)}%`;
              },
              color: "#fff",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11
            },
            upperLabel: { show: false },
            itemStyle: {
              borderWidth: 2,
              gapWidth: 2,
              borderColor: "#fafaf7"
            },
            data: data.heatmap.map((item) => ({
              name: item.ticker,
              value: item.cap,
              change: item.change,
              sector: item.sector,
              itemStyle: { color: colorByChange(item.change) }
            }))
          }
        ]
      });
      window.addEventListener("resize", () => heatmapChart.resize());
    }

    const sectorEl = $("#app-sector-chart");
    if (sectorEl) {
      const sectorRows = computeSectorExposure();
      const sectorChart = window.echarts.init(sectorEl, null, { renderer: "canvas" });
      sectorChart.setOption({
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter(params) {
            const rows = Array.isArray(params) ? params : [params];
            const sector = rows[0]?.axisValue || "Sector";
            const values = rows.map((row) => `${row.seriesName}: ${row.value}%`).join("<br>");
            const meta = sectorRows.find((item) => item.sector === sector);
            return `${sector}<br>${values}<br><span style="opacity:.72">Avg float ${formatPct(meta?.avgFloat || 0)} | High risk ${meta?.highRiskCount || 0}</span>`;
          }
        },
        legend: {
          top: 0,
          textStyle: { color: "#5c5850", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }
        },
        grid: { left: 50, right: 16, top: 34, bottom: 24 },
        xAxis: {
          type: "value",
          max: 100,
          axisLabel: { color: "#9c9890", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }
        },
        yAxis: {
          type: "category",
          data: sectorRows.map((item) => item.sector),
          axisLabel: { color: "#5c5850", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }
        },
        series: [
          {
            name: "Local",
            type: "bar",
            stack: "ownership",
            itemStyle: { color: "#1a8754" },
            data: sectorRows.map((item) => item.local)
          },
          {
            name: "Foreign",
            type: "bar",
            stack: "ownership",
            itemStyle: { color: "#2563eb" },
            data: sectorRows.map((item) => item.foreign)
          }
        ]
      });
      window.addEventListener("resize", () => sectorChart.resize());
    }
  }

  function initDashboard() {
    renderSidebar();
    renderAppLists();
    renderSpotlights();
    renderPositionRows();
    bindFloatSorting();
    bindFloatFilters();
    bindFloatTabs();
    bindFloatExport();
    initAppCharts();
    bindNetworkControls();
    attachSearch();
    bindAssistant();
    bindAnalysisControls();
    bindWatchlist();
    renderAnalysisPanel(state.analysisTicker);
    renderWatchlist();
  }

  function initAppScrollReveal() {
    const targets = document.querySelectorAll(".scroll-reveal");
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "app") return;
    enableDirectAccess();
    initDashboard();
    requestAnimationFrame(() => {
      document.querySelectorAll(".app-card").forEach((card, index) => {
        card.classList.add("scroll-reveal");
        card.style.transitionDelay = `${index * 0.06}s`;
      });
      initAppScrollReveal();
    });
  });
})();
