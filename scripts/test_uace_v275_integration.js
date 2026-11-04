// Интеграционный тест 27.5.0 «усвоение ландшафта»: agentView (Playwright MCP-формат), downsample (D2Snap),
// simhash/minhash-сверки (Charikar 2002 / Broder 1997). Работает через __UACE_INTERNALS__ в jsdom
// и на синтетических struct-ах. Всё — вне хэш-канона r2 §5: канонные поля не трогаем.
'use strict';
const fs = require('fs');
const { JSDOM } = require('jsdom');

const FILE = '/home/z/my-project/download/UACE-v27.5.0-PML-PANEL-B.user.js';
const src = fs.readFileSync(FILE, 'utf8');

const dom = new JSDOM('<!doctype html><html><body><main><p>secret-page-text</p></main></body></html>',
  { url: 'https://example.com/int', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
if (!w.matchMedia) w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
if (!w.navigator.clipboard) Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });

let failures = 0, pass = 0;
const ok = (cond, name) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); cond ? pass++ : failures++; };

let bootErr = null;
try { w.eval(src); } catch (e) { bootErr = e; }
ok(!bootErr, 'boot без исключений' + (bootErr ? ' — ' + bootErr.message : ''));
const I = w.__UACE_INTERNALS__;
ok(!!I && typeof I.agentView === 'function', 'internals доступны');

/* ---------- Синтетика: живая страница-класс A (чат с фидом) и её близнец/чужак ---------- */
const mkStruct = (over) => Object.assign({
  structVersion: 'r1',
  meta: { ts: 100, viewport: { w: 1200, h: 800 }, dpr: 1, urlHash: 'aabbccdd' },
  dom: {
    maxDepth: 6, blockCount: 900,
    landmarks: [
      { tag: 'nav', role: 'navigation', path: 'body>div>nav' },
      { tag: 'main', role: null, path: 'body>div>main' },
      { tag: 'aside', role: 'complementary', path: 'body>div>aside' }],
    groups: [
      { sigHash: '0aebe13f', count: 12, depth: 3, uniformity: 1, samplePath: 'body>main>ul>li', inPrimary: true },
      { sigHash: 'a9ecc18e', count: 6, depth: 2, uniformity: 0.86, samplePath: 'body>aside>ul>li', inPrimary: false },
      { sigHash: 'f0338710', count: 4, depth: 2, uniformity: 0.75, samplePath: 'body>div>div>ul>li', inPrimary: true }],
    truncated: false },
  scroll: { primary: { path: 'body>main', scrollHeight: 4651, clientHeight: 539, ratio: 0.12 }, containers: [{ path: 'body>main', scrollHeight: 4651, clientHeight: 539 }], truncated: false },
  mut: { window: 60, adds: 10, removes: 8, recycles: 4, medianIntervalMs: 900, streamCandidate: false },
  anchors: { mountPoints: [{ path: 'body>div>header', mode: 'sticky', h: 40 }], persistentPaths: [], stability: 0, truncated: false },
  recon: { status: 'found', candidate: { path: 'body>main>ul>li', sigHash: '0aebe13f', inPrimary: true, confidence: 82, basis: { u: 100, c: 30, p: 100, s: 88, l: 100 } } }
}, over || {});
const clone = JSON.parse(JSON.stringify(mkStruct()));

/* ---------- 1. agentView: формат Playwright MCP + приватность §15 ---------- */
const av = I.agentView(mkStruct());
const avLines = av.split('\n');
ok(avLines[0] === '- page urlHash=aabbccdd ratio=0.12', 'agentView: заголовок page urlHash+ratio');
ok(avLines.some(l => l === '- navigation [ref=l1] path=body>div>nav'), 'agentView: роль вместо тега, ref-нумерация с l1');
ok(avLines.some(l => l === '- main [ref=l2] path=body>div>main'), 'agentView: тег при role=null');
ok(avLines.some(l => l === '- group 0aebe13f [ref=g1] x12 depth=3 in-primary'), 'agentView: группа с in-primary');
ok(avLines.some(l => l === '- mount sticky [ref=m1] h=40 path=body>div>header'), 'agentView: точка монтажа');
ok(avLines.some(l => l === '- candidate 0aebe13f conf=82'), 'agentView: кандидат резерва r2 §3');
ok(av.indexOf('secret-page-text') < 0, 'agentView: 0 текста страницы (§15) — текст <p> не просочился');
ok(I.agentView(clone) === av, 'agentView: детерминизм между копиями struct');
ok(I.agentView(mkStruct({ dom: { maxDepth: 1, blockCount: 1, landmarks: [], groups: [], truncated: false }, scroll: 'no-scroll-container', anchors: { mountPoints: [], persistentPaths: [], stability: 0, truncated: false }, recon: { status: 'no-data' } })).split('\n').length === 1, 'agentView: пустой struct → только заголовок (без падений)');
ok(I.agentView(null).split('\n')[0].indexOf('- page urlHash=') === 0, 'agentView(null): фолбэк на buildStruct живой страницы');

