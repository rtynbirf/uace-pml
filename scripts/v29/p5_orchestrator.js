
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
