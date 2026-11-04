# -*- coding: utf-8 -*-
"""Сборка uace-pml-v28.3.0-unified.user.js из uace-pml-v28.2.2-unified.user.js.

Правки (все якорные, с проверкой кратности):
  1. Шапка: @version, @description, ИСТОРИЯ ВЕРСИЙ (+v28.3.0), SCRIPT_VER.
  2. SETTINGS_KEYS += 'uaice_tpl'.
  3. Возврат стилевого движка v27.3.0 (TPL_STYLES×5, buildStyledHTML,
     fillStyledDoc, openPrintWindow) + toHTML -> стилизованный.
  4. PDF: fillPrintDoc -> fillStyledDoc (печать в выбранном стиле);
     printFallback -> openPrintWindow(стилизованный) -> .print.html гарант;
     buildMerged('html') -> buildStyledHTML.
  5. UI: строка тем (Авто/Свет/Тьма/ТЕПЛО) вынесена на видное место под шапкой;
     селект «Стиль PDF/HTML»; кнопка «? Справка» слева от «ⓘ Паспорт»;
     всплывающие подсказки (data-tip + #uaice-28-tip); паспорт +2 строки.
"""
import hashlib
import pathlib

SRC = pathlib.Path('/home/z/my-project/download/uace-pml-v28.2.2-unified.user.js')
DST = pathlib.Path('/home/z/my-project/download/uace-pml-v28.3.0-unified.user.js')
ENG = pathlib.Path('/home/z/my-project/scripts/v2830_engine.js').read_text(encoding='utf-8')
HELPBLOCK = pathlib.Path('/home/z/my-project/scripts/v2830_help.js').read_text(encoding='utf-8')

out = SRC.read_text(encoding='utf-8')

def rep(s, old, new, n=1):
    c = s.count(old)
    assert c == n, f'ANCHOR x{c} (ожидалось {n}): {old[:100]!r}'
    return s.replace(old, new, n)

# --- 1a. @version ---
out = rep(out, '// @version      28.2.2-unified', '// @version      28.3.0-unified')

# --- 1b. @description ---
out = rep(
    out,
    r'самовосстановление монтажа (documentElement + watchdog 2 с).',
    r'самовосстановление монтажа (documentElement + watchdog 2 с). v28.3.0: темы на виду под шапкой (ТЕПЛО одним кликом), всплывающие подсказки при наведении, кнопка «? Справка» слева от «ⓘ Паспорт», возвращены 5 стилей PDF/HTML из v27.3.0 (Имперский с золотом и др.), PDF печатается в выбранном стиле.'
)

# --- 1c. ИСТОРИЯ ВЕРСИЙ ---
hist_old = r''' *       восстанавливает стили, buildUI ретраится до 8 раз при исключении.'''
hist_new = r''' *       восстанавливает стили, buildUI ретраится до 8 раз при исключении.
 *  v28.3.0 — «ТЕПЛО на виду · Подсказки · СПРАВКА · Стили PDF возвращены»:
 *    1) ТЁПЛАЯ ТЕМА: строка тем Авто/Свет/Тьма/Тепло вынесена ИЗ скрытых
 *       «Настроек» на видное место прямо под шапкой (логика v28.2.1 не тронута:
 *       uaice_theme честно применяется, PML-палитра следует за выбором, статус-
 *       фидбек). «Тепло» = фон #f6efe2, текст #3a3226 (11.03:1), акцент-охра
 *       #8a5a00 (5.18:1) — канон Тёплой палитры линии B.
 *    2) ПОДСКАЗКИ: наведение курсора (и Tab-фокус) на кнопку/селект/summary
 *       всплывает подсказкой через 0.32 с (#uaice-28-tip внутри Shadow DOM,
 *       не обрезается панелью, исчезает при клике/прокрутке; нативные title
 *       переведены в data-tip, чтобы не дублировались).
 *    3) СПРАВКА: кнопка «?» СЛЕВА от «ⓘ Паспорт панели» — инструкция по
 *       эксплуатации: быстрый старт, темы, стили PDF, хоткеи UACE/PML,
 *       PML-разведка, приватность, траблшутинг. Новых хоткеев нет (канон §13).
 *    4) СТИЛИ PDF/HTML ВОССТАНОВЛЕНЫ: стилевой движок v27.3.0 STYLES+ACCENT
 *       возвращён в unified-линейку — 5 шаблонов МАКТ-2026: ИМПЕРСКИЙ (тёмный
 *       фон + золото #d4af37, кегль 18), МАКТ Светлый, Швейцарская сетка,
 *       Нео-брутализм, Сепия Вечер. Селект «Стиль PDF/HTML» под форматом
 *       (uaice_tpl, дефолт — Имперский). Стиль применяют: PDF-печать
 *       (fillPrintDoc → fillStyledDoc), отдельное окно печати (openPrintWindow),
 *       HTML-файлы, сводный HTML, ZIP-inner и .print.html-гарант. Печать идёт
 *       с print-color-adjust:exact — фон и золото сохраняются.
 *    Канон не тронут: §5 PML-STRUCT (FNV-1a/sigHash), §13 хоткеи E/D/C/S/X/I,
 *    §15 приватность (0 внешних запросов; CDN только по явному флагу).'''
