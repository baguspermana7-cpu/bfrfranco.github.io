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
| `data-rz-figure` — built by the figure tool | 11 (4, 6, 8, 10, 12, 17, 18, 19, 21, 22, 26, 27) |

**Eight articles carried no visual of any kind at the start**: 1, 2, 3, 6, 8, 10, 15, 17.
Four of them now do (6, 8, 10, 17); the other four are closed with a reason below.

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

### Built — the complete set

| Article | Figure | What it adds that the prose cannot |
|---|---|---|
| 4 | `method-montecarlo` | The page reports a Monte Carlo result and a ranked list without the path between them. Lost: that the output is a distribution, and that the ranking is derived rather than authored. |
| 6, 8 | `method-assessment` | One definition, two pages. The model is used twice — how uncertain, and what it turns on — and a single reported score hides that either question was asked. |
| 10 | `cooling-water-loop` | §8.1 says to raise the cycles of concentration to cut blowdown. That assumes a loop the article never draws, and "blowdown" means nothing to a reader who does not know it is deliberate. |
| 12 | `tariff-gap` | Two prices in separate sentences and the fillers in a third place. The gap is the argument, and a gap is a distance to be seen, not a subtraction to be performed. |
| 17 | `jevons-loop` | A table lists three efficiency factors as independent rows. It cannot show that the output returns to the input — and a cycle drawn as a list reads as unrelated savings, the exact misreading the section corrects. |
| 18 | `heat-path-ceilings` | Two tables, density and cooling ceilings, never connected. The connection is the argument: the trajectory crossed the air ceiling, so the path changed shape. |
| 19 | `corridor-model` | The answer is neither site but a corridor across both. A reader comparing two columns of costs has to be shown the comparison was the wrong frame. |
| 21 | `smr-cost-chain` | The overrun is a table, the hyperscaler difference a list of contract terms. Between them is a causal chain that makes a 20-year PPA legible as a replacement for one link. |
| 22 | `cpo-trace-collapse` | The table gives both trace lengths as numbers. The argument is geometry — the retimers exist only to pay for the distance. Drawn at the real 24:1. |
| 26 | `pfas-loss-zones` | The table enumerates seven loss zones. It cannot show that the escape routes bypass the meter. |
| 27 | `three-levers` | The finding — only Create adds supply — is a fourth column nobody reads against the others. Drawn, two of three arrows never reach the pool. |

### Closed with no figure, and why

| Article | Verdict |
|---|---|
| 1 | Scores dimensions but runs **no Monte Carlo**. The shared method figure describes a pipeline this page does not have. Excluded on reading its code, not on how it looks. |
| 11 | Argues the same structure as 12 from the opposite side. Its content is comparison tables and cited figures, which its existing chart serves. A both-sides figure would also misrepresent an article that deliberately argues one side. |
| 20 | Claim against measurement — Microsoft 4.7 to 6.4 billion litres, Google +20 %. Quantities, not structure. Table or chart. |
| 24 | Growth by trade: HVAC +67 %, robotic technician +107 %, electrician +18 %. A quantitative comparison. Chart. |
| 28 | Four charts already, and the argument is two limits. Charts are the right instrument. |
| 9, 13, 25 | Living diagrams already carry it. 25 nearly received a duplicate of its own 6 GW animation. |
| 16, 23 | Scrollytelling already carries the narrative visually. |
| 2, 3, 5, 7, 14, 15 | Calculator pages whose commentary does not explain the instrument; nothing structural to draw. |

**Eleven figures across eleven articles. Fourteen articles closed with a reason.**
Every verdict against building was recorded before the work stopped, so a later reader
can tell a considered "no" from an unfinished list.

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
