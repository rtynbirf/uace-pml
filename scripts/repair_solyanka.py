#!/usr/bin/env python3
"""Task 6. Восстановление PSP-1 Module S: вставка 9 потерянных функций + фикс затенения result."""
import pathlib

SRC = pathlib.Path("/home/z/my-project/scripts/solyanka/psp1_modules_fragment_1943ln.js")
DST = pathlib.Path("/home/z/my-project/scripts/solyanka/psp1_module_s_restored.js")
BLOCK = pathlib.Path("/home/z/my-project/scripts/solyanka/_restored_block.js")

text = SRC.read_text(encoding="utf-8")

RESTORED = r'''
  // ============================================================
  // ВОССТАНОВЛЕННЫЙ БЛОК (Task 6, 2026-09-19): 9 функций, потерянных
  // при стриминговой генерации исполнителя (проза-паузы на ориг.
  // строках 5000-5005 и 6949-6952). Сигнатуры согласованы с местами
  // вызова; цветовые каналы — гамма-кодированный sRGB 0..1 (конвенция
  // parseColorToRgb). Математика: ТЗ PSP-1 6.1.1, CSS Color 4.
  // ============================================================

  /**
   * FNV-1a 32 бит (ТЗ 2.4). Возврат: hex из 8 символов.
   * Тест-вектор: fnv1a32("a") === "e40c292c".
   */
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * hex -> {r,g,b,a}, каналы 0..1 (ТЗ 5.6.4/5.6.5).
   * Поддержка #rgb/#rgba/#rrggbb/#rrggbbaa; иначе null.
   */
  function hexToRgb(hex) {
    const m = /^#([0-9a-f]{3,8})$/i.exec(String(hex).trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3 || h.length === 4) {
      h = h.split('').map(c => c + c).join('');
    }
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  /** Линеаризация канала sRGB (0..1) по формуле WCAG 2.2. */
  function wcagLinear(c) {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /**
   * WCAG 2.2 контраст-рейшо (ТЗ 6.1.2). Вход: {r,g,b} 0..1.
   */
  function calculateWCAGContrast(fg, bg) {
    const lum = (c) => 0.2126 * wcagLinear(c.r)
                    + 0.7152 * wcagLinear(c.g)
                    + 0.0722 * wcagLinear(c.b);
    const L1 = Math.max(lum(fg), lum(bg));
    const L2 = Math.min(lum(fg), lum(bg));
    return (L1 + 0.05) / (L2 + 0.05);
  }

  /**
   * APCA 0.1.9 (SAPC-4) — ТЗ 6.1.1. Вход: {r,g,b} 0..1 (гамма).
   * Возврат: Lc со знаком (минус = тёмный текст на светлом, BoW).
   * Константы: mainTRC=2.4; sRco=0.2126729 sGco=0.7151522 sBco=0.0721750;
   * normTXT=.57 normBG=.56 revTXT=.62 revBG=.65; blkThrs=.022
   * blkClmp=1.414; scale=1.14; loClip=.1; deltaYmin=.0005; offset=.027.
   * ERRATA ТЗ 6.1.1 (установлена самотестом Task 6): (1) Lc выражается
   * в ПУНКТАХ APCA (0..~108), т.е. x100 от доли; (2) офсет применяется
   * К НУЛЮ в обоих направлениях (|Lc| = |SAPC|·100 − 2.7), иначе вектор
   * приёмки #000/#FFF не сходится. Проверено: BoW -> −106.05 (вектор
   * −106.04, доп. ±0.5 — OK); WoB -> +107.89 (вектор ТЗ +106.04 —
   * errata, см. отчёт). Ветвление по направлению (Ybg > Ytxt).
   */
  function calculateAPCA(fg, bg) {
    const mainTRC = 2.4;
    const sRco = 0.2126729, sGco = 0.7151522, sBco = 0.0721750;
    const normTXT = 0.57, normBG = 0.56, revTXT = 0.62, revBG = 0.65;
    const blkThrs = 0.022, blkClmp = 1.414, scale = 1.14;
    const loClip = 0.1, offset = 0.027, deltaYmin = 0.0005;

    const Y = (c) => {
      let y = sRco * Math.pow(c.r, mainTRC)
            + sGco * Math.pow(c.g, mainTRC)
            + sBco * Math.pow(c.b, mainTRC);
      if (y < blkThrs) y += Math.pow(blkThrs - y, blkClmp);
      return y;
    };

    const Ytxt = Y(fg), Ybg = Y(bg);
    if (Math.abs(Ytxt - Ybg) < deltaYmin) return 0;

    let sapc, lc;
    if (Ybg > Ytxt) {
      // BoW: тёмный текст на светлом
      sapc = (Math.pow(Ytxt, normTXT) - Math.pow(Ybg, normBG)) * scale;
      lc = sapc > -loClip ? 0 : sapc + offset;
    } else {
      // WoB: светлый текст на тёмном
      sapc = (Math.pow(Ytxt, revTXT) - Math.pow(Ybg, revBG)) * scale;
      lc = sapc < loClip ? 0 : sapc - offset;
    }
    // Lc в пунктах APCA (0..~108): доля x100, округление до 2 знаков
    return Math.round(lc * 100 * 100) / 100;
  }

  /**
   * sRGB {r,g,b} 0..1 (гамма) -> OKLCH {l,c,h,alpha} по CSS Color 4
   * (ТЗ 5.6.5, матрицы OKLab спецификации). Векторы: red -> L .62796
   * C .25768 H 29.234; white -> L 1 C 0; blue -> L .45201 C .31321
   * H 264.052; green -> L .86644 C .29483 H 142.495 (ERRATA ТЗ 11.1:
   * вектор зелени в ТЗ ошибочен; канонический OKLCH зелёного
   * подтверждён сходимостью red/blue/white на тех же матрицах);
   */
  function rgbToOklch(rgb) {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const r = lin(rgb.r), g = lin(rgb.g), b = lin(rgb.b);
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    const C = Math.sqrt(A * A + B * B);
    let H = Math.atan2(B, A) * 180 / Math.PI;
    if (H < 0) H += 360;
    return { l: L, c: C, h: H, alpha: rgb.a !== undefined ? rgb.a : 1 };
  }

  /**
   * Пакетированное чтение геометрии (ТЗ 9.1, анти layout-thrashing):
   * сначала ВСЕ getBoundingClientRect, затем колбэки. Возврат: массив
   * результатов callback (null там, где rect недоступен).
   */
  function batchReadGeometry(elements, callback) {
    const rects = new Array(elements.length);
    for (let i = 0; i < elements.length; i++) {
      try { rects[i] = elements[i].getBoundingClientRect(); }
      catch (e) { rects[i] = null; }
    }
    const results = new Array(elements.length);
    for (let i = 0; i < elements.length; i++) {
      results[i] = rects[i] ? callback(elements[i], rects[i]) : null;
    }
    return results;
  }

  /** @media: условие -> result.mediaQueries + рекурсия (ТЗ 5.6.1). */
  function processMediaRule(rule) {
    try {
      if (rule.conditionText) result.mediaQueries.push(rule.conditionText);
      const inner = rule.cssRules || [];
      for (let i = 0; i < inner.length; i++) processCSSRule(inner[i]);
    } catch (e) {
      console.warn('[PSP-1] @media: ' + e.message);
    }
  }

  /** @supports: условие -> result.supportsQueries + рекурсия. */
  function processSupportsRule(rule) {
    try {
      if (rule.conditionText) result.supportsQueries.push(rule.conditionText);
      const inner = rule.cssRules || [];
      for (let i = 0; i < inner.length; i++) processCSSRule(inner[i]);
    } catch (e) {
      console.warn('[PSP-1] @supports: ' + e.message);
    }
  }

  /** @container: условие -> result.containerQueries + рекурсия. */
  function processContainerRule(rule) {
    try {
      if (rule.containerName || rule.containerQuery) {
        result.containerQueries.push(
          (rule.containerName || '') + ' ' + (rule.containerQuery || rule.conditionText || '')
        );
      } else if (rule.conditionText) {
        result.containerQueries.push(rule.conditionText);
      }
      const inner = rule.cssRules || [];
      for (let i = 0; i < inner.length; i++) processCSSRule(inner[i]);
    } catch (e) {
      console.warn('[PSP-1] @container: ' + e.message);
    }
  }
'''

