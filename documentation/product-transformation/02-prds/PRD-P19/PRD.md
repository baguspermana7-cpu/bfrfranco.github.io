# PRD-P19: The calculation engine as a versioned package, or a documented decision not to (merges Q14)

## 1. Document control
| Field | Value |
|---|---|
| PRD id | PRD-P19 (absorbs Q14 "Versioned public calculation API, or delete it") |
| Version | 1.0, 2026-11-10 |
| Status | **NEEDS OWNER APPROVAL.** Publishing to npm is public and permanent, and it commits the owner to an API. Part A (an internal ESM build used by the site's own Node tests) is approved. Part B (public npm publish) is BLOCKED on the owner. |
| Priority | Wave 4 |
| Re-baseline | Q14 assumed a public calculation API exists. Re-checked: none exists. `worker/` and `cf-worker/` are finance gateways (Finnhub, news). So "delete it" does not apply. |

## 2. Executive summary
`rz-engine.js` (1.1 MB, 30 models) is a browser global. The site's own tests load it into Node with `vm`. Engineers who would script studies cannot import it.

This PRD:
- **Part A:** produces an ES module build with JSDoc types, so tests and scripts import it cleanly.
- **Part B:** optionally publishes it after the owner decides. The decision covers licence, versioning policy and support stance.

## 3. Problem statement
- The engine is an IIFE writing `window.RZEngine`.
- Node usage needs a vm sandbox.
- There are no type hints.
- There is no public API, and no versioning promise beyond `meta.version` on sub-engines.

## 4. Objectives and success metrics
| Objective | Metric | Target |
|---|---|---|
| A: ESM build | `import RZEngine from './dist/rz-engine.mjs'` returns the same outputs as the browser global for 30 model fixtures | 100 % deep-equal |
| A: types | JSDoc on public model entry points | 30/30 |
| B: package | published with semver, CHANGELOG, licence | owner decision |

## 5. Scope
- **A, in:** a build script that wraps the existing IIFE (no source rewrite); a parity test; JSDoc.
- **B (blocked):** `package.json`, licence selection (owner), and a publish workflow.
- **Out:** an HTTP API (a server would be new infrastructure, needing approval).

## 6. Personas
Engineers scripting studies. The site's own test tools.

## 7. User journey
- **A:** `node -e "import('./dist/rz-engine.mjs').then(m => console.log(m.default.models.pue.pueFromInputs({...})))"`.
- **B:** `npm i @resistancezero/engine`, after approval.

## 8. Functional requirements
| ID | Description |
|---|---|
| FR-P19-1 | `tools/build-engine-esm.mjs` wraps the IIFE text, exports the engine object, and writes `dist/rz-engine.mjs` (gitignored or committed: the owner decides; default committed for zero-build users) |
| FR-P19-2 | Parity gate: 30 model fixture calls; vm global vs ESM deep-equal |
| FR-P19-3 | Freshness: the ESM file equals a fresh build |
| FR-P19-4 (B) | Publish workflow with provenance |

## 9. UI/UX specification
None. Developer docs are added to `documentation/`.

## 10. Data model
None.

## 11. API contracts
The engine's existing object shape is the API. Part B freezes it under semver.

## 12. Business rules
- Breaking changes need a major version (B).

## 13. Cross-module integration
The test tools may switch from vm to ESM over time (optional).

## 14. AI and automation
Not applicable.

## 15. Non-functional requirements
Build under 2 s.

## 16. Security
Part B: npm 2FA and provenance; no secrets in the repo (the publish token is the owner's).

## 17. Edge cases
The engine references `window` at load: the wrapper provides a shim object.

## 18. Technical architecture
IIFE source → wrapper → ESM file → parity gate.

## 19. Implementation breakdown
A: 1 d. B: 0.5 d after the decision.

## 20. Test strategy
Parity, freshness.

## 21. Acceptance criteria
- **Given** the fixture set, **then** ESM and global outputs are deep-equal.

## 22. Rollout
A: one release. B: owner-run publish.

## 23. Risks
A public API commitment (B), which is why it is the owner's call.

## 24. Definition of done
- A: gates green.
- B: published, or a recorded "not publishing" decision.
