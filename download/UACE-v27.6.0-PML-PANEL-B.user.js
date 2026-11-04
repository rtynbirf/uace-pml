// ==UserScript==
// @name         UACE · PML-PANEL 1.0 (вариант B · UACE v27.6 core)
// @namespace    uace.pml.b
// @version      27.6.0
// @description  Референс-реализация замороженного мастера PML-PANEL 1.0 (§1–17) + Модуль I на каноне r2 §5 (соль PMLSTRUCT, pre-order UPPERCASE-сигнатуры, urlHash SALT+'URL>'+href) + наблюдение 60 с + скоринг/резерв r2 §2–3 + реестр с «Копировать struct» + усвоение мирового ландшафта 2025–2026 (agentView в духе Playwright MCP, downsample по D2Snap, simhash/minhash-сверки) + экспорт-пакет 27.6.0 (JSON/Markdown/HTML/TXT/CSV/agent-view файлами + ZIP-бандл: инлайновый райтер CRC32+STORE) — всё аддитивно, вне хэш-канона, 0 внешних запросов (§15). Вариант сессии B для сверки с ЧК-1; канон UPOLY ведёт сессия A.
// @author       session B (UACE-main)
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* UACE v27.6.0 · вариант B · 2026-09-20
   Реализует: мастер PML-PANEL 1.0 §1–17; PML-STRUCT r1+r2 §5 — соль/сигнатуры/urlHash дословно столбец UPOLY
   (полевые конверты №2/№3); findGroups/pickPrimary/findMounts — столбец UPOLY (модальные группы, отсечения
   32px/0.4·высоты, сортировка count*uniformity↓→parentPath, БЕЗ дедупа sigHash — подтверждено полем: f0338710
   встречается дважды); скан от document.body — собственный хост (#pml-host под <html>) исключён из struct ПО
   ПОСТРОЕНИЮ (fix 27.4.3: в 27.4.2 скан от documentElement мог включать собственную панель).
   Рендер struct терпит ОБЕ формы scroll (канон-объект со строкой на primary И легаси-строку на уровне scroll) —
   класс E1 «reading 'path'» закрыт в обе стороны (27.4.2, сохранено и расширено).
   Новое 27.4.3: наблюдение 60 с (I-3/I-4b: мутации, рециклы по prefixPath-4, снапшоты каждые 10 с, stability,
   stream-критерий I.4.3, Esc — стоп; при pagehide авто-разведка глушится — мелочь B-6 применена у B); разведка
   мгновенная (бюджет ≤150 мс; default mut window 60); скоринг r2 §2 + резерв r2 §3 (гейты G1–G4); экспорт
   struct: действие «Копировать struct» + Alt+C (JSON, lastStruct || свежая сборка); хоткеи — канонный набор
   E/D/C/S/X/I (журнал и свёртка — только кнопками); __UACE_INTERNALS__ — полевая сверка хэшей из консоли.
   Снято B в пользу столбца UPOLY (финал развилок r2): соль 'pml-s1' → PMLSTRUCT; сигнатура sig3 → pre-order
   UPPERCASE; urlHash 'pml-s1'+href → SALT+'URL>'+href; C1 «scroll всегда объект» → форма UPOLY (строка на
   уровне scroll); truncated-списки 0-b → boolean; mut-окно 10 с → 60 с; скан от documentElement → body.
   Удержано B (позиции к r2): белый список landmarks (C3: роль-any шумит — 18/20 role=button в поле); append-
   семантика renderActions (гость получает кнопки-фолбэки, не затирая реестр владельца; replace у A —
   дефект-кандидат, M2-семейство); контраст акцента — от активной темы.
   Тесты: node --check PASS; core — FNV-канон-векторы + P1-палитры + солвер §6; smoke jsdom — boot, рендер,
   двойной страж scroll, экспорт, честная версия. FNV-ядро переведено на UTF-8-байты (для ASCII-входов
   байт-эквивалентно прежнему — сверено векторами).
   Новое 27.5.0 «усвоение ландшафта» (наказ владельца: не изобретать велосипед — интегрировать лучшие
   наработки; аддитивно, хэш-канон r2 §5 НЕ тронут — канон-векторы прежние):
   • agentView — a11y-скелет в формате Playwright MCP a11y-снапшота (де-факто стандарт 2025–2026), но БЕЗ
     имён (accessible name = текст) — §15 «0 текста страницы» соблюдено, отличие осознанное (вопрос к r3);
   • downsample — детерминированный даунсемплинг под токен-бюджет по мотивам D2Snap «DOM Downsampling
     for LLM Web Agents» (arXiv 08.2025): фаза coverage (landmarks→mounts→groups по канонному рангу I.2.5),
     фаза selection добором под бюджет; без рандома, без Salt-зависимости порядка;
   • domSim64/simBetween — simhash 64 бита (Charikar, Google 2002) по структурным фичам struct: расстояние
     Хэмминга «один класс страницы» — кандидат на калибровку порога в ЧК-3; вне хэш-конверта (ext);
   • compareStructs — точный Jaccard по sigHash групп (линейка minhash, Broder/AltaVista 1997; наборы ≤12 —
     точный подсчёт дешевле аппроксимации);
   • уже усвоено ранее: повторяющиеся структуры = findGroups (wrapper induction: Kushmerick 1997, RoadRunner
     VLDB 2001); uniformity-скоринг = Readability-линейка; синглтон = P13 (Greasemonkey-линейка не формализовала).
   Новое 27.6.0 «возврат экспорт-пакета» (наказ владельца: вернуть ВСЕ срезанные кнопки/функции — MD, JSON,
   HTML, TXT, CSV, ZIP; структура 27.5.0 сохранена дословно, всё аддитивно — хэш-канон r2 §5 и канон хоткеев
   §13 E/D/C/S/X/I не тронуты):
   • файловые выгрузки: struct.json, Markdown-отчёт (.md: таблицы ландмарков/групп/якорей), автономный
     HTML-отчёт (.html, инлайн-CSS), TXT-отчёт (тикеты/чаты), CSV групп (BOM для Excel/Sheets), agent-view
     (.txt); канал — Blob + URL.createObjectURL + <a download>, внешних запросов НЕТ (§15);
   • ZIP-бандл: инлайновый райтер (таблица CRC32 0xEDB88320 + метод STORE, флаг UTF-8 0x0800, центральный
     каталог + EOCD) — все 6 форматов одним архивом, без внешних зависимостей;
   • кнопки: реестр «Действия» +7 («Скачать JSON/Markdown/HTML/TXT/CSV/agent-view/ZIP-бандл»), панель
     разведки +2 быстрых («Скачать JSON», «Скачать ZIP-бандл»); append-семантика renderActions сохранена;
   • паспорт: счётчик выгрузок и ZIP; __UACE_INTERNALS__ дополнен (crc32/makeZip/buildExportSet/…).
   Объём: ~700 строк кода (физических 881) — потолок §17 превышен (данные R3 для STP-2, вопрос поднят в r2).
   Приватность: 0 внешних запросов, 0 чтения текста страницы — только структурные агрегаты (§15); agentView,
   downsample и весь экспорт-пакет 27.6.0 строятся ТОЛЬКО из уже собранного struct. */
(() => {
'use strict';
const T0 = performance.now(); // 0-d: старт сессии — первая исполняемая строка
if (typeof document === 'undefined' || !document.documentElement) return;

/*PML-PURE-BEGIN*/
const fnvByte = (h, b) => Math.imul(((h ^ b) >>> 0), 0x01000193) >>> 0;
const FNV1a32 = s => { // FNV-1a 32-bit по байтам UTF-8 — канон r2 §5, дословно столбец UPOLY
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    let c = s.codePointAt(i);
    if (c > 0xffff) i++;
    if (c < 0x80) h = fnvByte(h, c);
    else if (c < 0x800) { h = fnvByte(h, 0xc0 | c >> 6); h = fnvByte(h, 0x80 | c & 63); }
    else if (c < 0x10000) { h = fnvByte(h, 0xe0 | c >> 12); h = fnvByte(h, 0x80 | (c >> 6) & 63); h = fnvByte(h, 0x80 | c & 63); }
    else { h = fnvByte(h, 0xf0 | c >> 18); h = fnvByte(h, 0x80 | (c >> 12) & 63); h = fnvByte(h, 0x80 | (c >> 6) & 63); h = fnvByte(h, 0x80 | c & 63); }
  }
  return h >>> 0;
};
const hex8 = n => (n >>> 0).toString(16).padStart(8, '0'); // 0-a: lowercase hex 8, padStart
const SALT = 'PMLSTRUCT';                                  // r2 §5: соль обеих сборок; смена после Ф2 запрещена
const sigHashIn = sig => SALT + '>' + sig;                 // вход sigHash: 'PMLSTRUCT>UL>LI>P'
const urlHashIn = href => SALT + 'URL>' + href;            // вход urlHash: столбец UPOLY (SALT+'URL>'+href)
const simhash64 = feats => { // Charikar (2002): 64-бит фингерпринт мультмножества фич; две независимые 32-бит половины
  const a1 = new Array(32).fill(0), a2 = new Array(32).fill(0);
  for (const f of feats) {
    const h1 = FNV1a32('SIM1>' + f.k), h2 = FNV1a32('SIM2>' + f.k), w = Math.max(1, Math.min(9, f.w | 0));
    for (let i = 0; i < 32; i++) { if ((h1 >>> i) & 1) a1[i] += w; else a1[i] -= w; if ((h2 >>> i) & 1) a2[i] += w; else a2[i] -= w; }
  }
  let v1 = 0, v2 = 0;
  for (let i = 0; i < 32; i++) { if (a1[i] > 0) v1 |= 1 << i; if (a2[i] > 0) v2 |= 1 << i; }
  return hex8(v1) + hex8(v2); // hex16: две канонные hex8 половины
};
const hammingHex = (a, b) => { // расстояние Хэмминга между hex16-фингерпринтами; -1 на некорректном входе
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 16 || b.length !== 16) return -1;
  let d = 0;
  for (let i = 0; i < 16; i += 8) { let v = parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16);
    while (v) { d += v & 1; v >>>= 1; } }
  return d;
};
const hx = n => Math.round(n * 100) / 100; // 0-c: числа-доли — 2 знака
const lum = (r, g, b) => { const f = c => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const x = lum(a[0], a[1], a[2]), y = lum(b[0], b[1], b[2]); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb2ok = (r, g, b) => { const f = c => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); const R = f(r), G = f(g), B = f(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s2, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s2, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s2]; };
const ok2rgb = (L, a, b) => { const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s2 = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const g = c => Math.max(0, Math.min(255, Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055))));
  return [g(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2), g(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2), g(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s2)]; };
