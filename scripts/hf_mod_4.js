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
    const data = (e.data instanceof Uint8Array) ? e.data : enc.encode(String(e.data));
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
