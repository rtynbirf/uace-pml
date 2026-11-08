# -*- coding: utf-8 -*-
"""
Сборка UACE v27.3.0 «STYLES + ACCENT» — слияние двух веток линейки.
  БАЗА:   наша v27.1.0 HUMAN-FIRST (UI целиком: системный акцент AccentColor,
          сегментный тумблер, комфорт-панель, паспорт; движок = оригинальный v26 —
          регресс сборки v27.0: без deflate/navByURL/autoResume/childJob).
  ДОНОР:  v27.2.0 STYLES (линия RESTORED: движок с deflate/nav/childJob + 5 стилей
          PDF/HTML МАКТ-2026; их UI НЕ берём).
Все операции — по уникальным анкорам с проверкой количества вхождений.
"""
import re, sys

BASE  = '/home/z/my-project/download/UACE-v27.1.0-HUMAN-FIRST.user.js'
DONOR = '/home/z/my-project/upload/_my_chats_2/UACE-v27.2.0-STYLES.user.js'
UI    = '/home/z/my-project/scripts/uace-v27-ui.js'
OUT   = '/home/z/my-project/download/UACE-v27.3.0-STYLES-ACCENT.user.js'
UI_OUT= '/home/z/my-project/scripts/uace-v273-ui.js'

base  = open(BASE,  encoding='utf-8').read()
donor = open(DONOR, encoding='utf-8').read()
ui    = open(UI,    encoding='utf-8').read()

FAILS = []
def rep(text, old, new, tag, expect=1):
    n = text.count(old)
    if n != expect:
        FAILS.append(f'{tag}: анкор найден {n} раз (ожидалось {expect})')
        return text
    return text.replace(old, new)

def block(src, start_anchor, end_anchor, tag, include_end=False):
    i = src.find(start_anchor)
    if i < 0:
        FAILS.append(f'{tag}: старт-анкор не найден'); return None
    j = src.find(end_anchor, i + len(start_anchor))
    if j < 0:
        FAILS.append(f'{tag}: конец-анкор не найден'); return None
    if include_end:
        j += len(end_anchor)
    return src[i:j]

# ================= ДОНОРСКИЕ БЛОКИ =================
styles_engine = block(donor,
    '  // ============ v27.2 STYLES ENGINE: PDF/HTML по шаблону МАКТ-2026 ============',
    '  // ============ ДОСТАВКА: BLOB / СОБСТВЕННЫЙ ZIP (без CDN) / PDF ============', 'E1')
# донор держит toHTML-обёртку перед форматами ShareGPT/JSONL/Alpaca — обрезаем хвост,
# чтобы не дублировать sharegptFrom/toShareGPT/toJSONL/toAlpaca/contentFor (они уже в базе)
cut = styles_engine.find('  // ShareGPT: {title,url,conversations')
if cut > 0:
    styles_engine = styles_engine[:cut].rstrip('\n') + '\n'
assert styles_engine and all(s in styles_engine for s in
    ('function buildStyledHTML', 'function openPrintWindow', 'function toHTML', 'TPL_STYLES',
     'function tplCss', 'function tplBarHTML', 'function tplPassportHTML', 'function tplChatHTML',
     'function tplPageScript', 'function tplStyleId', 'function tplEscape'))
for dup in ('function sharegptFrom', 'function toShareGPT', 'function toJSONL', 'function toAlpaca', 'function contentFor'):
    assert dup not in styles_engine, 'E1-срез содержит дубликат ' + dup

donor_zip = block(donor,
    '  // entries: [{name, data:string|Uint8Array, date?}] -> Blob (application/zip)',
    '\n\n  function blobToU8', 'E2d', include_end=False)
assert donor_zip and 'deflateRaw' in donor_zip and 'async function zipStore' in donor_zip

base_zip_old = block(base,
    '  // entries: [{name, data:string|Uint8Array, date?}] -> Blob (application/zip)',
    '\n\n  function blobToU8', 'E2b', include_end=False)
assert base_zip_old and 'async function zipStore' not in base_zip_old

nav_block = block(donor,
    '  // ============ v26.1 (из RESTORED): АВТО-ПРОДОЛЖЕНИЕ ПОСЛЕ URL-ПЕРЕХОДА ============',
    '\n\n  // ===== АКТИВАЦИЯ ЧАТА В САЙДБАРЕ', 'E3d')
assert nav_block and 'function navByURL' in nav_block and 'uaice_nav' in nav_block

donor_listener = block(donor,
    '  let childJob = null;',
    '\n\n  function waitForChildResult', 'E6d', include_end=False)
assert donor_listener and 'childJob' in donor_listener and "addEventListener('message'" in donor_listener

