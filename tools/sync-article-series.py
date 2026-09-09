"""Check series navigation against published search-index URLs; --patch emits a patch."""

import argparse
import difflib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
FAMILIES = ("article", "FF", "geopolitics")
NAVIGATION = re.compile(
    r'(<div class="series-nav"[^>]*>\s*<div class="series-badge"[^>]*>)'
    r'(?P<badge>.*?)'
    r'(</div>\s*<span class="series-title">.*?</span>\s*'
    r'<div class="series-links">)(?P<links>.*?)(</div>\s*</div>)',
    re.DOTALL,
)
CONTROL = re.compile(
    r'<(?P<tag>a|span)\b(?P<attrs>[^>]*)>(?P<body>.*?)</(?P=tag)>',
    re.DOTALL,
)


def published_families(root: Path) -> dict[str, list[str]]:
    rows = json.loads((root / "search-index.json").read_text())
    result = {}
    for family in FAMILIES:
        pattern = re.compile(rf"{family}-(\d+)\.html")
        names = [row["url"] for row in rows if pattern.fullmatch(row.get("url", ""))]
        if len(names) != len(set(names)):
            raise ValueError(f"Duplicate published URL in {family}")
        if not names or any(not (root / name).is_file() for name in names):
            raise ValueError(f"Missing published source in {family}")
        result[family] = sorted(names, key=lambda name: int(pattern.fullmatch(name)[1]))
    return result


def sync_control(match: re.Match, previous: str | None, following: str | None) -> str:
    body = match["body"]
    label = re.sub(r"<[^>]+>", "", body).strip()
    if label not in ("Prev", "Next"):
        raise ValueError(f"Unexpected series control: {label}")
    target = previous if label == "Prev" else following
    attrs = match["attrs"]
    if target:
        attrs = re.sub(r'\s+href="[^"]*"', "", attrs)
        attrs = attrs.replace('class="series-link disabled"', 'class="series-link"')
        attrs = re.sub(r'\s+style="opacity:0\.4;pointer-events:none;"', "", attrs)
        return f'<a href="{target}"{attrs}>{body}</a>'
    attrs = re.sub(r'\s+href="[^"]*"', "", attrs)
    attrs = re.sub(r'\s+style="opacity:0\.4;pointer-events:none;"', "", attrs)
    attrs = attrs.replace('class="series-link"', 'class="series-link disabled"')
    return f'<span{attrs}>{body}</span>'


def sync_navigation(text: str, names: list[str], position: int) -> str:
    matches = list(NAVIGATION.finditer(text))
    if len(matches) != 1:
        raise ValueError(f"Expected one series navigation in {names[position]}")
    match = matches[0]
    badge = match["badge"]
    count = f"Article {position + 1} of {len(names)}"
    if re.search(r"Article \d+(?: of \d+)?", badge):
        badge = re.sub(r"Article \d+(?: of \d+)?", count, badge)
    else:
        badge = badge.rstrip() + " &mdash; " + count + badge[len(badge.rstrip()):]
    previous = names[position - 1] if position else None
    following = names[position + 1] if position + 1 < len(names) else None
    links, total = CONTROL.subn(
        lambda control: sync_control(control, previous, following), match["links"]
    )
    if total != 2:
        raise ValueError(f"Expected two series controls in {names[position]}")
    replacement = match[1] + badge + match[3] + links + match[5]
    return text[:match.start()] + replacement + text[match.end():]


def collect_changes(root: Path) -> list[tuple[str, str, str]]:
    changes = []
    for names in published_families(root).values():
        for position, name in enumerate(names):
            before = (root / name).read_text()
            after = sync_navigation(before, names, position)
            after = sync_footer(after, names, position)
            if before != after:
                changes.append((name, before, after))
    return changes


def sync_footer(text: str, names: list[str], position: int) -> str:
    if position + 1 == len(names):
        return text
    following = names[position + 1]
    pattern = re.compile(r'<div class="article-nav"[^>]*>.*?</div>', re.DOTALL)

    def replace_footer(match: re.Match) -> str:
        block = match[0]
        if f'href="{following}"' in block:
            return block
        link = f'<a href="{following}">Next Article <i class="fas fa-arrow-right"></i></a>'
        latest = re.compile(r'<span[^>]*>Latest Article</span>')
        if latest.search(block):
            return latest.sub(link, block)
        if re.search(r'>\s*Next Article\b', block):
            raise ValueError(f"Wrong footer destination in {names[position]}")
        return block.replace('</div>', f'    {link}\n    </div>')

    return pattern.sub(replace_footer, text)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--patch", action="store_true")
    args = parser.parse_args()
    changes = collect_changes(ROOT)
    if args.patch:
        print("*** Begin Patch")
        for name, before, after in changes:
            print(f"*** Update File: {ROOT / name}")
            for line in list(difflib.unified_diff(before.splitlines(), after.splitlines()))[2:]:
                print("@@" if line.startswith("@@") else line)
        print("*** End Patch")
    else:
        for name, before, after in changes:
            print(f"STALE {name}")
        print(f"{len(changes)} stale series navigation blocks")
    return int(bool(changes) and not args.patch)


if __name__ == "__main__":
    raise SystemExit(main())
