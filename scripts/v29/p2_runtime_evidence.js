
/* ══════════════ L1 RUNTIME — планировщик, TreeWalker, бюджеты (§8/§9) ══════════════ */

const CFG = {
  DEDUPE_CAP: 400, SR_NODE_CAP: 12000, SR_TIME_MS: 250, SR_ROOT_CAP: 300,
  TEXT_CAP: 200000, MUTOBS_BATCH_CAP: 500, MAX_ZIP_MB: 50,
  IMG_POOL: 4, IMG_MAX: 60, ARTIFACT_MAX: 40, NAV_TIMEOUT: 12000, MSG_WAIT: 15000, MAX_NAV: 500,
  /* v29.0.1 H6/H7: автоскролл + стабилизация */
  SCROLL_STEP_MS: 350, SCROLL_MAX_PASSES: 3, SCROLL_MAX_STEPS: 160,
  STABILIZE_MS: 8000, STABILIZE_SAMPLES: 3, STABILIZE_STEP_MS: 400
};
const SCHED_SLICE = 12;
let _sliceAt = Date.now();
const schedNeedYield = () => (Date.now() - _sliceAt) >= SCHED_SLICE;
const schedYield = () => new Promise(r => setTimeout(r, 0));
async function schedSlice() { if (schedNeedYield()) { await schedYield(); _sliceAt = Date.now(); } }

/* collectShadowRoots: TreeWalker + бюджеты узлов/времени/корней + yield (§8);
   единый планировщик Sched и для UACE, и для PML-обходов (§9) */
async function collectShadowRoots(root) {
  const roots = [], seen = new Set();
  let nodes = 0, truncated = false;
  const start = Date.now();
  const topRoot = root || document.documentElement || document;
  seen.add(topRoot);
  const stack = [topRoot];
  while (stack.length) {
    if (roots.length >= CFG.SR_ROOT_CAP || nodes >= CFG.SR_NODE_CAP || Date.now() - start > CFG.SR_TIME_MS) { truncated = true; break; }
    const cur = stack.pop();
    let walker = null;
    try { walker = document.createTreeWalker(cur, NodeFilter.SHOW_ELEMENT); } catch (e) { journal.debug('runtime', 'treewalker-fail', String(e && e.message || e)); continue; }
    let n = walker.currentNode;
    while (n) {
      nodes++;
      if (schedNeedYield()) await schedSlice();
      if (n.shadowRoot) {
        if (!seen.has(n.shadowRoot)) { seen.add(n.shadowRoot); roots.push(n.shadowRoot); stack.push(n.shadowRoot); }
      }
      if (nodes >= CFG.SR_NODE_CAP || Date.now() - start > CFG.SR_TIME_MS) { truncated = true; break; }
      n = walker.nextNode();
    }
    if (truncated) break;
  }
  return { roots, truncated, nodes, ms: Date.now() - start, evidence: mkEv('treewalker', roots.length ? 0.9 : 0.4, ['nodes:' + nodes, truncated ? 'truncated' : 'complete']) };
}
let _shadow = null, _shadowAt = 0;
async function shadowRootsCached() {
  if (_shadow && Date.now() - _shadowAt < 1500) return _shadow;
  const r = await collectShadowRoots();
  _shadow = r.roots; _shadowAt = Date.now();
  return _shadow;
}
async function queryAllDeep(sel) {
  const out = Array.from(document.querySelectorAll(sel));
  try { for (const sr of await shadowRootsCached()) { try { out.push(...sr.querySelectorAll(sel)); } catch (e) { journal.debug('runtime', 'shadow-qsa-fail', String(e && e.message || e)); } } } catch (e) { journal.debug('runtime', 'shadow-cached-fail', String(e && e.message || e)); }
  return out;
}

