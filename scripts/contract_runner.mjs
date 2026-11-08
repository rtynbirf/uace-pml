#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * П54 · КОНТРАКТ-СНАПШОТЫ 36 ДОМЕНОВ — раннер (issue uace-pml#5, волна ×4)
 * ----------------------------------------------------------------------------
 * Что это: CI-гейт, который на фиксированных HTML-фикстурах (contracts/fixtures/)
 * прогоняет РЕАЛЬНЫЙ код платформенных адаптеров userscript (scripts/v29/
 * p1..p4: PLATFORMS + findMessages + extractRoleRaw + textOf + makeChatDocument)
 * и сверяет результат с JSON-schema контракта экспорта (ChatDocument/29) и со
 * снапшотом expected.json. Домен меняет вёрстку → адаптер промахивается →
 * красный гейт с ТОЧНЫМ именем платформы.
 *
 * Принципы:
 *  - без внешних зависимостей (stdlib Node): свой мини-DOM + мини-валидатор
 *    JSON Schema (подмножество draft-07, достаточное для этого контракта);
 *  - контракт пинит ПЛАТФОРМЕННЫЕ селекторы: generic/структурные фолбэки
 *    findMessages отключены (GENERIC_MSG_SELS обнуляется в песочнице) —
 *    сломанный адаптер = красный, даже если generic-стратегия «спасает»;
 *  - тесты на геометрию браузера в контракт не входят: в песочнице
 *    getBoundingClientRect/getComputedStyle — константная честная среда
 *    (все элементы «видимы»), это часть среды фикстуры, не домена;
 *  - детерминизм: capturedAt не входит в снапшот; двойной прогон идентичен.
 *
 * Запуск:
 *   node scripts/contract_runner.mjs              # все 36 доменов, rc=0/1
 *   node scripts/contract_runner.mjs --selftest   # 5 проверок каркаса
 *   node scripts/contract_runner.mjs --freeze     # переписать expected.json
 * ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const FIXTURES = path.join(ROOT, 'contracts', 'fixtures');
const NEGATIVE = path.join(ROOT, 'contracts', 'negative');
const SCHEMA_PATH = path.join(ROOT, 'contracts', 'schema', 'chatdocument.schema.json');
const P1 = path.join(ROOT, 'scripts', 'v29', 'p1_header_core.js');
const P2 = path.join(ROOT, 'scripts', 'v29', 'p2_runtime_evidence.js');
const P3 = path.join(ROOT, 'scripts', 'v29', 'p3_platforms.js');
const P4 = path.join(ROOT, 'scripts', 'v29', 'p4_capture_storage.js');

/* ─────────────────────────── мини-DOM (фикстуры) ─────────────────────────── */
const VOID_TAGS = new Set(['meta', 'link', 'br', 'hr', 'img', 'input', 'base', 'source', 'wbr', 'col', 'area']);
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = s => String(s || '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTITIES['&' + e]);

class El {
  constructor(tag) {
    this.nodeType = 1; this.tagName = String(tag).toUpperCase();
    this.attrs = {}; this.childNodes = []; this.parentNode = null; this.shadowRoot = null;
  }
  get className() { return this.attrs['class'] || ''; }
  get id() { return this.attrs['id'] || ''; }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get childElementCount() { return this.children.length; }
  get parentElement() { const p = this.parentNode; return p && p.nodeType === 1 ? p : null; }
  get isConnected() { return true; }
  getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; }
  get textContent() { return this.childNodes.map(n => (n.nodeType === 3 ? n.text : n.textContent)).join(''); }
  get innerText() { return this.textContent; }
  getBoundingClientRect() { return { width: 400, height: 80, top: 0, left: 0, right: 400, bottom: 80, x: 0, y: 0 }; }
  contains(other) { for (let p = other; p; p = p.parentNode) if (p === this) return true; return false; }
  closest(sel) { for (let p = this; p; p = p.parentElement) { try { if (matchesCompoundGroup(p, sel)) return p; } catch (e) { return null; } } return null; }
  querySelectorAll(sel) { return qsaUnder(this, sel); }
}
const textNode = t => ({ nodeType: 3, text: t, parentNode: null });

