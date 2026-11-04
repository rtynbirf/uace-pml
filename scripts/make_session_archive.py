#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка полного архива всех файлов сессии UACE/Polymat (раунд 2026-09-18..19)."""
import os
import zipfile
import datetime

BASE = "/home/z/my-project"
# Архив строим ВНЕ download/, чтобы os.walk не захватил сам архив (иначе zip-бомба),
# а по завершении атомарно переносим в download/.
OUT = os.path.join(BASE, "scripts", "_archive_tmp.zip")
FINAL = os.path.join(BASE, "download", "UACE-SESSION-FULL-ARCHIVE-2026-09-19.zip")
STAMP = datetime.date.today().isoformat()

# Что кладём в архив (продукты сессии: деливераблы + рабочие файлы + журнал)
INCLUDE_DIRS = [
    os.path.join(BASE, "download"),
    os.path.join(BASE, "scripts"),
]
INCLUDE_FILES = [os.path.join(BASE, "worklog.md")]

HEADER = f"""ПОЛНЫЙ АРХИВ СЕССИИ — UACE/Polymat userscript line
Дата сборки: {STAMP}
Состав: download/ (деливераблы) + scripts/ (рабочие файлы сборки и тестов) + worklog.md

=== ДЕЛИВЕРАБЛЫ (download/) ===
UACE-v26.0.0-RESTORED.user.js      — восстановленный экспортёр: activateChatItem (3 канала),
                                     ZIP DEFLATE, анти-шторм childJob, onlyNew, 29 платформ (2490 строк)
UACE-v27.0.0-HUMAN-FIRST.user.js   — UI перестроен по 9 нормам MAKT-2026 (3013 строк)
UACE-v27.1.0-HUMAN-FIRST.user.js   — + системный акцент AccentColor (двухпроходная подгонка
                                     WCAG >=4.5), сегментный тумблер Авто/Свет/Тьма/Тепло (3164 строки)
UACE-v27.3.0-STYLES-ACCENT.user.js — ГЛАВНАЯ СБОРКА: слияние обеих веток — движок RESTORED
                                     (deflate+nav+resume+childJob) + UI HUMAN-FIRST + 5 стилей
                                     экспорта (Имперский/МАКТ/Швейцарская/Нео-брутализм/Сепия),
                                     3549 строк, UI_ID uaice-273
SSEA-2026-v1.0.0-RESTORED.user.js  — восстановленный скрипт исполнителя (реализация №5 из солянки)
POLYMAT-PSP1-MODULE-S-RESTORED.js  — восстановленный движок каркаса PSP-1 (Module S, самотест 15/15)
POLYMAT-PSP-1-TZ-PROMPT-v1.0.md    — ТЗ PSP-1/TZ-1.0 для внешнего ИИ-исполнителя
README.md                          — описание папки download
UACE-v27.1-preview-*.png (7 шт)    — визуальная QA панели v27.1 (light/dark/warm/авто/тумблер/паспорт)
UACE-v27.3-preview-panel.png       — визуальная QA панели v27.3

=== РАБОЧИЕ ФАЙЛЫ (scripts/) ===
build_v27.py / build_v273.py       — сборщики версий (анкорные операции)
uace-v27-ui.js / uace-v273-ui.js   — UI-слои
validate_v273.js, test_zip_v273.js, test_styled_v273.js, test_accent_tune.js,
test-zip-uace.js, test_restored.js, coverage_solyanka.js — тесты (ZIP roundtrip,
                                     подгонка акцента 103 сочетания, стили 11/11, coverage-свип)
audit_v27.py, audit_v273_styles.py — независимые WCAG-аудиты палитр
make_preview.py, make_preview_v273.py, preview-v271.html, preview-v273.html,
v273-styled-sample.html            — стенды визуальной QA
extract/clean/repair/assemble_solyanka.py, analyze_html.py,
extract_standards.py, inspect_7z.py — разбор солянки и эталонов
uace-v25-source.js, uace-v26*.user.js, uace-v27-src.user.js — исходные точки эволюции
diff_engine_regions.txt, inventory_my_chats.txt — отчёты слияния веток
solyanka/                          — фрагменты разбора солянки
uace-*-zip-test.zip                — артефакты ZIP-тестов

=== ЖУРНАЛ ===
worklog.md — полная история Task 1..7 (все решения, дефекты, валидации)

=== ЛЕЖИТ ДО ПОРЫ (в архив НЕ включено, по директиве) ===
upload/_my_chats_2/ (26М), upload/_chrome_backup/ (2.5М), upload/_polymat_7z/ (1.6М),
SSEA-отчёты исполнителя, debug/sniffer-отчёты, исходные 7z/ZIP — исходники пользователя,
лежат на полке проекта.
"""

def main():
    manifest_path = os.path.join(BASE, "scripts", "MANIFEST.txt")
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(HEADER)

    if os.path.exists(OUT):
        os.remove(OUT)

    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.write(manifest_path, "MANIFEST.txt")
        count += 1
        for d in INCLUDE_DIRS:
            for root, _dirs, files in os.walk(d):
                for fn in sorted(files):
                    p = os.path.join(root, fn)
                    if os.path.abspath(p) in (os.path.abspath(OUT), os.path.abspath(FINAL)):
                        continue  # страховка: архив никогда не кладём в самого себя
                    if os.path.abspath(p) == os.path.abspath(manifest_path):
                        continue  # манифест уже лежит в корне архива — без дубля
                    arc = os.path.relpath(p, BASE)
                    z.write(p, arc)
                    count += 1
        for p in INCLUDE_FILES:
            z.write(p, os.path.basename(p))
            count += 1

    # Контроль целостности ещё ДО переезда в download/
    with zipfile.ZipFile(OUT) as z:
        bad = z.testzip()
        names = z.namelist()
    size = os.path.getsize(OUT)

    # Атомарный переезд готового архива в download/
    if os.path.exists(FINAL):
        os.remove(FINAL)
    os.replace(OUT, FINAL)

    print(f"OK: {FINAL}")
    print(f"Файлов в архиве: {count}")
    print(f"Размер: {size/1024/1024:.2f} МБ")
    print(f"CRC-проверка: {'OK' if bad is None else 'FAIL: ' + bad}")
    print(f"Записей при чтении: {len(names)}")

if __name__ == "__main__":
    main()