base_listener = block(base,
    "  window.addEventListener('message', (event) => {",
    '\n\n  function waitForChildResult', 'E6b', include_end=False)
assert base_listener and 'childJob' not in base_listener

donor_boot = block(donor, '  function boot() {', '\n  }', 'E5d', include_end=True)
assert donor_boot and 'uaice_nav' in donor_boot and 'autoResume' in donor_boot

# ================= ШАПКА =================
DESC = ('// @description  STYLES+ACCENT EDITION — слияние двух веток линейки: 5 ГОТОВЫХ стилей PDF/HTML-экспорта '
    'по шаблону МАКТ-2026 (Имперский — тёмный фон+золото и кегль 18 для слабого зрения, МАКТ Светлый, Швейцарская '
    'сетка, Нео-брутализм, Сепия Вечер; выбор виден в главной панели, дублируется в «Ещё экспорт» и в окне печати, '
    'запоминается; PDF силами браузера — векторный текст, 0 CDN; паспорт страницы в каждом экспорте) + весь '
    'HUMAN-FIRST UI v27.1 (акцент панели берётся из системы пользователя — CSS Color 4 AccentColor с автоподгонкой '
    'контраста ≥4.5:1; сегментный переключатель Авто/Свет/Тьма/Тепло; комфорт-панель; паспорт панели с живым '
    'сам-аудитом; контраст ≥4.5:1 без чистого ч/б; кегль 14–21; цели ≥44px; ноль попапов; тёплый вечер; '
    'reduced-motion) + движок RESTORED-линии: ZIP DEFLATE (CompressionStream, fallback store), тома 50 МБ, '
    'навигация по URL с авто-продолжением сессии (uaice_nav, кап 12), childJob-антишторм дочерних вкладок, '
    'origin-чек сообщений, 29+ платформ, 9 форматов, IndexedDB-манифест FNV-1a, onlyNew, Shadow DOM, resume, '
    'Alt+E/A/C/S/X/R/T.')
base = rep(base, '// @name         Universal AI Chat Exporter — Polymat v27.1.0 HUMAN-FIRST',
    '// @name         Universal AI Chat Exporter — Polymat v27.3.0 STYLES+ACCENT', 'hdr:name')
base, n = re.subn(r'// @description  HUMAN-FIRST EDITION[^\n]*', DESC, base, count=1)
if n != 1: FAILS.append('hdr:desc — строка описания не заменена')
base = rep(base, '// @version      27.1.0', '// @version      27.3.0', 'hdr:ver')
base = rep(base, "const SCRIPT_VER = '27.1.0';", "const SCRIPT_VER = '27.3.0';", 'const:ver')
base = rep(base, "const UI_ID = 'uaice-271';", "const UI_ID = 'uaice-273';", 'const:uiid')

# ================= E7: exportAsPDF =================
old_pdf = block(base, '  async function exportAsPDF(scraped, title) {', '\n  }\n', 'E7old', include_end=True)
assert old_pdf and 'renderPdfBlob' in old_pdf and 'buildStyledHTML' not in old_pdf
new_pdf = '''  async function exportAsPDF(scraped, title) {
    // v27.3: PDF = печать по шаблону (5 стилей МАКТ-2026), без CDN, векторный текст.
    // Прежний CDN-путь (html2pdf, опция uaice_pdfcdn='1') сохранён как опция —
    // настоящий PDF-файл для вложений. Дефолт — печать по шаблону: документ реален,
    // пустой страницей быть не может (оффскрин-holder html2canvas не рендерил).
    if (safeStorageGet('uaice_pdfcdn') === '1') {
      try {
        const blob = await renderPdfBlob(scraped, title);
        downloadBlob(blob, sanitize(title) + '-' + ts() + '.pdf', 'application/pdf');
        return;
      } catch (e) { console.error('PDF CDN error:', e); }
    }
    const html = buildStyledHTML(scraped, title, {});
    const w = openPrintWindow(html);
    if (!w) {
      // Окно заблокировано: отдаём готовый шаблон файлом — открыть и Ctrl+P.
      downloadBlob(html, sanitize(title) + '-' + ts() + '.print.html', 'text/html;charset=utf-8');
      setStatusSafe('PDF: окно печати заблокировано — сохранён .print.html, откройте его и нажмите Ctrl+P.');
    } else {
      setStatusSafe('PDF: окно печати открыто — стиль выбирается в панели окна (запоминается).');
    }
  }
'''
base = rep(base, old_pdf, new_pdf, 'E7')

