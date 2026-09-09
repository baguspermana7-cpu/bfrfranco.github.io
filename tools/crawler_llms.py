"""Common discovery helpers; withhold bodies when access checks are detected."""

import argparse
import re
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys

from crawler_inventory import GATED_MARKER_RE, collect_inventory, read_metadata


METADATA_ONLY_NOTICE = "[metadata-only: access checks detected; body intentionally not exported]"
GATED_REGION_NOTICE = "[tier-gated region omitted]"


class PublicBodyParser(HTMLParser):
    """Collect complete main containers, falling back to the complete body."""

    EXCLUDED = frozenset({'head', 'script', 'style', 'nav', 'footer', 'noscript',
                          'template', 'svg', 'canvas'})
    VOID = frozenset({'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
                      'link', 'meta', 'param', 'source', 'track', 'wbr'})

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.body_parts: list[str] = []
        self.main_parts: list[str] = []
        self.saw_main = False
        # Depth of the outermost tier-gated region currently open, or None outside one.
        # A page can be public while a region inside it is not; that region's markup is
        # replaced by one notice so the export says something was withheld rather than
        # silently dropping it.
        self.gated_depth: int | None = None

    def emit(self, text: str) -> None:
        """Collect only content outside excluded and tier-gated subtrees."""
        if any(tag in self.EXCLUDED for tag in self.stack):
            return
        if self.gated_depth is not None:
            return
        if 'body' in self.stack:
            self.body_parts.append(text)
        if 'main' in self.stack:
            self.main_parts.append(text)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == 'main' and not any(parent in self.EXCLUDED for parent in self.stack):
            self.saw_main = True
        attributes = dict(attrs)
        marker = ' '.join((attributes.get(key) or '') for key in ('class', 'id'))
        marker = re.sub(r'([a-z])([A-Z])', r'\1-\2', marker).lower()
        opening_gate = self.gated_depth is None and bool(GATED_MARKER_RE.search(marker))
        if opening_gate:
            self.emit(GATED_REGION_NOTICE)
        if tag not in self.VOID:
            self.stack.append(tag)
        if opening_gate and tag not in self.VOID:
            self.gated_depth = len(self.stack)
        rendered = ''.join(f' {key}="{escape(value or "", quote=True)}"'
                           for key, value in attrs)
        self.emit(f'<{tag}{rendered}>')

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        self.emit(f'</{tag}>')
        if tag in self.stack:
            position = len(self.stack) - 1 - self.stack[::-1].index(tag)
            self.stack = self.stack[:position]
            if self.gated_depth is not None and len(self.stack) < self.gated_depth:
                self.gated_depth = None

    def handle_data(self, data: str) -> None:
        self.emit(escape(data, quote=False))

    def content(self) -> str:
        """Return all selected content without a first-card shortcut."""
        return ''.join(self.main_parts if self.saw_main else self.body_parts)


def extract_public_body(source: str) -> str:
    """Select public body markup structurally, ignoring comments and inert blocks."""
    parser = PublicBodyParser()
    parser.feed(source)
    parser.close()
    return parser.content()


def publication_pages(root, inventory=None):
    inventory = inventory if inventory is not None else collect_inventory(root)
    if inventory["errors"]:
        raise ValueError("\n".join(inventory["errors"]))
    return [page for page in inventory["pages"] if page["status"] == "included"]


def extract_meta(path):
    metadata = read_metadata(path)
    title = " ".join("".join(metadata.title_parts).split()) or Path(path).name
    description = " ".join(metadata.description.split())
    return title, description


def markdown_label(text):
    return text.replace("\\", "\\\\").replace("[", r"\[").replace("]", r"\]")


def run_builder(builder, filename):
    parser = argparse.ArgumentParser(description=f"Generate {filename} from crawler inventory")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Write output (also the default)")
    mode.add_argument("--check", action="store_true", help="Fail if output differs; do not write")
    mode.add_argument("--dry-run", action="store_true", help="Print output without writing")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    try:
        content = builder(root)
        target = root / filename
        if args.check:
            if target.read_text(encoding="utf-8") != content:
                raise ValueError(f"{filename} is stale; regenerate its builder with --apply")
            print(f"Current: {filename}")
        elif args.dry_run:
            print(content, end="")
        else:
            target.write_text(content, encoding="utf-8")
            print(f"Written: {filename} ({len(content.encode('utf-8')):,} bytes)")
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"Crawler export failed: {error}", file=sys.stderr)
        return 1
    return 0
