#!/usr/bin/env python3
"""
rebuild-codebase-graph.py — regenerate the Second Brain "Codebase Graph" layer.

Pipeline (all local, no API key — code-only AST):
  1. graphify extract <dirs>       -> ~/.graphify/rz-code/graphify-out/graph.json
  2. graphify cluster-only         -> names communities + GRAPH_REPORT.md + graph.html
  3. graphify export obsidian      -> obsidian-knowledge-vault/09-Codebase/ (markdown + canvas)
  4. inject the Second-Brain root-gate into graph.html -> codebase-graph.html (root-only)
  5. (optional) codebase-memory-mcp cli index_repository -> live MCP query graph

Run:  python3 "Apps/second brain/rebuild-codebase-graph.py"
Deps: ~/.venvs/graphify (graphifyy), ~/.local/bin/codebase-memory-mcp
"""
import os
import subprocess
import sys

SB = os.path.dirname(os.path.abspath(__file__))
RZ = os.path.abspath(os.path.join(SB, "../../"))
GRAPHIFY = os.path.expanduser("~/.venvs/graphify/bin/graphify")
CODEMEM = os.path.expanduser("~/.local/bin/codebase-memory-mcp")
OUT = os.path.expanduser("~/.graphify/rz-code")
GRAPH_JSON = os.path.join(OUT, "graphify-out", "graph.json")
GRAPH_HTML = os.path.join(OUT, "graphify-out", "graph.html")
VAULT = os.path.join(SB, "obsidian-knowledge-vault", "09-Codebase")

# Code dirs to graph, extracted SEPARATELY then merged (a single site-wide extract with the
# similarity pass on 1000+ files OOMs here, and `extract a b c` only scans the first root).
# Add dirs as needed — each is scanned recursively into its own graph, then merge-graphs unions them.
SCOPE = os.environ.get("CBG_SCOPE", "js dcmoc/src supabase worker worker-auth cf-worker Apps/dca-app/src").split()
MERGED = os.path.expanduser("~/.graphify/rz-merged")


def run(cmd, **kw):
    print("· " + " ".join(cmd))
    return subprocess.run(cmd, cwd=RZ, **kw)


def inject_gate(graph_html, out_path):
    src = open(graph_html, encoding="utf-8").read()
    head = ('<style>\n'
            '  .root-gate{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:rgba(6,9,13,.72);backdrop-filter:blur(4px)}\n'
            '  body.locked .root-gate{display:flex}\n'
            '  body.locked > *:not(.root-gate):not(#rzModalOverlay):not(script):not(style){filter:blur(7px);pointer-events:none;user-select:none}\n'
            '  .root-gate-card{background:#121820;border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:2rem 2.2rem;max-width:360px;text-align:center;font-family:\'JetBrains Mono\',ui-monospace,monospace;color:#e7edf3;box-shadow:0 20px 60px rgba(0,0,0,.5)}\n'
            '  .root-gate-card .lock{width:54px;height:54px;margin:0 auto 1rem;border-radius:12px;background:#f59e0b;color:#0b0f14;display:flex;align-items:center;justify-content:center;font-size:1.5rem}\n'
            '  .root-gate-card h2{margin:0 0 .5rem;font-size:1.15rem;color:#f6f7f9}\n'
            '  .root-gate-card p{margin:0 0 1.2rem;font-size:.82rem;color:#93a1b0;line-height:1.5}\n'
            '  .root-gate-actions{display:flex;gap:.6rem;justify-content:center}\n'
            '  .root-gate-actions .login{background:#8b5cf6;color:#fff;border:none;border-radius:8px;padding:.55rem 1.1rem;cursor:pointer;font:inherit;font-weight:600}\n'
            '  .root-gate-actions .back{color:#93a1b0;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:.55rem 1.1rem;text-decoration:none}\n'
            '  .cbg-nav{position:fixed;top:0;left:0;right:0;z-index:8000;display:flex;align-items:center;gap:.8rem;padding:.5rem 1rem;background:rgba(3,7,16,.9);border-bottom:1px solid rgba(255,255,255,.1);font-family:\'JetBrains Mono\',monospace;font-size:.78rem;color:#93a1b0}\n'
            '  .cbg-nav a{color:#8b5cf6;text-decoration:none} .cbg-nav b{color:#e7edf3}\n'
            '</style>\n'
            '<script src="../../js/rz-feature-flags.js?v=2026-07-21" defer></script>\n'
            '<script src="../../auth.js?v=2026-07-24a" defer></script>')
    body = ('<nav class="cbg-nav"><a href="index.html">← Second Brain</a><span>·</span><b>Codebase Graph</b>'
            '<span>· rz-work code knowledge graph (graphify · codebase-memory-mcp)</span></nav>\n'
            '<div class="root-gate" id="rootGate" aria-live="polite"><div class="root-gate-card">'
            '<div class="lock">&#128274;</div><h2>Root access required</h2>'
            '<p>The codebase knowledge graph is restricted to root accounts. Sign in with a root account to continue.</p>'
            '<div class="root-gate-actions"><button class="login" id="rootLoginBtn" type="button">Sign In</button>'
            '<a class="back" href="index.html">Back</a></div></div></div>')
    script = ('<script>(function(){'
              'function isRoot(){try{var s=JSON.parse(localStorage.getItem("rz_premium_session")||"null");if(!s)return false;'
              'var r=s.role,e=(s.email||"").toLowerCase();return r==="root"||e==="bagus@resistancezero.com"||e==="admin@resistancezero.com";}catch(x){return false;}}'
              'function ag(){try{if(window._rzAuth&&typeof window._rzAuth.enforceTierFeatureAccess==="function"){window._rzAuth.enforceTierFeatureAccess("second-brain");}}catch(e){}'
              'if(isRoot())document.body.classList.remove("locked");else document.body.classList.add("locked");}'
              'var b=document.getElementById("rootLoginBtn");if(b)b.addEventListener("click",function(){if(window._rzAuth&&typeof window._rzAuth.showModal==="function")window._rzAuth.showModal();});'
              'window.addEventListener("rz-auth-change",function(){setTimeout(ag,50);});'
              'window.addEventListener("storage",function(e){if(e.key==="rz_premium_session")ag();});'
              'ag();setTimeout(ag,60);setTimeout(ag,550);setTimeout(ag,1600);'
              'setInterval(function(){if(!isRoot()&&!document.body.classList.contains("locked"))document.body.classList.add("locked");},1000);'
              '})();</script>')
    src = src.replace("</head>", head + "\n</head>", 1)
    src = src.replace("<body>", "<body>\n" + body, 1)
    src = src.replace("</body>", script + "\n</body>", 1)
    src = src.replace("<title>graphify", "<title>Codebase Graph — Second Brain · graphify", 1)
    open(out_path, "w", encoding="utf-8").write(src)
    print(f"  wrote {out_path} ({len(src)//1024} KB, root-gated)")


