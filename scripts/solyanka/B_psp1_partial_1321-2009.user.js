// ==UserScript== // @name POLYMAT PSP-1 — PAGE STRUCTURE PROFILER // @namespace https://polymat.example/psp1 // @version 1.0.0 // @description Сбор профиля устройства и каркаса страницы (без содержимого) с формированием отчётов, безопасных для здоровья человека // @author LLM-агент по разработке программного обеспечения // @match *://*/\* // @grant none // @run-at document-idle // @license MIT // ==/UserScript==

/\*

- 

---

- POLYMAT PSP-1 — PAGE STRUCTURE PROFILER
- Техническое задание № PSP-1/TZ-1.0, версия 1.0, дата 2026-09-19
- Статус: утверждено к реализации
- 

---

- Языки: комментарии кода, тексты отчётов — русский; идентификаторы кода — английский
- Общие правила:
- 


- ОБЯЗАТЕЛЬНО — требование подлежит реализации и проверке


- 


- ЗАПРЕЩЕНО — требование исключает поведение


- 


- РЕКОМЕНДОВАНО — реализовать при отсутствии конфликта с нормативными пунктами


- 


- Отступления от нормативных требований не допускаются


- 

---

\*/

(function PSP1Main() { 'use strict';

// ========================================================================== // Вспомогательные утилиты // ========================================================================== const Utils = { /\*\* \* Изолятор отказов: защищает чтение любого свойства от исключений \* @template T \* @param {() =&gt; T} fn Функция для выполнения \* @param {string} category Категория метрики \* @param {string} key Ключ метрики \* @param {string} sourceApi Исходное API \* @param {null|string} unit Единица измерения \* @returns {{category: string, key: string, value: T|null, unit: string|null, availability: string, source_api: string}} \*/ safeRead(fn, category, key, sourceApi, unit = null) { try { const value = fn(); return { category, key, value, unit, availability: 'granted', source_api: sourceApi }; } catch (err) { return { category, key, value: null, unit, availability: err.name === 'NotAllowedError' ? 'permission-required' : 'unavailable', source_api: sourceApi }; } },

`/**`\
` * FNV-1a 32-битный хеш для маскировки идентификаторов`\
` * @param {string} str Входная строка`\
` * @returns {string} Хеш в шестнадцатеричном формате`\
` */`\
`fnv1a32(str) {`\
`  let h = 2166136261;`\
`  for (let i = 0; i < str.length; i++) {`\
`    h ^= str.charCodeAt(i);`\
`    h = Math.imul(h, 16777619);`\
`  }`\
`  return (h >>> 0).toString(16).padStart(8, '0');`\
`},`\
\
`/**`\
` * Нормализация URL: возвращает только hostname и глубину пути`\
` * @param {string} url Полный URL`\
` * @returns {{hostname: string, path_depth: number}}`\
` */`\
`normalizeUrl(url) {`\
`  try {`\
`    const u = new URL(url, window.location.href);`\
`    const segments = u.pathname.split('/').filter(Boolean);`\
`    return { hostname: u.hostname, path_depth: segments.length };`\
`  } catch {`\
`    return { hostname: window.location.hostname, path_depth: 0 };`\
`  }`\
`},`\
\
`/**`\
` * Измерение времени выполнения функции`\
` * @template T`\
` * @param {() => T} fn Целевая функция`\
` * @returns {{result: T, durationMs: number}}`\
` */`\
`measureTime(fn) {`\
`  const start = performance.now();`\
`  const result = fn();`\
`  return { result, durationMs: performance.now() - start };`\
`},`\
\
`/**`\
` * Медиана массива чисел`\
` * @param {number[]} arr Массив чисел`\
` * @returns {number}`\
` */`\
`median(arr) {`\
`  if (arr.length === 0) return 0;`\
`  const sorted = [...arr].sort((a, b) => a - b);`\
`  const mid = Math.floor(sorted.length / 2);`\
`  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;`\
`}`

};

// ========================================================================== // Модуль D: Профиль устройства // ========================================================================== const ModuleD = { /\*\* \* Сбор всех метрик экрана и окна \* @returns {Array} Массив метрик устройства \*/ async collectDeviceProfile() { const metrics = \[\];

`  // 4.1 Экран и окно`\
`  metrics.push(Utils.safeRead(() => screen.width, 'screen', 'width', 'Screen API', 'px'));`\
`  metrics.push(Utils.safeRead(() => screen.height, 'screen', 'height', 'Screen API', 'px'));`\
`  metrics.push(Utils.safeRead(() => screen.availWidth, 'screen', 'avail_width', 'Screen API', 'px'));`\
`  metrics.push(Utils.safeRead(() => screen.availHeight, 'screen', 'avail_height', 'Screen API', 'px'));`\
`  metrics.push(Utils.safeRead(() => screen.orientation?.type, 'screen', 'orientation_type', 'Screen Orientation API'));`\
`  metrics.push(Utils.safeRead(() => screen.orientation?.angle, 'screen', 'orientation_angle', 'Screen Orientation API', 'deg'));`\
`  metrics.push(Utils.safeRead(() => devicePixelRatio, 'viewport', 'dpr', 'Window API'));`\
`  metrics.push(Utils.safeRead(() => window.innerWidth, 'viewport', 'inner_width', 'Window API', 'px'));`\
`  metrics.push(Utils.safeRead(() => window.innerHeight, 'viewport', 'inner_height', 'Window API', 'px'));`\
`  metrics.push(Utils.safeRead(() => window.outerWidth, 'viewport', 'outer_width', 'Window API', 'px'));`\
`  metrics.push(Utils.safeRead(() => window.outerHeight, 'viewport', 'outer_height', 'Window API', 'px'));`\
`  metrics.push(Utils.safeRead(() => window.screenX, 'viewport', 'screen_x', 'Window API', 'px'));`\
`  metrics.push(Utils.safeRead(() => window.screenY, 'viewport', 'screen_y', 'Window API', 'px'));`\
\
`  if (window.visualViewport) {`\
`    metrics.push(Utils.safeRead(() => visualViewport.width, 'visual_viewport', 'width', 'Visual Viewport API', 'px'));`\
`    metrics.push(Utils.safeRead(() => visualViewport.height, 'visual_viewport', 'height', 'Visual Viewport API', 'px'));`\
`    metrics.push(Utils.safeRead(() => visualViewport.scale, 'visual_viewport', 'scale', 'Visual Viewport API'));`\
`    metrics.push(Utils.safeRead(() => visualViewport.offsetTop, 'visual_viewport', 'offset_top', 'Visual Viewport API', 'px'));`\
`    metrics.push(Utils.safeRead(() => visualViewport.offsetLeft, 'visual_viewport', 'offset_left', 'Visual Viewport API', 'px'));`\
`  }`\
\
`  // 4.1 Медиа-запросы предпочтений пользователя`\
`  const mediaQueries = [`\
`    ['prefers-color-scheme', 'dark|light'],`\
`    ['prefers-contrast', 'no-preference|more|less|custom'],`\
`    ['prefers-reduced-motion', 'reduced|no-preference'],`\
`    ['prefers-reduced-transparency', 'reduced|no-preference'],`\
`    ['forced-colors', 'active|none'],`\
`    ['inverted-colors', 'inverted|none'],`\
`    ['color-gamut', 'srgb|p3|rec2020'],`\
`    ['dynamic-range', 'high|standard'],`\
`    ['video-dynamic-range', 'high|standard'],`\
`    ['update', 'fast|slow|none'],`\
`    ['pointer', 'coarse|fine|none'],`\
`    ['hover', 'hover|none'],`\
`    ['any-pointer', 'coarse|fine|none'],`\
`    ['any-hover', 'hover|none'],`\
`    ['display-mode', 'standalone|browser|fullscreen|minimal-ui'],`\
`    ['scripting', 'enabled|initial-only|none'],`\
`    ['monochrome', 'monochrome|none']`\
`  ];`\
\
`  for (const [mqName, allowed] of mediaQueries) {`\
`    metrics.push(Utils.safeRead(`\
`      () => {`\
`        for (const variant of allowed.split('|')) {`\
``           if (window.matchMedia(`(${mqName}: ${variant})`).matches) return variant; ``\
`        }`\
`        return 'no-preference';`\
`      },`\
`      'media_preference',`\
`      mqName,`\
`      'Media Queries Level 5'`\
`    ));`\
`  }`\
\
`  // 4.2 Частота обновления дисплея`\
`  metrics.push(...await this.measureRefreshRate());`\
\
`  // 4.3 Платформа`\
`  metrics.push(Utils.safeRead(() => navigator.userAgentData?.brands, 'platform', 'ua_brands', 'User-Agent Client Hints API'));`\
`  metrics.push(Utils.safeRead(() => navigator.userAgentData?.mobile, 'platform', 'ua_mobile', 'User-Agent Client Hints API'));`\
`  metrics.push(Utils.safeRead(() => navigator.userAgentData?.platform, 'platform', 'ua_platform', 'User-Agent Client Hints API'));`\
\
`  if (navigator.userAgentData?.getHighEntropyValues) {`\
`    try {`\
`      const highEntropy = await navigator.userAgentData.getHighEntropyValues([`\
`        'architecture', 'bitness', 'model', 'platformVersion', 'wow64'`\
`      ]);`\
`      metrics.push({`\
`        category: 'platform', key: 'high_entropy', value: highEntropy,`\
`        unit: null, availability: 'granted', source_api: 'User-Agent Client Hints API'`\
`      });`\
`    } catch {`\
`      metrics.push({`\
`        category: 'platform', key: 'high_entropy', value: null,`\
`        unit: null, availability: 'unavailable', source_api: 'User-Agent Client Hints API'`\
`      });`\
`    }`\
`  }`\
\
`  metrics.push(Utils.safeRead(() => navigator.platform, 'platform', 'legacy_platform', 'Navigator API (deprecated)'));`\
`  metrics.push(Utils.safeRead(() => navigator.hardwareConcurrency, 'platform', 'hardware_concurrency', 'Navigator API', 'cores'));`\
`  metrics.push(Utils.safeRead(() => navigator.deviceMemory, 'platform', 'device_memory', 'Device Memory API', 'GB'));`\
`  metrics.push(Utils.safeRead(() => navigator.maxTouchPoints, 'platform', 'max_touch_points', 'Navigator API'));`\
`  metrics.push(Utils.safeRead(() => navigator.webdriver, 'platform', 'webdriver', 'Navigator API'));`\
`  metrics.push(Utils.safeRead(() => navigator.pdfViewerEnabled, 'platform', 'pdf_viewer_enabled', 'Navigator API'));`\
`  metrics.push(Utils.safeRead(() => navigator.cookieEnabled, 'platform', 'cookie_enabled', 'Navigator API'));`\
`  metrics.push(Utils.safeRead(() => navigator.onLine, 'platform', 'on_line', 'Navigator API'));`\
`  metrics.push(Utils.safeRead(() => navigator.languages?.map(lang => lang.split('-')[0]), 'platform', 'language_codes', 'Navigator API'));`\
`  metrics.push(Utils.safeRead(() => Intl.DateTimeFormat().resolvedOptions().timeZone, 'platform', 'iana_timezone', 'ECMAScript Internationalization API'));`\
`  metrics.push(Utils.safeRead(() => new Date().getTimezoneOffset(), 'platform', 'utc_offset', 'Date API', 'minutes'));`\
\
`  if (navigator.storage?.estimate) {`\
`    try {`\
`      const storage = await navigator.storage.estimate();`\
`      metrics.push({`\
`        category: 'platform', key: 'storage_estimate', value: { quota: storage.quota, usage: storage.usage },`\
`        unit: 'bytes', availability: 'granted', source_api: 'Storage API'`\
`      });`\
`    } catch {`\
`      metrics.push({`\
`        category: 'platform', key: 'storage_estimate', value: null,`\
`        unit: 'bytes', availability: 'unavailable', source_api: 'Storage API'`\
`      });`\
`    }`\
`  }`\
\
`  // 4.4 Сеть`\
`  if (navigator.connection) {`\
`    metrics.push(Utils.safeRead(() => navigator.connection.effectiveType, 'network', 'effective_type', 'Network Information API'));`\
`    metrics.push(Utils.safeRead(() => navigator.connection.type, 'network', 'connection_type', 'Network Information API'));`\
`    metrics.push(Utils.safeRead(() => navigator.connection.downlink, 'network', 'downlink', 'Network Information API', 'Mbps'));`\
`    metrics.push(Utils.safeRead(() => navigator.connection.downlinkMax, 'network', 'downlink_max', 'Network Information API', 'Mbps'));`\
`    metrics.push(Utils.safeRead(() => navigator.connection.rtt, 'network', 'rtt', 'Network Information API', 'ms'));`\
`    metrics.push(Utils.safeRead(() => navigator.connection.saveData, 'network', 'save_data', 'Network Information API'));`\
`  }`\
\
`  // 4.5 Графика`\
`  metrics.push(...this.collectGraphicsMetrics());`\
\
`  // 4.6 Медиа-декодирование`\
`  const mediaCodecs = ['avc1.640028', 'hvc1.1.6.L123.00', 'vp09.00.10.08', 'av01.0.08M.08', 'mp4a.40.2', 'opus', 'flac'];`\
`  for (const codec of mediaCodecs) {`\
`    metrics.push(Utils.safeRead(`\
``       () => MediaSource.isTypeSupported(`video/mp4; codecs="${codec}"`) || MediaSource.isTypeSupported(`audio/mp4; codecs="${codec}"`), ``\
`      'media_codecs', codec, 'Media Source Extensions API'`\
`    ));`\
`  }`\
\
`  // 4.7 Батарея`\
`  if (navigator.getBattery) {`\
`    try {`\
`      const battery = await navigator.getBattery();`\
`      metrics.push({`\
`        category: 'battery', key: 'status', value: { charging: battery.charging, level: battery.level },`\
`        unit: null, availability: 'granted', source_api: 'Battery Status API'`\
`      });`\
`    } catch {`\
`      metrics.push({`\
`        category: 'battery', key: 'status', value: null,`\
`        unit: null, availability: 'unavailable', source_api: 'Battery Status API'`\
`      });`\
`    }`\
`  }`\
\
`  return metrics;`\
`},`\
\
`/**`\
` * Замер частоты обновления дисплея через requestAnimationFrame`\
` * @returns {Array} Метрики частоты обновления`\
` */`\
`async measureRefreshRate() {`\
`  return new Promise((resolve) => {`\
`    const deltas = [];`\
`    let prevTs = 0;`\
`    let frameCount = 0;`\
`    const totalFrames = 120;`\
`    const skipFirst = 10;`\
\
`    const tick = (ts) => {`\
`      if (prevTs > 0 && frameCount >= skipFirst) {`\
`        deltas.push(ts - prevTs);`\
`      }`\
`      prevTs = ts;`\
`      frameCount++;`\
\
`      if (frameCount < totalFrames) {`\
`        requestAnimationFrame(tick);`\
`      } else {`\
`        if (deltas.length < 60) {`\
`          resolve([{`\
`            category: 'display', key: 'refresh_rate', value: null,`\
`            unit: 'Hz', availability: 'unreliable', source_api: 'requestAnimationFrame'`\
`          }]);`\
`          return;`\
`        }`\
\
`        const medianDelta = Utils.median(deltas);`\
`        const rawHz = 1000 / medianDelta;`\
`        const normalizedHz = [60, 75, 90, 120, 144, 165, 240].reduce((prev, curr) =>`\
`          Math.abs(curr - rawHz) < Math.abs(prev - rawHz) ? curr : prev`\
`        );`\
\
`        resolve([`\
`          {`\
`            category: 'display', key: 'refresh_rate_raw', value: Math.round(rawHz * 10) / 10,`\
`            unit: 'Hz', availability: 'granted', source_api: 'requestAnimationFrame'`\
`          },`\
`          {`\
`            category: 'display', key: 'refresh_rate_normalized', value: normalizedHz,`\
`            unit: 'Hz', availability: 'granted', source_api: 'requestAnimationFrame'`\
`          }`\
`        ]);`\
`      }`\
`    };`\
\
`    requestAnimationFrame(tick);`\
`  });`\
`},`\
\
`/**`\
` * Сбор графических метрик WebGL`\
` * @returns {Array} Метрики графики`\
` */`\
`collectGraphicsMetrics() {`\
`  const metrics = [];`\
\
`  // WebGL1`\
`  const canvas1 = document.createElement('canvas');`\
`  const gl1 = canvas1.getContext('webgl');`\
`  metrics.push(Utils.safeRead(() => !!gl1, 'graphics', 'webgl1_supported', 'WebGL API'));`\
`  if (gl1) {`\
`    metrics.push(Utils.safeRead(() => gl1.getParameter(gl1.MAX_TEXTURE_SIZE), 'graphics', 'webgl1_max_texture_size', 'WebGL API', 'px'));`\
`    metrics.push(Utils.safeRead(() => gl1.getParameter(gl1.MAX_RENDERBUFFER_SIZE), 'graphics', 'webgl1_max_renderbuffer_size', 'WebGL API', 'px'));`\
`    metrics.push(Utils.safeRead(() => gl1.getParameter(gl1.MAX_VIEWPORT_DIMS), 'graphics', 'webgl1_max_viewport_dims', 'WebGL API', 'px'));`\
\
`    const debugInfo = gl1.getExtension('WEBGL_debug_renderer_info');`\
`    if (debugInfo) {`\
`      metrics.push(Utils.safeRead(() => gl1.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL), 'graphics', 'webgl1_unmasked_vendor', 'WEBGL_debug_renderer_info'));`\
`      metrics.push(Utils.safeRead(() => gl1.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL), 'graphics', 'webgl1_unmasked_renderer', 'WEBGL_debug_renderer_info'));`\
`    } else {`\
`      metrics.push({`\
`        category: 'graphics', key: 'webgl1_unmasked_vendor', value: null,`\
`        unit: null, availability: 'masked', source_api: 'WEBGL_debug_renderer_info'`\
`      });`\
`      metrics.push({`\
`        category: 'graphics', key: 'webgl1_unmasked_renderer', value: null,`\
`        unit: null, availability: 'masked', source_api: 'WEBGL_debug_renderer_info'`\
`      });`\
`    }`\
`  }`\
\
`  // WebGL2`\
`  const canvas2 = document.createElement('canvas');`\
`  const gl2 = canvas2.getContext('webgl2');`\
`  metrics.push(Utils.safeRead(() => !!gl2, 'graphics', 'webgl2_supported', 'WebGL 2 API'));`\
\
`  // OffscreenCanvas`\
`  metrics.push(Utils.safeRead(() => !!window.OffscreenCanvas, 'graphics', 'offscreencanvas_supported', 'OffscreenCanvas API'));`\
\
`  return metrics;`\
`}`

};