out = rep(out, hist_old, hist_new)

# --- 1d. SCRIPT_VER ---
out = rep(out, "const SCRIPT_VER = '28.2.2-unified';", "const SCRIPT_VER = '28.3.0-unified';")

# --- 2. SETTINGS_KEYS ---
out = rep(
    out,
    r"'uaice_theme','uaice_evening','uaice_fsz','uaice_motion'];",
    r"'uaice_theme','uaice_evening','uaice_fsz','uaice_motion','uaice_tpl'];"
)

# --- 3. Стилевой движок + toHTML ---
tohtml_old = r'''function toHTML(scraped, title) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(title) + '</title><style>' + htmlCss() + '</style></head><body>' + htmlBody(scraped, title) + '</body></html>';
}'''
tohtml_new = ENG + '\nfunction toHTML(scraped, title) {\n  /* v28.3.0: HTML-экспорт = стилизованный документ (дефолт — Имперский) */\n  return buildStyledHTML(scraped, title, {});\n}'
out = rep(out, tohtml_old, tohtml_new)

# --- 4a. fillPrintDoc -> стилизованный ---
fill_old = r'''function fillPrintDoc(doc, scraped, title) {
  /* v28.2.2: наполнение документа печати через DOM-API (TT-безопасно) */
  try { const t = doc.createElement('title'); t.textContent = String(title || 'export').replace(/[&<>]/g, ''); doc.head.appendChild(t); } catch (e) {}
  try { const st = doc.createElement('style'); st.textContent = htmlCss() + '\n' + pdfPrintCss(); doc.head.appendChild(st); } catch (e) {}
  const holder = doc.createElement('div');
  setHTML(holder, htmlBody(scraped, title));
  doc.body.appendChild(holder);
  return holder;
}'''
fill_new = r'''function fillPrintDoc(doc, scraped, title) {
  /* v28.3.0: печать в ВЫБРАННОМ СТИЛЕ (uaice_tpl, дефолт — Имперский с золотом);
     наполнение через DOM-API (TT-безопасно, без document.write). */
  return fillStyledDoc(doc, scraped, title);
}'''
out = rep(out, fill_old, fill_new)

