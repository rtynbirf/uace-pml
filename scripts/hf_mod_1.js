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
