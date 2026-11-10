# PRD-P06: Cx records for a real project (not only the demo)

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P06 |
| Version | 1.0, 2026-11-10 |
| Status | **Stage 1** approved under the directive: a local record workspace (create, edit, import, export a record set in this browser), validated by the existing laws. **Stage 2** needs owner approval: cloud persistence with new Supabase tables and RLS, which is a security-boundary change the owner must apply. Stage 2 is BLOCKED. |
| Priority | Wave 3 |
| Dependencies | P01 (project id) for linking; P13 (RFS → Cx issues) feeds it |
| Modules | `js/rz-cx-records.js` (validate, overlay, importRegister, 12+ laws R1–R13), `js/rz-cx-records-ui.js` (loads `data/cx/demo-records.json`), cx-calculator.html; `supabase/schema.sql` (stage 2) |

## 2. Executive summary
The Cx super-app has a Tier 3 record layer that is already well built. It covers assets, ports, connections, mappings, gates, packs, attempts, steps, issues, approvals, cost lines, allocations and observations, and validates them against the owner's PRD laws (for example R4: L(n) accepted implies L(n−1) accepted; R8: an open blocking issue blocks the gate).

It only ever loads one fixture, `data/cx/demo-records.json` ("demo records, not a project").

This PRD turns the record layer into a working tool. The user can start an empty record set for their project, import an asset register, raise and close issues, and record gate decisions. The data is kept in the browser and exported as a file. Cloud persistence follows when the owner approves.

## 3. Problem statement (measured)
- `rz-cx-records-ui.js:31` fetches `data/cx/demo-records.json` unconditionally.
- The fixture's meta: `project_id: 'DEMO'`. It holds 11 assets, 21 ports, 10 connections, 8 mappings and 30 gates.
- `importRegister(csv)` exists (PRD v1.0 §30 rules) but its output is not persisted anywhere.
- No write path exists for issues or gate decisions.
- **Consequence:** the most rigorous part of the Cx tool cannot hold a real project.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Real record set | a user creates, edits and reloads a record set; laws re-validate on every change | E2E |
| No law bypass | every write goes through `validate()`; a write that creates an R-law violation is refused or flagged as declared by that law (R8 blocks, R9 labels) | gate: 13 law fixtures |
| Portability | export, then import into another browser, gives an identical record set | round-trip deep-equal |
| Demo intact | the demo remains selectable and read-only | E2E |

## 5. Scope
**Stage 1 (in scope):**
- Workspace selector: Demo (read-only) / My records (local) / Import file.
- An empty set seeded from an asset register CSV via `importRegister`.
- Issue create, edit and close forms.
- Gate decision form (accept / reject with revision hash).
- Revision increments.
- Export / import JSON (schema = the record db).
- localStorage persistence (cap 2 MB per set, with a warning at 1.5 MB).
- An undo of the last write.

**Stage 2 (BLOCKED):**
- Tables `cx_record_sets(id, user_id, project_id, name, body jsonb ≤ 2 MB, rev, timestamps)` with own-row RLS.
- Optional sharing by token, mirroring `dcmoc_projects`' share RPC.

**Out of scope:**
- Attachments and photos.
- Multi-user concurrent editing.
- Approval workflows with real identities (approver identity is a typed name in stage 1, labelled "self-declared").

**Reuse:** `RZCxRecords.validate/overlay/importRegister`, existing panels.

**Constraints:**
- The laws are the authority.
- The UI never writes around them.

## 6. Personas
- **Cx manager:** maintains the register and gates.
- **Contractor:** imports an asset list.
- **Reviewer:** reads the exported set.

## 7. User journey
1. The Records tab shows the workspace selector. "Demo" is the default for first visits, with its existing note.
2. **New record set.**
   - Name it. Optionally link the active P01 project.
   - Import an asset register CSV. Rejected lines are listed with reasons (from `importRegister`).
3. **Issue.** "New issue": title, asset, severity, blocking yes/no, owner (text). Saving re-validates; if the issue is blocking, the gate panel shows the blocked constraint (R8).
4. **Gate decision.** Accept or reject with the current revision hash. If R4 is violated (L(n−1) not accepted), the action is refused with the law text.
5. **Export** a JSON file. **Import** checks the schema and the laws; findings are listed. The user can import anyway as "invalid set (n findings)", and the set is marked as such.
6. **Failures.**
   - Storage full: the warning offers Export.
   - Corrupt local set: quarantined, with a notice.

