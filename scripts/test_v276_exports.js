// Тест UACE v27.6.0: канон FNV + экспорт-пакет + ZIP-райтер (верификация Python zipfile)
const fs = require('fs');
const src = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.0-PML-PANEL-B.user.js', 'utf8');

// 1) PURE-ядро (FNV1a32, hex8, SALT, urlHashIn, ...) — между маркерами
const pBeg = src.indexOf('/*PML-PURE-BEGIN*/'), pEnd = src.indexOf('/*PML-PURE-END*/');
if (pBeg < 0 || pEnd < 0) throw new Error('PURE-блок не найден');
const pure = src.slice(pBeg, pEnd);

// 2) Цельный блок экспорт-пакета: от заголовка до function stopAll (не включая её)
const eBeg = src.indexOf('/* ===================== ЭКСПОРТ-ПАКЕТ 27.6.0');
const eEnd = src.indexOf('function stopAll()');
if (eBeg < 0 || eEnd < 0 || eEnd < eBeg) throw new Error('Блок экспорт-пакета не найден');
const expack = src.slice(eBeg, eEnd);

const code = [
  pure,
  "const VER = '27.6.0';",
  "const agentView = st => '- page urlHash=' + st.meta.urlHash;",
  "const metrics = { downloads: 0, zipMade: false, structCopied: false, agentCopied: false };",
  "let lastStruct = null;",
  "const buildStruct = () => { throw new Error('buildStruct не должен зваться: struct передан явно'); };",
  "const status = () => {}, log = () => {}, ce = () => { throw new Error('ce не должен зваться в этом тесте'); };",
  "const document = { createElement: () => { throw new Error('DOM не нужен'); }, body: null };",
  expack,
  'return { FNV1a32, hex8, SALT, urlHashIn, VER, escH, structToText, structToMarkdown, structToHTML, structToCSV, csvCell, crc32, makeZip, buildExportSet, fileStamp, metrics };'
].join('\n');

const api = new Function('Blob', 'TextEncoder', 'URL', 'location', code)(
  globalThis.Blob, globalThis.TextEncoder,
  { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} },
  { href: 'https://example.com/test' }
);

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } };

// --- 1. Канон FNV-векторы (r2 §5) — хэш-канон не тронут
console.log('[1] Канон FNV-1a 32 (r2 §5):');
ok(api.hex8(api.FNV1a32('')) === '811c9dc5', "FNV1a32('') = 811c9dc5");
ok(api.hex8(api.FNV1a32('a')) === 'e40c292c', "FNV1a32('a') = e40c292c");
ok(api.hex8(api.FNV1a32(api.SALT + '>UL>LI>P')) === api.hex8(api.FNV1a32('PMLSTRUCT>UL>LI>P')), 'sigHashIn детерминирован');
ok(api.SALT === 'PMLSTRUCT', 'соль PMLSTRUCT');
ok(api.hex8(api.FNV1a32(api.urlHashIn('https://x.y/'))) === api.hex8(api.FNV1a32('PMLSTRUCTURL>https://x.y/')), 'urlHashIn формат SALT+URL>+href');

// --- 2. CRC32 по эталонам
console.log('[2] CRC32:');
const enc = new TextEncoder();
ok(api.crc32(enc.encode('123456789')) === 0xcbf43926, "crc32('123456789') = 0xcbf43926");
ok(api.crc32(new Uint8Array(0)) === 0x00000000, 'crc32(пусто) = 0');

