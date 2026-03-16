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
    computeSectorExposure,
    entityAnchor,
    entityHref,
    escapeHtml,
    filterFloatRows,
    formatPct,
    getFloatRows,
    getNetworkScenarios,
    getSourceLedgerRows,
    isAllowedToken,
    riskClass,
    round2,
    searchEntities,
    toCsv
  } = utils;

  const SAVED_KEY = "stockmap_saved_tickers";
  const state = {
    currentTab: "mid",
    sortKey: "freeFloat",
    sortDir: "asc",
    sectorFilter: "all",
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
      results.innerHTML = '<div class="search-item">No sourced result.</div>';
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
      { id: "overview-section", label: "Overview", note: "Source status" },
      { id: "screener-section", label: "Float Screener", note: "Sourced rows" },
      { id: "network-section", label: "Network", note: "Issuer overlap" },
      { id: "source-section", label: "Source Ledger", note: "As-of dates" },
      { id: "saved-section", label: "Saved Tickers", note: "Local storage" }
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

  function parseAsOf(value) {
    const match = String(value || "").match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
    if (!match) return 0;
    const monthMap = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    return new Date(Number(match[3]), monthMap[match[2]] ?? 0, Number(match[1])).getTime();
  }

  function renderTopStats(currentRows) {
    const container = $("#app-top-stats");
    if (!container) return;

    const ledger = getSourceLedgerRows({ includeReview: true });
    const readyCount = ledger.filter((row) => row.status === "ready").length;
    const reviewCount = ledger.filter((row) => row.status !== "ready").length;
    const latest = ledger.slice().sort((a, b) => parseAsOf(b.asOf) - parseAsOf(a.asOf))[0]?.asOf || "N/A";
    const recurringInvestors = getNetworkScenarios().filter((item) => item.type === "investor").length;

    const items = [
      { label: "Ready Tickers", value: String(readyCount) },
      { label: "Review Queue", value: String(reviewCount) },
      { label: "Investor Scenarios", value: String(recurringInvestors) },
      { label: "Latest Source", value: latest },
      { label: "Rows in View", value: String(currentRows.length) }
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

  function renderOverviewPanels() {
    const coverage = $("#coverage-summary-list");
    const discipline = $("#source-discipline-list");
    const latest = $("#latest-source-list");
    const patterns = $("#holder-pattern-list");
    const ledger = getSourceLedgerRows({ includeReview: true });
    const ready = ledger.filter((row) => row.status === "ready");
    const scenarios = getNetworkScenarios().filter((row) => row.type === "investor");

    if (coverage) {
      coverage.innerHTML = [
        { label: "Analytics universe", value: `${ready.length} ready tickers` },
        { label: "Review exclusions", value: `${ledger.length - ready.length} ticker` },
        { label: "Mode", value: data.meta?.coverageMode || "Official-source-only" },
        { label: "Synthetic rows", value: "0" }
      ].map((item) => `
        <div class="list-row">
          <span>${escapeHtml(item.label)}</span>
          <span class="mono muted">${escapeHtml(item.value)}</span>
        </div>
      `).join("");
    }

    if (discipline) {
      discipline.innerHTML = [
        "Only issuer disclosures are rendered in the app shell.",
        "Ticker analytics exclude review-required names until strategic classification is defensible.",
        "Each row keeps its own as-of date; no fake same-day market snapshot is implied.",
        "Investor pages are derived from holder-table evidence only."
      ].map((item) => `
        <div class="list-row">
          <span class="mono muted">RULE</span>
          <span>${escapeHtml(item)}</span>
        </div>
      `).join("");
    }

    if (latest) {
      latest.innerHTML = ready
        .slice()
        .sort((a, b) => parseAsOf(b.asOf) - parseAsOf(a.asOf))
        .slice(0, 4)
        .map((row) => `
          <div class="list-row">
            <span><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a></span>
            <span class="mono muted">${escapeHtml(row.asOf)}</span>
          </div>
        `)
        .join("");
    }

    if (patterns) {
      if (!scenarios.length) {
        patterns.innerHTML = '<div class="list-row"><span>No recurring named holders yet.</span></div>';
      } else {
        patterns.innerHTML = scenarios
          .slice(0, 6)
          .map((scenario) => `
            <div class="list-row">
              <span>${entityAnchor(scenario.label)}</span>
              <span class="mono muted">${escapeHtml(scenario.stats.find((item) => item.label === "Positions")?.value || "0")} positions</span>
            </div>
          `)
          .join("");
      }
    }
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
      .filter((row) => state.sectorFilter === "all" || row.sector === state.sectorFilter)
      .slice();

    rows.sort((a, b) => {
      const compare = compareValues(a, b, state.sortKey);
      return state.sortDir === "asc" ? compare : compare * -1;
    });

    return rows;
  }

  function renderFloatAnalyticsGrid(rows) {
    const container = $("#float-analytics-grid");
    if (!container) return;

    const avgFloat = rows.length ? round2(rows.reduce((sum, row) => sum + row.freeFloat, 0) / rows.length) : 0;
    const avgStrategic = rows.length ? round2(rows.reduce((sum, row) => sum + row.totalHeld, 0) / rows.length) : 0;
    const avgBlindSpot = rows.length ? round2(rows.reduce((sum, row) => sum + row.blindSpot, 0) / rows.length) : 0;
    const avgHHI = rows.length ? round2(rows.reduce((sum, row) => sum + row.hhi, 0) / rows.length) : 0;
    const highRisk = rows.filter((row) => row.risk === "High").length;

    const cards = [
      { label: "Avg Free Float", value: formatPct(avgFloat) },
      { label: "Avg Strategic Held", value: formatPct(avgStrategic) },
      { label: "Avg Blind Spot", value: formatPct(avgBlindSpot) },
      { label: "Avg HHI", value: avgHHI.toFixed(0) },
      { label: "High Risk", value: String(highRisk) },
      { label: "Rows", value: String(rows.length) }
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
      const latest = rows.slice().sort((a, b) => parseAsOf(b.asOf) - parseAsOf(a.asOf))[0]?.asOf || "N/A";
      note.textContent = `${rows.length} sourced row(s) in view. 0 synthetic rows. Latest snapshot among visible rows: ${latest}.`;
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
        const mix = item.localPct || item.foreignPct ? `${round2(item.localPct)} / ${round2(item.foreignPct)}` : "-";
        return `
          <tr>
            <td class="mono" style="font-weight:700;color:var(--accent)"><a class="entity-inline-link" href="${entityHref("ticker", item.ticker)}">${escapeHtml(item.ticker)}</a></td>
            <td>${escapeHtml(item.company)}</td>
            <td>${escapeHtml(item.sector)}</td>
            <td>${entityAnchor(item.largestStrategicHolder)}</td>
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
        state.currentTab = tab.dataset.tab || "mid";
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
    if (!sectorSelect) return;

    const sectors = Array.from(new Set(getFloatRows().map((row) => row.sector).filter(Boolean))).sort();
    sectorSelect.innerHTML = ["<option value=\"all\">All sectors</option>", ...sectors.map((sector) => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`)].join("");
    sectorSelect.value = state.sectorFilter;

    sectorSelect.addEventListener("change", () => {
      state.sectorFilter = sectorSelect.value || "all";
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
        { label: "Largest Strategic Holder", value: "largestStrategicHolder" },
        { label: "Strategic Held", value: (row) => formatPct(row.totalHeld) },
        { label: "Free Float", value: (row) => formatPct(row.freeFloat) },
        { label: "Visible Coverage", value: (row) => formatPct(row.visibleHeld) },
        { label: "Blind Spot", value: (row) => formatPct(row.blindSpot) },
        { label: "HHI", value: (row) => row.hhi.toFixed(0) },
        { label: "Local Visible", value: (row) => row.localPct || "" },
        { label: "Foreign Visible", value: (row) => row.foreignPct || "" },
        { label: "Risk", value: "risk" },
        { label: "Signal", value: "signalSummary" },
        { label: "As Of", value: "asOf" },
        { label: "Source", value: "sourceLabel" }
      ]);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stockmap-sourced-float-${state.currentTab}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
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

  function renderOwnershipMixChart(scenario) {
    const chart = state.charts.ownership;
    if (!chart || !scenario) return;

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
          data: scenario.mix || []
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
        .map((item) => `
          <div class="snapshot">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `)
        .join("");
    }

    if (snapshotGrid) {
      snapshotGrid.innerHTML = scenario.snapshots
        .map((item) => `
          <div class="snapshot">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </div>
        `)
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
        .map((item) => `
          <div class="list-row">
            <span class="mono muted">LINK</span>
            <span>${escapeHtml(item)}</span>
          </div>
        `)
        .join("");
    }

    if (evidenceBody) {
      evidenceBody.innerHTML = scenario.evidence
        .map((row) => `
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
        `)
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

  function readSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeSaved(items) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items));
  }

  function addSaved(ticker) {
    const items = readSaved();
    if (items.includes(ticker)) {
      renderSaved();
      return;
    }
    items.unshift(ticker);
    writeSaved(items);
    renderSaved();
  }

  function removeSaved(ticker) {
    writeSaved(readSaved().filter((item) => item !== ticker));
    renderSaved();
  }

  function renderSourceLedger() {
    const body = $("#source-ledger-body");
    const notes = $("#source-ledger-note-list");
    if (!body || !notes) return;

    const rows = getSourceLedgerRows({ includeReview: true });
    const floatRows = getFloatRows();

    body.innerHTML = rows
      .map((row) => {
        const floatRow = floatRows.find((item) => item.ticker === row.ticker) || null;
        const statusTone = row.status === "ready" ? "tone-green" : "tone-red";
        return `
          <tr>
            <td class="mono"><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a></td>
            <td>${escapeHtml(row.company)}</td>
            <td class="mono">${escapeHtml(row.asOf)}</td>
            <td>${row.sourceUrl ? `<a class="entity-inline-link" href="${row.sourceUrl}" target="_blank" rel="noreferrer">${escapeHtml(row.sourceLabel)}</a>` : escapeHtml(row.sourceLabel)}</td>
            <td><span class="type-badge ${statusTone}">${escapeHtml(row.status.replace(/_/g, " "))}</span></td>
            <td class="right mono">${floatRow ? formatPct(floatRow.freeFloat) : "N/A"}</td>
            <td>${escapeHtml(row.note)}</td>
            <td><button class="ghost-btn save-ticker-btn" type="button" data-ticker="${escapeHtml(row.ticker)}" ${row.status !== "ready" ? "disabled" : ""}>Save</button></td>
          </tr>
        `;
      })
      .join("");

    notes.innerHTML = rows
      .slice(0, 5)
      .map((row) => `
        <div class="list-row">
          <span class="mono muted">${escapeHtml(row.ticker)}</span>
          <span>${row.sourceUrl ? `<a class="entity-inline-link" href="${row.sourceUrl}" target="_blank" rel="noreferrer">${escapeHtml(row.sourceLabel)}</a>` : escapeHtml(row.sourceLabel)}${row.note ? ` - ${escapeHtml(row.note)}` : ""}</span>
        </div>
      `)
      .join("");
  }

  function renderSaved() {
    const body = $("#saved-body");
    if (!body) return;

    const saved = readSaved();
    const floatRows = getFloatRows();
    const ledger = getSourceLedgerRows({ includeReview: true });

    if (!saved.length) {
      body.innerHTML = '<tr><td colspan="6" class="muted-copy">No saved tickers yet. Save one from the source ledger.</td></tr>';
      return;
    }

    body.innerHTML = saved
      .map((ticker) => {
        const floatRow = floatRows.find((item) => item.ticker === ticker);
        const sourceRow = ledger.find((item) => item.ticker === ticker);
        return `
          <tr>
            <td class="mono"><a class="entity-inline-link" href="${entityHref("ticker", ticker)}">${escapeHtml(ticker)}</a></td>
            <td>${escapeHtml(sourceRow?.company || ticker)}</td>
            <td class="mono">${escapeHtml(sourceRow?.asOf || "N/A")}</td>
            <td class="right mono">${floatRow ? formatPct(floatRow.freeFloat) : "N/A"}</td>
            <td class="right ${floatRow ? riskClass(floatRow.risk) : ""}">${escapeHtml(floatRow?.risk || "N/A")}</td>
            <td>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <a class="ghost-btn" href="${entityHref("ticker", ticker)}" style="padding:6px 10px">Open</a>
                <button class="ghost-btn saved-remove-btn" type="button" data-ticker="${escapeHtml(ticker)}" style="padding:6px 10px">Remove</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function bindSavedControls() {
    const ledgerBody = $("#source-ledger-body");
    const savedBody = $("#saved-body");

    if (ledgerBody) {
      ledgerBody.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains("save-ticker-btn")) return;
        const ticker = target.dataset.ticker;
        if (ticker) addSaved(ticker);
      });
    }

    if (savedBody) {
      savedBody.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains("saved-remove-btn")) return;
        const ticker = target.dataset.ticker;
        if (ticker) removeSaved(ticker);
      });
    }
  }

  function initAppCharts() {
    if (!window.echarts) {
      ["#app-ownership-chart", "#app-network-chart", "#app-sector-chart"].forEach((selector) => {
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

    const sectorEl = $("#app-sector-chart");
    if (sectorEl) {
      const sectorRows = computeSectorExposure();
      if (!sectorRows.length) {
        sectorEl.innerHTML = '<div class="muted-copy">Sector mix is shown only for sectors with explicit local-versus-foreign disclosure.</div>';
        return;
      }
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
            return `${sector}<br>${values}<br><span style="opacity:.72">Avg float ${formatPct(meta?.avgFloat || 0)} | Names ${meta?.names || 0}</span>`;
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
          data: sectorRows.map((row) => row.sector),
          axisLabel: { color: "#5c5850", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }
        },
        series: [
          {
            name: "Local",
            type: "bar",
            stack: "ownership",
            itemStyle: { color: "#1a8754" },
            data: sectorRows.map((row) => row.local)
          },
          {
            name: "Foreign",
            type: "bar",
            stack: "ownership",
            itemStyle: { color: "#2563eb" },
            data: sectorRows.map((row) => row.foreign)
          }
        ]
      });
      window.addEventListener("resize", () => sectorChart.resize());
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const token = enableDirectAccess();
    if (!token) return;

    initAppCharts();
    renderSidebar();
    attachSearch();
    renderOverviewPanels();
    bindAssistant();
    bindFloatFilters();
    bindFloatSorting();
    bindFloatTabs();
    bindFloatExport();
    bindNetworkControls();
    renderSourceLedger();
    renderSaved();
    bindSavedControls();
  });
})();