function parseHtml(src) {
  const root = new El('html');
  let cur = root, i = 0, buf = '';
  const flush = () => { if (buf) { const n = textNode(decode(buf)); n.parentNode = cur; cur.childNodes.push(n); buf = ''; } };
  while (i < src.length) {
    if (src.startsWith('<!--', i)) { flush(); const e = src.indexOf('-->', i); i = e < 0 ? src.length : e + 3; continue; }
    if (src.startsWith('<', i) && /[a-zA-Z!/]/.test(src[i + 1] || '')) {
      flush();
      if (src.startsWith('<!', i)) { const e = src.indexOf('>', i); i = e < 0 ? src.length : e + 1; continue; }
      const close = src.startsWith('</', i);
      const e = src.indexOf('>', i); if (e < 0) break;
      const raw = src.slice(close ? i + 2 : i + 1, e).trim();
      const name = (raw.match(/^[a-zA-Z][-\w]*/) || [''])[0].toLowerCase();
      if (!name) { i = e + 1; continue; }
      if (close) {
        let p = cur;
        while (p && p.tagName !== name.toUpperCase()) p = p.parentNode;
        if (p) cur = p.parentNode && p.parentNode.nodeType === 1 ? p.parentNode : root;
        i = e + 1; continue;
      }
      const el = new El(name);
      const attrRe = /([-\w]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let m, rest = raw.slice(name.length);
      while ((m = attrRe.exec(rest))) el.attrs[m[1].toLowerCase()] = decode(m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] != null ? m[5] : '');
      el.parentNode = cur; cur.childNodes.push(el);
      const selfClosed = /\/\s*$/.test(raw);
      if (!selfClosed && !VOID_TAGS.has(name)) cur = el;
      i = e + 1; continue;
    }
    buf += src[i++];
  }
  flush();
  return root;
}

/* ── мини-движок CSS-селекторов (подмножество, которого хватит адаптерам) ── */
function splitTop(s, sep) { /* split по sep вне скобок/кавычек */
  const out = []; let depth = 0, q = null, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === sep && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start)); return out;
}
function parseCompound(s) {
  const p = { tag: null, id: null, classes: [], attrs: [], nots: [] };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '*') { i++; }
    else if (c === '#') { let j = i + 1; while (j < s.length && /[-\w]/.test(s[j])) j++; p.id = s.slice(i + 1, j); i = j; }
    else if (c === '.') { let j = i + 1; while (j < s.length && /[-\w]/.test(s[j])) j++; p.classes.push(s.slice(i + 1, j)); i = j; }
    else if (c === '[') {
      let j = i + 1, q = null, depth = 1;
      while (j < s.length) { const ch = s[j]; if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '[') depth++; else if (ch === ']') { depth--; if (!depth) break; } j++; }
      const inner = s.slice(i + 1, j); i = j + 1;
      const mm = /^([-\w]+)\s*(?:([*$^|~]?=)\s*("([^"]*)"|'([^']*)'|([^\]]*?)))?\s*(i)?\s*$/.exec(inner.trim());
      if (!mm) throw new Error('attr-selector: [' + inner + ']');
      p.attrs.push({ name: mm[1].toLowerCase(), op: mm[2] || null, value: mm[4] != null ? mm[4] : mm[5] != null ? mm[5] : mm[6] != null ? mm[6].trim() : null, ci: !!mm[7] });
    }
    else if (s.startsWith(':not(', i)) {
      let j = i + 5, depth = 1; while (j < s.length) { if (s[j] === '(') depth++; else if (s[j] === ')') { depth--; if (!depth) break; } j++; }
      p.nots.push(parseCompound(s.slice(i + 5, j))); i = j + 1;
    }
    else if (/[a-zA-Z]/.test(c)) { let j = i; while (j < s.length && /[-\w]/.test(s[j])) j++; p.tag = s.slice(i, j).toUpperCase(); i = j; }
    else i++;
  }
  return p;
}
function matchAttr(el, a) {
  const v = el.getAttribute(a.name); if (v == null) return false;
  if (a.op == null) return true;
  const val = a.ci ? String(v).toLowerCase() : String(v);
  const t = a.ci ? String(a.value).toLowerCase() : String(a.value);
  if (a.op === '=') return val === t;
  if (a.op === '*=') return val.includes(t);
  if (a.op === '^=') return val.startsWith(t);
  if (a.op === '$=') return val.endsWith(t);
  if (a.op === '~=') return val.split(/\s+/).includes(t);
  if (a.op === '|=') return val === t || val.startsWith(t + '-');
  return false;
}
function matchOne(el, p) {
  if (p.tag && el.tagName !== p.tag) return false;
  if (p.id && el.id !== p.id) return false;
  const cls = String(el.className || '').split(/\s+/);
  for (const c of p.classes) if (!cls.includes(c)) return false;
  for (const a of p.attrs) if (!matchAttr(el, a)) return false;
  for (const n of p.nots) if (matchOne(el, n)) return false;
  return true;
}
function matchesCompoundGroup(el, group) { return splitTop(group, ',').some(part => matchOne(el, parseCompound(part.trim()))); }
function walk(root, cb) { for (const n of root.childNodes) { if (n.nodeType === 1) { cb(n); walk(n, cb); } } }
function qsaUnder(root, sel) {
  const out = [];
  try { walk(root, el => { try { if (matchesCompoundGroup(el, sel)) out.push(el); } catch (e) { /* неизвестный селектор = 0 совпадений */ } }); } catch (e) { /* noop */ }
  return out;
}