# ================= E1: стилевой движок + удаление старого toHTML =================
base = rep(base, '  // ============ ДОСТАВКА: BLOB / СОБСТВЕННЫЙ ZIP (без CDN) / PDF ============',
    styles_engine.rstrip('\n') + '\n\n  // ============ ДОСТАВКА: BLOB / СОБСТВЕННЫЙ ZIP (без CDN) / PDF ============',
    'E1-insert')
old_tohtml = block(base, '  function toHTML(scraped, title) {', '\n  }\n', 'E1-del', include_end=True)
assert old_tohtml and 'buildStyledHTML' not in old_tohtml
base = rep(base, old_tohtml, '', 'E1-del-apply')

# ================= E2: ZIP DEFLATE =================
base = rep(base, base_zip_old, donor_zip, 'E2')

# ================= E9: pdf внутри ZIP -> .print.html =================
old_zippdf = block(base, "      } else if (innerFmt === 'pdf') {", "      } else {", 'E9old', include_end=True)
new_zippdf = """      } else if (innerFmt === 'pdf') {
        // v27.3: внутри ZIP «PDF» — это .print.html по шаблону: открыть -> Ctrl+P.
        // Настоящий PDF силами браузера (векторный текст), без CDN, честно.
        rec.file = base + '.print.html';
        rec.note = 'PDF по шаблону: откройте файл и нажмите Ctrl+P (0 CDN)';
        entries.push({ name: 'chats/' + rec.file, data: buildStyledHTML(r.scraped, r.title, { inZip: true }) });
      } else {"""
base = rep(base, old_zippdf, new_zippdf, 'E9')

# ================= E8: buildMerged html-ветка =================
old_merged = block(base,
    "      let h = '<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>AI Chats</title><style>'",
    "      return h + '</body></html>';", 'E8old', include_end=True)
new_merged = "      return buildStyledHTML(results.map((r) => ({ scraped: r.scraped, title: r.title, url: r.url })), 'AI Chats — ' + now(), {});"
base = rep(base, old_merged, new_merged, 'E8')

# ================= E3: navByURL-блок перед АКТИВАЦИЕЙ =================
base = rep(base, '  // ===== АКТИВАЦИЯ ЧАТА В САЙДБАРЕ (переключение на чат) =====',
    nav_block.rstrip('\n') + '\n\n  // ===== АКТИВАЦИЯ ЧАТА В САЙДБАРЕ (переключение на чат) =====', 'E3')

# ================= E4: последний резерв -> navByURL =================
old_reserve = block(base,
    '    // ПОСЛЕДНИЙ РЕЗЕРВ: прямая навигация по href/dataId (полная перезагрузка;',
    "      try { location.href = url; await sleep(1200); return true; } catch (e) {}\n    }\n    return false;",
    'E4old', include_end=True)
new_reserve = '''    // ПОСЛЕДНИЙ РЕЗЕРВ (v26.1): прямая навигация по href/dataId (полная перезагрузка).
    // Сессия сохранена; перед переходом ставится флаг uaice_nav — после рестарта
    // boot продолжит масс-сбор сам (авто-резюм), без ручного «▶ Продолжить».
    let url = it.href || '';
    if (!url && it.dataId) { try { url = buildChatUrl(it.dataId) || ''; } catch (e) {} }
    if (url && navByURL(url)) { await sleep(1200); return true; }
    return false;'''
base = rep(base, old_reserve, new_reserve, 'E4')

# ================= E6: слушатель дочерних вкладок =================
base = rep(base, base_listener, donor_listener, 'E6')

# ================= E5: boot =================
old_boot = block(base, '  function boot() {', '\n  }', 'E5old', include_end=True)
assert old_boot and 'getManifest' in old_boot
new_boot = donor_boot.replace("'[UAICE v' + SCRIPT_VER + ' STYLES] Готов.",
                              "'[UAICE v' + SCRIPT_VER + ' STYLES+ACCENT] Готов.")
new_boot = new_boot.replace('тёплый вечер, ноль прерываний.',
                            'тёплый вечер, ноль прерываний, акцент панели — из системы.')
base = rep(base, old_boot, new_boot, 'E5')

# ================= E10: Dola-селекторы из сниффера =================
old_dola = "msgSelectors: ['[class*=\"message\"]', '[class*=\"chat-message\"]'],"
new_dola = ("msgSelectors: ['[class*=\"message\"]', '[class*=\"chat-message\"]', "
            "'[class*=\"message-list\"] > *', '[class*=\"v_list\"]'],  // + сниффер 2026-09-18: контейнер списка и строки v_list")
base = rep(base, old_dola, new_dola, 'E10')

