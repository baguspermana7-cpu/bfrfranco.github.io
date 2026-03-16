window.StockMapMock = {
  meta: {
    siteName: "StockMap Indonesia",
    kseiDate: "Source dates vary by issuer",
    methodologyDate: "March 2026",
    allowedTokens: ["prototype-token", "meta-demo-2026"],
    accessMode: "Direct full access",
    sourceCopy: "Official issuer disclosures only",
    coverageMode: "Official-source-only",
    coverageDate: "16 Mar 2026",
    paymentProvider: "Mayar.id"
  },
  landingStats: [
    { label: "Ready Tickers", value: "13" },
    { label: "Review Queue", value: "1" },
    { label: "Investor Scenarios", value: "7" },
    { label: "Synthetic Rows", value: "0" }
  ],
  featureCards: [
    {
      icon: "Source",
      title: "Official Source Ledger",
      body: "Every analytics row is tied to an issuer disclosure with an explicit as-of date."
    },
    {
      icon: "Float",
      title: "Sourced Float Screener",
      body: "Free-float metrics run only on ready-status issuer disclosures."
    },
    {
      icon: "Graph",
      title: "Issuer-Derived Networks",
      body: "Investor-ticker overlap is built from recurring holder-table evidence."
    },
    {
      icon: "Scope",
      title: "Coverage Discipline",
      body: "Review-required names remain in the ledger but stay out of analytics."
    }
  ],
  overview: { kpis: [], marketOverview: [], hotSearches: [], topForeign: [], conglomerates: [] },
  funds: { count: "0", list: [], detail: { name: "", tags: [], holdings: [] } },
  freeFloat: [],
  hiddenPositions: [],
  norwayPositions: [],
  network: { title: "", nodes: [], links: [] },
  heatmap: [],
  methodology: {
    classifications: [
      { code: "CP", type: "Corporate", classification: "Strategic", rationale: "Cross-holdings, parent companies, holding entities" },
      { code: "IB", type: "Bank", classification: "Strategic", rationale: "Commercial banks and custodial banks with strategic or custodial positions" },
      { code: "FD", type: "Foundation", classification: "Strategic", rationale: "Family foundations and long-term strategic vehicles" },
      { code: "OT", type: "Other", classification: "Strategic", rationale: "Nominees, SPVs, and unclassified entities that need manual control review" },
      { code: "ID", type: "Individual", classification: "Conditional", rationale: "Free float by default unless verified as insider" },
      { code: "MF", type: "Mutual Fund", classification: "Free Float", rationale: "Portfolio investment and regularly tradeable" },
      { code: "IS", type: "Insurance", classification: "Free Float", rationale: "Portfolio allocation and investment-grade holdings" },
      { code: "PF", type: "Pension Fund", classification: "Free Float", rationale: "Long-term portfolio but still freely tradeable" },
      { code: "SC", type: "Securities Co.", classification: "Free Float", rationale: "Broker and dealer inventory or market-making positions" }
    ],
    idRules: [
      "If the individual holds 20% or more, classify as strategic.",
      "If board, commissioner, founder, family-vehicle, or insider evidence exists, classify as strategic.",
      "If the individual holds material stakes across multiple issuers, trigger manual review rather than automatic strategic classification.",
      "If no control evidence is found, treat the individual as free float."
    ],
    stats: [
      { label: "Ready Tickers", value: "13" },
      { label: "Review Queue", value: "1" },
      { label: "Named Holders", value: "24" },
      { label: "Official Sources", value: "14" },
      { label: "Latest Snapshot", value: "28 Feb 2026" },
      { label: "Earliest Snapshot", value: "31 Dec 2023" }
    ],
    limitations: [
      "This local build now excludes synthetic aggregate rows from the app and keeps only issuer-sourced ownership snapshots.",
      "Source dates differ by issuer, so every row must be read together with its as-of date rather than as a same-day market snapshot.",
      "Some issuers publish only controlling blocks plus public categories, while others publish top public holder tables.",
      "Strategic classification can remain review-sensitive when named corporate holders appear without explicit affiliation disclosure.",
      "Rows marked review-required stay visible in the source ledger but are excluded from sourced analytics until classification is defensible."
    ]
  },
  sourceLedger: {
    BBCA: {
      status: "ready",
      asOf: "31 Dec 2024",
      sourceLabel: "BCA Annual Report 2024",
      sourceUrl: "https://www.bca.co.id/en/tentang-bca/hubungan-investor/laporan-presentasi/laporan-tahunan",
      note: "Strategic control anchored by PT Dwimuria Investama Andalan. Public float uses issuer disclosure."
    },
    BBRI: {
      status: "ready",
      asOf: "31 Dec 2023",
      sourceLabel: "BRI Annual Report 2023",
      sourceUrl: "https://bri.co.id/documents/20123/56790/Annual+Report+BBRI+2023-Eng.pdf",
      note: "Public ownership split is sourced from the issuer annual report ownership composition disclosure."
    },
    TLKM: {
      status: "ready",
      asOf: "31 Dec 2024",
      sourceLabel: "Telkom Annual Report 2024",
      sourceUrl: "https://minio.telkom.co.id/telkom-about/media/CRdDglE0R-Annual-Report-2024.pdf",
      note: "Named public holders come from the 20 largest public shareholders table in the annual report."
    },
    BMRI: {
      status: "ready",
      asOf: "30 Sep 2025",
      sourceLabel: "Bank Mandiri September 2025 Corporate Presentation",
      sourceUrl: "https://bankmandiri.co.id/web/ir/corporate-presentations",
      note: "Ownership composition uses the issuer presentation table; note states the majority state block was transferred to Danantara while Government retains Series A."
    },
    BBNI: {
      status: "ready",
      asOf: "31 Jan 2026",
      sourceLabel: "BNI Shares Ownership Structure",
      sourceUrl: "https://www.bni.co.id/en-us/investors/stock-bond-information/shares-ownership-structure",
      note: "Danantara and Government rows are sourced from the issuer ownership structure, with domestic and foreign public categories preserved."
    },
    ASII: {
      status: "ready",
      asOf: "28 Feb 2026",
      sourceLabel: "Astra Shareholder Composition",
      sourceUrl: "https://www.astra.co.id/Investor-Relations/Stock-Information/Shareholder-Composition",
      note: "Foreign public mix is net of Jardine's strategic block so float is not double counted."
    },
    TINS: {
      status: "ready",
      asOf: "31 Dec 2025",
      sourceLabel: "PT Timah Shareholder Composition",
      sourceUrl: "https://timah.com/en/shareholder/",
      note: "Issuer disclosure shows a 65.00% strategic state block and 35.00% public ownership."
    },
    ITMG: {
      status: "ready",
      asOf: "31 Dec 2024",
      sourceLabel: "ITMG Annual Report 2024",
      sourceUrl: "https://www.itmg.co.id/files/itr_itmg/annualreport/Annual_Report_2024_PDF.pdf",
      note: "Top 10 shareholders table provides the strategic parent and named public holders above 1%."
    },
    GIAA: {
      status: "ready",
      asOf: "08 Dec 2025",
      sourceLabel: "Garuda PMTHMETD Information Disclosure",
      sourceUrl: "https://www.garuda-indonesia.com/static/content/dam/garuda/files/pdf/investor-relations/corporate-governance/FIN%20Keterbukaan%20Informasi%20PMTHMED_.pdf",
      note: "Post-PMTHMETD structure uses the official pro forma shareholding table plus the final share issuance result notice dated 8 December 2025."
    },
    BUMI: {
      status: "review_required",
      asOf: "27 Feb 2026",
      sourceLabel: "Bumi Resources Shareholder Composition",
      sourceUrl: "https://www.bumiresources.com/en/about-us",
      note: "Named corporate holders are official, but strategic-versus-portfolio classification is still under review and excluded from sourced analytics."
    },
    ANTM: {
      status: "ready",
      asOf: "31 Aug 2025",
      sourceLabel: "ANTAM Ownership Structure",
      sourceUrl: "https://www.antam.com/id/stock-information",
      note: "Ownership structure and top-20 shareholders come from the issuer ownership page as of August 2025."
    },
    PTBA: {
      status: "ready",
      asOf: "31 Aug 2025",
      sourceLabel: "PTBA Shareholder List",
      sourceUrl: "https://old.ptba.co.id/en/shareholders",
      note: "Structure, treasury stock, and top-20 shareholders are sourced from the issuer shareholder list as of 31 August 2025."
    },
    INCO: {
      status: "ready",
      asOf: "31 Mar 2025",
      sourceLabel: "Vale Indonesia Shares Information",
      sourceUrl: "https://vale.com/indonesia/shares-information",
      note: "Share counts and free-float split are sourced from Vale Indonesia's shares information page."
    },
    PGAS: {
      status: "ready",
      asOf: "31 Oct 2025",
      sourceLabel: "PGAS Shareholders Page",
      sourceUrl: "https://pgas-investor.com/shareholders/our-shareholders/",
      note: "Control block and named holders use the official PGAS shareholders page as of 31 October 2025."
    }
  },
  affiliate: {
    steps: [
      "Daftar jadi affiliate dan langsung dapat link referral unik.",
      "Bagikan link ke teman, komunitas, atau followers untuk komisi hingga 30% per sale.",
      "Gunakan referral utama dan sub-affiliate flow untuk tracking komisi berlapis."
    ]
  },
  sectorExposure: [],
  spotlights: [],
  entities: {
    tickers: {
      BBCA: {
        kind: "ticker",
        id: "BBCA",
        name: "Bank Central Asia Tbk",
        sector: "Banking",
        marketCap: 1140,
        dailyChange: 0.8,
        eyebrow: "Ticker detail",
        summary: "Large-cap Indonesian bank with strategic control anchored by the Djarum ecosystem. Float remains deep enough for market relevance, but strategic influence is still obvious.",
        tags: ["Banking", "Large Cap", "Low Risk Float"],
        metrics: [
          { label: "Market Cap", value: "Rp1,140T" },
          { label: "Free Float", value: "45.06%" },
          { label: "Visible Held", value: "58.67%" },
          { label: "P/E", value: "22.1x" },
          { label: "P/B", value: "4.8x" },
          { label: "ROE", value: "21.4%" }
        ],
        localForeign: null,
        summaryPoints: [
          "Djarum strategic layer keeps effective control even while the free float remains investable.",
          "Foreign participation is still material enough to keep BBCA relevant for institutional flow tracking.",
          "Investor page links are useful here because cross-holdings tend to matter more than a raw holder list."
        ],
        holderTable: [
          { name: "PT DWIMURIA INVESTAMA ANDALAN", type: "CP", nat: "L", pct: "54.94%", strategic: true, entityId: "pt-dwimuria-investama-andalan", entityKind: "investor" },
          { name: "CITIBANK SINGAPORE S/A GOVERNMENT OF SINGAPORE", type: "PF", nat: "F", pct: "1.44%", classificationOverride: "float", entityId: "government-of-singapore", entityKind: "investor" },
          { name: "OTHER PUBLIC SHAREHOLDERS", type: "MF", nat: "", pct: "43.62%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Dwimuria Investama Andalan", kind: "investor", id: "pt-dwimuria-investama-andalan" },
          { label: "Government of Singapore", kind: "investor", id: "government-of-singapore" }
        ]
      },
      BBRI: {
        kind: "ticker",
        id: "BBRI",
        name: "Bank Rakyat Indonesia Tbk",
        sector: "Banking",
        marketCap: 760,
        dailyChange: -1.2,
        eyebrow: "Ticker detail",
        summary: "State-linked bank where strategic ownership remains visible through a concentrated control layer while float is still deep enough for broad market participation.",
        tags: ["Banking", "State-linked", "Low Risk Float"],
        metrics: [
          { label: "Market Cap", value: "Rp760T" },
          { label: "Free Float", value: "41.5%" },
          { label: "Strategic Held", value: "58.5%" },
          { label: "Visible Held", value: "60.76%" },
          { label: "P/E", value: "11.9x" },
          { label: "P/B", value: "2.2x" },
          { label: "ROE", value: "19.1%" }
        ],
        localForeign: [
          { name: "Local", value: 63.44 },
          { name: "Foreign", value: 36.56 }
        ],
        summaryPoints: [
          "Strategic control is still clear despite large public market participation.",
          "Foreign ownership is meaningful but subordinate to the local strategic block.",
          "BRI is useful for explaining how state-linked control can still coexist with liquid float."
        ],
        holderTable: [
          { name: "GOVERNMENT OF THE REPUBLIC OF INDONESIA", type: "CP", nat: "L", pct: "53.19%", strategic: true },
          { name: "DOMESTIC PUBLIC HOLDERS", type: "PF", nat: "L", pct: "10.25%", classificationOverride: "float" },
          { name: "FOREIGN PUBLIC HOLDERS", type: "PF", nat: "F", pct: "36.56%", classificationOverride: "float" }
        ],
        related: [
          { label: "TLKM", kind: "ticker", id: "TLKM" }
        ]
      },
      TLKM: {
        kind: "ticker",
        id: "TLKM",
        name: "Telkom Indonesia Tbk",
        sector: "Telecom",
        marketCap: 410,
        dailyChange: -0.3,
        eyebrow: "Ticker detail",
        summary: "Strategic state-linked ownership remains dominant, but the float profile is healthier than many concentrated names and still relevant for foreign institutions.",
        tags: ["Telecom", "State-linked", "Low Risk Float"],
        metrics: [
          { label: "Market Cap", value: "Rp410T" },
          { label: "Free Float", value: "43.9%" },
          { label: "Strategic Held", value: "56.1%" },
          { label: "Visible Held", value: "59.23%" },
          { label: "P/E", value: "10.8x" },
          { label: "P/B", value: "1.8x" },
          { label: "ROE", value: "16.5%" }
        ],
        localForeign: [
          { name: "Local", value: 54.9 },
          { name: "Foreign", value: 45.1 }
        ],
        summaryPoints: [
          "Telkom is a useful benchmark for strategic state control without collapsing tradable float.",
          "Foreign participation remains structurally important.",
          "A production entity page should show historical shifts in strategic versus float composition."
        ],
        holderTable: [
          { name: "GOVERNMENT OF THE REPUBLIC OF INDONESIA", type: "CP", nat: "L", pct: "52.09%", strategic: true },
          { name: "DJS KETENAGAKERJAAN PROGRAM JHT", type: "PF", nat: "L", pct: "2.39%", classificationOverride: "float", entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "EMPLOYEES PROVIDENT FUND BOARD", type: "PF", nat: "F", pct: "1.79%", classificationOverride: "float", entityId: "employees-provident-fund-board", entityKind: "investor" },
          { name: "CITIBANK N.A. S/A GOVERNMENT OF SINGAPORE", type: "PF", nat: "F", pct: "1.46%", classificationOverride: "float", entityId: "government-of-singapore", entityKind: "investor" },
          { name: "JPMCB NA RE-VANGUARD TOTAL INTERNATIONAL STOCK INDEX FUND", type: "MF", nat: "F", pct: "0.66%", classificationOverride: "float", entityId: "vanguard-total-international-stock-index-fund", entityKind: "investor" },
          { name: "JPMCB NA RE-VANGUARD EMERGING MARKETS STOCK INDEX FUND", type: "MF", nat: "F", pct: "0.60%", classificationOverride: "float", entityId: "vanguard-emerging-markets-stock-index-fund", entityKind: "investor" },
          { name: "THE BANK OF NEW YORK MELLON S/A GOVERNMENT OF NORWAY", type: "PF", nat: "F", pct: "0.29%", classificationOverride: "float", entityId: "government-of-norway", entityKind: "investor" },
          { name: "DJS PENSION PROGRAM JP", type: "PF", nat: "L", pct: "0.42%", classificationOverride: "float", entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "OTHER PUBLIC SHAREHOLDERS", type: "MF", nat: "", pct: "40.30%", classificationOverride: "float" }
        ],
        related: [
          { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan" },
          { label: "Government of Singapore", kind: "investor", id: "government-of-singapore" },
          { label: "Employees Provident Fund Board", kind: "investor", id: "employees-provident-fund-board" }
        ]
      },
      BMRI: {
        kind: "ticker",
        id: "BMRI",
        name: "Bank Mandiri Tbk",
        sector: "Banking",
        marketCap: 760,
        dailyChange: 1.5,
        eyebrow: "Ticker detail",
        summary: "State-linked bank with a concentrated strategic block but still broad enough public participation to remain institutionally relevant. The key analytical question is not whether control exists, but how much tradeable float remains after strategic exclusions.",
        tags: ["Banking", "State-linked", "Low Risk Float"],
        metrics: [
          { label: "Market Cap", value: "Rp760T" },
          { label: "Free Float", value: "44.4%" },
          { label: "Strategic Held", value: "55.6%" },
          { label: "Visible Held", value: "57.8%" },
          { label: "P/E", value: "10.7x" },
          { label: "P/B", value: "2.1x" },
          { label: "ROE", value: "20.2%" }
        ],
        localForeign: [
          { name: "Local", value: 70.37 },
          { name: "Foreign", value: 29.63 }
        ],
        summaryPoints: [
          "Danantara remains the anchor strategic holder, but the float profile is still healthier than tightly held small caps.",
          "Mandiri is useful for comparing state-linked banks with similar control logic but different foreign participation levels.",
          "Holder-level detail matters because the gap between visible coverage and strategic holdings is narrower than in many small-cap names."
        ],
        holderTable: [
          { name: "GOVERNMENT OF THE REPUBLIC OF INDONESIA / DANANTARA NOTE", type: "CP", nat: "L", pct: "52.00%", strategic: true },
          { name: "INDONESIA INVESTMENT AUTHORITY", type: "CP", nat: "L", pct: "8.00%", strategic: true, entityId: "indonesia-investment-authority", entityKind: "investor" },
          { name: "LOCAL INSTITUTIONS", type: "PF", nat: "L", pct: "5.25%", classificationOverride: "float" },
          { name: "LOCAL RETAIL", type: "ID", nat: "L", pct: "5.12%", classificationOverride: "float" },
          { name: "FOREIGN INVESTORS", type: "PF", nat: "F", pct: "29.63%", classificationOverride: "float" }
        ],
        related: [
          { label: "Indonesia Investment Authority", kind: "investor", id: "indonesia-investment-authority" },
          { label: "BBRI", kind: "ticker", id: "BBRI" }
        ]
      },
      BBNI: {
        kind: "ticker",
        id: "BBNI",
        name: "Bank Negara Indonesia Tbk",
        sector: "Banking",
        marketCap: 480,
        dailyChange: 0.4,
        eyebrow: "Ticker detail",
        summary: "Another state-linked bank where strategic control remains dominant but public market participation is still deep enough for institutional trading screens.",
        tags: ["Banking", "State-linked", "Low Risk Float"],
        metrics: [
          { label: "Market Cap", value: "Rp480T" },
          { label: "Free Float", value: "40.6%" },
          { label: "Strategic Held", value: "59.4%" },
          { label: "Visible Held", value: "62.56%" },
          { label: "P/E", value: "9.8x" },
          { label: "P/B", value: "1.4x" },
          { label: "ROE", value: "15.1%" }
        ],
        localForeign: [
          { name: "Local", value: 76.88 },
          { name: "Foreign", value: 23.12 }
        ],
        summaryPoints: [
          "BNNI sits in the same strategic-control family as the other state banks, but at a cheaper valuation profile.",
          "The overlap with Norway, BPJS, and BlackRock makes BBNI useful for cross-bank ownership mapping.",
          "The main research value is comparing how similar control structures still produce different float and valuation outcomes."
        ],
        holderTable: [
          { name: "GOVERNMENT OF THE REPUBLIC OF INDONESIA", type: "CP", nat: "L", pct: "0.60%", strategic: true },
          { name: "PT DANANTARA ASSET MANAGEMENT", type: "CP", nat: "L", pct: "59.40%", strategic: true, entityId: "pt-danantara-asset-management", entityKind: "investor" },
          { name: "DOMESTIC PUBLIC HOLDERS", type: "PF", nat: "L", pct: "16.88%", classificationOverride: "float" },
          { name: "FOREIGN HOLDERS", type: "PF", nat: "F", pct: "23.12%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management" }
        ]
      },
      ASII: {
        kind: "ticker",
        id: "ASII",
        name: "Astra International Tbk",
        sector: "Industrial",
        marketCap: 680,
        dailyChange: 2.1,
        eyebrow: "Ticker detail",
        summary: "Large-cap industrial and consumer proxy with a clear strategic foreign parent block but still a deep public float profile.",
        tags: ["Industrial", "Large Cap", "Strategic Parent"],
        metrics: [
          { label: "Market Cap", value: "Rp680T" },
          { label: "Free Float", value: "49.89%" },
          { label: "Strategic Held", value: "50.11%" },
          { label: "Visible Held", value: "53.14%" },
          { label: "P/E", value: "8.9x" },
          { label: "P/B", value: "1.5x" },
          { label: "ROE", value: "17.2%" }
        ],
        localForeign: [
          { name: "Local", value: 13.98 },
          { name: "Foreign", value: 86.02 }
        ],
        summaryPoints: [
          "ASII is a useful reminder that concentrated strategic ownership does not automatically imply a tight float.",
          "It also gives the network engine a non-state strategic block to compare against Danantara-linked banks.",
          "The visible holder set is heavily foreign, which changes the interpretation of flow sensitivity."
        ],
        holderTable: [
          { name: "JARDINE CYCLE & CARRIAGE LTD", type: "CP", nat: "F", pct: "50.11%", strategic: true, entityId: "jardine-cycle-carriage-ltd", entityKind: "investor" },
          { name: "DOMESTIC PUBLIC HOLDERS", type: "PF", nat: "L", pct: "13.98%", classificationOverride: "float" },
          { name: "FOREIGN PUBLIC HOLDERS EX-JARDINE", type: "PF", nat: "F", pct: "35.91%", classificationOverride: "float" }
        ],
        related: [
          { label: "Jardine Cycle & Carriage Ltd", kind: "investor", id: "jardine-cycle-carriage-ltd" }
        ]
      },
      TINS: {
        kind: "ticker",
        id: "TINS",
        name: "Timah Tbk",
        sector: "Materials",
        marketCap: 19.5,
        dailyChange: 1.7,
        eyebrow: "Ticker detail",
        summary: "State-linked metals name where strategic government ownership is clear, but visible institutional float still matters for market interpretation.",
        tags: ["Materials", "State-linked", "Medium Float"],
        metrics: [
          { label: "Market Cap", value: "Rp19.5T" },
          { label: "Free Float", value: "35%" },
          { label: "Strategic Held", value: "65%" },
          { label: "Visible Held", value: "68.14%" },
          { label: "P/E", value: "7.8x" },
          { label: "P/B", value: "0.9x" },
          { label: "ROE", value: "11.3%" }
        ],
        localForeign: null,
        summaryPoints: [
          "TINS is useful for showing how a government strategic block can coexist with visible foreign fund participation.",
          "Norway, Vanguard, and BPJS create a cleaner institutional overlap map than many small-cap names.",
          "The core distinction here is between strategic state control and still-tradeable public float."
        ],
        holderTable: [
          { name: "PT MINERAL INDUSTRI INDONESIA (MIND ID)", type: "CP", nat: "L", pct: "65.00%", strategic: true, entityId: "mineral-industri-indonesia", entityKind: "investor" },
          { name: "PUBLIC HOLDERS", type: "PF", nat: "", pct: "35.00%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Mineral Industri Indonesia (MIND ID)", kind: "investor", id: "mineral-industri-indonesia" }
        ]
      },
      ITMG: {
        kind: "ticker",
        id: "ITMG",
        name: "Indo Tambangraya Megah Tbk",
        sector: "Energy",
        marketCap: 29.8,
        dailyChange: 0.9,
        eyebrow: "Ticker detail",
        summary: "Coal producer with a dominant strategic parent block, but still enough visible institutional float to remain screenable for ownership analysis.",
        tags: ["Energy", "Strategic Parent", "Medium Float"],
        metrics: [
          { label: "Market Cap", value: "Rp29.8T" },
          { label: "Free Float", value: "34.86%" },
          { label: "Strategic Held", value: "65.14%" },
          { label: "Visible Held", value: "68.2%" },
          { label: "P/E", value: "6.4x" },
          { label: "P/B", value: "1.6x" },
          { label: "ROE", value: "22.6%" }
        ],
        localForeign: null,
        summaryPoints: [
          "ITMG is a strong contrast case to state-linked strategic blocks because control sits with a corporate foreign parent.",
          "The overlap with BPJS, Norway, and Vanguard keeps the ticker analytically interesting beyond the parent stake itself.",
          "A production version should separate strategic parent ownership from passive foreign institutional participation over time."
        ],
        holderTable: [
          { name: "BANPU MINERAL (SINGAPORE) PTE LTD", type: "CP", nat: "F", pct: "65.14%", strategic: true, entityId: "banpu-mineral-singapore-pte-ltd", entityKind: "investor" },
          { name: "DJS KETENAGAKERJAAN PROGRAM JHT", type: "PF", nat: "L", pct: "1.04%", classificationOverride: "float", entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "SEB AB LUXEMBOURG BRANCH A/C CLIENTS", type: "IB", nat: "F", pct: "1.49%", classificationOverride: "float", entityId: "seb-ab-luxembourg-branch-ac-clients", entityKind: "investor" },
          { name: "OTHER PUBLIC HOLDERS", type: "MF", nat: "", pct: "32.33%", classificationOverride: "float" }
        ],
        related: [
          { label: "Banpu Mineral (Singapore) Pte Ltd", kind: "investor", id: "banpu-mineral-singapore-pte-ltd" },
          { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan" },
          { label: "SEB AB Luxembourg Branch A/C Clients", kind: "investor", id: "seb-ab-luxembourg-branch-ac-clients" }
        ]
      },
      GIAA: {
        kind: "ticker",
        id: "GIAA",
        name: "Garuda Indonesia Tbk",
        sector: "Transport",
        marketCap: 13,
        dailyChange: -1.4,
        eyebrow: "Ticker detail",
        summary: "Post-PMTHMETD Garuda is a very tightly controlled name. The key research issue is that Danantara already held the pre-transaction strategic block before subscribing the new series D shares.",
        tags: ["Transport", "State-linked", "Medium Float"],
        metrics: [
          { label: "Market Cap", value: "Rp13T" },
          { label: "Free Float", value: "6.17%" },
          { label: "Strategic Held", value: "93.83%" },
          { label: "Visible Held", value: "100%" },
          { label: "P/S", value: "0.5x" },
          { label: "P/B", value: "1.1x" },
          { label: "Risk", value: "Medium" }
        ],
        localForeign: null,
        summaryPoints: [
          "The official PMTHMETD disclosure shows Danantara already owned the legacy strategic block before the December 2025 issuance.",
          "Using only the newly issued shares understates strategic concentration and overstates the apparent public float.",
          "This row is now aligned to the official pro forma holder table and the final issuance result notice."
        ],
        holderTable: [
          { name: "PT DANANTARA ASSET MANAGEMENT", type: "CP", nat: "L", pct: "92.03%", strategic: true, entityId: "pt-danantara-asset-management", entityKind: "investor" },
          { name: "PT TRANS AIRWAYS", type: "CP", nat: "L", pct: "1.80%", strategic: true },
          { name: "PUBLIC HOLDERS", type: "MF", nat: "", pct: "6.17%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management" }
        ]
      },
      ANTM: {
        kind: "ticker",
        id: "ANTM",
        name: "Aneka Tambang Tbk",
        sector: "Materials",
        related: [
          { label: "PT Mineral Industri Indonesia (MIND ID)", kind: "investor", id: "mineral-industri-indonesia" },
          { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan" },
          { label: "Employees Provident Fund Board", kind: "investor", id: "employees-provident-fund-board" }
        ],
        holderTable: [
          { name: "PT MINERAL INDUSTRI INDONESIA (MIND ID)", type: "CP", nat: "L", pct: "65.00%", strategic: true, entityId: "mineral-industri-indonesia", entityKind: "investor" },
          { name: "BNYM RE EMPLOYEES PROVIDENT FUND BOARD", type: "PF", nat: "F", pct: "1.17%", classificationOverride: "float", entityId: "employees-provident-fund-board", entityKind: "investor" },
          { name: "DJS KETENAGAKERJAAN PROGRAM JHT", type: "PF", nat: "L", pct: "1.07%", classificationOverride: "float", entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "DJS KETENAGAKERJAAN PROGRAM JP", type: "PF", nat: "L", pct: "0.81%", classificationOverride: "float", entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "JP MORGAN (S.E.A.) LIMITED-CQ SMART ESG EMERGING ASIA EQUITY FUND", type: "MF", nat: "F", pct: "0.66%", classificationOverride: "float" },
          { name: "BLACKROCK INVESTMENT FUNDS FOR EMPLOYEE BENEFIT TRUSTS", type: "MF", nat: "F", pct: "0.60%", classificationOverride: "float", entityId: "blackrock-funds", entityKind: "investor" },
          { name: "OTHER PUBLIC HOLDERS", type: "MF", nat: "", pct: "30.69%", classificationOverride: "float" }
        ]
      },
      PTBA: {
        kind: "ticker",
        id: "PTBA",
        name: "Bukit Asam Tbk",
        sector: "Energy",
        related: [
          { label: "PT Mineral Industri Indonesia (MIND ID)", kind: "investor", id: "mineral-industri-indonesia" },
          { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan" },
          { label: "Panin Sekuritas", kind: "investor", id: "panin-sekuritas" }
        ],
        holderTable: [
          { name: "PT MINERAL INDUSTRI INDONESIA (MIND ID)", type: "CP", nat: "L", pct: "65.93%", strategic: true, entityId: "mineral-industri-indonesia", entityKind: "investor" },
          { name: "TREASURY STOCK", type: "OT", nat: "L", pct: "0.05%", strategic: true },
          { name: "DJS KETENAGAKERJAAN PROGRAM JHT", type: "PF", nat: "L", pct: "1.53%", classificationOverride: "float", entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "GOVERNMENT OF SOUTH SUMATRA PROVINCE", type: "OT", nat: "L", pct: "0.93%", classificationOverride: "float" },
          { name: "PT PANIN SEKURITAS TBK", type: "SC", nat: "L", pct: "0.90%", classificationOverride: "float", entityId: "panin-sekuritas", entityKind: "investor" },
          { name: "DJS KETENAGAKERJAAN PROGRAM JP", type: "PF", nat: "L", pct: "0.71%", classificationOverride: "float", entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "SSBT CQ ISHARES CORE MSCI EMERGING MARKETS ETF", type: "MF", nat: "F", pct: "0.50%", classificationOverride: "float", entityId: "ishares-core-msci-emerging-markets-etf", entityKind: "investor" },
          { name: "BNYM SA/NV FOR BNYM FOR GLOBAL X SUPERDIVIDEND ETF", type: "MF", nat: "F", pct: "0.44%", classificationOverride: "float", entityId: "global-x-superdividend-etf", entityKind: "investor" },
          { name: "OTHER PUBLIC HOLDERS", type: "MF", nat: "", pct: "29.01%", classificationOverride: "float" }
        ]
      },
      INCO: {
        kind: "ticker",
        id: "INCO",
        name: "Vale Indonesia Tbk",
        sector: "Materials",
        related: [
          { label: "Vale Canada Limited", kind: "investor", id: "vale-canada-limited" },
          { label: "PT Mineral Industri Indonesia (MIND ID)", kind: "investor", id: "mineral-industri-indonesia" },
          { label: "Sumitomo Metal Mining Co. Ltd.", kind: "investor", id: "sumitomo-metal-mining-co-ltd" }
        ],
        holderTable: [
          { name: "VALE CANADA LIMITED", type: "CP", nat: "F", pct: "33.88%", strategic: true, entityId: "vale-canada-limited", entityKind: "investor" },
          { name: "PT MINERAL INDUSTRI INDONESIA (MIND ID)", type: "CP", nat: "L", pct: "34.00%", strategic: true, entityId: "mineral-industri-indonesia", entityKind: "investor" },
          { name: "SUMITOMO METAL MINING CO. LTD.", type: "CP", nat: "F", pct: "11.48%", strategic: true, entityId: "sumitomo-metal-mining-co-ltd", entityKind: "investor" },
          { name: "SCRIP SHARES (NON-FREE FLOAT)", type: "OT", nat: "", pct: "0.24%", strategic: true },
          { name: "PUBLIC SHAREHOLDERS WITH LESS THAN 5% SHARE OWNERSHIP", type: "MF", nat: "", pct: "20.40%", classificationOverride: "float" }
        ]
      },
      PGAS: {
        kind: "ticker",
        id: "PGAS",
        name: "Perusahaan Gas Negara Tbk",
        sector: "Energy",
        related: [
          { label: "Pertamina (Persero)", kind: "investor", id: "pertamina-persero" },
          { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan" },
          { label: "Panin Sekuritas", kind: "investor", id: "panin-sekuritas" }
        ],
        holderTable: [
          { name: "PT PERTAMINA (PERSERO)", type: "CP", nat: "L", pct: "56.96%", strategic: true, entityId: "pertamina-persero", entityKind: "investor" },
          { name: "BPJS KETENAGAKERJAAN", type: "PF", nat: "L", pct: "4.66%", classificationOverride: "float", entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "PT PANIN SEKURITAS TBK", type: "SC", nat: "L", pct: "1.87%", classificationOverride: "float", entityId: "panin-sekuritas", entityKind: "investor" },
          { name: "VANGUARD", type: "MF", nat: "F", pct: "1.52%", classificationOverride: "float", entityId: "vanguard-funds", entityKind: "investor" },
          { name: "ISHARES", type: "MF", nat: "F", pct: "1.45%", classificationOverride: "float", entityId: "ishares-funds", entityKind: "investor" },
          { name: "PETRONAS", type: "CP", nat: "F", pct: "1.27%", classificationOverride: "float", entityId: "petronas", entityKind: "investor" },
          { name: "LO KHENG HONG", type: "ID", nat: "L", pct: "0.98%", classificationOverride: "float", entityId: "lo-kheng-hong", entityKind: "investor" },
          { name: "BLACKROCK", type: "MF", nat: "F", pct: "0.83%", classificationOverride: "float", entityId: "blackrock-funds", entityKind: "investor" },
          { name: "PRUDENTIAL LIFE ASSURANCE", type: "IS", nat: "L", pct: "0.83%", classificationOverride: "float" },
          { name: "OTHER PUBLIC HOLDERS", type: "MF", nat: "", pct: "29.63%", classificationOverride: "float" }
        ]
      },
      BUMI: {
        kind: "ticker",
        id: "BUMI",
        name: "Bumi Resources Tbk",
        sector: "Energy",
        marketCap: 58,
        dailyChange: 0.4,
        eyebrow: "Ticker detail",
        summary: "An extreme strategic-control example where float is too thin for normal assumptions about trading depth, price discovery, or governance dispersion.",
        tags: ["Energy", "Very Low Float", "High Risk"],
        metrics: [
          { label: "Market Cap", value: "Rp58T" },
          { label: "Free Float", value: "2.06%" },
          { label: "Visible Held", value: "98.14%" },
          { label: "P/E", value: "7.2x" },
          { label: "P/B", value: "1.1x" },
          { label: "ROE", value: "8.4%" },
          { label: "Liquidity Risk", value: "High" }
        ],
        localForeign: null,
        summaryPoints: [
          "This is the clearest float-risk case in the prototype dataset.",
          "Strategic concentration dominates any narrative about broad public ownership.",
          "A serious screener should flag names like this at the top of compliance and liquidity reviews."
        ],
        holderTable: [
          { name: "MACH ENERGY (HONG KONG) LIMITED", type: "CP", nat: "F", pct: "45.78%", strategic: true, entityId: "mach-energy-hong-kong-limited", entityKind: "investor" },
          { name: "UBS AG SWITZERLAND S/A CLIENT ASSETS", type: "IB", nat: "F", pct: "5.10%", classificationOverride: "float" },
          { name: "CRIS DEVELOPMENTS LIMITED", type: "CP", nat: "F", pct: "4.86%" },
          { name: "TREASURE GLOBAL INVESTMENTS LTD", type: "CP", nat: "F", pct: "3.18%" },
          { name: "HSBC-FUND CHENGDONG NO. 1 PRIVATE EQUITY FUND", type: "MF", nat: "F", pct: "2.81%", classificationOverride: "float" },
          { name: "OTHER PUBLIC HOLDERS", type: "MF", nat: "", pct: "38.27%", classificationOverride: "float" }
        ],
        related: [
          { label: "Bakrie Group", kind: "group", id: "bakrie-group" }
        ]
      }
    },
    investors: {
      "pt-danantara-asset-management": { kind: "investor", id: "pt-danantara-asset-management", name: "PT Danantara Asset Management" },
      "bpjs-ketenagakerjaan": { kind: "investor", id: "bpjs-ketenagakerjaan", name: "BPJS Ketenagakerjaan" },
      "government-of-singapore": { kind: "investor", id: "government-of-singapore", name: "Government of Singapore" },
      "employees-provident-fund-board": { kind: "investor", id: "employees-provident-fund-board", name: "Employees Provident Fund Board" },
      "vanguard-total-international-stock-index-fund": { kind: "investor", id: "vanguard-total-international-stock-index-fund", name: "Vanguard Total International Stock Index Fund" },
      "vanguard-emerging-markets-stock-index-fund": { kind: "investor", id: "vanguard-emerging-markets-stock-index-fund", name: "Vanguard Emerging Markets Stock Index Fund" },
      "government-of-norway": { kind: "investor", id: "government-of-norway", name: "Government of Norway" },
      "indonesia-investment-authority": { kind: "investor", id: "indonesia-investment-authority", name: "Indonesia Investment Authority" },
      "pt-dwimuria-investama-andalan": { kind: "investor", id: "pt-dwimuria-investama-andalan", name: "PT Dwimuria Investama Andalan" },
      "jardine-cycle-carriage-ltd": { kind: "investor", id: "jardine-cycle-carriage-ltd", name: "Jardine Cycle & Carriage Ltd" },
      "mineral-industri-indonesia": { kind: "investor", id: "mineral-industri-indonesia", name: "PT Mineral Industri Indonesia (MIND ID)" },
      "banpu-mineral-singapore-pte-ltd": { kind: "investor", id: "banpu-mineral-singapore-pte-ltd", name: "Banpu Mineral (Singapore) Pte Ltd" },
      "seb-ab-luxembourg-branch-ac-clients": { kind: "investor", id: "seb-ab-luxembourg-branch-ac-clients", name: "SEB AB Luxembourg Branch A/C Clients" },
      "blackrock-funds": { kind: "investor", id: "blackrock-funds", name: "BlackRock" },
      "panin-sekuritas": { kind: "investor", id: "panin-sekuritas", name: "Panin Sekuritas" },
      "ishares-core-msci-emerging-markets-etf": { kind: "investor", id: "ishares-core-msci-emerging-markets-etf", name: "iShares Core MSCI Emerging Markets ETF" },
      "global-x-superdividend-etf": { kind: "investor", id: "global-x-superdividend-etf", name: "Global X SuperDividend ETF" },
      "vale-canada-limited": { kind: "investor", id: "vale-canada-limited", name: "Vale Canada Limited" },
      "sumitomo-metal-mining-co-ltd": { kind: "investor", id: "sumitomo-metal-mining-co-ltd", name: "Sumitomo Metal Mining Co. Ltd." },
      "pertamina-persero": { kind: "investor", id: "pertamina-persero", name: "Pertamina (Persero)" },
      "vanguard-funds": { kind: "investor", id: "vanguard-funds", name: "Vanguard" },
      "ishares-funds": { kind: "investor", id: "ishares-funds", name: "iShares" },
      "petronas": { kind: "investor", id: "petronas", name: "Petronas" },
      "lo-kheng-hong": { kind: "investor", id: "lo-kheng-hong", name: "Lo Kheng Hong" }
    },
    groups: {}
  },
  tickerAnalytics: {},
  searchIndex: [
    { label: "BBCA", kind: "ticker", id: "BBCA", subtitle: "Bank Central Asia Tbk" },
    { label: "BBRI", kind: "ticker", id: "BBRI", subtitle: "Bank Rakyat Indonesia Tbk" },
    { label: "TLKM", kind: "ticker", id: "TLKM", subtitle: "Telkom Indonesia Tbk" },
    { label: "BMRI", kind: "ticker", id: "BMRI", subtitle: "Bank Mandiri Tbk" },
    { label: "BBNI", kind: "ticker", id: "BBNI", subtitle: "Bank Negara Indonesia Tbk" },
    { label: "ASII", kind: "ticker", id: "ASII", subtitle: "Astra International Tbk" },
    { label: "TINS", kind: "ticker", id: "TINS", subtitle: "Timah Tbk" },
    { label: "ITMG", kind: "ticker", id: "ITMG", subtitle: "Indo Tambangraya Megah Tbk" },
    { label: "GIAA", kind: "ticker", id: "GIAA", subtitle: "Garuda Indonesia Tbk" },
    { label: "ANTM", kind: "ticker", id: "ANTM", subtitle: "Aneka Tambang Tbk" },
    { label: "PTBA", kind: "ticker", id: "PTBA", subtitle: "Bukit Asam Tbk" },
    { label: "INCO", kind: "ticker", id: "INCO", subtitle: "Vale Indonesia Tbk" },
    { label: "PGAS", kind: "ticker", id: "PGAS", subtitle: "Perusahaan Gas Negara Tbk" },
    { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management", subtitle: "State-linked strategic holder", aliases: ["PT DANANTARA ASSET MANAGEMENT", "DANANTARA"] },
    { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan", subtitle: "Local pension-style holder", aliases: ["BPJS KETENAGAKERJAAN"] },
    { label: "Government of Singapore", kind: "investor", id: "government-of-singapore", subtitle: "Foreign sovereign holder", aliases: ["GOVERNMENT OF SINGAPORE"] },
    { label: "Government of Norway", kind: "investor", id: "government-of-norway", subtitle: "Foreign sovereign holder", aliases: ["GOVERNMENT OF NORWAY"] },
    { label: "Employees Provident Fund Board", kind: "investor", id: "employees-provident-fund-board", subtitle: "Foreign pension holder", aliases: ["EMPLOYEES PROVIDENT FUND BOARD"] },
    { label: "Vanguard Total International Stock Index Fund", kind: "investor", id: "vanguard-total-international-stock-index-fund", subtitle: "Foreign fund holder", aliases: ["VANGUARD TOTAL INTERNATIONAL STOCK INDEX FUND"] },
    { label: "Vanguard Emerging Markets Stock Index Fund", kind: "investor", id: "vanguard-emerging-markets-stock-index-fund", subtitle: "Foreign fund holder", aliases: ["VANGUARD EMERGING MARKETS STOCK INDEX FUND"] },
    { label: "Banpu Mineral (Singapore) Pte Ltd", kind: "investor", id: "banpu-mineral-singapore-pte-ltd", subtitle: "Strategic parent holder", aliases: ["BANPU MINERAL (SINGAPORE) PTE LTD"] },
    { label: "Jardine Cycle & Carriage Ltd", kind: "investor", id: "jardine-cycle-carriage-ltd", subtitle: "Strategic parent holder", aliases: ["JARDINE CYCLE & CARRIAGE LTD"] },
    { label: "Indonesia Investment Authority", kind: "investor", id: "indonesia-investment-authority", subtitle: "Strategic state holder", aliases: ["INDONESIA INVESTMENT AUTHORITY"] },
    { label: "PT Dwimuria Investama Andalan", kind: "investor", id: "pt-dwimuria-investama-andalan", subtitle: "Strategic holder", aliases: ["PT DWIMURIA INVESTAMA ANDALAN"] },
    { label: "PT Mineral Industri Indonesia (MIND ID)", kind: "investor", id: "mineral-industri-indonesia", subtitle: "Strategic holder", aliases: ["PT MINERAL INDUSTRI INDONESIA", "MIND ID"] },
    { label: "SEB AB Luxembourg Branch A/C Clients", kind: "investor", id: "seb-ab-luxembourg-branch-ac-clients", subtitle: "Foreign holder", aliases: ["SEB AB LUXEMBOURG BRANCH A/C CLIENTS"] },
    { label: "Pertamina (Persero)", kind: "investor", id: "pertamina-persero", subtitle: "Strategic state holder", aliases: ["PT PERTAMINA (PERSERO)", "PERTAMINA"] },
    { label: "Panin Sekuritas", kind: "investor", id: "panin-sekuritas", subtitle: "Domestic securities holder", aliases: ["PT PANIN SEKURITAS TBK", "PANIN SEKURITAS"] },
    { label: "Vale Canada Limited", kind: "investor", id: "vale-canada-limited", subtitle: "Strategic holder", aliases: ["VALE CANADA LIMITED"] },
    { label: "Sumitomo Metal Mining Co. Ltd.", kind: "investor", id: "sumitomo-metal-mining-co-ltd", subtitle: "Strategic holder", aliases: ["SUMITOMO METAL MINING CO. LTD."] }
  ],
  searchables: [
    "BBCA",
    "BBRI",
    "TLKM",
    "BMRI",
    "BBNI",
    "ASII",
    "TINS",
    "ITMG",
    "GIAA",
    "ANTM",
    "PTBA",
    "INCO",
    "PGAS",
    "PT Danantara Asset Management",
    "BPJS Ketenagakerjaan",
    "Government of Singapore",
    "Government of Norway",
    "Employees Provident Fund Board",
    "Vanguard Total International Stock Index Fund",
    "Vanguard Emerging Markets Stock Index Fund",
    "Banpu Mineral (Singapore) Pte Ltd",
    "Jardine Cycle & Carriage Ltd",
    "Indonesia Investment Authority",
    "PT Dwimuria Investama Andalan",
    "PT Mineral Industri Indonesia",
    "SEB AB Luxembourg Branch A/C Clients",
    "Pertamina",
    "Panin Sekuritas",
    "Vale Canada Limited",
    "Sumitomo Metal Mining Co. Ltd."
  ]
};
