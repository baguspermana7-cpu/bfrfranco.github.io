(function () {
  const data = window.StockMapMock;
  const utils = window.StockMapUtils;

  if (!data || !utils || document.body.dataset.page !== "entity") {
    return;
  }

  const {
    $,
    computeLocalForeign,
    computeTickerMetrics,
    entityHref,
    escapeHtml,
    findSearchItem,
    formatPct,
    getFloatRows,
    isStrategicHolder,
    normalize,
    parsePct,
    riskClass,
    searchEntities
  } = utils;

  function enableDirectAccess() {
    sessionStorage.setItem("idx_token", "prototype-token");
    return "prototype-token";
  }

  function wireSessionLinks(token) {
    const appLink = $("#entity-app-link");
    const backLink = $("#entity-back-link");
    if (appLink) appLink.href = "./app.html";
    if (backLink) backLink.href = "./app.html";
  }

  function formatMarketCap(value) {
    if (!Number.isFinite(value)) return "N/A";
    return `Rp${value.toLocaleString("en-US")}T`;
  }

  function patchTickerMetrics(baseMetrics, analytics, marketCap) {
    const metrics = (baseMetrics || []).map((item) => {
      if (item.label === "Market Cap") return { ...item, value: formatMarketCap(marketCap) };
      if (item.label === "Free Float") return { ...item, value: formatPct(analytics.freeFloat) };
      if (item.label === "Visible Held" || item.label === "Total Held") return { ...item, value: formatPct(analytics.visibleHeld) };
      if (item.label === "Strategic Held") return { ...item, value: formatPct(analytics.strategicHeld) };
      if (item.label === "Liquidity Risk" || item.label === "Risk") return { label: "Risk", value: analytics.risk };
      return item;
    });

    if (!metrics.some((item) => item.label === "Free Float")) {
      metrics.unshift({ label: "Free Float", value: formatPct(analytics.freeFloat) });
    }

    if (!metrics.some((item) => item.label === "Visible Held")) {
      metrics.splice(Math.min(1, metrics.length), 0, { label: "Visible Held", value: formatPct(analytics.visibleHeld) });
    }

    if (!metrics.some((item) => item.label === "Strategic Held")) {
      metrics.splice(Math.min(2, metrics.length), 0, { label: "Strategic Held", value: formatPct(analytics.strategicHeld) });
    }

    if (!metrics.some((item) => item.label === "Risk")) {
      metrics.push({ label: "Risk", value: analytics.risk });
    }

    return metrics;
  }

  function hydrateTickerEntity(entity) {
    const analytics = computeTickerMetrics(entity);
    const tags = Array.from(new Set([...(entity.tags || []).filter((tag) => !/risk/i.test(tag)), `${analytics.risk} Float Risk`]));

    return {
      ...entity,
      tags,
      metrics: patchTickerMetrics(entity.metrics, analytics, entity.marketCap),
      localForeign: entity.localForeign?.length ? entity.localForeign : analytics.localForeign,
      holderTable: analytics.rows.map((row) => ({
        ...row,
        pct: row.pct || formatPct(row.pctValue),
        strategic: row.strategic
      })),
      _fallback: false
    };
  }

  function buildFallbackTickerEntity(id) {
    const floatRow = getFloatRows().find((item) => item.ticker === id) || data.freeFloat.find((item) => item.ticker === id);
    const heatmapRow = data.heatmap.find((item) => item.ticker === id);
    const sampleRows = [...data.hiddenPositions, ...data.norwayPositions]
      .filter((item) => item.ticker === id)
      .map((row) => ({
        name: row.investor,
        type: row.type,
        nat: row.nationality,
        pct: row.pct,
        strategic: isStrategicHolder(row)
      }));

    const localForeign = sampleRows.length
      ? computeLocalForeign(sampleRows.map((row) => ({ ...row, pctValue: parsePct(row.pct) })))
      : null;

    return {
      kind: "ticker",
      id,
      name: floatRow?.company || `${id} detail`,
      eyebrow: "Ticker detail",
      summary: "Fallback ticker page generated from aggregate prototype tables. It prevents dead-end navigation but does not replace a fully authored research page.",
      tags: [heatmapRow?.sector || "Unknown Sector", floatRow?.risk ? `${floatRow.risk} Risk` : "Prototype"],
      metrics: [
        { label: "Market Cap", value: heatmapRow ? formatMarketCap(heatmapRow.cap) : "N/A" },
        { label: "Free Float", value: floatRow ? formatPct(floatRow.freeFloat) : "N/A" },
        { label: "Strategic Held", value: floatRow ? formatPct(floatRow.totalHeld) : "N/A" },
        { label: "Visible Held", value: floatRow ? formatPct(floatRow.visibleHeld || floatRow.totalHeld) : "N/A" },
        { label: "Daily Change", value: heatmapRow ? `${heatmapRow.change > 0 ? "+" : ""}${heatmapRow.change}%` : "N/A" },
        { label: "Risk", value: floatRow?.risk || "Unknown" }
      ],
      localForeign,
      styleBreakdown: localForeign ? null : [{ name: "Fallback summary", value: 100 }],
      summaryPoints: [
        "This page is assembled from screener rows and sample hidden-position tables rather than a dedicated authored profile.",
        "Fallback entities keep navigation intact while making the coverage gap explicit.",
        "A production entity page should add evidence trails, source links, and a complete holder table."
      ],
      holderTable: sampleRows.length
        ? sampleRows
        : [
            {
              name: floatRow?.holder || "Prototype row not authored",
              type: "N/A",
              nat: "N/A",
              pct: floatRow ? formatPct(Math.max(0, 100 - floatRow.freeFloat)) : "N/A",
              strategic: true
            }
          ],
      related: [],
      _fallback: true
    };
  }

  function buildFallbackInvestorEntity(id) {
    const searchItem = findSearchItem(id) || searchEntities(id, 1)[0];
    const displayName = searchItem?.label || id.replace(/-/g, " ").toUpperCase();
    const rows = [...data.hiddenPositions, ...data.norwayPositions].filter((row) => {
      const investorName = normalize(row.investor);
      const target = normalize(displayName);
      return investorName.includes(target) || target.includes(investorName);
    });

    return {
      kind: "investor",
      id,
      name: displayName,
      eyebrow: "Investor detail",
      summary: "Fallback investor page generated because this entity appears in linked sample data but does not yet have a dedicated authored profile.",
      tags: ["Investor", rows[0]?.nationality === "F" ? "Foreign" : "Local", "Prototype"],
      metrics: [
        { label: "Visible Positions", value: String(rows.length || 0) },
        { label: "Nationality", value: rows[0]?.nationality === "F" ? "Foreign" : rows[0]?.nationality === "L" ? "Local" : "N/A" },
        { label: "Investor Type", value: rows[0]?.type || "N/A" },
        { label: "Affiliated", value: "Unknown" }
      ],
      styleBreakdown: [{ name: "Visible rows", value: rows.length || 1 }],
      summaryPoints: [
        "Fallback investor pages keep search results and sample tables navigable.",
        "The next product step is adding beneficial-owner interpretation and historical changes.",
        "Linked holdings below come only from the visible prototype rows, not a complete portfolio." 
      ],
      holdings: rows.map((row) => ({
        ticker: row.ticker,
        company: row.ticker,
        pct: row.pct
      })),
      related: [],
      _fallback: true
    };
  }

  function buildFallbackEntity(kind, id) {
    if (kind === "ticker") return buildFallbackTickerEntity(id);
    if (kind === "investor") return buildFallbackInvestorEntity(id);

    return {
      kind,
      id,
      name: id,
      eyebrow: "Entity detail",
      summary: "Fallback entity profile.",
      tags: ["Prototype"],
      metrics: [
        { label: "Status", value: "Draft" },
        { label: "Kind", value: kind },
        { label: "Records", value: "0" },
        { label: "Coverage", value: "Partial" }
      ],
      styleBreakdown: [{ name: "Prototype", value: 100 }],
      summaryPoints: ["This entity is not fully authored yet."],
      holdings: [],
      related: [],
      _fallback: true
    };
  }

  function resolveEntity(kind, id) {
    if (kind === "ticker" && data.entities.tickers[id]) return hydrateTickerEntity(data.entities.tickers[id]);
    if (kind === "investor" && data.entities.investors[id]) return { ...data.entities.investors[id], _fallback: false };
    if (kind === "group" && data.entities.groups[id]) return { ...data.entities.groups[id], _fallback: false };
    return buildFallbackEntity(kind, id);
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
      summary.innerHTML = (entity.summaryPoints || [])
        .map((item) => `<div class="entity-summary-item">${escapeHtml(item)}</div>`)
        .join("");
    }

    if (!related) return;

    if (!entity.related || !entity.related.length) {
      related.innerHTML = '<div class="entity-related-card">No related entities authored yet.</div>';
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
      title.textContent = entity._fallback ? "Visible Holder Table / Fallback Approximation" : "Visible Holder Table";
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
              <td class="mono">${escapeHtml(row.nat || row.nationality || "N/A")}</td>
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
      body.innerHTML = '<tr><td colspan="3" class="muted-copy">No holdings authored yet.</td></tr>';
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

  function initCharts(entity) {
    const pieTarget = $("#entity-pie-chart");
    const barTarget = $("#entity-bar-chart");
    if (!pieTarget || !barTarget) return;

    if (!window.echarts) {
      pieTarget.innerHTML = '<div class="muted-copy">ECharts CDN unavailable.</div>';
      barTarget.innerHTML = '<div class="muted-copy">ECharts CDN unavailable.</div>';
      return;
    }

    const pieData = entity.localForeign || entity.styleBreakdown || [{ name: "Prototype", value: 100 }];
    const pieChart = window.echarts.init(pieTarget, null, { renderer: "canvas" });
    const chartTitle = $("#entity-chart-title");
    if (chartTitle) {
      chartTitle.textContent = entity.kind === "ticker" && entity.localForeign ? "Visible Holder Mix" : entity.localForeign ? "Local vs Foreign" : "Portfolio Composition";
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
      ? (entity.holderTable || []).map((row, index) => ({
          name: row.name.length > 24 ? `${row.name.slice(0, 24)}...` : row.name,
          value: parsePct(row.pct) || Math.max(1, (entity.holderTable || []).length - index)
        }))
      : (entity.holdings || []).map((row, index) => ({
          name: row.ticker,
          value: parsePct(row.pct) || Math.max(1, (entity.holdings || []).length - index)
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

    wireSessionLinks(token);

    const params = new URLSearchParams(window.location.search);
    const kind = params.get("kind") || "ticker";
    const rawId = params.get("id") || "BBCA";
    const id = kind === "ticker" ? rawId.toUpperCase() : rawId;
    const entity = resolveEntity(kind, id);

    renderHero(entity);
    renderSummary(entity);
    renderTable(entity);
    initCharts(entity);
  });
})();
