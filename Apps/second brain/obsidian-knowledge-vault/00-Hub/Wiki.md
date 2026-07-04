# ResistanceZero — Knowledge Wiki

> The knowledge wiki for [resistancezero.com](https://resistancezero.com) — the
> Obsidian-mirrored second brain behind the site. This is the **navigation
> landing**: what the vault holds and how to move through it.
>
> Looking for the repo install / tooling docs instead? Those live separately at
> `standarization/repos/REPO_INSTALL_PLAN.md` (the **Repo Install Plans** node in
> the graph) — they are *not* part of this knowledge wiki.

---

## What this is

A structured, cross-linked knowledge base mirroring every public page of the
site — articles, calculators, apps, comparisons, reports, and the engineering
standards behind them. Every note is a graph node; the value is in the
**connections** (`[[wikilinks]]`), not just the content of a single page.

Open the interactive graph any time via **Second Brain** on the site, or use
Obsidian's **Graph View** (`Ctrl+G`) inside the vault.

---

## The 8 hubs

| # | Hub | What's inside |
|---|-----|---------------|
| 01 | [[01-Articles/Articles-Hub]] | All 26 deep-dive articles + geopolitics + Future Forward series |
| 02 | [[02-Calculators/Calculators-Hub]] | The 7 engineering calculators (CAPEX, OPEX, ROI, TCO, PUE, Carbon, CX) + share module |
| 03 | [[03-Apps/Apps-Hub]] | Finance Terminal, Second Brain, DC AI, DCMOC |
| 04 | [[04-Series/Series-Hub]] | Multi-part series — Geopolitics + Future Forward |
| 05 | [[05-Standards/Standards-Hub]] | TIA-942, Tier Advisor, LTC virtual labs, DC systems |
| 06 | [[06-Comparisons/Comparisons-Hub]] | 10 head-to-head engineering comparisons |
| 07 | [[07-Reports/Reports-Hub]] | Infographics + market reports + PLN Java grid family |
| 08 | [[08-Automation/Automation-Hub]] | Private engineering audits (gitignored) |

---

## How to navigate

1. **Start broad** → [[00-Hub/README]] (vault overview + most-connected nodes) or
   [[00-Hub/Site-Architecture]] (how the site is wired).
2. **Follow a thread** → open any hub above, then traverse its `[[wikilinks]]`
   rather than jumping around by search — the graph *is* the map.
3. **Ask about connections** when querying with AI: reference node IDs (e.g.
   `calc-tco`, `art-26`) and ask what links to what, not just "what does X say".
4. **Tech context** → [[00-Hub/Tech-Stack]].

---

## Conventions

- One note = one page/concept = one graph node.
- Relationships are expressed with `[[wikilinks]]`; link liberally.
- Hubs (`*-Hub`) are the category entry points — every note in a category links
  back to its hub.
- Repo/tooling install docs are deliberately kept **out** of this wiki and
  reachable through their own **Repo Install Plans** node.

_Last reviewed: 2026-07-04._
