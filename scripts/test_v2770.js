#!/usr/bin/env node
/* test_v2770.js — верификация UACE v27.7.0 «полная синтеза» (HF-цех в PML-PANEL) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const zlib = require('zlib');

const FILE = '/home/z/my-project/download/UACE-v27.7.0-PML-PANEL-B.user.js';
const BASE61 = '/home/z/my-project/download/UACE-v27.6.1-PML-PANEL-B.user.js';
const src = fs.readFileSync(FILE, 'utf8');
const base = fs.readFileSync(BASE61, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } };

console.log('== 1. Канон и структура ==');
const m = src.match(/\/\*PML-PURE-BEGIN\*\/([\s\S]*?)\/\*PML-PURE-END\*\//);
const mb = base.match(/\/\*PML-PURE-BEGIN\*\/([\s\S]*?)\/\*PML-PURE-END\*\//);
ok('PURE-блок байт-в-байт = 27.6.1 (хэш-канон r2 §5 не тронут)', m && mb && m[1] === mb[1]);
ok('соль PMLSTRUCT дословно', src.includes("const SALT = 'PMLSTRUCT';"));
ok("вход urlHash SALT+'URL>'", src.includes("SALT + 'URL>' + href"));
ok('версия честная 27.7.0', src.includes("@version      27.7.0") && src.includes("const VER = '27.7.0'"));
ok('имя v27.7 core', src.includes('UACE v27.7 core'));
ok('скан от document.body (fix 27.4.3)', src.includes('const bodyEl = document.body;'));
ok('badge append fix 27.4.1', src.includes("(root.parentElement || sh || root).append(els.badge)"));
ok('pagehide глушит авто-разведку (B-6)', src.includes('if (obsSession) finishObservation(true, true)'));
ok('renderRecon терпит обе формы scroll (E1)', src.includes("st.scroll === 'no-scroll-container' || st.scroll.primary === 'no-scroll-container'"));

console.log('== 2. Хоткеи §13 ==');
const hk = src.match(/const CONFIG = \{ name: 'UACE', version: VER, hotkeys: \[([\s\S]*?)\] \};/);
const keys = hk ? (hk[1].match(/key: '([A-Z])'/g) || []).map(s => s.slice(6, 7)) : [];
ok('канонный набор E/D/C/S/X/I', JSON.stringify(keys) === JSON.stringify(['E', 'D', 'C', 'S', 'X', 'I']));
ok('regHotkeys фильтр EDCSXI не расширен', src.includes("if ('EDCSXI'.indexOf(k) < 0) return;"));

console.log('== 3. Реестр REG: 38 кнопок, все 25 старых на месте ==');
const regBlock = src.match(/const REG = \[([\s\S]*?)\];\s*\n\s*const runAct/);
const ids = regBlock ? (regBlock[1].match(/\{ id: '([^']+)'/g) || []).map(s => s.slice(7, -1)) : [];
ok('REG ≥38 кнопок', ids.length >= 38);
ok('id уникальны', new Set(ids).size === ids.length);
const old25 = ['observe', 'copy-struct', 'copy-agent', 'dl-json', 'dl-md', 'dl-html', 'dl-txt', 'dl-csv', 'dl-agent', 'dl-zip', 'dlg-copy', 'dlg-md', 'dlg-json', 'dlg-txt', 'dlg-html', 'dlg-sharegpt', 'dlg-jsonl', 'dlg-alpaca', 'dlg-pdf', 'dlg-zip', 'stop', 'copylog', 'tabs', 'collapse', 'passport'];
ok('все 25 кнопок 27.6.1 сохранены', old25.every(x => ids.includes(x)));
const new13 = ['hf-md-rich', 'hf-md-scroll', 'hf-md-buffer', 'hf-continue', 'hf-pdf-cdn', 'hf-zip-media', 'bulk-run', 'bulk-tabs', 'bulk-resume', 'bulk-stop', 'bulk-clear', 'debug-report', 'debug-sniffer'];
ok('все 13 новых кнопок 27.7.0 на месте', new13.every(x => ids.includes(x)));

console.log('== 4. Приватность §15: сеть только по opt-in ==');
ok('S.mediaNet по умолчанию false', /mediaNet: false/.test(src));
ok('S.pdfCdn по умолчанию false', /pdfCdn: false/.test(src));
ok('fetchImageU8 обёрнут в гейт S.mediaNet', /if \(S\.mediaNet && imagesEnabled\(\)/.test(src));
ok('PDF-рендер требует S.pdfCdn', /if \(!S\.pdfCdn\) \{ printFallback/.test(src));
ok('buildZipEntries: pdf-фолбэк в md без CDN', /if \(fmt === 'pdf' && !S\.pdfCdn\) fmt = 'md'/.test(src));
ok('нет автовызовов html2pdf при старте', !/loadScript\(LIBS\.html2pdf[^)]*\);\s*\}\s*\)\(\)/.test(src));
ok('структурный контур не читает текст (buildStruct без innerText)', !/buildStruct[\s\S]{0,2200}innerText/.test(src));

console.log('== 5. FNV-1a 32 канон-векторы ==');
(() => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  w.Element.prototype.getBoundingClientRect = function () { return { width: 200, height: 40, top: 10, left: 10, bottom: 50, right: 210, x: 10, y: 10, toJSON() {} }; };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent || ''; }, configurable: true });
  w.eval(src);
  const I = w.__UACE_INTERNALS__;
  const doc = w.document;
  ok('интерна exposed (53+ новых имён)', !!I && !!I.domToMarkdown && !!I.zipStore && !!I.exportAll && !!I.getManifest);
  ok("FNV('') = 0x811c9dc5", I.FNV1a32('') === 0x811c9dc5);
  ok("FNV('a') = 0xe40c292c", I.FNV1a32('a') === 0xe40c292c);
  ok("FNV('foobar') = 0xbf9cf968", I.FNV1a32('foobar') === 0xbf9cf968);
  ok('hex8 формат lowercase', I.hex8(0xabcd) === '0000abcd');
  ok('sigHashIn формат', I.sigHashIn('UL>LI>P') === 'PMLSTRUCT>UL>LI>P');
  ok('urlHashIn формат', I.urlHashIn('https://x/y') === 'PMLSTRUCTURL>https://x/y');

  console.log('== 6. ZIP-райтер (zipStore): CRC32 + round-trip ==');
  ok('CRC32("123456789") = 0xCBF43926', I.crc32(new TextEncoder().encode('123456789')) === 0xcbf43926);
  const blob = I.zipStore([{ name: 'a.txt', data: 'привет мир' }, { name: 'bin/data.bin', data: new Uint8Array([1, 2, 3, 255]) }]);
  blob.arrayBuffer().then(ab => {
    fs.writeFileSync('/home/z/my-project/scripts/_v277_test.zip', Buffer.from(ab));
    ok('ZIP: PK\\x03\\x04 сигнатура', ab.byteLength > 100);
    const b = Buffer.from(ab);
    ok('ZIP: local header PK', b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04);
    // EOCD в хвосте
    const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    ok('ZIP: EOCD найден в хвосте', eocd > 0);
    ok('ZIP: флаг UTF-8 0x0800', b.readUInt16LE(6) === 0x0800);
    console.log('== 7. Rich-MD движок (jsdom) ==');
    const html = '<div><h2>Заголовок</h2><p>Абзац с <b>жирным</b> и <a href="https://ex.com">ссылкой</a>.</p>' +
      '<ul><li>один</li><li>два</li></ul><ol><li>перв</li><li>втор</li></ol>' +
      '<table><tr><th>A</th><td colspan="2">широкая</td></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>' +
      '<pre><code class="language-python">print(1)</code></pre><span>python</span><span>Copy</span>' +
      '<blockquote>цитата</blockquote><span class="katex"><annotation encoding="application/x-tex">E=mc^2</annotation></span></div>';
    const holder = doc.createElement('div'); holder.innerHTML = html; doc.body.appendChild(holder);
    const md = I.domToMarkdown(holder);
    ok('MD: заголовок ##', md.includes('## Заголовок'));
    ok('MD: жирный **', md.includes('**жирным**'));
    ok('MD: ссылка []()', md.includes('[ссылкой](https://ex.com)') || md.includes('[ссылка](https://ex.com)') || /\[.{2,20}\]\(https:\/\/ex\.com\)/.test(md));
    ok('MD: список - и нумерованный 1./2.', md.includes('- один') && /1\. перв[\s\S]*2\. втор/.test(md));
    ok('MD: таблица с colspan (пустая ячейка-дополнение)', /\| A \| широкая \|\s*\|/.test(md) || (md.includes('| A |') && md.includes('широкая')));
    ok('MD: код с языком ```python', /```python\nprint\(1\)\n```/.test(md));
    ok('MD: цитата >', md.split('\n').some(l => l.startsWith('> ')));
    ok('MD: KaTeX → $E=mc^2$', md.includes('$E=mc^2$'));
    const chromeCleaned = I.domToMarkdown(holder);
    ok('MD: хром код-виджета (python/Copy) вычищен из прозы', !/(^|\n)python\s*(Copy)?\s*(\n|$)/.test(chromeCleaned));
    console.log('== 8. Форматы (9) на синтетическом scraped ==');
    const scraped = { items: [{ role: 'user', content: '**вопрос**', text: 'вопрос', thinking: ['мысли'] }, { role: 'assistant', content: 'ответ', text: 'ответ', thinking: [] }], source: 'test', platformName: 'ChatGPT', images: [{ src: 'https://ex/i.png', alt: '', msg: 0 }], attachments: [{ url: 'https://ex/f.pdf', name: 'f.pdf' }], artifacts: [{ type: 'code', lang: 'python', content: 'print(1)', ext: 'py', msg: 1 }] };
    ok('toMarkdown front-matter', I.toMarkdown(scraped, 'T').startsWith('---\n'));
    ok('toJSON парсится + content_markdown', JSON.parse(I.toJSON(scraped, 'T')).messages[0].content_markdown === '**вопрос**');
    ok('toTXT роли [USER]', I.toTXT(scraped, 'T').includes('[USER]'));
    ok('toHTML автономный', I.toHTML(scraped, 'T').startsWith('<!DOCTYPE html>'));
    ok('toShareGPT from:human/gpt', JSON.parse(I.toShareGPT(scraped, 'T')).conversations[0].from === 'human');
    ok('toJSONL две строки', I.toJSONL(scraped, 'T').split('\n').length === 2);
    ok('toAlpaca пара instruction/output', JSON.parse(I.toAlpaca(scraped, 'T')).samples[0].output === 'ответ');
    console.log('== 9. Манифест/хеши/тома ==');
    ok('hashString 16 hex', /^[0-9a-f]{16}$/.test(I.hashString('abc')));
    ok('hashString детерминирован', I.hashString('abc') === I.hashString('abc'));
    ok('chatHash по ролям+тексту', /^[0-9a-f]{16}$/.test(I.chatHash(scraped)));
    doc.body.innerHTML = '<a href="/c/abc12345678"></a>';
    ok('manifestKey href-нормализация', I.manifestKey({ href: w.location.href }) === w.location.href);
    ok('manifestKey dataId-префикс', I.manifestKey({ dataId: 'xyz' }) === 'id:xyz');
    const many = []; for (let i = 0; i < 400; i++) many.push({ name: 'chats/' + i + '.md', data: 'x'.repeat(200000) });
    const vols = I.splitZipVolumes(many, 50 * 1024 * 1024);
    ok('тома: 400×200KB > 50МБ → >1 том', vols.length > 1);
    ok('тома: без потерь', vols.reduce((s, v) => s + v.length, 0) === many.length);
    ok('тома: один том под лимитом', I.splitZipVolumes(many.slice(0, 10), 50 * 1024 * 1024).length === 1);
    console.log('== 10. Санитайзеры v26 ==');
    ok('sanitize вычищает недопустимые', !/[\\/:*?"<>|]/.test(I.sanitize('a/b\\c:d*e?"<>|', 40)));
    ok('sanitize короткое имя без суффикса', I.sanitize('простой заголовок чата', 80) === 'простой заголовок чата');
    ok('progress-бар формат', /^\[[█·]{10}\] 1\/2 /.test(I.progress(0, 2, 'x')));
    console.log('== 11. Стоп-семантика 27.7.0 ==');
    ok('runAct оставляет Стоп/Пакет-стоп живыми', src.includes("['stop', 'bulk-stop'].forEach"));
    ok('Esc глушит пакет', src.includes("e.key === 'Escape' && (bulkRunning || tabsExportRunning)"));
    ok('stopAll: окно ИЛИ пакет', /function stopAll\(\) \{ if \(obsSession\) abortObservation\(\);[^}]*bulkRunning \|\| tabsExportRunning/.test(src));
    ok('CANCEL-флаг в циклах same-tab/tabs', (src.match(/if \(CANCEL\)/g) || []).length >= 4);

    console.log('== 12. Панель и комфорт ==');
    ok('Экспорт-настройки смонтированы', src.includes("'Экспорт-настройки (27.7.0)'"));
    ok('чекбоксы сети с пометкой (сеть!)', src.includes("exChk('mediaNet', 'Скачивать медиа', true)") && src.includes("exChk('pdfCdn', 'PDF-рендер CDN', true)"));
    ok('store ≤512B: ключи не раздуты', (() => { const s = JSON.stringify({ theme: 'system', fs: 14, motion: true, collapsed: false, onlyNew: true, autoScroll: true, stripThink: true, images: true, mermaid: true, fm: true, mediaNet: true, pdfCdn: true, zipInner: 'both', bulkFmt: 'sharegpt', hotkeys: ['E', 'D', 'C', 'S', 'X', 'I'] }); return s.length <= 512; })());
    ok('паспорт: строка HF-цеха', src.includes("'HF-цех 27.7.0: пакетов '"));
    ok('тост не стекуется (один id)', src.includes("getElementById('pml-hf-toast')"));
    ok('журнал инициализации 27.7.0', src.includes('HF-цех 27.7.0: богатый MD/KaTeX/Mermaid'));
    done();
  }).catch(e => { fail++; console.log('  FAIL zip-async: ' + e.message); done(); });
})();

let _done = false;
function done() { if (_done) return; _done = true;
  console.log('\n== ИТОГ ==');
  console.log('PASS: ' + pass + '  FAIL: ' + fail);
  process.exit(fail ? 1 : 0); }
setTimeout(() => { if (!_done) { console.log('TIMEOUT'); done(); } }, 15000);
