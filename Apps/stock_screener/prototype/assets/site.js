(function () {
  const data = window.StockMapMock;
  const utils = window.StockMapUtils;

  if (!data || !utils) {
    return;
  }

  const {
    $,
    entityAnchor,
    entityHref,
    escapeHtml,
    formatPct,
    getFloatRows,
    getNetworkScenarios,
    getSourceLedgerRows,
    riskClass,
    searchEntities
  } = utils;

  function parseAsOf(value) {
    const match = String(value || "").match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
    if (!match) return 0;
    const monthMap = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    return new Date(Number(match[3]), monthMap[match[2]] ?? 0, Number(match[1])).getTime();
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

  function attachSearch(inputSelector, resultsSelector) {
    const input = $(inputSelector);
    const results = $(resultsSelector);
    if (!input || !results) return;

    function runSearch() {
      const query = input.value.trim();
      if (!query) {
        results.classList.remove("is-open");
        return;
      }
      renderSearchResults(results, searchEntities(query, 6));
    }

    input.addEventListener("input", runSearch);
    input.addEventListener("focus", () => renderSearchResults(results, searchEntities(input.value.trim(), 6)));

    document.addEventListener("click", (event) => {
      if (!results.contains(event.target) && event.target !== input) {
        results.classList.remove("is-open");
      }
    });
  }

  function renderLandingStats() {
    const container = $("#landing-stats");
    const mini = $("#landing-mini-stats");
    if (!container || !mini) return;

    const ledger = getSourceLedgerRows({ includeReview: true });
    const ready = ledger.filter((row) => row.status === "ready");
    const scenarios = getNetworkScenarios().filter((row) => row.type === "investor");
    const stats = [
      { label: "Ready Tickers", value: String(ready.length) },
      { label: "Review Queue", value: String(ledger.length - ready.length) },
      { label: "Investor Scenarios", value: String(scenarios.length) },
      { label: "Synthetic Rows", value: "0" }
    ];

    const html = stats
      .map((item) => `
        <div class="stat-item reveal">
          <div class="stat-num">${escapeHtml(item.value)}</div>
          <div class="stat-label">${escapeHtml(item.label)}</div>
        </div>
      `)
      .join("");

    container.innerHTML = html;
    mini.innerHTML = stats
      .map((item) => `
        <div class="mini-stat">
          <div class="mini-stat-value">${escapeHtml(item.value)}</div>
          <div class="mini-stat-label">${escapeHtml(item.label)}</div>
        </div>
      `)
      .join("");
  }

  function renderFeatureCards() {
    const container = $("#feature-grid");
    if (!container) return;

    const cards = [
      {
        icon: "Source",
        title: "Official Source Ledger",
        body: "Every ticker in analytics carries a primary issuer disclosure label and an explicit as-of date."
      },
      {
        icon: "Float",
        title: "Sourced Float Screener",
        body: "No synthetic rows. Free-float calculations run only on ready-status issuer disclosures."
      },
      {
        icon: "Graph",
        title: "Issuer-Derived Networks",
        body: "Investor-ticker scenarios are assembled from recurring holder-table evidence, not authored placeholder links."
      },
      {
        icon: "Scope",
        title: "Coverage Discipline",
        body: "Review-required names remain visible in the ledger but stay out of analytics until classification is defensible."
      }
    ];

    container.innerHTML = cards
      .map((item) => `
        <article class="feature-card reveal">
          <div class="feature-icon">${escapeHtml(item.icon)}</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
        </article>
      `)
      .join("");
  }

  function renderCoveragePanels() {
    const coverage = $("#landing-coverage-list");
    const latest = $("#landing-latest-list");
    const holders = $("#landing-holder-list");
    const rules = $("#landing-rule-list");
    const ledger = getSourceLedgerRows({ includeReview: true });
    const ready = ledger.filter((row) => row.status === "ready");
    const investorScenarios = getNetworkScenarios().filter((row) => row.type === "investor");

    if (coverage) {
      coverage.innerHTML = [
        { label: "Analytics universe", value: `${ready.length} ready tickers` },
        { label: "Coverage mode", value: data.meta?.coverageMode || "Official-source-only" },
        { label: "Latest coverage date", value: data.meta?.coverageDate || "N/A" }
      ].map((item) => `
        <div class="list-row">
          <span>${escapeHtml(item.label)}</span>
          <span class="mono muted">${escapeHtml(item.value)}</span>
        </div>
      `).join("");
    }

    if (latest) {
      latest.innerHTML = ready
        .slice()
        .sort((a, b) => parseAsOf(b.asOf) - parseAsOf(a.asOf))
        .slice(0, 4)
        .map((item) => `
          <div class="list-row">
            <span><a class="entity-inline-link" href="${entityHref("ticker", item.ticker)}">${escapeHtml(item.ticker)}</a></span>
            <span class="mono muted">${escapeHtml(item.asOf)}</span>
          </div>
        `)
        .join("");
    }

    if (holders) {
      holders.innerHTML = investorScenarios
        .slice(0, 4)
        .map((item) => `
          <div class="list-row">
            <span>${entityAnchor(item.label)}</span>
            <span class="mono muted">${escapeHtml(item.stats.find((row) => row.label === "Positions")?.value || "0")} positions</span>
          </div>
        `)
        .join("");
    }

    if (rules) {
      rules.innerHTML = [
        "No placeholder screener rows.",
        "No fallback entity pages.",
        "Issuer dates are shown as disclosed, not normalized into a fake live tape.",
        "Review-required names stay outside analytics."
      ].map((item) => `
        <div class="list-row">
          <span class="mono muted">RULE</span>
          <span>${escapeHtml(item)}</span>
        </div>
      `).join("");
    }
  }

  function renderFloatPreview() {
    const body = $("#free-float-preview-body");
    if (!body) return;

    const rows = getFloatRows().slice().sort((a, b) => a.freeFloat - b.freeFloat).slice(0, 6);
    body.innerHTML = rows
      .map((item) => `
        <tr>
          <td class="mono" style="font-weight:700;color:var(--accent)"><a class="entity-inline-link" href="${entityHref("ticker", item.ticker)}">${escapeHtml(item.ticker)}</a></td>
          <td>${escapeHtml(item.holder)}</td>
          <td class="right mono">${formatPct(item.totalHeld)}</td>
          <td class="right mono ${riskClass(item.risk)}">${formatPct(item.freeFloat)}</td>
        </tr>
      `)
      .join("");
  }

  function renderSourcePreview() {
    const body = $("#landing-source-body");
    if (!body) return;

    body.innerHTML = getSourceLedgerRows({ includeReview: true })
      .slice()
      .sort((a, b) => parseAsOf(b.asOf) - parseAsOf(a.asOf))
      .slice(0, 6)
      .map((row) => `
        <tr>
          <td class="mono"><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a></td>
          <td class="mono">${escapeHtml(row.asOf)}</td>
          <td>${row.sourceUrl ? `<a class="entity-inline-link" href="${row.sourceUrl}" target="_blank" rel="noreferrer">${escapeHtml(row.sourceLabel)}</a>` : escapeHtml(row.sourceLabel)}</td>
          <td><span class="type-badge ${row.status === "ready" ? "tone-green" : "tone-red"}">${escapeHtml(row.status.replace(/_/g, " "))}</span></td>
        </tr>
      `)
      .join("");
  }

  function initLandingCharts() {
    if (!window.echarts) {
      const networkFallback = $("#landing-network-chart");
      if (networkFallback) networkFallback.innerHTML = '<div class="muted-copy">ECharts CDN unavailable. Network graph not rendered.</div>';
      return;
    }

    const networkEl = $("#landing-network-chart");
    if (!networkEl) return;

    const scenario = getNetworkScenarios()[0] || null;
    if (!scenario) {
      networkEl.innerHTML = '<div class="muted-copy">No sourced network scenario available.</div>';
      return;
    }

    const chart = window.echarts.init(networkEl, null, { renderer: "canvas" });
    chart.setOption({
      animationDuration: 900,
      tooltip: { trigger: "item" },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          label: {
            show: true,
            color: "#5c5850",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10
          },
          force: {
            repulsion: 190,
            edgeLength: 96
          },
          data: scenario.nodes.map((node) => ({
            ...node,
            symbolSize: node.symbolSize || node.value,
            itemStyle: {
              color: node.category === 0 ? "#e55300" : node.category === 1 ? "#2563eb" : node.category === 2 ? "#1a8754" : "#7c3aed"
            }
          })),
          links: scenario.links,
          lineStyle: {
            color: "rgba(0,0,0,0.12)",
            width: 1.5
          }
        }
      ]
    });
    window.addEventListener("resize", () => chart.resize());
  }

  function renderMethodology() {
    const stats = $("#method-stats");
    const classBody = $("#method-classification-body");
    const rules = $("#method-id-rules");
    const limitations = $("#method-limitations");

    if (stats) {
      stats.innerHTML = data.methodology.stats
        .map((item) => `
          <div class="method-stat">
            <div class="method-stat-value">${escapeHtml(item.value)}</div>
            <div class="method-stat-label">${escapeHtml(item.label)}</div>
          </div>
        `)
        .join("");
    }

    if (classBody) {
      classBody.innerHTML = data.methodology.classifications
        .map((item) => `
          <tr>
            <td class="mono" style="font-weight:700">${escapeHtml(item.code)}</td>
            <td>${escapeHtml(item.type)}</td>
            <td class="mono">${escapeHtml(item.classification)}</td>
            <td>${escapeHtml(item.rationale)}</td>
          </tr>
        `)
        .join("");
    }

    if (rules) {
      rules.innerHTML = data.methodology.idRules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("");
    }

    if (limitations) {
      limitations.innerHTML = data.methodology.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    attachSearch("#landing-search-input", "#landing-search-results");
    renderLandingStats();
    renderFeatureCards();
    renderCoveragePanels();
    renderFloatPreview();
    renderSourcePreview();
    initLandingCharts();
    renderMethodology();
  });
})();