# --- 4b. printFallback -> стилизованное окно + гарант ---
pf_old = r'''function printFallback(scraped, title) {
  let w = null;
  try { w = window.open('', '_blank'); } catch (e) {}
  if (w) {
    try {
      const d = w.document;
      try { const t = d.createElement('title'); t.textContent = String(title || 'export').replace(/[&<>]/g, ''); d.head.appendChild(t); } catch (e) {}
      try { const st = d.createElement('style'); st.textContent = htmlCss() + '\n' + pdfPrintCss(); d.head.appendChild(st); } catch (e) {}
      setHTML(d.body, htmlBody(scraped, title)); /* v28.2.2: без document.write — TT-безопасно */
      setStatusSafe('PDF: открыто окно печати — выберите «Сохранить как PDF».');
      setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 500);
      return;
    } catch (e) { try { w.close(); } catch (e2) {} }
  }
  /* v28.2.2: ГАРАНТ-фейлвер — файл сохраняется всегда (локальный файл без CSP) */
  try {
    downloadBlob(toHTML(scraped, title), sanitize(title) + '-' + ts() + '.print.html', 'text/html;charset=utf-8');
    setStatusSafe('PDF: печать недоступна (CSP/popup) — сохранён .print.html. Откройте файл → Ctrl+P → «Сохранить как PDF».');
    toast('PDF: печать заблокирована — сохранён .print.html (открыть → Ctrl+P → «Сохранить как PDF»)', 9000);
  } catch (e2) { setStatusSafe('PDF: не удалось ни напечатать, ни сохранить файл.'); }
}'''
pf_new = r'''function printFallback(scraped, title) {
  /* v28.3.0: путь 1 — СТИЛИЗОВАННОЕ окно печати (blob-URL, openPrintWindow из
     v27.3.0: полный шаблон + панель стилей; печать триггерится с opener — CSP
     окна не мешает). Путь 2 — ГАРАНТ-файл .print.html (тоже стилизованный):
     открыть → Ctrl+P → «Сохранить как PDF». */
  try {
    const w = openPrintWindow(buildStyledHTML(scraped, title, {}));
    if (w) { setStatusSafe('PDF: открыто стилизованное окно печати — выберите «Сохранить как PDF».'); return; }
  } catch (e) { try { console.error('PDF window error:', e); } catch (e2) {} }
  try {
    downloadBlob(toHTML(scraped, title), sanitize(title) + '-' + ts() + '.print.html', 'text/html;charset=utf-8');
    setStatusSafe('PDF: печать недоступна (CSP/popup) — сохранён стилизованный .print.html. Откройте файл → Ctrl+P → «Сохранить как PDF».');
    toast('PDF: печать заблокирована — сохранён .print.html (открыть → Ctrl+P → «Сохранить как PDF»)', 9000);
  } catch (e2) { setStatusSafe('PDF: не удалось ни напечатать, ни сохранить файл.'); }
}'''
out = rep(out, pf_old, pf_new)

# --- 4c. buildMerged html -> стилизованный сводный ---
bm_old = r'''  if (innerFmt === 'html') { let h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI Chats</title><style>' + htmlCss() + 'section{page-break-after:always}</style></head><body>'; results.forEach(r => { h += '<section>' + htmlBody(r.scraped, r.title) + '</section>'; }); return h + '</body></html>'; }'''
bm_new = r'''  if (innerFmt === 'html') return buildStyledHTML(results.map(r => ({ scraped: r.scraped, title: r.title, url: r.url })), 'AI Chats', { list: true }); /* v28.3.0: сводный HTML в выбранном стиле */'''
out = rep(out, bm_old, bm_new)

# --- 5a. CSS: темы вне .comfort + справка + тултип ---
css_anchor = '#${UI_ID}.hf-motion-off *{transition:none !important;animation:none !important;}'
css_add = r'''/* === v28.3.0: строки тем/комфорта работают и вне .comfort (темы на виду) === */
#${UI_ID} .crow{display:flex;gap:8px;align-items:center;justify-content:space-between;}
#${UI_ID} .crow .cl{font-size:13px;color:var(--hf-tx);}
#${UI_ID} .cbtns{display:flex;gap:4px;flex-wrap:wrap;}
#${UI_ID} .cbtns button{min-height:36px;min-width:36px;padding:4px 9px;font-size:13px;text-align:center;flex:0 0 auto;}
#${UI_ID} .cbtns button[aria-pressed="true"]{border-color:var(--hf-accent);box-shadow:inset 0 0 0 1px var(--hf-accent);color:var(--hf-accent);font-weight:600;}
/* === v28.3.0: СПРАВКА — прокручиваемая инструкция === */
#${UI_ID} .help{flex:0 0 auto;min-height:0;max-height:56vh;overflow-y:auto;overscroll-behavior:contain;padding-right:4px;}
#${UI_ID} .help h3{margin:8px 0 2px;font-size:13px;color:var(--hf-accent);}
#${UI_ID} .help p{margin:3px 0;font-size:13px;line-height:1.55;}
#${UI_ID} .help .hrow{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed var(--hf-line);padding:3px 0;font-size:12.5px;}
#${UI_ID} .help .hk{color:var(--hf-accent);font-weight:600;white-space:nowrap;}
#${UI_ID} .help .cap2{font-size:11.5px;color:var(--hf-tx2);line-height:1.5;margin:4px 0 2px;}
/* === v28.3.0: всплывающая подсказка (живёт в #uaice-28 → наследует --hf-*) === */
#${UI_ID} #${UI_ID}-tip{position:fixed;z-index:2147483647;max-width:280px;padding:7px 10px;border-radius:9px;border:1px solid var(--hf-line);background:var(--hf-surface);color:var(--hf-tx);font:12.5px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;box-shadow:0 8px 22px rgba(0,0,0,.28);pointer-events:none;opacity:0;transition:opacity .12s linear;white-space:normal;overflow-wrap:anywhere;}
#${UI_ID} #${UI_ID}-tip.on{opacity:1;}
''' + css_anchor
out = rep(out, css_anchor, css_add)

