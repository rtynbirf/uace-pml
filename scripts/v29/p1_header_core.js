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