def main():
    if not os.path.exists(GRAPHIFY):
        sys.exit("graphify not found at " + GRAPHIFY + " — pip install graphifyy in ~/.venvs/graphify")
    # 1. extract each scope dir into its own graph
    graphs = []
    for d in SCOPE:
        out = os.path.expanduser("~/.graphify/rz-" + d.replace("/", "-"))
        run([GRAPHIFY, "extract", d, "--code-only", "--out", out], check=True)
        graphs.append(os.path.join(out, "graphify-out", "graph.json"))
    # 2. merge into one code graph (single dir → no merge needed)
    os.makedirs(os.path.join(MERGED, "graphify-out"), exist_ok=True)
    merged_json = os.path.join(MERGED, "graphify-out", "graph.json")
    if len(graphs) == 1:
        import shutil
        shutil.copy(graphs[0], merged_json)
    else:
        run([GRAPHIFY, "merge-graphs", *graphs, "--out", merged_json], check=True)
    # 2b. OPTIONAL docs/PDF/SQL semantic layer — LOCAL via ollama (no cloud key, no cost).
    #     Slow (one local-LLM call per doc), so opt-in: CBG_DOCS=1 [CBG_DOCS_DIRS="standarization documentation"].
    #     Requires a chat model in ollama (qwen2.5 / llama3.2 / deepseek-r1). Merged into the graph.
    if os.environ.get("CBG_DOCS") == "1":
        backend = os.environ.get("CBG_BACKEND", "ollama")
        for d in os.environ.get("CBG_DOCS_DIRS", "standarization documentation").split():
            if not os.path.isdir(os.path.join(RZ, d)):
                continue
            out = os.path.expanduser("~/.graphify/rz-docs-" + d.replace("/", "-"))
            run([GRAPHIFY, "extract", d, "--backend", backend, "--out", out])
            dj = os.path.join(out, "graphify-out", "graph.json")
            if os.path.exists(dj):
                run([GRAPHIFY, "merge-graphs", merged_json, dj, "--out", merged_json])
    # 3. cluster (names communities + builds graph.html), export Obsidian, inject the root gate
    run([GRAPHIFY, "cluster-only", MERGED])
    run([GRAPHIFY, "export", "obsidian", "--graph", merged_json, "--dir", VAULT])
    inject_gate(os.path.join(MERGED, "graphify-out", "graph.html"), os.path.join(SB, "codebase-graph.html"))
    if os.path.exists(CODEMEM):
        run([CODEMEM, "cli", "index_repository", "--repo-path", RZ, "--mode", "moderate", "--persistence", "true"])
    print("\n✓ Codebase Graph rebuilt. Open Second Brain → Codebase Graph (root only), or the vault's 09-Codebase in Obsidian.")


if __name__ == "__main__":
    main()
