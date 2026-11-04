#!/usr/bin/env python3
"""Task 6. Сборка финальных деливераблов в download/ с паспорт-шапками."""
import pathlib

SOL = pathlib.Path("/home/z/my-project/scripts/solyanka")
DL = pathlib.Path("/home/z/my-project/download")
DL.mkdir(exist_ok=True)

SSEA_HEADER = """// ==SSEA-2026 v1.0 — ssea-1==
// SELFCHECK: 1-10 OK (статический аудит Task 6, 2026-09-19: node --check OK;
//   запрещённые API: 0 — fetch/XHR/WebSocket/sendBeacon/EventSource/import/eval;
//   срез «вызовы-vs-определения»: 0 неопределённых; метрики H1-H14: 14/14;
//   validateReport: есть; панель: 5 управляющих; Alt+D с гигиеной полей;
//   детерминизм: сортировки map/сэмплы по document order; ADR — в хвосте)
// DEVIATION: 8.6 «тёплая палитра после 20:00» — реализовано только как опция
//   темы (честно задокументировано исполнителем, ADR в хвосте файла)
// ПРОИСХОЖДЕНИЕ: Task 6. Извлечено из «солянки» — экспорта чата Dola, где
//   ассистент склеил 6 реализаций SSEA + частичный PSP-1 + прозу. Это полная
//   реализация №5 (ориг. строки 2892-6948): единственная с валидным синтаксисом
//   и 100%-покрытием вызовов. Дубли отбракованы, прозы удалены.

"""

PSP1_HEADER = """// ==========================================================================
// POLYMAT PSP-1 — МОДУЛЬ S: КАРКАС СТРАНИЦЫ (движок по ТЗ PSP-1/TZ-1.0, раздел 5)
// ВОССТАНОВЛЕНО Task 6 (2026-09-19) из «солянки» — экспорта чата Dola.
//
// ЧТО ЭТО: движок сбора каркаса страницы БЕЗ содержимого — дерево (5.1-5.2),
// геометрия пакетированно (5.2/9.1), CSS-инвентарь (5.6.1-5.6.4), цветовая
// карта OKLCH (5.6.5-5.6.7), слои композитинга L0-L6 (5.7), таблицы (5.4),
// формы (5.5), информационная архитектура (5.8). Экспорт: const PageStructure.
//
// ЭТО НЕ ПОЛНЫЙ USERSCRIPT: модулей D (устройство, разд. 4), H (метрики
// здоровья, 6.1-6.6), R (отчёты, 7.1-7.3), C (согласие/панель, разд. 10)
// исполнитель не дал — их нужно достраивать или запросить повторно.
//
// ВОССТАНОВЛЕНО (9 функций, потерянных при стриминге исполнителя):
//   fnv1a32, hexToRgb, calculateWCAGContrast, calculateAPCA, rgbToOklch,
//   batchReadGeometry, processMediaRule, processSupportsRule, processContainerRule
//   Юнит-векторы (scripts/test_restored.js): FNV-1a("a")=e40c292c;
//   WCAG b/w=21.00; APCA BoW=-106.04 (вектор ТЗ, ±0.5 OK); OKLCH
//   red/green/blue/white — 15/15 PASS.
// ИСПРАВЛЕНО: затенение `result` в collectCSSInventory (локальная тень
//   модульной переменной — статистика селекторов/юнитов/функций терялась).
//
// ERRATA ТЗ PSP-1/TZ-1.0 (установлена самотестом Task 6):
//   6.1.1: Lc — в ПУНКТАХ (x100 от доли); офсет 0.027 применяется К НУЛЮ в
//          обоих направлениях; WoB-вектор ≈+107.89, а не +106.04
//          (BoW -106.04 сходится точно);
//   11.1:  вектор OKLCH зелёного — (0.86644, 0.29483, 142.495),
//          а не (0.96815, 0.21133, 136.013).
//
// ИЗВЕСТНЫЕ ПРОБЕЛЫ ИСХОДНИКА (не чинились — вне рамок восстановления):
//   specificity всегда нули (analyzeSelector не считает тройку a,b,c);
//   parsedRules пуст (processCSSRule не пушит правила в массив);
//   @layer/@property — заглушки (ТЗ 5.6.1 требует списки имён).
// ==========================================================================

"""

# 1) SSEA-2026 RESTORED
ssea = (SSEA_HEADER + (SOL / "ssea_final_2106ln.js").read_text(encoding="utf-8"))
p1 = DL / "SSEA-2026-v1.0.0-RESTORED.user.js"
p1.write_text(ssea, encoding="utf-8", newline="\n")
print(f"{p1.name}: {ssea.count(chr(10))+1} строк, {len(ssea.encode('utf-8'))} байт")

# 2) PSP-1 Module S RESTORED
psp1 = (PSP1_HEADER + (SOL / "psp1_module_s_restored.js").read_text(encoding="utf-8"))
p2 = DL / "POLYMAT-PSP1-MODULE-S-RESTORED.js"
p2.write_text(psp1, encoding="utf-8", newline="\n")
print(f"{p2.name}: {psp1.count(chr(10))+1} строк, {len(psp1.encode('utf-8'))} байт")
