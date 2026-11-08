/* ============================================================================
 * UACE × PML — v29.0.1 «EVIDENCE HOTFIX» — хотфиксы полевого аудита H1–H13
 * (база v29.0.0 — архитектурная сборка v28.3.0)
 * ----------------------------------------------------------------------------
 * Реагирует на аудит v28.3.0 (STATIC SYNTAX: PASS → ARCHITECTURAL AUDIT).
 * Слои: L0 CORE (чистое ядро, Node-тестируемое) → L1 RUNTIME → L2 EVIDENCE →
 * L3 PLATFORMS → L4 CAPTURE (ChatDocument) → L5 STORAGE → L6 RENDERERS/
 * ORCHESTRATOR → L7 UI/PML. Главный принцип: EVIDENCE FIRST — каждый результат
 * несёт {value, evidence, confidence, source, strategy}; «не уверен» → unknown,
 * НЕ догадка. Слежу за каноном PML-STRUCT r1+r2 §5 (соль PMLSTRUCT) и
 * PML-PANEL 1.0 §13 (хоткеи только E/D/C/S/X/I), §15 (приватность — честно).
 *
 * КАРТА ИСПРАВЛЕНИЙ АУДИТА (§ → где в коде):
 *  §2/§10 renderPdfBlob()→true + blobToU8(true) — УДАЛЕНО: экспорт возвращает
 *      типизированный ExportResult {kind:'file'|'print'|'print-html'|'failed'};
 *      ZIP принимает ТОЛЬКО Blob; PDF = печать браузера, ZIP-член = .print.html.
 *  §3/§4 сеть — широковещательный connect-грант УДАЛЁН (согласие на домен
 *      запрашивает Tampermonkey); изображения ВЫКЛ по умолчанию; GM_xhr только
 *      с anonymous:true, HTTPS, блок приватных адресов, журнал сети.
 *  §5 роли — parity-догадка УДАЛЕНА; лестница улик attribute → platform-selector
 *      → semantic-class → ancestor → (structural-order только при доказанном
 *      strictAlternation платформы; в v29 ни одна не заявлена) → unknown.
 *  §6 выбор списка сообщений — не max-count, а validated score ≥ 0.55.
 *  §7 dedupeNested — O(n×depth) (сортировка по глубине + проход по предкам).
 *  §8/§9 TreeWalker + бюджеты узлов/времени + единый планировщик Sched.
 *  §11 размеры ZIP — только UTF-8 байты (TextEncoder ДО любого расчёта).
 *  §12 Mermaid — режимы off/inline; внешние mermaid-сервисы больше не вызываются.
 *  §13 Trusted Types — именованные политики uace-static/uace-export
 *      (createHTML с запретом raw <script>); default-политика УДАЛЕНА.
 *  §14/§15 postMessage/window.open — IPC-канал дочерних вкладок удалён
 *      полностью (same-tab активация), поверхность атаки устранена; печать —
 *      окно с opener=null.
 *  §17 snapshot — captureMode:'snapshot', confidence 0, честные warnings.
 *  §18 канонический ключ platform|origin|chatId.
 *  §19 resume — idx∈[0..n]; idx===n → сессия ЗАВЕРШЕНА (не откат на n-1).
 *  §20 журнал — 5 уровней (debug/info/warn/error/security), кольцо 500,
 *      Debug-отчёт включает журнал; пустые catch в значимых путях запрещены.
 *  §22–§26 слои, Evidence First, ChatDocument, конвейер рендереров.
 *  §27 СОХРАНЕНО: 36 платформ, 5 стилей PDF/HTML (ИМПЕРСКИЙ С ЗОЛОТОМ и др.),
 *      темы Авто/Свет/Тьма/Тепло, подсказки, «? Справка» слева от «ⓘ Паспорт»,
 *      PML-наблюдение 60 с, ZIP DEFLATE, resume/onlyNew, самовосстановление UI.
 *
 * ХОТФИКСЫ v29.0.1 (полевой аудит v29.0.0 — 9 регрессий + 9 дефектов):
 *  H1 хоткеи — выбор действия по e.code (KeyE/KeyD/KeyC/KeyS/KeyX/KeyI),
 *      раскладко-независимо; кириллическая раскладка больше не глушит канон §13.
 *  H2 resume — ветка complete теперь ДЕЙСТВИТЕЛЬНО перезапускает проход
 *      (resumeEntryPlan: complete→restart, смена списка→restart, гвард listUrl).
 *  H3 «Стоп» — busy() не глушит keepAlive-кнопку «Стоп»; CANCEL-чекпоинт между
 *      томами ZIP; чекпоинты в стабилизации/скролл-драйвере.
 *  H5 Shadow DOM — findMessages опрашивает light+shadow (queryAllDeep),
 *      стратегии platform-deep/generic-deep; chatAreaRootDeep для membership.
 *  H6 автоскролл — scrollAndCollect: прокрутка ленты с сбором сообщений по
 *      contentHash (безопасно к виртуализации), бюджеты проходов/шагов, CANCEL.
 *  H7 стабилизация — stabilizeContent: N одинаковых проб (count+hash) подряд;
 *      стриминг-чаты больше не экспортируются наполовину.
 *  H11 кнопка «⧉ MD» — быстрый экспорт Markdown одним кликом (возврат из v28.3.0).
 *  H12 фильтр чатов — строка ввода + parseChatFilter/applyChatFilterList
 *      («подстрока, !исключить, через запятую»), ключ uaice_filter ожил.
 *  H13 мёртвые ключи — uaice_strip/zipinner/evening/fsz/motion удалены из
 *      whitelist + однократная миграция-чистка localStorage.
 *  H4/H8/H9/H10 — формулировки из полевого Debug-отчёта не получены: в этой
 *      сборке помечены как «ожидает данных», очередь v29.0.2 (честно, без догадок).
 * ========================================================================== */
// ==UserScript==
// @name         UACE × PML — Universal AI Chat Exporter (29.0.1 EVIDENCE HOTFIX)
// @namespace    uace.pml.sessionB
// @version      29.0.1-evidence
// @description  Хотфикс-сборка H1–H13 поверх v29.0.0 (Evidence First, ChatDocument, ExportResult, честная приватность, роли по уликам, ZIP UTF-8 байты, PDF = печать, именованные TT-политики). Новое: хоткеи по e.code (кириллица), рабочий resume-перезапуск, «Стоп» во время экспорта, Shadow DOM в поиске сообщений, автоскролл виртуализированных лент, стабилизация стриминга, кнопка «⧉ MD», фильтр чатов, чистка мёртвых ключей. 36 платформ, 9 форматов, 5 стилей PDF/HTML (Имперский с золотом), темы Авто/Свет/Тьма/Тепло, подсказки, Справка, PML-наблюдение 60 с, resume/onlyNew, самовосстановление UI. Хоткеи канона: Alt+E/D/C/S/X/I.
// @author       Session B (UACE-main)
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://bard.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://chat.deepseek.com/*
// @match        https://deepseek.com/*
// @match        https://chat.qwen.ai/*
// @match        https://qwen.ai/*
// @match        https://tongyi.aliyun.com/*
// @match        https://kimi.moonshot.cn/*
// @match        https://www.kimi.com/*
// @match        https://kimi.com/*
// @match        https://kimi.ai/*
// @match        https://agent.minimax.io/*
// @match        https://chat.minimax.io/*
// @match        https://minimaxi.com/*
// @match        https://chat.mistral.ai/*
// @match        https://mistral.ai/*
// @match        https://chat.groq.com/*
// @match        https://groq.com/*
// @match        https://openrouter.ai/*
// @match        https://huggingface.co/chat/*
// @match        https://build.nvidia.com/*
// @match        https://chat.z.ai/*
// @match        https://z.ai/*
// @match        https://chatglm.cn/*
// @match        https://space-z.ai/*
// @match        https://pollinations.ai/*
// @match        https://puter.com/*
// @match        https://playground.ai.cloudflare.com/*
// @match        https://grok.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @match        https://poe.com/*
// @match        https://character.ai/*
// @match        https://you.com/*
// @match        https://www.doubao.com/*
// @match        https://doubao.com/*
// @match        https://yuanbao.tencent.com/*
// @match        https://www.meta.ai/*
// @match        https://meta.ai/*
// @match        https://alice.yandex.ru/*
// @match        https://ya.ru/alice*
// @match        https://yandex.ru/alice*
// @match        https://dola.com/*
// @match        https://lmarena.ai/*
// @match        https://chat.lmarena.ai/*
// @match        https://notebooklm.google.com/*
// @match        https://github.com/copilot/*
// @match        https://coze.com/*
// @match        https://www.coze.com/*
// @match        https://coze.cn/*
// @match        https://www.phind.com/*
// @match        https://phind.com/*
// @match        https://v0.dev/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @run-at       document-idle
// @noframes
// ==/UserScript==
/* ИСТОРИЯ ВЕРСИЙ
 * v29.0.1-evidence «EVIDENCE HOTFIX» (база v29.0.0), хотфиксы H1–H13 — по строке на пункт:
 *  H1  Хоткеи Alt+E/D/C/S/X/I по e.code вместо e.key — работают на любой раскладке (HOTKEY_CODE_MAP).
 *  H2  «Все чаты» resume: завершённая сессия ДЕЙСТВИТЕЛЬНО перезапускается (resumeEntryPlan) + гвард listUrl.
 *  H3  «Стоп» жива во время экспорта (busy() не глушит dataset.keepAlive) + CANCEL-чекпоинт между томами ZIP.
 *  H4  Формулировок полевого Debug-отчёта нет — честно «ожидает данных», очередь v29.0.2 (без догадок).
 *  H5  findMessages опрашивает light+shadow DOM (queryAllDeep, стратегии platform-deep/generic-deep).
 *  H6  Автоскролл виртуализированных лент (findScrollContainer+scrollAndCollect, дедуп по contentHash, возврат прокрутки).
 *  H7  Стабилизация контента (stabilityDecision+stabilizeContent: 3 одинаковые пробы ИЛИ 8 с, CANCEL).
 *  H8  Формулировок полевого Debug-отчёта нет — честно «ожидает данных», очередь v29.0.2 (без догадок).
 *  H9  Формулировок полевого Debug-отчёта нет — честно «ожидает данных», очередь v29.0.2 (без догадок).
 *  H10 Формулировок полевого Debug-отчёта нет — честно «ожидает данных», очередь v29.0.2 (без догадок).
 *  H11 Кнопка «⧉ MD» — быстрый экспорт Markdown одним кликом (rowFmt).
 *  H12 Фильтр чатов: подстроки через запятую, «!текст» — исключить (parseChatFilter, uaice_filter).
 *  H13 Мёртвые ключи настроек удалены из whitelist + однократная миграция localStorage (REMOVED_SETTINGS_KEYS).
 * v29.0.0 — архитектурная сборка по аудиту v28.3.0 (КАРТА ИСПРАВЛЕНИЙ — в шапке выше).
 */
/* ПРИВАТНОСТЬ (§3/§4 аудита): широковещательный connect-грант удалён. По
   умолчанию 0 внешних запросов. Загрузка изображений — ЯВНАЯ опция (выкл. по
   умолчанию): при первом домене Tampermonkey сам запросит согласие; GM-запросы
   — anonymous, HTTPS-only, приватные адреса запрещены, всё — в Журнале сети. */

