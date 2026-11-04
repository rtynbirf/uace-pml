#!/usr/bin/env node
// Срез «вызовы vs определения» для очищенных частей солянки Dola.
const fs = require('fs');
const path = '/home/z/my-project/scripts/solyanka/';

const GLOBALS = new Set(['window','document','console','Math','JSON','Object','Array','Promise','setTimeout','clearTimeout','setInterval','clearInterval','parseInt','parseFloat','String','Number','Boolean','Date','Error','TypeError','RangeError','isNaN','isFinite','encodeURIComponent','decodeURIComponent','structuredClone','Intl','Blob','URL','File','Image','Map','Set','WeakSet','WeakMap','Symbol','Proxy','Reflect','localStorage','sessionStorage','indexedDB','performance','requestIdleCallback','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','matchMedia','crypto','fetch','alert','confirm','prompt','navigator','screen','history','location','CSS','Node','Element','HTMLElement','MutationObserver','IntersectionObserver','PerformanceObserver','ResizeObserver','CustomEvent','Event','FormData','FileReader','Worker','TextEncoder','TextDecoder','Infinity','NaN','undefined','globalThis','self','top','parent','frames','length','arguments','this','super','require','module','exports']);

function audit(file) {
  const src = fs.readFileSync(path + file, 'utf8');
  // Вырезаем комментарии и строковые литералы (грубая, но безопасная эвристика)
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

  const defined = new Set();
  const patterns_def = [
    /function\s+([A-Za-z_$][\w$]*)/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /\b([A-Za-z_$][\w$]*)\s*:\s*function/g,
    /\b([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g, // shorthand-методы
    /class\s+([A-Za-z_$][\w$]*)/g,
  ];
  for (const p of patterns_def) {
    let m; while ((m = p.exec(code))) defined.add(m[1]);
  }

  const called = new Set();
  const pcall = /(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = pcall.exec(code))) {
    const name = m[2];
    if (!GLOBALS.has(name) && !defined.has(name)) called.add(name);
  }
  // имена могли быть определены позже (hoisting функций учитывается, const — нет,
  // но срез по всему файлу это компенсирует, т.к. defined собирается по всему тексту)
  const missing = [...called].filter(n => !defined.has(n) && !GLOBALS.has(n));
  console.log(`\n=== ${file} ===`);
  console.log(`определений: ${defined.size}; подозрительных голых вызовов: ${missing.length}`);
  if (missing.length) console.log('НЕ ОПРЕДЕЛЕНЫ: ' + missing.sort().join(', '));
}

['ssea_final_2106ln.js', 'psp1_module_s_restored.js'].forEach(audit);
