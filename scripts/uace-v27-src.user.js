// ==UserScript==
// @name         Universal AI Chat Exporter — Polymat v26.0.0 POLYMATH
// @namespace    local.universal.ai.exporter
// @version      26.0.0
// @description  POLYMATH EDITION: IndexedDB-манифест (без лимита 5 МБ) + FNV-1a хеши + единый manifestKey + Mermaid→mermaid.ink + KaTeX/MathJax→LaTeX + colspan-таблицы + retry картинок + артефакты кода в ZIP + разбивка ZIP на тома 50 МБ + showSaveFilePicker + адаптивные задержки + toast + Alt+X/Alt+R + анти-дубликаты имён. Движок v22/v24/v25 полностью: 29+ платформ, 9 форматов, Shadow DOM, resume, только новые.
// @author       local
// @license      MIT
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_VER = '26.0.0';
  const UI_ID = 'uaice-26';
  const IS_FRAME = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();

  function injectModernStyles() {
    if (document.getElementById(UI_ID + '-styles')) return;
    // UI в стиле v20: тёмная панель .box со стопкой однотипных кнопок, статус и версия внутри панели.
    // Дополнения ULTIMATE: grip-заголовок с drag, панель настроек, прокрутка высокой панели.
    const css = `
#${UI_ID}{position:fixed;right:16px;bottom:16px;z-index:2147483647;font:13px system-ui,sans-serif;color:#fff;}
#${UI_ID} .box{display:flex;flex-direction:column;gap:7px;background:rgba(20,20,20,.94);padding:10px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.3);min-width:230px;max-width:320px;max-height:86vh;overflow-y:auto;box-sizing:border-box;}
#${UI_ID} button{border:0;border-radius:7px;padding:8px 10px;cursor:pointer;font:inherit;}
#${UI_ID} button:disabled{opacity:.5;cursor:not-allowed;}
#${UI_ID} .status{font-size:11px;color:#ddd;max-width:300px;white-space:pre-wrap;}
#${UI_ID} .mini{font-size:11px;opacity:.75;}
#${UI_ID} .grip{display:flex;align-items:center;justify-content:space-between;gap:6px;cursor:move;user-select:none;-webkit-user-select:none;font-size:12px;font-weight:600;opacity:.92;padding:1px 2px;}
#${UI_ID} .grip .title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#${UI_ID} .grip button{flex:0 0 auto;padding:2px 9px;font-size:13px;line-height:1.2;}
#${UI_ID} .settings{display:flex;flex-direction:column;gap:6px;border-top:1px solid rgba(255,255,255,.18);padding-top:8px;}
#${UI_ID} .settings input[type="text"]{background:#111;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 6px;font:inherit;font-size:12px;box-sizing:border-box;width:100%;}
#${UI_ID} .settings select{background:#111;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 6px;font:inherit;font-size:12px;}
#${UI_ID} .settings label{display:flex;gap:6px;align-items:center;font-size:12px;color:#ddd;cursor:pointer;}
#${UI_ID} .settings .row{display:flex;gap:6px;}
#${UI_ID} .settings .row button{flex:1;padding:5px 6px;font-size:11px;}
`;
    const s = document.createElement('style');
    s.id = UI_ID + '-styles';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  // PDF-рендер — единственная опциональная CDN-зависимость (с fallback на печать).
  // ZIP — собственная реализация (см. ниже), внешних библиотек не требует.
  const LIBS = {
    html2pdf: [
      'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.12.1/html2pdf.bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    ]
  };

  function loadScript(urls, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
      let i = 0;
      const tryNext = () => {
        if (i >= urls.length) return reject(new Error('Не удалось загрузить библиотеку (CSP?)'));
        const s = document.createElement('script');
        s.src = urls[i++];
        s.onload = () => resolve(globalName ? window[globalName] : true);
        s.onerror = () => { s.remove(); tryNext(); };
        (document.head || document.documentElement).appendChild(s);
      };
      tryNext();
    });
  }

  const MSG_REQ = 'UAICE_EXPORT_REQUEST';
  const MSG_RES = 'UAICE_EXPORT_RESULT';

  const CFG = {
    MIN_TEXT: 8, MIN_TOTAL_TEXT: 80, CLICK_WAIT: 800, STABLE_MS: 1200,
    MAX_WAIT: 25000, POLL: 300, SCROLL_ROUNDS: 50, SCROLL_WAIT: 550, TAB_CHILD_TIMEOUT: 65000,
    DEDUPE_CAP: 400, MSG_MIN: 1, MSG_MAX: 800, IMG_PER_MSG: 40, IMG_TOTAL: 60, IMG_TIMEOUT: 10000,
    SNAPSHOT_MAX: 200000, ADAPTIVE: true, BASE_CLICK: 800, BASE_SCROLL: 550, BASE_POLL: 300,
    MAX_CLICK: 1800, MAX_SCROLL: 900, IMG_RETRIES: 3, MAX_ZIP_MB: 50, ARTIFACTS_MAX: 100
  };

  const FORMATS = ['md', 'json', 'txt', 'html', 'pdf', 'zip', 'sharegpt', 'jsonl', 'alpaca'];

  let CANCEL = false;
  let busy = false;
  let tabsExportRunning = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ts = () => now().replace(/[: ]/g, '-');
  function safeStorageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function safeStorageRemove(k) { try { localStorage.removeItem(k); } catch (e) {} }

  // ============ v26 POLYMATH: АДАПТИВНЫЕ ЗАДЕРЖКИ ============
  function isPageBusy() {
    try { return document.querySelectorAll('[class*="loading"],[class*="spinner"],[class*="busy"],[aria-busy="true"],[data-loading="true"]').length > 0; } catch (e) { return false; }
  }
  function adaptiveMs(base, maxCap) {
    const enabled = (safeStorageGet('uaice_adaptive') !== '0') && CFG.ADAPTIVE;
    if (!enabled) return base;
    const v = Math.round(base * (isPageBusy() ? 2.1 : 1));
    return maxCap ? Math.min(v, maxCap) : v;
  }
  function clickWait() { return adaptiveMs(CFG.BASE_CLICK || CFG.CLICK_WAIT, CFG.MAX_CLICK); }
  function scrollWait() { return adaptiveMs(CFG.BASE_SCROLL || CFG.SCROLL_WAIT, CFG.MAX_SCROLL); }
  function pollWait() { return adaptiveMs(CFG.BASE_POLL || CFG.POLL, 800); }

  // ============ v26 POLYMATH: TOAST (виден и при свёрнутой панели) ============
  function toast(msg, ms) {
    try {
      const t = document.createElement('div');
      t.textContent = String(msg || '');
      t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:rgba(20,20,20,.96);color:#fff;padding:10px 16px;border-radius:8px;font:13px system-ui,sans-serif;z-index:2147483647;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none;opacity:0;transition:opacity .18s;max-width:70vw;';
      (document.body || document.documentElement).appendChild(t);
      requestAnimationFrame(() => { try { t.style.opacity = '1'; } catch (e) {} });
      setTimeout(() => { try { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); } catch (e) {} }, ms || 2500);
    } catch (e) {}
  }

  // ============ v26 POLYMATH: INDEXEDDB (манифест без лимита ~5 МБ) ============
  const HAS_IDB = (function () { try { return typeof indexedDB !== 'undefined' && !!indexedDB.open; } catch (e) { return false; } })();
  const IDB_NAME = 'UAICE_POLYMATH_DB';
  const IDB_STORE_MAN = 'manifest';
  let _idbPromise = null;
  function idbOpen() {
    if (_idbPromise) return _idbPromise;
    _idbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE_MAN)) db.createObjectStore(IDB_STORE_MAN, { keyPath: 'id' });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject(req.error || new Error('IDB open failed'));
      } catch (e) { reject(e); }
    });
    return _idbPromise;
  }
  function idbRun(store, mode, fn) {
    return idbOpen().then((db) => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(store, mode);
        const out = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : null);
        tx.onerror = () => reject(tx.error || new Error('IDB tx failed'));
      } catch (e) { reject(e); }
    }));
  }
  function idbGetAll() { return HAS_IDB ? idbRun(IDB_STORE_MAN, 'readonly', (s) => s.getAll()).catch(() => []) : Promise.resolve([]); }
  function idbPutMany(arr) { return HAS_IDB ? idbRun(IDB_STORE_MAN, 'readwrite', (s) => { for (let i = 0; i < arr.length; i++) s.put(arr[i]); }).catch(() => {}) : Promise.resolve(); }
  function idbClearMan() { return HAS_IDB ? idbRun(IDB_STORE_MAN, 'readwrite', (s) => s.clear()).catch(() => {}) : Promise.resolve(); }

  function now() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function sanitize(s, m) {
    m = m || 80;
    const raw = String(s || 'export');
    const norm = raw.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
    let out = norm.slice(0, m);
    // v26: имя длиннее лимита получает хеш-суффикс (анти-дубликат на Windows/FS)
    if (norm.length > m) out += '-' + hashString(raw).slice(0, 6);
    return out || 'export';
  }
  function pageTitle() {
    let t = (document.title || '').trim();
    t = t.replace(/\s*[-–|·]\s*[^-–|·]{0,40}$/i, '').trim();
    return t.length > 1 ? t.slice(0, 120) : 'export';
  }
  // Схлопывание повторяющегося текста (артефакт виртуализированного DOM): "abcabcabc" -> "abc"
  function dedupeText(s) {
    s = String(s || '');
    if (s.length < 6 || s.length > 400) return s;
    for (let n = 2; n <= 4; n++) {
      if (s.length % n !== 0) continue;
      const chunk = s.slice(0, s.length / n);
      if (!chunk) continue;
      let rep = true;
      for (let i = 1; i < n; i++) { if (s.slice(i * chunk.length, (i + 1) * chunk.length) !== chunk) { rep = false; break; } }
      if (rep) return chunk;
    }
    return s;
  }
  // Срезание UI-обёрток перед текстом ("Ваш запрос", "Ответ Gemini", "You said" и т.п.)
  function stripUiPrefix(text) {
    if (!text) return text;
    const lines = String(text).split('\n');
    let i = 0;
    while (i < lines.length) {
      const st = lines[i].replace(/^#+\s*/, '').trim();
      if (/^(Ответ\s+\S+|Ваш\s+запрос|Gemini|You\s+said|ChatGPT\s+said|Assistant\s+said|User\s+said|DeepSeek|Claude|Grok|Kimi|Qwen|Mistral|Copilot|GPT)$/i.test(st)) {
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
      } else break;
    }
    return lines.slice(i).join('\n').trim();
  }
  // Прогресс-бар в строке статуса: [█████·----] 3/10 Заголовок
  function progress(i, n, label) {
    const f = Math.max(0, Math.min(10, Math.round(10 * (i) / Math.max(1, n))));
    return '[' + '█'.repeat(f) + '·'.repeat(10 - f) + '] ' + (i + 1) + '/' + n + ' ' + (label || '');
  }

  // ============ ПЛАТФОРМЫ (28 из v22.1.7 + Dola; хосты расширены из v24) ============
  const PLATFORMS = [
    { name: 'ChatGPT', hosts: [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/],
      msgSelectors: ['[data-message-author-role]', 'article[data-testid^="conversation-turn"]'],
      roleAttr: 'data-message-author-role', chatUrlPattern: '/c/{id}',
      sidebarSelectors: ['#stage-slideover-sidebar', 'nav[aria-label*="Chat" i]', 'nav', 'aside'] },
    { name: 'Claude', hosts: [/(^|\.)claude\.ai$/],
      msgSelectors: ['[data-testid="user-message"]', '[data-testid="assistant-message"]', '.font-claude-message', '.font-user-message'],
      role: (el) => el.matches('[data-testid="user-message"], .font-user-message') ? 'user' : 'assistant',
      chatUrlPattern: '/chat/{id}' },
    { name: 'Gemini', hosts: [/(^|\.)(gemini\.google\.com|bard\.google\.com)$/],
      msgSelectors: ['user-query', 'model-response', 'conversation-turn', 'ms-chat-turn'],
      role: (el) => {
        const t = el.tagName.toLowerCase();
        if (t === 'user-query') return 'user';
        if (t === 'model-response') return 'assistant';
        return /user|query|human/i.test(el.className || '') ? 'user' : 'assistant';
      },
      chatUrlPattern: '/app/{id}', sidebarSelectors: ['side-navigation-v2', 'bard-sidenav', 'mat-sidenav'] },
    { name: 'Google AI Studio', hosts: [/(^|\.)aistudio\.google\.com$/],
      msgSelectors: ['[data-test-id="user-message"]', '[data-test-id="model-message"]', 'ms-chat-turn'],
      role: (el) => (el.getAttribute('data-role') || '') === 'user' ? 'user' : 'assistant' },
    { name: 'DeepSeek', hosts: [/(^|\.)deepseek\.com$/],
      msgSelectors: ['[class*="message"]', '[class*="_message"]'],
      role: (el) => /user|human|query/i.test(el.className || '') ? 'user' : 'assistant',
      chatUrlPattern: '/a/chat/s/{id}',
      sidebarSelectors: ['aside', 'nav', '[class*="sidebar"]', '[class*="sider"]', '[class*="history"]'] },
    { name: 'Qwen', hosts: [/(^|\.)(qwen\.ai|tongyi\.aliyun\.com)$/],
      msgSelectors: ['[class*="_message"]', '[data-message-role]', '[class*="chat-message"]', '[class*="markdown"]'],
      role: (el) => {
        const c = (el.className || '') + ' ' + (el.getAttribute('data-message-role') || '') + ' ' + (el.getAttribute('data-role') || '');
        if (/user|human|question/i.test(c)) return 'user';
        if (/assistant|bot|ai|model|response/i.test(c)) return 'assistant';
        return 'unknown';
      },
      chatUrlPattern: '/c/{id}',
      sidebarSelectors: ['.sidebar-side', '.session-list-wrapper', 'a[aria-label="chat-item"]', 'a.chat-item-drag-link', '[class*="sidebar"]', 'aside', 'nav'] },
    { name: 'Kimi', hosts: [/(^|\.)(kimi\.moonshot\.cn|kimi\.ai|kimi\.com)$/],
      msgSelectors: ['.segment', '.segment-container', '[class*="message"]'],
      role: (el) => /user|human/i.test((el.className || '') + ' ' + (el.getAttribute('data-role') || '')) ? 'user' : 'assistant',
      sidebarSelectors: ['aside', 'nav', '.next-sidebar', '[class*="sidebar"]'] },
    { name: 'MiniMax', hosts: [/(^|\.)(minimax\.io|minimaxi\.com)$/],
      msgSelectors: ['[class*="message"]', '[class*="chat-item"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Mistral Le Chat', hosts: [/(^|\.)mistral\.ai$/],
      msgSelectors: ['[data-message-role]', '[class*="Message"]', '[class*="message"]'],
      role: (el) => {
        const r = el.getAttribute('data-message-role') || '';
        if (/user/i.test(r)) return 'user';
        if (/assistant/i.test(r)) return 'assistant';
        return /user/i.test(el.className || '') ? 'user' : 'assistant';
      } },
    { name: 'Groq', hosts: [/(^|\.)groq\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'OpenRouter', hosts: [/(^|\.)openrouter\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'HuggingChat', hosts: [/(^|\.)huggingface\.co$/], path: /^\/chat/,
      msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'NVIDIA NIM', hosts: [/(^|\.)build\.nvidia\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Z.ai', hosts: [/(^|\.)(z\.ai|chatglm\.cn|space-z\.ai)$/],
      msgSelectors: ['[data-role="user"]', '[data-role="assistant"]', '[data-message-role]', '[class*="UserMessage"]', '[class*="AssistantMessage"]', '[class*="message"]', '[class*="chat-message"]'],
      role: (el) => {
        const e = el.getAttribute('data-role') || el.getAttribute('data-message-role') || '';
        if (e) return /user|human/i.test(e) ? 'user' : 'assistant';
        return /user|human/i.test(el.className || '') ? 'user' : 'assistant';
      },
      chatUrlPattern: '/c/{id}',
      sidebarSelectors: ['.chat-aside', '.chat-history-list', '[class*="chat-aside"]', '[class*="chat-history"]', 'aside', 'nav'] },
    { name: 'Pollinations', hosts: [/(^|\.)pollinations\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Puter', hosts: [/(^|\.)puter\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Open WebUI', hosts: [/openwebui/, /^localhost(?::\d+)?$/, /^127\.0\.0\.1(?::\d+)?$/],
      msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Cloudflare AI', hosts: [/(^|\.)playground\.ai\.cloudflare\.com$/],
      msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Grok', hosts: [/(^|\.)grok\.com$/], msgSelectors: ['[class*="message"]', '[class*="message-bubble"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant',
      chatUrlPattern: '/c/{id}', sidebarSelectors: ['aside', 'nav', '[class*="sidebar"]', '[class*="sidebar-group"]'] },
    { name: 'Microsoft Copilot', hosts: [/(^|\.)copilot\.microsoft\.com$/],
      msgSelectors: ['[class*="message"]', '[class*="turn"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Perplexity', hosts: [/(^|\.)perplexity\.ai$/],
      msgSelectors: ['[class*="query"]', '[class*="answer"]', '[class*="message"]'],
      role: (el) => /query|user|human/i.test(el.className || '') ? 'user' : 'assistant',
      chatUrlHints: [/\/search\//] },
    { name: 'Poe', hosts: [/(^|\.)poe\.com$/],
      msgSelectors: ['[class*="human-message"]', '[class*="chat-message"]', '[class*="message"]'],
      role: (el) => /human|user/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Character.ai', hosts: [/(^|\.)character\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'You.com', hosts: [/(^|\.)you\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Doubao', hosts: [/(^|\.)doubao\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Tencent Yuanbao', hosts: [/(^|\.)yuanbao\.tencent\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Meta AI', hosts: [/(^|\.)meta\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Yandex Alice AI', hosts: [/(^|\.)alice\.yandex\.ru$/],
      msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Yandex Alice (path)', hosts: [/(^|\.)yandex\.(ru|com)$/], path: /\/alice\//i,
      msgSelectors: ['[class*="message"]', '[class*="chat"]'],
      role: (el) => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
    { name: 'Dola', hosts: [/(^|\.)dola\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat-message"]'],
      role: (el) => {
        const c = (el.className || '').toLowerCase();
        if (/user|human|question/i.test(c)) return 'user';
        if (/bot|assistant|ai|response|reply/i.test(c)) return 'assistant';
        return 'unknown';
      },
      chatUrlPattern: '/chat/{id}',
      sidebarSelectors: ['#flow_chat_sidebar', 'nav[class*="panel-"]', '[class*="conversation-item"]', 'nav', 'aside'] }
  ];

  function getPlatform() {
    const host = location.host, path = location.pathname;
    for (const p of PLATFORMS) {
      let ok = false;
      for (const re of p.hosts) { try { if (re.test(host)) { ok = true; break; } } catch (e) {} }
      if (!ok) continue;
      if (p.path) { try { if (!p.path.test(path)) continue; } catch (e) {} }
      return p;
    }
    return null;
  }

  // ============ DOM-ХЕЛПЕРЫ И ФИЛЬТРЫ ============
  const SKIP_TAGS = new Set(['STYLE','SCRIPT','LINK','META','NOSCRIPT','TEMPLATE','HEAD','TITLE','BASE','HTML','SVG','PATH','G','DEFS','MAT-ICON','BR','HR']);
  const HARD_EXCLUDE = '#' + UI_ID + ',[class*="tooltip"]:not([class*="content"]),[class*="popover"]:not([class*="content"])';
  const CHAT_AREA = 'div.chat-container,#chat-history,[data-test-id="chat-history-container"],conversation-container,div.conversation-container,ms-chat-turn,[class*="chat-history-scroll"],[class*="turn-content"],main,[role="main"]';

  function isInHardExclude(el) {
    let p = el, d = 0;
    while (p && p !== document.body && d < 15) {
      try { if (p.matches && p.matches(HARD_EXCLUDE)) return true; } catch (e) {}
      p = p.parentElement; d++;
    }
    return false;
  }
  function isInNavigation(el) {
    let p = el, d = 0;
    while (p && p !== document.body && d < 12) {
      const tag = p.tagName ? p.tagName.toLowerCase() : '';
      const role = p.getAttribute ? (p.getAttribute('role') || '') : '';
      if (tag === 'nav' || tag === 'aside' || role === 'navigation') return true;
      if (tag === 'mat-sidenav' || tag === 'bard-sidenav' || tag === 'side-navigation-v2') return true;
      const c = (typeof p.className === 'string' ? p.className : (p.className && p.className.baseVal) || '').toLowerCase();
      if (/(^|[-_ ])(sidebar|sidenav|side-nav|drawer|chat-list|conversation-list|history-list|nav-|panel-left)([-_ ]|$)/.test(c)) return true;
      p = p.parentElement; d++;
    }
    return false;
  }
  function isInChatArea(el) {
    if (!el || !el.closest) return false;
    try { if (el.closest('aside, nav, [role="navigation"], [class*="sidebar"], [class*="sider"]')) return false; } catch (e) {}
    try { return !!el.closest(CHAT_AREA); } catch (e) { return false; }
  }
  function cls(el) { if (!el || !el.className) return ''; const c = el.className; return (typeof c === 'string' ? c : c.baseVal || '').toLowerCase(); }
  function clean(s) {
    return String(s || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ')
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function txt(el) {
    if (!el || SKIP_TAGS.has(el.tagName)) return '';
    let out = '';
    try { const x = el.innerText; if (x && x.trim()) out = x.trim(); } catch (e) {}
    if (!out) out = (el.textContent || '').trim();
    return dedupeText(out);
  }
  function isCssOrJs(s) {
    if (!s) return false;
    const head = s.slice(0, 800);
    if (/_ngcontent|_nghost/.test(head)) return true;
    const decl = (head.match(/[a-z-]+\s*:\s*[^;{}\n]+\s*[;\n]/gi) || []).length;
    if (!decl) return false;
    const lines = head.split('\n').filter((l) => l.trim()).length || 1;
    const hasBraces = /[{}]/.test(head);
    if (hasBraces && decl >= 5 && decl / lines > 0.5) return true;
    if (/@media|@font-face|@keyframes/.test(head) && decl >= 3) return true;
    return false;
  }
  function isSourceListing(s) {
    if (!s || s.length > 400) return false;
    if (/\d+\s*(источник|источника|источников|source|sources)/i.test(s)) return true;
    if (/\d+\s*(дн\.|день|дня|дней|day|days)\s*(назад|ago)/i.test(s)) return true;
    if (/только для скачивания/i.test(s)) return true;
    return false;
  }
  function isVisible(el) { try { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch (e) { return true; } }

  function dedupeNested(els) {
    let arr = Array.from(els);
    if (arr.length > CFG.DEDUPE_CAP) arr = arr.slice(0, CFG.DEDUPE_CAP);
    const isContainer = new Set();
    for (const x of arr) {
      const held = arr.filter((y) => y !== x && x.contains(y) && !arr.some((z) => z !== x && z !== y && z.contains(y) && x.contains(z)));
      if (held.length >= 2) isContainer.add(x);
    }
    const drop = new Set();
    for (const x of arr) {
      if (isContainer.has(x)) continue;
      for (const y of arr) { if (y !== x && y.contains(x) && !isContainer.has(y)) { drop.add(x); break; } }
    }
    return arr.filter((e) => !drop.has(e) && !isContainer.has(e));
  }

  // ============ SHADOW DOM: обход открытых shadow-корней (с TTL-кэшем) ============
  let _srCache = null, _srCacheAt = 0;
  function collectShadowRoots(root) {
    const roots = [];
    const seen = new Set();
    const nowMs = Date.now();
    const cached = (!root && _srCache && (nowMs - _srCacheAt) < 1500) ? _srCache : null;
    if (cached) return cached.slice();
    const walk = (r) => {
      if (!r || seen.has(r)) return;
      seen.add(r);
      let all;
      try { all = r.querySelectorAll('*'); } catch (e) { return; }
      for (let i = 0; i < all.length; i++) {
        const sr = all[i].shadowRoot;
        if (sr) { roots.push(sr); walk(sr); }
      }
    };
    try { walk(root || document); } catch (e) {}
    if (!root) { _srCache = roots; _srCacheAt = nowMs; }
    return roots;
  }
  // querySelectorAll по документу + всем открытым shadow-корням (в порядке появления)
  function deepQueryAll(sel, root) {
    const scopes = [root || document].concat(collectShadowRoots(root));
    const out = [];
    for (const sc of scopes) {
      let found;
      try { found = sc.querySelectorAll(sel); } catch (e) { continue; }
      for (const el of found) if (out.indexOf(el) === -1) out.push(el);
    }
    return out;
  }

  function roleFromValue(v) {
    const x = String(v || '').toLowerCase().trim();
    if (/^(user|human|you|me|client|prompt|question|query)$/.test(x)) return 'user';
    if (/^(assistant|bot|ai|model|response|answer|reply)$/.test(x)) return 'assistant';
    if (/(^|[-_ ])(user|human|query|prompt|question)([-_ ]|$)/.test(x)) return 'user';
    if (/(^|[-_ ])(assistant|bot|model|response|answer|reply)([-_ ]|$)/.test(x)) return 'assistant';
    return null;
  }

  function detectRole(el, platform) {
    if (platform && platform.roleAttr) { const v = roleFromValue(el.getAttribute(platform.roleAttr)); if (v) return v; }
    if (platform && typeof platform.role === 'function') { try { const r = platform.role(el); if (r === 'user' || r === 'assistant') return r; } catch (e) {} }
    if (el.tagName) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'user-query') return 'user';
      if (tag === 'model-response') return 'assistant';
    }
    const score = { user: 0, assistant: 0 };
    const nodes = [el]; let p = el.parentElement;
    for (let i = 0; i < 5 && p; i++, p = p.parentElement) nodes.push(p);
    for (let ni = 0; ni < nodes.length; ni++) {
      const n = nodes[ni]; const w = ni === 0 ? 1 : 0.6;
      for (const a of n.attributes || []) {
        const name = a.name.toLowerCase(), value = String(a.value || '').toLowerCase();
        if (/role|author|sender|speaker|type|side|from/i.test(name)) {
          if (/user|human|you\b|me\b|client|question|prompt|query/i.test(value)) score.user += 8 * w;
          if (/assistant|bot|model|response|answer|reply/i.test(value)) score.assistant += 8 * w;
        }
      }
      const r1 = roleFromValue(cls(n));
      if (r1) score[r1] += (ni === 0 ? 6 : 4) * w;
    }
    if (el.querySelector && el.querySelector('[class*="markdown"],[class*="prose"],.katex')) score.assistant += 5;
    if (score.user >= score.assistant + 4 && score.user >= 5) return 'user';
    if (score.assistant >= score.user + 4 && score.assistant >= 5) return 'assistant';
    return 'unknown';
  }

  function filterValid(found) {
    const valid = [];
    found.forEach((el) => {
      if (isInHardExclude(el)) return;
      if (isInNavigation(el)) return;
      if (!isVisible(el)) return;
      const t = txt(el);
      if (!t || t.length < CFG.MIN_TEXT) return;
      if (isCssOrJs(t) || isSourceListing(t)) return;
      valid.push(el);
    });
    return valid;
  }

  // ============ ПОИСК СООБЩЕНИЙ ============
  function findMessages() {
    const platform = getPlatform();
    const UNIVERSAL = ['[data-message-author-role]','[data-testid="user-message"]','[data-testid="assistant-message"]','user-query','model-response','.segment','.segment-container','[data-message-role]','[data-message-id]','[class*="UserMessage"]','[class*="AssistantMessage"]','[class*="user-message"]:not([class*="input"]):not([class*="fixed"])','[class*="assistant-message"]:not([class*="input"]):not([class*="fixed"])','[class*="Message_container"]','[class*="MessageContainer"]','div.conversation-container'];
    const trySel = (sel) => {
      let found = deepQueryAll(sel);
      if (!found || found.length < 1) return null;
      const valid = dedupeNested(filterValid(found));
      return valid.length ? valid : null;
    };
    if (platform) {
      for (let i = 0; i < platform.msgSelectors.length; i++) {
        const valid = trySel(platform.msgSelectors[i]);
        if (valid && (i === 0 ? valid.length >= 2 : valid.length >= CFG.MSG_MIN)) {
          return { items: valid.slice(0, CFG.MSG_MAX), source: platform.msgSelectors[i], platform: platform };
        }
      }
      let best = null, bestSel = '';
      for (const sel of platform.msgSelectors.concat(UNIVERSAL)) {
        const valid = trySel(sel);
        if (valid && valid.length > (best ? best.length : 0)) { best = valid; bestSel = sel; }
      }
      if (best) return { items: best.slice(0, CFG.MSG_MAX), source: bestSel, platform: platform };
    }
    let best = null, bestSel = '';
    for (const sel of UNIVERSAL) {
      const valid = trySel(sel);
      if (valid && valid.length > (best ? best.length : 0)) { best = valid; bestSel = sel; }
    }
    if (best) return { items: best.slice(0, CFG.MSG_MAX), source: bestSel, platform: platform };

    // Эвристика: крупнейшая группа однотипных детей основного контейнера (из v20)
    const heur = heuristicMessages();
    if (heur && heur.length >= 2) return { items: heur.slice(0, CFG.MSG_MAX), source: 'heuristic', platform: platform };
    return null;
  }

  function heuristicMessages() {
    const containers = deepQueryAll('main, article, section, [role="main"], [class*="conversation"], [class*="chat"]');
    let best = null;
    for (const c of containers) {
      const groups = {};
      Array.from(c.children || []).forEach((child) => {
        const key = child.tagName + '|' + (typeof child.className === 'string' ? child.className : '').split(/\s+/).slice(0, 3).join(' ');
        (groups[key] = groups[key] || []).push(child);
      });
      for (const key of Object.keys(groups)) {
        const group = dedupeNested(filterValid(groups[key]));
        if (group.length >= 3 && (!best || group.length > best.length)) best = group;
      }
      // второй уровень: внуки (виртуализированные списки)
      Array.from(c.children || []).forEach((mid) => {
        Array.from(mid.children || []).forEach((child) => {
          const key = child.tagName + '|' + (typeof child.className === 'string' ? child.className : '').split(/\s+/).slice(0, 3).join(' ');
          (groups['@' + key] = groups['@' + key] || []).push(child);
        });
      });
      for (const key of Object.keys(groups)) {
        if (!/^@/.test(key)) continue;
        const group = dedupeNested(filterValid(groups[key]));
        if (group.length >= 3 && (!best || group.length > best.length)) best = group;
      }
    }
    return best;
  }

  // ============ ТЕКСТ / MARKDOWN ============
  let renderHolder = null;
  function getRenderHolder() {
    if (!renderHolder || !renderHolder.isConnected) {
      renderHolder = document.createElement('div');
      renderHolder.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;pointer-events:none;opacity:0;z-index:-1;white-space:normal;';
      (document.body || document.documentElement).appendChild(renderHolder);
    }
    return renderHolder;
  }
  // Клон присоединяется к скрытому держателю в документе — innerText считает переносы корректно.
  function extractText(el) {
    const clone = el.cloneNode(true);
    const remove = clone.querySelectorAll('style,script,link,meta,noscript,template,svg,button,nav,footer,[role="button"],[role="toolbar"],.sr-only,time,[class*="timestamp"],[class*="copy-button"],[class*="action-bar"],[class*="toolbar"],[class*="feedback"],[class*="rating"],mat-icon,[class*="icon"]:not([class*="content"]),[data-icon],i[class*="fa-"]');
    for (let i = 0; i < remove.length; i++) remove[i].remove();
    const holder = getRenderHolder();
    holder.appendChild(clone);
    let t = '';
    try { t = clean(clone.innerText || ''); } catch (e) { t = (clone.textContent || '').trim(); }
    clone.remove();
    return t;
  }

  const MD_REMOVE = 'style,script,link,meta,noscript,template,svg,button,nav,footer,header,[role="button"],[role="toolbar"],[aria-hidden="true"],.sr-only,time,[class*="timestamp"],[class*="copy-button"],[class*="action-bar"],[class*="toolbar"],[class*="feedback"],[class*="rating"],mat-icon,[data-icon]';

  // v25.0.1: вычистка хрома код-виджетов (язык «python», кнопки «Run/Copy»),
  // которые рендерятся div/span-ами рядом с <pre> и не ловятся MD_REMOVE.
  // Правило: элемент/текстовый узел-сосед pre удаляется, только если он состоит
  // ТОЛЬКО из токенов-хрома (названия языков и подписки кнопок). React-DOM не
  // вставляет пробелов между span-ами, поэтому «pythonRunCopy» — тоже хром.
  // Проза вида «Run the code» / «Код на Python это круто» не трогается.
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const CHROME_TOKENS = ['python', 'python3', 'javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx', 'java', 'c', 'c++', 'cpp', 'csharp', 'cs', 'go', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'bash', 'sh', 'shell', 'zsh', 'powershell', 'sql', 'html', 'css', 'scss', 'less', 'json', 'json5', 'yaml', 'yml', 'xml', 'toml', 'ini', 'markdown', 'md', 'text', 'txt', 'plaintext', 'perl', 'r', 'matlab', 'dart', 'lua', 'groovy', 'objc', 'objectivec', 'pascal', 'fortran', 'haskell', 'elixir', 'erlang', 'clojure', 'vb', 'vba', 'asm', 'assembly', 'wasm', 'graphql', 'dockerfile', 'makefile', 'diff', 'mermaid', 'run', 'copy', 'код', 'язык', 'запустить', 'выполнить', 'копировать', 'показать', 'скрыть', 'свернуть', 'развернуть', 'collapse', 'expand', 'toggle', 'wrap', 'nowrap', 'edit', 'done', 'save', 'share', 'download'];
  const CHROME_TOKENS_SORTED = CHROME_TOKENS.slice().sort((a, b) => b.length - a.length);
  const CHROME_ALT = CHROME_TOKENS_SORTED.map(escapeRe).join('|');
  const CHROME_TOKEN_PREFIX_RE = new RegExp('^(?:' + CHROME_ALT + ')', 'i');
  const CHROME_TOKEN_FULL_RE = new RegExp('^(?:' + CHROME_ALT + ')$', 'i');
  function isChromeText(t) {
    const s = String(t || '').trim();
    if (!s || s.length > 40) return false;
    const words = s.split(/\s+/);
    if (words.length <= 4 && words.every((w) => CHROME_TOKEN_FULL_RE.test(w))) return true;
    let rest = s.toLowerCase(), guard = 0;
    while (rest.length && guard++ < 10) {
      const m = rest.match(CHROME_TOKEN_PREFIX_RE);
      if (!m) return false;
      rest = rest.slice(m[0].length);
    }
    return rest.length === 0;
  }
  function stripCodeChrome(root) {
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

  // v26: Mermaid-диаграммы → ссылка на SVG-рендер (mermaid.ink), zero-dependency
  function mermaidEnabled() { return safeStorageGet('uaice_mermaid') !== '0'; }
  function processMermaid(content) {
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

  function domToMarkdown(el) {
    const root = el.cloneNode(true);
    let rm;
    try { rm = root.querySelectorAll(MD_REMOVE); } catch (e) { rm = []; }
    for (let i = 0; i < rm.length; i++) rm[i].remove();
    stripCodeChrome(root);
    // v26: KaTeX/MathJax → LaTeX-математика в markdown. ВАЖНО: до MD_REMOVE,
    // иначе annotation[aria-hidden] вычищается и формула теряется целиком.
    try {
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
      if (tag === 'code') return '`' + clean(node.textContent) + '`';
      if (tag === 'img') { const src = node.getAttribute('src') || ''; if (!src) return ''; return '![' + (node.getAttribute('alt') || '') + '](' + src + ')'; }
      if (tag === 'a') { const href = node.getAttribute('href') || ''; const v = clean(children(node)); return href ? '[' + (v || href) + '](' + href + ')' : v; }
      if (/^h[1-6]$/.test(tag)) return '\n\n' + '#'.repeat(Number(tag[1])) + ' ' + clean(children(node)) + '\n\n';
      if (tag === 'strong' || tag === 'b') { const v = clean(children(node)); return v ? '**' + v + '**' : ''; }
      if (tag === 'em' || tag === 'i') { const v = clean(children(node)); return v ? '*' + v + '*' : ''; }
      if (tag === 'del' || tag === 's') { const v = clean(children(node)); return v ? '~~' + v + '~~' : ''; }
      if (tag === 'blockquote') { const v = clean(children(node)); return '\n\n' + v.split('\n').map((l) => '> ' + l).join('\n') + '\n\n'; }
      if (tag === 'li') { const ordered = node.parentElement && node.parentElement.tagName.toLowerCase() === 'ol'; return (ordered ? '1. ' : '- ') + clean(children(node)) + '\n'; }
      if (tag === 'ul' || tag === 'ol') {
        // v25.0.1: настоящая нумерация <ol> вместо «1. 1. 1.»
        const ordered = tag === 'ol';
        let lis = [];
        try { lis = Array.from(node.children || []).filter((c) => c && c.tagName && c.tagName.toLowerCase() === 'li'); } catch (e) {}
        if (lis.length) {
          const body = lis.map((li, i) => (ordered ? (i + 1) + '. ' : '- ') + clean(children(li)) + '\n').join('');
          return '\n\n' + body + '\n';
        }
        return '\n\n' + children(node) + '\n';
      }
      if (tag === 'table') return tableToMarkdown(node);
      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'figure') return '\n' + children(node) + '\n';
      return children(node);
    }
    function tableToMarkdown(table) {
      let rows;
      try { rows = Array.from(table.querySelectorAll('tr')); } catch (e) { return ''; }
      if (!rows.length) return '';
      // v26: поддержка colspan — объединённые ячейки дополняются пустыми, колонки не уезжают
      const matrix = rows.map((row) => {
        const cells = [];
        try {
          Array.from(row.querySelectorAll('th,td')).forEach((cell) => {
            const t = clean(cell.innerText || cell.textContent || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
            const cs = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1);
            cells.push(t);
            for (let k = 1; k < cs; k++) cells.push('');
          });
        } catch (e) {}
        return cells;
      });
      const width = Math.max(1, ...matrix.map((r) => r.length));
      const norm = matrix.map((r) => { const c = r.slice(); while (c.length < width) c.push(''); return c; });
      const head = norm[0];
      let out = '\n\n| ' + head.join(' | ') + ' |\n| ' + head.map(() => '---').join(' | ') + ' |\n';
      out += norm.slice(1).map((r) => '| ' + r.join(' | ') + ' |').join('\n') + '\n\n';
      return out;
    }
    return clean(walk(root));
  }

  const THINK_SELECTORS = ['[class*="think"]','[class*="reason"]','[class*="analysis"]','[class*="thought"]','[data-testid*="think"]','[data-testid*="reason"]','[data-testid*="analysis"]','[aria-label*="thinking" i]','[aria-label*="reasoning" i]'];
  function extractThinking(el) {
    const nodes = [];
    for (const sel of THINK_SELECTORS) { nodes.push(...deepQueryAll(sel, el)); }
    const unique = dedupeNested(nodes);
    const out = [];
    for (const n of unique) { const t = domToMarkdown(n); if (t && out.indexOf(t) === -1) out.push(t); }
    return out;
  }

  // Сбор картинок и вложений сообщения (для ZIP-режима)
  function collectMedia(el, msgIndex) {
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
        const a = atts[i];
        const href = a.getAttribute('href') || '';
        if (!href || /^(#|javascript:)/i.test(href)) continue;
        attachments.push({
          url: new URL(href, location.href).href,
          name: a.getAttribute('data-filename') || a.getAttribute('download') || (href.split('/').pop() || 'file').split('?')[0]
        });
      }
    } catch (e) {}
    return { images: images, attachments: attachments };
  }

  // v26: артефакты — код-блоки как отдельные файлы для ZIP
  const LANG_EXT = { javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py', ruby: 'rb', go: 'go', golang: 'go', rust: 'rs', java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', 'c#': 'cs', php: 'php', bash: 'sh', shell: 'sh', sh: 'sh', html: 'html', css: 'css', json: 'json', yaml: 'yml', yml: 'yml', xml: 'xml', markdown: 'md', md: 'md', sql: 'sql', r: 'r', swift: 'swift', kotlin: 'kt', scala: 'scala', perl: 'pl', lua: 'lua', dart: 'dart', toml: 'toml', ini: 'ini', tex: 'tex', matlab: 'm', mermaid: 'mmd' };
  function collectArtifacts(el, msgIndex) {
    const arts = [];
    try {
      const pres = el.querySelectorAll('pre');
      for (let i = 0; i < pres.length && arts.length < 30; i++) {
        const pre = pres[i];
        const code = pre.querySelector('code') || pre;
        let lang = '';
        const cls = (code.className || '') + ' ' + (pre.className || '');
        const mm = cls.match(/language-([\w+#-]+)/i) || cls.match(/lang-([\w+#-]+)/i);
        if (mm) lang = mm[1].toLowerCase();
        const text = (code.textContent || '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
        if (!text || text.length < 12) continue;
        if (isCssOrJs(text) && text.length < 80) continue;
        const ext = LANG_EXT[lang] || (lang ? lang.replace(/[^a-z0-9]/gi, '') : '') || 'txt';
        arts.push({ type: 'code', lang: lang || 'text', content: text, ext: ext, msg: msgIndex });
      }
    } catch (e) {}
    return arts;
  }

  // ============ SCRAPE ============
  function scrape(options) {
    options = options || {};
    const found = findMessages();
    if (!found) return { items: [], platform: null, source: null, images: [], attachments: [], artifacts: [] };
    const platform = found.platform;
    const pre = [];
    found.items.forEach((el) => {
      const content = stripUiPrefix(domToMarkdown(el));
      const text = stripUiPrefix(extractText(el));
      if (!content && !text) return;
      const plain = text || content;
      if (plain.length < CFG.MIN_TEXT) return;
      if (isCssOrJs(plain) || isSourceListing(plain)) return;
      pre.push({ el: el, content: content, text: text, thinking: extractThinking(el) });
    });
    const roles = pre.map((m) => detectRole(m.el, platform));
    const allUnknown = roles.length > 0 && roles.every((r) => r === 'unknown');
    const allSame = roles.length > 1 && roles.every((r) => r === roles[0]);
    const parity = allUnknown || (allSame && roles[0] !== 'user');
    const allImages = [], allAttachments = [], allArtifacts = [];
    const out = pre.map((m, i) => {
      let role = roles[i];
      if (role === 'unknown' && parity) role = i % 2 === 0 ? 'user' : 'assistant';
      else if (parity && role === roles[0]) role = i % 2 === 0 ? 'user' : 'assistant';
      let content = m.content;
      if (options.stripThinking && m.thinking.length) {
        // v26: вырезаем ВСЕ вхождения блока (replace по строке бьёт только первое)
        for (const block of m.thinking) {
          if (!block || block.length < 3) continue;
          let guard = 0;
          while (content.indexOf(block) !== -1 && guard++ < 20) content = content.replace(block, '');
        }
        content = clean(content);
      }
      if (mermaidEnabled()) content = processMermaid(content);
      const media = collectMedia(m.el, i);
      collectArtifacts(m.el, i).forEach((a) => allArtifacts.push(a));
      media.images.forEach((x) => allImages.push(x));
      media.attachments.forEach((x) => allAttachments.push(x));
      return { role: role, content: content, text: m.text || clean(m.content), thinking: options.exportThinking ? m.thinking : [] };
    }).filter((m) => (options.stripThinking ? m.content : m.text) && (options.stripThinking ? m.content.length : m.text.length) >= CFG.MIN_TEXT);
    return { items: out.slice(0, CFG.MSG_MAX), source: found.source, platformName: (platform && platform.name) || null, images: allImages.slice(0, CFG.IMG_TOTAL), attachments: allAttachments.slice(0, CFG.IMG_TOTAL), artifacts: allArtifacts.slice(0, 300) };
  }

  // Аварийный снимок страницы, когда точечная структура не распознана (урок из Gemini-беседы)
  function snapshotScrape() {
    try {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('#' + UI_ID + ',script,style,noscript,svg').forEach((n) => n.remove());
      const holder = getRenderHolder();
      holder.appendChild(clone);
      let t = '';
      try { t = clean(clone.innerText || ''); } catch (e) { t = (clone.textContent || '').trim(); }
      clone.remove();
      if (!t || t.length < CFG.MIN_TOTAL_TEXT) return null;
      if (t.length > CFG.SNAPSHOT_MAX) t = t.slice(0, CFG.SNAPSHOT_MAX) + '\n\n… (обрезано)';
      return {
        items: [{ role: 'unknown', content: '⚠ Автоснимок страницы (структура не распознана точечно):\n\n' + t, text: '⚠ Автоснимок страницы (структура не распознана точечно):\n\n' + t, thinking: [] }],
        source: 'snapshot', platformName: (getPlatform() || {}).name || null, images: [], attachments: [], artifacts: []
      };
    } catch (e) { return null; }
  }

  function fingerprint() {
    const found = findMessages();
    if (!found) return '';
    return found.items.map((el) => txt(el).slice(0, 80)).join('|');
  }

  function findScrollContainer() {
    const found = findMessages();
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

  // Автопрокрутка истории: к началу, ждём стабилизации высоты, к концу (рабочая версия из v22/v24)
  async function autoScroll(statusFn) {
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

  // Ожидание смены контента после активации чата: фингерпринт + смена URL (фикс «экспорт предыдущего чата»)
  async function waitStable(prevFp, prevHref) {
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
      } else if (hrefChanged && Date.now() - lastChangeTime >= CFG.STABLE_MS) {
        return true;
      }
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

  // ============ ФОРМАТЫ ЭКСПОРТА (9) ============
  function platformName(scraped) {
    const n = scraped && scraped.platformName;
    if (n) return n;
    const p = getPlatform();
    return p ? p.name : 'universal-heuristic';
  }
  function roleLabel(role) {
    if (role === 'user') return '🧑‍💻 User';
    if (role === 'assistant') return '🤖 Assistant';
    return '❔ ' + (role || 'Unknown');
  }
  function frontMatterEnabled() { return safeStorageGet('uaice_fm') !== '0'; }

  function toMarkdown(scraped, title) {
    const L = [];
    if (frontMatterEnabled()) {
      const dateTag = '#export-' + now().slice(0, 10);
      const platTag = '#' + String(platformName(scraped)).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '');
      L.push('---',
        'title: ' + JSON.stringify(String(title || 'export')),
        'platform: ' + JSON.stringify(platformName(scraped)),
        'url: ' + JSON.stringify(location.href),
        'exported_at: ' + JSON.stringify(new Date().toISOString()),
        'exporter: ' + JSON.stringify('Universal AI Chat Exporter v' + SCRIPT_VER),
        'messages_count: ' + scraped.items.length,
        'tags: [' + JSON.stringify(platTag) + ', ' + JSON.stringify(dateTag) + ']',
        '---', '', '# ' + title, '');
    } else {
      L.push('# ' + title, '',
        '- **Platform:** ' + platformName(scraped), '- **URL:** ' + location.href,
        '- **Exported:** ' + now() + ' (v' + SCRIPT_VER + ')', '- **Messages:** ' + scraped.items.length, '', '---', '');
    }
    scraped.items.forEach((m) => {
      L.push('### ' + roleLabel(m.role), '', m.content || m.text, '');
      if (m.thinking && m.thinking.length) L.push('<details><summary>🧠 Thinking</summary>', '', m.thinking.join('\n\n'), '', '</details>', '');
    });
    return L.join('\n');
  }
  function toJSON(scraped, title) {
    return JSON.stringify({
      title: title, platform: platformName(scraped), exporter: 'Universal AI Chat Exporter v' + SCRIPT_VER,
      url: location.href, exported_at: new Date().toISOString(), messages_count: scraped.items.length,
      source_selector: scraped.source || null,
      messages: scraped.items.map((m, i) => ({ index: i, role: m.role, content_markdown: m.content, text: m.text, thinking: m.thinking || [] }))
    }, null, 2);
  }
  function toTXT(scraped, title) {
    const lines = [title, '='.repeat(Math.min(title.length, 70)), 'Platform: ' + platformName(scraped), 'URL: ' + location.href, 'Exported: ' + now() + ' (v' + SCRIPT_VER + ')', ''];
    scraped.items.forEach((m) => {
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
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let h = '<h1>' + esc(title) + '</h1>';
    h += '<div class="meta">Platform: ' + esc(platformName(scraped)) + '<br>URL: ' + esc(location.href) + '<br>Exported: ' + now() + ' (v' + SCRIPT_VER + ')<br>Messages: ' + scraped.items.length + '</div>';
    scraped.items.forEach((m) => {
      h += '<div class="msg ' + esc(String(m.role || 'unknown')) + '">';
      h += '<div class="role">' + esc(roleLabel(m.role)) + '</div>';
      if (m.thinking && m.thinking.length) h += '<div class="think"><b>🧠 Thinking</b><br>' + esc(m.thinking.join('\n\n')).replace(/\n/g, '<br>') + '</div>';
      h += '<div>' + esc(m.text || m.content).replace(/\n/g, '<br>') + '</div></div>';
    });
    return h;
  }
  function toHTML(scraped, title) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(title) + '</title><style>' + htmlCss() + '</style></head><body>' + htmlBody(scraped, title) + '</body></html>';
  }
  // ShareGPT: {title,url,conversations:[{from:'human'|'gpt'|'system', value}]}
  function sharegptFrom(role) {
    if (role === 'user') return 'human';
    if (role === 'assistant') return 'gpt';
    return 'system';
  }
  function toShareGPT(scraped, title) {
    return JSON.stringify({
      title: title,
      url: location.href,
      exported_at: new Date().toISOString(),
      conversations: scraped.items.map((m) => ({ from: sharegptFrom(m.role), value: m.text || m.content }))
    }, null, 2);
  }
  // JSONL: одна строка на сообщение
  function toJSONL(scraped, title) {
    return scraped.items.map((m, i) => JSON.stringify({
      chat: title, i: i, role: m.role, text: m.text || m.content
    })).join('\n');
  }
  // Alpaca: пары instruction(user) -> output(assistant)
  function toAlpaca(scraped, title) {
    const samples = [];
    let pending = null;
    scraped.items.forEach((m) => {
      if (m.role === 'user') {
        if (pending) samples.push({ instruction: pending, input: '', output: '' });
        pending = m.text || m.content;
      } else if (m.role === 'assistant') {
        samples.push({ instruction: pending || '', input: '', output: m.text || m.content });
        pending = null;
      } else if (pending) {
        samples.push({ instruction: pending, input: '', output: '' });
        pending = null;
      }
    });
    if (pending) samples.push({ instruction: pending, input: '', output: '' });
    return JSON.stringify({ chat: title, url: location.href, samples: samples }, null, 2);
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

  // ============ ДОСТАВКА: BLOB / СОБСТВЕННЫЙ ZIP (без CDN) / PDF ============
  function downloadBlob(content, filename, mime) {
    const blob = (content instanceof Blob) ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    (document.body || document.documentElement).appendChild(a);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  // v26: стриминговая запись больших ZIP/PDF через File System Access API (без удержания blob в памяти вкладки)
  async function downloadSmart(content, filename, mime) {
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

  // Собственный ZIP-писатель (метод store, UTF-8 имена). Никаких внешних библиотек.
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function dosDateTime(d) {
    const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xFFFF;
    const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time: time, date: date };
  }
  // entries: [{name, data:string|Uint8Array, date?}] -> Blob (application/zip)
  function zipStore(entries) {
    const enc = new TextEncoder();
    const localChunks = [], centralChunks = [];
    let offset = 0;
    const d = new Date();
    const { time, date } = dosDateTime(d);
    for (const e of entries) {
      const name = enc.encode(e.name);
      const data = (e.data instanceof Uint8Array) ? e.data : enc.encode(String(e.data));
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true);
      lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      localChunks.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true);
      ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true);
      ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true);
      ch.setUint32(42, offset, true);
      centralChunks.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    let cdSize = 0;
    for (const c of centralChunks) cdSize += c.length;
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, entries.length, true);
    eocd.setUint16(10, entries.length, true);
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, offset, true);
    eocd.setUint16(20, 0, true);
    return new Blob(localChunks.concat(centralChunks, [new Uint8Array(eocd.buffer)]), { type: 'application/zip' });
  }

  function blobToU8(blob) { return blob.arrayBuffer().then((ab) => new Uint8Array(ab)); }
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
  async function fetchImageU8(url) {
    // v26: до 3 попыток с прогрессивной паузой; 401/403 помечаются как session-bound
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

  function resolveInner() {
    const v = (safeStorageGet('uaice_zipinner') || 'md').toLowerCase();
    return ['md', 'json', 'txt', 'html', 'pdf', 'both'].indexOf(v) !== -1 ? v : 'md';
  }
  function imagesEnabled() { return safeStorageGet('uaice_images') !== '0'; }

  // ZIP из результатов массового экспорта: chats/ + images/ + artifacts/ + _index.json + _FAILURES.txt
  // v26: возвращает список записей; разбивку на тома делает splitZipVolumes
  async function buildZipEntries(results, failures, innerFmt, statusFn) {
    const entries = [];
    const index = [];
    const imagesFailed = [];
    const attachmentsAll = [];
    let imgSeq = 0, artSeq = 0;
    for (let i = 0; i < results.length; i++) {
      if (CANCEL) break;
      const r = results[i];
      if (statusFn) statusFn('ZIP ' + progress(i, results.length, sanitize(r.title, 24)));
      const base = String(i + 1).padStart(3, '0') + '-' + sanitize(r.title);
      const rec = { file: '', title: r.title, url: r.url, messages: r.scraped.items.length };
      if (innerFmt === 'both') {
        // v26: двойной формат для ML-пайплайнов — md + json рядом
        const fm = contentFor('md', r.scraped, r.title);
        const fj = contentFor('json', r.scraped, r.title);
        rec.file = base + '.md+.json';
        entries.push({ name: 'chats/' + base + '.md', data: fm.content });
        entries.push({ name: 'chats/' + base + '.json', data: fj.content });
      } else if (innerFmt === 'pdf') {
        try {
          const blob = await renderPdfBlob(r.scraped, r.title);
          rec.file = base + '.pdf';
          entries.push({ name: 'chats/' + rec.file, data: await blobToU8(blob) });
        } catch (e) {
          rec.file = base + '.md'; rec.note = 'PDF недоступен (' + (e && e.message) + '), сохранён MD';
          entries.push({ name: 'chats/' + rec.file, data: contentFor('md', r.scraped, r.title).content });
        }
      } else {
        const f = contentFor(innerFmt, r.scraped, r.title);
        rec.file = base + '.' + f.ext;
        entries.push({ name: 'chats/' + rec.file, data: f.content });
      }
      if (imagesEnabled() && r.scraped && Array.isArray(r.scraped.images)) {
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
      if (r.scraped && Array.isArray(r.scraped.attachments)) {
        r.scraped.attachments.forEach((a) => attachmentsAll.push({ chat: r.title, url: a.url, name: a.name }));
      }
      // v26: артефакты кода — отдельные файлы artifacts/NNN-MM-lang.ext
      if (r.scraped && Array.isArray(r.scraped.artifacts)) {
        for (const a of r.scraped.artifacts) {
          if (artSeq >= CFG.ARTIFACTS_MAX) break;
          artSeq++;
          entries.push({ name: 'artifacts/' + String(i + 1).padStart(3, '0') + '-' + String((a.msg || 0) + 1).padStart(2, '0') + '-' + sanitize(a.lang || 'text', 20) + '.' + (a.ext || 'txt'), data: a.content || '' });
          rec.artifacts = (rec.artifacts || 0) + 1;
        }
      }
      index.push(rec);
    }
    // v26: прямые ссылки на все картинки — ручная дозагрузка при CORS-блоках
    if (imagesEnabled()) {
      const links = [];
      for (const r of results) { if (r.scraped && Array.isArray(r.scraped.images)) r.scraped.images.forEach((im) => links.push('- [' + sanitize(r.title, 40) + '] ' + im.src)); }
      if (links.length) entries.push({ name: '_image-links.txt', data: ['# Все найденные изображения (для ручной загрузки при CORS-блоках)', ''].concat(links).join('\n') });
    }
    if (failures.length) entries.push({ name: '_FAILURES.txt', data: ['# Не удалось', ''].concat(failures.map((f) => '- ' + f.title + ': ' + f.error)).join('\n') });
    if (attachmentsAll.length) entries.push({ name: '_attachments.txt', data: attachmentsAll.map((a) => '- [' + sanitize(a.chat, 40) + '] ' + a.name + ' — ' + a.url).join('\n') });
    if (imagesFailed.length) entries.push({ name: '_images-failed.txt', data: ['# Не скачались (CORS/доступ)', ''].concat(imagesFailed).join('\n') });
    entries.push({ name: '_index.json', data: JSON.stringify({ exporter: 'UACE v' + SCRIPT_VER, created: now(), format: innerFmt, chats: index, failures: failures, images_failed: imagesFailed.length }, null, 2) });
    return entries;
  }

  // v26: разбивка записей ZIP на тома при превышении лимита (анти-краш вкладки)
  function splitZipVolumes(entries, maxBytes) {
    const limit = maxBytes || CFG.MAX_ZIP_MB * 1024 * 1024;
    const size = (e) => 30 + (e.name ? e.name.length : 0) + (e.data ? (e.data.length || 0) : 0) + 46;
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

  async function renderPdfBlob(scraped, title) {
    await loadScript(LIBS.html2pdf, 'html2pdf');
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;background:#fff;';
    holder.innerHTML = '<style>' + htmlCss() + '</style>' + htmlBody(scraped, title);
    (document.body || document.documentElement).appendChild(holder);
    try {
      const pdf = await window.html2pdf().set({
        margin: 10, image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(holder).toPdf().get('pdf');
      return pdf.output('blob');
    } finally { holder.remove(); }
  }
  function printFallback(scraped, title) {
    const w = window.open('', '_blank');
    if (!w) { setStatusSafe('PDF: popup заблокирован, откройте окно печати вручную.'); return; }
    w.document.open(); w.document.write(toHTML(scraped, title)); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 500);
  }
  function setStatusSafe(t) { try { console.warn('[UAICE] ' + t); } catch (e) {} }
  async function exportAsPDF(scraped, title) {
    try { const blob = await renderPdfBlob(scraped, title); downloadBlob(blob, sanitize(title) + '-' + ts() + '.pdf', 'application/pdf'); }
    catch (e) { console.error('PDF error:', e); printFallback(scraped, title); }
  }
  async function saveInFormat(scraped, title, format) {
    if (format === 'pdf') { await exportAsPDF(scraped, title); return; }
    if (format === 'zip') {
      const entries = await buildZipEntries([{ title: title, url: location.href, scraped: scraped }], [], resolveInner(), null);
      await volumesToDownloads(splitZipVolumes(entries), sanitize(title) + '-' + ts(), null);
      return;
    }
    const f = contentFor(format, scraped, title);
    downloadBlob(f.content, sanitize(title) + '-' + ts() + '.' + f.ext, f.mime);
  }

  function buildMerged(results, innerFmt) {
    if (innerFmt === 'json') return JSON.stringify({ exporter: 'UACE v' + SCRIPT_VER, created: now(), chats: results.map((r) => ({ title: r.title, url: r.url, platform: platformName(r.scraped), messages: r.scraped.items })) }, null, 2);
    if (innerFmt === 'sharegpt') return JSON.stringify({ exporter: 'UACE v' + SCRIPT_VER, created: now(), chats: results.map((r) => ({ title: r.title, url: r.url, conversations: r.scraped.items.map((m) => ({ from: sharegptFrom(m.role), value: m.text || m.content })) })) }, null, 2);
    if (innerFmt === 'alpaca') return JSON.stringify({ exporter: 'UACE v' + SCRIPT_VER, created: now(), chats: results.map((r) => JSON.parse(toAlpaca(r.scraped, r.title))) }, null, 2);
    if (innerFmt === 'jsonl') return results.map((r) => toJSONL(r.scraped, r.title)).join('\n');
    if (innerFmt === 'html') {
      let h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI Chats</title><style>' + htmlCss() + 'section{page-break-after:always}</style></head><body>';
      results.forEach((r) => { h += '<section>' + htmlBody(r.scraped, r.title) + '</section>'; });
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
      if (failures.length) downloadBlob(['# Не удалось', ''].concat(failures.map((f) => '- ' + f.title + ': ' + f.error)).join('\n'), '_FAILURES-' + ts() + '.txt', 'text/plain;charset=utf-8');
      return;
    }
    if (format === 'zip') {
      try {
        if (statusFn) statusFn('Собираю ZIP...');
        const entries = await buildZipEntries(results, failures, inner, statusFn);
        await volumesToDownloads(splitZipVolumes(entries), 'ai-chats-' + ts(), statusFn);
        return;
      } catch (e) { console.error(e); if (statusFn) statusFn('⚠ ZIP не удался, объединённый файл'); }
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
    if (failures.length) downloadBlob(['# Не удалось', ''].concat(failures.map((f) => '- ' + f.title + ': ' + f.error)).join('\n'), '_FAILURES-' + ts() + '.txt', 'text/plain;charset=utf-8');
  }

  // ============ САЙДБАР / СПИСОК ЧАТОВ (мерж v22 + v24) ============
  const UUID_RE = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;

  function extractChatTarget(el) {
    if (!el) return { href: null, id: null };
    if (el.attributes) {
      for (let i = 0; i < el.attributes.length; i++) {
        const a = el.attributes[i];
        const v = a.value || '';
        if (a.name === 'href' && v) {
          try { return { href: new URL(v, location.href).href, id: null }; } catch (e) {}
        }
        const m = v.match(UUID_RE);
        if (m) return { href: null, id: m[1] };
        if (/^(data-(chat|conversation|session|thread|id)|id)$/i.test(a.name) && v.length >= 6 && v.length <= 80) {
          return { href: null, id: v };
        }
      }
    }
    const innerA = el.querySelector && el.querySelector('a[href]');
    if (innerA && innerA.href) return { href: innerA.href, id: null };
    const html = el.outerHTML || '';
    const m1 = html.match(UUID_RE);
    if (m1) return { href: null, id: m1[1] };
    try {
      const keys = Object.keys(el);
      for (let ki = 0; ki < keys.length; ki++) {
        const k = keys[ki];
        if (k.indexOf('__reactProps$') !== 0 && k.indexOf('__reactFiber$') !== 0) continue;
        let node = el[k];
        for (let depth = 0; depth < 10 && node; depth++) {
          const props = node.memoizedProps;
          if (props && typeof props === 'object') {
            const keys2 = Object.keys(props);
            for (let pi = 0; pi < keys2.length; pi++) {
              const pv = props[keys2[pi]];
              if (typeof pv === 'string') {
                const m = pv.match(UUID_RE);
                if (m) return { href: null, id: m[1] };
                if (/^(id|chatId|conversationId|sessionId|threadId|key)$/i.test(keys2[pi]) && pv.length >= 6 && pv.length <= 80) {
                  return { href: null, id: pv };
                }
                if (/^href$|^to$|^url$/i.test(keys2[pi]) && pv.length > 1) {
                  try { return { href: new URL(pv, location.href).href, id: null }; } catch (e) {}
                }
              } else if (pv && typeof pv === 'object') {
                const innerKeys = Object.keys(pv);
                for (let ii = 0; ii < innerKeys.length; ii++) {
                  const ipv = pv[innerKeys[ii]];
                  if (typeof ipv === 'string') {
                    const m = ipv.match(UUID_RE);
                    if (m) return { href: null, id: m[1] };
                  }
                }
              }
            }
          }
          node = node.return;
        }
      }
    } catch (e) {}
    return { href: null, id: null };
  }

  function buildChatUrl(id) {
    if (!id) return null;
    const platform = getPlatform();
    if (platform && platform.chatUrlPattern) return location.origin + platform.chatUrlPattern.replace('{id}', id);
    const m = location.pathname.match(/^(.*\/)(c|chat|conversation|app|thread)\/[^\/]+/i);
    if (m) return location.origin + m[1] + m[2] + '/' + id;
    return location.origin + '/c/' + id;
  }

  function tryReactOnClick(el) {
    try {
      const keys = Object.keys(el);
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('__reactProps$') !== 0) continue;
        const props = el[keys[i]];
        if (props && typeof props.onClick === 'function') {
          const evt = {
            type: 'click', target: el, currentTarget: el,
            nativeEvent: { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
            preventDefault: function () {}, stopPropagation: function () {},
            isDefaultPrevented: function () { return false; },
            isPropagationStopped: function () { return false; },
            persist: function () {}, defaultPrevented: false, bubbles: true, cancelable: true
          };
          props.onClick(evt);
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // Строгий фильтр URL чата (мерж v22 + v24): сегменты + query-параметры + явные исключения
  function isChatUrl(href) {
    if (!href) return false;
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) return false;
      if (/^\/(new|create|edit|settings|help|login|signup|logout|terms|privacy|about|contact|faq|legal|pricing|billing|account|profile|drive|create-image|cron-jobs|tasks|discover|explore|search|upgrade|download|auth|oauth|reset|verify)/i.test(u.pathname)) return false;
      if (/\/(chat|work|code|c|conversation|thread|app|gem|s|share|session|talk|a)\/[a-zA-Z0-9][a-zA-Z0-9_\/-]{7,}/i.test(u.pathname)) return true;
      if (/[?&](id|chat|conversation|thread|session)=/i.test(u.search)) return true;
      return false;
    } catch (e) { return false; }
  }

  const NAV_KEYWORDS = [
    'проекты','проект','новая папка','новый проект','vibe','work','code','chat','projects',
    'настройки','settings','профиль','profile','новый чат','new chat','помощь','help',
    'сообщество','community','обновления','updates','поиск','search','архив','archive',
    'избранное','library','библиотека','gpts','sora','explore','discover','temporary chat','временный чат',
    '新对话','新建对话','新聊天','新建会话','设置','帮助',
    'delete','удалить','rename','переименовать','pin','закрепить','share','поделиться',
    'все чаты','all chats','история','history','activity','gemini','extensions','расширения','gems',
    'notebooklm','new notebook','upgrade','обновить','попробовать','блокноты','недавние','artifacts',
    'customize','pinned','new','claude','images','scheduled','plugins','health','codex',
    'создание контента ии','запланированные задачи','диск','dola','поиск по чатам','новый блокнот','новая беседа'
  ];
  function normalizeNavKey(s) { return String(s || '').replace(/[\s.…,;:!?—–-]+$/g, '').toLowerCase().trim(); }
  function isNavKeyword(s) {
    if (!s) return false;
    const low = normalizeNavKey(s);
    if (!low || low.length > 40) return false;
    return NAV_KEYWORDS.indexOf(low) !== -1;
  }

  function isClickable(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'a' && el.hasAttribute && el.hasAttribute('href')) return true;
    if (tag === 'button') return true;
    const role = el.getAttribute ? (el.getAttribute('role') || '') : '';
    if (role === 'button' || role === 'link' || role === 'listitem' || role === 'option' || role === 'tab') return true;
    const tab = el.getAttribute ? el.getAttribute('tabindex') : null;
    if (tab !== null && tab !== undefined && tab !== '-1') return true;
    return false;
  }
  function isNavContainer(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    const role = el.getAttribute ? (el.getAttribute('role') || '') : '';
    if (tag === 'mat-sidenav' || tag === 'bard-sidenav' || tag === 'side-navigation-v2') return true;
    if (tag === 'aside' || tag === 'nav' || role === 'navigation') return true;
    const c = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    if (/sidenav|sidebar|side-nav|drawer|history-list|chat-list|conversation-list|side-bar|chat-aside|chat-history/.test(c)) return true;
    return false;
  }
  function isLeftSide(el) {
    if (!el) return false;
    try {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth || 1920;
      if (r.height < 100) return false;
      if (r.width < 20) return false;
      if (r.left > vw * 0.40) return false;
      if (r.left + r.width > vw * 0.65) return false;
      return true;
    } catch (e) { return false; }
  }
  function looksLikeCode(s) {
    if (!s) return true;
    const t = s.trim();
    if (t.length < 2) return true;
    if (/\b(is not defined|is not a function|TypeError|ReferenceError|SyntaxError)\b/.test(t)) return true;
    if (/^https?:\/\/\S+$/i.test(t)) return true;
    if (/^Thought for \d+/i.test(t)) return true;
    if (/^```/.test(t)) return true;
    return false;
  }
  function looksLikeChatItem(el) {
    if (!el || !isVisible(el)) return false;
    if (el.closest && el.closest('#' + UI_ID)) return false;
    if (isInChatArea(el)) return false;
    let t = txt(el);
    if (!t || t.length < 2) { const p = el.parentElement; if (p) t = txt(p); }
    if (!t || t.length < 2 || t.length > 120) return false;
    if (isNavKeyword(t) || isCssOrJs(t) || isSourceListing(t)) return false;
    if (t.indexOf('\n') !== -1) return false;
    if (looksLikeCode(t)) return false;
    if (t.indexOf('::') !== -1) return false;
    if (/^[#>*-]\s/.test(t)) return false;
    if (/[.…]{2,}\s*$/.test(t)) return false;
    if (/^[A-Za-z]{2,6}$/.test(t)) return false;
    return true;
  }

  function findLeftPanel() {
    const cands = [];
    const sels = 'mat-sidenav, bard-sidenav, side-navigation-v2, aside, nav, [role="navigation"], [class*="sidenav"], [class*="sidebar"], [class*="sider"], [class*="side-bar"], [class*="history"], [class*="conversation"], [class*="chat-aside"], [class*="chat-history"], [class*="chat-list"], #flow_chat_sidebar, nav[class*="panel-"]';
    let els = [];
    try { els = document.querySelectorAll(sels); } catch (e) { els = []; }
    els.forEach((el) => {
      try {
        if (el.closest && el.closest('#' + UI_ID)) return;
        if (!isLeftSide(el)) return;
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        const scrollable = /auto|scroll/.test(st.overflowY) || /auto|scroll/.test(st.overflow);
        let score = Math.max(r.height, 200) * (scrollable ? 2 : 1);
        if (isNavContainer(el)) score *= 4;
        const cc = el.querySelectorAll('a[href*="/a/chat/s/"], a[href*="/chat/"], a[href*="/c/"], [class*="conversation-item"]').length;
        if (cc > 0) score *= 5;
        cands.push({ el: el, score: score });
      } catch (e) {}
    });
    cands.sort((a, b) => b.score - a.score);
    return cands[0] ? cands[0].el : null;
  }

  function isDrawerOpen() {
    return !!document.querySelector('mat-sidenav.mat-drawer-opened, mat-sidenav.mat-drawer-opening, bard-sidenav.mat-drawer-opened, bard-sidenav.mat-drawer-opening, aside.mat-drawer-opened');
  }
  function isSidebarOpen() {
    if (isDrawerOpen()) return true;
    const panel = findLeftPanel();
    if (!panel) return false;
    const r = panel.getBoundingClientRect();
    return r.left >= -5 && r.width >= 20 && r.height >= 100;
  }
  async function waitForDrawerOpen(t) {
    const s = Date.now();
    while (Date.now() - s < t) {
      if (isDrawerOpen()) { await sleep(600); return true; }
      await sleep(150);
    }
    return isDrawerOpen();
  }
  async function dispatchFullClick(el) {
    try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
    await sleep(120);
    try { if (typeof el.focus === 'function') el.focus(); } catch (e) {}
    let cx = 1, cy = 1;
    try {
      const r = el.getBoundingClientRect();
      cx = Math.floor(r.left + r.width / 2) || 1;
      cy = Math.floor(r.top + r.height / 2) || 1;
    } catch (e) {}
    const base = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, detail: 1 };
    try { el.dispatchEvent(new PointerEvent('pointerover', Object.assign({}, base, { pointerId: 1, pointerType: 'mouse', buttons: 0, isPrimary: true }))); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseover', Object.assign({}, base, { buttons: 0 }))); } catch (e) {}
    try { el.dispatchEvent(new PointerEvent('pointerenter', Object.assign({}, base, { pointerId: 1, pointerType: 'mouse', buttons: 0, isPrimary: true }))); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseenter', Object.assign({}, base, { buttons: 0 }))); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mousemove', base)); } catch (e) {}
    try { el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, base, { pointerId: 1, pointerType: 'mouse', buttons: 1, isPrimary: true }))); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', Object.assign({}, base, { buttons: 1 }))); } catch (e) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, base, { pointerId: 1, pointerType: 'mouse', buttons: 0, isPrimary: true }))); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, base, { buttons: 0 }))); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('click', base)); } catch (e) {}
    try { if (typeof el.click === 'function') el.click(); } catch (e) {}
  }
  async function tryOpenSidebar() {
    if (isSidebarOpen()) return true;
    const seen = new Set(), cands = [];
    const pushC = (el) => { if (!el || seen.has(el)) return; if (!isVisible(el)) return; seen.add(el); cands.push(el); };
    try { const q = document.querySelector('#sidebar-toggle-button'); if (q) pushC(q); } catch (e) {}
    const sels = ['button[aria-label*="Main menu" i]','button[aria-label*="Side panel" i]','button[aria-label*="sidebar" i]','button[aria-label*="sidenav" i]','button[aria-label*="Toggle sidebar" i]','button[aria-label*="menu" i]','button[aria-label*="Open" i]','button[aria-label*="Открыть" i]','button[aria-label*="меню" i]','[class*="sidebar-toggle"]','[class*="menu-toggle"]','[class*="hamburger"]','.slide-switch'];
    for (const sel of sels) {
      try { document.querySelectorAll(sel).forEach(pushC); } catch (e) {}
    }
    for (const c of cands) {
      try { await dispatchFullClick(c); if (await waitForDrawerOpen(2000)) return true; } catch (e) {}
    }
    return isSidebarOpen();
  }
  async function ensureSidebar() {
    let ok = await tryOpenSidebar();
    if (!ok) { await sleep(800); ok = await tryOpenSidebar(); }
    if (!ok) { await sleep(1200); ok = await tryOpenSidebar(); }
    return ok;
  }

  function extractItemsFromPanel(panel) {
    if (!panel) return [];
    const groups = {};
    panel.querySelectorAll('*').forEach((el) => {
      try {
        if (el.closest && el.closest('#' + UI_ID)) return;
        if (!looksLikeChatItem(el)) return;
        if (el.children.length > 10) return;
        let clickable = isClickable(el);
        if (!clickable) { const anc = el.closest && el.closest('a[href], button, [role="button"], [role="listitem"]'); if (anc) clickable = true; }
        if (!clickable) return;
        const key = el.tagName;
        (groups[key] = groups[key] || []).push(el);
      } catch (e) {}
    });
    let best = null;
    Object.keys(groups).forEach((key) => {
      const els = groups[key];
      if (els.length < 2) return;
      const cleanList = els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
      if (cleanList.length < 2) return;
      if (!best || cleanList.length > best.items.length) best = { key: key, items: cleanList };
    });
    if (!best) return [];
    return best.items.map((el) => {
      const ex = extractChatTarget(el);
      const title = txt(el).slice(0, 120);
      return { el: el, href: (ex && ex.href) || '', title: title, dataId: (ex && ex.id) || null };
    });
  }

  function collectChatLinks(rootEl) {
    const root = rootEl || document;
    const out = [];
    const seen = new Set();
    const curUrl = location.href.split('?')[0].replace(/\/$/, '');
    const push = (item) => {
      if (!item || !item.el) return;
      if (seen.has(item.el)) return;
      for (let i = 0; i < out.length; i++) {
        if (out[i].el === item.el) return;
        if (out[i].el.contains(item.el) || item.el.contains(out[i].el)) return;
      }
      seen.add(item.el);
      out.push(item);
    };
    const platform = getPlatform();
    const hints = platform && platform.chatUrlHints;
    // A) платформенные URL-подсказки
    if (hints && hints.length) {
      try {
        root.querySelectorAll('a[href]').forEach((a) => {
          if (!isVisible(a)) return;
          const href = a.getAttribute('href') || '';
          let matched = false;
          for (const h of hints) { try { if (h.test(href)) { matched = true; break; } } catch (e) {} }
          if (!matched) return;
          if (!isChatUrl(a.href)) return;
          const t = txt(a);
          if (!t || t.length < 2 || t.length > 200) return;
          if (looksLikeCode(t) || isNavKeyword(t)) return;
          push({ el: a, href: a.href || '', title: t.slice(0, 120), dataId: null });
        });
      } catch (e) {}
    }
    // B) известные селекторы элементов чата
    try {
      const sel = 'a[aria-label="chat-item"], a.chat-item-drag-link, [class*="conversation-item"], [class*="chat-item"], [class*="history-item"], [class*="session-item"], [data-chat-id], [data-conversation-id], [data-session-id], [data-thread-id]';
      root.querySelectorAll(sel).forEach((el) => {
        if (!isVisible(el)) return;
        const t = txt(el);
        if (!t || t.length < 2 || t.length > 200) return;
        if (looksLikeCode(t) || isNavKeyword(t)) return;
        const extracted = extractChatTarget(el);
        const innerA = el.querySelector('a[href]');
        const dataId = el.getAttribute('data-chat-id') || el.getAttribute('data-conversation-id') || el.getAttribute('data-session-id') || el.getAttribute('data-thread-id') || (extracted && extracted.id) || null;
        const href = (innerA && innerA.href) || (extracted && extracted.href) || '';
        if (!href && !dataId) return;
        if (href && href.split('?')[0].replace(/\/$/, '') === curUrl) return;
        push({ el: el, href: href, title: t.slice(0, 120), dataId: dataId });
      });
    } catch (e) {}
    // C) все ссылки того же origin, похожие на чат
    try {
      root.querySelectorAll('a[href]').forEach((a) => {
        if (isInChatArea(a)) return;
        if (!isVisible(a)) return;
        const t = txt(a);
        if (!t || t.length < 2 || t.length > 200) return;
        if (isNavKeyword(t) || isCssOrJs(t) || isSourceListing(t) || looksLikeCode(t)) return;
        try { const u = new URL(a.href, location.href); if (u.origin !== location.origin) return; } catch (e) { return; }
        if (!isChatUrl(a.href)) return;
        if (a.href.split('?')[0].replace(/\/$/, '') === curUrl) return;
        push({ el: a, href: a.href || '', title: t.slice(0, 120), dataId: null });
      });
    } catch (e) {}
    // D) элементы левой панели (группировка по тегу)
    try {
      const panel = (root === document) ? findLeftPanel() : root;
      if (panel) extractItemsFromPanel(panel).forEach((it) => {
        if (it.href && it.href.split('?')[0].replace(/\/$/, '') === curUrl) return;
        push(it);
      });
    } catch (e) {}
    return out;
  }

  function scanContainers(selector) {
    let containers;
    try { containers = document.querySelectorAll(selector); } catch (e) { return null; }
    const cands = [];
    for (const c of containers) {
      if (c.closest && c.closest('#' + UI_ID)) continue;
      if (!isLeftSide(c)) continue;
      const links = collectChatLinks(c);
      if (links.length >= 2) cands.push({ container: c, items: links, score: links.length, via: 'container' });
    }
    cands.sort((a, b) => b.score - a.score);
    return cands[0] || null;
  }
  function findStructuralChatItems() {
    const panel = findLeftPanel();
    if (!panel) return null;
    const items = extractItemsFromPanel(panel);
    return items.length >= 2 ? { container: panel, items: items, score: items.length, via: 'left-panel' } : null;
  }
  function findClickableChatItems() {
    const panel = findLeftPanel();
    if (!panel) return null;
    const items = [];
    const curUrl = location.href.split('?')[0].replace(/\/$/, '');
    let nl = [];
    try { nl = panel.querySelectorAll('[role="button"], [role="link"], [role="listitem"], [tabindex]:not([tabindex="-1"]), button, li, a[aria-label="chat-item"], a.chat-item-drag-link, [class*="conversation-item"]'); } catch (e) {}
    for (const el of nl) {
      if (el.closest && el.closest('#' + UI_ID)) continue;
      if (!isVisible(el)) continue;
      if (el.children.length > 6) continue;
      const t = txt(el);
      if (!t || t.length < 2 || t.length > 120) continue;
      if (looksLikeCode(t) || isNavKeyword(t) || isCssOrJs(t)) continue;
      if (t.indexOf('\n') !== -1) continue;
      const href = el.href || '';
      if (href && href.split('?')[0].replace(/\/$/, '') === curUrl) continue;
      items.push({ el: el, href: href, title: t.slice(0, 120), dataId: null });
    }
    if (items.length >= 2) return { container: panel, items: items, score: items.length, via: 'click-items' };
    return null;
  }
  function findList() {
    const platform = getPlatform();
    const strategies = [];
    if (platform && platform.sidebarSelectors && platform.sidebarSelectors.length) {
      strategies.push({ name: 'platform', fn: () => scanContainers(platform.sidebarSelectors.join(',')) });
    }
    strategies.push({ name: 'generic', fn: () => scanContainers('nav,aside,[role="navigation"],[class*="sidebar"],[class*="history"],[class*="chat-list"],[class*="conversation-list"],[class*="sider"]') });
    strategies.push({ name: 'conversation-item', fn: () => {
      const items = [];
      try {
        document.querySelectorAll('[class*="conversation-item"], a[id^="conversation_"]').forEach((el) => {
          const t = txt(el);
          if (!t || t.length < 2) return;
          const href = el.href || '';
          if (href && href.split('?')[0] === location.href.split('?')[0]) return;
          items.push({ el: el, href: href, title: t.slice(0, 120), dataId: null });
        });
      } catch (e) {}
      return items.length >= 2 ? { container: null, items: items, score: items.length, via: 'conversation-item' } : null;
    } });
    strategies.push({ name: 'structural', fn: findStructuralChatItems });
    strategies.push({ name: 'click-items', fn: findClickableChatItems });
    for (const st of strategies) {
      try {
        const r = st.fn();
        if (r && r.items && r.items.length >= 2) return r;
      } catch (e) {}
    }
    // последний шанс: все ссылки документа
    const docLinks = collectChatLinks(document).filter((it) => it.href || it.dataId);
    if (docLinks.length >= 2) return { container: null, items: docLinks, score: docLinks.length, via: 'doc-links', fallback: true };
    return null;
  }
  async function prescrollList(container) {
    if (!container) return;
    const step = Math.max(200, Math.floor(container.clientHeight * 0.8));
    for (let k = 0; k < 4; k++) {
      container.scrollTop = 0; await sleep(150);
      for (let y = 0; y < container.scrollHeight; y += step) { container.scrollTop = y; await sleep(120); }
      container.scrollTop = container.scrollHeight; await sleep(200);
    }
    container.scrollTop = 0; await sleep(150);
  }

  // ============ МАНИФЕСТ (onlyNew) И СЕССИЯ (RESUME) — v26: IndexedDB + FNV-1a ============
  const MANIFEST_KEY = 'uaice_manifest_v1';
  const SESSION_KEY = 'uaice_bulk_v1';
  // FNV-1a 64-bit (BigInt): детерминированный хеш вместо коллидирующего «role:length»
  function hashString(s) {
    let h = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    const mask = 0xffffffffffffffffn;
    const text = String(s || '');
    for (let i = 0; i < text.length; i++) { h ^= BigInt(text.charCodeAt(i)); h = (h * prime) & mask; }
    return h.toString(16).padStart(16, '0');
  }
  function chatHash(s) {
    const items = (s && Array.isArray(s.items)) ? s.items : [];
    return hashString(items.map((x) => (x.role || 'unknown') + '\u0000' + (x.text || x.content || '')).join('\u0001'));
  }
  // Единый ключ манифеста для чтения И записи (фикс расхождения href/dataId/title)
  function manifestKey(it) {
    if (!it) return '';
    if (it.href) { try { const u = new URL(it.href, location.href); u.hash = ''; return u.href; } catch (e) {} }
    if (it.dataId) return 'id:' + String(it.dataId);
    return 'title:' + normalizeNavKey(it.title || '');
  }
  // v26: лёгкий отпечаток сайдбара для resume-выравнивания
  function fingerprintSidebar() {
    try {
      const list = findList();
      if (!list || !list.items) return '';
      return hashString(list.items.slice(0, 40).map((x) => (x.dataId || '') + '\u0000' + normalizeNavKey(x.title || '') + '\u0000' + (x.href || '')).join('\u0001'));
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
        rows.forEach((r) => { if (r && r.id) o[r.id] = { hash: r.hash, exported_at: r.exported_at, title: r.title }; });
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
    const rows = Object.keys(m).map((k) => ({ id: k, hash: m[k].hash, exported_at: m[k].exported_at, title: m[k].title }));
    try { await idbPutMany(rows); } catch (e) {}
  }
  async function clearManifestAll() {
    MANIFEST_MEM = {};
    if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
    safeStorageRemove(MANIFEST_KEY);
    try { await idbClearMan(); } catch (e) {}
  }
  function loadSession() { try { const s = JSON.parse(safeStorageGet(SESSION_KEY) || 'null'); return (s && Array.isArray(s.items)) ? s : null; } catch (e) { return null; } }
  function saveSession(s) {
    try { s.sidebarFp = fingerprintSidebar(); } catch (e) {}
    safeStorageSet(SESSION_KEY, JSON.stringify(s));
  }
  function clearSession() { safeStorageRemove(SESSION_KEY); }

  function askOptions() {
    return {
      filter: (safeStorageGet('uaice_filter') || '').toLowerCase(),
      onlyNew: safeStorageGet('uaice_onlynew') === '1',
      exportThinking: safeStorageGet('uaice_think') === '1',
      stripThinking: safeStorageGet('uaice_strip') === '1'
    };
  }

  // ============ КОПИРОВАНИЕ ============
  async function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return; }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    (document.body || document.documentElement).appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
  }
  async function copyCurrentMd(options) {
    await autoScroll(null);
    const scraped = scrape(options);
    if (!scraped.items.length) throw new Error('Сообщения не найдены');
    await copyTextToClipboard(toMarkdown(scraped, pageTitle()));
    return scraped.items.length;
  }
  // Промпт-перенос: диалог в формате для продолжения в другом AI (фича v24)
  async function copyContinuePrompt(options) {
    await autoScroll(null);
    const scraped = scrape(options);
    if (!scraped.items.length) throw new Error('Сообщения не найдены');
    const L = ['# Перенос диалога в другой AI', '', 'Продолжи диалог ниже. История от другого AI-ассистента:', ''];
    scraped.items.forEach((m) => {
      L.push(m.role === 'user' ? 'USER:' : 'ASSISTANT:');
      L.push(m.text || m.content);
      L.push('');
    });
    L.push('---', 'Продолжи с этого места. Не пересказывай, отвечай как продолжение.');
    await copyTextToClipboard(L.join('\n'));
    return scraped.items.length;
  }

  // ============ ЭКСПОРТ ТЕКУЩЕГО ЧАТА ============
  async function exportCurrent(format, options, statusFn) {
    if (statusFn) statusFn('Ищу сообщения...');
    await autoScroll(statusFn);
    let scraped = scrape(options);
    if (!scraped.items.length) {
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        if (statusFn) statusFn('Жду текста... (' + (i + 1) + ')');
        scraped = scrape(options);
        if (scraped.items.length > 0) break;
      }
    }
    if (!scraped.items.length) {
      const snap = snapshotScrape();
      if (snap) {
        await saveInFormat(snap, pageTitle() + '-snapshot', format === 'zip' ? 'md' : format);
        return { count: 1, snapshot: true };
      }
      debugDump();
      throw new Error('Сообщения не найдены. F12 → Console.');
    }
    await saveInFormat(scraped, pageTitle(), format);
    return { count: scraped.items.length };
  }

  // ===== АКТИВАЦИЯ ЧАТА В САЙДБАРЕ (переключение на чат) =====
  // ФИКС v25.0.2: в v25.0.0/v25.0.1 exportAllSameTab вызывал activateChatItem(),
  // но сама функция нигде не определялась → ReferenceError на каждом чате масс-сбора
  // («✗ <чат>: activateChatItem is not defined» — только заголовки, без содержимого).
  async function activateChatItem(it) {
    if (!it) return false;
    let el = (it.el && it.el.isConnected) ? it.el : null;
    // RESUME: в сессии el не сериализуется — переищем элемент по заголовку в сайдбаре
    if (!el && it.title) {
      try {
        const list = findList();
        if (list && Array.isArray(list.items)) {
          const t = String(it.title).trim().toLowerCase();
          for (const x of list.items) {
            if (x && x.el && x.el.isConnected && String(x.title || '').trim().toLowerCase() === t) { el = x.el; break; }
          }
        }
      } catch (e) {}
    }
    const hrefBefore = location.href;
    const fpBefore = fingerprint();
    if (el) {
      try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
      await sleep(120);
      // Цели клика: сам элемент, внутренняя ссылка/кнопка, внешняя ссылка-обёртка
      const targets = [el];
      try {
        const inner = el.querySelector('a[href],button,[role="link"],[role="button"],[role="menuitem"]');
        if (inner) targets.push(inner);
        const outer = el.closest && el.closest('a[href],[role="link"]');
        if (outer) targets.push(outer);
      } catch (e) {}
      for (let k = 0; k < targets.length; k++) {
        if (CANCEL) return true;
        const t = targets[k];
        // 1) обычный click(), 2) React synthetic onClick, 3) полная серия мышиных событий
        try { t.click(); } catch (e) {}
        try { tryReactOnClick(t); } catch (e) {}
        try {
          ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
            t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
          });
        } catch (e) {}
        await sleep(300);
        if (location.href !== hrefBefore || fingerprint() !== fpBefore) return true;
      }
      // SPA ещё думает — дать последнюю отсрочку и проверить смену контента
      try {
        const changed = await waitForContentChange(hrefBefore, fpBefore, 2500);
        if (changed) return true;
      } catch (e) {}
    }
    // ПОСЛЕДНИЙ РЕЗЕРВ: прямая навигация по href/dataId (полная перезагрузка;
    // сессия уже сохранена — продолжение кнопкой «▶ Продолжить» после рестарта)
    let url = it.href || '';
    if (!url && it.dataId) { try { url = buildChatUrl(it.dataId) || ''; } catch (e) {} }
    if (url && url.split('#')[0] !== location.href.split('#')[0]) {
      try { location.href = url; await sleep(1200); return true; } catch (e) {}
    }
    return false;
  }

  // ============ МАССОВЫЙ ЭКСПОРТ (тот же таб) ============
  async function exportAllSameTab(format, options, statusFn, session) {
    let items = null, startIdx = 0;
    if (session && Array.isArray(session.items) && session.items.length) {
      items = session.items;
      startIdx = Math.max(0, Math.min(session.idx || 0, items.length - 1));
      if (statusFn) statusFn('▶ Продолжаю с ' + (startIdx + 1) + '/' + items.length);
      await ensureSidebar();
      // v26: перепривязка el по нормализованному ключу (сайдбар мог перерисоваться)
      try {
        const list = findList();
        if (list && Array.isArray(list.items)) {
          const byKey = new Map();
          list.items.forEach((x) => { const k = manifestKey(x); if (k && !byKey.has(k)) byKey.set(k, x.el); });
          let re = 0;
          items.forEach((it) => { const el = byKey.get(manifestKey(it)); if (el) { it.el = el; re++; } });
          const cur = fingerprintSidebar();
          if (session.sidebarFp && cur && cur !== session.sidebarFp) console.log('[UAICE] Сайдбар изменился с прошлого запуска — привязано ' + re + '/' + items.length);
        }
      } catch (e) {}
    } else {
      await ensureSidebar();
      let list = findList();
      if (list && list.container) { await prescrollList(list.container); list = findList() || list; }
      if (!list) throw new Error('Список чатов не найден.');
      const deduped = [], seen = new Set();
      list.items.forEach((it) => {
        const key = it.href || it.dataId || it.el;
        if (!key || seen.has(key)) return;
        if (!it.title || it.title.length < 2) return;
        seen.add(key);
        let id = it.dataId, href = it.href;
        if (!id && it.el) {
          const ex = extractChatTarget(it.el);
          if (ex.id) id = ex.id;
          if (!href && ex.href) href = ex.href;
        }
        deduped.push({ title: it.title, href: href || '', dataId: id || null, el: it.el });
      });
      if (deduped.length < 2) {
        console.log('[UAICE] Сырых элементов списка: ' + (list.items ? list.items.length : 0) + ', после дедупа: ' + deduped.length);
        throw new Error('В списке меньше двух чатов.');
      }
      items = deduped;
    }
    if (options && options.filter) {
      items = items.filter((it) => (it.title || '').toLowerCase().indexOf(options.filter) !== -1);
      if (!items.length) { clearSession(); throw new Error('Фильтр "' + options.filter + '" не дал совпадений.'); }
    }
    if (statusFn) statusFn('Найдено ' + items.length + ' чатов.');
    if (!session) saveSession({ mode: 'same', fmt: format, items: items.map((x) => ({ title: x.title, href: x.href, dataId: x.dataId })), idx: 0 });

    const results = [], failures = [];
    const manifest = await getManifest();
    let lastChatFp = '', skipped = 0;

    for (let i = startIdx; i < items.length; i++) {
      if (CANCEL) { if (statusFn) statusFn('⏹ Остановлено. ' + progress(i, items.length, 'Продолжите кнопкой ▶')); saveSession({ mode: 'same', fmt: format, items: items.map((x) => ({ title: x.title, href: x.href, dataId: x.dataId })), idx: i }); return { results, failures, total: items.length, skipped, stopped: true }; }
      const it = items[i];
      if (statusFn) statusFn(progress(i, items.length, it.title.slice(0, 30)));
      try {
        const beforeHref = location.href;
        const fpBefore = fingerprint();
        const activated = await activateChatItem(it);
        if (!activated) throw new Error('клик не сработал — используйте "🗂 Все (вкладками)"');
        const ok = await waitStable(fpBefore, beforeHref);
        if (!ok) throw new Error('контент не догрузился');
        await autoScroll(statusFn);
        await sleep(500);
        const scraped = scrape(options);
        if (!scraped.items.length) throw new Error('сообщения не найдены');
        const chatFp = chatHash(scraped);
        const mkey = manifestKey(it);
        if (options && options.onlyNew) {
          if (manifest[mkey] && manifest[mkey].hash === chatFp) {
            skipped++;
            console.log('  ⏭ ' + it.title + ' (уже экспортирован)');
            continue;
          }
        }
        if (chatFp === lastChatFp && location.href === beforeHref) throw new Error('дубликат');
        lastChatFp = chatFp;
        results.push({ title: it.title, scraped: scraped, url: location.href });
        manifest[mkey] = { hash: chatFp, exported_at: new Date().toISOString(), title: it.title };
        saveManifest(manifest);
        console.log('  ✓ ' + it.title + ' — ' + scraped.items.length);
      } catch (e) {
        console.warn('  ✗ ' + it.title + ': ' + e.message);
        failures.push({ title: it.title, url: it.href || '', error: e.message });
      }
      saveSession({ mode: 'same', fmt: format, items: items.map((x) => ({ title: x.title, href: x.href, dataId: x.dataId })), idx: i + 1 });
      await sleep(300);
    }
    clearSession();
    await flushManifest();
    return { results, failures, total: items.length, skipped };
  }

  // ============ МАССОВЫЙ ЭКСПОРТ (ДОЧЕРНИЕ ВКЛАДКИ) ============
  window.addEventListener('message', (event) => {
    if (event.source === window) return;
    const d = event.data;
    if (!d || d.type !== MSG_REQ || !d.nonce) return;
    if (tabsExportRunning) return;
    const respond = (payload) => {
      try { event.source.postMessage(Object.assign({ type: MSG_RES, nonce: d.nonce }, payload), event.origin === 'null' ? '*' : event.origin); } catch (e) {}
    };
    (async () => {
      try {
        await autoScroll(null);
        await waitStable(fingerprint(), location.href);
        const scraped = scrape(d.options || {});
        respond({ ok: scraped.items.length > 0, url: location.href, title: pageTitle() || document.title, data: scraped });
      } catch (e) { respond({ ok: false, url: location.href, title: document.title, error: String(e && e.message || e) }); }
    })();
  });

  function waitForChildResult(child, nonce, timeout, options) {
    return new Promise((resolve) => {
      let done = false, timer = null, pingTimer = null;
      const finish = (v) => {
        if (done) return; done = true;
        try { window.removeEventListener('message', listener); } catch (e) {}
        if (timer) clearTimeout(timer);
        if (pingTimer) clearInterval(pingTimer);
        resolve(v);
      };
      const listener = (event) => {
        const d = event.data;
        if (!d || d.type !== MSG_RES || d.nonce !== nonce) return;
        if (event.source !== child) return;
        finish(d);
      };
      window.addEventListener('message', listener);
      timer = setTimeout(() => finish({ ok: false, error: 'тайм-аут дочерней вкладки' }), timeout);
      const ping = () => {
        try { child.postMessage({ type: MSG_REQ, nonce: nonce, options: options || {} }, '*'); }
        catch (e) { finish({ ok: false, error: String(e && e.message || e) }); }
      };
      ping();
      pingTimer = setInterval(() => { if (!done) ping(); }, 1500);
    });
  }

  async function exportAllTabs(format, options, statusFn, session) {
    let items = null, startIdx = 0;
    if (session && Array.isArray(session.items) && session.items.length) {
      items = session.items;
      startIdx = Math.max(0, Math.min(session.idx || 0, items.length - 1));
      await ensureSidebar();
    } else {
      await ensureSidebar();
      let list = findList();
      if (list && list.container) { await prescrollList(list.container); list = findList() || list; }
      if (!list) throw new Error('Список чатов не найден.');
      const deduped = [], seen = new Set();
      list.items.forEach((it) => {
        let href = it.href;
        if (!href && it.dataId) href = buildChatUrl(it.dataId);
        if (!href && it.el) {
          const ex = extractChatTarget(it.el);
          if (ex.href) href = ex.href;
          else if (ex.id) href = buildChatUrl(ex.id);
        }
        if (!href) return;
        if (seen.has(href)) return;
        if (!it.title || it.title.length < 2) return;
        seen.add(href);
        deduped.push({ title: it.title, href: href, dataId: it.dataId || null });
      });
      if (deduped.length < 2) throw new Error('Меньше двух чатов с URL.');
      items = deduped;
    }
    if (options && options.filter) {
      items = items.filter((it) => (it.title || '').toLowerCase().indexOf(options.filter) !== -1);
      if (!items.length) { clearSession(); throw new Error('Фильтр "' + options.filter + '" не дал совпадений.'); }
    }
    if (!session) saveSession({ mode: 'tabs', fmt: format, items: items.map((x) => ({ title: x.title, href: x.href, dataId: x.dataId || null })), idx: 0 });

    tabsExportRunning = true;
    const results = [], failures = [];
    const manifest = await getManifest();
    let skipped = 0;
    try {
      for (let i = startIdx; i < items.length; i++) {
        if (CANCEL) {
          if (statusFn) statusFn('⏹ Остановлено. ' + progress(i, items.length, 'Продолжите кнопкой ▶'));
          saveSession({ mode: 'tabs', fmt: format, items: items.map((x) => ({ title: x.title, href: x.href, dataId: x.dataId || null })), idx: i });
          return { results, failures, total: items.length, skipped, stopped: true };
        }
        const it = items[i];
        if (statusFn) statusFn('Вкладки ' + progress(i, items.length, it.title.slice(0, 26)));
        const nonce = Date.now() + '-' + Math.random().toString(36).slice(2);
        let child = null;
        try {
          child = window.open(it.href, '_blank');
          if (!child) throw new Error('POPUP_BLOCKED');
          await sleep(800);
          const response = await waitForChildResult(child, nonce, CFG.TAB_CHILD_TIMEOUT, options);
          if (!response.ok) throw new Error(response.error || 'нет данных');
          if (!response.data || !Array.isArray(response.data.items) || !response.data.items.length) throw new Error('пусто');
          const chatFp = chatHash(response.data);
          const mkey = manifestKey(it);
          if (options && options.onlyNew) {
            if (manifest[mkey] && manifest[mkey].hash === chatFp) { skipped++; continue; }
          }
          results.push({ title: response.title || it.title, url: response.url || it.href, scraped: response.data });
          manifest[mkey] = { hash: chatFp, exported_at: new Date().toISOString(), title: it.title };
          saveManifest(manifest);
        } catch (e) {
          const msg = e.message === 'POPUP_BLOCKED' ? 'popup заблокирован' : String(e && e.message || e);
          failures.push({ title: it.title, url: it.href, error: msg });
          if (e.message === 'POPUP_BLOCKED' && results.length === 0 && i === 0) throw new Error('Всплывающие окна заблокированы.');
        } finally { try { if (child) child.close(); } catch (e) {} }
        saveSession({ mode: 'tabs', fmt: format, items: items.map((x) => ({ title: x.title, href: x.href, dataId: x.dataId || null })), idx: i + 1 });
        await sleep(200);
      }
    } finally { tabsExportRunning = false; }
    clearSession();
    await flushManifest();
    return { results, failures, total: items.length, skipped };
  }

  async function exportAll(format, mode, options, statusFn, session) {
    const inner = format === 'zip' ? resolveInner() : format;
    const outcome = (mode === 'tabs')
      ? await exportAllTabs(format, options, statusFn, session)
      : await exportAllSameTab(format, options, statusFn, session);
    await finalizeResults(outcome.results, outcome.failures, format, inner, statusFn);
    try { toast('✅ Готово: ' + outcome.results.length + ' чатов' + (outcome.failures.length ? ', ошибок: ' + outcome.failures.length : ''), 3000); } catch (e) {}
    return { ok: outcome.results.length, fail: outcome.failures.length, total: outcome.total, skipped: outcome.skipped || 0, stopped: !!outcome.stopped };
  }

  // ============ ДИАГНОСТИКА ============
  function debugDump() {
    try { console.groupCollapsed('%c[UAICE v' + SCRIPT_VER + '] DEBUG', 'color:#4af;font-weight:bold'); } catch (e) {}
    console.log('URL:', location.href);
    const platform = getPlatform();
    console.log('Платформа:', platform ? platform.name : 'не определена');
    const s = scrape({ exportThinking: true });
    console.log('Найдено:', s.items.length, 'источник:', s.source, '| картинок:', s.images.length, '| вложений:', s.attachments.length);
    s.items.slice(0, 20).forEach((m, i) => console.log('  [' + i + '] role=' + m.role + ' len=' + (m.text || '').length + ' text="' + (m.text || '').slice(0, 120) + '..."'));
    const sc = findScrollContainer();
    console.log('Скролл-контейнер:', sc ? { clientHeight: sc.clientHeight, scrollHeight: sc.scrollHeight } : null);
    const list = findList();
    console.log('Список чатов:', list ? list.items.length + ' (via ' + list.via + ')' : 'НЕ НАЙДЕН');
    if (list) console.table(list.items.slice(0, 30).map((x, i) => ({ idx: i, title: String(x.title || '').slice(0, 50), href: String(x.href || '').slice(0, 70), dataId: x.dataId || '' })));
    const sess = loadSession();
    if (sess) console.log('Незавершённый экспорт:', sess.idx + '/' + sess.items.length, 'формат:', sess.fmt, 'режим:', sess.mode);
    try { console.groupEnd(); } catch (e) {}
    return s;
  }

  function exportDebugReport() {
    const platform = getPlatform();
    const report = {
      meta: { exporter: 'UACE v' + SCRIPT_VER, generated_at: new Date().toISOString(), url: location.href, userAgent: navigator.userAgent },
      environment: {
        hostname: location.hostname, pathname: location.pathname,
        platform: platform ? platform.name : null,
        msgSelectors: platform ? platform.msgSelectors : [],
        sidebarSelectors: platform ? (platform.sidebarSelectors || []) : []
      },
      dom: {
        totalNodes: document.querySelectorAll('*').length,
        links: document.querySelectorAll('a[href]').length,
        shadowRoots: collectShadowRoots().length,
        chatClassEls: document.querySelectorAll('[class*="chat"],[class*="message"]').length
      },
      scrape: (function () { try { const s = scrape({}); return { items_count: s.items.length, source: s.source, images: s.images.length }; } catch (e) { return { error: String(e && e.message || e) }; } })(),
      list: (function () { try { const l = findList(); return l ? { via: l.via, count: l.items.length } : null; } catch (e) { return { error: String(e && e.message || e) }; } })(),
      session: loadSession()
    };
    downloadBlob(JSON.stringify(report, null, 2), 'uaice-debug-' + ts() + '.json', 'application/json;charset=utf-8');
  }

  function debugSniffer() {
    function snap(el, depth, maxDepth) {
      if (!el || depth > maxDepth) return null;
      let r;
      try { r = el.getBoundingClientRect(); } catch (e) { r = { width: 0, height: 0, left: 0, top: 0 }; }
      const vis = r.width > 0 && r.height > 0;
      let t = '';
      if (el.children.length === 0) { try { t = dedupeText((el.textContent || '').trim()).slice(0, 100); } catch (e) {} }
      const attrs = {};
      for (let i = 0; i < el.attributes.length; i++) {
        const a = el.attributes[i];
        if (/^data-|^aria-|^role$|^href$|^id$|^class$/i.test(a.name)) attrs[a.name] = String(a.value).slice(0, 120);
      }
      const kids = [];
      if (depth < maxDepth) for (let j = 0; j < el.children.length && j < 30; j++) { const s = snap(el.children[j], depth + 1, maxDepth); if (s) kids.push(s); }
      return { tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 200), id: el.id || '', attrs: attrs, rect: [Math.round(r.width), Math.round(r.height), Math.round(r.left), Math.round(r.top)], vis: vis, text: t, childCount: el.children.length, children: kids };
    }
    const platform = getPlatform();
    const report = { meta: { url: location.href, hostname: location.hostname, ver: SCRIPT_VER, ts: now() }, platform: platform ? platform.name : null, leftPanel: null, chatItemCandidates: [], messageCandidates: [], summary: {} };
    try { const lp = findLeftPanel(); if (lp) report.leftPanel = snap(lp, 0, 3); } catch (e) {}
    try { const l = findList(); if (l) report.chatItemCandidates = l.items.slice(0, 40).map((it) => ({ title: (it.title || '').slice(0, 80), href: (it.href || '').slice(0, 120) })); } catch (e) {}
    try {
      const m = findMessages();
      if (m) report.messageCandidates = m.items.slice(0, 40).map((el) => ({ tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 120), textLen: (txt(el) || '').length, text: (txt(el) || '').slice(0, 100) }));
    } catch (e) {}
    report.summary = { chatItems: report.chatItemCandidates.length, messageCandidates: report.messageCandidates.length, sidebarDetected: !!report.leftPanel };
    downloadBlob(JSON.stringify(report, null, 2), 'uaice-sniffer-' + sanitize(location.hostname) + '-' + ts() + '.json', 'application/json;charset=utf-8');
  }

  // ============ UI (стиль v20 + drag + настройки + бейдж) ============
  function buildUI() {
    if (document.getElementById(UI_ID)) return;
    if (!document.body) return;
    injectModernStyles();

    const w = document.createElement('div');
    w.id = UI_ID;

    const box = document.createElement('div');
    box.className = 'box';
    w.appendChild(box);

    const st = document.createElement('div');
    st.className = 'status';

    const badge = document.createElement('button');
    badge.textContent = '🤖';
    badge.title = 'Universal AI Chat Exporter v' + SCRIPT_VER + ' — клик, чтобы развернуть';
    badge.style.cssText = 'display:none;padding:8px 11px;border-radius:50%;background:#1f2937;color:#fff;font-size:16px;line-height:1;cursor:pointer;border:0;';

    const mini = document.createElement('div');
    mini.className = 'mini';

    function btn(label) {
      const b = document.createElement('button');
      b.textContent = label;
      return b;
    }

    // Grip-заголовок: название + кнопка сворачивания, служит ручкой перетаскивания.
    const grip = document.createElement('div');
    grip.className = 'grip';
    const gripTitle = document.createElement('span');
    gripTitle.className = 'title';
    gripTitle.textContent = '≡ UACE v' + SCRIPT_VER + ' POLYMATH';
    const b0 = btn('—');
    b0.title = 'Свернуть в 🤖';
    grip.appendChild(gripTitle);
    grip.appendChild(b0);

    const b3 = btn('Формат: MD');
    b3.title = 'md → json → txt → html → pdf → zip → sharegpt → jsonl → alpaca';
    const b1 = btn('📄 Текущий');
    b1.title = 'Экспорт текущего чата. Горячая клавиша: Alt+E';
    const b2 = btn('📦 Все чаты');
    b2.title = 'Массовый экспорт из сайдбара (тот же таб). Горячая клавиша: Alt+A';
    const bTabs = btn('🗂 Все (вкладками)');
    bTabs.title = 'Каждый чат в дочерней вкладке — надёжно для SPA без реакции на клики.';
    const bResume = btn('▶ Продолжить');
    bResume.title = 'Продолжить незавершённый массовый экспорт с места остановки';
    bResume.disabled = true;
    const b5 = btn('📋 Копировать MD');
    b5.title = 'MD текущего чата в буфер. Горячая клавиша: Alt+C';
    const bCont = btn('➡️ Промпт-перенос');
    bCont.title = 'Скопировать диалог как промпт для продолжения в другом AI';
    const bThink = btn('🧠 Thinking: OFF');
    const bStrip = btn('🧹 Strip thinking: OFF');
    const bSet = btn('⚙️ Настройки');
    bSet.title = 'Фильтр, только новые, картинки, ZIP-формат. Горячая клавиша: Alt+S';
    const bSide = btn('☰ Открыть сайдбар');
    bSide.title = 'Развернуть панель истории чатов и показать, сколько чатов найдено';
    const b6 = btn('🔍 Debug');
    b6.title = 'Диагностика в консоль (F12)';
    const bRep = btn('📥 Report');
    bRep.title = 'Скачать JSON-отчёт о среде';
    const bSniff = btn('🕵️ Sniffer');
    bSniff.title = 'Скачать JSON-дамп DOM-кандидатов (селекторы)';
    const b4 = btn('⏹ Стоп');
    b4.disabled = true;

    const mainBtns = [b3, b1, b2, bTabs, bResume, b5, bCont, bThink, bStrip, bSet, bSide, b6, bRep, bSniff, b4];

    // Панель настроек (без системных диалогов)
    const settings = document.createElement('div');
    settings.className = 'settings';
    settings.style.display = 'none';
    const lbFilter = document.createElement('span');
    lbFilter.textContent = 'Фильтр по названию:';
    lbFilter.style.cssText = 'font-size:11px;color:#bbb;';
    const inFilter = document.createElement('input');
    inFilter.type = 'text';
    inFilter.placeholder = 'пусто = все чаты';
    inFilter.value = safeStorageGet('uaice_filter') || '';
    const cbOnly = document.createElement('input'); cbOnly.type = 'checkbox';
    cbOnly.checked = safeStorageGet('uaice_onlynew') === '1';
    const lbOnly = document.createElement('label');
    lbOnly.appendChild(cbOnly);
    lbOnly.appendChild(document.createTextNode(' Только новые (пропускать экспортированные)'));
    const cbImg = document.createElement('input'); cbImg.type = 'checkbox';
    cbImg.checked = safeStorageGet('uaice_images') !== '0';
    const lbImg = document.createElement('label');
    lbImg.appendChild(cbImg);
    lbImg.appendChild(document.createTextNode(' Скачивать картинки в ZIP'));
    const cbFm = document.createElement('input'); cbFm.type = 'checkbox';
    cbFm.checked = safeStorageGet('uaice_fm') !== '0';
    const lbFm = document.createElement('label');
    lbFm.appendChild(cbFm);
    lbFm.appendChild(document.createTextNode(' YAML-шапка в Markdown'));
    // v26 POLYMATH: адаптивные задержки и Mermaid-ссылки
    const cbAd = document.createElement('input'); cbAd.type = 'checkbox';
    cbAd.checked = safeStorageGet('uaice_adaptive') !== '0';
    const lbAd = document.createElement('label');
    lbAd.appendChild(cbAd);
    lbAd.appendChild(document.createTextNode(' Адаптивные задержки'));
    const cbMer = document.createElement('input'); cbMer.type = 'checkbox';
    cbMer.checked = safeStorageGet('uaice_mermaid') !== '0';
    const lbMer = document.createElement('label');
    lbMer.appendChild(cbMer);
    lbMer.appendChild(document.createTextNode(' Mermaid-ссылки на SVG'));
    const selZip = document.createElement('select');
    ['md', 'json', 'txt', 'html', 'pdf', 'both'].forEach((f) => {
      const o = document.createElement('option');
      o.value = f; o.textContent = f === 'both' ? 'ZIP: внутри MD+JSON' : 'ZIP: внутри ' + f.toUpperCase();
      selZip.appendChild(o);
    });
    selZip.value = resolveInner();
    const rowReset = document.createElement('div');
    rowReset.className = 'row';
    const bRm1 = btn('Сбросить отметки');
    bRm1.title = 'Забыть, какие чаты уже экспортированы (манифест onlyNew)';
    const bRm2 = btn('Сбросить всё');
    bRm2.title = 'Манифест + настройки + позиция панели + незавершённый экспорт';
    rowReset.appendChild(bRm1);
    rowReset.appendChild(bRm2);
    settings.appendChild(lbFilter);
    settings.appendChild(inFilter);
    settings.appendChild(lbOnly);
    settings.appendChild(lbImg);
    settings.appendChild(lbFm);
    settings.appendChild(lbAd);
    settings.appendChild(lbMer);
    settings.appendChild(selZip);
    settings.appendChild(rowReset);

    let collapsed = safeStorageGet('uaice_collapsed') === '1';
    function applyCollapsed() {
      grip.style.display = collapsed ? 'none' : '';
      mainBtns.forEach((x) => { x.style.display = collapsed ? 'none' : ''; });
      settings.style.display = 'none';
      mini.style.display = collapsed ? 'none' : '';
      const empty = collapsed && !st.textContent;
      st.style.display = empty ? 'none' : '';
      box.style.display = empty ? 'none' : '';
      badge.style.display = collapsed ? '' : 'none';
      safeStorageSet('uaice_collapsed', collapsed ? '1' : '0');
    }
    b0.onclick = () => { collapsed = true; applyCollapsed(); };
    badge.onclick = () => { collapsed = false; applyCollapsed(); };

    let statusTimer = null;
    function setStatus(t, hideAfter) {
      st.textContent = t || '';
      if (collapsed) applyCollapsed();
      if (statusTimer) clearTimeout(statusTimer);
      if (hideAfter) statusTimer = setTimeout(() => setStatus(''), hideAfter);
    }

    const options = {
      exportThinking: safeStorageGet('uaice_think') === '1',
      stripThinking: safeStorageGet('uaice_strip') === '1'
    };
    function syncThink() {
      bThink.textContent = '🧠 Thinking: ' + (options.exportThinking ? 'ON' : 'OFF');
      bStrip.textContent = '🧹 Strip thinking: ' + (options.stripThinking ? 'ON' : 'OFF');
    }
    bThink.onclick = () => { options.exportThinking = !options.exportThinking; safeStorageSet('uaice_think', options.exportThinking ? '1' : '0'); syncThink(); };
    bStrip.onclick = () => { options.stripThinking = !options.stripThinking; safeStorageSet('uaice_strip', options.stripThinking ? '1' : '0'); syncThink(); };

    let currentFormat = safeStorageGet('uaice_format') || 'md';
    if (FORMATS.indexOf(currentFormat) === -1) currentFormat = 'md';
    function updateFormatLabel() { b3.textContent = 'Формат: ' + currentFormat.toUpperCase(); }

    function refreshResume() {
      const ses = loadSession();
      const can = !!(ses && ses.idx < ses.items.length);
      bResume.disabled = can ? false : true;
      bResume.textContent = can ? '▶ Продолжить (' + ses.idx + '/' + ses.items.length + ')' : '▶ Продолжить';
    }

    function setBusy(v) {
      busy = v;
      [b1, b2, bTabs, bResume, b3, bThink, bStrip, b5, bCont, bSet, bSide, b6, bRep, bSniff].forEach((x) => { x.disabled = v; });
      b4.disabled = !v;
      badge.style.background = v ? '#c92a2a' : '#1f2937';
      if (!v) { CANCEL = false; refreshResume(); }
    }

    b3.onclick = () => {
      currentFormat = FORMATS[(FORMATS.indexOf(currentFormat) + 1) % FORMATS.length];
      updateFormatLabel();
      safeStorageSet('uaice_format', currentFormat);
      setStatus('Формат: ' + currentFormat.toUpperCase() + (currentFormat === 'zip' ? ' (внутри: ' + resolveInner().toUpperCase() + ')' : ''), 2500);
    };

    async function run(fn) {
      if (busy) return;
      setBusy(true);
      try { await fn(); }
      catch (e) { console.error(e); setStatus('❌ ' + (e && e.message || e), 12000); }
      finally { setBusy(false); }
    }

    b1.onclick = () => run(async () => {
      const r = await exportCurrent(currentFormat, options, setStatus);
      setStatus((r.snapshot ? '⚠ Снимок страницы сохранён' : '✅ ' + r.count + ' сообщений') + ' (' + currentFormat.toUpperCase() + ')', 5000);
    });
    b2.onclick = () => run(async () => {
      const r = await exportAll(currentFormat, 'same', askOptions(), setStatus);
      setStatus('✅ Готово: ' + r.ok + '/' + r.total + (r.skipped ? ', пропущено: ' + r.skipped : '') + (r.fail ? ', ошибок: ' + r.fail : ''), 10000);
    });
    bTabs.onclick = () => run(async () => {
      const r = await exportAll(currentFormat, 'tabs', askOptions(), setStatus);
      setStatus('✅ (вкладками): ' + r.ok + '/' + r.total + (r.skipped ? ', пропущено: ' + r.skipped : '') + (r.fail ? ', ошибок: ' + r.fail : ''), 10000);
    });
    bResume.onclick = () => run(async () => {
      const ses = loadSession();
      if (!ses || ses.idx >= ses.items.length) { setStatus('Нет незавершённого экспорта', 3000); return; }
      const r = await exportAll(ses.fmt, ses.mode, askOptions(), setStatus, ses);
      setStatus('▶ Продолжено: ' + r.ok + '/' + r.total + (r.skipped ? ', пропущено: ' + r.skipped : '') + (r.fail ? ', ошибок: ' + r.fail : ''), 10000);
    });
    b4.onclick = () => { CANCEL = true; setStatus('⏹ Останавливаю...'); };
    b5.onclick = () => run(async () => {
      const n = await copyCurrentMd(options);
      setStatus('📋 Скопировано: ' + n + ' сообщений (MD)', 4000);
    });
    bCont.onclick = () => run(async () => {
      const n = await copyContinuePrompt(options);
      setStatus('➡️ Промпт скопирован (' + n + ' сообщений)', 6000);
    });
    bSet.onclick = () => { settings.style.display = settings.style.display === 'none' ? '' : 'none'; };
    bSide.onclick = () => run(async () => {
      setStatus('Открываю сайдбар...');
      const ok = await ensureSidebar();
      await sleep(500);
      const l = findList();
      if (l) setStatus('✅ ' + l.items.length + ' чатов (via ' + l.via + ')', 5000);
      else setStatus(ok ? 'Сайдбар открыт, но чаты не найдены' : 'Сайдбар не найден', 6000);
    });
    b6.onclick = () => { try { debugDump(); setStatus('Debug → F12 Console', 3000); } catch (e) { setStatus('❌ Debug: ' + e.message, 8000); } };
    bRep.onclick = () => { try { exportDebugReport(); setStatus('📥 Report сохранён', 5000); } catch (e) { setStatus('❌ Report: ' + e.message, 8000); } };
    bSniff.onclick = () => { try { debugSniffer(); setStatus('🕵️ Sniffer: JSON сохранён', 7000); } catch (e) { setStatus('❌ Sniffer: ' + e.message, 8000); } };

    // Настройки: сохранение на лету
    inFilter.onchange = () => { safeStorageSet('uaice_filter', inFilter.value.trim().toLowerCase()); setStatus('⚙️ Фильтр: "' + (inFilter.value.trim() || 'все') + '"', 3000); };
    cbOnly.onchange = () => { safeStorageSet('uaice_onlynew', cbOnly.checked ? '1' : '0'); };
    cbImg.onchange = () => { safeStorageSet('uaice_images', cbImg.checked ? '1' : '0'); };
    cbFm.onchange = () => { safeStorageSet('uaice_fm', cbFm.checked ? '1' : '0'); };
    cbAd.onchange = () => { safeStorageSet('uaice_adaptive', cbAd.checked ? '1' : '0'); };
    cbMer.onchange = () => { safeStorageSet('uaice_mermaid', cbMer.checked ? '1' : '0'); };
    selZip.onchange = () => { safeStorageSet('uaice_zipinner', selZip.value); };
    bRm1.onclick = () => { clearManifestAll().then(() => setStatus('⚙️ Отметки onlyNew сброшены', 3000)).catch(() => setStatus('⚙️ Отметки сброшены', 3000)); };
    bRm2.onclick = () => {
      [MANIFEST_KEY, SESSION_KEY, 'uaice_filter', 'uaice_onlynew', 'uaice_images', 'uaice_fm', 'uaice_zipinner', 'uaice_format', 'uaice_think', 'uaice_strip', 'uaice_collapsed', 'uaice_pos_v1', 'uaice_adaptive', 'uaice_mermaid'].forEach((k) => safeStorageRemove(k));
      inFilter.value = ''; cbOnly.checked = false; cbImg.checked = true; cbFm.checked = true; cbAd.checked = true; cbMer.checked = true;
      clearManifestAll().catch(() => {});
      currentFormat = 'md'; updateFormatLabel(); syncThink();
      setStatus('⚙️ Все настройки сброшены. Перегрузите страницу.', 6000);
    };

    // Drag панели за grip
    const POS_KEY = 'uaice_pos_v1';
    try {
      const saved = JSON.parse(safeStorageGet(POS_KEY) || 'null');
      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        w.style.left = saved.left + 'px';
        w.style.top = saved.top + 'px';
        w.style.right = 'auto';
        w.style.bottom = 'auto';
      }
    } catch (e) {}
    let drag = null;
    grip.addEventListener('pointerdown', (e) => {
      if (e.target === b0) return;
      const r = w.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
    });
    document.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const vw = window.innerWidth || 1920, vh = window.innerHeight || 1080;
      const left = Math.max(0, Math.min(vw - 80, e.clientX - drag.dx));
      const top = Math.max(0, Math.min(vh - 40, e.clientY - drag.dy));
      w.style.left = left + 'px';
      w.style.top = top + 'px';
      w.style.right = 'auto';
      w.style.bottom = 'auto';
    });
    document.addEventListener('pointerup', () => {
      if (!drag) return;
      drag = null;
      const r = w.getBoundingClientRect();
      safeStorageSet(POS_KEY, JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }));
    });
    grip.addEventListener('dblclick', (e) => {
      if (e.target === b0) return;
      safeStorageRemove(POS_KEY);
      w.style.left = ''; w.style.top = ''; w.style.right = ''; w.style.bottom = '';
    });

    document.addEventListener('keydown', (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.code === 'KeyE') { e.preventDefault(); b1.click(); }
      else if (e.code === 'KeyA') { e.preventDefault(); b2.click(); }
      else if (e.code === 'KeyC') { e.preventDefault(); b5.click(); }
      else if (e.code === 'KeyS') { e.preventDefault(); bSet.click(); }
      else if (e.code === 'KeyX') { e.preventDefault(); b3.click(); }
      else if (e.code === 'KeyR') { e.preventDefault(); if (!bResume.disabled) bResume.click(); }
    });

    // Порядок в панели (v20): grip, формат, текущий, все, вкладками, продолжить,
    // копировать, промпт-перенос, thinking, strip, настройки, сайдбар, debug, report,
    // sniffer, стоп, настройки-панель, статус, версия.
    box.appendChild(grip);
    mainBtns.forEach((b) => box.appendChild(b));
    box.appendChild(settings);
    box.appendChild(st);
    box.appendChild(mini);
    w.appendChild(badge);
    document.body.appendChild(w);

    const p0 = getPlatform();
    const miniBase = 'v' + SCRIPT_VER + ' · ' + (p0 ? p0.name : 'универсальный');
    mini.textContent = miniBase;
    // v26: счётчик манифеста в мини-строке
    getManifest().then((m) => {
      const n = Object.keys(m || {}).length;
      if (n > 0) mini.textContent = miniBase + ' · 📦' + n;
    }).catch(() => {});

    updateFormatLabel();
    syncThink();
    refreshResume();
    applyCollapsed();
  }

  // Тестовый/отладочный доступ к чистым функциям (форматёры, ZIP, парсеры)
  try {
    window.__UAICE_INTERNALS__ = {
      ver: SCRIPT_VER, FORMATS: FORMATS, CFG: CFG,
      crc32: crc32, zipStore: zipStore, dosDateTime: dosDateTime,
      toMarkdown: toMarkdown, toJSON: toJSON, toTXT: toTXT, toHTML: toHTML,
      toShareGPT: toShareGPT, toJSONL: toJSONL, toAlpaca: toAlpaca, contentFor: contentFor,
      sanitize: sanitize, dedupeText: dedupeText, stripUiPrefix: stripUiPrefix, domToMarkdown: domToMarkdown,
      detectRole: detectRole, roleFromValue: roleFromValue, getPlatform: getPlatform,
      isChatUrl: isChatUrl, buildChatUrl: buildChatUrl, extractChatTarget: extractChatTarget,
      scrape: scrape, findMessages: findMessages, debugDump: debugDump,
      loadSession: loadSession, clearSession: clearSession, loadManifest: loadManifest,
      activateChatItem: activateChatItem,
      hashString: hashString, manifestKey: manifestKey, chatHash: chatHash,
      processMermaid: processMermaid, mermaidEnabled: mermaidEnabled,
      adaptiveMs: adaptiveMs, splitZipVolumes: splitZipVolumes,
      collectArtifacts: collectArtifacts, fingerprintSidebar: fingerprintSidebar,
      getManifest: getManifest, flushManifest: flushManifest, clearManifestAll: clearManifestAll,
      HAS_IDB: HAS_IDB, toast: toast
    };
  } catch (e) {}

  function boot() {
    if (IS_FRAME) return;
    buildUI();
    const p = getPlatform();
    console.log('[UAICE v' + SCRIPT_VER + ' POLYMATH] Готов. Платформа: ' + (p ? p.name : 'универсальный режим') + '. Форматы: ' + FORMATS.join('/') + '. Хранилище манифеста: ' + (HAS_IDB ? 'IndexedDB' : 'localStorage'));
    getManifest().catch(() => {});
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(boot, 1000));
  }
})();
