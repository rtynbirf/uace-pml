#!/usr/bin/env python3
"""Assemble UACE v27.1.0 HUMAN-FIRST from v26 POLYMATH source + new UI chunk.
   v27.1: акцент панели из системы (CSS AccentColor) + симпатичный переключатель режима."""
import re

SRC = "/home/z/my-project/scripts/uace-v27-src.user.js"
UI = "/home/z/my-project/scripts/uace-v27-ui.js"
OUT = "/home/z/my-project/download/UACE-v27.1.0-HUMAN-FIRST.user.js"

src = open(SRC, encoding="utf-8").read()
ui = open(UI, encoding="utf-8").read()

# 1. Header: name / version / description
src = src.replace(
    "// @name         Universal AI Chat Exporter — Polymat v26.0.0 POLYMATH",
    "// @name         Universal AI Chat Exporter — Polymat v27.1.0 HUMAN-FIRST",
)
src = src.replace("// @version      26.0.0", "// @version      27.1.0")

desc_new = (
    "// @description  HUMAN-FIRST EDITION: интерфейс панели пересобран по девяти нормам MAKT-2026/GOLOGRAMMA — "
    "контраст WCAG 2.2 ≥4.5:1 без чистого ч/б, APCA Lc75, строка 45–75ch, мерцание 0 Гц, тёплый вечерний режим "
    "(Harvard: синий свет 460–480 нм), цели ≥44px, поле зрения 4–6 контролов (Коэн 2015: 4±1), ноль попапов "
    "(Gloria Mark: 23 мин), кегль ≥14px без тонких весов; комфорт-панель (темы авто/свет/тьма/тепло, кегль 13–18, "
    "движение вкл/выкл), паспорт панели с живым сам-аудитом. v27.1: акцентный цвет панели берётся из системы "
    "пользователя (CSS Color 4: AccentColor) с автоподгонкой контраста ≥4.5:1 к теме; симпатичный сегментный "
    "переключатель режима (Авто/Свет/Тьма/Тепло) вшит в шапку панели — радиогруппа со стрелками и тумблером "
    "на трансформе; живая перекраска при смене темы/акцента ОС (matchMedia + focus + visibilitychange). "
    "Автономен по построению: system-ui, 0 CDN по умолчанию (PDF — печать браузера). Движок v26 полностью: "
    "29+ платформ, 9 форматов, IndexedDB-манифест, FNV-1a, собственный ZIP, тома 50 МБ, Shadow DOM, resume, "
    "onlyNew, Alt+E/A/C/S/X/R."
)
src = re.sub(r"// @description  .*\n", desc_new + "\n", src, count=1)

# 2. Version constants
src = src.replace("const SCRIPT_VER = '26.0.0';", "const SCRIPT_VER = '27.1.0';")
src = src.replace("const UI_ID = 'uaice-26';", "const UI_ID = 'uaice-271';")

# 3. Remove old injectModernStyles (from its def to the PDF-рендер comment)
m = re.search(r"  function injectModernStyles\(\) \{.*?\n  \}\n\n  // PDF-рендер", src, re.S)
assert m, "old injectModernStyles block not found"
src = src[:m.start()] + "  // PDF-рендер" + src[m.end():]

# 4. Remove old TOAST section
m = re.search(r"  // ============ v26 POLYMATH: TOAST \(виден и при свёрнутой панели\) ============\n.*?\n(?=  // ============ v26 POLYMATH: INDEXEDDB)", src, re.S)
assert m, "old toast section not found"
src = src[:m.start()] + src[m.end():]

# 5. Replace UI section with new chunk
start_marker = "  // ============ UI (стиль v20 + drag + настройки + бейдж) ============"
end_marker = "  // Тестовый/отладочный доступ"
i = src.index(start_marker)
j = src.index(end_marker)
src = src[:i] + ui.rstrip() + "\n\n  " + src[j:]

# 6. Autonomy: PDF via native print by default (CDN only opt-in)
old_pdf = """  async function exportAsPDF(scraped, title) {
    try { const blob = await renderPdfBlob(scraped, title); downloadBlob(blob, sanitize(title) + '-' + ts() + '.pdf', 'application/pdf'); }
    catch (e) { console.error('PDF error:', e); printFallback(scraped, title); }
  }"""
new_pdf = """  async function exportAsPDF(scraped, title) {
    // v27 HUMAN-FIRST: автономность по построению — по умолчанию печать браузера (0 сетевых запросов).
    // CDN-рендер включается вручную в настройках (uaice_pdfcdn='1').
    if (safeStorageGet('uaice_pdfcdn') !== '1') { printFallback(scraped, title); return; }
    try { const blob = await renderPdfBlob(scraped, title); downloadBlob(blob, sanitize(title) + '-' + ts() + '.pdf', 'application/pdf'); }
    catch (e) { console.error('PDF error:', e); printFallback(scraped, title); }
  }"""
assert old_pdf in src, "exportAsPDF body not found"
src = src.replace(old_pdf, new_pdf)

# 7. Boot log wording
src = src.replace("'[UAICE v' + SCRIPT_VER + ' POLYMATH] Готов.", "'[UAICE v' + SCRIPT_VER + ' HUMAN-FIRST] Готов.")

open(OUT, "w", encoding="utf-8", newline="\n").write(src)

# Report
n_lines = src.count("\n") + 1
print("OK ->", OUT)
print("lines:", n_lines, " bytes:", len(src.encode("utf-8")))
print("SCRIPT_VER 27.1.0:", "const SCRIPT_VER = '27.1.0';" in src)
print("UI_ID uaice-271:", "const UI_ID = 'uaice-271';" in src)
print("old injectModernStyles removed:", src.count("function injectModernStyles") == 1)
print("old toast removed:", src.count("function toast") == 1)
print("UI section replaced:", "UI v27.1 HUMAN-FIRST" in src)
print("pdf autonomy:", "uaice_pdfcdn" in src)
print("system accent:", "hfSystemAccent" in src and "AccentColor" in src)
print("seg switcher:", "setSegTheme" in src and "radiogroup" in src)
print("accent-tx var:", "--hf-accent-tx" in src)