## 8. Functional requirements
| ID | Description | Acceptance |
|---|---|---|
| FR-P06-1 | Workspace model: `{sets: {id: {name, project_id?, db, rev, updated_at}}, active}` in `localStorage rz_cx_records_v1` | unit |
| FR-P06-2 | Every write = clone db → apply change → `validate()` → commit if no *refusal* law is violated. Refusal laws: R1, R2, R3, R4, R5, R6, R7, R11. Flag laws: R8, R9, R10, R13. | 13 law fixtures |
| FR-P06-3 | Register import via `importRegister` | unit with a fixture CSV incl. bad lines |
| FR-P06-4 | Issue CRUD with `ISSUE_OPEN` states | E2E |
| FR-P06-5 | Gate decision with `revision_hash` | E2E |
| FR-P06-6 | Export / import round-trip | unit |
| FR-P06-7 | Demo read-only (write controls hidden, with "Demo is read-only · Start your own set") | E2E |
| FR-P06-8 | Undo of the last write (single level) | E2E |
| FR-P06-9 (stage 2) | Cloud save/load + SQL + RLS tests | owner |

## 9. UI/UX specification
- **Workspace selector.** At the top of the Records tab: segmented control (Demo / My records ▾ / Import) and set name.
- **Forms.** DHModal-style dialogs. Labels above fields. Required fields marked. Inline errors carry the law id and text when a law refuses ("R4: L2 cannot be accepted before L1 for CRAH-01").
- **Tables.** The existing record panels, plus row actions (Edit · Close issue).
- **Status.** Validation findings sit in a persistent panel with counts per law. Each finding links to its record.
- Both themes, 390/1440 px.

## 10. Data model
- **Stage 1:** the existing record db shape (tables listed in `validate`).
- **Stage 2 SQL:**
```sql
create table public.cx_record_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid null,
  name text not null check (char_length(name) between 1 and 120),
  body jsonb not null check (pg_column_size(body) <= 2097152),
  rev int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: four own-row policies (same shape as saved_scenarios); index (user_id, updated_at desc)
```

## 11. API contracts
- Stage 1: in-browser only.
- Stage 2: supabase-js on the new table; errors via `friendly()`.

## 12. Business rules
- The laws R1–R13 as implemented are the rules.
- Refusal laws block a write.
- Flag laws annotate.
- Revisions increment on every write.

## 13. Cross-module integration
| Module | Effect |
|---|---|
| Plan overlay | `RZCxRecords.overlay` uses the active set, so the schedule shows actual accepted levels |
| P13 | RFS gaps arrive as issues in the active set |
| P12 | Export unaffected (plan) |
| P01 | `project_id` link |
| 3D campus / heatmap | Read through overlay |

**Phase 3 amendment C3:** new issues go to the active Cx tier. With no Tier 3 record set active, intake writes Tier 1 `RZCxIssues`. With a Tier 3 set active, intake writes Tier 3 `issues`, and the Tier 1 register is read-only. Conversion between tiers is explicit (`RZCxRecords.issueFromTier1`); nothing is mirrored silently.
**Phase 3 amendment C7:** the SQL is delivered in the single owner-applied bundle `supabase/migrations/2026-11-product-transformation.sql`.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
- Validate on a 5,000-record set in under 200 ms (estimate, measured with a generated set).
- Accessibility AA.

## 16. Security
- **Stage 1:** local, untrusted import validated; text rendered via textContent.
- **Stage 2:** RLS, size cap, no anonymous access.
- The self-declared approver name is stated as not an authenticated identity.

## 17. Edge cases
- Import of a set with a different law version: the findings are shown and it is not auto-fixed.
- Two tabs: the storage event reloads the other tab with a notice.
- Deleting an asset referenced by ports or gates: refused, listing the references.

## 18. Technical architecture
UI → write pipeline (clone, change, validate, commit) → localStorage; (stage 2) → Supabase.

## 19. Implementation breakdown
| Task | Effort | Verify |
|---|---|---|
| Workspace + persistence | 0.75 d | unit |
| Write pipeline + 13 law fixtures | 1 d | gate |
| Import / export | 0.5 d | unit |
| Issue + gate forms | 1.5 d | E2E + a11y |
| Demo read-only + undo | 0.5 d | E2E |
| Stage 2 SQL | 0.5 d | owner |

## 20. Test strategy
- Law fixtures (each refusal law has one refused write; each flag law has one flagged write).
- Round-trip.
- E2E journey.
- axe.
- Regression on the existing Cx gates (`test-cx-*`).

## 21. Acceptance criteria
- **Given** a new set with CRAH-01, **when** L2 is accepted before L1, **then** the action is refused with the R4 text.
- **Given** a blocking open issue on CRAH-01, **then** its L3 gate constraint reads blocked.
- **Given** export then import, **then** the sets are deep-equal.

## 22. Rollout
- Stage 1: additive. The demo stays the default.
- Rollback by revert. Local data stays.
- Stage 2 after approval.

## 23. Risks
| Risk | Mitigation |
|---|---|
| localStorage limits | 2 MB cap + export prompt |
| Users expect a server backup | The UI states "kept in this browser"; stage 2 |

## 24. Definition of done
- Stage 1 FRs are done.
- The gates are green.
- Screenshots reviewed.
- The change is live and verified.
- Stage 2 SQL is delivered with status BLOCKED (owner).