/* --- DOM-хелперы --- */
const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE', 'BASE', 'HTML', 'SVG', 'PATH', 'MAT-ICON', 'BR', 'HR']);
const UI_HOST_ID = 'uaice-29';
const HARD_EXCLUDE_SEL = '#' + UI_HOST_ID + ',#' + UI_HOST_ID + '-host,[class*="tooltip"]:not([class*="content"])';
const CHAT_AREA_SEL = 'div.chat-container,#chat-history,[data-test-id="chat-history-container"],conversation-container,div.conversation-container,ms-chat-turn,[class*="chat-history-scroll"],[class*="turn-content"],main,[role="main"]';
function visible(el) {
  try { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity !== 0; } catch (e) { return false; }
}
function filterValid(els) {
  const out = [];
  for (const el of els) {
    if (!el || el.nodeType !== 1 || SKIP_TAGS.has(el.tagName)) continue;
    if (el.closest && el.closest(HARD_EXCLUDE_SEL)) continue;
    try { const r = el.getBoundingClientRect(); if (r.width < 32 || r.height < 16) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue; } catch (e) { continue; }
    out.push(el);
  }
  return out;
}
function chatAreaRoot() {
  try { const els = document.querySelectorAll(CHAT_AREA_SEL); for (const el of els) if (visible(el)) return el; } catch (e) { journal.debug('runtime', 'chat-area-fail', String(e && e.message || e)); }
  return null;
}
/* H5: глубокая (light+shadow) версия для membership-оценки */
async function chatAreaRootDeep() {
  try { const els = await queryAllDeep(CHAT_AREA_SEL); for (const el of els) if (visible(el)) return el; } catch (e) { journal.debug('runtime', 'chat-area-deep-fail', String(e && e.message || e)); }
  return chatAreaRoot();
}
function isUiZone(el) {
  try { return !!el.closest('nav,aside,header,footer,[role="navigation"],[role="banner"],button,[role="button"],[role="menu"],form'); } catch (e) { return false; }
}

/* ══════════════ L2 EVIDENCE — роли по уликам (§5), валидация кандидатов (§6) ══════════════ */

/* Лестница улик: attribute → testid → platform-selector → semantic-class → ancestor
   → (structural-order ТОЛЬКО при доказанном strictAlternation платформы; в v29
   ни одна платформа флага не имеет — поле зарезервировано под полевые доказательства)
   → framework-internal (только диагностический fallback списка чатов)
   → unknown. ДОГАДКА ПАРИТЕТА УДАЛЕНА (§5 аудита). */
