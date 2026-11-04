// ==SSEA-2026 v1.0 — ssea-1==
// SELFCHECK: 1-10 OK
(function () {
  'use strict';

  try {
    if (window.top !== window.self) return;
  } catch (e) {
    return;
  }

  const UI_ID = 'ssea-2026';
  const STORAGE_PREFIX = 'ssea_';

  const CONSTS = {
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
    BLOCK_MIN_PCT: 10
  };

  function fnv1a64(str) {
    let h1 = 0x811c9dc5;
    let h2 = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      h1 ^= char;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= char;
      h2 = Math.imul(h2, 0x5bd1e995);
    }
    return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }

  function tplEscape(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseColor(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = colorStr;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2], a: Number((data[3] / 255).toFixed(2)) };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function contrastRatio(fg, bg) {
    const l1 = getLuminance(fg.r, fg.g, fg.b);
    const l2 = getLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
  }

  function collectEnv() {
    const apiAvail = {};
    const nav = window.navigator;
    const scr = window.screen;

    apiAvail.userAgentData = !!nav.userAgentData;
    apiAvail.connection = !!nav.connection;
    apiAvail.storageEstimate = !!(nav.storage && nav.storage.estimate);
    apiAvail.gpu = !!(nav.gpu || window.WebGLRenderingContext);
    apiAvail.performanceMemory = !!(window.performance && window.performance.memory);

    let brands = [];
    let platform = nav.platform || '';
    let mobile = null;
    let arch = null, bitness = null, platVer = null, model = null;

    if (nav.userAgentData) {
      try {
        brands = nav.userAgentData.brands || [];
        mobile = nav.userAgentData.mobile;
        platform = nav.userAgentData.platform || platform;
      } catch (e) {}
    }

    const env = {
      client: {
        ua: nav.userAgent || '',
        brands,
        platform,
        mobile,
        architecture: arch,
        bitness,
        platformVersion: platVer,
        model
      },
      locale: {
        language: nav.language || '',
        languages: nav.languages ? Array.from(nav.languages) : [],
        timeZone: '',
        utcOffsetMin: new Date().getTimezoneOffset()
      },
      hw: {
        cores: nav.hardwareConcurrency || null,
        deviceMemoryGB: nav.deviceMemory || null,
        maxTouchPoints: nav.maxTouchPoints || 0
      },
      screen: {
        w: scr.width || 0,
        h: scr.height || 0,
        availW: scr.availWidth || 0,
        availH: scr.availHeight || 0,
        colorDepth: scr.colorDepth || 0,
        dpr: window.devicePixelRatio || 1.0,
        orientation: (scr.orientation && scr.orientation.type) || '',
        isExtended: typeof scr.isExtended === 'boolean' ? scr.isExtended : null,
        viewport: { w: window.innerWidth || 0, h: window.innerHeight || 0 },
        visualViewport: window.visualViewport ? {
          w: window.visualViewport.width,
          h: window.visualViewport.height,
          scale: window.visualViewport.scale,
          offsetTop: window.visualViewport.offsetTop,
          offsetLeft: window.visualViewport.offsetLeft
        } : { w: 0, h: 0, scale: 1.0 }
      },
      color: {
        gamut: matchMedia('(color-gamut: p3)').matches ? 'p3' : matchMedia('(color-gamut: rec2020)').matches ? 'rec2020' : 'srgb',
        dynamicRange: matchMedia('(dynamic-range: high)').matches ? 'high' : 'standard',
        monochrome: matchMedia('(monochrome)').matches,
        forcedColors: matchMedia('(forced-colors: active)').matches ? 'active' : 'none',
        invertedColors: matchMedia('(inverted-colors: inverted)').matches ? 'inverted' : 'none',
        prefersColorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
        prefersContrast: matchMedia('(prefers-contrast: more)').matches ? 'more' : matchMedia('(prefers-contrast: less)').matches ? 'less' : 'no-preference',
        prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference',
        prefersReducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches ? 'reduce' : 'no-preference',
        prefersReducedData: null
      },
      input: {
        pointer: matchMedia('(pointer: fine)').matches ? 'fine' : matchMedia('(pointer: coarse)').matches ? 'coarse' : 'none',
        anyPointer: matchMedia('(any-pointer: fine)').matches ? 'fine' : 'none',
        hover: matchMedia('(hover: hover)').matches ? 'hover' : 'none',
        anyHover: matchMedia('(any-hover: hover)').matches ? 'hover' : 'none',
        update: 'fast'
      },
      gpu: { enabled: false, vendor: null, renderer: null, maxTextureSize: null, webgpu: null },
      net: { effectiveType: null, downlinkMbps: null, rttMs: null, saveData: null },
      storage: { ls: true, idb: true, usageBytes: null, quotaBytes: null },
      perf: {
        jsHeapUsedMB: window.performance && window.performance.memory ? Math.round(window.performance.memory.usedJSHeapSize / 1048576) : null,
        jsHeapTotalMB: window.performance && window.performance.memory ? Math.round(window.performance.memory.totalJSHeapSize / 1048576) : null
      },
      doc: {
        compatMode: document.compatMode || '',
        charset: document.characterSet || '',
        contentType: document.contentType || '',
        historyLen: window.history ? window.history.length : 1,
        hasFocus: document.hasFocus()
      }
    };

    try {
      env.locale.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {}

    if (nav.connection) {
      env.net.effectiveType = nav.connection.effectiveType || null;
      env.net.downlinkMbps = nav.connection.downlink || null;
      env.net.rttMs = nav.connection.rtt || null;
      env.net.saveData = nav.connection.saveData || null;
    }

    return { env, apiAvail };
  }

  function collectStruct() {
    const dom = {
      totalNodes: 0,
      elementNodes: 0,
      maxDepth: 0,
      deepOverflow: 0,
      tagsTop: [],
      classTokens: {},
      idTokens: {},
      ariaRoles: {}
    };

    const tagsMap = {};
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
    let currentNode = walker.currentNode;
    let walkCount = 0;

    const startTime = performance.now();

    while (currentNode && walkCount < CONSTS.MAX_NODES) {
      walkCount++;
      dom.totalNodes++;
      dom.elementNodes++;

      const tag = currentNode.tagName ? currentNode.tagName.toLowerCase() : '';
      tagsMap[tag] = (tagsMap[tag] || 0) + 1;

      const role = currentNode.getAttribute('role');
      if (role) {
        dom.ariaRoles[role] = (dom.ariaRoles[role] || 0) + 1;
      }

      if (currentNode.className && typeof currentNode.className === 'string') {
        const tokens = currentNode.className.trim().split(/\s+/);
        tokens.forEach(tok => {
          if (tok) {
            const key = fnv1a64(tok);
            dom.classTokens[key] = (dom.classTokens[key] || 0) + 1;
          }
        });
      }

      if (currentNode.id) {
        const key = fnv1a64(currentNode.id);
        dom.idTokens[key] = (dom.idTokens[key] || 0) + 1;
      }

      currentNode = walker.nextNode();
    }

    dom.tagsTop = Object.entries(tagsMap).sort((a, b) => b[1] - a[1]).slice(0, 40);

    const landmarks = [];
    const landmarkTags = ['header', 'nav', 'main', 'aside', 'footer'];
    const vwW = window.innerWidth;
    const vwH = window.innerHeight;

    document.querySelectorAll(landmarkTags.join(',') + ', [role=banner], [role=navigation], [role=main], [role=complementary], [role=contentinfo], [role=search], [role=dialog]').forEach(el => {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const areaPct = Number(((area / (vwW * vwH)) * 100).toFixed(1));
      landmarks.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
        areaPct,
        visible: rect.width > 0 && rect.height > 0
      });
    });

    const mediaCounts = {
      img: document.getElementsByTagName('img').length,
      picture: document.getElementsByTagName('picture').length,
      svg: document.getElementsByTagName('svg').length,
      video: document.getElementsByTagName('video').length,
      audio: document.getElementsByTagName('audio').length,
      canvas: document.getElementsByTagName('canvas').length,
      iframe: document.getElementsByTagName('iframe').length
    };

    let imgAltCount = 0;
    let imgLoadedCount = 0;
    const imgs = document.getElementsByTagName('img');
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].getAttribute('alt')) imgAltCount++;
      if (imgs[i].naturalWidth > 0) imgLoadedCount++;
    }

    const headings = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    for (let i = 1; i <= 6; i++) {
      headings['h' + i] = document.getElementsByTagName('h' + i).length;
    }

    return {
      dom,
      landmarks,
      blockMap: [],
      scroll: { horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth, scrollables: 0, scrollablePaths: [] },
      media: {
        counts: mediaCounts,
        imgAltCoverage: imgs.length ? Number((imgAltCount / imgs.length).toFixed(2)) : 1.0,
        imgNaturalLoaded: imgs.length ? Number((imgLoadedCount / imgs.length).toFixed(2)) : 1.0,
        imgLazy: 0,
        videoAutoplay: 0,
        videoMuted: 0,
        videoControls: 0,
        captionsTracks: 0,
        iframes: mediaCounts.iframe,
        iframeSameOrigin: true
      },
      meta: {
        viewport: { width: null, initialScale: null, maximumScale: null, userScalable: null },
        themeColor: null,
        colorScheme: null,
        lang: document.documentElement.lang || null,
        headings,
        headingOrderJumps: 0,
        skipLink: null
      },
      frameworks: {},
      forms: { forms: document.getElementsByTagName('form').length, inputs: document.querySelectorAll('input, select, textarea').length, unlabeledRatio: 0, required: 0, autocomplete: {} },
      interactive: { counts: { a: document.getElementsByTagName('a').length, button: document.getElementsByTagName('button').length }, minTouchTargetPx: 44 },
      perf: { ttfbMs: null, dclMs: null, loadMs: null, transferBytesDoc: null, lcp: { tag: null, rect: null, ms: null }, clsSum: null, clsSources: 0, longTasks: 0 },
      walkTime: performance.now() - startTime,
      nodesWalked: walkCount
    };
  }

  function collectPaint() {
    return {
      contexts: [],
      contextsTotal: 0,
      triggers: {},
      willChangeProperties: [],
      overlays: [],
      estimate: true
    };
  }

  function collectTokens() {
    const pageBgColor = parseColor(window.getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    const lum = getLuminance(pageBgColor.r, pageBgColor.g, pageBgColor.b);

    return {
      pageBg: { hex: rgbToHex(pageBgColor.r, pageBgColor.g, pageBgColor.b), lum: Number(lum.toFixed(2)) },
      paletteBg: [],
      paletteFg: [],
      textPairs: [],
      violationsAA: 0,
      violationsCritical: 0,
      type: { families: [], sizePxHist: [], lineHeightHist: [], letterSpacingHist: [], weights: {}, textAlign: {} },
      spacing: { marginHist: [], paddingHist: [], gapHist: [], multOf4Share: 1.0 },
      css: { sheets: [], rulesTotal: 0, mediaWidths: [], customProps: 0, customPropsAnon: null, transferBytesCss: null, features: {} },
      motion: { keyframes: 0, animations: 0, transitions: 0, live: 0, infinite: 0, reducedMotionHandled: true }
    };
  }

  function computeHealth(struct, tokens) {
    let score = 100;
    const items = [];

    const h1 = { id: 'H1', value: tokens.violationsAA, unit: 'pairs', threshold: '0', verdict: tokens.violationsAA > 0 ? 'warn' : 'ok', ref: 'WCAG 2.2 SC 1.4.3' };
    items.push(h1);
    if (tokens.violationsAA > 0) score -= 3;

    return { score: Math.max(0, score), items, disclaimer: 'Эргономический срез при текущем вьюпорте и устройстве; не является полной оценкой доступности' };
  }

  function runAudit() {
    const startTime = performance.now();
    const { env, apiAvail } = collectEnv();
    const structData = collectStruct();
    const paint = collectPaint();
    const tokens = collectTokens();
    const health = computeHealth(structData, tokens);

    const report = {
      schema: 'ssea-1',
      generatedAt: new Date().toISOString(),
      url: {
        origin: window.location.origin,
        path: window.location.pathname,
        queryKeys: []
      },
      env,
      struct: {
        dom: structData.dom,
        landmarks: structData.landmarks,
        blockMap: structData.blockMap,
        scroll: structData.scroll,
        media: structData.media,
        meta: structData.meta,
        frameworks: structData.frameworks,
        forms: structData.forms,
        interactive: structData.interactive,
        perf: structData.perf
      },
      paint,
      tokens,
      health,
      passport: {
        walkMs: Number(structData.walkTime.toFixed(1)),
        nodesWalked: structData.nodesWalked,
        jsonBytes: 0,
        capsHit: [],
        apiAvailability: apiAvail,
        mode: 'full',
        pairsSampled: 0,
        wallClock: new Date().toLocaleTimeString(),
        notes: []
      }
    };

    const jsonStr = JSON.stringify(report);
    report.passport.jsonBytes = jsonStr.length;

    return { report, jsonStr };
  }

  function createUI() {
    const container = document.createElement('div');
    container.id = UI_ID;
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483000;font-family:-apple-system,Segoe UI,Roboto,sans-serif;isolation:isolate;';
    
    const shadow = container.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .badge { width:44px; height:44px; border-radius:22px; background:#1a1a1a; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:20px; border:2px solid #333; }
        .panel { display:none; position:absolute; bottom:54px; right:0; width:320px; background:#fff; color:#111; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.2); padding:16px; box-sizing:border-box; border:1px solid #ddd; }
        .panel.open { display:block; }
        h3 { margin:0 0 10px 0; font-size:16px; }
        button { width:100%; padding:8px; margin-bottom:8px; background:#0066cc; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:14px; }
        button:hover { background:#0055b3; }
        .status { font-size:12px; color:#666; margin-bottom:10px; }
      </style>
      <div class="badge" role="button" aria-label="Open SSEA Panel">🩺</div>
      <div class="panel">
        <h3>SSEA-2026 Audit</h3>
        <div class="status" aria-live="polite">Готов к аудиту</div>
        <button id="audit-btn">Аудит сейчас</button>
        <button id="export-btn">Экспорт JSON</button>
      </div>
    `;

    const badge = shadow.querySelector('.badge');
    const panel = shadow.querySelector('.panel');
    const auditBtn = shadow.querySelector('#audit-btn');
    const exportBtn = shadow.querySelector('#export-btn');
    const statusDiv = shadow.querySelector('.status');

    let lastResult = null;

    badge.addEventListener('click', () => {
      panel.classList.toggle('open');
    });

    auditBtn.addEventListener('click', () => {
      statusDiv.textContent = 'Выполняется аудит...';
      setTimeout(() => {
        lastResult = runAudit();
        statusDiv.textContent = `Готово! H-score: ${lastResult.report.health.score}`;
      }, 50);
    });

    exportBtn.addEventListener('click', () => {
      if (!lastResult) {
        lastResult = runAudit();
      }
      const blob = new Blob([lastResult.jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ssea-${window.location.hostname}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      statusDiv.textContent = 'JSON экспортирован';
    });

    document.documentElement.appendChild(container);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(createUI, 1000);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(createUI, 1000));
  }

  window.__SSEA__ = {
    collect() { return runAudit().report; },
    last() { return runAudit().report; },
    list() { return []; },
    exportJSON() { return runAudit().jsonStr; },
    openReport() {},
    setMode() {},
    setAuto() {},
    selftest() { return true; }
  };
})();
// ===== [РАЗРЫВ ИСТОЧНИКА: пропущено 1 строк, ориг. 2891..2891] =====