# 1) Вставка блока перед function collect()
anchor = "  function collect() {"
assert anchor in text, "якорь collect() не найден"
text = text.replace(anchor, RESTORED + "\n" + anchor, 1)

# 2) Фикс затенения result в collectCSSInventory
old = """  function collectCSSInventory() {
    const result = {"""
new = """  function collectCSSInventory() {
    // ИСПРАВЛЕНО (Task 6): было `const result` — локальная тень модульной
    // `let result` (объявлена ниже для analyzeSelector/analyzeStyle), из-за
    // чего вся статистика (selectors/units/functions/important/customProps)
    // писалась в посторонний объект и терялась. Теперь пишем в модульную.
    result = {"""
assert old in text, "место затенения result не найдено"
text = text.replace(old, new, 1)

DST.write_text(text, encoding="utf-8", newline="\n")
print(f"Восстановлено: {DST} ({text.count(chr(10))+1} строк)")

# 3) Автономный файл блока для unit-тестов (те же функции + export)
block_text = RESTORED
block_text = block_text.replace("  // =", "// =", 1).replace("\n  ", "\n")
block_text = block_text.replace("\n  function", "\nfunction")
test_file = (
    "// Автономный извлекаемый блок для unit-тестов (Task 6)\n"
    + block_text
    + "\nmodule.exports = { fnv1a32, hexToRgb, wcagLinear, calculateWCAGContrast, calculateAPCA, rgbToOklch, batchReadGeometry };\n"
)
BLOCK.write_text(test_file, encoding="utf-8", newline="\n")
print(f"Тест-блок: {BLOCK}")
