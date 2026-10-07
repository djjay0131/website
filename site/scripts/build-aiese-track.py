#!/usr/bin/env python3
"""Build the site data for research/governed-agentic-research/ai-in-empirical-se/
from the research store in djjay0131/ai-empirical-se-chapter
(docs/research/ai-in-empirical-se/, branch research/ai-in-empirical-se).

  python3 site/scripts/build-aiese-track.py <store-dir> [<literature-gap.md>]

Writes site/src/data/governed-agentic-research/ai-in-empirical-se/
  sources.json      explorer-shaped records (category := lifecycle_stage,
                    verification := {verdict, notes}); extra fields kept
  synthesis.html    SYNTHESIS.md rendered, `record-id` -> cite links
  consensus.json    the eight channel files: query, synthesis_html, cited_html
  literature-gap.html  the plan's Task 1 table (derived view of a control-plane doc)
"""
import json, re, sys, html, pathlib, markdown

store = pathlib.Path(sys.argv[1])
gap_md = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else store / "literature-gap.md"
out = pathlib.Path(__file__).resolve().parents[1] / "src/data/governed-agentic-research/ai-in-empirical-se"
out.mkdir(parents=True, exist_ok=True)

records = json.load(open(store / "sources.json"))
ids = {r["id"]: r for r in records}

def to_explorer(r):
    v = r.get("verification")
    if isinstance(v, dict): ver = {"verdict": v.get("verdict", "UNCHECKED"), "notes": v.get("notes")}
    else: ver = {"verdict": v or "UNCHECKED", "notes": None}
    o = dict(r)
    o["category"] = r.get("lifecycle_stage") or []
    o["verification"] = ver
    o["found_via"] = r.get("found_via") or "web"
    return o

json.dump([to_explorer(r) for r in records], open(out / "sources.json", "w"), indent=1, ensure_ascii=False)

MD = lambda s: markdown.markdown(s, extensions=["tables", "sane_lists"])

def cite(m):
    rid = m.group(1)
    if rid in ids:
        t = html.escape(ids[rid]["title"][:60] + ("…" if len(ids[rid]["title"]) > 60 else ""))
        return f'<a class="cite" href="../sources/#{rid}" title="{t}">[{rid}]</a>'
    return m.group(0)

def render(md_text):
    h = MD(md_text)
    return re.sub(r"<code>([a-z0-9][a-z0-9-]+-\d{4}-[a-z0-9-]+)</code>", cite, h)

# ---- synthesis: drop the H1 and the header metadata lines; keep the caveat blockquote and all sections
syn = open(store / "SYNTHESIS.md").read()
syn = re.sub(r"^# .*\n", "", syn, count=1)
syn = re.sub(r"^\*\*(Date|Inputs|Records|Verification status):\*\*.*\n", "", syn, flags=re.M)
open(out / "synthesis.html", "w").write(render(syn.strip()))

# ---- consensus channel files
queries = []
for f in sorted((store / "consensus").glob("q*.md")):
    t = open(f).read()
    slug = f.stem
    label = slug.split("-")[0].upper()
    title = re.match(r"# q\d+ — (.*)", t).group(1).strip()
    qm = re.search(r"\*\*Query \(exact text\):\*\* `([^`]+)`", t)
    query = qm.group(1) if qm else ""
    def section(name):
        m = re.search(rf"^## {name}.*?\n(.*?)(?=^## |\Z)", t, flags=re.M | re.S)
        return m.group(1).strip() if m else ""
    queries.append({
        "slug": slug, "label": label, "title": title, "query": query, "url": None,
        "synthesis_html": render(section("Synthesis")),
        "cited_html": MD(section(r"Ranked results")),
    })
json.dump(queries, open(out / "consensus.json", "w"), indent=1, ensure_ascii=False)

# ---- literature gap table (derived view; the control-plane doc is named on the page)
gap = open(gap_md).read()
gap = re.sub(r"^# .*\n", "", gap, count=1)
open(out / "literature-gap.html", "w").write(render(gap.strip()))

print(f"records={len(records)} queries={len(queries)} synthesis={len(open(out/'synthesis.html').read())}B gap={len(open(out/'literature-gap.html').read())}B")
