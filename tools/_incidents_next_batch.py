#!/usr/bin/env python3
"""Emit the next N un-researched incidents from data/incidents/_master-list.json
as a compact args array for the Phase C research Workflow. Usage:
  python3 tools/_incidents_next_batch.py [N]
Excludes incidents whose dossier JSON already exists + a known-duplicate skip set."""
import json, os, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 5
SKIP = {
    'gcp-global-service-control-outage-2025',
    'kakao-sk-cc-pangyo-datacenter-fire-2022',
    'facebook-bgp-backbone-outage-2021',
}
master = json.load(open(os.path.join(ROOT, 'data/incidents/_master-list.json')))
done = {os.path.basename(f)[:-5] for f in glob.glob(os.path.join(ROOT, 'data/incidents/*.json'))
        if not os.path.basename(f).startswith('_')}
batch, remaining = [], 0
for x in master['incidents']:
    if x['slug'] in done or x['slug'] in SKIP:
        continue
    remaining += 1
    if len(batch) < N:
        batch.append({
            'slug': x['slug'], 'title': x['title'], 'operator': x['operator'],
            'dcName': x.get('dcName', ''), 'location': x.get('location', {}),
            'date': x['date'], 'category': x.get('category', []),
            'brief': x['brief'], 'officialPostmortem': x['officialPostmortem'],
            'sources': x.get('candidateSources', [])[:3],
        })
sys.stderr.write(f"[next-batch] {len(batch)} incidents · {remaining - len(batch)} remain after · {len(done)} done\n")
print(json.dumps(batch, ensure_ascii=False))
