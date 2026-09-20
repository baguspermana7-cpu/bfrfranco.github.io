# Article figure audit

> Every article in the corpus, what it already has, and whether it needs an explanatory
> figure. Opened 2026-09-21.

The rule that decides every verdict, from the diagram-design skill:

> **Would the reader learn more from this than from a well-written paragraph?**
> If the article already answers the question in a table, a chart or a sentence, a figure
> that restates it is noise.

A figure earns its place only by showing something the prose **cannot**: a shape, a
topology, a proportion, a boundary. Each built figure records that reason as a `because`
in `tools/build-article-diagrams.mjs`.

---

## 1. What the corpus actually has

The first survey of this corpus was wrong, and the error is worth recording. Counting
`<svg>` per article returns 19–52, which looks like a corpus rich in diagrams. Almost all
of it is interface: share buttons, nav chevrons, icon glyphs. Counting only SVGs with a
viewBox wider or taller than 200 units gives the real figure.

| Visual asset | Articles carrying it |
|---|---|
| `data-rz-chart` — sourced interactive chart | 17 |
| large inline SVG (a real figure of some kind) | 13 |
| `data-rz-diagram` — living animated diagram | 3 (9, 13, 25) |
| `data-rz-scrolly` — pinned scrollytelling | 2 (16, 23) |
| `data-rz-figure` — built by the figure tool | 3 (18, 22, 26) |

**Eight articles carry no visual of any kind**: 1, 2, 3, 6, 8, 10, 15, 17.

---

## 2. Two families, two different needs

**Narrative articles** (9–12, 16–28) argue a case across numbered sections. These are where
a structural figure pays: the argument usually has a shape, and prose describes shapes
badly.

**Calculator articles** (1–8, 13–15) are assessment instruments — Monte Carlo, dimension
scores, KPI panels — wrapped in commentary. They rarely need a figure of their subject.
What several of them *do* need is one figure of the **method**: what the model takes in,
what it simulates, and what the score means. That is a single reusable figure, not eleven.

---

## 3. Verdicts

### Built

| Article | Figure | What it adds that the prose cannot |
|---|---|---|
| 18 | `heat-path-ceilings` | Two tables give density by platform and ceilings by cooling technology, and neither connects them. The connection is the argument: the trajectory crossed the air ceiling, so the heat path changed **shape**. |
| 22 | `cpo-trace-collapse` | The table lists both trace lengths as numbers. The argument is **geometry** — the retimers exist only to pay for the distance. Drawn to the real 24:1 ratio. |
| 26 | `pfas-loss-zones` | The table enumerates seven loss zones with magnitudes. It cannot show that the escape routes **bypass the meter**, which is the section's point. |

### Do not add — the article already has it

| Article | Why not |
|---|---|
| 25 | A living diagram already animates the 6 GW gap opening between retirements and the interconnection queue. A static figure of the same content is duplication. |
| 9 | Living diagram of the HVAC fault path. |
| 13 | Living diagram plus three figures already. |
| 16, 23 | Scrollytelling already carries the narrative visually. |
| 28 | Four charts, and the argument is quantitative — two walls expressed as limits. Charts are the right instrument; see §4. |

### Priority queue — narrative articles with a shape and no figure

| Article | Subject | The figure would show |
|---|---|---|
| **10** | Water stress and AI data centers | Where the water actually goes: withdrawal vs consumption, on-site vs the power plant upstream. The distinction the whole debate turns on, and the article has no visual at all. |
| **17** | The $37 B SEA opportunity | Jevons paradox as a loop: efficiency lowers cost per token, which raises demand. A reinforcing cycle is a shape prose states badly and a loop diagram states once. |
| **19** | Singapore vs Batam | The 20-kilometre paradox — a boundary 20 km apart changing the cost structure. A decision matrix is a table; the *corridor model* is not. |
| **21** | Nuclear SMRs | The grid-interconnection timeline against the SMR delivery timeline — why the dates do not meet. |
| **24, 27** | Workforce | The three levers (create, substitute, extend) against the 2026 cliff. |
| **11, 12** | Who pays for new load | Cost allocation as a flow: who bears which cost, and where the subsidy actually lands. Both articles argue the same structure from opposite sides. |
| **20** | Altman vs the water data | Claim against measurement, three claims side by side. Possibly a table instead — decide when read. |

### Calculator family

One shared **method figure** — inputs → deterministic model → Monte Carlo → score — placed
in the articles whose commentary explains the instrument (1, 4, 6, 8 are the candidates).
Not eleven copies: one definition, placed where it earns its place.

---

## 4. When a chart is the right answer instead

The figure tool draws **structure**: topology, boundary, sequence, containment. It is the
wrong instrument for a quantity over time or a distribution, and reaching for it there
produces a diagram pretending to be a chart.

Article 18 is the clearest case. Its density trajectory — 5 kW in 2015 to roughly 600 kW at
Rubin Ultra — crossing the cooling ceilings is a genuinely diagrammatic *insight*, but its
natural form is a line against thresholds, which is `js/rz-article-chart.js` and the
dataviz guidance, not this tool. The figure built for article 18 deliberately takes the
structural half of that story (the path changes shape) and leaves the quantitative half to
a chart.

---

## Related

- `standarization/DIAGRAM_ENGINE_STANDARD.md` — what the engine guarantees, the token
  contract, and why geometry is not composition
- `tools/build-article-diagrams.mjs` — the figure definitions, each with its `because`
- `standarization/ARTICLE_DATAVIZ_STANDARD.md` — charts, and their provenance gate
