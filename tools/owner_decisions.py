#!/usr/bin/env python3
"""The single owner-approval CLI of the product-transformation program.

Spec: documentation/product-transformation/03-architecture/ARCHITECTURE.md §1.1; gate: tools/test-owner-decisions.py.

  owner_decisions.py [--file DECISIONS.md] decide <D-id> --status ACCEPTED|REJECTED|DEFAULTED --request R<nnn> [--chosen OPT]
  owner_decisions.py [--file DECISIONS.md] propose <D-id> --question Q --options O --default D
  owner_decisions.py [--file DECISIONS.md] list [--status STATUS]
  owner_decisions.py record <kind> <ids...> --request R<nnn> [--set key=value ...]

A session runs `decide` and `record` only from an owner message that names the id; this tool cannot tell, so the
request id is mandatory and written into the row. Exit codes: 0 written, 1 refused (reasons printed), 2 bad input.
Record kinds come from modules that define RECORD_KINDS = {kind: {precondition, apply, load, save}}: every
tools/lib/*.py that defines it, plus files named in OWNER_DECISIONS_PLUGINS (os.pathsep-separated).
"""
import argparse
import datetime
import glob
import importlib.util
import os
import re
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_FILE = os.path.join(ROOT, "documentation", "product-transformation", "DECISIONS.md")
REQUEST_RE = re.compile(r"^R[0-9]{3,4}$")
ID_RE = re.compile(r"^D-[A-Z0-9]+-[0-9]+$")
FINAL = ("ACCEPTED", "REJECTED", "DEFAULTED")
COLUMNS = 7  # Id | Question | Options | Recommended default | Status | Decided by | Date


class Refused(Exception):
    pass


class BadInput(Exception):
    pass


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write_atomic(path, text):
    d = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".owner_decisions.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def cells(line):
    return [c.strip() for c in line.strip().strip("|").split(" | ")]


def row_line(c):
    return "| " + " | ".join(c) + " |"


def find_row(lines, did):
    hits = [i for i, l in enumerate(lines) if l.startswith("| " + did + " |")]
    if len(hits) > 1:
        raise Refused(f"{did} appears {len(hits)} times")
    return hits[0] if hits else None


def check_request(req):
    if not req or not REQUEST_RE.match(req):
        raise BadInput(f"request id {req!r} does not match ^R[0-9]{{3,4}}$")


def check_id(did):
    if not ID_RE.match(did):
        raise BadInput(f"decision id {did!r} does not match D-<PRD>-<n>")


def no_pipe(*values):
    for v in values:
        if "|" in v or "\n" in v:
            raise BadInput("values must not contain '|' or a newline")


def cmd_decide(a):
    check_id(a.id)
    check_request(a.request)
    if a.status not in FINAL:
        raise BadInput("status must be one of " + ", ".join(FINAL))
    text = read(a.file)
    lines = text.split("\n")
    i = find_row(lines, a.id)
    if i is None:
        raise Refused(f"{a.id} is not in {a.file}")
    c = cells(lines[i])
    if len(c) != COLUMNS:
        raise Refused(f"{a.id} row has {len(c)} columns, expected {COLUMNS}")
    if c[4] != "PROPOSED":
        raise Refused(f"{a.id} is {c[4]}, not PROPOSED; a decided row is never rewritten")
    new = list(c)
    if a.chosen:
        no_pipe(a.chosen)
        if a.chosen.strip() != c[3].strip():
            new[3] = f"chosen: {a.chosen} (recommended was: {c[3]})"
    new[4] = a.status
    new[5] = f"owner ({a.request})"
    new[6] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    lines[i] = row_line(new)
    write_atomic(a.file, "\n".join(lines))
    print(f"{a.id}: {a.status} by owner ({a.request})")


def cmd_propose(a):
    check_id(a.id)
    no_pipe(a.question, a.options, a.default)
    text = read(a.file)
    lines = text.split("\n")
    if find_row(lines, a.id) is not None:
        raise Refused(f"{a.id} already exists; ids are never reused")
    rows = [i for i, l in enumerate(lines) if re.match(r"^\| D-[A-Z0-9]+-[0-9]+ \|", l)]
    if not rows:
        raise Refused("no decision table found")
    last = rows[-1]
    lines.insert(last + 1, row_line([a.id, a.question, a.options, a.default, "PROPOSED", "—", "—"]))
    write_atomic(a.file, "\n".join(lines))
    print(f"{a.id}: PROPOSED")


def cmd_list(a):
    for l in read(a.file).split("\n"):
        if re.match(r"^\| D-[A-Z0-9]+-[0-9]+ \|", l):
            c = cells(l)
            if a.status and (len(c) < 5 or c[4] != a.status):
                continue
            print(f"{c[0]}\t{c[4] if len(c) > 4 else '?'}\t{c[1][:100]}")


def load_kinds():
    paths = sorted(glob.glob(os.path.join(ROOT, "tools", "lib", "*.py")))
    extra = os.environ.get("OWNER_DECISIONS_PLUGINS", "")
    paths += [p for p in extra.split(os.pathsep) if p]
    kinds = {}
    for p in paths:
        try:
            src = read(p)
        except OSError:
            continue
        if "RECORD_KINDS" not in src:
            continue
        spec = importlib.util.spec_from_file_location("od_plugin_" + str(len(kinds)), p)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for k, v in getattr(mod, "RECORD_KINDS", {}).items():
            if k in kinds:
                raise Refused(f"record kind {k!r} is defined twice ({p})")
            kinds[k] = v
    return kinds


def cmd_record(a):
    check_request(a.request)
    kinds = load_kinds()
    if a.kind not in kinds:
        raise BadInput(f"unknown record kind {a.kind!r}; known: {', '.join(sorted(kinds)) or 'none'}")
    k = kinds[a.kind]
    extra = {}
    for kv in a.set or []:
        if "=" not in kv:
            raise BadInput(f"--set expects key=value, got {kv!r}")
        key, val = kv.split("=", 1)
        extra[key] = val
    problems = []
    for rid in a.ids:
        problems += [f"{rid}: {p}" for p in k["precondition"](rid)]
    if problems:
        raise Refused("; ".join(problems))
    args = dict(extra, request=a.request, kind=a.kind)
    for rid in a.ids:
        before = k["load"](rid)
        after = k["apply"](before, args)
        if after is before:
            raise Refused(f"{a.kind}.apply mutated the record in place instead of returning a new dict")
        k["save"](rid, after)
        print(f"{a.kind} {rid}: written ({a.request})")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--file", default=DEFAULT_FILE)
    sub = p.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("decide")
    d.add_argument("id")
    d.add_argument("--status", required=True)
    d.add_argument("--request", required=True)
    d.add_argument("--chosen")
    pr = sub.add_parser("propose")
    pr.add_argument("id")
    pr.add_argument("--question", required=True)
    pr.add_argument("--options", required=True)
    pr.add_argument("--default", required=True)
    ls = sub.add_parser("list")
    ls.add_argument("--status")
    r = sub.add_parser("record")
    r.add_argument("kind")
    r.add_argument("ids", nargs="+")
    r.add_argument("--request", required=True)
    r.add_argument("--set", action="append")
    try:
        a = p.parse_args(argv)
    except SystemExit as e:
        return 2 if e.code else 0
    try:
        {"decide": cmd_decide, "propose": cmd_propose, "list": cmd_list, "record": cmd_record}[a.cmd](a)
        return 0
    except BadInput as e:
        print("bad input: " + str(e), file=sys.stderr)
        return 2
    except Refused as e:
        print("refused: " + str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
