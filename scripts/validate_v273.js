// Валидация UACE v27.3.0: покрытие вызовов определениями + дубликаты + структурные чеки
const fs = require('fs');
const src = fs.readFileSync('/home/z/my-project/download/UACE-v27.3.0-STYLES-ACCENT.user.js', 'utf8');
let bad = 0;

// 1) Дубликаты объявлений функций верхнего уровня (function name( / async function name()
const declRe = /^\s*(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm;
const seen = new Map(); let m;
while ((m = declRe.exec(src))) {
  const name = m[1];
  seen.set(name, (seen.get(name) || 0) + 1);
}
const dups = [...seen.entries()].filter(([, c]) => c > 1);
if (dups.length) { console.log('ДУБЛИКАТЫ ФУНКЦИЙ:', dups); bad++; }
else console.log('1) Дубликаты функций: нет (' + seen.size + ' уникальных объявлений)');

// 2) Свободные вызовы: вызов имени, которого нет среди объявлений и известных глобалов/locals
const defs = new Set(seen.keys());
// локальные const/let стрелки и переменные
const varRe = /^\s*(?:const|let)\s+([A-Za-z0-9_$]+)/gm;
while ((m = varRe.exec(src))) defs.add(m[1]);
// параметры функций (упрощённо: имена в скобках)
const fnParams = [];
const fnRe = /function\s+[A-Za-z0-9_]*\s*\(([^)]*)\)/g;
while ((m = fnRe.exec(src))) m[1].split(',').forEach((p) => { const t = p.trim().split('=')[0].trim(); if (t) fnParams.push(t); });
const callRe = /(?<![.\w$])([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
const known = new Set(['if','for','while','switch','catch','function','return','typeof','new','await','async','const','let','var','delete','void','in','of','do','else','try','finally','throw','case','break','continue','instanceof','yield','static','get','set','super','this','class','extends','import','export','from','default','window','document','console','Math','JSON','Object','Array','String','Number','Boolean','Date','Promise','Map','Set','Uint8Array','ArrayBuffer','DataView','Blob','URL','Response','CompressionStream','TextEncoder','TextDecoder','FileReader','CustomEvent','Error','TypeError','RangeError','AbortController','MutationObserver','IntersectionObserver','ResizeObserver','matchMedia','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','setTimeout','setInterval','clearTimeout','clearInterval','parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','encodeURI','decodeURI','alert','confirm','prompt','fetch','localStorage','sessionStorage','indexedDB','navigator','location','history','screen','performance','crypto','btoa','atob','structuredClone','queueMicrotask','requestIdleCallback','Node','Element','HTMLElement','NodeFilter','DOMParser','XMLSerializer','Blob','File','RegExp','Symbol','Proxy','Reflect','WeakMap','WeakSet','BigInt','Function','eval','Function','Intl','CSS','customElements','event','ChromeUtils','dump','browsingContext','GM_info','GM_setValue','GM_getValue','unsafeWindow','chrome','browser']);
const paramSet = new Set(fnParams);
const missing = new Map();
while ((m = callRe.exec(src))) {
  const name = m[1];
  if (defs.has(name) || known.has(name) || paramSet.has(name)) continue;
  // член выражения после точки уже отсечён lookbehind; свойство объекта с точки не попадает
  missing.set(name, (missing.get(name) || 0) + 1);
}
if (missing.size) {
  console.log('2) СВОБОДНЫЕ ВЫЗОВЫ БЕЗ ОПРЕДЕЛЕНИЯ (' + missing.size + '):');
  [...missing.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('   ' + k + ' ×' + v));
} else console.log('2) Свободные вызовы: 100% покрыты');

// 3) Структурные чеки
const checks = [
  ['SCRIPT_VER 27.3.0', /const SCRIPT_VER = '27\.3\.0'/],
  ['UI_ID uaice-273', /const UI_ID = 'uaice-273'/],
  ['TPL_STYLES: 5 стилей', /const TPL_STYLES = \{[\s\S]*?imperial[\s\S]*?makt[\s\S]*?swiss[\s\S]*?brutal[\s\S]*?sepia[\s\S]*?\};/],
  ['tplStyleId/uaice_tpl', /function tplStyleId\(\)/],
  ['buildStyledHTML', /function buildStyledHTML\(/],
  ['openPrintWindow', /function openPrintWindow\(/],
  ['toHTML -> buildStyledHTML (один toHTML)', /function toHTML\(scraped, title\) \{\n    return buildStyledHTML\(scraped, title, \{\}\);\n  \}/],
  ['deflateRaw', /async function deflateRaw\(/],
  ['zipNoCompress', /function zipNoCompress\(/],
  ['async zipStore', /async function zipStore\(/],
  ['navByURL', /function navByURL\(/],
  ['uaice_nav set в navByURL', /safeStorageSet\('uaice_nav', '1'\)/],
  ['boot: чтение uaice_nav', /safeStorageGet\('uaice_nav'\) === '1'/],
  ['autoResume-мост в boot', /window\.__UAICE_UI__ && window\.__UAICE_UI__\.autoResume/],
  ['childJob-антишторм', /let childJob = null;/],
  ['origin-чек слушателя', /event\.origin !== location\.origin/],
  ['exportAsPDF -> buildStyledHTML', /const html = buildStyledHTML\(scraped, title, \{\}\);/],
  ['CDN-опция сохранена', /safeStorageGet\('uaice_pdfcdn'\) === '1'/],
  ['buildMerged html -> styled', /if \(innerFmt === 'html'\) \{\n      return buildStyledHTML/],
  ['ZIP pdf -> .print.html', /buildStyledHTML\(r\.scraped, r\.title, \{ inZip: true \}\)/],
  ['Dola: v_list-селектор', /\[class\*="v_list"\]/],
  ['Dola: message-list селектор', /\[class\*="message-list"\] > \*/],
  ['Системный акцент (v27.1)', /function hfSystemAccent\(/],
  ['Подгонка акцента (v27.1)', /function hfTuneAccent\(/],
  ['Сегментный тумблер (v27.1)', /function setSegTheme\(/],
  ['makeTplSelect в панели', /function makeTplSelect\(\)/],
  ['селект стиля ×2 (main+more)', /selTplMore = makeTplSelect\(\);/],
  ['мост __UAICE_UI__ в UI', /window\.__UAICE_UI__ = \{ setStatus: setStatus, autoResume:/],
  ['паспорт: строка стиля', /row\('Стиль экспорта PDF\/HTML'/],
  ['старый htmlCss ещё жив (CDN-путь)', /function htmlCss\(\)/],
  ['renderPdfBlob сохранён (CDN-опция)', /function renderPdfBlob\(/],
];
console.log('3) Структурные чеки:');
for (const [name, re] of checks) {
  const ok = re.test(src);
  console.log('   ' + (ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (!ok) bad++;
}
// 4) toHTML ровно один; zipStore ровно один
console.log('4) toHTML объявлений: ' + (src.match(/function toHTML\(/g) || []).length + ' | zipStore: ' + (src.match(/function zipStore\(/g) || []).length + ' | exportAsPDF: ' + (src.match(/function exportAsPDF\(/g) || []).length);
process.exit(bad ? 1 : 0);
