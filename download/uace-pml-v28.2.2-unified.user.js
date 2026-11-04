// ==UserScript==
// @name         UACE × PML — Universal AI Chat Exporter + Recon (Unified)
// @namespace    local.universal.ai.exporter.pml
// @version      28.2.2-unified
// @description  Единая сборка лучших частей v28.0.0 + v28.1.0: 36+ платформ, 9 форматов, IndexedDB, resume/onlyNew. UI изолирован в Shadow DOM (CSS не конфликтует с сайтом). Итеративный обход DOM со стеком и квантом 15 мс (без stack overflow и фризов). 4-уровневый CORS-фейлвер для картинок: fetch → GM_xmlhttpRequest → canvas из DOM → canvas свежей загрузкой. ZIP с DEFLATE (CompressionStream, фейлвер STORED). Параллельная загрузка изображений (пул, ≤4). PDF 0-CDN: iframe реального размера + @media print, фейлвер окно → .print.html. Безопасная обёртка history (NavGuard). Настройки в localStorage с JSON-зеркалом. Итеративная pml-разведка (r1+r2), журнал, паспорт, комфорт-темы. Хоткеи UACE = Alt+…, PML = Alt+Shift+…. v28.2.2: Trusted Types-совместимость (gemini.google.com: default-policy + setHTML + boot без innerHTML), PDF без document.write с фейлвер-цепочкой и тостами, самовосстановление монтажа (documentElement + watchdog 2 с).
// @author       local · PML Line (unified)
// @license      MIT
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
'use strict';

/* ==========================================================================
 *  ИСТОРИЯ ВЕРСИЙ (unified-линейка)
 *  --------------------------------------------------------------------------
 *  v28.0.0 — первая единая сборка UACE × PML.
 *  v28.1.0 — итеративный обход DOM, DEFLATE-ZIP, пул изображений, NavGuard.
 *  v28.2.0 — Shadow DOM-изоляция UI, JSON-зеркало настроек, хоткеи Alt+… / Alt+Shift+….
 *  v28.2.1 — FIX «ТЕПЛО НЕ РАБОТАЕТ» (4 причины, все устранены):
 *    1) Контейнер комфорта имел класс .settings, а ВСЕ CSS-правила строк комфорта
 *       (.crow/.cl/.cbtns, включая подсветку aria-pressed="true" — рамка акцентом
 *       + инсет-кольцо + акцентный текст) были написаны под несуществующего
 *       предка .comfort. Итог: выбранная тема НЕ подсвечивалась никогда, кнопки
 *       Авто/Свет/Тьма/Тепло выглядели одинаково в любом состоянии, строки
 *       «Кегль/Движение/Тёплый вечер» теряли компактную раскладку (flex → block,
 *       44px вместо 36px). Ночью (20:00–06:59) «Авто» и так тёплый, поэтому клик
 *       «Тепло» не давал НИ ОДНОГО видимого отклика — тема казалась мёртвой.
 *       ФИКС: контейнеру добавлен класс 'settings comfort'.
 *    2) PML-подсистема (pmlResolvePalette) игнорировала тему UACE: pmlState.theme
 *       навсегда 'system' (переключателя PML-темы в unified-сборке нет), палитра
 *       резолвилась мимо выбора пользователя. ФИКС: pmlResolvePalette() читает
 *       uaice_theme; явный light/dark/warm уважается, «Авто» = вечер 20:00–06:59
 *       (вкл по умолчанию) → warm, иначе системная схема.
 *    3) Клик темы не давал текстового фидбека. ФИКС: setStatus('Тема: …') после
 *       клика; фидбек также у «Движение» и «Тёплый вечер».
 *    4) applyHfTheme() теперь синхронно пересчитывает pmlCurPalette и акцент —
 *       паспорт PML показывает эффективную тему сразу после переключения.
 *    Плюс: удалён дубликат 'uaice_collapsed' в SETTINGS_KEYS.
 *  v28.2.2 — FIX «НЕ ПОЯВЛЯЕТСЯ НА gemini + PDF НЕ СОХРАНЯЕТСЯ + ПРОПАЛИ СТИЛИ».
 *    Причина (подтверждена заголовками gemini.google.com): enforce-CSP
 *    require-trusted-types-for 'script' — ЛЮБОЙ innerHTML/document.write со
 *    строкой бросает TypeError. buildUI() умирал на первом innerHTML
 *    (pmlReconOut, стр. 2943) ДО appendChild — панель не появлялась только на
 *    TT-сайтах (на прочих всё работало). PDF-канал умирал на doc.write молча
 *    (статус шёл лишь в console). Печать из iframe 0×0 давала пустые/безстильные
 *    страницы («пропали стили»). Исправлено:
 *    1) TT-адаптер: trustedTypes.createPolicy('default', identity) если
 *       default-policy нет (createScript намеренно не выдаётся); setHTML() с
 *       фейлвером template → текст; boot-путь вообще без HTML-парсинга.
 *    2) PDF: iframe РЕАЛЬНОГО размера 1024×768 вне экрана (0×0 печатал пустоту —
 *       «пропали стили»), наполнение DOM-API (style.textContent + setHTML),
 *       ожидание fonts.ready, фейлвер-цепочка: iframe-печать → отдельное окно
 *       печати → ГАРАНТ-файл .print.html (открыть → Ctrl+P → «Сохранить как
 *       PDF»); статус-фидбек тостом на каждом шаге.
 *    3) Самовосстановление монтажа: хост в documentElement (переживает замену
 *       body SPA-гидрацией), watchdog 2 с переподключает сорванный хост и
 *       восстанавливает стили, buildUI ретраится до 8 раз при исключении.
 * ========================================================================== */

const SCRIPT_VER = '28.2.2-unified';
const UACE_VER   = '27.0.0';
const UPOLY_VER  = '1.0.6';
const UI_ID      = 'uaice-28';
const IS_FRAME   = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();

/* v28.2.2: адаптер Trusted Types — gemini.google.com и иные сайты enforce
 * require-trusted-types-for 'script': innerHTML/document.write/srcdoc со
 * строкой бросают TypeError. Если default-policy ещё нет — создаём
 * identity-политику (createHTML/createScriptURL); createScript намеренно НЕ
 * выдаём. Если default-policy уже создана страницей — строки проходят через неё. */
const TT_ACTIVE = (function () {
  try {
    if (typeof trustedTypes === 'undefined' || !trustedTypes || typeof trustedTypes.createPolicy !== 'function') return false;
    if (!trustedTypes.defaultPolicy) {
      try {
        trustedTypes.createPolicy('default', {
          createHTML: s => String(s),
          createScriptURL: s => String(s),
          createScript: () => { throw new TypeError('UACE TT: createScript не выдаётся'); }
        });
      } catch (e) { /* default-policy уже существует — достаточно её */ }
    }
    return true;
  } catch (e) { return false; }
})();
/* v28.2.2: TT/DOM-безопасная установка HTML: innerHTML → template → текст */
function setHTML(el, html) {
  if (!el) return false;
  try { el.innerHTML = html; return true; } catch (e) {}
  try {
    const t = document.createElement('template');
    t.innerHTML = html;
    el.replaceChildren(t.content);
    return true;
  } catch (e2) {}
  try { el.textContent = String(html).replace(/<[^>]*>/g, ' '); } catch (e3) {}
  return false;
}

/* ==========================================================================
 *  A. ОБЩИЕ УТИЛИТЫ И PML-ЯДРО (перенесено из UPOLY v1.0.6)
 * ========================================================================== */

const SALT = 'PMLSTRUCT';
const SESSION_T0 = Date.now();
const nowMs = () => Date.now() - SESSION_T0;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round2 = v => Math.round(v * 100) / 100;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const fnvByte = (h, b) => Math.imul(((h ^ b) >>> 0), 0x01000193) >>> 0;
function fnv1a(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    let c = str.codePointAt(i);
    if (c > 0xffff) i++;
    if (c < 0x80) h = fnvByte(h, c);
    else if (c < 0x800) { h = fnvByte(h, 0xc0 | c >> 6); h = fnvByte(h, 0x80 | c & 63); }
    else if (c < 0x10000) { h = fnvByte(h, 0xe0 | c >> 12); h = fnvByte(h, 0x80 | (c >> 6) & 63); h = fnvByte(h, 0x80 | c & 63); }
    else { h = fnvByte(h, 0xf0 | c >> 18); h = fnvByte(h, 0x80 | (c >> 12) & 63); h = fnvByte(h, 0x80 | (c >> 6) & 63); h = fnvByte(h, 0x80 | c & 63); }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const median = arr => {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};
function parentOf(n) {
  const p = n.parentElement;
  if (p) return { el: p, cross: false };
  try { const r = n.getRootNode ? n.getRootNode() : null; if (r && r.host) return { el: r.host, cross: true }; } catch (e) {}
  return { el: null, cross: false };
}
function pathOf(el) {
  const segs = [];
  let n = el;
  while (n && n.nodeType === 1 && n.tagName !== 'BODY' && n.tagName !== 'HTML') {
    let i = 1, s = n;
    while ((s = s.previousElementSibling)) if (s.tagName === n.tagName) i++;
    const up = parentOf(n);
    segs.unshift((up.cross ? '~' : '') + n.tagName.toLowerCase() + (i > 1 ? ':nth(' + i + ')' : ''));
    n = up.el;
  }
  let p = 'body' + (segs.length ? '>' + segs.join('>') : '');
  if (p.length > 120) p = '~' + p.slice(-119);
  return p;
}
function pathSegs(el) {
  const segs = []; let n = el;
  while (n && n.nodeType === 1 && n.tagName !== 'BODY' && n.tagName !== 'HTML') {
    let i = 1, s = n;
    while ((s = s.previousElementSibling)) if (s.tagName === n.tagName) i++;
    const up = parentOf(n);
    segs.unshift((up.cross ? '~' : '') + n.tagName.toLowerCase() + (i > 1 ? ':nth(' + i + ')' : ''));
    n = up.el;
  }
  return ['body'].concat(segs);
}
const prefixPath = (el, d) => pathSegs(el).slice(0, d).join('>');
function sigOf(el) {
  const out = [];
  (function walk(n, d) {
    if (!n || n.nodeType !== 1 || d > 3) return;
    out.push(n.tagName.toUpperCase());
    for (let c = n.firstElementChild; c; c = c.nextElementSibling) walk(c, d + 1);
  })(el, 1);
  return out.join('>');
}
const sigHash = el => fnv1a(SALT + '>' + sigOf(el));
const subtreeDepth = (el, cap) => {
  let max = 1;
  (function walk(n, cur) {
    if (cur > cap) return;
    for (let c = n.firstElementChild; c; c = c.nextElementSibling) { max = Math.max(max, cur + 1); walk(c, cur + 1); }
  })(el, 1);
  return max;
};
const isEditable = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
function closestUp(el, sel) {
  let n = el;
  while (n && n.nodeType === 1) {
    let hit = null;
    try { hit = n.closest(sel); } catch (e) { return null; }
    if (hit) return hit;
    const up = parentOf(n);
    if (!up.cross) return null;
    n = up.el;
  }
  return null;
}

/* OKLCH-контраст для акцента (UPOLY §5–6) */
const srgbLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const pmlLuminance = rgb => 0.2126 * srgbLin(rgb[0]) + 0.7152 * srgbLin(rgb[1]) + 0.0722 * srgbLin(rgb[2]);
const pmlContrast = (a, b) => { const l1 = pmlLuminance(a), l2 = pmlLuminance(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
function rgbToOklch(rgb) {
  const [r, g, b] = rgb.map(srgbLin);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const L = 0.2104542553 * Math.cbrt(l) + 0.7936177850 * Math.cbrt(m) - 0.0040720468 * Math.cbrt(s);
  const A = 1.9779984951 * Math.cbrt(l) - 2.4285922050 * Math.cbrt(m) + 0.4505937099 * Math.cbrt(s);
  const B = 0.0259040371 * Math.cbrt(l) + 0.7827717662 * Math.cbrt(m) - 0.8086757660 * Math.cbrt(s);
  const C = Math.sqrt(A * A + B * B);
  return { L, C, H: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}
function oklchToRgb(L, C, H) {
  const h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const f = x => clamp(x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055, 0, 1);
  return [f(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          f(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          f(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
}
const rgbToHex = rgb => '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
function parseColor(str) {
  const m = /rgba?\(([^)]+)\)/.exec(str);
  if (m) { const p = m[1].split(',').map(parseFloat); return p.length >= 3 ? [p[0] / 255, p[1] / 255, p[2] / 255] : null; }
  const h = /^#[0-9a-f]{6}$/i.exec(str.trim());
  return h ? hexToRgb(h[0]) : null;
}
function fitAccent(bgRgb, sysRgb) {
  const sys = rgbToOklch(sysRgb);
  if (sys.C < 0.04 || sys.L < 0.05 || sys.L > 0.98) return null;
  let best = null;
  for (let L = 0.15; L <= 0.90; L += 0.01) {
    const rgb = oklchToRgb(L, Math.min(sys.C, 0.16), sys.H);
    const r1 = pmlContrast(bgRgb, rgb);
    if (r1 < 4.5) continue;
    const txWhite = pmlContrast(rgb, [1, 1, 1]), txBlack = pmlContrast(rgb, [0.055, 0.06, 0.075]);
    const tx = txWhite >= txBlack ? ['#ffffff', txWhite] : ['#0e0f12', txBlack];
    if (tx[1] < 4.5) continue;
    const score = Math.min(r1, tx[1]);
    if (!best || score > best.score) best = { hex: rgbToHex(rgb), txHex: tx[0], ratio: round2(r1), score };
  }
  return best;
}

/* PML-палитры (из UPOLY) */
const PML_PALETTES = {
  dark:  { bg:'#16181d', fg:'#e8eaf0', dim:'#a8aeb9', line:'#2c313b', ok:'#4fbf67', warn:'#d9a53f', crit:'#ef6a5f' },
  light: { bg:'#f2f3f6', fg:'#191b1f', dim:'#565c66', line:'#d7dade', ok:'#1f7a36', warn:'#8a6410', crit:'#b3392e' },
  warm:  { bg:'#231e15', fg:'#f0e9d9', dim:'#b9ac90', line:'#3b3324', ok:'#7fbf6a', warn:'#d9b25f', crit:'#e57a5f' }
};

/* PML-хранилище (одноимённый ключ из UPOLY, отдельно от uaice_*) */
const PML_STORE_KEY = 'pml_panel_v1';
const PML_WLIST = ['theme', 'fs', 'motion', 'collapsed', 'hotkeys', 'pml_upoly_'];
const pmlStorage = {
  load() {
    try {
      const raw = localStorage.getItem(PML_STORE_KEY);
      if (!raw || raw.length > 4096) { if (raw && raw.length > 4096) console.warn('[PML] pmlStorage: превышен лимит 4096 байт, load пропущен'); return {}; }
      const o = JSON.parse(raw); const ok = {};
      for (const k of Object.keys(o)) if (PML_WLIST.some(w => k === w || k.startsWith(w))) ok[k] = o[k];
      return ok;
    } catch (e) { return {}; }
  },
  save(obj) { try { const raw = JSON.stringify(obj); if (raw.length <= 4096) localStorage.setItem(PML_STORE_KEY, raw); else console.warn('[PML] pmlStorage: превышен лимит 4096 байт, save пропущен'); } catch (e) {} }
};

/* ==========================================================================
 *  B. UACE-ДВИЖОК (v27; сохранён полностью; ниже — ключевые блоки)
 * ========================================================================== */

/* ---- B.1. PDF-рендер — единственная CDN, включается опционально ---- */
const LIBS = { html2pdf: [
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.12.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
] };
function loadScript(urls, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    let i = 0;
    const tryNext = () => {
      if (i >= urls.length) return reject(new Error('Не удалось загрузить библиотеку (CSP?)'));
      const s = document.createElement('script');
      s.src = urls[i++];
      s.onload = () => resolve(globalName ? window[globalName] : true);
      s.onerror = () => { s.remove(); tryNext(); };
      (document.head || document.documentElement).appendChild(s);
    };
    tryNext();
  });
}

const MSG_REQ = 'UAICE_EXPORT_REQUEST';
const MSG_RES = 'UAICE_EXPORT_RESULT';

const CFG = {
  MIN_TEXT: 8, MIN_TOTAL_TEXT: 80, CLICK_WAIT: 800, STABLE_MS: 1200,
  MAX_WAIT: 25000, POLL: 300, SCROLL_ROUNDS: 50, SCROLL_WAIT: 550, TAB_CHILD_TIMEOUT: 65000,
  DEDUPE_CAP: 400, MSG_MIN: 1, MSG_MAX: 800, IMG_PER_MSG: 40, IMG_TOTAL: 60, IMG_TIMEOUT: 10000,
  SNAPSHOT_MAX: 200000, ADAPTIVE: true, BASE_CLICK: 800, BASE_SCROLL: 550, BASE_POLL: 300,
  MAX_CLICK: 1800, MAX_SCROLL: 900, IMG_RETRIES: 3, MAX_ZIP_MB: 50, ARTIFACTS_MAX: 100
};
const FORMATS = ['md','json','txt','html','pdf','zip','sharegpt','jsonl','alpaca'];

let CANCEL = false, busy = false, tabsExportRunning = false;
const ts = () => now().replace(/[: ]/g, '-');
const safeStorageGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const safeStorageRemove = k => { try { localStorage.removeItem(k); } catch (e) {} };

/* ---- B.1b. JSON-зеркало настроек (v28.2: устойчивость к очистке отдельных ключей) ---- */
const SETTINGS_KEY = 'uace_pml_settings_v1';
const SETTINGS_KEYS = ['uaice_filter','uaice_onlynew','uaice_images','uaice_fm','uaice_zipinner','uaice_format','uaice_think','uaice_strip','uaice_collapsed','uaice_pos_v1','uaice_adaptive','uaice_mermaid','uaice_pdfcdn','uaice_theme','uaice_evening','uaice_fsz','uaice_motion'];
let _mirrorTimer = null;
function saveSettingsMirror() {
  /* v28.2: запись синхронная — изменения настроек редки (клики), JSON мал,
     а отложенная запись через setTimeout не срабатывает в средах без таймеров */
  try {
    const snapshot = {};
    for (const k of SETTINGS_KEYS) { const v = safeStorageGet(k); if (v !== null) snapshot[k] = v; }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(snapshot));
  } catch (e) {}
}
function loadSettingsMirror() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (SETTINGS_KEYS.indexOf(k) === -1) continue;
      if (safeStorageGet(k) === null && o[k] !== null && typeof o[k] !== 'object') safeStorageSet(k, String(o[k]));
    }
  } catch (e) {}
}
const safeStorageSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} if (k && k.indexOf('uaice_') === 0) saveSettingsMirror(); };

/* ---- B.1c. NavGuard: безопасная обёртка History API (v28.2: без повторного патчинга и утечек) ---- */
const NavGuard = {
  wrapped: false,
  origPush: null,
  origReplace: null,
  subs: new Set(),
  ensure() {
    if (this.wrapped) return true;
    try {
      const hp = history.pushState, hr = history.replaceState;
      if (typeof hp !== 'function' || typeof hr !== 'function') return false;
      const guard = this;
      history.pushState = function () { guard._notify(); return hp.apply(this, arguments); };
      history.replaceState = function () { guard._notify(); return hr.apply(this, arguments); };
      guard.origPush = hp; guard.origReplace = hr; guard.wrapped = true;
      return true;
    } catch (e) { return false; }
  },
  _notify() { for (const fn of Array.from(this.subs)) { try { fn(); } catch (e) {} } },
  subscribe(fn) {
    if (typeof fn !== 'function' || this.subs.has(fn)) return false;
    this.ensure();
    this.subs.add(fn);
    return true;
  },
  unsubscribe(fn) { return this.subs.delete(fn); }
};

function isPageBusy() { try { return document.querySelectorAll('[class*="loading"],[class*="spinner"],[class*="busy"],[aria-busy="true"],[data-loading="true"]').length > 0; } catch (e) { return false; } }
function adaptiveMs(base, maxCap) {
  const enabled = (safeStorageGet('uaice_adaptive') !== '0') && CFG.ADAPTIVE;
  if (!enabled) return base;
  const v = Math.round(base * (isPageBusy() ? 2.1 : 1));
  return maxCap ? Math.min(v, maxCap) : v;
}
const clickWait = () => adaptiveMs(CFG.BASE_CLICK || CFG.CLICK_WAIT, CFG.MAX_CLICK);
const scrollWait = () => adaptiveMs(CFG.BASE_SCROLL || CFG.SCROLL_WAIT, CFG.MAX_SCROLL);
const pollWait = () => adaptiveMs(CFG.BASE_POLL || CFG.POLL, 800);

/* ---- B.2. IndexedDB манифест ---- */
const HAS_IDB = (function () { try { return typeof indexedDB !== 'undefined' && !!indexedDB.open; } catch (e) { return false; } })();
const IDB_NAME = 'UAICE_POLYMATH_DB'; const IDB_STORE_MAN = 'manifest';
let _idbPromise = null;
function idbOpen() {
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains(IDB_STORE_MAN)) db.createObjectStore(IDB_STORE_MAN, { keyPath: 'id' }); };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => reject(req.error || new Error('IDB open failed'));
    } catch (e) { reject(e); }
  });
  return _idbPromise;
}
function idbRun(store, mode, fn) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store, mode);
      const out = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : null);
      tx.onerror = () => reject(tx.error || new Error('IDB tx failed'));
    } catch (e) { reject(e); }
  }));
}
const idbGetAll = () => HAS_IDB ? idbRun(IDB_STORE_MAN, 'readonly', s => s.getAll()).catch(() => []) : Promise.resolve([]);
const idbPutMany = arr => HAS_IDB ? idbRun(IDB_STORE_MAN, 'readwrite', s => { for (let i = 0; i < arr.length; i++) s.put(arr[i]); }).catch(() => {}) : Promise.resolve();
const idbClearMan = () => HAS_IDB ? idbRun(IDB_STORE_MAN, 'readwrite', s => s.clear()).catch(() => {}) : Promise.resolve();

