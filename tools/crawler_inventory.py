"""Shared, offline publication inventory and crawler policy checks."""

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, unquote, urljoin, urlsplit


SITE_URL = "https://resistancezero.com"
PUBLIC_DIRS = frozenset({"id", "manual", "prd", "network", "dc-market"})

# A class or id naming a tier-gated region, matched after camelCase is split to hyphens.
GATED_MARKER_RE = re.compile(r"(^|[\s_-])(pro|premium|gated|locked|root-gate)([\s_-]|$)")

# Which gate reasons withhold a whole page from the content exports.
#
# `gated-markup` alone does NOT. It marks a tier-gated REGION inside a page whose body is
# served to anonymous visitors — the Pro panel of an article calculator, for example. Forty
# public pages carry one, and treating that as page-level access control withheld the site's
# entire article corpus from llms-full.txt while sitemap.xml and llms.txt went on publishing
# the same URLs as public. A page is withheld only when the PAGE is access-controlled:
# a document-level access call, or a path the root-only inventory lists. The gated regions
# themselves are still never exported — crawler_llms strips those subtrees from the body.
GATE_DOCUMENT_TAGS = frozenset({"html", "body", "main"})
PAGE_LEVEL_GATE_REASONS = frozenset({"runtime-access-check", "auth-root-only-path",
                                     "gated-document"})
EXCLUDE_DIRS = frozenset({
    "node_modules", ".git", "archive", "dcmoc", "Dunia-Emosi", "Apps",
    "Automation", "Article", ".qa-screens", "embed", "prompts", "Data",
    "standarization", "tools", "js", "assets", "css", "images", "fonts",
    "games", "documentation", "scripts", "shared", "pokemondb_hd_alt2",
    "output", "_private",
})
EXCLUDE_FILES = frozenset({
    "article-9-paper.html", "rz-ops-p7x3k9m.html",
    "google1b98e0817bd5aa88.html", "changelog.html", "404.html",
})
SEARCH_AGENTS = frozenset({"robots", "googlebot", "bingbot", "googlebot-news"})
REVIEWED_HUB_NAVIGATION = """
function handleRootCardClick(event) {
    if (window._rzAuth && typeof window._rzAuth.enforceTierFeatureAccess === 'function') {
        var allowed = window._rzAuth.enforceTierFeatureAccess('standards-ltc-lab');
        if (!allowed) { event.preventDefault(); }
        return;
    }
    try {
        var s = JSON.parse(localStorage.getItem('rz_premium_session') || 'null');
        var t = s && s.tier;
        var r = s && s.role;
        var passes = !!s && (t === 'pro' || t === 'root' || r === 'root' || r === 'pro' || r === 'educator');
        if (!passes) { event.preventDefault(); openLogin(); }
    } catch (e) { event.preventDefault(); openLogin(); }
}
var rootCard = document.getElementById('rootStandardsCard');
if (rootCard) { rootCard.addEventListener('click', handleRootCardClick); }
"""


def javascript_tokens(source: str) -> list[str]:
    """Match a reviewed literal structure, preserving strings and ignoring comments."""
    pattern = r'''//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|[^\s]'''
    return [token for token in re.findall(pattern, source)
            if not token.startswith(('//', '/*'))]


def reviewed_hub_navigation(metadata: 'HeadMetadata', path: Path) -> bool:
    """Exempt only the reviewed linked-tool handler and its exact click binding."""
    if path.name != 'datacenter-solutions.html' or metadata.hub_targets != ['standards-ltc-lab.html']:
        return False
    if metadata.in_script or metadata.inline_gate:
        return False
    expected = javascript_tokens(REVIEWED_HUB_NAVIGATION)
    scripts = [javascript_tokens(source) for source in metadata.scripts]
    references = sum(tokens.count('handleRootCardClick') for tokens in scripts)
    if references != 2:
        return False
    matched = False
    for tokens in scripts:
        starts = [position for position in range(len(tokens))
                  if tokens[position:position + len(expected)] == expected]
        if len(starts) > 1:
            return False
        if starts:
            position = starts[0]
            tokens = tokens[:position] + tokens[position + len(expected):]
            matched = True
        if 'enforceTierFeatureAccess' in tokens or '_rzFeatures' in tokens:
            return False
    return matched


class HeadMetadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_head = False
        self.saw_head = False
        self.canonicals = []
        self.noindex = False
        self.redirect = False
        self.title_parts = []
        self.description = ""
        self.in_title = False
        self.in_script = False
        self.gate_reasons = set()
        self.gate_markers = []
        self.scripts = []
        self.script_parts = []
        self.hub_targets = []
        self.inline_gate = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if any(key.startswith('on') and value and re.search(
                r'enforceTierFeatureAccess\s*\(|_rzFeatures\.has\s*\(', value)
                for key, value in attrs):
            self.inline_gate = True
            self.gate_reasons.add('runtime-access-check')
        marker = " ".join((attributes.get(key) or "") for key in ("class", "id"))
        marker = re.sub(r"([a-z])([A-Z])", r"\1-\2", marker).lower()
        if GATED_MARKER_RE.search(marker):
            # Where the marker sits decides what it means. On <html>, <body> or <main> it
            # describes the whole document, so the page is withheld. On anything nested it
            # describes one region, and only that region is stripped from the export.
            if tag in GATE_DOCUMENT_TAGS:
                self.gate_reasons.add("gated-document")
            else:
                self.gate_reasons.add("gated-markup")
            self.gate_markers.append((tag, attributes.get('class'), attributes.get('id')))
        if attributes.get('id') == 'rootStandardsCard':
            self.hub_targets.append(attributes.get('href') if tag == 'a' else None)
        if tag == "script":
            self.in_script = True
            self.script_parts = []
        if tag == "head":
            self.in_head = True
            self.saw_head = True
        if tag == 'meta':
            name = (attributes.get('name') or '').strip().lower()
            tokens = re.split(r'[\s,]+', (attributes.get('content') or '').lower())
            if name in SEARCH_AGENTS and {'noindex', 'none'}.intersection(tokens):
                self.noindex = True
        if not self.in_head:
            return
        if tag == "title":
            self.in_title = True
        if tag == "link" and "canonical" in (attributes.get("rel") or "").lower().split():
            self.canonicals.append((attributes.get("href") or "").strip())
        if tag == "meta":
            name = (attributes.get("name") or "").lower()
            if name == "description":
                self.description = (attributes.get("content") or "").strip()
            if (attributes.get("http-equiv") or "").lower() == "refresh":
                self.redirect = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script":
            self.in_script = False
            self.scripts.append(''.join(self.script_parts))
        if tag == "head":
            self.in_head = False

    def handle_data(self, data):
        if self.in_script:
            self.script_parts.append(data)
        if self.in_head and self.in_title:
            self.title_parts.append(data)
        if self.in_script and re.search(r"enforceTierFeatureAccess\s*\(|_rzFeatures\.has\s*\(", data):
            self.gate_reasons.add("runtime-access-check")


def read_metadata(path):
    metadata = HeadMetadata()
    metadata.feed(Path(path).read_text(encoding="utf-8"))
    metadata.close()
    if reviewed_hub_navigation(metadata, Path(path)):
        metadata.gate_reasons.discard('runtime-access-check')
        if all(marker == ('span', 'ds-badge-pro', None) for marker in metadata.gate_markers):
            metadata.gate_reasons.discard('gated-markup')
    return metadata


def local_url_path(url):
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.netloc != "resistancezero.com"
            or parsed.query or parsed.fragment or not parsed.path.startswith("/")):
        raise ValueError(f"not a clean same-origin canonical: {url}")
    path = unquote(parsed.path)
    if any(part in {".", ".."} for part in path.split("/")) or "\\" in path:
        raise ValueError(f"unsafe canonical path: {url}")
    return path.lstrip("/") + ("index.html" if path.endswith("/") else "")


