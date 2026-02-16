# Calculator Tooltip Standard — ResistanceZero

> **Version**: 1.0 | **Updated**: 2026-02-16

---

## Rule
**Every calculator input MUST have a tooltip.** No exceptions.

---

## HTML Pattern

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

---

## CSS (Theme-Colored)

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

| Article | Inputs | Tooltips | Status |
|---------|--------|----------|--------|
| 1 | 6+ | YES | Complete |
| 2 | 6+ | YES | Complete |
| 3 | Partial | Terminology only | Legacy (term-tooltip) |
| 4 | 7+5 adv | YES | Complete |
| 5 | 7 | YES | Complete (Feb 2026) |
| 6 | 8 | YES | Complete (Feb 2026) |
| 7 | 8 | YES | Complete (Feb 2026) |
| 8 | 8 | YES | Complete (Feb 2026) |
| 9 | 2+1 | YES | Complete (Feb 2026) |
| 10 | 3 | YES | Complete (Feb 2026) |
