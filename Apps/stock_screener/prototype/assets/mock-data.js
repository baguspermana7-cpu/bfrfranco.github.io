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
    { label: "Ready Tickers", value: "24" },
    { label: "Review Queue", value: "1" },
    { label: "Investor Scenarios", value: "10" },
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
      { label: "Ready Tickers", value: "24" },
      { label: "Review Queue", value: "1" },
      { label: "Named Holders", value: "35" },
      { label: "Official Sources", value: "25" },
      { label: "Latest Snapshot", value: "16 Mar 2026" },
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
    },
    KLBF: {
      status: "ready",
      asOf: "31 Mar 2025",
      sourceLabel: "Kalbe Farma Q1 2025 Financial Statements",
      sourceUrl: "https://www.kalbe.co.id/api-content/File/GetFile/LKT_KLBF_31_MAR_2025.pdf",
      note: "Share ownership composition, treasury shares, and public float categories are sourced from the official March 2025 financial statements."
    },
    UNTR: {
      status: "ready",
      asOf: "31 Dec 2025",
      sourceLabel: "United Tractors FY2025 Financial Statements",
      sourceUrl: "https://www.unitedtractors.com/wp-content/uploads/2026/02/FS-UNTR-1225-ENG.pdf",
      note: "Ownership structure uses the official December 2025 statement note showing Astra's control block, treasury shares, and public ownership."
    },
    JSMR: {
      status: "ready",
      asOf: "31 Mar 2025",
      sourceLabel: "Jasa Marga Q1 2025 Financial Statements",
      sourceUrl: "https://investor-id.jasamarga.com/newsroom/Laporan_Keuangan_JSMR_31_Maret_2025_Unaudited.pdf",
      note: "Government control and the leading public holder blocks are sourced from the official March 2025 statement note on share ownership."
    },
    INDF: {
      status: "ready",
      asOf: "Current IR page retrieved 16 Mar 2026",
      sourceLabel: "Indofood Shareholders Composition page",
      sourceUrl: "https://www.indofood.com/page/shareholders-composition",
      note: "Official issuer IR page is undated, so this row is treated as a current-page disclosure retrieved on 16 March 2026. The page explicitly shows First Pacific 50.07%, Anthoni Salim 0.02%, and public below 5% at 49.91%."
    },
    ICBP: {
      status: "ready",
      asOf: "Current IR page retrieved 16 Mar 2026",
      sourceLabel: "ICBP Shareholders Composition page",
      sourceUrl: "https://www.indofoodcbp.com/page/shareholders-composition",
      note: "Official issuer IR page is undated, so this row is treated as a current-page disclosure retrieved on 16 March 2026. The page shows PT Indofood Sukses Makmur Tbk at 80.53% and public below 5% at 19.47%."
    },
    WTON: {
      status: "ready",
      asOf: "31 Dec 2024",
      sourceLabel: "WTON Annual Report 2024 share-capital note",
      sourceUrl: "https://investor.wika-beton.co.id/misc/AR/flipbook/AR-2024/826-827/",
      note: "Exact annual-report share-capital page shows PT Wijaya Karya (Persero) Tbk 60.00%, Koperasi Karya Mitra Satya 4.59%, Yayasan Wijaya Karya 0.99%, key management holdings, and public 34.22%."
    },
    WEGE: {
      status: "ready",
      asOf: "31 Dec 2024",
      sourceLabel: "WEGE Annual Report 2024 shareholder composition page",
      sourceUrl: "https://investor.wikagedung.co.id/misc/AR/Flipbook/Annual-Report-2024/203/",
      note: "Exact annual-report shareholder page shows PT Wijaya Karya (Persero) Tbk 69.30%, Koperasi Karyawan WIKA 0.70%, and public 30.00%."
    },
    AUTO: {
      status: "ready",
      asOf: "31 Dec 2024",
      sourceLabel: "Astra Otoparts Annual Report 2024 shareholder composition",
      sourceUrl: "https://www.astra-otoparts.com/wp-content/uploads/2025/03/Astra-Otoparts-Annual-Report-2024.pdf",
      note: "Annual report shareholder-composition note shows PT Astra International Tbk at 80.00% and public ownership at 20.00%."
    },
    AALI: {
      status: "ready",
      asOf: "31 Dec 2024",
      sourceLabel: "Astra Agro Annual Report 2024 share ownership",
      sourceUrl: "https://www.astra-agro.co.id/wp-content/uploads/2025/04/Annual-Report-2024-AAL-web.pdf",
      note: "Annual report share-ownership page shows PT Astra International Tbk at 79.68% and public ownership at 20.32%."
    },
    WIKA: {
      status: "ready",
      asOf: "25 Jun 2025",
      sourceLabel: "WIKA Business Presentation 5M 2025",
      sourceUrl: "https://investor.wika.co.id/misc/slides/2025/Presentation-Jun-2025-ID.pdf",
      note: "Exact corporate presentation shows PT Danantara Asset Management at 91.02%, local public at 7.58%, and foreign public at 1.40%."
    },
    SMGR: {
      status: "ready",
      asOf: "31 Oct 2025",
      sourceLabel: "SIG 9M 2025 Info Memo",
      sourceUrl: "https://sig.id/storage/downloads/informasi-keuangan/2025/3q25-info-memo-smgr-2025.pdf",
      note: "Exact 9M 2025 info memo shows PT Biro Klasifikasi Indonesia (Persero) 51.2%, treasury stock 0.2%, and public 48.6%."
    }
  },
  decisionLedger: {
    BBCA: {
      asOf: "31 Dec 2025",
      sourceLabel: "BCA 2025 performance release",
      sourceUrl: "https://www.bca.co.id/en/tentang-bca/media-riset/pressroom/siaran-pers/2026/01/28/02/41/bca-mencetak-laba-rp57-5-triliun-di-2025",
      earningsView: "Strong",
      earningsNote: "2025 net profit reached Rp57.5T while total loans still grew and transaction volumes expanded.",
      balanceView: "Strong",
      balanceNote: "Funding franchise stayed deep, DPK grew 10.2% YoY, and cost discipline improved through a lower CIR.",
      catalystView: "Compounding",
      catalystNote: "Main upside driver is steady franchise compounding through credit, CASA, and transaction growth rather than a one-off re-rating.",
      valuationGate: "Premium franchise name. Live P/E and P/B check is mandatory before entry.",
      allocationFit: "High",
      multibaggerFit: "Low",
      watchItems: ["premium multiple discipline", "credit-cost normalization"]
    },
    BBRI: {
      asOf: "30 Sep 2025",
      sourceLabel: "BRI official 2025 operating highlights",
      sourceUrl: "https://www.ir-bri.com/at_a_glance.html",
      earningsView: "Strong",
      earningsNote: "Official IR highlights show assets above Rp2,100T by 1H25 and management kept emphasizing funding and micro franchise resilience through 2025.",
      balanceView: "Strong",
      balanceNote: "Funding quality improved, branchless distribution stayed unmatched, and capital remains a structural strength for the franchise.",
      catalystView: "Compounding",
      catalystNote: "Core catalyst is sustained low-cost funding, micro recovery quality, and digital transaction monetization, not a balance-sheet rescue story.",
      valuationGate: "Live valuation check required because bank rerating depends on NIM and credit-cost expectations at entry time.",
      allocationFit: "High",
      multibaggerFit: "Low",
      watchItems: ["micro asset-quality cycle", "margin sensitivity versus rate path"]
    },
    TLKM: {
      asOf: "30 Sep 2025",
      sourceLabel: "Telkom 9M 2025 results",
      sourceUrl: "https://www.telkom.co.id/sites/about-telkom/en_US/news/telkom-reports-9m-2025-results-with-double-digit-digital-growth-and-sustained-momentum-in-data-center-fiber-infrastructure-and-b2b-services-2409",
      earningsView: "Strong",
      earningsNote: "Official IR highlights show 9M25 revenue of Rp109.6T, EBITDA of Rp54.4T, and net income of Rp15.8T with digital infrastructure still expanding.",
      balanceView: "Adequate",
      balanceNote: "Cash generation remains large, but the group still needs disciplined capital allocation across fiber, mobile, and data-center build-out.",
      catalystView: "Project",
      catalystNote: "Data center, fiber infrastructure, enterprise IT services, and continuing FMC execution create a multi-year infrastructure monetization story.",
      valuationGate: "Live EV/EBITDA and sum-of-parts check required before adding size.",
      allocationFit: "High",
      multibaggerFit: "Selective",
      watchItems: ["capital intensity on digital infrastructure", "execution quality of 5 Bold Moves"]
    },
    BMRI: {
      asOf: "30 Sep 2025",
      sourceLabel: "Bank Mandiri 3Q 2025 financial statements",
      sourceUrl: "https://www.bankmandiri.co.id/documents/38265486/0/Mandiri_LapKeu_Q3-2025_Eng_Preview.pdf/f6881e13-2e5a-399a-0149-2bfac26d4716?t=1761639513464",
      earningsView: "Strong",
      earningsNote: "Official 3Q25 statements show profit for the period of Rp41.37T on a still-large earnings base.",
      balanceView: "Strong",
      balanceNote: "Capital stayed strong and reported CAR remained above 20%, supporting lending capacity and dividend resilience.",
      catalystView: "Compounding",
      catalystNote: "The case is disciplined compounding via corporate, retail, and wholesale banking rather than deep turnaround asymmetry.",
      valuationGate: "Live valuation and credit-cost check required; state-bank rerating can move quickly with macro expectations.",
      allocationFit: "High",
      multibaggerFit: "Low",
      watchItems: ["state-bank policy risk", "NIM compression if funding competition rises"]
    },
    BBNI: {
      asOf: "31 Dec 2025",
      sourceLabel: "BNI Investors FY2025 KPI",
      sourceUrl: "https://www.bni.co.id/en-us/investors",
      earningsView: "Stable",
      earningsNote: "Official FY2025 investor KPIs show net profit of Rp20.3T, ROE 12.7%, NPL 1.93%, and CAR 20.7%.",
      balanceView: "Strong",
      balanceNote: "Capital and liquidity remain solid, while management continues to frame digitalization and funding efficiency as core supports.",
      catalystView: "Compounding",
      catalystNote: "Potential upside comes from cleaner execution on digital, CASA efficiency, and portfolio mix improvement rather than pure scarcity.",
      valuationGate: "Live relative-valuation check versus other state banks is required before any accumulate call.",
      allocationFit: "Medium",
      multibaggerFit: "Selective",
      watchItems: ["return-on-equity catch-up", "execution consistency across corporate and consumer mix"]
    },
    ASII: {
      asOf: "31 Dec 2024",
      sourceLabel: "Astra FY2024 financial release",
      sourceUrl: "https://www.astra.co.id/press-release/27-februari-2025-laporan-keuangan-astra-tahun-2024",
      earningsView: "Stable",
      earningsNote: "Official FY2024 release shows net revenue of Rp330.9T and net profit of about Rp34.2T, supported by a diversified business portfolio.",
      balanceView: "Strong",
      balanceNote: "Management explicitly highlighted a solid balance sheet and financial-services plus infrastructure businesses still cushioned cyclicality.",
      catalystView: "Compounding",
      catalystNote: "This is a diversified compounding platform, not a single-theme rerating trade. Value creation depends on portfolio resilience and capital allocation.",
      valuationGate: "Live holding-company discount and subsidiary look-through valuation check required.",
      allocationFit: "High",
      multibaggerFit: "Low",
      watchItems: ["auto-cycle sensitivity", "coal-linked earnings contribution normalization"]
    },
    TINS: {
      asOf: "31 Mar 2025",
      sourceLabel: "PT Timah 1Q 2025 performance release",
      sourceUrl: "https://timah.com/news/post/pt-timah-tbk-tins-scored-a-net-profit-of-idr-11686-billion-in-the-first-quarter-of-2025-exceeding-the-target-of-120.html",
      earningsView: "Cyclical",
      earningsNote: "Official 1Q25 release shows profit of Rp116.86B as tin demand stayed solid and LME tin prices remained supportive.",
      balanceView: "Adequate",
      balanceNote: "The company completed MTN buybacks in March 2025, which helps capital-structure discipline but does not remove commodity volatility.",
      catalystView: "Cycle",
      catalystNote: "Main upside comes from tin-price strength, operational normalization, and downstream execution, which makes the thesis cyclical rather than linear.",
      valuationGate: "Live commodity-price deck and balance-sheet review required; do not treat this like a steady compounder.",
      allocationFit: "Medium",
      multibaggerFit: "Medium",
      watchItems: ["tin-price reversal", "illegal-mining and ore-supply execution risk"]
    },
    ITMG: {
      asOf: "31 Dec 2024",
      sourceLabel: "ITMG 12M24 financial results",
      sourceUrl: "https://www.itmg.co.id/files/media/News%20Release%20on%20Financial%20Results%20and%20Performance%2012M24.pdf",
      earningsView: "Cyclical",
      earningsNote: "Official 12M24 release shows net profit of US$376M, with coal production and sales volume rising despite lower average selling prices.",
      balanceView: "Strong",
      balanceNote: "Equity expanded in 2024 and the group still generated sizeable cash despite coal-price normalization.",
      catalystView: "Cycle",
      catalystNote: "Upside depends on coal prices, cost control, and capital return. This is a cycle and yield story more than an early structural-growth story.",
      valuationGate: "Live coal-price deck, dividend assumptions, and reserve-life review are mandatory.",
      allocationFit: "Medium",
      multibaggerFit: "Low",
      watchItems: ["coal benchmark downside", "reinvestment quality outside core cash generation"]
    },
    GIAA: {
      asOf: "30 Jun 2025",
      sourceLabel: "Garuda 1Q 2025 corporate presentation",
      sourceUrl: "https://www.garuda-indonesia.com/static/content/dam/garuda/files/pdf/investor-relations/company-presentation/Corp%20Presentation%201Q%202025_Final.pdf",
      earningsView: "Turnaround",
      earningsNote: "Official 1Q25 presentation shows consolidated operating revenue up 1.63% YoY to US$723.56M and EBITDA up 16.97% YoY, but the case is still a restructuring story.",
      balanceView: "Restructuring",
      balanceNote: "The company continues to frame creditor discipline, homologation execution, and PMTHMETD-backed repair as core to financial stability.",
      catalystView: "Turnaround",
      catalystNote: "Potential upside is high because route expansion, fleet recovery, and restructuring execution can materially change perception, but failure risk is still elevated.",
      valuationGate: "Speculative only. Live solvency, fleet, and restructuring-monitoring work is required before any capital is put at risk.",
      allocationFit: "Low",
      multibaggerFit: "High",
      watchItems: ["execution of restructuring milestones", "fleet readiness and supply-chain constraints"]
    },
    ANTM: {
      asOf: "31 Mar 2025",
      sourceLabel: "ANTAM 1Q 2025 performance release",
      sourceUrl: "https://www.antam.com/news-and-events/article/antam-strengthens-fundamentals--first-quarter-profit-in-2025-boost-to-rp2-32-trillion",
      earningsView: "Strong",
      earningsNote: "Official 1Q25 release shows profit for the period of Rp2.32T, EBITDA of Rp3.26T, and assets rising to Rp48.30T.",
      balanceView: "Adequate",
      balanceNote: "Management described the financial structure as solid, but the earnings profile still remains sensitive to metals prices and downstream execution.",
      catalystView: "Project",
      catalystNote: "Gold processing expansion, EV-battery ecosystem milestones, and alumina downstream readiness create real optionality if execution stays on schedule.",
      valuationGate: "Live commodity-price and downstream-project valuation check required.",
      allocationFit: "Medium",
      multibaggerFit: "Medium",
      watchItems: ["nickel and gold price volatility", "timing of downstream project commercialization"]
    },
    PTBA: {
      asOf: "30 Jun 2025",
      sourceLabel: "PTBA 1H 2025 performance release",
      sourceUrl: "https://old.ptba.co.id/berita/kinerja-operasional-terjaga-bukit-asam-ptba-bukukan-pendapatan-rp2045-triliun-di-semester-i-2025-2279",
      earningsView: "Cyclical",
      earningsNote: "Official 1H25 release shows operational volume growth, while earlier 1Q25 reporting still reflected pressured profitability versus stronger 2024 earnings.",
      balanceView: "Strong",
      balanceNote: "The company still distributed large dividends off FY2024 profit and continues to run from a relatively strong balance-sheet position.",
      catalystView: "Cycle",
      catalystNote: "Upside depends on export volume, logistics execution, and coal-market conditions. It is a cash-yield plus cycle name, not a clean structural-growth story.",
      valuationGate: "Live coal-price scenario and payout sustainability check are mandatory.",
      allocationFit: "Medium",
      multibaggerFit: "Selective",
      watchItems: ["coal-price weakness", "execution of rail and logistics expansion"]
    },
    INCO: {
      asOf: "25 Feb 2026",
      sourceLabel: "PT Vale growth project update",
      sourceUrl: "https://www.vale.com/w/pt-vale-s-growth-project-in-igp-pomalaa-reaches-62-completion",
      earningsView: "Stable",
      earningsNote: "Official 3Q25 release showed revenue of US$278.6M, EBITDA of US$74.6M, and net profit of US$27.2M as production improved and Bahodopi started contributing.",
      balanceView: "Adequate",
      balanceNote: "Project spending remains substantial, but RKAB approval and project progress updates support continuity rather than emergency financing language.",
      catalystView: "Project",
      catalystNote: "Pomalaa, Bahodopi, and broader nickel downstream expansion create real multi-year optionality if execution remains on schedule.",
      valuationGate: "Live nickel-price, capex, and project-risk review required before entry.",
      allocationFit: "Medium",
      multibaggerFit: "High",
      watchItems: ["project-execution and capex discipline", "nickel-price normalization risk"]
    },
    PGAS: {
      asOf: "30 Sep 2025",
      sourceLabel: "PGN 3Q 2025 business fundamentals update",
      sourceUrl: "https://ir.pgn.co.id/AssetFiles/Idx/PGN_Perkuat_Fundamental_Bisnis_Kelola_Dinamika_Bisnis_Triwulan_III_2025.pdf",
      earningsView: "Stable",
      earningsNote: "Official 3Q25 update shows revenue of about US$2.9B, EBITDA of US$728.7M, and net profit of US$237.9M.",
      balanceView: "Adequate",
      balanceNote: "Management emphasized cost efficiency, cash-flow prudence, and selective prioritization of key projects to strengthen resilience.",
      catalystView: "Policy",
      catalystNote: "Gas infrastructure, customer growth, and national gas-utilization policy create steady but policy-sensitive upside.",
      valuationGate: "Live gas-volume, tariff, and capex check required before adding exposure.",
      allocationFit: "High",
      multibaggerFit: "Selective",
      watchItems: ["regulatory and tariff risk", "execution of key infrastructure projects"]
    },
    KLBF: {
      asOf: "30 Sep 2025",
      sourceLabel: "Kalbe Farma 9M25 company presentation",
      sourceUrl: "https://www.kalbe.co.id/api-content/File/GetFile/Kalbe%209M25%20Presentation.pdf",
      earningsView: "Stable",
      earningsNote: "Official 9M25 presentation shows gross profit of about Rp10.56T and net income of about Rp2.63T, indicating the franchise still compounds through a defensive product mix.",
      balanceView: "Strong",
      balanceNote: "Kalbe continues to screen as a cash-generative healthcare compounder with low balance-sheet stress and broad operating diversification.",
      catalystView: "Compounding",
      catalystNote: "Catalyst is steady execution across prescription, consumer health, nutrition, and distribution rather than a one-step rerating event.",
      valuationGate: "Live P/E and quality-premium check required because defensive compounders can still be expensive at the wrong entry price.",
      allocationFit: "High",
      multibaggerFit: "Low",
      watchItems: ["entry valuation discipline", "margin resilience if consumer demand softens"]
    },
    UNTR: {
      asOf: "31 Mar 2025",
      sourceLabel: "United Tractors Q1 2025 results release",
      sourceUrl: "https://www.unitedtractors.com/en/united-tractors-posted-a-net-revenue-of-idr-31-0-trillion-and-net-income-of-idr-4-4-trillion-in-the-first-quarter-of-2025/",
      earningsView: "Cyclical",
      earningsNote: "Official results communication highlighted revenue of about Rp31.0T and net income of about Rp4.4T, showing earnings still depend materially on the heavy-equipment and commodity cycle.",
      balanceView: "Strong",
      balanceNote: "The group remains backed by Astra and retains balance-sheet resilience despite cyclical exposure to mining, contracting, and equipment demand.",
      catalystView: "Cycle",
      catalystNote: "The upside case depends on commodity capex, equipment demand, and operating leverage rather than a pure scarcity setup.",
      valuationGate: "Live commodity-cycle and subsidiary look-through valuation check are required before committing capital.",
      allocationFit: "Medium",
      multibaggerFit: "Selective",
      watchItems: ["coal and heavy-equipment cycle risk", "sensitivity of earnings mix to commodity capex"]
    },
    JSMR: {
      asOf: "31 Mar 2025",
      sourceLabel: "Jasa Marga Q1 2025 financial statements",
      sourceUrl: "https://investor-id.jasamarga.com/newsroom/Laporan_Keuangan_JSMR_31_Maret_2025_Unaudited.pdf",
      earningsView: "Stable",
      earningsNote: "Official 1Q25 results show revenue and other operating income of about Rp4.9T, EBITDA of about Rp3.2T, and core net profit of about Rp927.7B.",
      balanceView: "Adequate",
      balanceNote: "Leverage is still relevant in a toll-road operator, but management highlighted a net debt to EBITDA trend around 7.4x and continued asset monetization discipline.",
      catalystView: "Policy",
      catalystNote: "Tariff adjustments, traffic growth, and portfolio recycling remain the main drivers rather than explosive single-project optionality.",
      valuationGate: "Live traffic, tariff, and leverage review is mandatory because toll-road value can look cheap while balance-sheet drag remains real.",
      allocationFit: "Medium",
      multibaggerFit: "Low",
      watchItems: ["deleveraging pace", "traffic and tariff realization versus plan"]
    },
    INDF: {
      asOf: "30 Jun 2025",
      sourceLabel: "Indofood 1H 2025 financial results",
      sourceUrl: "https://www.indofood.com/menu/financial-press-releases/indofood-financial-results-for-the-period-ended-30-june-2025",
      earningsView: "Strong",
      earningsNote: "Official 1H25 release shows consolidated net sales up 4% to Rp59.84T, income attributable to equity holders up 51% to Rp5.84T, and core profit up 2% to Rp5.78T.",
      balanceView: "Strong",
      balanceNote: "Management explicitly highlighted a healthy balance sheet while preserving market share and profitability through a still-volatile consumer environment.",
      catalystView: "Compounding",
      catalystNote: "The case is resilient multi-segment food compounding rather than a single-project rerating. Brand strength, scale, and downstream integration remain the core edge.",
      valuationGate: "Live valuation check is mandatory because Indofood can screen attractive on headline multiples while consumer demand and commodity exposure still shape entry quality.",
      allocationFit: "High",
      multibaggerFit: "Low",
      watchItems: ["consumer demand elasticity", "commodity-input margins", "holding-company discount versus subsidiary value"]
    },
    ICBP: {
      asOf: "30 Sep 2025",
      sourceLabel: "ICBP 9M 2025 financial results",
      sourceUrl: "https://www.indofoodcbp.com/menu/financial-press-releases/icbps-financial-results-for-the-period-ended-30-september-2025",
      earningsView: "Stable",
      earningsNote: "Official 9M25 release shows net sales up 1% to Rp56.27T and income from operations up 6% to Rp12.74T, while attributable profit fell 13% because of forex-driven non-cash pressure.",
      balanceView: "Strong",
      balanceNote: "Management still described the financial position as healthy despite Rupiah depreciation and maintained an operating margin of 22.6%.",
      catalystView: "Compounding",
      catalystNote: "ICBP remains a brand-and-distribution compounding case. The main upside comes from product mix, efficiency, and sustained leadership across staple categories.",
      valuationGate: "Live valuation and forex-sensitivity review are still needed because the business quality is high but re-entry discipline matters when margins are already strong.",
      allocationFit: "High",
      multibaggerFit: "Low",
      watchItems: ["forex translation pressure", "raw-material cost pass-through", "volume growth versus pricing mix"]
    },
    WTON: {
      asOf: "30 Jun 2025",
      sourceLabel: "WIKA Beton H1 2025 performance release",
      sourceUrl: "https://www.wika-beton.co.id/wp-content/uploads/2026/01/Press_Release-WIKA-Beton-ID-EN-Kinerja-Semester-I-2025.pdf",
      earningsView: "Recovering",
      earningsNote: "Official H1 2025 release shows profit of Rp4.35B on revenue of Rp1.57T, with new contracts reaching Rp2.10T and infrastructure still dominating the mix.",
      balanceView: "Adequate",
      balanceNote: "Inference from the official release: operating momentum is positive, but profit remains thin relative to revenue, so working-capital discipline and collection quality still matter.",
      catalystView: "Project",
      catalystNote: "Main upside depends on whether the contract pipeline converts into healthier margins and whether private-sector demand stays supportive beside SOE infrastructure work.",
      valuationGate: "Treat as a project-execution name. Review backlog quality, receivables, and margin conversion before adding exposure.",
      allocationFit: "Low",
      multibaggerFit: "Selective",
      watchItems: ["backlog conversion quality", "working-capital intensity", "SOE and private project payment timing"]
    },
    WEGE: {
      asOf: "31 Mar 2025",
      sourceLabel: "WEGE Q1 2025 financial statements",
      sourceUrl: "https://investor.wikagedung.co.id/newsroom/Laporan_Keuangan_WEGE_Maret_2025_%28Unaudited%29.pdf",
      earningsView: "Fragile",
      earningsNote: "Official Q1 2025 statements show revenue of Rp543.26B with attributable profit of only Rp342.8M, which means the company stayed profitable but still on a very thin margin base.",
      balanceView: "Adequate",
      balanceNote: "Inference from the official statements: when profitability is this thin, contract execution, cash conversion, and claim collection can matter more than top-line growth alone.",
      catalystView: "Project",
      catalystNote: "Optionality comes from stronger building-project wins and margin recovery, but the thesis still depends on execution rather than ownership scarcity.",
      valuationGate: "Do not read this as a clean compounder. Review order-book quality, receivables, and margin recovery before taking risk.",
      allocationFit: "Low",
      multibaggerFit: "Selective",
      watchItems: ["project-margin recovery", "cash conversion and receivables", "new contract replenishment"]
    },
    AUTO: {
      asOf: "30 Sep 2025",
      sourceLabel: "Astra Otoparts 9M 2025 performance release",
      sourceUrl: "https://www.astra-otoparts.com/en/astra-otoparts-recorded-net-income-of-rp-1-6-trillion-in-the-first-nine-months-of-2025/",
      earningsView: "Stable",
      earningsNote: "Official 9M25 release shows net revenue of Rp14.8T and net income of Rp1.6T, indicating the group still benefits from resilient replacement-market and OEM demand.",
      balanceView: "Strong",
      balanceNote: "The same release highlights total assets of Rp23.0T and total liabilities of Rp6.5T, which supports a relatively conservative balance-sheet profile for the business mix.",
      catalystView: "Compounding",
      catalystNote: "The case is operational compounding through aftermarket leadership, OEM exposure, and export growth rather than a scarcity-driven float story.",
      valuationGate: "Live auto-cycle and parts-demand review is still required because margins can look safe until vehicle-cycle weakness feeds through.",
      allocationFit: "High",
      multibaggerFit: "Low",
      watchItems: ["domestic auto demand softness", "OEM margin mix", "export growth durability"]
    },
    AALI: {
      asOf: "30 Sep 2025",
      sourceLabel: "Astra Agro 9M 2025 financial statements",
      sourceUrl: "https://www.astra-agro.co.id/wp-content/uploads/2025/11/Financial-Statement-30-Sep-2025.pdf",
      earningsView: "Cyclical",
      earningsNote: "Inference from the official 9M25 financial statements: the company remained profitable and still carried a large asset base, but the investment case remains tied to palm-oil pricing and plantation operating conditions rather than a clean compounding profile.",
      balanceView: "Adequate",
      balanceNote: "Inference from the same statements: balance-sheet quality remains manageable, but cash generation and returns still depend materially on CPO prices and biological-asset cycle conditions.",
      catalystView: "Cycle",
      catalystNote: "Upside comes from stronger CPO prices, yield improvement, and operating normalization. This is a commodity-cycle case, not a hidden-ownership case.",
      valuationGate: "Review CPO price deck, yield trend, and margin sensitivity before treating the ticker as investable.",
      allocationFit: "Medium",
      multibaggerFit: "Selective",
      watchItems: ["CPO price volatility", "production trend versus weather risk", "cost inflation on plantations"]
    },
    WIKA: {
      asOf: "25 Apr 2025",
      sourceLabel: "WIKA AGMS 2024 performance press release",
      sourceUrl: "https://www.wika.co.id/en/media-and-information/press-release/wika-decreases-debt-by-idr-44-trillion-throughout-2024-present-to-shareholders-in-the-agms",
      earningsView: "Fragile",
      earningsNote: "Official AGMS release stressed financial strengthening in 2024 and highlighted debt reduction of Rp4.4T, but the core thesis remains a restructuring and balance-sheet repair story rather than a clean compounding case.",
      balanceView: "Restructuring",
      balanceNote: "The company explicitly framed debt repayment and financial recovery as key achievements, which means balance-sheet repair remains central to the case.",
      catalystView: "Turnaround",
      catalystNote: "Potential upside depends on whether operational transformation, project execution, and funding repair restore confidence. The setup is asymmetric, but not low-risk.",
      valuationGate: "Treat as a restructuring-sensitive name. Review liquidity, debt profile, and project execution before treating the equity as investable.",
      allocationFit: "Low",
      multibaggerFit: "Selective",
      watchItems: ["funding and liquidity repair", "margin recovery on projects", "execution of transformation roadmap"]
    },
    SMGR: {
      asOf: "30 Sep 2025",
      sourceLabel: "SIG 9M 2025 results release",
      sourceUrl: "https://www.sig.id/en/efisiensi-dan-kinerja-ekspor-kian-optimal-sig-catatkan-profitabilitas-di-tengah-tantangan-pasar-domestik-1",
      earningsView: "Stable",
      earningsNote: "Official 9M25 release shows sales volume of 27.46 million tons, revenue of Rp25.30T, EBITDA of Rp3.28T, and attributable profit of Rp114.84B amid a still-contracted domestic cement market.",
      balanceView: "Adequate",
      balanceNote: "Inference from official disclosures: the company still has scale and operational flexibility, but pricing pressure in domestic cement keeps the earnings profile from reading like a clean compounder.",
      catalystView: "Cycle",
      catalystNote: "Main upside depends on domestic demand recovery, export optimization, and cost discipline. This is an industry-cycle and execution case, not an ownership anomaly case.",
      valuationGate: "Review domestic cement demand, pricing pressure, and EBITDA resilience before taking exposure.",
      allocationFit: "Medium",
      multibaggerFit: "Low",
      watchItems: ["cement pricing pressure", "domestic demand recovery", "cost-efficiency sustainability"]
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
          { name: "GOVERNMENT OF THE REPUBLIC OF INDONESIA", type: "CP", nat: "L", pct: "53.19%", strategic: true, entityId: "government-of-the-republic-of-indonesia", entityKind: "investor" },
          { name: "DOMESTIC PUBLIC HOLDERS", type: "PF", nat: "L", pct: "10.25%", classificationOverride: "float" },
          { name: "FOREIGN PUBLIC HOLDERS", type: "PF", nat: "F", pct: "36.56%", classificationOverride: "float" }
        ],
        related: [
          { label: "Government of the Republic of Indonesia", kind: "investor", id: "government-of-the-republic-of-indonesia" },
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
          { name: "GOVERNMENT OF THE REPUBLIC OF INDONESIA", type: "CP", nat: "L", pct: "52.09%", strategic: true, entityId: "government-of-the-republic-of-indonesia", entityKind: "investor" },
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
          { label: "Government of the Republic of Indonesia", kind: "investor", id: "government-of-the-republic-of-indonesia" },
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
          { name: "GOVERNMENT OF THE REPUBLIC OF INDONESIA", type: "CP", nat: "L", pct: "0.60%", strategic: true, entityId: "government-of-the-republic-of-indonesia", entityKind: "investor" },
          { name: "PT DANANTARA ASSET MANAGEMENT", type: "CP", nat: "L", pct: "59.40%", strategic: true, entityId: "pt-danantara-asset-management", entityKind: "investor" },
          { name: "DOMESTIC PUBLIC HOLDERS", type: "PF", nat: "L", pct: "16.88%", classificationOverride: "float" },
          { name: "FOREIGN HOLDERS", type: "PF", nat: "F", pct: "23.12%", classificationOverride: "float" }
        ],
        related: [
          { label: "Government of the Republic of Indonesia", kind: "investor", id: "government-of-the-republic-of-indonesia" },
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
      KLBF: {
        kind: "ticker",
        id: "KLBF",
        name: "Kalbe Farma Tbk",
        sector: "Healthcare",
        related: [],
        holderTable: [
          { name: "PT LADANG IRA PANEN", type: "CP", nat: "L", pct: "10.46%", strategic: true },
          { name: "PT GIRA SOLE PRIMA", type: "CP", nat: "L", pct: "10.29%", strategic: true },
          { name: "PT SANTA SEHA SANADI", type: "CP", nat: "L", pct: "10.07%", strategic: true },
          { name: "PT DIPTANALA BAHANA", type: "CP", nat: "L", pct: "9.50%", strategic: true },
          { name: "PT LUCASTA MURNI CEMERLANG", type: "CP", nat: "L", pct: "9.47%", strategic: true },
          { name: "PT BINA ARTA CHARISMA", type: "CP", nat: "L", pct: "8.20%", strategic: true },
          { name: "TREASURY SHARES", type: "OT", nat: "L", pct: "2.62%", strategic: true },
          { name: "PUBLIC (EACH BELOW 5%)", type: "MF", nat: "", pct: "39.39%", classificationOverride: "float" }
        ]
      },
      UNTR: {
        kind: "ticker",
        id: "UNTR",
        name: "United Tractors Tbk",
        sector: "Industrial",
        related: [
          { label: "PT Astra International Tbk", kind: "investor", id: "pt-astra-international-tbk" }
        ],
        holderTable: [
          { name: "PT ASTRA INTERNATIONAL TBK", type: "CP", nat: "L", pct: "59.50%", strategic: true, entityId: "pt-astra-international-tbk", entityKind: "investor" },
          { name: "BOARD OF DIRECTORS", type: "ID", nat: "L", pct: "0.02%", strategic: true, insider: true },
          { name: "TREASURY SHARES", type: "OT", nat: "L", pct: "4.11%", strategic: true },
          { name: "PUBLIC, EXCLUDING DIRECTORS (BELOW 5% EACH)", type: "MF", nat: "", pct: "36.37%", classificationOverride: "float" }
        ]
      },
      JSMR: {
        kind: "ticker",
        id: "JSMR",
        name: "Jasa Marga Tbk",
        sector: "Infrastructure",
        related: [
          { label: "Government of the Republic of Indonesia", kind: "investor", id: "government-of-the-republic-of-indonesia" },
          { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan" },
          { label: "Employees Provident Fund Board", kind: "investor", id: "employees-provident-fund-board" }
        ],
        holderTable: [
          { name: "GOVERNMENT OF THE REPUBLIC OF INDONESIA", type: "CP", nat: "L", pct: "70.00%", strategic: true, entityId: "government-of-the-republic-of-indonesia", entityKind: "investor" },
          { name: "BPJS KETENAGAKERJAAN - JHT", type: "PF", nat: "L", pct: "3.41%", classificationOverride: "float", entityId: "bpjs-ketenagakerjaan", entityKind: "investor" },
          { name: "EMPLOYEES PROVIDENT FUND BOARD", type: "PF", nat: "F", pct: "2.31%", classificationOverride: "float", entityId: "employees-provident-fund-board", entityKind: "investor" },
          { name: "PT TASPEN (PERSERO)", type: "PF", nat: "L", pct: "2.20%", classificationOverride: "float", entityId: "pt-taspen-persero", entityKind: "investor" },
          { name: "PUBLIC (EACH BELOW 2%)", type: "MF", nat: "", pct: "22.08%", classificationOverride: "float" }
        ]
      },
      INDF: {
        kind: "ticker",
        id: "INDF",
        name: "Indofood Sukses Makmur Tbk",
        sector: "Consumer Staples",
        marketCap: 0,
        dailyChange: 0,
        eyebrow: "Ticker detail",
        summary: "Food holding company with a controlling First Pacific block and a still-deep public float. The research angle is not whether control exists, but how resilient the operating stack remains across consumer cycles and commodity swings.",
        tags: ["Consumer Staples", "Strategic Parent", "Large Cap"],
        metrics: [
          { label: "Market Cap", value: "N/A" },
          { label: "Free Float", value: "49.91%" },
          { label: "Strategic Held", value: "50.09%" },
          { label: "Visible Held", value: "100%" },
          { label: "Ownership Source", value: "16 Mar 2026 retrieval" }
        ],
        localForeign: null,
        summaryPoints: [
          "First Pacific still anchors effective strategic control, but the public float remains large enough to matter for liquidity and institutional participation.",
          "Indofood is useful because it combines strategic control with a multi-segment consumer earnings engine rather than a pure cyclical single-asset story.",
          "Cross-reading INDF with ICBP helps separate holding-company control from subsidiary operating quality."
        ],
        holderTable: [
          { name: "FIRST PACIFIC INVESTMENT MANAGEMENT LIMITED", type: "CP", nat: "F", pct: "50.07%", strategic: true, entityId: "first-pacific-investment-management-limited", entityKind: "investor" },
          { name: "ANTHONI SALIM", type: "ID", nat: "L", pct: "0.02%", strategic: true, insider: true },
          { name: "PUBLIC (EACH BELOW 5%)", type: "MF", nat: "", pct: "49.91%", classificationOverride: "float" }
        ],
        related: [
          { label: "First Pacific Investment Management Limited", kind: "investor", id: "first-pacific-investment-management-limited" },
          { label: "ICBP", kind: "ticker", id: "ICBP" }
        ]
      },
      ICBP: {
        kind: "ticker",
        id: "ICBP",
        name: "Indofood CBP Sukses Makmur Tbk",
        sector: "Consumer Staples",
        marketCap: 0,
        dailyChange: 0,
        eyebrow: "Ticker detail",
        summary: "Staples operating company controlled by Indofood. The ownership structure is extremely clean: one strategic parent block and one broad public float bucket.",
        tags: ["Consumer Staples", "Strategic Parent", "Operating Subsidiary"],
        metrics: [
          { label: "Market Cap", value: "N/A" },
          { label: "Free Float", value: "19.47%" },
          { label: "Strategic Held", value: "80.53%" },
          { label: "Visible Held", value: "100%" },
          { label: "Ownership Source", value: "16 Mar 2026 retrieval" }
        ],
        localForeign: null,
        summaryPoints: [
          "ICBP is analytically useful because the ownership structure is unusually simple and easy to audit from the issuer page.",
          "The main investment question here shifts from ownership ambiguity to earnings durability, FX sensitivity, and entry valuation.",
          "Linking ICBP back to INDF helps distinguish operating-company quality from parent-level capital-allocation questions."
        ],
        holderTable: [
          { name: "PT INDOFOOD SUKSES MAKMUR TBK", type: "CP", nat: "L", pct: "80.53%", strategic: true, entityId: "pt-indofood-sukses-makmur-tbk", entityKind: "investor" },
          { name: "PUBLIC (EACH BELOW 5%)", type: "MF", nat: "", pct: "19.47%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Indofood Sukses Makmur Tbk", kind: "investor", id: "pt-indofood-sukses-makmur-tbk" },
          { label: "INDF", kind: "ticker", id: "INDF" }
        ]
      },
      WTON: {
        kind: "ticker",
        id: "WTON",
        name: "Wijaya Karya Beton Tbk",
        sector: "Infrastructure",
        marketCap: 0,
        dailyChange: 0,
        eyebrow: "Ticker detail",
        summary: "Concrete and precast subsidiary of WIKA with a clear parent block and a meaningful affiliated-holder layer. The main research issue is execution quality, not ownership ambiguity.",
        tags: ["Infrastructure", "Strategic Parent", "Project Execution"],
        metrics: [
          { label: "Market Cap", value: "N/A" },
          { label: "Free Float", value: "34.22%" },
          { label: "Strategic Held", value: "65.78%" },
          { label: "Visible Held", value: "99.80%" },
          { label: "Ownership Source", value: "31 Dec 2024 annual report" }
        ],
        localForeign: null,
        summaryPoints: [
          "WTON is a clean example of a listed subsidiary where the strategic parent remains obvious and affiliated internal vehicles are still visible in the holder table.",
          "The ownership picture is readable enough; the harder investment question sits in margin recovery and project cash conversion.",
          "Together with WEGE, WTON creates a true recurring-holder scenario for PT Wijaya Karya (Persero) Tbk."
        ],
        holderTable: [
          { name: "PT WIJAYA KARYA (PERSERO) TBK", type: "CP", nat: "L", pct: "60.00%", strategic: true, entityId: "pt-wijaya-karya-persero-tbk", entityKind: "investor" },
          { name: "KOPERASI KARYA MITRA SATYA", type: "OT", nat: "L", pct: "4.59%", strategic: true, entityId: "koperasi-karya-mitra-satya", entityKind: "investor" },
          { name: "YAYASAN WIJAYA KARYA", type: "FD", nat: "L", pct: "0.99%", strategic: true, entityId: "yayasan-wijaya-karya", entityKind: "investor" },
          { name: "BOARD AND MANAGEMENT", type: "ID", nat: "L", pct: "0.20%", strategic: true, insider: true },
          { name: "PUBLIC HOLDERS", type: "MF", nat: "", pct: "34.22%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Wijaya Karya (Persero) Tbk", kind: "investor", id: "pt-wijaya-karya-persero-tbk" },
          { label: "WEGE", kind: "ticker", id: "WEGE" }
        ]
      },
      WEGE: {
        kind: "ticker",
        id: "WEGE",
        name: "Wijaya Karya Bangunan Gedung Tbk",
        sector: "Infrastructure",
        marketCap: 0,
        dailyChange: 0,
        eyebrow: "Ticker detail",
        summary: "Building-construction subsidiary of WIKA with a simple strategic holder stack. The equity story is operational leverage and margin repair, not hidden control analysis.",
        tags: ["Infrastructure", "Strategic Parent", "Contractor"],
        metrics: [
          { label: "Market Cap", value: "N/A" },
          { label: "Free Float", value: "30%" },
          { label: "Strategic Held", value: "70%" },
          { label: "Visible Held", value: "100%" },
          { label: "Ownership Source", value: "31 Dec 2024 annual report" }
        ],
        localForeign: null,
        summaryPoints: [
          "WEGE is ownership-clean: one dominant parent, one small affiliated cooperative block, and a broad public float remainder.",
          "That makes it useful for comparing execution risk versus ownership risk inside the same WIKA group ecosystem.",
          "Cross-reading WEGE and WTON creates a more meaningful WIKA-family network than a single ticker could on its own."
        ],
        holderTable: [
          { name: "PT WIJAYA KARYA (PERSERO) TBK", type: "CP", nat: "L", pct: "69.30%", strategic: true, entityId: "pt-wijaya-karya-persero-tbk", entityKind: "investor" },
          { name: "KOPERASI KARYAWAN WIKA", type: "OT", nat: "L", pct: "0.70%", strategic: true, entityId: "koperasi-karyawan-wika", entityKind: "investor" },
          { name: "PUBLIC HOLDERS", type: "MF", nat: "", pct: "30.00%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Wijaya Karya (Persero) Tbk", kind: "investor", id: "pt-wijaya-karya-persero-tbk" },
          { label: "WTON", kind: "ticker", id: "WTON" }
        ]
      },
      AUTO: {
        kind: "ticker",
        id: "AUTO",
        name: "Astra Otoparts Tbk",
        sector: "Industrial",
        marketCap: 0,
        dailyChange: 0,
        eyebrow: "Ticker detail",
        summary: "Auto-parts subsidiary under Astra with an exceptionally simple ownership stack. The key issue is business-cycle quality, not ownership ambiguity.",
        tags: ["Industrial", "Strategic Parent", "Aftermarket"],
        metrics: [
          { label: "Market Cap", value: "N/A" },
          { label: "Free Float", value: "20%" },
          { label: "Strategic Held", value: "80%" },
          { label: "Visible Held", value: "100%" },
          { label: "Ownership Source", value: "31 Dec 2024 annual report" }
        ],
        localForeign: null,
        summaryPoints: [
          "AUTO is ownership-clean: one dominant strategic parent and one broad public float bucket.",
          "That makes it useful for isolating business quality and valuation from ownership-noise questions.",
          "Together with UNTR and AALI, AUTO materially deepens the Astra-related investor network."
        ],
        holderTable: [
          { name: "PT ASTRA INTERNATIONAL TBK", type: "CP", nat: "L", pct: "80.00%", strategic: true, entityId: "pt-astra-international-tbk", entityKind: "investor" },
          { name: "PUBLIC HOLDERS", type: "MF", nat: "", pct: "20.00%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Astra International Tbk", kind: "investor", id: "pt-astra-international-tbk" },
          { label: "UNTR", kind: "ticker", id: "UNTR" },
          { label: "AALI", kind: "ticker", id: "AALI" }
        ]
      },
      AALI: {
        kind: "ticker",
        id: "AALI",
        name: "Astra Agro Lestari Tbk",
        sector: "Consumer Staples",
        marketCap: 0,
        dailyChange: 0,
        eyebrow: "Ticker detail",
        summary: "Plantation subsidiary under Astra where ownership is straightforward and the real debate sits in commodity cycle and plantation execution.",
        tags: ["Consumer Staples", "Strategic Parent", "Commodity Cycle"],
        metrics: [
          { label: "Market Cap", value: "N/A" },
          { label: "Free Float", value: "20.32%" },
          { label: "Strategic Held", value: "79.68%" },
          { label: "Visible Held", value: "100%" },
          { label: "Ownership Source", value: "31 Dec 2024 annual report" }
        ],
        localForeign: null,
        summaryPoints: [
          "AALI is another Astra-controlled subsidiary with a clean parent block and a broad public remainder.",
          "That means ownership analysis is mostly settled; the harder work is cycle timing, yields, and margin sensitivity to CPO prices.",
          "Adding AALI helps turn Astra-related overlap from a thin node into a more meaningful family cluster."
        ],
        holderTable: [
          { name: "PT ASTRA INTERNATIONAL TBK", type: "CP", nat: "L", pct: "79.68%", strategic: true, entityId: "pt-astra-international-tbk", entityKind: "investor" },
          { name: "PUBLIC HOLDERS", type: "MF", nat: "", pct: "20.32%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Astra International Tbk", kind: "investor", id: "pt-astra-international-tbk" },
          { label: "AUTO", kind: "ticker", id: "AUTO" },
          { label: "UNTR", kind: "ticker", id: "UNTR" }
        ]
      },
      WIKA: {
        kind: "ticker",
        id: "WIKA",
        name: "Wijaya Karya Persero Tbk",
        sector: "Infrastructure",
        marketCap: 0,
        dailyChange: 0,
        eyebrow: "Ticker detail",
        summary: "Parent contractor under the Danantara-linked state ecosystem with a very tight float profile. The main issue is financial recovery and project execution, not hidden-holder interpretation.",
        tags: ["Infrastructure", "State-linked", "Turnaround"],
        metrics: [
          { label: "Market Cap", value: "N/A" },
          { label: "Free Float", value: "8.98%" },
          { label: "Strategic Held", value: "91.02%" },
          { label: "Visible Held", value: "100%" },
          { label: "Ownership Source", value: "25 Jun 2025 presentation" }
        ],
        localForeign: [
          { name: "Local", value: 98.6 },
          { name: "Foreign", value: 1.4 }
        ],
        summaryPoints: [
          "WIKA now reads as a very tightly controlled Danantara-linked name rather than a broad state-float contractor.",
          "That makes the ownership question relatively simple; the harder work is whether financial and operational repair can durably improve the equity case.",
          "Adding WIKA also makes the WIKA-family structure more legible because the parent can now be inspected beside WTON and WEGE."
        ],
        holderTable: [
          { name: "PT DANANTARA ASSET MANAGEMENT", type: "CP", nat: "L", pct: "91.02%", strategic: true, entityId: "pt-danantara-asset-management", entityKind: "investor" },
          { name: "LOCAL PUBLIC HOLDERS", type: "PF", nat: "L", pct: "7.58%", classificationOverride: "float" },
          { name: "FOREIGN PUBLIC HOLDERS", type: "PF", nat: "F", pct: "1.40%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management" },
          { label: "WTON", kind: "ticker", id: "WTON" },
          { label: "WEGE", kind: "ticker", id: "WEGE" }
        ]
      },
      SMGR: {
        kind: "ticker",
        id: "SMGR",
        name: "Semen Indonesia Persero Tbk",
        sector: "Materials",
        marketCap: 0,
        dailyChange: 0,
        eyebrow: "Ticker detail",
        summary: "National cement leader with a strategic state-linked block and still-large public float. Ownership is readable; the harder question is industry-cycle recovery in a competitive domestic market.",
        tags: ["Materials", "State-linked", "Industry Cycle"],
        metrics: [
          { label: "Market Cap", value: "N/A" },
          { label: "Free Float", value: "48.60%" },
          { label: "Strategic Held", value: "51.40%" },
          { label: "Visible Held", value: "100%" },
          { label: "Ownership Source", value: "31 Oct 2025 info memo" }
        ],
        localForeign: null,
        summaryPoints: [
          "SMGR is not a float-squeeze case. The ownership structure is balanced enough that the key work shifts to industry dynamics and operating discipline.",
          "The updated holder table matters because the strategic block is shown under PT Biro Klasifikasi Indonesia (Persero), not the older direct government label.",
          "That makes SMGR useful for tracking how state-linked ownership can be mediated through a holding or special-purpose strategic vehicle."
        ],
        holderTable: [
          { name: "PT BIRO KLASIFIKASI INDONESIA (PERSERO)", type: "CP", nat: "L", pct: "51.20%", strategic: true, entityId: "pt-biro-klasifikasi-indonesia-persero", entityKind: "investor" },
          { name: "TREASURY STOCK", type: "OT", nat: "L", pct: "0.20%", strategic: true },
          { name: "PUBLIC HOLDERS", type: "MF", nat: "", pct: "48.60%", classificationOverride: "float" }
        ],
        related: [
          { label: "PT Biro Klasifikasi Indonesia (Persero)", kind: "investor", id: "pt-biro-klasifikasi-indonesia-persero" }
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
      "government-of-the-republic-of-indonesia": { kind: "investor", id: "government-of-the-republic-of-indonesia", name: "Government of the Republic of Indonesia" },
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
      "pt-astra-international-tbk": { kind: "investor", id: "pt-astra-international-tbk", name: "PT Astra International Tbk" },
      "pt-taspen-persero": { kind: "investor", id: "pt-taspen-persero", name: "PT Taspen (Persero)" },
      "first-pacific-investment-management-limited": { kind: "investor", id: "first-pacific-investment-management-limited", name: "First Pacific Investment Management Limited" },
      "pt-indofood-sukses-makmur-tbk": { kind: "investor", id: "pt-indofood-sukses-makmur-tbk", name: "PT Indofood Sukses Makmur Tbk" },
      "pt-wijaya-karya-persero-tbk": { kind: "investor", id: "pt-wijaya-karya-persero-tbk", name: "PT Wijaya Karya (Persero) Tbk" },
      "koperasi-karya-mitra-satya": { kind: "investor", id: "koperasi-karya-mitra-satya", name: "Koperasi Karya Mitra Satya" },
      "yayasan-wijaya-karya": { kind: "investor", id: "yayasan-wijaya-karya", name: "Yayasan Wijaya Karya" },
      "koperasi-karyawan-wika": { kind: "investor", id: "koperasi-karyawan-wika", name: "Koperasi Karyawan WIKA" },
      "pt-biro-klasifikasi-indonesia-persero": { kind: "investor", id: "pt-biro-klasifikasi-indonesia-persero", name: "PT Biro Klasifikasi Indonesia (Persero)" },
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
    { label: "KLBF", kind: "ticker", id: "KLBF", subtitle: "Kalbe Farma Tbk" },
    { label: "UNTR", kind: "ticker", id: "UNTR", subtitle: "United Tractors Tbk" },
    { label: "JSMR", kind: "ticker", id: "JSMR", subtitle: "Jasa Marga Tbk" },
    { label: "INDF", kind: "ticker", id: "INDF", subtitle: "Indofood Sukses Makmur Tbk" },
    { label: "ICBP", kind: "ticker", id: "ICBP", subtitle: "Indofood CBP Sukses Makmur Tbk" },
    { label: "WTON", kind: "ticker", id: "WTON", subtitle: "Wijaya Karya Beton Tbk" },
    { label: "WEGE", kind: "ticker", id: "WEGE", subtitle: "Wijaya Karya Bangunan Gedung Tbk" },
    { label: "AUTO", kind: "ticker", id: "AUTO", subtitle: "Astra Otoparts Tbk" },
    { label: "AALI", kind: "ticker", id: "AALI", subtitle: "Astra Agro Lestari Tbk" },
    { label: "WIKA", kind: "ticker", id: "WIKA", subtitle: "Wijaya Karya Persero Tbk" },
    { label: "SMGR", kind: "ticker", id: "SMGR", subtitle: "Semen Indonesia Persero Tbk" },
    { label: "PT Danantara Asset Management", kind: "investor", id: "pt-danantara-asset-management", subtitle: "State-linked strategic holder", aliases: ["PT DANANTARA ASSET MANAGEMENT", "DANANTARA"] },
    { label: "BPJS Ketenagakerjaan", kind: "investor", id: "bpjs-ketenagakerjaan", subtitle: "Local pension-style holder", aliases: ["BPJS KETENAGAKERJAAN"] },
    { label: "Government of the Republic of Indonesia", kind: "investor", id: "government-of-the-republic-of-indonesia", subtitle: "Strategic state holder", aliases: ["GOVERNMENT OF THE REPUBLIC OF INDONESIA", "PEMERINTAH REPUBLIK INDONESIA"] },
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
    { label: "PT Astra International Tbk", kind: "investor", id: "pt-astra-international-tbk", subtitle: "Strategic parent holder", aliases: ["PT ASTRA INTERNATIONAL TBK", "ASTRA INTERNATIONAL"] },
    { label: "PT Taspen (Persero)", kind: "investor", id: "pt-taspen-persero", subtitle: "Domestic pension holder", aliases: ["PT TASPEN (PERSERO)", "TASPEN"] },
    { label: "First Pacific Investment Management Limited", kind: "investor", id: "first-pacific-investment-management-limited", subtitle: "Strategic parent holder", aliases: ["FIRST PACIFIC INVESTMENT MANAGEMENT LIMITED", "FIRST PACIFIC"] },
    { label: "PT Indofood Sukses Makmur Tbk", kind: "investor", id: "pt-indofood-sukses-makmur-tbk", subtitle: "Strategic parent holder", aliases: ["PT INDOFOOD SUKSES MAKMUR TBK", "INDOFOOD SUKSES MAKMUR"] },
    { label: "PT Wijaya Karya (Persero) Tbk", kind: "investor", id: "pt-wijaya-karya-persero-tbk", subtitle: "Strategic parent holder", aliases: ["PT WIJAYA KARYA (PERSERO) TBK", "WIJAYA KARYA", "WIKA"] },
    { label: "Koperasi Karya Mitra Satya", kind: "investor", id: "koperasi-karya-mitra-satya", subtitle: "Affiliated cooperative holder", aliases: ["KOPERASI KARYA MITRA SATYA"] },
    { label: "Yayasan Wijaya Karya", kind: "investor", id: "yayasan-wijaya-karya", subtitle: "Affiliated foundation holder", aliases: ["YAYASAN WIJAYA KARYA"] },
    { label: "Koperasi Karyawan WIKA", kind: "investor", id: "koperasi-karyawan-wika", subtitle: "Affiliated cooperative holder", aliases: ["KOPERASI KARYAWAN WIKA"] },
    { label: "PT Biro Klasifikasi Indonesia (Persero)", kind: "investor", id: "pt-biro-klasifikasi-indonesia-persero", subtitle: "Strategic state-linked holder", aliases: ["PT BIRO KLASIFIKASI INDONESIA (PERSERO)", "BKI"] },
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
    "KLBF",
    "UNTR",
    "JSMR",
    "INDF",
    "ICBP",
    "WTON",
    "WEGE",
    "AUTO",
    "AALI",
    "WIKA",
    "SMGR",
    "PT Danantara Asset Management",
    "BPJS Ketenagakerjaan",
    "Government of the Republic of Indonesia",
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
    "PT Astra International Tbk",
    "First Pacific Investment Management Limited",
    "PT Indofood Sukses Makmur Tbk",
    "PT Wijaya Karya (Persero) Tbk",
    "Koperasi Karya Mitra Satya",
    "Yayasan Wijaya Karya",
    "Koperasi Karyawan WIKA",
    "PT Biro Klasifikasi Indonesia (Persero)",
    "PT Taspen (Persero)",
    "SEB AB Luxembourg Branch A/C Clients",
    "Pertamina",
    "Panin Sekuritas",
    "Vale Canada Limited",
    "Sumitomo Metal Mining Co. Ltd."
  ]
};