# --- 5b. Тема-строка: убрать из settings (переносится в box) ---
out = rep(out, '  settings.appendChild(rowTheme);\n', '')

# --- 5c. Кнопка «? Справка» слева от «ⓘ Паспорт» ---
grip_old = r'''  const bPass = btn('ⓘ'); bPass.title = 'Паспорт панели';
  bPass.setAttribute('aria-expanded', 'false');
  const b0 = btn('—'); b0.title = 'Свернуть'; b0.setAttribute('aria-label', 'Свернуть');
  gripBtns.appendChild(bPass); gripBtns.appendChild(b0);'''
grip_new = r'''  const bPass = btn('ⓘ'); bPass.title = 'Паспорт панели';
  bPass.setAttribute('aria-expanded', 'false');
  const bHelp = btn('?'); bHelp.title = 'Справка — инструкция по эксплуатации';
  bHelp.setAttribute('aria-expanded', 'false');
  const b0 = btn('—'); b0.title = 'Свернуть'; b0.setAttribute('aria-label', 'Свернуть');
  /* v28.3.0: «? Справка» СЛЕВА от «ⓘ Паспорт панели» */
  gripBtns.appendChild(bHelp); gripBtns.appendChild(bPass); gripBtns.appendChild(b0);'''
out = rep(out, grip_old, grip_new)

# --- 5d. Селект «Стиль PDF/HTML» ---
rowfmt_anchor = '  rowFmt.appendChild(selFormat); rowFmt.appendChild(bSet);'
rowtpl_add = rowfmt_anchor + r'''

  /* --- v28.3.0: СТИЛЬ PDF/HTML — возвращённые 5 шаблонов МАКТ-2026 --- */
  const rowTpl = document.createElement('div'); rowTpl.className = 'row2';
  const selTpl = document.createElement('select');
  selTpl.setAttribute('aria-label', 'Стиль PDF/HTML');
  Object.keys(TPL_STYLES).forEach(id => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = TPL_STYLES[id].name + ' — ' + TPL_STYLES[id].hint;
    selTpl.appendChild(o);
  });
  selTpl.value = tplStyleId();
  selTpl.onchange = () => { try { safeStorageSet('uaice_tpl', selTpl.value); } catch (e) {} setStatus('Стиль экспорта: ' + TPL_STYLES[selTpl.value].name, 3500); };
  rowTpl.appendChild(selTpl);'''
out = rep(out, rowfmt_anchor, rowtpl_add)

# --- 5e. Паспорт: +2 строки ---
out = rep(
    out,
    "    row('PML-разведка', 'встроена (r1+r2)', true);",
    "    row('PML-разведка', 'встроена (r1+r2)', true);\n"
    "    row('Стиль PDF/HTML', (TPL_STYLES[tplStyleId()] ? TPL_STYLES[tplStyleId()].name + ' · ' + Object.keys(TPL_STYLES).length + ' шаблонов МАКТ-2026' : '—'), true); /* v28.3.0 */\n"
    "    row('Подсказки', 'наведите курсор на кнопку', true); /* v28.3.0 */"
)

