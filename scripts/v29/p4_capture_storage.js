
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
