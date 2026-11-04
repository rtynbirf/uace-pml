#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Приёмка пакета от второй сессии (179): целостность + манифест-сверка + инвентарь."""
import zipfile
import hashlib
import os
import sys

SRC = "/home/z/my-project/upload/АРХИВ-СЕССИЯ-179-СКРИПТ-2026-09-19.zip"
DEST = "/home/z/my-project/upload/_archive_179"
EXPECT_MD5 = "b02d38bcb7ee360cb100d3fae5a933e8"

# 1. md5 уже сверен снаружи; двойной контроль внутри скрипта
h = hashlib.md5()
with open(SRC, "rb") as f:
    for chunk in iter(lambda: f.read(1 << 20), b""):
        h.update(chunk)
print(f"md5: {h.hexdigest()} {'OK' if h.hexdigest() == EXPECT_MD5 else 'MISMATCH!'}")

z = zipfile.ZipFile(SRC)
bad = z.testzip()
names = z.namelist()
print(f"testzip: {'OK' if bad is None else 'FAIL ' + bad}")
print(f"записей: {len(names)} (заявлено 217)")

# 2. Распаковка
if os.path.exists(DEST):
    import shutil
    shutil.rmtree(DEST)
os.makedirs(DEST, exist_ok=True)
z.extractall(DEST)
print(f"распаковано: {DEST}")

# 3. Сверка md5 каждого файла с манифестом отправителя (если манифест найден)
manifest = None
for n in names:
    if "МАНИФЕСТ" in n:
        manifest = os.path.join(DEST, n)
        break

if manifest:
    claimed = {}
    with open(manifest, encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.replace("|", " ").split()
            md5s = [p for p in parts if len(p) == 32 and all(c in "0123456789abcdef" for c in p.lower())]
            if md5s:
                # путь ищем как самый длинный токен с '/' или расширением
                cand = [p for p in parts if ("/" in p or "." in p) and p.lower() != md5s[0]]
                if cand:
                    claimed[max(cand, key=len)] = md5s[0]
    ok = miss = diff = 0
    diff_list = []
    for root, _d, files in os.walk(DEST):
        for fn in files:
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, DEST)
            hh = hashlib.md5(open(p, "rb").read()).hexdigest()
            # сверка по любому из представлений пути
            hit = None
            for key in (rel, rel.replace("\\", "/"), fn, os.path.join(*rel.split(os.sep)[-2:])):
                if key in claimed:
                    hit = claimed[key]
                    break
            if hit is None:
                miss += 1
            elif hit == hh:
                ok += 1
            else:
                diff += 1
                diff_list.append(rel)
    print(f"манифест-сверка: совпало {ok}, не найдено в манифесте {miss}, РАСХОЖДЕНИЙ {diff}")
    for d in diff_list[:10]:
        print(f"  DIFF: {d}")
else:
    print("манифест не найден — сверка пропущена")

# 4. Инвентарь верхнего уровня
print("\n=== ИНВЕНТАРЬ (2 уровня) ===")
top = {}
for n in names:
    parts = n.split("/")
    key = "/".join(parts[:2]) if len(parts) > 2 else n
    top[key] = top.get(key, 0) + 1
for k in sorted(top):
    print(f"{top[k]:>4}  {k}")
