#!/usr/bin/env python3
"""Разбор 'солянки' из экспорта Dola: извлечение всех склеенных скриптов в отдельные файлы."""
import re, pathlib

SRC = pathlib.Path("/home/z/my-project/upload/Pasted Content_1789811101216.txt")
OUT = pathlib.Path("/home/z/my-project/scripts/solyanka")
OUT.mkdir(parents=True, exist_ok=True)

lines = SRC.read_text(encoding="utf-8").splitlines()
n = len(lines)  # 9650

# Границы блоков (1-индексация включительно), найдены при разведке
blocks = {
    "A_ssea_impl1_573-1320.user.js":   (573, 1320),
    "B_psp1_partial_1321-2009.user.js":(1321, 2009),
    "C_ssea_impl3_2010-2391.user.js":  (2010, 2391),
    "D_ssea_impl4_2392-2891.user.js":  (2392, 2891),
    "E_ssea_impl5_2892-6952.user.js":  (2892, 6952),
    "F_ssea_impl6_6953-9650.user.js":  (6953, 9650),
}
for name, (a, b) in blocks.items():
    text = "\n".join(lines[a-1:b]) + "\n"
    p = OUT / name
    p.write_text(text, encoding="utf-8", newline="\n")
    print(f"{name}: {b-a+1} строк, {len(text.encode('utf-8'))} байт")

# Маркеры соответствия ТЗ по каждому блоку
markers = {
    "APCA (ТЗ PSP-1 6.1)":       [r"APCA", r"mainTRC", r"0\.57", r"blkThrs"],
    "OKLCH (ТЗ PSP-1 5.6.5)":    [r"oklch|OKLab|oklab"],
    "Слои L0-L6 (PSP-1 5.7)":    [r"L0|L5|exploded"],
    "HSI/CLI/RTI/BLWEI (PSP-1)": [r"HSI|BLWEI|CLI|RTI|FRI"],
    "AccentColor (PSP-1 7.2)":   [r"AccentColor"],
    "Self-Audit (PSP-1 7.2)":    [r"[Ss]elf-?[Aa]udit|SELF auditing"],
    "HS H1-H14 (SSEA 9)":        [r"H1[0-4]?\b|contrastAA|minTouchTarget|zoomBlocked|darkSchemeSupport"],
    "validateReport (SSEA 12.3)":[r"validateReport"],
    "Тёплый 20:00 (SSEA 8.6)":   [r"20:00|warm|тёпл"],
    "IndexedDB (SSEA 10.4)":     [r"indexedDB|ssea-db"],
    "Панель <=5 (SSEA 11)":      [r"ssea-audit|badge|Badge"],
    "Shadow DOM":                [r"attachShadow|shadowRoot|attachShadow"],
}
print("\n=== Маркеры по блокам ===")
for name in blocks:
    text = (OUT / name).read_text(encoding="utf-8")
    found = [m for m, pats in markers.items() if any(re.search(p, text) for p in pats)]
    missing = [m for m in markers if m not in found]
    print(f"\n[{name}]")
    print(f"  есть: {', '.join(found) if found else '—'}")
    print(f"  нет:  {', '.join(missing) if missing else '—'}")
