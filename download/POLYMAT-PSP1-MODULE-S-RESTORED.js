// ==========================================================================
// POLYMAT PSP-1 — МОДУЛЬ S: КАРКАС СТРАНИЦЫ (движок по ТЗ PSP-1/TZ-1.0, раздел 5)
// ВОССТАНОВЛЕНО Task 6 (2026-09-19) из «солянки» — экспорта чата Dola.
//
// ЧТО ЭТО: движок сбора каркаса страницы БЕЗ содержимого — дерево (5.1-5.2),
// геометрия пакетированно (5.2/9.1), CSS-инвентарь (5.6.1-5.6.4), цветовая
// карта OKLCH (5.6.5-5.6.7), слои композитинга L0-L6 (5.7), таблицы (5.4),
// формы (5.5), информационная архитектура (5.8). Экспорт: const PageStructure.
//
// ЭТО НЕ ПОЛНЫЙ USERSCRIPT: модулей D (устройство, разд. 4), H (метрики
// здоровья, 6.1-6.6), R (отчёты, 7.1-7.3), C (согласие/панель, разд. 10)
// исполнитель не дал — их нужно достраивать или запросить повторно.
//
// ВОССТАНОВЛЕНО (9 функций, потерянных при стриминге исполнителя):
//   fnv1a32, hexToRgb, calculateWCAGContrast, calculateAPCA, rgbToOklch,
//   batchReadGeometry, processMediaRule, processSupportsRule, processContainerRule
//   Юнит-векторы (scripts/test_restored.js): FNV-1a("a")=e40c292c;
//   WCAG b/w=21.00; APCA BoW=-106.04 (вектор ТЗ, ±0.5 OK); OKLCH
//   red/green/blue/white — 15/15 PASS.
// ИСПРАВЛЕНО: затенение `result` в collectCSSInventory (локальная тень
//   модульной переменной — статистика селекторов/юнитов/функций терялась).
//
// ERRATA ТЗ PSP-1/TZ-1.0 (установлена самотестом Task 6):
//   6.1.1: Lc — в ПУНКТАХ (x100 от доли); офсет 0.027 применяется К НУЛЮ в
//          обоих направлениях; WoB-вектор ≈+107.89, а не +106.04
//          (BoW -106.04 сходится точно);
//   11.1:  вектор OKLCH зелёного — (0.86644, 0.29483, 142.495),
//          а не (0.96815, 0.21133, 136.013).
//
// ИЗВЕСТНЫЕ ПРОБЕЛЫ ИСХОДНИКА (не чинились — вне рамок восстановления):
//   specificity всегда нули (analyzeSelector не считает тройку a,b,c);
//   parsedRules пуст (processCSSRule не пушит правила в массив);
//   @layer/@property — заглушки (ТЗ 5.6.1 требует списки имён).
// ==========================================================================

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

  // ============================================================
  // ВОССТАНОВЛЕННЫЙ БЛОК (Task 6, 2026-09-19): 9 функций, потерянных
  // при стриминговой генерации исполнителя (проза-паузы на ориг.
  // строках 5000-5005 и 6949-6952). Сигнатуры согласованы с местами
  // вызова; цветовые каналы — гамма-кодированный sRGB 0..1 (конвенция
  // parseColorToRgb). Математика: ТЗ PSP-1 6.1.1, CSS Color 4.
  // ============================================================

  /**
   * FNV-1a 32 бит (ТЗ 2.4). Возврат: hex из 8 символов.
   * Тест-вектор: fnv1a32("a") === "e40c292c".
   */
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * hex -> {r,g,b,a}, каналы 0..1 (ТЗ 5.6.4/5.6.5).
   * Поддержка #rgb/#rgba/#rrggbb/#rrggbbaa; иначе null.
   */
  function hexToRgb(hex) {
    const m = /^#([0-9a-f]{3,8})$/i.exec(String(hex).trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3 || h.length === 4) {
      h = h.split('').map(c => c + c).join('');
    }
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  /** Линеаризация канала sRGB (0..1) по формуле WCAG 2.2. */
  function wcagLinear(c) {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /**
   * WCAG 2.2 контраст-рейшо (ТЗ 6.1.2). Вход: {r,g,b} 0..1.
   */
  function calculateWCAGContrast(fg, bg) {
    const lum = (c) => 0.2126 * wcagLinear(c.r)
                    + 0.7152 * wcagLinear(c.g)
                    + 0.0722 * wcagLinear(c.b);
    const L1 = Math.max(lum(fg), lum(bg));
    const L2 = Math.min(lum(fg), lum(bg));
    return (L1 + 0.05) / (L2 + 0.05);
  }

  /**
   * APCA 0.1.9 (SAPC-4) — ТЗ 6.1.1. Вход: {r,g,b} 0..1 (гамма).
   * Возврат: Lc со знаком (минус = тёмный текст на светлом, BoW).
   * Константы: mainTRC=2.4; sRco=0.2126729 sGco=0.7151522 sBco=0.0721750;
   * normTXT=.57 normBG=.56 revTXT=.62 revBG=.65; blkThrs=.022
   * blkClmp=1.414; scale=1.14; loClip=.1; deltaYmin=.0005; offset=.027.
   * ERRATA ТЗ 6.1.1 (установлена самотестом Task 6): (1) Lc выражается
   * в ПУНКТАХ APCA (0..~108), т.е. x100 от доли; (2) офсет применяется
   * К НУЛЮ в обоих направлениях (|Lc| = |SAPC|·100 − 2.7), иначе вектор
   * приёмки #000/#FFF не сходится. Проверено: BoW -> −106.05 (вектор
   * −106.04, доп. ±0.5 — OK); WoB -> +107.89 (вектор ТЗ +106.04 —
   * errata, см. отчёт). Ветвление по направлению (Ybg > Ytxt).
   */
  function calculateAPCA(fg, bg) {
    const mainTRC = 2.4;
    const sRco = 0.2126729, sGco = 0.7151522, sBco = 0.0721750;
    const normTXT = 0.57, normBG = 0.56, revTXT = 0.62, revBG = 0.65;
    const blkThrs = 0.022, blkClmp = 1.414, scale = 1.14;
    const loClip = 0.1, offset = 0.027, deltaYmin = 0.0005;

    const Y = (c) => {
      let y = sRco * Math.pow(c.r, mainTRC)
            + sGco * Math.pow(c.g, mainTRC)
            + sBco * Math.pow(c.b, mainTRC);
      if (y < blkThrs) y += Math.pow(blkThrs - y, blkClmp);
      return y;
    };

    const Ytxt = Y(fg), Ybg = Y(bg);
    if (Math.abs(Ytxt - Ybg) < deltaYmin) return 0;

    let sapc, lc;
    if (Ybg > Ytxt) {
      // BoW: тёмный текст на светлом
      sapc = (Math.pow(Ytxt, normTXT) - Math.pow(Ybg, normBG)) * scale;
      lc = sapc > -loClip ? 0 : sapc + offset;
    } else {
      // WoB: светлый текст на тёмном
      sapc = (Math.pow(Ytxt, revTXT) - Math.pow(Ybg, revBG)) * scale;
      lc = sapc < loClip ? 0 : sapc - offset;
    }
    // Lc в пунктах APCA (0..~108): доля x100, округление до 2 знаков
    return Math.round(lc * 100 * 100) / 100;
  }

  /**
   * sRGB {r,g,b} 0..1 (гамма) -> OKLCH {l,c,h,alpha} по CSS Color 4
   * (ТЗ 5.6.5, матрицы OKLab спецификации). Векторы: red -> L .62796
   * C .25768 H 29.234; white -> L 1 C 0; blue -> L .45201 C .31321
   * H 264.052; green -> L .86644 C .29483 H 142.495 (ERRATA ТЗ 11.1:
   * вектор зелени в ТЗ ошибочен; канонический OKLCH зелёного
   * подтверждён сходимостью red/blue/white на тех же матрицах);
   */
  function rgbToOklch(rgb) {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const r = lin(rgb.r), g = lin(rgb.g), b = lin(rgb.b);
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    const C = Math.sqrt(A * A + B * B);
    let H = Math.atan2(B, A) * 180 / Math.PI;
    if (H < 0) H += 360;
    return { l: L, c: C, h: H, alpha: rgb.a !== undefined ? rgb.a : 1 };
  }

  /**
   * Пакетированное чтение геометрии (ТЗ 9.1, анти layout-thrashing):
   * сначала ВСЕ getBoundingClientRect, затем колбэки. Возврат: массив
   * результатов callback (null там, где rect недоступен).
   */
  function batchReadGeometry(elements, callback) {
    const rects = new Array(elements.length);
    for (let i = 0; i < elements.length; i++) {
      try { rects[i] = elements[i].getBoundingClientRect(); }
      catch (e) { rects[i] = null; }
    }
    const results = new Array(elements.length);
    for (let i = 0; i < elements.length; i++) {
      results[i] = rects[i] ? callback(elements[i], rects[i]) : null;
    }
    return results;
  }

  /** @media: условие -> result.mediaQueries + рекурсия (ТЗ 5.6.1). */
  function processMediaRule(rule) {
    try {
      if (rule.conditionText) result.mediaQueries.push(rule.conditionText);
      const inner = rule.cssRules || [];
      for (let i = 0; i < inner.length; i++) processCSSRule(inner[i]);
    } catch (e) {
      console.warn('[PSP-1] @media: ' + e.message);
    }
  }

  /** @supports: условие -> result.supportsQueries + рекурсия. */
  function processSupportsRule(rule) {
    try {
      if (rule.conditionText) result.supportsQueries.push(rule.conditionText);
      const inner = rule.cssRules || [];
      for (let i = 0; i < inner.length; i++) processCSSRule(inner[i]);
    } catch (e) {
      console.warn('[PSP-1] @supports: ' + e.message);
    }
  }

  /** @container: условие -> result.containerQueries + рекурсия. */
  function processContainerRule(rule) {
    try {
      if (rule.containerName || rule.containerQuery) {
        result.containerQueries.push(
          (rule.containerName || '') + ' ' + (rule.containerQuery || rule.conditionText || '')
        );
      } else if (rule.conditionText) {
        result.containerQueries.push(rule.conditionText);
      }
      const inner = rule.cssRules || [];
      for (let i = 0; i < inner.length; i++) processCSSRule(inner[i]);
    } catch (e) {
      console.warn('[PSP-1] @container: ' + e.message);
    }
  }

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
    // ИСПРАВЛЕНО (Task 6): было `const result` — локальная тень модульной
    // `let result` (объявлена ниже для analyzeSelector/analyzeStyle), из-за
    // чего вся статистика (selectors/units/functions/important/customProps)
    // писалась в посторонний объект и терялась. Теперь пишем в модульную.
    result = {
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