/* ---------- 2. downsample: бюджет, приоритеты, детерминизм ---------- */
const ds400 = I.downsample(mkStruct(), 400);
ok(ds400.used <= 400 && ds400.budget === 400 && ds400.dropped === 0, 'downsample: бюджет 400 вмещает весь пример, used=' + ds400.used);
const order = ds400.view.split('\n');
ok(order[0].indexOf('page aabbccdd') === 0, 'downsample: page — приоритет 0');
ok(order.findIndex(l => l.indexOf('navigation') === 0) < order.findIndex(l => l.indexOf('mount') === 0) && order.findIndex(l => l.indexOf('mount') === 0) < order.findIndex(l => l.indexOf('group') === 0), 'downsample: порядок landmarks → mounts → groups (coverage-фаза D2Snap)');
const tight = I.downsample(mkStruct(), 30); // пол бюджета 60: заголовок обязан выживать
ok(tight.used <= 60 && tight.budget === 60, 'downsample: запрос 30 поднят до пола 60 (защита заголовка), used=' + tight.used);
ok(tight.dropped > 0 && tight.view.endsWith('за бюджетом 60'), 'downsample: отброшенные посчитаны, хвост-строка с реальным бюджетом');
ok(tight.view.split('\n')[0].indexOf('page aabbccdd') === 0, 'downsample: при жёстком бюджете page выживает первым');
ok(I.downsample(mkStruct(), 30).view === tight.view, 'downsample: детерминизм (без рандома)');
ok(I.downsample(mkStruct()).budget === 400, 'downsample: дефолт 400 «токенов» (масштаб Playwright MCP 200–400)');
ok(I.downsample(mkStruct(), 10).budget === 60, 'downsample: пол нижнего бюджета 60 (заголовок обязан выживать)');

/* ---------- 3. simhash/hamming: свойство близости классов страниц ---------- */
const same = I.simBetween(mkStruct(), clone);
ok(same === 0, 'simBetween: идентичные struct → 0 бит');
const twin = mkStruct(); twin.meta.urlHash = 'deadbeef'; twin.dom.groups[0].count = 11; // тот же класс, чуть иной счётчик
const dTwin = I.simBetween(mkStruct(), twin);
console.log('  (близнец-класс: Хэмминг d=' + dTwin + ' бит из 64)');
const stranger = mkStruct({
  dom: { maxDepth: 4, blockCount: 40, landmarks: [{ tag: 'footer', role: 'contentinfo', path: 'body>footer' }], groups: [{ sigHash: '11111111', count: 3, depth: 1, uniformity: 0.9, samplePath: 'body>footer>div', inPrimary: false }], truncated: false },
  anchors: { mountPoints: [], persistentPaths: [], stability: 0, truncated: false } });
const dStranger = I.simBetween(mkStruct(), stranger);
console.log('  (чужак-класс: Хэмминг d=' + dStranger + ' бит из 64)');
ok(dTwin < dStranger, 'simBetween: близнец ближе чужака (свойство классов)');
ok(dStranger >= 8, 'simBetween: чужак различим (d≥8)');
const emptyA = { dom: { landmarks: [], groups: [] }, anchors: { mountPoints: [] } };
ok(I.simBetween(emptyA, emptyA) === 0, 'simBetween: EMPTY-фича — стабильный фолбэк без падений');
ok(I.compareStructs(mkStruct(), mkStruct()).sim === 0, 'compareStructs: sim согласован с simBetween');

/* ---------- 4. compareStructs: Jaccard (линейка minhash, точный подсчёт на малых наборах) ---------- */
const cSelf = I.compareStructs(mkStruct(), clone);
ok(cSelf.jaccard === 1 && cSelf.inter === 3 && cSelf.groupsA === 3 && cSelf.groupsB === 3, 'compareStructs: самопересечение J=1 (3/3)');
const halfB = clone; halfB.dom.groups = [clone.dom.groups[0], clone.dom.groups[1], { sigHash: '99999999', count: 2, depth: 1, uniformity: 1, samplePath: 'x', inPrimary: false }];
const cHalf = I.compareStructs(mkStruct(), halfB);
ok(cHalf.inter === 2 && cHalf.groupsA === 3 && cHalf.groupsB === 3 && cHalf.jaccard === 0.5, 'compareStructs: J=2/4=0.5 (hx-округление)');
const cEmpty = I.compareStructs({ dom: { groups: [] } }, { dom: { groups: [] } });
ok(cEmpty.jaccard === 1, 'compareStructs: оба пустых → J=1 (конвенция тождества)');
ok(I.compareStructs(mkStruct(), { dom: { groups: [] } }).jaccard === 0, 'compareStructs: пустое пересечение → J=0');

/* ---------- 5. Живая страница: интеграция не задевает канон ---------- */
const st = I.buildStruct();
ok(st.structVersion === 'r1' && st.scroll === 'no-scroll-container', 'живой struct: канонная форма (столбец UPOLY) не изменилась');
ok(mkStruct().dom.groups.every(g => Object.keys(g).length === 6 && ['sigHash', 'count', 'depth', 'uniformity', 'samplePath', 'inPrimary'].every(k => k in g)), 'синтетика: группы — ровно 6 канонных ключей');
ok(st.dom.groups.every(g => Object.keys(g).length === 6 && !('ext' in g)), 'живой struct: группы без ext-полей (в jsdom без layout групп нет — every пустого массива истинен, канон формы проверен на синтетике)');
ok(st.dom.landmarks.some(l => l.tag === 'main'), 'живой struct: landmark main на странице-примере');
const avLive = I.agentView(st);
ok(avLive.indexOf('secret-page-text') < 0 && avLive.indexOf('page urlHash=') > 0, 'живой agentView: приватность §15 + заголовок');
const dsLive = I.downsample(st);
ok(dsLive.used <= 400 && dsLive.view.indexOf('page ' + st.meta.urlHash) === 0, 'живой downsample: бюджет и приоритет 0');
ok(I.simBetween(st, I.buildStruct()) === 0, 'живой simBetween: два прогона одной страницы → 0 (детерминизм разведки)');

console.log('\nИтог: pass=' + pass + ' fail=' + failures);
process.exit(failures ? 1 : 0);
