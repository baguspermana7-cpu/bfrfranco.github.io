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
    getDecisionRows,
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
    floatDecisionFilter: "all",
    currentNetworkId: "",
    priorityMode: "allocation",
    networkShowAllLabels: false,
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
      { id: "priority-section", label: "Priority Queue", note: "Decision mode" },
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

  function getRecurringInvestorMap() {
    return new Map(
      getNetworkScenarios()
        .filter((item) => item.type === "investor")
        .map((item) => [item.id, Number(item.stats.find((row) => row.label === "Positions")?.value || 0)])
    );
  }

  function scoreRecency(asOf) {
    const timestamp = parseAsOf(asOf);
    if (!timestamp) return 0;
    const days = Math.max(0, Math.round((Date.now() - timestamp) / 86400000));
    if (days <= 120) return 6;
    if (days <= 240) return 4;
    if (days <= 365) return 2;
    return 0;
  }

  function buildOwnershipAssessment(row, recurringNamedHolders) {
    let score = 38;
    const positives = [];
    const cautions = [];

    if (row.freeFloat >= 25 && row.freeFloat <= 50) score += 18;
    else if (row.freeFloat >= 15 && row.freeFloat < 25) score += 10;
    else if (row.freeFloat > 50) score += 6;
    else if (row.freeFloat >= 5) score += 1;
    else score -= 26;

    if (row.risk === "Low") score += 18;
    else if (row.risk === "Medium") score += 6;
    else score -= 20;

    if (row.blindSpot <= 10) score += 10;
    else if (row.blindSpot <= 20) score += 6;
    else if (row.blindSpot > 35) score -= 10;

    if (row.visibleHeld >= 60) score += 8;
    else if (row.visibleHeld >= 40) score += 4;
    else score -= 4;

    if (row.concentrationBand === "Distributed") score += 6;
    else if (row.concentrationBand === "Concentrated") score -= 4;
    else score -= 10;

    if (row.strategicHeld >= 85) score -= 14;
    else if (row.strategicHeld >= 70) score -= 6;
    else if (row.strategicHeld >= 50 && row.strategicHeld <= 65) score += 4;

    score += Math.min(16, recurringNamedHolders * 4);
    score += scoreRecency(row.asOf);

    if (row.freeFloat >= 35) positives.push(`float ${formatPct(row.freeFloat)}`);
    else if (row.freeFloat >= 15) positives.push(`screenable float ${formatPct(row.freeFloat)}`);
    else cautions.push(`float only ${formatPct(row.freeFloat)}`);

    if (row.visibleHeld >= 60) positives.push(`coverage ${formatPct(row.visibleHeld)}`);
    else if (row.visibleHeld < 40) cautions.push("thin visible coverage");

    if (recurringNamedHolders >= 2) positives.push(`${recurringNamedHolders} recurring holders`);
    if (row.risk === "Low") positives.push("low ownership risk");
    if (row.risk === "Medium") cautions.push("medium ownership risk");
    if (row.risk === "High") cautions.push("high ownership risk");
    if (row.blindSpot > 25) cautions.push(`blind spot ${formatPct(row.blindSpot)}`);
    if (row.concentrationBand === "Tight") cautions.push("tight concentration");
    if (row.strategicHeld >= 85) cautions.push("strategic block dominates");

    return {
      ownershipScore: Math.max(0, Math.min(100, Math.round(score))),
      positives: positives.slice(0, 3),
      cautions: cautions.slice(0, 3)
    };
  }

  function scoreDecisionValue(value, map) {
    return map?.[value] ?? 0;
  }

  function buildPriorityQueue(mode = state.priorityMode) {
    const recurringMap = getRecurringInvestorMap();
    const modeConfig = mode === "multibagger"
      ? {
        label: "Multibagger",
        earningsMap: { Strong: 10, Stable: 9, Cyclical: 11, Turnaround: 8 },
        balanceMap: { Strong: 10, Adequate: 8, Restructuring: -4 },
        catalystMap: { Compounding: 5, Project: 16, Policy: 9, Cycle: 13, Turnaround: 18 },
        fitMap: { High: 18, Medium: 13, Selective: 8, Low: 1 },
        fitKey: "multibaggerFit"
      }
      : {
        label: "Allocation",
        earningsMap: { Strong: 18, Stable: 14, Cyclical: 8, Turnaround: 2 },
        balanceMap: { Strong: 18, Adequate: 12, Restructuring: 0 },
        catalystMap: { Compounding: 10, Project: 11, Policy: 8, Cycle: 6, Turnaround: 4 },
        fitMap: { High: 14, Medium: 8, Selective: 4, Low: 0 },
        fitKey: "allocationFit"
      };

    return getDecisionRows()
      .map((row) => {
        const entity = data.entities?.tickers?.[row.ticker];
        const decision = row.decision;
        const recurringNamedHolders = (entity?.holderTable || []).filter((holder) => recurringMap.has(holder.entityId)).length;
        const ownership = buildOwnershipAssessment(row, recurringNamedHolders);
        let score = ownership.ownershipScore * (mode === "multibagger" ? 0.38 : 0.46);

        score += scoreDecisionValue(decision.earningsView, modeConfig.earningsMap);
        score += scoreDecisionValue(decision.balanceView, modeConfig.balanceMap);
        score += scoreDecisionValue(decision.catalystView, modeConfig.catalystMap);
        score += scoreDecisionValue(decision[modeConfig.fitKey], modeConfig.fitMap);
        score += scoreRecency(decision.asOf);

        if (mode === "multibagger") {
          if (row.freeFloat >= 8 && row.freeFloat <= 30) score += 12;
          else if (row.freeFloat > 30 && row.freeFloat <= 45) score += 8;
          else if (row.freeFloat > 45) score += 3;
          else score -= 6;

          if (row.risk === "High") score -= 14;
          if (decision.balanceView === "Restructuring") score -= 12;
        } else {
          if (row.freeFloat > 50) score -= 3;
          if (row.risk === "High") score -= 12;
        }

        const modeFit = decision[modeConfig.fitKey];
        const finalScore = Math.max(0, Math.min(100, Math.round(score)));
        const action = mode === "multibagger"
          ? (finalScore >= 90
            && ["High", "Medium"].includes(modeFit)
            && decision.balanceView !== "Restructuring"
            && row.risk !== "High"
            && row.freeFloat >= 8
            && row.freeFloat <= 35
            ? "Accumulate"
            : finalScore >= 56 ? "Watch" : "Avoid")
          : (finalScore >= 90
            && modeFit === "High"
            && ["Strong", "Adequate"].includes(decision.balanceView)
            && decision.earningsView !== "Turnaround"
            && row.risk === "Low"
            ? "Accumulate"
            : finalScore >= 58 ? "Watch" : "Avoid");

        return {
          ...row,
          mode: modeConfig.label,
          modeFit,
          score: finalScore,
          recurringNamedHolders,
          action,
          positives: ownership.positives,
          cautions: ownership.cautions
        };
      })
      .sort((a, b) => {
        const actionWeight = { Accumulate: 3, Watch: 2, Avoid: 1 };
        return (actionWeight[b.action] || 0) - (actionWeight[a.action] || 0)
          || b.score - a.score
          || b.recurringNamedHolders - a.recurringNamedHolders
          || b.freeFloat - a.freeFloat
          || a.ticker.localeCompare(b.ticker);
      })
      .map((row, index) => ({
        ...row,
        rank: index + 1
      }));
  }

  function renderPriorityQueue() {
    const statGrid = $("#priority-stat-grid");
    const allocationList = $("#priority-allocation-list");
    const watchList = $("#priority-watch-list");
    const methodList = $("#priority-method-list");
    const riskList = $("#priority-risk-list");
    const body = $("#priority-body");
    const note = $("#priority-note");
    const allocationBtn = $("#priority-mode-allocation");
    const multibaggerBtn = $("#priority-mode-multibagger");
    if (!statGrid || !allocationList || !watchList || !methodList || !riskList || !body) return;

    const queue = buildPriorityQueue(state.priorityMode);
    const accumulate = queue.filter((row) => row.action === "Accumulate");
    const watch = queue.filter((row) => row.action === "Watch");
    const avoid = queue.filter((row) => row.action === "Avoid");
    const avgScore = queue.length ? round2(queue.reduce((sum, row) => sum + row.score, 0) / queue.length) : 0;
    const activeMode = state.priorityMode === "multibagger" ? "Multibagger" : "Allocation";

    if (allocationBtn && multibaggerBtn) {
      allocationBtn.classList.toggle("is-active", state.priorityMode === "allocation");
      multibaggerBtn.classList.toggle("is-active", state.priorityMode === "multibagger");
    }

    if (note) {
      note.textContent = state.priorityMode === "multibagger"
        ? "Multibagger mode looks for asymmetry, project optionality, cycle turns, and tighter ownership setups. It is stricter on execution risk and still requires live price work."
        : "Allocation mode looks for cleaner ownership plus stable issuer-side operating evidence. Use it to decide where core research time should go first.";
    }

    statGrid.innerHTML = [
      { label: "Mode", value: activeMode },
      { label: "Accumulate", value: String(accumulate.length) },
      { label: "Watch", value: String(watch.length) },
      { label: "Avoid", value: String(avoid.length) },
      { label: "Avg Score", value: String(avgScore) }
    ].map((item) => `
      <div class="snapshot">
        <strong>${escapeHtml(item.value)}</strong>
        <span>${escapeHtml(item.label)}</span>
      </div>
    `).join("");

    allocationList.innerHTML = accumulate.length
      ? accumulate.slice(0, 6).map((row) => `
        <div class="list-row">
          <span><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a> - ${escapeHtml(row.decision.earningsView)} / ${escapeHtml(row.decision.catalystView)}</span>
          <span class="mono muted">${escapeHtml(`${row.score}/100`)}</span>
        </div>
      `).join("")
      : '<div class="list-row"><span>No accumulate candidate under the current mode.</span></div>';

    watchList.innerHTML = watch.length
      ? watch.slice(0, 6).map((row) => `
        <div class="list-row">
          <span><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a> - ${escapeHtml(row.cautions[0] || row.decision.watchItems[0] || row.signalSummary)}</span>
          <span class="mono muted">${escapeHtml(`${row.score}/100`)}</span>
        </div>
      `).join("")
      : '<div class="list-row"><span>No watch candidate under the current mode.</span></div>';

    methodList.innerHTML = (state.priorityMode === "multibagger"
      ? [
        "Multibagger mode is not asking which business is safest. It is asking where optionality can re-rate materially if execution lands.",
        "Project, cycle, and turnaround catalysts receive more weight here, but weak balance sheets still block automatic accumulate labels.",
        "Tight float alone is never enough. The catalyst has to be specific and sourced from issuer-side disclosures.",
        "Use this mode to build a speculative watchlist, not to skip valuation discipline."
      ]
      : [
        "Allocation mode starts from cleaner ownership and then checks whether the issuer still shows stable operating evidence.",
        "Strong balance-sheet language, recurring earnings power, and disciplined catalyst paths rank above story-heavy optionality.",
        "Use Accumulate as a research-priority label, then run your own live valuation check before entry.",
        "If a ticker lands in Watch, it means the case is real but still needs price, debt, or execution confirmation."
      ]).map((item) => `
      <div class="list-row">
        <span class="mono muted">RULE</span>
        <span>${escapeHtml(item)}</span>
      </div>
    `).join("");

    riskList.innerHTML = (state.priorityMode === "multibagger"
      ? [
        "Avoid names where balance repair is still open-ended unless you deliberately want turnaround risk.",
        "If free float is too tight and blind spot is too large, treat the move as trade-only until new disclosure arrives.",
        "Project optionality must be tied to named milestones such as commissioning, RKAB, or network rollout.",
        "Every multibagger candidate still needs a live downside map before capital deployment."
      ]
      : [
        "Do not turn an ownership score into a buy call without checking live valuation multiples.",
        "High-risk float structures stay out of Accumulate even if the business case looks attractive.",
        "Debt, funding, or tariff sensitivity can overturn a clean ownership setup; always read the issuer release itself.",
        "If the source date is older than your holding horizon requires, refresh the thesis before acting."
      ]).map((item) => `
      <div class="list-row">
        <span class="mono muted">RULE</span>
        <span>${escapeHtml(item)}</span>
      </div>
    `).join("");

    body.innerHTML = queue
      .map((row) => `
        <tr>
          <td class="mono">${escapeHtml(String(row.rank))}</td>
          <td class="mono"><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a></td>
          <td><span class="type-badge ${row.action === "Accumulate" ? "tone-green" : row.action === "Watch" ? "tone-accent" : "tone-red"}">${escapeHtml(row.action)}</span></td>
          <td><span class="type-badge ${row.modeFit === "High" ? "tone-green" : row.modeFit === "Medium" ? "tone-blue" : row.modeFit === "Selective" ? "tone-violet" : "tone-red"}">${escapeHtml(row.modeFit)}</span></td>
          <td class="right mono">${escapeHtml(String(row.score))}</td>
          <td>${escapeHtml(row.positives.join(", ") || row.signalSummary)}</td>
          <td><span class="type-badge tone-blue">${escapeHtml(row.decision.earningsView)}</span> ${escapeHtml(row.decision.earningsNote)}</td>
          <td><span class="type-badge tone-green">${escapeHtml(row.decision.balanceView)}</span> ${escapeHtml(row.decision.balanceNote)}</td>
          <td><span class="type-badge tone-violet">${escapeHtml(row.decision.catalystView)}</span> ${escapeHtml(row.decision.catalystNote)}</td>
          <td>${escapeHtml(row.decision.valuationGate)}</td>
          <td>${row.decision.sourceUrl ? `<a class="entity-inline-link" href="${row.decision.sourceUrl}" target="_blank" rel="noreferrer">${escapeHtml(row.decision.sourceLabel)}</a>` : escapeHtml(row.decision.sourceLabel)}<div class="mono muted" style="margin-top:6px">${escapeHtml(row.decision.asOf)}</div></td>
        </tr>
      `)
      .join("");
  }

  function bindPriorityMode() {
    const allocationBtn = $("#priority-mode-allocation");
    const multibaggerBtn = $("#priority-mode-multibagger");
    if (!allocationBtn || !multibaggerBtn) return;

    allocationBtn.addEventListener("click", () => {
      state.priorityMode = "allocation";
      renderPriorityQueue();
    });

    multibaggerBtn.addEventListener("click", () => {
      state.priorityMode = "multibagger";
      renderPriorityQueue();
    });
  }

  function getDecisionMaps() {
    return {
      allocation: new Map(buildPriorityQueue("allocation").map((row) => [row.ticker, row])),
      multibagger: new Map(buildPriorityQueue("multibagger").map((row) => [row.ticker, row]))
    };
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
    const decisionMaps = getDecisionMaps();
    const rows = filterFloatRows(state.currentTab)
      .map((row) => {
        const allocation = decisionMaps.allocation.get(row.ticker);
        const multibagger = decisionMaps.multibagger.get(row.ticker);
        return {
          ...row,
          allocationAction: allocation?.action || "N/A",
          allocationScore: allocation?.score || 0,
          multibaggerAction: multibagger?.action || "N/A",
          multibaggerScore: multibagger?.score || 0
        };
      })
      .filter((row) => state.sectorFilter === "all" || row.sector === state.sectorFilter)
      .filter((row) => {
        if (state.floatDecisionFilter === "allocation-accumulate") return row.allocationAction === "Accumulate";
        if (state.floatDecisionFilter === "multibagger-accumulate") return row.multibaggerAction === "Accumulate";
        if (state.floatDecisionFilter === "watch-only") return row.allocationAction === "Watch" || row.multibaggerAction === "Watch";
        if (state.floatDecisionFilter === "avoid-any") return row.allocationAction === "Avoid" || row.multibaggerAction === "Avoid";
        return true;
      })
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
    const allocationAccumulate = rows.filter((row) => row.allocationAction === "Accumulate").length;
    const multibaggerAccumulate = rows.filter((row) => row.multibaggerAction === "Accumulate").length;

    const cards = [
      { label: "Avg Free Float", value: formatPct(avgFloat) },
      { label: "Avg Strategic Held", value: formatPct(avgStrategic) },
      { label: "Avg Blind Spot", value: formatPct(avgBlindSpot) },
      { label: "Avg HHI", value: avgHHI.toFixed(0) },
      { label: "High Risk", value: String(highRisk) },
      { label: "Alloc A", value: String(allocationAccumulate) },
      { label: "Multi A", value: String(multibaggerAccumulate) },
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
      const filterLabels = {
        all: "All decisions",
        "allocation-accumulate": "Allocation Accumulate",
        "multibagger-accumulate": "Multibagger Accumulate",
        "watch-only": "Any Watch",
        "avoid-any": "Any Avoid"
      };
      note.textContent = `${rows.length} sourced row(s) in view. Decision filter: ${filterLabels[state.floatDecisionFilter] || "All decisions"}. Latest snapshot among visible rows: ${latest}.`;
    }

    renderTopStats(rows);
    renderFloatAnalyticsGrid(rows);
    updateSortHeaders();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="14" class="muted-copy">No rows match the current filter.</td></tr>';
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
            <td>
              <div class="decision-chip-row">
                <span class="type-badge ${item.allocationAction === "Accumulate" ? "tone-green" : item.allocationAction === "Watch" ? "tone-accent" : "tone-red"}">${escapeHtml(item.allocationAction)}</span>
                <span class="mono muted">${escapeHtml(String(item.allocationScore))}</span>
              </div>
            </td>
            <td>
              <div class="decision-chip-row">
                <span class="type-badge ${item.multibaggerAction === "Accumulate" ? "tone-green" : item.multibaggerAction === "Watch" ? "tone-accent" : "tone-red"}">${escapeHtml(item.multibaggerAction)}</span>
                <span class="mono muted">${escapeHtml(String(item.multibaggerScore))}</span>
              </div>
            </td>
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
    const decisionSelect = $("#float-decision-filter");
    if (!sectorSelect || !decisionSelect) return;

    const sectors = Array.from(new Set(getFloatRows().map((row) => row.sector).filter(Boolean))).sort();
    sectorSelect.innerHTML = ["<option value=\"all\">All sectors</option>", ...sectors.map((sector) => `<option value="${escapeHtml(sector)}">${escapeHtml(sector)}</option>`)].join("");
    sectorSelect.value = state.sectorFilter;

    decisionSelect.innerHTML = [
      { value: "all", label: "All decisions" },
      { value: "allocation-accumulate", label: "Allocation Accumulate" },
      { value: "multibagger-accumulate", label: "Multibagger Accumulate" },
      { value: "watch-only", label: "Any Watch" },
      { value: "avoid-any", label: "Any Avoid" }
    ].map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("");
    decisionSelect.value = state.floatDecisionFilter;

    sectorSelect.addEventListener("change", () => {
      state.sectorFilter = sectorSelect.value || "all";
      renderFloatTable();
    });

    decisionSelect.addEventListener("change", () => {
      state.floatDecisionFilter = decisionSelect.value || "all";
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
        { label: "Allocation Action", value: "allocationAction" },
        { label: "Allocation Score", value: "allocationScore" },
        { label: "Multibagger Action", value: "multibaggerAction" },
        { label: "Multibagger Score", value: "multibaggerScore" },
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
    const canvasNote = $("#network-canvas-note");

    if (note) note.textContent = scenario.note;
    if (canvasNote) {
      canvasNote.textContent = `${scenario.nodes.length} nodes • ${scenario.links.length} links • scroll to zoom • drag to inspect dense clusters`;
    }

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

  function shouldShowNodeLabel(node) {
    if (state.networkShowAllLabels) return true;
    if (node.category === 0) return true;
    if (node.kind === "ticker") return true;
    if (node.category === 2) return true;
    return (node.symbolSize || node.value || 0) >= 24;
  }

  function renderNetworkGraph(scenario) {
    const chart = state.charts.network;
    if (!chart || !scenario) return;

    const dense = scenario.nodes.length >= 14 || scenario.links.length >= 18;
    const repulsion = dense ? Math.min(1200, 420 + scenario.nodes.length * 28) : 340;
    const edgeLength = dense ? [120, 220] : [90, 170];
    const zoom = dense ? 0.84 : 0.96;

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
          zoom,
          force: {
            repulsion,
            edgeLength,
            gravity: dense ? 0.02 : 0.045,
            friction: 0.12
          },
          emphasis: { focus: "adjacency" },
          labelLayout: {
            hideOverlap: !state.networkShowAllLabels,
            moveOverlap: "shiftY"
          },
          label: {
            color: "#5c5850",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            position: "right"
          },
          data: scenario.nodes.map((node) => ({
            ...node,
            label: {
              show: shouldShowNodeLabel(node),
              formatter: node.name,
              color: "#5c5850",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: node.kind === "ticker" ? 11 : 10
            },
            emphasis: {
              label: {
                show: true
              }
            },
            itemStyle: {
              color: node.category === 0 ? "#e55300" : node.category === 1 ? "#2563eb" : node.category === 2 ? "#1a8754" : "#7c3aed"
            }
          })),
          links: scenario.links,
          lineStyle: { color: "rgba(0,0,0,0.12)", curveness: 0.1, opacity: 0.7 }
        }
      ]
    }, true);

    chart.resize();

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
    const fitButton = $("#network-fit-btn");
    const labelButton = $("#network-label-toggle-btn");
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

    if (fitButton) {
      fitButton.addEventListener("click", () => {
        renderNetworkScenario(state.currentNetworkId);
      });
    }

    if (labelButton) {
      const syncLabelButton = () => {
        labelButton.textContent = state.networkShowAllLabels ? "Show Key Labels" : "Show All Labels";
      };

      syncLabelButton();
      labelButton.addEventListener("click", () => {
        state.networkShowAllLabels = !state.networkShowAllLabels;
        syncLabelButton();
        renderNetworkScenario(state.currentNetworkId);
      });
    }

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
    renderPriorityQueue();
    bindPriorityMode();
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
