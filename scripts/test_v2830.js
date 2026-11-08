/* Тест v28.3.0: стилевой движок экспорта + структурные проверки сборки.
 * Запуск: node scripts/test_v2830.js  */
const fs = require('fs');
const vm = require('vm');
const path = '/home/z/my-project/download/uace-pml-v28.3.0-unified.user.js';
const src = fs.readFileSync(path, 'utf8');
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  PASS ' + name); } else { fail++; console.error('  FAIL ' + name); } };

/* ---------- 1. Структурные проверки ---------- */
console.log('[1] Структура сборки');
ok(src.includes("// @version      28.3.0-unified"), '@version 28.3.0-unified');
ok(src.includes("const SCRIPT_VER = '28.3.0-unified';"), 'SCRIPT_VER 28.3.0-unified');
ok(src.includes("'uaice_theme','uaice_evening','uaice_fsz','uaice_motion','uaice_tpl'];"), 'SETTINGS_KEYS += uaice_tpl');
ok(!src.includes("settings.appendChild(rowTheme)"), 'тема-строка УБРАНА из скрытых настроек');
ok(src.includes("box.appendChild(grip);\n  box.appendChild(rowTheme);"), 'тема-строка ДОБАВЛЕНА на видное место (после grip)');
ok(src.indexOf("gripBtns.appendChild(bHelp)") !== -1 && src.indexOf("gripBtns.appendChild(bHelp)") < src.indexOf("gripBtns.appendChild(bPass)"), '«? Справка» СЛЕВА от «ⓘ Паспорт»');
ok(src.includes("const bHelp = btn('?')"), 'кнопка Справка создана');
ok(src.includes("box.appendChild(helpBox);"), 'helpBox в сборке панели');
ok((src.match(/\n\s+\[[A-Za-z][A-Za-z0-9_.]*, '/g) || []).length >= 38, 'тултипы: >= 38 записей в TIPS');
ok(src.includes("const TIPS = ["), 'TIPS-таблица подсказок');
ok(src.includes("bindTip"), 'bindTip-функция');
ok(src.includes("tipEl.id = UI_ID + '-tip'"), 'тултип-элемент #uaice-28-tip');
ok(src.includes("w.appendChild(tipEl);"), 'тултип внутри #uaice-28 (наследование --hf-*)');
ok(src.includes("row('Стиль PDF/HTML'"), 'паспорт: строка стиля');
ok(src.includes("'uaice_theme','uaice_evening','uaice_fsz','uaice_motion','uaice_tpl'].forEach(k => safeStorageRemove(k));"), 'сброс: uaice_tpl очищается');
ok(src.includes("selTpl.value = tplStyleId();"), 'селект стиля синхронизирован');
ok(src.includes("return fillStyledDoc(doc, scraped, title);"), 'fillPrintDoc -> fillStyledDoc (PDF в стиле)');
ok(src.includes("openPrintWindow(buildStyledHTML(scraped, title, {}))"), 'printFallback -> стилизованное окно');
ok(src.includes("buildStyledHTML(results.map(r => ({ scraped: r.scraped, title: r.title, url: r.url })), 'AI Chats', { list: true })"), 'сводный HTML -> стилизованный');
ok(src.includes("return buildStyledHTML(scraped, title, {});"), 'toHTML -> buildStyledHTML');
ok(src.includes("TPL_STYLES, TPL_KEY, tplStyleId, tplCss, tplEscape, buildStyledHTML, styledParts, fillStyledDoc, openPrintWindow,"), 'internals: движок экспортирован');
ok(src.includes("Стилей PDF/HTML: ' + Object.keys(TPL_STYLES).length"), 'boot-лог: число стилей');
ok(/[,(]\s*selFormat,\s*selTpl\]/.test(src), 'setBusy блокирует selTpl');
ok(src.includes("[rowFmt, rowTpl, rowTheme, gridMain"), 'applyCollapsed скрывает новые блоки');

/* ---------- 2. Стилевой движок: изоляция и векторы ---------- */
console.log('[2] Стилевой движок (изолированный прогон)');
const m = src.indexOf('/* === TPL-ENGINE:BEGIN === */');
const m2 = src.indexOf('/* === TPL-ENGINE:END === */');
ok(m !== -1 && m2 !== -1 && m2 > m, 'маркеры TPL-ENGINE на месте');
const engine = src.slice(m, m2);
const sandbox = {
  safeStorageGet: () => null,
  now: () => '2026-09-20 12:00:00',
  platformName: () => 'тест-платформа',
  roleLabel: (r) => String(r || 'unknown'),
  SCRIPT_VER: '28.3.0-unified',
  location: { href: 'https://example.test/chat' },
  setHTML: (el, h) => { el.__html = h; return true; },
  console
};
vm.createContext(sandbox);
vm.runInContext(engine + '\nthis.__api = { TPL_STYLES, tplStyleId, tplCss, tplEscape, tplBarHTML, tplPassportHTML, tplChatHTML, styledParts, buildStyledHTML, fillStyledDoc, openPrintWindow };', sandbox);
const api = sandbox.__api;

const ids = Object.keys(api.TPL_STYLES);
ok(ids.length === 5, '5 стилей экспорта');
ok(ids.join(',') === 'imperial,makt,swiss,brutal,sepia', 'состав: imperial,makt,swiss,brutal,sepia');
ok(api.TPL_STYLES.imperial.name === 'Имперский', 'стиль «Имперский» присутствует');
ok(api.tplStyleId() === 'imperial', 'дефолт стиля = imperial (uaice_tpl пуст)');

const css = api.tplCss();
ok(css.includes('html[data-tpl="imperial"]'), 'CSS: селектор imperial');
ok(css.includes('#d4af37'), 'CSS: золото #d4af37 в Имперском');
ok(css.includes('print-color-adjust:exact'), 'CSS: print-color-adjust:exact');
ok(css.includes('@page{size:A4'), 'CSS: @page A4');
['makt', 'swiss', 'brutal', 'sepia'].forEach(id => ok(css.includes('html[data-tpl="' + id + '"]'), 'CSS: селектор ' + id));

const scraped = { items: [
  { role: 'user', text: 'Привет <b>мир</b>\nвторая строка' },
  { role: 'assistant', text: 'Ответ ассистента', thinking: ['мысль 1', 'мысль 2'] }
] };
const html = api.buildStyledHTML(scraped, 'Тест <Заголовок> & "кавычки"', {});
ok(html.startsWith('<!DOCTYPE html><html lang="ru" data-tpl="imperial">'), 'buildStyledHTML: доктайп + data-tpl=imperial');
ok(html.includes('<title>Тест &lt;Заголовок&gt; &amp; &quot;кавычки&quot;</title>'), 'buildStyledHTML: экранирование заголовка');
ok(html.includes('Привет &lt;b&gt;мир&lt;/b&gt;'), 'buildStyledHTML: экранирование текста сообщений');
ok(html.includes('tpl-bar') && html.includes('Печать / PDF'), 'buildStyledHTML: панель стилей с кнопкой печати');
ok(html.includes('class="cover"') && html.includes('class="flow"') && html.includes('class="colophon"'), 'buildStyledHTML: анатомия cover/flow/colophon');
ok(html.includes('details class="think"'), 'buildStyledHTML: thinking-блок');
ok(html.includes('Имперский'), 'buildStyledHTML: имя стиля в паспорте страницы');
ok(html.includes('0</b>') || html.includes('внешних запросов: <b>0</b>'), 'buildStyledHTML: паспорт «0 внешних запросов»');
ok(!html.includes('\u0000'), 'buildStyledHTML: без нулевых байтов');

const list = api.buildStyledHTML([
  { scraped: scraped, title: 'Чат 1', url: 'https://a.test/1' },
  { scraped: { items: [{ role: 'user', text: 'x' }] }, title: 'Чат 2', url: 'https://a.test/2' }
], 'Сводный', {});
ok((list.match(/class="chat"/g) || []).length === 2, 'сводный: 2 chat-секции');

/* fillStyledDoc: DOM-API наполнение (TT-безопасный путь) */
function makeStubDoc() {
  const created = [];
  const doc = {
    documentElement: { setAttribute(k, v) { this[k] = v; } },
    head: { appendChild(x) { created.push(['head', x]); } },
    body: { appendChild(x) { created.push(['body', x]); } },
    querySelectorAll: () => [],
    createElement: (tag) => ({ tagName: tag, textContent: '', className: '', setAttribute() {}, appendChild() {} })
  };
  doc.__created = created;
  return doc;
}
const doc = makeStubDoc();
const main = api.fillStyledDoc(doc, scraped, 'Печать PDF');
ok(doc.documentElement['data-tpl'] === 'imperial', 'fillStyledDoc: data-tpl на <html>');
ok(doc.__created.some(x => x[0] === 'head' && x[1].tagName === 'style' && x[1].textContent.includes('#d4af37')), 'fillStyledDoc: <style> с золотом Имперского');
ok(doc.__created.some(x => x[0] === 'body' && x[1] === main), 'fillStyledDoc: <main> в body');
ok(main.__html && main.__html.includes('class="cover"') && main.__html.includes('class="flow"'), 'fillStyledDoc: cover+flow в main');
ok(!main.__html.includes('tpl-bar'), 'fillStyledDoc: без панели стилей (печать чистая)');

/* ---------- 3. WCAG-контраст всех 5 стилей ---------- */
console.log('[3] WCAG 2.2 контраст стилей');
function lum(hex) {
  const c = hex.replace('#', '');
  const v = [0, 2, 4].map(i => { let x = parseInt(c.slice(i, i + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contrast(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
const vars = {};
for (const id of ids) {
  const block = css.split('html[data-tpl="' + id + '"]{')[1].split('}')[0];
  const get = (name) => { const mm = block.match(new RegExp('--' + name + ':(#[0-9a-f]{6})')); return mm ? mm[1] : null; };
  vars[id] = { bg: get('bg'), paper: get('paper'), ink: get('ink'), ink2: get('ink2'), accent: get('accent'), accentTx: get('accent-tx'), role: get('role-tx') };
  const v = vars[id];
  ok(v.ink && v.paper, 'переменные ' + id + ' распознаны');
  ok(contrast(v.ink, v.bg) >= 4.5, id + ': ink/bg = ' + contrast(v.ink, v.bg).toFixed(2) + ':1 ≥4.5');
  ok(contrast(v.ink, v.paper) >= 4.5, id + ': ink/paper = ' + contrast(v.ink, v.paper).toFixed(2) + ':1 ≥4.5');
  ok(contrast(v.accentTx, v.accent) >= 4.5, id + ': accent-tx/accent = ' + contrast(v.accentTx, v.accent).toFixed(2) + ':1 ≥4.5');
}
ok(contrast(vars.imperial.ink, vars.imperial.paper) >= 7, 'Имперский: текст/бумага ≥7:1 (крупный кегль 18px для слабого зрения)');

/* ---------- 4. Канон Тёплой палитры панели (регресс «ТЕПЛО») ---------- */
console.log('[4] Тёплая палитра панели');
const warm = src.match(/warm:\s*\{ bg:'#f6efe2'[^}]*\}/);
ok(!!warm, 'HF_PALETTES.warm канон: bg #f6efe2');
ok(src.includes("[['auto', 'Авто'], ['light', 'Свет'], ['dark', 'Тьма'], ['warm', 'Тепло']]"), '4 кнопки тем, включая ТЕПЛО');
ok(contrast('#3a3226', '#f6efe2') >= 4.5, 'Тёплая: текст/фон = ' + contrast('#3a3226', '#f6efe2').toFixed(2) + ':1 ≥4.5');
ok(contrast('#ffffff', '#8a5a00') >= 4.5, 'Тёплая: текст на акценте = ' + contrast('#ffffff', '#8a5a00').toFixed(2) + ':1 ≥4.5');

console.log('\nИТОГО: PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
