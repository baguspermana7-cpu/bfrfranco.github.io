# Session Resume

Suggested session name:
`Commissioning Playbook v2 - Equipment-Driven Schedule`

Date saved:
2026-03-19

Scope locked for this session:
- commissioning only
- no RFS model in this session
- no HTML build in this session
- output intended for downstream engine implementation

## What Was Completed

1. Created a commissioning-only specification v2:
- [cx-playbook-spec-v2-commissioning-only.md](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-playbook-spec-v2-commissioning-only.md)

2. Added a default 5-level expandable schedule model:
- Level 1: Commissioning Phase
- Level 2: Discipline
- Level 3: System Group
- Level 4: Equipment / Major Asset
- Level 5: Activity / Test Package

3. Updated schedule logic so equipment breakdown is driven by input parameters, not a static equipment list.

4. Added standards alignment rules:
- ASHRAE = commissioning process backbone
- TIA = infrastructure domain alignment
- Uptime = optional resiliency / performance overlay

5. Created implementation backlog / build tickets for the engine team:
- [cx-playbook-v2-implementation-backlog.md](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-playbook-v2-implementation-backlog.md)

## Key Decisions

- Keep the product playbook-first, not calculator-first.
- Keep the source model recursive, but force the default schedule projection to a standardized 5-level expandable hierarchy.
- Level 4 schedule rows must be real equipment or equipment sets.
- Level 5 schedule rows must be real commissioning packages / activities.
- Equipment rows must be generated from inputs:
  - archetype
  - building count
  - hall count
  - IT load
  - electrical topology
  - redundancy
  - cooling type
  - liquid cooling percentage
  - rack density
  - operator overlay
  - explicit equipment-count overrides

## Most Important Files

- Spec:
  [cx-playbook-spec-v2-commissioning-only.md](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-playbook-spec-v2-commissioning-only.md)

- Backlog:
  [cx-playbook-v2-implementation-backlog.md](/home/baguspermana7/rz-work/Article/Cx/Draft/cx-playbook-v2-implementation-backlog.md)

- Earlier review:
  [cx-rfs-playbook-review-2026-03-18.md](/home/baguspermana7/rz-work/Article/Cx/Codex%20Review/cx-rfs-playbook-review-2026-03-18.md)

## Best Next Steps When Resuming

1. Deepen equipment derivation formulas by archetype and discipline.
2. Expand package library so each major equipment family has standard L1-L5 commissioning packages.
3. Add a standards crosswalk appendix:
   ASHRAE process item -> TIA domain -> optional Uptime overlay implication.
4. Convert backlog into milestone waves:
   Alpha, Beta, Production candidate.
5. If needed later, start a separate session for RFS only.

## Do Not Drift Into

- RFS taxonomy
- customer service-readiness workflows
- HTML implementation details
- commercial gating / premium model

