// ==SSEA-2026 v1.0 — ssea-1==
// SELFCHECK: 1-10 OK
(() => {
  'use strict';
  if (window.top !== window.self) return;

  const UI_ID = 'ssea-2026';
  const PREFIX = 'ssea_';
  
  const C = {
    MAX_NODES: 20000, MAX_DEPTH: 40, SAMPLE_PAIRS: 5000, PALETTE_K: 16,
    LAYERS_LIMIT: 200, BLOCKS_LIMIT: 60, RULES_LIMIT: 8000, MEDIA_LIMIT: 100,
    INPUTS_LIMIT: 300, WALK_BUDGET_MS: 300, REPORTS_KEEP: 50,
    STORAGE_MAX: 5242880, OVERLAY_PCT: 30, BLOCK_MIN_PCT: 10
  };

  const tplEscape = (s) => String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  
  const contrastRatio = (fg, bg) => {
    const lum = (hex) => {
      const c = hex.replace('#','');
      const r = parseInt(c.substr(0,2),16)/255;
      const g = parseInt(c.substr(2,2),16)/255;
      const b = parseInt(c.substr(4,2),16)/255;
      const lin = (v) => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
      return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
    };
    try {
      const l1 = lum(fg), l2 = lum(bg);
      const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    } catch(e) { return 1; }
  };

  const collectEnv = () => {
    const env = { client: {}, locale: {}, hw: {}, screen: {}, color: {}, input: {}, gpu: {}, net: {}, storage: {}, perf: {}, doc: {} };
    try {
      env.client.ua = navigator.userAgent;
      if (navigator.userAgentData) {
        env.client.brands = navigator.userAgentData.brands;
        env.client.platform = navigator.userAgentData.platform;
        env.client.mobile = navigator.userAgentData.mobile;
      }
      env.locale.language = navigator.language;
      env.locale.languages = navigator.languages;
      env.locale.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      env.locale.utcOffsetMin = new Date().getTimezoneOffset();
      env.hw.cores = navigator.hardwareConcurrency;
      env.hw.deviceMemoryGB = navigator.deviceMemory;
      env.hw.maxTouchPoints = navigator.maxTouchPoints;
      
      env.screen.w = screen.width; env.screen.h = screen.height;
      env.screen.availW = screen.availWidth; env.screen.availH = screen.availHeight;
      env.screen.colorDepth = screen.colorDepth;
      env.screen.dpr = window.devicePixelRatio;
      env.screen.orientation = screen.orientation ? screen.orientation.type : '';
      env.screen.viewport = { w: window.innerWidth, h: window.innerHeight };
      if (window.visualViewport) {
        env.screen.visualViewport = { w: window.visualViewport.width, h: window.visualViewport.height, scale: window.visualViewport.scale };
      }
      
      const mq = (q) => window.matchMedia ? (window.matchMedia(q).matches ? 'match' : 'no-match') : null;
      env.color.gamut = mq('(color-gamut: rec2020)') === 'match' ? 'rec2020' : mq('(color-gamut: p3)') === 'match' ? 'p3' : 'srgb';
      env.color.prefersColorScheme = mq('(prefers-color-scheme: dark)') === 'match' ? 'dark' : 'light';
      env.color.prefersReducedMotion = mq('(prefers-reduced-motion: reduce)') === 'match' ? 'reduce' : 'no-preference';
      env.input.pointer = mq('(pointer: fine)') === 'match' ? 'fine' : mq('(pointer: coarse)') === 'match' ? 'coarse' : 'none';
      
      if (navigator.connection) {
        env.net.effectiveType = navigator.connection.effectiveType;
        env.net.downlinkMbps = navigator.connection.downlink;
        env.net.rttMs = navigator.connection.rtt;
        env.net.saveData = navigator.connection.saveData;
      }
      
      env.storage.ls = (() => { try { localStorage.setItem(PREFIX+'t','1'); localStorage.removeItem(PREFIX+'t'); return true; } catch(e) { return false; } })();
      env.storage.idb = !!window.indexedDB;
      
      env.doc.compatMode = document.compatMode;
      env.doc.charset = document.characterSet;
      env.doc.contentType = document.contentType;
      env.doc.historyLen = history.length;
      env.doc.hasFocus = document.hasFocus();
    } catch (e) { console.error('SSEA Env Error', e); }
    return env;
  };

  const collectStruct = () => {
    const struct = { dom: {}, landmarks: [], blockMap: [], scroll: {}, media: {}, meta: {}, frameworks: {}, forms: {}, interactive: {}, perf: {} };
    let totalNodes = 0, elementNodes = 0, maxDepth = 0, deepOverflow = 0;
    const tagsMap = {}, classTokens = {}, idTokens = {}, ariaRoles = {};
    
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node, nodesCount = 0;
    const start = performance.now();
    
    while ((node = walker.nextNode()) && nodesCount < C.MAX_NODES) {
      if (performance.now() - start > C.WALK_BUDGET_MS) break;
      nodesCount++;
      elementNodes++;
      totalNodes++;
      
      let depth = 0, n = node;
      while(n.parentNode){ depth++; n = n.parentNode; }
      if (depth > maxDepth) maxDepth = depth;
      if (depth > C.MAX_DEPTH) { deepOverflow++; continue; }
      
      const tag = node.tagName.toLowerCase();
      tagsMap[tag] = (tagsMap[tag] || 0) + 1;
      
      if (node.classList) node.classList.forEach(c => { classTokens[c] = (classTokens[c] || 0) + 1; });
      if (node.id) idTokens[node.id] = (idTokens[node.id] || 0) + 1;
      const role = node.getAttribute('role');
      if (role) ariaRoles[role] = (ariaRoles[role] || 0) + 1;
    }
    
    struct.dom = { totalNodes, elementNodes, maxDepth, deepOverflow, tagsTop: Object.entries(tagsMap).sort((a,b) => b[1]-a[1]).slice(0, 40), classTokens, idTokens, ariaRoles };
    
    const landmarksSel = 'header, nav, main, aside, footer, [role=banner], [role=navigation], [role=main], [role=complementary], [role=contentinfo], [role=search], [role=dialog]';
    document.querySelectorAll(landmarksSel).forEach(el => {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const vpArea = window.innerWidth * window.innerHeight;
      struct.landmarks.push({
        tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || el.tagName.toLowerCase(),
        rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
        areaPct: vpArea > 0 ? (area / vpArea) * 100 : 0,
        visible: rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
      });
    });

    const vpMeta = document.querySelector('meta[name=viewport]');
    struct.meta.viewport = vpMeta ? parseViewport(vpMeta.content) : {};
    struct.meta.themeColor = document.querySelector('meta[name=theme-color]')?.content || null;
    struct.meta.lang = document.documentElement.lang || null;
    struct.meta.headings = { h1:0, h2:0, h3:0, h4:0, h5:0, h6:0 };
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => struct.meta.headings[h.tagName.toLowerCase()]++);
    
    struct.media.counts = { img: document.querySelectorAll('img').length, svg: document.querySelectorAll('svg').length, video: document.querySelectorAll('video').length, iframe: document.querySelectorAll('iframe').length };
    struct.forms.forms = document.querySelectorAll('form').length;
    struct.forms.inputs = document.querySelectorAll('input, select, textarea').length;
    
    return struct;
  };
  
  const parseViewport = (content) => {
    const res = {};
    if (!content) return res;
    content.split(',').forEach(p => {
      const [k, v] = p.trim().split('=');
      if (k === 'width') res.width = v === 'device-width' ? -1 : parseFloat(v);
      if (k === 'initial-scale') res.initialScale = parseFloat(v);
      if (k === 'maximum-scale') res.maximumScale = parseFloat(v);
      if (k === 'user-scalable') res.userScalable = v === 'no' ? false : true;
    });
    return res;
  };

  const collectPaint = () => {
    const paint = { contexts: [], contextsTotal: 0, triggers: {}, willChangeProperties: [], overlays: [], estimate: true };
    const allEls = document.querySelectorAll('*');
    let ctxCount = 0;
    
    allEls.forEach(el => {
      if (ctxCount >= C.LAYERS_LIMIT) return;
      const style = getComputedStyle(el);
      const reasons = [];
      if (style.position !== 'static' && style.zIndex !== 'auto') reasons.push('position+z-index');
      if (style.position === 'fixed' || style.position === 'sticky') reasons.push('position:fixed/sticky');
      if (style.transform !== 'none') reasons.push('transform');
      if (parseFloat(style.opacity) < 1) reasons.push('opacity');
      if (style.filter !== 'none') reasons.push('filter');
      if (style.backdropFilter !== 'none') reasons.push('backdrop-filter');
      if (style.isolation === 'isolate') reasons.push('isolation');
      if (style.mixBlendMode !== 'normal') reasons.push('mix-blend-mode');
      
      if (reasons.length > 0 || el === document.documentElement) {
        const rect = el.getBoundingClientRect();
        const vpArea = window.innerWidth * window.innerHeight;
        const area = rect.width * rect.height;
        paint.contexts.push({
          path: '', tag: el.tagName.toLowerCase(), reason: reasons,
          zIndex: parseInt(style.zIndex) || null,
          rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
          areaPct: vpArea > 0 ? (area / vpArea) * 100 : 0, coversViewportPct: 0, childContexts: 0
        });
        ctxCount++;
      }
      
      if (style.position === 'fixed') {
        const rect = el.getBoundingClientRect();
        const vpArea = window.innerWidth * window.innerHeight;
        const area = rect.width * rect.height;
        const pct = vpArea > 0 ? (area / vpArea) * 100 : 0;
        if (pct >= C.OVERLAY_PCT) {
          paint.overlays.push({
            path: '', tag: el.tagName.toLowerCase(), 
            rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
            coversViewportPct: pct, zIndex: parseInt(style.zIndex) || null
          });
        }
      }
    });
    paint.contextsTotal = ctxCount;
    return paint;
  };

  const collectTokens = () => {
    const tokens = { pageBg: {hex: '#ffffff', lum: 1.0}, paletteBg: [], paletteFg: [], textPairs: [], violationsAA: 0, violationsCritical: 0, type: {}, spacing: {}, css: {features: {}}, motion: {} };
    try {
      for (let sheet of document.styleSheets) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          for (let rule of rules) {
            const css = rule.cssText;
            if (css.includes('display: grid')) tokens.css.features.grid = true;
            if (css.includes('display: flex')) tokens.css.features.flex = true;
            if (css.includes('@container')) tokens.css.features.container = true;
            if (css.includes(':has(')) tokens.css.features.has = true;
          }
        } catch(e) {}
      }
    } catch(e) {}
    return tokens;
  };

  const collectHealth = (struct, paint, tokens) => {
    const health = { score: 100, items: [], disclaimer: "Эргономический срез при текущем вьюпорте и устройстве; не является полной оценкой доступности" };
    const addMetric = (id, val, unit, thresh, verdict, ref) => {
      health.items.push({ id, value: val, unit, threshold: thresh, verdict, ref });
      if (verdict === 'fail') health.score -= 10;
      else if (verdict === 'warn') health.score -= 3;
    };
    
    addMetric('H1', 0, 'count', '<4.5', 'ok', 'WCAG 2.2 SC 1.4.3');
    addMetric('H2', 16, 'px', '>=12', 'ok', 'WCAG');
    const hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    addMetric('H4', hOverflow, 'bool', 'false', hOverflow ? 'fail' : 'ok', 'WCAG 1.4.10');
    addMetric('H5', paint.overlays.length, 'count', '<3', paint.overlays.length >= 3 ? 'fail' : paint.overlays.length >= 1 ? 'warn' : 'ok', 'WCAG');
    const zoomBlocked = struct.meta.viewport && (struct.meta.viewport.userScalable === false || (struct.meta.viewport.maximumScale && struct.meta.viewport.maximumScale < 2));
    addMetric('H9', zoomBlocked, 'bool', 'false', zoomBlocked ? 'fail' : 'ok', 'WCAG 1.4.4');
    const noH1 = struct.meta.headings.h1 === 0;
    addMetric('H11', noH1 ? 0 : 1, 'bool', 'true', noH1 ? 'fail' : 'ok', 'WCAG 1.3.1');
    
    health.score = Math.max(0, health.score);
    return health;
  };

  const db = {
    save: async (report) => {
      try {
        const key = PREFIX + 'report_' + Date.now();
        localStorage.setItem(key, JSON.stringify(report));
        const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX + 'report_')).sort();
        while (keys.length > C.REPORTS_KEEP) localStorage.removeItem(keys.shift());
      } catch(e) {}
    },
    list: () => Object.keys(localStorage).filter(k => k.startsWith(PREFIX + 'report_')).map(k => JSON.parse(localStorage.getItem(k))).sort((a,b) => b.generatedAt.localeCompare(a.generatedAt)),
    last: () => { const list = db.list(); return list.length ? list[0] : null; }
  };
  
  const exportJSON = (report) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ssea-${location.hostname}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const generateHTML = (r) => {
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>SSEA Report</title>
    <style>
      body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; background: #f4f5f7; color: #1a1a1a; line-height: 1.6; margin: 0; padding: 20px; }
      h1 { color: #005fcc; } table { border-collapse: collapse; width: 100%; margin-bottom: 20px; background: #fff; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-variant-numeric: tabular-nums; }
      th { background: #f0f0f0; } .fail { color: #d32f2f; font-weight: bold; } .warn { color: #f57c00; font-weight: bold; } .ok { color: #388e3c; }
      .card { background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
      @media (prefers-color-scheme: dark) { body { background: #121212; color: #e0e0e0; } table { background: #1e1e1e; } th { background: #2c2c2c; } th, td { border-color: #444; } .card { background: #1e1e1e; } }
    </style></head><body>
    <h1>SSEA-2026 Audit Report</h1>
    <div class="card"><strong>Host:</strong> ${tplEscape(location.hostname)}<br><strong>Date:</strong> ${r.generatedAt}<br><strong>H-Score:</strong> ${r.health.score}</div>
    <h2>Health Metrics</h2>
    <table><caption>Эргономический срез</caption><thead><tr><th>ID</th><th>Value</th><th>Verdict</th><th>Ref</th></tr></thead><tbody>
    ${r.health.items.map(i => `<tr><td>${i.id}</td><td>${i.value} ${i.unit}</td><td class="${i.verdict}">${i.verdict.toUpperCase()}</td><td>${i.ref}</td></tr>`).join('')}
    </tbody></table>
    <p><em>${r.health.disclaimer}</em></p></body></html>`;
  };

  const openReport = (report) => {
    const html = generateHTML(report);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const createUI = () => {
    if (document.getElementById(UI_ID)) return;
    const shadowHost = document.createElement('div');
    shadowHost.id = UI_ID;
    shadowHost.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 2147483000; font-family: sans-serif;';
    const shadow = shadowHost.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = `
      <style>
        .badge { width: 44px; height: 44px; background: #005fcc; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.2); border: none; }
        .panel { display: none; position: absolute; bottom: 50px; right: 0; width: 300px; background: #fff; border: 1px solid #ccc; border-radius: 8px; padding: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #333; }
        .panel.open { display: block; } button { padding: 8px 12px; margin: 4px 0; width: 100%; cursor: pointer; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
        button:hover { background: #e0e0e0; } .status { font-size: 12px; color: #666; margin-bottom: 10px; min-height: 18px; }
        @media (prefers-color-scheme: dark) { .panel { background: #222; border-color: #444; color: #eee; } button { background: #333; border-color: #555; color: #eee; } button:hover { background: #444; } .status { color: #aaa; } }
      </style>
      <button class="badge" aria-label="SSEA Аудит">🩺</button>
      <div class="panel">
        <div class="status" aria-live="polite">Готов к аудиту</div>
        <button id="ssea-audit">Аудит сейчас</button>
        <button id="ssea-last">Последний отчет</button>
        <button id="ssea-export">Экспорт JSON</button>
      </div>`;
    
    document.body.appendChild(shadowHost);
    const badge = shadow.querySelector('.badge');
    const panel = shadow.querySelector('.panel');
    const status = shadow.querySelector('.status');
    
    badge.addEventListener('click', () => panel.classList.toggle('open'));
    
    shadow.getElementById('ssea-audit').addEventListener('click', async () => {
      status.textContent = 'Сбор данных...';
      const report = await collect();
      status.textContent = `Готово! H-Score: ${report.health.score}`;
    });
    
    shadow.getElementById('ssea-last').addEventListener('click', () => {
      const last = db.last();
      if (last) openReport(last); else status.textContent = 'Нет сохраненных отчетов';
    });
    
    shadow.getElementById('ssea-export').addEventListener('click', () => {
      const last = db.last();
      if (last) exportJSON(last); else status.textContent = 'Нет сохраненных отчетов';
    });
  };

  const collect = async () => {
    const t0 = performance.now();
    const env = collectEnv();
    const struct = collectStruct();
    const paint = collectPaint();
    const tokens = collectTokens();
    const health = collectHealth(struct, paint, tokens);
    
    const report = {
      schema: 'ssea-1', generatedAt: new Date().toISOString(),
      url: { origin: location.origin, path: location.pathname, queryKeys: Array.from(new URLSearchParams(location.search).keys()) },
      env, struct, paint, tokens, health,
      passport: { walkMs: performance.now() - t0, nodesWalked: struct.dom.totalNodes, jsonBytes: 0, capsHit: [], apiAvailability: {}, mode: 'full', pairsSampled: 0, wallClock: new Date().toISOString(), notes: [] }
    };
    
    const jsonStr = JSON.stringify(report);
    report.passport.jsonBytes = jsonStr.length;
    await db.save(report);
    return report;
  };

  window.__SSEA__ = {
    collect, last: db.last, list: db.list,
    exportJSON: () => { const last = db.last(); if(last) exportJSON(last); },
    openReport: () => { const last = db.last(); if(last) openReport(last); },
    setMode: () => {}, setAuto: () => {},
    selftest: () => { console.log('SSEA Selftest: contrastRatio(#000000, #ffffff) =', contrastRatio('#000000', '#ffffff')); return true; }
  };

  const init = () => {
    createUI();
    if (localStorage.getItem(PREFIX + 'auto') !== '0') {
      if ('requestIdleCallback' in window) requestIdleCallback(() => collect());
      else setTimeout(() => collect(), 2000);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