/* ---- B.3. Общие утилиты ---- */
function now() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
function hashString(s) {
  let h = 0xcbf29ce484222325n; const prime = 0x100000001b3n; const mask = 0xffffffffffffffffn;
  const text = String(s || '');
  for (let i = 0; i < text.length; i++) { h ^= BigInt(text.charCodeAt(i)); h = (h * prime) & mask; }
  return h.toString(16).padStart(16, '0');
}
function sanitize(s, m) {
  m = m || 80;
  const raw = String(s || 'export');
  const norm = raw.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  let out = norm.slice(0, m);
  if (norm.length > m) out += '-' + hashString(raw).slice(0, 6);
  return out || 'export';
}
function pageTitle() {
  let t = (document.title || '').trim();
  t = t.replace(/\s*[-–|·]\s*[^-–|·]{0,40}$/i, '').trim();
  return t.length > 1 ? t.slice(0, 120) : 'export';
}
function dedupeText(s) {
  s = String(s || '');
  if (s.length < 6 || s.length > 400) return s;
  for (let n = 2; n <= 4; n++) {
    if (s.length % n !== 0) continue;
    const chunk = s.slice(0, s.length / n); if (!chunk) continue;
    let rep = true;
    for (let i = 1; i < n; i++) if (s.slice(i * chunk.length, (i + 1) * chunk.length) !== chunk) { rep = false; break; }
    if (rep) return chunk;
  }
  return s;
}
function stripUiPrefix(text) {
  if (!text) return text;
  const lines = String(text).split('\n'); let i = 0;
  while (i < lines.length) {
    const st = lines[i].replace(/^#+\s*/, '').trim();
    if (/^(Ответ\s+\S+|Ваш\s+запрос|Gemini|You\s+said|ChatGPT\s+said|Assistant\s+said|User\s+said|DeepSeek|Claude|Grok|Kimi|Qwen|Mistral|Copilot|GPT)$/i.test(st)) {
      i++; while (i < lines.length && !lines[i].trim()) i++;
    } else break;
  }
  return lines.slice(i).join('\n').trim();
}
function progress(i, n, label) {
  const f = Math.max(0, Math.min(10, Math.round(10 * i / Math.max(1, n))));
  return '[' + '█'.repeat(f) + '·'.repeat(10 - f) + '] ' + (i + 1) + '/' + n + ' ' + (label || '');
}

/* ---- B.4. Платформы (30+) ---- */
const PLATFORMS = [
  { name: 'ChatGPT', hosts: [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/], msgSelectors: ['[data-message-author-role]', 'article[data-testid^="conversation-turn"]'], roleAttr: 'data-message-author-role', chatUrlPattern: '/c/{id}', sidebarSelectors: ['#stage-slideover-sidebar', 'nav[aria-label*="Chat" i]', 'nav', 'aside'] },
  { name: 'Claude', hosts: [/(^|\.)claude\.ai$/], msgSelectors: ['[data-testid="user-message"]', '[data-testid="assistant-message"]', '.font-claude-message', '.font-user-message'], role: el => el.matches('[data-testid="user-message"], .font-user-message') ? 'user' : 'assistant', chatUrlPattern: '/chat/{id}' },
  { name: 'Gemini', hosts: [/(^|\.)(gemini\.google\.com|bard\.google\.com)$/], msgSelectors: ['user-query', 'model-response', 'conversation-turn', 'ms-chat-turn'], role: el => { const t = el.tagName.toLowerCase(); if (t === 'user-query') return 'user'; if (t === 'model-response') return 'assistant'; return /user|query|human/i.test(el.className || '') ? 'user' : 'assistant'; }, chatUrlPattern: '/app/{id}', sidebarSelectors: ['side-navigation-v2', 'bard-sidenav', 'mat-sidenav'] },
  { name: 'Google AI Studio', hosts: [/(^|\.)aistudio\.google\.com$/], msgSelectors: ['[data-test-id="user-message"]', '[data-test-id="model-message"]', 'ms-chat-turn'], role: el => (el.getAttribute('data-role') || '') === 'user' ? 'user' : 'assistant' },
  { name: 'DeepSeek', hosts: [/(^|\.)deepseek\.com$/], msgSelectors: ['[class*="message"]', '[class*="_message"]'], role: el => /user|human|query/i.test(el.className || '') ? 'user' : 'assistant', chatUrlPattern: '/a/chat/s/{id}', sidebarSelectors: ['aside','nav','[class*="sidebar"]','[class*="sider"]','[class*="history"]'] },
  { name: 'Qwen', hosts: [/(^|\.)(qwen\.ai|tongyi\.aliyun\.com)$/], msgSelectors: ['[class*="_message"]', '[data-message-role]', '[class*="chat-message"]', '[class*="markdown"]'], role: el => { const c = (el.className || '') + ' ' + (el.getAttribute('data-message-role') || '') + ' ' + (el.getAttribute('data-role') || ''); if (/user|human|question/i.test(c)) return 'user'; if (/assistant|bot|ai|model|response/i.test(c)) return 'assistant'; return 'unknown'; }, chatUrlPattern: '/c/{id}', sidebarSelectors: ['.sidebar-side','.session-list-wrapper','a[aria-label="chat-item"]','a.chat-item-drag-link','[class*="sidebar"]','aside','nav'] },
  { name: 'Kimi', hosts: [/(^|\.)(kimi\.moonshot\.cn|kimi\.ai|kimi\.com)$/], msgSelectors: ['.segment','.segment-container','[class*="message"]'], role: el => /user|human/i.test((el.className||'') + ' ' + (el.getAttribute('data-role')||'')) ? 'user' : 'assistant', sidebarSelectors: ['aside','nav','.next-sidebar','[class*="sidebar"]'] },
  { name: 'MiniMax', hosts: [/(^|\.)(minimax\.io|minimaxi\.com)$/], msgSelectors: ['[class*="message"]','[class*="chat-item"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Mistral Le Chat', hosts: [/(^|\.)mistral\.ai$/], msgSelectors: ['[data-message-role]','[class*="Message"]','[class*="message"]'], role: el => { const r = el.getAttribute('data-message-role') || ''; if (/user/i.test(r)) return 'user'; if (/assistant/i.test(r)) return 'assistant'; return /user/i.test(el.className || '') ? 'user' : 'assistant'; } },
  { name: 'Groq', hosts: [/(^|\.)groq\.com$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'OpenRouter', hosts: [/(^|\.)openrouter\.ai$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'HuggingChat', hosts: [/(^|\.)huggingface\.co$/], path: /^\/chat/, msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'NVIDIA NIM', hosts: [/(^|\.)build\.nvidia\.com$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Z.ai', hosts: [/(^|\.)(z\.ai|chatglm\.cn|space-z\.ai)$/], msgSelectors: ['[data-role="user"]','[data-role="assistant"]','[data-message-role]','[class*="UserMessage"]','[class*="AssistantMessage"]','[class*="message"]','[class*="chat-message"]'], role: el => { const e = el.getAttribute('data-role') || el.getAttribute('data-message-role') || ''; if (e) return /user|human/i.test(e) ? 'user' : 'assistant'; return /user|human/i.test(el.className || '') ? 'user' : 'assistant'; }, chatUrlPattern: '/c/{id}', sidebarSelectors: ['.chat-aside','.chat-history-list','[class*="chat-aside"]','[class*="chat-history"]','aside','nav'] },
  { name: 'Pollinations', hosts: [/(^|\.)pollinations\.ai$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Puter', hosts: [/(^|\.)puter\.com$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Open WebUI', hosts: [/openwebui/, /^localhost(?::\d+)?$/, /^127\.0\.0\.1(?::\d+)?$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Cloudflare AI', hosts: [/(^|\.)playground\.ai\.cloudflare\.com$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Grok', hosts: [/(^|\.)grok\.com$/], msgSelectors: ['[class*="message"]','[class*="message-bubble"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant', chatUrlPattern: '/c/{id}', sidebarSelectors: ['aside','nav','[class*="sidebar"]','[class*="sidebar-group"]'] },
  { name: 'Microsoft Copilot', hosts: [/(^|\.)copilot\.microsoft\.com$/], msgSelectors: ['[class*="message"]','[class*="turn"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Perplexity', hosts: [/(^|\.)perplexity\.ai$/], msgSelectors: ['[class*="query"]','[class*="answer"]','[class*="message"]'], role: el => /query|user|human/i.test(el.className || '') ? 'user' : 'assistant', chatUrlHints: [/\/search\//] },
  { name: 'Poe', hosts: [/(^|\.)poe\.com$/], msgSelectors: ['[class*="human-message"]','[class*="chat-message"]','[class*="message"]'], role: el => /human|user/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Character.ai', hosts: [/(^|\.)character\.ai$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'You.com', hosts: [/(^|\.)you\.com$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Doubao', hosts: [/(^|\.)doubao\.com$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Tencent Yuanbao', hosts: [/(^|\.)yuanbao\.tencent\.com$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Meta AI', hosts: [/(^|\.)meta\.ai$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Yandex Alice AI', hosts: [/(^|\.)alice\.yandex\.ru$/], msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Yandex Alice (path)', hosts: [/(^|\.)yandex\.(ru|com)$/], path: /\/alice\//i, msgSelectors: ['[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Dola', hosts: [/(^|\.)dola\.com$/], msgSelectors: ['[class*="message"]','[class*="chat-message"]'], role: el => { const c = (el.className || '').toLowerCase(); if (/user|human|question/i.test(c)) return 'user'; if (/bot|assistant|ai|response|reply/i.test(c)) return 'assistant'; return 'unknown'; }, chatUrlPattern: '/chat/{id}', sidebarSelectors: ['#flow_chat_sidebar','nav[class*="panel-"]','[class*="conversation-item"]','nav','aside'] },
  /* --- v28.2: новые платформы --- */
  { name: 'LM Arena', hosts: [/(^|\.)(lmarena\.ai|chat\.lmarena\.ai)$/], msgSelectors: ['[data-message-author-role]','[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'NotebookLM', hosts: [/(^|\.)notebooklm\.google\.com$/], msgSelectors: ['[class*="message"]','[class*="chat-turn"]','[class*="response"]'], role: el => /user|query|question/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'GitHub Copilot', hosts: [/(^|\.)github\.com$/], path: /\/copilot/i, msgSelectors: ['[data-testid="chat-message"]','[class*="ChatMessage"]','[class*="message"]'], role: el => { const t = (el.getAttribute('data-testid') || '') + ' ' + el.className; return /user/i.test(t) ? 'user' : 'assistant'; } },
  { name: 'Coze', hosts: [/(^|\.)(coze\.com|coze\.cn)$/], msgSelectors: ['[class*="message"]','[class*="chat-item"]','[class*="ChatItem"]'], role: el => /user|human|question/i.test(el.className || '') ? 'user' : 'assistant', sidebarSelectors: ['aside','nav','[class*="session"]','[class*="history"]'] },
  { name: 'Phind', hosts: [/(^|\.)phind\.com$/], msgSelectors: ['[class*="message"]','[class*="Question"]','[class*="Answer"]'], role: el => /question|user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'v0 (Vercel)', hosts: [/(^|\.)v0\.dev$/], msgSelectors: ['[data-testid="message"]','[class*="message"]','[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' }
];
function getPlatform() {
  const host = location.host, path = location.pathname;
  for (const p of PLATFORMS) {
    let ok = false;
    for (const re of p.hosts) { try { if (re.test(host)) { ok = true; break; } } catch (e) {} }
    if (!ok) continue;
    if (p.path) { try { if (!p.path.test(path)) continue; } catch (e) {} }
    return p;
  }
  return null;
}

/* ---- B.5. DOM-хелперы UACE ---- */
const SKIP_TAGS = new Set(['STYLE','SCRIPT','LINK','META','NOSCRIPT','TEMPLATE','HEAD','TITLE','BASE','HTML','SVG','PATH','G','DEFS','MAT-ICON','BR','HR']);
const HARD_EXCLUDE = '#' + UI_ID + ',#' + UI_ID + '-host,#pml-tabs-host,[class*="tooltip"]:not([class*="content"]),[class*="popover"]:not([class*="content"])';
const CHAT_AREA = 'div.chat-container,#chat-history,[data-test-id="chat-history-container"],conversation-container,div.conversation-container,ms-chat-turn,[class*="chat-history-scroll"],[class*="turn-content"],main,[role="main"]';

function isInHardExclude(el) {
  let p = el, d = 0;
  while (p && p !== document.body && d < 15) {
    try { if (p.matches && p.matches(HARD_EXCLUDE)) return true; } catch (e) {}
    p = p.parentElement; d++;
  }
  return false;
}
function isInNavigation(el) {
  let p = el, d = 0;
  while (p && p !== document.body && d < 12) {
    const tag = p.tagName ? p.tagName.toLowerCase() : '';
    const role = p.getAttribute ? (p.getAttribute('role') || '') : '';
    if (tag === 'nav' || tag === 'aside' || role === 'navigation') return true;
    if (tag === 'mat-sidenav' || tag === 'bard-sidenav' || tag === 'side-navigation-v2') return true;
    const c = (typeof p.className === 'string' ? p.className : (p.className && p.className.baseVal) || '').toLowerCase();
    if (/(^|[-_ ])(sidebar|sidenav|side-nav|drawer|chat-list|conversation-list|history-list|nav-|panel-left)([-_ ]|$)/.test(c)) return true;
    p = p.parentElement; d++;
  }
  return false;
}
function isInChatArea(el) {
  if (!el || !el.closest) return false;
  try { if (el.closest('aside, nav, [role="navigation"], [class*="sidebar"], [class*="sider"]')) return false; } catch (e) {}
  try { return !!el.closest(CHAT_AREA); } catch (e) { return false; }
}
function cls(el) { if (!el || !el.className) return ''; const c = el.className; return (typeof c === 'string' ? c : c.baseVal || '').toLowerCase(); }
function clean(s) {
  return String(s || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function txt(el) {
  if (!el || SKIP_TAGS.has(el.tagName)) return '';
  let out = '';
  try { const x = el.innerText; if (x && x.trim()) out = x.trim(); } catch (e) {}
  if (!out) out = (el.textContent || '').trim();
  return dedupeText(out);
}
function isCssOrJs(s) {
  if (!s) return false;
  const head = s.slice(0, 800);
  if (/_ngcontent|_nghost/.test(head)) return true;
  const decl = (head.match(/[a-z-]+\s*:\s*[^;{}\n]+\s*[;\n]/gi) || []).length;
  if (!decl) return false;
  const lines = head.split('\n').filter(l => l.trim()).length || 1;
  const hasBraces = /[{}]/.test(head);
  if (hasBraces && decl >= 5 && decl / lines > 0.5) return true;
  if (/@media|@font-face|@keyframes/.test(head) && decl >= 3) return true;
  return false;
}
function isSourceListing(s) {
  if (!s || s.length > 400) return false;
  if (/\d+\s*(источник|источника|источников|source|sources)/i.test(s)) return true;
  if (/\d+\s*(дн\.|день|дня|дней|day|days)\s*(назад|ago)/i.test(s)) return true;
  if (/только для скачивания/i.test(s)) return true;
  return false;
}
function isVisible(el) { try { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch (e) { return true; } }
function dedupeNested(els) {
  let arr = Array.from(els);
  if (arr.length > CFG.DEDUPE_CAP) arr = arr.slice(0, CFG.DEDUPE_CAP);
  const isContainer = new Set();
  for (const x of arr) {
    const held = arr.filter(y => y !== x && x.contains(y) && !arr.some(z => z !== x && z !== y && z.contains(y) && x.contains(z)));
    if (held.length >= 2) isContainer.add(x);
  }
  const drop = new Set();
  for (const x of arr) {
    if (isContainer.has(x)) continue;
    for (const y of arr) { if (y !== x && y.contains(x) && !isContainer.has(y)) { drop.add(x); break; } }
  }
  return arr.filter(e => !drop.has(e) && !isContainer.has(e));
}

let _srCache = null, _srCacheAt = 0;
const SR_NODE_CAP = 12000; // v28.2: защита от сверхтяжёлых DOM
function collectShadowRoots(root) {
  const roots = []; const seen = new Set();
  const nowMs = Date.now();
  const cached = (!root && _srCache && (nowMs - _srCacheAt) < 1500) ? _srCache : null;
  if (cached) return cached.slice();
  /* v28.2: полностью итеративный обход (стек) — рекурсия устранена (риск stack overflow);
     закрытые (closed) shadowRoot недоступны и/или mode!=='open' — пропускаем осознанно */
  const stack = [root || document];
  seen.add(root || document);
  let visited = 0;
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || (cur.nodeType !== 9 && cur.nodeType !== 1 && cur.nodeType !== 11)) continue;
    let all; try { all = cur.querySelectorAll('*'); } catch (e) { continue; }
    for (let i = 0; i < all.length; i++) {
      if (++visited > SR_NODE_CAP) { stack.length = 0; break; }
      const el = all[i];
      let sr = null;
      try { sr = el.shadowRoot; } catch (e) {}
      if (!sr || seen.has(sr)) continue;
      if (sr.mode && sr.mode !== 'open') { seen.add(sr); continue; }
      seen.add(sr); roots.push(sr); stack.push(sr);
    }
  }
  if (!root) { _srCache = roots; _srCacheAt = nowMs; }
  return roots;
}
function deepQueryAll(sel, root) {
  const scopes = [root || document].concat(collectShadowRoots(root));
  const out = [];
  for (const sc of scopes) {
    let found; try { found = sc.querySelectorAll(sel); } catch (e) { continue; }
    for (const el of found) if (out.indexOf(el) === -1) out.push(el);
  }
  return out;
}
function roleFromValue(v) {
  const x = String(v || '').toLowerCase().trim();
  if (/^(user|human|you|me|client|prompt|question|query)$/.test(x)) return 'user';
  if (/^(assistant|bot|ai|model|response|answer|reply)$/.test(x)) return 'assistant';
  if (/(^|[-_ ])(user|human|query|prompt|question)([-_ ]|$)/.test(x)) return 'user';
  if (/(^|[-_ ])(assistant|bot|model|response|answer|reply)([-_ ]|$)/.test(x)) return 'assistant';
  return null;
}
function detectRole(el, platform) {
  if (platform && platform.roleAttr) { const v = roleFromValue(el.getAttribute(platform.roleAttr)); if (v) return v; }
  if (platform && typeof platform.role === 'function') { try { const r = platform.role(el); if (r === 'user' || r === 'assistant') return r; } catch (e) {} }
  if (el.tagName) { const tag = el.tagName.toLowerCase(); if (tag === 'user-query') return 'user'; if (tag === 'model-response') return 'assistant'; }
  const score = { user: 0, assistant: 0 };
  const nodes = [el]; let p = el.parentElement;
  for (let i = 0; i < 5 && p; i++, p = p.parentElement) nodes.push(p);
  for (let ni = 0; ni < nodes.length; ni++) {
    const n = nodes[ni]; const w = ni === 0 ? 1 : 0.6;
    for (const a of n.attributes || []) {
      const name = a.name.toLowerCase(), value = String(a.value || '').toLowerCase();
      if (/role|author|sender|speaker|type|side|from/i.test(name)) {
        if (/user|human|you\b|me\b|client|question|prompt|query/i.test(value)) score.user += 8 * w;
        if (/assistant|bot|model|response|answer|reply/i.test(value)) score.assistant += 8 * w;
      }
    }
    const r1 = roleFromValue(cls(n)); if (r1) score[r1] += (ni === 0 ? 6 : 4) * w;
  }
  if (el.querySelector && el.querySelector('[class*="markdown"],[class*="prose"],.katex')) score.assistant += 5;
  if (score.user >= score.assistant + 4 && score.user >= 5) return 'user';
  if (score.assistant >= score.user + 4 && score.assistant >= 5) return 'assistant';
  return 'unknown';
}
function filterValid(found) {
  const valid = [];
  found.forEach(el => {
    if (isInHardExclude(el)) return;
    if (isInNavigation(el)) return;
    if (!isVisible(el)) return;
    const t = txt(el);
    if (!t || t.length < CFG.MIN_TEXT) return;
    if (isCssOrJs(t) || isSourceListing(t)) return;
    valid.push(el);
  });
  return valid;
}

/* ---- B.6. Поиск сообщений ---- */
function findMessages() {
  const platform = getPlatform();
  const UNIVERSAL = ['[data-message-author-role]','[data-testid="user-message"]','[data-testid="assistant-message"]','user-query','model-response','.segment','.segment-container','[data-message-role]','[data-message-id]','[class*="UserMessage"]','[class*="AssistantMessage"]','[class*="user-message"]:not([class*="input"]):not([class*="fixed"])','[class*="assistant-message"]:not([class*="input"]):not([class*="fixed"])','[class*="Message_container"]','[class*="MessageContainer"]','div.conversation-container'];
  const trySel = sel => {
    let found = deepQueryAll(sel);
    if (!found || found.length < 1) return null;
    const valid = dedupeNested(filterValid(found));
    return valid.length ? valid : null;
  };
  if (platform) {
    for (let i = 0; i < platform.msgSelectors.length; i++) {
      const valid = trySel(platform.msgSelectors[i]);
      if (valid && (i === 0 ? valid.length >= 2 : valid.length >= CFG.MSG_MIN)) return { items: valid.slice(0, CFG.MSG_MAX), source: platform.msgSelectors[i], platform };
    }
    let best = null, bestSel = '';
    for (const sel of platform.msgSelectors.concat(UNIVERSAL)) {
      const valid = trySel(sel);
      if (valid && valid.length > (best ? best.length : 0)) { best = valid; bestSel = sel; }
    }
    if (best) return { items: best.slice(0, CFG.MSG_MAX), source: bestSel, platform };
  }
  let best = null, bestSel = '';
  for (const sel of UNIVERSAL) {
    const valid = trySel(sel);
    if (valid && valid.length > (best ? best.length : 0)) { best = valid; bestSel = sel; }
  }
  if (best) return { items: best.slice(0, CFG.MSG_MAX), source: bestSel, platform };
  const heur = heuristicMessages();
  if (heur && heur.length >= 2) return { items: heur.slice(0, CFG.MSG_MAX), source: 'heuristic', platform };
  return null;
}
function heuristicMessages() {
  const containers = deepQueryAll('main, article, section, [role="main"], [class*="conversation"], [class*="chat"]');
  let best = null;
  for (const c of containers) {
    const groups = {};
    Array.from(c.children || []).forEach(child => {
      const key = child.tagName + '|' + (typeof child.className === 'string' ? child.className : '').split(/\s+/).slice(0, 3).join(' ');
      (groups[key] = groups[key] || []).push(child);
    });
    for (const key of Object.keys(groups)) {
      const group = dedupeNested(filterValid(groups[key]));
      if (group.length >= 3 && (!best || group.length > best.length)) best = group;
    }
    Array.from(c.children || []).forEach(mid => {
      Array.from(mid.children || []).forEach(child => {
        const key = child.tagName + '|' + (typeof child.className === 'string' ? child.className : '').split(/\s+/).slice(0, 3).join(' ');
        (groups['@' + key] = groups['@' + key] || []).push(child);
      });
    });
    for (const key of Object.keys(groups)) {
      if (!/^@/.test(key)) continue;
      const group = dedupeNested(filterValid(groups[key]));
      if (group.length >= 3 && (!best || group.length > best.length)) best = group;
    }
  }
  return best;
}

/* ---- B.7. Render holder + markdown ---- */
let renderHolder = null;
function getRenderHolder() {
  if (!renderHolder || !renderHolder.isConnected) {
    renderHolder = document.createElement('div');
    renderHolder.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;pointer-events:none;opacity:0;z-index:-1;white-space:normal;';
    (document.body || document.documentElement).appendChild(renderHolder);
  }
  return renderHolder;
}
function extractText(el) {
  const clone = el.cloneNode(true);
  const remove = clone.querySelectorAll('style,script,link,meta,noscript,template,svg,button,nav,footer,[role="button"],[role="toolbar"],.sr-only,time,[class*="timestamp"],[class*="copy-button"],[class*="action-bar"],[class*="toolbar"],[class*="feedback"],[class*="rating"],mat-icon,[class*="icon"]:not([class*="content"]),[data-icon],i[class*="fa-"]');
  for (let i = 0; i < remove.length; i++) remove[i].remove();
  const holder = getRenderHolder();
  holder.appendChild(clone);
  let t = '';
  try { t = clean(clone.innerText || ''); } catch (e) { t = (clone.textContent || '').trim(); }
  clone.remove();
  return t;
}
const MD_REMOVE = 'style,script,link,meta,noscript,template,svg,button,nav,footer,header,[role="button"],[role="toolbar"],[aria-hidden="true"],.sr-only,time,[class*="timestamp"],[class*="copy-button"],[class*="action-bar"],[class*="toolbar"],[class*="feedback"],[class*="rating"],mat-icon,[data-icon]';
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CHROME_TOKENS = ['python','python3','javascript','js','typescript','ts','jsx','tsx','java','c','c++','cpp','csharp','cs','go','golang','rust','ruby','php','swift','kotlin','scala','bash','sh','shell','zsh','powershell','sql','html','css','scss','less','json','json5','yaml','yml','xml','toml','ini','markdown','md','text','txt','plaintext','perl','r','matlab','dart','lua','groovy','objc','objectivec','pascal','fortran','haskell','elixir','erlang','clojure','vb','vba','asm','assembly','wasm','graphql','dockerfile','makefile','diff','mermaid','run','copy','код','язык','запустить','выполнить','копировать','показать','скрыть','свернуть','развернуть','collapse','expand','toggle','wrap','nowrap','edit','done','save','share','download'];
const CHROME_TOKENS_SORTED = CHROME_TOKENS.slice().sort((a, b) => b.length - a.length);
const CHROME_ALT = CHROME_TOKENS_SORTED.map(escapeRe).join('|');
const CHROME_TOKEN_PREFIX_RE = new RegExp('^(?:' + CHROME_ALT + ')', 'i');
const CHROME_TOKEN_FULL_RE = new RegExp('^(?:' + CHROME_ALT + ')$', 'i');
function isChromeText(t) {
  const s = String(t || '').trim();
  if (!s || s.length > 40) return false;
  const words = s.split(/\s+/);
  if (words.length <= 4 && words.every(w => CHROME_TOKEN_FULL_RE.test(w))) return true;
  let rest = s.toLowerCase(), guard = 0;
  while (rest.length && guard++ < 10) {
    const m = rest.match(CHROME_TOKEN_PREFIX_RE);
    if (!m) return false;
    rest = rest.slice(m[0].length);
  }
  return rest.length === 0;
}
function stripCodeChrome(root) {
  let pres;
  try { pres = Array.from(root.querySelectorAll('pre')); } catch (e) { return; }
  for (const pre of pres) {
    let anc = pre.parentElement;
    for (let lvl = 0; anc && lvl < 2; lvl++) {
      const kids = Array.from(anc.childNodes || []);
      for (const k of kids) {
        if (k.nodeType === 3) { if (isChromeText(k.nodeValue)) k.nodeValue = ''; continue; }
        if (k.nodeType !== 1 || k === pre) continue;
        const tag = (k.tagName || '').toLowerCase();
        if (tag === 'pre' || tag === 'code') continue;
        try { if (k.contains && k.contains(pre)) continue; } catch (e) {}
        if (isChromeText(k.textContent) && typeof k.remove === 'function') k.remove();
      }
      anc = anc.parentElement;
    }
  }
}
const mermaidEnabled = () => safeStorageGet('uaice_mermaid') !== '0';
function processMermaid(content) {
  const s = String(content || '');
  if (s.indexOf('```mermaid') === -1) return s;
  return s.replace(/```mermaid\r?\n([\s\S]*?)```/gi, (match, code) => {
    try {
      const src = String(code).trim();
      if (!src || src.length > 50000) return match;
      const b64 = btoa(unescape(encodeURIComponent(src)));
      return match + '\n\n> 📊 [SVG-диаграмма](https://mermaid.ink/svg/' + b64 + ')\n';
    } catch (e) { return match; }
  });
}
function domToMarkdown(el) {
  const root = el.cloneNode(true);
  let rm; try { rm = root.querySelectorAll(MD_REMOVE); } catch (e) { rm = []; }
  for (let i = 0; i < rm.length; i++) rm[i].remove();
  stripCodeChrome(root);
  try {
    const maths = root.querySelectorAll('.katex, .katex-display, mjx-container, math[alttext]');
    for (let mi = 0; mi < maths.length; mi++) {
      const mn = maths[mi];
      if (!mn.parentElement || (root.contains && !root.contains(mn))) continue;
      let tex = '';
      const ann = mn.querySelector('annotation[encoding="application/x-tex"]');
      if (ann && ann.textContent) tex = ann.textContent.trim();
      if (!tex && mn.getAttribute) tex = mn.getAttribute('alttext') || '';
      if (!tex) continue;
      const display = (mn.classList && mn.classList.contains('katex-display')) || mn.getAttribute('display') === 'block';
      const doc = root.ownerDocument || document;
      mn.parentElement.replaceChild(doc.createTextNode(display ? '\n\n$$' + tex + '$$\n\n' : ' $' + tex + '$ '), mn);
    }
  } catch (e) {}
  function children(node) { return Array.from(node.childNodes || []).map(walk).join(''); }
  function walk(node) {
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'noscript') return '';
    if (tag === 'br') return '\n';
    if (tag === 'hr') return '\n\n---\n\n';
    if (tag === 'pre') {
      const code = node.querySelector('code');
      const lang = code && code.className && (code.className.match(/language-([\w-]+)/) || [])[1] || '';
      const text = (code ? code.textContent : node.textContent) || '';
      return '\n\n```' + lang + '\n' + String(text).replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n```\n\n';
    }
    if (tag === 'code') return '`' + clean(node.textContent) + '`';
    if (tag === 'img') { const src = node.getAttribute('src') || ''; if (!src) return ''; return '![' + (node.getAttribute('alt') || '') + '](' + src + ')'; }
    if (tag === 'a') { const href = node.getAttribute('href') || ''; const v = clean(children(node)); return href ? '[' + (v || href) + '](' + href + ')' : v; }
    if (/^h[1-6]$/.test(tag)) return '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + clean(children(node)) + '\n\n';
    if (tag === 'strong' || tag === 'b') { const v = clean(children(node)); return v ? '**' + v + '**' : ''; }
    if (tag === 'em' || tag === 'i') { const v = clean(children(node)); return v ? '*' + v + '*' : ''; }
    if (tag === 'del' || tag === 's') { const v = clean(children(node)); return v ? '~~' + v + '~~' : ''; }
    if (tag === 'blockquote') { const v = clean(children(node)); return '\n\n' + v.split('\n').map(l => '> ' + l).join('\n') + '\n\n'; }
    if (tag === 'li') { const ordered = node.parentElement && node.parentElement.tagName.toLowerCase() === 'ol'; return (ordered ? '1. ' : '- ') + clean(children(node)) + '\n'; }
    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol';
      let lis = [];
      try { lis = Array.from(node.children || []).filter(c => c && c.tagName && c.tagName.toLowerCase() === 'li'); } catch (e) {}
      if (lis.length) {
        const body = lis.map((li, i) => (ordered ? (i + 1) + '. ' : '- ') + clean(children(li)) + '\n').join('');
        return '\n\n' + body + '\n';
      }
      return '\n\n' + children(node) + '\n';
    }
    if (tag === 'table') return tableToMarkdown(node);
    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'figure') return '\n' + children(node) + '\n';
    return children(node);
  }
  function tableToMarkdown(table) {
    let rows; try { rows = Array.from(table.querySelectorAll('tr')); } catch (e) { return ''; }
    if (!rows.length) return '';
    const matrix = rows.map(row => {
      const cells = [];
      try {
        Array.from(row.querySelectorAll('th,td')).forEach(cell => {
          const t = clean(cell.innerText || cell.textContent || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
          const cs = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1);
          cells.push(t);
          for (let k = 1; k < cs; k++) cells.push('');
        });
      } catch (e) {}
      return cells;
    });
    const width = Math.max(1, ...matrix.map(r => r.length));
    const norm = matrix.map(r => { const c = r.slice(); while (c.length < width) c.push(''); return c; });
    const head = norm[0];
    let out = '\n\n| ' + head.join(' | ') + ' |\n| ' + head.map(() => '---').join(' | ') + ' |\n';
    out += norm.slice(1).map(r => '| ' + r.join(' | ') + ' |').join('\n') + '\n\n';
    return out;
  }
  return clean(walk(root));
}
const THINK_SELECTORS = ['[class*="think"]','[class*="reason"]','[class*="analysis"]','[class*="thought"]','[data-testid*="think"]','[data-testid*="reason"]','[data-testid*="analysis"]','[aria-label*="thinking" i]','[aria-label*="reasoning" i]'];
function extractThinking(el) {
  const nodes = [];
  for (const sel of THINK_SELECTORS) nodes.push(...deepQueryAll(sel, el));
  const unique = dedupeNested(nodes);
  const out = [];
  for (const n of unique) { const t = domToMarkdown(n); if (t && out.indexOf(t) === -1) out.push(t); }
  return out;
}
function collectMedia(el, msgIndex) {
  const images = [], attachments = [];
  try {
    const imgs = el.querySelectorAll('img[src]');
    for (let i = 0; i < imgs.length && images.length < CFG.IMG_PER_MSG; i++) {
      const src = imgs[i].getAttribute('src') || '';
      if (!src || /^data:/i.test(src)) continue;
      images.push({ src: new URL(src, location.href).href, alt: imgs[i].getAttribute('alt') || '', msg: msgIndex });
    }
  } catch (e) {}
  try {
    const atts = el.querySelectorAll('a[href][download],[class*="attachment"] a[href],[data-filename]');
    for (let i = 0; i < atts.length; i++) {
      const a = atts[i];
      const href = a.getAttribute('href') || '';
      if (!href || /^(#|javascript:)/i.test(href)) continue;
      attachments.push({ url: new URL(href, location.href).href, name: a.getAttribute('data-filename') || a.getAttribute('download') || (href.split('/').pop() || 'file').split('?')[0] });
    }
  } catch (e) {}
  return { images, attachments };
}
const LANG_EXT = { javascript:'js', js:'js', typescript:'ts', ts:'ts', python:'py', py:'py', ruby:'rb', go:'go', golang:'go', rust:'rs', java:'java', c:'c', cpp:'cpp', 'c++':'cpp', csharp:'cs', 'c#':'cs', php:'php', bash:'sh', shell:'sh', sh:'sh', html:'html', css:'css', json:'json', yaml:'yml', yml:'yml', xml:'xml', markdown:'md', md:'md', sql:'sql', r:'r', swift:'swift', kotlin:'kt', scala:'scala', perl:'pl', lua:'lua', dart:'dart', toml:'toml', ini:'ini', tex:'tex', matlab:'m', mermaid:'mmd' };
function collectArtifacts(el, msgIndex) {
  const arts = [];
  try {
    const pres = el.querySelectorAll('pre');
    for (let i = 0; i < pres.length && arts.length < 30; i++) {
      const pre = pres[i];
      const code = pre.querySelector('code') || pre;
      let lang = '';
      const cls = (code.className || '') + ' ' + (pre.className || '');
      const mm = cls.match(/language-([\w+#-]+)/i) || cls.match(/lang-([\w+#-]+)/i);
      if (mm) lang = mm[1].toLowerCase();
      const text = (code.textContent || '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
      if (!text || text.length < 12) continue;
      if (isCssOrJs(text) && text.length < 80) continue;
      const ext = LANG_EXT[lang] || (lang ? lang.replace(/[^a-z0-9]/gi, '') : '') || 'txt';
      arts.push({ type: 'code', lang: lang || 'text', content: text, ext, msg: msgIndex });
    }
  } catch (e) {}
  return arts;
}

/* ---- B.8. Scrape ---- */
function scrape(options) {
  options = options || {};
  const found = findMessages();
  if (!found) return { items: [], platform: null, source: null, images: [], attachments: [], artifacts: [] };
  const platform = found.platform;
  const pre = [];
  found.items.forEach(el => {
    const content = stripUiPrefix(domToMarkdown(el));
    const text = stripUiPrefix(extractText(el));
    if (!content && !text) return;
    const plain = text || content;
    if (plain.length < CFG.MIN_TEXT) return;
    if (isCssOrJs(plain) || isSourceListing(plain)) return;
    pre.push({ el, content, text, thinking: extractThinking(el) });
  });
  const roles = pre.map(m => detectRole(m.el, platform));
  const allUnknown = roles.length > 0 && roles.every(r => r === 'unknown');
  const allSame = roles.length > 1 && roles.every(r => r === roles[0]);
  const parity = allUnknown || (allSame && roles[0] !== 'user');
  const allImages = [], allAttachments = [], allArtifacts = [];
  const out = pre.map((m, i) => {
    let role = roles[i];
    if (role === 'unknown' && parity) role = i % 2 === 0 ? 'user' : 'assistant';
    else if (parity && role === roles[0]) role = i % 2 === 0 ? 'user' : 'assistant';
    let content = m.content;
    if (options.stripThinking && m.thinking.length) {
      for (const block of m.thinking) {
        if (!block || block.length < 3) continue;
        let guard = 0;
        while (content.indexOf(block) !== -1 && guard++ < 20) content = content.replace(block, '');
      }
      content = clean(content);
    }
    if (mermaidEnabled()) content = processMermaid(content);
    const media = collectMedia(m.el, i);
    collectArtifacts(m.el, i).forEach(a => allArtifacts.push(a));
    media.images.forEach(x => allImages.push(x));
    media.attachments.forEach(x => allAttachments.push(x));
    return { role, content, text: m.text || clean(m.content), thinking: options.exportThinking ? m.thinking : [] };
  }).filter(m => (options.stripThinking ? m.content : m.text) && (options.stripThinking ? m.content.length : m.text.length) >= CFG.MIN_TEXT);
  return { items: out.slice(0, CFG.MSG_MAX), source: found.source, platformName: (platform && platform.name) || null, images: allImages.slice(0, CFG.IMG_TOTAL), attachments: allAttachments.slice(0, CFG.IMG_TOTAL), artifacts: allArtifacts.slice(0, 300) };
}
function snapshotScrape() {
  try {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('#' + UI_ID + ',#' + UI_ID + '-host,#pml-tabs-host,script,style,noscript,svg').forEach(n => n.remove());
    const holder = getRenderHolder();
    holder.appendChild(clone);
    let t = '';
    try { t = clean(clone.innerText || ''); } catch (e) { t = (clone.textContent || '').trim(); }
    clone.remove();
    if (!t || t.length < CFG.MIN_TOTAL_TEXT) return null;
    if (t.length > CFG.SNAPSHOT_MAX) t = t.slice(0, CFG.SNAPSHOT_MAX) + '\n\n… (обрезано)';
    return { items: [{ role: 'unknown', content: '⚠ Автоснимок страницы (структура не распознана точечно):\n\n' + t, text: '⚠ Автоснимок страницы (структура не распознана точечно):\n\n' + t, thinking: [] }], source: 'snapshot', platformName: (getPlatform() || {}).name || null, images: [], attachments: [], artifacts: [] };
  } catch (e) { return null; }
}
function fingerprint() { const found = findMessages(); if (!found) return ''; return found.items.map(el => txt(el).slice(0, 80)).join('|'); }
function findScrollContainer() {
  const found = findMessages();
  const sample = found && found.items && found.items[0];
  let p = sample;
  for (let i = 0; i < 14 && p; i++, p = p.parentElement) {
    try { const st = getComputedStyle(p); if (/auto|scroll/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 100) return p; } catch (e) {}
  }
  const candidates = [document.scrollingElement, document.documentElement, document.body];
  try { candidates.push(...document.querySelectorAll('main,[role="main"],[class*="scroll"],[class*="conversation"]')); } catch (e) {}
  let sc = null, bestSize = 0;
  for (const el of candidates) {
    if (!el) continue;
    try { const extra = el.scrollHeight - el.clientHeight; if (extra > 100 && el.clientHeight > 150 && el.scrollHeight > bestSize) { bestSize = el.scrollHeight; sc = el; } } catch (e) {}
  }
  return sc;
}
async function autoScroll(statusFn) {
  const sc = findScrollContainer(); if (!sc) return;
  if (statusFn) statusFn('Прокручиваю историю...');
  let lastH = -1, stable = 0;
  for (let i = 0; i < CFG.SCROLL_ROUNDS; i++) {
    if (CANCEL) return;
    sc.scrollTop = 0;
    await sleep(CFG.SCROLL_WAIT);
    const h = sc.scrollHeight;
    if (h === lastH) stable++; else stable = 0;
    lastH = h;
    if (stable >= 3) break;
    if (statusFn && i % 5 === 0) statusFn('История: ' + (i + 1) + '/' + CFG.SCROLL_ROUNDS);
  }
  try { sc.scrollTop = sc.scrollHeight; } catch (e) {}
  await sleep(400);
}
async function waitStable(prevFp, prevHref) {
  const start = Date.now();
  let lastFp = '', lastChangeTime = Date.now();
  let hrefChanged = !!(prevHref && location.href !== prevHref);
  while (Date.now() - start < CFG.MAX_WAIT) {
    if (CANCEL) return false;
    await sleep(CFG.POLL);
    if (!hrefChanged && prevHref && location.href !== prevHref) { hrefChanged = true; lastChangeTime = Date.now(); }
    const cur = fingerprint();
    if (cur && cur !== prevFp) {
      if (cur !== lastFp) { lastFp = cur; lastChangeTime = Date.now(); }
      else if (Date.now() - lastChangeTime >= CFG.STABLE_MS) return true;
    } else if (hrefChanged && Date.now() - lastChangeTime >= CFG.STABLE_MS) return true;
    if (!hrefChanged && !lastFp && Date.now() - start > 6000) return false;
  }
  const fp = fingerprint();
  return (!!fp && fp !== prevFp) || hrefChanged;
}
async function waitForContentChange(beforeHref, prevFp, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (CANCEL) return false;
    await sleep(250);
    if (location.href !== beforeHref) return true;
    if (fingerprint() !== prevFp) return true;
  }
  return false;
}

/* ---- B.9. Форматы ---- */
function platformName(scraped) {
  const n = scraped && scraped.platformName; if (n) return n;
  const p = getPlatform(); return p ? p.name : 'universal-heuristic';
}
function roleLabel(role) {
  if (role === 'user') return '🧑‍💻 User';
  if (role === 'assistant') return '🤖 Assistant';
  return '❔ ' + (role || 'Unknown');
}
const frontMatterEnabled = () => safeStorageGet('uaice_fm') !== '0';
function toMarkdown(scraped, title) {
  const L = [];
  if (frontMatterEnabled()) {
    const dateTag = '#export-' + now().slice(0, 10);
    const platTag = '#' + String(platformName(scraped)).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '');
    L.push('---',
      'title: ' + JSON.stringify(String(title || 'export')),
      'platform: ' + JSON.stringify(platformName(scraped)),
      'url: ' + JSON.stringify(location.href),
      'exported_at: ' + JSON.stringify(new Date().toISOString()),
      'exporter: ' + JSON.stringify('UACE v' + UACE_VER + ' × PML v' + UPOLY_VER),
      'messages_count: ' + scraped.items.length,
      'tags: [' + JSON.stringify(platTag) + ', ' + JSON.stringify(dateTag) + ']',
      '---', '', '# ' + title, '');
  } else {
    L.push('# ' + title, '', '- **Platform:** ' + platformName(scraped), '- **URL:** ' + location.href, '- **Exported:** ' + now() + ' (v' + SCRIPT_VER + ')', '- **Messages:** ' + scraped.items.length, '', '---', '');
  }
  scraped.items.forEach(m => {
    L.push('### ' + roleLabel(m.role), '', m.content || m.text, '');
    if (m.thinking && m.thinking.length) L.push('<details><summary>🧠 Thinking</summary>', '', m.thinking.join('\n\n'), '', '</details>', '');
  });
  return L.join('\n');
}
function toJSON(scraped, title) {
  return JSON.stringify({ title, platform: platformName(scraped), exporter: 'UACE v' + UACE_VER + ' × PML v' + UPOLY_VER, url: location.href, exported_at: new Date().toISOString(), messages_count: scraped.items.length, source_selector: scraped.source || null, messages: scraped.items.map((m, i) => ({ index: i, role: m.role, content_markdown: m.content, text: m.text, thinking: m.thinking || [] })) }, null, 2);
}
function toTXT(scraped, title) {
  const lines = [title, '='.repeat(Math.min(title.length, 70)), 'Platform: ' + platformName(scraped), 'URL: ' + location.href, 'Exported: ' + now() + ' (v' + SCRIPT_VER + ')', ''];
  scraped.items.forEach(m => {
    lines.push('[' + String(m.role || 'unknown').toUpperCase() + ']');
    if (m.thinking && m.thinking.length) lines.push('[REASONING]', m.thinking.join('\n\n'), '');
    lines.push(m.text || m.content); lines.push('');
  });
  return lines.join('\n');
}
function htmlCss() {
  return 'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#222}h1{border-bottom:2px solid #eee;padding-bottom:.5rem}.msg{margin:1.5rem 0;padding:1rem;border-radius:8px}.user{background:#e7f3ff;border-left:4px solid #1a73e8}.assistant{background:#f5f5f5;border-left:4px solid #666}.unknown{background:#fff8e1;border-left:4px solid #f0a500}.role{font-weight:600;margin-bottom:.5rem;color:#555}.meta{color:#888;font-size:.9rem;margin-bottom:2rem}.think{background:#fafafa;border:1px dashed #ccc;border-radius:6px;padding:.6rem;margin:.6rem 0;font-size:.92em;color:#555}';
}
function htmlBody(scraped, title) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let h = '<h1>' + esc(title) + '</h1>';
  h += '<div class="meta">Platform: ' + esc(platformName(scraped)) + '<br>URL: ' + esc(location.href) + '<br>Exported: ' + now() + ' (v' + SCRIPT_VER + ')<br>Messages: ' + scraped.items.length + '</div>';
  scraped.items.forEach(m => {
    h += '<div class="msg ' + esc(String(m.role || 'unknown')) + '">';
    h += '<div class="role">' + esc(roleLabel(m.role)) + '</div>';
    if (m.thinking && m.thinking.length) h += '<div class="think"><b>🧠 Thinking</b><br>' + esc(m.thinking.join('\n\n')).replace(/\n/g, '<br>') + '</div>';
    h += '<div>' + esc(m.text || m.content).replace(/\n/g, '<br>') + '</div></div>';
  });
  return h;
}
function toHTML(scraped, title) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(title) + '</title><style>' + htmlCss() + '</style></head><body>' + htmlBody(scraped, title) + '</body></html>';
}
function sharegptFrom(role) { return role === 'user' ? 'human' : role === 'assistant' ? 'gpt' : 'system'; }
function toShareGPT(scraped, title) {
  return JSON.stringify({ title, url: location.href, exported_at: new Date().toISOString(), conversations: scraped.items.map(m => ({ from: sharegptFrom(m.role), value: m.text || m.content })) }, null, 2);
}
function toJSONL(scraped, title) {
  return scraped.items.map((m, i) => JSON.stringify({ chat: title, i, role: m.role, text: m.text || m.content })).join('\n');
}
function toAlpaca(scraped, title) {
  const samples = []; let pending = null;
  scraped.items.forEach(m => {
    if (m.role === 'user') { if (pending) samples.push({ instruction: pending, input: '', output: '' }); pending = m.text || m.content; }
    else if (m.role === 'assistant') { samples.push({ instruction: pending || '', input: '', output: m.text || m.content }); pending = null; }
    else if (pending) { samples.push({ instruction: pending, input: '', output: '' }); pending = null; }
  });
  if (pending) samples.push({ instruction: pending, input: '', output: '' });
  return JSON.stringify({ chat: title, url: location.href, samples }, null, 2);
}
function contentFor(format, scraped, title) {
  if (format === 'json') return { content: toJSON(scraped, title), ext: 'json', mime: 'application/json;charset=utf-8' };
  if (format === 'txt') return { content: toTXT(scraped, title), ext: 'txt', mime: 'text/plain;charset=utf-8' };
  if (format === 'html') return { content: toHTML(scraped, title), ext: 'html', mime: 'text/html;charset=utf-8' };
  if (format === 'sharegpt') return { content: toShareGPT(scraped, title), ext: 'sharegpt.json', mime: 'application/json;charset=utf-8' };
  if (format === 'jsonl') return { content: toJSONL(scraped, title), ext: 'jsonl', mime: 'application/x-ndjson;charset=utf-8' };
  if (format === 'alpaca') return { content: toAlpaca(scraped, title), ext: 'alpaca.json', mime: 'application/json;charset=utf-8' };
  return { content: toMarkdown(scraped, title), ext: 'md', mime: 'text/markdown;charset=utf-8' };
}

/* ---- B.10. Доставка: Blob / ZIP без CDN / PDF ---- */
function downloadBlob(content, filename, mime) {
  const blob = (content instanceof Blob) ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  (document.body || document.documentElement).appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
async function downloadSmart(content, filename, mime) {
  const blob = (content instanceof Blob) ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  if (typeof window.showSaveFilePicker === 'function' && /\.(zip|pdf)$/i.test(String(filename || ''))) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: filename });
      const wr = await h.createWritable();
      await wr.write(blob);
      await wr.close();
      return true;
    } catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  downloadBlob(blob, filename, mime); return false;
}
const CRC_TABLE = (function () { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function dosDateTime(d) { const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xFFFF; const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(); return { time, date }; }
function zipStore(entries) {
  const enc = new TextEncoder();
  const localChunks = [], centralChunks = []; let offset = 0;
  const d = new Date(); const { time, date } = dosDateTime(d);
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = ArrayBuffer.isView(e.data) ? e.data : enc.encode(String(e.data)); /* v28.2: isView — реалм-независимо */
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    localChunks.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    centralChunks.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  let cdSize = 0; for (const c of centralChunks) cdSize += c.length;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(4, 0, true); eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true); eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true); eocd.setUint16(20, 0, true);
  return new Blob(localChunks.concat(centralChunks, [new Uint8Array(eocd.buffer)]), { type: 'application/zip' });
}
/* ---- v28.2: ZIP c DEFLATE (native CompressionStream) + фейлвер STORED ---- */
const HAS_DEFLATE = (function () { try { return typeof CompressionStream === 'function'; } catch (e) { return false; } })();
async function deflateRawU8(u8) {
  if (!HAS_DEFLATE) return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const stream = new Blob([u8]).stream().pipeThrough(cs);
    const ab = await new Response(stream).arrayBuffer();
    const out = new Uint8Array(ab);
    return (out.length && out.length < u8.length) ? out : null; // несжимаемое — храним как есть
  } catch (e) { return null; }
}
async function zipStoreAsync(entries, opts) {
  const compress = !(opts && opts.store === true) && HAS_DEFLATE;
  const enc = new TextEncoder();
  const localChunks = [], centralChunks = []; let offset = 0;
  const d = new Date(); const { time, date } = dosDateTime(d);
  const plainSizes = new Map(); // v28.2: несжатый размер по имени — для заголовков DEFLATE
  for (const e of entries) { try { const dd = ArrayBuffer.isView(e.data) ? e.data : enc.encode(String(e.data)); plainSizes.set(e.name, dd.length); } catch (e2) {} }
  for (const e of entries) {
    const name = enc.encode(e.name);
    let data = ArrayBuffer.isView(e.data) ? e.data : enc.encode(String(e.data)); /* v28.2: isView — реалм-независимо */
    let method = 0; // 0 = STORED
    let crcPlain = crc32(data);
    if (compress && data.length > 96) {
      const deflated = await deflateRawU8(data);
      if (deflated) { data = deflated; method = 8; } // 8 = DEFLATE
    }
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crcPlain, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, plainSizes.get(e.name) || data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    localChunks.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crcPlain, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, plainSizes.get(e.name) || data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    centralChunks.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  let cdSize = 0; for (const c of centralChunks) cdSize += c.length;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(4, 0, true); eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true); eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true); eocd.setUint16(20, 0, true);
  return new Blob(localChunks.concat(centralChunks, [new Uint8Array(eocd.buffer)]), { type: 'application/zip' });
}
const u32PlainSize = new Map(); // (совместимость; фактический учёт внутри zipStoreAsync)
async function zipStoreSmart(entries, opts) {
  if (HAS_DEFLATE) {
    try { return await zipStoreAsync(entries, opts); } catch (e) { console.warn('[UACE] ZIP deflate не удался, фейлвер STORED:', e); }
  }
  return zipStore(entries);
}
const blobToU8 = blob => blob.arrayBuffer().then(ab => new Uint8Array(ab));
function extFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.indexOf('jpeg') !== -1) return 'jpg';
  if (m.indexOf('png') !== -1) return 'png';
  if (m.indexOf('webp') !== -1) return 'webp';
  if (m.indexOf('gif') !== -1) return 'gif';
  if (m.indexOf('svg') !== -1) return 'svg';
  if (m.indexOf('bmp') !== -1) return 'bmp';
  return 'bin';
}
/* ---- v28.2: 4-уровневый CORS-фейлвер для изображений ---- */
function gmXhrAvailable() {
  try { return typeof GM_xmlhttpRequest === 'function' || !!(typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function'); } catch (e) { return false; }
}
function fetchViaGM(url) {
  return new Promise((resolve, reject) => {
    let sent = false;
    const run = (fn) => { try { fn({ method: 'GET', url, responseType: 'arraybuffer', timeout: CFG.IMG_TIMEOUT, headers: { 'Accept': 'image/*,*/*' },
      onload: (res) => {
        if (res.status >= 200 && res.status < 300) {
          const u8 = new Uint8Array(res.response);
          let mime = '';
          if (res.responseHeaders) { const m = res.responseHeaders.match(/content-type:\s*([^\r\n;]+)/i); if (m) mime = m[1].toLowerCase().trim(); }
          if (!u8 || u8.length < 24) return reject(new Error('GM_XHR пустой ответ'));
          resolve({ data: u8, ext: extFromMime(mime) });
        } else reject(new Error('GM_XHR HTTP ' + res.status));
      },
      onerror: () => reject(new Error('GM_XHR ошибка сети')),
      ontimeout: () => reject(new Error('GM_XHR тайм-аут')) }); } catch (e) { reject(e); } };
    if (typeof GM_xmlhttpRequest === 'function') { sent = true; run(GM_xmlhttpRequest); }
    else if (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') { sent = true; run(GM.xmlHttpRequest); }
    if (!sent) reject(new Error('GM_xmlhttpRequest недоступен'));
  });
}
function canvasFromImgEl(imgEl) {
  const canvas = document.createElement('canvas');
  canvas.width = imgEl.naturalWidth; canvas.height = imgEl.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d недоступен');
  ctx.drawImage(imgEl, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { data: bytes, ext: 'png' };
}
function extractImageViaCanvas(imgUrl) {
  return new Promise((resolve, reject) => {
    try {
      const imgs = deepQueryAll('img');
      const imgEl = imgs.find(i => i.src === imgUrl || i.currentSrc === imgUrl);
      if (!imgEl || !imgEl.complete || !imgEl.naturalWidth) return reject(new Error('Изображение недоступно в DOM'));
      resolve(canvasFromImgEl(imgEl));
    } catch (e) { reject(new Error('Canvas CORS restriction: ' + (e && e.message || e))); }
  });
}
function extractImageViaCanvasFresh(imgUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; reject(new Error('canvas-fresh тайм-аут')); }, CFG.IMG_TIMEOUT);
    img.onload = () => {
      clearTimeout(timer);
      try {
        if (!img.naturalWidth) return reject(new Error('canvas-fresh: пустое изображение'));
        resolve(canvasFromImgEl(img));
      } catch (e) { reject(new Error('Canvas CORS restriction: ' + (e && e.message || e))); }
    };
    img.onerror = () => { clearTimeout(timer); reject(new Error('canvas-fresh: загрузка не удалась')); };
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.src = imgUrl;
  });
}
async function fetchImageU8(url) {
  const tries = CFG.IMG_RETRIES || 3; let lastErr = null;
  /* Level 1: нативный fetch (CORS, кэш) */
  for (let attempt = 0; attempt < tries; attempt++) {
    const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, CFG.IMG_TIMEOUT) : null;
    try {
      const resp = await fetch(url, { mode: 'cors', cache: attempt === 0 ? 'force-cache' : 'no-cache', signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status + (resp.status === 401 || resp.status === 403 ? ' (session-bound)' : ''));
      const blob = await resp.blob();
      if (!blob || !blob.size) throw new Error('пустой blob');
      return { data: await blobToU8(blob), ext: extFromMime(blob.type) };
    } catch (e) { lastErr = e; if (attempt < tries - 1) await sleep(350 * (attempt + 1)); }
    finally { if (timer) clearTimeout(timer); }
  }
  /* Level 2: привилегии юзерскрипта (GM_xmlhttpRequest / GM.xmlHttpRequest) */
  if (gmXhrAvailable()) {
    try { return await fetchViaGM(url); } catch (e) { lastErr = e; }
  }
  /* Level 3: растр уже отрендеренного <img> из DOM */
  try { return await extractImageViaCanvas(url); } catch (e) { lastErr = e; }
  /* Level 4: свежая загрузка <img crossOrigin=anonymous> + canvas */
  try { return await extractImageViaCanvasFresh(url); } catch (e) { lastErr = e; }
  throw lastErr || new Error('CORS/сессия: все 4 уровня исчерпаны (fetch, GM, canvas-DOM, canvas-fresh)');
}
const resolveInner = () => { const v = (safeStorageGet('uaice_zipinner') || 'md').toLowerCase(); return ['md','json','txt','html','pdf','both'].indexOf(v) !== -1 ? v : 'md'; };
const imagesEnabled = () => safeStorageGet('uaice_images') !== '0';

/* ---- v28.2: пул параллельных задач (картинки больше не качаются по одной) ---- */
async function poolMap(items, limit, worker, statusTick) {
  const arr = Array.isArray(items) ? items.slice() : [];
  const out = new Array(arr.length);
  let cursor = 0, done = 0;
  const lanes = new Array(Math.max(1, Math.min(limit || 4, arr.length || 1))).fill(0).map(async () => {
    while (cursor < arr.length) {
      const idx = cursor++;
      try { out[idx] = { ok: true, value: await worker(arr[idx], idx) }; }
      catch (e) { out[idx] = { ok: false, error: e };
      } finally { done++; if (statusTick) try { statusTick(done, arr.length); } catch (e) {} }
    }
  });
  await Promise.all(lanes);
  return out;
}

async function buildZipEntries(results, failures, innerFmt, statusFn) {
  const entries = []; const index = []; const imagesFailed = []; const attachmentsAll = [];
  let imgSeq = 0, artSeq = 0;
  for (let i = 0; i < results.length; i++) {
    if (CANCEL) break;
    const r = results[i];
    if (statusFn) statusFn('ZIP ' + progress(i, results.length, sanitize(r.title, 24)));
    const base = String(i + 1).padStart(3, '0') + '-' + sanitize(r.title);
    const rec = { file: '', title: r.title, url: r.url, messages: r.scraped.items.length };
    if (innerFmt === 'both') {
      const fm = contentFor('md', r.scraped, r.title);
      const fj = contentFor('json', r.scraped, r.title);
      rec.file = base + '.md+.json';
      entries.push({ name: 'chats/' + base + '.md', data: fm.content });
      entries.push({ name: 'chats/' + base + '.json', data: fj.content });
    } else if (innerFmt === 'pdf') {
      /* v28.2: в ZIP кладём настоящий PDF только при явном CDN-флаге; иначе — печатная HTML-версия без CSP-рисков */
      if (safeStorageGet('uaice_pdfcdn') === '1') {
        try {
          const blob = await renderPdfBlobCdn(r.scraped, r.title);
          rec.file = base + '.pdf';
          entries.push({ name: 'chats/' + rec.file, data: await blobToU8(blob) });
        } catch (e) {
          rec.file = base + '.print.html'; rec.note = 'CDN-рендер недоступен (' + (e && e.message) + '), сохранена печатная HTML';
          try { const h = await renderPdfBlob(r.scraped, r.title); entries.push({ name: 'chats/' + rec.file, data: await blobToU8(h) }); }
          catch (e2) { rec.file = base + '.md'; delete rec.note; entries.push({ name: 'chats/' + rec.file, data: contentFor('md', r.scraped, r.title).content }); }
        }
      } else {
        try {
          const h = await renderPdfBlob(r.scraped, r.title);
          rec.file = base + '.print.html'; rec.note = '0-CDN: печатная HTML (открыть → Ctrl+P → Сохранить как PDF)';
          entries.push({ name: 'chats/' + rec.file, data: await blobToU8(h) });
        } catch (e) { rec.file = base + '.md'; entries.push({ name: 'chats/' + rec.file, data: contentFor('md', r.scraped, r.title).content }); }
      }
    } else {
      const f = contentFor(innerFmt, r.scraped, r.title);
      rec.file = base + '.' + f.ext;
      entries.push({ name: 'chats/' + rec.file, data: f.content });
    }
    if (imagesEnabled() && r.scraped && Array.isArray(r.scraped.images)) {
      /* v28.2: параллельная загрузка (пул ≤4) вместо последовательной */
      const queue = [];
      let perChat = 0;
      for (const im of r.scraped.images) {
        if (imgSeq >= CFG.IMG_TOTAL || perChat >= 20) break;
        queue.push(im); perChat++;
      }
      const gotList = await poolMap(queue, 4, im => fetchImageU8(im.src));
      for (let q = 0; q < gotList.length; q++) {
        const got = gotList[q];
        if (got && got.ok) {
          imgSeq++;
          entries.push({ name: 'images/' + String(i + 1).padStart(3, '0') + '-' + String(q + 1).padStart(2, '0') + '.' + got.value.ext, data: got.value.data });
          rec.images = (rec.images || 0) + 1;
        } else {
          imagesFailed.push(queue[q].src + ' — ' + ((got && got.error && got.error.message) || 'ошибка'));
        }
      }
    }
    if (r.scraped && Array.isArray(r.scraped.attachments)) r.scraped.attachments.forEach(a => attachmentsAll.push({ chat: r.title, url: a.url, name: a.name }));
    if (r.scraped && Array.isArray(r.scraped.artifacts)) {
      for (const a of r.scraped.artifacts) {
        if (artSeq >= CFG.ARTIFACTS_MAX) break;
        artSeq++;
        entries.push({ name: 'artifacts/' + String(i + 1).padStart(3, '0') + '-' + String((a.msg || 0) + 1).padStart(2, '0') + '-' + sanitize(a.lang || 'text', 20) + '.' + (a.ext || 'txt'), data: a.content || '' });
        rec.artifacts = (rec.artifacts || 0) + 1;
      }
    }
    index.push(rec);
  }
  if (imagesEnabled()) {
    const links = [];
    for (const r of results) if (r.scraped && Array.isArray(r.scraped.images)) r.scraped.images.forEach(im => links.push('- [' + sanitize(r.title, 40) + '] ' + im.src));
    if (links.length) entries.push({ name: '_image-links.txt', data: ['# Все найденные изображения (для ручной загрузки при CORS-блоках)', ''].concat(links).join('\n') });
  }
  if (failures.length) entries.push({ name: '_FAILURES.txt', data: ['# Не удалось', ''].concat(failures.map(f => '- ' + f.title + ': ' + f.error)).join('\n') });
  if (attachmentsAll.length) entries.push({ name: '_attachments.txt', data: attachmentsAll.map(a => '- [' + sanitize(a.chat, 40) + '] ' + a.name + ' — ' + a.url).join('\n') });
  if (imagesFailed.length) entries.push({ name: '_images-failed.txt', data: ['# Не скачались (CORS/доступ)', ''].concat(imagesFailed).join('\n') });
  entries.push({ name: '_index.json', data: JSON.stringify({ exporter: 'UACE v' + UACE_VER + ' × PML v' + UPOLY_VER, created: now(), format: innerFmt, chats: index, failures, images_failed: imagesFailed.length }, null, 2) });
  return entries;
}
function splitZipVolumes(entries, maxBytes) {
  const limit = maxBytes || CFG.MAX_ZIP_MB * 1024 * 1024;
  const size = e => 30 + (e.name ? e.name.length : 0) + (e.data ? (e.data.length || 0) : 0) + 46;
  const total = entries.reduce((s, e) => s + size(e), 0);
  if (total <= limit) return [entries];
  const vols = []; let cur = [], curSize = 0;
  for (const e of entries) {
    const s = size(e);
    if (cur.length && curSize + s > limit) { vols.push(cur); cur = []; curSize = 0; }
    cur.push(e); curSize += s;
  }
  if (cur.length) vols.push(cur);
  return vols;
}
async function volumesToDownloads(vols, baseName, statusFn) {
  for (let i = 0; i < vols.length; i++) {
    if (statusFn && vols.length > 1) statusFn('ZIP: том ' + (i + 1) + '/' + vols.length + '...');
    const name = vols.length > 1 ? baseName + '-part' + (i + 1) + '.zip' : baseName + '.zip';
    const blob = HAS_DEFLATE ? await zipStoreSmart(vols[i]) : zipStore(vols[i]);
    await downloadSmart(blob, name, 'application/zip');
  }
  if (vols.length > 1) toast('⚠ ZIP разбит на ' + vols.length + ' томов (лимит ' + CFG.MAX_ZIP_MB + ' МБ)', 5000);
}
/* ---- v28.2.2: PDF 0-CDN — iframe РЕАЛЬНОГО размера вне экрана + наполнение
 *      DOM-API (без document.write: TT-сайты типа gemini блокируют запись
 *      строкой). Печать = нативное «Сохранить как PDF». 0×0-iframe печатал
 *      пустые/безстильные страницы — «ПРОПАЛИ СТИЛИ». ---- */
function pdfPrintCss() {
  return '@media print { @page { margin: 14mm; size: A4; } html, body { background: #fff; } body { font-family: system-ui, sans-serif; color: #000; margin: 0; } .msg { page-break-inside: avoid; } .think { page-break-inside: avoid; } pre, code { white-space: pre-wrap; word-break: break-all; background: #f4f4f4; padding: 6px; } }';
}
function fillPrintDoc(doc, scraped, title) {
  /* v28.2.2: наполнение документа печати через DOM-API (TT-безопасно) */
  try { const t = doc.createElement('title'); t.textContent = String(title || 'export').replace(/[&<>]/g, ''); doc.head.appendChild(t); } catch (e) {}
  try { const st = doc.createElement('style'); st.textContent = htmlCss() + '\n' + pdfPrintCss(); doc.head.appendChild(st); } catch (e) {}
  const holder = doc.createElement('div');
  setHTML(holder, htmlBody(scraped, title));
  doc.body.appendChild(holder);
  return holder;
}
function renderPdfBlob(scraped, title) {
  return new Promise((resolve, reject) => {
    let iframe = null, settled = false;
    const cleanup = () => { try { if (iframe) iframe.remove(); } catch (e) {} };
    const timer = setTimeout(() => { if (!settled) { settled = true; cleanup(); reject(new Error('print timeout')); } }, 120000);
    try {
      iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('title', 'Печать отчёта UACE');
      iframe.style.cssText = 'position:fixed;left:-12000px;top:0;width:1024px;height:768px;border:0;outline:none;';
      (document.body || document.documentElement).appendChild(iframe);
      const win = iframe.contentWindow, doc = win.document;
      fillPrintDoc(doc, scraped, title);
      try { win.addEventListener('afterprint', () => setTimeout(cleanup, 1500), { once: true }); } catch (e) {}
      const doPrint = () => {
        if (settled) return;
        try {
          win.focus();
          win.print(); /* диалог печати → «Сохранить как PDF» */
          settled = true; clearTimeout(timer);
          setTimeout(cleanup, 30000); /* iframe живёт, пока открыт диалог */
          resolve(true);
        } catch (e) { settled = true; clearTimeout(timer); cleanup(); reject(e); }
      };
      const ready = (doc.fonts && doc.fonts.ready) ? doc.fonts.ready : Promise.resolve();
      Promise.resolve(ready).then(() => setTimeout(doPrint, 300)).catch(() => setTimeout(doPrint, 300));
    } catch (err) { settled = true; clearTimeout(timer); cleanup(); reject(err); }
  });
}
/* v28.2: прежний CDN-рендер переименован и включается только флагом uaice_pdfcdn=1 */
async function renderPdfBlobCdn(scraped, title) {
  await loadScript(LIBS.html2pdf, 'html2pdf');
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;background:#fff;';
  setHTML(holder, '<style>' + htmlCss() + '</style>' + htmlBody(scraped, title)); /* v28.2.2: TT-safe */
  (document.body || document.documentElement).appendChild(holder);
  try {
    const pdf = await window.html2pdf().set({ margin: 10, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(holder).toPdf().get('pdf');
    return pdf.output('blob');
  } finally { holder.remove(); }
}
function printFallback(scraped, title) {
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
}
const setStatusSafe = t => { try { console.warn('[UACE] ' + t); } catch (e) {} try { toast(t, 7000); } catch (e2) {} }; /* v28.2.2: фидбек не только в console */
async function exportAsPDF(scraped, title) {
  /* v28.2.2: основной путь — 0-CDN iframe-печать (нативное «Сохранить как PDF»);
     CDN-рендер — только по явному флагу uaice_pdfcdn=1; далее окно печати,
     далее ГАРАНТ-файл .print.html. Каждый шаг — тост-фидбек. */
  if (safeStorageGet('uaice_pdfcdn') === '1') {
    try { const blob = await renderPdfBlobCdn(scraped, title); downloadBlob(blob, sanitize(title) + '-' + ts() + '.pdf', 'application/pdf'); toast('PDF: файл сохранён (CDN-рендер)', 4000); return; }
    catch (e) { console.error('PDF CDN error:', e); setStatusSafe('PDF: CDN-рендер не удался (' + (e && e.message ? e.message : 'CSP') + '), переключаюсь на печать браузера'); }
  }
  try { await renderPdfBlob(scraped, title); toast('PDF: открыт диалог печати — выберите «Сохранить как PDF»', 6000); }
  catch (e) { console.error('PDF print error:', e); setStatusSafe('PDF: печать в iframe не удалась (' + (e && e.message ? e.message : 'ошибка') + '), пробую отдельное окно'); printFallback(scraped, title); }
}
async function saveInFormat(scraped, title, format) {
  if (format === 'pdf') { await exportAsPDF(scraped, title); return; }
  if (format === 'zip') {
    const entries = await buildZipEntries([{ title, url: location.href, scraped }], [], resolveInner(), null);
    await volumesToDownloads(splitZipVolumes(entries), sanitize(title) + '-' + ts(), null);
    return;
  }
  const f = contentFor(format, scraped, title);
  downloadBlob(f.content, sanitize(title) + '-' + ts() + '.' + f.ext, f.mime);
}
function buildMerged(results, innerFmt) {
  if (innerFmt === 'json') return JSON.stringify({ exporter: 'UACE v' + UACE_VER + ' × PML v' + UPOLY_VER, created: now(), chats: results.map(r => ({ title: r.title, url: r.url, platform: platformName(r.scraped), messages: r.scraped.items })) }, null, 2);
  if (innerFmt === 'sharegpt') return JSON.stringify({ exporter: 'UACE v' + UACE_VER + ' × PML v' + UPOLY_VER, created: now(), chats: results.map(r => ({ title: r.title, url: r.url, conversations: r.scraped.items.map(m => ({ from: sharegptFrom(m.role), value: m.text || m.content })) })) }, null, 2);
  if (innerFmt === 'alpaca') return JSON.stringify({ exporter: 'UACE v' + UACE_VER + ' × PML v' + UPOLY_VER, created: now(), chats: results.map(r => JSON.parse(toAlpaca(r.scraped, r.title))) }, null, 2);
  if (innerFmt === 'jsonl') return results.map(r => toJSONL(r.scraped, r.title)).join('\n');
  if (innerFmt === 'html') { let h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI Chats</title><style>' + htmlCss() + 'section{page-break-after:always}</style></head><body>'; results.forEach(r => { h += '<section>' + htmlBody(r.scraped, r.title) + '</section>'; }); return h + '</body></html>'; }
  const sep = '='.repeat(60);
  return results.map((r, i) => { const f = contentFor(innerFmt === 'pdf' ? 'md' : innerFmt, r.scraped, r.title); return '\n\n' + sep + '\n' + (i + 1) + '. ' + r.title + '\n' + r.url + '\n' + sep + '\n\n' + f.content; }).join('\n');
}
async function finalizeResults(results, failures, format, inner, statusFn) {
  if (!results.length) {
    if (failures.length) downloadBlob(['# Не удалось', ''].concat(failures.map(f => '- ' + f.title + ': ' + f.error)).join('\n'), '_FAILURES-' + ts() + '.txt', 'text/plain;charset=utf-8');
    return;
  }
  if (format === 'zip') {
    try {
      if (statusFn) statusFn('Собираю ZIP...');
      const entries = await buildZipEntries(results, failures, inner, statusFn);
      await volumesToDownloads(splitZipVolumes(entries), 'ai-chats-' + ts(), statusFn);
      return;
    } catch (e) { console.error(e); if (statusFn) statusFn('⚠ ZIP не удался, объединённый файл'); }
  }
  if (inner === 'pdf') {
    for (let i = 0; i < results.length; i++) {
      if (CANCEL) break;
      const r = results[i];
      if (statusFn) statusFn('PDF ' + progress(i, results.length, sanitize(r.title, 24)));
      try { await exportAsPDF(r.scraped, String(i + 1).padStart(3, '0') + '-' + r.title); } catch (e) {}
      await sleep(700);
    }
  } else {
    const merged = buildMerged(results, inner);
    const f = contentFor(inner, results[0].scraped, results[0].title);
    downloadBlob(merged, 'ai-chats-' + ts() + '.' + f.ext, f.mime);
  }
  if (failures.length) downloadBlob(['# Не удалось', ''].concat(failures.map(f => '- ' + f.title + ': ' + f.error)).join('\n'), '_FAILURES-' + ts() + '.txt', 'text/plain;charset=utf-8');
}

/* ---- B.11. Сайдбар UACE ---- */
const UUID_RE = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
function extractChatTarget(el) {
  if (!el) return { href: null, id: null };
  if (el.attributes) {
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i]; const v = a.value || '';
      if (a.name === 'href' && v) { try { return { href: new URL(v, location.href).href, id: null }; } catch (e) {} }
      const m = v.match(UUID_RE); if (m) return { href: null, id: m[1] };
      if (/^(data-(chat|conversation|session|thread|id)|id)$/i.test(a.name) && v.length >= 6 && v.length <= 80) return { href: null, id: v };
    }
  }
  const innerA = el.querySelector && el.querySelector('a[href]');
  if (innerA && innerA.href) return { href: innerA.href, id: null };
  const html = el.outerHTML || '';
  const m1 = html.match(UUID_RE);
  if (m1) return { href: null, id: m1[1] };
  try {
    const keys = Object.keys(el);
    for (let ki = 0; ki < keys.length; ki++) {
      const k = keys[ki];
      if (k.indexOf('__reactProps$') !== 0 && k.indexOf('__reactFiber$') !== 0) continue;
      let node = el[k];
      for (let depth = 0; depth < 10 && node; depth++) {
        const props = node.memoizedProps;
        if (props && typeof props === 'object') {
          const keys2 = Object.keys(props);
          for (let pi = 0; pi < keys2.length; pi++) {
            const pv = props[keys2[pi]];
            if (typeof pv === 'string') {
              const m = pv.match(UUID_RE); if (m) return { href: null, id: m[1] };
              if (/^(id|chatId|conversationId|sessionId|threadId|key)$/i.test(keys2[pi]) && pv.length >= 6 && pv.length <= 80) return { href: null, id: pv };
              if (/^href$|^to$|^url$/i.test(keys2[pi]) && pv.length > 1) { try { return { href: new URL(pv, location.href).href, id: null }; } catch (e) {} }
            } else if (pv && typeof pv === 'object') {
              const innerKeys = Object.keys(pv);
              for (let ii = 0; ii < innerKeys.length; ii++) {
                const ipv = pv[innerKeys[ii]];
                if (typeof ipv === 'string') { const m = ipv.match(UUID_RE); if (m) return { href: null, id: m[1] }; }
              }
            }
          }
        }
        node = node.return;
      }
    }
  } catch (e) {}
  return { href: null, id: null };
}
function buildChatUrl(id) {
  if (!id) return null;
  const platform = getPlatform();
  if (platform && platform.chatUrlPattern) return location.origin + platform.chatUrlPattern.replace('{id}', id);
  const m = location.pathname.match(/^(.*\/)(c|chat|conversation|app|thread)\/[^\/]+/i);
  if (m) return location.origin + m[1] + m[2] + '/' + id;
  return location.origin + '/c/' + id;
}
function tryReactOnClick(el) {
  try {
    const keys = Object.keys(el);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('__reactProps$') !== 0) continue;
      const props = el[keys[i]];
      if (props && typeof props.onClick === 'function') {
        const evt = { type: 'click', target: el, currentTarget: el, nativeEvent: { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, preventDefault: () => {}, stopPropagation: () => {}, isDefaultPrevented: () => false, isPropagationStopped: () => false, persist: () => {}, defaultPrevented: false, bubbles: true, cancelable: true };
        props.onClick(evt); return true;
      }
    }
  } catch (e) {}
  return false;
}
function isChatUrl(href) {
  if (!href) return false;
  try {
    const u = new URL(href, location.href);
    if (u.origin !== location.origin) return false;
    if (/^\/(new|create|edit|settings|help|login|signup|logout|terms|privacy|about|contact|faq|legal|pricing|billing|account|profile|drive|create-image|cron-jobs|tasks|discover|explore|search|upgrade|download|auth|oauth|reset|verify)/i.test(u.pathname)) return false;
    if (/\/(chat|work|code|c|conversation|thread|app|gem|s|share|session|talk|a)\/[a-zA-Z0-9][a-zA-Z0-9_\/-]{7,}/i.test(u.pathname)) return true;
    if (/[?&](id|chat|conversation|thread|session)=/i.test(u.search)) return true;
    return false;
  } catch (e) { return false; }
}
const NAV_KEYWORDS = ['проекты','проект','новая папка','новый проект','vibe','work','code','chat','projects','настройки','settings','профиль','profile','новый чат','new chat','помощь','help','сообщество','community','обновления','updates','поиск','search','архив','archive','избранное','library','библиотека','gpts','sora','explore','discover','temporary chat','временный чат','新对话','新建对话','新聊天','新建会话','设置','帮助','delete','удалить','rename','переименовать','pin','закрепить','share','поделиться','все чаты','all chats','история','history','activity','gemini','extensions','расширения','gems','notebooklm','new notebook','upgrade','обновить','попробовать','блокноты','недавние','artifacts','customize','pinned','new','claude','images','scheduled','plugins','health','codex','создание контента ии','запланированные задачи','диск','dola','поиск по чатам','новый блокнот','новая беседа'];
const normalizeNavKey = s => String(s || '').replace(/[\s.…,;:!?—–-]+$/g, '').toLowerCase().trim();
function isNavKeyword(s) { if (!s) return false; const low = normalizeNavKey(s); if (!low || low.length > 40) return false; return NAV_KEYWORDS.indexOf(low) !== -1; }
function isClickable(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'a' && el.hasAttribute && el.hasAttribute('href')) return true;
  if (tag === 'button') return true;
  const role = el.getAttribute ? (el.getAttribute('role') || '') : '';
  if (role === 'button' || role === 'link' || role === 'listitem' || role === 'option' || role === 'tab') return true;
  const tab = el.getAttribute ? el.getAttribute('tabindex') : null;
  if (tab !== null && tab !== undefined && tab !== '-1') return true;
  return false;
}
function isNavContainer(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  const role = el.getAttribute ? (el.getAttribute('role') || '') : '';
  if (tag === 'mat-sidenav' || tag === 'bard-sidenav' || tag === 'side-navigation-v2') return true;
  if (tag === 'aside' || tag === 'nav' || role === 'navigation') return true;
  const c = (typeof el.className === 'string' ? el.className : '').toLowerCase();
  if (/sidenav|sidebar|side-nav|drawer|history-list|chat-list|conversation-list|side-bar|chat-aside|chat-history/.test(c)) return true;
  return false;
}
function isLeftSide(el) {
  if (!el) return false;
  try {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 1920;
    if (r.height < 100) return false;
    if (r.width < 20) return false;
    if (r.left > vw * 0.40) return false;
    if (r.left + r.width > vw * 0.65) return false;
    return true;
  } catch (e) { return false; }
}
function looksLikeCode(s) {
  if (!s) return true;
  const t = s.trim();
  if (t.length < 2) return true;
  if (/\b(is not defined|is not a function|TypeError|ReferenceError|SyntaxError)\b/.test(t)) return true;
  if (/^https?:\/\/\S+$/i.test(t)) return true;
  if (/^Thought for \d+/i.test(t)) return true;
  if (/^```/.test(t)) return true;
  return false;
}
function looksLikeChatItem(el) {
  if (!el || !isVisible(el)) return false;
  if (el.closest && el.closest('#' + UI_ID)) return false;
  if (el.closest && el.closest('#pml-tabs-host')) return false;
  if (isInChatArea(el)) return false;
  let t = txt(el);
  if (!t || t.length < 2) { const p = el.parentElement; if (p) t = txt(p); }
  if (!t || t.length < 2 || t.length > 120) return false;
  if (isNavKeyword(t) || isCssOrJs(t) || isSourceListing(t)) return false;
  if (t.indexOf('\n') !== -1) return false;
  if (looksLikeCode(t)) return false;
  if (t.indexOf('::') !== -1) return false;
  if (/^[#>*-]\s/.test(t)) return false;
  if (/[.…]{2,}\s*$/.test(t)) return false;
  if (/^[A-Za-z]{2,6}$/.test(t)) return false;
  return true;
}
function findLeftPanel() {
  const cands = [];
  const sels = 'mat-sidenav, bard-sidenav, side-navigation-v2, aside, nav, [role="navigation"], [class*="sidenav"], [class*="sidebar"], [class*="sider"], [class*="side-bar"], [class*="history"], [class*="conversation"], [class*="chat-aside"], [class*="chat-history"], [class*="chat-list"], #flow_chat_sidebar, nav[class*="panel-"]';
  let els = [];
  try { els = document.querySelectorAll(sels); } catch (e) { els = []; }
  els.forEach(el => {
    try {
      if (el.closest && el.closest('#' + UI_ID)) return;
      if (!isLeftSide(el)) return;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const scrollable = /auto|scroll/.test(st.overflowY) || /auto|scroll/.test(st.overflow);
      let score = Math.max(r.height, 200) * (scrollable ? 2 : 1);
      if (isNavContainer(el)) score *= 4;
      const cc = el.querySelectorAll('a[href*="/a/chat/s/"], a[href*="/chat/"], a[href*="/c/"], [class*="conversation-item"]').length;
      if (cc > 0) score *= 5;
      cands.push({ el, score });
    } catch (e) {}
  });
  cands.sort((a, b) => b.score - a.score);
  return cands[0] ? cands[0].el : null;
}
function isDrawerOpen() { return !!document.querySelector('mat-sidenav.mat-drawer-opened, mat-sidenav.mat-drawer-opening, bard-sidenav.mat-drawer-opened, bard-sidenav.mat-drawer-opening, aside.mat-drawer-opened'); }
function isSidebarOpen() {
  if (isDrawerOpen()) return true;
  const panel = findLeftPanel(); if (!panel) return false;
  const r = panel.getBoundingClientRect();
  return r.left >= -5 && r.width >= 20 && r.height >= 100;
}
async function waitForDrawerOpen(t) {
  const s = Date.now();
  while (Date.now() - s < t) { if (isDrawerOpen()) { await sleep(600); return true; } await sleep(150); }
  return isDrawerOpen();
}
async function dispatchFullClick(el) {
  try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
  await sleep(120);
  try { if (typeof el.focus === 'function') el.focus(); } catch (e) {}
  let cx = 1, cy = 1;
  try { const r = el.getBoundingClientRect(); cx = Math.floor(r.left + r.width / 2) || 1; cy = Math.floor(r.top + r.height / 2) || 1; } catch (e) {}
  const base = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, detail: 1 };
  const fire = (type, Ctor, extra) => { try { el.dispatchEvent(new Ctor(type, Object.assign({}, base, extra))); } catch (e) {} };
  fire('pointerover', PointerEvent || MouseEvent, { pointerId: 1, pointerType: 'mouse', buttons: 0, isPrimary: true });
  fire('mouseover', MouseEvent, { buttons: 0 });
  fire('pointerenter', PointerEvent || MouseEvent, { pointerId: 1, pointerType: 'mouse', buttons: 0, isPrimary: true });
  fire('mouseenter', MouseEvent, { buttons: 0 });
  fire('mousemove', MouseEvent, {});
  fire('pointerdown', PointerEvent || MouseEvent, { pointerId: 1, pointerType: 'mouse', buttons: 1, isPrimary: true });
  fire('mousedown', MouseEvent, { buttons: 1 });
  fire('pointerup', PointerEvent || MouseEvent, { pointerId: 1, pointerType: 'mouse', buttons: 0, isPrimary: true });
  fire('mouseup', MouseEvent, { buttons: 0 });
  fire('click', MouseEvent, {});
  try { if (typeof el.click === 'function') el.click(); } catch (e) {}
}
async function tryOpenSidebar() {
  if (isSidebarOpen()) return true;
  const seen = new Set(), cands = [];
  const pushC = el => { if (!el || seen.has(el)) return; if (!isVisible(el)) return; seen.add(el); cands.push(el); };
  try { const q = document.querySelector('#sidebar-toggle-button'); if (q) pushC(q); } catch (e) {}
  const sels = ['button[aria-label*="Main menu" i]','button[aria-label*="Side panel" i]','button[aria-label*="sidebar" i]','button[aria-label*="sidenav" i]','button[aria-label*="Toggle sidebar" i]','button[aria-label*="menu" i]','button[aria-label*="Open" i]','button[aria-label*="Открыть" i]','button[aria-label*="меню" i]','[class*="sidebar-toggle"]','[class*="menu-toggle"]','[class*="hamburger"]','.slide-switch'];
  for (const sel of sels) { try { document.querySelectorAll(sel).forEach(pushC); } catch (e) {} }
  for (const c of cands) { try { await dispatchFullClick(c); if (await waitForDrawerOpen(2000)) return true; } catch (e) {} }
  return isSidebarOpen();
}
async function ensureSidebar() {
  let ok = await tryOpenSidebar();
  if (!ok) { await sleep(800); ok = await tryOpenSidebar(); }
  if (!ok) { await sleep(1200); ok = await tryOpenSidebar(); }
  return ok;
}
function extractItemsFromPanel(panel) {
  if (!panel) return [];
  const groups = {};
  panel.querySelectorAll('*').forEach(el => {
    try {
      if (el.closest && el.closest('#' + UI_ID)) return;
      if (!looksLikeChatItem(el)) return;
      if (el.children.length > 10) return;
      let clickable = isClickable(el);
      if (!clickable) { const anc = el.closest && el.closest('a[href], button, [role="button"], [role="listitem"]'); if (anc) clickable = true; }
      if (!clickable) return;
      const key = el.tagName;
      (groups[key] = groups[key] || []).push(el);
    } catch (e) {}
  });
  let best = null;
  Object.keys(groups).forEach(key => {
    const els = groups[key];
    if (els.length < 2) return;
    const cleanList = els.filter(el => !els.some(o => o !== el && o.contains(el)));
    if (cleanList.length < 2) return;
    if (!best || cleanList.length > best.items.length) best = { key, items: cleanList };
  });
  if (!best) return [];
  return best.items.map(el => {
    const ex = extractChatTarget(el);
    const title = txt(el).slice(0, 120);
    return { el, href: (ex && ex.href) || '', title, dataId: (ex && ex.id) || null };
  });
}
function collectChatLinks(rootEl) {
  const root = rootEl || document;
  const out = []; const seen = new Set();
  const curUrl = location.href.split('?')[0].replace(/\/$/, '');
  const push = item => {
    if (!item || !item.el) return;
    if (seen.has(item.el)) return;
    for (let i = 0; i < out.length; i++) {
      if (out[i].el === item.el) return;
      if (out[i].el.contains(item.el) || item.el.contains(out[i].el)) return;
    }
    seen.add(item.el); out.push(item);
  };
  const platform = getPlatform();
  const hints = platform && platform.chatUrlHints;
  if (hints && hints.length) {
    try {
      root.querySelectorAll('a[href]').forEach(a => {
        if (!isVisible(a)) return;
        const href = a.getAttribute('href') || '';
        let matched = false;
        for (const h of hints) { try { if (h.test(href)) { matched = true; break; } } catch (e) {} }
        if (!matched) return;
        if (!isChatUrl(a.href)) return;
        const t = txt(a);
        if (!t || t.length < 2 || t.length > 200) return;
        if (looksLikeCode(t) || isNavKeyword(t)) return;
        push({ el: a, href: a.href || '', title: t.slice(0, 120), dataId: null });
      });
    } catch (e) {}
  }
  try {
    const sel = 'a[aria-label="chat-item"], a.chat-item-drag-link, [class*="conversation-item"], [class*="chat-item"], [class*="history-item"], [class*="session-item"], [data-chat-id], [data-conversation-id], [data-session-id], [data-thread-id]';
    root.querySelectorAll(sel).forEach(el => {
      if (!isVisible(el)) return;
      const t = txt(el);
      if (!t || t.length < 2 || t.length > 200) return;
      if (looksLikeCode(t) || isNavKeyword(t)) return;
      const extracted = extractChatTarget(el);
      const innerA = el.querySelector('a[href]');
      const dataId = el.getAttribute('data-chat-id') || el.getAttribute('data-conversation-id') || el.getAttribute('data-session-id') || el.getAttribute('data-thread-id') || (extracted && extracted.id) || null;
      const href = (innerA && innerA.href) || (extracted && extracted.href) || '';
      if (!href && !dataId) return;
      if (href && href.split('?')[0].replace(/\/$/, '') === curUrl) return;
      push({ el, href, title: t.slice(0, 120), dataId });
    });
  } catch (e) {}
  try {
    root.querySelectorAll('a[href]').forEach(a => {
      if (isInChatArea(a)) return;
      if (!isVisible(a)) return;
      const t = txt(a);
      if (!t || t.length < 2 || t.length > 200) return;
      if (isNavKeyword(t) || isCssOrJs(t) || isSourceListing(t) || looksLikeCode(t)) return;
      try { const u = new URL(a.href, location.href); if (u.origin !== location.origin) return; } catch (e) { return; }
      if (!isChatUrl(a.href)) return;
      if (a.href.split('?')[0].replace(/\/$/, '') === curUrl) return;
      push({ el: a, href: a.href || '', title: t.slice(0, 120), dataId: null });
    });
  } catch (e) {}
  try {
    const panel = (root === document) ? findLeftPanel() : root;
    if (panel) extractItemsFromPanel(panel).forEach(it => {
      if (it.href && it.href.split('?')[0].replace(/\/$/, '') === curUrl) return;
      push(it);
    });
  } catch (e) {}
  return out;
}
function scanContainers(selector) {
  let containers; try { containers = document.querySelectorAll(selector); } catch (e) { return null; }
  const cands = [];
  for (const c of containers) {
    if (c.closest && c.closest('#' + UI_ID)) continue;
    if (!isLeftSide(c)) continue;
    const links = collectChatLinks(c);
    if (links.length >= 2) cands.push({ container: c, items: links, score: links.length, via: 'container' });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0] || null;
}
function findStructuralChatItems() {
  const panel = findLeftPanel(); if (!panel) return null;
  const items = extractItemsFromPanel(panel);
  return items.length >= 2 ? { container: panel, items, score: items.length, via: 'left-panel' } : null;
}
function findClickableChatItems() {
  const panel = findLeftPanel(); if (!panel) return null;
  const items = []; const curUrl = location.href.split('?')[0].replace(/\/$/, '');
  let nl = [];
  try { nl = panel.querySelectorAll('[role="button"], [role="link"], [role="listitem"], [tabindex]:not([tabindex="-1"]), button, li, a[aria-label="chat-item"], a.chat-item-drag-link, [class*="conversation-item"]'); } catch (e) {}
  for (const el of nl) {
    if (el.closest && el.closest('#' + UI_ID)) continue;
    if (!isVisible(el)) continue;
    if (el.children.length > 6) continue;
    const t = txt(el);
    if (!t || t.length < 2 || t.length > 120) continue;
    if (looksLikeCode(t) || isNavKeyword(t) || isCssOrJs(t)) continue;
    if (t.indexOf('\n') !== -1) continue;
    const href = el.href || '';
    if (href && href.split('?')[0].replace(/\/$/, '') === curUrl) continue;
    items.push({ el, href, title: t.slice(0, 120), dataId: null });
  }
  if (items.length >= 2) return { container: panel, items, score: items.length, via: 'click-items' };
  return null;
}
function findList() {
  const platform = getPlatform();
  const strategies = [];
  if (platform && platform.sidebarSelectors && platform.sidebarSelectors.length) strategies.push({ name: 'platform', fn: () => scanContainers(platform.sidebarSelectors.join(',')) });
  strategies.push({ name: 'generic', fn: () => scanContainers('nav,aside,[role="navigation"],[class*="sidebar"],[class*="history"],[class*="chat-list"],[class*="conversation-list"],[class*="sider"]') });
  strategies.push({ name: 'conversation-item', fn: () => {
    const items = [];
    try {
      document.querySelectorAll('[class*="conversation-item"], a[id^="conversation_"]').forEach(el => {
        const t = txt(el); if (!t || t.length < 2) return;
        const href = el.href || '';
        if (href && href.split('?')[0] === location.href.split('?')[0]) return;
        items.push({ el, href, title: t.slice(0, 120), dataId: null });
      });
    } catch (e) {}
    return items.length >= 2 ? { container: null, items, score: items.length, via: 'conversation-item' } : null;
  } });
  strategies.push({ name: 'structural', fn: findStructuralChatItems });
  strategies.push({ name: 'click-items', fn: findClickableChatItems });
  for (const st of strategies) {
    try { const r = st.fn(); if (r && r.items && r.items.length >= 2) return r; } catch (e) {}
  }
  const docLinks = collectChatLinks(document).filter(it => it.href || it.dataId);
  if (docLinks.length >= 2) return { container: null, items: docLinks, score: docLinks.length, via: 'doc-links', fallback: true };
  return null;
}
async function prescrollList(container) {
  if (!container) return;
  const step = Math.max(200, Math.floor(container.clientHeight * 0.8));
  for (let k = 0; k < 4; k++) {
    container.scrollTop = 0; await sleep(150);
    for (let y = 0; y < container.scrollHeight; y += step) { container.scrollTop = y; await sleep(120); }
    container.scrollTop = container.scrollHeight; await sleep(200);
  }
  container.scrollTop = 0; await sleep(150);
}

/* ---- B.12. Манифест + сессия ---- */
const MANIFEST_KEY = 'uaice_manifest_v1';
const SESSION_KEY = 'uaice_bulk_v1';
function chatHash(s) { const items = (s && Array.isArray(s.items)) ? s.items : []; return hashString(items.map(x => (x.role || 'unknown') + '\u0000' + (x.text || x.content || '')).join('\u0001')); }
function manifestKey(it) {
  if (!it) return '';
  if (it.href) { try { const u = new URL(it.href, location.href); u.hash = ''; return u.href; } catch (e) {} }
  if (it.dataId) return 'id:' + String(it.dataId);
  return 'title:' + normalizeNavKey(it.title || '');
}
function fingerprintSidebar() {
  try {
    const list = findList(); if (!list || !list.items) return '';
    return hashString(list.items.slice(0, 40).map(x => (x.dataId || '') + '\u0000' + normalizeNavKey(x.title || '') + '\u0000' + (x.href || '')).join('\u0001'));
  } catch (e) { return ''; }
}
let MANIFEST_MEM = null;
const loadManifest = () => { try { return JSON.parse(safeStorageGet(MANIFEST_KEY) || '{}'); } catch (e) { return {}; } };
async function getManifest() {
  if (MANIFEST_MEM) return MANIFEST_MEM;
  const base = loadManifest();
  try {
    const rows = await idbGetAll();
    if (rows && rows.length) {
      const o = {};
      rows.forEach(r => { if (r && r.id) o[r.id] = { hash: r.hash, exported_at: r.exported_at, title: r.title }; });
      MANIFEST_MEM = Object.assign({}, base, o);
      return MANIFEST_MEM;
    }
  } catch (e) {}
  MANIFEST_MEM = base; return MANIFEST_MEM;
}
let _persistTimer = null;
function saveManifest(m) { MANIFEST_MEM = m || {}; if (_persistTimer) clearTimeout(_persistTimer); _persistTimer = setTimeout(() => { flushManifest(); }, 400); }
async function flushManifest() {
  const m = MANIFEST_MEM || loadManifest();
  try { safeStorageSet(MANIFEST_KEY, JSON.stringify(m)); } catch (e) {}
  const rows = Object.keys(m).map(k => ({ id: k, hash: m[k].hash, exported_at: m[k].exported_at, title: m[k].title }));
  try { await idbPutMany(rows); } catch (e) {}
}
async function clearManifestAll() {
  MANIFEST_MEM = {};
  if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
  safeStorageRemove(MANIFEST_KEY);
  try { await idbClearMan(); } catch (e) {}
}
const loadSession = () => { try { const s = JSON.parse(safeStorageGet(SESSION_KEY) || 'null'); return (s && Array.isArray(s.items)) ? s : null; } catch (e) { return null; } };
function saveSession(s) { try { s.sidebarFp = fingerprintSidebar(); } catch (e) {} safeStorageSet(SESSION_KEY, JSON.stringify(s)); }
const clearSession = () => safeStorageRemove(SESSION_KEY);
const askOptions = () => ({
  filter: (safeStorageGet('uaice_filter') || '').toLowerCase(),
  onlyNew: safeStorageGet('uaice_onlynew') === '1',
  exportThinking: safeStorageGet('uaice_think') === '1',
  stripThinking: safeStorageGet('uaice_strip') === '1'
});

/* ---- B.13. Копирование ---- */
async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return; }
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
  (document.body || document.documentElement).appendChild(ta);
  ta.select(); document.execCommand('copy'); ta.remove();
}
async function copyCurrentMd(options) {
  await autoScroll(null);
  const scraped = scrape(options);
  if (!scraped.items.length) throw new Error('Сообщения не найдены');
  await copyTextToClipboard(toMarkdown(scraped, pageTitle()));
  return scraped.items.length;
}
async function copyContinuePrompt(options) {
  await autoScroll(null);
  const scraped = scrape(options);
  if (!scraped.items.length) throw new Error('Сообщения не найдены');
  const L = ['# Перенос диалога в другой AI', '', 'Продолжи диалог ниже. История от другого AI-ассистента:', ''];
  scraped.items.forEach(m => { L.push(m.role === 'user' ? 'USER:' : 'ASSISTANT:'); L.push(m.text || m.content); L.push(''); });
  L.push('---', 'Продолжи с этого места. Не пересказывай, отвечай как продолжение.');
  await copyTextToClipboard(L.join('\n'));
  return scraped.items.length;
}

/* ---- B.14. Экспорт текущего / массовый ---- */
async function exportCurrent(format, options, statusFn) {
  if (statusFn) statusFn('Ищу сообщения...');
  await autoScroll(statusFn);
  let scraped = scrape(options);
  if (!scraped.items.length) {
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      if (statusFn) statusFn('Жду текста... (' + (i + 1) + ')');
      scraped = scrape(options);
      if (scraped.items.length > 0) break;
    }
  }
  if (!scraped.items.length) {
    const snap = snapshotScrape();
    if (snap) { await saveInFormat(snap, pageTitle() + '-snapshot', format === 'zip' ? 'md' : format); return { count: 1, snapshot: true }; }
    debugDump();
    throw new Error('Сообщения не найдены. F12 → Console.');
  }
  await saveInFormat(scraped, pageTitle(), format);
  return { count: scraped.items.length };
}
async function activateChatItem(it) {
  if (!it) return false;
  let el = (it.el && it.el.isConnected) ? it.el : null;
  if (!el && it.title) {
    try {
      const list = findList();
      if (list && Array.isArray(list.items)) {
        const t = String(it.title).trim().toLowerCase();
        for (const x of list.items) if (x && x.el && x.el.isConnected && String(x.title || '').trim().toLowerCase() === t) { el = x.el; break; }
      }
    } catch (e) {}
  }
  const hrefBefore = location.href;
  const fpBefore = fingerprint();
  if (el) {
    try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
    await sleep(120);
    const targets = [el];
    try {
      const inner = el.querySelector('a[href],button,[role="link"],[role="button"],[role="menuitem"]'); if (inner) targets.push(inner);
      const outer = el.closest && el.closest('a[href],[role="link"]'); if (outer) targets.push(outer);
    } catch (e) {}
    for (let k = 0; k < targets.length; k++) {
      if (CANCEL) return true;
      const t = targets[k];
      try { t.click(); } catch (e) {}
      try { tryReactOnClick(t); } catch (e) {}
      try { ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(type => t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))); } catch (e) {}
      await sleep(300);
      if (location.href !== hrefBefore || fingerprint() !== fpBefore) return true;
    }
    try { const changed = await waitForContentChange(hrefBefore, fpBefore, 2500); if (changed) return true; } catch (e) {}
  }
  let url = it.href || '';
  if (!url && it.dataId) { try { url = buildChatUrl(it.dataId) || ''; } catch (e) {} }
  if (url && url.split('#')[0] !== location.href.split('#')[0]) { try { location.href = url; await sleep(1200); return true; } catch (e) {} }
  return false;
}
async function exportAllSameTab(format, options, statusFn, session) {
  let items = null, startIdx = 0;
  if (session && Array.isArray(session.items) && session.items.length) {
    items = session.items;
    startIdx = Math.max(0, Math.min(session.idx || 0, items.length - 1));
    if (statusFn) statusFn('▶ Продолжаю с ' + (startIdx + 1) + '/' + items.length);
    await ensureSidebar();
    try {
      const list = findList();
      if (list && Array.isArray(list.items)) {
        const byKey = new Map();
        list.items.forEach(x => { const k = manifestKey(x); if (k && !byKey.has(k)) byKey.set(k, x.el); });
        let re = 0;
        items.forEach(it => { const el = byKey.get(manifestKey(it)); if (el) { it.el = el; re++; } });
        const cur = fingerprintSidebar();
        if (session.sidebarFp && cur && cur !== session.sidebarFp) console.log('[UACE] Сайдбар изменился с прошлого запуска — привязано ' + re + '/' + items.length);
      }
    } catch (e) {}
  } else {
    await ensureSidebar();
    let list = findList();
    if (list && list.container) { await prescrollList(list.container); list = findList() || list; }
    if (!list) throw new Error('Список чатов не найден.');
    const deduped = [], seen = new Set();
    list.items.forEach(it => {
      const key = it.href || it.dataId || it.el;
      if (!key || seen.has(key)) return;
      if (!it.title || it.title.length < 2) return;
      seen.add(key);
      let id = it.dataId, href = it.href;
      if (!id && it.el) { const ex = extractChatTarget(it.el); if (ex.id) id = ex.id; if (!href && ex.href) href = ex.href; }
      deduped.push({ title: it.title, href: href || '', dataId: id || null, el: it.el });
    });
    if (deduped.length < 2) {
      console.log('[UACE] Сырых элементов списка: ' + (list.items ? list.items.length : 0) + ', после дедупа: ' + deduped.length);
      throw new Error('В списке меньше двух чатов.');
    }
    items = deduped;
  }
  if (options && options.filter) {
    items = items.filter(it => (it.title || '').toLowerCase().indexOf(options.filter) !== -1);
    if (!items.length) { clearSession(); throw new Error('Фильтр "' + options.filter + '" не дал совпадений.'); }
  }
  if (statusFn) statusFn('Найдено ' + items.length + ' чатов.');
  if (!session) saveSession({ mode: 'same', fmt: format, items: items.map(x => ({ title: x.title, href: x.href, dataId: x.dataId })), idx: 0 });

  const results = [], failures = [];
  const manifest = await getManifest();
  let lastChatFp = '', skipped = 0;
  for (let i = startIdx; i < items.length; i++) {
    if (CANCEL) { if (statusFn) statusFn('⏹ Остановлено. ' + progress(i, items.length, 'Продолжите кнопкой ▶')); saveSession({ mode: 'same', fmt: format, items: items.map(x => ({ title: x.title, href: x.href, dataId: x.dataId })), idx: i }); return { results, failures, total: items.length, skipped, stopped: true }; }
    const it = items[i];
    if (statusFn) statusFn(progress(i, items.length, it.title.slice(0, 30)));
    try {
      const beforeHref = location.href;
      const fpBefore = fingerprint();
      const activated = await activateChatItem(it);
      if (!activated) throw new Error('клик не сработал — используйте "Все чаты (вкладками)"');
      const ok = await waitStable(fpBefore, beforeHref);
      if (!ok) throw new Error('контент не догрузился');
      await autoScroll(statusFn);
      await sleep(500);
      const scraped = scrape(options);
      if (!scraped.items.length) throw new Error('сообщения не найдены');
      const chatFp = chatHash(scraped);
      const mkey = manifestKey(it);
      if (options && options.onlyNew) {
        if (manifest[mkey] && manifest[mkey].hash === chatFp) { skipped++; console.log('  ⏭ ' + it.title + ' (уже экспортирован)'); continue; }
      }
      if (chatFp === lastChatFp && location.href === beforeHref) throw new Error('дубликат');
      lastChatFp = chatFp;
      results.push({ title: it.title, scraped, url: location.href });
      manifest[mkey] = { hash: chatFp, exported_at: new Date().toISOString(), title: it.title };
      saveManifest(manifest);
      console.log('  ✓ ' + it.title + ' — ' + scraped.items.length);
    } catch (e) {
      console.warn('  ✗ ' + it.title + ': ' + e.message);
      failures.push({ title: it.title, url: it.href || '', error: e.message });
    }
    saveSession({ mode: 'same', fmt: format, items: items.map(x => ({ title: x.title, href: x.href, dataId: x.dataId })), idx: i + 1 });
    await sleep(300);
  }
  clearSession(); await flushManifest();
  return { results, failures, total: items.length, skipped };
}
window.addEventListener('message', event => {
  if (event.source === window) return;
  const d = event.data;
  if (!d || d.type !== MSG_REQ || !d.nonce) return;
  if (tabsExportRunning) return;
  const respond = payload => { try { event.source.postMessage(Object.assign({ type: MSG_RES, nonce: d.nonce }, payload), event.origin === 'null' ? '*' : event.origin); } catch (e) {} };
  (async () => {
    try { await autoScroll(null); await waitStable(fingerprint(), location.href); const scraped = scrape(d.options || {}); respond({ ok: scraped.items.length > 0, url: location.href, title: pageTitle() || document.title, data: scraped }); }
    catch (e) { respond({ ok: false, url: location.href, title: document.title, error: String(e && e.message || e) }); }
  })();
});
function waitForChildResult(child, nonce, timeout, options) {
  return new Promise(resolve => {
    let done = false, timer = null, pingTimer = null;
    const finish = v => { if (done) return; done = true; try { window.removeEventListener('message', listener); } catch (e) {} if (timer) clearTimeout(timer); if (pingTimer) clearInterval(pingTimer); resolve(v); };
    const listener = event => { const d = event.data; if (!d || d.type !== MSG_RES || d.nonce !== nonce) return; if (event.source !== child) return; finish(d); };
    window.addEventListener('message', listener);
    timer = setTimeout(() => finish({ ok: false, error: 'тайм-аут дочерней вкладки' }), timeout);
    const ping = () => { try { child.postMessage({ type: MSG_REQ, nonce, options: options || {} }, '*'); } catch (e) { finish({ ok: false, error: String(e && e.message || e) }); } };
    ping();
    pingTimer = setInterval(() => { if (!done) ping(); }, 1500);
  });
}
async function exportAllTabs(format, options, statusFn, session) {
  let items = null, startIdx = 0;
  if (session && Array.isArray(session.items) && session.items.length) {
    items = session.items;
    startIdx = Math.max(0, Math.min(session.idx || 0, items.length - 1));
    await ensureSidebar();
  } else {
    await ensureSidebar();
    let list = findList();
    if (list && list.container) { await prescrollList(list.container); list = findList() || list; }
    if (!list) throw new Error('Список чатов не найден.');
    const deduped = [], seen = new Set();
    list.items.forEach(it => {
      let href = it.href;
      if (!href && it.dataId) href = buildChatUrl(it.dataId);
      if (!href && it.el) { const ex = extractChatTarget(it.el); if (ex.href) href = ex.href; else if (ex.id) href = buildChatUrl(ex.id); }
      if (!href) return;
      if (seen.has(href)) return;
      if (!it.title || it.title.length < 2) return;
      seen.add(href);
      deduped.push({ title: it.title, href, dataId: it.dataId || null });
    });
    if (deduped.length < 2) throw new Error('Меньше двух чатов с URL.');
    items = deduped;
  }
  if (options && options.filter) {
    items = items.filter(it => (it.title || '').toLowerCase().indexOf(options.filter) !== -1);
    if (!items.length) { clearSession(); throw new Error('Фильтр "' + options.filter + '" не дал совпадений.'); }
  }
  if (!session) saveSession({ mode: 'tabs', fmt: format, items: items.map(x => ({ title: x.title, href: x.href, dataId: x.dataId || null })), idx: 0 });
  tabsExportRunning = true;
  const results = [], failures = [];
  const manifest = await getManifest();
  let skipped = 0;
  try {
    for (let i = startIdx; i < items.length; i++) {
      if (CANCEL) { if (statusFn) statusFn('⏹ Остановлено. ' + progress(i, items.length, 'Продолжите кнопкой ▶')); saveSession({ mode: 'tabs', fmt: format, items: items.map(x => ({ title: x.title, href: x.href, dataId: x.dataId || null })), idx: i }); return { results, failures, total: items.length, skipped, stopped: true }; }
      const it = items[i];
      if (statusFn) statusFn('Вкладки ' + progress(i, items.length, it.title.slice(0, 26)));
      const nonce = Date.now() + '-' + Math.random().toString(36).slice(2);
      let child = null;
      try {
        child = window.open(it.href, '_blank');
        if (!child) throw new Error('POPUP_BLOCKED');
        await sleep(800);
        const response = await waitForChildResult(child, nonce, CFG.TAB_CHILD_TIMEOUT, options);
        if (!response.ok) throw new Error(response.error || 'нет данных');
        if (!response.data || !Array.isArray(response.data.items) || !response.data.items.length) throw new Error('пусто');
        const chatFp = chatHash(response.data);
        const mkey = manifestKey(it);
        if (options && options.onlyNew) { if (manifest[mkey] && manifest[mkey].hash === chatFp) { skipped++; continue; } }
        results.push({ title: response.title || it.title, url: response.url || it.href, scraped: response.data });
        manifest[mkey] = { hash: chatFp, exported_at: new Date().toISOString(), title: it.title };
        saveManifest(manifest);
      } catch (e) {
        const msg = e.message === 'POPUP_BLOCKED' ? 'popup заблокирован' : String(e && e.message || e);
        failures.push({ title: it.title, url: it.href, error: msg });
        if (e.message === 'POPUP_BLOCKED' && results.length === 0 && i === 0) throw new Error('Всплывающие окна заблокированы.');
      } finally { try { if (child) child.close(); } catch (e) {} }
      saveSession({ mode: 'tabs', fmt: format, items: items.map(x => ({ title: x.title, href: x.href, dataId: x.dataId || null })), idx: i + 1 });
      await sleep(200);
    }
  } finally { tabsExportRunning = false; }
  clearSession(); await flushManifest();
  return { results, failures, total: items.length, skipped };
}
async function exportAll(format, mode, options, statusFn, session) {
  const inner = format === 'zip' ? resolveInner() : format;
  const outcome = (mode === 'tabs') ? await exportAllTabs(format, options, statusFn, session) : await exportAllSameTab(format, options, statusFn, session);
  await finalizeResults(outcome.results, outcome.failures, format, inner, statusFn);
  try { toast('✅ Готово: ' + outcome.results.length + ' чатов' + (outcome.failures.length ? ', ошибок: ' + outcome.failures.length : ''), 3000); } catch (e) {}
  return { ok: outcome.results.length, fail: outcome.failures.length, total: outcome.total, skipped: outcome.skipped || 0, stopped: !!outcome.stopped };
}

/* ---- B.15. Диагностика UACE ---- */
function debugDump() {
  try { console.groupCollapsed('%c[UACE v' + SCRIPT_VER + '] DEBUG', 'color:#4af;font-weight:bold'); } catch (e) {}
  console.log('URL:', location.href);
  const platform = getPlatform();
  console.log('Платформа:', platform ? platform.name : 'не определена');
  const s = scrape({ exportThinking: true });
  console.log('Найдено:', s.items.length, 'источник:', s.source, '| картинок:', s.images.length, '| вложений:', s.attachments.length);
  s.items.slice(0, 20).forEach((m, i) => console.log('  [' + i + '] role=' + m.role + ' len=' + (m.text || '').length + ' text="' + (m.text || '').slice(0, 120) + '..."'));
  const sc = findScrollContainer();
  console.log('Скролл-контейнер:', sc ? { clientHeight: sc.clientHeight, scrollHeight: sc.scrollHeight } : null);
  const list = findList();
  console.log('Список чатов:', list ? list.items.length + ' (via ' + list.via + ')' : 'НЕ НАЙДЕН');
  if (list) console.table(list.items.slice(0, 30).map((x, i) => ({ idx: i, title: String(x.title || '').slice(0, 50), href: String(x.href || '').slice(0, 70), dataId: x.dataId || '' })));
  const sess = loadSession();
  if (sess) console.log('Незавершённый экспорт:', sess.idx + '/' + sess.items.length, 'формат:', sess.fmt, 'режим:', sess.mode);
  try { console.groupEnd(); } catch (e) {}
  return s;
}
function exportDebugReport() {
  const platform = getPlatform();
  const report = {
    meta: { exporter: 'UACE v' + SCRIPT_VER, generated_at: new Date().toISOString(), url: location.href, userAgent: navigator.userAgent },
    environment: { hostname: location.hostname, pathname: location.pathname, platform: platform ? platform.name : null, msgSelectors: platform ? platform.msgSelectors : [], sidebarSelectors: platform ? (platform.sidebarSelectors || []) : [] },
    dom: { totalNodes: document.querySelectorAll('*').length, links: document.querySelectorAll('a[href]').length, shadowRoots: collectShadowRoots().length, chatClassEls: document.querySelectorAll('[class*="chat"],[class*="message"]').length },
    scrape: (function () { try { const s = scrape({}); return { items_count: s.items.length, source: s.source, images: s.images.length }; } catch (e) { return { error: String(e && e.message || e) }; } })(),
    list: (function () { try { const l = findList(); return l ? { via: l.via, count: l.items.length } : null; } catch (e) { return { error: String(e && e.message || e) }; } })(),
    session: loadSession()
  };
  downloadBlob(JSON.stringify(report, null, 2), 'uace-debug-' + ts() + '.json', 'application/json;charset=utf-8');
}
function debugSniffer() {
  function snap(el, depth, maxDepth) {
    if (!el || depth > maxDepth) return null;
    let r; try { r = el.getBoundingClientRect(); } catch (e) { r = { width: 0, height: 0, left: 0, top: 0 }; }
    const vis = r.width > 0 && r.height > 0;
    let t = ''; if (el.children.length === 0) { try { t = dedupeText((el.textContent || '').trim()).slice(0, 100); } catch (e) {} }
    const attrs = {};
    for (let i = 0; i < el.attributes.length; i++) { const a = el.attributes[i]; if (/^data-|^aria-|^role$|^href$|^id$|^class$/i.test(a.name)) attrs[a.name] = String(a.value).slice(0, 120); }
    const kids = [];
    if (depth < maxDepth) for (let j = 0; j < el.children.length && j < 30; j++) { const s = snap(el.children[j], depth + 1, maxDepth); if (s) kids.push(s); }
    return { tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 200), id: el.id || '', attrs, rect: [Math.round(r.width), Math.round(r.height), Math.round(r.left), Math.round(r.top)], vis, text: t, childCount: el.children.length, children: kids };
  }
  const platform = getPlatform();
  const report = { meta: { url: location.href, hostname: location.hostname, ver: SCRIPT_VER, ts: now() }, platform: platform ? platform.name : null, leftPanel: null, chatItemCandidates: [], messageCandidates: [], summary: {} };
  try { const lp = findLeftPanel(); if (lp) report.leftPanel = snap(lp, 0, 3); } catch (e) {}
  try { const l = findList(); if (l) report.chatItemCandidates = l.items.slice(0, 40).map(it => ({ title: (it.title || '').slice(0, 80), href: (it.href || '').slice(0, 120) })); } catch (e) {}
  try { const m = findMessages(); if (m) report.messageCandidates = m.items.slice(0, 40).map(el => ({ tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 120), textLen: (txt(el) || '').length, text: (txt(el) || '').slice(0, 100) })); } catch (e) {}
  report.summary = { chatItems: report.chatItemCandidates.length, messageCandidates: report.messageCandidates.length, sidebarDetected: !!report.leftPanel };
  downloadBlob(JSON.stringify(report, null, 2), 'uace-sniffer-' + sanitize(location.hostname) + '-' + ts() + '.json', 'application/json;charset=utf-8');
}

/* ==========================================================================
 *  C. PML-МОДУЛЬ: разведка DOM, наблюдение, struct r1+r2 (перенос из UPOLY)
 * ========================================================================== */

const CAP = { groups: 12, landmarks: 20, containers: 5, mountPoints: 8, persistentPaths: 8, nodes: 5000 };
const RECON_BUDGET_MS = 150;
const OBS_WINDOW_MS = 60000;
let obsResult = null;
let lastStruct = null, lastElapsed = 0;
const pmlJournal = [];
let pmlMetrics = { reconRuns: 0, obsRuns: 0, structCopied: false };
const pmlHotkeyMap = new Map();
const pmlHotkeyList = [];

let pmlState = Object.assign(
  { theme: 'system', pmlFs: 14, motion: true, pmlCollapsed: false },
  pmlStorage.load()
);

function pmlResolvePalette() {
  /* v28.2.1: PML-палитра следует за темой UACE (uaice_theme) — единая точка правды.
     Раньше PML всегда жил в 'system' и игнорировал выбор «Тепло/Свет/Тьма».
     «Авто»: «Тёплый вечер» (вкл по умолчанию) и часы 20:00–06:59 → warm,
     иначе системная схема dark/light. */
  const t = safeStorageGet('uaice_theme') || 'auto';
  if (t === 'light' || t === 'dark' || t === 'warm') return t;
  const dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  const evening = safeStorageGet('uaice_evening') !== '0';
  const h = new Date().getHours();
  if (evening && (h >= 20 || h < 7)) return 'warm';
  return dark ? 'dark' : 'light';
}
let pmlCurPalette = 'dark';
let pmlAccentInfo = { hex: '#4da3ff', tx: '#0e0f12', ratio: 0, src: 'default' };
function pmlRefreshAccent() {
  const bg = parseColor(PML_PALETTES[pmlCurPalette].bg);
  let sys = null;
  try {
    const probe = document.createElement('span');
    probe.style.color = 'AccentColor'; probe.style.display = 'none';
    (document.body || document.documentElement).appendChild(probe);
    sys = parseColor(getComputedStyle(probe).color);
    probe.remove();
  } catch (e) { sys = null; }
  const fit = sys && bg ? fitAccent(bg, sys) : null;
  pmlAccentInfo = fit ? { hex: fit.hex, tx: fit.txHex, ratio: fit.ratio, src: 'system' }
    : { hex: pmlCurPalette === 'light' ? '#0b62c4' : '#4da3ff', tx: pmlCurPalette === 'light' ? '#ffffff' : '#0e0f12', ratio: 0, src: 'default' };
  if (pmlAccentInfo.ratio === 0 && bg) pmlAccentInfo.ratio = round2(pmlContrast(bg, hexToRgb(pmlAccentInfo.hex)));
}

function pmlPersist() {
  pmlStorage.save({ theme: pmlState.theme, fs: pmlState.pmlFs, motion: pmlState.motion, collapsed: pmlState.pmlCollapsed });
}
function pmlLog(level, msg) {
  pmlJournal.unshift({ t: nowMs(), level, msg: String(msg).slice(0, 200) });
  if (pmlJournal.length > 200) pmlJournal.length = 200;
  if (ui && ui.pmlLogList) renderPmlLog();
}
function renderPmlLog() {
  if (!ui || !ui.pmlLogList) return;
  setHTML(ui.pmlLogList, pmlJournal.map(j =>
    `<li><i data-l="${j.level}"></i><span><span class="pml-dim">+${(j.t / 1000).toFixed(1)}с</span> ${pmlEscape(j.msg)}</span></li>`).join(''));
}
const pmlEscape = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pmlSetStatus(msg) {
  if (!ui || !ui.pmlStatus) return;
  ui.pmlStatus.textContent = String(msg || '').slice(0, 80);
  clearTimeout(pmlStatusTimer);
  if (msg) pmlStatusTimer = setTimeout(() => { if (ui && ui.pmlStatus) ui.pmlStatus.textContent = ''; }, 4000);
}
let pmlStatusTimer = 0;

/* --- Разведка --- */
function pmlPickPrimary(all, vh) {
  const cands = [];
  for (const el of all) {
    if (el.scrollHeight <= el.clientHeight + 4) continue;
    let ov = 'visible'; try { ov = getComputedStyle(el).overflowY; } catch (e) {}
    if (ov !== 'auto' && ov !== 'scroll' && ov !== 'overlay') continue;
    let main = false; try { main = !!closestUp(el, 'main,[role="main"]'); } catch (e) {}
    cands.push({ el, path: pathOf(el), clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, visibleShare: el.clientHeight / vh, insideMain: main });
  }
  cands.sort((a, b) => b.visibleShare - a.visibleShare || b.scrollHeight - a.scrollHeight || b.clientHeight - a.clientHeight || (b.insideMain - a.insideMain) || (a.path < b.path ? -1 : 1));
  return { primary: cands[0] || null, containers: cands.slice(0, CAP.containers).map(c => ({ path: c.path, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight })), truncated: cands.length > CAP.containers };
}
function pmlFindGroups(all, primaryPath, deadline) {
  const out = [];
  for (const parent of all) {
    if (performance.now() > deadline) { out.budgetHit = true; break; }
    if (parent.childElementCount < 3) continue;
    const kids = [...parent.children];
    const bySig = new Map();
    for (const k of kids) { const h = sigHash(k); if (!bySig.has(h)) bySig.set(h, []); bySig.get(h).push(k); }
    let best = null;
    for (const [h, arr] of bySig) if (!best || arr.length > best.arr.length) best = { h, arr };
    if (!best || best.arr.length < 3) continue;
    const u = best.arr.length / kids.length;
    if (u < 0.6) continue;
    let pr; try { pr = parent.getBoundingClientRect(); } catch (e) { continue; }
    let sumH = 0, ok = true;
    for (const k of best.arr) { const r = k.getBoundingClientRect(); if (r.height < 32) { ok = false; break; } sumH += r.height; }
    if (!ok || sumH < 0.4 * pr.height) continue;
    out.push({ sigHash: best.h, count: best.arr.length, depth: subtreeDepth(best.arr[0], 6), uniformity: round2(u), samplePath: pathOf(best.arr[0]), parentPath: pathOf(parent), inPrimary: !!primaryPath && (pathOf(best.arr[0]) === primaryPath || pathOf(best.arr[0]).startsWith(primaryPath + '>')), el: best.arr[0] });
  }
  out.sort((a, b) => b.count * b.uniformity - a.count * a.uniformity || (a.parentPath < b.parentPath ? -1 : 1));
  return out;
}
function pmlFindMounts(all, vh, deadline) {
  const out = [];
  for (const el of all) {
    if (performance.now() > deadline) { out.budgetHit = true; break; }
    if (el.closest && el.closest('#' + UI_ID)) continue;
    if (el.childElementCount < 1) continue;
    let cs; try { cs = getComputedStyle(el); } catch (e) { continue; }
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (!(r.top < 0.15 * vh && r.height >= 32 && r.height <= 96 && r.width >= 120)) continue;
    out.push({ path: pathOf(el), mode: cs.position, h: Math.round(r.height), top: r.top, x: r.x });
  }
  out.sort((a, b) => a.top - b.top || a.x - b.x);
  return out;
}
function pmlFindLandmarks(all) {
  const out = [];
  const tags = { MAIN: 1, NAV: 1, HEADER: 1, FOOTER: 1, ASIDE: 1, SECTION: 1 };
  for (const el of all) {
    const role = el.getAttribute('role');
    if (!tags[el.tagName] && !role) continue;
    out.push({ tag: el.tagName.toLowerCase(), role: role || null, path: pathOf(el) });
  }
  return out;
}
function pmlIsOwnNode(el) {
  if (el.closest && el.closest('#' + UI_ID)) return true;
  if (el.closest && el.closest('#' + UI_ID + '-host')) return true;
  if (el.closest && el.closest('#pml-tabs-host')) return true;
  /* v28.2: UI живёт в Shadow DOM — учитываем хост через getRootNode */
  try {
    const rn = el.getRootNode && el.getRootNode();
    if (rn && rn.host && rn.host.id === UI_ID + '-host') return true;
    if (rn && rn.host && rn.host.id === UI_ID) return true;
  } catch (e) {}
  return false;
}
/* v28.2: pmlCollectDeep — полностью итеративный (стек) с квантом времени 15 мс;
   устранены рекурсия (stack overflow на тяжёлых SPA) и блокировка основного потока */
const PML_COLLECT_TIME_CAP_MS = 15;
function pmlCollectDeep() {
  const out = []; let total = 0;
  const tStart = performance.now();
  const stack = [document.body];
  const seenShadows = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || cur.nodeType !== 1) continue;
    if (SKIP_TAGS.has(cur.tagName) || pmlIsOwnNode(cur)) continue;
    total++;
    if (out.length < CAP.nodes) out.push(cur);
    try {
      const sr = cur.shadowRoot;
      if (sr && sr.firstElementChild && !seenShadows.has(sr) && (!sr.mode || sr.mode === 'open') && !pmlIsOwnNode(cur)) {
        seenShadows.add(sr);
        for (let c = sr.firstElementChild; c; c = c.nextElementSibling) stack.push(c);
      }
    } catch (e) {}
    for (let c = cur.firstElementChild; c; c = c.nextElementSibling) stack.push(c);
    if ((out.length >= CAP.nodes && total > CAP.nodes + 2048) || (performance.now() - tStart > PML_COLLECT_TIME_CAP_MS)) break;
  }
  out.total = total;
  return out;
}
function pmlScanSync() {
  const t0 = performance.now();
  const deep = pmlCollectDeep();
  const all = deep.slice(0, CAP.nodes);
  const vh = innerHeight || 800;
  let blockCount = 0, maxDepth = 0;
  (function w(n, d) { if (!n || n.nodeType !== 1) return; blockCount++; maxDepth = Math.max(maxDepth, d); for (let c = n.firstElementChild; c; c = c.nextElementSibling) w(c, d + 1); })(document.body, 1);
  const sc = pmlPickPrimary(all, vh);
  const deadline = t0 + RECON_BUDGET_MS;
  const groups = pmlFindGroups(all, sc.primary ? sc.primary.path : null, deadline);
  const mounts = pmlFindMounts(all, vh, deadline);
  const landmarks = pmlFindLandmarks(all);
  const budgetHit = !!(groups.budgetHit || mounts.budgetHit);
  return { all, vh, blockCount, maxDepth, sc, groups, mounts, landmarks, truncatedDom: deep.total > CAP.nodes || budgetHit, elapsed: Math.round(performance.now() - t0) };
}
function pmlScoreGroup(g) {
  const u = Math.round(100 * clamp((g.uniformity - 0.6) / 0.4, 0, 1));
  const c = Math.round(100 * Math.min(1, g.count / 40));
  const p = g.inPrimary ? 100 : 0;
  const s = Math.round(100 * clamp(1 - g.ratio, 0, 1));
  const l = g.hasLandmark ? 100 : 0;
  return { u, c, p, s, l, confidence: Math.round(0.35 * u + 0.25 * c + 0.20 * p + 0.10 * s + 0.10 * l) };
}
function pmlResolveRecon(scored) {
  const ok = scored.filter(x => x.inPrimary && x.count >= 6 && x.depth >= 2).sort((a, b) => b.confidence - a.confidence || (a.samplePath < b.samplePath ? -1 : 1));
  if (!ok.length || ok[0].confidence < 75) return { status: 'no-data' };
  const second = ok[1];
  if (second && ok[0].confidence - second.confidence < 15 && second.confidence >= 50) return { status: 'no-data' };
  const t = ok[0];
  return { status: 'found', candidate: { path: t.samplePath, sigHash: t.sigHash, inPrimary: true, confidence: t.confidence, basis: { u: t.u, c: t.c, p: t.p, s: t.s, l: t.l } } };
}
function pmlBuildStruct() {
  const s = pmlScanSync();
  const primary = s.sc.primary;
  const raw = s.groups.slice(0, CAP.groups).map(g => {
    const g2 = { sigHash: g.sigHash, count: g.count, depth: g.depth, uniformity: g.uniformity, samplePath: g.samplePath, inPrimary: g.inPrimary };
    g2.ratio = primary ? round2(primary.clientHeight / primary.scrollHeight) : 1;
    try { g2.hasLandmark = !!closestUp(g.el, 'main,[role="main"],[role="feed"],[role="log"]'); } catch (e) { g2.hasLandmark = false; }
    return Object.assign(g2, pmlScoreGroup(g2));
  });
  const struct = {
    structVersion: 'r1',
    meta: { ts: nowMs(), viewport: { w: innerWidth, h: innerHeight }, dpr: round2(devicePixelRatio || 1), urlHash: fnv1a(SALT + 'URL>' + location.href) },
    dom: { maxDepth: s.maxDepth, blockCount: s.blockCount, landmarks: s.landmarks.slice(0, CAP.landmarks), groups: raw.map(g => ({ sigHash: g.sigHash, count: g.count, depth: g.depth, uniformity: g.uniformity, samplePath: g.samplePath, inPrimary: g.inPrimary })), truncated: s.truncatedDom || s.groups.length > CAP.groups || s.landmarks.length > CAP.landmarks },
    scroll: { primary: primary ? { path: primary.path, scrollHeight: primary.scrollHeight, clientHeight: primary.clientHeight, ratio: round2(primary.clientHeight / primary.scrollHeight) } : 'no-scroll-container', containers: s.sc.containers, truncated: s.sc.truncated },
    mut: obsResult ? obsResult.mut : { window: 60, adds: 0, removes: 0, recycles: 0, medianIntervalMs: null, streamCandidate: null },
    anchors: { mountPoints: s.mounts.slice(0, CAP.mountPoints).map(m => ({ path: m.path, mode: m.mode, h: m.h })), persistentPaths: obsResult ? obsResult.persistent : [], stability: obsResult ? obsResult.stability : 0, truncated: s.mounts.length > CAP.mountPoints || (obsResult ? obsResult.persistentTruncated : false) }
  };
  struct.recon = pmlResolveRecon(raw);
  lastElapsed = s.elapsed;
  return struct;
}

/* --- Наблюдение 60 с --- */
let obsSession = null;
function pmlStartObservation() {
  if (obsSession) return;
  if (!document.body) { pmlLog('err', 'нет document.body'); pmlSetStatus('наблюдение: нет body'); return; }
  pmlMetrics.obsRuns++;
  const s = { adds: 0, removes: 0, recycles: 0, sigBudget: 500, aborted: false, byPath: new Map(), addIntervals: new Map(), lastAdd: new Map(), removedSigs: new Map(), snapshots: [], navEvents: 0, pausedMs: 0, hiddenAt: 0 };
  s.endsAt = Date.now() + OBS_WINDOW_MS;
  obsSession = s;
  pmlSetStatus('Наблюдение: осталось 60 с');
  pmlLog('info', 'окно наблюдения 60 с запущено (Esc — стоп)');
  s.observer = new MutationObserver(muts => {
    /* v28.2: защита наблюдателя — исключения не должны оставлять подписку висеть;
       батч ограничен, чтобы всплеск мутаций не фризил поток */
    const MUTOBS_BATCH_CAP = 500;
    try {
      const list = muts.length > MUTOBS_BATCH_CAP ? muts.slice(0, MUTOBS_BATCH_CAP) : muts;
      for (const m of list) {
        const p = m.target && m.target.nodeType === 1 ? prefixPath(m.target, 4) : 'body';
        let rec = s.byPath.get(p); if (!rec) { rec = { adds: 0, removes: 0, net: 0 }; s.byPath.set(p, rec); }
        for (const n of m.addedNodes) if (n.nodeType === 1) {
          try { if (n.shadowRoot && !pmlIsOwnNode(n)) s.observeRoot(n.shadowRoot); } catch (e) {}
          s.adds++; rec.adds++; rec.net++;
        const t = performance.now(), last = s.lastAdd.get(p);
        if (last != null) { const a = s.addIntervals.get(p) || []; a.push(Math.round(t - last)); s.addIntervals.set(p, a); }
        s.lastAdd.set(p, t);
        if (s.sigBudget > 0) { s.sigBudget--; const h = sigHash(n), set = s.removedSigs.get(p); if (set && set.has(h)) { s.recycles++; set.delete(h); } }
      }
      for (const n of m.removedNodes) if (n.nodeType === 1) {
        s.removes++; rec.removes--; rec.net--;
        if (s.sigBudget > 0) { const set = s.removedSigs.get(p) || s.removedSigs.set(p, new Set()).get(p); if (set.size < 50) set.add(sigHash(n)); }
      }
      }
    } catch (e) {}
  });
  s.observer.observe(document.body, { childList: true, subtree: true });
  s.shadowRoots = [];
  const observeRoot = r => { if (!r || s.shadowRoots.length >= 8) return; try { s.observer.observe(r, { childList: true, subtree: true }); s.shadowRoots.push(r); } catch (e) {} };
  s.observeRoot = observeRoot;
  for (const el of pmlCollectDeep()) { if (s.shadowRoots.length >= 8) break; try { if (el.shadowRoot && !pmlIsOwnNode(el)) observeRoot(el.shadowRoot); } catch (e) {} }
  const snap = () => { const set = new Set(); (function w(n, d) { if (!n || n.nodeType !== 1 || d > 4 || set.size >= 300) return; if (!pmlIsOwnNode(n)) { set.add(pathOf(n)); for (let c = n.firstElementChild; c; c = c.nextElementSibling) w(c, d + 1); } })(document.body, 1); s.snapshots.push(set); };
  s.snap = snap; snap();
  s.snapTimer = setInterval(() => { if (!document.hidden && s.snapshots.length < 30) snap(); }, 10000);
  s.navHandler = () => { s.navEvents++; snap(); };
  /* v28.2: NavGuard — одноразовая безопасная обёртка history (без повторного патчинга и утечек при сбоях) */
  NavGuard.subscribe(s.navHandler);
  addEventListener('popstate', s.navHandler);
  s.visHandler = () => { if (document.hidden) s.hiddenAt = Date.now(); else if (s.hiddenAt) { s.pausedMs += Date.now() - s.hiddenAt; s.hiddenAt = 0; } };
  document.addEventListener('visibilitychange', s.visHandler);
  s.tick = setInterval(() => {
    const left = Math.max(0, Math.ceil((s.endsAt + s.pausedMs - Date.now()) / 1000));
    pmlSetStatus(`Наблюдение: осталось ${left} с`);
    if (left <= 0) pmlFinishObservation(false);
  }, 1000);
}
function pmlFinishObservation(aborted) {
  const s = obsSession; if (!s) return;
  obsSession = null;
  clearInterval(s.tick); clearInterval(s.snapTimer);
  s.observer.disconnect();
  document.removeEventListener('visibilitychange', s.visHandler);
  removeEventListener('popstate', s.navHandler);
  NavGuard.unsubscribe(s.navHandler); /* v28.2: отписка вместо восстановления history */
  const top = [...s.byPath.entries()].sort((a, b) => b[1].adds - a[1].adds)[0];
  const med = top ? median(s.addIntervals.get(top[0]) || []) : null;
  const stream = top ? (top[1].adds >= 3 && top[1].net > 0 && med !== null && med >= 50 && med <= 5000) : false;
  obsResult = { mut: { window: 60, adds: s.adds, removes: s.removes, recycles: s.recycles, medianIntervalMs: med, streamCandidate: stream }, persistent: [], stability: 0, persistentTruncated: false };
  if (s.snapshots.length) {
    const total = s.snapshots.length, cnt = new Map();
    for (const set of s.snapshots) for (const p of set) cnt.set(p, (cnt.get(p) || 0) + 1);
    const per = [...cnt.entries()].filter(x => x[1] / total >= 0.9).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    obsResult.persistent = per.slice(0, CAP.persistentPaths).map(x => x[0]);
    obsResult.persistentTruncated = per.length > CAP.persistentPaths;
    obsResult.stability = round2(obsResult.persistent.length / Math.max(1, Math.min(s.snapshots[0].size, 20)));
  }
  pmlLog(aborted ? 'warn' : 'ok', aborted ? 'наблюдение прервано' : `наблюдение завершено: adds ${s.adds}, recycles ${s.recycles}, поток ${stream ? 'да' : 'нет'}`);
  pmlSetStatus(aborted ? 'Наблюдение прервано' : 'Наблюдение завершено');
  pmlRunRecon();
}

/* --- Действия PML --- */
function pmlRunRecon() {
  pmlMetrics.reconRuns++;
  lastStruct = pmlBuildStruct();
  if (ui) {
    renderPmlRecon(lastStruct);
    renderPmlPassport();
  }
  const r = lastStruct.recon;
  pmlLog('ok', `разведка ${lastElapsed} мс: групп ${lastStruct.dom.groups.length}, резерв: ${r.status === 'found' ? 'found ' + r.candidate.confidence : r.status}`);
  pmlSetStatus(`Разведка ${lastElapsed} мс · резерв ${r.status}`);
}
function pmlCopyStruct() {
  pmlMetrics.structCopied = true;
  const text = JSON.stringify(lastStruct || pmlBuildStruct(), null, 1);
  pmlCopyText(text, 'struct скопирован (JSON)');
}
function pmlCopyJournal() {
  pmlCopyText(pmlJournal.map(j => `[+${(j.t / 1000).toFixed(1)}с][${j.level}] ${j.msg}`).join('\n'), 'журнал скопирован (' + pmlJournal.length + ')');
}
function pmlStopAll() {
  if (obsSession) pmlFinishObservation(true);
  else { pmlSetStatus('стоп: нечего прерывать'); pmlLog('info', 'стоп: активного окна нет'); }
}
function pmlCopyText(text, okMsg) {
  const done = () => { pmlSetStatus(okMsg); pmlLog('ok', okMsg); };
  const fail = () => { pmlSetStatus('копирование недоступно'); pmlLog('warn', 'буфер обмена недоступен'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
  else fallback();
  function fallback() {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      ok ? done() : fail();
    } catch (e) { fail(); }
  }
}
function pmlGetPassport() {
  return [
    `Ядро: UACE v${UACE_VER} · PML v${UPOLY_VER}`,
    `Тема UACE: ${(safeStorageGet('uaice_theme') || 'auto')} → палитра ${pmlCurPalette}`,
    `Акцент: ${pmlAccentInfo.hex} (${pmlAccentInfo.src}) · ${pmlAccentInfo.ratio}:1`,
    `Движение: ${pmlState.motion ? 'вкл' : 'выкл'} · кегль ${pmlState.pmlFs}px`,
    `Разведка: прогонов ${pmlMetrics.reconRuns}, наблюдений ${pmlMetrics.obsRuns}, struct ${pmlMetrics.structCopied ? 'копировался' : 'нет'}`,
    `Uptime: ${Math.round(nowMs() / 1000)} с · журнал: ${pmlJournal.length}`,
    `Хоткеи PML: ${pmlHotkeyList.map(h => 'Alt+Shift+' + h.key).join(' · ')}`,
    `Соль FNV-1a: ${SALT} · PML-STRUCT r1+r2`
  ].join('\n');
}

/* ==========================================================================
 *  D. UI: UACE-панель + UPOLY-badge + top-right + PML-секция
 *  ЗАМЕНЕНО ИЗ UPOLY:
 *    – позиция панели: было bottom-right → стало top-right
 *    – badge: было ⬇ 48×48 1px line → стало UP 44×44 2px ok-color
 *  ДОБАВЛЕНО: PML-секция внутри панели (разведка/наблюдение/struct/журнал)
 * ========================================================================== */

const HF_PALETTES = {
  light: { bg:'#fbfbfd', surface:'#ffffff', tx:'#1d1d1f', tx2:'#55555c', line:'#d9d9e0', accent:'#0b66c3', accentTx:'#ffffff', ok:'#1d7a3c', warn:'#a04b00', btn:'#ffffff', btnHover:'#f0f0f4', btnTx:'#1d1d1f', ring:'rgba(11,102,195,.55)' },
  dark:  { bg:'#1d1d24', surface:'#26262e', tx:'#f2f2f6', tx2:'#b9b9c3', line:'#43434e', accent:'#74b3ff', accentTx:'#10131a', ok:'#6fd08c', warn:'#ffb066', btn:'#2d2d37', btnHover:'#35353f', btnTx:'#f2f2f6', ring:'rgba(116,179,255,.6)' },
  warm:  { bg:'#f6efe2', surface:'#fdf8ee', tx:'#3a3226', tx2:'#6b5f4c', line:'#d8ccb4', accent:'#8a5a00', accentTx:'#ffffff', ok:'#4a6b1f', warn:'#a04b00', btn:'#fdf8ee', btnHover:'#f1e8d6', btnTx:'#3a3226', ring:'rgba(138,90,0,.5)' }
};
function hfTheme() {
  const t = safeStorageGet('uaice_theme') || 'auto';
  if (t === 'light' || t === 'dark' || t === 'warm') return t;
  const evening = safeStorageGet('uaice_evening') !== '0';
  const h = new Date().getHours();
  if (evening && (h >= 20 || h < 7)) return 'warm';
  try { if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'; } catch (e) {}
  return 'light';
}
function hfMotionOn() {
  if (safeStorageGet('uaice_motion') === '0') return false;
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
  return true;
}
function hfLum(hex) {
  const c = hex.replace('#', '');
  const v = [0, 2, 4].map(i => { let x = parseInt(c.slice(i, i + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function hfContrast(fg, bg) { const l1 = hfLum(fg), l2 = hfLum(bg); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

/* === ИНЪЕКЦИЯ СТИЛЕЙ: v28.2 — стили живут внутри Shadow Root (:host-изоляция) === */
function injectModernStyles(targetRoot) {
  if ((targetRoot || document).getElementById(UI_ID + '-styles')) return;
  const css = `
:host{all:initial;}
:host{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;font:14px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}
#${UI_ID}{pointer-events:auto;position:fixed;right:16px;top:16px;z-index:2147483647;font:14px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--hf-tx);}
#${UI_ID} .box{display:flex;flex-direction:column;gap:8px;background:var(--hf-bg);padding:12px;border-radius:14px;border:1px solid var(--hf-line);box-shadow:0 8px 30px rgba(0,0,0,.22);min-width:288px;max-width:360px;max-height:88vh;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;}
#${UI_ID} button{border:1px solid var(--hf-line);border-radius:9px;padding:9px 12px;min-height:44px;cursor:pointer;font:inherit;font-weight:400;color:var(--hf-btn-tx);background:var(--hf-btn);text-align:left;box-sizing:border-box;}
#${UI_ID} button:hover:not(:disabled){background:var(--hf-btn-hover);}
#${UI_ID} button:disabled{opacity:.45;cursor:not-allowed;}
#${UI_ID} button:focus-visible, #${UI_ID} select:focus-visible, #${UI_ID} input:focus-visible, #${UI_ID} summary:focus-visible{outline:2px solid var(--hf-accent);outline-offset:2px;}
#${UI_ID} select{min-height:44px;background:var(--hf-surface);color:var(--hf-tx);border:1px solid var(--hf-line);border-radius:9px;padding:4px 8px;font:inherit;flex:1;}
#${UI_ID} .status{font-size:14px;line-height:1.6;color:var(--hf-tx);max-width:65ch;white-space:pre-wrap;text-align:left;overflow-wrap:anywhere;}
#${UI_ID} .mini{font-size:12px;line-height:1.5;color:var(--hf-tx2);}
#${UI_ID} .grip{display:flex;align-items:center;justify-content:space-between;gap:6px;cursor:move;user-select:none;-webkit-user-select:none;font-size:14px;font-weight:600;line-height:1.3;padding:1px 2px;}
#${UI_ID} .grip .title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#${UI_ID} .grip button{flex:0 0 auto;min-height:44px;min-width:44px;padding:4px 10px;text-align:center;font-size:14px;}
#${UI_ID} .row2{display:flex;gap:8px;align-items:stretch;}
#${UI_ID} .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
#${UI_ID} .stop{grid-column:1 / -1;text-align:center;border-color:var(--hf-warn);color:var(--hf-warn);}
#${UI_ID} details{border:1px solid var(--hf-line);border-radius:9px;background:var(--hf-surface);}
#${UI_ID} summary{list-style:none;cursor:pointer;padding:9px 12px;min-height:44px;display:flex;align-items:center;font-weight:400;color:var(--hf-btn-tx);}
#${UI_ID} summary::-webkit-details-marker{display:none;}
#${UI_ID} summary::before{content:'▸ ';color:var(--hf-tx2);}
#${UI_ID} details[open] summary::before{content:'▾ ';}
#${UI_ID} details .inner{display:flex;flex-direction:column;gap:8px;padding:0 10px 10px;}
#${UI_ID} .settings{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--hf-line);padding-top:10px;}
#${UI_ID} .settings input[type="text"]{background:var(--hf-surface);color:var(--hf-tx);border:1px solid var(--hf-line);border-radius:9px;padding:8px 10px;font:inherit;box-sizing:border-box;width:100%;min-height:44px;}
#${UI_ID} .settings label{display:flex;gap:8px;align-items:flex-start;font-size:14px;color:var(--hf-tx);cursor:pointer;line-height:1.5;}
#${UI_ID} .settings input[type="checkbox"]{width:20px;height:20px;margin:2px 0 0;accent-color:var(--hf-accent);flex:0 0 auto;}
#${UI_ID} .settings .row{display:flex;gap:8px;}
#${UI_ID} .settings .row button{flex:1;font-size:13px;}
#${UI_ID} .cap{font-size:12px;color:var(--hf-tx2);line-height:1.5;}
#${UI_ID} .comfort{display:flex;flex-direction:column;gap:8px;}
#${UI_ID} .comfort .crow{display:flex;gap:8px;align-items:center;justify-content:space-between;}
#${UI_ID} .comfort .crow .cl{font-size:13px;color:var(--hf-tx);}
#${UI_ID} .comfort .cbtns{display:flex;gap:4px;flex-wrap:wrap;}
#${UI_ID} .comfort .cbtns button{min-height:36px;min-width:36px;padding:4px 9px;font-size:13px;text-align:center;flex:0 0 auto;}
#${UI_ID} .comfort .cbtns button[aria-pressed="true"]{border-color:var(--hf-accent);box-shadow:inset 0 0 0 1px var(--hf-accent);color:var(--hf-accent);font-weight:600;}
#${UI_ID} .passport{display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.55;}
#${UI_ID} .passport .prow{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed var(--hf-line);padding-bottom:4px;}
#${UI_ID} .passport .pk{color:var(--hf-tx2);}
#${UI_ID} .passport .pv{font-weight:600;text-align:right;overflow-wrap:anywhere;}
#${UI_ID} .passport .pv.good{color:var(--hf-ok);}
#${UI_ID} .passport a{color:var(--hf-accent);text-decoration:underline;overflow-wrap:anywhere;}

/* === badge: UPOLY-стиль (замена) === */
#${UI_ID} .badge{
  display:none;padding:0;
  width:44px;height:44px;                 /* было 48×48 */
  border-radius:50%;
  background:var(--hf-surface);
  color:var(--hf-tx);
  font-size:16px;line-height:1;             /* было 19px */
  font-weight:700;                           /* было наследуемое */
  cursor:pointer;
  border:2px solid var(--hf-ok);             /* было 1px solid var(--hf-line) */
  box-shadow:0 6px 24px rgba(0,0,0,.35);
  text-align:center;
}
#${UI_ID} .badge:hover{filter:brightness(1.05);}
#${UI_ID} .badge.busy{border-color:var(--hf-warn);color:var(--hf-warn);}

/* === PML-секция внутри UACE-панели === */
#${UI_ID} .pml-tabs{display:flex;border:1px solid var(--hf-line);border-radius:9px;overflow:hidden;}
#${UI_ID} .pml-tabs button{flex:1;min-height:40px;border:0;border-radius:0;text-align:center;background:var(--hf-btn);color:var(--hf-tx2);}
#${UI_ID} .pml-tabs button[aria-selected="true"]{color:var(--hf-tx);font-weight:600;box-shadow:inset 0 -2px 0 var(--hf-accent);}
#${UI_ID} .pml-pane{padding:6px 0 0;display:flex;flex-direction:column;gap:6px;}
#${UI_ID} .pml-sec{font-weight:600;color:var(--hf-accent);font-size:13px;margin:2px 0 4px;}
#${UI_ID} .pml-kv{margin:0;font-size:12px;line-height:1.5;color:var(--hf-tx);white-space:pre-wrap;word-break:break-word;}
#${UI_ID} .pml-dim{color:var(--hf-tx2);}
#${UI_ID} .pml-log{list-style:none;margin:0;padding:0;max-height:180px;overflow-y:auto;}
#${UI_ID} .pml-log li{display:flex;gap:6px;padding:3px 0;border-bottom:1px dashed var(--hf-line);font-size:12px;}
#${UI_ID} .pml-log i{flex:0 0 auto;width:8px;height:8px;border-radius:50%;margin-top:6px;background:var(--hf-tx2);}
#${UI_ID} .pml-log i[data-l=ok]{background:var(--hf-ok);}
#${UI_ID} .pml-log i[data-l=warn]{background:var(--hf-warn);}
#${UI_ID} .pml-log i[data-l=err]{background:var(--hf-warn);}
#${UI_ID} .pml-status{display:block;min-height:1.4em;color:var(--hf-tx2);font-size:12px;}

#${UI_ID}.hf-motion-off *{transition:none !important;animation:none !important;}
@media (prefers-reduced-motion: reduce){#${UI_ID} *{transition:none !important;animation:none !important;}}
`;
  const s = document.createElement('style');
  s.id = UI_ID + '-styles';
  s.textContent = css;
  (targetRoot || document.head || document.documentElement).appendChild(s);
}

/* === тост (тот же, что в UACE) === */
function toast(msg, ms) {
  try {
    let t = document.getElementById(UI_ID + '-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = UI_ID + '-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#1d1d24;color:#f2f2f6;padding:10px 16px;border-radius:10px;border:1px solid #43434e;font:14px/1.5 system-ui,sans-serif;z-index:2147483647;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none;max-width:70vw;';
      (document.body || document.documentElement).appendChild(t);
    }
    t.textContent = String(msg || '');
    t.style.opacity = '1';
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { try { t.style.opacity = '0'; } catch (e) {} }, ms || 2600);
  } catch (e) {}
}

/* === UI-сборка: v28.2 — панель монтируется в Shadow DOM (CSS-изоляция от сайта) === */
let ui = null;
let shadowHost = null, shadowRootRef = null;

function renderPmlRecon(struct) {
  if (!ui || !ui.pmlReconOut) return;
  const d = struct && struct.dom, s = struct && struct.scroll, m = struct && struct.mut, a = struct && struct.anchors, r = struct && struct.recon;
  const sec = [
    ['Каркас', d ? `блоков: ${d.blockCount}\nглубина: ${d.maxDepth}\nгрупп: ${d.groups.length}${d.truncated ? ' (усечено)' : ''}\n` + d.groups.slice(0, 3).map(g => `${g.sigHash} ×${g.count} u=${g.uniformity}${g.inPrimary ? ' ✓скролл' : ''}`).join('\n') : null],
    ['Скролл', s && s.primary && s.primary.path ? `primary: ${s.primary.path}\nratio: ${s.primary.ratio}\nконтейнеров: ${s.containers.length}${s.truncated ? ' (усечено)' : ''}` : null],
    ['Мутации', m ? `окно: ${m.window}с\nadds: ${m.adds} removes: ${m.removes}\nrecycles: ${m.recycles}\nмедиана: ${m.medianIntervalMs === null ? '—' : m.medianIntervalMs + ' мс'}\nпоток: ${m.streamCandidate === null ? 'окно не набрано' : m.streamCandidate ? 'кандидат' : 'нет'}` : null],
    ['Якоря', a ? `mount: ${a.mountPoints.length}\nстойких: ${a.persistentPaths.length}\nstability: ${a.stability}` : null],
    ['Резерв', r ? (r.status === 'found' ? `найдено: ${r.candidate.path}\nconfidence: ${r.candidate.confidence}` : 'нет данных (консервативный отказ)') : null]
  ];
  setHTML(ui.pmlReconOut, sec.map(([t, body]) => `<div class="pml-sec">${t}</div><div class="pml-kv">${body ? pmlEscape(body) : '<span class="pml-dim">нет данных</span>'}</div>`).join(''));
}
function renderPmlPassport() {
  if (!ui || !ui.pmlPassport) return;
  const lines = pmlGetPassport().split('\n');
  setHTML(ui.pmlPassport, lines.map(l => {
    const idx = l.indexOf(': ');
    if (idx === -1) return `<div class="pml-kv">${pmlEscape(l)}</div>`;
    return `<div class="pml-kv"><span class="pml-dim">${pmlEscape(l.slice(0, idx))}:</span> ${pmlEscape(l.slice(idx + 2))}</div>`;
  }).join(''));
}

function buildUI() {
  if (shadowHost && shadowHost.isConnected) return;
  if (document.getElementById(UI_ID + '-host')) return;
  if (!document.body) return;
  loadSettingsMirror(); /* v28.2: восстановление настроек из JSON-зеркала */
  shadowHost = document.createElement('div');
  shadowHost.id = UI_ID + '-host';
  shadowHost.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  try { shadowRootRef = shadowHost.attachShadow({ mode: 'open' }); } catch (e) { shadowRootRef = null; }
  injectModernStyles(shadowRootRef || document.head);
  pmlCurPalette = pmlResolvePalette();
  pmlRefreshAccent();

  const w = document.createElement('div');
  w.id = UI_ID;
  w.setAttribute('role', 'complementary');
  w.setAttribute('aria-label', 'Панель экспорта UACE × PML');

  const box = document.createElement('div'); box.className = 'box'; w.appendChild(box);

  const st = document.createElement('div');
  st.className = 'status';
  st.setAttribute('role', 'status');
  st.setAttribute('aria-live', 'polite');

  /* === ЗАМЕНЕНО: UPOLY-badge === */
  const badge = document.createElement('button');
  badge.className = 'badge';
  badge.type = 'button';
  badge.textContent = 'UP';
  badge.setAttribute('aria-label', 'UACE × PML — развернуть панель');
  badge.title = 'UACE × PML v' + SCRIPT_VER + ' — развернуть';

  const mini = document.createElement('div'); mini.className = 'mini';

  const btn = label => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; return b; };

  /* --- тема/комфорт --- */
  function applyHfTheme() {
    const p = HF_PALETTES[hfTheme()] || HF_PALETTES.light;
    const r = w.style;
    r.setProperty('--hf-bg', p.bg); r.setProperty('--hf-surface', p.surface);
    r.setProperty('--hf-tx', p.tx); r.setProperty('--hf-tx2', p.tx2);
    r.setProperty('--hf-line', p.line); r.setProperty('--hf-accent', p.accent);
    r.setProperty('--hf-ok', p.ok); r.setProperty('--hf-warn', p.warn);
    r.setProperty('--hf-btn', p.btn); r.setProperty('--hf-btn-hover', p.btnHover);
    r.setProperty('--hf-btn-tx', p.btnTx); r.setProperty('--hf-ring', p.ring);
    box.style.background = p.bg;
    box.style.border = '1px solid ' + p.line;
    w.classList.toggle('hf-motion-off', !hfMotionOn());
    const fsz = Math.min(18, Math.max(13, parseInt(safeStorageGet('uaice_fsz') || '14', 10) || 14));
    w.style.fontSize = fsz + 'px';
    w.style.lineHeight = '1.6';
    /* v28.2.1: PML-палитра и акцент следуют за темой UACE в момент переключения */
    try { pmlCurPalette = pmlResolvePalette(); pmlRefreshAccent(); } catch (e) {}
  }
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if ((safeStorageGet('uaice_theme') || 'auto') === 'auto') applyHfTheme(); }); } catch (e) {}

  /* --- grip --- */
  const grip = document.createElement('div'); grip.className = 'grip';
  const gripTitle = document.createElement('span'); gripTitle.className = 'title';
  gripTitle.textContent = '⬇ UACE × PML v' + SCRIPT_VER;
  const gripBtns = document.createElement('div');
  gripBtns.style.cssText = 'display:flex;gap:6px;flex:0 0 auto;';
  const bPass = btn('ⓘ'); bPass.title = 'Паспорт панели';
  bPass.setAttribute('aria-expanded', 'false');
  const b0 = btn('—'); b0.title = 'Свернуть'; b0.setAttribute('aria-label', 'Свернуть');
  gripBtns.appendChild(bPass); gripBtns.appendChild(b0);
  grip.appendChild(gripTitle); grip.appendChild(gripBtns);

  /* --- формат + настройки --- */
  const rowFmt = document.createElement('div'); rowFmt.className = 'row2';
  const selFormat = document.createElement('select');
  selFormat.setAttribute('aria-label', 'Формат экспорта');
  const FMT_LABELS = { md:'Markdown', json:'JSON', txt:'Текст', html:'HTML', pdf:'PDF (0-CDN печать)', zip:'ZIP', sharegpt:'ShareGPT', jsonl:'JSONL', alpaca:'Alpaca' };
  FORMATS.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = FMT_LABELS[f] || f; selFormat.appendChild(o); });
  let currentFormat = safeStorageGet('uaice_format') || 'md';
  if (FORMATS.indexOf(currentFormat) === -1) currentFormat = 'md';
  selFormat.value = currentFormat;
  const bSet = btn('Настройки'); bSet.title = 'Фильтр, комфорт, автономность (Alt+S)'; bSet.setAttribute('aria-expanded', 'false');
  rowFmt.appendChild(selFormat); rowFmt.appendChild(bSet);

  /* --- главные действия UACE --- */
  const gridMain = document.createElement('div'); gridMain.className = 'grid';
  const b1 = btn('Экспорт текущего'); b1.title = 'Alt+E';
  const b2 = btn('Все чаты'); b2.title = 'Alt+A';
  const b4 = btn('⏹ Стоп'); b4.className = 'stop'; b4.title = 'Остановить'; b4.disabled = true;
  gridMain.appendChild(b1); gridMain.appendChild(b2); gridMain.appendChild(b4);

  /* --- Ещё экспорт --- */
  const dMore = document.createElement('details');
  const sMore = document.createElement('summary'); sMore.textContent = 'Ещё экспорт';
  const iMore = document.createElement('div'); iMore.className = 'inner';
  const bTabs = btn('Все чаты (вкладками)');
  const bResume = btn('▶ Продолжить'); bResume.disabled = true;
  const b5 = btn('Копировать Markdown'); b5.title = 'Alt+C';
  const bCont = btn('Промпт-перенос');
  const bSide = btn('Открыть сайдбар');
  iMore.appendChild(bTabs); iMore.appendChild(bResume); iMore.appendChild(b5); iMore.appendChild(bCont); iMore.appendChild(bSide);
  dMore.appendChild(sMore); dMore.appendChild(iMore);

  /* --- ПЕРЕНЕСЕНО ИЗ UPOLY: PML-секция с вкладками --- */
  const dPml = document.createElement('details');
  const sPml = document.createElement('summary'); sPml.textContent = 'PML-разведка';
  const iPml = document.createElement('div'); iPml.className = 'inner';

  const pmlTabs = document.createElement('div'); pmlTabs.className = 'pml-tabs';
  const tRecon = document.createElement('button'); tRecon.type = 'button'; tRecon.textContent = 'Разведка'; tRecon.setAttribute('aria-selected', 'true');
  const tActs  = document.createElement('button'); tActs.type = 'button'; tActs.textContent = 'Действия'; tActs.setAttribute('aria-selected', 'false');
  const tLog   = document.createElement('button'); tLog.type = 'button'; tLog.textContent = 'Журнал'; tLog.setAttribute('aria-selected', 'false');
  pmlTabs.appendChild(tRecon); pmlTabs.appendChild(tActs); pmlTabs.appendChild(tLog);

  const pmlPaneRecon = document.createElement('div'); pmlPaneRecon.className = 'pml-pane';
  const bPmlRecon = btn('Разведка (Alt+Shift+E)');
  const bPmlObs = btn('Наблюдение 60 с (Alt+Shift+D)');
  const pmlReconOut = document.createElement('div'); /* v28.2.2: boot без innerHTML — TT-сайты (gemini) */
  (function () { const d = document.createElement('div'); d.className = 'pml-dim'; d.textContent = 'нет данных'; pmlReconOut.appendChild(d); })();
  const bPmlCopyStruct = btn('Копировать struct (Alt+Shift+C)');
  pmlPaneRecon.appendChild(bPmlRecon); pmlPaneRecon.appendChild(bPmlObs);
  pmlPaneRecon.appendChild(pmlReconOut);
  pmlPaneRecon.appendChild(bPmlCopyStruct);

  const pmlPaneActs = document.createElement('div'); pmlPaneActs.className = 'pml-pane'; pmlPaneActs.hidden = true;
  const bPmlStop = btn('Стоп (Alt+Shift+S)');
  const bPmlCopyJournal = btn('Копировать журнал');
  const bPmlCycleTabs = btn('Цикл вкладок PML (Alt+Shift+X)');
  const bPmlPassport = btn('Паспорт PML (Alt+Shift+I)');
  pmlPaneActs.appendChild(bPmlStop); pmlPaneActs.appendChild(bPmlCopyJournal); pmlPaneActs.appendChild(bPmlCycleTabs); pmlPaneActs.appendChild(bPmlPassport);

  const pmlPaneLog = document.createElement('div'); pmlPaneLog.className = 'pml-pane'; pmlPaneLog.hidden = true;
  const pmlLogList = document.createElement('ul'); pmlLogList.className = 'pml-log';
  pmlPaneLog.appendChild(pmlLogList);

  const pmlStatus = document.createElement('span'); pmlStatus.className = 'pml-status'; pmlStatus.setAttribute('aria-live', 'polite');
  const pmlPassport = document.createElement('div'); pmlPassport.className = 'pml-kv'; pmlPassport.style.display = 'none';

  iPml.appendChild(pmlTabs);
  iPml.appendChild(pmlPaneRecon); iPml.appendChild(pmlPaneActs); iPml.appendChild(pmlPaneLog);
  iPml.appendChild(pmlStatus);
  iPml.appendChild(pmlPassport);
  dPml.appendChild(sPml); dPml.appendChild(iPml);

  /* --- режимы диалога (UACE) --- */
  const dModes = document.createElement('details');
  const sModes = document.createElement('summary'); sModes.textContent = 'Режимы диалога';
  const iModes = document.createElement('div'); iModes.className = 'inner';
  const options = { exportThinking: safeStorageGet('uaice_think') === '1', stripThinking: safeStorageGet('uaice_strip') === '1' };
  function cbRow(label, checked, title, onchange) {
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = checked;
    if (title) cb.title = title;
    const lb = document.createElement('label');
    lb.appendChild(cb); lb.appendChild(document.createTextNode(' ' + label));
    cb.onchange = () => onchange(cb.checked);
    return lb;
  }
  iModes.appendChild(cbRow('Экспортировать thinking', options.exportThinking, '', v => { options.exportThinking = v; safeStorageSet('uaice_think', v ? '1' : '0'); }));
  iModes.appendChild(cbRow('Вырезать thinking из текста', options.stripThinking, '', v => { options.stripThinking = v; safeStorageSet('uaice_strip', v ? '1' : '0'); }));
  dModes.appendChild(sModes); dModes.appendChild(iModes);

  /* --- диагностика UACE --- */
  const dDiag = document.createElement('details');
  const sDiag = document.createElement('summary'); sDiag.textContent = 'Диагностика UACE';
  const iDiag = document.createElement('div'); iDiag.className = 'inner';
  const b6 = btn('Debug (F12)');
  const bRep = btn('Report (JSON)');
  const bSniff = btn('Sniffer (DOM)');
  iDiag.appendChild(b6); iDiag.appendChild(bRep); iDiag.appendChild(bSniff);
  dDiag.appendChild(sDiag); dDiag.appendChild(iDiag);

  /* --- настройки UACE --- */
  const settings = document.createElement('div'); settings.className = 'settings comfort'; settings.style.display = 'none'; /* v28.2.1: +comfort — оживляет CSS строк комфорта и подсветку aria-pressed */
  const capC = document.createElement('div'); capC.className = 'cap'; capC.textContent = 'Комфорт';
  const rowTheme = document.createElement('div'); rowTheme.className = 'crow';
  const clTheme = document.createElement('span'); clTheme.className = 'cl'; clTheme.textContent = 'Тема UACE';
  const cTheme = document.createElement('div'); cTheme.className = 'cbtns';
  const themeBtns = {};
  [['auto', 'Авто'], ['light', 'Свет'], ['dark', 'Тьма'], ['warm', 'Тепло']].forEach(([v, lb]) => {
    const b = btn(lb); b.dataset.v = v;
    b.onclick = () => { safeStorageSet('uaice_theme', v); applyHfTheme(); syncComfort(); setStatus('Тема: ' + lb, 2200); }; /* v28.2.1: статус-фидбек */
    themeBtns[v] = b; cTheme.appendChild(b);
  });
  rowTheme.appendChild(clTheme); rowTheme.appendChild(cTheme);

  const rowFsz = document.createElement('div'); rowFsz.className = 'crow';
  const clFsz = document.createElement('span'); clFsz.className = 'cl'; clFsz.textContent = 'Кегль';
  const cFsz = document.createElement('div'); cFsz.className = 'cbtns';
  const fA = btn('A−'); const fB = btn('A+');
  fA.onclick = () => { const v = Math.max(13, (parseInt(safeStorageGet('uaice_fsz') || '14', 10) || 14) - 1); safeStorageSet('uaice_fsz', String(v)); applyHfTheme(); };
  fB.onclick = () => { const v = Math.min(18, (parseInt(safeStorageGet('uaice_fsz') || '14', 10) || 14) + 1); safeStorageSet('uaice_fsz', String(v)); applyHfTheme(); };
  cFsz.appendChild(fA); cFsz.appendChild(fB);
  rowFsz.appendChild(clFsz); rowFsz.appendChild(cFsz);

  const rowMot = document.createElement('div'); rowMot.className = 'crow';
  const clMot = document.createElement('span'); clMot.className = 'cl'; clMot.textContent = 'Движение';
  const cMot = document.createElement('div'); cMot.className = 'cbtns';
  const mOn = btn('Вкл'); const mOff = btn('Выкл');
  mOn.onclick = () => { safeStorageSet('uaice_motion', '1'); applyHfTheme(); syncComfort(); setStatus('Движение: вкл', 2200); };
  mOff.onclick = () => { safeStorageSet('uaice_motion', '0'); applyHfTheme(); syncComfort(); setStatus('Движение: выкл', 2200); };
  cMot.appendChild(mOn); cMot.appendChild(mOff);
  rowMot.appendChild(clMot); rowMot.appendChild(cMot);

  const rowEve = document.createElement('div'); rowEve.className = 'crow';
  const clEve = document.createElement('span'); clEve.className = 'cl'; clEve.textContent = 'Тёплый вечер';
  const cEve = document.createElement('div'); cEve.className = 'cbtns';
  const eOn = btn('Вкл'); const eOff = btn('Выкл');
  eOn.onclick = () => { safeStorageSet('uaice_evening', '1'); applyHfTheme(); syncComfort(); setStatus('Тёплый вечер: вкл — «Авто» тёплый 20:00–06:59', 3200); };
  eOff.onclick = () => { safeStorageSet('uaice_evening', '0'); applyHfTheme(); syncComfort(); setStatus('Тёплый вечер: выкл', 2200); };
  cEve.appendChild(eOn); cEve.appendChild(eOff);
  rowEve.appendChild(clEve); rowEve.appendChild(cEve);

  function syncComfort() {
    const t = safeStorageGet('uaice_theme') || 'auto';
    Object.keys(themeBtns).forEach(k => themeBtns[k].setAttribute('aria-pressed', k === t ? 'true' : 'false'));
    const mot = safeStorageGet('uaice_motion') !== '0';
    mOn.setAttribute('aria-pressed', mot ? 'true' : 'false');
    mOff.setAttribute('aria-pressed', mot ? 'false' : 'true');
    const ev = safeStorageGet('uaice_evening') !== '0';
    eOn.setAttribute('aria-pressed', ev ? 'true' : 'false');
    eOff.setAttribute('aria-pressed', ev ? 'false' : 'true');
  }

  const lbFilter = document.createElement('span'); lbFilter.className = 'cap'; lbFilter.textContent = 'Фильтр по названию:';
  const inFilter = document.createElement('input'); inFilter.type = 'text'; inFilter.placeholder = 'пусто = все'; inFilter.value = safeStorageGet('uaice_filter') || '';
  const cbOnly = document.createElement('input'); cbOnly.type = 'checkbox'; cbOnly.checked = safeStorageGet('uaice_onlynew') === '1';
  const lbOnly = document.createElement('label'); lbOnly.appendChild(cbOnly); lbOnly.appendChild(document.createTextNode(' Только новые'));
  const cbImg = document.createElement('input'); cbImg.type = 'checkbox'; cbImg.checked = safeStorageGet('uaice_images') !== '0';
  const lbImg = document.createElement('label'); lbImg.appendChild(cbImg); lbImg.appendChild(document.createTextNode(' Скачивать картинки в ZIP'));
  const cbFm = document.createElement('input'); cbFm.type = 'checkbox'; cbFm.checked = safeStorageGet('uaice_fm') !== '0';
  const lbFm = document.createElement('label'); lbFm.appendChild(cbFm); lbFm.appendChild(document.createTextNode(' YAML-шапка MD'));
  const cbAd = document.createElement('input'); cbAd.type = 'checkbox'; cbAd.checked = safeStorageGet('uaice_adaptive') !== '0';
  const lbAd = document.createElement('label'); lbAd.appendChild(cbAd); lbAd.appendChild(document.createTextNode(' Адаптивные задержки'));
  const cbMer = document.createElement('input'); cbMer.type = 'checkbox'; cbMer.checked = safeStorageGet('uaice_mermaid') !== '0';
  const lbMer = document.createElement('label'); lbMer.appendChild(cbMer); lbMer.appendChild(document.createTextNode(' Mermaid-ссылки SVG'));
  const cbPdf = document.createElement('input'); cbPdf.type = 'checkbox'; cbPdf.checked = safeStorageGet('uaice_pdfcdn') === '1';
  const lbPdf = document.createElement('label'); lbPdf.appendChild(cbPdf); lbPdf.appendChild(document.createTextNode(' PDF: CDN-рендер (эксперимент, может блокироваться CSP)'));
  const selZip = document.createElement('select');
  ['md','json','txt','html','pdf','both'].forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f === 'both' ? 'ZIP: MD+JSON' : 'ZIP: ' + f.toUpperCase(); selZip.appendChild(o); });
  selZip.value = resolveInner();
  const rowReset = document.createElement('div'); rowReset.className = 'row';
  const bRm1 = btn('Сбросить отметки');
  const bRm2 = btn('Сбросить всё');
  rowReset.appendChild(bRm1); rowReset.appendChild(bRm2);

  settings.appendChild(capC);
  settings.appendChild(rowTheme);
  settings.appendChild(rowFsz);
  settings.appendChild(rowMot);
  settings.appendChild(rowEve);
  settings.appendChild(lbFilter); settings.appendChild(inFilter);
  settings.appendChild(lbOnly); settings.appendChild(lbImg); settings.appendChild(lbFm); settings.appendChild(lbAd); settings.appendChild(lbMer); settings.appendChild(lbPdf);
  settings.appendChild(selZip); settings.appendChild(rowReset);

  /* --- паспорт UACE --- */
  const passport = document.createElement('div'); passport.className = 'passport'; passport.style.display = 'none';
  function renderPassportUace() {
    const p = HF_PALETTES[hfTheme()] || HF_PALETTES.light;
    const rows = [];
    const row = (k, v, good) => rows.push('<div class="prow"><span class="pk">' + k + '</span><span class="pv' + (good === true ? ' good' : '') + '">' + v + '</span></div>');
    const fsz = Math.min(18, Math.max(13, parseInt(safeStorageGet('uaice_fsz') || '14', 10) || 14));
    row('Контраст WCAG 2.2', hfContrast(p.tx, p.bg).toFixed(1) + ':1 ≥4.5', hfContrast(p.tx, p.bg) >= 4.5);
    row('Длина строки статуса', '≤65ch', true);
    row('Мерцание', '0 Гц', true);
    row('Тёплый вечер', (safeStorageGet('uaice_evening') !== '0' ? 'вкл' : 'выкл') + ' · ' + hfTheme(), true);
    row('Цели касания', '≥44px', true);
    row('Кегль', fsz + 'px', fsz >= 14);
    row('Badge (из UPOLY)', 'UP 44×44 2px', true);
    row('Позиция панели (из UPOLY)', 'top:16px right:16px', true);
    row('PML-разведка', 'встроена (r1+r2)', true);
    setHTML(passport, rows.join(''));
  }
  bPass.onclick = () => {
    const show = passport.style.display === 'none';
    if (show) { renderPassportUace(); renderPmlPassport(); }
    passport.style.display = show ? '' : 'none';
    pmlPassport.style.display = show ? '' : 'none';
    bPass.setAttribute('aria-expanded', show ? 'true' : 'false');
  };

  /* --- состояние панели --- */
  let collapsed = safeStorageGet('uaice_collapsed') === '1';
  function applyCollapsed() {
    grip.style.display = collapsed ? 'none' : '';
    [rowFmt, gridMain, dMore, dPml, dModes, dDiag].forEach(x => { x.style.display = collapsed ? 'none' : ''; });
    settings.style.display = 'none';
    bSet.setAttribute('aria-expanded', 'false');
    mini.style.display = collapsed ? 'none' : '';
    const empty = collapsed && !st.textContent;
    st.style.display = empty ? 'none' : '';
    box.style.display = empty ? 'none' : '';
    badge.style.display = collapsed ? 'block' : 'none';
    safeStorageSet('uaice_collapsed', collapsed ? '1' : '0');
  }
  b0.onclick = () => { collapsed = true; applyCollapsed(); };
  badge.onclick = () => { collapsed = false; applyCollapsed(); };

  let statusTimer = null;
  function setStatus(t, hideAfter) {
    st.textContent = t || '';
    if (collapsed) applyCollapsed();
    if (statusTimer) clearTimeout(statusTimer);
    if (hideAfter) statusTimer = setTimeout(() => setStatus(''), hideAfter);
  }
  function refreshResume() {
    const ses = loadSession();
    const can = !!(ses && ses.idx < ses.items.length);
    bResume.disabled = !can;
    bResume.textContent = can ? '▶ Продолжить (' + ses.idx + '/' + ses.items.length + ')' : '▶ Продолжить';
  }
  function setBusy(v) {
    busy = v;
    [b1, b2, bTabs, bResume, b5, bCont, bSide, b6, bRep, bSniff, selFormat].forEach(x => { try { x.disabled = v; } catch (e) {} });
    b4.disabled = !v;
    badge.classList.toggle('busy', v);
    badge.setAttribute('aria-label', (v ? 'Идёт экспорт — ' : 'UACE × PML v' + SCRIPT_VER + ' — ') + (v ? 'нажмите, чтобы открыть панель' : 'развернуть'));
    if (!v) { CANCEL = false; refreshResume(); }
  }
  function cycleFormat() {
    if (busy) return;
    currentFormat = FORMATS[(FORMATS.indexOf(currentFormat) + 1) % FORMATS.length];
    selFormat.value = currentFormat;
    safeStorageSet('uaice_format', currentFormat);
    setStatus('Формат: ' + (FMT_LABELS[currentFormat] || currentFormat), 2500);
  }
  selFormat.onchange = () => { currentFormat = selFormat.value; safeStorageSet('uaice_format', currentFormat); setStatus('Формат: ' + (FMT_LABELS[currentFormat] || currentFormat), 2500); };

  async function run(fn) {
    if (busy) return; setBusy(true);
    try { await fn(); } catch (e) { console.error(e); setStatus('Ошибка: ' + (e && e.message || e), 12000); }
    finally { setBusy(false); }
  }
  async function runPml(fn) {
    if (busy) return; setBusy(true);
    try { await fn(); } catch (e) { console.error(e); pmlSetStatus('Ошибка: ' + (e && e.message || e)); }
    finally { setBusy(false); }
  }

  b1.onclick = () => run(async () => {
    const r = await exportCurrent(currentFormat, options, setStatus);
    setStatus((r.snapshot ? 'Снимок сохранён' : 'Готово: ' + r.count + ' сообщений') + ' — ' + (FMT_LABELS[currentFormat] || currentFormat), 5000);
  });
  b2.onclick = () => run(async () => {
    const r = await exportAll(currentFormat, 'same', askOptions(), setStatus);
    setStatus('Готово: ' + r.ok + '/' + r.total + (r.skipped ? ', пропущено: ' + r.skipped : '') + (r.fail ? ', ошибок: ' + r.fail : ''), 10000);
  });
  bTabs.onclick = () => run(async () => {
    const r = await exportAll(currentFormat, 'tabs', askOptions(), setStatus);
    setStatus('Вкладками: ' + r.ok + '/' + r.total, 10000);
  });
  bResume.onclick = () => run(async () => {
    const ses = loadSession();
    if (!ses || ses.idx >= ses.items.length) { setStatus('Нет незавершённого', 3000); return; }
    const r = await exportAll(ses.fmt, ses.mode, askOptions(), setStatus, ses);
    setStatus('Продолжено: ' + r.ok + '/' + r.total, 10000);
  });
  b4.onclick = () => { CANCEL = true; setStatus('Останавливаю...'); };
  b5.onclick = () => run(async () => { const n = await copyCurrentMd(options); setStatus('Скопировано: ' + n, 4000); });
  bCont.onclick = () => run(async () => { const n = await copyContinuePrompt(options); setStatus('Промпт: ' + n, 6000); });
  bSet.onclick = () => { const show = settings.style.display === 'none'; settings.style.display = show ? '' : 'none'; bSet.setAttribute('aria-expanded', show ? 'true' : 'false'); };
  bSide.onclick = () => run(async () => {
    setStatus('Открываю сайдбар...');
    const ok = await ensureSidebar();
    await sleep(500);
    const l = findList();
    if (l) setStatus('Найдено: ' + l.items.length + ' (' + l.via + ')', 5000);
    else setStatus(ok ? 'Сайдбар открыт, чаты не найдены' : 'Сайдбар не найден', 6000);
  });
  b6.onclick = () => { try { debugDump(); setStatus('Debug → F12', 3000); } catch (e) { setStatus('Ошибка: ' + e.message, 8000); } };
  bRep.onclick = () => { try { exportDebugReport(); setStatus('Report сохранён', 5000); } catch (e) { setStatus('Ошибка: ' + e.message, 8000); } };
  bSniff.onclick = () => { try { debugSniffer(); setStatus('Sniffer сохранён', 7000); } catch (e) { setStatus('Ошибка: ' + e.message, 8000); } };

  inFilter.onchange = () => { safeStorageSet('uaice_filter', inFilter.value.trim().toLowerCase()); setStatus('Фильтр: "' + (inFilter.value.trim() || 'все') + '"', 3000); };
  cbOnly.onchange = () => safeStorageSet('uaice_onlynew', cbOnly.checked ? '1' : '0');
  cbImg.onchange = () => safeStorageSet('uaice_images', cbImg.checked ? '1' : '0');
  cbFm.onchange = () => safeStorageSet('uaice_fm', cbFm.checked ? '1' : '0');
  cbAd.onchange = () => safeStorageSet('uaice_adaptive', cbAd.checked ? '1' : '0');
  cbMer.onchange = () => safeStorageSet('uaice_mermaid', cbMer.checked ? '1' : '0');
  cbPdf.onchange = () => safeStorageSet('uaice_pdfcdn', cbPdf.checked ? '1' : '0');
  selZip.onchange = () => safeStorageSet('uaice_zipinner', selZip.value);
  bRm1.onclick = () => { clearManifestAll().then(() => setStatus('Отметки сброшены', 3000)).catch(() => setStatus('Отметки сброшены', 3000)); };
  bRm2.onclick = () => {
    [MANIFEST_KEY, SESSION_KEY, SETTINGS_KEY, 'uaice_filter','uaice_onlynew','uaice_images','uaice_fm','uaice_zipinner','uaice_format','uaice_think','uaice_strip','uaice_collapsed','uaice_pos_v1','uaice_adaptive','uaice_mermaid','uaice_pdfcdn','uaice_theme','uaice_evening','uaice_fsz','uaice_motion'].forEach(k => safeStorageRemove(k));
    inFilter.value = ''; cbOnly.checked = false; cbImg.checked = true; cbFm.checked = true; cbAd.checked = true; cbMer.checked = true; cbPdf.checked = false;
    clearManifestAll().catch(() => {});
    currentFormat = 'md'; selFormat.value = 'md';
    applyHfTheme(); syncComfort();
    setStatus('Все настройки сброшены.', 6000);
  };

  /* --- PML-вкладки --- */
  function showPmlTab(name) {
    tRecon.setAttribute('aria-selected', name === 'recon' ? 'true' : 'false');
    tActs.setAttribute('aria-selected', name === 'acts' ? 'true' : 'false');
    tLog.setAttribute('aria-selected', name === 'log' ? 'true' : 'false');
    pmlPaneRecon.hidden = name !== 'recon';
    pmlPaneActs.hidden = name !== 'acts';
    pmlPaneLog.hidden = name !== 'log';
    if (name === 'log') renderPmlLog();
  }
  tRecon.onclick = () => showPmlTab('recon');
  tActs.onclick = () => showPmlTab('acts');
  tLog.onclick = () => showPmlTab('log');

  bPmlRecon.onclick = () => runPml(async () => { pmlRunRecon(); });
  bPmlObs.onclick = () => { if (obsSession) { pmlSetStatus('уже идёт'); return; } pmlStartObservation(); };
  bPmlCopyStruct.onclick = () => { try { pmlCopyStruct(); } catch (e) { pmlSetStatus('ошибка: ' + e.message); } };
  bPmlStop.onclick = () => pmlStopAll();
  bPmlCopyJournal.onclick = () => { try { pmlCopyJournal(); } catch (e) { pmlSetStatus('ошибка'); } };
  bPmlCycleTabs.onclick = () => { const order = ['recon','acts','log']; const cur = order.find(t => (t === 'recon' ? tRecon : t === 'acts' ? tActs : tLog).getAttribute('aria-selected') === 'true') || 'recon'; showPmlTab(order[(order.indexOf(cur) + 1) % 3]); };
  bPmlPassport.onclick = () => { const show = pmlPassport.style.display === 'none'; if (show) renderPmlPassport(); pmlPassport.style.display = show ? '' : 'none'; };

  /* --- drag --- */
  const POS_KEY = 'uaice_pos_v1';
  try {
    const saved = JSON.parse(safeStorageGet(POS_KEY) || 'null');
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      w.style.left = saved.left + 'px'; w.style.top = saved.top + 'px';
      w.style.right = 'auto'; w.style.bottom = 'auto';
    }
  } catch (e) {}
  let drag = null;
  grip.addEventListener('pointerdown', e => {
    if (gripBtns.contains(e.target)) return;
    const r = w.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.preventDefault();
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const vw = window.innerWidth || 1920, vh = window.innerHeight || 1080;
    const left = Math.max(0, Math.min(vw - 80, e.clientX - drag.dx));
    const top = Math.max(0, Math.min(vh - 40, e.clientY - drag.dy));
    w.style.left = left + 'px'; w.style.top = top + 'px';
    w.style.right = 'auto'; w.style.bottom = 'auto';
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return; drag = null;
    const r = w.getBoundingClientRect();
    safeStorageSet(POS_KEY, JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }));
  });
  grip.addEventListener('dblclick', e => {
    if (gripBtns.contains(e.target)) return;
    safeStorageRemove(POS_KEY);
    w.style.left = ''; w.style.top = ''; w.style.right = ''; w.style.bottom = '';
  });

  /* --- хоткеи: UACE Alt+… / PML Alt+Shift+… --- */
  document.addEventListener('keydown', e => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    /* PML: Alt+Shift+… */
    if (e.shiftKey) {
      if (e.code === 'KeyE') { e.preventDefault(); bPmlRecon.click(); }
      else if (e.code === 'KeyD') { e.preventDefault(); bPmlObs.click(); }
      else if (e.code === 'KeyC') { e.preventDefault(); bPmlCopyStruct.click(); }
      else if (e.code === 'KeyS') { e.preventDefault(); bPmlStop.click(); }
      else if (e.code === 'KeyX') { e.preventDefault(); bPmlCycleTabs.click(); }
      else if (e.code === 'KeyI') { e.preventDefault(); bPmlPassport.click(); }
      return;
    }
    /* UACE: Alt+… */
    if (e.code === 'KeyE') { e.preventDefault(); b1.click(); }
    else if (e.code === 'KeyA') { e.preventDefault(); b2.click(); }
    else if (e.code === 'KeyC') { e.preventDefault(); b5.click(); }
    else if (e.code === 'KeyS') { e.preventDefault(); bSet.click(); }
    else if (e.code === 'KeyX') { e.preventDefault(); cycleFormat(); }
    else if (e.code === 'KeyR') { e.preventDefault(); if (!bResume.disabled) bResume.click(); }
  });
  /* Esc — стоп наблюдения */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && obsSession) pmlFinishObservation(true);
  });

  /* --- сборка --- */
  box.appendChild(grip);
  box.appendChild(rowFmt);
  box.appendChild(gridMain);
  box.appendChild(dMore);
  box.appendChild(dPml);
  box.appendChild(dModes);
  box.appendChild(dDiag);
  box.appendChild(passport);
  box.appendChild(settings);
  box.appendChild(st);
  box.appendChild(mini);
  w.appendChild(badge);
  /* v28.2.2: хост в documentElement — переживает замену body при SPA-гидрации (gemini) */
  if (shadowRootRef) { shadowRootRef.appendChild(w); (document.documentElement || document.body).appendChild(shadowHost); }
  else (document.body || document.documentElement).appendChild(w); /* фейлвер для сред без attachShadow */

  /* --- активация UI-ссылок для функций PML --- */
  ui = {
    pmlReconOut, pmlLogList, pmlStatus, pmlPassport,
    tabs: { tRecon, tActs, tLog }
  };

  const p0 = getPlatform();
  const miniBase = 'v' + SCRIPT_VER + ' · ' + (p0 ? p0.name : 'универсальный') + ' · UACE+PML';
  mini.textContent = miniBase;
  getManifest().then(m => { const n = Object.keys(m || {}).length; if (n > 0) mini.textContent = miniBase + ' · манифест: ' + n; }).catch(() => {});

  applyHfTheme(); syncComfort(); refreshResume(); applyCollapsed();
  pmlLog('info', 'интеграция UACE v' + UACE_VER + ' × PML v' + UPOLY_VER + ' готова');
}

/* ==========================================================================
 *  E. Экспорт внутренних функций (для отладки)
 * ========================================================================== */
try {
  window.__UAICE_INTERNALS__ = {
    ver: SCRIPT_VER, UACE_VER, UPOLY_VER, FORMATS, CFG,
    crc32, zipStore, dosDateTime,
    toMarkdown, toJSON, toTXT, toHTML, toShareGPT, toJSONL, toAlpaca, contentFor,
    sanitize, dedupeText, stripUiPrefix, domToMarkdown, detectRole, roleFromValue, getPlatform,
    isChatUrl, buildChatUrl, extractChatTarget, scrape, findMessages, debugDump,
    loadSession, clearSession, loadManifest, activateChatItem,
    hashString, manifestKey, chatHash, processMermaid, mermaidEnabled, adaptiveMs, splitZipVolumes,
    collectArtifacts, fingerprintSidebar, getManifest, flushManifest, clearManifestAll,
    HAS_IDB, toast,
    /* v28.2: новые модули */
    HAS_DEFLATE, zipStoreAsync, zipStoreSmart, deflateRawU8, poolMap, NavGuard,
    fetchViaGM, extractImageViaCanvas, extractImageViaCanvasFresh, collectShadowRoots, saveSettingsMirror, loadSettingsMirror,
    /* PML */
    fnv1a, sigOf, sigHash, pathOf, prefixPath, subtreeDepth, closestUp,
    pmlBuildStruct, pmlScoreGroup, pmlResolveRecon, pmlScanSync,
    pmlStartObservation, pmlFinishObservation, pmlRunRecon, pmlCopyStruct,
    pmlGetPassport, pmlMetrics, pmlJournal,
    /* v28.2.2: TT/PDF/монтаж */
    TT_ACTIVE, setHTML, fillPrintDoc, pdfPrintCss, renderPdfBlob, printFallback, exportAsPDF,
    /* UI */
    pmlState, pmlCurPalette: () => pmlCurPalette, pmlAccentInfo: () => pmlAccentInfo
  };
} catch (e) {}

/* ==========================================================================
 *  F. Boot
 * ========================================================================== */
let bootTries = 0, mountWatchdog = null;
function boot() {
  if (IS_FRAME) return;
  try {
    buildUI(); /* v28.2.2: ретрай при исключении (TT-сайты, SPA-гидрация) */
  } catch (e) {
    try { console.error('[UACE v' + UACE_VER + '] buildUI не удался (попытка ' + (bootTries + 1) + '):', e); } catch (e2) {}
    if (bootTries++ < 8) setTimeout(boot, 1500);
    return;
  }
  const p = getPlatform();
  console.log('[UACE v' + UACE_VER + ' × PML v' + UPOLY_VER + '] Интеграция готова. Платформа: ' + (p ? p.name : 'универсальный режим') + '. Форматы: ' + FORMATS.join('/') + '. Хранилище: ' + (HAS_IDB ? 'IndexedDB' : 'localStorage') + (TT_ACTIVE ? ' · Trusted Types: совместимо' : ''));
  getManifest().catch(() => {});
  /* v28.2.2: watchdog самовосстановления монтажа (период ≤2 с — по стандарту PML-PANEL) */
  if (!mountWatchdog) {
    mountWatchdog = setInterval(() => {
      try {
        if (shadowHost && !shadowHost.isConnected) {
          (document.documentElement || document.body).appendChild(shadowHost);
          pmlLog('info', 'watchdog: хост панели переподключён');
        }
        if (shadowRootRef && shadowRootRef.getElementById && !shadowRootRef.getElementById(UI_ID + '-styles')) injectModernStyles(shadowRootRef);
      } catch (e) {}
    }, 2000);
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(boot, 1000);
} else {
  window.addEventListener('load', () => setTimeout(boot, 1000));
}

/* опциональная автозагрузка PML-разведки при старте (можно отключить через localStorage) */
try {
  if (safeStorageGet('uaice_pml_autorecon') === '1') {
    setTimeout(() => { try { pmlRunRecon(); } catch (e) {} }, 2500);
  }
} catch (e) {}

})();