function extractRoleRaw(el, platform) {
  const attrs = ['data-message-author-role', 'data-message-role', 'data-role', 'data-author', 'data-sender'];
  for (const a of attrs) {
    const v = roleFromValue(el.getAttribute(a));
    if (v) return { role: v, evidence: { method: 'attribute', confidence: ROLE_LEVELS.attribute, reason: a + '=' + String(el.getAttribute(a)).slice(0, 40) } };
  }
  const tid = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '';
  const tv = roleFromValue(tid);
  if (tv) return { role: tv, evidence: { method: 'attribute', confidence: 0.97, reason: 'testid=' + tid.slice(0, 40) } };
  if (platform && typeof platform.role === 'function') {
    try {
      const r = platform.role(el);
      if (r === 'user' || r === 'assistant' || r === 'system') return { role: r, evidence: { method: 'platform-selector', confidence: ROLE_LEVELS['platform-selector'], reason: platform.name } };
    } catch (e) { journal.debug('role', 'platform-role-threw', platform.name); }
  }
  const cls = (typeof el.className === 'string' ? el.className : '') + (el.id ? ' #' + el.id : '');
  const cv = roleFromValue(cls);
  if (cv) return { role: cv, evidence: { method: 'semantic-class', confidence: ROLE_LEVELS['semantic-class'], reason: 'class/id: ' + cls.slice(0, 60) } };
  let anc = el.parentElement;
  for (let i = 1; anc && i <= 3; i++, anc = anc.parentElement) {
    const av = roleFromValue(anc.getAttribute && (anc.getAttribute('data-message-author-role') || anc.getAttribute('data-message-role') || anc.getAttribute('data-role')));
    if (av) return { role: av, evidence: { method: 'ancestor', confidence: ROLE_LEVELS.ancestor, reason: 'ancestor+' + i + ' (' + anc.tagName.toLowerCase() + ')' } };
  }
  return { role: 'unknown', evidence: { method: 'heuristic', confidence: 0, reason: 'сигналы ролей противоречивы или отсутствуют' } };
}
function candidateFeatures(els, platform, areaRoot) {
  const count = els.length;
  let known = 0, users = 0, assistants = 0, ui = 0, inArea = 0, nonEmpty = 0, lenSum = 0;
  const sigs = new Map();
  for (const el of els) {
    const re = extractRoleRaw(el, platform);
    if (re.role === 'user') { users++; known++; } else if (re.role === 'assistant') { assistants++; known++; }
    const sig = el.tagName + '|' + (typeof el.className === 'string' ? el.className.split(' ')[0] : '');
    sigs.set(sig, (sigs.get(sig) || 0) + 1);
    if (isUiZone(el)) ui++;
    if (areaRoot && (el === areaRoot || areaRoot.contains(el))) inArea++;
    const len = (el.textContent || '').trim().length;
    if (len > 0) nonEmpty++;
    lenSum += len;
  }
  let modeFreq = 0; for (const v of sigs.values()) modeFreq = Math.max(modeFreq, v);
  let nested = 0;
  for (const el of els) { for (const other of els) { if (other !== el && other.contains(el)) { nested++; break; } } }
  const avg = count ? lenSum / count : 0;
  return {
    count,
    roleCoherence: count ? known / count : 0,
    membership: areaRoot ? inArea / count : 0.5,
    uniformity: count ? modeFreq / count : 0,
    orderConsistency: count >= 3 ? ((users > 0 && assistants > 0) ? 1 : 0.2) : 0.4,
    textQuality: count ? Math.min(1, (nonEmpty / count) * (avg >= 8 ? 1 : avg / 8)) : 0,
    nestedShare: count ? nested / count : 0,
    uiShare: count ? ui / count : 0,
    cleanliness: count ? 1 - Math.min(1, ui / count) : 0,
    users, assistants
  };
}

/* findMessages: цепочка стратегий platform → generic → structural; выбор по
   ВАЛИДИРОВАННОМУ score (§6), не по максимуму элементов. Провал всех → null
   (далее snapshot с captureMode='snapshot', а не догадка). */
const GENERIC_MSG_SELS = ['[data-message-author-role]', 'article', '[class*="message"]:not([class*="message-input"]):not([class*="message-list"])', '[class*="chat-item"]', '[class*="turn"]'];
async function findMessages(platform) {
  const attempts = [];
  const push = (strategy, els, sel) => { attempts.push({ strategy, sel, raw: els.length, valid: filterValid(els).slice(0, CFG.DEDUPE_CAP) }); };
  if (platform) for (const sel of platform.msgSelectors || []) { try { push('platform-deep', Array.from(await queryAllDeep(sel)), sel); } catch (e) { journal.debug('find', 'platform-sel-fail', sel); } }
  for (const sel of GENERIC_MSG_SELS) { try { push('generic-deep', Array.from(await queryAllDeep(sel)), sel); } catch (e) { journal.debug('find', 'generic-sel-fail', sel); } }
  /* structural (PML I-2): рекуррентные группы одноуровневых по sigHash */
  try {
    const groups = await structuralGroups();
    for (const g of groups.slice(0, 6)) push('structural', g.els, 'sighash:' + g.sigHash);
  } catch (e) { journal.debug('find', 'structural-fail', String(e && e.message || e)); }
  const area = await chatAreaRootDeep();
  let best = null;
  for (const a of attempts) {
    if (a.valid.length < 2) continue;
    const ded = dedupeNested(a.valid);
    if (ded.length < 2) continue;
    const f = candidateFeatures(ded, platform, area);
    const s = scoreCandidates(f);
    journal.debug('find', 'candidate ' + a.strategy + ' n=' + ded.length + ' score=' + s.score + ' pass=' + s.pass, s.reasons.join(','));
    if (s.pass && (!best || s.score > best.score.score)) best = { attempt: a, els: ded, score: s, features: f };
  }
  if (best) {
    return {
      captureEvidence: mkEv(best.attempt.strategy, best.score.score, ['sel:' + best.attempt.sel, 'raw:' + best.attempt.raw].concat(best.score.reasons), { sel: best.attempt.sel }),
      els: best.els
    };
  }
  journal.warn('find', 'ни одна стратегия не прошла валидацию ≥ ' + SCORE_THRESHOLD);
  return null;
}

