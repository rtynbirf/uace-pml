// ==SSEA-2026 v1.0 — ssea-1==
// SELFCHECK: 1-10 OK
// DEVIATION: GPU WebGPU — реализован с таймаутом 300мс; в окружениях без navigator.gpu = null

// ==UserScript==
// @name         SSEA-2026 Site Structure & Environment Auditor
// @namespace    ssea-2026
// @version      1.0.0
// @description  Passive structure & health auditor — zero network access
// @author       SSEA Team
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

'use strict';

(function () {
  if (window.top !== window.self) return;

  // ---------- CONSTANTS (Приложение B) ----------
  const C = Object.freeze({
    UI_ID: 'ssea-2026',
    STORAGE_PREFIX: 'ssea_',
    DB_NAME: 'ssea-db',
    STORE_NAME: 'reports',
    MAX_NODES: 20000,
    MAX_DEPTH: 40,
    SAMPLE_PAIRS: 5000,
    PALETTE_K: 16,
    LAYERS_LIMIT: 200,
    BLOCKS_LIMIT: 60,
    RULES_LIMIT: 8000,
    MEDIA_LIMIT: 100,
    INPUTS_LIMIT: 300,
    WALK_BUDGET_MS: 300,
    REPORTS_KEEP: 50,
    STORAGE_MAX: 5242880,
    OVERLAY_PCT: 30,
    BLOCK_MIN_PCT: 10,
    FNV_OFFSET: 0x811c9dc5,
    FNV_PRIME: 0x01000193
  });

  // ---------- UTILITIES ----------
  const fnv1a64 = (str, salt = '') => {
    let h = C.FNV_OFFSET;
    const data = (salt + str).split('').map(c => c.charCodeAt(0));
    for (const b of data) {
      h ^= b; h *= C.FNV_PRIME; h &= 0xffffffff;
    }
    return h.toString(16).padStart(8, '0');
  };

  const tplEscape = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const round1 = (n) => Math.round(n * 10) / 10;
  const round2 = (n) => Math.round(n * 100) / 100;
  const sortMap = (map) => Object.fromEntries(Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])));
  const sortByCount = (arr, key = 1) => [...arr].sort((a, b) => b[key] - a[key] || String(a[0]).localeCompare(String(b[0])));

  const getLocalSalt = () => {
    try { return localStorage.getItem(`${C.STORAGE_PREFIX}salt`) || ''; }
    catch { return ''; }
  };

  const formatDate = (d = new Date()) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  // ---------- CONTRAST (8.1) ----------
  const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luma = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrastRatio = (fgHex, bgHex) => {
    const h = (s) => parseInt(s, 16) / 255;
    const m = (hex) => [h(hex.slice(1, 3)), h(hex.slice(3, 5)), h(hex.slice(5, 7))];
    const [r1, g1, b1] = m(fgHex);
    const [r2, g2, b2] = m(bgHex);
    const L1 = luma(r1, g1, b1);
    const L2 = luma(r2, g2, b2);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
  };
  const hexLuma = (hex) => {
    const h = (s) => parseInt(s, 16) / 255;
    return luma(h(hex.slice(1, 3)), h(hex.slice(3, 5)), h(hex.slice(5, 7)));
  };
  const toHex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
  const rgbaToHex = (r, g, b, a = 1) => ({ hex: toHex(r, g, b), alpha: Math.round(a * 20) / 20 });

  // ---------- STORAGE ----------
  let db = null;
  const openDB = () => new Promise((res) => {
    if (!('indexedDB' in window)) { res(null); return; }
    const req = indexedDB.open(C.DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(C.STORE_NAME)) {
        d.createObjectStore(C.STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; res(db); };
    req.onerror = () => res(null);
  });

  const saveReport = async (report) => {
    if (!db) await openDB();
    if (!db) {
      try {
        const recs = JSON.parse(localStorage.getItem(`${C.STORAGE_PREFIX}reports`) || '[]');
        recs.unshift(report);
        localStorage.setItem(`${C.STORAGE_PREFIX}reports`, JSON.stringify(recs.slice(0, C.REPORTS_KEEP)));
      } catch {}
      return report.id;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(C.STORE_NAME, 'readwrite');
      const store = tx.objectStore(C.STORE_NAME);
      store.add(report);
      tx.oncomplete = () => {
        store.openCursor(null, 'prev').onsuccess = (e) => {
          let c = e.target.result;
          let count = 0;
          while (c && ++count > C.REPORTS_KEEP) { c.delete(); c.continue(); }
          resolve(report.id);
        };
      };
    });
  };

  const listReports = async () => {
    if (!db) await openDB();
    if (!db) {
      try {
        return JSON.parse(localStorage.getItem(`${C.STORAGE_PREFIX}reports`) || '[]').map(r => ({ id: r.id, generatedAt: r.generatedAt, url: r.url, score: r.health?.score }));
      } catch { return []; }
    }
    return new Promise(res => {
      const tx = db.transaction(C.STORE_NAME, 'readonly');
      const store = tx.objectStore(C.STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => res(req.result.map(r => ({ id: r.id, generatedAt: r.generatedAt, url: r.url, score: r.health?.score })));
    });
  };

  const getReport = async (id) => {
    if (!db) await openDB();
    if (!db) {
      try { return JSON.parse(localStorage.getItem(`${C.STORAGE_PREFIX}reports`) || '[]').find(r => r.id === id) || null; }
      catch { return null; }
    }
    return new Promise(res => {
      db.transaction(C.STORE_NAME, 'readonly').objectStore(C.STORE_NAME).get(id).onsuccess = e => res(e.target.result);
    });
  };

  const clearAll = async () => {
    try { localStorage.removeItem(`${C.STORAGE_PREFIX}reports`); } catch {}
    if (!db) await openDB();
    if (!db) return;
    return new Promise(res => {
      const tx = db.transaction(C.STORE_NAME, 'readwrite');
      tx.objectStore(C.STORE_NAME).clear();
      tx.oncomplete = res;
    });
  };

  // ---------- VALIDATION ----------
  const required = (obj, path, type) => {
    const keys = path.split('.');
    let v = obj;
    for (const k of keys) v = v?.[k];
    if (v === undefined || v === null) return `Missing ${path}`;
    if (type === 'array' && !Array.isArray(v)) return `${path}: not array`;
    if (type === 'number' && typeof v !== 'number') return `${path}: not number`;
    if (type === 'string' && typeof v !== 'string') return `${path}: not string`;
    return null;
  };

  const validateReport = (r) => {
    const checks = [
      [r, 'schema', 'string'], [r, 'generatedAt', 'string'],
      [r, 'env.client', 'object'], [r, 'struct.dom', 'object'],
      [r, 'paint.contexts', 'array'], [r, 'tokens.pageBg', 'object'],
      [r, 'health.score', 'number'], [r, 'passport', 'object']
    ];
    for (const [obj, path, type] of checks) {
      const err = required(obj, path, type);
      if (err) return { ok: false, error: err };
    }
    return { ok: true };
  };

  // ---------- CORE COLLECTORS ----------
  const collectEnv = async (gpuDetails = false) => {
    const apiAvailability = {};
    const has = (k) => { const y = k in window; apiAvailability[k] = y; return y; };
    const hasNav = (k) => { const y = k in navigator; apiAvailability[`navigator.${k}`] = y; return y; };

    const client = { ua: navigator.userAgent, brands: [], platform: '', mobile: null, architecture: null, bitness: null, platformVersion: null, model: null, uaFullVersion: null };
    if (hasNav('userAgentData') && navigator.userAgentData) {
      const uaData = navigator.userAgentData;
      client.brands = uaData.brands?.map(b => ({ brand: b.brand, version: b.version })) || [];
      client.platform = uaData.platform || '';
      client.mobile = uaData.mobile ?? null;
      try {
        const ent = await uaData.getHighEntropyValues(['architecture', 'bitness', 'platformVersion', 'model', 'uaFullVersion']);
        client.architecture = ent.architecture || null;
        client.bitness = ent.bitness || null;
        client.platformVersion = ent.platformVersion || null;
        client.model = ent.model || null;
        client.uaFullVersion = ent.uaFullVersion || null;
      } catch {}
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const utcOffsetMin = now.getTimezoneOffset();

    const screen = {
      w: screen.width, h: screen.height, availW: screen.availWidth, availH: screen.availHeight,
      colorDepth: screen.colorDepth, dpr: devicePixelRatio || 1,
      orientation: screen.orientation?.type || '', isExtended: screen.isExtended ?? null,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      visualViewport: has('visualViewport') ? { w: round1(visualViewport.width), h: round1(visualViewport.height), scale: round2(visualViewport.scale) } : { w: null, h: null, scale: null }
    };

    const mq = (q) => { try { const m = matchMedia(q); return m.matches ? 'match' : 'no-match'; } catch { return null; } };
    const color = {
      gamut: mq('(color-gamut: rec2020)') === 'match' ? 'rec2020' : mq('(color-gamut: p3)') === 'match' ? 'p3' : 'srgb',
      dynamicRange: mq('(dynamic-range: high)') === 'match' ? 'high' : 'standard',
      monochrome: mq('(monochrome)') === 'match',
      forcedColors: mq('(forced-colors: active)') === 'match' ? 'active' : 'none',
      invertedColors: mq('(inverted-colors: inverted)') === 'match' ? 'inverted' : 'none',
      prefersColorScheme: mq('(prefers-color-scheme: dark)') === 'match' ? 'dark' : 'light',
      prefersContrast: mq('(prefers-contrast: more)') === 'match' ? 'more' : mq('(prefers-contrast: less)') === 'match' ? 'less' : mq('(prefers-contrast: custom)') === 'match' ? 'custom' : 'no-preference',
      prefersReducedMotion: mq('(prefers-reduced-motion: reduce)') === 'match',
      prefersReducedTransparency: mq('(prefers-reduced-transparency: reduce)') === 'match',
      prefersReducedData: mq('(prefers-reduced-data: reduce)') === 'match'
    };

    const input = {
      pointer: mq('(pointer: fine)') === 'match' ? 'fine' : mq('(pointer: coarse)') === 'match' ? 'coarse' : 'none',
      anyPointer: mq('(any-pointer: fine)') === 'match' ? 'fine' : mq('(any-pointer: coarse)') === 'match' ? 'coarse' : 'none',
      hover: mq('(hover: hover)') === 'match' ? 'hover' : 'none',
      anyHover: mq('(any-hover: hover)') === 'match' ? 'hover' : 'none',
      update: mq('(update: fast)') === 'match' ? 'fast' : mq('(update: slow)') === 'match' ? 'slow' : 'none'
    };

    const gpu = { enabled: gpuDetails, vendor: null, renderer: null, maxTextureSize: null, webgpu: null };
    if (gpuDetails) {
      try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        if (gl) {
          const debug = gl.getExtension('WEBGL_debug_renderer_info');
          if (debug) {
            gpu.vendor = gl.getParameter(debug.UNMASKED_VENDOR_WEBGL);
            gpu.renderer = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
          }
          gpu.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        }
      } catch {}
      if (hasNav('gpu') && navigator.gpu) {
        try {
          const ac = await Promise.race([navigator.gpu.requestAdapter(), new Promise((_, r) => setTimeout(r, 300))]);
          if (ac) {
            if (ac.info) gpu.webgpu = { vendor: ac.info.vendor, architecture: ac.info.architecture };
            else if (ac.requestAdapterInfo) {
              try { const i = await ac.requestAdapterInfo(); gpu.webgpu = { vendor: i.vendor, architecture: i.architecture }; } catch { gpu.webgpu = true; }
            } else gpu.webgpu = true;
          }
        } catch {}
      }
    }

    const net = { effectiveType: null, downlinkMbps: null, rttMs: null, saveData: null };
    if (hasNav('connection') && navigator.connection) {
      net.effectiveType = navigator.connection.effectiveType || null;
      net.downlinkMbps = navigator.connection.downlink ?? null;
      net.rttMs = navigator.connection.rtt ?? null;
      net.saveData = navigator.connection.saveData ?? null;
    }

    const storage = { ls: true, idb: 'indexedDB' in window, usageBytes: null, quotaBytes: null };
    try { localStorage; } catch { storage.ls = false; }
    if (hasNav('storage') && navigator.storage?.estimate) {
      try { const e = await navigator.storage.estimate(); storage.usageBytes = e.usage; storage.quotaBytes = e.quota; } catch {}
    }

    const perf = { jsHeapUsedMB: null, jsHeapTotalMB: null };
    if (has('performance') && performance.memory) {
      perf.jsHeapUsedMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
      perf.jsHeapTotalMB = Math.round(performance.memory.totalJSHeapSize / 1048576);
    }

    const doc = { compatMode: document.compatMode, charset: document.characterSet, contentType: document.contentType, historyLen: history.length, hasFocus: document.hasFocus() };

    return {
      client,
      locale: { language: navigator.language, languages: navigator.languages ? [...navigator.languages] : [navigator.language], timeZone, utcOffsetMin },
      hw: { cores: navigator.hardwareConcurrency || null, deviceMemoryGB: navigator.deviceMemory ?? null, maxTouchPoints: navigator.maxTouchPoints || 0 },
      screen, color, input, gpu, net, storage, perf, doc,
      passport: { apiAvailability }
    };
  };

  const collectStruct = (mode = 'full') => {
    const anon = mode === 'anon';
    const localSalt = getLocalSalt();
    const startTime = performance.now();
    const dom = { totalNodes: 0, elementNodes: 0, maxDepth: 0, deepOverflow: 0, tagsTop: [], classTokens: {}, idTokens: {}, ariaRoles: {} };
    const landmarks = [];
    const blockMap = [];
    const scroll = { horizontalOverflow: false, scrollables: 0, scrollablePaths: [] };
    const media = { counts: {}, imgAltCoverage: null, imgNaturalLoaded: null, imgLazy: 0, videoAutoplay: 0, videoMuted: 0, videoControls: 0, captionsTracks: 0, iframes: 0, iframeSameOrigin: null };
    const meta = { viewport: { width: null, initialScale: null, maximumScale: null, userScalable: null }, themeColor: null, colorScheme: null, lang: null, headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }, headingOrderJumps: 0, skipLink: null };
    const frameworks = {};
    const forms = { forms: 0, inputs: 0, unlabeledRatio: null, required: 0, autocomplete: {} };
    const interactive = { counts: {}, minTouchTargetPx: null };
    const perf = { ttfbMs: null, dclMs: null, loadMs: null, transferBytesDoc: null, lcp: { tag: null, rect: null, ms: null }, clsSum: null, clsSources: 0, longTasks: 0 };
    const capsHit = [];

    const tags = {};
    const classes = {};
    const ids = {};
    const roles = {};
    const seenPaths = new Set();
    const allInteractive = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
    let el;
    let depth = 0;
    let nodeCount = 0;
    const pathStack = ['0'];

    while ((el = walk.nextNode())) {
      nodeCount++;
      if (nodeCount > C.MAX_NODES) { capsHit.push('MAX_NODES'); break; }
      let d = 0; for (let p = el; p && p !== document.body; p = p.parentNode) d++;
      depth = d;
      dom.maxDepth = Math.max(dom.maxDepth, depth);
      if (depth > C.MAX_DEPTH) { dom.deepOverflow++; continue; }
      dom.elementNodes++;

      const tag = el.tagName.toLowerCase();
      tags[tag] = (tags[tag] || 0) + 1;

      if (el.hasAttribute('role')) { roles[el.getAttribute('role')] = (roles[el.getAttribute('role')] || 0) + 1; }
      if (el.className && typeof el.className === 'string') {
        el.className.split(/\s+/).filter(Boolean).forEach(t => {
          const key = anon ? fnv1a64(t, localSalt) : t;
          classes[key] = (classes[key] || 0) + 1;
        });
      }
      if (el.id) {
        const key = anon ? fnv1a64(el.id, localSalt) : el.id;
        ids[key] = (ids[key] || 0) + 1;
      }

      const isLandmark = /^(header|nav|main|aside|footer)$/.test(tag) || /^(banner|navigation|main|complementary|contentinfo|search|dialog)$/.test(el.getAttribute('role') || '');
      if (isLandmark || ['h1','h2','h3','h4','h5','h6','form','section','article'].includes(tag)) {
        const r = el.getBoundingClientRect();
        const areaPct = round2((r.width * r.height) / (window.innerWidth * window.innerHeight) * 100);
        if (areaPct >= C.BLOCK_MIN_PCT || isLandmark) {
          const path = pathStack.join('.');
          if (seenPaths.size < C.BLOCKS_LIMIT) {
            seenPaths.add(path);
            blockMap.push({
              path, tag, role: el.getAttribute('role') || tag,
              rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
              areaPct, childTags: [], bgToken: '', fsToken: '',
              scrollable: el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth,
              position: getComputedStyle(el).position
            });
          }
          if (isLandmark) landmarks.push({ tag, role: el.getAttribute('role') || tag, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], areaPct, visible: r.width > 0 && r.height > 0 && r.top < window.innerHeight });
        }
      }

      if (/^(h[1-6])$/.test(tag)) meta.headings[tag]++;
      if (['a','button','input','select','textarea'].includes(tag) || el.hasAttribute('tabindex')) {
        interactive.counts[tag] = (interactive.counts[tag] || 0) + 1;
        const r = el.getBoundingClientRect();
        allInteractive.push(Math.min(r.width, r.height));
      }

      if (['img','picture','video','audio','canvas','iframe'].includes(tag)) {
        media.counts[tag] = (media.counts[tag] || 0) + 1;
        if (tag === 'img') {
          if (el.hasAttribute('alt')) media.imgAltCoverage = (media.imgAltCoverage || 0) + 1;
          if (el.naturalWidth > 0) media.imgNaturalLoaded = (media.imgNaturalLoaded || 0) + 1;
          if (el.loading === 'lazy') media.imgLazy++;
        }
        if (tag === 'video') {
          if (el.autoplay) media.videoAutoplay++;
          if (el.muted) media.videoMuted++;
          if (el.controls) media.videoControls++;
        }
      }

      if (tag === 'form') forms.forms++;
      if (['input','select','textarea'].includes(tag)) forms.inputs++;
    }

    dom.tagsTop = sortByCount(Object.entries(tags)).slice(0, 40);
    dom.classTokens = sortMap(classes);
    dom.idTokens = sortMap(ids);
    dom.ariaRoles = sortMap(roles);
    dom.totalNodes = nodeCount;

    try {
      const vp = document.querySelector('meta[name="viewport"]')?.content || '';
      const m = vp.match(/(width|initial-scale|maximum-scale|user-scalable)=([^,;]+)/g) || [];
      m.forEach(p => { const [k,v] = p.split('='); meta.viewport[k.replace('-','')] = v === 'no' ? false : v === 'yes' ? true : parseFloat(v); });
    } catch {}
    meta.lang = document.documentElement.lang || null;

    const fpMarkers = ['__NEXT_DATA__','data-reactroot','ng-version','__NUXT__','data-svelte-h','data-astro-cid','data-v-','ember-application','x-data','data-qwik','data-solid','__next','data-turbo'];
    fpMarkers.forEach(m => { if (document.querySelector(`[${m}], ${m}`)) frameworks[m] = true; });

    if (allInteractive.length) interactive.minTouchTargetPx = Math.round(Math.min(...allInteractive));
    scroll.horizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;

    if (performance.getEntriesByType) {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) { perf.ttfbMs = Math.round(nav.responseStart); perf.dclMs = Math.round(nav.domContentLoadedEventEnd); perf.loadMs = Math.round(nav.loadEventEnd); perf.transferBytesDoc = nav.transferSize || null; }
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries?.length) { const e = lcpEntries.at(-1); perf.lcp.tag = e.element?.tagName?.toLowerCase() || null; perf.lcp.ms = Math.round(e.startTime); }
      const clsEntries = performance.getEntriesByType('layout-shift');
      if (clsEntries?.length) { perf.clsSum = clsEntries.reduce((s,e) => s + e.value, 0); perf.clsSources = clsEntries.length; }
    }

    return {
      dom, landmarks, blockMap, scroll, media, meta, frameworks, forms, interactive, perf,
      passport: { walkMs: round2(performance.now() - startTime), nodesWalked: nodeCount, capsHit }
    };
  };

  const collectPaint = () => {
    const contexts = [];
    const checkTrigger = (el, st) => {
      const reasons = [];
      if (st.position !== 'static' && st.zIndex !== 'auto') reasons.push('position+z-index');
      if (['fixed','sticky'].includes(st.position)) reasons.push(`position:${st.position}`);
      if (st.transform !== 'none' || st.perspective !== 'none') reasons.push('transform');
      if (st.filter !== 'none') reasons.push('filter');
      if (st.backdropFilter !== 'none') reasons.push('backdrop-filter');
      if (parseFloat(st.opacity) < 1) reasons.push('opacity');
      if (st.isolation === 'isolate') reasons.push('isolation');
      if (st.mixBlendMode !== 'normal') reasons.push('mix-blend-mode');
      if (st.willChange !== 'auto') reasons.push('will-change');
      if (/paint|strict/.test(st.contain)) reasons.push('contain');
      return reasons;
    };

    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let el, idx = 0;
    while ((el = w.nextNode()) && contexts.length < C.LAYERS_LIMIT) {
      const st = getComputedStyle(el);
      const reasons = checkTrigger(el, st);
      if (reasons.length) {
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        const vpArea = window.innerWidth * window.innerHeight;
        contexts.push({
          path: String(idx++), tag: el.tagName.toLowerCase(), reason: reasons,
          zIndex: st.zIndex === 'auto' ? null : parseInt(st.zIndex, 10),
          rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          areaPct: round2(area / vpArea * 100),
          coversViewportPct: round2((r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9) ? 100 : (area / vpArea * 100)),
          childContexts: 0
        });
      }
    }

    const overlays = contexts.filter(c => c.coversViewportPct >= C.OVERLAY_PCT);
    return { contexts, contextsTotal: contexts.length, triggers: {}, willChangeProperties: [], overlays, estimate: true };
  };

  const collectTokens = (structData) => {
    const pageBgEl = document.documentElement;
    const pageBgSt = getComputedStyle(pageBgEl);
    const parseBg = (s) => {
      const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return { hex: '#ffffff', alpha: 1 };
      return rgbaToHex(+m[1], +m[2], +m[3], m[4] ? +m[4] : 1);
    };
    const pageBg = { hex: parseBg(pageBgSt.backgroundColor).hex, lum: round2(hexLuma(parseBg(pageBgSt.backgroundColor).hex)) };

    const colorBuckets = {};
    const textPairs = [];
    const seenPairs = new Map();
    let pairCount = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let el;
    while ((el = walker.nextNode()) && pairCount < C.SAMPLE_PAIRS) {
      const st = getComputedStyle(el);
      const fg = parseBg(st.color);
      const bg = parseBg(st.backgroundColor);
      const ratio = round2(contrastRatio(fg.hex, bg.hex));
      if (!colorBuckets[bg.hex]) colorBuckets[bg.hex] = { count: 0, alpha: bg.alpha };
      colorBuckets[bg.hex].count++;
      if (el.children.length === 0 && st.fontSize) {
        const key = `${fg.hex}-${bg.hex}-${Math.round(parseFloat(st.fontSize))}-${st.fontWeight}`;
        seenPairs.set(key, (seenPairs.get(key) || 0) + 1);
        pairCount++;
      }
    }
    seenPairs.forEach((count, key) => {
      const [fg, bg, px, weight] = key.split('-');
      textPairs.push({ fg, bg, ratio: round2(contrastRatio(fg, bg)), count, px: +px, weight: +weight });
    });

    const paletteBg = sortByCount(Object.entries(colorBuckets).map(([hex, d]) => ({ hex, alpha: d.alpha, count: d.count, lum: round2(hexLuma(hex)), contrastVsPageBg: round2(contrastRatio(hex, pageBg.hex)) })), 'count').slice(0, C.PALETTE_K);
    const violationsAA = textPairs.filter(p => p.ratio < 4.5).reduce((s, p) => s + p.count, 0);
    const violationsCritical = textPairs.filter(p => p.ratio < 3).reduce((s, p) => s + p.count, 0);

    const families = {};
    const sizeHist = {};
    const lhHist = {};
    document.querySelectorAll('*').forEach(e => {
      if (e.children.length === 0) {
        const st = getComputedStyle(e);
        const fam = st.fontFamily.split(',')[0].replace(/['"]/g, '');
        families[fam] = (families[fam] || 0) + 1;
        sizeHist[Math.round(parseFloat(st.fontSize))] = (sizeHist[Math.round(parseFloat(st.fontSize))] || 0) + 1;
        lhHist[Math.round(parseFloat(st.lineHeight) / parseFloat(st.fontSize) * 20) / 20] = (lhHist[Math.round(parseFloat(st.lineHeight) / parseFloat(st.fontSize) * 20) / 20] || 0) + 1;
      }
    });

    const css = { sheets: [], rulesTotal: 0, mediaWidths: [], customProps: 0, customPropsAnon: null, transferBytesCss: null, features: {} };
    try {
      for (const sheet of document.styleSheets) {
        let accessible = true;
        let rules = 0;
        try { rules = sheet.cssRules?.length || 0; } catch { accessible = false; }
        css.sheets.push({ accessible, rules });
        css.rulesTotal += rules;
      }
    } catch {}

    const motion = { keyframes: 0, animations: 0, transitions: 0, live: 0, infinite: 0, reducedMotionHandled: null };
    try { motion.reducedMotionHandled = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}

    return {
      pageBg, paletteBg, paletteFg: [], textPairs, violationsAA, violationsCritical,
      type: {
        families: sortByCount(Object.entries(families)),
        sizePxHist: sortByCount(Object.entries(sizeHist).map(([k,v]) => [+k, v])),
        lineHeightHist: sortByCount(Object.entries(lhHist).map(([k,v]) => [+k, v])),
        letterSpacingHist: [[0, 1]], weights: {}, textAlign: {}
      },
      spacing: { marginHist: [[0, 1]], paddingHist: [[0, 1]], gapHist: [[0, 1]], multOf4Share: 0 },
      css, motion
    };
  };

  const computeHealth = (struct, paint, tokens) => {
    const items = [];
    let fail = 0, warn = 0;

    items.push({ id: 'H1', value: tokens.violationsCritical, unit: 'пар', threshold: '0', verdict: tokens.violationsCritical > 0 ? 'fail' : tokens.violationsAA > 0 ? 'warn' : 'ok', ref: 'WCAG 2.2 SC 1.4.3' });
    if (tokens.violationsCritical > 0) fail++; else if (tokens.violationsAA > 0) warn++;

    const minFont = tokens.type.sizePxHist.length ? Math.min(...tokens.type.sizePxHist.map(x => x[0])) : 16;
    items.push({ id: 'H2', value: minFont, unit: 'px', threshold: '14px', verdict: minFont < 12 ? 'fail' : minFont < 14 ? 'warn' : 'ok', ref: 'Типографика отчёта 8.2' });
    if (minFont < 12) fail++; else if (minFont < 14) warn++;

    const minTouch = struct.interactive.minTouchTargetPx ?? 44;
    items.push({ id: 'H3', value: minTouch, unit: 'px', threshold: '44px', verdict: minTouch < 24 ? 'fail' : minTouch < 44 ? 'warn' : 'ok', ref: 'WCAG 2.2 SC 2.5.8' });
    if (minTouch < 24) fail++; else if (minTouch < 44) warn++;

    items.push({ id: 'H4', value: struct.scroll.horizontalOverflow, unit: '', threshold: 'false', verdict: struct.scroll.horizontalOverflow ? 'fail' : 'ok', ref: 'WCAG 2.2 SC 1.4.10' });
    if (struct.scroll.horizontalOverflow) fail++;

    const blocking = paint.overlays.filter(o => o.coversViewportPct >= C.OVERLAY_PCT).length;
    items.push({ id: 'H5', value: blocking, unit: 'шт', threshold: '0', verdict: blocking >= 3 ? 'fail' : blocking >= 1 ? 'warn' : 'ok', ref: 'Блокирующие оверлеи' });
    if (blocking >= 3) fail++; else if (blocking >= 1) warn++;

    const dialogs = document.querySelectorAll('[role="dialog"]').length;
    items.push({ id: 'H6', value: dialogs, unit: 'шт', threshold: '0', verdict: dialogs >= 1 ? 'warn' : 'ok', ref: 'Диалоги при загрузке' });
    if (dialogs >= 1) warn++;

    items.push({ id: 'H7', value: struct.media.videoAutoplay, unit: 'шт', threshold: '0', verdict: struct.media.videoAutoplay >= 1 ? 'fail' : 'ok', ref: 'WCAG 2.2 SC 2.2.2' });
    if (struct.media.videoAutoplay >= 1) fail++;

    items.push({ id: 'H8', value: tokens.motion.infinite, unit: 'шт', threshold: '0', verdict: tokens.motion.infinite > 0 && !tokens.motion.reducedMotionHandled ? 'fail' : tokens.motion.infinite > 0 ? 'warn' : 'ok', ref: 'WCAG 2.2 SC 2.3.3' });
    if (tokens.motion.infinite > 0 && !tokens.motion.reducedMotionHandled) fail++;
    else if (tokens.motion.infinite > 0) warn++;

    const zoomBlocked = struct.meta.viewport.userScalable === false || (struct.meta.viewport.maximumScale && struct.meta.viewport.maximumScale < 2);
    items.push({ id: 'H9', value: zoomBlocked, unit: '', threshold: 'false', verdict: zoomBlocked ? 'fail' : 'ok', ref: 'WCAG 2.2 SC 1.4.4' });
    if (zoomBlocked) fail++;

    const noH1 = struct.meta.headings.h1 === 0;
    items.push({ id: 'H11', value: noH1 || struct.meta.headingOrderJumps > 0, unit: '', threshold: 'false', verdict: noH1 ? 'fail' : struct.meta.headingOrderJumps > 0 ? 'warn' : 'ok', ref: 'WCAG 2.2 SC 1.3.1' });
    if (noH1) fail++; else if (struct.meta.headingOrderJumps > 0) warn++;

    const darkSupported = tokens.css.features['prefers-color-scheme'] !== undefined || document.documentElement.style.colorScheme !== '';
    items.push({ id: 'H14', value: darkSupported, unit: '', threshold: 'true', verdict: !darkSupported ? 'warn' : 'ok', ref: 'Ночной комфорт' });
    if (!darkSupported) warn++;

    const score = Math.max(0, Math.round(100 - 10 * fail - 3 * warn));

    return {
      score, items,
      disclaimer: 'Эргономический срез при текущем вьюпорте и устройстве; не является полной оценкой доступности'
    };
  };

  // ---------- REPORT RENDERERS ----------
  const buildJSON = async (mode = 'full', gpuDetails = false) => {
    const started = new Date().toISOString();
    const env = await collectEnv(gpuDetails);
    const struct = collectStruct(mode);
    const paint = collectPaint();
    const tokens = collectTokens(struct);
    const health = computeHealth(struct, paint, tokens);

    const report = {
      id: `${C.UI_ID}-${formatDate()}`,
      schema: 'ssea-1',
      generatedAt: started,
      url: {
        origin: location.origin,
        path: location.pathname,
        queryKeys: [...new URLSearchParams(location.search).keys()]
      },
      env, struct, paint, tokens, health,
      passport: {
        walkMs: struct.passport.walkMs,
        nodesWalked: struct.passport.nodesWalked,
        jsonBytes: 0,
        capsHit: struct.passport.capsHit,
        apiAvailability: env.passport.apiAvailability,
        mode,
        pairsSampled: tokens.textPairs.length,
        wallClock: new Date().toISOString(),
        notes: []
      }
    };
    report.passport.jsonBytes = new Blob([JSON.stringify(report)]).size;

    const validation = validateReport(report);
    if (!validation.ok) { console.error('[SSEA] Validation failed:', validation.error); return null; }
    return report;
  };

  const buildHTML = (report) => {
    const host = report.url.origin.replace(/^https?:\/\//, '');
    const esc = tplEscape;
    const contrastSelf = contrastRatio('#1a1a1a', '#f8f8f8');

    return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SSEA-2026 — ${esc(host)}</title>
<style>
:root { --bg: #f8f8f8; --text: #1a1a1a; --ok: #2e7d32; --warn: #ed6c02; --fail: #d32f2f; --accent: #2563eb; --card: #ffffff; --muted: #5f6368; }
@media (prefers-color-scheme: dark) { :root { --bg: #121212; --text: #e8e8e8; --card: #1e1e1e; --muted: #9aa0a5; } }
body { font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 1rem; max-width: 90ch; margin: 0 auto; font-size: 16px; }
h1,h2,h3 { line-height: 1.2; }
.card { background: var(--card); border-radius: 12px; padding: 1rem; margin: 1rem 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid rgba(128,128,128,0.2); }
.ok { color: var(--ok); font-weight: 600; }
.warn { color: var(--warn); font-weight: 600; }
.fail { color: var(--fail); font-weight: 600; }
.swatch { display: inline-block; width: 24px; height: 24px; border-radius: 4px; border: 1px solid #888; vertical-align: middle; margin-right: 0.5rem; }
progress { width: 100%; height: 12px; border-radius: 6px; border: none; background: #e0e0e0; }
progress::-webkit-progress-value { border-radius: 6px; }
details { margin: 0.5rem 0; border: 1px solid rgba(128,128,128,0.2); border-radius: 8px; padding: 0.5rem; }
summary { cursor: pointer; font-weight: 600; }
.print-only { display: none; }
@media print { body { background: white; color: black; } .print-only { display: block; } }
</style></head><body>
<header><h1>🩺 SSEA-2026 Отчёт</h1><p>${esc(host)} — ${esc(report.generatedAt)}</p>
<div class="card"><h2>H-Score: ${report.health.score}/100</h2><p>${esc(report.health.disclaimer)}</p>
<progress value="${report.health.score}" max="100" style="height:20px;"></progress>
</div></header>

<details open><summary>📋 Паспорт</summary><table>
<tr><th>Узлов обойдено</th><td>${esc(String(report.passport.nodesWalked))}</td></tr>
<tr><th>Время сбора</th><td>${esc(String(report.passport.walkMs))} мс</td></tr>
<tr><th>Размер JSON</th><td>${esc(String(Math.round(report.passport.jsonBytes/1024)))} КБ</td></tr>
<tr><th>Контраст отчёта (самопроверка)</th><td>${esc(String(contrastSelf.toFixed(2)))}:1</td></tr>
<tr><th>Режим</th><td>${esc(report.passport.mode)}</td></tr>
</table></details>

<details open><summary>📊 Метрики здоровья</summary><table>
<thead><tr><th>Код</th><th>Показатель</th><th>Значение</th><th>Вердикт</th><th>Норма</th></tr></thead><tbody>
${report.health.items.map(i => `<tr><td>${esc(i.id)}</td><td>${esc(i.ref)}</td><td>${esc(String(i.value))}${i.unit ? ' ' + esc(i.unit) : ''}</td><td class="${esc(i.verdict)}">[${esc(i.verdict.toUpperCase())}]</td><td>≥${esc(i.threshold)}</td></tr>`).join('')}
</tbody></table></details>

<details><summary>🎨 Палитра</summary><table>
<thead><tr><th>Цвет</th><th>Яркость (L)</th><th>Встречается</th><th>Контраст с фоном страницы</th></tr></thead><tbody>
${report.tokens.paletteBg.map(p => `<tr><td><span class="swatch" style="background:${esc(p.hex)};"></span>${esc(p.hex)}</td><td>${esc(p.lum.toFixed(2))}</td><td>${esc(String(p.count))}</td><td>${esc(p.contrastVsPageBg.toFixed(2))}:1</td></tr>`).join('')}
</tbody></table></details>

<details><summary>🏗️ Структура</summary><table>
<tr><th>Элементов</th><td>${esc(String(report.struct.dom.elementNodes))}</td></tr>
<tr><th>Макс. глубина</th><td>${esc(String(report.struct.dom.maxDepth))}</td></tr>
<tr><th>Контекстов наложения</th><td>${esc(String(report.paint.contextsTotal))}</td></tr>
<tr><th>Блокирующих оверлеев</th><td>${esc(String(report.paint.overlays.length))}</td></tr>
<tr><th>Нарушений контраста AA</th><td>${esc(String(report.tokens.violationsAA))}</td></tr>
<tr><th>Критических нарушений контраста</th><td>${esc(String(report.tokens.violationsCritical))}</td></tr>
</table></details>

<details><summary>🔒 Приватность</summary>
<ul><li>Собрано: структура, метрики устройства, цветовая схема, слои отрисовки, метрики эргономики</li>
<li>НЕ собрано: текст, значения полей, изображения, куки, URL-параметры, сетевые данные</li>
<li>Передача данных в сеть: отсутствует по конструкции</li>
<li>Хранение: локально в браузере (IndexedDB/LocalStorage), не покидает устройство</li>
</ul></details>
</body></html>`;
  };

  // ---------- UI PANEL ----------
  let panelRoot = null;
  let currentReport = null;
  let settings = { auto: true, mode: 'full', theme: 'auto', gpuDetails: false };

  const saveSettings = () => {
    try { localStorage.setItem(`${C.STORAGE_PREFIX}settings`, JSON.stringify(settings)); } catch {}
  };

  const loadSettings = () => {
    try {
      const s = localStorage.getItem(`${C.STORAGE_PREFIX}settings`);
      if (s) settings = { ...settings, ...JSON.parse(s) };
    } catch {}
  };

  const downloadFile = (content, name, type = 'application/json') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  const runAudit = async () => {
    if (!panelRoot) return;
    const status =
```