/* ──────────────── песочница: РЕАЛЬНЫЙ код p1..p4 в функции ──────────────── */
function loadCore() {
  const src = fs.readFileSync(P1, 'utf8');
  /* p1 открывает IIFE всего юзерскрипта (закрывается в p6) — для Node-вызова
     закрываем скобку сами: при отсутствии document/window IIFE выходит сразу
     после экспорта __UACE29__ (канон L0-ядра, «файл заканчивается здесь»). */
  const fn = new Function(src + '\n})();\n;return globalThis.__UACE29__ || null;');
  const core = fn();
  if (!core) throw new Error('p1: __UACE29__ не экспортирован');
  return core;
}

const PRELUDE = `'use strict';
const journal = CORE.journal, mkEv = CORE.mkEv, ROLE_LEVELS = CORE.ROLE_LEVELS,
      roleFromValue = CORE.roleFromValue, scoreCandidates = CORE.scoreCandidates,
      SCORE_THRESHOLD = CORE.SCORE_THRESHOLD, dedupeNested = CORE.dedupeNested,
      fnv1a32 = CORE.fnv1a32, fnv1aHex = CORE.fnv1aHex, sigHashOf = CORE.sigHashOf,
      makeChatDocument = CORE.makeChatDocument;
const round2 = v => Math.round(v * 100) / 100;
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* Контракт пинит именно адаптер домена: структурная стратегия (resilience-фолбэк
   по вырожденным сигнатурам фикстур) отключена броском из sigOfEl — findMessages
   глотает её в try/catch, остаются ТОЛЬКО платформенные селекторы. */
const sigOfEl = () => { throw new Error('structural disabled in contract runner'); };
`;
const EPILOGUE = `
;GENERIC_MSG_SELS.length = 0; /* контракт пинит ПЛАТФОРМЕННЫЕ селекторы: generic-фолбэк отключён */
globalThis.__UACE_CONTRACT__ = { getPlatform, findMessages, extractRoleRaw, chatIdFrom, PLATFORMS, textOf };
`;