class RobotsPolicy:
    def __init__(self, text):
        self.groups = []
        self.sitemaps = []
        agents, rules = [], []
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            field, value = (part.strip() for part in line.split(":", 1))
            field = field.lower()
            if field == "sitemap":
                self.sitemaps.append(value)
            elif field == "user-agent":
                if rules:
                    self.groups.append((agents, rules))
                    agents, rules = [], []
                agents.append(value.lower())
            elif agents and field in {"allow", "disallow", "crawl-delay"}:
                rules.append((field, value))
        if agents:
            self.groups.append((agents, rules))

    @property
    def agents(self):
        return sorted({"*", "googlebot", "bingbot"} |
                      {agent for agents, _ in self.groups for agent in agents})

    def rules_for(self, agent):
        matching = [(len(name), rules) for agents, rules in self.groups
                    for name in agents if name != "*" and name in agent.lower()]
        if matching:
            longest = max(length for length, _ in matching)
            return [rule for length, rules in matching if length == longest for rule in rules]
        return [rule for agents, rules in self.groups if "*" in agents for rule in rules]

    def allowed(self, agent, path):
        matches = []
        for field, pattern in self.rules_for(agent):
            if field not in {"allow", "disallow"} or not pattern:
                continue
            anchored = pattern.endswith("$")
            expression = re.escape(pattern[:-1] if anchored else pattern).replace(r"\*", ".*")
            if re.match("^" + expression + ("$" if anchored else ""), path):
                matches.append((len(pattern.rstrip("$").replace("*", "")), field == "allow"))
        return max(matches, default=(0, True))[1]

    def restriction_errors(self):
        baseline = {value for field, value in self.rules_for("*") if field == "disallow" and value}
        errors = []
        for agent in self.agents:
            specific = {value for field, value in self.rules_for(agent) if field == "disallow"}
            for pattern in sorted(baseline):
                probe = pattern.rstrip("$").replace("*", "crawler-probe")
                if pattern not in specific or (not self.allowed("*", probe) and self.allowed(agent, probe)):
                    errors.append(f"robots group {agent} bypasses wildcard restriction {pattern}")
            for field, pattern in self.rules_for(agent):
                if field == "allow" and pattern:
                    probe = pattern.rstrip("$").replace("*", "crawler-probe")
                    if not self.allowed("*", probe) and self.allowed(agent, probe):
                        errors.append(f"robots group {agent} reopens wildcard restriction with Allow {pattern}")
        return errors


def git_html_inventory(root):
    command = ["git", "-C", str(root), "ls-files", "-z"]
    tracked = subprocess.run(command + ["--cached"], capture_output=True, check=True).stdout
    untracked = subprocess.run(command + ["--others", "--exclude-standard"],
                               capture_output=True, check=True).stdout
    tracked_paths = {path.decode("utf-8") for path in tracked.split(b"\0") if path}
    other_paths = {path.decode("utf-8") for path in untracked.split(b"\0") if path}
    return [(path, path in tracked_paths) for path in sorted(tracked_paths | other_paths)
            if path.lower().endswith(".html")]


def root_only_paths(root):
    auth = root / "auth.js"
    if not auth.exists():
        return []
    source = auth.read_text(encoding="utf-8")
    match = re.search(r"\bvar\s+ROOT_ONLY_PATHS\s*=\s*\[([^\]]*)\]", source)
    if not match:
        raise ValueError("Cannot verify auth.js ROOT_ONLY_PATHS; review crawler content policy")
    return re.findall(r"['\"](/[^'\"]*)['\"]", match.group(1))


def exclusion_reason(path, tracked):
    parts = Path(path).parts
    if not tracked:
        return "untracked"
    if any(part in EXCLUDE_DIRS or part.startswith((".", "_")) for part in parts[:-1]):
        return "excluded-directory"
    if path in EXCLUDE_FILES or parts[-1].startswith((".", "_")):
        return "excluded-file"
    if len(parts) > 1 and parts[0] not in PUBLIC_DIRS:
        return "unreviewed-directory"
    return None