// ========================================================================== // Модуль S: Каркас страницы (без содержимого) // ========================================================================== const ModuleS = { /\*\* \* Обход DOM и построение структурной модели страницы \* @returns {Object} Структурный каркас страницы \*/ collectStructure() { const limits = { maxDepth: 64, maxNodes: 20000 }; const tree = \[\]; const stack = \[{ node: document.body, parent: null, depth: 0 }\]; let nodeCount = 0; let truncated = false;

`  while (stack.length > 0) {`\
`    const { node, parent, depth } = stack.pop();`\
\
`    if (depth > limits.maxDepth || nodeCount >= limits.maxNodes) {`\
`      truncated = true;`\
`      break;`\
`    }`\
\
`    if (!node || node.nodeType !== Node.ELEMENT_NODE) {`\
`      if (node?.nodeType === Node.TEXT_NODE) {`\
`        tree.push(this.describeTextNode(node));`\
`      }`\
`      continue;`\
`    }`\
\
`    const tag = node.tagName.toLowerCase();`\
`    if (['script', 'style', 'link', 'meta', 'noscript', 'template'].includes(tag)) {`\
`      continue;`\
`    }`\
\
`    const elementDesc = this.describeElement(node, depth);`\
`    tree.push(elementDesc);`\
`    nodeCount++;`\
\
`    // Обход дочерних узлов в обратном порядке для сохранения порядка`\
`    let child = node.lastChild;`\
`    while (child) {`\
`      stack.push({ node: child, parent: node, depth: depth + 1 });`\
`      child = child.previousSibling;`\
`    }`\
\
`    // Обработка Shadow DOM`\
`    if (node.shadowRoot) {`\
`      let shadowChild = node.shadowRoot.lastChild;`\
`      while (shadowChild) {`\
`        stack.push({ node: shadowChild, parent: node, depth: depth + 1 });`\
`        shadowChild = shadowChild.previousSibling;`\
`      }`\
`    }`\
`  }`\
\
`  return {`\
`    tree,`\
`    truncated,`\
`    node_count: nodeCount,`\
`    limits_applied: limits,`\
`    ...this.collectCssInventory(),`\
`    ...this.collectTables(),`\
`    ...this.collectForms(),`\
`    ...this.collectInformationArchitecture()`\
`  };`\
`},`\
\
`/**`\
` * Описание отдельного элемента без содержимого`\
` * @param {Element} el Целевой элемент`\
` * @param {number} depth Глубина вложенности`\
` * @returns {Object} Описание элемента`\
` */`\
`describeElement(el, depth) {`\
`  const rect = el.getBoundingClientRect();`\
`  const computed = window.getComputedStyle(el);`\
\
`  // Маскировка идентификаторов по правилам 2.4`\
`  const idRaw = el.id || '';`\
``   const idHash = idRaw ? `${Utils.fnv1a32(idRaw)}:${idRaw.length}` : null; ``\
`  const classes = Array.from(el.classList);`\
\
`  // Статус видимости`\
`  let visibilityStatus = 'displayed';`\
`  if (computed.display === 'none') visibilityStatus = 'hidden';`\
`  else if (computed.visibility === 'hidden') visibilityStatus = 'invisible';`\
`  else if (parseFloat(computed.opacity) < 0.05) visibilityStatus = 'transparent';`\
`  else if (rect.width === 0 || rect.height === 0) visibilityStatus = 'clipped';`\
`  else if (rect.right < 0 || rect.left > window.innerWidth || rect.bottom < 0 || rect.top > window.innerHeight) {`\
`    visibilityStatus = 'offscreen';`\
`  }`\
\
`  return {`\
`    tag: el.tagName.toLowerCase(),`\
`    namespace: el.namespaceURI.includes('svg') ? 'svg' : el.namespaceURI.includes('mathml') ? 'mathml' : 'html',`\
`    depth,`\
`    id_hash: idHash,`\
`    classes,`\
`    role: el.getAttribute('role') || this.inferAriaRole(el),`\
`    landmark_class: this.detectLandmarkClass(el),`\
`    heading_level: this.detectHeadingLevel(el),`\
`    geometry: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },`\
`    visibility: visibilityStatus,`\
`    stacking_props: {`\
`      position: computed.position,`\
`      z_index: computed.zIndex,`\
`      opacity: parseFloat(computed.opacity),`\
`      transform: computed.transform !== 'none',`\
`      has_filter: computed.filter !== 'none',`\
`      has_backdrop_filter: computed.backdropFilter !== 'none',`\
`      will_change: computed.willChange !== 'auto',`\
`      isolation: computed.isolation === 'isolate',`\
`      mix_blend_mode: computed.mixBlendMode !== 'normal',`\
`      contain: computed.contain,`\
`      has_mask: computed.mask !== 'none'`\
`    },`\
`    interactive: {`\
`      tabindex: el.hasAttribute('tabindex') ? parseInt(el.getAttribute('tabindex') || '0', 10) : null,`\
`      disabled: el.hasAttribute('disabled'),`\
`      readonly: el.hasAttribute('readonly')`\
`    },`\
`    structural_aria: {`\
`      hidden: el.hasAttribute('aria-hidden'),`\
`      expanded: el.getAttribute('aria-expanded'),`\
`      current: el.getAttribute('aria-current'),`\
`      level: el.getAttribute('aria-level'),`\
`      posinset: el.getAttribute('aria-posinset'),`\
`      setsize: el.getAttribute('aria-setsize'),`\
`      live: el.getAttribute('aria-live'),`\
`      busy: el.getAttribute('aria-busy'),`\
`      modal: el.getAttribute('aria-modal')`\
`    },`\
`    has_inline_style: !!el.style.length,`\
`    inline_style_decl_count: el.style.length`\
`  };`\
`},`\
\
`/**`\
` * Описание текстового узла без содержимого`\
` * @param {Text} node Текстовый узел`\
` * @returns {Object} Структурное описание текстового узла`\
` */`\
`describeTextNode(node) {`\
`  const text = node.textContent || '';`\
`  return {`\
`    type: 'text_node',`\
`    length: text.length,`\
`    words: text.split(/\s+/).filter(Boolean).length,`\
`    has_digits: /\d/.test(text),`\
`    in_link: node.parentElement?.closest('a') !== null`\
`  };`\
`},`\
\
`/**`\
` * Вывод неявной ARIA-роли элемента по спецификации W3C`\
` * @param {Element} el Целевой элемент`\
` * @returns {string} Неявная роль`\
` */`\
`inferAriaRole(el) {`\
`  const tag = el.tagName.toLowerCase();`\
`  const implicitRoles = {`\
`    a: el.hasAttribute('href') ? 'link' : 'generic',`\
`    button: 'button',`\
`    input: {`\
`      button: 'button', checkbox: 'checkbox', radio: 'radio',`\
`      range: 'slider', search: 'searchbox', text: 'textbox'`\
`    }[el.getAttribute('type')] || 'textbox',`\
`    nav: 'navigation',`\
`    main: 'main',`\
`    aside: 'complementary',`\
`    header: el.closest('main') ? 'banner' : 'generic',`\
`    footer: el.closest('main') ? 'contentinfo' : 'generic',`\
`    form: el.getAttribute('role') || 'form'`\
`  };`\
`  return implicitRoles[tag] || 'generic';`\
`},`\
\
`/**`\
` * Определение landmark-класса элемента`\
` * @param {Element} el Целевой элемент`\
` * @returns {string|null} Класс landmark`\
` */`\
`detectLandmarkClass(el) {`\
`  const tag = el.tagName.toLowerCase();`\
`  if (tag === 'header' && !el.closest('main, article, section')) return 'banner';`\
`  if (tag === 'nav') return 'navigation';`\
`  if (tag === 'main') return 'main';`\
`  if (tag === 'aside') return 'complementary';`\
`  if (tag === 'footer' && !el.closest('main, article, section')) return 'contentinfo';`\
`  if (el.getAttribute('role') === 'search') return 'search';`\
`  if (['form', 'section', 'region'].includes(tag) || el.getAttribute('role') === 'region') {`\
`    return 'region';`\
`  }`\
`  return null;`\
`},`\
\
`/**`\
` * Определение уровня заголовка`\
` * @param {Element} el Целевой элемент`\
` * @returns {number|null} Уровень заголовка`\
` */`\
`detectHeadingLevel(el) {`\
`  const tag = el.tagName.toLowerCase();`\
`  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {`\
`    return parseInt(tag.charAt(1), 10);`\
`  }`\
`  if (el.getAttribute('role') === 'heading' && el.hasAttribute('aria-level')) {`\
`    return parseInt(el.getAttribute('aria-level') || '1', 10);`\
`  }`\
`  return null;`\
`},`\
\
`/**`\
` * Сбор инвентаря CSS`\
` * @returns {Object} Данные CSS-инвентаря`\
` */`\
`collectCssInventory() {`\
`  const result = {`\
`    total_same_origin_sheets: 0,`\
`    total_cross_origin_sheets: 0,`\
`    at_media_queries: [],`\
`    at_supports: [],`\
`    at_layers: [],`\
`    at_property: [],`\
`    selector_type_distribution: {},`\
`    max_specificity: [0, 0, 0],`\
`    total_important: 0,`\
`    total_inline_declarations: 0,`\
`    custom_property_names: new Set(),`\
`    unit_distribution: {},`\
`    function_distribution: {}`\
`  };`\
\
`  for (let i = 0; i < document.styleSheets.length; i++) {`\
`    const sheet = document.styleSheets[i];`\
`    try {`\
`      const rules = sheet.cssRules || [];`\
`      result.total_same_origin_sheets++;`\
`      for (const rule of rules) {`\
`        this.processCssRule(rule, result);`\
`      }`\
`    } catch {`\
`      result.total_cross_origin_sheets++;`\
`    }`\
`  }`\
\
`  result.custom_property_names = Array.from(result.custom_property_names);`\
`  return { css_inventory: result };`\
`},`\
\
`/**`\
` * Обработка отдельного CSS-правила`\
` * @param {CSSRule} rule CSS-правило`\
` * @param {Object} result Объект для накопления результатов`\
` */`\
`processCssRule(rule, result) {`\
`  if (rule.type === CSSRule.MEDIA_RULE) {`\
`    result.at_media_queries.push(rule.conditionText);`\
`  }`\
`  if (rule.type === CSSRule.SUPPORTS_RULE) {`\
`    result.at_supports.push(rule.conditionText);`\
`  }`\
`  if (rule.type === CSSRule.LAYER_RULE) {`\
`    result.at_layers.push(rule.name);`\
`  }`\
`  if (rule.type === CSSRule.PROPERTY_RULE) {`\
`    result.at_property.push(rule.name);`\
`  }`\
`  if (rule.selectorText) {`\
`    this.analyzeSelector(rule.selectorText, result);`\
`  }`\
`  if (rule.style) {`\
`    result.total_inline_declarations += rule.style.length;`\
`    for (let i = 0; i < rule.style.length; i++) {`\
`      const prop = rule.style[i];`\
`      const val = rule.style.getPropertyValue(prop);`\
`      if (rule.style.getPropertyPriority(prop) === 'important') {`\
`        result.total_important++;`\
`      }`\
`      this.analyzeCssValue(val, result);`\
`    }`\
`  }`\
`},`\
\
`/**`\
` * Анализ селектора по типам`\
` * @param {string} selector Селектор`\
` * @param {Object} result Объект для накопления результатов`\
` */`\
`analyzeSelector(selector, result) {`\
`  const tokens = selector.split(/[\s>+,~]/).filter(Boolean);`\
`  for (const token of tokens) {`\
`    if (token.startsWith('.')) result.selector_type_distribution.class = (result.selector_type_distribution.class || 0) + 1;`\
`    else if (token.startsWith('#')) result.selector_type_distribution.id = (result.selector_type_distribution.id || 0) + 1;`\
`    else if (token.startsWith('[')) result.selector_type_distribution.attribute = (result.selector_type_distribution.attribute || 0) + 1;`\
`    else if (token.includes(':')) result.selector_type_distribution.pseudo = (result.selector_type_distribution.pseudo || 0) + 1;`\
`    else if (token === '*') result.selector_type_distribution.universal = (result.selector_type_distribution.universal || 0) + 1;`\
`    else result.selector_type_distribution.tag = (result.selector_type_distribution.tag || 0) + 1;`\
`  }`\
`},`\
\
`/**`\
` * Анализ CSS-значения на единицы и функции`\
` * @param {string} value CSS-значение`\
` * @param {Object} result Объект для накопления результатов`\
` */`\
`analyzeCssValue(value, result) {`\
`  const units = ['px', 'rem', 'em', '%', 'vw', 'vh', 'dvh', 'svh', 'lvh', 'ch', 'ex', 'fr', 'cm', 'mm', 'in', 'pt', 'q', 'deg', 'rad', 'turn'];`\
`  for (const unit of units) {`\
``     if (new RegExp(`\\d+${unit}\\b`).test(value)) { ``\
`      result.unit_distribution[unit] = (result.unit_distribution[unit] || 0) + 1;`\
`    }`\
`  }`\
\
`  const functions = ['calc', 'min', 'max', 'clamp', 'fit-content', 'min-content', 'max-content', 'var', 'env', 'color-mix', 'oklch', 'oklab', 'lab', 'lch', 'color', 'hsl', 'rgb'];`\
`  for (const fn of functions) {`\
``     if (value.includes(`${fn}(`)) { ``\
`      result.function_distribution[fn] = (result.function_distribution[fn] || 0) + 1;`\
`    }`\
`    if (fn === 'var') {`\
`      const matches = value.match(/var\(--([a-zA-Z0-9_-]+)/g);`\
`      matches?.forEach(m => result.custom_property_names.add(m.slice(5)));`\
`    }`\
`  }`\
`},`\
\
`/**`\
`（AI生成）`



I have received and reviewed the comprehensive technical specification for the **POLYMAT PSP-1 Page Structure Profiler**. 

This is a highly detailed blueprint for an advanced, privacy-focused web auditing userscript that analyzes DOM structure, CSS capabilities, accessibility (WCAG 2.2 & APCA), and performance, outputting deterministic JSON and offline HTML reports.

How would you like to proceed? I can help you with:

1. **Writing the Userscript (`psp-1.user.js`)**: Implementing specific modules (e.g., the iterative DFS DOM walker, OKLCH/APCA color math, the deterministic recommendation engine, or the Shadow DOM UI panel).
2. **Drafting the JSON Schema (`psp-1.schema.json`)**: Creating the strict validation schema for the `ssea-1` JSON report structure.
3. **Generating Test Fixtures**: Writing the HTML code for the 8 required E2E test pages (e.g., the dark theme with warm palette, infinite 4Hz animation, cross-origin iframe + dialog, etc.).
4. **Writing the README**: Documenting the installation, usage, privacy threat model, and known limitations.
5. **Code Review & Architecture**: Discussing how to handle specific constraints like the `requestIdleCallback` chunking, layout-thrashing prevention, or strict CSP compliance.

Please let me know which part of the project you would like to tackle first!
