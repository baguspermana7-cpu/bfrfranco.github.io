# Calculator Tooltip Standard — ResistanceZero

> **Version**: 1.2 | **Updated**: 2026-02-16

---

## Rule
**Every calculator input MUST have a tooltip.** No exceptions.
**Every domain-specific term in article body MUST have a term-tooltip.** (See Term Tooltip Pattern below.)

---

## Two Tooltip Systems

### System 1: Calculator Input Tooltips (`.tooltip-trigger` + `.tooltip-content`)
Used for calculator inputs. JS-powered positioning with floating content panel.

### System 2: Term Tooltips (`.term-tooltip` + `data-tooltip`)
Used for inline technical terms in article body text. CSS-only `::after` hover.

---

## HTML Pattern — Calculator Tooltips

```html
<label class="calc-label">
  Input Name
  <span class="tooltip-trigger">?
    <span class="tooltip-content">
      <div class="tooltip-title">Input Name</div>
      <div class="tooltip-desc">
        What this input means, why it matters, and how it affects the calculation.
        2-3 sentences maximum.
      </div>
      <div class="tooltip-formula">
        Benchmark: typical industry value or formula reference
      </div>
    </span>
  </span>
</label>
```

## HTML Pattern — Term Tooltips

```html
<span class="term-tooltip" data-tooltip="Brief definition of the term. Include industry benchmark or standard reference.">technical term</span>
```

---

## CSS — Calculator Tooltips (Theme-Colored)

Replace `THEME_COLOR` and `THEME_RGB` with article's accent color:

```css
.tooltip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(THEME_RGB, 0.15);
  color: THEME_COLOR;
  font-size: 0.65rem;
  font-weight: 700;
  cursor: help;
  margin-left: 6px;
  vertical-align: middle;
  position: relative;
}

.tooltip-content {
  display: none;
  position: fixed;
  width: 280px;
  background: #1e293b;
  border: 1px solid rgba(THEME_RGB, 0.3);
  border-radius: 10px;
  padding: 14px;
  z-index: 9999;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  pointer-events: none;
}

.tooltip-trigger:hover .tooltip-content {
  display: block;
}

.tooltip-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: THEME_COLOR;
  margin-bottom: 6px;
}

.tooltip-desc {
  font-size: 0.78rem;
  color: #cbd5e1;
  line-height: 1.5;
  margin-bottom: 8px;
}

.tooltip-formula {
  font-size: 0.72rem;
  color: #94a3b8;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.1);
  font-style: italic;
}
```

## CSS — Term Tooltips

```css
.term-tooltip {
  position: relative;
  border-bottom: 1px dotted THEME_COLOR;
  cursor: help;
  color: inherit;
}

.term-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: #e2e8f0;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 1.5;
  width: 260px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  border: 1px solid rgba(THEME_RGB, 0.3);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  pointer-events: none;
  z-index: 9999;
  white-space: normal;
}

.term-tooltip:hover::after {
  opacity: 1;
  visibility: visible;
}
```

---

## JavaScript Positioning (Required)

CSS `:hover` alone doesn't position fixed elements correctly. Add this JS:

```js
document.querySelectorAll('.tooltip-trigger').forEach(function(trigger) {
  trigger.addEventListener('mouseenter', function() {
    var content = this.querySelector('.tooltip-content');
    if (!content) return;
    content.style.display = 'block';
    var rect = this.getBoundingClientRect();
    var cRect = content.getBoundingClientRect();
    var top = rect.bottom + 8;
    var left = rect.left - cRect.width / 2 + rect.width / 2;
    // Viewport bounds
    if (left < 8) left = 8;
    if (left + cRect.width > window.innerWidth - 8)
      left = window.innerWidth - cRect.width - 8;
    if (top + cRect.height > window.innerHeight - 8)
      top = rect.top - cRect.height - 8;
    content.style.top = top + 'px';
    content.style.left = left + 'px';
  });
  trigger.addEventListener('mouseleave', function() {
    var content = this.querySelector('.tooltip-content');
    if (content) content.style.display = 'none';
  });
});
```

---

## Per-Article Tooltip Colors

| Article | Theme Color | RGB for rgba() |
|---------|-------------|-----------------|
| 1 | `#3b82f6` | `59, 130, 246` |
| 2 | `#ef4444` | `239, 68, 68` |
| 3 | `#10b981` | `16, 185, 129` |
| 4 | `#3b82f6` | `59, 130, 246` |
| 5 | `#f59e0b` | `245, 158, 11` |
| 6 | `#06b6d4` | `6, 182, 212` |
| 7 | `#10b981` | `16, 185, 129` |
| 8 | `#8b5cf6` | `139, 92, 246` |
| 9 | `#3b82f6` | `59, 130, 246` |
| 10 | `#0891b2` | `8, 145, 178` |
| 11 | `#f59e0b` | `245, 158, 11` |
| 12 | `#10b981` | `16, 185, 129` |
| 13 | `#6366f1` | `99, 102, 241` |
| 14 | `#f97316` | `249, 115, 22` |
| 15 | `#ec4899` | `236, 72, 153` |