function loadRuntime(core, docStub, locStub) {
  const src = PRELUDE
    + fs.readFileSync(P2, 'utf8') + '\n'
    + fs.readFileSync(P3, 'utf8') + '\n'
    + fs.readFileSync(P4, 'utf8') + '\n'
    + EPILOGUE;
  const fn = new Function('CORE', 'document', 'location', 'NodeFilter', 'getComputedStyle', 'localStorage', src);
  fn(core, docStub, locStub, { SHOW_ELEMENT: 1 }, () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  return globalThis.__UACE_CONTRACT__;
}

function buildStubs(html) {
  const root = parseHtml(html);
  const findFirst = tag => { let r = null; walk(root, el => { if (!r && el.tagName === tag) r = el; }); return r; };
  const metaEl = findFirst('META') && (() => { let r = null; walk(root, el => { if (!r && el.tagName === 'META' && el.attrs['name'] === 'uace-fixture') r = el; }); return r; })();
  const meta = {};
  for (const kv of String((metaEl && metaEl.attrs['content']) || '').split(';')) {
    const idx = kv.indexOf('='); if (idx > 0) meta[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
  }
  const titleEl = findFirst('TITLE');
  const title = (titleEl ? titleEl.textContent : '').trim();
  const host = meta.host || 'fixture.invalid', pathname = meta.path || '/';
  const href = 'https://' + host + pathname;
  const location = { host, hostname: host, pathname, href, origin: 'https://' + host, search: '', hash: '' };
  const document = {
    documentElement: root,
    body: findFirst('BODY') || root,
    title,
    readyState: 'complete',
    querySelectorAll: sel => qsaUnder(root, sel),
    querySelector: sel => qsaUnder(root, sel)[0] || null,
    createTreeWalker: () => ({ currentNode: root, nextNode: () => null })
  };
  return { document, location, meta };
}

/* ───────────────── мини-валидатор JSON Schema (подмножество) ─────────────── */
function validateSchema(inst, schema, root, out, pathStr) {
  root = root || schema; out = out || []; pathStr = pathStr || '$';
  const err = msg => out.push(pathStr + ': ' + msg);
  if (schema.$ref) {
    const target = schema.$ref.split('/').slice(1).reduce((acc, k) => acc && acc[k], root);
    if (!target) { err('неразрешимый $ref ' + schema.$ref); return out; }
    return validateSchema(inst, target, root, out, pathStr);
  }
  if (schema.const !== undefined && JSON.stringify(inst) !== JSON.stringify(schema.const)) err('ожидался const ' + JSON.stringify(schema.const) + ', получено ' + JSON.stringify(inst));
  if (schema.enum && !schema.enum.some(v => JSON.stringify(v) === JSON.stringify(inst))) err('вне enum: ' + JSON.stringify(inst));
  const t = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : null;
  if (t) {
    const actual = inst === null ? 'null' : Array.isArray(inst) ? 'array' : typeof inst === 'number' ? (Number.isInteger(inst) ? 'integer' : 'number') : typeof inst;
    if (!t.includes(actual) && !(t.includes('number') && actual === 'integer')) err('тип: ожидался ' + t.join('|') + ', получено ' + actual);
  }
  if (typeof inst === 'string') {
    if (schema.minLength != null && inst.length < schema.minLength) err('длина < ' + schema.minLength);
    if (schema.pattern && !new RegExp(schema.pattern).test(inst)) err('не матчится pattern ' + schema.pattern);
    if (schema.format === 'date-time' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(inst)) err('не date-time: ' + inst);
  }
  if (typeof inst === 'number') {
    if (schema.minimum != null && inst < schema.minimum) err('< minimum ' + schema.minimum);
    if (schema.maximum != null && inst > schema.maximum) err('> maximum ' + schema.maximum);
  }
  if (Array.isArray(inst)) {
    if (schema.minItems != null && inst.length < schema.minItems) err('массив < ' + schema.minItems + ' элементов');
    if (schema.maxItems != null && inst.length > schema.maxItems) err('массив > ' + schema.maxItems + ' элементов');
    if (schema.items) inst.forEach((it, i) => validateSchema(it, schema.items, root, out, pathStr + '[' + i + ']'));
  }
  if (inst && typeof inst === 'object' && !Array.isArray(inst)) {
    for (const r of schema.required || []) if (!(r in inst)) err('нет required-поля «' + r + '»');
    for (const [k, sub] of Object.entries(schema.properties || {})) if (k in inst) validateSchema(inst[k], sub, root, out, pathStr + '.' + k);
  }
  return out;
}

/* ─────────────────────────── извлечение по фикстуре ─────────────────────── */
const CORE = loadCore();
const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

async function extractFixture(fixturePath) {
  const html = fs.readFileSync(fixturePath, 'utf8');
  const { document, location } = buildStubs(html);
  const api = loadRuntime(CORE, document, location);
  const platform = api.getPlatform();
  if (!platform) return { ok: false, platform: null, reason: 'платформа не распознана по host/path фикстуры' };
  const url = location.href;
  const chatId = api.chatIdFrom(platform, url);
  const found = await api.findMessages(platform);
  if (!found || !found.els || found.els.length < 2) {
    return { ok: false, platform: platform.name, reason: 'findMessages: платформенные селекторы не нашли ≥2 валидных сообщений (молчаливая смена вёрстки?)' };
  }
  const messages = [];
  for (const el of found.els) {
    const re = api.extractRoleRaw(el, platform);
    messages.push({ role: re.role, method: re.evidence.method, confidence: re.evidence.confidence, reason: re.evidence.reason, text: api.textOf(el) });
  }
  const title = String(document.title || '').replace(/\s*[\|\-–·]\s*[^|\-–·]*$/, '').trim().slice(0, 200) || 'Без названия';
  const cd = CORE.makeChatDocument({
    platform: platform.name, origin: location.origin, url, title,
    captureMode: 'structured', captureEvidence: found.captureEvidence,
    messages: messages.map(m => ({ role: m.role, roleEvidence: { method: m.method, confidence: m.confidence, reason: m.reason }, text: m.text })),
    warnings: []
  });
  const schemaErrors = validateSchema(cd, SCHEMA);
  const projection = {
    platform: cd.platform, chatId,
    messages: cd.messages.map(m => ({ role: m.role, method: m.roleEvidence.method, confidence: m.roleEvidence.confidence, text: m.text }))
  };
  return { ok: schemaErrors.length === 0, platform: platform.name, chatId, messages, chatDocument: cd, projection, schemaErrors, found };
}

function compareWithExpected(res, expected) {
  const diffs = [];
  if (res.platform !== expected.platform) diffs.push('платформа: ' + res.platform + ' ≠ ' + expected.platform);
  if ((res.chatId || null) !== (expected.chatId || null)) diffs.push('chatId: ' + (res.chatId || null) + ' ≠ ' + (expected.chatId || null));
  const exp = (expected.messages || []).map(m => JSON.stringify([m.role, m.method, m.confidence, m.text]));
  const act = (res.projection ? res.projection.messages : (res.messages || []).map(m => [m.role, m.method, m.confidence, m.text])).map(m => Array.isArray(m) ? JSON.stringify(m) : JSON.stringify([m.role, m.method, m.confidence, m.text]));
  if (exp.length !== act.length) diffs.push('число сообщений: ' + act.length + ' ≠ ' + exp.length);
  else for (let i = 0; i < exp.length; i++) if (exp[i] !== act[i]) diffs.push('сообщение #' + i + ': ' + act[i] + ' ≠ ' + exp[i]);
  return diffs;
}

function fixtureDirs() {
  return fs.readdirSync(FIXTURES).filter(d => /^(\d+)-/.test(d) && fs.statSync(path.join(FIXTURES, d)).isDirectory()).sort();
}
const expectedPath = d => path.join(FIXTURES, d, 'expected.json');
const fixturePathOf = d => path.join(FIXTURES, d, 'fixture.html');

async function runAll() {
  const dirs = fixtureDirs();
  let pass = 0; const failures = [];
  const lines = [];
  for (const d of dirs) {
    let res, errs = [];
    try { res = await extractFixture(fixturePathOf(d)); } catch (e) { res = { ok: false, platform: null }; errs.push('исключение: ' + (e && e.message || e)); }
    const expected = JSON.parse(fs.readFileSync(expectedPath(d), 'utf8'));
    if (res.ok) errs.push(...res.schemaErrors.map(s => 'schema ' + s));
    if (res.ok) errs.push(...compareWithExpected(res, expected));
    if (!errs.length) {
      pass++;
      lines.push('PASS  ' + d.padEnd(24) + ' ' + String(res.platform).padEnd(20) + ' ' + res.messages.length + ' сообщ. · ' + res.messages[0].method);
    } else {
      failures.push({ dir: d, platform: res.platform || expected.platform, errs });
      lines.push('FAIL  ' + d.padEnd(24) + ' ' + String(res.platform || expected.platform).padEnd(20) + ' ' + errs.join(' | '));
    }
  }
  return { dirs, pass, failures, lines };
}

/* ─────────────────────────────── selftest ───────────────────────────────── */
async function selftest() {
  let pass = 0, fail = 0, total = 0;
  const t = (cond, name) => { total++; if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name); } };

  /* 1. реестр платформ: ровно 36, имена = expected.json фикстур */
  const stub = buildStubs('<html><head><meta name="uace-fixture" content="host=fixture.invalid;path=/;"></head><body><main></main></body></html>');
  const api = loadRuntime(CORE, stub.document, stub.location);
  const dirs = fixtureDirs();
  const namesFromRegistry = api.PLATFORMS.map(p => p.name);
  const namesFromExpected = dirs.map(d => JSON.parse(fs.readFileSync(expectedPath(d), 'utf8')).platform);
  t(api.PLATFORMS.length === 36, 'реестр PLATFORMS: ровно 36 адаптеров (есть ' + api.PLATFORMS.length + ')');
  t(dirs.length === 36 && JSON.stringify(namesFromRegistry) === JSON.stringify(namesFromExpected),
    '36 фикстур ↔ 36 имён реестра, порядок совпадает');

  /* 2. все 36 доменов зелёные */
  const run = await runAll();
  t(run.failures.length === 0 && run.pass === 36, 'контракт-снапшоты 36/36 зелёные (упало: ' + run.failures.map(f => f.platform).join(', ') + ')');

  /* 3. намеренно поломанная фикстура (коммит) → красный с именем домена */
  const negPath = path.join(NEGATIVE, 'ChatGPT-broken.html');
  let neg = { ok: true, platform: null };
  try { neg = await extractFixture(negPath); } catch (e) { neg = { ok: false, platform: 'ChatGPT', reason: 'исключение: ' + (e && e.message || e) }; }
  t(neg.ok === false && neg.platform === 'ChatGPT',
    'негативная фикстура ChatGPT-broken → красный с именем домена (' + (neg.reason || 'перестроено') + ')');

  /* 4. мутация на живом фикстуре: смена имени атрибута роли ловится */
  const good = fs.readFileSync(fixturePathOf(dirs[0]), 'utf8');
  const broken = good.replace(/data-message-author-role/g, 'data-msg-author-role');
  const tmp = path.join(NEGATIVE, '_tmp-mutation.html');
  fs.writeFileSync(tmp, broken);
  let mut = { ok: true };
  try { mut = await extractFixture(tmp); } catch (e) { mut = { ok: false }; }
  fs.unlinkSync(tmp);
  t(mut.ok === false, 'мутация атрибута роли в фикстуре ChatGPT → красный (поломка ловится)');

  /* 5. детерминизм: двойной прогон идентичен */
  const a = JSON.stringify((await extractFixture(fixturePathOf(dirs[0]))).projection);
  const b = JSON.stringify((await extractFixture(fixturePathOf(dirs[0]))).projection);
  t(a === b, 'двойной прогон фикстуры байт-в-байт идентичен (capturedAt вне снапшота)');

  console.log('# Result: ' + pass + ' passed, ' + fail + ' failed (of ' + total + ')');
  console.log(fail === 0 ? '# SELFTEST GREEN' : '# SELFTEST RED');
  return fail === 0;
}

