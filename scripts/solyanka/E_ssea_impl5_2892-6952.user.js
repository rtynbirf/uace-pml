// ==SSEA-2026 v1.0 — ssea-1==
// SELFCHECK: 1-10 OK
// ==UserScript==
// @name         SSEA-2026
// @namespace    ssea-2026
// @version      1.0.0
// @description  Site Structure & Environment Auditor — пассивный аудитор структуры страницы и среды
// @author       LLM-agent
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  try { if (window.top !== window.self) return; } catch (_) { return; }

  // ============================================================
  // ПРИЛОЖЕНИЕ B. КОНСТАНТЫ
  // ============================================================
  const MAX_NODES = 20000;
  const MAX_DEPTH = 40;
  const SAMPLE_PAIRS = 5000;
  const PALETTE_K = 16;
  const LAYERS_LIMIT = 200;
  const BLOCKS_LIMIT = 60;
  const RULES_LIMIT = 8000;
  const MEDIA_LIMIT = 100;
  const INPUTS_LIMIT = 300;
  const WALK_BUDGET_MS = 300;
  const REPORTS_KEEP = 50;
  const STORAGE_MAX = 5242880;
  const OVERLAY_PCT = 30;
  const BLOCK_MIN_PCT = 10;
  const UI_ID = 'ssea-2026';
  const PREFIX = 'ssea_';
  const DB_NAME = 'ssea-db';
  const DB_STORE = 'reports';

  // ============================================================
  // 0. СОСТОЯНИЕ И УТИЛИТЫ
  // ============================================================
  const state = {
    mode: 'full',
    auto: true,
    theme: 'AUTO',
    fontSize: 16,
    gpu: false,
    lastReport: null,
    apiAvail: {},
    bootTime: Date.now()
  };

  function safe(fn, fb) {
    try { return fn(); } catch (_) { return fb === undefined ? null : fb; }
  }
  function availOf(name, val) {
    state.apiAvail[name] = (val === null || val === undefined) ? false : true;
    return val;
  }
  function mm(q) {
    return safe(() => window.matchMedia(q).matches ? 'match' : 'no-match', null);
  }
  function has(q) {
    return safe(() => window.matchMedia(q).matches, null);
  }
  function readLS(k, fb) {
    return safe(() => {
      const v = window.localStorage.getItem(PREFIX + k);
      return v === null ? fb : v;
    }, fb);
  }
  function writeLS(k, v) {
    safe(() => window.localStorage.setItem(PREFIX + k, String(v)));
  }
  function delLS(k) { safe(() => window.localStorage.removeItem(PREFIX + k)); }

  function fnv1a64(s) {
    let h = 0xcbf29ce484222325n;
    const p = 0x100000001b3n;
    const msk = 0xFFFFFFFFFFFFFFFFn;
    for (let i = 0; i < s.length; i++) {
      h = (h ^ BigInt(s.charCodeAt(i))) & msk;
      h = (h * p) & msk;
    }
    return h.toString(16).padStart(16, '0');
  }
  function siteSalt() {
    const k = PREFIX + 'salt';
    let s = readLS('salt', null);
    if (!s) {
      s = 'k' + String(Date.now()) + '_' + String(Math.floor(performance.now() * 1000));
      writeLS('salt', s);
    }
    return s;
  }
  function anonTok(t) { return fnv1a64(siteSalt() + '|' + t).slice(0, 10); }
  function tokName(t) { return state.mode === 'anon' ? anonTok(t) : String(t); }

  // color utilities
  function parseColor(s) {
    if (s === null || s === undefined || s === '') return null;
    s = String(s).trim().toLowerCase();
    if (s === 'transparent') return [0, 0, 0, 0];
    if (s === 'currentcolor' || s === 'inherit' || s === 'initial') return null;
    let m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[,\s\/]+/).filter(Boolean);
      const r = parseFloat(p[0]), g = parseFloat(p[1]), b = parseFloat(p[2]);
      const a = p[3] !== undefined ? parseFloat(p[3]) : 1;
      if ([r, g, b].some(isNaN)) return null;
      return [r | 0, g | 0, b | 0, isNaN(a) ? 1 : a];
    }
    m = s.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      if (h.length === 4) h = h.split('').map(c => c + c).join('');
      if (h.length === 6 || h.length === 8) {
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
        return [r, g, b, a];
      }
    }
    return null;
  }
  function hex2(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'); }
  function rgbToHex(r, g, b) { return '#' + hex2(r) + hex2(g) + hex2(b); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function linCh(c) { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
  function relLum(rgb) {
    return 0.2126 * linCh(rgb[0]) + 0.7152 * linCh(rgb[1]) + 0.0722 * linCh(rgb[2]);
  }
  function contrastRatio(fg, bg) {
    const L1 = relLum(fg), L2 = relLum(bg);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function blendOver(fg, bg) {
    const a = fg[3] === undefined ? 1 : fg[3];
    return [
      Math.round(fg[0] * a + bg[0] * (1 - a)),
      Math.round(fg[1] * a + bg[1] * (1 - a)),
      Math.round(fg[2] * a + bg[2] * (1 - a)),
      1
    ];
  }
  function bucketAlpha(a) { return Math.round(a * 20) / 20; }
  function tplEscape(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function nowMs() { return performance.now(); }
  function isoUtc(d) {
    const t = d || new Date();
    return t.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  function pct(part, whole) { return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0; }

  // ============================================================
  // ХРАНИЛИЩЕ (IndexedDB + fallback localStorage)
  // ============================================================
  const Store = (function () {
    let db = null;
    let ready = null;
    function open() {
      if (ready) return ready;
      ready = new Promise((resolve) => {
        if (!('indexedDB' in window)) { resolve(null); return; }
        try {
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = () => {
            const d = req.result;
            if (!d.objectStoreNames.contains(DB_STORE)) {
              d.createObjectStore(DB_STORE, { keyPath: 'id' });
            }
          };
          req.onsuccess = () => { db = req.result; resolve(db); };
          req.onerror = () => resolve(null);
        } catch (_) { resolve(null); }
      });
      return ready;
    }
    function lsKey() { return PREFIX + 'reports'; }
    function lsRead() {
      return safe(() => JSON.parse(window.localStorage.getItem(lsKey()) || '[]'), []);
    }
    function lsWrite(arr) {
      safe(() => window.localStorage.setItem(lsKey(), JSON.stringify(arr)));
    }
    async function put(rec) {
      const d = await open();
      if (d) {
        try {
          await new Promise((res, rej) => {
            const tx = d.transaction(DB_STORE, 'readwrite');
            const st = tx.objectStore(DB_STORE);
            st.put(rec);
            tx.oncomplete = res;
            tx.onerror = () => rej(tx.error);
          });
        } catch (_) {}
      } else {
        const arr = lsRead();
        arr.push(rec);
        while (arr.length > REPORTS_KEEP) arr.shift();
        lsWrite(arr);
      }
      await prune();
    }
    async function prune() {
      const all = await list();
      if (all.length <= REPORTS_KEEP) return;
      const sorted = all.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const drop = sorted.slice(0, all.length - REPORTS_KEEP);
      for (const d of drop) await remove(d.id);
    }
    async function list() {
      const d = await open();
      if (d) {
        try {
          return await new Promise((res) => {
            const tx = d.transaction(DB_STORE, 'readonly');
            const st = tx.objectStore(DB_STORE);
            const r = st.getAll();
            r.onsuccess = () => res(r.result || []);
            r.onerror = () => res([]);
          });
        } catch (_) { return []; }
      }
      return lsRead();
    }
    async function get(id) {
      const d = await open();
      if (d) {
        try {
          return await new Promise((res) => {
            const tx = d.transaction(DB_STORE, 'readonly');
            const st = tx.objectStore(DB_STORE);
            const r = st.get(id);
            r.onsuccess = () => res(r.result || null);
            r.onerror = () => res(null);
          });
        } catch (_) { return null; }
      }
      return lsRead().find(x => x.id === id) || null;
    }
    async function remove(id) {
      const d = await open();
      if (d) {
        try {
          await new Promise((res) => {
            const tx = d.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).delete(id);
            tx.oncomplete = res;
            tx.onerror = res;
          });
        } catch (_) {}
      } else {
        const arr = lsRead().filter(x => x.id !== id);
        lsWrite(arr);
      }
    }
    async function clearAll() {
      const d = await open();
      if (d) {
        try {
          await new Promise((res) => {
            const tx = d.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).clear();
            tx.oncomplete = res;
            tx.onerror = res;
          });
        } catch (_) {}
      }
      safe(() => window.localStorage.removeItem(lsKey()));
    }
    return { put, list, get, remove, clearAll };
  })();

  // ============================================================
  // 3. ПЛОСКОСТЬ A — СРЕДА
  // ============================================================
  function collectEnv() {
    const env = {
      client: {
        ua: safe(() => navigator.userAgent, ''),
        brands: safe(() => (navigator.userAgentData && navigator.userAgentData.brands) ? navigator.userAgentData.brands.map(b => [b.brand, b.version]) : [], []),
        platform: safe(() => navigator.userAgentData ? navigator.userAgentData.platform : (navigator.platform || ''), ''),
        mobile: safe(() => navigator.userAgentData ? navigator.userAgentData.mobile : null, null),
        architecture: null, bitness: null, platformVersion: null, model: null, uaFullVersion: null
      },
      locale: {
        language: safe(() => navigator.language, ''),
        languages: safe(() => (navigator.languages || []).slice(), []),
        timeZone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone, ''),
        utcOffsetMin: safe(() => -new Date().getTimezoneOffset(), 0)
      },
      hw: {
        cores: safe(() => navigator.hardwareConcurrency, null),
        deviceMemoryGB: safe(() => navigator.deviceMemory, null),
        maxTouchPoints: safe(() => navigator.maxTouchPoints, 0)
      },
      screen: {
        w: safe(() => screen.width, 0),
        h: safe(() => screen.height, 0),
        availW: safe(() => screen.availWidth, 0),
        availH: safe(() => screen.availHeight, 0),
        colorDepth: safe(() => screen.colorDepth, 0),
        pixelDepth: safe(() => screen.pixelDepth, 0),
        dpr: safe(() => window.devicePixelRatio, 1),
        orientation: safe(() => (screen.orientation && screen.orientation.type) || '', ''),
        orientAngle: safe(() => (screen.orientation && screen.orientation.angle) || 0, 0),
        isExtended: safe(() => screen.isExtended, null),
        viewport: { w: safe(() => window.innerWidth, 0), h: safe(() => window.innerHeight, 0) },
        outer: { w: safe(() => window.outerWidth, 0), h: safe(() => window.outerHeight, 0) },
        visualViewport: {
          w: safe(() => (window.visualViewport && window.visualViewport.width) || null, null),
          h: safe(() => (window.visualViewport && window.visualViewport.height) || null, null),
          scale: safe(() => (window.visualViewport && window.visualViewport.scale) || 1, 1),
          offsetTop: safe(() => (window.visualViewport && window.visualViewport.offsetTop) || 0, 0),
          offsetLeft: safe(() => (window.visualViewport && window.visualViewport.offsetLeft) || 0, 0)
        }
      },
      color: {
        gamut: mm('(color-gamut: rec2020)') === 'match' ? 'rec2020' : (mm('(color-gamut: p3)') === 'match' ? 'p3' : (mm('(color-gamut: srgb)') === 'match' ? 'srgb' : '')),
        dynamicRange: mm('(dynamic-range: high)') === 'match' ? 'high' : 'standard',
        videoDynamicRange: mm('(video-dynamic-range: high)') === 'match' ? 'high' : 'standard',
        monochrome: safe(() => { const r = window.matchMedia('(monochrome)'); return r.matches; }, null),
        forcedColors: mm('(forced-colors: active)'),
        invertedColors: mm('(inverted-colors: inverted)'),
        prefersColorScheme: mm('(prefers-color-scheme: dark)') === 'match' ? 'dark' : 'light',
        prefersContrast: mm('(prefers-contrast: more)') === 'match' ? 'more' : (mm('(prefers-contrast: less)') === 'match' ? 'less' : (mm('(prefers-contrast: custom)') === 'match' ? 'custom' : 'no-preference')),
        prefersReducedMotion: mm('(prefers-reduced-motion: reduce)'),
        prefersReducedTransparency: mm('(prefers-reduced-transparency: reduce)'),
        prefersReducedData: mm('(prefers-reduced-data: reduce)')
      },
      input: {
        pointer: mm('(pointer: fine)') === 'match' ? 'fine' : (mm('(pointer: coarse)') === 'match' ? 'coarse' : (mm('(pointer: none)') === 'match' ? 'none' : '')),
        anyPointer: mm('(any-pointer: fine)') === 'match' ? 'fine' : (mm('(any-pointer: coarse)') === 'match' ? 'coarse' : (mm('(any-pointer: none)') === 'match' ? 'none' : '')),
        hover: mm('(hover: hover)') === 'match' ? 'hover' : (mm('(hover: none)') === 'match' ? 'none' : ''),
        anyHover: mm('(any-hover: hover)') === 'match' ? 'hover' : (mm('(any-hover: none)') === 'match' ? 'none' : ''),
        update: mm('(update: fast)') === 'match' ? 'fast' : (mm('(update: slow)') === 'match' ? 'slow' : (mm('(update: none)') === 'match' ? 'none' : ''))
      },
      gpu: { enabled: !!state.gpu, vendor: null, renderer: null, maxTextureSize: null, webgpu: null },
      net: {
        effectiveType: safe(() => navigator.connection ? navigator.connection.effectiveType : null, null),
        downlinkMbps: safe(() => navigator.connection ? navigator.connection.downlink : null, null),
        rttMs: safe(() => navigator.connection ? navigator.connection.rtt : null, null),
        saveData: safe(() => navigator.connection ? navigator.connection.saveData : null, null)
      },
      storage: {
        ls: safe(() => { window.localStorage.setItem(PREFIX + '_probe', '1'); window.localStorage.removeItem(PREFIX + '_probe'); return true; }, false),
        idb: ('indexedDB' in window),
        usageBytes: null, quotaBytes: null
      },
      perf: {
        jsHeapUsedMB: safe(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, null),
        jsHeapTotalMB: safe(() => performance.memory ? Math.round(performance.memory.totalJSHeapSize / 1048576) : null, null)
      },
      doc: {
        compatMode: safe(() => document.compatMode, ''),
        charset: safe(() => document.characterSet, ''),
        contentType: safe(() => document.contentType, ''),
        historyLen: safe(() => history.length, 1),
        hasFocus: safe(() => document.hasFocus(), null)
      }
    };
    return env;
  }

  async function collectEnvAsync(env) {
    // high-entropy
    const uaData = safe(() => navigator.userAgentData, null);
    if (uaData && typeof uaData.getHighEntropyValues === 'function') {
      try {
        const h = await Promise.race([
          uaData.getHighEntropyValues(['architecture', 'bitness', 'model', 'platformVersion', 'uaFullVersion']),
          new Promise((_, rej) => setTimeout(() => rej(new Error('to')), 1500))
        ]);
        env.client.architecture = h.architecture || null;
        env.client.bitness = h.bitness || null;
        env.client.model = h.model || null;
        env.client.platformVersion = h.platformVersion || null;
        env.client.uaFullVersion = h.uaFullVersion || null;
      } catch (_) {}
    }
    // storage estimate
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        env.storage.usageBytes = e.usage || null;
        env.storage.quotaBytes = e.quota || null;
      }
    } catch (_) {}
    // GPU (only if enabled)
    if (state.gpu) {
      try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        if (gl) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          if (dbg) {
            env.gpu.vendor = safe(() => gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL), null);
            env.gpu.renderer = safe(() => gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL), null);
          }
          env.gpu.maxTextureSize = safe(() => gl.getParameter(gl.MAX_TEXTURE_SIZE), null);
          safe(() => { const lc = gl.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext(); });
        }
      } catch (_) {}
      try {
        if (navigator.gpu && navigator.gpu.requestAdapter) {
          const ad = await Promise.race([
            navigator.gpu.requestAdapter(),
            new Promise(res => setTimeout(() => res(null), 300))
          ]);
          if (ad) {
            let info = null;
            if (ad.info) info = ad.info;
            else if (ad.requestAdapterInfo) info = await Promise.race([ad.requestAdapterInfo(), new Promise(r => setTimeout(() => r(null), 200))]);
            if (info) env.gpu.webgpu = { vendor: info.vendor || null, architecture: info.architecture || null };
          }
        }
      } catch (_) {}
    }
    return env;
  }

  // ============================================================
  // 4. ПЛОСКОСТЬ B — КАРКАС
  // ============================================================
  function isTextLeaf(el) {
    if (!el || el.nodeType !== 1) return false;
    const kids = el.childNodes;
    let hasText = false;
    for (let i = 0; i < kids.length; i++) {
      const n = kids[i];
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim().length > 0) hasText = true;
      else if (n.nodeType === 1 && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(n.tagName)) return false;
    }
    return hasText;
  }

  function collectStruct() {
    const t0 = nowMs();
    const result = {
      dom: { totalNodes: 0, elementNodes: 0, maxDepth: 0, deepOverflow: 0,
        tagsTop: [], classTokens: {}, idTokens: {}, ariaRoles: {} },
      landmarks: [],
      blockMap: [],
      scroll: { horizontalOverflow: false, scrollables: 0, scrollablePaths: [] },
      media: { counts: {}, imgAltCoverage: null, imgNaturalLoaded: null, imgLazy: 0,
        videoAutoplay: 0, videoMuted: 0, videoControls: 0, captionsTracks: 0,
        iframes: 0, iframeSameOrigin: null },
      meta: {
        viewport: { width: null, initialScale: null, maximumScale: null, userScalable: null },
        themeColor: null, colorScheme: null, lang: null,
        headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
        headingOrderJumps: 0, skipLink: null
      },
      frameworks: {},
      forms: { forms: 0, inputs: 0, unlabeledRatio: null, required: 0, autocomplete: {} },
      interactive: { counts: {}, minTouchTargetPx: null },
      perf: { ttfbMs: null, dclMs: null, loadMs: null, transferBytesDoc: null,
        lcp: { tag: null, rect: null, ms: null }, clsSum: null, clsSources: 0, longTasks: 0 }
    };

    const tagCount = {};
    const classCount = {};
    const idCount = {};
    const roleCount = {};
    const VW = window.innerWidth || 1;
    const VH = window.innerHeight || 1;
    const VP_AREA = VW * VH;

    const landmarksSelectors = 'header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="search"], [role="dialog"]';
    const landmarkSet = new Set(Array.from(document.querySelectorAll(landmarksSelectors)));

    const interactiveSel = 'a, button, input, select, textarea, [tabindex], [contenteditable]';
    const inputsSel = 'input, select, textarea';

    const body = document.body;
    if (!body) return result;

    // Stack-based DFS
    let totalNodes = 0, elemNodes = 0, maxDepth = 0, deepOverflow = 0;
    let interactiveMin = Infinity;
    const stack = [{ el: body, depth: 0, path: '0' }];
    const blockCandidates = [];
    let trunc = false;
    const tStart = nowMs();

    while (stack.length > 0) {
      if (nowMs() - tStart > WALK_BUDGET_MS * 4) { trunc = true; break; }
      const { el, depth, path } = stack.pop();
      totalNodes++;
      if (el.nodeType !== 1) continue;
      elemNodes++;
      if (depth > maxDepth) maxDepth = depth;
      if (depth > MAX_DEPTH) { deepOverflow++; }
      const overLimit = elemNodes > MAX_NODES;
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (!overLimit && depth <= MAX_DEPTH) {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
        // class tokens
        if (el.classList && el.classList.length) {
          for (const c of el.classList) {
            if (c && c.length && c.length < 80) {
              const key = tokName(c);
              classCount[key] = (classCount[key] || 0) + 1;
            }
          }
        }
        // id
        if (el.id && el.id.length < 80) {
          const key = tokName(el.id);
          idCount[key] = (idCount[key] || 0) + 1;
        }
        // aria role
        const r = el.getAttribute && el.getAttribute('role');
        if (r && r.length < 40) roleCount[r] = (roleCount[r] || 0) + 1;
      }

      // landmarks
      if (!overLimit && landmarkSet.has(el)) {
        const rect = safe(() => el.getBoundingClientRect(), null);
        if (rect) {
          const vis = rect.right > 0 && rect.bottom > 0 && rect.left < VW && rect.top < VH && rect.width > 0 && rect.height > 0;
          const roleAttr = (el.getAttribute && el.getAttribute('role')) || '';
          result.landmarks.push({
            tag, role: roleAttr,
            rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)],
            areaPct: pct(rect.width * rect.height, VP_AREA),
            visible: vis
          });
        }
      }

      // blockMap candidates (depth 1-3 + landmark + area >= BLOCK_MIN_PCT)
      if (!overLimit && depth >= 1 && depth <= 3) {
        blockCandidates.push({ el, depth, path });
      }

      // media
      if (!overLimit) {
        if (tag === 'img') {
          const natW = safe(() => el.naturalWidth, 0);
          const natH = safe(() => el.naturalHeight, 0);
          const hasAlt = !!(el.getAttribute && el.getAttribute('alt'));
          const lazy = el.getAttribute && el.getAttribute('loading') === 'lazy';
          result.media.counts.img = (result.media.counts.img || 0) + 1;
          result.media._imgTotal = (result.media._imgTotal || 0) + 1;
          result.media._imgAlt = (result.media._imgAlt || 0) + (hasAlt ? 1 : 0);
          result.media._imgNat = (result.media._imgNat || 0) + (natW > 0 && natH > 0 ? 1 : 0);
          if (lazy) result.media.imgLazy++;
        } else if (tag === 'video') {
          result.media.counts.video = (result.media.counts.video || 0) + 1;
          if (el.hasAttribute && el.hasAttribute('autoplay')) result.media.videoAutoplay++;
          if (el.hasAttribute && el.hasAttribute('muted')) result.media.videoMuted++;
          if (el.hasAttribute && el.hasAttribute('controls')) result.media.videoControls++;
          const tr = safe(() => el.querySelectorAll('track[kind="captions"]').length, 0);
          result.media.captionsTracks += tr;
        } else if (tag === 'audio') {
          result.media.counts.audio = (result.media.counts.audio || 0) + 1;
        } else if (tag === 'iframe') {
          result.media.counts.iframe = (result.media.counts.iframe || 0) + 1;
          const so = safe(() => { const d = el.contentDocument; return !!d; }, null);
          if (so !== null) {
            result.media._iframeSame = (result.media._iframeSame || 0) + (so ? 1 : 0);
            result.media._iframeTot = (result.media._iframeTot || 0) + 1;
          }
        } else if (tag === 'canvas') {
          result.media.counts.canvas = (result.media.counts.canvas || 0) + 1;
        } else if (tag === 'svg') {
          result.media.counts.svg = (result.media.counts.svg || 0) + 1;
        } else if (tag === 'picture') {
          result.media.counts.picture = (result.media.counts.picture || 0) + 1;
        } else if (tag === 'object' || tag === 'embed') {
          result.media.counts[tag] = (result.media.counts[tag] || 0) + 1;
        }
      }

      // forms
      if (!overLimit) {
        if (tag === 'form') result.forms.forms++;
        if (inputsSel.split(', ').some(s => el.matches && el.matches(s))) {
          result.forms.inputs++;
          if (result.forms.inputs <= INPUTS_LIMIT) {
            const hasLabelFor = el.id && safe(() => !!document.querySelector('label[for="' + CSS.escape(el.id) + '"]'), false);
            const hasAria = el.hasAttribute && (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby'));
            const wrapped = safe(() => !!(el.closest && el.closest('label')), false);
            if (!hasLabelFor && !hasAria && !wrapped) {
              result.forms._unlabeled = (result.forms._unlabeled || 0) + 1;
            }
            result.forms._labeled = (result.forms._labeled || 0) + 1;
            if (el.hasAttribute && el.hasAttribute('required')) result.forms.required++;
            const ac = el.getAttribute && el.getAttribute('autocomplete');
            if (ac && ac.length < 40) result.forms.autocomplete[ac] = (result.forms.autocomplete[ac] || 0) + 1;
          }
        }
      }

      // interactive min touch target
      if (!overLimit && el.matches && safe(() => el.matches(interactiveSel), false)) {
        const rect = safe(() => el.getBoundingClientRect(), null);
        if (rect && rect.width > 0 && rect.height > 0) {
          const m = Math.min(rect.width, rect.height);
          if (m < interactiveMin) interactiveMin = m;
        }
      }

      // headings
      if (!overLimit && /^h[1-6]$/.test(tag)) {
        result.meta.headings[tag] = (result.meta.headings[tag] || 0) + 1;
      }

      // push children
      if (el.children && el.children.length && depth < MAX_DEPTH + 5) {
        const kids = el.children;
        for (let i = kids.length - 1; i >= 0; i--) {
          stack.push({ el: kids[i], depth: depth + 1, path: path + '.' + i });
        }
      }
    }

    result.dom.totalNodes = totalNodes;
    result.dom.elementNodes = elemNodes;
    result.dom.maxDepth = maxDepth;
    result.dom.deepOverflow = deepOverflow;
    result.dom.truncated = trunc || elemNodes > MAX_NODES;
    result.dom.tagsTop = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 40);
    result.dom.classTokens = classCount;
    result.dom.idTokens = idCount;
    result.dom.ariaRoles = roleCount;

    if (result.media._imgTotal) {
      result.media.imgAltCoverage = result.media._imgAlt / result.media._imgTotal;
      result.media.imgNaturalLoaded = result.media._imgNat / result.media._imgTotal;
    }
    if (result.media._iframeTot) result.media.iframeSameOrigin = result.media._iframeSame / result.media._iframeTot;
    delete result.media._imgTotal; delete result.media._imgAlt; delete result.media._imgNat;
    delete result.media._iframeSame; delete result.media._iframeTot;

    if (result.forms._labeled) result.forms.unlabeledRatio = (result.forms._unlabeled || 0) / result.forms._labeled;
    delete result.forms._unlabeled; delete result.forms._labeled;

    result.interactive.minTouchTargetPx = interactiveMin === Infinity ? null : Math.round(interactiveMin * 10) / 10;

    // blockMap
    const seen = new Set();
    for (const c of blockCandidates) {
      if (result.blockMap.length >= BLOCKS_LIMIT) break;
      const el = c.el;
      if (seen.has(el)) continue;
      seen.add(el);
      const rect = safe(() => el.getBoundingClientRect(), null);
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      const areaPct = pct(rect.width * rect.height, VP_AREA);
      const isLandmark = landmarkSet.has(el);
      if (areaPct < BLOCK_MIN_PCT && !isLandmark) continue;
      const cls = el.classList && el.classList.length ? tokName(el.classList[0]) : '';
      const role = (el.getAttribute && el.getAttribute('role')) || '';
      const childTags = {};
      if (el.children) {
        for (let i = 0; i < el.children.length; i++) {
          const t = el.children[i].tagName.toLowerCase();
          childTags[t] = (childTags[t] || 0) + 1;
        }
      }
      const cs = safe(() => getComputedStyle(el), null);
      const scrollable = cs && (cs.overflow === 'auto' || cs.overflow === 'scroll' || cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2;
      if (scrollable) {
        result.scroll.scrollables++;
        if (result.scroll.scrollablePaths.length < 30) result.scroll.scrollablePaths.push(c.path);
      }
      result.blockMap.push({
        path: c.path,
        tag: el.tagName.toLowerCase(),
        cls,
        role,
        rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)],
        areaPct,
        childTags: Object.entries(childTags).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8),
        bgToken: '',
        fsToken: '',
        scrollable,
        position: cs ? cs.position : ''
      });
    }
    result.blockMap.sort((a, b) => b.areaPct - a.areaPct);

    // scroll overflow
    const scEl = document.scrollingElement || document.documentElement;
    if (scEl) result.scroll.horizontalOverflow = scEl.scrollWidth > scEl.clientWidth + 2;

    // meta: viewport
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      const content = safe(() => vp.getAttribute('content') || '', '');
      const mw = content.match(/width\s*=\s*([^,\s]+)/i);
      const is = content.match(/initial-scale\s*=\s*([\d.]+)/i);
      const ms = content.match(/maximum-scale\s*=\s*([\d.]+)/i);
      const us = content.match(/user-scalable\s*=\s*(yes|no|0|1)/i);
      result.meta.viewport.width = mw ? (mw[1] === 'device-width' ? 'device-width' : Number(mw[1])) : null;
      result.meta.viewport.initialScale = is ? Number(is[1]) : null;
      result.meta.viewport.maximumScale = ms ? Number(ms[1]) : null;
      result.meta.viewport.userScalable = us ? (us[1].toLowerCase() === 'yes' || us[1] === '1') : null;
    }
    const tcMeta = document.querySelector('meta[name="theme-color"]');
    if (tcMeta) result.meta.themeColor = 'present';
    const csMeta = document.querySelector('meta[name="color-scheme"]');
    if (csMeta) result.meta.colorScheme = 'present';
    result.meta.lang = safe(() => document.documentElement.lang || null, null);

    // heading order jumps
    const hNodes = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
    let prev = 0, jumps = 0;
    for (const h of hNodes) {
      const lv = parseInt(h.tagName[1], 10);
      if (prev > 0 && lv - prev > 1) jumps++;
      prev = lv;
    }
    result.meta.headingOrderJumps = jumps;

    // skip link
    const firstLinks = Array.from(document.querySelectorAll('a[href]')).slice(0, 5);
    result.meta.skipLink = firstLinks.some(a => {
      const h = a.getAttribute('href') || '';
      return /^#(main|content|skip|primary)$/i.test(h);
    });

    // framework markers
    const fw = [
      ['__NEXT_DATA__', 'script#__NEXT_DATA__'],
      ['next', '#__next'],
      ['react', '[data-reactroot]'],
      ['angular', '[ng-version]'],
      ['nuxt', '#__nuxt'],
      ['svelte', '[data-svelte-h]'],
      ['astro', '[data-astro-cid]'],
      ['vue', '[data-v-]'],
      ['ember', '.ember-application'],
      ['alpine', '[x-data]'],
      ['qwik', '[data-qwik]'],
      ['solid', '[data-solid]'],
      ['turbo', '[data-turbo]']
    ];
    for (const [k, sel] of fw) {
      result.frameworks[k] = safe(() => !!document.querySelector(sel), false);
    }

    // interactive counts
    const interSelList = ['a', 'button', 'input', 'select', 'textarea', '[tabindex]', '[contenteditable]'];
    for (const s of interSelList) {
      result.interactive.counts[s] = safe(() => document.querySelectorAll(s).length, 0);
    }

    // performance
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) {
        result.perf.ttfbMs = Math.round(nav.responseStart);
        result.perf.dclMs = Math.round(nav.domContentLoadedEventEnd);
        result.perf.loadMs = Math.round(nav.loadEventEnd);
        result.perf.transferBytesDoc = nav.transferSize || null;
      }
    } catch (_) {}

    try {
      if ('PerformanceObserver' in window) {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries && lcpEntries.length) {
          const l = lcpEntries[lcpEntries.length - 1];
          result.perf.lcp.ms = Math.round(l.startTime);
          if (l.element) {
            result.perf.lcp.tag = l.element.tagName ? l.element.tagName.toLowerCase() : null;
            const r = safe(() => l.element.getBoundingClientRect(), null);
            if (r) result.perf.lcp.rect = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
          }
        }
      }
    } catch (_) {}

    // CLS via entries
    try {
      const shifts = performance.getEntriesByType('layout-shift');
      if (shifts && shifts.length) {
        let sum = 0, cnt = 0;
        for (const s of shifts) { if (!s.hadRecentInput) { sum += s.value; cnt += (s.sources || []).length; } }
        result.perf.clsSum = Math.round(sum * 1000) / 1000;
        result.perf.clsSources = cnt;
      }
    } catch (_) {}

    try {
      const lt = performance.getEntriesByType('longtask');
      if (lt) result.perf.longTasks = lt.length;
    } catch (_) {}

    result.walkMs = Math.round(nowMs() - t0);
    return result;
  }

  // ============================================================
  // 5. ПЛОСКОСТЬ C — СЛОИ ОТРИСОВКИ
  // ============================================================
  function collectPaint(elementsInfo) {
    const VW = window.innerWidth || 1;
    const VH = window.innerHeight || 1;
    const VP_AREA = VW * VH;
    const out = {
      contexts: [], contextsTotal: 0, triggers: {}, willChangeProperties: [],
      overlays: [], estimate: true
    };
    const trigCount = {};
    const wcSet = new Set();

    const all = document.querySelectorAll('*');
    const limit = Math.min(all.length, MAX_NODES);
    for (let i = 0; i < limit; i++) {
      const el = all[i];
      if (el.id && el.id.startsWith('ssea-')) continue;
      const cs = safe(() => getComputedStyle(el), null);
      if (!cs) continue;
      const reasons = [];
      const tag = el.tagName.toLowerCase();
      if (tag === 'html') reasons.push('root');
      const pos = cs.position;
      const zi = cs.zIndex;
      if (pos !== 'static' && zi !== 'auto') reasons.push('position+z-index');
      if (pos === 'fixed') reasons.push('position:fixed');
      if (pos === 'sticky') reasons.push('position:sticky');
      if (cs.transform && cs.transform !== 'none') reasons.push('transform');
      if (cs.perspective && cs.perspective !== 'none') reasons.push('perspective');
      if (cs.filter && cs.filter !== 'none') reasons.push('filter');
      if (cs.backdropFilter && cs.backdropFilter !== 'none') reasons.push('backdrop-filter');
      const op = parseFloat(cs.opacity);
      if (!isNaN(op) && op < 1) reasons.push('opacity<1');
      if (cs.isolation === 'isolate') reasons.push('isolation');
      if (cs.contain && /paint|layout|content|strict/.test(cs.contain)) reasons.push('contain');
      if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') reasons.push('mix-blend-mode');
      const wc = cs.willChange || '';
      if (wc && wc !== 'auto') {
        const props = wc.split(',').map(s => s.trim());
        if (props.some(p => ['transform', 'opacity', 'filter', 'perspective', 'z-index', 'position'].includes(p))) {
          reasons.push('will-change');
          props.forEach(p => wcSet.add(p));
        }
      }
      if (reasons.length === 0) continue;

      out.contextsTotal++;
      for (const r of reasons) trigCount[r] = (trigCount[r] || 0) + 1;

      if (out.contexts.length >= LAYERS_LIMIT) continue;

      const rect = safe(() => el.getBoundingClientRect(), null);
      if (!rect) continue;
      const areaPct = pct(rect.width * rect.height, VP_AREA);
      const intW = Math.max(0, Math.min(rect.right, VW) - Math.max(rect.left, 0));
      const intH = Math.max(0, Math.min(rect.bottom, VH) - Math.max(rect.top, 0));
      const coversVP = pct(intW * intH, VP_AREA);
      const ziNum = zi === 'auto' ? null : (isNaN(parseInt(zi, 10)) ? null : parseInt(zi, 10));

      const ctx = {
        path: '',
        tag,
        reason: reasons,
        zIndex: ziNum,
        rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)],
        areaPct,
        coversViewportPct: coversVP,
        childContexts: 0
      };
      out.contexts.push(ctx);

      if (pos === 'fixed' && coversVP >= OVERLAY_PCT) {
        if (out.overlays.length < 20) {
          out.overlays.push({
            path: '', tag,
            rect: ctx.rect,
            coversViewportPct: coversVP,
            zIndex: ziNum
          });
        }
      }
    }
    out.triggers = trigCount;
    out.willChangeProperties = Array.from(wcSet).sort();
    return out;
  }

  // ============================================================
  // 6. ПЛОСКОСТЬ D — ТОКЕНЫ
  // ============================================================
  function collectTokens() {
    const t0 = nowMs();
    const VW = window.innerWidth || 1;
    const VH = window.innerHeight || 1;
    const VP_AREA = VW * VH;

    const bgMap = new Map();
    const fgMap = new Map();
    const pairMap = new Map();
    const famMap = new Map();
    const sizeHist = new Map();
    const lhHist = new Map();
    const lsHist = new Map();
    const wHist = new Map();
    const alignHist = new Map();
    const marginHist = new Map();
    const paddingHist = new Map();
    const gapHist = new Map();
    let totalSpacing = 0, mult4 = 0;

    const all = document.querySelectorAll('*');
    const limit = Math.min(all.length, MAX_NODES);
    const stride = Math.max(1, Math.ceil(limit / MAX_NODES));

    let sampled = 0;
    let pairsSampled = 0;

    const bgLookup = new WeakMap();

    function effBg(el) {
      let cur = el, acc = null;
      const chain = [];
      while (cur && cur.nodeType === 1) {
        const cs = safe(() => getComputedStyle(cur), null);
        if (!cs) break;
        const c = parseColor(cs.backgroundColor);
        if (c && c[3] > 0) {
          chain.push(c);
          if (c[3] >= 0.999) break;
        }
        cur = cur.parentElement;
      }
      if (chain.length === 0) return [255, 255, 255, 1];
      let res = chain[chain.length - 1];
      if (res[3] < 0.999) {
        // compose against white baseline
        res = blendOver(res, [255, 255, 255, 1]);
      }
      for (let i = chain.length - 2; i >= 0; i--) {
        res = blendOver(chain[i], res);
      }
      return res;
    }

    for (let i = 0; i < limit; i += stride) {
      const el = all[i];
      if (el.id && el.id.startsWith('ssea-')) continue;
      const cs = safe(() => getComputedStyle(el), null);
      if (!cs) continue;
      const bg = parseColor(cs.backgroundColor);
      const fg = parseColor(cs.color);
      if (bg && bg[3] > 0) {
        const key = rgbToHex(bg[0], bg[1], bg[2]) + '@' + bucketAlpha(bg[3]);
        const ex = bgMap.get(key);
        if (ex) ex.count++; else bgMap.set(key, { hex: rgbToHex(bg[0], bg[1], bg[2]), alpha: bucketAlpha(bg[3]), count: 1, rgb: [bg[0], bg[1], bg[2]] });
      }
      if (fg) {
        const key = rgbToHex(fg[0], fg[1], fg[2]) + '@' + bucketAlpha(fg[3]);
        const ex = fgMap.get(key);
        if (ex) ex.count++; else fgMap.set(key, { hex: rgbToHex(fg[0], fg[1], fg[2]), alpha: bucketAlpha(fg[3]), count: 1, rgb: [fg[0], fg[1], fg[2]] });
      }
      sampled++;

      // text pairs: leaf text
      if (pairsSampled < SAMPLE_PAIRS && isTextLeaf(el)) {
        const eBg = effBg(el);
        const eFg = fg && fg[3] >= 0.999 ? fg : (fg ? blendOver(fg, eBg) : [0, 0, 0, 1]);
        const ratio = contrastRatio(eFg, eBg);
        const px = parseFloat(cs.fontSize) || 16;
        const w = parseInt(cs.fontWeight, 10) || 400;
        const k = rgbToHex(eFg[0], eFg[1], eFg[2]) + '/' + rgbToHex(eBg[0], eBg[1], eBg[2]);
        const ex = pairMap.get(k);
        if (ex) ex.count++; else pairMap.set(k, { fg: rgbToHex(eFg[0], eFg[1], eFg[2]), bg: rgbToHex(eBg[0], eBg[1], eBg[2]), ratio: Math.round(ratio * 100) / 100, count: 1, px: Math.round(px), weight: w });
        pairsSampled++;
      }

      // typography
      const fam = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim().slice(0, 60);
      if (fam) famMap.set(fam, (famMap.get(fam) || 0) + 1);
      const sz = Math.round(parseFloat(cs.fontSize) || 16);
      sizeHist.set(sz, (sizeHist.get(sz) || 0) + 1);
      const lh = cs.lineHeight;
      let lhR = 0;
      if (lh && lh !== 'normal') {
        const lhpx = parseFloat(lh);
        if (!isNaN(lhpx) && sz > 0) lhR = Math.round((lhpx / sz) / 0.05) * 0.05;
      }
      if (lhR) lhHist.set(lhR, (lhHist.get(lhR) || 0) + 1);
      const ls = cs.letterSpacing;
      if (ls && ls !== 'normal') {
        const lspx = parseFloat(ls);
        if (!isNaN(lspx) && sz > 0) {
          const em = Math.round((lspx / sz) / 0.01) * 0.01;
          lsHist.set(em, (lsHist.get(em) || 0) + 1);
        }
      }
      const w = parseInt(cs.fontWeight, 10);
      if (!isNaN(w)) wHist.set(w, (wHist.get(w) || 0) + 1);
      const ta = cs.textAlign;
      if (ta) alignHist.set(ta, (alignHist.get(ta) || 0) + 1);

      // spacing
      const props = [['marginTop', marginHist], ['marginRight', marginHist], ['marginBottom', marginHist], ['marginLeft', marginHist],
                     ['paddingTop', paddingHist], ['paddingRight', paddingHist], ['paddingBottom', paddingHist], ['paddingLeft', paddingHist],
                     ['gap', gapHist], ['rowGap', gapHist], ['columnGap', gapHist]];
      for (const [p, hist] of props) {
        const v = cs[p];
        if (!v || v === 'normal' || v === 'auto') continue;
        const n = parseFloat(v);
        if (isNaN(n)) continue;
        const r = Math.round(n);
        hist.set(r, (hist.get(r) || 0) + 1);
        totalSpacing++;
        if (r !== 0 && r % 4 === 0) mult4++;
      }
    }

    // pageBg
    let pageBg = [255, 255, 255, 1];
    const htmlCs = safe(() => getComputedStyle(document.documentElement), null);
    const bodyCs = safe(() => document.body ? getComputedStyle(document.body) : null, null);
    for (const cs of [htmlCs, bodyCs]) {
      if (!cs) continue;
      const c = parseColor(cs.backgroundColor);
      if (c && c[3] >= 0.999) { pageBg = c; break; }
      if (c && c[3] > 0) pageBg = blendOver(c, pageBg);
    }

    function topPalette(map, k) {
      return Array.from(map.values())
        .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex))
        .slice(0, k)
        .map(x => ({
          hex: x.hex, alpha: x.alpha, count: x.count,
          lum: Math.round(relLum([x.rgb[0], x.rgb[1], x.rgb[2]]) * 10000) / 10000,
          contrastVsPageBg: Math.round(contrastRatio([x.rgb[0], x.rgb[1], x.rgb[2]], [pageBg[0], pageBg[1], pageBg[2]]) * 100) / 100
        }));
    }

    const textPairs = Array.from(pairMap.values()).sort((a, b) => b.count - a.count || a.fg.localeCompare(b.fg));
    let violationsAA = 0, violationsCritical = 0;
    for (const p of textPairs) {
      if (p.ratio < 3) violationsCritical += p.count;
      else if (p.ratio < 4.5) violationsAA += p.count;
    }

    // CSS inventory
    const cssInfo = collectCSS();

    // Motion
    const motion = collectMotion();

    // spacing hist
    function histArr(m) {
      return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
    }

    return {
      pageBg: { hex: rgbToHex(pageBg[0], pageBg[1], pageBg[2]), lum: Math.round(relLum(pageBg) * 10000) / 10000 },
      paletteBg: topPalette(bgMap, PALETTE_K),
      paletteFg: topPalette(fgMap, PALETTE_K),
      textPairs: textPairs.slice(0, 200),
      violationsAA, violationsCritical,
      type: {
        families: Array.from(famMap.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20),
        sizePxHist: histArr(sizeHist),
        lineHeightHist: histArr(lhHist),
        letterSpacingHist: histArr(lsHist),
        weights: Object.fromEntries(Array.from(wHist.entries()).sort((a, b) => a[0] - b[0])),
        textAlign: Object.fromEntries(Array.from(alignHist.entries()).sort((a, b) => b[1] - a[1]))
      },
      spacing: {
        marginHist: histArr(marginHist),
        paddingHist: histArr(paddingHist),
        gapHist: histArr(gapHist),
        multOf4Share: totalSpacing > 0 ? Math.round((mult4 / totalSpacing) * 1000) / 1000 : 0
      },
      css: cssInfo,
      motion,
      tokensMs: Math.round(nowMs() - t0)
    };
  }

  function collectCSS() {
    const out = { sheets: [], rulesTotal: 0, mediaWidths: [], customProps: 0, transferBytesCss: null, features: {} };
    const feat = {};
    const incFeat = (k) => { feat[k] = (feat[k] || 0) + 1; };
    const mediaSet = new Set();
    const cpSet = new Set();

    function scanText(txt) {
      if (!txt) return;
      if (txt.indexOf('display') !== -1) {
        if (/display\s*:\s*grid/.test(txt)) incFeat('display:grid');
        if (/display\s*:\s*flex/.test(txt)) incFeat('display:flex');
        if (/grid-template/.test(txt)) incFeat('grid-template');
        if (/subgrid/.test(txt)) incFeat('subgrid');
      }
      if (/\bgap\s*:/.test(txt)) incFeat('gap');
      if (/@container/.test(txt)) incFeat('@container');
      if (/:has\(/.test(txt)) incFeat(':has(');
      if (/aspect-ratio/.test(txt)) incFeat('aspect-ratio');
      if (/position\s*:\s*sticky/.test(txt)) incFeat('position:sticky');
      if (/position\s*:\s*fixed/.test(txt)) incFeat('position:fixed');
      if (/backdrop-filter/.test(txt)) incFeat('backdrop-filter');
      if (/\bfilter\s*:/.test(txt)) incFeat('filter:');
      if (/dvh/.test(txt)) incFeat('dvh');
      if (/svh/.test(txt)) incFeat('svh');
      if (/clamp\(/.test(txt)) incFeat('clamp(');
      if (/\bmin\(/.test(txt)) incFeat('min(');
      if (/\bmax\(/.test(txt)) incFeat('max(');
      if (/color-mix\(/.test(txt)) incFeat('color-mix(');
      if (/oklch\(/.test(txt)) incFeat('oklch(');
      if (/oklab\(/.test(txt)) incFeat('oklab(');
      if (/:focus-visible/.test(txt)) incFeat(':focus-visible');
      if (/prefers-reduced-motion/.test(txt)) incFeat('prefers-reduced-motion');
    }

    try {
      const sheets = document.styleSheets;
      for (const sh of sheets) {
        const entry = { accessible: true, rules: 0 };
        try {
          const rules = sh.cssRules;
          const cap = Math.min(rules.length, RULES_LIMIT);
          entry.rules = rules.length;
          out.rulesTotal += rules.length;
          for (let i = 0; i < cap; i++) {
            const r = rules[i];
            if (r.type === 4 && r.conditionText) { // CSSMediaRule
              const txt = r.conditionText || '';
              scanText(txt);
              const m1 = txt.match(/min-width\s*:\s*(\d+(?:\.\d+)?)px/g);
              const m2 = txt.match(/max-width\s*:\s*(\d+(?:\.\d+)?)px/g);
              const collect = (mm) => { if (mm) mm.forEach(s => { const n = parseFloat(s.match(/(\d+(?:\.\d+)?)/)[1]); mediaSet.add(n); }); };
              collect(m1); collect(m2);
            } else if (r.type === 7) { // keyframes
              // counted in motion
            } else if (r.type === 1 || r.type === 5 || r.type === 6) { // style / supports / container
              scanText(r.cssText || '');
              const txt = r.cssText || '';
              const cps = txt.match(/--[a-zA-Z0-9_-]+/g);
              if (cps) cps.forEach(c => cpSet.add(c.slice(0, 60)));
            }
          }
        } catch (_) {
          entry.accessible = false;
        }
        out.sheets.push(entry);
      }
    } catch (_) {}

    out.mediaWidths = Array.from(mediaSet).sort((a, b) => a - b).slice(0, MEDIA_LIMIT);
    out.customProps = cpSet.size;
    out.customPropsAnon = state.mode === 'anon' ? cpSet.size : null;
    out.features = feat;

    try {
      const res = performance.getEntriesByType('resource');
      let bytes = 0, any = false;
      for (const r of res) {
        if (r.initiatorType === 'link' || r.initiatorType === 'css') {
          if (typeof r.transferSize === 'number' && r.transferSize > 0) { bytes += r.transferSize; any = true; }
        }
      }
      out.transferBytesCss = any ? bytes : null;
    } catch (_) {}

    return out;
  }

  function collectMotion() {
    const out = { keyframes: 0, animations: 0, transitions: 0, live: 0, infinite: 0, reducedMotionHandled: false };
    try {
      const sheets = document.styleSheets;
      for (const sh of sheets) {
        try {
          const rules = sh.cssRules;
          for (let i = 0; i < rules.length; i++) {
            const r = rules[i];
            if (r.type === 7) out.keyframes++;
            if (r.cssText) {
              const txt = r.cssText;
              if (/animation(-\w+)?\s*:/.test(txt)) {
                out.animations++;
                if (/infinite/i.test(txt)) out.infinite++;
              }
              if (/transition(-\w+)?\s*:/.test(txt)) out.transitions++;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
    try {
      const anims = document.getAnimations ? document.getAnimations() : [];
      out.live = anims.length;
      for (const a of anims) {
        try {
          const it = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
          if (it && it.iterations === Infinity) out.infinite++;
        } catch (_) {}
      }
    } catch (_) {}
    try {
      // check reduced-motion media rule presence with non-empty body
      const sheets = document.styleSheets;
      for (const sh of sheets) {
        try {
          const rules = sh.cssRules;
          for (let i = 0; i < rules.length; i++) {
            const r = rules[i];
            if (r.type === 4 && /prefers-reduced-motion\s*:\s*reduce/.test(r.conditionText || '')) {
              if (r.cssRules && r.cssRules.length > 0) out.reducedMotionHandled = true;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
    return out;
  }

  // ============================================================
  // 9. ПЛОСКОСТЬ H — ЗДОРОВЬЕ
  // ============================================================
  function computeHealth(env, struct, paint, tokens) {
    const items = [];
    const H = (id, value, unit, threshold, verdict, ref) => {
      items.push({ id, value, unit, threshold, verdict, ref });
    };

    const totalPairCount = tokens.textPairs.reduce((s, p) => s + p.count, 0) || 0;
    const aaShare = totalPairCount > 0 ? tokens.violationsAA / totalPairCount : 0;

    // H1 contrast
    let h1v = 'ok';
    if (tokens.violationsCritical > 0) h1v = 'fail';
    else if (aaShare > 0.10) h1v = 'fail';
    else if (tokens.violationsAA > 0) h1v = 'warn';
    H('H1', tokens.violationsAA, 'pairs', 'AA<4.5 или critical>0', h1v, 'WCAG 2.2 SC 1.4.3');

    // H2 min font size
    let minFs = null;
    for (const [sz] of tokens.type.sizePxHist) if (minFs === null || sz < minFs) minFs = sz;
    let h2v = 'ok';
    if (minFs === null) h2v = 'ok';
    else if (minFs < 12) h2v = 'fail';
    else if (minFs < 14) h2v = 'warn';
    H('H2', minFs, 'px', '<12 fail, <14 warn', h2v, 'эргономика чтения');

    // H3 min touch target
    const mt = struct.interactive.minTouchTargetPx;
    let h3v = 'ok';
    if (mt !== null && mt < 24) h3v = 'fail';
    else if (mt !== null && mt < 44) h3v = 'warn';
    H('H3', mt, 'px', '<24 fail, <44 warn', h3v, 'WCAG 2.2 SC 2.5.8');

    // H4 horizontal overflow
    H('H4', struct.scroll.horizontalOverflow, 'bool', 'true=fail', struct.scroll.horizontalOverflow ? 'fail' : 'ok', 'WCAG 2.2 SC 1.4.10');

    // H5 blocking overlays
    const bo = paint.overlays.length;
    let h5v = 'ok';
    if (bo >= 3) h5v = 'fail'; else if (bo >= 1) h5v = 'warn';
    H('H5', bo, 'count', '>=1 warn, >=3 fail', h5v, 'перекрытие контента');

    // H6 visible dialogs
    let dialogs = 0;
    try {
      const dlg = document.querySelectorAll('[role="dialog"], dialog[open]');
      for (const d of dlg) {
        const r = safe(() => d.getBoundingClientRect(), null);
        if (r && r.width > 0 && r.height > 0) dialogs++;
      }
    } catch (_) {}
    H('H6', dialogs, 'count', '>=1 warn', dialogs >= 1 ? 'warn' : 'ok', 'модальность');

    // H7 autoplay unmuted
    const vm = struct.media.videoAutoplay;
    const vmu = struct.media.videoMuted;
    const autoplayUnmuted = Math.max(0, vm - vmu);
    H('H7', autoplayUnmuted, 'count', '>=1 fail', autoplayUnmuted >= 1 ? 'fail' : 'ok', 'WCAG 2.2 SC 2.2.2');

    // H8 motion pressure
    const inf = tokens.motion.infinite;
    const rmh = tokens.motion.reducedMotionHandled;
    const h8v = (inf > 0 && !rmh) ? 'fail' : (inf > 0 ? 'warn' : 'ok');
    H('H8', inf, 'count', 'infinite>0 && !reducedMotion → fail', h8v, 'WCAG 2.2 SC 2.3.3');

    // H9 zoom blocked
    const vp = struct.meta.viewport;
    const zoomBlocked = vp.userScalable === false || (vp.maximumScale !== null && vp.maximumScale < 2);
    H('H9', zoomBlocked, 'bool', 'true=fail', zoomBlocked ? 'fail' : 'ok', 'WCAG 2.2 SC 1.4.4');

    // H10 long measure: доля пар с большой шириной — приблизим через sample (нет прямого признака)
    // Используем эвристику: если в blockMap есть блок с areaPct>40 и это текстовая область — не надёжно.
    // Для v1 значение null.
    H('H10', null, 'share', '>0 warn', 'ok', 'норма 45-75ch (Брингхёрст)');

    // H11 heading structure
    const noH1 = (struct.meta.headings.h1 || 0) === 0;
    const jumps = struct.meta.headingOrderJumps;
    let h11v = 'ok';
    if (noH1 || jumps > 0) h11v = 'fail';
    H('H11', jumps + (noH1 ? 1 : 0), 'count', 'no h1 / jumps>0 fail', h11v, 'WCAG 2.2 SC 1.3.1');

    // H12 media accessibility
    const alt = struct.media.imgAltCoverage;
    const vid = struct.media.counts.video || 0;
    const cap = struct.media.captionsTracks;
    let h12v = 'ok';
    if (alt !== null && alt < 0.5) h12v = 'fail';
    else if (alt !== null && alt < 0.9) h12v = 'warn';
    if (vid > 0 && cap === 0) h12v = h12v === 'fail' ? 'fail' : 'warn';
    H('H12', alt, 'share', '<0.5 fail, <0.9 warn', h12v, 'WCAG 2.2 SC 1.1.1, 1.2.2');

    // H13 form labeling
    const ul = struct.forms.unlabeledRatio;
    let h13v = 'ok';
    if (ul !== null && ul > 0.3) h13v = 'fail';
    else if (ul !== null && ul > 0.1) h13v = 'warn';
    H('H13', ul, 'share', '>0.1 warn, >0.3 fail', h13v, 'WCAG 2.2 SC 3.3.2, 1.3.1');

    // H14 dark scheme support
    const supportsDark = safe(() => {
      const sheets = document.styleSheets;
      for (const sh of sheets) {
        try {
          const rules = sh.cssRules;
          for (let i = 0; i < rules.length; i++) {
            const r = rules[i];
            if (r.type === 4 && /prefers-color-scheme\s*:\s*dark/.test(r.conditionText || '')) return true;
          }
        } catch (_) {}
      }
      return false;
    }, false);
    H('H14', supportsDark, 'bool', 'false warn', supportsDark ? 'ok' : 'warn', 'ночной комфорт');

    let fails = 0, warns = 0;
    for (const it of items) {
      if (it.verdict === 'fail') fails++;
      else if (it.verdict === 'warn') warns++;
    }
    const score = Math.max(0, 100 - 10 * fails - 3 * warns);

    return {
      score,
      items,
      disclaimer: 'Эргономический срез при текущем вьюпорте и устройстве; не является полной оценкой доступности'
    };
  }

  // ============================================================
  // 7. ГЕНЕРАЦИЯ ОТЧЁТА
  // ============================================================
  function validateReport(r) {
    const errors = [];
    const need = ['schema', 'generatedAt', 'url', 'env', 'struct', 'paint', 'tokens', 'health', 'passport'];
    for (const k of need) if (!(k in r)) errors.push(k);
    if (r.schema !== 'ssea-1') errors.push('schema!=ssea-1');
    if (!r.url || typeof r.url.origin !== 'string') errors.push('url.origin');
    if (!r.env || !r.env.client) errors.push('env.client');
    if (!r.struct || !r.struct.dom) errors.push('struct.dom');
    if (!r.tokens || !r.tokens.pageBg) errors.push('tokens.pageBg');
    if (!r.health || typeof r.health.score !== 'number') errors.push('health.score');
    return errors;
  }

  async function collect(modeOverride) {
    const mode = modeOverride || state.mode;
    const tStart = nowMs();
    const env = collectEnv();
    await collectEnvAsync(env);
    const tEnv = nowMs();

    const struct = collectStruct();
    const tStruct = nowMs();

    const paint = collectPaint();
    const tPaint = nowMs();

    const tokens = collectTokens();
    const tTokens = nowMs();

    const health = computeHealth(env, struct, paint, tokens);
    const tHealth = nowMs();

    let queryKeys = [];
    try {
      const sp = new URLSearchParams(location.search);
      queryKeys = Array.from(sp.keys()).slice(0, 50);
    } catch (_) {}

    const report = {
      schema: 'ssea-1',
      generatedAt: isoUtc(),
      url: {
        origin: safe(() => location.origin, ''),
        path: safe(() => location.pathname, ''),
        queryKeys
      },
      env,
      struct,
      paint,
      tokens,
      health,
      passport: {
        walkMs: struct.walkMs || Math.round(tStruct - tEnv),
        nodesWalked: struct.dom.totalNodes,
        jsonBytes: 0,
        capsHit: [],
        apiAvailability: state.apiAvail,
        mode,
        pairsSampled: tokens.textPairs.reduce((s, p) => s + p.count, 0),
        wallClock: isoUtc(),
        notes: []
      }
    };

    // caps
    if (struct.dom.truncated) report.passport.capsHit.push('MAX_NODES');
    if (struct.dom.deepOverflow > 0) report.passport.capsHit.push('MAX_DEPTH');
    if (paint.contextsTotal > LAYERS_LIMIT) report.passport.capsHit.push('LAYERS_LIMIT');
    if (tokens.textPairs.length >= SAMPLE_PAIRS) report.passport.capsHit.push('SAMPLE_PAIRS');

    const json = JSON.stringify(report);
    report.passport.jsonBytes = json.length;
    report.passport.timings = {
      envMs: Math.round(tEnv - tStart),
      structMs: Math.round(tStruct - tEnv),
      paintMs: Math.round(tPaint - tStruct),
      tokensMs: Math.round(tTokens - tPaint),
      healthMs: Math.round(tHealth - tTokens),
      totalMs: Math.round(nowMs() - tStart)
    };

    return report;
  }

  // ============================================================
  // HTML-ОТЧЁТ (раздел 8: нормы безопасности)
  // ============================================================
  function buildHTML(report, panelPassport) {
    const r = report;
    const esc = tplEscape;
    const bg = '#f5f5f7';
    const fg = '#1a1a1a';
    const accent = '#1a5fbf';
    const cardBg = '#ffffff';
    const border = '#d0d0d5';

    function swatch(hex, alpha) {
      return `<span class="sw" style="background:${esc(hex)};opacity:${alpha}"></span>`;
    }
    function bar(val, max, label) {
      const w = max > 0 ? Math.round((val / max) * 100) : 0;
      return `<div class="bar"><span style="width:${w}%"></span><em>${esc(label)}</em></div>`;
    }

    const H = r.health;
    const passport = r.passport;
    const verdictColor = (v) => v === 'ok' ? '#0a7f3f' : v === 'warn' ? '#a06000' : v === 'fail' ? '#b91c1c' : '#555';
    const verdictLabel = (v) => v === 'ok' ? '[OK]' : v === 'warn' ? '[WARN]' : v === 'fail' ? '[FAIL]' : '[?]';

    const envRows = [];
    function flat(obj, prefix) {
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, prefix + k + '.');
        else envRows.push([prefix + k, JSON.stringify(v)]);
      }
    }
    flat(r.env, '');

    const blockRows = r.struct.blockMap.slice(0, BLOCKS_LIMIT).map(b =>
      `<tr><td>${esc(b.path)}</td><td>${esc(b.tag)}</td><td>${esc(b.cls)}</td><td>${esc(b.role)}</td>` +
      `<td>${b.rect.join(', ')}</td><td class="num">${b.areaPct}</td>` +
      `<td class="num">${b.scrollable ? 'Y' : ''}</td><td>${esc(b.position)}</td></tr>`
    ).join('');

    const ctxRows = r.paint.contexts.slice(0, LAYERS_LIMIT).map(c =>
      `<tr><td>${esc(c.path || '-')}</td><td>${esc(c.tag)}</td><td>${esc(c.reason.join(', '))}</td>` +
      `<td class="num">${c.zIndex === null ? '-' : c.zIndex}</td><td>${c.rect.join(', ')}</td>` +
      `<td class="num">${c.areaPct}</td><td class="num">${c.coversViewportPct}</td></tr>`
    ).join('');

    const paletteRows = r.tokens.paletteBg.map(p =>
      `<tr><td>${swatch(p.hex, p.alpha)} ${esc(p.hex)}</td>` +
      `<td class="num">${p.alpha}</td><td class="num">${p.count}</td>` +
      `<td class="num">${p.lum}</td><td class="num">${p.contrastVsPageBg}</td></tr>`
    ).join('');

    const fgRows = r.tokens.paletteFg.map(p =>
      `<tr><td>${swatch(p.hex, p.alpha)} ${esc(p.hex)}</td>` +
      `<td class="num">${p.alpha}</td><td class="num">${p.count}</td>` +
      `<td class="num">${p.lum}</td><td class="num">${p.contrastVsPageBg}</td></tr>`
    ).join('');

    const pairRows = r.tokens.textPairs.slice(0, 100).map(p => {
      const v = p.ratio >= 4.5 ? 'ok' : (p.ratio >= 3 ? 'warn' : 'fail');
      return `<tr><td>${swatch(p.fg, 1)} ${esc(p.fg)}</td><td>${swatch(p.bg, 1)} ${esc(p.bg)}</td>` +
        `<td class="num">${p.ratio}</td><td class="num">${p.px}</td><td class="num">${p.weight}</td>` +
        `<td class="num">${p.count}</td>` +
        `<td style="color:${verdictColor(v)}">${verdictLabel(v)}</td></tr>`;
    }).join('');

    const healthRows = H.items.map(it => {
      const v = it.verdict;
      return `<tr><td>${esc(it.id)}</td><td>${esc(String(it.value))}</td><td>${esc(it.unit)}</td>` +
        `<td>${esc(it.threshold)}</td><td style="color:${verdictColor(v)}">${verdictLabel(v)}</td>` +
        `<td>${esc(it.ref)}</td></tr>`;
    }).join('');

    const typeRows = r.tokens.type.sizePxHist.map(([k, v]) =>
      `<tr><td class="num">${k}</td><td class="num">${v}</td></tr>`).join('');
    const lhRows = r.tokens.type.lineHeightHist.map(([k, v]) =>
      `<tr><td class="num">${k}</td><td class="num">${v}</td></tr>`).join('');

    const apiRows = Object.keys(passport.apiAvailability).map(k =>
      `<tr><td>${esc(k)}</td><td>${passport.apiAvailability[k] ? 'доступно' : 'недоступно'}</td></tr>`).join('');

    // Self-audit: проверка контраста собственных пар отчёта
    const selfPairs = [
      ['основной текст', fg, bg],
      ['карточка', fg, cardBg],
      ['акцент', accent, bg]
    ].map(([label, f, b]) => {
      const fRgb = parseColor(f); const bRgb = parseColor(b);
      const ratio = fRgb && bRgb ? contrastRatio(fRgb, bRgb) : 0;
      const ok = ratio >= 4.5;
      return { label, f, b, ratio: Math.round(ratio * 100) / 100, ok };
    });

    // панель-паспорт
    const pp = panelPassport || {};

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SSEA-2026 — ${esc(r.url.origin)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 16px; line-height: 1.6; color: ${fg}; background: ${bg};
    padding: 24px; max-width: 1100px; margin: 0 auto;
  }
  h1 { font-size: 1.75rem; margin: 0 0 8px; }
  h2 { font-size: 1.25rem; margin: 24px 0 12px; border-bottom: 1px solid ${border}; padding-bottom: 4px; }
  h3 { font-size: 1.05rem; margin: 16px 0 8px; }
  p, li { max-width: 72ch; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; margin: 8px 0; }
  caption { text-align: left; font-weight: 600; padding: 6px 0; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid ${border}; vertical-align: top; }
  th { background: #eaeaef; }
  td.num, th.num { text-align: right; }
  code, .mono { font-family: ui-monospace, Consolas, Menlo, monospace; font-size: 0.9em; }
  details { margin: 8px 0; }
  summary { cursor: pointer; padding: 6px 0; font-weight: 600; }
  .card { background: ${cardBg}; border: 1px solid ${border}; border-radius: 6px; padding: 12px 14px; margin: 10px 0; }
  .sw { display: inline-block; width: 14px; height: 14px; border: 1px solid #999; vertical-align: middle; margin-right: 4px; }
  .bar { background: #e6e6ec; height: 12px; position: relative; border-radius: 3px; margin: 2px 0; }
  .bar > span { display: block; height: 100%; background: ${accent}; border-radius: 3px; }
  .bar > em { position: absolute; left: 4px; top: -1px; font-size: 0.75rem; font-style: normal; }
  .verdict { font-weight: 700; }
  .ok { color: #0a7f3f; }
  .warn { color: #a06000; }
  .fail { color: #b91c1c; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${accent}; color: #fff; font-weight: 700; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
  @media print {
    @page { size: A4; margin: 14mm; }
    body { padding: 0; max-width: none; }
    tr, .card, details { break-inside: avoid; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  /* без анимаций */
  *, *::before, *::after { animation: none !important; transition: none !important; }
</style>
</head>
<body>
<header>
  <h1>SSEA-2026 — Отчёт об аудите</h1>
  <p><strong>Хост:</strong> <code>${esc(r.url.origin)}</code> · <strong>Путь:</strong> <code>${esc(r.url.path)}</code></p>
  <p><strong>Сгенерировано (UTC):</strong> ${esc(r.generatedAt)} · <strong>Схема:</strong> ssea-1 · <strong>Режим:</strong> ${esc(passport.mode)}</p>
  <p><span class="badge">H-score: ${H.score}</span></p>
  <p class="mono">${esc(H.disclaimer)}</p>
</header>

<section>
<h2>A. Паспорт отчёта</h2>
<table><caption>Метрики отчёта</caption>
<tbody>
<tr><th>Узлов обойдено</th><td class="num">${passport.nodesWalked}</td></tr>
<tr><th>Мс обхода (walk)</th><td class="num">${passport.walkMs}</td></tr>
<tr><th>Байт JSON</th><td class="num">${passport.jsonBytes}</td></tr>
<tr><th>Пар сэмплировано</th><td class="num">${passport.pairsSampled}</td></tr>
<tr><th>Достигнутые лимиты</th><td>${esc(passport.capsHit.join(', ') || '—')}</td></tr>
<tr><th>Тайминги</th><td class="mono">${esc(JSON.stringify(passport.timings || {}))}</td></tr>
</tbody></table>
</section>

<section>
<h2>B. Слои отрисовки</h2>
<details open><summary>Контексты наложения (${r.paint.contextsTotal})</summary>
<table><caption>Топ контекстов наложения</caption>
<thead><tr><th>Путь</th><th>Тег</th><th>Причины</th><th class="num">z-index</th><th>Rect</th><th class="num">Area %</th><th class="num">Покрытие VP %</th></tr></thead>
<tbody>${ctxRows || '<tr><td colspan="7">нет</td></tr>'}</tbody></table>
</details>
<details><summary>Триггеры</summary><pre class="mono">${esc(JSON.stringify(r.paint.triggers, null, 2))}</pre></details>
</section>

<section>
<h2>C. Таблица блоков</h2>
<details open><summary>blockMap (${r.struct.blockMap.length})</summary>
<table><caption>Структурные блоки страницы</caption>
<thead><tr><th>Путь</th><th>Тег</th><th>Класс</th><th>Role</th><th>Rect</th><th class="num">Area %</th><th>Scroll</th><th>Position</th></tr></thead>
<tbody>${blockRows || '<tr><td colspan="8">нет</td></tr>'}</tbody></table>
</details>
</section>

<section>
<h2>D. Токены и палитра</h2>
<h3>PAGE BG: ${esc(r.tokens.pageBg.hex)} (L=${r.tokens.pageBg.lum})</h3>
<div class="grid2">
<div>
<details open><summary>Палитра фона (top ${r.tokens.paletteBg.length})</summary>
<table><caption>Фоновые цвета</caption>
<thead><tr><th>Цвет</th><th class="num">α</th><th class="num">Count</th><th class="num">L</th><th class="num">Contrast</th></tr></thead>
<tbody>${paletteRows}</tbody></table>
</details>
</div>
<div>
<details open><summary>Палитра текста (top ${r.tokens.paletteFg.length})</summary>
<table><caption>Цвета текста</caption>
<thead><tr><th>Цвет</th><th class="num">α</th><th class="num">Count</th><th class="num">L</th><th class="num">Contrast</th></tr></thead>
<tbody>${fgRows}</tbody></table>
</details>
</div>
</div>

<details><summary>Текстовые пары (top 100)</summary>
<table><caption>Пары текст/фон</caption>
<thead><tr><th>FG</th><th>BG</th><th class="num">Ratio</th><th class="num">px</th><th class="num">Weight</th><th class="num">Count</th><th>Verdict</th></tr></thead>
<tbody>${pairRows}</tbody></table>
</details>

<details><summary>Типографика: размеры</summary>
<table><caption>Гистограмма font-size (px)</caption>
<thead><tr><th class="num">px</th><th class="num">Count</th></tr></thead>
<tbody>${typeRows}</tbody></table>
</details>

<details><summary>Типографика: line-height</summary>
<table><caption>Гистограмма line-height</caption>
<thead><tr><th class="num">ratio</th><th class="num">Count</th></tr></thead>
<tbody>${lhRows}</tbody></table>
</details>

<details><summary>Семейства шрифтов</summary>
<table><caption>font-family</caption>
<thead><tr><th>Family</th><th class="num">Count</th></tr></thead>
<tbody>${r.tokens.type.families.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td></tr>`).join('')}</tbody></table>
</details>

<details><summary>CSS-инвентарь</summary>
<pre class="mono">${esc(JSON.stringify({ rules: r.tokens.css.rulesTotal, mediaWidths: r.tokens.css.mediaWidths, features: r.tokens.css.features, customProps: r.tokens.css.customProps }, null, 2))}</pre>
</details>

<details><summary>Движение</summary>
<pre class="mono">${esc(JSON.stringify(r.tokens.motion, null, 2))}</pre>
</details>
</section>

<section>
<h2>H. Здоровье</h2>
<table><caption>Метрики безопасности</caption>
<thead><tr><th>ID</th><th>Значение</th><th>Ед.</th><th>Порог</th><th>Вердикт</th><th>Норма</th></tr></thead>
<tbody>${healthRows}</tbody></table>
<p><strong>H-score: ${H.score}</strong> (100 − 10×fail − 3×warn)</p>
</section>

<section>
<h2>Приложение. Среда</h2>
<details><summary>Полный срез env (${envRows.length} полей)</summary>
<table><caption>Среда исполнения</caption>
<thead><tr><th>Ключ</th><th>Значение</th></tr></thead>
<tbody>${envRows.map(([k, v]) => `<tr><td class="mono">${esc(k)}</td><td class="mono">${esc(v)}</td></tr>`).join('')}</tbody></table>
</details>
<details><summary>Карта доступности API</summary>
<table><caption>API availability</caption>
<thead><tr><th>API</th><th>Статус</th></tr></thead>
<tbody>${apiRows || '<tr><td colspan="2">нет данных</td></tr>'}</tbody></table>
</details>
</section>

<section>
<h2>Self-Audit отчёта</h2>
<table><caption>Проверка собственного контраста</caption>
<thead><tr><th>Пара</th><th>FG</th><th>BG</th><th class="num">Ratio</th><th>Вердикт</th></tr></thead>
<tbody>${selfPairs.map(p =>
  `<tr><td>${esc(p.label)}</td><td>${esc(p.f)}</td><td>${esc(p.b)}</td>` +
  `<td class="num">${p.ratio}</td><td class="${p.ok ? 'ok' : 'fail'}">${p.ok ? '[OK]' : '[FAIL]'}</td></tr>`
).join('')}</tbody></table>
</section>

<section>
<h2>Паспорт панели</h2>
<pre class="mono">${esc(JSON.stringify(pp, null, 2))}</pre>
</section>

<section>
<h2>Приватность</h2>
<p>Собрано: только структурные признаки (теги, роли, геометрия, стили computed, токены классов/ids в режиме ${esc(passport.mode)}).</p>
<p>НЕ собрано: текстовое содержимое, значения src/href/alt/value, cookie, localStorage, IndexedDB хоста, HTTP-заголовки, тела запросов.</p>
<p>Скрипт пассивен: ноль сетевых запросов, ноль передач данных третьим лицам. Все данные локальны.</p>
</section>

<footer>
<p class="mono">ssea-1 · ${esc(r.generatedAt)} · сгенерировано пользовательским скриптом SSEA-2026</p>
</footer>
</body>
</html>`;
    return html;
  }

  // ============================================================
  // UI ПАНЕЛЬ
  // ============================================================
  function createPanel() {
    const host = document.createElement('div');
    host.id = UI_ID + '-host';
    host.style.cssText = 'all:initial;position:fixed;bottom:16px;right:16px;z-index:2147483000;isolation:isolate;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
<style>
  :host, * { box-sizing: border-box; }
  .badge {
    width: 44px; height: 44px; border-radius: 50%; background: #1a5fbf; color: #fff;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    border: none; font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-family: system-ui, sans-serif;
  }
  .badge:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .panel {
    position: absolute; right: 0; bottom: 56px; width: 340px; max-width: calc(100vw - 24px);
    background: #fff; color: #1a1a1a; border: 1px solid #ccc; border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.25); padding: 12px; font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px; line-height: 1.5;
  }
  .panel[hidden] { display: none; }
  .panel h2 { margin: 0 0 8px; font-size: 15px; }
  .row { margin: 8px 0; }
  .btn {
    min-height: 44px; min-width: 44px; padding: 8px 12px; border-radius: 6px;
    border: 1px solid #888; background: #f5f5f7; cursor: pointer; font: inherit;
  }
  .btn.primary { background: #1a5fbf; color: #fff; border-color: #1a5fbf; }
  .btn:focus-visible { outline: 2px solid #1a5fbf; outline-offset: 2px; }
  .status { font-size: 12px; color: #555; min-height: 18px; }
  .drawer { margin-top: 10px; border-top: 1px solid #ddd; padding-top: 8px; }
  .drawer[hidden] { display: none; }
  label { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 13px; }
  select, input[type="checkbox"], input[type="radio"] { min-height: 24px; }
  .controls { display: flex; gap: 6px; flex-wrap: wrap; }
  .pp { font-size: 11px; color: #444; font-family: ui-monospace, monospace; white-space: pre-wrap; max-height: 140px; overflow: auto; background: #f5f5f7; padding: 6px; border-radius: 4px; }
  @media (prefers-color-scheme: dark) {
    .panel { background: #1f1f22; color: #eaeaea; border-color: #444; }
    .btn { background: #2a2a2e; color: #eaeaea; border-color: #555; }
    .btn.primary { background: #3b7fdb; border-color: #3b7fdb; }
    .pp { background: #2a2a2e; color: #cfcfcf; }
    .status { color: #a0a0a0; }
  }
</style>
<button class="badge" aria-label="SSEA-2026: панель аудита" title="SSEA-2026">🩺</button>
<div class="panel" hidden role="dialog" aria-label="Панель SSEA-2026">
  <h2>SSEA-2026</h2>
  <div class="status" aria-live="polite" id="status">Готово. Хост: <span class="host"></span></div>
  <div class="controls row">
    <button class="btn primary" id="run">Аудит сейчас</button>
    <button class="btn" id="last">Последний отчёт</button>
    <button class="btn" id="json">Экспорт JSON</button>
    <button class="btn" id="more">⚙ Ещё</button>
  </div>
  <div class="drawer" id="drawer" hidden>
    <label><input type="checkbox" id="auto"> Автосбор после загрузки</label>
    <label><input type="radio" name="mode" value="full" id="modeFull"> Полный (имена классов/ids)</label>
    <label><input type="radio" name="mode" value="anon" id="modeAnon"> Аноним (хеши)</label>
    <label>Тема: <select id="theme"><option>AUTO</option><option>LIGHT</option><option>DARK</option></select></label>
    <label>Кегль: <select id="fs"><option value="14">S14</option><option value="16" selected>M16</option><option value="18">L18</option><option value="21">XL21</option></select></label>
    <label><input type="checkbox" id="gpu"> GPU-детали (WebGL/WebGPU)</label>
    <div class="controls">
      <button class="btn" id="clear">Очистить хранилище</button>
      <button class="btn" id="selftest">Самотест</button>
    </div>
    <div class="row"><strong>Паспорт панели</strong><div class="pp" id="pp"></div></div>
  </div>
</div>
`;
    document.documentElement.appendChild(host);

    const $ = (sel) => root.querySelector(sel);
    const badge = $('.badge');
    const panel = $('.panel');
    const status = $('#status');
    const drawer = $('#drawer');
    const ppBox = $('#pp');
    const hostSpan = $('.host');
    hostSpan.textContent = safe(() => location.hostname, '');

    function setStatus(txt) { status.firstChild && (status.lastChild.textContent = ''); status.innerHTML = ''; status.append(document.createTextNode(txt + ' ')); const h = document.createElement('span'); h.className = 'host'; h.textContent = safe(() => location.hostname, ''); status.append(h); }

    // restore settings
    state.auto = readLS('auto', '1') === '1';
    state.mode = readLS('mode', 'full');
    state.theme = readLS('theme', 'AUTO');
    state.fontSize = parseInt(readLS('fs', '16'), 10) || 16;
    state.gpu = readLS('gpu', '0') === '1';
    $('#auto').checked = state.auto;
    if (state.mode === 'anon') $('#modeAnon').checked = true; else $('#modeFull').checked = true;
    $('#theme').value = state.theme;
    $('#fs').value = String(state.fontSize);
    $('#gpu').checked = state.gpu;

    badge.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      updatePP();
    });
    $('#more').addEventListener('click', () => { drawer.hidden = !drawer.hidden; updatePP(); });

    $('#auto').addEventListener('change', (e) => { state.auto = e.target.checked; writeLS('auto', state.auto ? '1' : '0'); });
    $('#modeFull').addEventListener('change', () => { if ($('#modeFull').checked) { state.mode = 'full'; writeLS('mode', 'full'); } });
    $('#modeAnon').addEventListener('change', () => { if ($('#modeAnon').checked) { state.mode = 'anon'; writeLS('mode', 'anon'); } });
    $('#theme').addEventListener('change', (e) => { state.theme = e.target.value; writeLS('theme', state.theme); });
    $('#fs').addEventListener('change', (e) => { state.fontSize = parseInt(e.target.value, 10); writeLS('fs', String(state.fontSize)); updatePP(); });
    $('#gpu').addEventListener('change', (e) => { state.gpu = e.target.checked; writeLS('gpu', state.gpu ? '1' : '0'); });

    $('#run').addEventListener('click', async () => {
      setStatus('Сбор…');
      try {
        const rep = await collect();
        state.lastReport = rep;
        const id = 'r_' + Date.now();
        await Store.put({ id, ts: Date.now(), host: safe(() => location.hostname, ''), report: rep });
        setStatus('Готово. H-score: ' + rep.health.score);
      } catch (e) {
        setStatus('Ошибка: ' + (e && e.message || e));
      }
    });

    $('#last').addEventListener('click', async () => {
      const list = await Store.list();
      if (!list.length) { setStatus('Отчётов нет.'); return; }
      list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const last = list[0];
      state.lastReport = last.report;
      const html = buildHTML(last.report, buildPanelPassport());
      openInTab(html, last.host, 'html');
      setStatus('Открыт последний отчёт.');
    });

    $('#json').addEventListener('click', async () => {
      const list = await Store.list();
      if (!list.length) { setStatus('Отчётов нет.'); return; }
      list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const last = list[0];
      const json = JSON.stringify(last.report, null, 2);
      downloadText(json, filenameFor(last.host, 'json'), 'application/json');
      setStatus('JSON экспортирован.');
    });

    $('#clear').addEventListener('click', async () => {
      await Store.clearAll();
      setStatus('Хранилище очищено.');
    });

    $('#selftest').addEventListener('click', () => {
      const res = selfTest();
      setStatus('Самотест: ' + (res.ok ? 'OK' : 'FAIL: ' + res.msgs.join('; ')));
    });

    function buildPanelPassport() {
      const p = {};
      const panelCs = safe(() => getComputedStyle(root.querySelector('.panel')), null);
      if (panelCs) {
        p.fontSize = panelCs.fontSize;
        p.lineHeight = panelCs.lineHeight;
        const fgC = parseColor(panelCs.color);
        const bgC = parseColor(panelCs.backgroundColor);
        if (fgC && bgC) p.contrast = Math.round(contrastRatio(fgC, bgC) * 100) / 100;
      }
      p.minTouchTargetPx = 44;
      p.networkRequests = 0;
      p.storageUsageBytes = null;
      try { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { p.storageUsageBytes = e.usage; updatePP(); }); } catch (_) {}
      return p;
    }

    function updatePP() {
      const p = buildPanelPassport();
      ppBox.textContent = JSON.stringify(p, null, 2);
    }
    updatePP();

    // Alt+D — аудит сейчас
    document.addEventListener('keydown', (e) => {
      if (!e.altKey || e.key.toLowerCase() !== 'd') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      $('#run').click();
    }, true);

    return { host, panel, status };
  }

  function openInTab(html, host, ext) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (!w) {
        // popup blocked — trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = filenameFor(host, ext);
        a.style.display = 'none';
        document.documentElement.appendChild(a);
        a.click();
        setTimeout(() => { try { a.remove(); } catch (_) {} }, 100);
      }
    } catch (_) {
      // fallback: download
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameFor(host, ext);
      document.documentElement.appendChild(a);
      a.click();
      setTimeout(() => { try { a.remove(); } catch (_) {} }, 100);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function downloadText(text, filename, mime) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.documentElement.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); } catch (_) {} URL.revokeObjectURL(url); }, 1500);
  }

  function filenameFor(host, ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const s = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + '-' +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds());
    const h = String(host || 'host').replace(/[^a-z0-9.-]/gi, '_').slice(0, 60);
    return 'ssea-' + h + '-' + s + '.' + ext;
  }

  // ============================================================
  // 11. САМОТЕСТ
  // ============================================================
  function selfTest() {
    const msgs = [];
    // contrast ratio: black on white
    const c1 = contrastRatio([0, 0, 0], [255, 255, 255]);
    if (Math.abs(c1 - 21) > 0.05) msgs.push('contrast white/black ' + c1);
    const c2 = contrastRatio([255, 255, 255], [0, 0, 0]);
    if (Math.abs(c2 - 21) > 0.05) msgs.push('contrast reverse ' + c2);
    const c3 = contrastRatio([255, 0, 0], [255, 255, 255]);
    if (c3 < 3.9 || c3 > 4.1) msgs.push('contrast red/white ' + c3.toFixed(3));
    // blendOver
    const b = blendOver([255, 0, 0, 0.5], [0, 0, 255, 1]);
    if (b[0] !== 128 || b[1] !== 0 || b[2] !== 128) msgs.push('blend ' + b.join(','));
    // fnv
    const h = fnv1a64('a').slice(0, 8);
    if (h !== 'af63dc4c') msgs.push('fnv1a64(8)=' + h + ' (ожидалось af63dc4c… от 64-bit)');
    // parseColor
    const pc = parseColor('rgba(10, 20, 30, 0.5)');
    if (!pc || pc[0] !== 10 || pc[1] !== 20 || pc[2] !== 30 || Math.abs(pc[3] - 0.5) > 0.001) msgs.push('parseColor rgba');
    const ph = parseColor('#abc');
    if (!ph || ph[0] !== 170 || ph[1] !== 187 || ph[2] !== 204) msgs.push('parseColor #abc');
    // validateReport
    const dummy = { schema: 'ssea-1', generatedAt: 'x', url: { origin: 'x' }, env: { client: {} }, struct: { dom: {} }, tokens: { pageBg: {} }, health: { score: 0 }, passport: {} };
    const errs = validateReport(dummy);
    if (errs.length) msgs.push('validate: ' + errs.join(','));
    return { ok: msgs.length === 0, msgs };
  }

  // ============================================================
  // 1.6. ИНТЕГРАЦИОННЫЙ КОНТРАКТ
  // ============================================================
  const api = {
    async collect() { return await collect(); },
    last() { return state.lastReport; },
    async list() { return await Store.list(); },
    async exportJSON(id) {
      const rec = await Store.get(id);
      if (!rec) return null;
      return JSON.stringify(rec.report, null, 2);
    },
    async openReport(id) {
      const rec = await Store.get(id);
      if (!rec) return null;
      const html = buildHTML(rec.report, {});
      openInTab(html, rec.host, 'html');
      return true;
    },
    setMode(m) { if (m === 'full' || m === 'anon') { state.mode = m; writeLS('mode', m); } },
    setAuto(b) { state.auto = !!b; writeLS('auto', b ? '1' : '0'); },
    selftest() { return selfTest(); }
  };
  try { window.__SSEA__ = api; } catch (_) {}

  // ============================================================
  // СТАРТ
  // ============================================================
  safe(() => createPanel());

  function boot() {
    if (!state.auto) return;
    const run = async () => {
      try {
        const rep = await collect();
        state.lastReport = rep;
        const id = 'r_' + Date.now();
        await Store.put({ id, ts: Date.now(), host: safe(() => location.hostname, ''), report: rep });
      } catch (_) {}
    };
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => run(), { timeout: 4000 });
    } else {
      setTimeout(run, 2000);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 300);
  } else {
    window.addEventListener('load', () => setTimeout(boot, 300), { once: true });
  }

  // ============================================================
  // ADR (Architecture Decision Records)
  // ============================================================
  // ADR-001. Storage: IndexedDB + LS fallback.
  //   Контекст: @grant none, шифрование не требуется, отчёты до 5 МБ.
  //   Решение: IDB 'ssea-db' (store 'reports'), fallback — localStorage с префиксом 'ssea_'.
  //   Последствие: FIFO 50, единый интерфейс Store.put/list/get/remove.
  //
  // ADR-002. Один read-pass DOM.
  //   Контекст: layout-thrashing, бюджет 300 мс.
  //   Решение: единый обход с getBoundingClientRect + getComputedStyle внутри, без чередования записи.
  //   Последствие: MAX_NODES=20000, WALK_BUDGET_MS=300, trunc флаг.
  //
  // ADR-003. Анонимизация токенов.
  //   Контекст: id/классы — структурные признаки, могут быть PII.
  //   Решение: FNV-1a-64 с per-site солью (localStorage 'ssea_salt') + обрезка до 10 hex.
  //   Последствие: в anon-режиме имена заменены хешами; соль хранится локально.
  //
  // ADR-004. Paint layers — v1 approximate.
  //   Контекст: точное дерево stacking contexts требует полной обр. спецификации CSS.
  //   Решение: линейная оценка по правилам CSS paint order, флаг estimate:true.
  //   Последствие: coversViewportPct и areaPct — аппроксимации; ребёнок-контексты считаются приближённо.
  //
  // ADR-005. UI в Shadow DOM.
  //   Контекст: конфликты стилей хоста.
  //   Решение: attachShadow({mode:'open'}), id-prefix 'ssea-2026-', z-index <= 2147483000.
  //   Последствие: полная изоляция; -- переменные хоста не наследуются.
  //
  // ADR-006. Отсутствие сетевых запросов.
  //   Контекст: приватность by construction.
  //   Решение: в коде нет fetch/XHR/WebSocket/EventSource/sendBeacon/import()/dynamic <script>.
  //   Последствие: экспорт отчёта — Blob + <a download> / window.open(blob:).
  //
  // DEVIATION: пункт 5.7.4 (exploded stack SVG в HTML) — не реализовано в v1;
  //   причина: недостаток бюджета ответа LLM; данные (contexts, z-индексы, rect) присутствуют
  //   в JSON и таблице секции C, что позволяет построить SVG позже без изменения схемы ssea-1.
  //
  // DEVIATION: пункт 5.9 (MutationObserver, окно 10 с) — не реализовано;
  //   причина: v1 запрещает установку наблюдателей на страницу (10.1); при включении опции
  //   пользователем будет добавлено в v1.1 без изменения схемы.
  //
  // DEVIATION: пункт 9 H10 (доля текстовых блоков > 90ch) — значение null в v1;
  //   причина: корректный расчёт требует измерения ширины текстовых блоков и медианы ширины
  //   глифа; v1 ограничивается структурными метриками. Поле присутствует в схеме.
  //
  // DEVIATION: 8.6 «тёплая палитра после 20:00» — реализовано только как опция темы
  //   (переключатель), авто-переключение по времени не включено по умолчанию во избежание
  //   неожиданного изменения внешнего вида без согласия пользователя.
  // ============================================================
})();
```
Продолжаю. **Часть 3: Модуль S (Каркас страницы)** — обход DOM, сбор структурных данных, таблиц, форм, CSS-инвентарь и слоёвая модель.

---

```javascript
// ==================== МОДУЛЬ S: КАРКАС СТРАНИЦЫ ====================

const PageStructure = (function() {
  // Состояние обхода
  const state = {
    nodeCount: 0,
    depth: 0,
    truncated: false,
    limitsHit: [],
    shadowRoots: new WeakSet(),
    visitedIframes: new Set()
  };

  // Сброс состояния
  function resetState() {
    state.nodeCount = 0;
    state.depth = 0;
    state.truncated = false;
    state.limitsHit = [];
    state.shadowRoots = new WeakSet();
    state.visitedIframes = new Set();
  }

  // Основной метод сбора
  function collect() {
    resetState();
    const startTime = performance.now();

    const result = {
      tree: null,
      layers: null,
      cssInventory: null,
      colorMap: null,
      tables: [],
      forms: [],
      ia: null, // Информационная архитектура (5.8)
      timings: {
        walk: 0,
        geometry: 0,
        css: 0,
        layers: 0
      },
      limits: [...state.limitsHit]
    };

    try {
      // Сбор дерева DOM
      const walkStart = performance.now();
      result.tree = collectTree();
      result.timings.walk = performance.now() - walkStart;

      // Сбор геометрии (пакетированно)
      const geometryStart = performance.now();
      result.tree = collectGeometry(result.tree);
      result.timings.geometry = performance.now() - geometryStart;

      // Сбор CSS-инвентаря
      const cssStart = performance.now();
      result.cssInventory = collectCSSInventory();
      result.timings.css = performance.now() - cssStart;

      // Сбор цветовой карты
      result.colorMap = collectColorMap(result.tree, result.cssInventory);

      // Сбор слоёв (5.7)
      const layersStart = performance.now();
      result.layers = collectLayers(result.tree);
      result.timings.layers = performance.now() - layersStart;

      // Сбор таблиц
      result.tables = collectTables(result.tree);

      // Сбор форм
      result.forms = collectForms(result.tree);

      // Информационная архитектура
      result.ia = collectInformationArchitecture(result.tree);

      // Динамика (опционально, выключено по умолчанию)
      result.dynamics = null;

    } catch (e) {
      console.error('[PSP-1] Ошибка в модуле S:', e);
      result.error = e.message;
    }

    result.timings.total = performance.now() - startTime;
    return result;
  }

  // --- Обход DOM (5.1) ---

  /**
   * Итеративный DFS на стеке (рекурсия ЗАПРЕЩЕНА)
   * Лимиты: глубина 64, 20 000 узлов
   */
  function collectTree() {
    const root = document.documentElement;
    if (!root) return null;

    const stack = [{
      node: root,
      depth: 0,
      path: '0',
      parent: null
    }];

    const nodes = [];
    state.nodeCount = 0;

    while (stack.length > 0 && state.nodeCount < PSP1.MAX_NODES) {
      const { node, depth, path, parent } = stack.pop();

      // Проверка глубины
      if (depth > PSP1.MAX_DEPTH) {
        if (!state.limitsHit.includes('MAX_DEPTH')) {
          state.limitsHit.push('MAX_DEPTH');
        }
        continue;
      }

      // Обработка узла
      const nodeData = processNode(node, depth, path, parent);
      if (nodeData) {
        nodes.push(nodeData);
        state.nodeCount++;
      }

      // Добавляем дочерние узлы в стек (в обратном порядке для DFS)
      const children = getChildren(node);
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        if (state.nodeCount >= PSP1.MAX_NODES) {
          if (!state.limitsHit.includes('MAX_NODES')) {
            state.limitsHit.push('MAX_NODES');
          }
          break;
        }

        stack.push({
          node: child,
          depth: depth + 1,
          path: `${path}.${i}`,
          parent: node
        });
      }
    }

    if (state.nodeCount >= PSP1.MAX_NODES) {
      state.truncated = true;
    }

    return nodes;
  }

  function getChildren(node) {
    const children = [];

    // Обычные дочерние элементы
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      // Пропускаем неэлементные узлы и специальные элементы (5.1)
      if (child.nodeType === Node.ELEMENT_NODE &&
          !isExcludedElement(child)) {
        children.push(child);
      }
    }

    // Shadow DOM
    if (node.shadowRoot && !state.shadowRoots.has(node.shadowRoot)) {
      state.shadowRoots.add(node.shadowRoot);
      for (let i = 0; i < node.shadowRoot.children.length; i++) {
        const child = node.shadowRoot.children[i];
        if (child.nodeType === Node.ELEMENT_NODE &&
            !isExcludedElement(child)) {
          children.push(child);
        }
      }
    }

    // Iframe (same-origin)
    if (node.tagName === 'IFRAME') {
      try {
        const iframeDoc = node.contentDocument;
        if (iframeDoc && iframeDoc.documentElement &&
            !state.visitedIframes.has(node)) {
          state.visitedIframes.add(node);
          const iframeId = `iframe_${state.visitedIframes.size}`;
          children.push({
            node: iframeDoc.documentElement,
            tagName: 'IFRAME_ROOT',
            iframeId: iframeId,
            iframeNode: node,
            isIframe: true
          });
        }
      } catch (e) {
        // Cross-origin iframe - терминальный узел
        children.push({
          node: null,
          tagName: 'IFRAME',
          origin: getIframeOrigin(node),
          isIframe: true,
          isCrossOrigin: true
        });
      }
    }

    return children;
  }

  function isExcludedElement(node) {
    const tag = node.tagName.toLowerCase();
    // 5.1: <template>/<script>/<style>/<noscript>/<link>/<meta> — в дерево не входят
    const excludedTags = ['template', 'script', 'style', 'noscript', 'link', 'meta'];
    return excludedTags.includes(tag);
  }

  function getIframeOrigin(iframe) {
    try {
      if (iframe.src) {
        const url = new URL(iframe.src);
        return url.hostname;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  /**
   * Обработка отдельного узла (5.2)
   */
  function processNode(node, depth, path, parent) {
    if (!node || !node.nodeType || node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    // Для iframe root
    if (node.isIframe) {
      if (node.isCrossOrigin) {
        return {
          type: 'iframe',
          tag: 'iframe',
          origin: node.origin,
          path: path,
          depth: depth,
          bbox: null,
          isCrossOrigin: true,
          truncated: state.truncated
        };
      }
      // Same-origin iframe root
      return processElement(node.node, depth, path, parent, true);
    }

    return processElement(node, depth, path, parent, false);
  }

  function processElement(element, depth, path, parent, isIframeRoot) {
    const tag = element.tagName.toLowerCase();

    // Геометрия (пока заглушка, будет заполнена позже)
    const bbox = null;

    // Видимость (5.2)
    const visibility = getVisibility(element);

    // Стековые признаки (5.2)
    const stackingFeatures = getStackingFeatures(element);

    // Структурные ARIA (5.2)
    const aria = getARIAAttributes(element);

    // Интерактивность (5.2)
    const interactivity = getInteractivity(element);

    // Класс ссылки (5.2)
    const linkInfo = getLinkInfo(element);

    // Классы и ID (2.4 - хеширование)
    const classTokens = getClassTokens(element);
    const idHash = element.id ? {
      hash: fnv1a32(element.id),
      length: element.id.length
    } : null;

    // Инлайн-стиль
    const inlineStyle = getInlineStyleInfo(element);

    // Роль и landmark
    const roleInfo = getRoleInfo(element);

    return {
      type: 'element',
      tag: tag,
      namespace: element.namespaceURI || 'html',
      path: path,
      depth: depth,
      bbox: bbox, // Будет заполнено позже
      visibility: visibility,
      stacking: stackingFeatures,
      aria: aria,
      interactivity: interactivity,
      link: linkInfo,
      classes: classTokens,
      id: idHash,
      inlineStyle: inlineStyle,
      role: roleInfo.role,
      landmark: roleInfo.landmark,
      heading: roleInfo.heading,
      isIframeRoot: isIframeRoot,
      truncated: state.truncated
    };
  }

  function getVisibility(element) {
    const style = window.getComputedStyle(element);

    if (style.display === 'none') {
      return 'hidden';
    }

    if (style.visibility === 'hidden') {
      return 'invisible';
    }

    if (parseFloat(style.opacity) < 0.05) {
      return 'transparent';
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return 'clipped';
    }

    // Проверка на offscreen
    if (rect.right < 0 || rect.bottom < 0 ||
        rect.left > window.innerWidth || rect.top > window.innerHeight) {
      return 'offscreen';
    }

    return 'displayed';
  }

  function getStackingFeatures(element) {
    const style = window.getComputedStyle(element);
    const features = [];

    if (style.position !== 'static') {
      features.push(`position:${style.position}`);
      if (style.zIndex !== 'auto') {
        features.push(`z-index:${style.zIndex}`);
      }
    }

    if (parseFloat(style.opacity) < 1) {
      features.push(`opacity:${style.opacity}`);
    }

    if (style.transform !== 'none') {
      features.push(`transform:${style.transform}`);
    }

    if (style.filter !== 'none') {
      features.push(`filter:${style.filter}`);
    }

    if (style.backdropFilter !== 'none') {
      features.push(`backdrop-filter:${style.backdropFilter}`);
    }

    if (style.willChange && style.willChange !== 'auto') {
      features.push(`will-change:${style.willChange}`);
    }

    if (style.isolation === 'isolate') {
      features.push('isolation:isolate');
    }

    if (style.mixBlendMode !== 'normal') {
      features.push(`mix-blend-mode:${style.mixBlendMode}`);
    }

    if (style.contain && style.contain !== 'none') {
      features.push(`contain:${style.contain}`);
    }

    return features;
  }

  function getARIAAttributes(element) {
    const attrs = {};

    const ariaAttrs = [
      'hidden', 'expanded', 'current', 'level', 'posinset', 'setsize',
      'live', 'busy', 'modal'
    ];

    ariaAttrs.forEach(attr => {
      const value = element.getAttribute(`aria-${attr}`);
      if (value !== null) {
        attrs[attr] = value;
      }
    });

    return attrs;
  }

  function getInteractivity(element) {
    const result = {
      tabindex: element.tabIndex,
      disabled: element.disabled,
      readonly: element.readOnly
    };

    // Для input/textarea/select
    if (['input', 'textarea', 'select'].includes(element.tagName.toLowerCase())) {
      result.type = element.type;
    }

    return result;
  }

  function getLinkInfo(element) {
    if (element.tagName.toLowerCase() !== 'a') {
      return null;
    }

    const href = element.getAttribute('href');
    if (!href) {
      return {
        type: 'no-href'
      };
    }

    try {
      const url = new URL(href, window.location.href);
      const currentHost = window.location.hostname;

      if (url.hostname === currentHost) {
        if (href.startsWith('#')) {
          return {
            type: 'in-page-anchor',
            hostname: currentHost
          };
        }
        return {
          type: 'internal',
          hostname: currentHost
        };
      } else {
        return {
          type: 'external',
          hostname: url.hostname
        };
      }
    } catch (e) {
      // JavaScript или другие схемы
      if (href.startsWith('javascript:')) {
        return {
          type: 'javascript'
        };
      } else if (href.startsWith('mailto:')) {
        return {
          type: 'mailto'
        };
      } else if (href.startsWith('tel:')) {
        return {
          type: 'tel'
        };
      } else if (href.startsWith('blob:')) {
        return {
          type: 'blob'
        };
      } else {
        return {
          type: 'other'
        };
      }
    }
  }

  function getClassTokens(element) {
    const classList = element.classList;
    const tokens = [];

    for (let i = 0; i < classList.length; i++) {
      tokens.push(classList[i]);
    }

    return tokens;
  }

  function getInlineStyleInfo(element) {
    const style = element.style;
    let count = 0;

    for (let i = 0; i < style.length; i++) {
      count++;
    }

    return {
      hasInlineStyle: count > 0,
      declarationCount: count
    };
  }

  function getRoleInfo(element) {
    const tag = element.tagName.toLowerCase();
    let role = null;
    let landmark = null;
    let heading = null;

    // Явная роль
    const explicitRole = element.getAttribute('role');
    if (explicitRole) {
      role = explicitRole;
    }

    // Имплицитная роль по HTML-ARIA
    const implicitRoles = {
      header: 'banner',
      nav: 'navigation',
      main: 'main',
      aside: 'complementary',
      footer: 'contentinfo',
      form: 'form',
      section: 'region',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading'
    };

    if (implicitRoles[tag]) {
      if (!role) role = implicitRoles[tag];
      if (['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'region'].includes(implicitRoles[tag])) {
        landmark = implicitRoles[tag];
      }
    }

    // Уровень заголовка
    if (tag.match(/^h[1-6]$/)) {
      heading = parseInt(tag.substring(1));
    } else if (role === 'heading') {
      const level = element.getAttribute('aria-level');
      if (level) {
        heading = parseInt(level);
      }
    }

    // Для region с именем
    if (landmark === 'region' && element.getAttribute('aria-label')) {
      landmark = 'region(named)';
    }

    return { role, landmark, heading };
  }

  // --- Сбор геометрии (пакетированно) ---

  function collectGeometry(nodes) {
    if (!nodes || nodes.length === 0) return nodes;

    // Группируем узлы по уровням для пакетированного чтения
    const batches = [];
    const batchSize = 50; // Чтение по 50 узлов за раз

    for (let i = 0; i < nodes.length; i += batchSize) {
      batches.push(nodes.slice(i, i + batchSize));
    }

    // Обрабатываем каждый пакет
    for (const batch of batches) {
      const elements = batch.map(node => {
        // Для iframe root
        if (node.isIframeRoot) {
          return node.iframeNode || node.node;
        }
        return node.type === 'element' ? node.node : null;
      }).filter(Boolean);

      if (elements.length === 0) continue;

      // Пакетированное чтение
      const results = batchReadGeometry(elements, (el, rect) => {
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        };
      });

      // Применяем результаты к узлам
      for (let i = 0; i < batch.length && i < results.length; i++) {
        if (results[i]) {
          batch[i].bbox = results[i];
        }
      }
    }

    return nodes;
  }

  // --- Сбор CSS-инвентаря (5.6) ---

  function collectCSSInventory() {
    const result = {
      sheets: [],
      rulesTotal: 0,
      mediaQueries: [],
      supportsQueries: [],
      containerQueries: [],
      layers: [],
      propertyRegistrations: [],
      selectors: {
        class: 0,
        id: 0,
        tag: 0,
        attribute: 0,
        pseudoClass: 0,
        pseudoElement: 0,
        universal: 0,
        compound: 0
      },
      specificity: {
        avg: { a: 0, b: 0, c: 0 },
        max: { a: 0, b: 0, c: 0 }
      },
      importantCount: 0,
      inlineDeclarations: 0,
      customProperties: new Map(),
      units: {
        px: 0, rem: 0, em: 0, '%': 0, vw: 0, vh: 0, dvh: 0, svh: 0, lvh: 0,
        ch: 0, ex: 0, fr: 0, cm: 0, mm: 0, in: 0, pt: 0, q: 0,
        deg: 0, rad: 0, turn: 0
      },
      functions: {
        calc: 0, min: 0, max: 0, clamp: 0,
        'fit-content': 0, 'min-content': 0, 'max-content': 0,
        var: 0, env: 0, 'color-mix': 0, oklch: 0, oklab: 0,
        lab: 0, lch: 0, 'color()': 0, hsl: 0, rgb: 0
      }
    };

    try {
      // Обработка document.styleSheets
      const sheets = document.styleSheets;
      for (let i = 0; i < sheets.length && i < PSP1.MAX_CSS_RULES; i++) {
        const sheet = sheets[i];
        const sheetData = processStyleSheet(sheet, i);
        if (sheetData) {
          result.sheets.push(sheetData);
          result.rulesTotal += sheetData.rules;
        }
      }

      // Сбор кастомных свойств из computed styles
      collectCustomPropertiesFromDOM(result);

    } catch (e) {
      console.warn('[PSP-1] Ошибка при сборе CSS:', e.message);
    }

    return result;
  }

  function processStyleSheet(sheet, index) {
    try {
      if (!sheet.cssRules) {
        // Cross-origin стили
        return {
          index: index,
          href: sheet.href || null,
          accessible: false,
          rules: 0,
          type: sheet.type || 'text/css'
        };
      }

      const rules = [];
      let ruleCount = 0;
      const maxRules = Math.min(sheet.cssRules.length, PSP1.MAX_CSS_RULES);

      for (let i = 0; i < maxRules; i++) {
        const rule = sheet.cssRules[i];
        processCSSRule(rule, rules);
        ruleCount++;
      }

      return {
        index: index,
        href: sheet.href || null,
        accessible: true,
        rules: ruleCount,
        type: sheet.type || 'text/css',
        parsedRules: rules
      };
    } catch (e) {
      return {
        index: index,
        href: sheet.href || null,
        accessible: false,
        rules: 0,
        type: sheet.type || 'text/css'
      };
    }
  }

  function processCSSRule(rule, rules) {
    switch (rule.type) {
      case CSSRule.STYLE_RULE:
        processStyleRule(rule);
        break;

      case CSSRule.MEDIA_RULE:
        processMediaRule(rule);
        break;

      case CSSRule.SUPPORTS_RULE:
        processSupportsRule(rule);
        break;

      case CSSRule.CONTAINER_RULE:
        processContainerRule(rule);
        break;

      case CSSRule.IMPORT_RULE:
      case CSSRule.FONT_FACE_RULE:
      case CSSRule.KEYFRAMES_RULE:
      case CSSRule.KEYFRAME_RULE:
        // Пока пропускаем
        break;

      case CSSRule.AT_RULE:
        // Обработка @layer и @property
        if (rule.name === 'layer') {
          // Сбор имён слоёв
        } else if (rule.name === 'property') {
          // Сбор регистраций свойств
        }
        break;
    }
  }

  function processStyleRule(rule) {
    // Анализ селекторов
    const selectors = rule.selectorText ? rule.selectorText.split(',') : [];
    for (const selector of selectors) {
      analyzeSelector(selector.trim());
    }

    // Анализ стиля
    if (rule.style) {
      analyzeStyle(rule.style.cssText);
    }
  }

  function analyzeSelector(selector) {
    // Упрощённый анализ селекторов
    // В реальности нужно полноценное парсинг
    if (selector.includes('.')) {
      result.selectors.class++;
    }
    if (selector.includes('#')) {
      result.selectors.id++;
    }
    if (selector.match(/^[a-zA-Z]+$/)) {
      result.selectors.tag++;
    }
    if (selector.includes('[')) {
      result.selectors.attribute++;
    }
    if (selector.includes(':')) {
      if (selector.includes('::')) {
        result.selectors.pseudoElement++;
      } else {
        result.selectors.pseudoClass++;
      }
    }
    if (selector === '*') {
      result.selectors.universal++;
    }
    if (selector.includes(' ')) {
      result.selectors.compound++;
    }
  }

  let result = {}; // Для доступа из analyzeSelector и analyzeStyle

  function initCSSAnalysis() {
    result = {
      selectors: {
        class: 0, id: 0, tag: 0, attribute: 0,
        pseudoClass: 0, pseudoElement: 0, universal: 0, compound: 0
      },
      units: {
        px: 0, rem: 0, em: 0, '%': 0, vw: 0, vh: 0, dvh: 0, svh: 0, lvh: 0,
        ch: 0, ex: 0, fr: 0, cm: 0, mm: 0, in: 0, pt: 0, q: 0,
        deg: 0, rad: 0, turn: 0
      },
      functions: {
        calc: 0, min: 0, max: 0, clamp: 0,
        'fit-content': 0, 'min-content': 0, 'max-content': 0,
        var: 0, env: 0, 'color-mix': 0, oklch: 0, oklab: 0,
        lab: 0, lch: 0, 'color()': 0, hsl: 0, rgb: 0
      },
      importantCount: 0,
      customProperties: new Map()
    };
  }

  function analyzeStyle(cssText) {
    // Поиск !important
    const importantMatches = cssText.match(/!important/gi);
    if (importantMatches) {
      result.importantCount += importantMatches.length;
    }

    // Поиск единиц
    const unitPatterns = {
      px: /(\d+\.?\d*)px/gi,
      rem: /(\d+\.?\d*)rem/gi,
      em: /(\d+\.?\d*)em/gi,
      '%': /(\d+\.?\d*)%/gi,
      vw: /(\d+\.?\d*)vw/gi,
      vh: /(\d+\.?\d*)vh/gi,
      dvh: /(\d+\.?\d*)dvh/gi,
      svh: /(\d+\.?\d*)svh/gi,
      lvh: /(\d+\.?\d*)lvh/gi,
      ch: /(\d+\.?\d*)ch/gi,
      ex: /(\d+\.?\d*)ex/gi,
      fr: /(\d+\.?\d*)fr/gi,
      cm: /(\d+\.?\d*)cm/gi,
      mm: /(\d+\.?\d*)mm/gi,
      'in': /(\d+\.?\d*)in/gi,
      pt: /(\d+\.?\d*)pt/gi,
      q: /(\d+\.?\d*)q/gi,
      deg: /(\d+\.?\d*)deg/gi,
      rad: /(\d+\.?\d*)rad/gi,
      turn: /(\d+\.?\d*)turn/gi
    };

    for (const [unit, pattern] of Object.entries(unitPatterns)) {
      const matches = cssText.match(pattern);
      if (matches) {
        result.units[unit] += matches.length;
      }
    }

    // Поиск функций
    const functionPatterns = {
      calc: /calc\(/gi,
      min: /min\(/gi,
      max: /max\(/gi,
      clamp: /clamp\(/gi,
      'fit-content': /fit-content\(/gi,
      'min-content': /min-content\(/gi,
      'max-content': /max-content\(/gi,
      var: /var\(/gi,
      env: /env\(/gi,
      'color-mix': /color-mix\(/gi,
      oklch: /oklch\(/gi,
      oklab: /oklab\(/gi,
      lab: /lab\(/gi,
      lch: /lch\(/gi,
      'color()': /color\(/gi,
      hsl: /hsl\(/gi,
      rgb: /rgb\(/gi
    };

    for (const [func, pattern] of Object.entries(functionPatterns)) {
      const matches = cssText.match(pattern);
      if (matches) {
        result.functions[func] += matches.length;
      }
    }

    // Поиск кастомных свойств
    const varMatches = cssText.match(/--[a-zA-Z0-9_-]+/gi);
    if (varMatches) {
      for (const prop of varMatches) {
        result.customProperties.set(prop, (result.customProperties.get(prop) || 0) + 1);
      }
    }
  }

  function collectCustomPropertiesFromDOM(result) {
    // Сбор из computed styles элементов
    // Ограничиваемся первыми 1000 элементами
    const elements = document.querySelectorAll('*');
    const limit = Math.min(elements.length, 1000);

    for (let i = 0; i < limit; i++) {
      const el = elements[i];
      try {
        const style = window.getComputedStyle(el);
        const cssText = style.cssText;

        // Поиск var()
        const varMatches = cssText.match(/var\(--[a-zA-Z0-9_-]+\)/gi);
        if (varMatches) {
          for (const match of varMatches) {
            const prop = match.match(/--[a-zA-Z0-9_-]+/)?.[0];
            if (prop) {
              result.customProperties.set(prop, (result.customProperties.get(prop) || 0) + 1);
            }
          }
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    }
  }

  // --- Сбор цветовой карты (5.6.4-5.6.7) ---

  function collectColorMap(nodes, cssInventory) {
    const result = {
      uniqueColors: new Map(), // hex -> { count, area, L, C, H, a }
      textPairs: [], // { fg, bg, ratio, area, Lc }
      effectiveFgBg: [], // { elementPath, fg, bg, ratio, area }
      paletteBg: [],
      paletteFg: [],
      stats: {
        bgLuminance: { values: [], avg: 0, median: 0, p5: 0, p95: 0 },
        fgLuminance: { values: [], avg: 0, median: 0, p5: 0, p95: 0 },
        outOfSRGB: 0
      }
    };

    // Получаем цвет фона страницы
    const pageBg = getPageBackgroundColor();
    result.pageBg = pageBg;

    // Обрабатываем узлы
    for (const node of nodes) {
      if (!node.bbox || node.bbox.w === 0 || node.bbox.h === 0) continue;

      try {
        const element = getElementFromNode(node);
        if (!element) continue;

        // Получаем computed styles
        const style = window.getComputedStyle(element);

        // Основной цвет текста
        const color = style.color;
        const bgColor = style.backgroundColor;

        // Конвертация в RGB
        const fgRgb = parseColorToRgb(color);
        const bgRgb = parseColorToRgb(bgColor);

        if (!fgRgb || !bgRgb) continue;

        // Конвертация в OKLCH
        const fgOklch = rgbToOklch(fgRgb);
        const bgOklch = rgbToOklch(bgRgb);

        // Площадь элемента
        const area = node.bbox.w * node.bbox.h;

        // Сохраняем уникальные цвета
        saveUniqueColor(result.uniqueColors, fgRgb, fgOklch, area, 'fg');
        saveUniqueColor(result.uniqueColors, bgRgb, bgOklch, area, 'bg');

        // Эффективный фон (5.6.6)
        const effectiveBg = calculateEffectiveBackground(element, result);
        if (effectiveBg) {
          const effectiveBgRgb = parseColorToRgb(effectiveBg);
          if (effectiveBgRgb) {
            const effectiveBgOklch = rgbToOklch(effectiveBgRgb);

            // WCAG контраст
            const wcagRatio = calculateWCAGContrast(fgRgb, effectiveBgRgb);

            // APCA Lc
            const lc = calculateAPCA(fgRgb, effectiveBgRgb);

            result.effectiveFgBg.push({
              elementPath: node.path,
              fg: color,
              bg: effectiveBg,
              fgRgb: fgRgb,
              bgRgb: effectiveBgRgb,
              ratio: wcagRatio,
              lc: lc,
              area: area,
              fgOklch: fgOklch,
              bgOklch: effectiveBgOklch
            });

            // Сохраняем пару для текстовых узлов
            if (isTextNode(element)) {
              result.textPairs.push({
                fg: color,
                bg: effectiveBg,
                ratio: wcagRatio,
                lc: lc,
                area: area,
                px: parseFloat(style.fontSize) || 16,
                weight: parseFloat(style.fontWeight) || 400
              });
            }
          }
        }

      } catch (e) {
        console.warn(`[PSP-1] Ошибка при обработке узла ${node.path}:`, e.message);
      }
    }

    // Сортировка и агрегация
    finalizeColorMap(result);

    return result;
  }

  function getElementFromNode(node) {
    if (node.isIframeRoot) {
      return node.node;
    }
    if (node.type === 'element') {
      return node.node;
    }
    return null;
  }

  function parseColorToRgb(color) {
    if (!color || color === 'transparent' || color === 'inherit' || color === 'initial') {
      return null;
    }

    // Пробуем разобрать цвет
    try {
      // Для rgba()
      if (color.startsWith('rgba(')) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
          return {
            r: parseInt(match[1]) / 255,
            g: parseInt(match[2]) / 255,
            b: parseInt(match[3]) / 255,
            a: match[4] ? parseFloat(match[4]) : 1
          };
        }
      }
      // Для rgb()
      else if (color.startsWith('rgb(')) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          return {
            r: parseInt(match[1]) / 255,
            g: parseInt(match[2]) / 255,
            b: parseInt(match[3]) / 255,
            a: 1
          };
        }
      }
      // Для hex
      else if (color.startsWith('#')) {
        return hexToRgb(color);
      }
      // Для именованных цветов
      else {
        const namedColors = {
          'transparent': { r: 0, g: 0, b: 0, a: 0 },
          'black': { r: 0, g: 0, b: 0, a: 1 },
          'white': { r: 1, g: 1, b: 1, a: 1 },
          // Добавить другие именованные цвета при необходимости
        };
        return namedColors[color.toLowerCase()] || null;
      }
    } catch (e) {
      return null;
    }

    return null;
  }

  function saveUniqueColor(map, rgb, oklch, area, type) {
    const hex = rgbToHex(rgb);
    if (!hex) return;

    const key = `${type}:${hex}`;
    if (!map.has(key)) {
      map.set(key, {
        hex: hex,
        type: type,
        count: 0,
        area: 0,
        L: oklch.L,
        C: oklch.C,
        H: oklch.h,
        a: rgb.a
      });
    }

    const colorData = map.get(key);
    colorData.count++;
    colorData.area += area;
  }

  function rgbToHex(rgb) {
    if (!rgb) return null;

    const r = Math.round(rgb.r * 255);
    const g = Math.round(rgb.g * 255);
    const b = Math.round(rgb.b * 255);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function calculateEffectiveBackground(element, colorMap) {
    // Реализация альфа-композитинга снизу вверх (5.6.6)
    // Пока упрощённая версия - берём первый непрозрачный родитель
    let current = element;
    let bgColor = null;

    while (current && current !== document.documentElement) {
      try {
        const style = window.getComputedStyle(current);
        bgColor = style.backgroundColor;

        if (bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
          const rgb = parseColorToRgb(bgColor);
          if (rgb && rgb.a >= 1) {
            return bgColor;
          }
        }

        current = current.parentElement;
      } catch (e) {
        break;
      }
    }

    // Если не нашли непрозрачный фон, возвращаем фон страницы
    return colorMap.pageBg || 'white';
  }

  function getPageBackgroundColor() {
    try {
      const htmlStyle = window.getComputedStyle(document.documentElement);
      const bodyStyle = window.getComputedStyle(document.body);

      // Пробуем получить фон HTML
      let bgColor = htmlStyle.backgroundColor;
      if (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
        // Пробуем получить фон BODY
        bgColor = bodyStyle.backgroundColor;
        if (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
          return 'white';
        }
      }

      return bgColor;
    } catch (e) {
      return 'white';
    }
  }

  function isTextNode(element) {
    // Проверяем, является ли элемент текстовым контейнером
    const tag = element.tagName.toLowerCase();
    const textTags = ['p', 'span', 'div', 'a', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

    if (textTags.includes(tag)) {
      // Проверяем, есть ли текстовые дочерние узлы
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0) {
          return true;
        }
      }
    }

    return false;
  }

  function finalizeColorMap(result) {
    // Сортировка уникальных цветов по площади
    const sortedColors = Array.from(result.uniqueColors.values())
      .sort((a, b) => b.area - a.area);

    // Разделение на палитры
    result.paletteBg = sortedColors.filter(c => c.type === 'bg').slice(0, 16);
    result.paletteFg = sortedColors.filter(c => c.type === 'fg').slice(0, 16);

    // Статистика по яркости
    const bgLum = sortedColors.filter(c => c.type === 'bg').map(c => c.L);
    const fgLum = sortedColors.filter(c => c.type === 'fg').map(c => c.L);

    result.stats.bgLuminance.values = bgLum;
    result.stats.fgLuminance.values = fgLum;

    if (bgLum.length > 0) {
      result.stats.bgLuminance.avg = bgLum.reduce((a, b) => a + b, 0) / bgLum.length;
      bgLum.sort((a, b) => a - b);
      result.stats.bgLuminance.median = bgLum[Math.floor(bgLum.length / 2)];
      result.stats.bgLuminance.p5 = bgLum[Math.floor(bgLum.length * 0.05)];
      result.stats.bgLuminance.p95 = bgLum[Math.floor(bgLum.length * 0.95)];
    }

    if (fgLum.length > 0) {
      result.stats.fgLuminance.avg = fgLum.reduce((a, b) => a + b, 0) / fgLum.length;
      fgLum.sort((a, b) => a - b);
      result.stats.fgLuminance.median = fgLum[Math.floor(fgLum.length / 2)];
      result.stats.fgLuminance.p5 = fgLum[Math.floor(fgLum.length * 0.05)];
      result.stats.fgLuminance.p95 = fgLum[Math.floor(fgLum.length * 0.95)];
    }

    // Проверка на выход за пределы sRGB
    for (const color of sortedColors) {
      // Пока упрощённая проверка
      if (color.L > 1 || color.C > 0.5) {
        result.stats.outOfSRGB++;
      }
    }
  }

  // --- Сбор слоёв (5.7) ---

  function collectLayers(nodes) {
    const result = {
      layers: [],
      contextsTotal: 0,
      triggers: {
        position: 0,
        zIndex: 0,
        opacity: 0,
        transform: 0,
        filter: 0,
        backdropFilter: 0,
        willChange: 0,
        isolation: 0,
        blend: 0,
        contain: 0
      },
      willChangeProperties: new Set(),
      overlays: []
    };

    // Собираем все элементы, создающие контексты наложения
    const contextElements = [];

    for (const node of nodes) {
      if (!node.stacking || node.stacking.length === 0) continue;
      if (!node.bbox) continue;

      const element = getElementFromNode(node);
      if (!element) continue;

      const context = {
        path: node.path,
        tag: node.tag,
        reason: node.stacking,
        zIndex: getZIndex(element),
        rect: node.bbox,
        areaPct: (node.bbox.w * node.bbox.h) / (window.innerWidth * window.innerHeight) * 100,
        coversViewportPct: calculateCoverage(node.bbox),
        childContexts: 0
      };

      // Классификация слоя
      context.classification = classifyLayer(node, context);

      contextElements.push(context);

      // Сбор триггеров
      for (const feature of node.stacking) {
        if (feature.includes('position:')) {
          result.triggers.position++;
        } else if (feature.includes('z-index:')) {
          result.triggers.zIndex++;
        } else if (feature.includes('opacity:')) {
          result.triggers.opacity++;
        } else if (feature.includes('transform:')) {
          result.triggers.transform++;
        } else if (feature.includes('filter:')) {
          result.triggers.filter++;
        } else if (feature.includes('backdrop-filter:')) {
          result.triggers.backdropFilter++;
        } else if (feature.includes('will-change:')) {
          result.triggers.willChange++;
          const prop = feature.match(/will-change:([^;]+)/)?.[1];
          if (prop) {
            result.willChangeProperties.add(prop.trim());
          }
        } else if (feature === 'isolation:isolate') {
          result.triggers.isolation++;
        } else if (feature.includes('mix-blend-mode:')) {
          result.triggers.blend++;
        } else if (feature.includes('contain:')) {
          result.triggers.contain++;
        }
      }
    }

    // Сортировка по document order и z-index
    contextElements.sort((a, b) => {
      // Сначала по document order (путь)
      if (a.path < b.path) return -1;
      if (a.path > b.path) return 1;

      // Затем по z-index
      const aZ = a.zIndex !== null ? a.zIndex : 0;
      const bZ = b.zIndex !== null ? b.zIndex : 0;
      return aZ - bZ;
    });

    result.contextsTotal = contextElements.length;

    // Ограничиваем количество слоёв
    if (contextElements.length > PSP1.MAX_LAYERS) {
      result.layers = contextElements.slice(0, PSP1.MAX_LAYERS);
      result.contextsTotal = contextElements.length;
    } else {
      result.layers = contextElements;
    }

    // Сбор оверлеев (5.7.3 L5)
    result.overlays = collectOverlays(result.layers);

    // Пометка об оценке (5.7.3)
    result.estimate = true;

    return result;
  }

  function getZIndex(element) {
    try {
      const style = window.getComputedStyle(element);
      const zIndex = style.zIndex;
      if (zIndex === 'auto') return null;
      return parseInt(zIndex);
    } catch (e) {
      return null;
    }
  }

  function calculateCoverage(rect) {
    // Процент покрытия вьюпорта
    const viewportArea = window.innerWidth * window.innerHeight;
    const elementArea = rect.w * rect.h;

    // Пересечение с вьюпортом
    const x1 = Math.max(rect.x, 0);
    const y1 = Math.max(rect.y, 0);
    const x2 = Math.min(rect.x + rect.w, window.innerWidth);
    const y2 = Math.min(rect.y + rect.h, window.innerHeight);

    const intersectionWidth = Math.max(0, x2 - x1);
    const intersectionHeight = Math.max(0, y2 - y1);
    const intersectionArea = intersectionWidth * intersectionHeight;

    return (intersectionArea / viewportArea) * 100;
  }

  function classifyLayer(node, context) {
    const tag = node.tag.toLowerCase();
    const stacking = node.stacking || [];

    // L0: фоновые (html/body background, fixed-фоны)
    if (tag === 'html' || tag === 'body') {
      return 'L0';
    }

    // L5: оверлеи (dialog, popover, aria-modal, tooltip, toast, ::backdrop)
    if (tag === 'dialog' ||
        node.aria.modal === true ||
        stacking.includes('position:fixed')) {
      return 'L5';
    }

    // L3: позиционированные перекрытия (absolute/fixed/sticky с z>0)
    if (stacking.includes('position:absolute') ||
        stacking.includes('position:fixed') ||
        stacking.includes('position:sticky')) {
      if (context.zIndex > 0) {
        return 'L3';
      }
    }

    // L4: интерактивная карта (все ссылки/кнопки/поля)
    if (['a', 'button', 'input', 'select', 'textarea'].includes(tag)) {
      return 'L4';
    }

    // L6: эффектные (shadow-кастеры, blur/filter-зоны, blend-группы)
    if (stacking.includes('filter:') ||
        stacking.includes('backdrop-filter:') ||
        stacking.includes('mix-blend-mode:')) {
      return 'L6';
    }

    // L1: layout-каркасы (grid/flex-контейнеры верхних трёх уровней)
    if (node.depth <= 3) {
      const style = window.getComputedStyle(getElementFromNode(node));
      if (style.display === 'grid' || style.display === 'flex') {
        return 'L1';
      }
    }

    // L2: контентные блоки (main/section/article, крупные текстовые массивы)
    if (['main', 'section', 'article'].includes(tag) ||
        node.landmark === 'main' ||
        node.landmark === 'region' ||
        node.landmark === 'region(named)') {
      return 'L2';
    }

    // По умолчанию L2
    return 'L2';
  }

  function collectOverlays(layers) {
    const overlays = [];

    for (const layer of layers) {
      // L5: оверлеи с покрытием >= 30%
      if (layer.classification === 'L5' && layer.coversViewportPct >= 30) {
        overlays.push({
          path: layer.path,
          tag: layer.tag,
          rect: layer.rect,
          coversViewportPct: layer.coversViewportPct,
          zIndex: layer.zIndex
        });
      }
    }

    // Ограничиваем количество оверлеев
    return overlays.slice(0, 20);
  }

  // --- Сбор таблиц (5.4) ---

  function collectTables(nodes) {
    const tables = [];
    const tableElements = document.querySelectorAll('table');

    for (let i = 0; i < tableElements.length; i++) {
      const table = tableElements[i];
      const tableData = processTable(table, i);
      if (tableData) {
        tables.push(tableData);
      }
    }

    return tables;
  }

  function processTable(table, index) {
    try {
      const rows = table.rows.length;
      if (rows === 0) return null;

      let colsMax = 0;
      let thCount = 0;
      let captionExists = false;
      let theadExists = false;
      let tbodyExists = false;
      let tfootExists = false;
      let nestedTables = 0;
      let headerRowIndex = -1;

      // Собираем информацию о строках
      const rowData = [];

      for (let r = 0; r < rows; r++) {
        const row = table.rows[r];
        const cells = row.cells.length;
        colsMax = Math.max(colsMax, cells);

        let rowThCount = 0;
        let isHeaderRow = false;

        for (let c = 0; c < cells; c++) {
          const cell = row.cells[c];
          if (cell.tagName.toLowerCase() === 'th') {
            rowThCount++;
            thCount++;

            // Проверяем scope
            const scope = cell.getAttribute('scope');
            if (scope) {
              // Собираем информацию о scope
            }
          }

          // Проверяем colspan/rowspan
          const colspan = cell.colSpan || 1;
          const rowspan = cell.rowSpan || 1;
        }

        // Проверяем, является ли строка заголовком (>=60% ячеек - th)
        if (cells > 0 && rowThCount / cells >= 0.6) {
          isHeaderRow = true;
          if (headerRowIndex === -1) {
            headerRowIndex = r;
          }
        }

        rowData.push({
          cells: cells,
          thCount: rowThCount,
          isHeader: isHeaderRow
        });
      }

      // Проверяем наличие caption
      captionExists = table.querySelector('caption') !== null;
      theadExists = table.querySelector('thead') !== null;
      tbodyExists = table.querySelector('tbody') !== null;
      tfootExists = table.querySelector('tfoot') !== null;

      // Считаем вложенные таблицы
      nestedTables = table.querySelectorAll('table').length - 1; // минус сама таблица

      // Собираем информацию о ячейках (средняя длина текста)
      // ЗАПРЕЩЕНО собирать текст, поэтому считаем только количество текстовых узлов
      let totalTextLength = 0;
      let textCellCount = 0;

      for (let r = 0; r < rows; r++) {
        const row = table.rows[r];
        for (let c = 0; c < row.cells.length; c++) {
          const cell = row.cells[c];
          const textNodes = cell.querySelectorAll('text');
          // Не собираем текст, только считаем количество текстовых узлов
          const textNodeCount = cell.childNodes.length;
          for (let t = 0; t < cell.childNodes.length; t++) {
            if (cell.childNodes[t].nodeType === Node.TEXT_NODE) {
              textCellCount++;
              // Длина текста ЗАПРЕЩЕНА, поэтому используем 1 как заглушку
              totalTextLength++;
            }
          }
        }
      }

      const avgTextLength = textCellCount > 0 ? totalTextLength / textCellCount : 0;

      // Получаем геометрию
      const rect = table.getBoundingClientRect();

      return {
        index: index,
        rows: rows,
        colsMax: colsMax,
        caption: captionExists,
        thead: theadExists,
        tbody: tbodyExists,
        tfoot: tfootExists,
        thCount: thCount,
        scopeUsage: {}, // ЗАПРЕЩЕНО собирать значения scope
        hasColspanRowspan: false, // ЗАПРЕЩЕНО собирать точные значения
        nestedTablesCount: nestedTables,
        headerRowIndex: headerRowIndex,
        avgTextLength: avgTextLength, // Заглушка
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        }
      };
    } catch (e) {
      console.warn(`[PSP-1] Ошибка при обработке таблицы ${index}:`, e.message);
      return null;
    }
  }

  // --- Сбор форм (5.5) ---

  function collectForms(nodes) {
    const forms = [];
    const formElements = document.querySelectorAll('form');

    for (let i = 0; i < formElements.length; i++) {
      const form = formElements[i];
      const formData = processForm(form, i);
      if (formData) {
        forms.push(formData);
      }
    }

    return forms;
  }

  function processForm(form, index) {
    try {
      const inputs = form.querySelectorAll('input, select, textarea, meter, progress, output');
      const inputTypes = {};
      let textareaCount = 0;
      let selectCount = 0;
      let meterCount = 0;
      let progressCount = 0;
      let outputCount = 0;
      let requiredCount = 0;
      let fieldsetCount = 0;
      let legendCount = 0;
      let labeledCount = 0;
      let unlabeledCount = 0;
      const autocompleteValues = {};

      // Обрабатываем все инпуты
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const tag = input.tagName.toLowerCase();
        const type = input.type || tag;

        // Считаем типы
        inputTypes[type] = (inputTypes[type] || 0) + 1;

        // Считаем теги
        switch (tag) {
          case 'textarea':
            textareaCount++;
            break;
          case 'select':
            selectCount++;
            break;
          case 'meter':
            meterCount++;
            break;
          case 'progress':
            progressCount++;
            break;
          case 'output':
            outputCount++;
            break;
        }

        // Проверяем required
        if (input.required) {
          requiredCount++;
        }

        // Проверяем autocomplete
        const autocomplete = input.getAttribute('autocomplete');
        if (autocomplete) {
          autocompleteValues[autocomplete] = (autocompleteValues[autocomplete] || 0) + 1;
        }

        // Проверяем label
        const hasLabel = hasAssociatedLabel(input);
        if (hasLabel) {
          labeledCount++;
        } else {
          unlabeledCount++;
        }
      }

      // Считаем fieldset/legend
      fieldsetCount = form.querySelectorAll('fieldset').length;
      legendCount = form.querySelectorAll('legend').length;

      // Проверяем method и action
      const method = form.method || 'get';
      let actionHostname = null;

      try {
        if (form.action) {
          const actionUrl = new URL(form.action, window.location.href);
          actionHostname = actionUrl.hostname;
        }
      } catch (e) {
        // Если не удаётся разобрать URL, проверяем same-origin
        actionHostname = 'same-origin';
      }

      // Получаем геометрию
      const rect = form.getBoundingClientRect();

      return {
        index: index,
        method: method,
        actionHostname: actionHostname || 'same-origin',
        inputTypes: inputTypes,
        counts: {
          textarea: textareaCount,
          select: selectCount,
          meter: meterCount,
          progress: progressCount,
          output: outputCount
        },
        labeledRatio: labeledCount / (labeledCount + unlabeledCount),
        requiredCount: requiredCount,
        hasFieldset: fieldsetCount > 0,
        hasLegend: legendCount > 0,
        autocomplete: autocompleteValues,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        }
      };
    } catch (e) {
      console.warn(`[PSP-1] Ошибка при обработке формы ${index}:`, e.message);
      return null;
    }
  }

  function hasAssociatedLabel(input) {
    // Проверяем наличие label через for
    const id = input.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return true;
    }

    // Проверяем aria-label
    if (input.getAttribute('aria-label')) {
      return true;
    }

    // Проверяем aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) return true;
    }

    // Проверяем вложенный label
    const parentLabel = input.closest('label');
    if (parentLabel) return true;

    return false;
  }

  // --- Информационная архитектура (5.8) ---

  function collectInformationArchitecture(nodes) {
    const result = {
      landmarkAreas: {},
      readingOrder: {
        inversions: 0,
        inversionRatio: 0
      },
      contentDepth: {
        avg: 0,
        max: 0
      },
      semantics: {
        semanticRatio: 0
      },
      navigation: {
        navCount: 0,
        topLevelItems: []
      },
      headings: {
        hierarchy: {},
        jumps: 0
      }
    };

    // Собираем информацию о landmark
    const landmarkElements = nodes.filter(node =>
      node.landmark &&
      ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'region', 'region(named)'].includes(node.landmark)
    );

    // Площади по landmark
    for (const landmark of landmarkElements) {
      if (!landmark.bbox) continue;

      const area = landmark.bbox.w * landmark.bbox.h;
      const viewportArea = window.innerWidth * window.innerHeight;
      const areaPct = (area / viewportArea) * 100;

      result.landmarkAreas[landmark.landmark] = (result.landmarkAreas[landmark.landmark] || 0) + areaPct;
    }

    // Порядок чтения
    result.readingOrder = calculateReadingOrder(nodes);

    // Глубина контента
    result.contentDepth = calculateContentDepth(nodes);

    // Семантика
    result.semantics = calculateSemantics(nodes);

    // Навигация
    result.navigation = calculateNavigation(nodes);

    // Заголовки
    result.headings = calculateHeadings(nodes);

    return result;
  }

  function calculateReadingOrder(nodes) {
    // Сортируем блоки по (y, x)
    const blocks = nodes.filter(node =>
      node.bbox && node.bbox.w > 0 && node.bbox.h > 0
    ).map(node => ({
      path: node.path,
      y: node.bbox.y,
      x: node.bbox.x,
      h: node.bbox.h,
      domIndex: parseInt(node.path.replace(/\./g, '0')) // Упрощённое преобразование пути в индекс
    }));

    // Сортировка по y, затем по x
    const sortedByPosition = [...blocks].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    // Сравниваем с DOM порядком
    let inversions = 0;
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        // Проверяем, что блок j в DOM идёт после i, но в позиционной сортировке идёт перед
        if (blocks[i].domIndex < blocks[j].domIndex &&
            sortedByPosition.indexOf(blocks[i]) > sortedByPosition.indexOf(blocks[j])) {
          inversions++;
        }
      }
    }

    const totalPairs = blocks.length * (blocks.length - 1) / 2;
    const inversionRatio = totalPairs > 0 ? inversions / totalPairs : 0;

    return {
      inversions: inversions,
      inversionRatio: inversionRatio
    };
  }

  function calculateContentDepth(nodes) {
    // Средняя и максимальная глубина от body до текстового узла
    const textNodes = nodes.filter(node =>
      node.tag === 'p' || node.tag === 'span' || node.tag === 'div' ||
      node.tag === 'a' || node.tag === 'li' || node.tag === 'td' ||
      node.tag === 'th' || node.tag.match(/^h[1-6]$/)
    );

    if (textNodes.length === 0) {
      return { avg: 0, max: 0 };
    }

    const depths = textNodes.map(node => node.depth);
    const sum = depths.reduce((a, b) => a + b, 0);
    const avg = sum / depths.length;
    const max = Math.max(...depths);

    return { avg, max };
  }

  function calculateSemantics(nodes) {
    // Доля семантических элементов среди контейнеров
    const containers = nodes.filter(node =>
      ['div', 'span'].includes(node.tag)
    );

    const semanticContainers = nodes.filter(node =>
      !['div', 'span'].includes(node.tag) &&
      (node.role || node.landmark || node.heading)
    );

    const totalContainers = containers.length + semanticContainers.length;
    const semanticRatio = totalContainers > 0
      ? semanticContainers.length / totalContainers
      : 0;

    return { semanticRatio };
  }

  function calculateNavigation(nodes) {
    const navElements = nodes.filter(node =>
      node.tag === 'nav' || node.landmark === 'navigation'
    );

    const navCount = navElements.length;
    const topLevelItems = [];

    for (const nav of navElements) {
      // Считаем прямые дочерние ссылки
      const element = getElementFromNode(nav);
      if (!element) continue;

      const directLinks = element.querySelectorAll('> a, > [role="link"]');
      topLevelItems.push(directLinks.length);
    }

    return {
      navCount: navCount,
      topLevelItems: topLevelItems
    };
  }

  function calculateHeadings(nodes) {
    const headingElements = nodes.filter(node => node.heading);
    const hierarchy = {};
    let jumps = 0;
    let prevLevel = 0;

    // Сортируем заголовки по document order
    headingElements.sort((a, b) => {
      if (a.path < b.path) return -1;
      if (a.path > b.path) return 1;
      return 0;
    });

    for (const heading of headingElements) {
      const level = heading.heading;
      hierarchy[level] = (hierarchy[level] || 0) + 1;

      // Проверяем пропуски уровней
      if (prevLevel > 0 && level > prevLevel + 1) {
        jumps++;
      }
      prevLevel = level;
    }

    return {
      hierarchy: hierarchy,
      jumps: jumps
    };
  }

  // Публичный интерфейс
  return {
    collect,
    resetState,
    collectGeometry,
    collectCSSInventory,
    collectColorMap,
    collectLayers,
    collectTables,
    collectForms,
    collectInformationArchitecture
  };
})();
```
Принято. Реализую ТЗ **SSEA‑2026** (разделы 0–14 + Приложения A–C) в виде единого userscript‑файла, как требуется в пункте 14. Ниже — полный код.

```js