---

## Content Guidelines

### tooltip-title
- Match the input label name exactly
- Capitalized, no period

### tooltip-desc
- 2-3 sentences explaining:
  - What the input measures
  - Why it matters to the calculation
  - Common pitfalls or misconceptions
- Use active voice, technical but accessible

### tooltip-formula
- Start with "Benchmark:" or "Formula:" or "Ref:"
- Include industry standard values
- Reference sources (IEEE, Uptime Institute, ISO, NIST, etc.)

---

## Tooltip Status Matrix

| Article | Inputs | Tooltips | Term Tooltips | Status |
|---------|--------|----------|---------------|--------|
| 1 | 6+ | YES | N/A | Complete |
| 2 | 6+ | YES | N/A | Complete |
| 3 | 8 | YES | YES (wrench time, etc.) | Complete (Feb 2026) |
| 4 | 7+5 adv | YES | N/A | Complete |
| 5 | 7 | YES | N/A | Complete (Feb 2026) |
| 6 | 8 | YES | N/A | Complete (Feb 2026) |
| 7 | 8 | YES | N/A | Complete (Feb 2026) |
| 8 | 8 | YES | N/A | Complete (Feb 2026) |
| 9 | 2+1 | YES | N/A | Complete (Feb 2026) |
| 10 | 3 | YES | N/A | Complete (Feb 2026) |
| 11 | 6 | YES | N/A | Complete (Feb 2026) |

---

## Known Bugs & Fixes (Reference)

### BUG-001: Tooltip Container Missing from DOM (Article 3)
**Symptom**: "?" badge visible but tooltip content never appears.
**Root cause**: JS references a container `#maint-tooltip-container` that doesn't exist in the DOM. The `if(!tc) return;` guard silently exits.
**Fix**: Always add the container `<div>` element to the HTML before the section that uses tooltips.
**Prevention**: After adding tooltip JS, verify the target container element exists in the HTML. Search for the container ID in the DOM.

### BUG-002: CSS opacity vs JS display Mismatch (Article 3)
**Symptom**: "?" badge visible, JS fires on hover, but tooltip is still invisible.
**Root cause**: CSS uses `opacity: 0` / `.visible { opacity: 1 }` pattern, but JS sets `style.display = 'block'` which doesn't override `opacity: 0`.
**Fix**: Use `classList.add('visible')` / `classList.remove('visible')` instead of `style.display`.
**Prevention**: When using opacity-based show/hide, ALWAYS use classList toggling, never display toggling. Pick one mechanism and stick with it.

### BUG-003: Tooltip JS Selector Too Narrow (Article 3)
**Symptom**: Tooltips work in one section but not in others.
**Root cause**: JS selector was `#section-12 .tooltip-trigger` instead of `.tooltip-trigger` (global).
**Fix**: Broaden the selector to target all tooltip triggers on the page.
**Prevention**: Unless tooltips are truly scoped to one section, always use the global `.tooltip-trigger` selector.

### BUG-004: Missing Term Tooltips for Key Terms
**Symptom**: Domain-specific terms (e.g., "wrench time") appear as plain text with no explanation.
**Root cause**: Terms were used in article body without `.term-tooltip` wrapping.
**Fix**: Wrap all domain-specific terms with `<span class="term-tooltip" data-tooltip="...">term</span>`.
**Prevention**: When writing article content, identify all industry jargon and technical terms. Each should have either a `.term-tooltip` (inline) or a glossary entry.

---

## Checklist (Pre-Deployment)

- [ ] Every calculator input has a `.tooltip-trigger` with `.tooltip-content` child
- [ ] Every `.tooltip-content` has `.tooltip-title`, `.tooltip-desc`, `.tooltip-formula`
- [ ] JS positioning code is present and uses correct selector (global or scoped)
- [ ] If using container-based tooltips: container `<div>` exists in the DOM
- [ ] If using opacity-based CSS: JS uses `classList` not `style.display`
- [ ] Domain-specific terms in article body have `.term-tooltip` with `data-tooltip`
- [ ] Tooltip colors match the article's theme color (see Per-Article table)
- [ ] Hover test: every "?" shows tooltip content, not just the badge
- [ ] Mobile: tooltips don't overflow viewport (JS viewport bounds check)
