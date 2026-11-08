
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