/* ── v29.0.1 H6/H7: автоскролл виртуализированных лент + стабилизация контента ── */
async function findScrollContainer(platform) {
  const isScrollable = el => {
    try {
      if (!el || el.nodeType !== 1 || el.scrollHeight <= el.clientHeight + 4) return false;
      const ov = getComputedStyle(el).overflowY;
      return ov === 'auto' || ov === 'scroll' || ov === 'overlay';
    } catch (e) { return false; }
  };
  const fit = el => { try { const r = el.getBoundingClientRect(); return r.height >= 120 && r.width >= 200; } catch (e) { return false; } };
  /* точный путь: прокручиваемый предок найденных сообщений (в т.ч. через shadow-host) */
  try {
    const found = await findMessages(platform);
    if (found && found.els.length) {
      let anc = found.els[0];
      while (anc) {
        if (isScrollable(anc) && fit(anc)) return { el: anc, scrollable: anc.scrollHeight - anc.clientHeight };
        anc = anc.parentElement || (anc.host || null);
      }
    }
  } catch (e) { journal.debug('scroll', 'ancestor-fail', String(e && e.message || e)); }
  /* запасной путь: кандидаты по селектору */
  const cands = [];
  const vh = innerHeight;
  const els = await queryAllDeep('main,[role="main"],body,#chat-history,[class*="chat"],[class*="history"],[class*="scroll"],[class*="conversation"],[class*="message"],[class*="turn"]');
  for (const el of els) {
    try {
      if (!isScrollable(el)) continue;
      if (!fit(el)) continue;
      cands.push({ el, share: el.getBoundingClientRect().height / vh, scrollable: el.scrollHeight - el.clientHeight });
    } catch (e) { journal.debug('scroll', 'cand-fail', String(e && e.message || e)); }
  }
  cands.sort((a, b) => b.share - a.share || b.scrollable - a.scrollable);
  if (cands[0]) return { el: cands[0].el, scrollable: cands[0].scrollable };
  const se = document.scrollingElement;
  if (se && se.scrollHeight > innerHeight + 4) return { el: se, scrollable: se.scrollHeight - innerHeight };
  return null;
}
/* дешёвая проба ленты: count + хэш пар «роль+текст» (первые 200 символов каждого) */
async function probeSignature(platform) {
  const found = await findMessages(platform);
  if (!found || !found.els.length) return { count: 0, hash: '' };
  let acc = '';
  for (const el of found.els) {
    const re = extractRoleRaw(el, platform);
    const t = (el.textContent || '').trim();
    acc += re.role + ':' + (t.length > 200 ? t.slice(0, 200) : t) + '|';
  }
  return { count: found.els.length, hash: fnv1a32(acc).toString(16) };
}
/* H7: ждать, пока лента перестанет меняться (стриминг), с CANCEL и тайм-аутом */
async function stabilizeContent(platform, budgetMs) {
  const dl = Date.now() + (budgetMs || CFG.STABILIZE_MS);
  const probes = [];
  while (Date.now() < dl) {
    if (CANCEL) { journal.info('stabilize', 'CANCEL — выходим без ожидания'); return false; }
    probes.push(await probeSignature(platform));
    const d = stabilityDecision(probes, { samples: CFG.STABILIZE_SAMPLES });
    if (d.stable) { journal.debug('stabilize', 'стабильно: проб ' + probes.length + ', streak ' + d.equalStreak); return true; }
    await sleep(CFG.STABILIZE_STEP_MS);
  }
  journal.warn('stabilize', 'тайм-аут ' + (budgetMs || CFG.STABILIZE_MS) + ' мс — работаем с тем, что есть');
  return false;
}
/* H6: прокрутить ленту и собрать все сообщения по contentHash (виртуализация-безопасно).
   Возвращает { els, steps, passes } либо null (скроллить нечего). */