(function () {
'use strict';
if (typeof window !== 'undefined' && window.top !== window) return; /* @noframes дублируем кодом */

const UACE_VER = '29.0.1';
const SCHEMA_VER = 'uace-chat-document/29';
const SALT = 'PMLSTRUCT';           /* канон PML-STRUCT r1+r2 §5 — НЕ МЕНЯТЬ */
const SESSION_T0 = Date.now();
const nowMs = () => Date.now() - SESSION_T0;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round2 = v => Math.round(v * 100) / 100;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hx = v => (v >>> 0).toString(16).padStart(8, '0');

/* ══════════════ L0 CORE — чистое ядро (Node-тестируемое) ══════════════ */

/* --- L0.1 ЖУРНАЛ (§20): 5 уровней, кольцо 500, без пустых catch в значимых путях --- */
const JOURNAL_CAP = 500;
const journalBuf = [];
function jpush(level, scope, msg, data) {
  journalBuf.push({ t: nowMs(), level, scope: String(scope || 'core'), msg: String(msg || '').slice(0, 300), data: data == null ? null : (typeof data === 'object' ? safeJson(data) : String(data)) });
  if (journalBuf.length > JOURNAL_CAP) journalBuf.shift();
}
function safeJson(o) { try { return JSON.stringify(o).slice(0, 400); } catch (e) { return '[unserializable]'; } }
const journal = {
  debug: (s, m, d) => jpush('debug', s, m, d),
  info: (s, m, d) => jpush('info', s, m, d),
  warn: (s, m, d) => jpush('warn', s, m, d),
  error: (s, m, d) => jpush('error', s, m, d),
  security: (s, m, d) => jpush('security', s, m, d),
  net: (host, bytes, via) => jpush('net', 'network', host + ' ' + bytes + 'B via ' + via, null),
  dump: n => journalBuf.slice(-(n || JOURNAL_CAP)),
  stats: () => {
    const s = {};
    for (const j of journalBuf) s[j.level] = (s[j.level] || 0) + 1;
    return s;
  }
};

/* --- L0.2 Хэш-канон PML §5: FNV-1a 32, UTF-8 байты, hex8 lowercase --- */
const ENC = new TextEncoder();
const utf8 = s => ENC.encode(String(s == null ? '' : s));
const byteLen = s => utf8(s).length;
function fnv1a32(str) { /* → число (для simhash половин) */
  const b = utf8(str); let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const fnv1aHex = s => hx(fnv1a32(s));
const hashString = fnv1aHex;                                  /* совместимость */
const sigHashIn = sig => SALT + '>' + String(sig).toUpperCase();   /* вход sigHash  */
const urlHashIn = href => SALT + 'URL>' + String(href || '');      /* вход urlHash  */
const sigHashOf = sig => fnv1aHex(sigHashIn(sig));
const urlHashOf = href => fnv1aHex(urlHashIn(href));
const truncPath = p => { p = String(p || ''); return p.length > 120 ? '~' + p.slice(-119) : p; };

/* --- L0.3 CRC32 + ZIP: строки → UTF-8 БАЙТЫ до любого расчёта (§11) --- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
async function deflateRawU8(u8) {
  try {
    if (typeof CompressionStream === 'undefined') return null;
    const cs = new CompressionStream('deflate-raw');
    const ab = await new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer();
    return new Uint8Array(ab);
  } catch (e) { journal.debug('zip', 'deflate-unavailable', String(e && e.message || e)); return null; }
}
const _u16 = (dv, o, v) => dv.setUint16(o, v & 0xFFFF, true);
const _u32 = (dv, o, v) => dv.setUint32(o, v >>> 0, true);
function _dosTime(d) { return { t: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, d: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF }; }
/* zipBuild(files) → Uint8Array. files: [{name, data:Uint8Array|string, store?}]
   КОНТРАКТ: name/data нормализуются к байтам немедленно; размеры ТОЛЬКО в байтах. */
async function zipBuild(files) {
  const norm = [];
  for (const f of (files || [])) {
    if (!f || !f.name) continue;
    norm.push({ nameU8: utf8(f.name), data: f.data instanceof Uint8Array ? f.data : utf8(f.data), store: !!f.store });
  }
  const stamp = _dosTime(new Date()), chunks = [], central = [];
  let offset = 0;
  for (const e of norm) {
    let method = 0, payload = e.data;
    const crc = crc32(e.data);
    if (!e.store && e.data.length > 64) { const def = await deflateRawU8(e.data); if (def && def.length < e.data.length) { method = 8; payload = def; } }
    const lh = new DataView(new ArrayBuffer(30));
    _u32(lh, 0, 0x04034b50); _u16(lh, 4, 20); _u16(lh, 6, 0x0800); _u16(lh, 8, method);
    _u16(lh, 10, stamp.t); _u16(lh, 12, stamp.d); _u32(lh, 14, crc);
    _u32(lh, 18, payload.length); _u32(lh, 22, e.data.length); _u16(lh, 26, e.nameU8.length); _u16(lh, 28, 0);
    chunks.push(new Uint8Array(lh.buffer), e.nameU8, payload);
    const cd = new DataView(new ArrayBuffer(46));
    _u32(cd, 0, 0x02014b50); _u16(cd, 4, 20); _u16(cd, 6, 20); _u16(cd, 8, 0x0800); _u16(cd, 10, method);
    _u16(cd, 12, stamp.t); _u16(cd, 14, stamp.d); _u32(cd, 16, crc);
    _u32(cd, 20, payload.length); _u32(cd, 24, e.data.length); _u16(cd, 28, e.nameU8.length);
    _u32(cd, 42, offset);
    central.push(new Uint8Array(cd.buffer), e.nameU8);
    offset += 30 + e.nameU8.length + payload.length;
  }
  let centralLen = 0; for (const c of central) centralLen += c.length;
  const eo = new DataView(new ArrayBuffer(22));
  _u32(eo, 0, 0x06054b50); _u16(eo, 8, norm.length); _u16(eo, 10, norm.length);
  _u32(eo, 12, centralLen); _u32(eo, 16, offset);
  const all = chunks.concat(central, [new Uint8Array(eo.buffer)]);
  let total = 0; for (const c of all) total += c.length;
  const out = new Uint8Array(total); let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}
/* Тома: разбивка по UTF-8 байтам (§11: string.length больше не участвует) */
function splitVolumesU8(entries, maxBytes) {
  const limit = Math.max(1024, maxBytes || 50 * 1024 * 1024);
  const size = e => 30 + e.nameU8.length + e.data.length + 46;
  const vols = []; let cur = [], curSize = 0, total = 0;
  for (const e of entries) { const s = size(e); total += s; }
  if (total <= limit) return [entries];
  for (const e of entries) {
    const s = size(e);
    if (cur.length && curSize + s > limit) { vols.push(cur); cur = []; curSize = 0; }
    cur.push(e); curSize += s;
  }
  if (cur.length) vols.push(cur);
  return vols;
}

/* --- L0.4 dedupeNested O(n×depth) (§7) — семантика v28.3.0: контейнер
   (держит ≥2 кандидатов ближайшим уровнем) удаляется, его предметы остаются;
   вложенность в не-контейнер-кандидата — дубликат, удаляется. Вместо тройных
   проходов O(n³) — ближайший-кандидат-предок за O(глубину). --- */
function dedupeNested(items, getParent) {
  const gp = getParent || (el => el.parentElement);
  const arr = Array.from(items).slice(0, 400);
  if (arr.length < 2) return arr;
  const set = new Set(arr);
  const nearAnc = el => { let p = gp(el); while (p) { if (set.has(p)) return p; p = gp(p); } return null; };
  const heldBy = new Map();
  for (const el of arr) { const a = nearAnc(el); if (a) heldBy.set(a, (heldBy.get(a) || 0) + 1); }
  const containers = new Set();
  for (const [a, c] of heldBy) if (c >= 2) containers.add(a);
  const out = [];
  for (const el of arr) {
    if (containers.has(el)) continue;            /* контейнер-«зонтик» долой */
    const a = nearAnc(el);
    if (a && !containers.has(a)) continue;       /* вложен в кандидата-дубликата */
    out.push(el);                                 /* предмет удалённого контейнера */
  }
  return out;
}

/* --- L0.5 EVIDENCE FIRST (§24) + лестница ролей (§5) + валидация (§6) --- */
const mkEv = (strategy, confidence, reasons, extra) => Object.assign({ strategy: String(strategy || 'unknown'), confidence: Math.max(0, Math.min(1, +confidence || 0)), reasons: reasons || [], source: null }, extra || {});
const ROLE_LEVELS = { attribute: 0.99, 'platform-selector': 0.95, 'semantic-class': 0.80, ancestor: 0.70, 'structural-order': 0.60, 'framework-internal': 0.55, heuristic: 0.00 };
function roleFromValue(v) { /* значение атрибута/класса → роль или null; ДОГАДКИ НЕТ */
  if (v == null || v === '') return null;
  const s = String(v).toLowerCase();
  if (/system/.test(s)) return 'system';
  if (/user|human|question|query/.test(s)) return 'user';
  if (/assistant|bot|model|gpt|response|answer|reply/.test(s)) return 'assistant';
  return null;
}
const SCORE_W = { role: 0.30, membership: 0.20, uniform: 0.15, order: 0.15, text: 0.10, clean: 0.10 };
const SCORE_THRESHOLD = 0.55;
/* scoreCandidates(features) → {score, pass, reasons[]}: НЕ максимум количества (§6) */
function scoreCandidates(f) {
  const reasons = [];
  if (!f || !f.count || f.count < 2) return { score: 0, pass: false, reasons: ['count<2'] };
  let s = SCORE_W.role * f.roleCoherence + SCORE_W.membership * f.membership + SCORE_W.uniform * f.uniformity
        + SCORE_W.order * f.orderConsistency + SCORE_W.text * f.textQuality + SCORE_W.clean * f.cleanliness;
  if (f.nestedShare > 0.3) { s -= 0.15; reasons.push('nesting-penalty'); }
  if (f.uiShare > 0.2) { s -= 0.15 + 0.3 * f.uiShare; reasons.push('ui-penalty'); }
  if (f.roleCoherence === 0) reasons.push('role-evidence:0');
  s = Math.max(0, Math.min(1, s));
  return { score: round2(s), pass: s >= SCORE_THRESHOLD && f.roleCoherence > 0 && f.uiShare <= 0.3, reasons };
}
/* resumePlan (§19): idx∈[0..n]; idx===n → сессия ЗАВЕРШЕНА, откатов нет */
function resumePlan(idx, n) {
  idx = Math.max(0, Math.min(Math.floor(Number(idx) || 0), n));
  return idx >= n ? { action: 'complete', idx: n } : { action: 'continue', idx };
}

/* ══════ v29.0.1 — чистые L0-функции хотфиксов (Node-тестируемые) ══════ */
/* H1: хоткеи по e.code — раскладко-независимо (канон §13: ровно E/D/C/S/X/I) */
const HOTKEY_CODE_MAP = { KeyE: 'e', KeyD: 'd', KeyC: 'c', KeyS: 's', KeyX: 'x', KeyI: 'i' };
function hotkeyActionFromCode(code) {
  return Object.prototype.hasOwnProperty.call(HOTKEY_CODE_MAP, String(code)) ? HOTKEY_CODE_MAP[String(code)] : null;
}
/* H12: парсер фильтра чатов «подстрока, !исключить, через запятую»; пусто = всё подряд */
function parseChatFilter(str) {
  const include = [], exclude = [];
  for (const raw of String(str || '').split(',')) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    if (t.charAt(0) === '!') { if (t.length > 1) exclude.push(t.slice(1)); }
    else include.push(t);
  }
  return { include, exclude };
}
function applyChatFilterList(items, flt) {
  const f = flt || { include: [], exclude: [] };
  const kept = [], excluded = [];
  for (const it of (items || [])) {
    const title = String((it && it.title) || '').toLowerCase();
    const inc = !f.include.length || f.include.some(s => title.indexOf(s) !== -1);
    const exc = f.exclude.some(s => title.indexOf(s) !== -1);
    if (inc && !exc) kept.push(it); else excluded.push(it);
  }
  return { kept, excluded };
}
/* H2: вход в resume — complete → ДЕЙСТВИТЕЛЬНЫЙ перезапуск; смена списка → перезапуск */
function resumeEntryPlan(session, n, listUrl) {
  const s = (session && typeof session === 'object') ? session : null;
  const plan = resumePlan(s ? s.idx : 0, n);
  if (plan.action === 'complete') return { action: 'restart', idx: 0, reason: 'complete-restart' };
  if (plan.action === 'continue' && s && s.idx > 0 && s.listUrl && listUrl && s.listUrl !== listUrl) {
    return { action: 'restart', idx: 0, reason: 'list-changed' };
  }
  return { action: plan.action, idx: plan.idx, reason: plan.idx > 0 ? 'resume' : 'fresh' };
}
/* H6: решение об остановке скролл-драйвера (чистая) */
function scrollStopDecision(st) {
  if (!st || st.cancelled) return true;
  const maxPasses = st.maxPasses || 3;
  if ((st.pass || 1) > maxPasses) return true;
  if (st.atBottom && (st.newCount || 0) === 0) return true;
  return false;
}
/* H7: решение о стабильности контента (чистая) — need одинаковых проб подряд */
function stabilityDecision(probes, opts) {
  const o = opts || {};
  const need = o.samples || 3;
  const arr = (probes || []).filter(p => p && typeof p.hash === 'string');
  if (arr.length < 2) return { stable: false, equalStreak: arr.length ? 1 : 0, need };
  let streak = 1;
  for (let i = arr.length - 1; i > 0; i--) {
    if (arr[i].hash === arr[i - 1].hash && arr[i].count === arr[i - 1].count) streak++;
    else break;
  }
  return { stable: streak >= need, equalStreak: streak, need };
}

/* --- L0.6 ChatDocument — каноническая модель (§26) --- */
function makeChatDocument(o) {
  const msgs = (o.messages || []).map((m, i) => ({
    index: i,
    role: (m.role === 'user' || m.role === 'assistant' || m.role === 'system') ? m.role : 'unknown',
    roleEvidence: m.roleEvidence && m.roleEvidence.method ? m.roleEvidence : { method: 'heuristic', confidence: 0, reason: 'no-signals' },
    text: String(m.text || ''),
    markdown: m.markdown != null ? m.markdown : String(m.text || ''),
    thinking: m.thinking || [],
    images: m.images || [],
    attachments: m.attachments || [],
    artifacts: m.artifacts || []
  }));
  const warnings = (o.warnings || []).slice();
  const unknownRoles = msgs.filter(m => m.role === 'unknown').length;
  if (unknownRoles) warnings.push('roles unknown: ' + unknownRoles + '/' + msgs.length + ' — сохранены как unknown, НЕ восстановлены догадкой');
  if (o.captureMode === 'snapshot') warnings.push('captureMode=snapshot: точечное извлечение не удалось, содержимое — линейный снимок страницы');
  const contentHash = fnv1aHex(msgs.map(m => m.role + '\u0001' + m.text).join('\u0002'));
  return {
    schemaVersion: SCHEMA_VER,
    exporter: 'UACE v' + UACE_VER,
    platform: o.platform || null,
    origin: o.origin || null,
    url: o.url || null,
    chatId: o.chatId || null,
    title: String(o.title || ''),
    capturedAt: new Date().toISOString(),
    captureMode: o.captureMode || 'structured',
    captureEvidence: o.captureEvidence || mkEv('unknown', 0, ['no evidence supplied']),
    messages: msgs,
    integrity: { messageCount: msgs.length, contentHash, warnings }
  };
}

/* --- L0.7 Рендереры над ChatDocument (9 форматов; Mermaid §12: off/inline, внешних ссылок НЕТ) --- */
const escHtml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MERMAID_MODES = ['off', 'inline'];
function mermaidNote(mode) { return mode === 'inline' ? '\n\n<!-- mermaid: встроен как исходник (offline), внешние сервисы не используются -->\n' : ''; }
function toMarkdown(cd, opts) {
  const o = opts || {}, mm = MERMAID_MODES.indexOf(o.mermaid) >= 0 ? o.mermaid : 'off';
  const L = [];
  L.push('# ' + (cd.title || 'Экспорт чата'), '');
  L.push('- Платформа: ' + (cd.platform || 'неизвестно'));
  L.push('- URL: ' + (cd.url || '—'));
  L.push('- Экспортёр: ' + cd.exporter + ' · схема ' + cd.schemaVersion);
  L.push('- Режим захвата: ' + cd.captureMode + ' (уверенность ' + cd.captureEvidence.confidence + ', стратегия ' + cd.captureEvidence.strategy + ')');
  L.push('- Целостность: сообщений ' + cd.integrity.messageCount + ', hash ' + cd.integrity.contentHash);
  if (cd.integrity.warnings.length) for (const w of cd.integrity.warnings) L.push('- ⚠ ' + w);
  L.push('');
  for (const m of cd.messages) {
    L.push('## ' + (m.index + 1) + ' · ' + m.role.toUpperCase() + (m.role === 'unknown' ? ' [' + m.roleEvidence.method + ' ' + m.roleEvidence.confidence + ']' : ''), '');
    if (m.thinking && m.thinking.length) {
      L.push('> **Размышления:**', '');
      for (const t of m.thinking) L.push('> ' + String(t).replace(/\n/g, '\n> '), '');
    }
    L.push(m.text || '_(пусто)_', '');
    if (mm === 'inline' && /```mermaid/.test(m.text || '')) L.push(mermaidNote(mm));
  }
  return L.join('\n');
}
function toJSON(cd) { return JSON.stringify(cd, null, 2); }
function toJSONL(cd) { return cd.messages.map(m => JSON.stringify({ index: m.index, role: m.role, roleEvidence: m.roleEvidence, text: m.text, thinking: m.thinking, images: m.images.map(i => i.src), artifacts: m.artifacts.map(a => ({ lang: a.lang, chars: (a.content || '').length })) })).join('\n'); }
function toAlpaca(cd) { /* unknown-роли НЕ выдумываем: пропускаем, число — в warnings */
  const out = [];
  for (const m of cd.messages) {
    if (m.role === 'user') out.push({ instruction: m.text, input: '', output: '' });
    else if (m.role === 'assistant' && out.length) { out[out.length - 1].output = m.text; }
  }
  return JSON.stringify(out, null, 2);
}
function toShareGPT(cd) {
  return JSON.stringify({
    title: cd.title, create_time: cd.capturedAt, capture_mode: cd.captureMode,
    conversations: cd.messages.map(m => ({ from: m.role === 'assistant' ? 'gpt' : m.role, value: m.text, evidence: m.roleEvidence }))
  }, null, 2);
}
function toTXT(cd) {
  const L = ['=== ' + (cd.title || 'Экспорт чата') + ' ===', 'URL: ' + (cd.url || '—'), 'Режим: ' + cd.captureMode, 'Хэш: ' + cd.integrity.contentHash, ''];
  for (const m of cd.messages) L.push('[' + (m.index + 1) + '] ' + m.role.toUpperCase() + (m.role === 'unknown' ? ' (evidence: ' + m.roleEvidence.method + ')' : ''), m.text || '(пусто)', '');
  return L.join('\n');
}
const csvCell = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
function toCSV(cd) {
  const rows = ['index,role,evidence_method,evidence_confidence,chars,text'];
  for (const m of cd.messages) rows.push([m.index, m.role, m.roleEvidence.method, m.roleEvidence.confidence, m.text.length, csvCell(m.text)].join(','));
  return rows.join('\n');
}

/* --- L0.8 Стилевой движок PDF/HTML (§27: 5 стилей МАКТ-2026, ИМПЕРСКИЙ С ЗОЛОТОМ первый) --- */
const TPL_STYLES = {
  imperial: { name: 'ИМПЕРСКИЙ С ЗОЛОТОМ', hint: 'Тёмный фон, золото #d4af37, кегль 18 — для слабого зрения' },
  makt:     { name: 'МАКТ Светлый',        hint: 'Человекоцентричный светлый стандарт проекта' },
  swiss:    { name: 'Швейцарская сетка',   hint: 'Editorial-типографика, жёсткая сетка линий' },
  brutal:   { name: 'Нео-брутализм',       hint: 'Жирные рамки и жёсткие тени' },
  sepia:    { name: 'Сепия Вечер',         hint: 'Тёплые тона для вечернего чтения' }
};
function tplCss() {
  return '*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-body);font-size:var(--fs);line-height:var(--lh)}'
+ '.page{max-width:78ch;margin:0 auto;padding:26px 22px 70px}a{color:var(--accent);text-decoration:underline;text-underline-offset:3px}'
+ 'code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.9em;background:var(--code-bg);border:1px solid var(--line);border-radius:4px;padding:.08em .35em;overflow-wrap:anywhere}'
+ '.cover{border:var(--cover-border);border-radius:var(--radius);background:var(--paper);padding:22px 24px 20px;margin:0 0 28px}'
+ '.kicker{font-family:var(--font-head);font-size:.72em;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 10px}'
+ 'h1{font-family:var(--font-head);font-size:1.85em;line-height:1.28;margin:0 0 16px;color:var(--ink);overflow-wrap:anywhere}'
+ '.meta{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:0 0 4px;font-size:.86em;color:var(--ink2)}'
+ '.meta b{color:var(--ink);font-weight:600}.meta .u{overflow-wrap:anywhere}'
+ '.passport{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:.8em;line-height:1.7;color:var(--ink2)}.passport b{color:var(--accent)}'
+ '.flow{list-style:none;margin:0;padding:0}'
+ '.msg{margin:0 0 18px;background:var(--paper);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:var(--radius);padding:14px 18px 15px;box-shadow:var(--shadow)}'
+ '.msg.user{background:var(--user-bg);border-left-color:var(--user-edge)}.msg.assistant{background:var(--as-bg);border-left-color:var(--as-edge)}'
+ '.msg.unknown{background:var(--think-bg);border-left-color:var(--ink2)}'
+ '.role{font-family:var(--font-head);font-size:.74em;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--role-tx);margin:0 0 8px}'
+ '.role .num{font-weight:400;letter-spacing:.02em;color:var(--ink2)}'
+ '.body{overflow-wrap:break-word}.body p{margin:0 0 .7em}.body pre{white-space:pre-wrap;overflow-wrap:anywhere}'
+ '.think{margin:12px 0 0;background:var(--think-bg);color:var(--think-tx);border:1px dashed var(--line);border-radius:6px;padding:10px 14px;font-size:.9em}'
+ '.think summary{cursor:pointer;font-family:var(--font-head);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.85em}'
+ '.colophon{margin-top:38px;padding-top:14px;border-top:1px solid var(--line);font-size:.78em;color:var(--ink2);line-height:1.7}'
+ '.tpl-bar{position:sticky;top:0;z-index:9;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;background:var(--bar-bg);color:var(--bar-tx);border-bottom:2px solid var(--accent)}'
+ '.tpl-bar .lbl{font-size:.78em;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-right:2px}'
+ '.tpl-btn{font:inherit;font-size:.86em;min-height:44px;padding:6px 14px;border-radius:8px;border:1px solid var(--bar-line);background:var(--bar-btn);color:var(--bar-tx);cursor:pointer}'
+ '.tpl-btn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-tx);font-weight:700}'
+ '.tpl-print{margin-left:auto;font-weight:700;background:var(--accent);border-color:var(--accent);color:var(--accent-tx)}'
+ '@page{size:A4;margin:15mm 13mm 17mm}@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}html,body{background:var(--bg)!important}body{margin:0}.tpl-bar{display:none!important}.page{max-width:none;margin:0;padding:0}.cover,.think{break-inside:avoid}.role{break-after:avoid}.body{orphans:3;widows:3}a{color:inherit}}';
}
const TPL_VARS = {
  imperial: '--bg:#191410;--paper:#211b14;--ink:#f2e9d3;--ink2:#c9b98a;--line:#413524;--accent:#d4af37;--accent-tx:#191410;--code-bg:#1a1510;--user-bg:#2a2312;--user-edge:#d4af37;--as-bg:#1e1913;--as-edge:#6b5a2e;--think-bg:#1b1611;--think-tx:#bca982;--role-tx:#e8c96a;--font-head:Georgia,serif;--font-body:Georgia,serif;--fs:18px;--lh:1.78;--radius:6px;--shadow:none;--cover-border:3px double #8a7430;--bar-bg:#100d0a;--bar-tx:#f2e9d3;--bar-btn:#241d15;--bar-line:#413524',
  makt:     '--bg:#f6f6f8;--paper:#fdfdfd;--ink:#1d1d1f;--ink2:#51515b;--line:#d9d9e0;--accent:#0b66c3;--accent-tx:#ffffff;--code-bg:#f0f0f4;--user-bg:#eaf2fc;--user-edge:#0b66c3;--as-bg:#f4f4f7;--as-edge:#9a9aa4;--think-bg:#fafafa;--think-tx:#51515b;--role-tx:#444a56;--font-head:-apple-system,Segoe UI,Roboto,sans-serif;--font-body:-apple-system,Segoe UI,Roboto,sans-serif;--fs:16px;--lh:1.65;--radius:10px;--shadow:0 1px 2px rgba(20,20,30,.06);--cover-border:1px solid var(--line);--bar-bg:#fdfdfd;--bar-tx:#1d1d1f;--bar-btn:#f0f0f4;--bar-line:#d9d9e0',
  swiss:    '--bg:#fbfbf8;--paper:#fefefe;--ink:#161616;--ink2:#5b5b55;--line:#161616;--accent:#d43518;--accent-tx:#ffffff;--code-bg:#f1f1ea;--user-bg:#fefefe;--user-edge:#d43518;--as-bg:#f0f0ea;--as-edge:#161616;--think-bg:#f5f5ef;--think-tx:#44443e;--role-tx:#161616;--font-head:Helvetica Neue,Helvetica,Arial,sans-serif;--font-body:Helvetica Neue,Helvetica,Arial,sans-serif;--fs:16px;--lh:1.6;--radius:0;--shadow:none;--cover-border:2px solid #161616;--bar-bg:#161616;--bar-tx:#fbfbf8;--bar-btn:#232320;--bar-line:#3a3a36',
  brutal:   '--bg:#f3ecdd;--paper:#fffdf4;--ink:#151515;--ink2:#4c4a42;--line:#151515;--accent:#2c49d0;--accent-tx:#ffffff;--code-bg:#efeadb;--user-bg:#ffd23f;--user-edge:#151515;--as-bg:#fffdf4;--as-edge:#151515;--think-bg:#efeadb;--think-tx:#3f3d36;--role-tx:#151515;--font-head:Segoe UI,Arial,sans-serif;--font-body:Segoe UI,Arial,sans-serif;--fs:16px;--lh:1.6;--radius:0;--shadow:5px 5px 0 #151515;--cover-border:3px solid #151515;--bar-bg:#ffd23f;--bar-tx:#151515;--bar-btn:#fffdf4;--bar-line:#151515',
  sepia:    '--bg:#f2e9d5;--paper:#f9f3e3;--ink:#443522;--ink2:#6f5d40;--line:#d8c8a6;--accent:#8a4d20;--accent-tx:#fff8ec;--code-bg:#ece2c9;--user-bg:#ecdfc0;--user-edge:#8a4d20;--as-bg:#f4ecd8;--as-edge:#b09468;--think-bg:#efe5cc;--think-tx:#5c4c32;--role-tx:#7a4a22;--font-head:Georgia,serif;--font-body:Georgia,serif;--fs:17px;--lh:1.75;--radius:8px;--shadow:none;--cover-border:1px solid #c9b287;--bar-bg:#e9ddc2;--bar-tx:#443522;--bar-btn:#f9f3e3;--bar-line:#c9b287'
};
const ROLE_RU = { user: 'ПОЛЬЗОВАТЕЛЬ', assistant: 'АССИСТЕНТ', system: 'СИСТЕМА', unknown: 'НЕИЗВЕСТНО' };
/* buildStyledHTML(cd, tplKey, opts) — офлайн-артефакт; весь динамический текст через escHtml (§13) */
function buildStyledHTML(cd, tplKey, opts) {
  const tpl = TPL_STYLES[tplKey] ? tplKey : 'imperial';
  const o = opts || {};
  const L = [];
  L.push('<!doctype html><html lang="ru" data-tpl="' + tpl + '"><head><meta charset="utf-8">');
  L.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  L.push('<title>' + escHtml(cd.title || 'Экспорт чата') + '</title>');
  L.push('<style>' + tplCss() + '\nhtml[data-tpl="' + tpl + '"]{' + TPL_VARS[tpl] + '}</style>');
  L.push('</head><body>');
  if (o.bar) {
    L.push('<div class="tpl-bar"><span class="lbl">Стиль:</span>');
    for (const k of Object.keys(TPL_STYLES)) L.push('<button class="tpl-btn" data-switch="' + k + '"' + (k === tpl ? ' aria-pressed="true"' : '') + '>' + escHtml(TPL_STYLES[k].name) + '</button>');
    L.push('<button class="tpl-btn tpl-print" data-print>Печать → PDF</button>');
    L.push('<span class="tpl-hint">' + escHtml(TPL_STYLES[tpl].hint) + ' · офлайн-файл, 0 внешних запросов</span></div>');
  }
  L.push('<div class="page"><div class="cover"><p class="kicker">UACE × PML · ' + escHtml(cd.exporter) + '</p>');
  L.push('<h1>' + escHtml(cd.title || 'Экспорт чата') + '</h1>');
  L.push('<div class="meta"><b>Платформа</b><span>' + escHtml(cd.platform || '—') + '</span><b>URL</b><span class="u">' + escHtml(cd.url || '—') + '</span><b>Захват</b><span>' + escHtml(cd.captureMode) + ' · уверенность ' + cd.captureEvidence.confidence + ' · стратегия ' + escHtml(cd.captureEvidence.strategy) + '</span><b>Сообщений</b><span>' + cd.integrity.messageCount + '</span><b>Хэш</b><span>' + cd.integrity.contentHash + '</span></div>');
  if (cd.integrity.warnings.length) {
    L.push('<div class="meta"><b>Предупреждения</b><span>' + cd.integrity.warnings.map(w => '⚠ ' + escHtml(w)).join('<br>') + '</span></div>');
  }
  L.push('<div class="passport"><b>Паспорт экспорта:</b> схема ' + escHtml(cd.schemaVersion) + ' · стилевой движок МАКТ-2026 («' + escHtml(TPL_STYLES[tpl].name) + '») · роли по уликам, unknown не восстанавливается · изображения выключены по умолчанию · 0 внешних запросов</div>');
  L.push('</div><ol class="flow">');
  for (const m of cd.messages) {
    const ev = m.role === 'unknown' ? ' <span class="num">· улика: ' + escHtml(m.roleEvidence.method) + ' ' + m.roleEvidence.confidence + '</span>' : '';
    L.push('<li class="msg ' + m.role + '"><p class="role">№' + (m.index + 1) + ' · ' + ROLE_RU[m.role] + ev + '</p><div class="body">');
    if (m.thinking && m.thinking.length) {
      L.push('<details class="think"><summary>Размышления модели</summary><pre>' + escHtml(m.thinking.join('\n\n')) + '</pre></details>');
    }
    const paras = String(m.text || '').split(/\n{2,}/);
    for (const p of paras) {
      if (/\n/.test(p)) L.push('<pre>' + escHtml(p) + '</pre>');
      else L.push('<p>' + escHtml(p).replace(/\n/g, '<br>') + '</p>');
    }
    if (m.artifacts && m.artifacts.length) {
      for (const a of m.artifacts) L.push('<p class="num" style="font-size:.8em;color:var(--ink2)">Код (' + escHtml(a.lang || 'text') + ', ' + (a.content || '').length + ' симв.) — в ZIP/artifacts</p>');
    }
    L.push('</div></li>');
  }
  L.push('</ol><div class="colophon">Экспортировано ' + escHtml(cd.capturedAt) + ' · UACE × PML v' + UACE_VER + ' · Evidence First: роли сохранены как определены, «неизвестно» не превращается в догадку · приватность: 0 внешних запросов по умолчанию</div></div>');
  if (o.bar) {
    L.push('<script>(function(){var b=document.querySelectorAll("[data-switch]");b.forEach(function(x){x.addEventListener("click",function(){var h=document.documentElement;h.setAttribute("data-tpl",x.getAttribute("data-switch"));b.forEach(function(y){y.setAttribute("aria-pressed",y===x?"true":"false")})})});var p=document.querySelector("[data-print]");if(p)p.addEventListener("click",function(){window.print()})})();<\/script>');
  }
  L.push('</body></html>');
  return L.join('\n');
}

/* --- L0.9 Панельные темы (канон линии B): Авто/Свет/Тьма/Тепло; Тёплый вечер 20:00–06:59 --- */
const PAL = {
  light: { bg: '#fbfbfd', panel: '#ffffff', fg: '#1d1d1f', muted: '#51515b', line: '#d9d9e0', accent: '#0b66c3', accentTx: '#ffffff', ok: '#4a6b1f', warn: '#a04b00', err: '#a63a2a', surface: '#f0f0f4' },
  dark:  { bg: '#1d1d24', panel: '#23232c', fg: '#f2f2f6', muted: '#a9a9b6', line: '#3a3a46', accent: '#4da3ff', accentTx: '#0b1220', ok: '#8fc97a', warn: '#e0a458', err: '#e08074', surface: '#2a2a34' },
  warm:  { bg: '#f6efe2', panel: '#fdf8ee', fg: '#3a3226', muted: '#6b5f4c', line: '#d8ccb4', accent: '#8a5a00', accentTx: '#ffffff', ok: '#4a6b1f', warn: '#a04b00', err: '#a63a2a', surface: '#fdf8ee' }
};
function resolveTheme(pref, hour, prefersDark) { /* единственная точка правды тем (фикс «Тепло») */
  if (pref === 'light' || pref === 'dark' || pref === 'warm') return pref;
  const evening = (hour >= 20 || hour < 7);
  if (evening) return 'warm';
  return prefersDark ? 'dark' : 'light';
}

/* --- L0.10 Поглощение ландшафта 27.5.0 (вне хэш-канона; только от собранного struct) --- */
const simhash64 = feats => {
  const a1 = new Array(32).fill(0), a2 = new Array(32).fill(0);
  for (const f of feats) {
    const h1 = fnv1a32('SIM1>' + f.k), h2 = fnv1a32('SIM2>' + f.k), w = Math.max(1, Math.min(9, f.w | 0));
    for (let i = 0; i < 32; i++) { if ((h1 >>> i) & 1) a1[i] += w; else a1[i] -= w; if ((h2 >>> i) & 1) a2[i] += w; else a2[i] -= w; }
  }
  let v1 = 0, v2 = 0;
  for (let i = 0; i < 32; i++) { if (a1[i] > 0) v1 |= 1 << i; if (a2[i] > 0) v2 |= 1 << i; }
  return hx(v1) + hx(v2);
};
const hammingHex = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 16 || b.length !== 16) return -1;
  let d = 0;
  for (let i = 0; i < 16; i += 8) { let v = parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16); while (v) { d += v & 1; v >>>= 1; } }
  return d;
};
const structFeatures = st => {
  const f = [];
  ((st.dom && st.dom.landmarks) || []).forEach(l => f.push({ k: 'L:' + l.tag + '|' + (l.role || '') + '|' + l.path, w: 3 }));
  ((st.dom && st.dom.groups) || []).forEach(g => f.push({ k: 'G:' + g.sigHash + '|' + g.count, w: 2 }));
  ((st.anchors && st.anchors.mountPoints) || []).forEach(m => f.push({ k: 'M:' + m.path + '|' + m.mode, w: 1 }));
  if (!f.length) f.push({ k: 'EMPTY', w: 1 });
  return f;
};
const domSim64 = st => simhash64(structFeatures(st));
const simBetween = (a, b) => hammingHex(domSim64(a), domSim64(b));
const agentViewOf = st => {
  const v = st || {}, L = [];
  L.push('- page urlHash=' + ((v.meta && v.meta.urlHash) || '?') + ' ratio=' + ((v.scroll && v.scroll.primary && v.scroll.primary.ratio) != null ? v.scroll.primary.ratio : 'n/a'));
  ((v.dom && v.dom.landmarks) || []).forEach((l, i) => L.push('- ' + (l.role || l.tag) + ' [ref=l' + (i + 1) + '] path=' + l.path));
  ((v.dom && v.dom.groups) || []).forEach((g, i) => L.push('- group ' + g.sigHash + ' [ref=g' + (i + 1) + '] x' + g.count + ' depth=' + g.depth + (g.inPrimary ? ' in-primary' : '')));
  ((v.anchors && v.anchors.mountPoints) || []).forEach((m, i) => L.push('- mount ' + m.mode + ' [ref=m' + (i + 1) + '] h=' + m.h + ' path=' + m.path));
  if (v.recon && v.recon.status === 'found') L.push('- candidate ' + v.recon.candidate.sigHash + ' conf=' + v.recon.candidate.confidence);
  return L.join('\n');
};
const downsample = (st, budget) => {
  const B = Math.max(60, budget == null ? 400 : budget | 0), items = [];
  const push = (prio, line) => items.push({ prio, line, cost: Math.ceil(line.length / 4) });
  push(0, 'page ' + ((st.meta && st.meta.urlHash) || '?'));
  ((st.dom && st.dom.landmarks) || []).forEach((l, i) => push(1, (l.role || l.tag) + ' [ref=l' + (i + 1) + '] ' + l.path));
  ((st.anchors && st.anchors.mountPoints) || []).forEach((m, i) => push(2, 'mount ' + m.mode + ' h' + m.h + ' ' + m.path));
  ((st.dom && st.dom.groups) || []).forEach((g, i) => push(3, 'group ' + g.sigHash + ' x' + g.count + ' d' + g.depth + (g.inPrimary ? ' *' : '') + ' ' + g.samplePath));
  items.sort((a, b) => a.prio - b.prio);
  const kept = []; let used = 0, dropped = 0;
  for (const it of items) if (used + it.cost <= B) { kept.push(it.line); used += it.cost; } else dropped++;
  if (dropped) kept.push('… +' + dropped + ' узлов за бюджетом ' + B);
  return { view: kept.join('\n'), used, budget: B, dropped };
};
const compareStructs = (a, b) => {
  const ga = new Set(((((a || {}).dom || {}).groups) || []).map(g => g.sigHash));
  const gb = new Set(((((b || {}).dom || {}).groups) || []).map(g => g.sigHash));
  let inter = 0; for (const h of ga) if (gb.has(h)) inter++;
  const union = ga.size + gb.size - inter;
  return { jaccard: union ? round2(inter / union) : 1, sim: simBetween(a, b), inter, groupsA: ga.size, groupsB: gb.size };
};

/* --- L0.11 Экспорт ядра для тестов (Node) и консольной сверки (канон ЧК) --- */
const CORE = {
  UACE_VER, SCHEMA_VER, SALT, journal, utf8, byteLen, fnv1a32, fnv1aHex, hashString,
  sigHashIn, urlHashIn, sigHashOf, urlHashOf, truncPath, crc32, zipBuild, deflateRawU8, splitVolumesU8,
  dedupeNested, mkEv, ROLE_LEVELS, roleFromValue, SCORE_W, SCORE_THRESHOLD, scoreCandidates, resumePlan,
  HOTKEY_CODE_MAP, hotkeyActionFromCode, parseChatFilter, applyChatFilterList, resumeEntryPlan,
  scrollStopDecision, stabilityDecision,
  makeChatDocument, toMarkdown, toJSON, toJSONL, toAlpaca, toShareGPT, toTXT, toCSV,
  escHtml, TPL_STYLES, TPL_VARS, tplCss, buildStyledHTML, MERMAID_MODES,
  PAL, resolveTheme, simhash64, hammingHex, structFeatures, domSim64, simBetween,
  agentViewOf, downsample, compareStructs
};
if (typeof globalThis !== 'undefined') { try { globalThis.__UACE29__ = CORE; } catch (e) { journal.debug('core', 'export-fail', String(e && e.message || e)); } }

/* Ниже — страничная часть (DOM). В Node-тестах файл заканчивается здесь. */
if (typeof document === 'undefined' || typeof window === 'undefined') return;

/* ══════════════ L1 RUNTIME — планировщик, TreeWalker, бюджеты (§8/§9) ══════════════ */

const CFG = {
  DEDUPE_CAP: 400, SR_NODE_CAP: 12000, SR_TIME_MS: 250, SR_ROOT_CAP: 300,
  TEXT_CAP: 200000, MUTOBS_BATCH_CAP: 500, MAX_ZIP_MB: 50,
  IMG_POOL: 4, IMG_MAX: 60, ARTIFACT_MAX: 40, NAV_TIMEOUT: 12000, MSG_WAIT: 15000, MAX_NAV: 500,
  /* v29.0.1 H6/H7: автоскролл + стабилизация */
  SCROLL_STEP_MS: 350, SCROLL_MAX_PASSES: 3, SCROLL_MAX_STEPS: 160,
  STABILIZE_MS: 8000, STABILIZE_SAMPLES: 3, STABILIZE_STEP_MS: 400
};
const SCHED_SLICE = 12;
let _sliceAt = Date.now();
const schedNeedYield = () => (Date.now() - _sliceAt) >= SCHED_SLICE;
const schedYield = () => new Promise(r => setTimeout(r, 0));
async function schedSlice() { if (schedNeedYield()) { await schedYield(); _sliceAt = Date.now(); } }

/* collectShadowRoots: TreeWalker + бюджеты узлов/времени/корней + yield (§8);
   единый планировщик Sched и для UACE, и для PML-обходов (§9) */
async function collectShadowRoots(root) {
  const roots = [], seen = new Set();
  let nodes = 0, truncated = false;
  const start = Date.now();
  const topRoot = root || document.documentElement || document;
  seen.add(topRoot);
  const stack = [topRoot];
  while (stack.length) {
    if (roots.length >= CFG.SR_ROOT_CAP || nodes >= CFG.SR_NODE_CAP || Date.now() - start > CFG.SR_TIME_MS) { truncated = true; break; }
    const cur = stack.pop();
    let walker = null;
    try { walker = document.createTreeWalker(cur, NodeFilter.SHOW_ELEMENT); } catch (e) { journal.debug('runtime', 'treewalker-fail', String(e && e.message || e)); continue; }
    let n = walker.currentNode;
    while (n) {
      nodes++;
      if (schedNeedYield()) await schedSlice();
      if (n.shadowRoot) {
        if (!seen.has(n.shadowRoot)) { seen.add(n.shadowRoot); roots.push(n.shadowRoot); stack.push(n.shadowRoot); }
      }
      if (nodes >= CFG.SR_NODE_CAP || Date.now() - start > CFG.SR_TIME_MS) { truncated = true; break; }
      n = walker.nextNode();
    }
    if (truncated) break;
  }
  return { roots, truncated, nodes, ms: Date.now() - start, evidence: mkEv('treewalker', roots.length ? 0.9 : 0.4, ['nodes:' + nodes, truncated ? 'truncated' : 'complete']) };
}
let _shadow = null, _shadowAt = 0;
async function shadowRootsCached() {
  if (_shadow && Date.now() - _shadowAt < 1500) return _shadow;
  const r = await collectShadowRoots();
  _shadow = r.roots; _shadowAt = Date.now();
  return _shadow;
}
async function queryAllDeep(sel) {
  const out = Array.from(document.querySelectorAll(sel));
  try { for (const sr of await shadowRootsCached()) { try { out.push(...sr.querySelectorAll(sel)); } catch (e) { journal.debug('runtime', 'shadow-qsa-fail', String(e && e.message || e)); } } } catch (e) { journal.debug('runtime', 'shadow-cached-fail', String(e && e.message || e)); }
  return out;
}

/* --- DOM-хелперы --- */
const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE', 'BASE', 'HTML', 'SVG', 'PATH', 'MAT-ICON', 'BR', 'HR']);
const UI_HOST_ID = 'uaice-29';
const HARD_EXCLUDE_SEL = '#' + UI_HOST_ID + ',#' + UI_HOST_ID + '-host,[class*="tooltip"]:not([class*="content"])';
const CHAT_AREA_SEL = 'div.chat-container,#chat-history,[data-test-id="chat-history-container"],conversation-container,div.conversation-container,ms-chat-turn,[class*="chat-history-scroll"],[class*="turn-content"],main,[role="main"]';
function visible(el) {
  try { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity !== 0; } catch (e) { return false; }
}
function filterValid(els) {
  const out = [];
  for (const el of els) {
    if (!el || el.nodeType !== 1 || SKIP_TAGS.has(el.tagName)) continue;
    if (el.closest && el.closest(HARD_EXCLUDE_SEL)) continue;
    try { const r = el.getBoundingClientRect(); if (r.width < 32 || r.height < 16) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue; } catch (e) { continue; }
    out.push(el);
  }
  return out;
}
function chatAreaRoot() {
  try { const els = document.querySelectorAll(CHAT_AREA_SEL); for (const el of els) if (visible(el)) return el; } catch (e) { journal.debug('runtime', 'chat-area-fail', String(e && e.message || e)); }
  return null;
}
/* H5: глубокая (light+shadow) версия для membership-оценки */
async function chatAreaRootDeep() {
  try { const els = await queryAllDeep(CHAT_AREA_SEL); for (const el of els) if (visible(el)) return el; } catch (e) { journal.debug('runtime', 'chat-area-deep-fail', String(e && e.message || e)); }
  return chatAreaRoot();
}
function isUiZone(el) {
  try { return !!el.closest('nav,aside,header,footer,[role="navigation"],[role="banner"],button,[role="button"],[role="menu"],form'); } catch (e) { return false; }
}

/* ══════════════ L2 EVIDENCE — роли по уликам (§5), валидация кандидатов (§6) ══════════════ */

/* Лестница улик: attribute → testid → platform-selector → semantic-class → ancestor
   → (structural-order ТОЛЬКО при доказанном strictAlternation платформы; в v29
   ни одна платформа флага не имеет — поле зарезервировано под полевые доказательства)
   → framework-internal (только диагностический fallback списка чатов)
   → unknown. ДОГАДКА ПАРИТЕТА УДАЛЕНА (§5 аудита). */
function extractRoleRaw(el, platform) {
  const attrs = ['data-message-author-role', 'data-message-role', 'data-role', 'data-author', 'data-sender'];
  for (const a of attrs) {
    const v = roleFromValue(el.getAttribute(a));
    if (v) return { role: v, evidence: { method: 'attribute', confidence: ROLE_LEVELS.attribute, reason: a + '=' + String(el.getAttribute(a)).slice(0, 40) } };
  }
  const tid = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '';
  const tv = roleFromValue(tid);
  if (tv) return { role: tv, evidence: { method: 'attribute', confidence: 0.97, reason: 'testid=' + tid.slice(0, 40) } };
  if (platform && typeof platform.role === 'function') {
    try {
      const r = platform.role(el);
      if (r === 'user' || r === 'assistant' || r === 'system') return { role: r, evidence: { method: 'platform-selector', confidence: ROLE_LEVELS['platform-selector'], reason: platform.name } };
    } catch (e) { journal.debug('role', 'platform-role-threw', platform.name); }
  }
  const cls = (typeof el.className === 'string' ? el.className : '') + (el.id ? ' #' + el.id : '');
  const cv = roleFromValue(cls);
  if (cv) return { role: cv, evidence: { method: 'semantic-class', confidence: ROLE_LEVELS['semantic-class'], reason: 'class/id: ' + cls.slice(0, 60) } };
  let anc = el.parentElement;
  for (let i = 1; anc && i <= 3; i++, anc = anc.parentElement) {
    const av = roleFromValue(anc.getAttribute && (anc.getAttribute('data-message-author-role') || anc.getAttribute('data-message-role') || anc.getAttribute('data-role')));
    if (av) return { role: av, evidence: { method: 'ancestor', confidence: ROLE_LEVELS.ancestor, reason: 'ancestor+' + i + ' (' + anc.tagName.toLowerCase() + ')' } };
  }
  return { role: 'unknown', evidence: { method: 'heuristic', confidence: 0, reason: 'сигналы ролей противоречивы или отсутствуют' } };
}
function candidateFeatures(els, platform, areaRoot) {
  const count = els.length;
  let known = 0, users = 0, assistants = 0, ui = 0, inArea = 0, nonEmpty = 0, lenSum = 0;
  const sigs = new Map();
  for (const el of els) {
    const re = extractRoleRaw(el, platform);
    if (re.role === 'user') { users++; known++; } else if (re.role === 'assistant') { assistants++; known++; }
    const sig = el.tagName + '|' + (typeof el.className === 'string' ? el.className.split(' ')[0] : '');
    sigs.set(sig, (sigs.get(sig) || 0) + 1);
    if (isUiZone(el)) ui++;
    if (areaRoot && (el === areaRoot || areaRoot.contains(el))) inArea++;
    const len = (el.textContent || '').trim().length;
    if (len > 0) nonEmpty++;
    lenSum += len;
  }
  let modeFreq = 0; for (const v of sigs.values()) modeFreq = Math.max(modeFreq, v);
  let nested = 0;
  for (const el of els) { for (const other of els) { if (other !== el && other.contains(el)) { nested++; break; } } }
  const avg = count ? lenSum / count : 0;
  return {
    count,
    roleCoherence: count ? known / count : 0,
    membership: areaRoot ? inArea / count : 0.5,
    uniformity: count ? modeFreq / count : 0,
    orderConsistency: count >= 3 ? ((users > 0 && assistants > 0) ? 1 : 0.2) : 0.4,
    textQuality: count ? Math.min(1, (nonEmpty / count) * (avg >= 8 ? 1 : avg / 8)) : 0,
    nestedShare: count ? nested / count : 0,
    uiShare: count ? ui / count : 0,
    cleanliness: count ? 1 - Math.min(1, ui / count) : 0,
    users, assistants
  };
}

/* findMessages: цепочка стратегий platform → generic → structural; выбор по
   ВАЛИДИРОВАННОМУ score (§6), не по максимуму элементов. Провал всех → null
   (далее snapshot с captureMode='snapshot', а не догадка). */
const GENERIC_MSG_SELS = ['[data-message-author-role]', 'article', '[class*="message"]:not([class*="message-input"]):not([class*="message-list"])', '[class*="chat-item"]', '[class*="turn"]'];
async function findMessages(platform) {
  const attempts = [];
  const push = (strategy, els, sel) => { attempts.push({ strategy, sel, raw: els.length, valid: filterValid(els).slice(0, CFG.DEDUPE_CAP) }); };
  if (platform) for (const sel of platform.msgSelectors || []) { try { push('platform-deep', Array.from(await queryAllDeep(sel)), sel); } catch (e) { journal.debug('find', 'platform-sel-fail', sel); } }
  for (const sel of GENERIC_MSG_SELS) { try { push('generic-deep', Array.from(await queryAllDeep(sel)), sel); } catch (e) { journal.debug('find', 'generic-sel-fail', sel); } }
  /* structural (PML I-2): рекуррентные группы одноуровневых по sigHash */
  try {
    const groups = await structuralGroups();
    for (const g of groups.slice(0, 6)) push('structural', g.els, 'sighash:' + g.sigHash);
  } catch (e) { journal.debug('find', 'structural-fail', String(e && e.message || e)); }
  const area = await chatAreaRootDeep();
  let best = null;
  for (const a of attempts) {
    if (a.valid.length < 2) continue;
    const ded = dedupeNested(a.valid);
    if (ded.length < 2) continue;
    const f = candidateFeatures(ded, platform, area);
    const s = scoreCandidates(f);
    journal.debug('find', 'candidate ' + a.strategy + ' n=' + ded.length + ' score=' + s.score + ' pass=' + s.pass, s.reasons.join(','));
    if (s.pass && (!best || s.score > best.score.score)) best = { attempt: a, els: ded, score: s, features: f };
  }
  if (best) {
    return {
      captureEvidence: mkEv(best.attempt.strategy, best.score.score, ['sel:' + best.attempt.sel, 'raw:' + best.attempt.raw].concat(best.score.reasons), { sel: best.attempt.sel }),
      els: best.els
    };
  }
  journal.warn('find', 'ни одна стратегия не прошла валидацию ≥ ' + SCORE_THRESHOLD);
  return null;
}

/* ── v29.0.1 H6/H7: автоскролл виртуализированных лент + стабилизация контента ── */
async function findScrollContainer(platform) {
  const isScrollable = el => {
    try {
      if (!el || el.nodeType !== 1 || el.scrollHeight <= el.clientHeight + 4) return false;
      const ov = getComputedStyle(el).overflowY;
      return ov === 'auto' || ov === 'scroll' || ov === 'overlay';
    } catch (e) { return false; }
  };
  const fit = el => { try { const r = el.getBoundingClientRect(); return r.height >= 120 && r.width >= 200; } catch (e) { return false; } };
  /* точный путь: прокручиваемый предок найденных сообщений (в т.ч. через shadow-host) */
  try {
    const found = await findMessages(platform);
    if (found && found.els.length) {
      let anc = found.els[0];
      while (anc) {
        if (isScrollable(anc) && fit(anc)) return { el: anc, scrollable: anc.scrollHeight - anc.clientHeight };
        anc = anc.parentElement || (anc.host || null);
      }
    }
  } catch (e) { journal.debug('scroll', 'ancestor-fail', String(e && e.message || e)); }
  /* запасной путь: кандидаты по селектору */
  const cands = [];
  const vh = innerHeight;
  const els = await queryAllDeep('main,[role="main"],body,#chat-history,[class*="chat"],[class*="history"],[class*="scroll"],[class*="conversation"],[class*="message"],[class*="turn"]');
  for (const el of els) {
    try {
      if (!isScrollable(el)) continue;
      if (!fit(el)) continue;
      cands.push({ el, share: el.getBoundingClientRect().height / vh, scrollable: el.scrollHeight - el.clientHeight });
    } catch (e) { journal.debug('scroll', 'cand-fail', String(e && e.message || e)); }
  }
  cands.sort((a, b) => b.share - a.share || b.scrollable - a.scrollable);
  if (cands[0]) return { el: cands[0].el, scrollable: cands[0].scrollable };
  const se = document.scrollingElement;
  if (se && se.scrollHeight > innerHeight + 4) return { el: se, scrollable: se.scrollHeight - innerHeight };
  return null;
}
/* дешёвая проба ленты: count + хэш пар «роль+текст» (первые 200 символов каждого) */
async function probeSignature(platform) {
  const found = await findMessages(platform);
  if (!found || !found.els.length) return { count: 0, hash: '' };
  let acc = '';
  for (const el of found.els) {
    const re = extractRoleRaw(el, platform);
    const t = (el.textContent || '').trim();
    acc += re.role + ':' + (t.length > 200 ? t.slice(0, 200) : t) + '|';
  }
  return { count: found.els.length, hash: fnv1a32(acc).toString(16) };
}
/* H7: ждать, пока лента перестанет меняться (стриминг), с CANCEL и тайм-аутом */
async function stabilizeContent(platform, budgetMs) {
  const dl = Date.now() + (budgetMs || CFG.STABILIZE_MS);
  const probes = [];
  while (Date.now() < dl) {
    if (CANCEL) { journal.info('stabilize', 'CANCEL — выходим без ожидания'); return false; }
    probes.push(await probeSignature(platform));
    const d = stabilityDecision(probes, { samples: CFG.STABILIZE_SAMPLES });
    if (d.stable) { journal.debug('stabilize', 'стабильно: проб ' + probes.length + ', streak ' + d.equalStreak); return true; }
    await sleep(CFG.STABILIZE_STEP_MS);
  }
  journal.warn('stabilize', 'тайм-аут ' + (budgetMs || CFG.STABILIZE_MS) + ' мс — работаем с тем, что есть');
  return false;
}
/* H6: прокрутить ленту и собрать все сообщения по contentHash (виртуализация-безопасно).
   Возвращает { els, steps, passes } либо null (скроллить нечего). */
async function scrollAndCollect(platform) {
  const sc = await findScrollContainer(platform);
  if (!sc) { journal.debug('scroll', 'контейнер не найден — обычный захват без прокрутки'); return null; }
  const el = sc.el;
  const origTop = el.scrollTop;
  const byHash = new Map();
  let steps = 0, passes = 0;
  const t0 = Date.now();
  for (let pass = 1; pass <= CFG.SCROLL_MAX_PASSES; pass++) {
    passes = pass;
    try { el.scrollTop = 0; } catch (e) { journal.debug('scroll', 'top-fail', String(e && e.message || e)); }
    await sleep(250);
    let newInPass = 0;
    while (true) {
      if (CANCEL) { journal.info('scroll', 'CANCEL — прокрутка прервана'); try { el.scrollTop = origTop; } catch (e2) { journal.debug('scroll', 'restore-fail', String(e2 && e2.message || e2)); } return null; }
      const found = await findMessages(platform);
      if (found && found.els.length) {
        for (const m of found.els) {
          const re = extractRoleRaw(m, platform);
          const t = (m.textContent || '').trim();
          const h = fnv1a32(re.role + '|' + t).toString(16);
          if (!byHash.has(h)) { byHash.set(h, m); newInPass++; }
        }
      }
      if (schedNeedYield()) await schedSlice();
      const before = el.scrollTop;
      try { el.scrollTop = before + Math.max(200, Math.floor(el.clientHeight * 0.85)); } catch (e) { journal.debug('scroll', 'step-fail', String(e && e.message || e)); break; }
      await sleep(CFG.SCROLL_STEP_MS);
      steps++;
      const atBottom = el.scrollTop <= before + 2 || el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      if (atBottom || steps >= CFG.SCROLL_MAX_STEPS) {
        if (steps >= CFG.SCROLL_MAX_STEPS) journal.warn('scroll', 'бюджет шагов исчерпан (' + steps + ')');
        break;
      }
    }
    if (scrollStopDecision({ atBottom: true, newCount: newInPass, pass, maxPasses: CFG.SCROLL_MAX_PASSES, cancelled: CANCEL }) && newInPass === 0) break;
    if (newInPass === 0 && pass >= 2) break;
  }
  try { el.scrollTop = origTop; } catch (e) { journal.debug('scroll', 'restore-fail', String(e && e.message || e)); }
  const els = Array.from(byHash.values());
  journal.info('scroll', 'scrollDriver: шагов ' + steps + ', проходов ' + passes + ', уникальных сообщений ' + els.length + ' за ' + (Date.now() - t0) + ' мс');
  return els.length ? { els, steps, passes } : null;
}
async function structuralGroups() {
  const out = [];
  const containers = await queryAllDeep('main,[role="main"],body');
  for (const parent of containers) {
    if (parent.childElementCount < 3) continue;
    const bySig = new Map();
    for (const k of parent.children) { const h = sigHashOf(sigOfEl(k)); if (!bySig.has(h)) bySig.set(h, []); bySig.get(h).push(k); }
    let best = null;
    for (const [h, arr] of bySig) if (!best || arr.length > best.arr.length) best = { h, arr };
    if (!best || best.arr.length < 3) continue;
    const u = best.arr.length / parent.childElementCount;
    if (u < 0.6) continue;
    out.push({ sigHash: best.h, uniformity: u, els: best.arr });
    if (out.length >= 6) break;
  }
  return out;
}

/* findChatLists: цепочка platform → generic → conversation-item → structural →
   click-items → doc-links; каждая стратегия возвращает модель улик, выбирается
   ЛУЧШАЯ ВАЛИДИРОВАННАЯ (§16/§24), порог 0.5 */
async function findChatLists(platform) {
  const results = [];
  const consider = (strategy, containers, extraReasons) => {
    const items = [];
    const seenHref = new Set();
    for (const c of containers) {
      if (SKIP_TAGS.has(c.tagName)) continue;
      let links = [];
      try { links = Array.from(c.querySelectorAll('a[href]')); } catch (e) { continue; }
      for (const a of links) {
        let u;
        try { u = new URL(a.href, location.href); } catch (e) { continue; }
        if (u.origin !== location.origin || u.pathname.length < 2) continue;
        if (/\/(logout|settings|account|login|signup|pricing|help|docs|privacy|terms)/i.test(u.pathname)) continue;
        if (seenHref.has(u.pathname)) continue;
        if (!visible(a)) continue;
        seenHref.add(u.pathname);
        items.push({ el: a, url: u.href, title: (a.textContent || '').trim().slice(0, 120) });
      }
    }
    if (items.length < 2) return;
    const shapes = new Map();
    for (const it of items) { const shape = it.el.closest(HARD_EXCLUDE_SEL) ? 'ui' : new URL(it.url).pathname.replace(/[0-9a-f-]{8,}/gi, '{id}'); shapes.set(shape, (shapes.get(shape) || 0) + 1); }
    let mode = 0; for (const v of shapes.values()) mode = Math.max(mode, v);
    if (shapes.get('ui') === items.length) return;
    const uniformity = mode / items.length;
    const countFactor = Math.min(1, items.length / 8);
    let clean = 1; for (const it of items) if (isUiZone(it.el)) { clean -= 0.5 / items.length; }
    const score = round2(0.5 * uniformity + 0.3 * countFactor + 0.2 * clean);
    const ev = mkEv(strategy, score, ['items:' + items.length, 'uniformity:' + round2(uniformity)].concat(extraReasons || []));
    journal.debug('chatlist', 'strategy ' + strategy + ' items=' + items.length + ' score=' + score);
    results.push({ ev, items });
  };
  if (platform && platform.sidebarSelectors) {
    try { consider('platform', await queryAllDeep(platform.sidebarSelectors.join(',')), ['name:' + platform.name]); } catch (e) { journal.debug('chatlist', 'platform-fail', String(e && e.message || e)); }
  }
  try { consider('generic', await queryAllDeep('nav,aside,[role="navigation"],[class*="sidebar"],[class*="history"],[class*="chat-list"],[class*="conversation-list"],[class*="sider"]'), []); } catch (e) { journal.debug('chatlist', 'generic-fail', String(e && e.message || e)); }
  try { consider('conversation-item', await queryAllDeep('[class*="conversation-item"],[data-testid*="conversation"],a[href*="/c/"],a[href*="/chat/"]'), []); } catch (e) { journal.debug('chatlist', 'conv-item-fail', String(e && e.message || e)); }
  try { consider('structural', (await structuralGroups()).flatMap(g => g.els), ['pml-groups']); } catch (e) { journal.debug('chatlist', 'structural-fail', String(e && e.message || e)); }
  try { consider('click-items', await queryAllDeep('[role="listitem"],[role="option"],[role="button"]'), ['interactive']); } catch (e) { journal.debug('chatlist', 'click-items-fail', String(e && e.message || e)); }
  try { consider('doc-links', Array.from(document.querySelectorAll('a[href]')), ['document-wide']); } catch (e) { journal.debug('chatlist', 'doc-links-fail', String(e && e.message || e)); }
  let best = null;
  for (const r of results) if (r.ev.confidence >= 0.5 && (!best || r.ev.confidence > best.ev.confidence)) best = r;
  if (best) journal.info('chatlist', 'выбрана стратегия ' + best.ev.strategy + ' (score ' + best.ev.confidence + ', чатов ' + best.items.length + ')');
  else journal.warn('chatlist', 'валидный список чатов не найден — all-chats отменён (не догадываемся)');
  return best;
}

/* ══════════════ L3 PLATFORMS — 36 адаптеров (порт v28.3.0, поле проверено) ══════════════ */
/* ПРАВИЛО v29: platform.role(el) = уровень улик «platform-selector». Поле
   strictAlternation зарезервировано: только явное полевое доказательство (§5). */
const PLATFORMS = [
  { name: 'ChatGPT', hosts: [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/], msgSelectors: ['[data-message-author-role]', 'article[data-testid^="conversation-turn"]'], roleAttr: 'data-message-author-role', chatUrlPattern: '/c/{id}', sidebarSelectors: ['#stage-slideover-sidebar', 'nav[aria-label*="Chat" i]', 'nav', 'aside'] },
  { name: 'Claude', hosts: [/(^|\.)claude\.ai$/], msgSelectors: ['[data-testid="user-message"]', '[data-testid="assistant-message"]', '.font-claude-message', '.font-user-message'], role: el => el.matches('[data-testid="user-message"], .font-user-message') ? 'user' : 'assistant', chatUrlPattern: '/chat/{id}' },
  { name: 'Gemini', hosts: [/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/], msgSelectors: ['user-query', 'model-response', 'conversation-turn', 'ms-chat-turn'], role: el => { const t = el.tagName.toLowerCase(); if (t === 'user-query') return 'user'; if (t === 'model-response') return 'assistant'; return /user|query|human/i.test(el.className || '') ? 'user' : 'assistant'; }, chatUrlPattern: '/app/{id}', sidebarSelectors: ['side-navigation-v2', 'bard-sidenav', 'mat-sidenav'] },
  { name: 'Google AI Studio', hosts: [/(^|\.)aistudio\.google\.com$/], msgSelectors: ['[data-test-id="user-message"]', '[data-test-id="model-message"]', 'ms-chat-turn'], role: el => (el.getAttribute('data-role') || '') === 'user' ? 'user' : 'assistant' },
  { name: 'DeepSeek', hosts: [/(^|\.)deepseek\.com$/], msgSelectors: ['[class*="message"]', '[class*="_message"]'], role: el => /user|human|query/i.test(el.className || '') ? 'user' : 'assistant', chatUrlPattern: '/a/chat/s/{id}', sidebarSelectors: ['aside', 'nav', '[class*="sidebar"]', '[class*="sider"]', '[class*="history"]'] },
  { name: 'Qwen', hosts: [/(^|\.)qwen\.ai$|(^|\.)tongyi\.aliyun\.com$/], msgSelectors: ['[class*="_message"]', '[data-message-role]', '[class*="chat-message"]', '[class*="markdown"]'], role: el => { const c = (el.className || '') + ' ' + (el.getAttribute('data-message-role') || '') + ' ' + (el.getAttribute('data-role') || ''); if (/user|human|question/i.test(c)) return 'user'; if (/assistant|bot|ai|model|response/i.test(c)) return 'assistant'; return 'unknown'; }, chatUrlPattern: '/c/{id}', sidebarSelectors: ['.sidebar-side', '.session-list-wrapper', 'a[aria-label="chat-item"]', 'a.chat-item-drag-link', '[class*="sidebar"]', 'aside', 'nav'] },
  { name: 'Kimi', hosts: [/(^|\.)kimi\.moonshot\.cn$|(^|\.)kimi\.ai$|(^|\.)kimi\.com$/], msgSelectors: ['.segment', '.segment-container', '[class*="message"]'], role: el => /user|human/i.test((el.className || '') + ' ' + (el.getAttribute('data-role') || '')) ? 'user' : 'assistant', sidebarSelectors: ['aside', 'nav', '.next-sidebar', '[class*="sidebar"]'] },
  { name: 'MiniMax', hosts: [/(^|\.)minimax\.io$|(^|\.)minimaxi\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat-item"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Mistral Le Chat', hosts: [/(^|\.)mistral\.ai$/], msgSelectors: ['[data-message-role]', '[class*="Message"]', '[class*="message"]'], role: el => { const r = el.getAttribute('data-message-role') || ''; if (/user/i.test(r)) return 'user'; if (/assistant/i.test(r)) return 'assistant'; return /user/i.test(el.className || '') ? 'user' : 'assistant'; } },
  { name: 'Groq', hosts: [/(^|\.)groq\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'OpenRouter', hosts: [/(^|\.)openrouter\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'HuggingChat', hosts: [/(^|\.)huggingface\.co$/], path: /^\/chat/, msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'NVIDIA NIM', hosts: [/(^|\.)build\.nvidia\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Z.ai', hosts: [/(^|\.)z\.ai$|(^|\.)chatglm\.cn$|(^|\.)space-z\.ai$/], msgSelectors: ['[data-role="user"]', '[data-role="assistant"]', '[data-message-role]', '[class*="UserMessage"]', '[class*="AssistantMessage"]', '[class*="message"]', '[class*="chat-message"]'], role: el => { const e = el.getAttribute('data-role') || el.getAttribute('data-message-role') || ''; if (e) return /user|human/i.test(e) ? 'user' : 'assistant'; return /user|human/i.test(el.className || '') ? 'user' : 'assistant'; }, chatUrlPattern: '/c/{id}', sidebarSelectors: ['.chat-aside', '.chat-history-list', '[class*="chat-aside"]', '[class*="chat-history"]', 'aside', 'nav'] },
  { name: 'Pollinations', hosts: [/(^|\.)pollinations\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Puter', hosts: [/(^|\.)puter\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Open WebUI', hosts: [/openwebui/, /^localhost(?::\d+)?$/, /^127\.0\.0\.1(?::\d+)?$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Cloudflare AI', hosts: [/(^|\.)playground\.ai\.cloudflare\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Grok', hosts: [/(^|\.)grok\.com$/], msgSelectors: ['[class*="message"]', '[class*="message-bubble"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant', chatUrlPattern: '/c/{id}', sidebarSelectors: ['aside', 'nav', '[class*="sidebar"]', '[class*="sidebar-group"]'] },
  { name: 'Microsoft Copilot', hosts: [/(^|\.)copilot\.microsoft\.com$/], msgSelectors: ['[class*="message"]', '[class*="turn"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Perplexity', hosts: [/(^|\.)perplexity\.ai$/], msgSelectors: ['[class*="query"]', '[class*="answer"]', '[class*="message"]'], role: el => /query|user|human/i.test(el.className || '') ? 'user' : 'assistant', chatUrlHints: [/\/search\//] },
  { name: 'Poe', hosts: [/(^|\.)poe\.com$/], msgSelectors: ['[class*="human-message"]', '[class*="chat-message"]', '[class*="message"]'], role: el => /human|user/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Character.ai', hosts: [/(^|\.)character\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'You.com', hosts: [/(^|\.)you\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Doubao', hosts: [/(^|\.)doubao\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Tencent Yuanbao', hosts: [/(^|\.)yuanbao\.tencent\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Meta AI', hosts: [/(^|\.)meta\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Yandex Alice AI', hosts: [/(^|\.)alice\.yandex\.ru$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Yandex Alice (path)', hosts: [/(^|\.)yandex\.(ru|com)$|^ya\.ru$/], path: /\/alice/i, msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Dola', hosts: [/(^|\.)dola\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat-message"]'], role: el => { const c = (el.className || '').toLowerCase(); if (/user|human|question/i.test(c)) return 'user'; if (/bot|assistant|ai|response|reply/i.test(c)) return 'assistant'; return 'unknown'; }, chatUrlPattern: '/chat/{id}', sidebarSelectors: ['#flow_chat_sidebar', 'nav[class*="panel-"]', '[class*="conversation-item"]', 'nav', 'aside'] },
  { name: 'LM Arena', hosts: [/(^|\.)lmarena\.ai$|(^|\.)chat\.lmarena\.ai$/], msgSelectors: ['[data-message-author-role]', '[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'NotebookLM', hosts: [/(^|\.)notebooklm\.google\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat-turn"]', '[class*="response"]'], role: el => /user|query|question/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'GitHub Copilot', hosts: [/(^|\.)github\.com$/], path: /\/copilot/i, msgSelectors: ['[data-testid="chat-message"]', '[class*="ChatMessage"]', '[class*="message"]'], role: el => { const t = (el.getAttribute('data-testid') || '') + ' ' + el.className; return /user/i.test(t) ? 'user' : 'assistant'; } },
  { name: 'Coze', hosts: [/(^|\.)coze\.com$|(^|\.)coze\.cn$/], msgSelectors: ['[class*="message"]', '[class*="chat-item"]', '[class*="ChatItem"]'], role: el => /user|human|question/i.test(el.className || '') ? 'user' : 'assistant', sidebarSelectors: ['aside', 'nav', '[class*="session"]', '[class*="history"]'] },
  { name: 'Phind', hosts: [/(^|\.)phind\.com$/], msgSelectors: ['[class*="message"]', '[class*="Question"]', '[class*="Answer"]'], role: el => /question|user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'v0 (Vercel)', hosts: [/(^|\.)v0\.dev$/], msgSelectors: ['[data-testid="message"]', '[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' }
];
function getPlatform() {
  const host = location.host, path = location.pathname;
  for (const p of PLATFORMS) {
    let ok = false;
    for (const re of p.hosts) { try { if (re.test(host)) { ok = true; break; } } catch (e) { journal.debug('platform', 'host-re-fail', p.name); } }
    if (!ok) continue;
    if (p.path) { try { if (!p.path.test(path)) continue; } catch (e) { journal.debug('platform', 'path-re-fail', p.name); } }
    return p;
  }
  return null;
}
/* chatId из шаблона платформы '/c/{id}' → канонический ключ (§18) */
function chatIdFrom(platform, url) {
  try {
    const u = new URL(url);
    if (platform && platform.chatUrlPattern) {
      const tmpl = platform.chatUrlPattern.split('/').filter(Boolean);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= tmpl.length) {
        let id = null, ok = true;
        for (let i = 0; i < tmpl.length; i++) { if (tmpl[i] === '{id}') id = parts[i]; else if (parts[i] !== tmpl[i]) { ok = false; break; } }
        if (ok && id) return id;
      }
    }
    return null;
  } catch (e) { return null; }
}
const canonicalKey = (platformName, url) => {
  let origin = '';
  try { origin = new URL(url).origin; } catch (e) { origin = 'origin?'; }
  const id = chatIdFrom(platformName ? PLATFORMS.find(p => p.name === platformName) : null, url);
  return (platformName || 'unknown') + '|' + origin + '|' + (id || 'url:' + fnv1aHex(url || ''));
};

/* ══════════════ L4 CAPTURE — ChatDocument из DOM; снимок — честный (§17) ══════════════ */

const UI_PREFIX_RE = /^\s*(вы сказали|you said|пользователь|user|chatgpt сказал|claude сказал|gemini сказал|ассистент|assistant|бот|bot ответил|copilot сказал)\s*[:：—-]*\s*/i;
const stripUiPrefix = s => String(s || '').replace(UI_PREFIX_RE, '');
function textOf(el) {
  let t = '';
  try { t = el.innerText || el.textContent || ''; } catch (e) { t = el.textContent || ''; }
  t = stripUiPrefix(t).trim();
  if (t.length > CFG.TEXT_CAP) t = t.slice(0, CFG.TEXT_CAP);
  return t;
}
function thinkOf(el) {
  const out = [];
  try {
    const nodes = el.querySelectorAll('[data-thinking],details[class*="think"],details[class*="reason"],[class*="thinking"],[class*="reasoning"]');
    for (const n of nodes) { const t = (n.textContent || '').trim(); if (t.length > 24) out.push(t.slice(0, 20000)); }
  } catch (e) { journal.debug('capture', 'think-fail', String(e && e.message || e)); }
  return out.slice(0, 5);
}
function imagesOf(el) {
  const out = [];
  try {
    for (const im of el.querySelectorAll('img[src]')) {
      let r; try { r = im.getBoundingClientRect(); } catch (e) { continue; }
      if (r.width < 80 || r.height < 80) continue;
      const src = im.src || '';
      if (!/^https?:/i.test(src)) continue;
      out.push({ src: src.slice(0, 1000), w: Math.round(r.width), h: Math.round(r.height) });
      if (out.length >= 20) break;
    }
  } catch (e) { journal.debug('capture', 'images-fail', String(e && e.message || e)); }
  return out;
}
function artifactsOf(el) {
  const out = [];
  try {
    for (const code of el.querySelectorAll('pre code, pre')) {
      const content = (code.textContent || '').replace(/\n+$/, '');
      if (content.length < 24) continue;
      const cls = code.getAttribute('class') || '';
      const langM = /(?:language-|lang-)([\w+#-]+)/i.exec(cls);
      out.push({ lang: langM ? langM[1].toLowerCase() : 'text', content: content.slice(0, 100000) });
      if (out.length >= CFG.ARTIFACT_MAX) break;
    }
  } catch (e) { journal.debug('capture', 'artifacts-fail', String(e && e.message || e)); }
  return out;
}
/* Основной захват: стабилизация (H7) → автоскролл+сбор (H6) → обычный валидированный
   путь → snapshot. Только ВАЛИДИРОВАННАЯ стратегия; иначе честный snapshot. */
async function scrapeChatDocument() {
  const platform = getPlatform();
  const url = location.href;
  const title = document.title.replace(/\s*[\|\-–·]\s*[^|\-–·]*$/, '').trim().slice(0, 200) || 'Без названия';
  const warnings = [];
  await stabilizeContent(platform); /* H7: стриминг-чаты не режем наполовину */
  const collected = await scrollAndCollect(platform); /* H6: виртуализированные ленты */
  if (collected && collected.els.length >= 2) {
    if (collected.els.some(el => !el.isConnected)) warnings.push('виртуализированная лента: часть сообщений извлечена из отвязанных узлов — изображения ранних сообщений могут отсутствовать');
    const messages = [];
    let unknowns = 0;
    for (const el of collected.els) {
      const re = extractRoleRaw(el, platform);
      if (re.role === 'unknown') unknowns++;
      messages.push({ role: re.role, roleEvidence: re.evidence, text: textOf(el), thinking: thinkOf(el), images: imagesOf(el), artifacts: artifactsOf(el) });
    }
    journal.info('capture', 'structured(scroll): ' + messages.length + ' сообщений, unknown ' + unknowns + '/' + messages.length + ', шагов ' + collected.steps);
    return makeChatDocument({
      platform: platform ? platform.name : null, origin: location.origin, url, title,
      captureMode: 'structured', captureEvidence: mkEv('scroll-collected', 0.9, ['шагов ' + collected.steps, 'проходов ' + collected.passes, 'сообщений ' + messages.length]),
      messages, warnings
    });
  }
  const found = await findMessages(platform);
  if (found && found.els.length) {
    const messages = [];
    let unknowns = 0;
    for (const el of found.els) {
      const re = extractRoleRaw(el, platform);
      if (re.role === 'unknown') unknowns++;
      messages.push({ role: re.role, roleEvidence: re.evidence, text: textOf(el), thinking: thinkOf(el), images: imagesOf(el), artifacts: artifactsOf(el) });
    }
    journal.info('capture', 'structured: ' + messages.length + ' сообщений, unknown ' + unknowns + '/' + messages.length);
    return makeChatDocument({
      platform: platform ? platform.name : null, origin: location.origin, url, title,
      captureMode: 'structured', captureEvidence: found.captureEvidence, messages, warnings
    });
  }
  /* SNAPSHOT: аварийный режим, помечается честно (§17) */
  const body = document.body;
  let t = body ? (body.innerText || body.textContent || '') : '';
  t = t.length > CFG.TEXT_CAP ? t.slice(0, CFG.TEXT_CAP) : t;
  journal.warn('capture', 'structured не удался → snapshot (captureMode=snapshot, confidence 0)');
  return makeChatDocument({
    platform: platform ? platform.name : null, origin: location.origin, url, title,
    captureMode: 'snapshot',
    captureEvidence: mkEv('snapshot', 0, ['источники: document.body', 'структура не распознана']),
    messages: [{ role: 'unknown', roleEvidence: { method: 'heuristic', confidence: 0, reason: 'snapshot' }, text: '⚠ АВТОСНИМОК СТРАНИЦЫ (точечное извлечение не удалось — роли НЕ определены):\n\n' + t }],
    warnings
  });
}
/* waitForMessages: ожидание валидного списка (adaptive) + стабилизация контента (H7) */
async function waitForMessages(platform, timeoutMs) {
  const dl = Date.now() + (timeoutMs || CFG.MSG_WAIT);
  let delay = 400;
  while (Date.now() < dl) {
    if (CANCEL) return null;
    const found = await findMessages(platform);
    if (found && found.els.length) {
      await stabilizeContent(platform, Math.min(CFG.STABILIZE_MS, Math.max(0, dl - Date.now()))); /* H7 */
      return found;
    }
    await sleep(delay);
    delay = Math.min(1600, delay + 200);
  }
  return null;
}

/* ══════════════ L5 STORAGE — whitelist, JSON-настройки, IndexedDB-манифест, resume ══════════════ */

/* H13: whitelist живых ключей (мёртвые uaice_strip/zipinner/evening/fsz/motion удалены;
   uaice_filter оживлён фильтром чатов H12) */
const SETTINGS_KEYS = ['uaice_filter', 'uaice_onlynew', 'uaice_images', 'uaice_format', 'uaice_collapsed', 'uaice_pos_v1', 'uaice_mermaid', 'uaice_theme', 'uaice_tpl', 'uaice_session'];
const MANIFEST_KEY = 'uaice_manifest', SESSION_KEY = 'uaice_session';
/* H13: однократная миграция — вычистка мёртвых ключей из localStorage пользователя */
const REMOVED_SETTINGS_KEYS = ['uaice_strip', 'uaice_zipinner', 'uaice_evening', 'uaice_fsz', 'uaice_motion'];
try {
  for (const k of REMOVED_SETTINGS_KEYS) {
    if (localStorage.getItem(k) !== null) { localStorage.removeItem(k); journal.debug('storage', 'миграция 29.0.1: удалён мёртвый ключ ' + k); }
  }
} catch (e) { journal.debug('storage', 'миграция-файл', String(e && e.message || e)); }
function safeStorageGet(k) { try { if (!SETTINGS_KEYS.includes(k)) return null; return localStorage.getItem(k); } catch (e) { return null; } }
function safeStorageSet(k, v) {
  try {
    if (!SETTINGS_KEYS.includes(k)) { journal.security('storage', 'ключ вне whitelist отклонён: ' + k); return false; }
    let total = v.length;
    for (const kk of SETTINGS_KEYS) { if (kk === k) continue; const vv = localStorage.getItem(kk); if (vv) total += kk.length + vv.length; }
    if (total > 512 * 1024) { journal.warn('storage', 'лимит хранилища превышен — запись отклонена'); return false; }
    localStorage.setItem(k, v); return true;
  } catch (e) { journal.debug('storage', 'set-fail', String(e && e.message || e)); return false; }
}
function safeStorageRemove(k) { try { localStorage.removeItem(k); } catch (e) { journal.debug('storage', 'remove-fail', k); } }
const imagesEnabled = () => safeStorageGet('uaice_images') === '1'; /* §3: только ЯВНОЕ включение */
const mermaidEnabled = () => safeStorageGet('uaice_mermaid') === 'inline';
/* --- IndexedDB-манифест (resume/onlyNew); ключ канонический §18 --- */
let _idb = null;
function idb() {
  return new Promise(res => {
    if (_idb) return res(_idb);
    try {
      const rq = indexedDB.open('uace', 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore('manifest', { keyPath: 'key' }); };
      rq.onsuccess = () => { _idb = rq.result; res(_idb); };
      rq.onerror = () => { journal.warn('storage', 'IndexedDB недоступна — манифест только в localStorage'); res(null); };
    } catch (e) { journal.warn('storage', 'IDB-open-fail', String(e && e.message || e)); res(null); }
  });
}
async function manifestGetAll() {
  const db = await idb(); const out = [];
  if (db) await new Promise(res => {
    try {
      const rq = db.transaction('manifest').objectStore('manifest').getAll();
      rq.onsuccess = () => { out.push(...(rq.result || [])); res(); };
      rq.onerror = () => res();
    } catch (e) { res(); }
  });
  if (!out.length) { try { out.push(...JSON.parse(localStorage.getItem(MANIFEST_KEY) || '[]')); } catch (e) { journal.debug('storage', 'manifest-ls-parse-fail', String(e && e.message || e)); } }
  return out;
}
async function manifestPut(rec) {
  const db = await idb();
  if (db) await new Promise(res => {
    try {
      const tx = db.transaction('manifest', 'readwrite');
      tx.objectStore('manifest').put(rec);
      tx.oncomplete = () => res(); tx.onerror = () => res();
    } catch (e) { res(); }
  });
  try {
    const ls = JSON.parse(localStorage.getItem(MANIFEST_KEY) || '[]');
    const i = ls.findIndex(x => x.key === rec.key);
    if (i >= 0) ls[i] = rec; else ls.push(rec);
    if (ls.length > 2500) ls.splice(0, ls.length - 2500);
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(ls));
  } catch (e) { journal.debug('storage', 'manifest-ls-fail', String(e && e.message || e)); }
}
async function manifestClear() {
  const db = await idb();
  if (db) await new Promise(res => { try { const tx = db.transaction('manifest', 'readwrite'); tx.objectStore('manifest').clear(); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch (e) { res(); } });
  safeStorageRemove(MANIFEST_KEY);
}
let CANCEL = false;
function loadSession() { try { return JSON.parse(safeStorageGet(SESSION_KEY) || 'null') || null; } catch (e) { return null; } }
function saveSession(s) { safeStorageSet(SESSION_KEY, JSON.stringify(s)); }
function clearSession() { safeStorageRemove(SESSION_KEY); }

/* ══════════════ L6 ORCHESTRATOR — типизированные контракты экспорта (§2/§10) ══════════════ */
/* ExportResult — ЕДИНСТВЕННЫЙ контракт результата:
   { kind:'file',       name, mime, blob }   — файл сохранён
   { kind:'print',      ok }                 — открыта печать браузера (Blob НЕТ и НЕ притворяется)
   { kind:'print-html', name, blob }         — гарант-файл .print.html (открыть → Ctrl+P)
   { kind:'failed',     error }              — неудача
   ZIP-упаковщик принимает ТОЛЬКО {blob}. Boolean в Blob-канал попасть не может. */

const ts = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const sanitize = (s, n) => String(s || 'chat').replace(/[^\p{L}\p{N}\-_ ]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 60) || 'chat';
function downloadBlob(blob, name) {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.documentElement.appendChild(a);
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) { journal.debug('export', 'revoke-fail', String(e && e.message || e)); } }, 4000);
    return { kind: 'file', name, mime: blob.type, blob };
  } catch (e) { journal.error('export', 'download-fail', name + ': ' + String(e && e.message || e)); return { kind: 'failed', error: String(e && e.message || e) }; }
}
const downloadText = (text, name, mime) => downloadBlob(new Blob([utf8(text)], { type: (mime || 'text/plain') + ';charset=utf-8' }), name);
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); journal.info('clipboard', okMsg || 'скопировано'); return true; }
  catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.documentElement.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) { journal.info('clipboard', 'скопировано (fallback)'); return true; }
    } catch (e2) { journal.warn('clipboard', 'copy-fail', String(e2 && e2.message || e2)); }
    return false;
  }
}
/* --- PDF = печать браузера; окно без opener (§14/§15); NEVER Boolean-as-Blob --- */
function openPrintWindow(html) {
  try {
    const w = window.open('', '_blank');
    if (!w) return { kind: 'failed', error: 'popup-blocked' };
    try { w.opener = null; } catch (e) { journal.debug('pdf', 'opener-null-fail', String(e && e.message || e)); }
    const d = w.document;
    d.open(); d.write(html); d.close(); /* изолированное about:blank окно — CSP хоста не применяется */
    try { w.focus(); } catch (e) { journal.debug('pdf', 'focus-fail', String(e && e.message || e)); }
    setTimeout(() => { try { w.print(); } catch (e) { journal.warn('pdf', 'window.print-fail', String(e && e.message || e)); } }, 400);
    journal.info('pdf', 'открыто окно печати — «Сохранить как PDF»');
    return { kind: 'print', ok: true };
  } catch (e) { journal.error('pdf', 'print-window-fail', String(e && e.message || e)); return { kind: 'failed', error: String(e && e.message || e) }; }
}
/* --- Рендер-таблица: ChatDocument → {text, ext, mime} | специальные форматы --- */
function renderByFormat(cd, fmt) {
  switch (fmt) {
    case 'json': return { text: toJSON(cd), ext: 'json', mime: 'application/json' };
    case 'jsonl': return { text: toJSONL(cd), ext: 'jsonl', mime: 'application/x-ndjson' };
    case 'alpaca': return { text: toAlpaca(cd), ext: 'alpaca.json', mime: 'application/json' };
    case 'sharegpt': return { text: toShareGPT(cd), ext: 'sharegpt.json', mime: 'application/json' };
    case 'md': return { text: toMarkdown(cd, { mermaid: mermaidEnabled() ? 'inline' : 'off' }), ext: 'md', mime: 'text/markdown' };
    case 'txt': return { text: toTXT(cd), ext: 'txt', mime: 'text/plain' };
    case 'csv': return { text: toCSV(cd), ext: 'csv', mime: 'text/csv' };
    default: return null;
  }
}
async function exportCurrent(fmt) {
  CANCEL = false;
  const cd = await scrapeChatDocument();
  const base = sanitize(cd.title || 'chat') + '-' + ts();
  if (cd.captureMode === 'snapshot') journal.warn('export', 'экспорт выполняется по SNAPSHOT-захвату — данные помечены как неточные');
  if (fmt === 'pdf') {
    const r = openPrintWindow(buildStyledHTML(cd, tplStyleId(), { bar: false }));
    if (r.kind === 'failed') {
      const g = downloadText(buildStyledHTML(cd, tplStyleId(), { bar: true }), base + '.print.html', 'text/html');
      journal.warn('pdf', 'popup заблокирован → гарант-файл .print.html');
      return g.kind === 'file' ? { kind: 'print-html', name: g.name, blob: g.blob } : r;
    }
    return r;
  }
  if (fmt === 'html') return downloadText(buildStyledHTML(cd, tplStyleId(), { bar: true }), base + '.html', 'text/html');
  if (fmt === 'zip') return exportZip([cd], 'ai-chat-' + ts());
  const r = renderByFormat(cd, fmt);
  if (!r) return { kind: 'failed', error: 'неизвестный формат: ' + fmt };
  return downloadText(r.text, base + '.' + r.ext, r.mime);
}
/* --- ZIP: члены — только типизированные Blob/строки; PDF-слот = .print.html --- */
async function exportZip(cds, zipName) {
  const entries = [];
  const usedNames = new Set();
  const uniq = n => { let k = n, i = 2; while (usedNames.has(k)) { k = n.replace(/(\.\w+)?$/, '-' + i + '$1'); i++; } usedNames.add(k); return k; };
  const index = [];
  for (const cd of cds) {
    const base = sanitize(cd.title || 'chat', 50);
    index.push({ key: canonicalKey(cd.platform, cd.url), title: cd.title, platform: cd.platform, url: cd.url, captureMode: cd.captureMode, messages: cd.integrity.messageCount, contentHash: cd.integrity.contentHash, warnings: cd.integrity.warnings });
    for (const [fmt, ext] of [['md', 'md'], ['json', 'json'], ['txt', 'txt']]) {
      const r = renderByFormat(cd, fmt);
      if (r) entries.push({ name: 'chats/' + uniq(base + '.' + ext), data: r.text });
    }
    entries.push({ name: 'chats/' + uniq(base + '.html'), data: buildStyledHTML(cd, tplStyleId(), { bar: true }) });
    /* §2: PDF внутрь ZIP не притворяется Blob-ом — кладём печатаемый стилизованный файл */
    entries.push({ name: 'chats/' + uniq(base + '.print.html'), data: buildStyledHTML(cd, tplStyleId(), { bar: true }) });
    for (const m of cd.messages) {
      for (const a of (m.artifacts || [])) entries.push({ name: 'artifacts/' + uniq(String(m.index + 1).padStart(3, '0') + '-' + sanitize(a.lang || 'text', 20) + '.' + ({ javascript: 'js', python: 'py', json: 'json', html: 'html', css: 'css' }[a.lang] || 'txt')), data: a.content || '' });
    }
  }
  const links = [];
  for (const cd of cds) for (const m of cd.messages) for (const im of (m.images || [])) links.push(im.src);
  if (links.length) entries.push({ name: '_image-links.txt', data: ['# Изображения (загрузка выключена по умолчанию — приватность §3/§4;', '# включите «Внешние изображения» в панели, тогда они попадут в images/)', ''].concat(links).join('\n') });
  entries.push({ name: '_index.json', data: JSON.stringify({ exporter: 'UACE v' + UACE_VER + ' × PML-STRUCT r1+r2', schema: SCHEMA_VER, created: new Date().toISOString(), pdf_note: 'PDF в ZIP не пакуется: печатайте .print.html (Ctrl+P → Сохранить как PDF) — браузерная печать не является генератором Blob', chats: index }, null, 2) });
  entries.push({ name: 'README.txt', data: zipReadme(index) });
  /* изображения — ТОЛЬКО при явной capability (§3/§4) */
  if (imagesEnabled() && links.length) {
    const got = await poolImages(links.slice(0, CFG.IMG_MAX));
    for (const g of got) entries.push({ name: 'images/' + g.name, data: g.data });
  }
  const normalized = [];
  for (const e of entries) normalized.push({ name: e.name, nameU8: utf8(e.name), data: e.data instanceof Uint8Array ? e.data : utf8(e.data) });
  const vols = splitVolumesU8(normalized, CFG.MAX_ZIP_MB * 1024 * 1024);
  const outs = [];
  for (let i = 0; i < vols.length; i++) {
    if (CANCEL) { journal.warn('zip', 'H3: остановлено пользователем между томами (' + (i + 1) + '/' + vols.length + ') — уже скачанные тома не отозваны'); return outs[0] || { kind: 'failed', error: 'stopped-by-user', partial: true }; }
    const files = vols[i].map(e => ({ name: e.name, data: e.data }));
    const u8 = await zipBuild(files);
    const nm = vols.length > 1 ? zipName + '.part' + (i + 1) + '.zip' : zipName + '.zip';
    outs.push(downloadBlob(new Blob([u8], { type: 'application/zip' }), nm));
  }
  journal.info('zip', 'собрано томов: ' + vols.length + ' (лимит ' + CFG.MAX_ZIP_MB + ' МБ, учёт в UTF-8 байтах)');
  return outs[0] || { kind: 'failed', error: 'пустой ZIP' };
}
function zipReadme(index) {
  return ['UACE × PML — ' + UACE_VER + ' (Evidence First)', '',
  'СОСТАВ', '  chats/*.md|json|html — экспорт чатов (стиль «' + (TPL_STYLES[tplStyleId()] ? TPL_STYLES[tplStyleId()].name : 'imperial') + '» для HTML)', '  chats/*.print.html — открыть → Ctrl+P → «Сохранить как PDF» (PDF в ZIP не пакуется:', '    браузерная печать не является генератором Blob — честный контракт экспорта)', '  artifacts/* — блоки кода из сообщений', '  _index.json — манифест с режимом захвата, уликами и хэшами целостности', '',
  'ПРИВАТНОСТЬ (честно)', '  • По умолчанию 0 внешних запросов.', '  • Загрузка изображений — ЯВНАЯ опция, выключена по умолчанию;', '    при включении каждое сетевое обращение попадает в Журнал сети (Debug-отчёт).', '  • Роли сообщений сохранены по уликам; «unknown» не восстанавливался догадкой.', '',
  'ЦЕЛОСТНОСТЬ', '  • captureMode: structured | snapshot (snapshot = точное извлечение не удалось).', '  • contentHash — FNV-1a 32 (UTF-8) от пар роль+текст.', '',
  'ЧАТОВ: ' + index.length
  ].join('\n');
}
/* --- Сеть: capability-based (§3/§4); по умолчанию недостижима --- */
const PRIVATE_RE = /(^|\.)localhost$|^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^169\.254\.|^0\.|\.(local|internal)$/;
async function fetchImageU8(src) {
  let u;
  try { u = new URL(src, location.href); } catch (e) { return null; }
  if (u.protocol !== 'https:') { journal.security('network', 'не-HTTPS блокирован: ' + u.host); return null; }
  if (PRIVATE_RE.test(u.hostname)) { journal.security('network', 'приватный адрес блокирован: ' + u.hostname); return null; }
  const via = u.origin === location.origin ? 'same-origin' : 'cors';
  try {
    const r = await fetch(u.href, { mode: 'cors', credentials: 'omit' });
    if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); journal.net(u.host, b.length, via); return { data: b, ext: extFromMime(r.headers.get('content-type') || '') }; }
  } catch (e) { journal.debug('network', 'fetch-fail', u.host); }
  if (typeof GM_xmlhttpRequest === 'function' || (typeof GM !== 'undefined' && GM && GM.xmlHttpRequest)) {
    return await new Promise(res => {
      try {
        const run = g => g({ method: 'GET', url: u.href, anonymous: true, timeout: 20000, responseType: 'arraybuffer', headers: { Accept: 'image/*' }, onload: rsp => { if (rsp.status >= 200 && rsp.status < 300) { const b = new Uint8Array(rsp.response); journal.net(u.host, b.length, 'gm-anonymous'); res({ data: b, ext: extFromMime(rsp.getResponseHeader && rsp.getResponseHeader('Content-Type') || '') }); } else { journal.warn('network', 'gm-status ' + rsp.status, u.host); res(null); } }, onerror: () => { journal.warn('network', 'gm-error', u.host); res(null); }, ontimeout: () => { journal.warn('network', 'gm-timeout', u.host); res(null); } });
        if (typeof GM_xmlhttpRequest === 'function') run(GM_xmlhttpRequest); else run(GM.xmlHttpRequest);
      } catch (e) { journal.error('network', 'gm-throw', String(e && e.message || e)); res(null); }
    });
  }
  return null;
}
const extFromMime = mt => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[String(mt || '').split(';')[0].trim().toLowerCase()] || 'bin');
async function poolImages(srcs) {
  const out = []; let i = 0;
  const worker = async () => {
    while (i < srcs.length && !CANCEL) {
      const k = i++;
      const u8 = await fetchImageU8(srcs[k]);
      if (u8) out.push({ name: String(k + 1).padStart(3, '0') + '.' + u8.ext, data: u8.data });
      else out.push({ name: String(k + 1).padStart(3, '0') + '.failed.txt', data: srcs[k] });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CFG.IMG_POOL, srcs.length) }, worker));
  return out;
}
/* --- «Все чаты» (same-tab): активация + NavGuard + resumePlan (§19) + onlyNew.
   IPC дочерних вкладок из v28.3.0 НЕ ПЕРЕНОСИТСЯ: постмесседж-канал удалён,
   поверхность атаки устранена (§14/§15 аудита). */
function installNavGuard() {
  try {
    const g = window.__UACE_NAVGUARD__;
    if (g) return g;
    const X = history.pushState;
    const guard = { pushes: 0 };
    history.pushState = function (...args) { guard.pushes++; return X.apply(history, args); };
    window.__UACE_NAVGUARD__ = guard;
    return guard;
  } catch (e) { journal.debug('nav', 'guard-fail', String(e && e.message || e)); return {}; }
}
async function waitForChatChange(prevUrl, prevTitle) {
  const dl = Date.now() + CFG.NAV_TIMEOUT;
  let delay = 300;
  while (Date.now() < dl) {
    if (CANCEL) return false;
    if (location.href !== prevUrl || document.title !== prevTitle) { await sleep(600); return true; }
    await sleep(delay); delay = Math.min(1200, delay + 150);
  }
  return false;
}
async function exportAllChats(innerFmt) {
  CANCEL = false;
  installNavGuard();
  const platform = getPlatform();
  const best = await findChatLists(platform);
  if (!best || !best.items.length) { toast('Список чатов не найден (все стратегии < порога) — экспорт «Все чаты» отменён', 5000); return { kind: 'failed', error: 'no-validated-chat-list' };
  }
  let items = best.items;
  /* H12: фильтр чатов (подстроки, !исключить) — применяется ДО цикла, исключения — в журнал */
  const flt = parseChatFilter(safeStorageGet('uaice_filter'));
  if (flt.include.length || flt.exclude.length) {
    const before = items.length;
    const fl = applyChatFilterList(items, flt);
    items = fl.kept;
    journal.info('all', 'фильтр: осталось ' + items.length + ' из ' + before + ' (исключено ' + fl.excluded.length + ')');
    if (!items.length) { toast('Фильтр исключил все чаты (' + before + ') — экспорт отменён', 5000); return { kind: 'failed', error: 'filter-excluded-all' }; }
  }
  const session = loadSession();
  /* H2: resume-вход — complete ДЕЙСТВИТЕЛЬНО перезапускает; смена списка — гвард listUrl */
  const plan = resumeEntryPlan(session, items.length, location.href);
  if (plan.reason === 'complete-restart') { clearSession(); journal.info('all', 'resume: сессия была завершена — новый проход с нуля'); }
  if (plan.reason === 'list-changed') { clearSession(); journal.warn('all', 'resume: список чатов сменился — старт с нуля (гвард listUrl)'); }
  const manifest = await manifestGetAll();
  const seen = new Map(manifest.map(m => [m.key, m]));
  const results = [];
  const collectedCds = []; /* CD накапливаются для сводного ZIP */
  toast('Все чаты: ' + items.length + ' · стратегия ' + best.ev.strategy + ' · старт с ' + (plan.idx + 1) + ' (' + plan.reason + ')', 4000);
  for (let i = plan.idx; i < items.length; i++) {
    if (CANCEL) { saveSession({ idx: i, listUrl: location.href, startedAt: (session && session.startedAt) || Date.now() }); toast('Остановлено на ' + (i) + '/' + items.length + ' — сессия сохранена', 5000); return { kind: 'file', stopped: true, results }; }
    const it = items[i];
    const prevUrl = location.href, prevTitle = document.title;
    let clicked = false;
    try { it.el.scrollIntoView({ block: 'center' }); } catch (e) { journal.debug('all', 'scroll-into-view-fail', String(e && e.message || e)); }
    try { it.el.click(); clicked = true; } catch (e) { journal.warn('all', 'click-fail #' + i, String(e && e.message || e)); }
    const changed = clicked && await waitForChatChange(prevUrl, prevTitle);
    if (!changed) { journal.warn('all', 'навигация не подтвердилась #' + i + ' — пропуск с записью в журнал'); results.push({ key: canonicalKey(platform && platform.name, it.url), title: it.title, skipped: 'navigation-unconfirmed' }); continue; }
    await waitForMessages(platform);
    const cd = await scrapeChatDocument();
    const key = canonicalKey(cd.platform, cd.url);
    const rec = { key, title: cd.title, hash: cd.integrity.contentHash, captureMode: cd.captureMode, messages: cd.integrity.messageCount, at: new Date().toISOString() };
    if (onlyNewEnabled() && seen.has(key) && seen.get(key).hash === rec.hash) { journal.info('all', 'onlyNew: пропущен (без изменений) — ' + cd.title); }
    else { await manifestPut(rec); seen.set(key, rec); results.push(rec); collectedCds.push(cd); }
    saveSession({ idx: i + 1, listUrl: location.href, startedAt: (session && session.startedAt) || Date.now() });
    toast('Все чаты: ' + (i + 1) + '/' + items.length + ' — ' + cd.title.slice(0, 40), 2500);
    await sleep(700);
  }
  clearSession();
  journal.info('all', 'завершено: ' + results.length + ' чатов собрано');
  if (innerFmt === 'zip') return exportZip(collectedCds, 'ai-chats-' + ts());
  return { kind: 'file', results };
}
const onlyNewEnabled = () => safeStorageGet('uaice_onlynew') === '1';
/* --- Debug-отчёт (§20): структурированный журнал вместо console-only --- */
function debugReport() {
  const L = [];
  L.push('UACE × PML DEBUG REPORT', 'версия: ' + UACE_VER, 'дата: ' + new Date().toISOString(), 'URL: ' + location.href, 'UA: ' + navigator.userAgent, 'платформа: ' + ((getPlatform() || {}).name || 'не распознана'), 'язык: ' + navigator.language, 'экран: ' + screen.width + 'x' + screen.height + ' dpr ' + devicePixelRatio, '');
  L.push('НАСТРОЙКИ: ' + JSON.stringify(Object.fromEntries(SETTINGS_KEYS.map(k => [k, safeStorageGet(k)]))), '');
  L.push('ЖУРНАЛ (уровни): ' + JSON.stringify(journal.stats()), '');
  L.push('ЖУРНАЛ (последние ' + Math.min(200, journalBuf.length) + '):');
  for (const j of journal.dump(200)) L.push('  +' + (j.t / 1000).toFixed(1) + 'с [' + j.level + '][' + j.scope + '] ' + j.msg + (j.data ? ' · ' + j.data : ''));
  return L.join('\n');
}
const downloadDebug = () => downloadText(debugReport(), 'uace-debug-' + ts() + '.txt', 'text/plain');

/* ══════════════ L7 UI/PML — Trusted Types, панель, наблюдение 60 с ══════════════ */

/* --- Trusted Types: ИМЕНОВАННЫЕ политики, default-политика УДАЛЕНА (§13) --- */
let POL_EXPORT = null;
try {
  if (typeof trustedTypes !== 'undefined' && trustedTypes && trustedTypes.createPolicy) {
    POL_EXPORT = trustedTypes.createPolicy('uace-export', {
      createHTML: s => { if (/<script\b/i.test(String(s))) throw new Error('uace-export: raw <script> запрещён'); return String(s); }
    });
  }
} catch (e) { journal.debug('tt', 'policy-exists-or-fail', String(e && e.message || e)); }
function setExportHTML(el, html) {
  try {
    if (POL_EXPORT) { el.innerHTML = POL_EXPORT.createHTML(html); return true; }
    const t = document.createElement('template'); t.innerHTML = html; el.replaceChildren(t.content); return true;
  } catch (e) { journal.error('tt', 'setExportHTML-fail', String(e && e.message || e)); return false; }
}

/* --- PML-ЯДРО (канон r1+r2 §5): сигнатуры, пути, группы, монтаж, лендмарки --- */
const fnvByte = (h, b) => Math.imul(((h ^ b) >>> 0), 0x01000193) >>> 0;
function parentOf(n) { const p = n.parentElement; if (p) return { el: p, cross: false }; try { const r = n.getRootNode ? n.getRootNode() : null; if (r && r.host) return { el: r.host, cross: true }; } catch (e) { journal.debug('pml', 'rootnode-fail', String(e && e.message || e)); } return { el: null, cross: false }; }
function pathOf(el) {
  const segs = []; let n = el;
  while (n && n.nodeType === 1 && n.tagName !== 'BODY' && n.tagName !== 'HTML') {
    let i = 1, s = n;
    while ((s = s.previousElementSibling)) if (s.tagName === n.tagName) i++;
    const up = parentOf(n);
    segs.unshift((up.cross ? '~' : '') + n.tagName.toLowerCase() + (i > 1 ? ':nth(' + i + ')' : ''));
    n = up.el;
  }
  return truncPath('body' + (segs.length ? '>' + segs.join('>') : ''));
}
function sigOfEl(el) { /* pre-order сигнатура глубиной ≤3, UPPERCASE (канон §5) */
  const out = [];
  (function walk(n, d) { if (!n || n.nodeType !== 1 || d > 3) return; out.push(n.tagName.toUpperCase()); for (let c = n.firstElementChild; c; c = c.nextElementSibling) walk(c, d + 1); })(el, 1);
  return out.join('>');
}
const subtreeDepth = (el, cap) => { let max = 1; (function walk(n, cur) { if (cur > cap) return; for (let c = n.firstElementChild; c; c = c.nextElementSibling) { max = Math.max(max, cur + 1); walk(c, cur + 1); } })(el, 1); return max; };
const PML_CAP = { groups: 12, landmarks: 24, containers: 8, scanMs: 600 };
async function pmlCollectElements(deadline) {
  const all = [document.body];
  try { all.push(...document.body.querySelectorAll('*')); } catch (e) { journal.debug('pml', 'body-qsa-fail', String(e && e.message || e)); }
  try { for (const sr of await shadowRootsCached()) { try { all.push(...sr.querySelectorAll('*')); } catch (e) { journal.debug('pml', 'shadow-qsa-fail', String(e && e.message || e)); } } } catch (e) { journal.debug('pml', 'shadow-cached-fail', String(e && e.message || e)); }
  return all;
}
function pmlPickPrimary(all, vh) {
  const cands = [];
  for (const el of all) {
    if (el.scrollHeight <= el.clientHeight + 4) continue;
    let ov = 'visible'; try { ov = getComputedStyle(el).overflowY; } catch (e) { journal.debug('pml', 'overflow-fail', String(e && e.message || e)); }
    if (ov !== 'auto' && ov !== 'scroll' && ov !== 'overlay') continue;
    let main = false; try { main = !!el.closest('main,[role="main"]'); } catch (e) { journal.debug('pml', 'closest-fail', String(e && e.message || e)); }
    cands.push({ el, path: pathOf(el), clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, visibleShare: round2(el.clientHeight / vh), insideMain: main });
  }
  cands.sort((a, b) => b.visibleShare - a.visibleShare || b.scrollHeight - a.scrollHeight || b.clientHeight - a.clientHeight || (b.insideMain - a.insideMain) || (a.path < b.path ? -1 : 1));
  return { primary: cands[0] ? { path: cands[0].path, ratio: round2(cands[0].clientHeight / Math.max(1, cands[0].scrollHeight)), clientHeight: cands[0].clientHeight, scrollHeight: cands[0].scrollHeight } : null, containers: cands.slice(0, PML_CAP.containers).map(c => ({ path: c.path, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight })), truncated: cands.length > PML_CAP.containers };
}
function pmlFindGroups(all, primaryPath, deadline) {
  const out = [];
  for (const parent of all) {
    if (performance.now() > deadline) { out.budgetHit = true; break; }
    if (parent.childElementCount < 3) continue;
    const bySig = new Map();
    for (const k of parent.children) { const h = fnv1aHex(sigHashIn(sigOfEl(k))); if (!bySig.has(h)) bySig.set(h, []); bySig.get(h).push(k); }
    let best = null;
    for (const [h, arr] of bySig) if (!best || arr.length > best.arr.length) best = { h, arr };
    if (!best || best.arr.length < 3) continue;
    const u = best.arr.length / parent.childElementCount;
    if (u < 0.6) continue;
    let pr; try { pr = parent.getBoundingClientRect(); } catch (e) { continue; }
    let sumH = 0, ok = true;
    for (const k of best.arr) { const r = k.getBoundingClientRect(); if (r.height < 32) { ok = false; break; } sumH += r.height; }
    if (!ok || sumH < 0.4 * pr.height) continue;
    const samplePath = pathOf(best.arr[0]);
    out.push({ sigHash: best.h, count: best.arr.length, depth: subtreeDepth(best.arr[0], 6), uniformity: round2(u), samplePath, parentPath: pathOf(parent), inPrimary: !!primaryPath && (samplePath === primaryPath || samplePath.startsWith(primaryPath + '>')) });
  }
  out.sort((a, b) => b.count * b.uniformity - a.count * a.uniformity || (a.parentPath < b.parentPath ? -1 : 1));
  return out;
}
function pmlFindMounts(all, vh, deadline) {
  const out = [];
  for (const el of all) {
    if (performance.now() > deadline) { out.budgetHit = true; break; }
    if (el.closest && el.closest('#' + UI_HOST_ID)) continue;
    if (el.childElementCount < 1) continue;
    let cs; try { cs = getComputedStyle(el); } catch (e) { continue; }
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (!(r.top < 0.15 * vh && r.height >= 32 && r.height <= 96 && r.width >= 120)) continue;
    out.push({ path: pathOf(el), mode: cs.position, h: Math.round(r.height), top: Math.round(r.top), x: Math.round(r.x) });
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
    if (out.length > PML_CAP.landmarks * 2) break;
  }
  return out.slice(0, PML_CAP.landmarks);
}
/* Скоринг r2 §2: u/c/p/s/l = 0.35/0.25/0.20/0.10/0.10; резерв r2 §3 (порог 75) */
function scoreGroup(g, s) {
  const u = Math.round(100 * clamp((g.uniformity - 0.6) / 0.4, 0, 1));
  const c = Math.round(100 * clamp((g.count - 3) / 17, 0, 1));
  const p = g.inPrimary ? 100 : 0;
  const sz = Math.round(100 * clamp((s ? s.primary && s.primary.ratio || 0 : 0), 0, 1));
  const l = Math.round(100 * clamp(g.depth / 6, 0, 1));
  return { u, c, p, s: sz, l, confidence: Math.round(0.35 * u + 0.25 * c + 0.20 * p + 0.10 * sz + 0.10 * l) };
}
let lastStruct = null;
async function pmlScan() {
  const t0 = performance.now();
  const all = await pmlCollectElements();
  const vh = innerHeight || 800;
  const primary = pmlPickPrimary(all, vh);
  const groups = pmlFindGroups(all, primary.primary ? primary.primary.path : null, t0 + PML_CAP.scanMs);
  const mounts = pmlFindMounts(all, vh, t0 + PML_CAP.scanMs);
  const landmarks = pmlFindLandmarks(all);
  let blockCount = 0, maxDepth = 1;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let n = w.currentNode, depth = 1;
  while (n && blockCount < 4000) { blockCount++; n = w.nextNode(); }
  let deep = document.body, d = 1;
  while (deep && deep.firstElementChild && d < 30) { deep = deep.firstElementChild; d++; }
  maxDepth = d;
  const dom = { maxDepth, blockCount, landmarks, groups, truncated: !!(groups.budgetHit || mounts.budgetHit) || blockCount >= 4000 };
  const candidate = groups.length ? (() => { const g = groups[0]; const sc = scoreGroup(g, primary); return { sigHash: g.sigHash, count: g.count, uniformity: g.uniformity, confidence: sc.confidence, passed: sc.confidence >= 75 }; })() : null;
  lastStruct = {
    meta: { ts: Date.now(), viewport: { w: innerWidth, h: innerHeight }, dpr: round2(devicePixelRatio || 1), urlHash: urlHashOf(location.href) },
    scroll: { primary: primary.primary, containers: primary.containers },
    dom, anchors: { mountPoints: mounts },
    recon: candidate ? { status: candidate.passed ? 'found' : 'weak', candidate } : { status: 'none', candidate: null },
    capture: { ms: Math.round(performance.now() - t0), nodes: all.length }
  };
  journal.info('pml', 'разведка: групп ' + groups.length + ', монтаж ' + mounts.length, 'ms ' + lastStruct.capture.ms);
  return lastStruct;
}
/* --- Наблюдение 60 с (I-3/I-4b): MutationObserver ≤500/батч, снапшот 0 + каждые 10 с, Esc, pagehide (B-6) --- */
let obsSession = null;
function startObservation() {
  if (obsSession) { toast('Наблюдение уже идёт — Esc для остановки', 2500); return; }
  CANCEL = false;
  obsSession = { startedAt: Date.now(), snapshots: [], mutTotal: 0, mutBatches: 0, timer: null, escHandler: null, observer: null, pagehide: null };
  const snap = async label => { const st = await pmlScan(); obsSession.snapshots.push({ label, t: nowMs(), urlHash: st.meta.urlHash, groups: st.dom.groups.length, candidate: st.recon.candidate ? st.recon.candidate.sigHash : null, conf: st.recon.candidate ? st.recon.candidate.confidence : 0 }); renderPmlRecon(); };
  snap('T0');
  obsSession.timer = setInterval(() => {
    if (!obsSession) return;
    if (Date.now() - obsSession.startedAt >= 60000) return stopObservation('60 с истекли');
    snap('T+' + Math.round((Date.now() - obsSession.startedAt) / 1000) + 'с');
  }, 10000);
  try {
    let batch = [];
    const flush = async () => { if (!batch.length) return; obsSession.mutBatches++; obsSession.mutTotal += batch.length; batch = []; };
    obsSession.observer = new MutationObserver(muts => { batch.push(...muts.slice(0, CFG.MUTOBS_BATCH_CAP)); if (batch.length >= CFG.MUTOBS_BATCH_CAP) batch = batch.slice(0, CFG.MUTOBS_BATCH_CAP); flush(); });
    obsSession.observer.observe(document.body, { childList: true, subtree: true, attributes: false });
  } catch (e) { journal.warn('pml', 'observer-fail', String(e && e.message || e)); }
  obsSession.escHandler = ev => { if (ev.key === 'Escape') stopObservation('Esc'); };
  document.addEventListener('keydown', obsSession.escHandler, true);
  obsSession.pagehide = () => { if (obsSession) { journal.info('pml', 'pagehide: тихий автоснимок (B-6)'); const st = lastStruct; if (st) journal.info('pml', 'pagehide-struct', 'groups=' + st.dom.groups.length); } };
  window.addEventListener('pagehide', obsSession.pagehide, { once: true });
  toast('Наблюдение 60 с запущено — Esc/кнопка «Стоп»', 3000);
  renderPmlRecon();
}
function stopObservation(reason) {
  if (!obsSession) return;
  clearInterval(obsSession.timer);
  if (obsSession.observer) try { obsSession.observer.disconnect(); } catch (e) { journal.debug('pml', 'observer-disconnect-fail', String(e && e.message || e)); }
  if (obsSession.escHandler) document.removeEventListener('keydown', obsSession.escHandler, true);
  journal.info('pml', 'наблюдение остановлено: ' + reason + ' · снапшотов ' + obsSession.snapshots.length + ' · мутаций ' + obsSession.mutTotal);
  obsSession = null;
  renderPmlRecon();
}

/* --- ПАНЕЛЬ (PML-PANEL 1.0): ShadowRoot, documentElement-host, watchdog 2 с --- */
let ui = null, uiHost = null, uiShadow = null, bootTries = 0, watchdogTimer = null;
function tplStyleId() { const v = safeStorageGet('uaice_tpl'); return (v && TPL_STYLES[v]) ? v : 'imperial'; }
function panelCss(p) {
  return ':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'
  + '.box{position:fixed;z-index:2147483646;right:16px;top:72px;width:340px;max-height:82vh;overflow:auto;background:' + p.panel + ';color:' + p.fg + ';border:1px solid ' + p.line + ';border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14px;line-height:1.45}'
  + '.grip{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid ' + p.line + ';cursor:move;user-select:none}'
  + '.badge{font-weight:700;font-size:12px;letter-spacing:.06em;color:' + p.accent + '}'
  + '.badge small{display:block;color:' + p.muted + ';font-weight:400;letter-spacing:0}'
  + '.row{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-bottom:1px solid ' + p.line + ';align-items:center}'
  + 'button,.btn{min-height:36px;padding:5px 10px;border-radius:8px;border:1px solid ' + p.line + ';background:' + p.surface + ';color:' + p.fg + ';cursor:pointer;font-size:13px}'
  + 'button:hover{border-color:' + p.accent + '}button[aria-pressed="true"]{background:' + p.accent + ';border-color:' + p.accent + ';color:' + p.accentTx + ';font-weight:700}'
  + 'button:focus-visible{outline:2px solid ' + p.accent + ';outline-offset:2px}'
  + 'select{min-height:36px;border-radius:8px;border:1px solid ' + p.line + ';background:' + p.surface + ';color:' + p.fg + ';font-size:13px;max-width:170px}'
  + 'input[type="text"]{flex:1 1 auto;min-width:0;min-height:32px;padding:5px 9px;border-radius:8px;border:1px solid ' + p.line + ';background:' + p.surface + ';color:' + p.fg + ';font-size:12.5px}'
  + 'input[type="text"]:focus-visible{outline:2px solid ' + p.accent + ';outline-offset:1px;border-color:' + p.accent + '}'
  + '.grow{flex:1 1 auto}.status{min-height:20px;padding:4px 12px 8px;color:' + p.muted + ';font-size:12px}'
  + '.lbl{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + p.muted + '}'
  + '.passport,.help,.recon,.logbox{margin:0 12px 10px;border:1px solid ' + p.line + ';border-radius:10px;background:' + p.surface + ';padding:10px 12px;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere;display:none;max-height:300px;overflow:auto}'
  + '.logbox li{margin:0 0 3px}.logbox ul{margin:4px 0 4px;padding-left:16px}'
  + '.tip{position:fixed;z-index:2147483647;max-width:260px;background:' + p.fg + ';color:' + p.panel + ';font-size:12px;line-height:1.4;padding:6px 9px;border-radius:8px;pointer-events:none;opacity:0;transition:opacity .15s}'
  + '.tip.on{opacity:1}.collapsed{display:none!important}'
  + '.h3{margin:8px 0 2px;font-weight:700;color:' + p.accent + '}'
  + 'details{border-top:1px solid ' + p.line + ';padding:6px 12px}summary{cursor:pointer;font-size:12px;font-weight:700;color:' + p.muted + '}';
}
const TIPS = {
  thAuto: 'Тема «Авто»: днём светлая/тёмная по системе, вечером (20:00–07:00) — тёплая',
  thLight: 'Светлая тема', thDark: 'Тёмная тема', thWarm: 'Тёплая тема (канон #f6efe2 / акцент #8a5a00)',
  fmt: 'Формат экспорта текущего чата', btnExport: 'Экспорт текущего чата в выбранный формат',
  btnMd: 'Быстрый экспорт текущего чата в Markdown одним кликом (Alt+E экспортирует JSON — канон §13)',
  flt: 'Фильтр чатов для «Все чаты»: подстроки через запятую; «!текст» — исключить; без регистра; пусто = все',
  btnAll: 'Все чаты: обход списка с активацией кликом; resume/onlyNew; сводный ZIP',
  tpl: 'Стиль PDF/HTML-отчёта (МАКТ-2026): ИМПЕРСКИЙ С ЗОЛОТОМ, МАКТ, Швейцарская, Нео-брутализм, Сепия',
  btnObs: 'PML-наблюдение 60 с: снапшот 0 + каждые 10 с; Esc — стоп (канон §13: Alt+I)',
  btnStruct: 'Скопировать struct — канонный JSON PML-STRUCT (соль PMLSTRUCT)',
  btnAgent: 'Скопировать agent-view — a11y-скелет без имён (§15)',
  btnStop: 'Стоп: наблюдение/экспорт (Alt+S)', btnLog: 'Скопировать журнал сессии (5 уровней)',
  btnDebug: 'Debug-отчёт: журнал + настройки + окружение → .txt',
  btnHelp: 'Справка: инструкция по эксплуатации', btnPassport: 'Паспорт панели: версии, приватность, статистика',
  btnCollapse: 'Свернуть панель в бейдж', selImg: 'Внешние изображения: ВЫКЛ по умолчанию; при включении каждая загрузка — в журнале сети',
  cbMer: 'Mermaid: off = блок как есть; inline = исходник встроен (внешние ссылки запрещены)',
  cbOnly: 'onlyNew: пропускать чаты без изменений (по contentHash)'
};
function buildPanel() {
  const p = currentPalette();
  uiHost = document.createElement('div');
  uiHost.id = UI_HOST_ID + '-host';
  uiShadow = uiHost.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = panelCss(p);
  uiShadow.appendChild(style);
  const box = document.createElement('div');
  box.className = 'box';
  box.setAttribute('role', 'complementary');
  box.setAttribute('aria-label', 'Панель UACE × PML');
  const h = html => setExportHTML(box, box.innerHTML + h);
  /* шапка */
  const grip = document.createElement('div'); grip.className = 'grip'; grip.dataset.tip = 'Перетащите, чтобы переместить; панель живёт в Shadow DOM и самовосстанавливается';
  const badge = document.createElement('div'); badge.className = 'badge';
  badge.textContent = 'UACE × PML ' + UACE_VER + ' EVIDENCE';
  const small = document.createElement('small'); small.textContent = 'Evidence First · ChatDocument · ' + PLATFORMS.length + ' платформ';
  badge.appendChild(small);
  grip.appendChild(badge);
  /* темы */
  const rowTheme = document.createElement('div'); rowTheme.className = 'row';
  const lblT = document.createElement('span'); lblT.className = 'lbl'; lblT.textContent = 'Тема';
  rowTheme.appendChild(lblT);
  for (const [k, label] of [['auto', 'Авто'], ['light', 'Свет'], ['dark', 'Тьма'], ['warm', 'Тепло']]) {
    const b = document.createElement('button');
    b.textContent = label; b.dataset.theme = k; b.dataset.tip = TIPS['th' + k.charAt(0).toUpperCase() + k.slice(1)] || TIPS['th' + k];
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { applyTheme(k); journal.info('ui', 'тема → ' + k); setStatus('Тема: ' + k); });
    rowTheme.appendChild(b);
  }
  /* H12: фильтр чатов (ключ uaice_filter оживлён) */
  const rowFilter = document.createElement('div'); rowFilter.className = 'row';
  const inpF = document.createElement('input');
  inpF.type = 'text'; inpF.placeholder = 'фильтр чатов: подстрока, !исключить, через запятую';
  inpF.dataset.tip = TIPS.flt; inpF.setAttribute('aria-label', 'Фильтр чатов');
  let fDeb = 0;
  inpF.addEventListener('input', () => { clearTimeout(fDeb); fDeb = setTimeout(() => safeStorageSet('uaice_filter', inpF.value.trim()), 300); });
  try { inpF.value = safeStorageGet('uaice_filter') || ''; } catch (e) { journal.debug('ui', 'filter-load-fail', String(e && e.message || e)); }
  rowFilter.appendChild(inpF);
  /* формат + экспорт + все чаты */
  const rowFmt = document.createElement('div'); rowFmt.className = 'row';
  const selFmt = document.createElement('select'); selFmt.id = 'fmt'; selFmt.dataset.tip = TIPS.fmt; selFmt.setAttribute('aria-label', 'Формат экспорта');
  for (const [v, t] of [['md', 'Markdown'], ['json', 'JSON (ChatDocument)'], ['jsonl', 'JSONL'], ['alpaca', 'Alpaca'], ['sharegpt', 'ShareGPT'], ['html', 'HTML (стиль)'], ['txt', 'TXT'], ['csv', 'CSV'], ['zip', 'ZIP текущего'], ['pdf', 'PDF (печать)']]) {
    const o = document.createElement('option'); o.value = v; o.textContent = t; selFmt.appendChild(o);
  }
  const storedFmt = safeStorageGet('uaice_format'); if (storedFmt) selFmt.value = storedFmt;
  selFmt.addEventListener('change', () => safeStorageSet('uaice_format', selFmt.value));
  const btnExport = mkBtn('Экспорт', TIPS.btnExport, async () => {
    busy(true);
    try { const r = await exportCurrent(selFmt.value); handleExportResult(r); } catch (e) { journal.error('export', 'throw', String(e && e.stack || e)); toast('Ошибка экспорта: ' + (e && e.message || e), 5000); }
    busy(false);
  });
  /* H11: быстрая кнопка «⧉ MD» (возврат из v28.3.0) */
  const btnMd = mkBtn('⧉ MD', TIPS.btnMd, async () => {
    busy(true);
    try { const r = await exportCurrent('md'); handleExportResult(r); } catch (e) { journal.error('export', 'md-throw', String(e && e.stack || e)); toast('Ошибка: ' + (e && e.message || e), 5000); }
    busy(false);
  });
  const btnAll = mkBtn('Все чаты → ZIP', TIPS.btnAll, async () => {
    busy(true);
    try { const r = await exportAllChats('zip'); if (r && r.kind === 'file' && !r.stopped) toast('Готово: чатов ' + (r.results ? r.results.length : 0), 4000); } catch (e) { journal.error('all', 'throw', String(e && e.stack || e)); toast('Ошибка: ' + (e && e.message || e), 5000); }
    busy(false);
  });
  rowFmt.append(selFmt, btnExport, btnMd, btnAll);
  /* стиль PDF/HTML */
  const rowTpl = document.createElement('div'); rowTpl.className = 'row';
  const lblS = document.createElement('span'); lblS.className = 'lbl'; lblS.textContent = 'Стиль PDF/HTML';
  const selTpl = document.createElement('select'); selTpl.dataset.tip = TIPS.tpl; selTpl.setAttribute('aria-label', 'Стиль PDF/HTML');
  for (const [k, v] of Object.entries(TPL_STYLES)) { const o = document.createElement('option'); o.value = k; o.textContent = v.name; selTpl.appendChild(o); }
  selTpl.value = tplStyleId();
  selTpl.addEventListener('change', () => { safeStorageSet('uaice_tpl', selTpl.value); setStatus('Стиль: ' + TPL_STYLES[selTpl.value].name); });
  rowTpl.append(lblS, selTpl);
  /* опции */
  const rowOpt = document.createElement('div'); rowOpt.className = 'row';
  rowOpt.appendChild(mkCheck('cbImg', 'Внешние изображения', TIPS.selImg, imagesEnabled(), v => { safeStorageSet('uaice_images', v ? '1' : '0'); setStatus(v ? 'Изображения ВКЛ — сеть журналируется' : 'Изображения ВЫКЛ — 0 внешних запросов'); }));
  rowOpt.appendChild(mkCheck('cbMer', 'Mermaid inline', TIPS.cbMer, mermaidEnabled(), v => safeStorageSet('uaice_mermaid', v ? 'inline' : 'off')));
  rowOpt.appendChild(mkCheck('cbOnly', 'onlyNew', TIPS.cbOnly, onlyNewEnabled(), v => safeStorageSet('uaice_onlynew', v ? '1' : '0')));
  /* действия */
  const rowBtns = document.createElement('div'); rowBtns.className = 'row';
  rowBtns.append(
    mkBtn('Наблюдение', TIPS.btnObs, () => startObservation()),
    mkBtn('struct', TIPS.btnStruct, async () => { const st = lastStruct || await pmlScan(); await copyText(JSON.stringify(stripEls(st), null, 2), 'struct скопирован'); }),
    mkBtn('agent-view', TIPS.btnAgent, async () => { const st = lastStruct || await pmlScan(); await copyText(agentViewOf(stripEls(st)), 'agent-view скопирован'); }),
    mkBtn('Стоп', TIPS.btnStop, () => { CANCEL = true; stopObservation('кнопка Стоп'); }, { keepAlive: true }), /* H3: жива и во время busy */
    mkBtn('Журнал', TIPS.btnLog, async () => { await copyText(journal.dump().map(j => '+' + (j.t / 1000).toFixed(1) + 'с [' + j.level + '][' + j.scope + '] ' + j.msg + (j.data ? ' · ' + j.data : '')).join('\n'), 'журнал скопирован'); }),
    mkBtn('Debug', TIPS.btnDebug, () => downloadDebug())
  );
  /* СПРАВКА СЛЕВА от ПАСПОРТ + collapse (требование пользователя + §27) */
  const rowMain = document.createElement('div'); rowMain.className = 'row';
  const btnHelp = mkBtn('? Справка', TIPS.btnHelp, () => toggleBox('.help', true));
  const btnPass = mkBtn('ⓘ Паспорт', TIPS.btnPassport, () => toggleBox('.passport', true));
  const btnCol = mkBtn('—', TIPS.btnCollapse, () => { const c = safeStorageGet('uaice_collapsed') === '1'; safeStorageSet('uaice_collapsed', c ? '0' : '1'); applyCollapsed(!c); });
  rowMain.append(btnHelp, btnPass, btnCol);
  /* статус + боксы */
  const status = document.createElement('div'); status.className = 'status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const passport = document.createElement('div'); passport.className = 'passport';
  const help = document.createElement('div'); help.className = 'help';
  const recon = document.createElement('div'); recon.className = 'recon';
  const logbox = document.createElement('div'); logbox.className = 'logbox';
  const dLog = document.createElement('details');
  const sLog = document.createElement('summary'); sLog.textContent = 'PML: журнал разведки';
  dLog.appendChild(sLog); dLog.appendChild(logbox);
  const dRec = document.createElement('details');
  const sRec = document.createElement('summary'); sRec.textContent = 'PML: разведка/наблюдение';
  dRec.appendChild(sRec); dRec.appendChild(recon);
  box.append(grip, rowTheme, rowFilter, rowFmt, rowTpl, rowOpt, rowBtns, rowMain, status, passport, help, dRec, dLog);
  const tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('aria-hidden', 'true');
  uiShadow.appendChild(box);
  uiShadow.appendChild(tip);
  document.documentElement.appendChild(uiHost);
  ui = { box, grip, rowTheme, selFmt, selTpl, status, passport, help, recon, logbox, tip };
  wireTips(tip);
  dragify(grip, box);
  help.innerHTML = helpHTML();
  /* bootstrap поведения */
  applyTheme(safeStorageGet('uaice_theme') || 'auto', true);
  applyCollapsed(safeStorageGet('uaice_collapsed') === '1');
  renderPmlPassport();
  journal.info('boot', 'панель смонтирована (Shadow DOM, host=documentElement)', 'стилей ' + Object.keys(TPL_STYLES).length);
}
function mkBtn(label, tip, fn, opts) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (tip) b.dataset.tip = tip; if (opts && opts.keepAlive) b.dataset.keepAlive = '1'; b.addEventListener('click', fn); return b; }
function mkCheck(id, label, tip, checked, onChange) {
  const l = document.createElement('label'); l.className = 'btn'; l.style.display = 'inline-flex'; l.style.alignItems = 'center'; l.style.gap = '5px'; if (tip) l.dataset.tip = tip;
  const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!checked; c.addEventListener('change', () => onChange(c.checked));
  l.appendChild(c); l.appendChild(document.createTextNode(label));
  return l;
}
function stripEls(st) { /* struct без DOM-ссылок — канонный JSON */
  const c = JSON.parse(JSON.stringify(st, (k, v) => k === 'el' ? undefined : v));
  return c;
}
function handleExportResult(r) {
  if (!r) { toast('Экспорт: нет результата', 4000); return; }
  if (r.kind === 'file') toast('Файл сохранён: ' + r.name, 4000);
  else if (r.kind === 'print') toast('Открыта печать — выберите «Сохранить как PDF»', 6000);
  else if (r.kind === 'print-html') toast('Popup заблокирован: скачан .print.html — откройте и нажмите Ctrl+P', 7000);
  else toast('Не удалось: ' + (r.error || 'причина неизвестна'), 5000);
}
function setStatus(msg) { if (ui && ui.status) ui.status.textContent = String(msg || '').slice(0, 120); }
/* H3: busy глушит всё, КРОМЕ keepAlive-кнопок («Стоп» остаётся живой во время экспорта) */
function busy(on) { if (!ui) return; ui.box.querySelectorAll('button,select').forEach(el => { el.disabled = !!on && el.dataset.keepAlive !== '1'; }); setStatus(on ? 'Работаю…' : ''); }
function toggleBox(sel, show) {
  if (!ui) return;
  const el = ui.box.querySelector(sel);
  if (!el) return;
  el.style.display = show && el.style.display !== 'block' ? 'block' : 'none';
  if (el.style.display === 'block') { renderPmlPassport(); try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { journal.debug('ui', 'scroll-into-view-fail', String(e && e.message || e)); } }
}
function applyCollapsed(c) { if (!ui) return; ui.box.querySelectorAll('.row,.status,details,.passport,.help').forEach(el => el.classList.toggle('collapsed', c)); ui.box.classList.toggle('collapsed', false); }
function currentPalette() {
  const pref = safeStorageGet('uaice_theme') || 'auto';
  let prefersDark = false;
  try { prefersDark = matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { journal.debug('ui', 'prefers-dark-fail', String(e && e.message || e)); }
  return PAL[resolveTheme(pref, new Date().getHours(), prefersDark)] || PAL.light;
}
function applyTheme(pref, silent) {
  safeStorageSet('uaice_theme', pref); /* единая точка правды — фикс «Тепло»: один путь applyTheme */
  const p = currentPalette();
  if (ui) {
    const styleEl = ui.box.parentNode ? uiShadow.querySelector('style') : null;
    if (styleEl) styleEl.textContent = panelCss(p);
    ui.box.querySelectorAll('[data-theme]').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === pref ? 'true' : 'false'));
  }
  if (!silent) setStatus('Тема: ' + pref + ' → палитра ' + (PAL === p ? '' : Object.keys(PAL).find(k => PAL[k] === p) || 'auto'));
  renderPmlPassport();
}
function dragify(grip, box) {
  let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
  grip.addEventListener('mousedown', e => { drag = true; sx = e.clientX; sy = e.clientY; const r = box.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); });
  document.addEventListener('mousemove', e => { if (!drag) return; box.style.left = clamp(ox + e.clientX - sx, 0, innerWidth - 100) + 'px'; box.style.top = clamp(oy + e.clientY - sy, 0, innerHeight - 60) + 'px'; box.style.right = 'auto'; });
  document.addEventListener('mouseup', () => { if (drag) { drag = false; const r = box.getBoundingClientRect(); safeStorageSet('uaice_pos_v1', JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } });
  try { const pos = JSON.parse(safeStorageGet('uaice_pos_v1') || 'null'); if (pos) { box.style.left = clamp(pos.x, 0, innerWidth - 100) + 'px'; box.style.top = clamp(pos.y, 0, innerHeight - 60) + 'px'; box.style.right = 'auto'; } } catch (e) { journal.debug('ui', 'pos-parse-fail', String(e && e.message || e)); }
}
/* --- Тултипы (требование пользователя): 320 мс, клемп в вьюпорт --- */
function wireTips(tip) {
  let timer = 0;
  const show = el => {
    const txt = el.dataset && el.dataset.tip;
    if (!txt) return;
    tip.textContent = txt;
    const r = el.getBoundingClientRect();
    tip.classList.add('on');
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8) + 'px';
    tip.style.top = (r.top - th - 8 > 0 ? r.top - th - 8 : r.bottom + 8) + 'px';
  };
  const hide = () => { clearTimeout(timer); tip.classList.remove('on'); };
  uiShadow.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) { clearTimeout(timer); timer = setTimeout(() => show(el), 320); } });
  uiShadow.addEventListener('mouseout', hide);
  uiShadow.addEventListener('mousedown', hide);
  uiShadow.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(el); });
  uiShadow.addEventListener('focusout', hide);
  addEventListener('scroll', hide, true);
}
/* --- СПРАВКА (инструкция по эксплуатации) --- */
function helpHTML() {
  return '<div class="h3">1. Что это</div>Панель экспорта чатов + структурная разведка PML. Всё работает локально; по умолчанию 0 внешних запросов.'
  + '<div class="h3">2. Быстрый старт</div>Выберите формат → «Экспорт» (или «⧉ MD» — Markdown одним кликом). «Все чаты → ZIP» обходит список слева с кликами и собирает сводный архив (resume продолжает после перерыва, onlyNew пропускает неизменённые). Фильтр чатов: подстроки через запятую, «!текст» — исключить. Длинные/виртуализированные ленты автопрокручиваются; стриминг дожидается стабилизации.'
  + '<div class="h3">3. Темы</div>Авто/Свет/Тьма/Тепло. Вечером (20:00–07:00) «Авто» включает тёплую. Тёплый канон: фон #f6efe2, акцент #8a5a00 (контраст ≥5:1).'
  + '<div class="h3">4. Стили PDF/HTML</div>ИМПЕРСКИЙ С ЗОЛОТОМ (тёмный + золото #d4af37, кегль 18), МАКТ Светлый, Швейцарская сетка, Нео-брутализм, Сепия Вечер. PDF = печать браузера: окно → «Сохранить как PDF». При блоке popup скачивается .print.html — открыть и Ctrl+P.'
  + '<div class="h3">5. Форматы</div>Markdown, JSON (полный ChatDocument с уликами), JSONL, Alpaca (unknown пропускаются), ShareGPT, HTML, TXT, CSV, ZIP (внутри md+json+txt+html+.print.html+артефакты+манифест+README).'
  + '<div class="h3">6. Кнопки и хоткеи (канон §13: только 6)</div>Alt+E — экспорт JSON · Alt+D — Debug-отчёт · Alt+C — копировать struct · Alt+S — стоп · Alt+X — экспорт ZIP · Alt+I — наблюдение 60 с. Наблюдение: снапшот T0 + каждые 10 с, Esc — стоп. «struct»/«agent-view» — канонный JSON и a11y-скелет без имён.'
  + '<div class="h3">7. Приватность (честно)</div>0 внешних запросов по умолчанию. «Внешние изображения» — явная опция: HTTPS-only, приватные адреса запрещены, GM-запросы anonymous, каждое обращение в Журнале сети (Debug-отчёт). Текст страницы читается только по команде экспорта; struct — только структурные агрегаты.'
  + '<div class="h3">8. Траблшутинг</div>Панель пропала — вернётся сама ≤2 с (watchdog). На сайтах с Trusted Types используется именованная политика uace-export. Диагностика: «Debug» → пришлите файл. Если чат не распознался — экспорт честно пометит captureMode=snapshot.';
}
/* --- Паспорт: честная модель приватности (§3) --- */
async function renderPmlPassport() {
  if (!ui) return;
  const p = currentPalette();
  const palName = Object.keys(PAL).find(k => PAL[k] === p) || 'auto';
  const st = lastStruct;
  const net = journal.stats();
  const lines = [
    'Версия: UACE × PML ' + UACE_VER + ' (Evidence First) · схема ' + SCHEMA_VER,
    'Платформа: ' + ((getPlatform() || {}).name || 'не распознана') + ' · домен ' + location.host,
    'Тема UACE: ' + (safeStorageGet('uaice_theme') || 'auto') + ' → палитра ' + palName + ' (акцент ' + p.accent + ')',
    'Стиль PDF/HTML: ' + (TPL_STYLES[tplStyleId()] ? TPL_STYLES[tplStyleId()].name : 'imperial') + ' · форматов: 9 + ZIP · платформ: ' + PLATFORMS.length,
    'Приватность: 0 внешних запросов по умолчанию; изображения ' + (imagesEnabled() ? 'ВКЛ (сеть журналируется)' : 'ВЫКЛ') + '; сетевых записей в журнале: ' + (net.net || 0),
    'PML: ' + (st ? 'разведка ' + st.dom.groups.length + ' групп, кандидат ' + (st.recon.candidate ? st.recon.candidate.sigHash + ' conf ' + st.recon.candidate.confidence : '—') : 'ещё не выполнялась'),
    'Журнал: ' + journalBuf.length + ' записей · уровни ' + JSON.stringify(journal.stats()),
    'Хоткеи: Alt+E/D/C/S/X/I (канон §13, новые запрещены)'
  ];
  ui.passport.textContent = lines.join('\n');
}
function renderPmlRecon() {
  if (!ui) return;
  const st = lastStruct;
  const L = [];
  if (obsSession) {
    L.push('НАБЛЮДЕНИЕ идёт: ' + Math.round((Date.now() - obsSession.startedAt) / 1000) + ' с / 60 · Esc — стоп');
    L.push('мутаций: ' + obsSession.mutTotal + ' (батчей ' + obsSession.mutBatches + ', кап ' + CFG.MUTOBS_BATCH_CAP + ')');
  } else L.push('Наблюдение не активно (кнопка «Наблюдение» / Alt+I).');
  if (st) {
    L.push('');
    L.push('Каркас: блоков ' + st.dom.blockCount + ', глубина ' + st.dom.maxDepth + (st.dom.truncated ? ' (УСЕЧЕНО)' : ''));
    L.push('Первичный скролл: ' + (st.scroll.primary ? st.scroll.primary.path + ' ratio ' + st.scroll.primary.ratio : '—'));
    L.push('Группы (' + st.dom.groups.length + '):');
    for (const g of st.dom.groups.slice(0, 6)) L.push('  ' + g.sigHash + ' ×' + g.count + ' u=' + g.uniformity + (g.inPrimary ? ' ✓скролл' : '') + ' ' + g.samplePath);
    L.push('Кандидат: ' + (st.recon.candidate ? st.recon.candidate.sigHash + ' conf ' + st.recon.candidate.confidence + (st.recon.candidate.passed ? ' (порог 75 пройден)' : ' (ниже порога резерва)') : '—'));
    if (obsSession && obsSession.snapshots.length) {
      L.push('');
      L.push('Снапшоты:');
      for (const s of obsSession.snapshots.slice(-6)) L.push('  ' + s.label + ': групп ' + s.groups + ', кандидат ' + (s.candidate || '—') + ' conf ' + s.conf);
    }
  } else L.push('Разведка ещё не выполнялась.');
  ui.recon.textContent = L.join('\n');
  if (ui.logbox) {
    ui.logbox.textContent = journal.dump(40).map(j => '+' + (j.t / 1000).toFixed(1) + 'с [' + j.level + '][' + j.scope + '] ' + j.msg).join('\n') || 'пусто';
  }
}
/* --- toast --- */
let toastEl = null, toastTimer = 0;
function toast(msg, ms) {
  if (!ui) { journal.info('toast', msg); return; }
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'tip'; toastEl.style.maxWidth = '320px'; uiShadow.appendChild(toastEl); }
  toastEl.textContent = msg;
  const r = ui.box.getBoundingClientRect();
  toastEl.classList.add('on');
  toastEl.style.left = clamp(r.left, 8, innerWidth - 340) + 'px';
  toastEl.style.top = Math.max(8, r.top - 44) + 'px';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (toastEl) toastEl.classList.remove('on'); }, ms || 3500);
}
/* --- Хоткеи: канон §13, ровно E/D/C/S/X/I + защита полей ввода.
   H1: выбор по e.code — раскладко-независимо (кириллица больше не глушит канон) --- */
const isEditableEl = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
document.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (isEditableEl(e.target)) return;
  const act = hotkeyActionFromCode(e.code); /* KeyE/KeyD/KeyC/KeyS/KeyX/KeyI */
  const map = {
    e: () => exportCurrent('json').then(handleExportResult),
    d: () => downloadDebug(),
    c: () => pmlScan().then(st => copyText(JSON.stringify(stripEls(st), null, 2), 'struct скопирован (Alt+C)')),
    s: () => { CANCEL = true; stopObservation('Alt+S'); },
    x: () => exportCurrent('zip').then(handleExportResult),
    i: () => startObservation()
  };
  if (act && map[act]) { e.preventDefault(); e.stopPropagation(); try { map[act](); } catch (err) { journal.error('hotkey', act, String(err && err.stack || err)); } }
  else if (typeof e.code === 'string' && e.code.indexOf('Key') === 0) journal.debug('hotkey', 'код вне канона: ' + e.code + ' (key=' + e.key + ')');
}, true);
/* --- Watchdog (≤2 с самовосстановление) + boot с ретраями --- */
function connected() { return !!(uiHost && uiHost.isConnected && document.documentElement.contains(uiHost)); }
function watchdog() {
  clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    if (!connected()) {
      journal.warn('boot', 'watchdog: хост сорван — перемонтирование');
      try { uiHost && uiHost.remove(); } catch (e) { journal.debug('boot', 'host-remove-fail', String(e && e.message || e)); }
      ui = null;
      try { buildPanel(); } catch (e) { journal.error('boot', 'remount-fail', String(e && e.stack || e)); }
    }
  }, 2000);
}
function boot() {
  try {
    if (connected()) return;
    buildPanel();
    watchdog();
    journal.info('boot', 'UACE × PML ' + UACE_VER + ' готов', 'платформа: ' + ((getPlatform() || {}).name || 'generic'));
  } catch (e) {
    bootTries++;
    journal.error('boot', 'попытка ' + bootTries, String(e && e.stack || e));
    if (bootTries <= 8) setTimeout(boot, 1500);
  }
}
/* pagehide: тихий автоснимок struct (B-6) */
addEventListener('pagehide', () => { if (lastStruct) journal.info('pml', 'pagehide: struct в памяти, групп ' + lastStruct.dom.groups.length); });
/* --- API-мост синглтона (PML-PANEL 1.0 §1) + internals для консольной сверки --- */
try {
  Object.defineProperty(window, '__UACE_INTERNALS__', {
    value: Object.freeze({
      version: UACE_VER, schema: SCHEMA_VER, SALT, fnv1a32, fnv1aHex, sigHashIn, urlHashIn, sigHashOf, urlHashOf,
      pathOf, sigOfEl, subtreeDepth, scoreGroup, pmlScan, lastStruct: () => lastStruct,
      simhash64, hammingHex, structFeatures, domSim64, simBetween, agentViewOf, downsample, compareStructs,
      crc32, zipBuild, splitVolumesU8, dedupeNested, scoreCandidates, resumePlan, makeChatDocument,
      renderByFormat, buildStyledHTML, TPL_STYLES, PAL, resolveTheme, journal, debugReport,
      PLATFORMS, canonicalKey, chatIdFrom, exportCurrent, exportZip, fetchImageU8,
      /* v29.0.1 хотфиксы */ hotkeyActionFromCode, parseChatFilter, applyChatFilterList, resumeEntryPlan, stabilityDecision, scrollStopDecision
    }), configurable: true
  });
} catch (e) { journal.debug('boot', 'internals-define-fail', String(e && e.message || e)); }
/* --- Старт: document-idle + ретраи до 8×1500 мс (SPA-гидрация) --- */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 300));
else setTimeout(boot, 300);

})();
