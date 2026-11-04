// Smoke-тест build()/init() UACE v27.4.3 в jsdom — ловит рантайм-падения DOM-сборки.
// Ловил ранее: null.append у ребёнка ShadowRoot (27.4.1); класс E1 «reading 'path'» на no-scroll (двойной страж 27.4.2+).
// Новое 27.4.3: экспорт struct, канонные хэши через __UACE_INTERNALS__, pathOf-формат, честная версия, легаси-scroll.
'use strict';
const fs = require('fs');
const { JSDOM } = require('jsdom');

const FILE = '/home/z/my-project/download/UACE-v27.4.3-PML-PANEL-B.user.js';
const src = fs.readFileSync(FILE, 'utf8');

const dom = new JSDOM(
  '<!doctype html><html><head><title>t</title></head><body><main><article><p>item</p><p>item</p><p>item</p></article></main></body></html>',
  { url: 'https://example.com/page', runScripts: 'outside-only', pretendToBeVisual: true }
);
const w = dom.window;

// Стабы среды, которых нет в jsdom:
if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
if (!w.navigator.clipboard) Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });

let failures = 0;
const ok = (cond, name) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) failures++; };

let bootErr = null;
try { w.eval(src); } catch (e) { bootErr = e; }
ok(!bootErr, 'boot без исключений' + (bootErr ? ' — ' + bootErr.message : ''));

const h = w.document.getElementById('pml-host');
ok(!!h, 'хост #pml-host в documentElement');
ok(!!(h && h.shadowRoot), 'attachShadow() создал ShadowRoot');

const sr = h && h.shadowRoot;
const rootEl = sr && sr.querySelector('.pml-root');
ok(!!rootEl, '.pml-root внутри ShadowRoot');
ok(!!(sr && sr.querySelector('.pml-badge44')), 'бейдж .pml-badge44 на месте (не упал на parentElement)');
ok(!!(rootEl && rootEl.querySelector('.pml-hd')), 'шапка .pml-hd собрана');
ok([...(rootEl ? rootEl.querySelectorAll('.pml-tab') : [])].length === 3, 'три вкладки (P14/7)');

const api = w.__PML_PANEL_API__;
ok(!!api, 'API-синглтон __PML_PANEL_API__ выставлен');
ok(api && api.ping && api.ping().alive === true, 'ping().alive === true');
ok(api && typeof api.getPassport() === 'string' && api.getPassport().indexOf('Соль FNV-1a: PMLSTRUCT') >= 0, 'паспорт: соль PMLSTRUCT (r2 §5)');

// Экспорт struct: кнопки в обеих вкладках + реестр Действий
ok(!!(rootEl && [...rootEl.querySelectorAll('button')].filter(b => b.textContent === 'Копировать struct').length >= 2), '«Копировать struct» есть во вкладках Разведка и Действия');
const actIds = [...(rootEl ? rootEl.querySelectorAll('.pml-act button') : [])].map(b => b.textContent);
ok(['Наблюдение 60 с', 'Копировать struct', 'Стоп', 'Скопировать журнал'].every(x => actIds.includes(x)), 'реестр Действий: observe/copy-struct/stop/copylog');
ok(actIds.includes('Цикл вкладок') && actIds.includes('Открыть паспорт'), 'реестр Действий: tabs/passport');

// Честная версия: @version == VER == имени файла (урок v1.0.4)
ok(/@version\s+27\.4\.3/.test(src) && src.indexOf("const VER = '27.4.3'") >= 0, 'честная версия: @version == VER == 27.4.3');
ok(FILE.indexOf('27.4.3') >= 0, 'честная версия: имя файла содержит 27.4.3');

// Журнал: строка соли для сверки на первом обмене struct
ok(!!(rootEl && rootEl.textContent.indexOf('соль FNV-1a: PMLSTRUCT') >= 0), 'журнал: строка соли PMLSTRUCT');

