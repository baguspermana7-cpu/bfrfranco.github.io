#!/usr/bin/env python3
"""
build-incidents-vectors.py — preserve the DC-incident research as a lock-free,
semantically-searchable vector index (so the research is never lost).

Reads data/incidents/*.json → chunks each dossier by section → embeds every chunk
with ollama `nomic-embed-text` → writes:
  - data/incidents/incidents-chunks.jsonl  (text + metadata — the DURABLE, git-committed
    source of truth; the index is fully rebuildable from this even without embeddings)
  - data/incidents/incidents-vectors.npz   (embeddings matrix — regenerable, gitignored)

Incremental: a per-chunk content hash is stored; unchanged chunks reuse their cached
embedding, so re-runs after a new batch are cheap. If ollama is unavailable the JSONL
is still written (zero data loss) and embedding is skipped.

Run:  python3 tools/build-incidents-vectors.py
Query: python3 tools/incidents-search.py "why did generators fail to start"
"""
import json
import glob
import os
import hashlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data", "incidents")
CHUNKS = os.path.join(DATA_DIR, "incidents-chunks.jsonl")
VECTORS = os.path.join(DATA_DIR, "incidents-vectors.npz")
OLLAMA = "http://localhost:11434/api/embeddings"
MODEL = "nomic-embed-text"


def _chunks_for(inc):
    """Yield (section, text) chunks for one incident dossier."""
    slug = inc.get("slug", "")
    out = []
    if inc.get("brief"):
        out.append(("brief", inc["brief"]))
    if inc.get("rootCause"):
        out.append(("root-cause", inc["rootCause"]))
    if inc.get("technicalDeepDive"):
        out.append(("technical", inc["technicalDeepDive"]))
    for e in inc.get("sequenceOfEvents", []):
        out.append(("soe", f'{e.get("t","")} [{e.get("phase","")}] {e.get("event","")}'))
    for x in inc.get("contributingFactors", []):
        out.append(("contributing-factor", x))
    for c in inc.get("coe", []):
        out.append(("coe", f'{c.get("action","")} ({c.get("owner","")} · {c.get("status","")})'))
    for x in inc.get("lessonsLearnt", []):
        out.append(("lesson", x))
    for x in inc.get("improvements", []):
        out.append(("improvement", x))
    for s in inc.get("comprehensiveAnalysis", []):
        out.append(("analysis", f'{s.get("heading","")}: {s.get("body","")}'))
    for m in inc.get("metrics", []):
        out.append(("metric", f'{m.get("label","")}: {m.get("value","")}'))
    return out


def embed(text):
    body = json.dumps({"model": MODEL, "prompt": text}).encode()
    req = urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())["embedding"]


def main():
    files = sorted(f for f in glob.glob(os.path.join(DATA_DIR, "*.json")) if not os.path.basename(f).startswith("_"))
    records = []
    for f in files:
        inc = json.load(open(f, encoding="utf-8"))
        slug = inc.get("slug", os.path.basename(f)[:-5])
        for i, (section, text) in enumerate(_chunks_for(inc)):
            text = (text or "").strip()
            if not text:
                continue
            cid = f"{slug}::{section}::{i}"
            records.append({
                "id": cid, "slug": slug, "title": inc.get("title", ""), "operator": inc.get("operator", ""),
                "date": inc.get("date", ""), "category": inc.get("category", []), "section": section,
                "magnitudeScore": inc.get("_score") or 0, "text": text,
                "hash": hashlib.sha1(text.encode("utf-8")).hexdigest(),
            })

    # write the durable JSONL (text + metadata) — never lost, fully rebuildable
    with open(CHUNKS, "w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"[incidents-vectors] wrote {len(records)} chunks → incidents-chunks.jsonl ({len({r['slug'] for r in records})} incidents)")

    # load cached embeddings (incremental by hash)
    cache = {}
    if os.path.exists(VECTORS):
        try:
            import numpy as np
            z = np.load(VECTORS, allow_pickle=True)
            for h, v in zip(z["hashes"], z["vectors"]):
                cache[str(h)] = v
        except Exception:
            cache = {}

    todo = [r for r in records if r["hash"] not in cache]
    print(f"[incidents-vectors] {len(records) - len(todo)} cached, {len(todo)} to embed via ollama {MODEL}")
    try:
        if todo:
            with ThreadPoolExecutor(max_workers=6) as ex:
                embs = list(ex.map(lambda r: embed(r["text"]), todo))
            for r, e in zip(todo, embs):
                cache[r["hash"]] = e
    except Exception as e:
        print(f"[incidents-vectors] embedding skipped ({e.__class__.__name__}: {e}) — JSONL preserved, rerun when ollama is up")
        return

    import numpy as np
    hashes = [r["hash"] for r in records]
    ids = [r["id"] for r in records]
    mat = np.array([cache[h] for h in hashes], dtype="float32")
    np.savez_compressed(VECTORS, vectors=mat, hashes=np.array(hashes), ids=np.array(ids))
    print(f"[incidents-vectors] wrote {mat.shape[0]}×{mat.shape[1]} embeddings → incidents-vectors.npz")


if __name__ == "__main__":
    main()
