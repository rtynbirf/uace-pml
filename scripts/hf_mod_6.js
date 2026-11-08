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
