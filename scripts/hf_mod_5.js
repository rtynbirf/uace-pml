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
