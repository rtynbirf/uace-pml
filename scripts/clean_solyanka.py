#!/usr/bin/env python3
"""Генеральная чистка 'солянки' Dola: сегментация по заборам, отбраковка прозы,
склейка JS и пере-разбивка на логические реализации."""
import re, pathlib

SRC = pathlib.Path("/home/z/my-project/upload/Pasted Content_1789811101216.txt")
OUT = pathlib.Path("/home/z/my-project/scripts/solyanka")
OUT.mkdir(parents=True, exist_ok=True)

lines = SRC.read_text(encoding="utf-8").splitlines()

# Ассистентский регион: после "### 🤖 Assistant" (570) код-блок с 572 по 9650
start, end = 572, 9650
region = lines[start-1:end]

# 1) Сегментация по строкам-заборам
fence_re = re.compile(r'^\s*```\w*\s*$')
segs, cur = [], []
for i, ln in enumerate(region):
    if fence_re.match(ln):
        if cur: segs.append(cur)
        cur = []
    else:
        cur.append((start + i, ln))
if cur: segs.append(cur)

def looks_js(seg):
    text = "\n".join(l for _, l in seg)
    js_sigs = [r"function\s", r"=>\s*\{", r"const\s", r"let\s", r"^\s*//", r"\);", r"\};"]
    prose_sigs = [r"^(I |We |Please|How |Here|This |The |It )", r"^[А-ЯЁ][а-яё]+ [а-яё]+ [а-яё]+", r"^\*\*", r"^- ", r"（AI生成）"]
    js = sum(len(re.findall(p, text, re.M)) for p in js_sigs)
    prose = sum(len(re.findall(p, text, re.M)) for p in prose_sigs)
    return js >= prose * 2 and js > 5

js_parts, prose_parts = [], []
for seg in segs:
    (js_parts if looks_js(seg) else prose_parts).append(seg)
print(f"Сегментов всего: {len(segs)}; JS: {len(js_parts)}; проза: {len(prose_parts)}")
for i, seg in enumerate(prose_parts):
    a, b = seg[0][0], seg[-1][0]
    head = " ".join(l.strip() for _, l in seg[:2])[:110]
    print(f"  ПРОЗА {a}-{b}: {head}")

# 2) Склейка всех JS-сегментов в один поток (с маркерами стыков)
merged, merge_marks = [], []
prev_end = None
for seg in js_parts:
    a = seg[0][0]
    if prev_end is not None and a > prev_end + 1:
        merged.append(f"// ===== [РАЗРЫВ ИСТОЧНИКА: пропущено {a - prev_end - 1} строк, ориг. {prev_end+1}..{a-1}] =====")
    merged.extend(l for _, l in seg)
    prev_end = seg[-1][0]
merged_text = "\n".join(merged)
(OUT / "_merged_all_js.txt").write_text(merged_text + "\n", encoding="utf-8", newline="\n")
print(f"\nСклеенный JS: {len(merged)} строк -> _merged_all_js.txt")

# 3) Пере-разбивка на реализации по маркерам
marks = []
for i, ln in enumerate(merged):
    if re.search(r"==SSEA-2026 v1\.0|==UserScript==|function PSP1Main", ln):
        marks.append((i, ln.strip()[:90]))
print("\nМаркеры реализаций в склеенном потоке:")
for i, m in marks: print(f"  merged[{i}] {m}")

# Реализации: от маркера до следующего маркера
impls = []
for k, (i, m) in enumerate(marks):
    j = marks[k+1][0] if k+1 < len(marks) else len(merged)
    # маркер-строка может быть началом '@name' после ==UserScript==; берём от строки маркера
    body = merged[i:j]
    impls.append((i, j, m, body))

# B-реализация PSP-1 начинается с однострочного metadata-блока (строка содержит '@name POLYMAT PSP-1')
for k, (i, j, m, body) in enumerate(impls):
    tag = "PSP1" if ("PSP1Main" in m or "PSP-1" in m) else "SSEA"
    name = f"impl_{chr(65+k)}_{tag}_{len(body)}ln.user.js"
    (OUT / name).write_text("\n".join(body) + "\n", encoding="utf-8", newline="\n")
    print(f"  -> {name}: merged[{i}:{j}]")
