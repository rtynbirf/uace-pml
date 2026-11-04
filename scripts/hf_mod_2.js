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