// --- 3. Все форматы из fabricated struct
console.log('[3] Экспорт-пакет (форматы из struct):');
const st = {
  structVersion: 'r1',
  meta: { ts: 12345, viewport: { w: 1280, h: 800 }, dpr: 1, urlHash: 'abcd1234' },
  dom: { maxDepth: 9, blockCount: 420, truncated: false,
    landmarks: [{ tag: 'main', role: null, path: 'body>main' }, { tag: 'nav', role: 'navigation', path: 'body>div>nav' }],
    groups: [{ sigHash: 'f0338710', count: 12, depth: 4, uniformity: 0.86, samplePath: 'body>main>ul>li', inPrimary: true }] },
  scroll: { primary: { path: 'body>main', scrollHeight: 4000, clientHeight: 800, ratio: 0.2 }, containers: [{ path: 'body>main', scrollHeight: 4000, clientHeight: 800 }], truncated: false },
  mut: { window: 60, adds: 40, removes: 12, recycles: 5, medianIntervalMs: 420, streamCandidate: true },
  anchors: { mountPoints: [{ path: 'body>header', mode: 'fixed', h: 64 }], persistentPaths: ['body>header'], stability: 0.5, truncated: false },
  recon: { status: 'found', candidate: { path: 'body>main>ul>li', sigHash: 'f0338710', inPrimary: true, confidence: 78, basis: {} } }
};
const txt = api.structToText(st), md = api.structToMarkdown(st), html = api.structToHTML(st), csv = api.structToCSV(st);
ok(txt.includes('UACE 27.6.0') && txt.includes('f0338710') && txt.includes('confidence 78') && txt.includes('no-scroll') === false, 'TXT: версия + группы + резерв found');
ok(txt.includes('no-data') === false && txt.includes('кандидат body>main>ul>li'), 'TXT: резерв отрисован как found');
ok(md.startsWith('# UACE 27.6.0') && md.includes('| `f0338710` | 12 | 4 | 0.86 | да |') && md.includes('## Скролл (I-2)') && md.includes('confidence **78**'), 'MD: заголовок + таблица групп + резерв');
ok(html.startsWith('<!doctype html>') && html.includes('<table>') && html.includes('f0338710') && html.trim().endsWith('</html>'), 'HTML: док + таблицы + закрыт');
const evil = api.structToHTML({ ...st, dom: { ...st.dom, groups: [{ ...st.dom.groups[0], samplePath: '<script>alert(1)</script>' }] } });
ok(!evil.includes('<script>alert') && evil.includes('&lt;script&gt;'), 'HTML: XSS-путь экранируется');
ok(csv.charCodeAt(0) === 0xfeff && csv.includes('sigHash,count,depth,uniformity,inPrimary,samplePath') && csv.includes('f0338710,12,4,0.86,1,body>main>ul>li'), 'CSV: BOM + заголовок + строка групп');
const q = api.csvCell('a"b,c\nd');
ok(q === '"a""b,c\nd"', 'CSV: кавычки/запятые/перевод строки экранируются');
// Легаси-формы (E1-семейство): scroll-строка и отсутствие секций не роняют форматтеры
const legacy = { meta: st.meta, dom: st.dom, scroll: 'no-scroll-container', mut: null, anchors: null, recon: null };
ok(api.structToText(legacy).includes('no-scroll-container') && api.structToMarkdown(legacy).includes('no-scroll-container'), 'TXT/MD: легаси scroll-строка tolerated');
ok(api.structToHTML(legacy).includes('no-scroll-container'), 'HTML: легаси scroll-строка tolerated');

// --- 4. ZIP: собираем бандл как в downloadZip, верифицируем Python'ом
console.log('[4] ZIP-бандл (верификация Python zipfile):');
const stamp = api.fileStamp('json');
ok(/^uace-27\.6\.0-struct-[0-9a-f]{8}-\d{6}\.json$/.test(stamp), 'fileStamp: формат имени (' + stamp + ')');
const set = [
  { name: api.fileStamp('json'), text: JSON.stringify(st) },
  { name: api.fileStamp('md'), text: md },
  { name: api.fileStamp('html'), text: html },
  { name: api.fileStamp('txt'), text: txt },
  { name: api.fileStamp('csv'), text: csv },
  { name: api.fileStamp('agentview.txt'), text: 'agent-view stub' }
];
(async () => {
const blob = api.makeZip(set.map(e => ({ name: e.name, text: e.text })));
const buf = Buffer.from(await blob.arrayBuffer());
fs.writeFileSync('/home/z/my-project/scripts/_v276_test.zip', buf);
ok(buf.slice(0, 4).toString('hex') === '504b0304', 'ZIP: сигнатура PK\\x03\\x04');
ok(buf.length > 1000, 'ZIP: размер ' + buf.length + ' байт');

console.log('\nИТОГ: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
