window.StockMapMock = {
  meta: {
    siteName: "StockMap Indonesia",
    kseiDate: "27 Feb 2026",
    methodologyDate: "March 2026",
    allowedTokens: ["prototype-token", "meta-demo-2026"],
    accessMode: "Direct full access",
    sourceCopy: "Data source: KSEI",
    paymentProvider: "Mayar.id"
  },
  landingStats: [
    { label: "Tickers", value: "955" },
    { label: "Investors", value: "5,270" },
    { label: "Conglomerates", value: "18" },
    { label: "Investor Types", value: "8" }
  ],
  featureCards: [
    {
      icon: "Search",
      title: "Instant Search",
      body: "Search any ticker or investor name. Results appear as you type - find BBCA holders, Lo Kheng Hong positions, or Government of Norway exposure in seconds."
    },
    {
      icon: "AI",
      title: "AI-Powered Q&A",
      body: "Ask questions in natural language, compare local versus foreign ownership, or inspect free-float assumptions on demand."
    },
    {
      icon: "Group",
      title: "Conglomerate Maps",
      body: "Mapped business groups show how well-known Indonesian groups control multiple tickers through layered ownership."
    },
    {
      icon: "Table",
      title: "Deep Ownership Tables",
      body: "Full shareholder breakdown by investor type, local or foreign flag, share count, and percentage held."
    },
    {
      icon: "Graph",
      title: "Network Graphs",
      body: "Interactive investor-to-ticker graph reveals hidden relationships, cross-holdings, and concentrated influence."
    },
    {
      icon: "World",
      title: "Local vs Foreign",
      body: "Segment ownership by banks, individuals, funds, insurers, pensions, and corporates."
    },
    {
      icon: "Float",
      title: "Free Float Screener",
      body: "MSCI-aligned float estimation across all tickers, with strategic holder exclusions and risk-oriented screening."
    },
    {
      icon: "Heat",
      title: "Market Heatmap",
      body: "Full market heatmap sized by market cap and colored by daily return, designed for quick market scanning."
    }
  ],
  overview: {
    kpis: [
      { label: "Tickers", value: "955" },
      { label: "Investors", value: "5,270" },
      { label: "Local", value: "57.3%" },
      { label: "Foreign", value: "42.7%" }
    ],
    marketOverview: [
      { code: "CP", name: "Corporate", count: "2,305", tone: "accent" },
      { code: "ID", name: "Individual", count: "2,147", tone: "blue" },
      { code: "IB", name: "Bank", count: "138", tone: "green" },
      { code: "MF", name: "Mutual Fund", count: "136", tone: "violet" }
    ],
    hotSearches: [
      { rank: 1, name: "ANDRY HAKIM", count: "1,308" },
      { rank: 2, name: "Government of Norway", count: "969" },
      { rank: 3, name: "BBCA", count: "745" },
      { rank: 4, name: "LO KHENG HONG", count: "632" }
    ],
    topForeign: [
      { name: "UOB KAY HIAN PTE LTD", positions: "4 pos" },
      { name: "BANK OF SINGAPORE LTD", positions: "37 pos" },
      { name: "UBS AG SINGAPORE", positions: "27 pos" },
      { name: "DBS BANK LTD.", positions: "25 pos" }
    ],
    conglomerates: [
      { name: "Salim Group", tickers: "14 tickers" },
      { name: "Lippo Group", tickers: "12 tickers" },
      { name: "Sinar Mas Group", tickers: "12 tickers" },
      { name: "Bakrie Group", tickers: "11 tickers" }
    ]
  },
  funds: {
    count: "136 investors",
    list: [
      { investor: "FIDELITY FUNDS", nat: "F", pos: "18", top: "DUCK 9.88%" },
      { investor: "REKSA DANA EMCO MANTAP", nat: "L", pos: "15", top: "HOME 4.10%" },
      { investor: "SUCORINVEST EQUITY PRIMA", nat: "L", pos: "14", top: "CSMI 4.91%" },
      { investor: "PAN ARCADIA SAHAM BERTUMBUH", nat: "L", pos: "12", top: "DPUM 4.56%" }
    ],
    detail: {
      name: "REKSA DANA SUCORINVEST EQUITY PRIMA FUND",
      tags: ["Mutual Fund", "Local", "14 Holdings"],
      holdings: [
        { ticker: "CSMI", company: "Cipta Selera Murni Tbk" },
        { ticker: "KBLI", company: "KMI Wire and Cable Tbk" },
        { ticker: "BEER", company: "Jobubu Jarum Minahasa Tbk" },
        { ticker: "MYOH", company: "Samindo Resources Tbk" },
        { ticker: "SAGE", company: "Saptausaha Gemilangindah Tbk" }
      ]
    }
  },
  freeFloat: [
    { ticker: "BUMI", company: "Bumi Resources", totalHeld: 98.14, freeFloat: 2.06, holder: "Bakrie strategic layer", risk: "High" },
    { ticker: "GIAA", company: "Garuda Indonesia", totalHeld: 73.24, freeFloat: 26.76, holder: "Government + Trans Airways", risk: "Medium" },
    { ticker: "JKON", company: "Jakon International Hotels", totalHeld: 85.1, freeFloat: 14.9, holder: "Kresna investor cluster", risk: "High" },
    { ticker: "META", company: "Nusantara Capital", totalHeld: 85.5, freeFloat: 14.5, holder: "Founder and strategic vehicle", risk: "High" },
    { ticker: "MSEI", company: "Mesti Investama", totalHeld: 85.2, freeFloat: 14.8, holder: "Core strategic holders", risk: "High" },
    { ticker: "PTIS", company: "Indonesian Transport & Infra", totalHeld: 89.4, freeFloat: 10.6, holder: "Controlling investors", risk: "High" },
    { ticker: "TINS", company: "Timah", totalHeld: 65.0, freeFloat: 35.0, holder: "MIND ID / Government", risk: "Medium" },
    { ticker: "ITMG", company: "Indo Tambangraya Megah", totalHeld: 65.14, freeFloat: 34.86, holder: "Banpu Mineral (Singapore)", risk: "Medium" },
    { ticker: "ASII", company: "Astra International", totalHeld: 50.11, freeFloat: 49.89, holder: "Jardine Cycle & Carriage Ltd", risk: "Low" },
    { ticker: "BBNI", company: "Bank Negara Indonesia", totalHeld: 59.4, freeFloat: 40.6, holder: "PT Danantara Asset Management", risk: "Low" },
    { ticker: "BBRI", company: "Bank Rakyat Indonesia", totalHeld: 58.5, freeFloat: 41.5, holder: "PT Danantara Asset Management", risk: "Low" },
    { ticker: "TLKM", company: "Telkom Indonesia", totalHeld: 56.1, freeFloat: 43.9, holder: "PT Danantara Asset Management", risk: "Low" },
    { ticker: "BMRI", company: "Bank Mandiri", totalHeld: 55.6, freeFloat: 44.4, holder: "PT Danantara Asset Management", risk: "Low" },
    { ticker: "BBCA", company: "Bank Central Asia", totalHeld: 58.67, freeFloat: 45.06, holder: "Djarum strategic layer", risk: "Low" }
  ],
  hiddenPositions: [
    { ticker: "CFIN", investor: "LO KHENG HONG", type: "ID", nationality: "L", pct: "1.58%" },
    { ticker: "ADMG", investor: "LO KHENG HONG", type: "ID", nationality: "L", pct: "1.29%" },
    { ticker: "MAIN", investor: "LO KHENG HONG", type: "ID", nationality: "L", pct: "1.24%" },
    { ticker: "PNIN", investor: "LO KHENG HONG", type: "ID", nationality: "L", pct: "1.23%" },
    { ticker: "LSIP", investor: "LO KHENG HONG", type: "ID", nationality: "L", pct: "1.21%" },
    { ticker: "BEST", investor: "LO KHENG HONG", type: "ID", nationality: "L", pct: "1.16%" }
  ],
  norwayPositions: [
    { ticker: "MPMX", investor: "GOVERNMENT OF THE KINGDOM OF NORWAY", type: "PF", nationality: "F", pct: "1.03%" },
    { ticker: "MAPI", investor: "GOVERNMENT OF THE KINGDOM OF NORWAY", type: "PF", nationality: "F", pct: "1.06%" },
    { ticker: "TINS", investor: "GOVERNMENT OF THE KINGDOM OF NORWAY", type: "PF", nationality: "F", pct: "1.11%" },
    { ticker: "ESSA", investor: "GOVERNMENT OF THE KINGDOM OF NORWAY", type: "PF", nationality: "F", pct: "1.14%" },
    { ticker: "MIDI", investor: "GOVERNMENT OF THE KINGDOM OF NORWAY", type: "PF", nationality: "F", pct: "1.20%" },
    { ticker: "INCO", investor: "GOVERNMENT OF THE KINGDOM OF NORWAY", type: "PF", nationality: "F", pct: "1.23%" }
  ],
  network: {
    title: "Network Graph - Happy Hapsoro",
    nodes: [
      { id: "HAPPY HAPSORO", name: "HAPPY HAPSORO", category: 0, value: 28 },
      { id: "UNTR", name: "UNTR", category: 1, value: 20 },
      { id: "BSSR", name: "BSSR", category: 1, value: 18 },
      { id: "PTRO", name: "PTRO", category: 1, value: 18 },
      { id: "DSSA", name: "DSSA", category: 1, value: 22 },
      { id: "MBSS", name: "MBSS", category: 1, value: 16 },
      { id: "GEMS", name: "GEMS", category: 1, value: 17 },
      { id: "HRUM", name: "HRUM", category: 1, value: 16 }
    ],
    links: [
      { source: "HAPPY HAPSORO", target: "UNTR" },
      { source: "HAPPY HAPSORO", target: "BSSR" },
      { source: "HAPPY HAPSORO", target: "PTRO" },
      { source: "HAPPY HAPSORO", target: "DSSA" },
      { source: "HAPPY HAPSORO", target: "MBSS" },
      { source: "HAPPY HAPSORO", target: "GEMS" },
      { source: "HAPPY HAPSORO", target: "HRUM" },
      { source: "DSSA", target: "MBSS" },
      { source: "DSSA", target: "HRUM" },
      { source: "UNTR", target: "BSSR" }
    ]
  },
  heatmap: [
    { ticker: "BBCA", cap: 1140, change: 0.8, sector: "Banking" },
    { ticker: "BBRI", cap: 760, change: -1.2, sector: "Banking" },
    { ticker: "BMRI", cap: 760, change: 1.5, sector: "Banking" },
    { ticker: "TLKM", cap: 410, change: -0.3, sector: "Telecom" },
    { ticker: "ASII", cap: 680, change: 2.1, sector: "Industrial" },
    { ticker: "UNVR", cap: 520, change: -0.7, sector: "Consumer" },
    { ticker: "BBNI", cap: 480, change: 0.4, sector: "Banking" },
    { ticker: "HMSP", cap: 470, change: -1.8, sector: "Consumer" },
    { ticker: "ICBP", cap: 430, change: 0.2, sector: "Consumer" },
    { ticker: "KLBF", cap: 410, change: 1.1, sector: "Healthcare" },
    { ticker: "INDF", cap: 390, change: -0.5, sector: "Consumer" },
    { ticker: "SMGR", cap: 360, change: 0.9, sector: "Materials" },
    { ticker: "PGAS", cap: 320, change: 3.2, sector: "Energy" },
    { ticker: "PTBA", cap: 300, change: -2.1, sector: "Energy" },
    { ticker: "UNTR", cap: 290, change: 1.7, sector: "Industrial" },
    { ticker: "ADRO", cap: 280, change: -0.9, sector: "Energy" },
    { ticker: "ANTM", cap: 250, change: 2.4, sector: "Materials" },
    { ticker: "MDKA", cap: 240, change: -2.5, sector: "Materials" },
    { ticker: "BRPT", cap: 210, change: 1.9, sector: "Materials" },
    { ticker: "GOTO", cap: 88, change: -3.1, sector: "Technology" },
    { ticker: "ERAA", cap: 150, change: 3.5, sector: "Retail" },
    { ticker: "MAPI", cap: 140, change: -1.3, sector: "Retail" },
    { ticker: "TPIA", cap: 130, change: 1.2, sector: "Materials" },
    { ticker: "DSSA", cap: 120, change: 2.2, sector: "Energy" },
    { ticker: "BUMI", cap: 58, change: 0.4, sector: "Energy" },
    { ticker: "GIAA", cap: 13, change: -1.4, sector: "Transport" },
    { ticker: "JKON", cap: 4.6, change: 0.3, sector: "Hospitality" },
    { ticker: "META", cap: 5.2, change: -0.8, sector: "Financial Services" },
    { ticker: "MSEI", cap: 3.8, change: 1.1, sector: "Investment Holding" },
    { ticker: "PTIS", cap: 6.4, change: -0.5, sector: "Transport" },
    { ticker: "TINS", cap: 19.5, change: 1.7, sector: "Materials" },
    { ticker: "ITMG", cap: 29.8, change: 0.9, sector: "Energy" }
  ],
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
      { label: "Tickers Covered", value: "955" },
      { label: "Ownership Records", value: "7,257" },
      { label: "Affiliated Individuals", value: "807" },
      { label: "Controlling >=20%", value: "187" },
      { label: "Multi-Stock Controllers", value: "133" },
      { label: "Verified Insiders", value: "487" }
    ],
    limitations: [
      "Only holders with 1% or more ownership appear in the KSEI reporting set.",
      "Treasury shares, IPO lock-up periods, and foreign-ownership limits require extra treatment beyond this prototype.",
      "Some small-cap insiders may not be captured when public governance data is incomplete.",
      "Monthly KSEI publication means intra-month changes are not reflected.",
      "Sub-1% holders are assumed to be free float for estimation purposes, so the estimate should be read with error bounds in mind."
    ]
  },
  affiliate: {
    steps: [
      "Daftar jadi affiliate dan langsung dapat link referral unik.",
      "Bagikan link ke teman, komunitas, atau followers untuk komisi hingga 30% per sale.",
      "Gunakan referral utama dan sub-affiliate flow untuk tracking komisi berlapis."
    ]
  },
  sectorExposure: [
    { sector: "Banking", local: 62, foreign: 38 },
    { sector: "Energy", local: 54, foreign: 46 },
    { sector: "Consumer", local: 58, foreign: 42 },
    { sector: "Materials", local: 49, foreign: 51 },
    { sector: "Technology", local: 67, foreign: 33 },
    { sector: "Telecom", local: 56, foreign: 44 }
  ],
  spotlights: [
    {
      title: "Low-float concentration",
      body: "BUMI and GIAA remain extreme examples of strategic dominance where public float is constrained enough to distort liquidity expectations."
    },
    {
      title: "State-linked clusters",
      body: "Danantara-linked holdings create a recurring strategic pattern across several IDX large caps. A real app should flag this automatically."
    },
    {
      title: "Silent accumulation",
      body: "Lo Kheng Hong style sub-2% positions are precisely where the locked-data proposition becomes commercially meaningful."
    }
  ],
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
        localForeign: [
          { name: "Local", value: 61 },
          { name: "Foreign", value: 39 }
        ],
        summaryPoints: [
          "Djarum strategic layer keeps effective control even while the free float remains investable.",
          "Foreign participation is still material enough to keep BBCA relevant for institutional flow tracking.",
          "Investor page links are useful here because cross-holdings tend to matter more than a raw holder list."
        ],
        holderTable: [
          { name: "PT DWIMURIA INVESTAMA ANDALAN", type: "CP", nat: "L", pct: "54.94%", strategic: true },
          { name: "UOB KAY HIAN PTE LTD", type: "IB", nat: "F", pct: "1.44%", classificationOverride: "float", entityId: "uob-kay-hian-pte-ltd", entityKind: "investor" },
          { name: "GOVERNMENT OF NORWAY", type: "PF", nat: "F", pct: "1.21%", classificationOverride: "float", entityId: "government-of-norway", entityKind: "investor" },
          { name: "FIDELITY FUNDS", type: "MF", nat: "F", pct: "1.08%", strategic: false }
        ],
        related: [
          { label: "UOB KAY HIAN PTE LTD", kind: "investor", id: "uob-kay-hian-pte-ltd" },
          { label: "Government of Norway", kind: "investor", id: "government-of-norway" },
          { label: "Salim Group", kind: "group", id: "salim-group" }
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
          { name: "Local", value: 68 },
          { name: "Foreign", value: 32 }
        ],
        summaryPoints: [
          "Strategic control is still clear despite large public market participation.",
          "Foreign ownership is meaningful but subordinate to the local strategic block.",
          "BRI is useful for explaining how state-linked control can still coexist with liquid float."
        ],
        holderTable: [
          { name: "PT DANANTARA ASSET MANAGEMENT", type: "CP", nat: "L", pct: "53.19%", strategic: true, entityId: "pt-danantara-asset-management", entityKind: "investor" },
          { name: "NEGARA REPUBLIK INDONESIA SERI A", type: "CP", nat: "L", pct: "5.31%", strategic: true },
          { name: "GOVERNMENT OF NORWAY", type: "PF", nat: "F", pct: "1.43%", classificationOverride: "float", entityId: "government-of-norway", entityKind: "investor" },
          { name: "BLACKROCK FUNDS", type: "MF", nat: "F", pct: "1.10%", strategic: false },
          { name: "BPJS KETENAGAKERJAAN", type: "PF", nat: "L", pct: "1.04%", strategic: false }
        ],
        related: [
          { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management" },
          { label: "Government of Norway", kind: "investor", id: "government-of-norway" },
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
          { name: "Local", value: 59 },
          { name: "Foreign", value: 41 }
        ],
        summaryPoints: [
          "Telkom is a useful benchmark for strategic state control without collapsing tradable float.",
          "Foreign participation remains structurally important.",
          "A production entity page should show historical shifts in strategic versus float composition."
        ],
        holderTable: [
          { name: "PT DANANTARA ASSET MANAGEMENT", type: "CP", nat: "L", pct: "52.09%", strategic: true, entityId: "pt-danantara-asset-management", entityKind: "investor" },
          { name: "YAYASAN KESEJAHTERAAN KARYAWAN TELKOM", type: "FD", nat: "L", pct: "4.01%", strategic: true },
          { name: "GOVERNMENT OF NORWAY", type: "PF", nat: "F", pct: "1.09%", classificationOverride: "float", entityId: "government-of-norway", entityKind: "investor" },
          { name: "BPJS KETENAGAKERJAAN", type: "PF", nat: "L", pct: "1.03%", strategic: false },
          { name: "VANGUARD FUNDS", type: "MF", nat: "F", pct: "1.01%", strategic: false }
        ],
        related: [
          { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management" },
          { label: "BBRI", kind: "ticker", id: "BBRI" },
          { label: "Government of Norway", kind: "investor", id: "government-of-norway" }
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
          { name: "Local", value: 71 },
          { name: "Foreign", value: 29 }
        ],
        summaryPoints: [
          "Danantara remains the anchor strategic holder, but the float profile is still healthier than tightly held small caps.",
          "Mandiri is useful for comparing state-linked banks with similar control logic but different foreign participation levels.",
          "Holder-level detail matters because the gap between visible coverage and strategic holdings is narrower than in many small-cap names."
        ],
        holderTable: [
          { name: "PT DANANTARA ASSET MANAGEMENT", type: "CP", nat: "L", pct: "52.44%", strategic: true, entityId: "pt-danantara-asset-management", entityKind: "investor" },
          { name: "BANK MANDIRI PENSIUN RESERVE FOUNDATION", type: "FD", nat: "L", pct: "3.16%", strategic: true },
          { name: "GOVERNMENT OF NORWAY", type: "PF", nat: "F", pct: "1.20%", classificationOverride: "float", entityId: "government-of-norway", entityKind: "investor" },
          { name: "BPJS KETENAGAKERJAAN", type: "PF", nat: "L", pct: "1.00%", strategic: false }
        ],
        related: [
          { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management" },
          { label: "BBRI", kind: "ticker", id: "BBRI" },
          { label: "Government of Norway", kind: "investor", id: "government-of-norway" }
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
          { name: "Local", value: 66 },
          { name: "Foreign", value: 34 }
        ],
        summaryPoints: [
          "BNNI sits in the same strategic-control family as the other state banks, but at a cheaper valuation profile.",
          "The overlap with Norway, BPJS, and BlackRock makes BBNI useful for cross-bank ownership mapping.",
          "The main research value is comparing how similar control structures still produce different float and valuation outcomes."
        ],
        holderTable: [
          { name: "PT DANANTARA ASSET MANAGEMENT", type: "CP", nat: "L", pct: "59.40%", strategic: true, entityId: "pt-danantara-asset-management", entityKind: "investor" },
          { name: "BPJS KETENAGAKERJAAN", type: "PF", nat: "L", pct: "1.05%", strategic: false, entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "GOVERNMENT OF NORWAY", type: "PF", nat: "F", pct: "1.08%", classificationOverride: "float", entityId: "government-of-norway", entityKind: "investor" },
          { name: "BLACKROCK FUNDS", type: "MF", nat: "F", pct: "1.03%", strategic: false, entityId: "blackrock-funds", entityKind: "investor" }
        ],
        related: [
          { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management" },
          { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan" },
          { label: "Government of Norway", kind: "investor", id: "government-of-norway" }
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
          { name: "Local", value: 6 },
          { name: "Foreign", value: 94 }
        ],
        summaryPoints: [
          "ASII is a useful reminder that concentrated strategic ownership does not automatically imply a tight float.",
          "It also gives the network engine a non-state strategic block to compare against Danantara-linked banks.",
          "The visible holder set is heavily foreign, which changes the interpretation of flow sensitivity."
        ],
        holderTable: [
          { name: "JARDINE CYCLE & CARRIAGE LTD", type: "CP", nat: "F", pct: "50.11%", strategic: true, entityId: "jardine-cycle-carriage-ltd", entityKind: "investor" },
          { name: "UOB KAY HIAN PTE LTD", type: "IB", nat: "F", pct: "1.02%", classificationOverride: "float", entityId: "uob-kay-hian-pte-ltd", entityKind: "investor" },
          { name: "GOVERNMENT OF NORWAY", type: "PF", nat: "F", pct: "1.01%", classificationOverride: "float", entityId: "government-of-norway", entityKind: "investor" },
          { name: "VANGUARD FUNDS", type: "MF", nat: "F", pct: "1.00%", strategic: false, entityId: "vanguard-funds", entityKind: "investor" }
        ],
        related: [
          { label: "Jardine Cycle & Carriage Ltd", kind: "investor", id: "jardine-cycle-carriage-ltd" },
          { label: "UOB Kay Hian Pte Ltd", kind: "investor", id: "uob-kay-hian-pte-ltd" },
          { label: "Government of Norway", kind: "investor", id: "government-of-norway" }
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
        localForeign: [
          { name: "Local", value: 96.9 },
          { name: "Foreign", value: 3.1 }
        ],
        summaryPoints: [
          "TINS is useful for showing how a government strategic block can coexist with visible foreign fund participation.",
          "Norway, Vanguard, and BPJS create a cleaner institutional overlap map than many small-cap names.",
          "The core distinction here is between strategic state control and still-tradeable public float."
        ],
        holderTable: [
          { name: "MINING INDUSTRY INDONESIA", type: "CP", nat: "L", pct: "65.00%", strategic: true },
          { name: "GOVERNMENT OF NORWAY", type: "PF", nat: "F", pct: "1.11%", classificationOverride: "float", entityId: "government-of-norway", entityKind: "investor" },
          { name: "VANGUARD FUNDS", type: "MF", nat: "F", pct: "1.02%", strategic: false, entityId: "vanguard-funds", entityKind: "investor" },
          { name: "BPJS KETENAGAKERJAAN", type: "PF", nat: "L", pct: "1.01%", strategic: false, entityId: "bpjs-ketenagakerjaan", entityKind: "investor" }
        ],
        related: [
          { label: "Government of Norway", kind: "investor", id: "government-of-norway" },
          { label: "Vanguard Funds", kind: "investor", id: "vanguard-funds" },
          { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan" }
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
        localForeign: [
          { name: "Local", value: 1.5 },
          { name: "Foreign", value: 98.5 }
        ],
        summaryPoints: [
          "ITMG is a strong contrast case to state-linked strategic blocks because control sits with a corporate foreign parent.",
          "The overlap with BPJS, Norway, and Vanguard keeps the ticker analytically interesting beyond the parent stake itself.",
          "A production version should separate strategic parent ownership from passive foreign institutional participation over time."
        ],
        holderTable: [
          { name: "BANPU MINERAL (SINGAPORE) PTE LTD", type: "CP", nat: "F", pct: "65.14%", strategic: true, entityId: "banpu-mineral-singapore-pte-ltd", entityKind: "investor" },
          { name: "BPJS KETENAGAKERJAAN", type: "PF", nat: "L", pct: "1.04%", strategic: false, entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "GOVERNMENT OF NORWAY", type: "PF", nat: "F", pct: "1.01%", classificationOverride: "float", entityId: "government-of-norway", entityKind: "investor" },
          { name: "VANGUARD FUNDS", type: "MF", nat: "F", pct: "1.01%", strategic: false, entityId: "vanguard-funds", entityKind: "investor" }
        ],
        related: [
          { label: "Banpu Mineral (Singapore) Pte Ltd", kind: "investor", id: "banpu-mineral-singapore-pte-ltd" },
          { label: "Government of Norway", kind: "investor", id: "government-of-norway" },
          { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan" }
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
        summary: "State-influenced transport name with concentrated control, but not as extreme as the earlier placeholder row suggested. The research value here is how much float remains after clear strategic exclusions.",
        tags: ["Transport", "State-linked", "Medium Float"],
        metrics: [
          { label: "Market Cap", value: "Rp13T" },
          { label: "Free Float", value: "26.76%" },
          { label: "Strategic Held", value: "73.24%" },
          { label: "Visible Held", value: "73.24%" },
          { label: "P/S", value: "0.5x" },
          { label: "P/B", value: "1.1x" },
          { label: "Risk", value: "Medium" }
        ],
        localForeign: [
          { name: "Local", value: 100 },
          { name: "Foreign", value: 0 }
        ],
        summaryPoints: [
          "GIAA is still strategically controlled, but the official ownership structure suggests a materially larger float than the earlier prototype row showed.",
          "This is a good example of why replacing fabricated placeholders with source-backed structures matters.",
          "The blind-spot component remains important because visible float holders above 1% are still sparse."
        ],
        holderTable: [
          { name: "GOVERNMENT OF INDONESIA", type: "CP", nat: "L", pct: "64.54%", strategic: true },
          { name: "PT TRANS AIRWAYS", type: "CP", nat: "L", pct: "8.70%", strategic: true }
        ],
        related: [
          { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management" }
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
        localForeign: [
          { name: "Local", value: 92 },
          { name: "Foreign", value: 8 }
        ],
        summaryPoints: [
          "This is the clearest float-risk case in the prototype dataset.",
          "Strategic concentration dominates any narrative about broad public ownership.",
          "A serious screener should flag names like this at the top of compliance and liquidity reviews."
        ],
        holderTable: [
          { name: "BAKRIE CAPITAL INDONESIA", type: "CP", nat: "L", pct: "73.14%", strategic: true },
          { name: "LONG HAUL HOLDINGS", type: "OT", nat: "F", pct: "24.80%", strategic: true },
          { name: "PUBLIC FREE FLOAT CLUSTER", type: "ID", nat: "L", pct: "0.20%", strategic: false }
        ],
        related: [
          { label: "Bakrie Group", kind: "group", id: "bakrie-group" }
        ]
      }
    },
    investors: {
      "pt-danantara-asset-management": {
        kind: "investor",
        id: "pt-danantara-asset-management",
        name: "PT Danantara Asset Management",
        eyebrow: "Investor detail",
        summary: "Prototype state-linked strategic vehicle used to represent recurring government control blocks across IDX large caps. This entity is central for explaining why free-float screening must distinguish visible ownership from strategic ownership.",
        tags: ["Corporate", "Local", "State-linked", "Strategic Holder"],
        metrics: [
          { label: "Visible Positions", value: "4" },
          { label: "Nationality", value: "Local" },
          { label: "Investor Type", value: "CP" },
          { label: "Affiliated", value: "State-linked" }
        ],
        styleBreakdown: [
          { name: "Banking", value: 84 },
          { name: "Telecom", value: 16 }
        ],
        summaryPoints: [
          "This is the cleanest example of a strategic block that spans multiple flagship issuers.",
          "In a production workflow, this entity should feed both the float screener and state-linked network investigations automatically.",
          "The material analytical edge is seeing which names remain investable despite concentrated strategic ownership."
        ],
        holdings: [
          { ticker: "BBNI", company: "Bank Negara Indonesia", pct: "59.40%" },
          { ticker: "BBRI", company: "Bank Rakyat Indonesia", pct: "53.19%" },
          { ticker: "BMRI", company: "Bank Mandiri", pct: "52.44%" },
          { ticker: "TLKM", company: "Telkom Indonesia", pct: "52.09%" }
        ],
        related: [
          { label: "BBNI", kind: "ticker", id: "BBNI" },
          { label: "BBRI", kind: "ticker", id: "BBRI" },
          { label: "BMRI", kind: "ticker", id: "BMRI" },
          { label: "TLKM", kind: "ticker", id: "TLKM" }
        ]
      },
      "bpjs-ketenagakerjaan": {
        kind: "investor",
        id: "bpjs-ketenagakerjaan",
        name: "BPJS Ketenagakerjaan",
        eyebrow: "Investor detail",
        summary: "Large domestic pension-style allocator whose recurring positions help separate long-term portfolio capital from strategic control blocks.",
        tags: ["Pension Fund", "Local", "Institutional"],
        metrics: [
          { label: "Visible Positions", value: "6" },
          { label: "Nationality", value: "Local" },
          { label: "Investor Type", value: "PF" },
          { label: "Affiliated", value: "No" }
        ],
        styleBreakdown: [
          { name: "Banking", value: 63 },
          { name: "Materials", value: 17 },
          { name: "Energy", value: 11 },
          { name: "Telecom", value: 9 }
        ],
        summaryPoints: [
          "BPJS is analytically useful because it recurs across large caps without behaving like a strategic controller.",
          "The overlap with state banks, miners, and telecom names creates clean network bridges.",
          "This entity helps demonstrate why pension-style capital should stay inside float assumptions."
        ],
        holdings: [
          { ticker: "BBNI", company: "Bank Negara Indonesia", pct: "1.05%" },
          { ticker: "BBRI", company: "Bank Rakyat Indonesia", pct: "1.04%" },
          { ticker: "ITMG", company: "Indo Tambangraya Megah", pct: "1.04%" },
          { ticker: "TLKM", company: "Telkom Indonesia", pct: "1.03%" },
          { ticker: "TINS", company: "Timah", pct: "1.01%" },
          { ticker: "BMRI", company: "Bank Mandiri", pct: "1.00%" }
        ],
        related: [
          { label: "BBRI", kind: "ticker", id: "BBRI" },
          { label: "TLKM", kind: "ticker", id: "TLKM" },
          { label: "TINS", kind: "ticker", id: "TINS" }
        ]
      },
      "blackrock-funds": {
        kind: "investor",
        id: "blackrock-funds",
        name: "BlackRock Funds",
        eyebrow: "Investor detail",
        summary: "Foreign fund cluster used here as a recurring passive-style holder across large liquid Indonesian names.",
        tags: ["Mutual Fund", "Foreign", "Institutional"],
        metrics: [
          { label: "Visible Positions", value: "4" },
          { label: "Nationality", value: "Foreign" },
          { label: "Investor Type", value: "MF" },
          { label: "Affiliated", value: "No" }
        ],
        styleBreakdown: [
          { name: "Banking", value: 58 },
          { name: "Industrial", value: 18 },
          { name: "Energy", value: 24 }
        ],
        summaryPoints: [
          "BlackRock-style fund entities help show the distinction between recurring institutional ownership and strategic control.",
          "Their overlap across state banks is particularly useful in the network graph.",
          "In a production environment, beneficial-owner consolidation would matter here."
        ],
        holdings: [
          { ticker: "BBRI", company: "Bank Rakyat Indonesia", pct: "1.10%" },
          { ticker: "ADRO", company: "Alamtri Resources Indonesia", pct: "1.08%" },
          { ticker: "BBNI", company: "Bank Negara Indonesia", pct: "1.03%" },
          { ticker: "ASII", company: "Astra International", pct: "1.00%" }
        ],
        related: [
          { label: "BBRI", kind: "ticker", id: "BBRI" },
          { label: "BBNI", kind: "ticker", id: "BBNI" }
        ]
      },
      "vanguard-funds": {
        kind: "investor",
        id: "vanguard-funds",
        name: "Vanguard Funds",
        eyebrow: "Investor detail",
        summary: "Foreign passive-fund style entity used to deepen overlap mapping across telecom, industrial, mining, and energy names.",
        tags: ["Mutual Fund", "Foreign", "Passive-style"],
        metrics: [
          { label: "Visible Positions", value: "4" },
          { label: "Nationality", value: "Foreign" },
          { label: "Investor Type", value: "MF" },
          { label: "Affiliated", value: "No" }
        ],
        styleBreakdown: [
          { name: "Telecom", value: 28 },
          { name: "Industrial", value: 24 },
          { name: "Materials", value: 24 },
          { name: "Energy", value: 24 }
        ],
        summaryPoints: [
          "Vanguard-like fund exposure is useful for identifying shared passive ownership across otherwise unrelated names.",
          "The resulting graph is better for overlap analysis than for control analysis.",
          "Its presence inside authored holder tables adds dense secondary connections."
        ],
        holdings: [
          { ticker: "TINS", company: "Timah", pct: "1.02%" },
          { ticker: "TLKM", company: "Telkom Indonesia", pct: "1.01%" },
          { ticker: "ITMG", company: "Indo Tambangraya Megah", pct: "1.01%" },
          { ticker: "ASII", company: "Astra International", pct: "1.00%" }
        ],
        related: [
          { label: "TLKM", kind: "ticker", id: "TLKM" },
          { label: "TINS", kind: "ticker", id: "TINS" },
          { label: "ITMG", kind: "ticker", id: "ITMG" }
        ]
      },
      "banpu-mineral-singapore-pte-ltd": {
        kind: "investor",
        id: "banpu-mineral-singapore-pte-ltd",
        name: "Banpu Mineral (Singapore) Pte Ltd",
        eyebrow: "Investor detail",
        summary: "Strategic foreign parent used as the primary control block in ITMG.",
        tags: ["Corporate", "Foreign", "Strategic Holder"],
        metrics: [
          { label: "Visible Positions", value: "1" },
          { label: "Nationality", value: "Foreign" },
          { label: "Investor Type", value: "CP" },
          { label: "Affiliated", value: "Strategic" }
        ],
        styleBreakdown: [
          { name: "Energy", value: 100 }
        ],
        summaryPoints: [
          "This is a clean single-name strategic holder rather than a broad portfolio investor.",
          "It helps contrast parent-company control with passive fund overlap.",
          "These nodes matter for free-float deduction much more than for portfolio overlap."
        ],
        holdings: [
          { ticker: "ITMG", company: "Indo Tambangraya Megah", pct: "65.14%" }
        ],
        related: [
          { label: "ITMG", kind: "ticker", id: "ITMG" }
        ]
      },
      "jardine-cycle-carriage-ltd": {
        kind: "investor",
        id: "jardine-cycle-carriage-ltd",
        name: "Jardine Cycle & Carriage Ltd",
        eyebrow: "Investor detail",
        summary: "Strategic foreign parent block anchoring ASII, useful for comparing parent-controlled float structures against state-linked Indonesian names.",
        tags: ["Corporate", "Foreign", "Strategic Holder"],
        metrics: [
          { label: "Visible Positions", value: "1" },
          { label: "Nationality", value: "Foreign" },
          { label: "Investor Type", value: "CP" },
          { label: "Affiliated", value: "Strategic" }
        ],
        styleBreakdown: [
          { name: "Industrial", value: 100 }
        ],
        summaryPoints: [
          "ASII is the core control expression for this entity in the prototype.",
          "The analytical value is comparing this parent-controlled large cap against the state-bank structures.",
          "This type of entity is strategic by default for free-float purposes."
        ],
        holdings: [
          { ticker: "ASII", company: "Astra International", pct: "50.11%" }
        ],
        related: [
          { label: "ASII", kind: "ticker", id: "ASII" }
        ]
      },
      "lo-kheng-hong": {
        kind: "investor",
        id: "lo-kheng-hong",
        name: "Lo Kheng Hong",
        eyebrow: "Investor detail",
        summary: "Well-known Indonesian individual investor whose sub-2% positions matter precisely because they often sit below public attention thresholds.",
        tags: ["Individual", "Local", "Value Investor"],
        metrics: [
          { label: "Visible Positions", value: "6" },
          { label: "Nationality", value: "Local" },
          { label: "Investor Type", value: "ID" },
          { label: "Affiliated", value: "No" }
        ],
        styleBreakdown: [
          { name: "Financials", value: 34 },
          { name: "Industrial", value: 24 },
          { name: "Consumer", value: 19 },
          { name: "Others", value: 23 }
        ],
        summaryPoints: [
          "Best prototype example of hidden 1-2% ownership value proposition.",
          "Not all large individual holders should be treated as strategic or insider by default.",
          "This page is where real entity resolution and insider verification explain product differentiation."
        ],
        holdings: [
          { ticker: "CFIN", company: "Clipan Finance Indonesia", pct: "1.58%" },
          { ticker: "ADMG", company: "Polychem Indonesia", pct: "1.29%" },
          { ticker: "MAIN", company: "Malindo Feedmill", pct: "1.24%" },
          { ticker: "PNIN", company: "Panin Insurance", pct: "1.23%" },
          { ticker: "LSIP", company: "PP London Sumatra", pct: "1.21%" },
          { ticker: "BEST", company: "Bekasi Fajar Industrial Estate", pct: "1.16%" }
        ],
        related: [
          { label: "CFIN", kind: "ticker", id: "CFIN" },
          { label: "BBCA", kind: "ticker", id: "BBCA" }
        ]
      },
      "government-of-norway": {
        kind: "investor",
        id: "government-of-norway",
        name: "Government of Norway",
        eyebrow: "Investor detail",
        summary: "Prototype representation of sovereign-style foreign capital showing how official-looking names can appear across multiple IDX positions above the 1% threshold.",
        tags: ["Pension / Sovereign", "Foreign", "Portfolio Holder"],
        metrics: [
          { label: "Visible Positions", value: "6" },
          { label: "Nationality", value: "Foreign" },
          { label: "Investor Type", value: "PF override" },
          { label: "Affiliated", value: "No" }
        ],
        styleBreakdown: [
          { name: "Consumer", value: 24 },
          { name: "Telecom", value: 18 },
          { name: "Materials", value: 21 },
          { name: "Others", value: 37 }
        ],
        summaryPoints: [
          "Useful for showing how foreign institutional ownership can surface through official or sovereign names.",
          "Type classification matters because a CP code can be strategic by default even if the holder acts like a portfolio investor.",
          "This is where methodology nuance needs explicit explanation in-product."
        ],
        holdings: [
          { ticker: "MPMX", company: "Mitra Pinasthika Mustika", pct: "1.03%" },
          { ticker: "MAPI", company: "Mitra Adiperkasa", pct: "1.06%" },
          { ticker: "TINS", company: "Timah", pct: "1.11%" },
          { ticker: "ESSA", company: "Surya Esa Perkasa", pct: "1.14%" },
          { ticker: "MIDI", company: "Midi Utama Indonesia", pct: "1.20%" },
          { ticker: "INCO", company: "Vale Indonesia", pct: "1.23%" }
        ],
        related: [
          { label: "BBCA", kind: "ticker", id: "BBCA" },
          { label: "TLKM", kind: "ticker", id: "TLKM" }
        ]
      },
      "uob-kay-hian-pte-ltd": {
        kind: "investor",
        id: "uob-kay-hian-pte-ltd",
        name: "UOB Kay Hian Pte Ltd",
        eyebrow: "Investor detail",
        summary: "A recurring foreign intermediary or custodian-style name appearing across many positions, useful for top-foreign ranking views and link analysis.",
        tags: ["Bank", "Foreign", "Intermediary"],
        metrics: [
          { label: "Visible Positions", value: "4" },
          { label: "Nationality", value: "Foreign" },
          { label: "Investor Type", value: "IB" },
          { label: "Affiliated", value: "No" }
        ],
        styleBreakdown: [
          { name: "Banking", value: 28 },
          { name: "Consumer", value: 17 },
          { name: "Energy", value: 14 },
          { name: "Others", value: 41 }
        ],
        summaryPoints: [
          "Top-foreign ranking cards should lead into this detail page.",
          "Intermediary-style names often require extra interpretation because beneficial ownership may sit behind the visible holder record.",
          "A production version should distinguish direct owner versus custodian account when possible."
        ],
        holdings: [
          { ticker: "BBCA", company: "Bank Central Asia", pct: "1.44%" },
          { ticker: "BBRI", company: "Bank Rakyat Indonesia", pct: "1.01%" },
          { ticker: "ASII", company: "Astra International", pct: "1.02%" },
          { ticker: "TLKM", company: "Telkom Indonesia", pct: "1.05%" }
        ],
        related: [
          { label: "BBCA", kind: "ticker", id: "BBCA" }
        ]
      },
      "happy-hapsoro": {
        kind: "investor",
        id: "happy-hapsoro",
        name: "Happy Hapsoro",
        eyebrow: "Investor detail",
        summary: "Prototype entity aligned to the network graph sample, useful for demonstrating connected-company mapping instead of flat table inspection.",
        tags: ["Individual", "Local", "Network Example"],
        metrics: [
          { label: "Linked Tickers", value: "7" },
          { label: "Nationality", value: "Local" },
          { label: "Investor Type", value: "ID" },
          { label: "Affiliated", value: "Contextual" }
        ],
        styleBreakdown: [
          { name: "Energy", value: 42 },
          { name: "Industrial", value: 26 },
          { name: "Logistics", value: 18 },
          { name: "Others", value: 14 }
        ],
        summaryPoints: [
          "This entity anchors the network demonstration used across the prototype.",
          "Graph-first navigation is much more useful than plain table search for these clusters.",
          "A production version should support edge explanations and source traceability."
        ],
        holdings: [
          { ticker: "UNTR", company: "United Tractors", pct: "1.40%" },
          { ticker: "BSSR", company: "Baramulti Suksessarana", pct: "1.22%" },
          { ticker: "PTRO", company: "Petrosea", pct: "1.19%" },
          { ticker: "DSSA", company: "Dian Swastatika Sentosa", pct: "1.11%" }
        ],
        related: [
          { label: "BSSR", kind: "ticker", id: "BSSR" },
          { label: "DSSA", kind: "ticker", id: "DSSA" }
        ]
      }
    },
    groups: {
      "salim-group": {
        kind: "group",
        id: "salim-group",
        name: "Salim Group",
        eyebrow: "Conglomerate detail",
        summary: "Prototype conglomerate page showing how a mapped business group can be treated as its own research object rather than just a label in a card.",
        tags: ["Conglomerate", "14 Tickers", "Mapped Group"],
        metrics: [
          { label: "Mapped Tickers", value: "14" },
          { label: "Primary Sectors", value: "Consumer" },
          { label: "Confidence", value: "High" },
          { label: "Notable Name", value: "INDF / ICBP" }
        ],
        summaryPoints: [
          "Group-level pages are where the product can outperform simple screens and raw spreadsheets.",
          "Mapped groups should expose layered control, not just a list of public companies.",
          "Confidence scoring matters because conglomerate mapping often includes inferential work."
        ],
        holdings: [
          { ticker: "INDF", company: "Indofood Sukses Makmur", pct: "Core" },
          { ticker: "ICBP", company: "Indofood CBP", pct: "Core" },
          { ticker: "SIMP", company: "Salim Ivomas Pratama", pct: "Core" },
          { ticker: "LSIP", company: "PP London Sumatra", pct: "Associated" }
        ],
        related: [
          { label: "BBCA", kind: "ticker", id: "BBCA" },
          { label: "Lippo Group", kind: "group", id: "lippo-group" }
        ]
      },
      "bakrie-group": {
        kind: "group",
        id: "bakrie-group",
        name: "Bakrie Group",
        eyebrow: "Conglomerate detail",
        summary: "Useful for explaining extremely strategic ownership layers and why some tickers in the group screen as very low float.",
        tags: ["Conglomerate", "11 Tickers", "High Strategic Control"],
        metrics: [
          { label: "Mapped Tickers", value: "11" },
          { label: "Primary Sectors", value: "Energy" },
          { label: "Confidence", value: "High" },
          { label: "Notable Name", value: "BUMI" }
        ],
        summaryPoints: [
          "Bakrie-linked entities are a natural match for low-float and strategic-control examples.",
          "Group-level pages should tie directly into screener logic.",
          "This group is one of the best cases for linking from heatmap to ownership research."
        ],
        holdings: [
          { ticker: "BUMI", company: "Bumi Resources", pct: "Core" },
          { ticker: "BNBR", company: "Bakrie & Brothers", pct: "Core" },
          { ticker: "ENRG", company: "Energi Mega Persada", pct: "Core" }
        ],
        related: [
          { label: "BUMI", kind: "ticker", id: "BUMI" }
        ]
      },
      "lippo-group": {
        kind: "group",
        id: "lippo-group",
        name: "Lippo Group",
        eyebrow: "Conglomerate detail",
        summary: "Prototype group page to show how cross-sector family groups can be mapped beyond simple industry classification.",
        tags: ["Conglomerate", "12 Tickers", "Mapped Group"],
        metrics: [
          { label: "Mapped Tickers", value: "12" },
          { label: "Primary Sectors", value: "Property / Healthcare" },
          { label: "Confidence", value: "Medium" },
          { label: "Notable Name", value: "LPKR" }
        ],
        summaryPoints: [
          "Group mapping is not only for energy and industrial clusters.",
          "Pages like this need evidence trails and entity resolution notes.",
          "The user benefit is pattern recognition, not just table lookups."
        ],
        holdings: [
          { ticker: "LPKR", company: "Lippo Karawaci", pct: "Core" },
          { ticker: "SILO", company: "Siloam International Hospitals", pct: "Core" },
          { ticker: "MPPA", company: "Matahari Putra Prima", pct: "Adjacent" }
        ],
        related: [
          { label: "Salim Group", kind: "group", id: "salim-group" }
        ]
      }
    }
  },
  tickerAnalytics: {
    BBCA: {
      ticker: "BBCA",
      company: "Bank Central Asia Tbk",
      lastPrice: 10125,
      priceHistory: [
        { date: "2025-04", price: 9025 },
        { date: "2025-05", price: 9180 },
        { date: "2025-06", price: 9360 },
        { date: "2025-07", price: 9490 },
        { date: "2025-08", price: 9645 },
        { date: "2025-09", price: 9730 },
        { date: "2025-10", price: 9810 },
        { date: "2025-11", price: 9890 },
        { date: "2025-12", price: 9975 },
        { date: "2026-01", price: 10040 },
        { date: "2026-02", price: 10095 },
        { date: "2026-03", price: 10125 }
      ],
      technical: [
        { label: "RSI 14D", value: "56.4" },
        { label: "MA20", value: "9,870" },
        { label: "MA50", value: "9,620" },
        { label: "MACD", value: "+24" },
        { label: "Beta", value: "0.92" },
        { label: "Avg Value / Day", value: "Rp1.8T" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "8.6%" },
        { label: "Loan Growth", value: "11.4%" },
        { label: "NIM", value: "5.8%" },
        { label: "Dividend Yield", value: "2.2%" },
        { label: "EV / EBITDA", value: "14.1x" },
        { label: "CASA Ratio", value: "81.4%" }
      ],
      compare: [
        { ticker: "BBCA", company: "Bank Central Asia", pe: 22.1, pb: 4.8, roe: 21.4, divYield: 2.2, freeFloat: 45.06 },
        { ticker: "BBRI", company: "Bank Rakyat Indonesia", pe: 11.9, pb: 2.2, roe: 19.1, divYield: 5.8, freeFloat: 41.5 },
        { ticker: "BMRI", company: "Bank Mandiri", pe: 10.7, pb: 2.1, roe: 20.2, divYield: 5.2, freeFloat: 44.4 },
        { ticker: "BBNI", company: "Bank Negara Indonesia", pe: 9.8, pb: 1.4, roe: 15.1, divYield: 4.9, freeFloat: 40.6 }
      ],
      alerts: [
        "Premium valuation remains justified only if high-teen earnings quality persists.",
        "Visible foreign participation is still large enough to matter for flow sensitivity.",
        "Free-float remains healthy despite concentrated strategic control."
      ]
    },
    BBRI: {
      ticker: "BBRI",
      company: "Bank Rakyat Indonesia Tbk",
      lastPrice: 5840,
      priceHistory: [
        { date: "2025-04", price: 5210 },
        { date: "2025-05", price: 5340 },
        { date: "2025-06", price: 5480 },
        { date: "2025-07", price: 5550 },
        { date: "2025-08", price: 5680 },
        { date: "2025-09", price: 5600 },
        { date: "2025-10", price: 5480 },
        { date: "2025-11", price: 5570 },
        { date: "2025-12", price: 5650 },
        { date: "2026-01", price: 5730 },
        { date: "2026-02", price: 5890 },
        { date: "2026-03", price: 5840 }
      ],
      technical: [
        { label: "RSI 14D", value: "52.1" },
        { label: "MA20", value: "5,790" },
        { label: "MA50", value: "5,680" },
        { label: "MACD", value: "+11" },
        { label: "Beta", value: "1.07" },
        { label: "Avg Value / Day", value: "Rp2.1T" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "9.8%" },
        { label: "Loan Growth", value: "12.9%" },
        { label: "NIM", value: "7.4%" },
        { label: "Dividend Yield", value: "5.8%" },
        { label: "EV / EBITDA", value: "8.6x" },
        { label: "MSME Exposure", value: "82%" }
      ],
      compare: [
        { ticker: "BBRI", company: "Bank Rakyat Indonesia", pe: 11.9, pb: 2.2, roe: 19.1, divYield: 5.8, freeFloat: 41.5 },
        { ticker: "BMRI", company: "Bank Mandiri", pe: 10.7, pb: 2.1, roe: 20.2, divYield: 5.2, freeFloat: 44.4 },
        { ticker: "BBCA", company: "Bank Central Asia", pe: 22.1, pb: 4.8, roe: 21.4, divYield: 2.2, freeFloat: 45.06 },
        { ticker: "BBNI", company: "Bank Negara Indonesia", pe: 9.8, pb: 1.4, roe: 15.1, divYield: 4.9, freeFloat: 40.6 }
      ],
      alerts: [
        "Yield support is stronger than most large-cap bank peers.",
        "State-linked strategic control remains dominant, but float still screens as investable.",
        "Short-term price action is constructive but not overbought."
      ]
    },
    TLKM: {
      ticker: "TLKM",
      company: "Telkom Indonesia Tbk",
      lastPrice: 3180,
      priceHistory: [
        { date: "2025-04", price: 2860 },
        { date: "2025-05", price: 2910 },
        { date: "2025-06", price: 2960 },
        { date: "2025-07", price: 3010 },
        { date: "2025-08", price: 3040 },
        { date: "2025-09", price: 2970 },
        { date: "2025-10", price: 2920 },
        { date: "2025-11", price: 2980 },
        { date: "2025-12", price: 3030 },
        { date: "2026-01", price: 3090 },
        { date: "2026-02", price: 3150 },
        { date: "2026-03", price: 3180 }
      ],
      technical: [
        { label: "RSI 14D", value: "58.8" },
        { label: "MA20", value: "3,110" },
        { label: "MA50", value: "3,020" },
        { label: "MACD", value: "+18" },
        { label: "Beta", value: "0.81" },
        { label: "Avg Value / Day", value: "Rp640B" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "5.2%" },
        { label: "EBITDA Margin", value: "49.1%" },
        { label: "Dividend Yield", value: "5.4%" },
        { label: "EV / EBITDA", value: "5.9x" },
        { label: "Data Revenue Mix", value: "77%" },
        { label: "Net Debt / EBITDA", value: "0.7x" }
      ],
      compare: [
        { ticker: "TLKM", company: "Telkom Indonesia", pe: 10.8, pb: 1.8, roe: 16.5, divYield: 5.4, freeFloat: 43.9 },
        { ticker: "ISAT", company: "Indosat", pe: 12.7, pb: 2.3, roe: 18.2, divYield: 3.1, freeFloat: 35.4 },
        { ticker: "EXCL", company: "XL Axiata", pe: 15.4, pb: 1.6, roe: 10.7, divYield: 1.4, freeFloat: 33.2 },
        { ticker: "MTEL", company: "Dayamitra Telekomunikasi", pe: 26.8, pb: 3.9, roe: 14.8, divYield: 1.9, freeFloat: 28.7 }
      ],
      alerts: [
        "Dividend yield remains a core support pillar in the telecom peer set.",
        "Visible strategic control is high but does not crush tradable float.",
        "Technical structure is improving after a multi-month base."
      ]
    },
    BUMI: {
      ticker: "BUMI",
      company: "Bumi Resources Tbk",
      lastPrice: 142,
      priceHistory: [
        { date: "2025-04", price: 108 },
        { date: "2025-05", price: 116 },
        { date: "2025-06", price: 121 },
        { date: "2025-07", price: 129 },
        { date: "2025-08", price: 138 },
        { date: "2025-09", price: 132 },
        { date: "2025-10", price: 127 },
        { date: "2025-11", price: 131 },
        { date: "2025-12", price: 136 },
        { date: "2026-01", price: 140 },
        { date: "2026-02", price: 145 },
        { date: "2026-03", price: 142 }
      ],
      technical: [
        { label: "RSI 14D", value: "64.7" },
        { label: "MA20", value: "139" },
        { label: "MA50", value: "133" },
        { label: "MACD", value: "+4.6" },
        { label: "Beta", value: "1.41" },
        { label: "Avg Value / Day", value: "Rp420B" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "-3.8%" },
        { label: "Net Margin", value: "7.1%" },
        { label: "Dividend Yield", value: "0.0%" },
        { label: "EV / EBITDA", value: "4.3x" },
        { label: "Net Debt / EBITDA", value: "2.4x" },
        { label: "Coal Exposure", value: "High" }
      ],
      compare: [
        { ticker: "BUMI", company: "Bumi Resources", pe: 7.2, pb: 1.1, roe: 8.4, divYield: 0.0, freeFloat: 2.06 },
        { ticker: "ADRO", company: "Alamtri Resources", pe: 6.5, pb: 1.4, roe: 20.8, divYield: 8.2, freeFloat: 39.1 },
        { ticker: "PTBA", company: "Bukit Asam", pe: 6.9, pb: 1.7, roe: 23.3, divYield: 10.7, freeFloat: 34.6 },
        { ticker: "ENRG", company: "Energi Mega Persada", pe: 5.4, pb: 0.9, roe: 11.6, divYield: 0.0, freeFloat: 17.9 }
      ],
      alerts: [
        "Float is structurally constrained and should be treated as a liquidity/compliance risk factor.",
        "Technical momentum can look strong even while ownership concentration remains extreme.",
        "Peer comparison is weak on governance and dividend quality despite inexpensive headline multiples."
      ]
    },
    BBNI: {
      ticker: "BBNI",
      company: "Bank Negara Indonesia Tbk",
      lastPrice: 6125,
      priceHistory: [
        { date: "2025-04", price: 5480 },
        { date: "2025-05", price: 5590 },
        { date: "2025-06", price: 5710 },
        { date: "2025-07", price: 5820 },
        { date: "2025-08", price: 5930 },
        { date: "2025-09", price: 5860 },
        { date: "2025-10", price: 5780 },
        { date: "2025-11", price: 5875 },
        { date: "2025-12", price: 5960 },
        { date: "2026-01", price: 6025 },
        { date: "2026-02", price: 6170 },
        { date: "2026-03", price: 6125 }
      ],
      technical: [
        { label: "RSI 14D", value: "53.2" },
        { label: "MA20", value: "6,040" },
        { label: "MA50", value: "5,930" },
        { label: "MACD", value: "+12" },
        { label: "Beta", value: "1.05" },
        { label: "Avg Value / Day", value: "Rp940B" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "8.9%" },
        { label: "Loan Growth", value: "11.8%" },
        { label: "NIM", value: "4.7%" },
        { label: "Dividend Yield", value: "4.9%" },
        { label: "EV / EBITDA", value: "7.9x" },
        { label: "CASA Ratio", value: "70.4%" }
      ],
      compare: [
        { ticker: "BBNI", company: "Bank Negara Indonesia", pe: 9.8, pb: 1.4, roe: 15.1, divYield: 4.9, freeFloat: 40.6 },
        { ticker: "BMRI", company: "Bank Mandiri", pe: 10.7, pb: 2.1, roe: 20.2, divYield: 5.2, freeFloat: 44.4 },
        { ticker: "BBRI", company: "Bank Rakyat Indonesia", pe: 11.9, pb: 2.2, roe: 19.1, divYield: 5.8, freeFloat: 41.5 },
        { ticker: "BBCA", company: "Bank Central Asia", pe: 22.1, pb: 4.8, roe: 21.4, divYield: 2.2, freeFloat: 45.06 }
      ],
      alerts: [
        "The valuation remains cheaper than other large-cap banks despite similar strategic-control logic.",
        "Ownership overlap with Danantara, BPJS, Norway, and BlackRock makes BBNI useful for network screening.",
        "Float remains broad enough to stay institutionally relevant."
      ]
    },
    ASII: {
      ticker: "ASII",
      company: "Astra International Tbk",
      lastPrice: 5250,
      priceHistory: [
        { date: "2025-04", price: 4680 },
        { date: "2025-05", price: 4760 },
        { date: "2025-06", price: 4850 },
        { date: "2025-07", price: 4920 },
        { date: "2025-08", price: 5010 },
        { date: "2025-09", price: 4960 },
        { date: "2025-10", price: 5030 },
        { date: "2025-11", price: 5110 },
        { date: "2025-12", price: 5170 },
        { date: "2026-01", price: 5205 },
        { date: "2026-02", price: 5290 },
        { date: "2026-03", price: 5250 }
      ],
      technical: [
        { label: "RSI 14D", value: "55.1" },
        { label: "MA20", value: "5,180" },
        { label: "MA50", value: "5,050" },
        { label: "MACD", value: "+14" },
        { label: "Beta", value: "0.88" },
        { label: "Avg Value / Day", value: "Rp820B" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "7.5%" },
        { label: "Net Margin", value: "9.6%" },
        { label: "Dividend Yield", value: "4.1%" },
        { label: "EV / EBITDA", value: "6.8x" },
        { label: "Auto Exposure", value: "High" },
        { label: "Industrial Mix", value: "Diversified" }
      ],
      compare: [
        { ticker: "ASII", company: "Astra International", pe: 8.9, pb: 1.5, roe: 17.2, divYield: 4.1, freeFloat: 49.89 },
        { ticker: "UNTR", company: "United Tractors", pe: 7.4, pb: 1.3, roe: 18.7, divYield: 5.6, freeFloat: 40.3 },
        { ticker: "ERAA", company: "Erajaya Swasembada", pe: 10.6, pb: 1.7, roe: 15.3, divYield: 2.8, freeFloat: 43.7 },
        { ticker: "MAPI", company: "Mitra Adiperkasa", pe: 15.2, pb: 2.4, roe: 16.8, divYield: 1.6, freeFloat: 47.9 }
      ],
      alerts: [
        "Strategic parent ownership is concentrated, but free float remains broad by Indonesian large-cap standards.",
        "Visible holder mix is heavily foreign, which changes how flow data should be read.",
        "The stock remains one of the cleaner industrial names for ownership mapping."
      ]
    },
    TINS: {
      ticker: "TINS",
      company: "Timah Tbk",
      lastPrice: 1180,
      priceHistory: [
        { date: "2025-04", price: 930 },
        { date: "2025-05", price: 965 },
        { date: "2025-06", price: 1010 },
        { date: "2025-07", price: 1060 },
        { date: "2025-08", price: 1095 },
        { date: "2025-09", price: 1040 },
        { date: "2025-10", price: 1080 },
        { date: "2025-11", price: 1115 },
        { date: "2025-12", price: 1140 },
        { date: "2026-01", price: 1165 },
        { date: "2026-02", price: 1205 },
        { date: "2026-03", price: 1180 }
      ],
      technical: [
        { label: "RSI 14D", value: "57.6" },
        { label: "MA20", value: "1,155" },
        { label: "MA50", value: "1,102" },
        { label: "MACD", value: "+9" },
        { label: "Beta", value: "1.18" },
        { label: "Avg Value / Day", value: "Rp165B" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "6.1%" },
        { label: "EBITDA Margin", value: "16.4%" },
        { label: "Dividend Yield", value: "3.2%" },
        { label: "EV / EBITDA", value: "5.1x" },
        { label: "Tin Exposure", value: "High" },
        { label: "Net Debt / EBITDA", value: "0.8x" }
      ],
      compare: [
        { ticker: "TINS", company: "Timah", pe: 7.8, pb: 0.9, roe: 11.3, divYield: 3.2, freeFloat: 35.0 },
        { ticker: "ANTM", company: "Aneka Tambang", pe: 13.6, pb: 2.0, roe: 15.9, divYield: 2.7, freeFloat: 35.5 },
        { ticker: "INCO", company: "Vale Indonesia", pe: 12.9, pb: 1.8, roe: 13.6, divYield: 1.1, freeFloat: 20.4 },
        { ticker: "MDKA", company: "Merdeka Copper Gold", pe: 19.4, pb: 2.7, roe: 8.1, divYield: 0.0, freeFloat: 37.8 }
      ],
      alerts: [
        "Government control remains dominant, but visible institutional overlap makes the ownership structure more informative than a pure state block.",
        "Commodity sensitivity matters more for price action than for float deduction.",
        "The network is useful here because Norway, Vanguard, and BPJS all recur across other names."
      ]
    },
    ITMG: {
      ticker: "ITMG",
      company: "Indo Tambangraya Megah Tbk",
      lastPrice: 26750,
      priceHistory: [
        { date: "2025-04", price: 24400 },
        { date: "2025-05", price: 24750 },
        { date: "2025-06", price: 25100 },
        { date: "2025-07", price: 25500 },
        { date: "2025-08", price: 25950 },
        { date: "2025-09", price: 25380 },
        { date: "2025-10", price: 25840 },
        { date: "2025-11", price: 26210 },
        { date: "2025-12", price: 26600 },
        { date: "2026-01", price: 26950 },
        { date: "2026-02", price: 27120 },
        { date: "2026-03", price: 26750 }
      ],
      technical: [
        { label: "RSI 14D", value: "51.8" },
        { label: "MA20", value: "26,920" },
        { label: "MA50", value: "26,380" },
        { label: "MACD", value: "+62" },
        { label: "Beta", value: "0.97" },
        { label: "Avg Value / Day", value: "Rp210B" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "-1.9%" },
        { label: "EBITDA Margin", value: "29.8%" },
        { label: "Dividend Yield", value: "9.1%" },
        { label: "EV / EBITDA", value: "4.8x" },
        { label: "Coal Exposure", value: "High" },
        { label: "Net Cash", value: "Yes" }
      ],
      compare: [
        { ticker: "ITMG", company: "Indo Tambangraya Megah", pe: 6.4, pb: 1.6, roe: 22.6, divYield: 9.1, freeFloat: 34.86 },
        { ticker: "PTBA", company: "Bukit Asam", pe: 6.9, pb: 1.7, roe: 23.3, divYield: 10.7, freeFloat: 34.6 },
        { ticker: "ADRO", company: "Alamtri Resources", pe: 6.5, pb: 1.4, roe: 20.8, divYield: 8.2, freeFloat: 39.1 },
        { ticker: "BUMI", company: "Bumi Resources", pe: 7.2, pb: 1.1, roe: 8.4, divYield: 0.0, freeFloat: 2.06 }
      ],
      alerts: [
        "The strategic parent block is heavy, but the visible institutional float is still meaningful.",
        "Dividend support remains a key part of the equity story.",
        "Foreign strategic control and foreign passive overlap should not be conflated."
      ]
    },
    GIAA: {
      ticker: "GIAA",
      company: "Garuda Indonesia Tbk",
      lastPrice: 78,
      priceHistory: [
        { date: "2025-04", price: 63 },
        { date: "2025-05", price: 66 },
        { date: "2025-06", price: 68 },
        { date: "2025-07", price: 71 },
        { date: "2025-08", price: 74 },
        { date: "2025-09", price: 72 },
        { date: "2025-10", price: 73 },
        { date: "2025-11", price: 75 },
        { date: "2025-12", price: 76 },
        { date: "2026-01", price: 77 },
        { date: "2026-02", price: 79 },
        { date: "2026-03", price: 78 }
      ],
      technical: [
        { label: "RSI 14D", value: "49.4" },
        { label: "MA20", value: "77" },
        { label: "MA50", value: "74" },
        { label: "MACD", value: "+0.6" },
        { label: "Beta", value: "1.24" },
        { label: "Avg Value / Day", value: "Rp38B" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "4.8%" },
        { label: "EBIT Margin", value: "2.1%" },
        { label: "Dividend Yield", value: "0.0%" },
        { label: "EV / EBITDA", value: "7.4x" },
        { label: "Passenger Recovery", value: "Improving" },
        { label: "Leverage", value: "Elevated" }
      ],
      compare: [
        { ticker: "GIAA", company: "Garuda Indonesia", pe: 0.0, pb: 1.1, roe: 0.0, divYield: 0.0, freeFloat: 26.76 },
        { ticker: "AKRA", company: "AKR Corporindo", pe: 11.2, pb: 1.4, roe: 12.9, divYield: 4.0, freeFloat: 42.7 },
        { ticker: "PTIS", company: "Indonesian Transport & Infra", pe: 0.0, pb: 0.0, roe: 0.0, divYield: 0.0, freeFloat: 10.6 },
        { ticker: "META", company: "Nusantara Capital", pe: 0.0, pb: 0.0, roe: 0.0, divYield: 0.0, freeFloat: 14.5 }
      ],
      alerts: [
        "The strategic state block is material, but the updated free-float estimate is far less extreme than the older placeholder row.",
        "This is one of the clearest examples of why source-backed ownership structure matters.",
        "Blind-spot float remains meaningful because visible >1% public holders are sparse."
      ]
    },
    BMRI: {
      ticker: "BMRI",
      company: "Bank Mandiri Tbk",
      lastPrice: 7275,
      priceHistory: [
        { date: "2025-04", price: 6460 },
        { date: "2025-05", price: 6590 },
        { date: "2025-06", price: 6700 },
        { date: "2025-07", price: 6820 },
        { date: "2025-08", price: 6930 },
        { date: "2025-09", price: 6880 },
        { date: "2025-10", price: 6950 },
        { date: "2025-11", price: 7030 },
        { date: "2025-12", price: 7090 },
        { date: "2026-01", price: 7160 },
        { date: "2026-02", price: 7340 },
        { date: "2026-03", price: 7275 }
      ],
      technical: [
        { label: "RSI 14D", value: "54.6" },
        { label: "MA20", value: "7,180" },
        { label: "MA50", value: "7,020" },
        { label: "MACD", value: "+15" },
        { label: "Beta", value: "1.03" },
        { label: "Avg Value / Day", value: "Rp1.6T" }
      ],
      fundamentals: [
        { label: "Revenue Growth", value: "10.1%" },
        { label: "Loan Growth", value: "13.2%" },
        { label: "NIM", value: "5.3%" },
        { label: "Dividend Yield", value: "5.2%" },
        { label: "EV / EBITDA", value: "8.1x" },
        { label: "CASA Ratio", value: "74.6%" }
      ],
      compare: [
        { ticker: "BMRI", company: "Bank Mandiri", pe: 10.7, pb: 2.1, roe: 20.2, divYield: 5.2, freeFloat: 44.4 },
        { ticker: "BBRI", company: "Bank Rakyat Indonesia", pe: 11.9, pb: 2.2, roe: 19.1, divYield: 5.8, freeFloat: 41.5 },
        { ticker: "BBCA", company: "Bank Central Asia", pe: 22.1, pb: 4.8, roe: 21.4, divYield: 2.2, freeFloat: 45.06 },
        { ticker: "BBNI", company: "Bank Negara Indonesia", pe: 9.8, pb: 1.4, roe: 15.1, divYield: 4.9, freeFloat: 40.6 }
      ],
      alerts: [
        "Banking peer valuation still favors state banks over BBCA on simple multiples.",
        "Ownership concentration is lower risk than BUMI-style names but still strategic by design.",
        "Momentum remains constructive while price stays above the 50-day average."
      ]
    }
  },
  searchIndex: [
    { label: "BBCA", kind: "ticker", id: "BBCA", subtitle: "Bank Central Asia Tbk" },
    { label: "BBRI", kind: "ticker", id: "BBRI", subtitle: "Bank Rakyat Indonesia Tbk" },
    { label: "BMRI", kind: "ticker", id: "BMRI", subtitle: "Bank Mandiri Tbk" },
    { label: "TLKM", kind: "ticker", id: "TLKM", subtitle: "Telkom Indonesia Tbk" },
    { label: "BUMI", kind: "ticker", id: "BUMI", subtitle: "Bumi Resources Tbk" },
    { label: "BBNI", kind: "ticker", id: "BBNI", subtitle: "Bank Negara Indonesia Tbk" },
    { label: "ASII", kind: "ticker", id: "ASII", subtitle: "Astra International Tbk" },
    { label: "TINS", kind: "ticker", id: "TINS", subtitle: "Timah Tbk" },
    { label: "ITMG", kind: "ticker", id: "ITMG", subtitle: "Indo Tambangraya Megah Tbk" },
    { label: "GIAA", kind: "ticker", id: "GIAA", subtitle: "Garuda Indonesia Tbk" },
    { label: "ISAT", kind: "ticker", id: "ISAT", subtitle: "Indosat Ooredoo Hutchison" },
    { label: "EXCL", kind: "ticker", id: "EXCL", subtitle: "XL Axiata Tbk" },
    { label: "ADRO", kind: "ticker", id: "ADRO", subtitle: "Alamtri Resources Indonesia" },
    { label: "PTBA", kind: "ticker", id: "PTBA", subtitle: "Bukit Asam Tbk" },
    { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management", subtitle: "State-linked strategic holder", aliases: ["PT DANANTARA ASSET MANAGEMENT", "DANANTARA"] },
    { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan", subtitle: "Local pension-style holder", aliases: ["BPJS KETENAGAKERJAAN"] },
    { label: "BlackRock Funds", kind: "investor", id: "blackrock-funds", subtitle: "Foreign institutional holder", aliases: ["BLACKROCK FUNDS"] },
    { label: "Vanguard Funds", kind: "investor", id: "vanguard-funds", subtitle: "Foreign passive-style holder", aliases: ["VANGUARD FUNDS"] },
    { label: "Banpu Mineral (Singapore) Pte Ltd", kind: "investor", id: "banpu-mineral-singapore-pte-ltd", subtitle: "Strategic parent holder", aliases: ["BANPU MINERAL (SINGAPORE) PTE LTD"] },
    { label: "Jardine Cycle & Carriage Ltd", kind: "investor", id: "jardine-cycle-carriage-ltd", subtitle: "Strategic parent holder", aliases: ["JARDINE CYCLE & CARRIAGE LTD"] },
    { label: "Lo Kheng Hong", kind: "investor", id: "lo-kheng-hong", subtitle: "Individual investor", aliases: ["LO KHENG HONG"] },
    { label: "Government of Norway", kind: "investor", id: "government-of-norway", subtitle: "Foreign sovereign-style holder", aliases: ["GOVERNMENT OF THE KINGDOM OF NORWAY", "GOVT OF NORWAY"] },
    { label: "UOB Kay Hian Pte Ltd", kind: "investor", id: "uob-kay-hian-pte-ltd", subtitle: "Foreign intermediary", aliases: ["UOB KAY HIAN PTE LTD"] },
    { label: "Happy Hapsoro", kind: "investor", id: "happy-hapsoro", subtitle: "Network example investor", aliases: ["HAPPY HAPSORO"] },
    { label: "Salim Group", kind: "group", id: "salim-group", subtitle: "Mapped conglomerate" },
    { label: "Bakrie Group", kind: "group", id: "bakrie-group", subtitle: "Mapped conglomerate" },
    { label: "Lippo Group", kind: "group", id: "lippo-group", subtitle: "Mapped conglomerate" }
  ],
  searchables: [
    "BBCA",
    "BBRI",
    "BMRI",
    "BBNI",
    "ASII",
    "TINS",
    "ITMG",
    "GIAA",
    "TLKM",
    "ISAT",
    "EXCL",
    "ADRO",
    "PTBA",
    "GOTO",
    "PT Danantara Asset Management",
    "BPJS Ketenagakerjaan",
    "BlackRock Funds",
    "Vanguard Funds",
    "Banpu Mineral (Singapore) Pte Ltd",
    "Jardine Cycle & Carriage Ltd",
    "Lo Kheng Hong",
    "Government of Norway",
    "UOB Kay Hian Pte Ltd",
    "Salim Group",
    "Lippo Group",
    "Sinar Mas Group",
    "Prajogo Pangestu",
    "Happy Hapsoro",
    "Reksa Dana Sucorinvest Equity Prima",
    "Bank of Singapore Ltd",
    "PT Danantara Asset Management",
    "BSSR",
    "DSSA",
    "UNTR"
  ]
};
