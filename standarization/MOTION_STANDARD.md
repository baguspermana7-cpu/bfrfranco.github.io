# Motion standard — resistancezero.com

> Read this before adding or changing any animation or transition.
> Source philosophy: Emil Kowalski's animation work (`~/.claude/skills/animate`).
> Gate: `node tools/test-rz-motion.mjs --strict`.

Every number here was measured on this codebase before it was written down.
Opened 2026-10-06 (v3.12.2).

---

## What was measured first

| measurement | value |
|---|---|
| duration declarations across `css/*.css`, `styles*.css` and the 29 article pages | **825** |
| `--ease-*` tokens that existed | **0** — every curve was hand-written or a browser default |
| declarations over 300ms | 220 |
| …of those, constant or decorative motion allowed to be long (aurora 22s, marquee 60s, the documented 0.9s card shine sweep) | 102 |
| …**UI-interaction transitions over 300ms — the ones the ceiling is actually about** | **9** |
| article pages carrying inline motion with no `prefers-reduced-motion` handling of their own | **24 of 29** |

The ceiling is a real rule with a small backlog, not a sweep. **220 is not 220
defects** — a count is not a finding until someone asks what the number means.

---

## 1 · Should it animate at all?

This gate exists to produce **zero lines of code** sometimes. That is a success.

| how often the user sees it | decision |
|---|---|
| 100+ times a day — keyboard shortcuts, the command palette (`Ctrl/Cmd+K`, `/`) | **no animation, ever** |
| tens of times a day — hover, list navigation | near-imperceptible or nothing |
| occasional — modals, drawers, sheets, toasts | standard animation |
| rare or first-time — onboarding, a success state | the delight budget lives here |

**Keyboard-initiated is a disqualifier, not a judgement call.** `rz-command-palette.js`
is opened by shortcut hundreds of times a day and must stay instant. Raycast has
no open/close animation, and that is correct.

**Data the reader is acting on does not move for style.** A number in a cockpit
KPI, a figure's geometry, a table row — these may animate to encode a *state
change*, never to decorate.

## 2 · Name the purpose

Feedback · spatial consistency · state indication · preventing a jarring change ·
explanation (marketing only) · delight (rare tier only).

Can't name it in one of those words? Don't build it.

## 3 · The tokens

Defined on `:root` in `css/rz-article-dark.css`. **Use them; do not fork a
parallel scale.**

```css
--rz-ease-out:cubic-bezier(.23,1,.32,1);       /* entering or exiting */
--rz-ease-in-out:cubic-bezier(.77,0,.175,1);   /* moving on screen */
--rz-ease-drawer:cubic-bezier(.32,.72,0,1);    /* drawers and sheets (iOS-like) */

--rz-dur-press:120ms;    /* button press feedback */
--rz-dur-tip:160ms;      /* tooltips, small popovers */
--rz-dur-menu:200ms;     /* dropdowns, selects, toasts */
--rz-dur-panel:280ms;    /* modals, drawers, sheets */
--rz-dur-explain:600ms;  /* marketing / explanatory ONLY */
```

There is deliberately **no `--rz-ease-in`**. `ease-in` starts slow, which delays
the exact moment the user is watching: `ease-out` at 200ms *feels* faster than
`ease-in` at 200ms.

**UI motion stays under 300ms.** A 180ms dropdown reads as more responsive than
a 400ms one. Longer than that needs a reason written at the declaration.

## 4 · Properties

- **`transform` and `opacity` only.** They skip layout and paint and run on the
  GPU. `width`/`height`/`margin`/`padding`/`top`/`left` trigger all three.
  `clip-path` is the sanctioned fourth; `height` is tolerated only for
  accordions, where there is no transform equivalent.
  *Open item:* `css/ltc-lab.css` animates `width` on `.ltc-comp-bar-fill` and
  `.ltc-sub-bar-fill` (400ms). `transform: scaleX()` with a
  `transform-origin: left` is the correct form.
- **Never `transform: scale(0)`.** Start from `scale(.9)`–`scale(.97)` with
  `opacity: 0`. Nothing in the real world appears from nothing.
- **Percentages in `translate()`**, not hardcoded pixels: `translateY(100%)` is
  the element's own height whatever its content.
- **`transform-origin` at the trigger** for popovers, dropdowns, menus and
  tooltips. **Modals and bottom sheets are exempt** — they are not anchored to a
  trigger.
- **Never drive a child's transform from a custom property on the parent.** It
  recalculates styles for every child.

## 5 · Transitions, not keyframes, for anything rapidly triggered