# ================= UI-ПАТЧИ (к инлайн-UI базы и к отдельному UI-файлу) =================
SEL_MAIN = '''
    // --- v27.3: «Стиль PDF/HTML» — 5 шаблонов МАКТ-2026, выбор виден сразу (слияние с v27.2 STYLES) ---
    function makeTplSelect() {
      const s = document.createElement('select');
      s.setAttribute('aria-label', 'Стиль PDF/HTML-экспорта (5 готовых шаблонов)');
      s.title = 'Готовые шаблоны зашиты в скрипт: применяются к HTML-экспорту и PDF-печати. «Имперский» — тёмный фон с золотом и кегль 18 (для слабого зрения).';
      Object.keys(TPL_STYLES).forEach((id) => {
        const o = document.createElement('option');
        o.value = id; o.textContent = TPL_STYLES[id].name + ' — ' + TPL_STYLES[id].hint;
        s.appendChild(o);
      });
      s.value = tplStyleId();
      s.addEventListener('change', () => {
        try { safeStorageSet('uaice_tpl', s.value); } catch (e) {}
        syncTplSelects(s.value);
        setStatus('Стиль экспорта: ' + TPL_STYLES[s.value].name, 4000);
      });
      return s;
    }
    const rowTpl = document.createElement('div');
    rowTpl.className = 'row';
    const selTplMain = makeTplSelect();
    rowTpl.appendChild(selTplMain);
    let selTplMore = null;
    function syncTplSelects(v) {
      try { selTplMain.value = v; } catch (e) {}
      try { if (selTplMore) selTplMore.value = v; } catch (e) {}
    }
'''
UIOPS = [
    ("    rowFmt.appendChild(selFormat); rowFmt.appendChild(bSet);\n",
     "    rowFmt.appendChild(selFormat); rowFmt.appendChild(bSet);\n" + SEL_MAIN, 'U1a-rowFmt'),
    ("    iMore.appendChild(bTabs); iMore.appendChild(bResume); iMore.appendChild(b5); iMore.appendChild(bCont); iMore.appendChild(bSide);\n",
     "    iMore.appendChild(bTabs); iMore.appendChild(bResume); iMore.appendChild(b5); iMore.appendChild(bCont); iMore.appendChild(bSide);\n"
     "    selTplMore = makeTplSelect();\n    iMore.appendChild(selTplMore);\n", 'U1b-iMore'),
    ("    gridMain.appendChild(b1); gridMain.appendChild(b2); gridMain.appendChild(b4);\n",
     "    gridMain.appendChild(b1); gridMain.appendChild(b2); gridMain.appendChild(b4);\n"
     "    w.appendChild(rowTpl); // v27.3: строка «Стиль PDF/HTML» — выбор виден в главной панели\n", 'U1c-rowTpl'),
    ("    applyTheme();\n    syncComfort();\n    refreshResume();\n    applyCollapsed();\n",
     "    applyTheme();\n    syncComfort();\n    refreshResume();\n    applyCollapsed();\n"
     "    // v27.3: мост для движка — авто-продолжение после URL-перехода (uaice_nav) и статус\n"
     "    try { window.__UAICE_UI__ = { setStatus: setStatus, autoResume: function () { if (!bResume.disabled) bResume.click(); } }; } catch (e) {}\n",
     'U2-bridge'),
    ("      row('Акцент панели', w._hfSysAccent",
     "      row('Стиль экспорта PDF/HTML', (typeof TPL_STYLES !== 'undefined' && TPL_STYLES[tplStyleId()]) ? TPL_STYLES[tplStyleId()].name + ' · 5 шаблонов МАКТ-2026 · 0 CDN' : '—', true);\n"
     "      row('Акцент панели', w._hfSysAccent", 'U3-passport'),
    ("'v' + SCRIPT_VER + ' HUMAN-FIRST · '", "'v' + SCRIPT_VER + ' STYLES+ACCENT · '", 'U4-badge'),
]

def apply_ui(text, strict=True):
    for old, new, tag in UIOPS:
        n = text.count(old)
        if n != 1:
            FAILS.append(f'{tag}: анкор найден {n} раз (в {"базе" if strict else "UI-файле"})')
            continue
        text = text.replace(old, new)
    return text

base = apply_ui(base, strict=True)
ui2 = apply_ui(ui, strict=True)

# ================= ЗАПИСЬ =================
open(OUT, 'w', encoding='utf-8', newline='\n').write(base)
open(UI_OUT, 'w', encoding='utf-8', newline='\n').write(ui2)

if FAILS:
    print('ОШИБКИ СБОРКИ:')
    for f in FAILS: print(' -', f)
    sys.exit(1)
print('OK: сборка завершена')
print('движок+UI:', OUT, len(base.splitlines()), 'строк,', len(base.encode('utf-8')), 'байт')
print('UI-слой (копия для будущих сборок):', UI_OUT, len(ui2.splitlines()), 'строк')