# --- 5f. Справка+подсказки: вставка перед «сборка» ---
out = rep(out, '  /* --- сборка --- */', HELPBLOCK + '  /* --- сборка --- */')

# --- 5g. applyCollapsed: скрывать новые блоки ---
out = rep(
    out,
    "    [rowFmt, gridMain, dMore, dPml, dModes, dDiag].forEach(x => { x.style.display = collapsed ? 'none' : ''; });",
    "    [rowFmt, rowTpl, rowTheme, gridMain, dMore, dPml, dModes, dDiag].forEach(x => { x.style.display = collapsed ? 'none' : ''; });"
)

# --- 5h. Сборка: порядок блоков ---
out = rep(
    out,
    '  box.appendChild(grip);\n  box.appendChild(rowFmt);\n  box.appendChild(gridMain);',
    '  box.appendChild(grip);\n  box.appendChild(rowTheme); /* v28.3.0: темы на виду */\n  box.appendChild(rowFmt);\n  box.appendChild(rowTpl); /* v28.3.0: стиль PDF/HTML */\n  box.appendChild(gridMain);'
)
out = rep(
    out,
    '  box.appendChild(passport);',
    '  box.appendChild(passport);\n  box.appendChild(helpBox); /* v28.3.0: справка */'
)
out = rep(
    out,
    '  w.appendChild(badge);',
    '  w.appendChild(badge);\n  w.appendChild(tipEl); /* v28.3.0: тултип внутри #uaice-28 → наследует --hf-* */'
)

# --- 5i. setBusy: блокировать selTpl ---
out = rep(
    out,
    '    [b1, b2, bTabs, bResume, b5, bCont, bSide, b6, bRep, bSniff, selFormat].forEach(x => { try { x.disabled = v; } catch (e) {} });',
    '    [b1, b2, bTabs, bResume, b5, bCont, bSide, b6, bRep, bSniff, selFormat, selTpl].forEach(x => { try { x.disabled = v; } catch (e) {} });'
)

# --- 5j. Сброс: + uaice_tpl ---
out = rep(
    out,
    r"'uaice_theme','uaice_evening','uaice_fsz','uaice_motion'].forEach(k => safeStorageRemove(k));",
    r"'uaice_theme','uaice_evening','uaice_fsz','uaice_motion','uaice_tpl'].forEach(k => safeStorageRemove(k));"
)
out = rep(
    out,
    "    currentFormat = 'md'; selFormat.value = 'md';",
    "    currentFormat = 'md'; selFormat.value = 'md';\n    selTpl.value = tplStyleId(); /* v28.3.0: стиль вернётся к Имперскому */"
)

# --- 6. internals ---
out = rep(
    out,
    '    /* v28.2.2: TT/PDF/монтаж */\n    TT_ACTIVE, setHTML, fillPrintDoc, pdfPrintCss, renderPdfBlob, printFallback, exportAsPDF,',
    '    /* v28.2.2: TT/PDF/монтаж */\n    TT_ACTIVE, setHTML, fillPrintDoc, pdfPrintCss, renderPdfBlob, printFallback, exportAsPDF,\n'
    '    /* v28.3.0: стилевой движок экспорта (возвращён из v27.3.0 STYLES+ACCENT) */\n'
    '    TPL_STYLES, TPL_KEY, tplStyleId, tplCss, tplEscape, buildStyledHTML, styledParts, fillStyledDoc, openPrintWindow,'
)

# --- 7. boot-лог ---
out = rep(
    out,
    "+ '. Хранилище: ' + (HAS_IDB ? 'IndexedDB' : 'localStorage')",
    "+ '. Стилей PDF/HTML: ' + Object.keys(TPL_STYLES).length + ' (дефолт: Имперский — тёмный + золото). Хранилище: ' + (HAS_IDB ? 'IndexedDB' : 'localStorage')"
)

DST.write_text(out, encoding='utf-8')
md5 = hashlib.md5(out.encode('utf-8')).hexdigest()
print(f'OK: {DST}')
print(f'lines: {out.count(chr(10)) + 1}; bytes: {len(out.encode("utf-8"))}; md5: {md5}')
