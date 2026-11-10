# PRD-P18: Classroom mode (assignments and submissions for educators)

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P18 |
| Version | 1.1, 2026-11-10 (review revision: UI, acceptance) |
| Status | **NEEDS OWNER APPROVAL. Not started.** It adds new tables, new RLS policies and a new role-based permission path, and it stores data about other people (students). The directive requires approval for auth and security-boundary changes. The audience decision is also the owner's. |
| Priority | Wave 4 |
| Dependencies | P02 (links), P03 (compare), existing `educator_allowlist`, `profiles.role`/`tier`, `js/rz-feature-flags.js` (educator = role, tier pro) |

## 2. Executive summary
Educators are already a recognised role:
- the `educator_allowlist` table exists and is root-managed;
- feature flags treat educators as pro.

Nothing lets an educator give students a task and see their answers.

This PRD specifies a minimal classroom:
1. An educator creates an assignment: a calculator, a starting scenario link and instructions.
2. Students open the assignment link and submit their scenario.
3. The educator sees the submissions side by side, using P03 compare.

## 3. Problem statement (measured)
- `educator_allowlist` is referenced in `js/rz-supabase.js:466–480` (root CRUD) and `rz-feature-flags.js` (tier gating).
- No assignment or submission concept exists in `supabase/schema.sql`.
- Educators today share links informally and collect screenshots.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| Create | an educator creates an assignment with a starting link | E2E |
| Submit | a signed-in student submits a scenario once (resubmit replaces it) | E2E |
| Privacy | a student sees only their own submission; an educator sees submissions to their own assignments only | RLS tests: 4 negative cases |
| Review | the educator compares up to 4 submissions (P03) | E2E |

## 5. Scope
- **In:**
  - Tables `assignments(id, educator_id, calc, title, instructions ≤ 4,000, start_link, opens_at, closes_at, join_code)`.
  - Table `submissions(id, assignment_id, student_id, payload jsonb ≤ 64 KB, submitted_at)`.
  - RLS.
  - Join by code.
  - Educator page.
  - Student banner on the calculator.
- **Out:** grading, rubrics, LMS integration, exporting student data beyond CSV of the educator's own assignment.

## 6. Personas
- **Educator:** an allowlisted user with role educator.
- **Student:** any signed-in user who joins with a code.

## 7. User journey
1. Educator → account → "Classroom" → New assignment (calculator, title, instructions, start from the current link, closing date) → a join code is shown.
2. Student → `classroom.html?code=XXXX` (or enters the code) → the calculator opens with the start link and an assignment banner → works → **Submit** → "Submitted at 14:02 · Resubmit replaces it".
3. Educator → assignment → submission list (student display name, time) → select up to 4 → Compare.
4. **Failures:**
   - Closed assignment: Submit is refused with the date.
   - Wrong code: "No open assignment with this code".

## 8. Functional requirements
| ID | Description |
|---|---|
| FR-P18-1 | Assignment CRUD by educators only. RLS: `educator_id = auth.uid()` and the caller is an educator, via a SECURITY DEFINER `is_educator()`. |
| FR-P18-2 | Join code: 8 characters from an unambiguous alphabet. RPC `join_assignment(code)` returns assignment metadata without other students' data. |
| FR-P18-3 | Submit RPC: upsert one row per (assignment, student); refused after `closes_at`. |
| FR-P18-4 | Educator reads submissions of their own assignments via RLS join. |
| FR-P18-5 | Compare via P03 with payloads as cases. |
| FR-P18-6 | Rate limit: 30 submissions per student per hour (in the RPC). |

## 9. UI/UX specification
- **Account → Classroom section.** Visible to educators only: an assignment list (title, calculator, open/closed, submission count) plus a New assignment button.
- **Assignment form.** Title (1–120), calculator, instructions (≤ 4,000, plain text), start link (the current page link or pasted), and a closing date. Inline validation.
- **Assignment detail.** Join code with a copy button, the submission table (display name, submitted at, Open, Select for compare), and a Close now button with a confirm step.
- **Student banner on the calculator.** "Assignment: <title> · closes <date> · Submit · Leave". After Submit it reads "Submitted 14:02 · Resubmit".
- **States.** Empty ("No submissions yet"), loading (skeleton rows), error with Retry, closed (Submit hidden, reason shown).
- AA contrast in both themes. 390/1440 px.

## 10. Data model
The two tables above, with indexes `(educator_id)`, `(assignment_id, submitted_at desc)`, unique `(assignment_id, student_id)`. Cascade on assignment delete. Retention: deleted with the assignment, and the educator is told so.

## 11. API contracts
RPCs `join_assignment(code text)` and `submit_assignment(assignment_id uuid, payload jsonb)`; table selects under RLS. Errors via `friendly()`.

## 12. Business rules
- An assignment state is draft, open or closed, by dates.
- A submission belongs to its student.
- The educator cannot edit submissions.

## 13. Cross-module integration
P02 links, P03 compare, P15 events, feature flags.

**Phase 3 amendment C4:** the link payload schema lives in one file, `data/scenario-link.schema.json`. Readers accept v1 and v2.
**Phase 3 amendment C7:** the SQL is delivered in the single owner-applied bundle `supabase/migrations/2026-11-product-transformation.sql`.

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
Up to 200 submissions per assignment (assumption). The list is paginated by 50.

## 16. Security
- RLS is the boundary.
- SECURITY DEFINER functions use a fixed `search_path` (the existing pattern).
- Student display names only; no emails are shown to educators.
- Privacy note on the classroom page.

## 17. Edge cases
- An educator demoted: their assignments become read-only.
- A student account deleted: their submissions cascade.
- A clock difference: `closes_at` is checked server-side.

## 18. Technical architecture
Calculator ↔ `rz-classroom.js` ↔ Supabase RPC and RLS.

## 19. Implementation breakdown
SQL + RLS tests 1.5 d · educator UI 1.5 d · student banner 0.5 d · compare hook 0.25 d · E2E with stubs 1 d.

## 20. Test strategy
SQL RLS tests (owner-run); E2E with a stubbed client; axe.

## 21. Acceptance criteria
- **Given** student A and student B on one assignment, **then** A cannot read B's submission (SQL test).
- **Given** educator E1, **then** E1 cannot read submissions to E2's assignments (SQL test).
- **Given** a closed assignment, **when** a student submits, **then** the RPC refuses and the banner states the closing date.
- **Given** a student submits twice, **then** one row exists, holding the latest payload.
- **Given** a non-educator, **then** creating an assignment fails at RLS and the Classroom section is not shown.

## 22. Rollout
After approval: the owner applies the SQL, then the UI ships behind the feature flag `classroom` (an existing flags table), enabled for educators.

## 23. Risks
- Student data custody.
- Scope creep into an LMS.

## 24. Definition of done
- The owner has approved and applied the SQL.
- The RLS tests pass.
- E2E is green.
- The flag is enabled.
- **Current status: NOT STARTED, awaiting approval.**