def classify_page(root, path, tracked, policy):
    row = {"path": path, "status": exclusion_reason(path, tracked), "loc": None,
           "content_policy": "excluded",
           "lastmod": None, "lastmod_basis": "omitted-no-verified-significant-change-date"}
    errors, warnings = [], []
    if row["status"]:
        if row["status"] == "unreviewed-directory":
            errors.append(f"{path}: publication directory requires explicit review")
        return row, errors, warnings
    target = root / path
    if (target.is_symlink() or not target.is_file()
            or target.resolve() != root.resolve() / path):
        row["status"] = "missing-or-symlink"
        return row, [f"{path}: tracked page missing or symlink"], warnings
    metadata = read_metadata(target)
    source_url = SITE_URL + "/" + quote(path)
    blocked = [agent for agent in policy.agents if not policy.allowed(agent, "/" + quote(path))]
    if metadata.noindex or metadata.redirect:
        row["status"] = "noindex" if metadata.noindex else "redirect"
        if metadata.noindex and blocked:
            warnings.append(f"{path}: robots blocks noindex discovery for {', '.join(blocked)}; not unblocked")
        return row, errors, warnings
    if not metadata.saw_head:
        row["status"] = "invalid-html"
        return row, [f"{path}: missing HTML head"], warnings
    try:
        if len(metadata.canonicals) > 1 or metadata.canonicals == [""]:
            raise ValueError("multiple or empty canonical declarations")
        canonical = urljoin(source_url, metadata.canonicals[0]) if metadata.canonicals else source_url
        canonical_path = local_url_path(canonical)
    except ValueError as error:
        row["status"] = "invalid-canonical"
        return row, [f"{path}: {error}"], warnings
    row["loc"] = canonical
    row["canonical_target"] = canonical_path
    if not metadata.canonicals:
        warnings.append(f"{path}: missing canonical; using file URL")
    if canonical_path != path:
        row["status"] = "canonical-alias"
        return row, errors, warnings
    blocked += [agent for agent in policy.agents if not policy.allowed(agent, urlsplit(canonical).path)]
    if blocked:
        row["status"] = "robots-blocked"
        return row, [f"{path}: public indexable page blocked for {', '.join(sorted(set(blocked)))}"], warnings
    row["status"] = "included"
    row["gate_reasons"] = sorted(metadata.gate_reasons)
    row["content_policy"] = ("metadata-only"
                             if metadata.gate_reasons & PAGE_LEVEL_GATE_REASONS else "public-body")
    return row, errors, warnings


def collect_inventory(root):
    root = Path(root)
    policy = RobotsPolicy((root / "robots.txt").read_text(encoding="utf-8"))
    pages, errors, warnings = [], policy.restriction_errors(), []
    restricted = root_only_paths(root)
    for path, tracked in git_html_inventory(root):
        row, page_errors, page_warnings = classify_page(root, path, tracked, policy)
        if row["status"] == "included" and any(
                "/" + path == prefix or ("/" + path).startswith(prefix + "/") for prefix in restricted):
            row = {**row, "content_policy": "metadata-only",
                   "gate_reasons": sorted(set(row["gate_reasons"]) | {"auth-root-only-path"})}
        pages.append(row)
        errors.extend(page_errors)
        warnings.extend(page_warnings)
    by_path = {row["path"]: row for row in pages}
    for row in pages:
        if row["status"] == "canonical-alias":
            target = by_path.get(row["canonical_target"])
            if not target or target["status"] != "included" or target["loc"] != row["loc"]:
                errors.append(f"{row['path']}: canonical target not independently indexable: {row['loc']}")
    locs = Counter(row["loc"] for row in pages if row["status"] == "included")
    errors.extend(f"duplicate canonical loc: {loc}" for loc, count in locs.items() if count > 1)
    return {"schema_version": 1, "scope": "tracked HTML plus nonignored untracked exclusions; no live HTTP checks",
            "counts": dict(sorted(Counter(row["status"] for row in pages).items())),
            "content_counts": dict(sorted(Counter(row["content_policy"] for row in pages).items())),
            "pages": pages, "errors": sorted(errors), "warnings": sorted(warnings)}
