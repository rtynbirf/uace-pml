// ==UserScript==
// @name         UACE · PML-PANEL 1.0 (вариант B · UACE v27.7 core)
// @namespace    uace.pml.b
// @version      27.7.0
// @description  Референс-реализация замороженного мастера PML-PANEL 1.0 (§1–17) + Модуль I на каноне r2 §5 (соль PMLSTRUCT, pre-order UPPERCASE-сигнатуры, urlHash SALT+'URL>'+href) + наблюдение 60 с + скоринг/резерв r2 §2–3 + реестр с «Копировать struct» + усвоение мирового ландшафта 2025–2026 (agentView в духе Playwright MCP, downsample по D2Snap, simhash/minhash-сверки) + экспорт-пакет 27.6.0 (JSON/Markdown/HTML/TXT/CSV/agent-view + ZIP-бандл CRC32+STORE) + 27.6.1: возвращён ПОЛНЫЙ диалог-цех линии v22–v26 — извлечение диалога (29 платформ, Shadow DOM, универсальная эвристика, аварийный снимок), форматы MD/JSON/TXT/HTML/ShareGPT/JSONL/Alpaca, PDF через локальную печать, полный ZIP с журналом/паспортом. Текст страницы читается ТОЛЬКО по явной команде диалог-экспорта; struct-контур остаётся «0 текста» (§15). 27.7.0 «полная синтеза»: возвращён ВЕСЬ цех линии v26 POLYMATH / v27.0.0 HUMAN-FIRST — богатый MD-движок (KaTeX→LaTeX, Mermaid→SVG, таблицы colspan, чистка хрома код-виджетов), автоскролл истории, богатый scrape с parity-ролями/медиа/артефактами, ZIP с томами 50 МБ и File System Access, PDF-рендер html2pdf (СТРОГО opt-in CDN; по умолчанию печать — 0 сети), массовый экспорт по сайдбару (same-tab + дочерние вкладки через postMessage), манифест onlyNew (IndexedDB + localStorage), сессия resume, перенос диалога в другой AI, дебаг-цех (dump/report/sniffer), тост, «Экспорт-настройки» (0 попапов — норма HUMAN-FIRST). Сеть ТОЛЬКО по явным opt-in чекбоксам; хэш-канон r2 §5 и хоткеи §13 E/D/C/S/X/I не тронуты. Вариант сессии B для сверки с ЧК-1; канон UPOLY ведёт сессия A.
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
   Новое 27.6.1 «полный диалог-цех» (исправление кривого экземпляра 27.6.0 из архива владельца: описание
   обещало цех v22–v26, код — НЕТ; в реестре оставались старые 8 кнопок, функции отсутствовали. Доложено
   ВСЁ; структура/канон не тронуты — хэш-канон r2 §5, хоткеи §13 E/D/C/S/X/I, appended-семантика):
   • извлечение диалога (только по ЯВНОЙ команде — §15): реестр 30 платформ (ChatGPT, Claude, Gemini,
     AI Studio, DeepSeek, Qwen, Kimi, MiniMax, Mistral, Groq, OpenRouter, HuggingChat, NIM, Z.ai/ChatGLM,
     Pollinations, Puter, Open WebUI, Cloudflare, Grok, Copilot, Perplexity, Poe, Character.ai, You.com,
     Doubao, Yuanbao, Meta AI, Alice, Dola) + deepQueryAll с обходом открытых ShadowRoot + универсальные
     селекторы + эвристика «крупнейшая группа однотипных детей» + аварийный снимок текстовых блоков;
   • форматы диалога: Markdown (front-matter), JSON, TXT, HTML (автономный, инлайн-CSS), ShareGPT,
     JSONL, Alpaca; детект ролей — атрибуты → теги (user-query/model-response) → скоринг классов;
     thinking-блоки собираются в <details>; MD-копия в буфер;
   • PDF — через ЛОКАЛЬНЫЙ диалог печати (window.print в новом окне; при блокировке popup — готовый
     .print.html файлом: открыть и Ctrl+P). Внешних запросов НЕТ (§15); html2pdf/CDN не используются;
   • ZIP: базовый (struct-пакет + журнал + паспорт + README, 0 текста страницы) и ПОЛНЫЙ
     (+ все 7 форматов диалога) — один и тот же инлайновый райтер CRC32+STORE;
   • кнопки: реестр «Действия» +10 (диалог: буфер/MD/JSON/TXT/HTML/ShareGPT/JSONL/Alpaca/PDF/
     полный ZIP; всего 25), панель разведки +1 быстрая («Диалог → MD»);
   • аварийный снимок: если сообщений не нашлось — видимые текстовые блоки (p/li/pre) ≥40 символов
     из main/article/[role=main] помечаются ролью unknown — файл не бывает пустым.
   Новое 27.7.0 «полная синтеза» (наказ владельца: «ВОТ ЭТО ВСЁ ИНТЕГРИРУЙ СИНТЕЗИРУЙ» — приложена линия
   v26 POLYMATH / v27.0.0 HUMAN-FIRST; структура PML-PANEL сохранена дословно, всё аддитивно):
   • богатый MD-движок v25.0.1/v26: domToMarkdown (заголовки/списки с настоящей нумерацией <ol>/таблицы
     с colspan/ссылки/цитаты/код с языком), KaTeX/MathJax → LaTeX ($…$/$$…$$, ДО MD_REMOVE), Mermaid →
     SVG-ссылка mermaid.ink, чистка хрома код-виджетов (CHROME_TOKENS: «pythonRunCopy» — хром, проза — нет);
   • богатый scrape: MD-контент + текст + thinking (THINK_SELECTORS) + parity-роли (unknown/одинаковые →
     чередование user/assistant) + медиа (img/attachments — URL без сети) + артефакты кода (LANG_EXT);
   • автоскролл истории (к началу, стабилизация высоты, к концу), waitStable (фингерпринт+URL — фикс
     «экспорт предыдущего чата»), аварийный снимок страницы (snapshotScrape);
   • доставка: downloadBlob/downloadSmart (File System Access для ZIP/PDF), zipStore — свой райтер
     STORE+UTF-8 для строк И Uint8Array (makeZip 27.6.0 сохранён), тома ≤50 МБ, _index.json/_FAILURES/
     _image-links/_attachments; fetchImageU8 — ТОЛЬКО при opt-in «Скачивать медиа (сеть!)»;
   • PDF: по умолчанию локальная печать (0 сети, §15); html2pdf-рендер — ТОЛЬКО при opt-in «PDF-рендер CDN»;
   • массовый экспорт: findList (5 стратегий: generic/conversation-item/structural/click-items/doc-links),
     prescrollList, ensureSidebar, activateChatItem (click → React onClick → серия событий → навигация),
     exportAllSameTab + exportAllTabs (дочерние вкладки, postMessage UAICE_EXPORT_REQUEST/RESULT,
     waitForChildResult с ping-циклом), манифест onlyNew (IndexedDB UACE_POLYMATH_DB + localStorage,
     FNV-1a 64 BigInt chatHash), сессия resume (uace_bulk_v1 + fingerprintSidebar), adaptiвные задержки;
   • буфер: богатый MD текущего диалога, «Перенос диалога в другой AI» (USER:/ASSISTANT: — фича v24);
   • дебаг-цех v26: debugDump (консоль), exportDebugReport (JSON-файл), debugSniffer (снимок разметки);
   • «Экспорт-настройки» (details в футере, 0 попапов — норма HUMAN-FIRST): onlyNew, автоскролл,
     вырезать thinking, картинки (URL), СКАЧИВАТЬ МЕДИА (сеть!), PDF-рендер CDN (сеть!), Mermaid,
     внутренний формат ZIP (md/json/txt/html/both/pdf), формат пакета (7 форматов);
   • тост (не стекуется, role=status); кнопки «Стоп»/«Пакет: стоп» живут во время длинных пакетов;
     Esc = стоп наблюдения И пакета (канон семантики «стоп»); REAL-кнопки реестра: 25 → 38.
   Объём: ~1960 строк кода (физических 2914 / ~232 КБ) — потолок §17 превышен втрое (данные R3 для STP-2).
   Верификация: node --check PASS; тесты scripts/test_v2770.js 71/71 (канон/хоткеи/реестр 38/§15-гейты/
   FNV-векторы/ZIP CRC32 0xCBF43926 + python-zipfile round-trip с бинарём/rich-MD/9 форматов/манифест/
   тома/стоп-семантика/комфорт); PURE-блок байт-в-байт = 27.5.0/27.6.0/27.6.1.
   Приватность: 0 внешних запросов; struct-контур — 0 чтения текста страницы (§15); диалог-экспорты
   читают текст ТОЛЬКО по явной команде пользователя (кнопка) — компромисс зафиксирован в шапке 27.6.0. */
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

const VER = '27.7.0', OWNER = 'uace@' + VER, HOST_ID = 'pml-host';
const S = { theme: 'system', fs: 14, motion: true, collapsed: false, // pml_panel_v1, белый список §14
  onlyNew: false, autoScroll: false, stripThink: false, images: true, mermaid: true, fm: true, // HF-цех 27.7.0
  mediaNet: false, pdfCdn: false, zipInner: 'md', bulkFmt: 'md', bulkFilter: '' }; // сеть — ТОЛЬКО opt-in (§15)
const J = []; const HK = {}; const Q = []; const clean = [];
let host = null, root = null, mounted = false, busy = false, badge = 'ok', uid = 0;
let effTheme = 'dark', ACC = null, lastStruct = null, lastElapsed = 0, reconN = 0, mountMs = 0, stT = 0, cfgInfo = { name: 'UACE', version: VER };
let obsSession = null, obsResult = null;
const els = {};
const metrics = { reconRuns: 0, obsRuns: 0, structCopied: false, agentCopied: false, downloads: 0, zipMade: false, dlgRuns: 0, dlgEmpty: 0, bulkRuns: 0, bulkChats: 0, manifestClears: 0 }; // dlg* — 27.6.1; bulk* — HF-цех 27.7.0
const ce = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const bind = (t, fn, tgt) => { const w = tgt || window; w.addEventListener(t, fn); clean.push(['l', t, fn, w]); };
const store = {
  load() { try { const o = JSON.parse(localStorage.getItem('pml_panel_v1') || '{}'); for (const k of ['theme', 'fs', 'motion', 'collapsed', 'onlyNew', 'autoScroll', 'stripThink', 'images', 'mermaid', 'fm', 'mediaNet', 'pdfCdn', 'zipInner', 'bulkFmt', 'bulkFilter']) if (k in o) S[k] = o[k]; } catch (e) {} },
  save() { try { const s = JSON.stringify({ theme: S.theme, fs: S.fs, motion: S.motion, collapsed: S.collapsed, onlyNew: S.onlyNew, autoScroll: S.autoScroll, stripThink: S.stripThink, images: S.images, mermaid: S.mermaid, fm: S.fm, mediaNet: S.mediaNet, pdfCdn: S.pdfCdn, zipInner: S.zipInner, bulkFmt: S.bulkFmt, hotkeys: Object.keys(HK) }); if (s.length > 512) throw new Error('>512B'); localStorage.setItem('pml_panel_v1', s); } catch (e) { console.warn('[pml] store skip:', e && e.message); } } };

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
select{min-height:44px;min-width:44px;border:1px solid var(--pml-line);border-radius:8px;background:transparent;color:var(--pml-fg);font:inherit;padding:0 8px;accent-color:var(--pml-accent)}label{display:flex;gap:8px;align-items:center;padding:2px 0}
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
function downloadZip() { // базовый ZIP: struct-пакет + журнал + паспорт + README — 0 текста страницы (§15)
  const set = buildExportSet().map(e => ({ name: e.name, text: e.text }));
  set.push({ name: fileStamp('journal.txt'), text: J.map(j => '[' + j.t + '] ' + j.lv + ': ' + j.msg).join('\n') });
  set.push({ name: fileStamp('passport.txt'), text: passportText().join('\n') });
  set.push({ name: fileStamp('README.txt'), text: 'UACE ' + VER + ' · базовый ZIP-бандл\nstruct-пакет (JSON/MD/HTML/TXT/CSV/agent-view) + журнал + паспорт\n0 текста страницы, 0 внешних запросов (§15); CRC32+STORE\n' });
  metrics.zipMade = true;
  downloadFile(fileStamp('zip'), makeZip(set), 'ZIP-бандл собран: ' + set.length + ' файлов (struct + журнал + паспорт; CRC32+STORE — §15)'); }

/* ===================== ДИАЛОГ-ЦЕХ 27.6.1 (линия v22–v26 возвращена полностью) =====================
   Текст страницы читается ТОЛЬКО функциями этого блока и ТОЛЬКО по явной команде пользователя
   (кнопка) — §15-компромисс, зафиксированный в шапке. Struct-контур остаётся «0 текста». */
