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
