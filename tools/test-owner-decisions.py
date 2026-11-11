#!/usr/bin/env python3
"""Gate for tools/owner_decisions.py, the single owner-approval CLI (ARCHITECTURE.md §1.1).

Runs the CLI as a subprocess against a temporary copy of a small DECISIONS table, never the real file.
Laws:
  L1 decide rewrites exactly one PROPOSED row (status, decided-by, date) and nothing else.
  L2 decide refuses a row that is not PROPOSED (exit 1) and leaves the file byte-identical.
  L3 a request id outside ^R[0-9]{3,4}$ is exit 2 and the file is untouched.
  L4 an unknown decision id is exit 1 and the file is untouched.
  L5 --chosen writes the chosen option into "Recommended default".
  L6 propose appends a PROPOSED row; a duplicate id is refused (exit 1).
  L7 record with an unknown kind is exit 2; a registered kind writes through apply() and a failed precondition is exit 1.
  L8 list --status prints only rows with that status.
Exit 0 when every law holds, 1 otherwise.
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLI = os.path.join(ROOT, "tools", "owner_decisions.py")

TABLE = """# Owner decisions

Intro text that must survive.

| Id | Question | Options | Recommended default | Status | Decided by | Date |
|---|---|---|---|---|---|---|
| D-Q01-1 | First question? | A yes. B no | A | PROPOSED | — | — |
| D-Q01-2 | Second question? | A keep. B drop | B | ACCEPTED | owner (R100) | 2026-11-01 |
| D-Q04-1 | Third question? | A one. B two | A | PROPOSED | — | — |

Trailing text that must survive.
"""

failures = []


def law(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else " — " + detail))
    if not ok:
        failures.append(name)


def run(args, env_extra=None):
    env = dict(os.environ)
    if env_extra:
        env.update(env_extra)
    p = subprocess.run([sys.executable, CLI] + args, capture_output=True, text=True, env=env)
    return p.returncode, p.stdout + p.stderr


def fresh(tmp):
    path = os.path.join(tmp, "DECISIONS.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(TABLE)
    return path


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def row(text, did):
    for line in text.splitlines():
        if line.startswith("| " + did + " |"):
            return [c.strip() for c in line.strip().strip("|").split("|")]
    return None


def main():
    if not os.path.exists(CLI):
        print("FAIL tools/owner_decisions.py does not exist")
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        f = fresh(tmp)
        code, out = run(["--file", f, "decide", "D-Q01-1", "--status", "ACCEPTED", "--request", "R115"])
        after = read(f)
        r = row(after, "D-Q01-1")
        others_same = all(row(after, d) == row(TABLE, d) for d in ("D-Q01-2", "D-Q04-1"))
        law("L1 decide rewrites one PROPOSED row", code == 0 and r and r[4] == "ACCEPTED" and r[5] == "owner (R115)"
            and len(r[6]) == 10 and others_same and "Intro text that must survive." in after
            and "Trailing text that must survive." in after, f"exit {code}: {out.strip()[:200]} row={r}")

        f = fresh(tmp)
        code, out = run(["--file", f, "decide", "D-Q01-2", "--status", "REJECTED", "--request", "R115"])
        law("L2 refuses a non-PROPOSED row, file unchanged", code == 1 and read(f) == TABLE, f"exit {code}")

        bad_ok = True
        for bad in ("R12", "r115", "R12345", "115", "R115x"):
            f = fresh(tmp)
            code, _ = run(["--file", f, "decide", "D-Q01-1", "--status", "ACCEPTED", "--request", bad])
            bad_ok = bad_ok and code == 2 and read(f) == TABLE
        law("L3 bad request id is exit 2, file unchanged", bad_ok)

        f = fresh(tmp)
        code, _ = run(["--file", f, "decide", "D-Q99-9", "--status", "ACCEPTED", "--request", "R115"])
        law("L4 unknown id is exit 1, file unchanged", code == 1 and read(f) == TABLE, f"exit {code}")

        f = fresh(tmp)
        code, out = run(["--file", f, "decide", "D-Q04-1", "--status", "ACCEPTED", "--request", "R115", "--chosen", "B"])
        r = row(read(f), "D-Q04-1")
        law("L5 --chosen recorded", code == 0 and r and "chosen" in r[3] and "B" in r[3], f"exit {code} row={r}")

        f = fresh(tmp)
        code, out = run(["--file", f, "propose", "D-Q05-1", "--question", "New question?",
                         "--options", "A x. B y", "--default", "A"])
        r = row(read(f), "D-Q05-1")
        code2, _ = run(["--file", f, "propose", "D-Q05-1", "--question", "Again?", "--options", "A", "--default", "A"])
        law("L6 propose appends PROPOSED, duplicate refused",
            code == 0 and r and r[4] == "PROPOSED" and r[5] == "—" and code2 == 1
            and read(f).index("D-Q05-1") < read(f).index("Trailing text"), f"exit {code}/{code2} row={r}")

        # L7: a test kind registered through an env-provided plugin module
        plug = os.path.join(tmp, "kinds_test.py")
        data = os.path.join(tmp, "records.json")
        with open(data, "w") as fh:
            json.dump({"a1": {"status": "proposed"}, "a2": {"status": "retired"}}, fh)
        with open(plug, "w") as fh:
            fh.write(
                "import json\n"
                f"DATA = {data!r}\n"
                "def _load():\n    return json.load(open(DATA))\n"
                "def precondition(rid):\n"
                "    d = _load()\n"
                "    if rid not in d: return ['unknown record ' + rid]\n"
                "    if d[rid]['status'] == 'retired': return ['record is retired']\n"
                "    return []\n"
                "def apply(rec, args):\n"
                "    new = dict(rec); new.update({'status': 'accepted', 'decidedBy': 'owner', 'request': args['request']})\n"
                "    return new\n"
                "def load(rid): return _load()[rid]\n"
                "def save(rid, rec):\n"
                "    d = _load(); d[rid] = rec; json.dump(d, open(DATA, 'w'))\n"
                "RECORD_KINDS = {'test-kind': {'precondition': precondition, 'apply': apply, 'load': load, 'save': save}}\n")
        env = {"OWNER_DECISIONS_PLUGINS": plug}
        c_unknown, _ = run(["record", "nope-kind", "a1", "--request", "R115"], env)
        c_ok, out_ok = run(["record", "test-kind", "a1", "--request", "R115"], env)
        rec = json.load(open(data))
        c_pre, _ = run(["record", "test-kind", "a2", "--request", "R115"], env)
        rec2 = json.load(open(data))
        law("L7 record: unknown kind 2, written via apply, failed precondition 1",
            c_unknown == 2 and c_ok == 0 and rec["a1"]["status"] == "accepted" and rec["a1"]["request"] == "R115"
            and c_pre == 1 and rec2["a2"]["status"] == "retired",
            f"exits {c_unknown}/{c_ok}/{c_pre} out={out_ok.strip()[:160]}")

        f = fresh(tmp)
        code, out = run(["--file", f, "list", "--status", "PROPOSED"])
        law("L8 list filters by status", code == 0 and "D-Q01-1" in out and "D-Q04-1" in out and "D-Q01-2" not in out,
            f"exit {code}: {out[:200]}")

    print(("FAIL — %d law(s) broken" % len(failures)) if failures else "PASS — owner_decisions CLI holds all 8 laws")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
