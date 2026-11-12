# R120 gap file — DCMOC reliability and availability (2026-11-12)

Plan: `documentation/product-transformation/R120_TOOLS_GAP_PLAN.md`, tool 2 of the order. Gate:
`tools/test-reliability-reference.mjs`.

## Reference

The reference is the NIST/SEMATECH e-Handbook of Statistical Methods, §8.1.8.2 (series model), §8.1.8.3 (parallel
model) and §8.1.8.4 (r out of n model). It is a US government work in the public domain:

- https://www.itl.nist.gov/div898/handbook/apr/section1/apr182.htm
- https://www.itl.nist.gov/div898/handbook/apr/section1/apr184.htm

Read 2026-11-12. The reference gives these formulas:

- Series: R_S = Π R_i
- r out of n, identical components: R_S = Σ_{i=r..n} C(n,i) R^i (1−R)^(n−i)
- r = n gives the series model, and r = 1 gives the parallel model.

## Capability matrix

| Capability | Reference | RZ today | Kind |
|---|---|---|---|
| A = MTBF/(MTBF+MTTR) | standard | `rz-engine.js` models.reliability.availability | parity |
| Series | §8.1.8.2 | models.reliability.seriesAvailability; DCMOC `availabilityChain.ts` `ser` | parity (F1) |
| Parallel 1 of n | §8.1.8.3 | models.reliability.parallelAvailability; `availabilityChain.ts` `par` | parity (F2) |
| r out of n | §8.1.8.4 | models.reliability.kOutOfN (engine v2.5.0) | parity (F3, F4) |
| Redundancy label to model in the **headline** | — | DATA.reliability.redundancyPaths `{n:1, n1:2, '2n':2, '2n1':3}`, used by systemAvailability and DCMOC `buildSystems`/`ccOverall`. N+1 and 2N both become 1 of 2 | **defect D1, D2** |
| Redundancy what-if row | — | `ReliabilityEnginePage.tsx:150`: N+1 = kOutOfN(a,k,k+1), which is right; 2N = kOutOfN(a,k,2k), which pools the units of both systems | **defect D3** |
| Common cause | not in reference | `availabilityChain.ts` CC_BETA 5 % blend of the parallel and single-path overall values | RZ ahead (screening; a blend of whole-system values, not a per-group β) |
| Grid availability with backup | — | `GridReliabilityEngine.ts:142-145`: a fixed coverage per tier (0.95/0.99/0.999), capped at 99.999 % | not derived from components |
| No fake 100 % | — | `availabilityChain.ts` fmtAvail | RZ ahead |

The headline number and the what-if row on the same Reliability page use two different N+1 models.

## Fixtures

The engine reproduces every reference formula. The defects come from how the engine maps a redundancy label onto those
formulas.

| # | Case | Expected | RZ | Result |
|---|---|---|---|---|
| F1 | series n=4, R=0.9 | 0.656100 | 0.656100 | pass |
| F2 | parallel n=4, R=0.9 | 0.999900 | 0.999900 | pass |
| F3 | 2 out of 4, R=0.9 | 0.996300 | 0.996300 | pass |
| F4 | r=n is series, r=1 is parallel | equal | equal | pass |
| D1 | headline UPS: N+1 vs 2N | different | both 0.0005 min/yr | fail |
| D2 | headline UPS N+1 with N=4 (4 of 5) | 0.0054 min/yr | 0.0005 min/yr (10× low) | fail |
| D3 | 2N with N=4 as two independent N systems: 1−(1−a⁴)² | 0.008616 min/yr | what-if k of 2k: 0.000000 | fail |

UPS a = 250000/(250000+8), from DATA.reliability.components. Downtime is per group, before common cause.

Proof that the parity laws can fail: when kOutOfN is mutated to use k+1, F3 reads 0.947700 and F4 fails (exit 1).

## What D3 means

2N is two complete systems, each with the N units the load needs (Uptime Institute "System + System"). Counted on
independent unit failures only, two systems of 4 lose service when each system has at least one failed unit, about
(4q)² = 16q². N+1 with 5 units loses service at two failures, about C(5,2)q² = 10q². So 2N is not better than N+1 on
unit failures. Its real gains are concurrent maintenance, independent distribution paths and defence against common
cause. Those belong in the β term and in the path model, not in pooled unit counts. The what-if row shows 2N with
almost zero downtime, which overstates it.

## Owner decision needed (O-R120-REL)

Which model the headline uses for N+1 and 2N:

- **(a) Recommended:** N+1 is k of k+1; 2N is two systems of k; 2N+1 is two systems of k+1. This needs k (the units
  required) from equipScale in the headline, as the what-if row already does.
- (b) Keep 1 of 2 and label it "group of one unit per path".

Every Reliability number on DCMOC moves under (a), and the N+1 headline downtime rises. So this is a mock first,
then the owner's verdict.

## Beyond the reference (each with a gate law)

1. **One redundancy model for the headline and the what-if.** Law: the headline value at N+1 equals the what-if
   value at N+1 for the same k (fails today).
2. **The headline explains itself.** Show each group's share of system downtime, with the arithmetic in a tooltip.
   Law: the shares sum to 100 % ± 0.1, and the largest one is named.
3. **β per redundant group.** Use U = (1−β)·U_ind + β·U_single for each group. Law: β = 0 equals the independent
   RBD, and β = 1 equals the single-path series.
4. **Grid backup from the same chain.** Law: no tier-constant coverage literal remains, and the result moves when the
   generator MTTR moves.
5. **Provenance per MTBF/MTTR.** Each value carries an IEEE 493 table reference or is marked ASSUMED. The generator
   MTBF of 150,000 h is labelled "IEEE 493 typical" but has no table reference. Law: every component row has a
   provenance kind.