const parseRgb = v => { if (!v) return null; const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(v); if (m) return [+m[1], +m[2], +m[3]];
  const h = v.trim(); const n = h.length === 4 ? h.slice(1).split('').map(c => c + c).join('') : h.slice(1);
  return /^[\da-f]{6}$/i.test(n) ? [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16)) : null; };
const guardSat = rgb => { if (!rgb) return false; const [L, a, b] = rgb2ok(rgb[0], rgb[1], rgb[2]); return Math.hypot(a, b) >= 0.02 && L > 0.05 && L < 0.95; }; // сатурационный страж §6
const solveAccent = (bg, a, b) => { for (let i = 1; i < 100; i++) { const L = i / 100, rgb = ok2rgb(L, a, b);
  if (ratio(rgb, bg) >= 4.5 && Math.max(ratio(rgb, [255, 255, 255]), ratio(rgb, [24, 24, 24])) >= 4.5) return rgb; } return null; }; // двухпроходная подгонка §6
const pickTx = rgb => ratio(rgb, [255, 255, 255]) >= 4.5 ? [255, 255, 255] : [24, 24, 24]; // текст-на-акценте §6
const PAL = { // канон линии B; все пары ≥4.5:1 (P1); fb — fallback акцента по замороженному §6
  dark:  { bg: [18, 24, 33],    fg: [230, 235, 242], dim: [154, 168, 186], line: [42, 52, 65],    ring: [122, 184, 255], fb: [77, 163, 255], ok: [62, 190, 120],  warn: [255, 180, 84], crit: [255, 107, 107] },
  light: { bg: [247, 245, 241], fg: [28, 36, 48],    dim: [86, 97, 118],   line: [217, 212, 203], ring: [11, 98, 196],   fb: [11, 98, 196],  ok: [10, 122, 61],   warn: [138, 90, 0],   crit: [179, 38, 30] },
  warm:  { bg: [246, 239, 226], fg: [51, 41, 26],    dim: [107, 93, 66],   line: [227, 216, 194], ring: [138, 90, 0],    fb: [77, 163, 255], ok: [27, 94, 32],    warn: [138, 90, 0],   crit: [179, 38, 30] } };
/*PML-PURE-END*/

const VER = '27.6.0', OWNER = 'uace@' + VER, HOST_ID = 'pml-host';
const S = { theme: 'system', fs: 14, motion: true, collapsed: false }; // pml_panel_v1, белый список §14
const J = []; const HK = {}; const Q = []; const clean = [];
let host = null, root = null, mounted = false, busy = false, badge = 'ok', uid = 0;
let effTheme = 'dark', ACC = null, lastStruct = null, lastElapsed = 0, reconN = 0, mountMs = 0, stT = 0, cfgInfo = { name: 'UACE', version: VER };
let obsSession = null, obsResult = null;
const els = {};
const metrics = { reconRuns: 0, obsRuns: 0, structCopied: false, agentCopied: false, downloads: 0, zipMade: false };
const ce = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const bind = (t, fn, tgt) => { const w = tgt || window; w.addEventListener(t, fn); clean.push(['l', t, fn, w]); };
const store = {
  load() { try { const o = JSON.parse(localStorage.getItem('pml_panel_v1') || '{}'); for (const k of ['theme', 'fs', 'motion', 'collapsed']) if (k in o) S[k] = o[k]; } catch (e) {} },
  save() { try { const s = JSON.stringify({ theme: S.theme, fs: S.fs, motion: S.motion, collapsed: S.collapsed, hotkeys: Object.keys(HK) }); if (s.length > 512) throw new Error('>512B'); localStorage.setItem('pml_panel_v1', s); } catch (e) { console.warn('[pml] store skip:', e && e.message); } } };

const CSS = `
.pml-root{position:fixed;right:16px;top:16px;width:360px;min-width:320px;max-width:480px;max-height:80vh;min-height:360px;display:flex;flex-direction:column;font-family:-apple-system,"Segoe UI",Roboto,"Noto Sans",Arial,sans-serif;font-size:var(--pml-fs);line-height:1.5;font-weight:400;background:var(--pml-bg);color:var(--pml-fg);border:1px solid var(--pml-line);border-radius:var(--pml-radius);box-shadow:0 8px 32px rgba(0,0,0,.25);z-index:2147483000;overflow:hidden}
.pml-badge44{position:fixed;right:16px;top:16px;width:44px;height:44px;border-radius:50%;border:2px solid var(--pml-ok);background:var(--pml-bg);color:var(--pml-fg);cursor:pointer;font:inherit;font-weight:600;display:flex;align-items:center;justify-content:center;z-index:2147483000}
.pml-hd{display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid var(--pml-line)}.pml-dot{width:10px;height:10px;border-radius:50%;background:var(--pml-ok);flex:none}
.pml-dot.run{background:var(--pml-accent)}.pml-dot.warn{background:var(--pml-warn)}.pml-dot.err{background:var(--pml-crit)}.pml-title{font-weight:600;margin-right:auto;max-width:48ch}
.pml-seg{display:flex;border:1px solid var(--pml-line);border-radius:8px;overflow:hidden}.pml-seg button{min-width:44px;min-height:44px;border:0;background:transparent;color:var(--pml-fg);cursor:pointer;font:inherit;padding:0 8px}
.pml-seg button[aria-checked="true"]{background:var(--pml-accent);color:var(--pml-accent-tx)}
.pml-btn{min-height:44px;min-width:44px;border:1px solid var(--pml-line);border-radius:8px;background:transparent;color:var(--pml-fg);cursor:pointer;font:inherit;padding:0 12px;text-align:left}.pml-btn:hover{border-color:var(--pml-accent)}.pml-btn:disabled{opacity:.5;cursor:default}
.pml-btn:focus-visible,.pml-seg button:focus-visible,.pml-tab:focus-visible,.pml-badge44:focus-visible{outline:2px solid var(--pml-ring);outline-offset:2px}
.pml-tabs{display:flex;border-bottom:1px solid var(--pml-line)}.pml-tab{flex:1;min-height:44px;border:0;background:transparent;color:var(--pml-fg-dim);font:inherit;cursor:pointer}
.pml-tab[aria-selected="true"]{color:var(--pml-accent);box-shadow:inset 0 -2px var(--pml-accent)}.pml-bd{flex:1;overflow:auto;padding:8px}.pml-sec{margin:8px 0 4px;font-weight:600}
.pml-row{display:flex;gap:8px;font-size:calc(var(--pml-fs) - 2px)}.pml-k{color:var(--pml-fg-dim);flex:none;max-width:48ch}.pml-v{word-break:break-all}
.pml-act{display:flex;flex-direction:column;gap:8px;padding:4px 0}.pml-log{display:flex;gap:8px;align-items:baseline;font-size:calc(var(--pml-fs) - 2px)}
.pml-lg{width:8px;height:8px;border-radius:50%;flex:none;align-self:center}.pml-lg.info{background:var(--pml-fg-dim)}.pml-lg.ok{background:var(--pml-ok)}.pml-lg.warn{background:var(--pml-warn)}.pml-lg.err{background:var(--pml-crit)}
.pml-ft{border-top:1px solid var(--pml-line);padding:4px 8px;display:flex;flex-direction:column;gap:4px}.pml-status{font-size:calc(var(--pml-fs) - 2px);min-height:1.4em}
.pml-ft details,.pml-bd details{font-size:calc(var(--pml-fs) - 2px)}.pml-ft summary,.pml-bd summary{cursor:pointer;min-height:28px;display:flex;align-items:center}
.pml-root,.pml-btn,.pml-seg button,.pml-tab{transition:background-color .15s,color .15s,border-color .15s}.pml-motion-off *{transition:none!important;animation:none!important}
input[type=range]{accent-color:var(--pml-accent);min-height:44px}input[type=checkbox]{width:44px;height:44px;accent-color:var(--pml-accent)}
`;

/* ===================== МОДУЛЬ I · РАЗВЕДКА (канон r2: столбец UPOLY, конверты №2/№3) ===================== */
const CAP = { groups: 12, landmarks: 20, containers: 5, mountPoints: 8, persistentPaths: 8, nodes: 5000 };
const RECON_BUDGET_MS = 150;   // I.8.1: блокировка ≤150 мс
const OBS_WINDOW_MS = 60000;   // окно 60 с (r1; 10-с окно 27.4.0 отозвано)

