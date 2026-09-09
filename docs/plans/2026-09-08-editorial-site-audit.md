# Editorial and whole-site design audit

Status: IN PROGRESS. Local changes only; publication is not authorized.

## Owner request

“audit total ... tulisan/article saya jauh lebih proper utk dibaca dan anti-vibecode ... cek semua literally semuanya ... cek sitemaps, robot jagnan sampai ada terlewat”

## Acceptance and workstreams

1. Inventory every tracked HTML page, including nested pages and sub-apps. Classify private, generated, gated and public surfaces explicitly; exclusion is not a pass.
2. Review article prose and reading presentation without changing engineering facts, evidence, section anchors or approved controls.
3. Repair decorative design findings in source, not with a global override that destroys instrument surfaces. Preserve the approved aurora and semantic status colors.
4. Reconcile sitemap URLs against local files, canonical/noindex directives and robots groups. Keep private pages private; robots is not access control.
5. Exercise rendered light/dark desktop/mobile surfaces and record failures, blocked states and missing evidence. Static rule success cannot certify subjective design quality.
6. Run focused regression tests and release gates, synchronize generated discovery artifacts and document the final scope and unresolved findings.

Owner refinement: “perhatikan container, white space dll”. Verify shared left edges, mobile gutters, reading width, section rhythm and excessive pre-article space in rendered pages, not just stylesheet values.

Owner acceptance: “ensure no mistake, no bug”. Require regression tests, independent code/design review, rendered interaction checks and explicit unresolved findings. Passing a detector is not a guarantee of bug-free software.

## Baseline

- Branch: `fix/ship-gate-automation`; version at start: `2.12.0`.
- Existing untracked `.codex.legacy-empty-file-20260823-0025` and `output/` are unrelated and preserved.
- 299 tracked HTML files, before classification.
- Existing anti-vibecode gate: 0 gating but 273 monitored file/rule findings across 172 files. This is not a clean audit.
- Existing robots has specific bot groups with fewer restrictions than the wildcard group and lists `llms.txt` as a sitemap.
- Browser evidence and machine reports remain local, outside the published content tree.

## Coordination

Crawler/SEO, prose, static decorative CSS, and browser coverage have separate owners. Shared editorial CSS/runtime and final integration belong to the primary agent. No commits, pushes, deploys, credential changes or archive/memory rewrites.
