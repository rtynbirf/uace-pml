#!/usr/bin/env python3
"""Extract Human-First standards from MAKT-2026 and GOLOGRAMMA etalons."""
import re, os

BASE = "/home/z/my-project/upload/_polymat_7z"

def ctx(data, term, before=50, after=900, n=1):
    out = []
    for m in list(re.finditer(re.escape(term), data, re.I))[:n]:
        s = max(0, m.start() - before)
        e = min(len(data), m.start() + after)
        c = re.sub(r"<[^>]+>", " | ", data[s:e])
        c = re.sub(r"(\s*\|\s*)+", " | ", c)
        c = re.sub(r"\s+", " ", c).strip()
        out.append(c)
    return out

for fname, terms in [
    ("MAKT-2026_v110_INTEGRATED_ETALON.html",
     ["Контраст текста", "Перцептивный контраст", "Длина строки", "Порог мерцания",
      "Синий свет и мелатонин", "Большой палец и цели", "Рабочая память",
      "Цена прерывания", "Кегль и интерлиньяж", "Паспорт страницы"]),
    ("GOLOGRAMMA_v1_V_EGO_SHABLONE_2026-08-30.html",
     ["Панель комфорта", "Зрение", "Психика и вестибулярный", "Читаемость",
      "Эргономика", "Цветовая безопасность", "Прозрачность"]),
]:
    data = open(os.path.join(BASE, fname), encoding="utf-8", errors="replace").read()
    print("#" * 90)
    print("#", fname)
    print("#" * 90)
    for t in terms:
        for c in ctx(data, t):
            print(f"\n### {t}\n{c[:800]}")
