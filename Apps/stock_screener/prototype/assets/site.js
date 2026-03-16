(function () {
  const data = window.StockMapMock;
  const utils = window.StockMapUtils;

  if (!data || !utils) {
    return;
  }

  const {
    $,
    $$,
    colorByChange,
    entityAnchor,
    entityHref,
    escapeHtml,
    formatPct,
    getFloatRows,
    getNetworkScenarios,
    riskClass,
    searchEntities
  } = utils;

  function initCountdown() {
    if (!$("#cd-d")) return;

    const end = new Date("2026-03-19T16:59:00Z").getTime();
    const ids = ["cd-d", "cd-h", "cd-m", "cd-s"];
    const pad = (num) => String(num).padStart(2, "0");

    function tick() {
      const now = Date.now();
      let diff = Math.max(0, Math.floor((end - now) / 1000));
      const days = Math.floor(diff / 86400);
      diff %= 86400;
      const hours = Math.floor(diff / 3600);
      diff %= 3600;
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      const values = [days, hours, minutes, seconds];

      ids.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el) el.textContent = pad(values[index]);
      });

      if (end - now > 0) {
        setTimeout(tick, 1000);
      }
    }

    tick();
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
    input.addEventListener("focus", () => {
      const query = input.value.trim();
      renderSearchResults(results, searchEntities(query, 6));
    });

    document.addEventListener("click", (event) => {
      if (!results.contains(event.target) && event.target !== input) {
        results.classList.remove("is-open");
      }
    });
  }

  function renderLandingStats() {
    const container = $("#landing-stats");
    if (!container) return;

    container.innerHTML = data.landingStats
      .map((item) => {
        const numeric = Number.parseInt(String(item.value).replace(/[^0-9]/g, ""), 10);
        const isNumeric = Number.isFinite(numeric) && numeric > 0;
        return `
          <div class="stat-item reveal">
            <div class="stat-num" ${isNumeric ? `data-count="${numeric}"` : ""}>${escapeHtml(item.value)}</div>
            <div class="stat-label">${escapeHtml(item.label)}</div>
          </div>
        `;
      })
      .join("");
  }

  function renderFeatureCards() {
    const container = $("#feature-grid");
    if (!container) return;

    container.innerHTML = data.featureCards
      .map((item) => {
        const isNew = item.title === "Market Heatmap";
        return `
          <article class="feature-card reveal ${isNew ? "is-new" : ""}">
            ${isNew ? '<div class="new-tag">New</div>' : ""}
            <div class="feature-icon">${escapeHtml(item.icon)}</div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderMarketOverviewRow(item) {
    const tone = item.tone ? `tone-${item.tone}` : "tone-accent";
    return `
      <div class="list-row">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="code-pill ${tone}">${escapeHtml(item.code)}</span>
          <span>${escapeHtml(item.name)}</span>
        </div>
        <span class="mono muted">${escapeHtml(item.count)}</span>
      </div>
    `;
  }

  function renderHotSearchRow(item) {
    return `
      <div class="list-row">
        <span class="mono muted" style="width:16px">${escapeHtml(item.rank)}</span>
        <span style="font-weight:600">${entityAnchor(item.name)}</span>
        <span class="mono muted">${escapeHtml(item.count)}</span>
      </div>
    `;
  }

  function renderForeignRow(item) {
    return `
      <div class="list-row">
        <span>${entityAnchor(item.name)}</span>
        <span class="metric-pill tone-blue">${escapeHtml(item.positions)}</span>
      </div>
    `;
  }

  function renderConglomerateRow(item) {
    return `
      <div class="list-row">
        <span>${entityAnchor(item.name)}</span>
        <span class="mono muted">${escapeHtml(item.tickers)}</span>
      </div>
    `;
  }

  function renderOverviewLists() {
    const sections = [
      ["#market-overview-list", data.overview.marketOverview, renderMarketOverviewRow],
      ["#hot-searches-list", data.overview.hotSearches, renderHotSearchRow],
      ["#top-foreign-list", data.overview.topForeign, renderForeignRow],
      ["#conglomerate-list", data.overview.conglomerates, renderConglomerateRow]
    ];

    sections.forEach(([selector, rows, renderer]) => {
      const container = $(selector);
      if (!container) return;
      container.innerHTML = rows.map(renderer).join("");
    });
  }

  function renderFundSection() {
    const listBody = $("#fund-list-body");
    const detailBody = $("#fund-detail-body");
    const detailTitle = $("#fund-detail-title");
    const detailTags = $("#fund-detail-tags");

    if (listBody) {
      listBody.innerHTML = data.funds.list
        .map(
          (item) => `
            <div class="list-row">
              <span style="font-weight:600">${entityAnchor(item.investor)}</span>
              <span class="code-pill ${item.nat === "F" ? "tone-blue" : "tone-green"}">${escapeHtml(item.nat)}</span>
              <span class="mono">${escapeHtml(item.pos)}</span>
              <span class="mono" style="color:var(--accent);font-weight:600">${escapeHtml(item.top)}</span>
            </div>
          `
        )
        .join("");
    }

    if (detailTitle) detailTitle.textContent = data.funds.detail.name;

    if (detailTags) {
      detailTags.innerHTML = data.funds.detail.tags
        .map((tag, index) => `<span class="type-badge ${index === 2 ? "tone-accent" : "tone-green"}">${escapeHtml(tag)}</span>`)
        .join("");
    }

    if (detailBody) {
      detailBody.innerHTML = data.funds.detail.holdings
        .map(
          (item) => `
            <div class="list-row">
              <span class="mono" style="font-weight:700;color:var(--green)"><a class="entity-inline-link" href="${entityHref("ticker", item.ticker)}">${escapeHtml(item.ticker)}</a></span>
              <span class="muted-copy">${escapeHtml(item.company)}</span>
            </div>
          `
        )
        .join("");
    }
  }

  function renderFloatPreview() {
    const body = $("#free-float-preview-body");
    if (!body) return;

    const rows = getFloatRows().slice().sort((a, b) => a.freeFloat - b.freeFloat).slice(0, 6);

    body.innerHTML = rows
      .map(
        (item, index) => `
          <tr class="${index > 3 ? "blur-row" : ""}">
            <td class="mono" style="font-weight:700;color:var(--accent)"><a class="entity-inline-link" href="${entityHref("ticker", item.ticker)}">${escapeHtml(item.ticker)}</a></td>
            <td>${escapeHtml(item.holder)}</td>
            <td class="right mono">${formatPct(item.totalHeld)}</td>
            <td class="right mono ${riskClass(item.risk)}">${formatPct(item.freeFloat)}</td>
          </tr>
        `
      )
      .join("");
  }

  function renderPositionTables() {
    const tables = [
      ["#hidden-lkh-body", data.hiddenPositions],
      ["#hidden-norway-body", data.norwayPositions]
    ];

    tables.forEach(([selector, rows]) => {
      const body = $(selector);
      if (!body) return;

      body.innerHTML = rows
        .map(
          (row, index) => `
            <tr class="${index > 2 ? "blur-row" : ""}">
              <td class="mono" style="font-weight:700;color:var(--accent)"><a class="entity-inline-link" href="${entityHref("ticker", row.ticker)}">${escapeHtml(row.ticker)}</a></td>
              <td>${entityAnchor(row.investor)}</td>
              <td class="mono">${escapeHtml(row.type)}</td>
              <td class="mono">${escapeHtml(row.nationality)}</td>
              <td class="right mono">${escapeHtml(row.pct)}</td>
            </tr>
          `
        )
        .join("");
    });
  }

  function initLandingCharts() {
    if (!window.echarts) {
      const networkFallback = $("#landing-network-chart");
      const heatmapFallback = $("#landing-heatmap-chart");
      if (networkFallback) networkFallback.innerHTML = '<div class="muted-copy">ECharts CDN unavailable. Network graph placeholder only.</div>';
      if (heatmapFallback) heatmapFallback.innerHTML = '<div class="muted-copy">ECharts CDN unavailable. Heatmap placeholder only.</div>';
      return;
    }

    const networkEl = $("#landing-network-chart");
    if (networkEl) {
      const scenario = getNetworkScenarios()[0] || null;
      const nodes = scenario?.nodes || data.network.nodes;
      const links = scenario?.links || data.network.links;
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
            data: nodes.map((node) => ({
              ...node,
              symbolSize: node.symbolSize || node.value,
              itemStyle: {
                color: node.category === 0 ? "#e55300" : node.category === 1 ? "#2563eb" : node.category === 2 ? "#1a8754" : "#7c3aed"
              }
            })),
            links,
            lineStyle: {
              color: "rgba(0,0,0,0.12)",
              width: 1.5
            }
          }
        ]
      });
      window.addEventListener("resize", () => chart.resize());
    }

    const heatmapEl = $("#landing-heatmap-chart");
    if (heatmapEl) {
      const chart = window.echarts.init(heatmapEl, null, { renderer: "canvas" });
      chart.setOption({
        tooltip: {
          formatter(params) {
            const item = params.data;
            const sign = item.change > 0 ? "+" : "";
            return `${item.name}<br>${item.sector}<br>Change: ${sign}${item.change.toFixed(1)}%`;
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
              color: "#ffffff",
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
      window.addEventListener("resize", () => chart.resize());
    }
  }

  function applyReferralPricing() {
    return;
  }

  function bindLandingForms() {
    const payForm = $("#pay-form");
    const payMessage = $("#pay-msg");
    const recoverButton = $("#recover-login-btn");
    const recoverInput = $("#recover-email-landing");
    const recoverMessage = $("#recover-msg");

    if (payForm && payMessage) {
      payForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(payForm);
        const tos = $("#tos-check");

        if (!tos || !tos.checked) {
          payMessage.className = "form-msg err";
          payMessage.textContent = "Please agree to the Terms of Service.";
          return;
        }

        const name = String(formData.get("name") || "").trim();
        const email = String(formData.get("email") || "").trim();
        const phone = String(formData.get("phone") || "").trim();

        if (!name || !email || !phone) {
          payMessage.className = "form-msg err";
          payMessage.textContent = "Name, email, and phone are required.";
          return;
        }

        payMessage.className = "form-msg ok";
        payMessage.textContent = "Prototype mode: payment request captured locally. Next step is wiring /api/pay.";
      });
    }

    function handleRecover() {
      if (!recoverInput || !recoverMessage) return;
      const email = recoverInput.value.trim();

      if (!email) {
        recoverMessage.className = "form-msg err";
        recoverMessage.textContent = "Enter your email.";
        return;
      }

      sessionStorage.setItem("idx_token", "prototype-token");
      recoverMessage.className = "form-msg ok";
      recoverMessage.textContent = "Prototype login accepted. Opening the app shell...";
      setTimeout(() => {
        window.location.href = "./app.html";
      }, 600);
    }

    if (recoverButton) recoverButton.addEventListener("click", handleRecover);
    if (recoverInput) {
      recoverInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") handleRecover();
      });
    }
  }

  function renderMethodology() {
    const stats = $("#method-stats");
    const classBody = $("#method-classification-body");
    const rules = $("#method-id-rules");
    const limitations = $("#method-limitations");

    if (stats) {
      stats.innerHTML = data.methodology.stats
        .map(
          (item) => `
            <div class="method-stat">
              <div class="method-stat-value">${escapeHtml(item.value)}</div>
              <div class="method-stat-label">${escapeHtml(item.label)}</div>
            </div>
          `
        )
        .join("");
    }

    if (classBody) {
      classBody.innerHTML = data.methodology.classifications
        .map(
          (item) => `
            <tr>
              <td class="mono" style="font-weight:700">${escapeHtml(item.code)}</td>
              <td>${escapeHtml(item.type)}</td>
              <td class="mono">${escapeHtml(item.classification)}</td>
              <td>${escapeHtml(item.rationale)}</td>
            </tr>
          `
        )
        .join("");
    }

    if (rules) {
      rules.innerHTML = data.methodology.idRules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("");
    }

    if (limitations) {
      limitations.innerHTML = data.methodology.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    }
  }

  function bindAffiliateForm() {
    const stepList = $("#affiliate-steps");
    const form = $("#affiliate-form");
    const message = $("#affiliate-msg");
    const refField = $("#affiliate-upline");

    if (stepList) {
      stepList.innerHTML = data.affiliate.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
    }

    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && refField) {
      refField.value = ref;
    }

    if (form && message) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const fd = new FormData(form);
        const name = String(fd.get("name") || "").trim();
        const email = String(fd.get("email") || "").trim();
        const contact = String(fd.get("contact") || "").trim();

        if (!name || !email || !contact) {
          message.className = "form-msg err";
          message.textContent = "Name, email, and contact are required.";
          return;
        }

        message.className = "form-msg ok";
        message.textContent = "Prototype mode: affiliate application captured. Next step is wiring /api/affiliate/apply.";
      });
    }
  }

  function initLandingPage() {
    renderLandingStats();
    renderFeatureCards();
    renderOverviewLists();
    renderFundSection();
    renderFloatPreview();
    renderPositionTables();
    initLandingCharts();
    initCountdown();
    applyReferralPricing();
    bindLandingForms();
    attachSearch("#landing-search-input", "#landing-search-results");
  }

  function initMethodPage() {
    renderMethodology();
  }

  function initAffiliatePage() {
    bindAffiliateForm();
  }

  function initScrollReveal() {
    const targets = $$(".scroll-reveal");
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
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
  }

  function initAnimatedCounters() {
    const counters = $$('[data-count]');
    if (!counters.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const el = entry.target;
          const target = Number.parseInt(el.dataset.count, 10);
          const suffix = el.dataset.suffix || "";
          const prefix = el.dataset.prefix || "";
          const duration = 1200;
          const start = performance.now();

          function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * eased);
            el.textContent = prefix + current.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(tick);
          }

          requestAnimationFrame(tick);
          observer.unobserve(el);
        });
      },
      { threshold: 0.3 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  function initHeroParallax() {
    const hero = $(".hero");
    if (!hero) return;

    hero.addEventListener("mousemove", (event) => {
      const rect = hero.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 8;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 6;
      const heading = $("h1", hero);
      if (heading) heading.style.transform = `translate(${x}px, ${y}px)`;
    });

    hero.addEventListener("mouseleave", () => {
      const heading = $("h1", hero);
      if (heading) heading.style.transform = "";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;

    if (page === "landing") initLandingPage();
    if (page === "methodology") initMethodPage();
    if (page === "affiliate") initAffiliatePage();

    initScrollReveal();
    initAnimatedCounters();
    if (page === "landing") initHeroParallax();
  });
})();
