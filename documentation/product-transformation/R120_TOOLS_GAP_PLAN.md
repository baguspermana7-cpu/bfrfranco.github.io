# R120 — better than the reference, tool by tool (plan, 2026-11-11)

Owner: "yg lebih bagus daripada original code github pidnya. Yg dcmoc dan tools2 lain juga. Harus lebih bagus 100x
lipat. Cari gap code aslinya dan improve."

"100x" is not measurable; the plan turns it into checkable claims. For every tool: name ONE public reference whose
method and numbers can be read (open code, an open model, or a published calculator with its documented method),
list its capabilities, mark what RZ lacks (parity gap) and what RZ can add that the reference cannot (beyond), and
prove each closed gap red → green. A reference we cannot read is not a reference.

## Method (same for every tool)

1. Reference read: method, inputs, outputs, worked examples, licence. Recorded in `documentation/product-transformation/
   gaps/<tool>.md` with URL and date.
2. Capability matrix: capability · reference · RZ today · gap kind (parity / beyond / RZ already ahead).
3. Parity first: the reference's worked examples become RZ test fixtures; RZ must reproduce them within a stated
   tolerance or explain the difference by a cited assumption.
4. Beyond: only additions a reader uses (explain the result, show the cause, what-if, failure impact, provenance,
   phone layout). Each with a gate law.
5. Report to the owner: the matrix + screenshots before any live change on a tool page.

## Tools and candidate references (to confirm in step 1)

| Tool | Candidate reference (readable) | First parity check |
|---|---|---|
| P&ID (`js/rz-pid-*`) | ScottDuncanAI/PID-to-Knowledge-Graph (MIT) | off-page pairing + QA report on its fixture (R120 agent, in progress) |
| DCMOC CAPEX/OPEX/TCO | NREL Annual Technology Baseline method; LBNL/ENERGY STAR data-center calculators; Schneider Electric TradeOff Tools published method notes (WP 52/WP 6) | reproduce a published worked example per module |
| DCMOC reliability / Monte Carlo | IEEE 493 (Gold Book) availability method; open RBD libraries (e.g. `reliability` Python package, MIT) | series/parallel/k-of-n availability on the package's examples |
| PUE calculator | The Green Grid PUE/pPUE method (WP 49), ISO/IEC 30134-2 | category-1/2/3 measurement-point examples |
| CDU calculator | ASHRAE TC 9.9 liquid-cooling guidance; OCP ACS cold-plate requirements | flow/ΔT/approach examples (balance already gated in R117) |
| Fire calculator | NFPA 2001 Annex / ISO 14520 design-concentration equations | agent quantity examples from the standard's annex |
| Spares readiness | MIL-HDBK-338B / Poisson spares formula | spares-to-target-fill-rate examples |
| Cx calculator | ASHRAE Guideline 0 / 1.1 process; BCxA templates | phase/level coverage, not numbers |
| ROI / carbon | GHG Protocol Scope 2 guidance (location vs market based) | grid-factor examples |

## Order

1. P&ID (running). 2. DCMOC reliability + CAPEX (largest user surface). 3. PUE + CDU. 4. Fire + spares. 5. ROI/carbon,
Cx. One tool per release; each ships with its gap file, its fixtures and its gate.

## Laws (every tool)

- G1 the reference's worked examples pass as fixtures (count stated per tool).
- G2 every RZ number on the tool carries a provenance kind (RZProvenance) and a source.
- G3 each "beyond" feature has a test that fails on the tool without it.
- G4 390 px: no sideways scroll; both themes; axe 0 serious.