A toast, a toggle, anything a user can fire twice in a second: a transition
retargets from the current value, keyframes restart from zero and the second one
visibly jumps. `js/rz-toast.js` is the worked example, and
`tools/test-rz-motion.mjs` asserts `animationName === 'none'` on it.

CSS animation still wins for **predetermined** motion that must stay smooth while
the page is busy — it runs off the main thread, where a
`requestAnimationFrame` loop drops frames during load, script and paint.

## 6 · Exit the way it entered

A sheet that arrives from the bottom edge leaves through the bottom edge. The
symmetric path is what makes swipe-to-dismiss feel obvious rather than taught.

**Asymmetric timing where the user is deciding:** unmediated during the
deliberate phase (a drag tracks the finger 1:1, with `transition: none`), snappy
on the system response (release settles in 280ms on the drawer curve).

**Velocity decides a dismissal, not distance alone.** `js/rz-sheet.js` dismisses
on a flick over 0.55 px/ms from anywhere, or a slow drag past 40% of the height.
Distance alone makes a quick flick feel ignored.

## 7 · Reduced motion ships with the animation

Not as a follow-up. And it means **fewer and gentler, not zero** — a toast that
appears with no transition at all reads as a glitch.

`css/rz-article-dark.css` carries a **floor** for the editorial register: under
`prefers-reduced-motion: reduce` it narrows `transition-property` to the
non-moving properties (opacity, colour, border, shadow, fill, stroke) and sets
`animation: none`. Measured on `article-18.html`: transitions that move something
fall from **1180 to 9**.

Three namespaces are exempt **by name**, because their motion carries data
rather than decorating it: `.rz-diagram` / `[data-rz-diagram]`, `[data-rz-chart]`,
`.rz-scrolly`. An exemption not named there does not exist. The exemption is
proven with a seeded element rather than with current content, because the
living diagrams' own flow animation is already disabled under reduced motion by
an older targeted rule — so nothing in the corpus exercises it today.

## 8 · Pointer gating

```css
@media (hover: hover) and (pointer: fine) { .el:hover { transform: scale(1.02); } }
```

Touch fires a false hover on tap. Ungated hover motion is a defect.

---

## Components — use these, never hand-roll another

| need | module | notes |
|---|---|---|
| toast / notification | `js/rz-toast.js` → `window.RZToast` | `show/ok/warn/fault/info`, dwell pauses on hover and focus, stack of 3 expressed as transforms, message is `textContent` and never `innerHTML` |
| bottom sheet / drawer | `js/rz-sheet.js` → `window.RZSheet` | drag-to-dismiss with velocity, rubber-band upward, focus moved in, trapped, and returned to the opener; Escape closes |

**Why not sonner and vaul.** They are the references these are built against and
the right answer in React. This site is zero-build vanilla, so the principles are
ported rather than the packages — which is the standing instruction for
vanilla-JS repos here. Do not add React to use them.

Both self-inject their CSS, guard on `window.__rzToast` / `window.__rzSheet`, and
read the motion tokens above with literal fallbacks so they also work on a page
that does not load `css/rz-article-dark.css`.

---

## Never ship

| never | instead |
|---|---|
| `transition: all` | name the exact properties |
| `transform: scale(0)` entrance | `scale(.95)` + `opacity: 0` |
| `ease-in` on a UI element | `var(--rz-ease-out)` |
| a built-in `ease-out` on a deliberate animation | `var(--rz-ease-out)` |
| animation on a keyboard shortcut or a 100+/day action | no animation |
| a UI duration over 300ms with no reason | 150–250ms |
| `transform-origin: center` on a trigger-anchored popover | the trigger's origin (modals and sheets exempt) |
| keyframes on a toast, toggle or rapidly-triggered element | CSS transitions |
| animating `width`/`height`/`margin`/`padding`/`top`/`left` | `transform` / `opacity` |
| ungated `:hover` motion | `@media (hover: hover) and (pointer: fine)` |
| a missing `prefers-reduced-motion` variant | a gentler one, not zero |
| everything entering at once | a 30–80ms stagger |

## Gate

```bash
node tools/test-rz-motion.mjs --strict
```

39 assertions, every one reading a **computed value out of a real browser after a
real interaction** — never a class name or a source string. It covers both
components in both motion preferences, including a pointer-driven drag.

Proven to fail before it was trusted: seeding `transition: all 500ms ease-in`,
a `scale(0)` entrance, and removing the sheet's `rz-dragging` class produced 12
failures naming each defect. A gate nobody has seen fail is a gate nobody should
believe.