async function scrollAndCollect(platform) {
  const sc = await findScrollContainer(platform);
  if (!sc) { journal.debug('scroll', 'контейнер не найден — обычный захват без прокрутки'); return null; }
  const el = sc.el;
  const origTop = el.scrollTop;
  const byHash = new Map();
  let steps = 0, passes = 0;
  const t0 = Date.now();
  for (let pass = 1; pass <= CFG.SCROLL_MAX_PASSES; pass++) {
    passes = pass;
    try { el.scrollTop = 0; } catch (e) { journal.debug('scroll', 'top-fail', String(e && e.message || e)); }
    await sleep(250);
    let newInPass = 0;
    while (true) {
      if (CANCEL) { journal.info('scroll', 'CANCEL — прокрутка прервана'); try { el.scrollTop = origTop; } catch (e2) { journal.debug('scroll', 'restore-fail', String(e2 && e2.message || e2)); } return null; }
      const found = await findMessages(platform);
      if (found && found.els.length) {
        for (const m of found.els) {
          const re = extractRoleRaw(m, platform);
          const t = (m.textContent || '').trim();
          const h = fnv1a32(re.role + '|' + t).toString(16);
          if (!byHash.has(h)) { byHash.set(h, m); newInPass++; }
        }
      }
      if (schedNeedYield()) await schedSlice();
      const before = el.scrollTop;
      try { el.scrollTop = before + Math.max(200, Math.floor(el.clientHeight * 0.85)); } catch (e) { journal.debug('scroll', 'step-fail', String(e && e.message || e)); break; }
      await sleep(CFG.SCROLL_STEP_MS);
      steps++;
      const atBottom = el.scrollTop <= before + 2 || el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      if (atBottom || steps >= CFG.SCROLL_MAX_STEPS) {
        if (steps >= CFG.SCROLL_MAX_STEPS) journal.warn('scroll', 'бюджет шагов исчерпан (' + steps + ')');
        break;
      }
    }
    if (scrollStopDecision({ atBottom: true, newCount: newInPass, pass, maxPasses: CFG.SCROLL_MAX_PASSES, cancelled: CANCEL }) && newInPass === 0) break;
    if (newInPass === 0 && pass >= 2) break;
  }
  try { el.scrollTop = origTop; } catch (e) { journal.debug('scroll', 'restore-fail', String(e && e.message || e)); }
  const els = Array.from(byHash.values());
  journal.info('scroll', 'scrollDriver: шагов ' + steps + ', проходов ' + passes + ', уникальных сообщений ' + els.length + ' за ' + (Date.now() - t0) + ' мс');
  return els.length ? { els, steps, passes } : null;
}
async function structuralGroups() {
  const out = [];
  const containers = await queryAllDeep('main,[role="main"],body');
  for (const parent of containers) {
    if (parent.childElementCount < 3) continue;
    const bySig = new Map();
    for (const k of parent.children) { const h = sigHashOf(sigOfEl(k)); if (!bySig.has(h)) bySig.set(h, []); bySig.get(h).push(k); }
    let best = null;
    for (const [h, arr] of bySig) if (!best || arr.length > best.arr.length) best = { h, arr };
    if (!best || best.arr.length < 3) continue;
    const u = best.arr.length / parent.childElementCount;
    if (u < 0.6) continue;
    out.push({ sigHash: best.h, uniformity: u, els: best.arr });
    if (out.length >= 6) break;
  }
  return out;
}

/* findChatLists: цепочка platform → generic → conversation-item → structural →
   click-items → doc-links; каждая стратегия возвращает модель улик, выбирается
   ЛУЧШАЯ ВАЛИДИРОВАННАЯ (§16/§24), порог 0.5 */