const pathSegs = el => { // сегменты от body (без body/html) — формат столбца UPOLY
  const segs = []; let n = el;
  while (n && n.nodeType === 1 && n.tagName !== 'BODY' && n.tagName !== 'HTML') {
    let i = 1, s = n;
    while ((s = s.previousElementSibling)) if (s.tagName === n.tagName) i++;
    segs.unshift(n.tagName.toLowerCase() + (i > 1 ? ':nth(' + i + ')' : ''));
    n = n.parentElement;
  }
  return ['body'].concat(segs);
};
const pathOf = el => {                         // структурный путь ≤120 симв. (r1 §0): nth(i) только при i>1
  const segs = pathSegs(el).slice(1);
  let p = 'body' + (segs.length ? '>' + segs.join('>') : '');
  if (p.length > 120) p = '~' + p.slice(-119); // усечение слева, хвост глубже важнее
  return p;
};
const prefixPath = (el, d) => pathSegs(el).slice(0, d).join('>');
const sigOf = el => {                          // r2 §5: pre-order теги ВЕРХНИМ регистром через '>', глубина ≤3
  const out = [];
  (function walk(n, d) {
    if (!n || n.nodeType !== 1 || d > 3) return;
    out.push(n.tagName.toUpperCase());
    for (let c = n.firstElementChild; c; c = c.nextElementSibling) walk(c, d + 1);
  })(el, 1);
  return out.join('>');
};
const sigHash = el => hex8(FNV1a32(sigHashIn(sigOf(el))));
const subtreeDepth = (el, cap) => {            // фактическая глубина поддерева (cap 6)
  let max = 1;
  (function walk(n, cur) {
    if (cur > cap) return;
    for (let c = n.firstElementChild; c; c = c.nextElementSibling) { max = Math.max(max, cur + 1); walk(c, cur + 1); }
  })(el, 1);
  return max;
};
const median = arr => {                        // медиана целых; null если пусто
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

function pickPrimary(all, vh) {                // I-2: каскад primary (I.3.2) + контейнеры — столбец UPOLY
  const cands = [];
  for (const el of all) {
    if (el.scrollHeight <= el.clientHeight + 4) continue;
    let ov = 'visible';
    try { ov = getComputedStyle(el).overflowY; } catch (e) {}
    if (ov !== 'auto' && ov !== 'scroll' && ov !== 'overlay') continue;
    let main = false;
    try { main = !!el.closest('main,[role="main"]'); } catch (e) {}
    cands.push({ el, path: pathOf(el), clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, visibleShare: el.clientHeight / vh, insideMain: main });
  }
  cands.sort((a, b) => b.visibleShare - a.visibleShare || b.scrollHeight - a.scrollHeight || b.clientHeight - a.clientHeight || (b.insideMain - a.insideMain) || (a.path < b.path ? -1 : 1));
  return { primary: cands[0] || null, containers: cands.slice(0, CAP.containers).map(c => ({ path: c.path, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight })), truncated: cands.length > CAP.containers };
}
function findGroups(all, primaryPath, deadline) {   // I-1: модальная группа на родителя — столбец UPOLY (+ inPrimary r2 3-a)
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
    let pr;
    try { pr = parent.getBoundingClientRect(); } catch (e) { continue; }
    let sumH = 0, ok = true;
    for (const k of best.arr) {
      const r = k.getBoundingClientRect();
      if (r.height < 32) { ok = false; break; }   // I.2.3: каждый ребёнок ≥32px
      sumH += r.height;
    }
    if (!ok || sumH < 0.4 * pr.height) continue;  // отсечение toolbar/иконочных рядов
    out.push({ sigHash: best.h, count: best.arr.length, depth: subtreeDepth(best.arr[0], 6), uniformity: hx(u), samplePath: pathOf(best.arr[0]), parentPath: pathOf(parent), inPrimary: !!primaryPath && (pathOf(best.arr[0]) === primaryPath || pathOf(best.arr[0]).startsWith(primaryPath + '>')), el: best.arr[0] });
  }
  out.sort((a, b) => b.count * b.uniformity - a.count * a.uniformity || (a.parentPath < b.parentPath ? -1 : 1)); // I.2.5
  return out;
}
function findMounts(all, vh, deadline) {            // I-4a: кандидаты монтирования — столбец UPOLY + свои узлы вне
  const out = [];
  for (const el of all) {
    if (performance.now() > deadline) { out.budgetHit = true; break; }
    if (host && (el === host || host.contains(el))) continue;   // свои узлы исключены
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
function findLandmarks(all) {                   // C3 (позиция B на r2): структурные теги + ландмарк-роли, без role=button
  const out = [];
  const tags = { MAIN: 1, NAV: 1, HEADER: 1, FOOTER: 1, ASIDE: 1 };
  const roles = ['banner', 'main', 'navigation', 'complementary', 'contentinfo', 'search', 'region', 'form'];
  for (const el of all) {
    const role = el.getAttribute('role');
    if (!tags[el.tagName] && roles.indexOf(role) < 0) continue;
    out.push({ tag: el.tagName.toLowerCase(), role: role || null, path: pathOf(el) });
  }
  return out;
}
function scanSync() {                           // один обход от body (свой хост вне body — самоисключение), бюджет ≤150 мс
  const t0 = performance.now();
  const bodyEl = document.body;
  if (!bodyEl) return { all: [], vh: innerHeight || 800, blockCount: 0, maxDepth: 0, sc: { primary: null, containers: [], truncated: false }, groups: [], mounts: [], landmarks: [], truncatedDom: false, elapsed: 0 };
  const every = bodyEl.querySelectorAll('*');
  const all = [...every].slice(0, CAP.nodes);
  const vh = innerHeight || 800;
  let blockCount = 0, maxDepth = 0;
  (function w(n, d) { if (!n || n.nodeType !== 1) return; blockCount++; maxDepth = Math.max(maxDepth, d); for (let c = n.firstElementChild; c; c = c.nextElementSibling) w(c, d + 1); })(bodyEl, 1);
  const sc = pickPrimary(all, vh);
  const deadline = t0 + RECON_BUDGET_MS;
  const groups = findGroups(all, sc.primary ? sc.primary.path : null, deadline);
  const mounts = findMounts(all, vh, deadline);
  const landmarks = findLandmarks(all);
  const budgetHit = !!(groups.budgetHit || mounts.budgetHit);
  return { all, vh, blockCount, maxDepth, sc, groups, mounts, landmarks, truncatedDom: every.length > CAP.nodes || budgetHit, elapsed: Math.round(performance.now() - t0) };
}
function scoreGroup(g) {                        // r2 §2: чистая формула «кандидат → вес-факты»
  const u = Math.round(100 * Math.max(0, Math.min(1, (g.uniformity - 0.6) / 0.4)));
  const c = Math.round(100 * Math.min(1, g.count / 40));
  const p = g.inPrimary ? 100 : 0;
  const s = Math.round(100 * Math.max(0, Math.min(1, 1 - g.ratio)));
  const l = g.hasLandmark ? 100 : 0;
  return { u, c, p, s, l, confidence: Math.round(0.35 * u + 0.25 * c + 0.20 * p + 0.10 * s + 0.10 * l) };
}
function resolveRecon(scored) {                 // r2 §3: гейты G1–G4 → found/no-data
  const ok = scored.filter(x => x.inPrimary && x.count >= 6 && x.depth >= 2).sort((a, b) => b.confidence - a.confidence || (a.samplePath < b.samplePath ? -1 : 1));
  if (!ok.length || ok[0].confidence < 75) return { status: 'no-data' };
  const second = ok[1];
  if (second && ok[0].confidence - second.confidence < 15 && second.confidence >= 50) return { status: 'no-data' };
  const t = ok[0];
  return { status: 'found', candidate: { path: t.samplePath, sigHash: t.sigHash, inPrimary: true, confidence: t.confidence, basis: { u: t.u, c: t.c, p: t.p, s: t.s, l: t.l } } };
}
function buildStruct() {                        // конверт r1 (+inPrimary, recon по r2) — форма столбца UPOLY
  const s = scanSync();
  const primary = s.sc.primary;
  const raw = s.groups.slice(0, CAP.groups).map(g => {
    const g2 = { sigHash: g.sigHash, count: g.count, depth: g.depth, uniformity: g.uniformity, samplePath: g.samplePath, inPrimary: g.inPrimary };
    g2.ratio = primary ? hx(primary.clientHeight / primary.scrollHeight) : 1;
    try { g2.hasLandmark = !!g.el.closest('main,[role="main"],[role="feed"],[role="log"]'); } catch (e) { g2.hasLandmark = false; }
    return Object.assign(g2, scoreGroup(g2));
  });
  const struct = {
    structVersion: 'r1',
    meta: { ts: Math.round(performance.now() - T0), viewport: { w: innerWidth, h: innerHeight }, dpr: hx(devicePixelRatio || 1), urlHash: hex8(FNV1a32(urlHashIn(location.href))) },
    dom: { maxDepth: s.maxDepth, blockCount: s.blockCount, landmarks: s.landmarks.slice(0, CAP.landmarks), groups: raw.map(g => ({ sigHash: g.sigHash, count: g.count, depth: g.depth, uniformity: g.uniformity, samplePath: g.samplePath, inPrimary: g.inPrimary })), truncated: s.truncatedDom || s.groups.length > CAP.groups || s.landmarks.length > CAP.landmarks },
    scroll: primary ? { primary: { path: primary.path, scrollHeight: primary.scrollHeight, clientHeight: primary.clientHeight, ratio: hx(primary.clientHeight / primary.scrollHeight) }, containers: s.sc.containers, truncated: s.sc.truncated } : 'no-scroll-container',
    mut: obsResult ? obsResult.mut : { window: 60, adds: 0, removes: 0, recycles: 0, medianIntervalMs: null, streamCandidate: null },
    anchors: { mountPoints: s.mounts.slice(0, CAP.mountPoints).map(m => ({ path: m.path, mode: m.mode, h: m.h })), persistentPaths: obsResult ? obsResult.persistent : [], stability: obsResult ? obsResult.stability : 0, truncated: s.mounts.length > CAP.mountPoints || (obsResult ? obsResult.persistentTruncated : false) }
  };
  struct.recon = resolveRecon(raw);             // r2 §1.2: рендереры r1 ключ игнорируют
  lastElapsed = s.elapsed;
  return struct;
}
/* ===================== УСВОЕНИЕ ЛАНДШАФТА 27.5.0 (аддитивно; вне хэш-конверта r2 §5) =====================
   Все функции работают ТОЛЬКО от уже собранного struct (0 новых обращений к DOM-тексту — §15).
   Ни одно поле канонного struct не меняется; sigHash/urlHash не затронуты (канон-векторы прежние). */
const structFeatures = st => { // фичи simhash: landmarks ×3, группы ×2, точки монтажа ×1 (веса важности)
  const f = [];
  ((st.dom && st.dom.landmarks) || []).forEach(l => f.push({ k: 'L:' + l.tag + '|' + (l.role || '') + '|' + l.path, w: 3 }));
  ((st.dom && st.dom.groups) || []).forEach(g => f.push({ k: 'G:' + g.sigHash + '|' + g.count, w: 2 }));
  ((st.anchors && st.anchors.mountPoints) || []).forEach(m => f.push({ k: 'M:' + m.path + '|' + m.mode, w: 1 }));
  if (!f.length) f.push({ k: 'EMPTY', w: 1 });
  return f;
};
const domSim64 = st => simhash64(structFeatures(st));            // hex16; детерминирован на равном struct
const simBetween = (a, b) => hammingHex(domSim64(a), domSim64(b)); // биты Хэмминга; 0 = идентичный каркас
const agentView = st => { // формат Playwright MCP a11y-снапшота (2025–2026): «- роль [ref=eN] …» — но БЕЗ имён (§15)
  const v = st || lastStruct || buildStruct(), L = [];
  L.push('- page urlHash=' + ((v.meta && v.meta.urlHash) || '?') + ' ratio=' + ((v.scroll && v.scroll.primary && v.scroll.primary.ratio) != null ? v.scroll.primary.ratio : 'n/a'));
  ((v.dom && v.dom.landmarks) || []).forEach((l, i) => L.push('- ' + (l.role || l.tag) + ' [ref=l' + (i + 1) + '] path=' + l.path));
  ((v.dom && v.dom.groups) || []).forEach((g, i) => L.push('- group ' + g.sigHash + ' [ref=g' + (i + 1) + '] x' + g.count + ' depth=' + g.depth + (g.inPrimary ? ' in-primary' : '')));
  ((v.anchors && v.anchors.mountPoints) || []).forEach((m, i) => L.push('- mount ' + m.mode + ' [ref=m' + (i + 1) + '] h=' + m.h + ' path=' + m.path));
  if (v.recon && v.recon.status === 'found') L.push('- candidate ' + v.recon.candidate.sigHash + ' conf=' + v.recon.candidate.confidence);
  return L.join('\n');
};
const downsample = (st, budget) => { // D2Snap (arXiv 08.2025): coverage + selection под бюджет; детерминированно
  const B = Math.max(60, budget == null ? 400 : budget | 0), items = [];
  const push = (prio, line) => items.push({ prio, line, cost: Math.ceil(line.length / 4) }); // «токен» ≈ 4 символа
  push(0, 'page ' + ((st.meta && st.meta.urlHash) || '?'));
  ((st.dom && st.dom.landmarks) || []).forEach((l, i) => push(1, (l.role || l.tag) + ' [ref=l' + (i + 1) + '] ' + l.path));
  ((st.anchors && st.anchors.mountPoints) || []).forEach((m, i) => push(2, 'mount ' + m.mode + ' h' + m.h + ' ' + m.path));
  ((st.dom && st.dom.groups) || []).forEach((g, i) => push(3, 'group ' + g.sigHash + ' x' + g.count + ' d' + g.depth + (g.inPrimary ? ' *' : '') + ' ' + g.samplePath));
  items.sort((a, b) => a.prio - b.prio); // стабильная сортировка: внутри приоритета — канонный порядок struct
  const kept = []; let used = 0, dropped = 0;
  for (const it of items) if (used + it.cost <= B) { kept.push(it.line); used += it.cost; } else dropped++;
  if (dropped) kept.push('… +' + dropped + ' узлов за бюджетом ' + B);
  return { view: kept.join('\n'), used, budget: B, dropped };
};
const compareStructs = (a, b) => { // Broder/minhash-линейка (1997): точный Jaccard по sigHash групп (наборы ≤12)
  const ga = new Set(((((a || {}).dom || {}).groups) || []).map(g => g.sigHash));
  const gb = new Set(((((b || {}).dom || {}).groups) || []).map(g => g.sigHash));
  let inter = 0; for (const h of ga) if (gb.has(h)) inter++;
  const union = ga.size + gb.size - inter;
  return { jaccard: union ? hx(inter / union) : 1, sim: simBetween(a, b), inter, groupsA: ga.size, groupsB: gb.size };
};
/* ---- I-3 + I-4b: пассивное окно 60 с; Esc — стоп; снапшот 0 + каждые 10 с (столбец UPOLY) ---- */
function startObservation() {
  if (obsSession) return;
  if (!document.body) { log('err', 'нет document.body — наблюдение отменено'); status('наблюдение: нет body'); return; }
  metrics.obsRuns++;
  const s = { adds: 0, removes: 0, recycles: 0, sigBudget: 500, aborted: false, byPath: new Map(), addIntervals: new Map(), lastAdd: new Map(), removedSigs: new Map(), snapshots: [], navEvents: 0, pausedMs: 0, hiddenAt: 0 };
  s.endsAt = Date.now() + OBS_WINDOW_MS;
  obsSession = s;
  setBadge('run');
  status('Наблюдение: осталось 60 с');
  log('info', 'окно наблюдения 60 с запущено (Esc — стоп)');
  s.observer = new MutationObserver(muts => {
    for (const m of muts) {
      const p = m.target && m.target.nodeType === 1 ? prefixPath(m.target, 4) : 'body';
      let rec = s.byPath.get(p);
      if (!rec) { rec = { adds: 0, removes: 0, net: 0 }; s.byPath.set(p, rec); }
      for (const n of m.addedNodes) if (n.nodeType === 1) {
        s.adds++; rec.adds++; rec.net++;
        const t = performance.now(), last = s.lastAdd.get(p);
        if (last != null) { const a = s.addIntervals.get(p) || []; a.push(Math.round(t - last)); s.addIntervals.set(p, a); }
        s.lastAdd.set(p, t);
        if (s.sigBudget > 0) {
          s.sigBudget--;
          const h = sigHash(n), set = s.removedSigs.get(p);
          if (set && set.has(h)) { s.recycles++; set.delete(h); }   // I.4.4: remove→add с равным sigHash
        }
      }
      for (const n of m.removedNodes) if (n.nodeType === 1) {
        s.removes++; rec.removes--; rec.net--;
        if (s.sigBudget > 0) { const set = s.removedSigs.get(p) || s.removedSigs.set(p, new Set()).get(p); if (set.size < 50) set.add(sigHash(n)); }
      }
    }
  });
  s.observer.observe(document.body, { childList: true, subtree: true, characterData: false, attributes: false });
  const snap = () => { const set = new Set(); (function w(n, d) { if (!n || n.nodeType !== 1 || d > 4 || set.size >= 300) return; if (!host || n !== host) { set.add(pathOf(n)); for (let c = n.firstElementChild; c; c = c.nextElementSibling) w(c, d + 1); } })(document.body, 1); s.snapshots.push(set); };
  s.snap = snap; snap();                         // I.5.2: снапшот 0 + каждые 10 с, глубина ≤4, cap 300
  s.snapTimer = setInterval(() => { if (!document.hidden && s.snapshots.length < 30) snap(); }, 10000);
  s.navHandler = () => { s.navEvents++; snap(); };
  s.op = history.pushState; s.orp = history.replaceState;
  history.pushState = function () { s.navHandler(); return s.op.apply(this, arguments); };
  history.replaceState = function () { s.navHandler(); return s.orp.apply(this, arguments); };
  addEventListener('popstate', s.navHandler);
  s.visHandler = () => { if (document.hidden) s.hiddenAt = Date.now(); else if (s.hiddenAt) { s.pausedMs += Date.now() - s.hiddenAt; s.hiddenAt = 0; } };
  document.addEventListener('visibilitychange', s.visHandler);
  s.tick = setInterval(() => {
    const left = Math.max(0, Math.ceil((s.endsAt + s.pausedMs - Date.now()) / 1000));
    status('Наблюдение: осталось ' + left + ' с');
    if (left <= 0) finishObservation(false);
  }, 1000);
}
function finishObservation(aborted, silent) {
  const s = obsSession;
  if (!s) return;
  obsSession = null;
  clearInterval(s.tick); clearInterval(s.snapTimer);
  s.observer.disconnect();
  document.removeEventListener('visibilitychange', s.visHandler);
  removeEventListener('popstate', s.navHandler);
  history.pushState = s.op; history.replaceState = s.orp;
  const top = [...s.byPath.entries()].sort((a, b) => b[1].adds - a[1].adds)[0];
  const med = top ? median(s.addIntervals.get(top[0]) || []) : null;
  const stream = top ? (top[1].adds >= 3 && top[1].net > 0 && med !== null && med >= 50 && med <= 5000) : false; // I.4.3
  obsResult = {
    mut: { window: 60, adds: s.adds, removes: s.removes, recycles: s.recycles, medianIntervalMs: med, streamCandidate: stream },
    persistent: [], stability: 0, persistentTruncated: false
  };
  if (s.snapshots.length) {                      // I.5.2: присутствуют в ≥90% снапшотов
    const total = s.snapshots.length, cnt = new Map();
    for (const set of s.snapshots) for (const p of set) cnt.set(p, (cnt.get(p) || 0) + 1);
    const per = [...cnt.entries()].filter(x => x[1] / total >= 0.9).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    obsResult.persistent = per.slice(0, CAP.persistentPaths).map(x => x[0]);
    obsResult.persistentTruncated = per.length > CAP.persistentPaths;
    obsResult.stability = hx(obsResult.persistent.length / Math.max(1, Math.min(s.snapshots[0].size, 20)));
  }
  if (!silent) {                                 // silent: pagehide — авто-разведка при выгрузке глушится (мелочь B-6)
    if (aborted) log('warn', 'наблюдение прервано (Esc): частичный отчёт принят');
    else log('ok', 'наблюдение завершено: adds ' + s.adds + ', recycles ' + s.recycles + ', поток ' + (stream ? 'да' : 'нет'));
    status(aborted ? 'Наблюдение прервано' : 'Наблюдение завершено');
    Promise.resolve().then(runRecon).catch(e => log('err', 'авто-разведка: ' + (e && e.message))); // E1-гигиена: рендер терпит обе формы scroll
  }
}
function abortObservation() { if (obsSession) finishObservation(true, false); }

/* ===================== РЕЕСТР ДЕЙСТВИЙ · экспорт struct (канал ЧК-1/Ф2) ===================== */
function copyText(text, okMsg) {                 // 0 внешних запросов: clipboard API, fallback execCommand
  const done = () => { status(okMsg); log('ok', okMsg); };
  const fail = () => { status('копирование недоступно'); log('warn', 'буфер обмена недоступен'); };
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
async function runRecon() {                      // сборка struct r1: мгновенная (≤150 мс); мутации — отдельным окном
  metrics.reconRuns++;
  setBadge('run');
  lastStruct = buildStruct();
  renderRecon(lastStruct);
  setBadge(obsSession ? 'run' : 'ok');
  const r = lastStruct.recon;
  log('ok', 'разведка ' + lastElapsed + ' мс: групп ' + lastStruct.dom.groups.length + ', резерв: ' + (r.status === 'found' ? 'found ' + r.candidate.confidence : r.status));
  status('Разведка ' + lastElapsed + ' мс · резерв ' + r.status);
}
function copyStruct() { metrics.structCopied = true; copyText(JSON.stringify(lastStruct || buildStruct(), null, 1), 'struct скопирован (JSON)'); }
function copyAgentView() { metrics.agentCopied = true; copyText(agentView(lastStruct || buildStruct()), 'agent-view скопирован (a11y-скелет без имён, §15)'); }
/* ===================== ЭКСПОРТ-ПАКЕТ 27.6.0 · ВОЗВРАТ СРЕЗАННОГО (аддитивно, 27.5.0 не тронута) =====================
   Канал файлов — Blob + URL.createObjectURL + <a download>; 0 внешних запросов (§15).
   ZIP — инлайновый райтер (CRC32 + STORE); канон хоткеев §13 не тронут — новые действия кнопками. */
const fileStamp = ext => 'uace-' + VER + '-struct-' + hex8(FNV1a32(urlHashIn(location.href))) + '-' +
  new Date().toISOString().slice(11, 19).replace(/:/g, '') + '.' + ext;
const txtBlob = (s, mime) => new Blob([s], { type: mime || 'text/plain;charset=utf-8' });
function downloadFile(name, blob, okMsg) {
  try {
    const url = URL.createObjectURL(blob), a = ce('a');
    a.href = url; a.download = name;
    (document.body || document.documentElement).appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    metrics.downloads++; status(okMsg); log('ok', okMsg + ' → ' + name);
  } catch (e) { status('выгрузка недоступна'); log('warn', 'выгрузка не удалась: ' + (e && e.message)); }
}
const structToText = st => { // человекочитаемый TXT — тикеты/чаты; собирается ТОЛЬКО из struct (§15)
  const v = st || lastStruct || buildStruct(), MT = v.meta || { urlHash: '?', ts: 0, viewport: { w: 0, h: 0 }, dpr: '?' },
    D = v.dom || {}, M = v.mut || {}, A = v.anchors || {}, L = [];
  const sec = t => { L.push('', '-- ' + t + ' ' + '-'.repeat(Math.max(1, 48 - t.length))); };
  L.push('UACE ' + VER + ' · PML-STRUCT r1 · TXT-отчёт');
  L.push('='.repeat(56));
  L.push('urlHash  : ' + MT.urlHash);
  L.push('момент   : +' + MT.ts + ' мс от старта');
  L.push('viewport : ' + MT.viewport.w + 'x' + MT.viewport.h + ' @dpr ' + MT.dpr);
  L.push('соль     : ' + SALT + ' (контракт PML-STRUCT r1+r2)');
  sec('Каркас (I-1)');
  L.push('maxDepth ' + D.maxDepth + ' · blockCount ' + D.blockCount + (D.truncated ? ' · УСЕЧЕНО' : ''));
  (D.landmarks || []).forEach(l => L.push('  ' + l.tag + (l.role ? '[' + l.role + ']' : '') + ' ' + l.path));
  (D.groups || []).forEach(g => L.push('  ' + g.sigHash + ' x' + g.count + ' глуб.' + g.depth + ' однород.' + g.uniformity + (g.inPrimary ? ' [скролл]' : '') + ' ' + g.samplePath));
  sec('Скролл (I-2)');
  if (v.scroll && v.scroll.primary && v.scroll.primary.path) {
    L.push('primary  : ' + v.scroll.primary.path + ' ratio ' + v.scroll.primary.ratio + ' (' + v.scroll.primary.scrollHeight + '/' + v.scroll.primary.clientHeight + ')');
    (v.scroll.containers || []).forEach(c => L.push('  контейнер: ' + c.path + ' ' + c.scrollHeight + '/' + c.clientHeight));
  } else L.push('no-scroll-container');
  sec('Мутации (I-3)');
  L.push('окно ' + (M.window == null ? '—' : M.window) + ' с · adds ' + (M.adds || 0) + ' · removes ' + (M.removes || 0) + ' · рециклы ' + (M.recycles || 0) + ' · медиана ' + (M.medianIntervalMs == null ? '—' : M.medianIntervalMs) + ' мс · поток: ' + (M.streamCandidate ? 'да' : 'нет'));
  sec('Якоря (I-4)');
  (A.mountPoints || []).forEach(m => L.push('  ' + m.path + ' ' + m.mode + ' h' + m.h));
  L.push('стойких путей: ' + (A.persistentPaths || []).length + ' · стабильность ' + (A.stability == null ? '—' : A.stability));
  sec('Резерв (r2 §3)');
  if (v.recon && v.recon.status === 'found') L.push('кандидат ' + v.recon.candidate.path + ' · sigHash ' + v.recon.candidate.sigHash + ' · confidence ' + v.recon.candidate.confidence);
  else L.push('no-data (консервативный отказ)');
  return L.join('\n') + '\n';
};
const structToMarkdown = st => { // отчёт .md — таблицы для PR/вики/чатов
  const v = st || lastStruct || buildStruct(), MT = v.meta || { urlHash: '?', ts: 0, viewport: { w: 0, h: 0 }, dpr: '?' },
    D = v.dom || {}, M = v.mut || {}, A = v.anchors || {}, L = [];
  L.push('# UACE ' + VER + ' · PML-STRUCT r1 — отчёт Markdown', '');
  L.push('- **urlHash:** `' + MT.urlHash + '`');
  L.push('- **Момент:** +' + MT.ts + ' мс от старта');
  L.push('- **Viewport:** ' + MT.viewport.w + '×' + MT.viewport.h + ' @dpr ' + MT.dpr);
  L.push('- **Соль FNV-1a:** `' + SALT + '` · контракт r1+r2', '');
  L.push('## Каркас (I-1)', '');
  L.push('maxDepth **' + D.maxDepth + '** · blockCount **' + D.blockCount + '**' + (D.truncated ? ' · УСЕЧЕНО' : ''));
  if ((D.landmarks || []).length) {
    L.push('', '| тег | роль | путь |', '|---|---|---|');
    D.landmarks.forEach(l => L.push('| ' + l.tag + ' | ' + (l.role || '—') + ' | `' + l.path + '` |'));
  } else L.push('', '_ландмарков нет_');
  if ((D.groups || []).length) {
    L.push('', '### Группы (I-1, скоринг r2 §2)', '', '| sigHash | × | глуб. | однород. | inPrimary | образец |', '|---|---|---|---|---|---|');
    D.groups.forEach(g => L.push('| `' + g.sigHash + '` | ' + g.count + ' | ' + g.depth + ' | ' + g.uniformity + ' | ' + (g.inPrimary ? 'да' : 'нет') + ' | `' + g.samplePath + '` |'));
  } else L.push('', '_групп не найдено_');
  L.push('', '## Скролл (I-2)', '');
  if (v.scroll && v.scroll.primary && v.scroll.primary.path) {
    L.push('primary: `' + v.scroll.primary.path + '` · ratio **' + v.scroll.primary.ratio + '** · ' + v.scroll.primary.scrollHeight + '/' + v.scroll.primary.clientHeight);
    if ((v.scroll.containers || []).length) {
      L.push('', '| контейнер | scroll/client |', '|---|---|');
      v.scroll.containers.forEach(c => L.push('| `' + c.path + '` | ' + c.scrollHeight + '/' + c.clientHeight + ' |'));
    }
  } else L.push('no-scroll-container');
  L.push('', '## Мутации (I-3)', '');
  L.push('окно ' + (M.window == null ? '—' : M.window) + ' с · adds ' + (M.adds || 0) + ' · removes ' + (M.removes || 0) + ' · рециклы ' + (M.recycles || 0) + ' · медиана ' + (M.medianIntervalMs == null ? '—' : M.medianIntervalMs + ' мс') + ' · поток: ' + (M.streamCandidate ? 'да' : 'нет'));
  L.push('', '## Якоря (I-4)', '');
  if ((A.mountPoints || []).length) {
    L.push('', '| точка монтажа | режим | h |', '|---|---|---|');
    A.mountPoints.forEach(m => L.push('| `' + m.path + '` | ' + m.mode + ' | ' + m.h + ' |'));
  } else L.push('точек монтажа: 0');
  L.push('', 'стойких путей: ' + (A.persistentPaths || []).length + ' · стабильность ' + (A.stability == null ? '—' : A.stability));
  L.push('', '## Резерв (r2 §3)', '');
  if (v.recon && v.recon.status === 'found') L.push('кандидат `' + v.recon.candidate.path + '` · sigHash `' + v.recon.candidate.sigHash + '` · confidence **' + v.recon.candidate.confidence + '**');
  else L.push('no-data (консервативный отказ)');
  return L.join('\n') + '\n';
};
const escH = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const structToHTML = st => { // автономный HTML-отчёт: инлайн-CSS, 0 внешних запросов (§15)
  const v = st || lastStruct || buildStruct(), MT = v.meta || { urlHash: '?', ts: 0, viewport: { w: 0, h: 0 }, dpr: '?' },
    D = v.dom || {}, M = v.mut || {}, A = v.anchors || {}, e = escH;
  const rows = arr => arr.map(r => '<tr>' + r.map(c => '<td>' + e(c) + '</td>').join('') + '</tr>').join('');
  const tbl = (head, body) => '<table><thead><tr>' + head.map(h => '<th>' + e(h) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>';
  const r = v.recon && v.recon.status === 'found' ? v.recon.candidate : null;
  return '<!doctype html>\n<html lang="ru"><head><meta charset="utf-8"><title>UACE ' + e(VER) + ' · PML-STRUCT ' + e(MT.urlHash) + '</title>\n'
    + '<style>body{font:14px/1.5 -apple-system,"Segoe UI",Roboto,"Noto Sans",Arial,sans-serif;margin:0;background:#121821;color:#e6ebf2;padding:24px}'
    + 'h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #2a3441;padding-bottom:4px}'
    + '.m{color:#9aa8ba;font-size:12px;margin:0 0 16px}table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}'
    + 'th,td{border:1px solid #2a3441;padding:4px 8px;text-align:left;vertical-align:top}th{background:#1a2230;color:#9aa8ba;font-weight:600}'
    + 'code{background:#1a2230;padding:1px 5px;border-radius:4px;font-size:12px}.dim{color:#9aa8ba}</style></head>\n<body>\n'
    + '<h1>UACE ' + e(VER) + ' · PML-STRUCT r1 — HTML-отчёт</h1>\n'
    + '<p class="m">urlHash <code>' + e(MT.urlHash) + '</code> · момент +' + e(MT.ts) + ' мс · viewport ' + e(MT.viewport.w + '×' + MT.viewport.h) + ' @dpr ' + e(MT.dpr) + ' · автономный файл: 0 внешних запросов, текст страницы не читался (§15)</p>\n'
    + '<h2>Каркас (I-1)</h2>' + (D.maxDepth != null ? '<p>maxDepth ' + e(D.maxDepth) + ' · blockCount ' + e(D.blockCount) + (D.truncated ? ' · усечено' : '') + '</p>' : '')
    + ((D.landmarks || []).length ? tbl(['тег', 'роль', 'путь'], rows(D.landmarks.map(l => [l.tag, l.role || '—', l.path]))) : '<p class="dim">ландмарков нет</p>')
    + '<h2>Группы (I-1 · скоринг r2 §2)</h2>'
    + ((D.groups || []).length ? tbl(['sigHash', '×', 'глуб.', 'однород.', 'inPrimary', 'образец'], rows(D.groups.map(g => [g.sigHash, g.count, g.depth, g.uniformity, g.inPrimary ? 'да' : 'нет', g.samplePath]))) : '<p class="dim">групп не найдено</p>')
    + '<h2>Скролл (I-2)</h2>'
    + (v.scroll && v.scroll.primary && v.scroll.primary.path
      ? '<p>primary <code>' + e(v.scroll.primary.path) + '</code> · ratio ' + e(v.scroll.primary.ratio) + ' · ' + e(v.scroll.primary.scrollHeight + '/' + v.scroll.primary.clientHeight) + '</p>'
        + ((v.scroll.containers || []).length ? tbl(['контейнер', 'scroll/client'], rows(v.scroll.containers.map(c => [c.path, c.scrollHeight + '/' + c.clientHeight]))) : '')
      : '<p class="dim">no-scroll-container</p>')
    + '<h2>Мутации (I-3)</h2><p>окно ' + e(M.window == null ? '—' : M.window) + ' с · adds ' + e(M.adds || 0) + ' · removes ' + e(M.removes || 0)
    + ' · рециклы ' + e(M.recycles || 0) + ' · медиана ' + e(M.medianIntervalMs == null ? '—' : M.medianIntervalMs + ' мс') + ' · поток: ' + e(M.streamCandidate ? 'да' : 'нет') + '</p>'
    + '<h2>Якоря (I-4)</h2>'
    + ((A.mountPoints || []).length ? tbl(['точка монтажа', 'режим', 'h'], rows(A.mountPoints.map(m => [m.path, m.mode, m.h]))) : '<p class="dim">точек монтажа нет</p>')
    + '<p>стойких путей: ' + e((A.persistentPaths || []).length) + ' · стабильность ' + e(A.stability == null ? '—' : A.stability) + '</p>'
    + '<h2>Резерв (r2 §3)</h2>'
    + (r ? '<p>кандидат <code>' + e(r.path) + '</code> · sigHash <code>' + e(r.sigHash) + '</code> · confidence ' + e(r.confidence) + '</p>' : '<p class="dim">no-data (консервативный отказ)</p>')
    + '<p class="m">UACE ' + e(VER) + ' · соль ' + e(SALT) + ' · контракт PML-STRUCT r1+r2</p>\n</body></html>\n';
};
const csvCell = x => { const s = String(x == null ? '' : x); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const structToCSV = st => { // таблица групп — Excel/Sheets; BOM впереди для корректной кириллицы
  const v = st || lastStruct || buildStruct(), L = ['sigHash,count,depth,uniformity,inPrimary,samplePath'];
  ((v.dom && v.dom.groups) || []).forEach(g => L.push([g.sigHash, g.count, g.depth, g.uniformity, g.inPrimary ? 1 : 0, g.samplePath].map(csvCell).join(',')));
  return '\uFEFF' + L.join('\r\n') + '\r\n';
};
const crcTbl = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcTbl[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function makeZip(entries) { // инлайновый ZIP-райтер: CRC32 + метод STORE + флаг UTF-8 0x0800 — внешних зависимостей НЕТ (§15)
  const enc = new TextEncoder(), now = new Date();
  const dT = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dD = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  const parts = [], cd = []; let off = 0;
  for (const en of entries) {
    const nm = enc.encode(en.name), data = enc.encode(en.text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dT, true); h.setUint16(12, dD, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, data);
    cd.push({ nm, crc, sz: data.length, off });
    off += 30 + nm.length + data.length;
  }
  const cdStart = off; let cdSize = 0;
  for (const c of cd) {
    const h = new DataView(new ArrayBuffer(46));
    h.setUint32(0, 0x02014b50, true); h.setUint16(4, 20, true); h.setUint16(6, 20, true);
    h.setUint16(8, 0x0800, true); h.setUint16(10, 0, true);
    h.setUint16(12, dT, true); h.setUint16(14, dD, true);
    h.setUint32(16, c.crc, true); h.setUint32(20, c.sz, true); h.setUint32(24, c.sz, true);
    h.setUint16(28, c.nm.length, true); h.setUint32(42, c.off, true);
    parts.push(new Uint8Array(h.buffer), c.nm);
    cdSize += 46 + c.nm.length;
  }
  const eo = new DataView(new ArrayBuffer(22));
  eo.setUint32(0, 0x06054b50, true);
  eo.setUint16(8, cd.length, true); eo.setUint16(10, cd.length, true);
  eo.setUint32(12, cdSize, true); eo.setUint32(16, cdStart, true);
  parts.push(new Uint8Array(eo.buffer));
  return new Blob(parts, { type: 'application/zip' });
}
const buildExportSet = st => { // весь пакет из ОДНОГО struct — единый срез данных для всех форматов
  const v = st || lastStruct || buildStruct();
  return [
    { name: fileStamp('json'), mime: 'application/json;charset=utf-8', text: JSON.stringify(v, null, 1), label: 'struct JSON' },
    { name: fileStamp('md'), mime: 'text/markdown;charset=utf-8', text: structToMarkdown(v), label: 'Markdown-отчёт' },
    { name: fileStamp('html'), mime: 'text/html;charset=utf-8', text: structToHTML(v), label: 'HTML-отчёт' },
    { name: fileStamp('txt'), mime: 'text/plain;charset=utf-8', text: structToText(v), label: 'TXT-отчёт' },
    { name: fileStamp('csv'), mime: 'text/csv;charset=utf-8', text: structToCSV(v), label: 'CSV групп' },
    { name: fileStamp('agentview.txt'), mime: 'text/plain;charset=utf-8', text: agentView(v), label: 'agent-view' }];
};
const dlOne = (e, tail) => downloadFile(e.name, txtBlob(e.text, e.mime), e.label + ' выгружен' + (tail || ''));
function downloadJSON() { dlOne(buildExportSet()[0]); }
function downloadMD() { dlOne(buildExportSet()[1]); }
function downloadHTML() { dlOne(buildExportSet()[2]); }
function downloadTXT() { dlOne(buildExportSet()[3]); }
function downloadCSV() { dlOne(buildExportSet()[4]); }
function downloadAgentView() { metrics.agentCopied = true; dlOne(buildExportSet()[5]); }
function downloadZip() { const set = buildExportSet(); metrics.zipMade = true;
  downloadFile(fileStamp('zip'), makeZip(set.map(e => ({ name: e.name, text: e.text }))), 'ZIP-бандл собран: ' + set.length + ' файлов (CRC32+STORE, 0 внешних запросов — §15)'); }
function stopAll() { if (obsSession) abortObservation(); else { status('стоп: нечего прерывать'); log('info', 'стоп: активного окна нет'); } }
function cycleTabs() { if (!els.tabs) return; const n = els.tabs.children.length;
  for (let i = 0; i < n; i++) if (els.tabs.children[i].getAttribute('aria-selected') === 'true') { els.tabs.children[(i + 1) % n].click(); return; }
  if (n) els.tabs.children[0].click(); }
function showPassport() { if (!els.pf) return; els.pf.open = true; els.pp.textContent = passportText().join('\n'); els.pf.scrollIntoView({ block: 'nearest' }); }

const renderRecon = st => { // рендер-контракт §2: известные секции, неизвестные ключи игнор; терпит ОБЕ формы scroll (E1)
  lastStruct = st; const box = els.recon; box.textContent = '';
  const row = (k, v) => { const r = ce('div', 'pml-row'); r.append(ce('span', 'pml-k', k), ce('span', 'pml-v', String(v))); box.append(r); };
  if (!st || typeof st !== 'object') { row('struct', 'нет данных'); return; }
  const found = x => x && x.source === 'backup' ? ' · резерв ' + x.confidence : '';
  const truncTxt = t => t === true ? 'да' : (t && t.length ? t.join(', ') : ''); // boolean (столбец UPOLY) и список (0-b) обе tolerated
  box.append(ce('div', 'pml-sec', 'Каркас (I-1)'));
  if (!st.dom) row('dom', 'нет данных'); else {
    row('maxDepth', st.dom.maxDepth); row('blockCount', st.dom.blockCount);
    (st.dom.landmarks || []).forEach(l => row('landmark', l.tag + (l.role ? '[' + l.role + ']' : '') + ' ' + l.path));
    (st.dom.groups || []).forEach(g => row('group', g.sigHash + ' ×' + g.count + ' глуб.' + g.depth + ' однород.' + g.uniformity + (g.inPrimary ? ' ✓скролл' : '') + (g.found ? found(g.found) : '')));
    (st.dom.groups || []).slice(0, 1).forEach(g => row('образец', g.samplePath));
    const t = truncTxt(st.dom.truncated); if (t) row('усечено', t); }
  box.append(ce('div', 'pml-sec', 'Скролл (I-2)'));
  if (!st.scroll) row('scroll', 'нет данных'); // двойной страж 27.4.2+ (FIX E1): канон-объект со строкой на primary + легаси-строка на уровне scroll
  else if (st.scroll === 'no-scroll-container' || st.scroll.primary === 'no-scroll-container') row('primary', 'no-scroll-container');
  else if (st.scroll.primary && st.scroll.primary.path) { row('primary', st.scroll.primary.path + ' ratio ' + st.scroll.primary.ratio);
    (st.scroll.containers || []).forEach(c => row('container', c.path + ' ' + c.scrollHeight + '/' + c.clientHeight + found(c.found)));
    const t2 = truncTxt(st.scroll.truncated); if (t2) row('усечено', t2); }
  else row('scroll', 'нет данных');
  box.append(ce('div', 'pml-sec', 'Мутации (I-3)'));
  if (!st.mut) row('mut', 'нет данных'); else { row('окно, с', st.mut.window); row('добавлено', st.mut.adds); row('удалено', st.mut.removes);
    row('рецикл', st.mut.recycles); row('медиана, мс', st.mut.medianIntervalMs == null ? 'нет данных' : st.mut.medianIntervalMs);
    row('поток?', st.mut.streamCandidate == null ? 'нет данных' : String(st.mut.streamCandidate)); }
  box.append(ce('div', 'pml-sec', 'Якоря (I-4)'));
  if (!st.anchors) row('anchors', 'нет данных'); else { row('точек монтажа', (st.anchors.mountPoints || []).length);
    (st.anchors.mountPoints || []).forEach(m => row('точка', m.path + ' ' + m.mode + ' h' + m.h));
    row('стойких путей', (st.anchors.persistentPaths || []).length); row('стабильность', st.anchors.stability);
    const t3 = truncTxt(st.anchors.truncated); if (t3) row('усечено', t3); }
  box.append(ce('div', 'pml-sec', 'Резерв (r2 §3)'));
  if (!st.recon) row('recon', 'нет данных');
  else if (st.recon.status === 'found') { row('кандидат', st.recon.candidate.path); row('sigHash', st.recon.candidate.sigHash); row('confidence', st.recon.candidate.confidence); }
  else row('статус', 'no-data (консервативный отказ)');
};

const passportText = () => ['Скрипт: ' + cfgInfo.name + ' v' + cfgInfo.version, 'Панель: PML-PANEL 1.0',
  'Тема: ' + S.theme + ' (эфф. ' + effTheme + ')',
  'Акцент: ' + (ACC ? 'rgb(' + ACC.rgb + ')' : '—') + ' / ' + (ACC ? ACC.source : '—') + ' / фон ' + (ACC ? ACC.ratioBg : '—') + ':1, текст ' + (ACC ? hx(ratio(ACC.rgb, ACC.tx)) : '—') + ':1',
  'Движение: ' + (S.motion ? 'вкл' : 'выкл') + '; кегль ' + S.fs,
  'Разведка: прогонов ' + metrics.reconRuns + ', наблюдений ' + metrics.obsRuns + ', struct ' + (metrics.structCopied ? 'копировался' : 'не копировался') + ', agent-view ' + (metrics.agentCopied ? 'копировался' : 'нет'),
  'Экспорт-пакет: выгрузок ' + metrics.downloads + ' (JSON/MD/HTML/TXT/CSV/agent-view)' + (metrics.zipMade ? ' · ZIP собирался' : ''),
  'Метрики: журнал ' + J.length + ', монтирование ' + mountMs + ' мс, последняя разведка ' + lastElapsed + ' мс',
  'Хоткеи: ' + (Object.keys(HK).map(k => 'Alt+' + k + ' — ' + HK[k].label).join('; ') || 'нет'),
  'Соль FNV-1a: ' + SALT + ' · контракт: PML-STRUCT r1+r2'];

const REG = [ // реестр ядра; канонный набор хоткеев E/D/C/S/X/I (§13); журнал и свёртка — только кнопками
  { id: 'observe', label: 'Наблюдение 60 с', hint: 'I-3/I-4b; Esc — стоп (Alt+D)', run: () => startObservation() },
  { id: 'copy-struct', label: 'Копировать struct', hint: 'JSON в буфер (Alt+C) — канал ЧК-1/Ф2', run: () => copyStruct() },
  { id: 'copy-agent', label: 'Копировать agent-view', hint: 'a11y-скелет для LLM-агента (формат Playwright MCP, без имён — §15); хоткей Alt+V предложен к r3', run: () => copyAgentView() },
  { id: 'dl-json', label: 'Скачать JSON', hint: 'файл struct.json — Blob+download, 0 сети (§15); экспорт-пакет 27.6.0', run: () => downloadJSON() },
  { id: 'dl-md', label: 'Скачать Markdown', hint: 'отчёт .md: таблицы ландмарков/групп/якорей — для PR/вики', run: () => downloadMD() },
  { id: 'dl-html', label: 'Скачать HTML-отчёт', hint: 'автономный .html, инлайн-CSS — 0 внешних запросов (§15)', run: () => downloadHTML() },
  { id: 'dl-txt', label: 'Скачать TXT', hint: 'текстовый отчёт для тикет-систем и чатов', run: () => downloadTXT() },
  { id: 'dl-csv', label: 'Скачать CSV групп', hint: 'sigHash/count/depth/uniformity/inPrimary — Excel/Sheets', run: () => downloadCSV() },
  { id: 'dl-agent', label: 'Скачать agent-view', hint: 'a11y-скелет файлом (дубль буферной копии)', run: () => downloadAgentView() },
  { id: 'dl-zip', label: 'Скачать ZIP-бандл', hint: 'все 6 форматов одним архивом — инлайновый CRC32+STORE (§15)', run: () => downloadZip() },
  { id: 'stop', label: 'Стоп', hint: 'прервать окно (Alt+S)', run: () => stopAll() },
  { id: 'copylog', label: 'Скопировать журнал', hint: 'Полный лог info/ok/warn/err — канал отчётов беты', run: async () => { copyText(J.map(j => '[' + j.t + '] ' + j.lv + ': ' + j.msg).join('\n'), 'журнал скопирован (' + J.length + ' записей)'); } },
  { id: 'tabs', label: 'Цикл вкладок', hint: 'Alt+X', run: () => cycleTabs() },
  { id: 'collapse', label: 'Свернуть панель', run: async () => setCollapsed(true) },
  { id: 'passport', label: 'Открыть паспорт', hint: 'Alt+I', run: () => showPassport() }];

const runAct = a => async () => { if (busy) return; busy = true; setBadge('run');
  els.acts.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try { await a.run(); } catch (e) { log('err', String(e && e.message || e)); status('Ошибка действия'); }
  finally { busy = false; setBadge(obsSession ? 'run' : 'ok'); els.acts.querySelectorAll('button').forEach(b => { b.disabled = false; }); } };

const addActions = list => (list || []).forEach(a => { if (!a || els.acts.querySelector('[data-id="' + a.id + '"]')) return;
  const b = ce('button', 'pml-btn', a.label); b.type = 'button'; b.dataset.id = a.id; if (a.hint) b.title = a.hint; b.disabled = !!a.disabled;
  b.onclick = runAct(a); els.acts.append(b); });

const regHotkeys = cfg => { let added = 0; ((cfg && cfg.hotkeys) || []).forEach(h => { const k = String(h.key || '').toUpperCase();
  if ('EDCSXI'.indexOf(k) < 0) return;
  if (HK[k]) { console.warn('[pml] Alt+' + k + ' занят («' + HK[k].label + '» побеждает)'); addActions([{ id: 'hk-' + k + '-' + (++uid), label: h.label + ' (без хоткея)', run: h.run }]); }
  else { HK[k] = { label: h.label, run: h.run }; added++; } });
  store.save(); return { attached: true, owner: OWNER }; }; // хедер/паспорт не переписываем (§1)

const setBadge = s => { badge = s; if (els.dot) els.dot.className = 'pml-dot ' + s; // бейдж красим напрямую: var() не достаёт вне поддерева root
  if (els.badge && PAL[effTheme]) { const map = { ok: 'ok', warn: 'warn', err: 'crit', run: null }[s];
    els.badge.style.borderColor = 'rgb(' + (map ? PAL[effTheme][map] : ACC ? ACC.rgb : PAL[effTheme].fb) + ')'; } };
const log = (lv, msg) => { J.unshift({ t: Math.round(performance.now() - T0), lv, msg: String(msg).slice(0, 120) }); if (J.length > 200) J.pop(); // §9: свежее сверху
  els.log.textContent = ''; J.forEach(j => { const r = ce('div', 'pml-log'); r.append(ce('span', 'pml-lg ' + j.lv), ce('span', '', '[' + j.t + '] ' + j.msg)); els.log.append(r); }); };
const status = m => { els.status.textContent = String(m).slice(0, 80); clearTimeout(stT); stT = setTimeout(() => { els.status.textContent = ''; }, 4000); clean.push(['t', stT]); }; // §12
const setCollapsed = v => { S.collapsed = !!v; store.save(); root.hidden = !!v; els.badge.hidden = !v; };

const syncTheme = () => { // §5–§6
  const h = new Date().getHours();
  effTheme = S.theme === 'system' ? (h >= 20 || h < 6 ? 'warm' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : S.theme;
  const P = PAL[effTheme];
  let probe = null; try { const i = ce('input'); i.type = 'checkbox'; i.style.accentColor = 'auto'; document.body.append(i);
    probe = parseRgb(getComputedStyle(i).accentColor); i.remove(); } catch (e) {}
  const sat = guardSat(probe); // сатурационный страж
  const c = sat ? rgb2ok(probe[0], probe[1], probe[2]) : rgb2ok(P.fb[0], P.fb[1], P.fb[2]);
  const rgb = (sat && solveAccent(P.bg, c[1], c[2])) || P.fb; // отказ стража → детерминированный дефолт
  ACC = { rgb, source: sat ? 'system' : 'fallback', ratioBg: hx(ratio(rgb, P.bg)), tx: pickTx(rgb) };
  const st = root.style, T = { 'pml-bg': P.bg, 'pml-fg': P.fg, 'pml-fg-dim': P.dim, 'pml-line': P.line, 'pml-accent': rgb, 'pml-accent-tx': ACC.tx, 'pml-ring': P.ring, 'pml-ok': P.ok, 'pml-warn': P.warn, 'pml-crit': P.crit };
  for (const k in T) st.setProperty('--pml-' + k, 'rgb(' + T[k] + ')');
  st.setProperty('--pml-radius', '12px'); st.setProperty('--pml-fs', S.fs + 'px');
  if (els.badge) { els.badge.style.background = 'rgb(' + P.bg + ')'; els.badge.style.color = 'rgb(' + P.fg + ')'; }
  root.className = 'pml-root' + (S.motion ? '' : ' pml-motion-off');
  [...els.seg.children].forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === S.theme)));
};

const zscan = () => { // §3: разведка перед монтажом
  let z = 1000; const bars = [];
  for (const el of (document.body || document.documentElement).querySelectorAll('*')) { let s = null; try { s = getComputedStyle(el); } catch (e) {}
    if (!s || (s.position !== 'fixed' && s.position !== 'sticky')) continue;
    const r = el.getBoundingClientRect(); const zz = +s.zIndex; if (zz > z) z = Math.min(zz + 1, 2147483000);
    if (r.top < innerHeight * 0.15 && r.height >= 32 && r.height <= 96 && r.width >= 120) bars.push(r); }
  let top = 16, bottom = null;
  if (bars.length) { const maxB = Math.max.apply(null, bars.map(r => r.bottom)); if (maxB + 8 + 360 < innerHeight * 0.8) top = Math.round(maxB + 8); else bottom = 16; }
  return { z, top, bottom };
};

const build = () => {
  let h = document.getElementById(HOST_ID); if (h) h.remove(); // takeover: под нашим ID снимаем ЛЮБОЙ прежний хост (анти-дубль ID)
  host = ce('div'); host.id = HOST_ID; host.__pml = 1; document.documentElement.appendChild(host);
  let sh = null; try { sh = host.attachShadow({ mode: 'open' }); } catch (e) {}
  const style = ce('style'); style.textContent = CSS;
  if (sh) { root = ce('div'); sh.append(style, root); } else { root = host; (document.head || document.documentElement).append(style); clean.push(['n', style]); } // fallback §2
  const hd = ce('div', 'pml-hd');
  els.dot = ce('span', 'pml-dot'); els.title = ce('span', 'pml-title', cfgInfo.name + ' v' + cfgInfo.version.split('.').slice(0, 2).join('.'));
  els.seg = ce('div', 'pml-seg'); els.seg.setAttribute('role', 'radiogroup'); els.seg.setAttribute('aria-label', 'Тема');
  [['system', 'Авто'], ['light', 'Свет'], ['dark', 'Тьма'], ['warm', 'Тепло']].forEach((v, i) => {
    const b = ce('button', '', v[1]); b.type = 'button'; b.dataset.v = v[0]; b.setAttribute('role', 'radio'); b.tabIndex = i === 0 ? 0 : -1;
    b.onclick = () => { S.theme = b.dataset.v; store.save(); syncTheme(); status('Тема: ' + b.dataset.v); };
    b.onkeydown = e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return; e.preventDefault();
      const bs = [...els.seg.children], i2 = bs.indexOf(e.target);
      const j = e.key === 'ArrowLeft' ? i2 - 1 : e.key === 'ArrowRight' ? i2 + 1 : e.key === 'Home' ? 0 : bs.length - 1;
      const jj = (j + bs.length) % bs.length; bs.forEach((x, xi) => { x.tabIndex = xi === jj ? 0 : -1; }); bs[jj].focus(); bs[jj].click(); }; // roving tabindex §9
    els.seg.append(b); });
  const col = ce('button', 'pml-btn', '⌃'); col.type = 'button'; col.title = 'Свернуть'; col.setAttribute('aria-label', 'Свернуть панель'); col.onclick = () => setCollapsed(true);
  hd.append(els.dot, els.title, els.seg, col);
  const tabs = ce('div', 'pml-tabs'); els.tabs = tabs; const bd = ce('div', 'pml-bd'); els.panels = {};
  const ids = ['recon', 'actions', 'log'], names = ['Разведка', 'Действия', 'Журнал'];
  ids.forEach((id, i) => { const t = ce('button', 'pml-tab', names[i]); t.type = 'button'; t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', String(i === 0)); t.onclick = () => ids.forEach((id2, i2) => { tabs.children[i2].setAttribute('aria-selected', String(i2 === i)); els.panels[id2].hidden = i2 !== i; });
    tabs.append(t); const p = ce('div'); p.hidden = i !== 0; els.panels[id] = p; bd.append(p); });
  const rb = ce('button', 'pml-btn', 'Запустить разведку'); rb.type = 'button'; rb.onclick = runAct({ id: 'recon', run: runRecon });
  const cs = ce('button', 'pml-btn', 'Копировать struct'); cs.type = 'button'; cs.title = 'JSON в буфер (Alt+C) — канал ЧК-1/Ф2'; cs.onclick = runAct({ id: 'copy-struct', run: copyStruct });
  const ca = ce('button', 'pml-btn', 'Копировать agent-view'); ca.type = 'button'; ca.title = 'a11y-скелет в духе Playwright MCP (без имён — §15); усвоение ландшафта 27.5.0'; ca.onclick = runAct({ id: 'copy-agent', run: copyAgentView });
  const dj = ce('button', 'pml-btn', 'Скачать JSON'); dj.type = 'button'; dj.title = 'struct.json файлом — экспорт-пакет 27.6.0 (Blob+download, 0 сети — §15)'; dj.onclick = runAct({ id: 'dl-json', run: downloadJSON });
  const dz = ce('button', 'pml-btn', 'Скачать ZIP-бандл'); dz.type = 'button'; dz.title = 'JSON+MD+HTML+TXT+CSV+agent-view одним архивом (инлайновый CRC32+STORE)'; dz.onclick = runAct({ id: 'dl-zip', run: downloadZip });
  els.recon = ce('div'); els.panels.recon.append(rb, cs, ca, dj, dz, els.recon);
  els.acts = ce('div', 'pml-act'); els.panels.actions.append(els.acts);
  els.log = ce('div'); els.panels.log.append(els.log);
  const ft = ce('div', 'pml-ft'); els.status = ce('div', 'pml-status'); els.status.setAttribute('role', 'status'); els.status.setAttribute('aria-live', 'polite');
  const cm = ce('details'); cm.append(ce('summary', '', 'Комфорт'));
  const mv = ce('label'); const mc = ce('input'); mc.type = 'checkbox'; mc.checked = !S.motion;
  mc.onchange = () => { S.motion = !mc.checked; store.save(); syncTheme(); }; mv.append(mc, ' Движение выкл');
  const fv = ce('label'); const fr = ce('input'); fr.type = 'range'; fr.min = '12'; fr.max = '20'; fr.step = '1'; fr.value = String(S.fs);
  fr.oninput = () => { S.fs = +fr.value; store.save(); syncTheme(); }; fv.append(fr, ' Кегль ' + S.fs);
  cm.append(mv, fv);
  els.pf = ce('details'); els.pf.append(ce('summary', '', 'Паспорт')); els.pp = ce('pre'); els.pf.append(els.pp);
  ft.append(els.status, cm, els.pf);
  root.append(hd, tabs, bd, ft);
  els.badge = ce('button', 'pml-badge44', cfgInfo.name.slice(0, 2)); els.badge.type = 'button'; els.badge.title = 'Развернуть панель';
  els.badge.onclick = () => setCollapsed(false); (root.parentElement || sh || root).append(els.badge); // FIX 27.4.1: у ребёнка ShadowRoot parentElement === null
  const z = zscan(); root.style.zIndex = z.z;
  if (z.bottom != null) { root.style.top = 'auto'; root.style.bottom = '16px'; } else root.style.top = z.top + 'px'; // §3 каскад
  els.pf.addEventListener('toggle', () => { if (els.pf.open) els.pp.textContent = passportText().join('\n'); });
};

const CONFIG = { name: 'UACE', version: VER, hotkeys: [ // канонный набор §13: E/D/C/S/X/I
  { key: 'E', label: 'разведка', run: () => { if (els.panels) els.panels.recon.querySelector('button').click(); } },
  { key: 'D', label: 'наблюдение 60 с', run: () => startObservation() },
  { key: 'C', label: 'копировать struct', run: () => copyStruct() },
  { key: 'S', label: 'стоп', run: () => stopAll() },
  { key: 'X', label: 'цикл вкладок', run: () => cycleTabs() },
  { key: 'I', label: 'паспорт', run: () => showPassport() }] };

const api = Object.freeze({ // §1: синглтон API
  version: '1.0',
  ping: () => ({ version: '1.0', alive: true, owner: OWNER }),
  mount(c) { if (!mounted) { Q.push(['mount', c]); return { queued: true }; } log('info', 'подключён через mount(config): ' + ((c && c.name) || '?') + ' v' + ((c && c.version) || '?')); return regHotkeys(c); },
  setBadge(s) { if (!mounted) { Q.push(['setBadge', s]); return; } setBadge(s); },
  log(lv, msg) { if (!mounted) { Q.push(['log', lv, msg]); return; } log(lv, msg); },
  renderRecon(st) { if (!mounted) { Q.push(['renderRecon', st]); return; } renderRecon(st); }, // прямая совместимость с r1; lastStruct обновляется — «Копировать struct» владельца отдаст struct гостя
  renderActions(list) { if (!mounted) { Q.push(['renderActions', list]); return; } addActions(list); },
  getPassport() { return passportText().join('\n'); } });

const init = () => {
  const t0 = performance.now(); store.load(); build();
  syncTheme(); els.badge.hidden = !S.collapsed; root.hidden = !!S.collapsed;
  regHotkeys(CONFIG); addActions(REG);
  const wd = setInterval(() => { try { if (!host.isConnected) document.documentElement.appendChild(host); } catch (e) {} }, 2000); // watchdog §2
  clean.push(['i', wd]);
  bind('keydown', e => { if (e.key === 'Escape' && obsSession) { abortObservation(); return; } // Esc — стоп окна I-3
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return; // §13
    const t = e.target; if (t && ((t.matches && t.matches('input,textarea,select')) || t.isContentEditable)) return; // P5
    const h = HK[String(e.key || '').toUpperCase()]; if (!h) return; e.preventDefault(); h.run(); });
  bind('focus', syncTheme); bind('visibilitychange', syncTheme, document); // §5–§6 переспрос
  bind('pagehide', () => { if (obsSession) finishObservation(true, true); // мелочь B-6: без авто-разведки при выгрузке
    clean.forEach(c => { try { if (c[0] === 'l') c[3].removeEventListener(c[1], c[2]); else if (c[0] === 'i') clearInterval(c[1]);
      else if (c[0] === 't') clearTimeout(c[1]); else if (c[0] === 'n') c[1].remove(); } catch (e) {} }); if (host) host.remove(); }); // самоочистка §2
  mounted = true;
  while (Q.length) { const q = Q.shift(); try { if (q[0] === 'mount') regHotkeys(q[1]); else if (q[0] === 'renderRecon') renderRecon(q[1]);
    else if (q[0] === 'renderActions') addActions(q[1]); else if (q[0] === 'log') log(q[1], q[2]); else if (q[0] === 'setBadge') setBadge(q[1]); } catch (e) {} }
  mountMs = Math.round(performance.now() - t0);
  setBadge('ok'); log('ok', 'Панель PML-PANEL 1.0 · UACE ' + VER + ' · монтирование ' + mountMs + ' мс');
  log('info', 'соль FNV-1a: ' + SALT + ' — сверка sigHash со второй сборкой на первом обмене struct');
  log('info', 'экспорт-пакет 27.6.0: JSON/MD/HTML/TXT/CSV/agent-view/ZIP — кнопки «Действия» и панель разведки; хоткеи §13 прежние');
  status('Панель готова');
};

try { Object.defineProperty(window, '__UACE_INTERNALS__', { value: Object.freeze({ FNV1a32, hex8, SALT, urlHashIn, sigHashIn, sigOf, sigHash, pathOf, prefixPath, subtreeDepth, scoreGroup, resolveRecon, buildStruct, median, ok2rgb, rgb2ok, ratio, simhash64, hammingHex, structFeatures, domSim64, simBetween, agentView, downsample, compareStructs, fileStamp, structToText, structToMarkdown, structToHTML, structToCSV, crc32, makeZip, buildExportSet, downloadFile }), configurable: true }); } catch (e) {} // полевая сверка хэшей (ЧК-1) + интеграция 27.5.0 + экспорт-пакет 27.6.0

const prev = window.__PML_PANEL_API__;
if (prev) { // P13: синглтон; takeover >5 с (§1)
  let tries = 0;
  const chk = () => { let alive = false; try { const hh = document.getElementById(HOST_ID); // FIX 27.4.1: alive = живой UI, не голый хост
    const sr = hh && hh.shadowRoot; const ui = sr ? sr.childElementCount > 1 : !!(hh && hh.childElementCount);
    alive = !!ui && !!hh && hh.isConnected && prev.ping().alive; } catch (e) {}
    if (alive) { try { prev.mount(CONFIG); } catch (e) {} console.info('[pml] attached:', OWNER, '← владелец', prev.ping && prev.ping().owner); return; }
    if (++tries < 5) { setTimeout(chk, 1000); return; }
    console.warn('[pml] takeover: панель не отвечает >5 с — пересоздаю'); init(); };
  try { chk(); } catch (e) { console.warn('[pml] chk', e); init(); }
} else { window.__PML_PANEL_API__ = api; try { init(); } catch (e) { console.warn('[pml] init', e); } }
})();
