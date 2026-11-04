#!/usr/bin/env python3
"""Deep structural analysis of the three POLYMAT HTML files."""
import re, os

BASE = "/home/z/my-project/upload/_polymat_7z"
FILES = [
    "GOLOGRAMMA_v1_V_EGO_SHABLONE_2026-08-30.html",
    "HTML_DIFF_EVOLUTION_vs_MAKT_FULL.html",
    "MAKT-2026_v110_INTEGRATED_ETALON.html",
]

for f in FILES:
    p = os.path.join(BASE, f)
    data = open(p, encoding="utf-8", errors="replace").read()
    print("=" * 80)
    print("FILE:", f)
    print("=" * 80)

    # Headings
    for tag in ["h1", "h2", "h3"]:
        heads = re.findall(rf"<{tag}[^>]*>(.*?)</{tag}>", data, re.S | re.I)
        heads = [re.sub(r"<[^>]+>", " ", h) for h in heads]
        heads = [re.sub(r"\s+", " ", h).strip() for h in heads]
        heads = [h for h in heads if h]
        print(f"\n-- {tag.upper()} ({len(heads)}) --")
        for h in heads[:22]:
            print("   *", h[:110])

    # Comments / hints in code
    comments = re.findall(r"<!--(.*?)-->", data, re.S)
    comments = [c.strip() for c in comments if len(c.strip()) > 20]
    print(f"\n-- COMMENTS ({len(comments)}) --")
    for c in comments[:6]:
        print("   #", re.sub(r"\s+", " ", c)[:160])

    # data attributes / section ids to sense structure
    ids = re.findall(r'id="([^"]+)"', data)
    uniq = []
    for i in ids:
        if i not in uniq:
            uniq.append(i)
    print(f"\n-- IDS ({len(uniq)} unique, first 30) --")
    print("   ", uniq[:30])
    print()
