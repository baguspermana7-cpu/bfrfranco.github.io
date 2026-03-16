(function () {
  const data = window.StockMapMock;

  if (!data) {
    return;
  }

  const STRATEGIC_TYPES = new Set(["CP", "IB", "FD", "OT"]);
  const FLOAT_TYPES = new Set(["MF", "IS", "PF", "SC"]);
  const ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function tokenize(value) {
    return normalize(value).split(" ").filter(Boolean);
  }

  function parsePct(value) {
    const num = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(num) ? num : 0;
  }

  function formatPct(value) {
    return `${round2(value).toFixed(2).replace(/\.00$/, "")}%`;
  }

  function formatMarketCap(value) {
    if (!Number.isFinite(Number(value))) return "N/A";
    return `Rp${Number(value).toLocaleString("en-US")}T`;
  }

  function getSourceEntry(ticker) {
    return data.sourceLedger?.[ticker] || null;
  }

  function getSourceLedgerRows(options = {}) {
    const includeReview = Boolean(options.includeReview);

    return Object.entries(data.entities?.tickers || {})
      .map(([ticker, entity]) => {
        const source = getSourceEntry(ticker);
        if (!source) return null;
        if (!includeReview && source.status !== "ready") return null;

        return {
          ticker,
          company: entity.name,
          sector: entity.sector,
          marketCap: entity.marketCap,
          status: source.status,
          asOf: source.asOf,
          sourceLabel: source.sourceLabel,
          sourceUrl: source.sourceUrl || "",
          note: source.note || "",
          entity
        };
      })
      .filter(Boolean);
  }

  function entityHref(kind, id) {
    return `./entity.html?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
  }

  function riskClass(value) {
    const key = String(value ?? "").toLowerCase();
    if (key === "high") return "risk-high";
    if (key === "medium") return "risk-medium";
    return "risk-low";
  }

  function colorByChange(change) {
    const magnitude = Math.min(Math.abs(Number(change) || 0), 25);
    const alpha = Math.min(0.96, 0.28 + magnitude * 0.055);

    if (change > 0) {
      return `rgba(26, 135, 84, ${alpha})`;
    }

    if (change < 0) {
      return `rgba(185, 28, 28, ${alpha})`;
    }

    return "rgba(92, 88, 80, 0.45)";
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const rows = Array.from({ length: b.length + 1 }, (_, index) => index);

    for (let i = 1; i <= a.length; i += 1) {
      let prev = i - 1;
      rows[0] = i;

      for (let j = 1; j <= b.length; j += 1) {
        const temp = rows[j];
        if (a[i - 1] === b[j - 1]) {
          rows[j] = prev;
        } else {
          rows[j] = Math.min(prev + 1, rows[j] + 1, rows[j - 1] + 1);
        }
        prev = temp;
      }
    }

    return rows[b.length];
  }

  function buildSearchCorpus() {
    const corpus = new Map();

    function upsert(item) {
      if (!item || !item.kind || !item.id || !item.label) return;

      const key = `${item.kind}:${item.id}`;
      const current = corpus.get(key) || {};
      const aliases = Array.from(new Set([...(current.aliases || []), ...(item.aliases || [])]));

      corpus.set(key, {
        ...current,
        ...item,
        aliases
      });
    }

    getSourceLedgerRows()
      .forEach(({ entity }) => {
        upsert({
          label: entity.id,
          kind: "ticker",
          id: entity.id,
          subtitle: entity.name,
          aliases: [entity.name]
        });
      });

    getSourceLedgerRows()
      .forEach(({ entity }) => {
        (entity.holderTable || [])
          .filter((row) => row.entityKind === "investor" && row.entityId)
          .forEach((row) => {
            upsert({
              label: row.name,
              kind: "investor",
              id: row.entityId,
              subtitle: "Issuer-sourced holder",
              aliases: [row.entityId.replace(/-/g, " ")]
            });
          });
      });

    return Array.from(corpus.values());
  }

  const searchCorpus = buildSearchCorpus();

  function scoreSearchItem(item, query, queryTokens) {
    const label = normalize(item.label);
    const subtitle = normalize(item.subtitle || "");
    const aliases = (item.aliases || []).map(normalize).filter(Boolean);
    const haystack = [label, subtitle, ...aliases].filter(Boolean).join(" ");
    const hayTokens = tokenize(haystack);
    const compactQuery = query.replace(/\s+/g, "");
    const compactLabel = label.replace(/\s+/g, "");
    let score = 0;

    if (label === query) score += 180;
    if (aliases.includes(query)) score += 170;
    if (item.kind === "ticker" && compactLabel === compactQuery) score += 40;
    if (label.startsWith(query)) score += 110;
    if (aliases.some((alias) => alias.startsWith(query))) score += 95;
    if (subtitle.startsWith(query)) score += 55;
    if (label.includes(query)) score += 80;
    if (aliases.some((alias) => alias.includes(query))) score += 60;
    if (subtitle.includes(query)) score += 30;

    const matchedTokens = queryTokens.filter((token) => hayTokens.some((hayToken) => hayToken === token || hayToken.startsWith(token)));
    if (matchedTokens.length) score += matchedTokens.length * 18;
    if (queryTokens.length && matchedTokens.length === queryTokens.length) score += 35;

    if (compactQuery && compactLabel) {
      const distance = levenshtein(compactQuery, compactLabel);
      const threshold = compactQuery.length <= 5 ? 1 : 2;
      if (distance <= threshold) score += 45 - distance * 10;
    }

    return score;
  }

  function searchEntities(query, limit = 6) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return searchCorpus.slice(0, limit);
    }

    const queryTokens = tokenize(query);

    return searchCorpus
      .map((item) => ({
        item,
        score: scoreSearchItem(item, normalizedQuery, queryTokens)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.length - b.item.label.length || a.item.label.localeCompare(b.item.label))
      .slice(0, limit)
      .map((entry) => entry.item);
  }

  function findSearchItem(label) {
    const key = normalize(label);
    return searchCorpus.find((item) => {
      if (normalize(item.label) === key) return true;
      return (item.aliases || []).some((alias) => normalize(alias) === key);
    }) || searchEntities(label, 1)[0] || null;
  }

  function entityAnchor(label) {
    const match = findSearchItem(label);
    const safeLabel = escapeHtml(label);
    if (!match) return safeLabel;
    return `<a class="entity-inline-link" href="${entityHref(match.kind, match.id)}">${safeLabel}</a>`;
  }

  function isAllowedToken(token) {
    return Boolean(token) && (data.meta?.allowedTokens || []).includes(token);
  }

  function isStrategicHolder(row) {
    const override = String(row?.classificationOverride || "").toLowerCase();
    if (override === "strategic") return true;
    if (override === "float") return false;
    if (typeof row?.strategic === "boolean") return row.strategic;

    const type = String(row?.type || "").toUpperCase();
    if (STRATEGIC_TYPES.has(type)) return true;
    if (FLOAT_TYPES.has(type)) return false;

    if (type === "ID") {
      return Boolean(row?.insider) || parsePct(row?.pct) >= 20 || Boolean(row?.multiCompanyStrategic);
    }

    return false;
  }

  function computeLocalForeign(rows) {
    const local = rows.reduce((sum, row) => sum + (String(row?.nat || row?.nationality || "").toUpperCase() === "L" ? (row.pctValue ?? parsePct(row?.pct)) : 0), 0);
    const foreign = rows.reduce((sum, row) => sum + (String(row?.nat || row?.nationality || "").toUpperCase() === "F" ? (row.pctValue ?? parsePct(row?.pct)) : 0), 0);
    const total = local + foreign;

    if (!total) {
      return null;
    }

    return [
      { name: "Local", value: round2((local / total) * 100), amount: round2(local) },
      { name: "Foreign", value: round2((foreign / total) * 100), amount: round2(foreign) }
    ];
  }

  function computeHHI(rows, denominator) {
    const base = Number(denominator) || rows.reduce((sum, row) => sum + (row.pctValue ?? parsePct(row?.pct)), 0);
    if (!base) return 0;

    return round2(rows.reduce((sum, row) => {
      const share = ((row.pctValue ?? parsePct(row?.pct)) / base) * 100;
      return sum + share * share;
    }, 0));
  }

  function classifyConcentration(metrics) {
    if (metrics.largestStrategicPct >= 75 || metrics.hhiVisible >= 5200) return "Tight";
    if (metrics.largestStrategicPct >= 55 || metrics.hhiVisible >= 3200) return "Concentrated";
    return "Distributed";
  }

  function classifyCoverage(visibleHeld) {
    if (visibleHeld >= 60) return "Deep";
    if (visibleHeld >= 40) return "Medium";
    return "Thin";
  }

  function buildSignalSummary(metrics) {
    const flags = [];

    if (metrics.freeFloat < 5) flags.push("float trap");
    else if (metrics.freeFloat < 15) flags.push("tight float");
    else if (metrics.freeFloat < 35) flags.push("screenable squeeze");

    if (metrics.largestStrategicPct >= 50) flags.push("single-block control");
    if (metrics.coverageGap >= 40) flags.push("large blind spot");
    if (metrics.foreignPctVisible >= 45) flags.push("foreign-visible");
    if (metrics.floatBlockCount >= 3 && metrics.freeFloat >= 35) flags.push("institutional float");

    return flags.join("; ") || "balanced coverage";
  }

  function computeRiskScore(metrics) {
    let score = 0;

    if (metrics.freeFloat < 5) score += 50;
    else if (metrics.freeFloat < 15) score += 35;
    else if (metrics.freeFloat < 30) score += 20;
    else if (metrics.freeFloat < 50) score += 10;

    if (metrics.largestStrategicPct >= 75) score += 25;
    else if (metrics.largestStrategicPct >= 60) score += 18;
    else if (metrics.largestStrategicPct >= 40) score += 8;

    if (metrics.hhiVisible >= 5000) score += 15;
    else if (metrics.hhiVisible >= 3000) score += 8;
    else if (metrics.hhiVisible >= 1800) score += 4;

    if (metrics.coverageGap >= 55) score += 10;
    else if (metrics.coverageGap >= 35) score += 5;

    return round2(score);
  }

  function computeRisk(metrics) {
    const score = Number(metrics.riskScore ?? computeRiskScore(metrics));
    if (score >= 55) return "High";
    if (score >= 28) return "Medium";
    return "Low";
  }

  function resolveTickerMeta(ticker) {
    const entity = data.entities?.tickers?.[ticker] || null;
    const sourceEntry = getSourceEntry(ticker);
    const analytics = data.tickerAnalytics?.[ticker] || null;

    return {
      ticker,
      entity,
      sourceEntry,
      analytics,
      company: entity?.name || analytics?.company || ticker,
      sector: entity?.sector || "Unknown",
      marketCap: entity?.marketCap || 0
    };
  }

  function computeTickerMetrics(entity) {
    const rows = (entity?.holderTable || []).map((row) => {
      const pctValue = round2(parsePct(row.pct));
      return {
        ...row,
        pctValue,
        strategic: isStrategicHolder(row)
      };
    });

    const visibleHeld = round2(rows.reduce((sum, row) => sum + row.pctValue, 0));
    const strategicRows = rows.filter((row) => row.strategic);
    const floatRows = rows.filter((row) => !row.strategic);
    const strategicHeld = round2(strategicRows.reduce((sum, row) => sum + row.pctValue, 0));
    const visibleFloat = round2(floatRows.reduce((sum, row) => sum + row.pctValue, 0));
    const freeFloat = round2(Math.max(0, 100 - strategicHeld));
    const hiddenFloat = round2(Math.max(0, freeFloat - visibleFloat));
    const coverageGap = round2(Math.max(0, 100 - visibleHeld));
    const hasUnknownNat = rows.some((row) => !["L", "F"].includes(String(row?.nat || row?.nationality || "").toUpperCase()));
    const localForeign = hasUnknownNat ? null : computeLocalForeign(rows);
    const localPctVisible = round2(localForeign?.find((item) => item.name === "Local")?.value || 0);
    const foreignPctVisible = round2(localForeign?.find((item) => item.name === "Foreign")?.value || 0);
    const largestHolder = rows.slice().sort((a, b) => b.pctValue - a.pctValue)[0] || null;
    const largestStrategic = strategicRows.slice().sort((a, b) => b.pctValue - a.pctValue)[0] || null;
    const secondStrategic = strategicRows.slice().sort((a, b) => b.pctValue - a.pctValue)[1] || null;
    const hhiVisible = computeHHI(rows, visibleHeld);
    const hhiStrategic = computeHHI(strategicRows, strategicHeld);

    const metrics = {
      rows,
      visibleHeld,
      visibleFloat,
      strategicRows,
      floatRows,
      strategicHeld,
      freeFloat,
      hiddenFloat,
      coverageGap,
      largestHolder,
      largestStrategic,
      largestStrategicPct: largestStrategic ? largestStrategic.pctValue : 0,
      secondStrategicPct: secondStrategic ? secondStrategic.pctValue : 0,
      controlGap: round2((largestStrategic ? largestStrategic.pctValue : 0) - (secondStrategic ? secondStrategic.pctValue : 0)),
      localForeign,
      localPctVisible,
      foreignPctVisible,
      hhiVisible,
      hhiStrategic,
      strategicBlockCount: strategicRows.length,
      floatBlockCount: floatRows.length,
      coverageBand: classifyCoverage(visibleHeld),
      visibleFloatShare: freeFloat ? round2((visibleFloat / freeFloat) * 100) : 0
    };

    const riskScore = computeRiskScore(metrics);

    return {
      ...metrics,
      riskScore,
      risk: computeRisk({ ...metrics, riskScore }),
      concentrationBand: classifyConcentration(metrics),
      signalSummary: buildSignalSummary(metrics)
    };
  }

  let floatRowsCache = null;
  let networkScenariosCache = null;

  function getTickerAnalytics(ticker) {
    return data.tickerAnalytics?.[ticker] || null;
  }

  function getDecisionEntry(ticker) {
    return data.decisionLedger?.[ticker] || null;
  }

  function getDecisionRows() {
    return getFloatRows()
      .map((row) => {
        const decision = getDecisionEntry(row.ticker);
        if (!decision) return null;
        return {
          ...row,
          decision
        };
      })
      .filter(Boolean);
  }

  function getFloatRows() {
    if (floatRowsCache) {
      return floatRowsCache.slice();
    }

    const rows = getSourceLedgerRows()
      .map(({ entity, asOf, sourceLabel }) => {
      const metrics = computeTickerMetrics(entity);
      const meta = resolveTickerMeta(entity.id);

      return {
        ticker: entity.id,
        company: meta.company,
        holder: metrics.largestStrategic?.name || "N/A",
        largestStrategicHolder: metrics.largestStrategic?.name || "N/A",
        largestHolder: metrics.largestHolder?.name || "N/A",
        totalHeld: metrics.strategicHeld,
        strategicHeld: metrics.strategicHeld,
        visibleHeld: metrics.visibleHeld,
        visibleFloat: metrics.visibleFloat,
        blindSpot: metrics.hiddenFloat,
        freeFloat: metrics.freeFloat,
        largestStrategicPct: metrics.largestStrategicPct,
        secondStrategicPct: metrics.secondStrategicPct,
        controlGap: metrics.controlGap,
        risk: metrics.risk,
        riskScore: metrics.riskScore,
        concentrationBand: metrics.concentrationBand,
        coverageBand: metrics.coverageBand,
        hhi: metrics.hhiVisible,
        hhiStrategic: metrics.hhiStrategic,
        localPct: metrics.localPctVisible,
        foreignPct: metrics.foreignPctVisible,
        localForeign: metrics.localForeign,
        strategicBlockCount: metrics.strategicBlockCount,
        floatBlockCount: metrics.floatBlockCount,
        visibleFloatShare: metrics.visibleFloatShare,
        signalSummary: metrics.signalSummary,
        sector: meta.sector,
        marketCap: meta.marketCap,
        asOf,
        sourceLabel,
        derived: true,
        source: "authored"
      };
    });

    floatRowsCache = rows;
    return rows.slice();
  }

  function filterFloatRows(mode) {
    const rows = getFloatRows();
    if (mode === "low") return rows.filter((item) => item.freeFloat < 5);
    if (mode === "below15") return rows.filter((item) => item.freeFloat >= 5 && item.freeFloat < 15);
    if (mode === "mid") return rows.filter((item) => item.freeFloat >= 15 && item.freeFloat <= 50);
    if (mode === "high") return rows.filter((item) => item.freeFloat > 50);
    return rows;
  }

  function computeSectorExposure() {
    const groups = new Map();

    getFloatRows()
      .filter((row) => row.source === "authored" && Number.isFinite(row.localPct + row.foreignPct) && (row.localPct || row.foreignPct))
      .forEach((row) => {
        const current = groups.get(row.sector) || {
          sector: row.sector,
          localTotal: 0,
          foreignTotal: 0,
          floatTotal: 0,
          highRiskCount: 0,
          names: 0
        };

        current.localTotal += row.localPct;
        current.foreignTotal += row.foreignPct;
        current.floatTotal += row.freeFloat;
        current.highRiskCount += row.risk === "High" ? 1 : 0;
        current.names += 1;
        groups.set(row.sector, current);
      });

    if (!groups.size) {
      return (data.sectorExposure || []).map((item) => ({ ...item }));
    }

    return Array.from(groups.values())
      .map((group) => ({
        sector: group.sector,
        local: round2(group.localTotal / group.names),
        foreign: round2(group.foreignTotal / group.names),
        avgFloat: round2(group.floatTotal / group.names),
        highRiskCount: group.highRiskCount,
        names: group.names
      }))
      .sort((a, b) => b.names - a.names || a.sector.localeCompare(b.sector));
  }

  function toCsv(rows, columns) {
    const header = columns.map((column) => escapeCsv(column.label)).join(",");
    const lines = rows.map((row) => columns.map((column) => {
      const value = typeof column.value === "function" ? column.value(row) : row[column.value];
      return escapeCsv(value);
    }).join(","));

    return [header, ...lines].join("\n");
  }

  function matchInvestorSearchAliases(investor) {
    const searchItem = (data.searchIndex || []).find((item) => item.kind === "investor" && item.id === investor.id);
    return new Set([
      normalize(investor.name),
      normalize(investor.id.replace(/-/g, " ")),
      ...((searchItem?.aliases || []).map(normalize))
    ].filter(Boolean));
  }

  function rowMatchesInvestor(row, investor) {
    if (!row || !investor) return false;
    if (row.entityKind === "investor" && row.entityId === investor.id) return true;
    const aliases = matchInvestorSearchAliases(investor);
    return aliases.has(normalize(row.name));
  }

  function resolveInvestorEntityForRow(row) {
    if (!row) return null;
    if (row.entityKind === "investor" && data.entities?.investors?.[row.entityId]) {
      return data.entities.investors[row.entityId];
    }

    if (row.entityKind === "investor" && row.entityId) {
      return {
        kind: "investor",
        id: row.entityId,
        name: row.name
      };
    }

    const match = findSearchItem(row.name);
    if (match?.kind === "investor") {
      return data.entities?.investors?.[match.id] || {
        kind: "investor",
        id: match.id,
        name: match.label
      };
    }

    return null;
  }

  function collectInvestorPositions(investor) {
    if (!investor) return [];

    const positions = new Map();

    function upsertPosition(payload) {
      if (!payload?.ticker) return;
      const current = positions.get(payload.ticker) || { sources: [] };
      const pctValue = round2(Number(payload.pctValue ?? parsePct(payload.pct)));
      const meta = resolveTickerMeta(payload.ticker);
      const floatRow = getFloatRows().find((row) => row.ticker === payload.ticker) || null;

      positions.set(payload.ticker, {
        ticker: payload.ticker,
        company: payload.company || meta.company,
        sector: meta.sector,
        marketCap: meta.marketCap,
        pctValue: Math.max(current.pctValue || 0, pctValue),
        pct: formatPct(Math.max(current.pctValue || 0, pctValue)),
        source: payload.source || current.source || "investor-page",
        sources: Array.from(new Set([...(current.sources || []), payload.source || "investor-page"])),
        fromHolderTable: Boolean(current.fromHolderTable || payload.fromHolderTable),
        focusRowType: payload.focusRowType || current.focusRowType || investor.metrics?.find((item) => item.label === "Investor Type")?.value || "N/A",
        focusNat: payload.focusNat || current.focusNat || investor.metrics?.find((item) => item.label === "Nationality")?.value || "N/A",
        floatRow,
        tickerEntity: meta.entity
      });
    }

    getSourceLedgerRows().forEach(({ entity: tickerEntity }) => {
      (tickerEntity.holderTable || []).forEach((row) => {
        if (!rowMatchesInvestor(row, investor)) return;
        upsertPosition({
          ticker: tickerEntity.id,
          company: tickerEntity.name,
          pct: row.pct,
          pctValue: parsePct(row.pct),
          source: `holder-table:${tickerEntity.id}`,
          fromHolderTable: true,
          focusRowType: row.type,
          focusNat: row.nat
        });
      });
    });

    return Array.from(positions.values()).sort((a, b) => b.pctValue - a.pctValue || a.ticker.localeCompare(b.ticker));
  }

  function buildScenarioMix(evidenceRows) {
    const strategic = round2(evidenceRows.filter((row) => row.relationType === "Strategic co-holder").reduce((sum, row) => sum + row.pctValue, 0));
    const float = round2(evidenceRows.filter((row) => row.relationType === "Float co-holder").reduce((sum, row) => sum + row.pctValue, 0));
    const focus = round2(evidenceRows.filter((row) => row.relationType === "Focus stake").reduce((sum, row) => sum + row.pctValue, 0));
    const hidden = round2(evidenceRows.filter((row) => row.relationType === "Blind spot").reduce((sum, row) => sum + row.pctValue, 0));
    return [
      { name: "Focus stake", value: focus },
      { name: "Strategic co-holder", value: strategic },
      { name: "Float co-holder", value: float },
      { name: "Blind spot", value: hidden }
    ].filter((item) => item.value > 0);
  }

  function addGraphNode(map, node) {
    const current = map.get(node.id);
    if (!current) {
      map.set(node.id, node);
      return;
    }

    map.set(node.id, {
      ...current,
      value: Math.max(current.value || 0, node.value || 0),
      symbolSize: Math.max(current.symbolSize || 0, node.symbolSize || 0),
      emphasisValue: Math.max(current.emphasisValue || 0, node.emphasisValue || 0),
      href: current.href || node.href
    });
  }

  function addGraphLink(map, link) {
    const key = `${link.source}->${link.target}:${link.relationType}`;
    if (!map.has(key)) {
      map.set(key, link);
    }
  }

  function createBlindSpotEvidence(position, focusLabel) {
    const blindSpot = round2(position.floatRow?.blindSpot || 0);
    if (!blindSpot) return null;
    return {
      relationType: "Blind spot",
      sourceLabel: focusLabel,
      targetLabel: position.ticker,
      pctValue: blindSpot,
      pct: formatPct(blindSpot),
      sector: position.sector,
      freeFloat: position.floatRow?.freeFloat || 0,
      largestStrategicHolder: position.floatRow?.largestStrategicHolder || "N/A",
      evidence: position.fromHolderTable ? "holder table + inferred sub-1% float" : "aggregate float estimate",
      href: entityHref("ticker", position.ticker)
    };
  }

  function buildInvestorNetworkScenario(investor) {
    const positions = collectInvestorPositions(investor);
    if (!positions.length) return null;

    const nodeMap = new Map();
    const linkMap = new Map();
    const evidence = [];
    const focusLabel = investor.name;
    const sectors = new Set();

    addGraphNode(nodeMap, {
      id: `investor:${investor.id}`,
      name: investor.name,
      kind: "investor",
      category: 0,
      value: 38,
      symbolSize: 38,
      href: entityHref("investor", investor.id)
    });

    positions.slice(0, 12).forEach((position) => {
      sectors.add(position.sector);
      const floatRow = position.floatRow;
      addGraphNode(nodeMap, {
        id: `ticker:${position.ticker}`,
        name: position.ticker,
        kind: "ticker",
        category: 1,
        value: Math.max(18, Math.min(34, 12 + ((position.floatRow?.freeFloat || 0) / 3) + (position.pctValue / 8))),
        symbolSize: Math.max(18, Math.min(34, 12 + ((position.floatRow?.freeFloat || 0) / 3) + (position.pctValue / 8))),
        href: entityHref("ticker", position.ticker)
      });

      addGraphLink(linkMap, {
        source: `investor:${investor.id}`,
        target: `ticker:${position.ticker}`,
        value: position.pctValue,
        relationType: "Focus stake",
        lineStyle: { width: Math.max(1.5, Math.min(7, position.pctValue / 8)), color: "rgba(229,83,0,0.62)" },
        label: { show: position.pctValue >= 8, formatter: formatPct(position.pctValue), color: "#5c5850", fontSize: 10 }
      });

      evidence.push({
        relationType: "Focus stake",
        sourceLabel: focusLabel,
        targetLabel: position.ticker,
        pctValue: position.pctValue,
        pct: formatPct(position.pctValue),
        sector: position.sector,
        freeFloat: floatRow?.freeFloat || 0,
        largestStrategicHolder: floatRow?.largestStrategicHolder || "N/A",
        evidence: position.fromHolderTable ? "holder table" : "investor page",
        href: entityHref("ticker", position.ticker)
      });

      const blindSpotEvidence = createBlindSpotEvidence(position, focusLabel);
      if (blindSpotEvidence) {
        evidence.push(blindSpotEvidence);
        addGraphNode(nodeMap, {
          id: `blind:${position.ticker}`,
          name: `${position.ticker} blind spot`,
          kind: "blind-spot",
          category: 3,
          value: Math.max(10, Math.min(20, 8 + (blindSpotEvidence.pctValue / 8))),
          symbolSize: Math.max(10, Math.min(20, 8 + (blindSpotEvidence.pctValue / 8))),
          href: entityHref("ticker", position.ticker)
        });
        addGraphLink(linkMap, {
          source: `blind:${position.ticker}`,
          target: `ticker:${position.ticker}`,
          value: blindSpotEvidence.pctValue,
          relationType: "Blind spot",
          lineStyle: { width: Math.max(1, Math.min(4, blindSpotEvidence.pctValue / 12)), color: "rgba(124,58,237,0.36)" },
          label: { show: false }
        });
      }

      const tickerEntity = position.tickerEntity;
      if (!tickerEntity) {
        if (floatRow?.largestStrategicHolder) {
          const strategicId = `holder:${normalize(floatRow.largestStrategicHolder)}:${position.ticker}`;
          addGraphNode(nodeMap, {
            id: strategicId,
            name: floatRow.largestStrategicHolder,
            kind: "holder",
            category: 2,
            value: Math.max(14, Math.min(28, 10 + (floatRow.totalHeld || 0) / 4)),
            symbolSize: Math.max(14, Math.min(28, 10 + (floatRow.totalHeld || 0) / 4)),
            href: entityHref("ticker", position.ticker)
          });
          addGraphLink(linkMap, {
            source: strategicId,
            target: `ticker:${position.ticker}`,
            value: floatRow.totalHeld || 0,
            relationType: "Strategic co-holder",
            lineStyle: {
              width: Math.max(1.2, Math.min(5, (floatRow.totalHeld || 0) / 12)),
              color: "rgba(26,135,84,0.48)"
            },
            label: { show: false }
          });
          evidence.push({
            relationType: "Strategic co-holder",
            sourceLabel: floatRow.largestStrategicHolder,
            targetLabel: position.ticker,
            pctValue: floatRow.totalHeld || 0,
            pct: formatPct(floatRow.totalHeld || 0),
            sector: position.sector,
            freeFloat: floatRow.freeFloat || 0,
            largestStrategicHolder: floatRow.largestStrategicHolder,
            evidence: "aggregate strategic estimate",
            href: entityHref("ticker", position.ticker)
          });
        }
        return;
      }

      tickerEntity.holderTable
        .map((row) => ({
          ...row,
          pctValue: parsePct(row.pct),
          strategic: isStrategicHolder(row)
        }))
        .filter((row) => !rowMatchesInvestor(row, investor))
        .sort((a, b) => Number(b.strategic) - Number(a.strategic) || b.pctValue - a.pctValue)
        .slice(0, 4)
        .forEach((row) => {
          const linkedInvestor = resolveInvestorEntityForRow(row);
          const nodeId = linkedInvestor ? `investor:${linkedInvestor.id}` : `holder:${normalize(row.name)}`;
          const relationType = row.strategic ? "Strategic co-holder" : "Float co-holder";

          addGraphNode(nodeMap, {
            id: nodeId,
            name: linkedInvestor?.name || row.name,
            kind: linkedInvestor ? "investor" : "holder",
            category: row.strategic ? 2 : 3,
            value: Math.max(14, Math.min(28, 10 + row.pctValue / 2)),
            symbolSize: Math.max(14, Math.min(28, 10 + row.pctValue / 2)),
            href: linkedInvestor ? entityHref("investor", linkedInvestor.id) : null
          });

          addGraphLink(linkMap, {
            source: nodeId,
            target: `ticker:${position.ticker}`,
            value: row.pctValue,
            relationType,
            lineStyle: {
              width: Math.max(1.2, Math.min(5, row.pctValue / 12)),
              color: row.strategic ? "rgba(26,135,84,0.48)" : "rgba(37,99,235,0.42)"
            },
            label: { show: false }
          });

          evidence.push({
            relationType,
            sourceLabel: linkedInvestor?.name || row.name,
            targetLabel: position.ticker,
            pctValue: row.pctValue,
            pct: formatPct(row.pctValue),
            sector: position.sector,
            freeFloat: floatRow?.freeFloat || 0,
            largestStrategicHolder: floatRow?.largestStrategicHolder || "N/A",
            evidence: `holder table:${position.ticker}`,
            href: linkedInvestor ? entityHref("investor", linkedInvestor.id) : entityHref("ticker", position.ticker)
          });
        });
    });

    const avgFloat = round2(positions.reduce((sum, row) => sum + (row.floatRow?.freeFloat || 0), 0) / positions.length);
    const totalStake = round2(positions.reduce((sum, row) => sum + row.pctValue, 0));
    const maxStake = positions[0]?.pctValue || 0;
    const avgStake = round2(totalStake / positions.length);
    const blindSpotAvg = round2(positions.reduce((sum, row) => sum + (row.floatRow?.blindSpot || row.floatRow?.freeFloat || 0), 0) / positions.length);
    const highRiskCount = positions.filter((row) => row.floatRow?.risk === "High").length;
    const overlaps = Array.from(linkMap.values()).filter((link) => link.relationType !== "Focus stake").length;
    const mix = buildScenarioMix(evidence);

    return {
      id: investor.id,
      type: "investor",
      label: investor.name,
      title: `${investor.name} network`,
      description: `Derived from authored investor positions plus linked ticker holder tables. Focus is on overlap, strategic co-holders, and unobserved float.`,
      note: `${positions.length} linked positions with ${overlaps} secondary holder connections across ${sectors.size} sectors.`,
      nodes: Array.from(nodeMap.values()),
      links: Array.from(linkMap.values()),
      evidence: evidence.sort((a, b) => b.pctValue - a.pctValue || a.targetLabel.localeCompare(b.targetLabel)),
      mix,
      stats: [
        { label: "Positions", value: String(positions.length) },
        { label: "Total Linked Stake", value: formatPct(totalStake) },
        { label: "Avg Target Float", value: formatPct(avgFloat) },
        { label: "Sectors", value: String(sectors.size) }
      ],
      snapshots: [
        { label: "Max Stake", value: formatPct(maxStake) },
        { label: "Avg Stake", value: formatPct(avgStake) },
        { label: "Avg Blind Spot", value: formatPct(blindSpotAvg) },
        { label: "High Risk", value: String(highRiskCount) }
      ],
      highlights: [
        `${investor.name} links to ${positions[0]?.ticker || "the authored universe"} as the largest visible position at ${formatPct(maxStake)}.`,
        `Average target free float is ${formatPct(avgFloat)}, which tells you whether the portfolio sits in tradable names or structurally tight floats.`,
        `${overlaps} secondary holder edges expose where recurring co-holders or strategic blocks repeat across the linked names.`
      ],
      connectionHighlights: evidence
        .filter((row) => row.relationType !== "Blind spot")
        .slice(0, 12)
        .map((row) => `${row.sourceLabel} -> ${row.targetLabel} (${row.pct})`)
    };
  }

  function buildTickerNetworkScenario(entity) {
    if (!entity?.holderTable?.length) return null;

    const metrics = computeTickerMetrics(entity);
    const nodeMap = new Map();
    const linkMap = new Map();
    const evidence = [];

    addGraphNode(nodeMap, {
      id: `ticker:${entity.id}`,
      name: entity.id,
      kind: "ticker",
      category: 1,
      value: 34,
      symbolSize: 34,
      href: entityHref("ticker", entity.id)
    });

    metrics.rows
      .slice()
      .sort((a, b) => b.pctValue - a.pctValue)
      .forEach((row) => {
        const investor = resolveInvestorEntityForRow(row);
        const nodeId = investor ? `investor:${investor.id}` : `holder:${normalize(row.name)}`;
        const relationType = row.strategic ? "Strategic co-holder" : "Float co-holder";

        addGraphNode(nodeMap, {
          id: nodeId,
          name: investor?.name || row.name,
          kind: investor ? "investor" : "holder",
          category: row.strategic ? 2 : 3,
          value: Math.max(14, Math.min(30, 11 + row.pctValue / 2)),
          symbolSize: Math.max(14, Math.min(30, 11 + row.pctValue / 2)),
          href: investor ? entityHref("investor", investor.id) : null
        });

        addGraphLink(linkMap, {
          source: nodeId,
          target: `ticker:${entity.id}`,
          value: row.pctValue,
          relationType,
          lineStyle: {
            width: Math.max(1.5, Math.min(7, row.pctValue / 8)),
            color: row.strategic ? "rgba(26,135,84,0.55)" : "rgba(37,99,235,0.44)"
          },
          label: { show: row.pctValue >= 10, formatter: formatPct(row.pctValue), color: "#5c5850", fontSize: 10 }
        });

        evidence.push({
          relationType,
          sourceLabel: investor?.name || row.name,
          targetLabel: entity.id,
          pctValue: row.pctValue,
          pct: formatPct(row.pctValue),
          sector: entity.sector || "Unknown",
          freeFloat: metrics.freeFloat,
          largestStrategicHolder: metrics.largestStrategic?.name || "N/A",
          evidence: `holder table:${entity.id}`,
          href: investor ? entityHref("investor", investor.id) : entityHref("ticker", entity.id)
        });

        if (!investor) return;

        collectInvestorPositions(investor)
          .filter((position) => position.ticker !== entity.id)
          .slice(0, 3)
          .forEach((position) => {
            addGraphNode(nodeMap, {
              id: `ticker:${position.ticker}`,
              name: position.ticker,
              kind: "ticker",
              category: 1,
              value: Math.max(12, Math.min(22, 10 + (position.pctValue / 10) + ((position.floatRow?.freeFloat || 0) / 10))),
              symbolSize: Math.max(12, Math.min(22, 10 + (position.pctValue / 10) + ((position.floatRow?.freeFloat || 0) / 10))),
              href: entityHref("ticker", position.ticker)
            });

            addGraphLink(linkMap, {
              source: nodeId,
              target: `ticker:${position.ticker}`,
              value: position.pctValue,
              relationType: "Linked holding",
              lineStyle: { width: Math.max(1, Math.min(4.5, position.pctValue / 12)), color: "rgba(125,90,230,0.34)" },
              label: { show: false }
            });

            evidence.push({
              relationType: "Linked holding",
              sourceLabel: investor.name,
              targetLabel: position.ticker,
              pctValue: position.pctValue,
              pct: formatPct(position.pctValue),
              sector: position.sector,
              freeFloat: position.floatRow?.freeFloat || 0,
              largestStrategicHolder: position.floatRow?.largestStrategicHolder || "N/A",
              evidence: position.fromHolderTable ? "holder table overlap" : "investor page overlap",
              href: entityHref("ticker", position.ticker)
            });
          });
      });

    addGraphNode(nodeMap, {
      id: `blind:${entity.id}`,
      name: `${entity.id} blind spot`,
      kind: "blind-spot",
      category: 3,
      value: Math.max(10, Math.min(20, 8 + (metrics.hiddenFloat / 8))),
      symbolSize: Math.max(10, Math.min(20, 8 + (metrics.hiddenFloat / 8))),
      href: entityHref("ticker", entity.id)
    });

    addGraphLink(linkMap, {
      source: `blind:${entity.id}`,
      target: `ticker:${entity.id}`,
      value: metrics.hiddenFloat,
      relationType: "Blind spot",
      lineStyle: { width: Math.max(1, Math.min(4, metrics.hiddenFloat / 12)), color: "rgba(124,58,237,0.36)" },
      label: { show: false }
    });

    evidence.push({
      relationType: "Blind spot",
      sourceLabel: entity.id,
      targetLabel: entity.id,
      pctValue: metrics.hiddenFloat,
      pct: formatPct(metrics.hiddenFloat),
      sector: entity.sector || "Unknown",
      freeFloat: metrics.freeFloat,
      largestStrategicHolder: metrics.largestStrategic?.name || "N/A",
      evidence: "inferred sub-1% float",
      href: entityHref("ticker", entity.id)
    });

    const mix = buildScenarioMix(evidence);

    return {
      id: entity.id,
      type: "ticker",
      label: `${entity.id} holder stack`,
      title: `${entity.id} holder stack`,
      description: "Ticker-centered graph built from the sourced holder table plus linked investor overlap for holders that recur across issuer disclosures.",
      note: `${metrics.strategicBlockCount} strategic blocks and ${metrics.floatBlockCount} visible float blocks inside the authored table.`,
      nodes: Array.from(nodeMap.values()),
      links: Array.from(linkMap.values()),
      evidence: evidence.sort((a, b) => b.pctValue - a.pctValue || a.targetLabel.localeCompare(b.targetLabel)),
      mix,
      stats: [
        { label: "Strategic Held", value: formatPct(metrics.strategicHeld) },
        { label: "Free Float", value: formatPct(metrics.freeFloat) },
        { label: "Visible Coverage", value: formatPct(metrics.visibleHeld) },
        { label: "HHI", value: metrics.hhiVisible.toFixed(0) }
      ],
      snapshots: [
        { label: "Largest Block", value: formatPct(metrics.largestStrategicPct) },
        { label: "Blind Spot", value: formatPct(metrics.hiddenFloat) },
        { label: "Coverage", value: metrics.coverageBand },
        { label: "Concentration", value: metrics.concentrationBand }
      ],
      highlights: [
        `${entity.id} screens at ${formatPct(metrics.freeFloat)} free float after excluding ${formatPct(metrics.strategicHeld)} strategic holdings.`,
        `Visible coverage reaches ${formatPct(metrics.visibleHeld)}, leaving an inferred ${formatPct(metrics.hiddenFloat)} of float in sub-1% or unobserved holders.`,
        `HHI at ${metrics.hhiVisible.toFixed(0)} and a ${metrics.concentrationBand.toLowerCase()} structure show how dependent the name is on a small number of holders.`
      ],
      connectionHighlights: evidence
        .filter((row) => row.relationType !== "Blind spot")
        .slice(0, 12)
        .map((row) => `${row.sourceLabel} -> ${row.targetLabel} (${row.pct})`)
    };
  }

  function getNetworkScenarios() {
    if (networkScenariosCache) {
      return networkScenariosCache.slice();
    }

    const scenarios = [];
    const investorMap = new Map();

    getSourceLedgerRows().forEach(({ entity }) => {
      (entity.holderTable || [])
        .filter((row) => row.entityKind === "investor" && row.entityId)
        .forEach((row) => {
          if (!investorMap.has(row.entityId)) {
            investorMap.set(row.entityId, resolveInvestorEntityForRow(row) || {
              kind: "investor",
              id: row.entityId,
              name: row.name
            });
          }
        });
    });

    Array.from(investorMap.values())
      .map((investor) => ({
        investor,
        positions: collectInvestorPositions(investor)
      }))
      .filter((entry) => entry.positions.length >= 2)
      .sort((a, b) => b.positions.length - a.positions.length || a.investor.name.localeCompare(b.investor.name))
      .forEach((entry) => {
        const scenario = buildInvestorNetworkScenario(entry.investor);
        if (scenario) scenarios.push(scenario);
      });

    getSourceLedgerRows()
      .map(({ entity }) => entity)
      .sort((a, b) => {
        const aMetrics = computeTickerMetrics(a);
        const bMetrics = computeTickerMetrics(b);
        return aMetrics.freeFloat - bMetrics.freeFloat || a.id.localeCompare(b.id);
      })
      .forEach((entity) => {
        const scenario = buildTickerNetworkScenario(entity);
        if (scenario) scenarios.push(scenario);
      });

    networkScenariosCache = scenarios;
    return scenarios.slice();
  }

  function buildAiAnswer(query) {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return "Ask about a ticker, an investor, free float concentration, or network overlap. Example: BBCA blind spot, Danantara network, most concentrated names.";
    }

    const floatRows = getFloatRows();

    if (normalizedQuery.includes("lowest") && normalizedQuery.includes("float")) {
      const rows = floatRows.slice().sort((a, b) => a.freeFloat - b.freeFloat).slice(0, 3);
      return `Lowest sourced free-float names are ${rows.map((row) => `${row.ticker} ${formatPct(row.freeFloat)}`).join(", ")}.`;
    }

    if (normalizedQuery.includes("highest") && normalizedQuery.includes("float")) {
      const rows = floatRows.slice().sort((a, b) => b.freeFloat - a.freeFloat).slice(0, 3);
      return `Highest sourced free-float names are ${rows.map((row) => `${row.ticker} ${formatPct(row.freeFloat)}`).join(", ")}.`;
    }

    if (normalizedQuery.includes("concentrated") || normalizedQuery.includes("hhi")) {
      const rows = floatRows.slice().sort((a, b) => b.hhi - a.hhi).slice(0, 3);
      return `Most concentrated visible holder structures are ${rows.map((row) => `${row.ticker} HHI ${row.hhi.toFixed(0)}`).join(", ")}.`;
    }

    if (normalizedQuery.includes("blind spot") || normalizedQuery.includes("coverage")) {
      const rows = floatRows.slice().sort((a, b) => b.blindSpot - a.blindSpot).slice(0, 3);
      return `Largest inferred blind spots are ${rows.map((row) => `${row.ticker} ${formatPct(row.blindSpot)}`).join(", ")}. This is the portion of float not directly visible in >1% holder rows.`;
    }

    const match = searchEntities(query, 1)[0];

    if (match?.kind === "ticker") {
      const entity = data.entities?.tickers?.[match.id];
      const row = floatRows.find((item) => item.ticker === match.id);
      const metrics = entity ? computeTickerMetrics(entity) : null;
      const local = row?.localPct ?? metrics?.localPctVisible;
      const foreign = row?.foreignPct ?? metrics?.foreignPctVisible;

      return `${match.id} screens at ${formatPct(row?.freeFloat || metrics?.freeFloat || 0)} free float with ${formatPct(row?.strategicHeld || metrics?.strategicHeld || 0)} strategic holdings and ${formatPct(row?.visibleHeld || metrics?.visibleHeld || 0)} visible coverage. Largest strategic holder is ${row?.largestStrategicHolder || metrics?.largestStrategic?.name || "N/A"} at ${formatPct(row?.largestStrategicPct || metrics?.largestStrategicPct || 0)}. Visible-structure HHI is ${(row?.hhi || metrics?.hhiVisible || 0).toFixed(0)} with a ${String(row?.concentrationBand || metrics?.concentrationBand || "balanced").toLowerCase()} concentration band. ${Number.isFinite(local) && Number.isFinite(foreign) && (local || foreign) ? `Visible ownership mix is ${round2(local)}% local and ${round2(foreign)}% foreign.` : "Local-versus-foreign mix is not fully authored for this symbol yet."} Blind spot estimate is ${formatPct(row?.blindSpot || metrics?.hiddenFloat || 0)}.`;
    }

    if (match?.kind === "investor") {
      const investor = data.entities?.investors?.[match.id];
      const scenario = getNetworkScenarios().find((item) => item.id === match.id);
      if (investor && scenario) {
        const totalStake = scenario.stats.find((item) => item.label === "Total Linked Stake")?.value || "N/A";
        const avgFloat = scenario.stats.find((item) => item.label === "Avg Target Float")?.value || "N/A";
        return `${investor.name} has ${scenario.stats.find((item) => item.label === "Positions")?.value || investor.holdings?.length || 0} linked positions with ${totalStake} total visible stake across the mapped names. Average target free float is ${avgFloat}, and the network includes ${scenario.connectionHighlights.slice(0, 3).join(", ")}.`;
      }
    }

    if (match?.kind === "group") {
      const entity = data.entities?.groups?.[match.id];
      if (entity) {
        const holdings = (entity.holdings || []).slice(0, 3).map((holding) => holding.ticker).join(", ");
        return `${entity.name} is mapped as a conglomerate with ${(entity.holdings || []).length} visible linked tickers in the prototype. Core names include ${holdings || "no authored holdings yet"}.`;
      }
    }

    const sectorExposure = computeSectorExposure();
    if (normalizedQuery.includes("foreign") && normalizedQuery.includes("sector") && sectorExposure.length) {
      const topSector = sectorExposure.slice().sort((a, b) => b.foreign - a.foreign)[0];
      return `Within authored ticker coverage, ${topSector.sector} has the highest foreign mix at ${formatPct(topSector.foreign)}.`;
    }

    return "No exact sourced entity match was resolved. Try a ticker like BBCA or TLKM, or a question such as lowest free float or most concentrated names.";
  }

  window.StockMapUtils = {
    $,
    $$,
    buildAiAnswer,
    buildSignalSummary,
    colorByChange,
    collectInvestorPositions,
    computeHHI,
    computeLocalForeign,
    computeRisk,
    computeRiskScore,
    computeSectorExposure,
    computeTickerMetrics,
    entityAnchor,
    entityHref,
    escapeCsv,
    escapeHtml,
    filterFloatRows,
    findSearchItem,
    formatMarketCap,
    formatPct,
    getSourceEntry,
    getSourceLedgerRows,
    getFloatRows,
    getNetworkScenarios,
    getDecisionEntry,
    getDecisionRows,
    getTickerAnalytics,
    isAllowedToken,
    isStrategicHolder,
    normalize,
    parsePct,
    riskClass,
    round2,
    searchCorpus,
    searchEntities,
    toCsv
  };
})();
