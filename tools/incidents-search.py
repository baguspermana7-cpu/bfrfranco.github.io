#!/usr/bin/env python3
"""
incidents-search.py — semantic search over the DC-incident vector index (lock-free).
Usage:  python3 tools/incidents-search.py "why did generators fail to start" [top_k]
Rebuild the index first with: python3 tools/build-incidents-vectors.py
"""
import json
import os
import sys
import urllib.request
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data", "incidents")
CHUNKS = os.path.join(DATA_DIR, "incidents-chunks.jsonl")
VECTORS = os.path.join(DATA_DIR, "incidents-vectors.npz")


def embed(text):
    body = json.dumps({"model": "nomic-embed-text", "prompt": text}).encode()
    req = urllib.request.Request("http://localhost:11434/api/embeddings", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return np.array(json.loads(r.read())["embedding"], dtype="float32")


def main():
    if len(sys.argv) < 2:
        print("usage: incidents-search.py \"<query>\" [top_k]"); return
    q = sys.argv[1]
    k = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    if not os.path.exists(VECTORS):
        print("No index yet — run: python3 tools/build-incidents-vectors.py"); return
    z = np.load(VECTORS, allow_pickle=True)
    mat, ids = z["vectors"], [str(x) for x in z["ids"]]
    meta = {}
    for line in open(CHUNKS, encoding="utf-8"):
        r = json.loads(line); meta[r["id"]] = r
    qv = embed(q)
    mn = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)
    qn = qv / (np.linalg.norm(qv) + 1e-9)
    sims = mn @ qn
    order = np.argsort(-sims)[:k]
    print(f"\nTop {k} for: {q}\n" + "─" * 60)
    for i in order:
        r = meta.get(ids[i], {})
        print(f"[{sims[i]:.3f}] {r.get('operator','')} · {r.get('date','')} · {r.get('section','')}")
        print(f"   {r.get('text','')[:200]}")
        print(f"   → incident-{r.get('slug','')}.html\n")


if __name__ == "__main__":
    main()