async function findChatLists(platform) {
  const results = [];
  const consider = (strategy, containers, extraReasons) => {
    const items = [];
    const seenHref = new Set();
    for (const c of containers) {
      if (SKIP_TAGS.has(c.tagName)) continue;
      let links = [];
      try { links = Array.from(c.querySelectorAll('a[href]')); } catch (e) { continue; }
      for (const a of links) {
        let u;
        try { u = new URL(a.href, location.href); } catch (e) { continue; }
        if (u.origin !== location.origin || u.pathname.length < 2) continue;
        if (/\/(logout|settings|account|login|signup|pricing|help|docs|privacy|terms)/i.test(u.pathname)) continue;
        if (seenHref.has(u.pathname)) continue;
        if (!visible(a)) continue;
        seenHref.add(u.pathname);
        items.push({ el: a, url: u.href, title: (a.textContent || '').trim().slice(0, 120) });
      }
    }
    if (items.length < 2) return;
    const shapes = new Map();
    for (const it of items) { const shape = it.el.closest(HARD_EXCLUDE_SEL) ? 'ui' : new URL(it.url).pathname.replace(/[0-9a-f-]{8,}/gi, '{id}'); shapes.set(shape, (shapes.get(shape) || 0) + 1); }
    let mode = 0; for (const v of shapes.values()) mode = Math.max(mode, v);
    if (shapes.get('ui') === items.length) return;
    const uniformity = mode / items.length;
    const countFactor = Math.min(1, items.length / 8);
    let clean = 1; for (const it of items) if (isUiZone(it.el)) { clean -= 0.5 / items.length; }
    const score = round2(0.5 * uniformity + 0.3 * countFactor + 0.2 * clean);
    const ev = mkEv(strategy, score, ['items:' + items.length, 'uniformity:' + round2(uniformity)].concat(extraReasons || []));
    journal.debug('chatlist', 'strategy ' + strategy + ' items=' + items.length + ' score=' + score);
    results.push({ ev, items });
  };
  if (platform && platform.sidebarSelectors) {
    try { consider('platform', await queryAllDeep(platform.sidebarSelectors.join(',')), ['name:' + platform.name]); } catch (e) { journal.debug('chatlist', 'platform-fail', String(e && e.message || e)); }
  }
  try { consider('generic', await queryAllDeep('nav,aside,[role="navigation"],[class*="sidebar"],[class*="history"],[class*="chat-list"],[class*="conversation-list"],[class*="sider"]'), []); } catch (e) { journal.debug('chatlist', 'generic-fail', String(e && e.message || e)); }
  try { consider('conversation-item', await queryAllDeep('[class*="conversation-item"],[data-testid*="conversation"],a[href*="/c/"],a[href*="/chat/"]'), []); } catch (e) { journal.debug('chatlist', 'conv-item-fail', String(e && e.message || e)); }
  try { consider('structural', (await structuralGroups()).flatMap(g => g.els), ['pml-groups']); } catch (e) { journal.debug('chatlist', 'structural-fail', String(e && e.message || e)); }
  try { consider('click-items', await queryAllDeep('[role="listitem"],[role="option"],[role="button"]'), ['interactive']); } catch (e) { journal.debug('chatlist', 'click-items-fail', String(e && e.message || e)); }
  try { consider('doc-links', Array.from(document.querySelectorAll('a[href]')), ['document-wide']); } catch (e) { journal.debug('chatlist', 'doc-links-fail', String(e && e.message || e)); }
  let best = null;
  for (const r of results) if (r.ev.confidence >= 0.5 && (!best || r.ev.confidence > best.ev.confidence)) best = r;
  if (best) journal.info('chatlist', 'выбрана стратегия ' + best.ev.strategy + ' (score ' + best.ev.confidence + ', чатов ' + best.items.length + ')');
  else journal.warn('chatlist', 'валидный список чатов не найден — all-chats отменён (не догадываемся)');
  return best;
}
