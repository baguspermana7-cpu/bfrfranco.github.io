#!/usr/bin/env python3
"""Apply v1.5.0 article typography uplift to all article-class pages.

Idempotent: skips any file already containing the v1.5.0 marker.
"""
import os
import glob

root = '/home/baguspermana7/rz-work'

MARKER = '/* v1.5.0 — article typography uplift */'

PATCH = r"""/* v1.5.0 — article typography uplift (Awwwards-tier polish) */

/* Gradient drop-cap on first paragraph of article body */
.article-body > p:first-of-type::first-letter,
article > p:first-of-type::first-letter,
.article-content > p:first-of-type::first-letter {
    float: left;
    font-size: 4.5rem;
    line-height: 1;
    font-weight: 800;
    margin: 0.1em 0.15em 0 0;
    background: linear-gradient(135deg, #fbbf24 0%, #10b981 50%, #3b82f6 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    font-family: 'Inter', system-ui, sans-serif;
}

/* Scroll-reveal class — IntersectionObserver toggles .is-visible */
.rz-reveal {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s cubic-bezier(0.22, 0.61, 0.36, 1),
                transform 0.6s cubic-bezier(0.22, 0.61, 0.36, 1);
    will-change: opacity, transform;
}
.rz-reveal.is-visible {
    opacity: 1;
    transform: translateY(0);
}

/* Subtle fade-in animation for h2 / h3 section headers as user scrolls */
.article-body h2,
.article-content h2,
article h2 {
    position: relative;
}
.article-body h2::before,
.article-content h2::before,
article h2::before {
    content: '';
    position: absolute;
    left: -1rem;
    top: 0.45em;
    width: 4px;
    height: 0.55em;
    background: linear-gradient(180deg, #fbbf24, #10b981);
    border-radius: 2px;
    opacity: 0;
    transform: translateX(-8px);
    transition: opacity 0.5s ease, transform 0.5s ease;
}
.article-body h2:hover::before,
.article-content h2:hover::before,
article h2:hover::before { opacity: 1; transform: translateX(0); }

/* Better inline-link underline (resend.com style) */
.article-body a:not(.btn):not([class*="card"]),
.article-content a:not(.btn):not([class*="card"]) {
    background-image: linear-gradient(120deg, currentColor 0%, currentColor 100%);
    background-repeat: no-repeat;
    background-size: 100% 1px;
    background-position: 0 100%;
    transition: background-size 0.3s ease;
}
.article-body a:not(.btn):not([class*="card"]):hover,
.article-content a:not(.btn):not([class*="card"]):hover {
    background-size: 100% 2px;
}

@media (prefers-reduced-motion: reduce) {
    .rz-reveal { opacity: 1 !important; transform: none !important; transition: none; }
    .article-body h2::before { opacity: 1; transform: none; }
}
"""

files = sorted(
    glob.glob(os.path.join(root, 'article-*.html')) +
    glob.glob(os.path.join(root, 'FF-*.html')) +
    glob.glob(os.path.join(root, 'geopolitics*.html'))
)

modified = 0
skipped = 0

for f in files:
    basename = os.path.basename(f)

    # Skip print variant
    if 'article-9-paper' in basename:
        print(f'  [skip print-variant] {basename}')
        skipped += 1
        continue

    with open(f, encoding='utf-8') as fh:
        src = fh.read()

    # Idempotency check — use the marker string directly
    if MARKER in src:
        print(f'  [skip already-patched] {basename}')
        skipped += 1
        continue

    # Find the last </style>
    idx = src.rfind('</style>')
    if idx < 0:
        print(f'  [skip no-style-tag] {basename}')
        skipped += 1
        continue

    new_src = src[:idx] + PATCH + '\n' + src[idx:]

    with open(f, 'w', encoding='utf-8') as fh:
        fh.write(new_src)

    print(f'  [patched] {basename}')
    modified += 1

print(f'\nModified: {modified}  Skipped: {skipped}  Total: {len(files)}')