// __UACE_INTERNALS__: канонные хэши против независимой реализации в тесте (UTF-8, вкл. не-ASCII)
try {
  const I = w.__UACE_INTERNALS__;
  ok(!!I && I.SALT === 'PMLSTRUCT', '__UACE_INTERNALS__ выставлен, соль PMLSTRUCT');
  const ref = s => { const b = Buffer.from(s, 'utf8'); let hh = 0x811c9dc5 >>> 0;
    for (const byte of b) hh = Math.imul((hh ^ byte) >>> 0, 0x01000193) >>> 0; return (hh >>> 0).toString(16).padStart(8, '0'); };
  ok(I.hex8(I.FNV1a32(I.sigHashIn('UL>LI'))) === '0aebe13f', 'internals: sigHash-вектор UL>LI = 0aebe13f');
  ok(I.hex8(I.FNV1a32(I.urlHashIn('https://example.com/'))) === 'a03cc27b', 'internals: urlHash-вектор = a03cc27b');
  ok(I.hex8(I.FNV1a32(I.urlHashIn('https://ru.example/тест'))) === ref('PMLSTRUCTURL>https://ru.example/тест'), 'internals: urlHash не-ASCII = UTF-8-reference');

  // sigOf: pre-order UPPERCASE глубина ≤3; sigHash на живом DOM
  const d = w.document.createElement('div'); d.innerHTML = '<ul><li><p>т</p></li><li><p>т</p></li><li><p>т</p></li></ul>';
  w.document.body.appendChild(d);
  const li = d.querySelector('li');
  ok(I.sigOf(li) === 'LI>P', 'sigOf: pre-order UPPERCASE «LI>P»');
  ok(I.sigHash(li) === 'a9ecc18e', 'sigHash(li>p) = a9ecc18e (канон-вектор)');

  // pathOf: nth(i) только при i>1, от body, без html
  const pth = I.pathOf(d.querySelector('ul'));
  ok(pth === 'body>div>ul', 'pathOf: «body>div>ul» (без :nth(1) на первых одноимённых)');
  const d2 = w.document.createElement('div'); d2.innerHTML = '<span>a</span><span>b</span><i>c</i>';
  w.document.body.appendChild(d2);
  ok(I.pathOf(d2.children[1]) === 'body>div:nth(2)>span:nth(2)', 'pathOf: второй div → div:nth(2), второй span → span:nth(2)');

  // buildStruct на странице без скроллов: форма столбца UPOLY (строка на уровне scroll), recon no-data
  const st = I.buildStruct();
  ok(st.structVersion === 'r1' && st.scroll === 'no-scroll-container', 'buildStruct: scroll-строка на уровне scroll (столбец UPOLY)');
  ok(st.mut.window === 60 && st.recon.status === 'no-data', 'buildStruct: mut window 60, резерв no-data');
  ok(st.meta.urlHash === ref('PMLSTRUCTURL>https://example.com/page'), 'buildStruct: urlHash страницы = UTF-8-reference');
  ok(st.dom.groups.every(g => !('found' in g) && 'inPrimary' in g), 'struct.dom.groups: 6 канонных ключей, без score-полей');
} catch (e) { ok(false, '__UACE_INTERNALS__/buildStruct бросил: ' + e.message); }

// renderRecon: легаси-строка на уровне scroll (форма UPOLY v1.0.x) — класс E1, регрессия
try {
  api.renderRecon({ structVersion: 'r1', meta: { ts: 1, viewport: { w: 800, h: 600 }, dpr: 1, urlHash: '00000000' },
    dom: { maxDepth: 2, blockCount: 3, landmarks: [], groups: [], truncated: true },
    scroll: 'no-scroll-container', mut: { window: 60, adds: 0, removes: 0, recycles: 0, medianIntervalMs: null, streamCandidate: null },
    anchors: { mountPoints: [], persistentPaths: [], stability: 0, truncated: false }, recon: { status: 'no-data' } });
  ok(rootEl.textContent.indexOf('no-scroll-container') >= 0, 'renderRecon: легаси-строка уровня scroll отрисована без TypeError (E1)');
  ok(rootEl.textContent.indexOf('no-data') >= 0, 'renderRecon: секция Резерв отрисована (r2 §3)');
} catch (e) { ok(false, 'renderRecon (легаси) бросил: ' + e.message); }