/* ──────────────────────────────── CLI ───────────────────────────────────── */
const argv = new Set(process.argv.slice(2));
if (argv.has('--freeze')) {
  /* переписать expected.json по фактическому извлечению (сначала заморозка, потом проверки) */
  for (const d of fixtureDirs()) {
    const res = await extractFixture(fixturePathOf(d));
    if (!res.ok) { console.error('FREEZE FAIL ' + d + ': ' + (res.reason || (res.schemaErrors || []).join('; '))); process.exit(2); }
    const expected = { platform: res.platform, chatId: res.chatId || null, messages: res.messages.map(m => ({ role: m.role, method: m.method, confidence: m.confidence, text: m.text })) };
    fs.writeFileSync(expectedPath(d), JSON.stringify(expected, null, 2) + '\n');
    console.log('FROZE ' + d.padEnd(24) + ' ' + res.platform.padEnd(20) + ' ' + res.messages.length + ' сообщ. · ' + res.messages[0].method);
  }
  console.log('# expected.json переписан по фактическому извлечению (--freeze)');
}
if (argv.has('--selftest')) {
  const ok = await selftest();
  process.exit(ok ? 0 : 2);
}
console.log('П54 · контракт-снапшоты 36 доменов — schema ' + SCHEMA.schemaVersion + ' (ChatDocument/29)');
const run = await runAll();
for (const line of run.lines) console.log(line);
console.log('# Result: ' + run.pass + ' passed, ' + run.failures.length + ' failed (of ' + run.dirs.length + ')');
if (run.failures.length) {
  console.log('# КРАСНЫЙ ГЕЙТ — домены со сломанным контрактом: ' + run.failures.map(f => f.platform).join(', '));
  process.exit(1);
}
process.exit(0);
