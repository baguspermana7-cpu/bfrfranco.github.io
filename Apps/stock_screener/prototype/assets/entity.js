(function () {
  const data = window.StockMapMock;
  const utils = window.StockMapUtils;

  if (!data || !utils || document.body.dataset.page !== "entity") {
    return;
  }

  const {
    $,
    collectInvestorPositions,
    computeTickerMetrics,
    entityHref,
    escapeHtml,
    formatPct,
    getDecisionEntry,
    getSourceEntry,
    parsePct,
    round2
  } = utils;

  function enableDirectAccess() {
    sessionStorage.setItem("idx_token", "prototype-token");
    return "prototype-token";
  }

  function wireSessionLinks() {
    const appLink = $("#entity-app-link");
    const backLink = $("#entity-back-link");
    if (appLink) appLink.href = "./app.html";
    if (backLink) backLink.href = "./app.html";
  }

  function buildTickerEntity(id) {
    const base = data.entities?.tickers?.[id];
    const source = getSourceEntry(id);
    if (!base || !source) return null;

    const metrics = computeTickerMetrics(base);
    const tags = [
      base.sector,
      `${metrics.risk} Risk`,
      `As of ${source.asOf}`,
      source.status === "ready" ? "Sourced" : "Review Required"
    ].filter(Boolean);

    return {
      kind: "ticker",
      id,
      name: base.name,
      eyebrow: "Ticker detail",
      summary: `${base.name} in sourced-coverage mode. Ownership metrics below are calculated from official issuer disclosures dated ${source.asOf}.`,
      tags,
      metrics: [
        { label: "Source Date", value: source.asOf },
        { label: "Source", value: source.sourceLabel },
        { label: "Free Float", value: formatPct(metrics.freeFloat) },
        { label: "Strategic Held", value: formatPct(metrics.strategicHeld) },
        { label: "Visible Coverage", value: formatPct(metrics.visibleHeld) },
        { label: "Risk", value: metrics.risk }
      ],
      localForeign: metrics.localForeign,
      styleBreakdown: null,
      summaryPoints: [
        `${source.sourceLabel} is the controlling source for this ticker, with snapshot date ${source.asOf}.`,
        `Largest strategic holder is ${metrics.largestStrategic?.name || "N/A"} at ${formatPct(metrics.largestStrategicPct)}.`,
        `Visible coverage is ${formatPct(metrics.visibleHeld)} and blind-spot float is ${formatPct(metrics.hiddenFloat)}.`,
        source.note
      ].filter(Boolean),
      holderTable: metrics.rows.map((row) => ({
        ...row,
        pct: row.pct || formatPct(row.pctValue),
        strategic: row.strategic
      })),
      related: (base.related || []).filter((item) => item.kind !== "group"),
      sourceStatus: source.status,
      source,
      decision: getDecisionEntry(id)
    };
  }

  function inferInvestorMeta(positions) {
    const typeCounts = new Map();
    const natCounts = new Map();

    positions.forEach((position) => {
      const type = String(position.focusRowType || "").trim() || "N/A";
      const nat = String(position.focusNat || "").trim() || "N/A";
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      natCounts.set(nat, (natCounts.get(nat) || 0) + 1);
    });

    const dominantType = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
    const dominantNat = Array.from(natCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      type: dominantType,
      nationality: dominantNat === "L" ? "Local" : dominantNat === "F" ? "Foreign" : "Mixed / Undisclosed"
    };
  }

  function buildInvestorEntity(id) {
    const manual = data.entities?.investors?.[id] || null;
    const seed = manual || {
      kind: "investor",
      id,
      name: id.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    };
    const positions = collectInvestorPositions(seed);
    if (!positions.length) return null;

    const meta = inferInvestorMeta(positions);
    const totalStake = round2(positions.reduce((sum, row) => sum + row.pctValue, 0));
    const avgFloat = round2(positions.reduce((sum, row) => sum + (row.floatRow?.freeFloat || 0), 0) / positions.length);
    const sectors = Array.from(new Set(positions.map((row) => row.sector).filter(Boolean)));
    const styleBreakdown = sectors
      .map((sector) => ({
        name: sector,
        value: round2(positions.filter((row) => row.sector === sector).reduce((sum, row) => sum + row.pctValue, 0))
      }))
      .sort((a, b) => b.value - a.value);

    return {
      kind: "investor",
      id,
      name: manual?.name || seed.name,
      eyebrow: "Investor detail",
      summary: `${manual?.name || seed.name} is derived only from issuer-sourced holder tables currently included in the app.`,
      tags: [
        meta.nationality,
        `Type ${meta.type}`,
        `${positions.length} sourced positions`
      ],
      metrics: [
        { label: "Visible Positions", value: String(positions.length) },
        { label: "Total Visible Stake", value: formatPct(totalStake) },
        { label: "Avg Target Float", value: formatPct(avgFloat) },
        { label: "Investor Type", value: meta.type },
        { label: "Nationality", value: meta.nationality }
      ],
      localForeign: null,
      styleBreakdown,
      summaryPoints: [
        `This page is computed from holder-table rows that explicitly reference ${manual?.name || seed.name}.`,
        `Current sourced coverage links this investor to ${positions.length} ticker(s) across ${sectors.length} sector(s).`,
        `Average target free float across those tickers is ${formatPct(avgFloat)}.`,
        "No synthetic holdings are injected into this page."
      ],
      holdings: positions.map((position) => ({
        ticker: position.ticker,
        company: position.company,
        pct: formatPct(position.pctValue)
      })),
      related: positions.slice(0, 4).map((position) => ({
        label: position.ticker,
        kind: "ticker",
        id: position.ticker
      }))
    };
  }

  function buildUnavailableEntity(kind, id) {
    return {
      kind,
      id,
      name: id,
      eyebrow: "Unavailable",
      summary: "This entity is not available in sourced-coverage mode.",
      tags: ["Unavailable"],
      metrics: [
        { label: "Status", value: "Unavailable" },
        { label: "Reason", value: "No sourced holder table" }
      ],
      localForeign: null,
      styleBreakdown: null,
      summaryPoints: [
        "Only issuer-sourced ticker coverage and investors derivable from those holder tables are exposed here.",
        "Fallback pages have been removed to avoid placeholder data."
      ],
      holdings: [],
      related: []
    };
  }

  function resolveEntity(kind, id) {
    if (kind === "ticker") return buildTickerEntity(id) || buildUnavailableEntity(kind, id);
    if (kind === "investor") return buildInvestorEntity(id) || buildUnavailableEntity(kind, id);
    return buildUnavailableEntity(kind, id);
  }

  function renderHero(entity) {
    const eyebrow = $("#entity-eyebrow");
    const title = $("#entity-title");
    const summary = $("#entity-summary");
    const tags = $("#entity-tags");
    const metrics = $("#entity-metrics");

    if (eyebrow) eyebrow.textContent = entity.eyebrow || "Entity detail";
    if (title) title.textContent = entity.name;
    if (summary) summary.textContent = entity.summary || "";

    if (tags) {
      tags.innerHTML = (entity.tags || [])
        .map((tag) => `<span class="type-badge tone-accent">${escapeHtml(tag)}</span>`)
        .join("");
    }

    if (metrics) {
      metrics.innerHTML = (entity.metrics || [])
        .map(
          (item) => `
            <div class="entity-metric">
              <strong>${escapeHtml(item.value)}</strong>
              <span>${escapeHtml(item.label)}</span>
            </div>
          `
        )
        .join("");
    }
  }

  function renderSummary(entity) {
    const summary = $("#entity-summary-points");
    const related = $("#entity-related");

    if (summary) {
      const sourceLink = entity.source?.sourceUrl
        ? [`<div class="entity-summary-item"><a class="entity-inline-link" href="${entity.source.sourceUrl}" target="_blank" rel="noreferrer">Open primary source</a></div>`]
        : [];

      summary.innerHTML = sourceLink.concat((entity.summaryPoints || [])
        .map((item) => `<div class="entity-summary-item">${escapeHtml(item)}</div>`)
      ).join("");
    }

    if (!related) return;
    if (!entity.related || !entity.related.length) {
      related.innerHTML = '<div class="entity-related-card">No related sourced entities available.</div>';
      return;
    }

    related.innerHTML = entity.related
      .map(
        (item) => `
          <a class="entity-related-card" href="${entityHref(item.kind, item.id)}">
            <strong>${escapeHtml(item.label)}</strong>
            <div class="muted-copy" style="margin-top:6px">${escapeHtml(item.kind)}</div>
          </a>
        `
      )
      .join("");
  }

  function renderTable(entity) {
    const head = $("#entity-table-head");
    const body = $("#entity-table-body");
    const title = $("#entity-table-title");

    if (!head || !body || !title) return;

    if (entity.kind === "ticker") {
      title.textContent = "Visible Holder Table";
      head.innerHTML = `
        <tr>
          <th scope="col">Holder</th>
          <th scope="col">Type</th>
          <th scope="col">L/F</th>
          <th scope="col" class="right">%</th>
          <th scope="col" class="right">Strategic</th>
        </tr>
      `;
      body.innerHTML = (entity.holderTable || [])
        .map((row) => {
          const linkedName = row.entityId
            ? `<a class="entity-inline-link" href="${entityHref(row.entityKind, row.entityId)}">${escapeHtml(row.name)}</a>`
            : escapeHtml(row.name);
          return `
            <tr>
              <td>${linkedName}</td>
              <td class="mono">${escapeHtml(row.type)}</td>
              <td class="mono">${escapeHtml(row.nat || "N/A")}</td>
              <td class="right mono">${escapeHtml(row.pct || formatPct(row.pctValue || 0))}</td>
              <td class="right ${row.strategic ? "risk-high" : "risk-low"}">${row.strategic ? "Yes" : "No"}</td>
            </tr>
          `;
        })
        .join("");
      return;
    }

    title.textContent = "Visible Holdings";
    head.innerHTML = `
      <tr>
        <th scope="col">Ticker</th>
        <th scope="col">Company</th>
        <th scope="col" class="right">%</th>
      </tr>
    `;

    if (!entity.holdings || !entity.holdings.length) {
      body.innerHTML = '<tr><td colspan="3" class="muted-copy">No sourced holdings available.</td></tr>';
      return;
    }

    body.innerHTML = entity.holdings
      .map(
        (row) => `
          <tr>
            <td class="mono"><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a></td>
            <td>${escapeHtml(row.company)}</td>
            <td class="right mono">${escapeHtml(row.pct)}</td>
          </tr>
        `
      )
      .join("");
  }

  function renderDecision(entity) {
    const section = $("#entity-decision-section");
    const title = $("#entity-decision-title");
    const operating = $("#entity-decision-operating");
    const protocol = $("#entity-decision-protocol");
    if (!section || !title || !operating || !protocol) return;

    if (entity.kind !== "ticker" || !entity.decision) {
      section.classList.add("hide");
      return;
    }

    section.classList.remove("hide");
    title.textContent = "Decision Layer";

    operating.innerHTML = [
      { label: "Earnings", tone: "tone-blue", value: entity.decision.earningsView, note: entity.decision.earningsNote },
      { label: "Balance / Debt", tone: "tone-green", value: entity.decision.balanceView, note: entity.decision.balanceNote },
      { label: "Catalyst", tone: "tone-violet", value: entity.decision.catalystView, note: entity.decision.catalystNote }
    ].map((item) => `
      <div class="entity-summary-item">
        <span class="type-badge ${item.tone}">${escapeHtml(item.label)}: ${escapeHtml(item.value)}</span>
        <div style="margin-top:8px">${escapeHtml(item.note)}</div>
      </div>
    `).join("");

    protocol.innerHTML = [
      entity.decision.valuationGate,
      `Allocation fit: ${entity.decision.allocationFit}. Multibagger fit: ${entity.decision.multibaggerFit}.`,
      `Decision source: ${entity.decision.sourceLabel} (${entity.decision.asOf}).`,
      `Watch items: ${(entity.decision.watchItems || []).join(", ")}.`
    ].map((item, index) => `
      <div class="entity-summary-item">
        ${index === 2 && entity.decision.sourceUrl ? `<a class="entity-inline-link" href="${entity.decision.sourceUrl}" target="_blank" rel="noreferrer">${escapeHtml(item)}</a>` : escapeHtml(item)}
      </div>
    `).join("");
  }

  function initCharts(entity) {
    const pieTarget = $("#entity-pie-chart");
    const barTarget = $("#entity-bar-chart");
    if (!pieTarget || !barTarget) return;

    if (!window.echarts) {
      pieTarget.innerHTML = '<div class="muted-copy">ECharts CDN unavailable.</div>';
      barTarget.innerHTML = '<div class="muted-copy">ECharts CDN unavailable.</div>';
      return;
    }

    const pieData = entity.localForeign || entity.styleBreakdown || [{ name: "Sourced rows", value: 100 }];
    const pieChart = window.echarts.init(pieTarget, null, { renderer: "canvas" });
    const chartTitle = $("#entity-chart-title");
    if (chartTitle) {
      chartTitle.textContent = entity.localForeign ? "Local vs Foreign" : "Composition";
    }
    pieChart.setOption({
      tooltip: { trigger: "item" },
      color: ["#1a8754", "#2563eb", "#e55300", "#7c3aed", "#dc2626"],
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
          data: pieData
        }
      ]
    });

    const barChart = window.echarts.init(barTarget, null, { renderer: "canvas" });
    const barRows = entity.kind === "ticker"
      ? (entity.holderTable || []).map((row) => ({
          name: row.name.length > 24 ? `${row.name.slice(0, 24)}...` : row.name,
          value: parsePct(row.pct)
        }))
      : (entity.holdings || []).map((row) => ({
          name: row.ticker,
          value: parsePct(row.pct)
        }));

    const barTitle = $("#entity-bar-title");
    if (barTitle) {
      barTitle.textContent = entity.kind === "ticker" ? "Holder Weight" : "Holding Weight";
    }
    barChart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 50, right: 16, top: 10, bottom: 30 },
      xAxis: {
        type: "category",
        data: barRows.map((row) => row.name),
        axisLabel: {
          interval: 0,
          rotate: 30,
          color: "#5c5850",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 9
        }
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#9c9890",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10
        }
      },
      series: [
        {
          type: "bar",
          data: barRows.map((row) => row.value),
          itemStyle: { color: "#e55300", borderRadius: [6, 6, 0, 0] }
        }
      ]
    });

    window.addEventListener("resize", () => {
      pieChart.resize();
      barChart.resize();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const token = enableDirectAccess();
    if (!token) return;

    wireSessionLinks();

    const params = new URLSearchParams(window.location.search);
    const kind = params.get("kind") || "ticker";
    const rawId = params.get("id") || "BBCA";
    const id = kind === "ticker" ? rawId.toUpperCase() : rawId;
    const entity = resolveEntity(kind, id);

    renderHero(entity);
    renderSummary(entity);
    renderDecision(entity);
    renderTable(entity);
    initCharts(entity);
  });
})();