const DLG_MAX = 500, DLG_MIN_TEXT = 2, DLG_HOLDER_ID = 'pml-dlg-holder';
const DLG_PLATFORMS = [ // 30 платформ: hosts → path → msgSelectors; роли — dlgDetectRole (атрибуты→теги→скоринг)
  { name: 'ChatGPT', hosts: [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/], roleAttr: 'data-message-author-role',
    msgSelectors: ['[data-message-author-role]', 'article[data-testid^="conversation-turn"]'] },
  { name: 'Claude', hosts: [/(^|\.)claude\.ai$/],
    msgSelectors: ['[data-testid="user-message"]', '[data-testid="assistant-message"]', '.font-claude-message', '.font-user-message'] },
  { name: 'Gemini', hosts: [/(^|\.)(gemini\.google\.com|bard\.google\.com)$/],
    msgSelectors: ['user-query', 'model-response', 'conversation-turn', 'ms-chat-turn'] },
  { name: 'Google AI Studio', hosts: [/(^|\.)aistudio\.google\.com$/],
    msgSelectors: ['[data-test-id="user-message"]', '[data-test-id="model-message"]', 'ms-chat-turn'] },
  { name: 'DeepSeek', hosts: [/(^|\.)deepseek\.com$/], msgSelectors: ['[class*="message"]', '[class*="_message"]'] },
  { name: 'Qwen', hosts: [/(^|\.)(qwen\.ai|tongyi\.aliyun\.com)$/], msgSelectors: ['[class*="_message"]', '[data-message-role]', '[class*="chat-message"]'] },
  { name: 'Kimi', hosts: [/(^|\.)(kimi\.moonshot\.cn|kimi\.ai|kimi\.com)$/], msgSelectors: ['.segment', '.segment-container', '[class*="message"]'] },
  { name: 'MiniMax', hosts: [/(^|\.)(minimax\.io|minimaxi\.com)$/], msgSelectors: ['[class*="message"]', '[class*="chat-item"]'] },
  { name: 'Mistral Le Chat', hosts: [/(^|\.)mistral\.ai$/], msgSelectors: ['[data-message-role]', '[class*="Message"]', '[class*="message"]'] },
  { name: 'Groq', hosts: [/(^|\.)groq\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'] },
  { name: 'OpenRouter', hosts: [/(^|\.)openrouter\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'] },
  { name: 'HuggingChat', hosts: [/(^|\.)huggingface\.co$/], path: /^\/chat/, msgSelectors: ['[class*="message"]', '[class*="chat"]'] },
  { name: 'NVIDIA NIM', hosts: [/(^|\.)build\.nvidia\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'] },
  { name: 'Z.ai / ChatGLM', hosts: [/(^|\.)(z\.ai|chatglm\.cn|space-z\.ai)$/],
    msgSelectors: ['[data-role="user"]', '[data-role="assistant"]', '[data-message-role]', '[class*="UserMessage"]', '[class*="AssistantMessage"]', '[class*="message"]'] },
  { name: 'Pollinations', hosts: [/(^|\.)pollinations\.ai$/], msgSelectors: ['[class*="message"]'] },
  { name: 'Puter', hosts: [/(^|\.)puter\.com$/], msgSelectors: ['[class*="message"]'] },
  { name: 'Open WebUI', hosts: [/openwebui/, /^localhost(?::\d+)?$/, /^127\.0\.0\.1(?::\d+)?$/], msgSelectors: ['[class*="message"]'] },
  { name: 'Cloudflare AI', hosts: [/(^|\.)playground\.ai\.cloudflare\.com$/], msgSelectors: ['[class*="message"]'] },
  { name: 'Grok', hosts: [/(^|\.)grok\.com$/], msgSelectors: ['[class*="message"]', '[class*="message-bubble"]'] },
  { name: 'Microsoft Copilot', hosts: [/(^|\.)copilot\.microsoft\.com$/], msgSelectors: ['[class*="message"]', '[class*="turn"]'] },
  { name: 'Perplexity', hosts: [/(^|\.)perplexity\.ai$/], msgSelectors: ['[class*="query"]', '[class*="answer"]', '[class*="message"]'] },
  { name: 'Poe', hosts: [/(^|\.)poe\.com$/], msgSelectors: ['[class*="human-message"]', '[class*="chat-message"]', '[class*="message"]'] },
  { name: 'Character.ai', hosts: [/(^|\.)character\.ai$/], msgSelectors: ['[class*="message"]'] },
  { name: 'You.com', hosts: [/(^|\.)you\.com$/], msgSelectors: ['[class*="message"]'] },
  { name: 'Doubao', hosts: [/(^|\.)doubao\.com$/], msgSelectors: ['[class*="message"]'] },
  { name: 'Tencent Yuanbao', hosts: [/(^|\.)yuanbao\.tencent\.com$/], msgSelectors: ['[class*="message"]'] },
  { name: 'Meta AI', hosts: [/(^|\.)meta\.ai$/], msgSelectors: ['[class*="message"]'] },
  { name: 'Yandex Alice AI', hosts: [/(^|\.)alice\.yandex\.ru$/], msgSelectors: ['[class*="message"]'] },
  { name: 'Yandex Alice (path)', hosts: [/(^|\.)yandex\.(ru|com)$/], path: /\/alice\//i, msgSelectors: ['[class*="message"]'] },
  { name: 'Dola', hosts: [/(^|\.)dola\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat-message"]', '[class*="message-list"] > *', '[class*="v_list"]'] }
];
let dlgSRc = null, dlgSRt = 0;
const dlgShadowRoots = () => { // открытые ShadowRoot (кэш 2 с) — v26-линейка
  if (dlgSRc && performance.now() - dlgSRt < 2000) return dlgSRc;
  const roots = [];
  (function walk(r) { let all = []; try { all = r.querySelectorAll('*'); } catch (e) { return; }
    for (let i = 0; i < all.length; i++) { const sr = all[i].shadowRoot; if (sr) { roots.push(sr); walk(sr); } } })(document);
  dlgSRc = roots; dlgSRt = performance.now(); return roots; };
const dlgQAll = (sel, rootEl) => { // querySelectorAll по документу + всем открытым shadow-корням
  const scopes = [rootEl || document].concat(rootEl ? [] : dlgShadowRoots());
  const out = []; for (const sc of scopes) { let f; try { f = sc.querySelectorAll(sel); } catch (e) { continue; }
    for (let i = 0; i < f.length; i++) if (out.indexOf(f[i]) < 0) out.push(f[i]); } return out; };
const DLG_SKIP = new Set(['STYLE', 'SCRIPT', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE', 'BASE', 'SVG', 'PATH', 'BR', 'HR', 'MAT-ICON']);
const dlgCls = el => { if (!el || !el.className) return ''; const c = el.className; return (typeof c === 'string' ? c : (c && c.baseVal) || '').toLowerCase(); };
const dlgInHost = el => { let p = el, d = 0; // свой хост и скрытый держатель клонов — исключены
  while (p && d < 25) { if (p.id === HOST_ID || p.id === DLG_HOLDER_ID || p.__pml) return true; p = p.host || p.parentNode; d++; } return false; };
const dlgInNav = el => { let p = el, d = 0;
  while (p && p !== document.body && d < 12) { const t = (p.tagName || '').toLowerCase(), r = p.getAttribute ? (p.getAttribute('role') || '') : '';
    if (t === 'nav' || t === 'aside' || r === 'navigation') return true;
    if (/(^|[-_ ])(sidebar|sidenav|side-nav|drawer|chat-list|conversation-list|history-list|nav-)([-_ ]|$)/.test(dlgCls(p))) return true;
    p = p.parentElement; d++; } return false; };
const dlgVisible = el => { if (!el || !el.getBoundingClientRect) return false;
  try { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; } catch (e) { return false; } };
const dlgClean = s => String(s || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
let dlgHolder = null;
const dlgText = el => { // клон в скрытый держатель — innerText считает переносы корректно (v20-приём)
  if (!el || DLG_SKIP.has(el.tagName)) return '';
  try { if (!dlgHolder || !dlgHolder.isConnected) { dlgHolder = ce('div'); dlgHolder.id = DLG_HOLDER_ID;
      dlgHolder.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;pointer-events:none;opacity:0;z-index:-1;white-space:normal;';
      (document.body || document.documentElement).appendChild(dlgHolder); }
    const c = el.cloneNode(true); dlgHolder.textContent = ''; dlgHolder.appendChild(c);
    return dlgClean(dlgHolder.innerText); } catch (e) { try { return dlgClean(el.textContent); } catch (e2) { return ''; } } };
const dlgRoleFrom = v => { const x = String(v || '').toLowerCase().trim();
  if (/^(user|human|you|me|client|prompt|question|query)$/.test(x)) return 'user';
  if (/^(assistant|bot|ai|model|response|answer|reply)$/.test(x)) return 'assistant';
  if (/(^|[-_ .])(user|human|query|prompt|question)([-_ .]|$)/.test(x)) return 'user';
  if (/(^|[-_ .])(assistant|bot|model|response|answer|reply)([-_ .]|$)/.test(x)) return 'assistant';
  return null; };
const dlgDetectRole = (el, pl) => { // атрибут платформы → теги → скоринг классов/атрибутов вверх по 5 узлам
  if (pl && pl.roleAttr) { const v = dlgRoleFrom(el.getAttribute(pl.roleAttr)); if (v) return v; }
  if (pl && typeof pl.role === 'function') { try { const r = pl.role(el); if (r === 'user' || r === 'assistant') return r; } catch (e) {} }
  const t = el.tagName ? el.tagName.toLowerCase() : '';
  if (t === 'user-query') return 'user';
  if (t === 'model-response') return 'assistant';
  const sc = { user: 0, assistant: 0 }; const nodes = [el]; let p = el.parentElement;
  for (let i = 0; i < 5 && p; i++, p = p.parentElement) nodes.push(p);
  nodes.forEach((n, ni) => { const w = ni === 0 ? 1 : 0.6;
    for (const a of (n.attributes || [])) { const nm = a.name.toLowerCase(), vv = String(a.value || '').toLowerCase();
      if (/role|author|sender|speaker|type|side|from/i.test(nm)) {
        if (/user|human|you\b|me\b|question|prompt|query/i.test(vv)) sc.user += 8 * w;
        if (/assistant|bot|model|response|answer|reply/i.test(vv)) sc.assistant += 8 * w; } }
    const r1 = dlgRoleFrom(dlgCls(n)); if (r1) sc[r1] += (ni === 0 ? 6 : 4) * w; });
  if (sc.user >= sc.assistant + 4 && sc.user >= 5) return 'user';
  if (sc.assistant >= sc.user + 4 && sc.assistant >= 5) return 'assistant';
  return 'unknown'; };
const dlgIsCode = t => /^(css|js|json|html|svg|php|sql|python|java|cpp|bash|shell|xml|yaml|toml)$/i.test(String(t).trim().slice(0, 12)) && t.length < 400;
const dlgValid = found => { const out = [];
  found.forEach(el => { if (dlgInHost(el) || dlgInNav(el) || !dlgVisible(el)) return;
    const t = dlgText(el); if (!t || t.length < DLG_MIN_TEXT || dlgIsCode(t)) return; out.push(el); }); return out; };
const dlgDedupe = list => { const out = []; // гнездование: содержащий/содержимый — один остаётся
  for (const el of list) { let dup = false;
    for (const o of out) if (o === el || o.contains(el) || el.contains(o)) { dup = true; break; }
    if (!dup) out.push(el); } return out; };
const dlgThinking = el => { const th = [];
  try { el.querySelectorAll('[class*="thinking"],[class*="reasoning"],[class*="collapsible-content"],details').forEach(d => {
    const t = dlgText(d); if (t && t.length > 10 && t.length < 20000) th.push(t.slice(0, 4000)); }); } catch (e) {}
  return th; };
const DLG_UNIVERSAL = ['[data-message-author-role]', '[data-testid="user-message"]', '[data-testid="assistant-message"]',
  'user-query', 'model-response', '[data-message-role]', '[data-message-id]', '[class*="UserMessage"]', '[class*="AssistantMessage"]',
  '[class*="user-message"]:not([class*="input"]):not([class*="fixed"])', '[class*="assistant-message"]:not([class*="input"]):not([class*="fixed"])',
  '[class*="Message_container"]', '[class*="MessageContainer"]', 'div.conversation-container', '.segment', '.segment-container'];
const dlgHeuristic = () => { // крупнейшая группа однотипных детей основного контейнера (из v20) + внуки (виртуализация)
  const conts = dlgQAll('main, article, [role="main"], [class*="conversation"], [class*="chat"]');
  let best = null;
  const scan = parent => { const groups = {};
    Array.from(parent.children || []).forEach(ch => { const k = ch.tagName + '|' + dlgCls(ch).split(/\s+/).slice(0, 3).join(' ');
      (groups[k] = groups[k] || []).push(ch); });
    for (const k of Object.keys(groups)) { const g = dlgDedupe(dlgValid(groups[k]));
      if (g.length >= 3 && (!best || g.length > best.length)) best = g; } };
  conts.forEach(c => { scan(c); Array.from(c.children || []).forEach(mid => scan(mid)); });
  return best; };
const dlgFindMessages = () => { // платформенные селекторы → универсальные → эвристика (v22/v24-линейка)
  const pl = dlgGetPlatform();
  const trySel = sel => { const f = dlgQAll(sel); if (!f.length) return null; const v = dlgDedupe(dlgValid(f)); return v.length ? v : null; };
  if (pl) { for (let i = 0; i < pl.msgSelectors.length; i++) { const v = trySel(pl.msgSelectors[i]);
      if (v && (i === 0 ? v.length >= 2 : v.length >= 3)) return { items: v.slice(0, DLG_MAX), source: pl.name + ': ' + pl.msgSelectors[i], platform: pl }; }
    let best = null, bestSel = '';
    for (const sel of pl.msgSelectors.concat(DLG_UNIVERSAL)) { const v = trySel(sel);
      if (v && v.length > (best ? best.length : 0)) { best = v; bestSel = sel; } }
    if (best) return { items: best.slice(0, DLG_MAX), source: pl.name + ': ' + bestSel, platform: pl }; }
  let best = null, bestSel = '';
  for (const sel of DLG_UNIVERSAL) { const v = trySel(sel); if (v && v.length > (best ? best.length : 0)) { best = v; bestSel = sel; } }
  if (best) return { items: best.slice(0, DLG_MAX), source: 'universal: ' + bestSel, platform: pl };
  const heur = dlgHeuristic();
  if (heur && heur.length >= 2) return { items: heur.slice(0, DLG_MAX), source: 'heuristic', platform: pl };
  return null; };
const dlgEmergency = () => { // аварийный снимок: файл не бывает пустым
  const conts = dlgQAll('main, article, [role="main"]'); const base = conts.length ? conts[0] : document.body;
  const blocks = []; try { base.querySelectorAll('p, li, pre, td').forEach(b => {
    if (dlgInHost(b) || !dlgVisible(b)) return; const t = dlgText(b);
    if (t && t.length >= 40) blocks.push(t); }); } catch (e) {}
  return blocks.slice(0, 200); };
const dlgTitle = () => { let t = (document.title || '').trim(); t = t.replace(/\s*[-–|·]\s*[^-–|·]{0,40}$/i, '').trim();
  return t.length > 1 ? t.slice(0, 120) : 'export'; };
const dlgGetPlatform = () => {
  const h = location.host, p = location.pathname;
  for (const pl of DLG_PLATFORMS) { let ok = false;
    for (const re of pl.hosts) { try { if (re.test(h)) { ok = true; break; } } catch (e) {} }
    if (!ok) continue;
    if (pl.path) { try { if (!pl.path.test(p)) continue; } catch (e) {} }
    return pl; }
  return null; };
const scrapeDialog = () => { // ГЛАВНЫЙ вход: текст читается ТОЛЬКО здесь, по явной команде (§15-компромисс)
  metrics.dlgRuns++;
  const found = dlgFindMessages(); const items = [];
  if (found) found.items.forEach(el => items.push({ role: dlgDetectRole(el, found.platform), text: dlgText(el), thinking: dlgThinking(el) }));
  let emergency = false;
  if (!items.length) { emergency = true; metrics.dlgEmpty++;
    dlgEmergency().forEach(t => items.push({ role: 'unknown', text: t, thinking: [] })); }
  const pl = dlgGetPlatform();
  return { platform: (found && found.platform ? found.platform.name : pl ? pl.name : 'universal-heuristic'),
    title: dlgTitle(), url: location.href, source: found ? found.source : 'emergency-snapshot',
    emergency, count: items.length, items }; };
function stopAll() { if (obsSession) abortObservation(); // Alt+S / «Стоп»: окно I-3 ИЛИ активный пакет (27.7.0)
  else if (bulkRunning || tabsExportRunning) { CANCEL = true; status('пакет: стоп запрошен'); log('warn', 'стоп: пакет остановится после текущего чата'); }
  else { status('стоп: нечего прерывать'); log('info', 'стоп: активного окна нет'); } }
function cycleTabs() { if (!els.tabs) return; const n = els.tabs.children.length;
  for (let i = 0; i < n; i++) if (els.tabs.children[i].getAttribute('aria-selected') === 'true') { els.tabs.children[(i + 1) % n].click(); return; }
  if (n) els.tabs.children[0].click(); }
function showPassport() { if (!els.pf) return; els.pf.open = true; els.pp.textContent = passportText().join('\n'); els.pf.scrollIntoView({ block: 'nearest' }); }

/* ---- форматы диалога (7): Markdown/JSON/TXT/HTML/ShareGPT/JSONL/Alpaca — линейка v22–v26 ---- */
const dlgRoleLabel = r => r === 'user' ? '🧑‍💻 User' : r === 'assistant' ? '🤖 Assistant' : '❔ ' + (r || 'Unknown');
const dlgSGFrom = r => r === 'user' ? 'human' : r === 'assistant' ? 'gpt' : 'system';
const dlgToMarkdown = d => { const L = [];
  L.push('---', 'title: ' + JSON.stringify(d.title), 'platform: ' + JSON.stringify(d.platform),
    'url: ' + JSON.stringify(d.url), 'exported_at: ' + JSON.stringify(new Date().toISOString()),
    'exporter: ' + JSON.stringify('UACE ' + VER + ' · PML-PANEL B · диалог-цех 27.6.1'),
    'messages_count: ' + d.count, 'source: ' + JSON.stringify(d.source), 'emergency_snapshot: ' + d.emergency, '---', '', '# ' + d.title, '');
  d.items.forEach(m => { L.push('### ' + dlgRoleLabel(m.role), '', m.text || '', '');
    if (m.thinking && m.thinking.length) L.push('<details><summary>🧠 Thinking</summary>', '', m.thinking.join('\n\n'), '', '</details>', ''); });
  return L.join('\n') + '\n'; };
const dlgToJSON = d => JSON.stringify({ title: d.title, platform: d.platform, exporter: 'UACE ' + VER, url: d.url,
  exported_at: new Date().toISOString(), messages_count: d.count, source: d.source, emergency: d.emergency,
  messages: d.items.map((m, i) => ({ index: i, role: m.role, text: m.text, thinking: m.thinking || [] })) }, null, 2);
const dlgToTXT = d => { const L = [d.title, '='.repeat(Math.min(d.title.length, 70)), 'Platform: ' + d.platform,
    'URL: ' + d.url, 'Exported: ' + new Date().toISOString() + ' (UACE ' + VER + ')',
    'Source: ' + d.source + (d.emergency ? ' (АВАРИЙНЫЙ СНИМОК)' : ''), ''];
  d.items.forEach(m => { L.push('[' + String(m.role || 'unknown').toUpperCase() + ']');
    if (m.thinking && m.thinking.length) L.push('[REASONING]', m.thinking.join('\n\n'), '');
    L.push(m.text || ''); L.push(''); }); return L.join('\n'); };
const dlgCss = () => 'body{font-family:-apple-system,"Segoe UI",Roboto,"Noto Sans",Arial,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#20242c;background:#fbfaf8}'
  + 'h1{border-bottom:2px solid #e4e1da;padding-bottom:.5rem}.meta{color:#7a8290;font-size:.9rem;margin-bottom:1.5rem}'
  + '.msg{margin:1.2rem 0;padding:1rem;border-radius:10px}.user{background:#eef4fd;border-left:4px solid #3d74d9}'
  + '.assistant{background:#f4f4f2;border-left:4px solid #6b7280}.unknown{background:#fdf6e3;border-left:4px solid #d9a13d}'
  + '.role{font-weight:600;margin-bottom:.5rem;color:#565f6e}.think{background:#fafaf8;border:1px dashed #c9c5bb;border-radius:6px;padding:.6rem;margin:.6rem 0;font-size:.92em;color:#5a5f68}';
const dlgEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dlgToHTML = d => { let h = '<h1>' + dlgEsc(d.title) + '</h1>';
  h += '<div class="meta">Platform: ' + dlgEsc(d.platform) + ' · URL: ' + dlgEsc(d.url) + ' · Exported: ' + dlgEsc(new Date().toISOString())
    + ' · Messages: ' + d.count + (d.emergency ? ' · АВАРИЙНЫЙ СНИМОК' : '') + '</div>';
  d.items.forEach(m => { h += '<div class="msg ' + dlgEsc(String(m.role || 'unknown')) + '"><div class="role">' + dlgEsc(dlgRoleLabel(m.role)) + '</div>';
    if (m.thinking && m.thinking.length) h += '<div class="think"><b>🧠 Thinking</b><br>' + dlgEsc(m.thinking.join('\n\n')).replace(/\n/g, '<br>') + '</div>';
    h += '<div>' + dlgEsc(m.text).replace(/\n/g, '<br>') + '</div></div>'; });
  return '<!doctype html>\n<html lang="ru"><head><meta charset="utf-8"><title>' + dlgEsc(d.title) + '</title><style>' + dlgCss() + '</style></head>\n<body>\n' + h + '\n</body></html>\n'; };
const dlgToShareGPT = d => JSON.stringify({ title: d.title, url: d.url, exported_at: new Date().toISOString(),
  conversations: d.items.map(m => ({ from: dlgSGFrom(m.role), value: m.text })) }, null, 2);
const dlgToJSONL = d => d.items.map((m, i) => JSON.stringify({ chat: d.title, i, role: m.role, text: m.text })).join('\n');
const dlgToAlpaca = d => { const samples = []; let pend = null;
  d.items.forEach(m => { if (m.role === 'user') { if (pend) samples.push({ instruction: pend, input: '', output: '' }); pend = m.text; }
    else if (m.role === 'assistant') { samples.push({ instruction: pend || '', input: '', output: m.text }); pend = null; }
    else if (pend) { samples.push({ instruction: pend, input: '', output: '' }); pend = null; } });
  if (pend) samples.push({ instruction: pend, input: '', output: '' });
  return JSON.stringify({ chat: d.title, url: d.url, samples }, null, 2); };
const DLG_FMTS = { md: { ext: 'md', mime: 'text/markdown;charset=utf-8' }, json: { ext: 'json', mime: 'application/json;charset=utf-8' },
  txt: { ext: 'txt', mime: 'text/plain;charset=utf-8' }, html: { ext: 'html', mime: 'text/html;charset=utf-8' },
  sharegpt: { ext: 'sharegpt.json', mime: 'application/json;charset=utf-8' }, jsonl: { ext: 'jsonl', mime: 'application/x-ndjson;charset=utf-8' },
  alpaca: { ext: 'alpaca.json', mime: 'application/json;charset=utf-8' } };
const dlgContent = (fmt, d) => { d = d || scrapeDialog();
  if (fmt === 'json') return dlgToJSON(d); if (fmt === 'txt') return dlgToTXT(d);
  if (fmt === 'html') return dlgToHTML(d); if (fmt === 'sharegpt') return dlgToShareGPT(d);
  if (fmt === 'jsonl') return dlgToJSONL(d); if (fmt === 'alpaca') return dlgToAlpaca(d);
  return dlgToMarkdown(d); };
const dlgStamp = ext => 'uace-' + VER + '-dialog-' + hex8(FNV1a32(urlHashIn(location.href))) + '-' +
  new Date().toISOString().slice(11, 19).replace(/:/g, '') + '.' + ext;
/* ---- экспорт-действия диалога: кнопки REG ---- */
function exportDialog(fmt) { const d = scrapeDialog();
  if (!d.count) { status('диалог не найден'); log('warn', 'извлечение диалога: 0 сообщений'); return; }
  const f = DLG_FMTS[fmt] || DLG_FMTS.md;
  downloadFile(dlgStamp(f.ext), txtBlob(dlgContent(fmt, d), f.mime),
    'Диалог → ' + f.ext.toUpperCase() + ': ' + d.count + ' сообщ. (' + d.platform + (d.emergency ? ', АВАРИЙНЫЙ СНИМОК' : '') + ')'); }
function copyDialogMD() { const d = scrapeDialog(); if (!d.count) { status('диалог не найден'); log('warn', 'копирование диалога: 0 сообщений'); return; }
  copyText(dlgToMarkdown(d), 'диалог скопирован (Markdown, ' + d.count + ' сообщ.' + (d.emergency ? ', АВАРИЙНЫЙ СНИМОК' : '') + ')'); }
function exportDialogPDF() { // PDF силами браузера: локальная печать, 0 CDN/внешних запросов (§15)
  const d = scrapeDialog(); if (!d.count) { status('диалог не найден'); log('warn', 'PDF: 0 сообщений'); return; }
  const html = dlgToHTML(d); const w = window.open('', '_blank');
  if (!w) { downloadFile(dlgStamp('print.html'), txtBlob(html, 'text/html;charset=utf-8'),
    'PDF: popup заблокирован — сохранён .print.html: откройте и Ctrl+P'); return; }
  try { w.document.open(); w.document.write(html); w.document.close(); } catch (e) {}
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 500);
  status('PDF: окно печати открыто — «Сохранить как PDF»'); log('ok', 'PDF (локальная печать): ' + d.count + ' сообщ.'); }
function buildDialogEntries(d) {
  return ['md', 'json', 'txt', 'html', 'sharegpt', 'jsonl', 'alpaca'].map(k =>
    ({ name: 'dialog-' + dlgStamp(DLG_FMTS[k].ext), mime: DLG_FMTS[k].mime, text: dlgContent(k, d), label: 'dialog ' + k })); }
function downloadZipFull() { // полный ZIP: struct-пакет + все 7 форматов диалога + журнал + паспорт (явная команда)
  const d = scrapeDialog(); if (!d.count) { status('диалог не найден — полный ZIP отменён'); log('warn', 'полный ZIP: 0 сообщений'); return; }
  const set = buildExportSet().map(e => ({ name: e.name, text: e.text }));
  buildDialogEntries(d).forEach(e => set.push({ name: e.name, text: e.text }));
  set.push({ name: dlgStamp('journal.txt').replace('dialog-', 'full-'), text: J.map(j => '[' + j.t + '] ' + j.lv + ': ' + j.msg).join('\n') });
  set.push({ name: 'passport.txt', text: passportText().join('\n') });
  set.push({ name: 'README.txt', text: 'UACE ' + VER + ' · полный ZIP-бандл\nstruct-пакет (6 файлов, 0 текста страницы)\n+ диалог: 7 форматов (' + d.platform + ', ' + d.count + ' сообщ.' + (d.emergency ? ', АВАРИЙНЫЙ СНИМОК' : '') + ')\n+ журнал + паспорт\nCRC32+STORE, 0 внешних запросов (§15)\n' });
  metrics.zipMade = true;
  downloadFile(dlgStamp('zip'), makeZip(set), 'Полный ZIP: ' + set.length + ' файлов (struct + диалог + журнал + паспорт)'); }

/* ===================== ЦЕХ HUMAN-FIRST 27.7.0 (линия v26 POLYMATH + v27.0.0 возвращена полностью) =====================
   Порт в структуру PML-PANEL БЕЗ изменения ядра: богатый MD-движок (KaTeX→LaTeX, Mermaid→SVG-ссылка,
   таблицы с colspan, чистка хрома код-виджетов), автоскролл истории, медиа/артефакты, собственный ZIP
   с томами 50 МБ, PDF-рендер html2pdf (СТРОГО opt-in — по умолчанию локальная печать, 0 сети, §15),
   массовый экспорт по сайдбару (same-tab + дочерние вкладки), манифест onlyNew (IndexedDB + localStorage),
   сессия resume, перенос диалога в другой AI, дебаг-цех (dump/report/sniffer), тост.
   Сеть: 0 запросов по умолчанию; fetch изображений и CDN-рендер PDF — ТОЛЬКО после явного включения
   чекбоксами «Экспорт-настроек» (помечены «сеть!»). Текст страницы читают ТОЛЬКО явные команды. */
const MSG_REQ = 'UAICE_EXPORT_REQUEST', MSG_RES = 'UAICE_EXPORT_RESULT';
const CFG = {
  MIN_TEXT: 8, MIN_TOTAL_TEXT: 80, CLICK_WAIT: 800, STABLE_MS: 1200,
  MAX_WAIT: 25000, POLL: 300, SCROLL_ROUNDS: 50, SCROLL_WAIT: 550, TAB_CHILD_TIMEOUT: 65000,
  DEDUPE_CAP: 400, MSG_MIN: 1, MSG_MAX: 800, IMG_PER_MSG: 40, IMG_TOTAL: 60, IMG_TIMEOUT: 10000,
  SNAPSHOT_MAX: 200000, ADAPTIVE: true, BASE_CLICK: 800, BASE_SCROLL: 550, BASE_POLL: 300,
  MAX_CLICK: 1800, MAX_SCROLL: 900, IMG_RETRIES: 3, MAX_ZIP_MB: 50, ARTIFACTS_MAX: 100
};
let CANCEL = false, tabsExportRunning = false, bulkRunning = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => now().replace(/[: ]/g, '-');
function safeStorageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function safeStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function safeStorageRemove(k) { try { localStorage.removeItem(k); } catch (e) {} }
function now() { const d = new Date(), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); }
function isPageBusy() { try { return document.querySelectorAll('[class*="loading"],[class*="spinner"],[class*="busy"],[aria-busy="true"],[data-loading="true"]').length > 0; } catch (e) { return false; } }
function adaptiveMs(base, maxCap) { // v26: адаптивные задержки — страница занята → ждём дольше
  if (!CFG.ADAPTIVE || safeStorageGet('uace_adaptive') === '0') return base;
  const v = Math.round(base * (isPageBusy() ? 2.1 : 1));
  return maxCap ? Math.min(v, maxCap) : v;
}
function clickWait() { return adaptiveMs(CFG.BASE_CLICK || CFG.CLICK_WAIT, CFG.MAX_CLICK); }
function scrollWait() { return adaptiveMs(CFG.BASE_SCROLL || CFG.SCROLL_WAIT, CFG.MAX_SCROLL); }
function pollWait() { return adaptiveMs(CFG.BASE_POLL || CFG.POLL, 800); }
function sanitize(s, m) { // имя файла ≤m + хеш-суффикс для длинных (анти-дубликат на Windows/FS)
  m = m || 80;
  const raw = String(s || 'export'), norm = raw.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  let out = norm.slice(0, m);
  if (norm.length > m) out += '-' + hashString(raw).slice(0, 6);
  return out || 'export';
}
// Схлопывание повторяющегося текста (артефакт виртуализированного DOM): "abcabcabc" -> "abc"
function dedupeText(s) {
  s = String(s || '');
  if (s.length < 6 || s.length > 400) return s;
  for (let n = 2; n <= 4; n++) {
    if (s.length % n !== 0) continue;
    const chunk = s.slice(0, s.length / n);
    if (!chunk) continue;
    let rep = true;
    for (let i = 1; i < n; i++) { if (s.slice(i * chunk.length, (i + 1) * chunk.length) !== chunk) { rep = false; break; } }
    if (rep) return chunk;
  }
  return s;
}
// Срезание UI-обёрток перед текстом («Ваш запрос», «Ответ Gemini», «You said» и т.п.)
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
function progress(i, n, label) { // прогресс в строке статуса: [█████·----] 3/10 Заголовок
  const f = Math.max(0, Math.min(10, Math.round(10 * i / Math.max(1, n))));
  return '[' + '█'.repeat(f) + '·'.repeat(10 - f) + '] ' + (i + 1) + '/' + n + ' ' + (label || '');
}
/* ---- INDEXEDDB: манифест onlyNew без лимита ~5 МБ (v26 POLYMATH) ---- */
const HAS_IDB = (function () { try { return typeof indexedDB !== 'undefined' && !!indexedDB.open; } catch (e) { return false; } })();
const IDB_NAME = 'UACE_POLYMATH_DB', IDB_STORE_MAN = 'manifest';
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
      const tx = db.transaction(store, mode), out = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : null);
      tx.onerror = () => reject(tx.error || new Error('IDB tx failed'));
    } catch (e) { reject(e); }
  }));
}
function idbGetAll() { return HAS_IDB ? idbRun(IDB_STORE_MAN, 'readonly', s => s.getAll()).catch(() => []) : Promise.resolve([]); }
function idbPutMany(arr) { return HAS_IDB ? idbRun(IDB_STORE_MAN, 'readwrite', s => { for (let i = 0; i < arr.length; i++) s.put(arr[i]); }).catch(() => {}) : Promise.resolve(); }
function idbClearMan() { return HAS_IDB ? idbRun(IDB_STORE_MAN, 'readwrite', s => s.clear()).catch(() => {}) : Promise.resolve(); }
/* ---- DOM-хелперы и фильтры (v26) ---- */
const HF_SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE', 'BASE', 'HTML', 'SVG', 'PATH', 'G', 'DEFS', 'MAT-ICON', 'BR', 'HR']);
const HF_EXCLUDE_SEL = '#' + HOST_ID + ',#' + DLG_HOLDER_ID + ',[class*="tooltip"]:not([class*="content"]),[class*="popover"]:not([class*="content"])';
const HF_CHAT_AREA = 'div.chat-container,#chat-history,[data-test-id="chat-history-container"],conversation-container,div.conversation-container,ms-chat-turn,[class*="chat-history-scroll"],[class*="turn-content"],main,[role="main"]';
function hfIsInExclude(el) { let p = el, d = 0;
  while (p && p !== document.body && d < 15) { try { if (p.matches && p.matches(HF_EXCLUDE_SEL)) return true; } catch (e) {} p = p.parentElement; d++; }
  return false; }
function isInChatArea(el) {
  if (!el || !el.closest) return false;
  try { if (el.closest('aside, nav, [role="navigation"], [class*="sidebar"], [class*="sider"]')) return false; } catch (e) {}
  try { return !!el.closest(HF_CHAT_AREA); } catch (e) { return false; }
}
function hfClean(s) { return String(s || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }
function hfTxt(el) { // короткий текст элемента (список чатов, фингерпринт) — с дедупом повторов
  if (!el || HF_SKIP_TAGS.has(el.tagName)) return '';
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
function dedupeNested(list) { // гнездование с «контейнерами» (v26): держатели ≥2 детей живут, одиночные вложенные падают
  let arr = Array.from(list);
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

/* ---- МАНИФЕСТ onlyNew + СЕССИЯ resume (v26: IndexedDB + FNV-1a 64) ---- */
const MANIFEST_KEY = 'uace_manifest_v1', SESSION_KEY = 'uace_bulk_v1';
function hashString(s) { // FNV-1a 64-bit (BigInt): детерминированный хеш вместо коллидирующего «role:length»
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n, mask = 0xffffffffffffffffn, text = String(s || '');
  for (let i = 0; i < text.length; i++) { h ^= BigInt(text.charCodeAt(i)); h = (h * prime) & mask; }
  return h.toString(16).padStart(16, '0');
}
function chatHash(s) {
  const items = (s && Array.isArray(s.items)) ? s.items : [];
  return hashString(items.map(x => (x.role || 'unknown') + '\u0000' + (x.text || x.content || '')).join('\u0001'));
}
function manifestKey(it) { // единый ключ чтения И записи (фикс расхождения href/dataId/title)
  if (!it) return '';
  if (it.href) { try { const u = new URL(it.href, location.href); u.hash = ''; return u.href; } catch (e) {} }
  if (it.dataId) return 'id:' + String(it.dataId);
  return 'title:' + normalizeNavKey(it.title || '');
}
function fingerprintSidebar() { // лёгкий отпечаток сайдбара для resume-выравнивания
  try {
    const list = findList();
    if (!list || !list.items) return '';
    return hashString(list.items.slice(0, 40).map(x => (x.dataId || '') + '\u0000' + normalizeNavKey(x.title || '') + '\u0000' + (x.href || '')).join('\u0001'));
  } catch (e) { return ''; }
}
let MANIFEST_MEM = null;
function loadManifest() { try { return JSON.parse(safeStorageGet(MANIFEST_KEY) || '{}'); } catch (e) { return {}; } }
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
  MANIFEST_MEM = base;
  return MANIFEST_MEM;
}
let _persistTimer = null;
function saveManifest(m) {
  MANIFEST_MEM = m || {};
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => { flushManifest(); }, 400);
}
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
function loadSession() { try { const s = JSON.parse(safeStorageGet(SESSION_KEY) || 'null'); return (s && Array.isArray(s.items)) ? s : null; } catch (e) { return null; } }
function saveSession(s) { try { s.sidebarFp = fingerprintSidebar(); } catch (e) {} safeStorageSet(SESSION_KEY, JSON.stringify(s)); }
function clearSession() { safeStorageRemove(SESSION_KEY); }
function hfOptions() { // опции из S (панель «Экспорт-настройки») — вместо confirm-попапов v26 (норма «0 попапов»)
  return { filter: (S.bulkFilter || '').toLowerCase(), onlyNew: S.onlyNew === true,
    exportThinking: true, stripThinking: S.stripThink === true };
}
/* ---- БОГАТЫЙ MD-ДВИЖОК (v25.0.1/v26): DOM → Markdown ---- */
const MD_REMOVE = 'style,script,link,meta,noscript,template,svg,button,nav,footer,header,[role="button"],[role="toolbar"],[aria-hidden="true"],.sr-only,time,[class*="timestamp"],[class*="copy-button"],[class*="action-bar"],[class*="toolbar"],[class*="feedback"],[class*="rating"],mat-icon,[data-icon]';
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const CHROME_TOKENS = ['python', 'python3', 'javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'java', 'c', 'c++', 'cpp', 'csharp', 'cs', 'go', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'bash', 'sh', 'shell', 'zsh', 'powershell', 'sql', 'html', 'css', 'scss', 'less', 'json', 'json5', 'yaml', 'yml', 'xml', 'toml', 'ini', 'markdown', 'md', 'text', 'txt', 'plaintext', 'perl', 'r', 'matlab', 'dart', 'lua', 'groovy', 'objc', 'objectivec', 'pascal', 'fortran', 'haskell', 'elixir', 'erlang', 'clojure', 'vb', 'vba', 'asm', 'assembly', 'wasm', 'graphql', 'dockerfile', 'makefile', 'diff', 'mermaid', 'run', 'copy', 'код', 'язык', 'запустить', 'выполнить', 'копировать', 'показать', 'скрыть', 'свернуть', 'развернуть', 'collapse', 'expand', 'toggle', 'wrap', 'nowrap', 'edit', 'done', 'save', 'share', 'download'];
const CHROME_TOKENS_SORTED = CHROME_TOKENS.slice().sort((a, b) => b.length - a.length);
const CHROME_ALT = CHROME_TOKENS_SORTED.map(escapeRe).join('|');
const CHROME_TOKEN_PREFIX_RE = new RegExp('^(?:' + CHROME_ALT + ')', 'i');
const CHROME_TOKEN_FULL_RE = new RegExp('^(?:' + CHROME_ALT + ')$', 'i');
function isChromeText(t) { // элемент/текст-сосед pre состоит ТОЛЬКО из токенов-хрома («pythonRunCopy»)
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
function stripCodeChrome(root) { // чистка хрома код-виджетов рядом с <pre> (React-DOM без пробелов)
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
function mermaidEnabled() { return S.mermaid !== false; }
function processMermaid(content) { // Mermaid → ссылка на SVG-рендер mermaid.ink (zero-dependency)
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
function domToMarkdown(el) { // ГЛАВНЫЙ рендер: заголовки/списки/таблицы/код/ссылки/цитаты/KaTeX
  const root = el.cloneNode(true);
  let rm;
  try { rm = root.querySelectorAll(MD_REMOVE); } catch (e) { rm = []; }
  for (let i = 0; i < rm.length; i++) rm[i].remove();
  stripCodeChrome(root);
  try { // KaTeX/MathJax → LaTeX; ВАЖНО: до MD_REMOVE, иначе формула теряется целиком
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
    if (tag === 'code') return '`' + hfClean(node.textContent) + '`';
    if (tag === 'img') { const src = node.getAttribute('src') || ''; if (!src) return ''; return '![' + (node.getAttribute('alt') || '') + '](' + src + ')'; }
    if (tag === 'a') { const href = node.getAttribute('href') || ''; const v = hfClean(children(node)); return href ? '[' + (v || href) + '](' + href + ')' : v; }
    if (/^h[1-6]$/.test(tag)) return '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + hfClean(children(node)) + '\n\n';
    if (tag === 'strong' || tag === 'b') { const v = hfClean(children(node)); return v ? '**' + v + '**' : ''; }
    if (tag === 'em' || tag === 'i') { const v = hfClean(children(node)); return v ? '*' + v + '*' : ''; }
    if (tag === 'del' || tag === 's') { const v = hfClean(children(node)); return v ? '~~' + v + '~~' : ''; }
    if (tag === 'blockquote') { const v = hfClean(children(node)); return '\n\n' + v.split('\n').map(l => '> ' + l).join('\n') + '\n\n'; }
    if (tag === 'li') { const ordered = node.parentElement && node.parentElement.tagName.toLowerCase() === 'ol'; return (ordered ? '1. ' : '- ') + hfClean(children(node)) + '\n'; }
    if (tag === 'ul' || tag === 'ol') { // v25.0.1: настоящая нумерация <ol> вместо «1. 1. 1.»
      const ordered = tag === 'ol';
      let lis = [];
      try { lis = Array.from(node.children || []).filter(c => c && c.tagName && c.tagName.toLowerCase() === 'li'); } catch (e) {}
      if (lis.length) { const body = lis.map((li, i) => (ordered ? (i + 1) + '. ' : '- ') + hfClean(children(li)) + '\n').join(''); return '\n\n' + body + '\n'; }
      return '\n\n' + children(node) + '\n';
    }
    if (tag === 'table') return tableToMarkdown(node);
    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'figure') return '\n' + children(node) + '\n';
    return children(node);
  }
  function tableToMarkdown(table) { // v26: поддержка colspan — колонки не уезжают
    let rows;
    try { rows = Array.from(table.querySelectorAll('tr')); } catch (e) { return ''; }
    if (!rows.length) return '';
    const matrix = rows.map(row => {
      const cells = [];
      try {
        Array.from(row.querySelectorAll('th,td')).forEach(cell => {
          const t = hfClean(cell.innerText || cell.textContent || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
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
  return hfClean(walk(root));
}
const THINK_SELECTORS = ['[class*="think"]', '[class*="reason"]', '[class*="analysis"]', '[class*="thought"]', '[data-testid*="think"]', '[data-testid*="reason"]', '[data-testid*="analysis"]', '[aria-label*="thinking" i]', '[aria-label*="reasoning" i]'];
function extractThinking(el) { // thinking-блоки → богатый MD (наши dlgQAll/dlgDedupe вместо v26-хелперов)
  const nodes = [];
  for (const sel of THINK_SELECTORS) { try { nodes.push(...dlgQAll(sel, el)); } catch (e) {} }
  const unique = dlgDedupe(nodes);
  const out = [];
  for (const n of unique) { const t = domToMarkdown(n); if (t && out.indexOf(t) === -1) out.push(t); }
  return out;
}

/* ---- МЕДИА И АРТЕФАКТЫ (v26) ---- */
const LANG_EXT = { javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py', ruby: 'rb', go: 'go', golang: 'go', rust: 'rs', java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', 'c#': 'cs', php: 'php', bash: 'sh', shell: 'sh', sh: 'sh', html: 'html', css: 'css', json: 'json', yaml: 'yml', yml: 'yml', xml: 'xml', markdown: 'md', md: 'md', sql: 'sql', r: 'r', swift: 'swift', kotlin: 'kt', scala: 'scala', perl: 'pl', lua: 'lua', dart: 'dart', toml: 'toml', ini: 'ini', tex: 'tex', matlab: 'm', mermaid: 'mmd' };
function collectMedia(el, msgIndex) { // картинки/вложения сообщения — URL собираются БЕЗ сети (§15)
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
      const a = atts[i], href = a.getAttribute('href') || '';
      if (!href || /^(#|javascript:)/i.test(href)) continue;
      attachments.push({ url: new URL(href, location.href).href, name: a.getAttribute('data-filename') || a.getAttribute('download') || (href.split('/').pop() || 'file').split('?')[0] });
    }
  } catch (e) {}
  return { images, attachments };
}
function collectArtifacts(el, msgIndex) { // код-блоки как отдельные файлы для ZIP
  const arts = [];
  try {
    const pres = el.querySelectorAll('pre');
    for (let i = 0; i < pres.length && arts.length < 30; i++) {
      const pre = pres[i], code = pre.querySelector('code') || pre;
      let lang = '';
      const clsStr = (code.className || '') + ' ' + (pre.className || '');
      const mm = clsStr.match(/language-([\w+#-]+)/i) || clsStr.match(/lang-([\w+#-]+)/i);
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
/* ---- СКРОЛЛ ИСТОРИИ + СТАБИЛИЗАЦИЯ (рабочая линейка v22/v24/v26) ---- */
function fingerprint() { // фингерпринт диалога по первым 80 символам сообщений
  const found = dlgFindMessages();
  if (!found) return '';
  return found.items.map(el => hfTxt(el).slice(0, 80)).join('|');
}
function findScrollContainer() { // от сообщения вверх → кандидаты по документу
  const found = dlgFindMessages();
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
async function autoScroll(statusFn) { // к началу, ждём стабилизации высоты, к концу
  const sc = findScrollContainer();
  if (!sc) return;
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
async function waitStable(prevFp, prevHref) { // фикс «экспорт предыдущего чата»: фингерпринт + смена URL
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
/* ---- БОГАТЫЙ SCRAPE (v27.0.0) + АВАРИЙНЫЙ СНИМОК СТРАНИЦЫ ---- */
let renderHolder = null;
function getRenderHolder() {
  if (!renderHolder || !renderHolder.isConnected) {
    renderHolder = document.createElement('div');
    renderHolder.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;pointer-events:none;opacity:0;z-index:-1;white-space:normal;';
    (document.body || document.documentElement).appendChild(renderHolder);
  }
  return renderHolder;
}
function extractText(el) { // клон в скрытый держатель — innerText считает переносы корректно (v20-приём)
  const clone = el.cloneNode(true);
  const remove = clone.querySelectorAll('style,script,link,meta,noscript,template,svg,button,nav,footer,[role="button"],[role="toolbar"],.sr-only,time,[class*="timestamp"],[class*="copy-button"],[class*="action-bar"],[class*="toolbar"],[class*="feedback"],[class*="rating"],mat-icon,[class*="icon"]:not([class*="content"]),[data-icon],i[class*="fa-"]');
  for (let i = 0; i < remove.length; i++) remove[i].remove();
  const holder = getRenderHolder();
  holder.appendChild(clone);
  let t = '';
  try { t = hfClean(clone.innerText || ''); } catch (e) { t = (clone.textContent || '').trim(); }
  clone.remove();
  return t;
}
function scrape(options) { // богатый сбор: MD-контент + текст + thinking + parity-роли + медиа/артефакты
  options = options || {};
  const found = dlgFindMessages();
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
  const roles = pre.map(m => dlgDetectRole(m.el, platform));
  const allUnknown = roles.length > 0 && roles.every(r => r === 'unknown');
  const allSame = roles.length > 1 && roles.every(r => r === roles[0]);
  const parity = allUnknown || (allSame && roles[0] !== 'user');
  const allImages = [], allAttachments = [], allArtifacts = [];
  const out = pre.map((m, i) => {
    let role = roles[i];
    if (role === 'unknown' && parity) role = i % 2 === 0 ? 'user' : 'assistant';
    else if (parity && role === roles[0]) role = i % 2 === 0 ? 'user' : 'assistant';
    let content = m.content;
    if (options.stripThinking && m.thinking.length) { // вырезаем ВСЕ вхождения блока
      for (const block of m.thinking) {
        if (!block || block.length < 3) continue;
        let guard = 0;
        while (content.indexOf(block) !== -1 && guard++ < 20) content = content.replace(block, '');
      }
      content = hfClean(content);
    }
    if (mermaidEnabled()) content = processMermaid(content);
    const media = collectMedia(m.el, i);
    collectArtifacts(m.el, i).forEach(a => allArtifacts.push(a));
    media.images.forEach(x => allImages.push(x));
    media.attachments.forEach(x => allAttachments.push(x));
    return { role, content, text: m.text || hfClean(m.content), thinking: options.exportThinking ? m.thinking : [] };
  }).filter(m => (options.stripThinking ? m.content : m.text) && (options.stripThinking ? m.content.length : m.text.length) >= CFG.MIN_TEXT);
  return { items: out.slice(0, CFG.MSG_MAX), source: found.source, platformName: (platform && platform.name) || null, images: allImages.slice(0, CFG.IMG_TOTAL), attachments: allAttachments.slice(0, CFG.IMG_TOTAL), artifacts: allArtifacts.slice(0, 300) };
}
function snapshotScrape() { // аварийный снимок страницы (урок из Gemini-беседы)
  try {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('#' + HOST_ID + ',#' + DLG_HOLDER_ID + ',script,style,noscript,svg').forEach(n => n.remove());
    const holder = getRenderHolder();
    holder.appendChild(clone);
    let t = '';
    try { t = hfClean(clone.innerText || ''); } catch (e) { t = (clone.textContent || '').trim(); }
    clone.remove();
    if (!t || t.length < CFG.MIN_TOTAL_TEXT) return null;
    if (t.length > CFG.SNAPSHOT_MAX) t = t.slice(0, CFG.SNAPSHOT_MAX) + '\n\n… (обрезано)';
    const msg = '⚠ Автоснимок страницы (структура не распознана точечно):\n\n' + t;
    return { items: [{ role: 'unknown', content: msg, text: msg, thinking: [] }], source: 'snapshot', platformName: (dlgGetPlatform() || {}).name || null, images: [], attachments: [], artifacts: [] };
  } catch (e) { return null; }
}

/* ---- ФОРМАТЫ ЭКСПОРТА (9, v27.0.0): rich-линия на нашемDlg-сырье ---- */
const platformName = scraped => (scraped && scraped.platformName) || (dlgGetPlatform() ? dlgGetPlatform().name : 'universal-heuristic');
const roleLabel = dlgRoleLabel;
const sharegptFrom = dlgSGFrom;
const frontMatterEnabled = () => S.fm !== false;
function toMarkdown(scraped, title) {
  const L = [];
  if (frontMatterEnabled()) {
    const dateTag = '#export-' + now().slice(0, 10);
    const platTag = '#' + String(platformName(scraped)).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '');
    L.push('---', 'title: ' + JSON.stringify(String(title || 'export')), 'platform: ' + JSON.stringify(platformName(scraped)),
      'url: ' + JSON.stringify(location.href), 'exported_at: ' + JSON.stringify(new Date().toISOString()),
      'exporter: ' + JSON.stringify('UACE v' + VER + ' · PML-PANEL B · HF-цех'), 'messages_count: ' + scraped.items.length,
      'tags: [' + JSON.stringify(platTag) + ', ' + JSON.stringify(dateTag) + ']', '---', '', '# ' + title, '');
  } else {
    L.push('# ' + title, '', '- **Platform:** ' + platformName(scraped), '- **URL:** ' + location.href,
      '- **Exported:** ' + now() + ' (v' + VER + ')', '- **Messages:** ' + scraped.items.length, '', '---', '');
  }
  scraped.items.forEach((m, i) => {
    L.push('### ' + roleLabel(m.role), '', m.text || m.content || '', '');
    if (m.thinking && m.thinking.length) L.push('<details><summary>🧠 Thinking</summary>', '', m.thinking.join('\n\n'), '', '</details>', '');
  });
  return L.join('\n') + '\n';
}
function toJSON(scraped, title) {
  return JSON.stringify({ title, platform: platformName(scraped), exporter: 'UACE v' + VER, url: location.href,
    exported_at: new Date().toISOString(), messages_count: scraped.items.length, source_selector: scraped.source || null,
    messages: scraped.items.map((m, i) => ({ index: i, role: m.role, content_markdown: m.content, text: m.text, thinking: m.thinking || [] })) }, null, 2);
}
function toTXT(scraped, title) {
  const lines = [title, '='.repeat(Math.min(title.length, 70)), 'Platform: ' + platformName(scraped), 'URL: ' + location.href,
    'Exported: ' + now() + ' (v' + VER + ')', ''];
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
  h += '<div class="meta">Platform: ' + esc(platformName(scraped)) + '<br>URL: ' + esc(location.href) + '<br>Exported: ' + esc(now()) + ' (v' + VER + ')<br>Messages: ' + scraped.items.length + '</div>';
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
function toShareGPT(scraped, title) {
  return JSON.stringify({ title, url: location.href, exported_at: new Date().toISOString(),
    conversations: scraped.items.map(m => ({ from: sharegptFrom(m.role), value: m.text || m.content })) }, null, 2);
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
/* ---- ДОСТАВКА: BLOB / SMART (File System Access) / СОБСТВЕННЫЙ ZIP (STORE) / PDF ---- */
function downloadBlob(content, filename, mime) {
  const blob = (content instanceof Blob) ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  (document.body || document.documentElement).appendChild(a);
  a.click(); a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 1500);
}
async function downloadSmart(content, filename, mime) { // v26: стриминг больших ZIP/PDF без удержания blob во вкладке
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
  downloadBlob(blob, filename, mime);
  return false;
}
function zipStore(entries) { // собственный ZIP-писатель (STORE, UTF-8 имена, 0 библиотек) — строки И Uint8Array
  const enc = new TextEncoder(), localChunks = [], centralChunks = [];
  let offset = 0;
  const d = new Date();
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xffff;
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const e of entries) {
    const name = enc.encode(e.name);
    let data;
    if (ArrayBuffer.isView(e.data)) data = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength); // реалм-независимо (jsdom/VM)
    else data = enc.encode(String(e.data));
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    localChunks.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    centralChunks.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  let cdSize = 0;
  for (const c of centralChunks) cdSize += c.length;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true); eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true);
  return new Blob(localChunks.concat(centralChunks, [new Uint8Array(eocd.buffer)]), { type: 'application/zip' });
}
function blobToU8(blob) { return blob.arrayBuffer().then(ab => new Uint8Array(ab)); }
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
async function fetchImageU8(url) { // СЕТЬ! вызывается ТОЛЬКО при S.mediaNet=true (opt-in, §15)
  const tries = CFG.IMG_RETRIES || 3;
  let lastErr = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, CFG.IMG_TIMEOUT) : null;
    try {
      const resp = await fetch(url, { mode: 'cors', cache: attempt === 0 ? 'force-cache' : 'no-cache', signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status + (resp.status === 401 || resp.status === 403 ? ' (session-bound)' : ''));
      const blob = await resp.blob();
      return { data: await blobToU8(blob), ext: extFromMime(blob.type) };
    } catch (e) {
      lastErr = e;
      if (attempt < tries - 1) await sleep(350 * (attempt + 1));
    } finally { if (timer) clearTimeout(timer); }
  }
  throw lastErr || new Error('fetch failed');
}
const resolveInner = () => ['md', 'json', 'txt', 'html', 'both', 'pdf'].indexOf(S.zipInner) !== -1 ? S.zipInner : 'md';
const imagesEnabled = () => S.images !== false;
async function buildZipEntries(results, failures, innerFmt, statusFn) { // chats/ + images/ + artifacts/ + _index.json
  let fmt = innerFmt;
  if (fmt === 'pdf' && !S.pdfCdn) fmt = 'md'; // PDF-рендер выключен → md-фолбэк (0 сети)
  const entries = [], index = [], imagesFailed = [], attachmentsAll = [];
  let imgSeq = 0, artSeq = 0;
  for (let i = 0; i < results.length; i++) {
    if (CANCEL) break;
    const r = results[i];
    if (statusFn) statusFn('ZIP ' + progress(i, results.length, sanitize(r.title, 24)));
    const base = String(i + 1).padStart(3, '0') + '-' + sanitize(r.title);
    const rec = { file: '', title: r.title, url: r.url, messages: r.scraped.items.length };
    if (fmt === 'both') { // двойной формат для ML-пайплайнов — md + json рядом
      const fm = contentFor('md', r.scraped, r.title), fj = contentFor('json', r.scraped, r.title);
      rec.file = base + '.md+.json';
      entries.push({ name: 'chats/' + base + '.md', data: fm.content });
      entries.push({ name: 'chats/' + base + '.json', data: fj.content });
    } else if (fmt === 'pdf') {
      try {
        const blob = await renderPdfBlob(r.scraped, r.title);
        rec.file = base + '.pdf';
        entries.push({ name: 'chats/' + rec.file, data: await blobToU8(blob) });
      } catch (e) {
        rec.file = base + '.md'; rec.note = 'PDF недоступен (' + (e && e.message) + '), сохранён MD';
        entries.push({ name: 'chats/' + rec.file, data: contentFor('md', r.scraped, r.title).content });
      }
    } else {
      const f = contentFor(fmt, r.scraped, r.title);
      rec.file = base + '.' + f.ext;
      entries.push({ name: 'chats/' + rec.file, data: f.content });
    }
    if (S.mediaNet && imagesEnabled() && r.scraped && Array.isArray(r.scraped.images)) { // СЕТЬ — opt-in
      let perChat = 0;
      for (const im of r.scraped.images) {
        if (imgSeq >= CFG.IMG_TOTAL || perChat >= 20) break;
        try {
          const got = await fetchImageU8(im.src);
          imgSeq++; perChat++;
          entries.push({ name: 'images/' + String(i + 1).padStart(3, '0') + '-' + String(perChat).padStart(2, '0') + '.' + got.ext, data: got.data });
          rec.images = (rec.images || 0) + 1;
        } catch (e) { imagesFailed.push(im.src + ' — ' + (e && e.message || 'ошибка')); }
      }
    }
    if (r.scraped && Array.isArray(r.scraped.attachments)) r.scraped.attachments.forEach(a => attachmentsAll.push({ chat: r.title, url: a.url, name: a.name }));
    if (r.scraped && Array.isArray(r.scraped.artifacts)) { // артефакты кода — файлы (это текст диалога, §15-компромисс)
      for (const a of r.scraped.artifacts) {
        if (artSeq >= CFG.ARTIFACTS_MAX) break;
        artSeq++;
        entries.push({ name: 'artifacts/' + String(i + 1).padStart(3, '0') + '-' + String((a.msg || 0) + 1).padStart(2, '0') + '-' + sanitize(a.lang || 'text', 20) + '.' + (a.ext || 'txt'), data: a.content || '' });
        rec.artifacts = (rec.artifacts || 0) + 1;
      }
    }
    index.push(rec);
  }
  if (imagesEnabled()) { // прямые ссылки на все картинки — ручная дозагрузка при CORS-блоках (БЕЗ сети)
    const links = [];
    for (const r of results) { if (r.scraped && Array.isArray(r.scraped.images)) r.scraped.images.forEach(im => links.push('- [' + sanitize(r.title, 40) + '] ' + im.src)); }
    if (links.length) entries.push({ name: '_image-links.txt', data: ['# Все найденные изображения (для ручной загрузки при CORS-блоках)', ''].concat(links).join('\n') });
  }
  if (failures.length) entries.push({ name: '_FAILURES.txt', data: ['# Не удалось', ''].concat(failures.map(f => '- ' + f.title + ': ' + f.error)).join('\n') });
  if (attachmentsAll.length) entries.push({ name: '_attachments.txt', data: attachmentsAll.map(a => '- [' + sanitize(a.chat, 40) + '] ' + a.name + ' — ' + a.url).join('\n') });
  if (imagesFailed.length) entries.push({ name: '_images-failed.txt', data: ['# Не скачались (CORS/доступ)', ''].concat(imagesFailed).join('\n') });
  entries.push({ name: '_index.json', data: JSON.stringify({ exporter: 'UACE v' + VER, created: now(), format: fmt, chats: index, failures, images_failed: imagesFailed.length }, null, 2) });
  return entries;
}
function splitZipVolumes(entries, maxBytes) { // тома ≤50 МБ (анти-краш вкладки)
  const limit = maxBytes || CFG.MAX_ZIP_MB * 1024 * 1024;
  const size = e => 30 + (e.name ? e.name.length : 0) + (e.data ? (e.data.length || 0) : 0) + 46;
  const total = entries.reduce((s, e) => s + size(e), 0);
  if (total <= limit) return [entries];
  const vols = [];
  let cur = [], curSize = 0;
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
    await downloadSmart(zipStore(vols[i]), name, 'application/zip');
  }
  if (vols.length > 1) toast('⚠ ZIP разбит на ' + vols.length + ' томов (лимит ' + CFG.MAX_ZIP_MB + ' МБ)', 5000);
}
/* ---- PDF: html2pdf (СТРОГО opt-in CDN) → печать браузера (по умолчанию — 0 сети, §15) ---- */
const LIBS = { html2pdf: ['https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.12.1/html2pdf.bundle.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'] };
function loadScript(urls, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  const next = i => i >= urls.length ? Promise.reject(new Error('load failed: ' + globalName)) :
    new Promise((res, rej) => { const s = document.createElement('script'); s.src = urls[i]; s.onload = () => res(window[globalName]); s.onerror = () => rej(new Error('cdn ' + urls[i])); document.head.appendChild(s); }).catch(() => next(i + 1));
  return next(0);
}
async function renderPdfBlob(scraped, title) { // СЕТЬ! только при S.pdfCdn (вызывающие проверяют)
  await loadScript(LIBS.html2pdf, 'html2pdf');
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;background:#fff;';
  holder.innerHTML = '<style>' + htmlCss() + '</style>' + htmlBody(scraped, title);
  (document.body || document.documentElement).appendChild(holder);
  try {
    const pdf = await window.html2pdf().set({ margin: 10, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(holder).toPdf().get('pdf');
    return pdf.output('blob');
  } finally { holder.remove(); }
}
function printFallback(scraped, title) {
  const w = window.open('', '_blank');
  if (!w) { downloadBlob(toHTML(scraped, title), sanitize(title) + '-' + ts() + '.print.html', 'text/html;charset=utf-8'); return; }
  w.document.open(); w.document.write(toHTML(scraped, title)); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 500);
}
async function exportAsPDF(scraped, title) {
  if (!S.pdfCdn) { printFallback(scraped, title); return; } // автономность по построению
  try { const blob = await renderPdfBlob(scraped, title); downloadBlob(blob, sanitize(title) + '-' + ts() + '.pdf', 'application/pdf'); }
  catch (e) { log('warn', 'PDF-рендер не удался: ' + (e && e.message) + ' — локальная печать'); printFallback(scraped, title); }
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
function buildMerged(results, innerFmt) { // объединённый файл всех чатов
  if (innerFmt === 'json') return JSON.stringify({ exporter: 'UACE v' + VER, created: now(), chats: results.map(r => ({ title: r.title, url: r.url, platform: platformName(r.scraped), messages: r.scraped.items })) }, null, 2);
  if (innerFmt === 'sharegpt') return JSON.stringify({ exporter: 'UACE v' + VER, created: now(), chats: results.map(r => ({ title: r.title, url: r.url, conversations: r.scraped.items.map(m => ({ from: sharegptFrom(m.role), value: m.text || m.content })) })) }, null, 2);
  if (innerFmt === 'alpaca') return JSON.stringify({ exporter: 'UACE v' + VER, created: now(), chats: results.map(r => JSON.parse(toAlpaca(r.scraped, r.title))) }, null, 2);
  if (innerFmt === 'jsonl') return results.map(r => toJSONL(r.scraped, r.title)).join('\n');
  if (innerFmt === 'html') {
    let h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI Chats</title><style>' + htmlCss() + 'section{page-break-after:always}</style></head><body>';
    results.forEach(r => { h += '<section>' + htmlBody(r.scraped, r.title) + '</section>'; });
    return h + '</body></html>';
  }
  const sep = '='.repeat(60);
  return results.map((r, i) => {
    const f = contentFor(innerFmt === 'pdf' ? 'md' : innerFmt, r.scraped, r.title);
    return '\n\n' + sep + '\n' + (i + 1) + '. ' + r.title + '\n' + r.url + '\n' + sep + '\n\n' + f.content;
  }).join('\n');
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
    } catch (e) { log('warn', 'ZIP не удался: ' + (e && e.message) + ' — объединённый файл'); }
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

/* ---- САЙДБАР / СПИСОК ЧАТОВ (мерж v22 + v24, UI_ID → наш хост) ---- */
const UUID_RE = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
function extractChatTarget(el) { // href/dataId: атрибуты → внутренняя ссылка → React fiber (v24)
  if (!el) return { href: null, id: null };
  if (el.attributes) {
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i], v = a.value || '';
      if (a.name === 'href' && v) { try { return { href: new URL(v, location.href).href, id: null }; } catch (e) {} }
      const m = v.match(UUID_RE);
      if (m) return { href: null, id: m[1] };
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
              const m = pv.match(UUID_RE);
              if (m) return { href: null, id: m[1] };
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
  const platform = dlgGetPlatform();
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
        const evt = { type: 'click', target: el, currentTarget: el, nativeEvent: { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
          preventDefault() {}, stopPropagation() {}, isDefaultPrevented() { return false; }, isPropagationStopped() { return false; }, persist() {}, defaultPrevented: false, bubbles: true, cancelable: true };
        props.onClick(evt);
        return true;
      }
    }
  } catch (e) {}
  return false;
}
function isChatUrl(href) { // строгий фильтр URL чата (мерж v22 + v24)
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
const NAV_KEYWORDS = ['проекты', 'проект', 'новая папка', 'новый проект', 'vibe', 'work', 'code', 'chat', 'projects', 'настройки', 'settings', 'профиль', 'profile', 'новый чат', 'new chat', 'помощь', 'help', 'сообщество', 'community', 'обновления', 'updates', 'поиск', 'search', 'архив', 'archive', 'избранное', 'library', 'библиотека', 'gpts', 'sora', 'explore', 'discover', 'temporary chat', 'временный чат', '新对话', '新建对话', '新聊天', '新建会话', '设置', '帮助', 'delete', 'удалить', 'rename', 'переименовать', 'pin', 'закрепить', 'share', 'поделиться', 'все чаты', 'all chats', 'история', 'history', 'activity', 'gemini', 'extensions', 'расширения', 'gems', 'notebooklm', 'new notebook', 'upgrade', 'обновить', 'попробовать', 'блокноты', 'недавние', 'artifacts', 'customize', 'pinned', 'new', 'claude', 'images', 'scheduled', 'plugins', 'health', 'codex', 'создание контента ии', 'запланированные задачи', 'диск', 'dola', 'поиск по чатам', 'новый блокнот', 'новая беседа'];
function normalizeNavKey(s) { return String(s || '').replace(/[\s.…,;:!?—–-]+$/g, '').toLowerCase().trim(); }
function isNavKeyword(s) {
  if (!s) return false;
  const low = normalizeNavKey(s);
  if (!low || low.length > 40) return false;
  return NAV_KEYWORDS.indexOf(low) !== -1;
}
function isClickable(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'a' && el.hasAttribute && el.hasAttribute('href')) return true;
  if (tag === 'button') return true;
  const role = el.getAttribute ? (el.getAttribute('role') || '') : '';
  if (role === 'button' || role === 'link' || role === 'listitem' || role === 'option' || role === 'tab') return true;
  const tab = el.getAttribute ? el.getAttribute('tabindex') : null;
  return tab !== null && tab !== undefined && tab !== '-1';
}
function isNavContainer(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  const role = el.getAttribute ? (el.getAttribute('role') || '') : '';
  if (tag === 'mat-sidenav' || tag === 'bard-sidenav' || tag === 'side-navigation-v2') return true;
  if (tag === 'aside' || tag === 'nav' || role === 'navigation') return true;
  const c = (typeof el.className === 'string' ? el.className : '').toLowerCase();
  return /sidenav|sidebar|side-nav|drawer|history-list|chat-list|conversation-list|side-bar|chat-aside|chat-history/.test(c);
}
function isLeftSide(el) {
  if (!el) return false;
  try {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 1920;
    if (r.height < 100 || r.width < 20) return false;
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
  return /^```/.test(t);
}
function looksLikeChatItem(el) {
  if (!el || !isVisible(el)) return false;
  if (hfIsInExclude(el)) return false;
  if (isInChatArea(el)) return false; // внутри чата — не элемент списка чатов
  let t = hfTxt(el);
  if (!t || t.length < 2) { const p = el.parentElement; if (p) t = hfTxt(p); }
  if (!t || t.length < 2 || t.length > 120) return false;
  if (isNavKeyword(t) || isCssOrJs(t) || isSourceListing(t)) return false;
  if (t.indexOf('\n') !== -1 || t.indexOf('::') !== -1) return false;
  if (looksLikeCode(t) || /^[#>*-]\s/.test(t)) return false;
  if (/[.…]{2,}\s*$/.test(t)) return false;
  return !/^[A-Za-z]{2,6}$/.test(t);
}
function findLeftPanel() {
  const cands = [];
  const sels = 'mat-sidenav, bard-sidenav, side-navigation-v2, aside, nav, [role="navigation"], [class*="sidenav"], [class*="sidebar"], [class*="sider"], [class*="side-bar"], [class*="history"], [class*="conversation"], [class*="chat-aside"], [class*="chat-history"], [class*="chat-list"], #flow_chat_sidebar, nav[class*="panel-"]';
  let els2 = [];
  try { els2 = document.querySelectorAll(sels); } catch (e) { els2 = []; }
  els2.forEach(el => {
    try {
      if (hfIsInExclude(el)) return;
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
function isDrawerOpen() {
  return !!document.querySelector('mat-sidenav.mat-drawer-opened, mat-sidenav.mat-drawer-opening, bard-sidenav.mat-drawer-opened, bard-sidenav.mat-drawer-opening, aside.mat-drawer-opened');
}
function isSidebarOpen() {
  if (isDrawerOpen()) return true;
  const panel = findLeftPanel();
  if (!panel) return false;
  const r = panel.getBoundingClientRect();
  return r.left >= -5 && r.width >= 20 && r.height >= 100;
}
async function waitForDrawerOpen(t) {
  const s = Date.now();
  while (Date.now() - s < t) {
    if (isDrawerOpen()) { await sleep(600); return true; }
    await sleep(150);
  }
  return isDrawerOpen();
}
async function dispatchFullClick(el) { // полная серия мышиных событий (React/SPA)
  try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
  await sleep(120);
  try { if (typeof el.focus === 'function') el.focus(); } catch (e) {}
  let cx = 1, cy = 1;
  try { const r = el.getBoundingClientRect(); cx = Math.floor(r.left + r.width / 2) || 1; cy = Math.floor(r.top + r.height / 2) || 1; } catch (e) {}
  const base = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, detail: 1 };
  const fire = (Ctor, type, extra) => { try { el.dispatchEvent(new Ctor(type, Object.assign({}, base, extra))); } catch (e) {} };
  fire(PointerEvent, 'pointerover', { pointerId: 1, pointerType: 'mouse', buttons: 0, isPrimary: true });
  fire(MouseEvent, 'mouseover', { buttons: 0 });
  fire(PointerEvent, 'pointerenter', { pointerId: 1, pointerType: 'mouse', buttons: 0, isPrimary: true });
  fire(MouseEvent, 'mouseenter', { buttons: 0 });
  fire(MouseEvent, 'mousemove', {});
  fire(PointerEvent, 'pointerdown', { pointerId: 1, pointerType: 'mouse', buttons: 1, isPrimary: true });
  fire(MouseEvent, 'mousedown', { buttons: 1 });
  fire(PointerEvent, 'pointerup', { pointerId: 1, pointerType: 'mouse', buttons: 0, isPrimary: true });
  fire(MouseEvent, 'mouseup', { buttons: 0 });
  fire(MouseEvent, 'click', {});
  try { if (typeof el.click === 'function') el.click(); } catch (e) {}
}
async function tryOpenSidebar() {
  if (isSidebarOpen()) return true;
  const seen = new Set(), cands = [];
  const pushC = el => { if (!el || seen.has(el)) return; if (!isVisible(el)) return; seen.add(el); cands.push(el); };
  try { const q = document.querySelector('#sidebar-toggle-button'); if (q) pushC(q); } catch (e) {}
  const sels = ['button[aria-label*="Main menu" i]', 'button[aria-label*="Side panel" i]', 'button[aria-label*="sidebar" i]', 'button[aria-label*="sidenav" i]', 'button[aria-label*="Toggle sidebar" i]', 'button[aria-label*="menu" i]', 'button[aria-label*="Open" i]', 'button[aria-label*="Открыть" i]', 'button[aria-label*="меню" i]', '[class*="sidebar-toggle"]', '[class*="menu-toggle"]', '[class*="hamburger"]', '.slide-switch'];
  for (const sel of sels) { try { document.querySelectorAll(sel).forEach(pushC); } catch (e) {} }
  for (const c of cands) {
    try { await dispatchFullClick(c); if (await waitForDrawerOpen(2000)) return true; } catch (e) {}
  }
  return isSidebarOpen();
}
async function ensureSidebar() {
  let ok = await tryOpenSidebar();
  if (!ok) { await sleep(800); ok = await tryOpenSidebar(); }
  if (!ok) { await sleep(1200); ok = await tryOpenSidebar(); }
  return ok;
}
function extractItemsFromPanel(panel) { // группировка по тегу: крупнейшая группа кликабельных элементов
  if (!panel) return [];
  const groups = {};
  panel.querySelectorAll('*').forEach(el => {
    try {
      if (hfIsInExclude(el)) return;
      if (!looksLikeChatItem(el)) return;
      if (el.children.length > 10) return;
      let clickable = isClickable(el);
      if (!clickable) { const anc = el.closest && el.closest('a[href], button, [role="button"], [role="listitem"]'); if (anc) clickable = true; }
      if (!clickable) return;
      (groups[el.tagName] = groups[el.tagName] || []).push(el);
    } catch (e) {}
  });
  let best = null;
  Object.keys(groups).forEach(key => {
    const list = groups[key];
    if (list.length < 2) return;
    const cleanList = list.filter(el => !list.some(o => o !== el && o.contains(el)));
    if (cleanList.length < 2) return;
    if (!best || cleanList.length > best.items.length) best = { key, items: cleanList };
  });
  if (!best) return [];
  return best.items.map(el => {
    const ex = extractChatTarget(el);
    return { el, href: (ex && ex.href) || '', title: hfTxt(el).slice(0, 120), dataId: (ex && ex.id) || null };
  });
}
function collectChatLinks(rootEl) { // A) платформенные подсказки B) селекторы C) URL того же origin D) панель
  const root = rootEl || document, out = [], seen = new Set();
  const curUrl = location.href.split('?')[0].replace(/\/$/, '');
  const push = item => {
    if (!item || !item.el) return;
    if (seen.has(item.el)) return;
    for (let i = 0; i < out.length; i++) {
      if (out[i].el === item.el) return;
      if (out[i].el.contains(item.el) || item.el.contains(out[i].el)) return;
    }
    seen.add(item.el);
    out.push(item);
  };
  try {
    const sel = 'a[aria-label="chat-item"], a.chat-item-drag-link, [class*="conversation-item"], [class*="chat-item"], [class*="history-item"], [class*="session-item"], [data-chat-id], [data-conversation-id], [data-session-id], [data-thread-id]';
    root.querySelectorAll(sel).forEach(el => {
      if (!isVisible(el)) return;
      const t = hfTxt(el);
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
      const t = hfTxt(a);
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
  let containers;
  try { containers = document.querySelectorAll(selector); } catch (e) { return null; }
  const cands = [];
  for (const c of containers) {
    if (hfIsInExclude(c)) continue;
    if (!isLeftSide(c)) continue;
    const links = collectChatLinks(c);
    if (links.length >= 2) cands.push({ container: c, items: links, score: links.length, via: 'container' });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0] || null;
}
function findStructuralChatItems() {
  const panel = findLeftPanel();
  if (!panel) return null;
  const items = extractItemsFromPanel(panel);
  return items.length >= 2 ? { container: panel, items, score: items.length, via: 'left-panel' } : null;
}
function findClickableChatItems() {
  const panel = findLeftPanel();
  if (!panel) return null;
  const items = [];
  const curUrl = location.href.split('?')[0].replace(/\/$/, '');
  let nl = [];
  try { nl = panel.querySelectorAll('[role="button"], [role="link"], [role="listitem"], [tabindex]:not([tabindex="-1"]), button, li, a[aria-label="chat-item"], a.chat-item-drag-link, [class*="conversation-item"]'); } catch (e) {}
  for (const el of nl) {
    if (hfIsInExclude(el)) continue;
    if (!isVisible(el)) continue;
    if (el.children.length > 6) continue;
    const t = hfTxt(el);
    if (!t || t.length < 2 || t.length > 120) continue;
    if (looksLikeCode(t) || isNavKeyword(t) || isCssOrJs(t)) continue;
    if (t.indexOf('\n') !== -1) continue;
    const href = el.href || '';
    if (href && href.split('?')[0].replace(/\/$/, '') === curUrl) continue;
    items.push({ el, href, title: t.slice(0, 120), dataId: null });
  }
  return items.length >= 2 ? { container: panel, items, score: items.length, via: 'click-items' } : null;
}
function findList() { // стратегический каскад: generic → conversation-item → structural → click-items → doc-links
  const strategies = [];
  strategies.push({ name: 'generic', fn: () => scanContainers('nav,aside,[role="navigation"],[class*="sidebar"],[class*="history"],[class*="chat-list"],[class*="conversation-list"],[class*="sider"]') });
  strategies.push({ name: 'conversation-item', fn: () => {
    const items = [];
    try {
      document.querySelectorAll('[class*="conversation-item"], a[id^="conversation_"]').forEach(el => {
        const t = hfTxt(el);
        if (!t || t.length < 2) return;
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
async function prescrollList(container) { // прокрутка списка — ленивые чаты попадают в DOM
  if (!container) return;
  const step = Math.max(200, Math.floor(container.clientHeight * 0.8));
  for (let k = 0; k < 4; k++) {
    container.scrollTop = 0; await sleep(150);
    for (let y = 0; y < container.scrollHeight; y += step) { container.scrollTop = y; await sleep(120); }
    container.scrollTop = container.scrollHeight; await sleep(200);
  }
  container.scrollTop = 0; await sleep(150);
}

/* ---- АКТИВАЦИЯ ЧАТА + МАССОВЫЙ ЭКСПОРТ (same-tab / вкладки) ---- */
async function activateChatItem(it) { // v25.0.2-линейка: клик → React onClick → серия событий → навигация
  if (!it) return false;
  let el = (it.el && it.el.isConnected) ? it.el : null;
  if (!el && it.title) { // RESUME: el не сериализуется — переищем по заголовку
    try {
      const list = findList();
      if (list && Array.isArray(list.items)) {
        const t = String(it.title).trim().toLowerCase();
        for (const x of list.items) { if (x && x.el && x.el.isConnected && String(x.title || '').trim().toLowerCase() === t) { el = x.el; break; } }
      }
    } catch (e) {}
  }
  const hrefBefore = location.href, fpBefore = fingerprint();
  if (el) {
    try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
    await sleep(120);
    const targets = [el];
    try {
      const inner = el.querySelector('a[href],button,[role="link"],[role="button"],[role="menuitem"]');
      if (inner) targets.push(inner);
      const outer = el.closest && el.closest('a[href],[role="link"]');
      if (outer) targets.push(outer);
    } catch (e) {}
    for (let k = 0; k < targets.length; k++) {
      if (CANCEL) return true;
      const t = targets[k];
      try { t.click(); } catch (e) {}
      try { tryReactOnClick(t); } catch (e) {}
      try { ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => { t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); }); } catch (e) {}
      await sleep(300);
      if (location.href !== hrefBefore || fingerprint() !== fpBefore) return true;
    }
    try { const changed = await waitForContentChange(hrefBefore, fpBefore, 2500); if (changed) return true; } catch (e) {}
  }
  // последний резерв: прямая навигация по href/dataId (сессия сохранена → «Продолжить»)
  let url = it.href || '';
  if (!url && it.dataId) { try { url = buildChatUrl(it.dataId) || ''; } catch (e) {} }
  if (url && url.split('#')[0] !== location.href.split('#')[0]) {
    try { location.href = url; await sleep(1200); return true; } catch (e) {}
  }
  return false;
}
async function exportAllSameTab(format, options, statusFn, session) {
  let items = null, startIdx = 0;
  if (session && Array.isArray(session.items) && session.items.length) {
    items = session.items;
    startIdx = Math.max(0, Math.min(session.idx || 0, items.length - 1));
    if (statusFn) statusFn('▶ Продолжаю с ' + (startIdx + 1) + '/' + items.length);
    await ensureSidebar();
    try { // перепривязка el по нормализованному ключу (сайдбар мог перерисоваться)
      const list = findList();
      if (list && Array.isArray(list.items)) {
        const byKey = new Map();
        list.items.forEach(x => { const k = manifestKey(x); if (k && !byKey.has(k)) byKey.set(k, x.el); });
        items.forEach(it => { const el = byKey.get(manifestKey(it)); if (el) it.el = el; });
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
    if (deduped.length < 2) throw new Error('В списке меньше двух чатов.');
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
    if (CANCEL) { if (statusFn) statusFn('⏹ Остановлено. ' + progress(i, items.length, 'Продолжите кнопкой «Продолжить»'));
      saveSession({ mode: 'same', fmt: format, items: items.map(x => ({ title: x.title, href: x.href, dataId: x.dataId })), idx: i });
      return { results, failures, total: items.length, skipped, stopped: true }; }
    const it = items[i];
    if (statusFn) statusFn(progress(i, items.length, it.title.slice(0, 30)));
    try {
      const beforeHref = location.href, fpBefore = fingerprint();
      const activated = await activateChatItem(it);
      if (!activated) throw new Error('клик не сработал — используйте «все чаты (вкладки)»');
      const ok = await waitStable(fpBefore, beforeHref);
      if (!ok) throw new Error('контент не догрузился');
      await autoScroll(statusFn);
      await sleep(500);
      const scraped = scrape(options);
      if (!scraped.items.length) throw new Error('сообщения не найдены');
      const chatFp = chatHash(scraped), mkey = manifestKey(it);
      if (options && options.onlyNew) { if (manifest[mkey] && manifest[mkey].hash === chatFp) { skipped++; continue; } }
      if (chatFp === lastChatFp && location.href === beforeHref) throw new Error('дубликат');
      lastChatFp = chatFp;
      results.push({ title: it.title, scraped, url: location.href });
      manifest[mkey] = { hash: chatFp, exported_at: new Date().toISOString(), title: it.title };
      saveManifest(manifest);
    } catch (e) {
      failures.push({ title: it.title, url: it.href || '', error: String(e && e.message || e) });
    }
    saveSession({ mode: 'same', fmt: format, items: items.map(x => ({ title: x.title, href: x.href, dataId: x.dataId })), idx: i + 1 });
    await sleep(300);
  }
  clearSession();
  await flushManifest();
  return { results, failures, total: items.length, skipped };
}
/* дочерние вкладки: скрипт в открытой вкладке отвечает на MSG_REQ (пост-сообщение, 0 внешней сети) */
window.addEventListener('message', event => {
  if (event.source === window) return;
  const d = event.data;
  if (!d || d.type !== MSG_REQ || !d.nonce) return;
  if (tabsExportRunning) return;
  const respond = payload => { try { event.source.postMessage(Object.assign({ type: MSG_RES, nonce: d.nonce }, payload), event.origin === 'null' ? '*' : event.origin); } catch (e) {} };
  (async () => {
    try {
      await autoScroll(null);
      await waitStable(fingerprint(), location.href);
      const scraped = scrape(d.options || {});
      respond({ ok: scraped.items.length > 0, url: location.href, title: dlgTitle() || document.title, data: scraped });
    } catch (e) { respond({ ok: false, url: location.href, title: document.title, error: String(e && e.message || e) }); }
  })();
});
function waitForChildResult(child, nonce, timeout, options) {
  return new Promise(resolve => {
    let done = false, timer = null, pingTimer = null;
    const finish = v => { if (done) return; done = true;
      try { window.removeEventListener('message', listener); } catch (e) {}
      if (timer) clearTimeout(timer);
      if (pingTimer) clearInterval(pingTimer);
      resolve(v); };
    const listener = event => {
      const d = event.data;
      if (!d || d.type !== MSG_RES || d.nonce !== nonce) return;
      if (event.source !== child) return;
      finish(d);
    };
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
      if (CANCEL) {
        if (statusFn) statusFn('⏹ Остановлено. ' + progress(i, items.length, 'Продолжите кнопкой «Продолжить»'));
        saveSession({ mode: 'tabs', fmt: format, items: items.map(x => ({ title: x.title, href: x.href, dataId: x.dataId || null })), idx: i });
        return { results, failures, total: items.length, skipped, stopped: true };
      }
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
        const chatFp = chatHash(response.data), mkey = manifestKey(it);
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
  clearSession();
  await flushManifest();
  return { results, failures, total: items.length, skipped };
}
async function exportAll(format, mode, options, statusFn, session) {
  const inner = format === 'zip' ? resolveInner() : format;
  const outcome = (mode === 'tabs') ? await exportAllTabs(format, options, statusFn, session) : await exportAllSameTab(format, options, statusFn, session);
  await finalizeResults(outcome.results, outcome.failures, format, inner, statusFn);
  toast('✅ Готово: ' + outcome.results.length + ' чатов' + (outcome.failures.length ? ', ошибок: ' + outcome.failures.length : '') + (outcome.skipped ? ', пропущено (onlyNew): ' + outcome.skipped : ''), 3000);
  return { ok: outcome.results.length, fail: outcome.failures.length, total: outcome.total, skipped: outcome.skipped || 0, stopped: !!outcome.stopped };
}
/* ---- КОПИРОВАНИЕ: буфер-тексты (v24) ---- */
async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return; }
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
  (document.body || document.documentElement).appendChild(ta);
  ta.select(); document.execCommand('copy'); ta.remove();
}
async function copyCurrentMd() { // богатый MD текущего диалога в буфер (автоскролл + KaTeX/таблицы)
  await autoScroll(null);
  const scraped = scrape(hfOptions());
  if (!scraped.items.length) throw new Error('Сообщения не найдены');
  await copyTextToClipboard(toMarkdown(scraped, dlgTitle()));
  return scraped.items.length;
}
async function copyContinuePrompt() { // перенос диалога в другой AI (фича v24)
  await autoScroll(null);
  const scraped = scrape(hfOptions());
  if (!scraped.items.length) throw new Error('Сообщения не найдены');
  const L = ['# Перенос диалога в другой AI', '', 'Продолжи диалог ниже. История от другого AI-ассистента:', ''];
  scraped.items.forEach(m => { L.push(m.role === 'user' ? 'USER:' : 'ASSISTANT:'); L.push(m.text || m.content); L.push(''); });
  L.push('---', 'Продолжи с этого места. Не пересказывай, отвечай как продолжение.');
  await copyTextToClipboard(L.join('\n'));
  return scraped.items.length;
}
async function exportCurrent(format, options, statusFn) { // экспорт текущего чата в произвольный формат
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
    if (snap) { await saveInFormat(snap, dlgTitle() + '-snapshot', format === 'zip' ? 'md' : format); return { count: 1, snapshot: true }; }
    debugDump();
    throw new Error('Сообщения не найдены (см. дебаг-дамп в консоли F12).');
  }
  await saveInFormat(scraped, dlgTitle(), format);
  return { count: scraped.items.length };
}
/* ---- ДИАГНОСТИКА (v26) ---- */
function debugDump() { // дамп диагностики в консоль
  try { console.groupCollapsed('%c[UACE v' + VER + '] DEBUG', 'color:#4af;font-weight:bold'); } catch (e) {}
  console.log('URL:', location.href);
  const platform = dlgGetPlatform();
  console.log('Платформа:', platform ? platform.name : 'не определена');
  const s = scrape({ exportThinking: true });
  console.log('Найдено:', s.items.length, 'источник:', s.source, '| картинок:', s.images.length, '| вложений:', s.attachments.length, '| артефактов:', s.artifacts.length);
  s.items.slice(0, 20).forEach((m, i) => console.log('  [' + i + '] role=' + m.role + ' len=' + (m.text || '').length + ' text="' + (m.text || '').slice(0, 120) + '..."'));
  const sc = findScrollContainer();
  console.log('Скролл-контейнер:', sc ? { clientHeight: sc.clientHeight, scrollHeight: sc.scrollHeight } : null);
  const list = findList();
  console.log('Список чатов:', list ? list.items.length + ' (via ' + list.via + ')' : 'НЕ НАЙДЕН');
  if (list && console.table) { try { console.table(list.items.slice(0, 30).map((x, i) => ({ idx: i, title: String(x.title || '').slice(0, 50), href: String(x.href || '').slice(0, 70), dataId: x.dataId || '' }))); } catch (e) {} }
  const sess = loadSession();
  if (sess) console.log('Незавершённый экспорт:', sess.idx + '/' + sess.items.length, 'формат:', sess.fmt, 'режим:', sess.mode);
  try { console.groupEnd(); } catch (e) {}
  return s;
}
function exportDebugReport() { // JSON-отчёт окружения файлом
  const platform = dlgGetPlatform();
  const report = {
    meta: { exporter: 'UACE v' + VER, generated_at: new Date().toISOString(), url: location.href, userAgent: navigator.userAgent },
    environment: { hostname: location.hostname, pathname: location.pathname, platform: platform ? platform.name : null,
      msgSelectors: platform ? platform.msgSelectors : [] },
    dom: { totalNodes: document.querySelectorAll('*').length, links: document.querySelectorAll('a[href]').length,
      shadowRoots: dlgShadowRoots().length, chatClassEls: document.querySelectorAll('[class*="chat"],[class*="message"]').length },
    scrape: (function () { try { const s = scrape({}); return { items_count: s.items.length, source: s.source, images: s.images.length }; } catch (e) { return { error: String(e && e.message || e) }; } })(),
    list: (function () { try { const l = findList(); return l ? { via: l.via, count: l.items.length } : null; } catch (e) { return { error: String(e && e.message || e) }; } })(),
    session: loadSession()
  };
  downloadBlob(JSON.stringify(report, null, 2), 'uace-debug-' + ts() + '.json', 'application/json;charset=utf-8');
}
function debugSniffer() { // снимок разметки: левая панель + кандидаты чатов/сообщений
  function snap(el, depth, maxDepth) {
    if (!el || depth > maxDepth) return null;
    let r;
    try { r = el.getBoundingClientRect(); } catch (e) { r = { width: 0, height: 0, left: 0, top: 0 }; }
    const vis = r.width > 0 && r.height > 0;
    let t = '';
    if (el.children.length === 0) { try { t = dedupeText((el.textContent || '').trim()).slice(0, 100); } catch (e) {} }
    const attrs = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i];
      if (/^data-|^aria-|^role$|^href$|^id$|^class$/i.test(a.name)) attrs[a.name] = String(a.value).slice(0, 120);
    }
    const kids = [];
    if (depth < maxDepth) for (let j = 0; j < el.children.length && j < 30; j++) { const s = snap(el.children[j], depth + 1, maxDepth); if (s) kids.push(s); }
    return { tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 200), id: el.id || '', attrs, rect: [Math.round(r.width), Math.round(r.height), Math.round(r.left), Math.round(r.top)], vis, text: t, childCount: el.children.length, children: kids };
  }
  const platform = dlgGetPlatform();
  const report = { meta: { url: location.href, hostname: location.hostname, ver: VER, ts: now() }, platform: platform ? platform.name : null, leftPanel: null, chatItemCandidates: [], messageCandidates: [], summary: {} };
  try { const lp = findLeftPanel(); if (lp) report.leftPanel = snap(lp, 0, 3); } catch (e) {}
  try { const l = findList(); if (l) report.chatItemCandidates = l.items.slice(0, 40).map(it => ({ title: (it.title || '').slice(0, 80), href: (it.href || '').slice(0, 120) })); } catch (e) {}
  try {
    const m = dlgFindMessages();
    if (m) report.messageCandidates = m.items.slice(0, 40).map(el => ({ tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 120), textLen: (hfTxt(el) || '').length, text: (hfTxt(el) || '').slice(0, 100) }));
  } catch (e) {}
  report.summary = { chatItems: report.chatItemCandidates.length, messageCandidates: report.messageCandidates.length, sidebarDetected: !!report.leftPanel };
  downloadBlob(JSON.stringify(report, null, 2), 'uace-sniffer-' + sanitize(location.hostname) + '-' + ts() + '.json', 'application/json;charset=utf-8');
}
/* ---- ТОСТ (норма «цена прерывания»: заменяет предыдущий, не стекуется, не мигает) ---- */
function toast(msg, ms) {
  try {
    let t = document.getElementById('pml-hf-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pml-hf-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#1d1d24;color:#f2f2f6;padding:10px 16px;border-radius:10px;border:1px solid #43434e;font:14px/1.5 system-ui,sans-serif;z-index:2147483647;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none;max-width:70vw;transition:opacity .3s;';
      (document.body || document.documentElement).appendChild(t);
    }
    t.textContent = String(msg || '');
    t.style.opacity = '1';
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { try { t.style.opacity = '0'; } catch (e) {} }, ms || 2600);
  } catch (e) {}
}
/* ---- ОБЁРТКИ ДЕЙСТВИЙ (REG): статус/журнал/метрики/ошибки ---- */
async function hfExportRich(fmt) { // богатый экспорт текущего диалога (KaTeX/Mermaid/таблицы/артефакты)
  const fmtName = (fmt || S.bulkFmt || 'md').toUpperCase();
  status('Богатый экспорт: собираю...');
  const scraped = scrape(hfOptions());
  if (!scraped.items.length) { const snap = snapshotScrape(); if (!snap) throw new Error('Сообщения не найдены'); await saveInFormat(snap, dlgTitle() + '-snapshot', fmt || 'md'); return; }
  await saveInFormat(scraped, dlgTitle(), fmt || S.bulkFmt || 'md');
  log('ok', 'богатый экспорт ' + fmtName + ': ' + scraped.items.length + ' сообщ., картинок ' + scraped.images.length + ', артефактов ' + scraped.artifacts.length);
}
async function hfExportScrolled() { // автоскролл истории → богатый MD (полная переписка)
  status('Диалог (скролл): прокручиваю...');
  await autoScroll(m => status(m));
  await hfExportRich('md');
}
async function hfExportZipMedia() { // ZIP: чат + артефакты (+картинки при opt-in «сеть!»), тома ≤50 МБ
  status('ZIP-медиа: собираю...');
  await autoScroll(null);
  const scraped = scrape(hfOptions());
  if (!scraped.items.length) throw new Error('Сообщения не найдены');
  const results = [{ title: dlgTitle(), url: location.href, scraped }];
  await finalizeResults(results, [], 'zip', resolveInner(), m => status(m));
  log('ok', 'ZIP-медиа собран: сообщ. ' + scraped.items.length + ', артефактов ' + scraped.artifacts.length + (S.mediaNet ? ', картинки качались (сеть!)' : ', картинки — ссылками (_image-links.txt)'));
}
async function hfExportPdfCdn() { // PDF: CDN-рендер при opt-in, иначе локальная печать
  if (!S.pdfCdn) { log('warn', 'PDF-рендер выключен (0 сети, §15) — открываю локальную печать. Включите «PDF-рендер CDN» в Экспорт-настройках.'); }
  await autoScroll(null);
  const scraped = scrape(hfOptions());
  if (!scraped.items.length) throw new Error('Сообщения не найдены');
  await exportAsPDF(scraped, dlgTitle());
}
async function hfBulkRun(mode) { // пакет: все чаты из сайдбара → формат S.bulkFmt (same-tab/вкладки)
  CANCEL = false; bulkRunning = true; metrics.bulkRuns++;
  const fmt = S.bulkFmt || 'md';
  try {
    const out = await exportAll(fmt, mode, hfOptions(), m => status(m), null);
    metrics.bulkChats += out.ok;
    log(out.stopped ? 'warn' : 'ok', 'пакет (' + (mode === 'tabs' ? 'вкладки' : 'список') + ' → ' + fmt.toUpperCase() + '): готово ' + out.ok + '/' + out.total + ', ошибок ' + out.fail + (out.skipped ? ', пропущено ' + out.skipped : '') + (out.stopped ? ' — ОСТАНОВЛЕНО, есть сессия' : ''));
    status(out.stopped ? 'Пакет остановлен — доступно «Продолжить»' : 'Пакет завершён: ' + out.ok + ' чатов');
  } finally { bulkRunning = false; CANCEL = false; }
}
async function hfBulkResume() { // продолжение незавершённого пакета (сессия в localStorage)
  const sess = loadSession();
  if (!sess) { status('нет незавершённого пакета'); log('info', 'resume: сессии нет'); return; }
  CANCEL = false; bulkRunning = true; metrics.bulkRuns++;
  try {
    const out = await exportAll(sess.fmt, sess.mode, hfOptions(), m => status(m), sess);
    metrics.bulkChats += out.ok;
    log(out.stopped ? 'warn' : 'ok', 'resume (' + sess.mode + ' → ' + sess.fmt + '): готово ' + out.ok + '/' + out.total + (out.stopped ? ' — снова остановлено' : ''));
  } finally { bulkRunning = false; CANCEL = false; }
}
async function hfBulkClear() { // очистка манифеста onlyNew + сессии
  await clearManifestAll();
  clearSession();
  metrics.manifestClears++;
  log('ok', 'манифест onlyNew и сессия очищены — «только новые» начнёт с нуля');
  status('Манифест очищен');
}

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
  'Экспорт: выгрузок ' + metrics.downloads + ' — struct: JSON/MD/HTML/TXT/CSV/agent-view · диалог: MD/JSON/TXT/HTML/ShareGPT/JSONL/Alpaca/PDF' + (metrics.zipMade ? ' · ZIP собирался' : '') + ' · диалог-извлечений ' + metrics.dlgRuns + (metrics.dlgEmpty ? ' (аварийных ' + metrics.dlgEmpty + ')' : ''),
  'HF-цех 27.7.0: пакетов ' + metrics.bulkRuns + ' (чатов ' + metrics.bulkChats + '), манифест очищался ' + metrics.manifestClears + ' · onlyNew ' + (S.onlyNew ? 'вкл' : 'выкл') + ' · формат пакета ' + (S.bulkFmt || 'md') + ' · ZIP ' + (S.zipInner || 'md') + ' · медиа-сеть ' + (S.mediaNet ? 'ВКЛ (сеть!)' : 'выкл') + ' · PDF CDN ' + (S.pdfCdn ? 'ВКЛ (сеть!)' : 'выкл (печать)') + (loadSession() ? ' · ЕСТЬ СЕССИЯ resume' : ''),
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
  { id: 'dl-zip', label: 'Скачать ZIP-бандл', hint: 'struct-пакет + журнал + паспорт одним архивом — инлайновый CRC32+STORE (§15)', run: () => downloadZip() },
  { id: 'dlg-copy', label: 'Копировать диалог (MD)', hint: 'извлечение диалога — текст читается ТОЛЬКО по этой команде (§15-компромисс 27.6.1)', run: () => copyDialogMD() },
  { id: 'dlg-md', label: 'Диалог → Markdown', hint: 'front-matter + роли + thinking — Obsidian/вики/PR', run: () => exportDialog('md') },
  { id: 'dlg-json', label: 'Диалог → JSON', hint: 'полная структура: роли/thinking/source-селектор', run: () => exportDialog('json') },
  { id: 'dlg-txt', label: 'Диалог → TXT', hint: 'текстовый дамп для тикет-систем', run: () => exportDialog('txt') },
  { id: 'dlg-html', label: 'Диалог → HTML', hint: 'автономный стилизованный отчёт, инлайн-CSS, 0 сети', run: () => exportDialog('html') },
  { id: 'dlg-sharegpt', label: 'Диалог → ShareGPT', hint: '{from: human|gpt|system} — fine-tune датасеты', run: () => exportDialog('sharegpt') },
  { id: 'dlg-jsonl', label: 'Диалог → JSONL', hint: 'строка на сообщение — LLM-пайплайны', run: () => exportDialog('jsonl') },
  { id: 'dlg-alpaca', label: 'Диалог → Alpaca', hint: 'пары instruction/output — LoRA/файнтюн', run: () => exportDialog('alpaca') },
  { id: 'dlg-pdf', label: 'Диалог → PDF (печать)', hint: 'локальный диалог печати; при блокировке popup — .print.html файлом (0 CDN — §15)', run: () => exportDialogPDF() },
  { id: 'dlg-zip', label: 'ZIP: полный (с диалогом)', hint: 'struct-пакет + 7 форматов диалога + журнал + паспорт', run: () => downloadZipFull() },
  { id: 'hf-md-rich', label: 'Диалог → MD (богатый)', hint: 'HF-цех 27.7.0: KaTeX→LaTeX, Mermaid→SVG, таблицы colspan, чистка хрома кода, медиа/артефакты (§15: сеть выкл по умолч.)', run: () => hfExportRich(S.bulkFmt || 'md') },
  { id: 'hf-md-scroll', label: 'Диалог (скролл) → MD', hint: 'автоскролл истории к началу + богатый MD — полная переписка (v22/v24/v26)', run: () => hfExportScrolled() },
  { id: 'hf-md-buffer', label: 'Диалог → буфер (богатый MD)', hint: 'буфер: rich-Markdown с thinking/таблицами/формулами', run: async () => { const n = await copyCurrentMd(); metrics.agentCopied = true; status('буфер: богатый MD (' + n + ' сообщ.)'); log('ok', 'богатый MD в буфере: ' + n + ' сообщ.'); } },
  { id: 'hf-continue', label: 'Перенос диалога (буфер)', hint: 'промпт-перенос в другой AI: USER:/ASSISTANT: (фича v24)', run: async () => { const n = await copyContinuePrompt(); status('буфер: промпт-перенос (' + n + ' сообщ.)'); log('ok', 'промпт-перенос скопирован: ' + n + ' сообщ.'); } },
  { id: 'hf-pdf-cdn', label: 'Диалог → PDF (рендер CDN, opt-in)', hint: 'СЕТЬ! html2pdf-рендер только при «PDF-рендер CDN» вкл; иначе локальная печать (§15)', run: () => hfExportPdfCdn() },
  { id: 'hf-zip-media', label: 'ZIP: чат + медиа/артефакты (тома)', hint: 'chats/ + artifacts/ + images/ (качаются ТОЛЬКО при opt-in «Скачивать медиа») + _index.json; тома ≤50 МБ', run: () => hfExportZipMedia() },
  { id: 'bulk-run', label: 'Пакет: все чаты → формат', hint: 'массовый сбор по сайдбару (same-tab): манифест onlyNew + сессия resume; формат — в Экспорт-настройках', run: () => hfBulkRun('same') },
  { id: 'bulk-tabs', label: 'Пакет: все чаты (вкладки)', hint: 'дочерние вкладки + postMessage; надёжнее для SPA; popup-блокировка → ошибка №1', run: () => hfBulkRun('tabs') },
  { id: 'bulk-resume', label: 'Пакет: продолжить (resume)', hint: 'продолжение незавершённого пакета с сохранённого индекса (сессия uace_bulk_v1)', run: () => hfBulkResume() },
  { id: 'bulk-stop', label: 'Пакет: стоп', hint: 'мягкий стоп после текущего чата; сессия сохраняется → «Продолжить»', run: () => { CANCEL = true; status('пакет: стоп запрошен'); log('warn', 'пакет: стоп запрошен — завершится после текущего чата'); } },
  { id: 'bulk-clear', label: 'Пакет: очистить манифест', hint: 'обнуляет onlyNew (IndexedDB + localStorage) и сессию resume', run: () => hfBulkClear() },
  { id: 'debug-report', label: 'Дебаг: отчёт (JSON)', hint: 'окружение/DOM/scrape/список/сессия → JSON-файл (v26-диагностика)', run: () => exportDebugReport() },
  { id: 'debug-sniffer', label: 'Дебаг: сниффер DOM', hint: 'снимок разметки: левая панель + кандидаты чатов/сообщений → JSON', run: () => debugSniffer() },
  { id: 'stop', label: 'Стоп', hint: 'прервать окно ИЛИ пакет (Alt+S)', run: () => stopAll() },
  { id: 'copylog', label: 'Скопировать журнал', hint: 'Полный лог info/ok/warn/err — канал отчётов беты', run: async () => { copyText(J.map(j => '[' + j.t + '] ' + j.lv + ': ' + j.msg).join('\n'), 'журнал скопирован (' + J.length + ' записей)'); } },
  { id: 'tabs', label: 'Цикл вкладок', hint: 'Alt+X', run: () => cycleTabs() },
  { id: 'collapse', label: 'Свернуть панель', run: async () => setCollapsed(true) },
  { id: 'passport', label: 'Открыть паспорт', hint: 'Alt+I', run: () => showPassport() }];

const runAct = a => async () => { if (busy) return; busy = true; setBadge('run');
  els.acts.querySelectorAll('button').forEach(b => { b.disabled = true; });
  ['stop', 'bulk-stop'].forEach(id => { const b = els.acts.querySelector('[data-id="' + id + '"]'); if (b) b.disabled = false; }); // 27.7.0: стоп живёт во время пакета
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
  const dz = ce('button', 'pml-btn', 'Скачать ZIP-бандл'); dz.type = 'button'; dz.title = 'struct-пакет + журнал + паспорт (инлайновый CRC32+STORE)'; dz.onclick = runAct({ id: 'dl-zip', run: downloadZip });
  const dm = ce('button', 'pml-btn', 'Диалог → MD'); dm.type = 'button'; dm.title = 'Markdown диалога — извлечение по явной команде (§15-компромисс); полный цех — в «Действия» (MD/JSON/TXT/HTML/ShareGPT/JSONL/Alpaca/PDF/полный ZIP)'; dm.onclick = runAct({ id: 'dlg-md', run: () => exportDialog('md') });
  els.recon = ce('div'); els.panels.recon.append(rb, cs, ca, dj, dz, dm, els.recon);
  els.acts = ce('div', 'pml-act'); els.panels.actions.append(els.acts);
  els.log = ce('div'); els.panels.log.append(els.log);
  const ft = ce('div', 'pml-ft'); els.status = ce('div', 'pml-status'); els.status.setAttribute('role', 'status'); els.status.setAttribute('aria-live', 'polite');
  const cm = ce('details'); cm.append(ce('summary', '', 'Комфорт'));
  const mv = ce('label'); const mc = ce('input'); mc.type = 'checkbox'; mc.checked = !S.motion;
  mc.onchange = () => { S.motion = !mc.checked; store.save(); syncTheme(); }; mv.append(mc, ' Движение выкл');
  const fv = ce('label'); const fr = ce('input'); fr.type = 'range'; fr.min = '12'; fr.max = '20'; fr.step = '1'; fr.value = String(S.fs);
  fr.oninput = () => { S.fs = +fr.value; store.save(); syncTheme(); }; fv.append(fr, ' Кегль ' + S.fs);
  cm.append(mv, fv);
  const ex = ce('details'); ex.append(ce('summary', '', 'Экспорт-настройки (27.7.0)'));
  const exChk = (key, label, warn) => { const lb = ce('label'); const cb = ce('input'); cb.type = 'checkbox'; cb.checked = !!S[key];
    cb.onchange = () => { S[key] = cb.checked; store.save(); status(label + ': ' + (cb.checked ? 'вкл' : 'выкл') + (warn && cb.checked ? ' — СЕТЬ АКТИВНА' : '')); log('info', label + ' = ' + cb.checked); };
    lb.append(cb, ' ' + label + (warn ? ' (сеть!)' : '')); return lb; };
  ex.append(exChk('onlyNew', 'Пакет: только новые'), exChk('autoScroll', 'Диалог: автоскролл'), exChk('stripThink', 'Вырезать thinking'),
    exChk('images', 'Собирать картинки (URL)'), exChk('mediaNet', 'Скачивать медиа', true), exChk('pdfCdn', 'PDF-рендер CDN', true), exChk('mermaid', 'Mermaid → SVG-ссылки'));
  const ziL = ce('label'); const ziS = ce('select'); [['md', 'ZIP: Markdown'], ['json', 'ZIP: JSON'], ['txt', 'ZIP: TXT'], ['html', 'ZIP: HTML'], ['both', 'ZIP: MD+JSON'], ['pdf', 'ZIP: PDF (CDN!)']].forEach(p => { const o = ce('option', '', p[1]); o.value = p[0]; if (S.zipInner === p[0]) o.selected = true; ziS.append(o); });
  ziS.onchange = () => { S.zipInner = ziS.value; store.save(); status('ZIP: ' + S.zipInner); }; ziL.append(ziS, ' внутренний формат');
  const bfL = ce('label'); const bfS = ce('select'); [['md', 'Пакет: Markdown'], ['json', 'Пакет: JSON'], ['txt', 'Пакет: TXT'], ['html', 'Пакет: HTML'], ['sharegpt', 'Пакет: ShareGPT'], ['jsonl', 'Пакет: JSONL'], ['alpaca', 'Пакет: Alpaca']].forEach(p => { const o = ce('option', '', p[1]); o.value = p[0]; if (S.bulkFmt === p[0]) o.selected = true; bfS.append(o); });
  bfS.onchange = () => { S.bulkFmt = bfS.value; store.save(); status('Пакет: ' + S.bulkFmt); }; bfL.append(bfS, ' формат пакета');
  ex.append(ziL, bfL);
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
    if (e.key === 'Escape' && (bulkRunning || tabsExportRunning)) { CANCEL = true; status('пакет: стоп по Esc'); log('warn', 'Esc: пакет остановится после текущего чата'); return; } // 27.7.0: та же семантика «стоп»
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
  log('info', 'диалог-цех 27.6.1: извлечение (30 платформ, Shadow DOM, эвристика, аварийный снимок) → MD/JSON/TXT/HTML/ShareGPT/JSONL/Alpaca/PDF/полный ZIP — текст читается ТОЛЬКО по явной команде (§15)');
  log('info', 'HF-цех 27.7.0: богатый MD/KaTeX/Mermaid · автоскролл · медиа/артефакты · ZIP-тома 50 МБ · пакет same-tab/вкладки · onlyNew (IndexedDB) · resume · перенос диалога · дебаг — сеть ТОЛЬКО по opt-in чекбоксам (§15)');
  loadSession() && log('warn', 'найдена незавершённая сессия пакета: «Пакет: продолжить» доступна');
  status('Панель готова');
};

try { Object.defineProperty(window, '__UACE_INTERNALS__', { value: Object.freeze({ FNV1a32, hex8, SALT, urlHashIn, sigHashIn, sigOf, sigHash, pathOf, prefixPath, subtreeDepth, scoreGroup, resolveRecon, buildStruct, median, ok2rgb, rgb2ok, ratio, simhash64, hammingHex, structFeatures, domSim64, simBetween, agentView, downsample, compareStructs, fileStamp, structToText, structToMarkdown, structToHTML, structToCSV, crc32, makeZip, buildExportSet, downloadFile, DLG_PLATFORMS, dlgGetPlatform, dlgQAll, scrapeDialog, dlgContent, dlgToMarkdown, dlgToJSON, dlgToTXT, dlgToHTML, dlgToShareGPT, dlgToJSONL, dlgToAlpaca, dlgFindMessages, dlgEmergency, CFG, CANCEL_REF: () => ({ cancel: CANCEL, bulk: bulkRunning }), now, sanitize, progress, hashString, chatHash, manifestKey, getManifest, loadManifest, flushManifest, clearManifestAll, loadSession, saveSession, clearSession, hfOptions, domToMarkdown, extractThinking, extractText, collectMedia, collectArtifacts, scrape, snapshotScrape, fingerprint, findScrollContainer, autoScroll, waitStable, waitForContentChange, downloadBlob, downloadSmart, zipStore, splitZipVolumes, buildZipEntries, volumesToDownloads, fetchImageU8, renderPdfBlob, exportAsPDF, saveInFormat, exportCurrent, contentFor, toMarkdown, toJSON, toTXT, toHTML, toShareGPT, toJSONL, toAlpaca, buildMerged, finalizeResults, findList, extractItemsFromPanel, collectChatLinks, extractChatTarget, buildChatUrl, activateChatItem, exportAllSameTab, exportAllTabs, exportAll, copyCurrentMd, copyContinuePrompt, debugDump, exportDebugReport, debugSniffer, toast, LIBS, loadScript }), configurable: true }); } catch (e) {} // полевая сверка хэшей (ЧК-1) + 27.5.0 + экспорт 27.6.0 + диалог 27.6.1 + HF-цех 27.7.0

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