// renderRecon: канон-объект со строкой на primary (форма C1 27.4.2) — тоже терпит
try {
  api.renderRecon({ structVersion: 'r1', meta: { ts: 2, viewport: { w: 800, h: 600 }, dpr: 1, urlHash: '00000000' },
    dom: { maxDepth: 2, blockCount: 3, landmarks: [], groups: [] },
    scroll: { primary: 'no-scroll-container', containers: [] }, mut: null,
    anchors: { mountPoints: [], persistentPaths: [], stability: 0 } });
  ok(rootEl.textContent.indexOf('no-scroll-container') >= 0, 'renderRecon: канон C1 (строка на primary) отрисован');
} catch (e) { ok(false, 'renderRecon (C1) бросил: ' + e.message); }

// renderRecon: полноценный primary с данными (forward-compat + усечено-boolean)
try {
  api.renderRecon({ structVersion: 'r1', meta: { ts: 3, viewport: { w: 800, h: 600 }, dpr: 1, urlHash: '00000000' },
    dom: { maxDepth: 4, blockCount: 40, landmarks: [], groups: [{ sigHash: 'f0338710', count: 5, depth: 3, uniformity: 1, samplePath: 'body>main>ul>li', inPrimary: true }], truncated: true },
    scroll: { primary: { path: 'body>main', scrollHeight: 4651, clientHeight: 539, ratio: 0.12 }, containers: [{ path: 'body>main', scrollHeight: 4651, clientHeight: 539 }], truncated: false },
    mut: { window: 60, adds: 0, removes: 0, recycles: 0, medianIntervalMs: null, streamCandidate: null },
    anchors: { mountPoints: [{ path: 'body>div>div>div:nth(2)>div:nth(3)>div>div:nth(2)>div:nth(2)>div>div:nth(2)>div>div>div', mode: 'sticky', h: 34 }], persistentPaths: [], stability: 0, truncated: false },
    recon: { status: 'no-data' } });
  const txt = rootEl.textContent;
  ok(txt.indexOf('f0338710') >= 0 && txt.indexOf('✓скролл') >= 0, 'renderRecon: группа с inPrimary помечена ✓скролл');
  ok(txt.indexOf('0.12') >= 0 && txt.indexOf('усечено') >= 0, 'renderRecon: ratio и boolean-усечено отрисованы');
} catch (e) { ok(false, 'renderRecon (данные) бросил: ' + e.message); }

// Свернуть/развернуть
try {
  const col = [...(rootEl ? rootEl.querySelectorAll('.pml-hd button') : [])].find(b => b.getAttribute('aria-label') === 'Свернуть панель');
  col.click();
  ok(rootEl.hidden === true && sr.querySelector('.pml-badge44').hidden === false, 'свёртка: root.hidden=true, бейдж виден');
  sr.querySelector('.pml-badge44').click();
  ok(rootEl.hidden === false, 'клик по бейджу разворачивает панель');
} catch (e) { ok(false, 'свёртка/разворот упали: ' + e.message); }

// Alt+E — разведка (мгновенная, ≤150 мс бюджет); Alt+C — копирование struct (clipboard-стаб)
try {
  w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'E', altKey: true, bubbles: true, cancelable: true }));
  ok(true, 'Alt+E отправлен без синхронного падения');
  w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'C', altKey: true, bubbles: true, cancelable: true }));
  ok(true, 'Alt+C (копировать struct) отправлен без синхронного падения');
} catch (e) { ok(false, 'хоткеи упали синхронно: ' + e.message); }

// Гостевой mount: UACE как владелец принимает гостя — log строка подключения (паритет с UPOLY)
try {
  api.mount({ name: 'PROBE', version: '0.9', hotkeys: [{ key: 'E', label: 'чужая разведка', run: () => {} }] });
  ok(rootEl.textContent.indexOf('подключён через mount(config): PROBE v0.9') >= 0, 'mount гостя: строка в журнале');
  ok(rootEl.textContent.indexOf('чужая разведка (без хоткея)') >= 0, 'конфликт хоткея: кнопка-фолбэк добавлена (append, не replace)');
} catch (e) { ok(false, 'гостевой mount упал: ' + e.message); }

console.log('\nИтог: ' + (failures === 0 ? 'ВСЕ ПРОВЕРКИ PASS' : failures + ' FAIL'));
process.exit(failures === 0 ? 0 : 1);
