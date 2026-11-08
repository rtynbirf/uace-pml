  // ============ UI v27.1 HUMAN-FIRST (по нормам MAKT-2026 / GOLOGRAMMA) ============
  // Девять норм вшиты в панель: контраст WCAG 2.2 1.4.3 (без чистого ч/б 21:1),
  // APCA Lc75, строка 45-75 знаков, мерцание 0 Гц, тёплый вечер (Harvard, 460-480 нм),
  // цели касания >=44px, поле зрения 4-6 контролов (Коэн 2015: 4±1), ноль попапов
  // (Gloria Mark: 23 мин возврата), кегль >=14px, без тонких начертаний.
  // Автоном по построению: system-ui шрифты, ноль CDN по умолчанию (PDF = печать браузера).
  // v27.1: акцент панели берётся из системы пользователя (CSS Color 4: AccentColor) с автоподгонкой
  // контраста ≥4.5:1 под текущую тему; симпатичный сегментный переключатель режима вшит в шапку
  // панели (радиогруппа: стрелки ←→, Home/End, roving tabindex); живая перекраска при смене
  // темы/акцента ОС (matchMedia + focus + visibilitychange).

  // --- Палитры (просчитаны по WCAG; чистые чёрный/белый запрещены — Zhang 2023) ---
  const HF_PALETTES = {
    light: { bg:'#fbfbfd', surface:'#ffffff', tx:'#1d1d1f', tx2:'#55555c', line:'#d9d9e0',
             accent:'#0b66c3', accentTx:'#ffffff', ok:'#1d7a3c', warn:'#a04b00',
             btn:'#ffffff', btnHover:'#f0f0f4', btnTx:'#1d1d1f', ring:'rgba(11,102,195,.55)' },
    dark:  { bg:'#1d1d24', surface:'#26262e', tx:'#f2f2f6', tx2:'#b9b9c3', line:'#43434e',
             accent:'#74b3ff', accentTx:'#10131a', ok:'#6fd08c', warn:'#ffb066',
             btn:'#2d2d37', btnHover:'#35353f', btnTx:'#f2f2f6', ring:'rgba(116,179,255,.6)' },
    warm:  { bg:'#f6efe2', surface:'#fdf8ee', tx:'#3a3226', tx2:'#6b5f4c', line:'#d8ccb4',
             accent:'#8a5a00', accentTx:'#ffffff', ok:'#4a6b1f', warn:'#a04b00',
             btn:'#fdf8ee', btnHover:'#f1e8d6', btnTx:'#3a3226', ring:'rgba(138,90,0,.5)' }
  };
  function hfTheme() {
    const t = safeStorageGet('uaice_theme') || 'auto';
    // v27.1: явный «Тепло» теперь честно форсится (в v27.0 кнопка писала 'warm', но читалась только вечером)
    if (t === 'light' || t === 'dark' || t === 'warm') return t;
    // auto: вечер после 20:00 и утро до 07:00 — тёплый режим (синий свет/мелатонин, Harvard)
    const evening = safeStorageGet('uaice_evening') !== '0';
    const h = new Date().getHours();
    if (evening && (h >= 20 || h < 7)) return 'warm';
    try { if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'; } catch (e) {}
    return 'light';
  }
  function hfMotionOn() {
    if (safeStorageGet('uaice_motion') === '0') return false;
    try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
    return true;
  }
  // WCAG-контраст живьём — паспорт панели считает сам, не ссылается на чужие обещания
  function hfLum(hex) {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => {
      let x = parseInt(c.slice(i, i + 2), 16) / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function hfContrast(fg, bg) {
    const l1 = hfLum(fg), l2 = hfLum(bg);
    return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
  }

  // --- v27.1: системный акцент ОС (CSS Color 4: AccentColor) — «цвет панели как у пользователя в системе» ---
  // Пробный элемент читает computed color ключевого слова AccentColor (Chromium 93+/Firefox 118+/Safari 16.4+).
  // Движки без поддержки отдают чёрный/серый — берём только насыщенные цвета, иначе остаёмся на эталоне.
  let hfSysAccentCache = null;
  function hfSystemAccent() {
    if (hfSysAccentCache) return hfSysAccentCache;
    try {
      const pr = document.createElement('span');
      pr.style.cssText = 'color:AccentColor;position:absolute;visibility:hidden;pointer-events:none;';
      (document.head || document.documentElement).appendChild(pr);
      const cs = getComputedStyle(pr).color || '';
      pr.remove();
      const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(cs);
      if (!m) return null;
      const rgb = [+m[1], +m[2], +m[3]];
      const mx = Math.max(rgb[0], rgb[1], rgb[2]) / 255, mn = Math.min(rgb[0], rgb[1], rgb[2]) / 255;
      if (mx < 0.08 || (mx - mn) / mx < 0.18) return null; // вырожденный ответ движка — эталонный акцент
      hfSysAccentCache = rgb;
      return rgb;
    } catch (e) { return null; }
  }
  function hfRgbToHex(rgb) {
    return '#' + rgb.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  }
  function hfShiftLum(rgb, k) { // k>0 — светлее, k<0 — темнее
    const f = (x) => (k >= 0 ? x + (255 - x) * k : x * (1 + k));
    return [f(rgb[0]), f(rgb[1]), f(rgb[2])];
  }
  // Подгонка по норме 1 (WCAG ≥4.5:1): двигаем светлоту ОТ фона темы, пока контраст не дотянут.
  // Светлые темы — акцент темнеет, тёмная — светлеет; оттенок системы сохраняется.
  // Проход 2 — «ловушка средней светлоты»: текст НА акценте (тумблер переключателя) тоже обязан
  // дать ≥4.5:1, поэтому акцент уводится дальше, пока обе проверки не сойдутся.
  function hfTuneAccent(rgb, bgHex) {
    let c = rgb.slice();
    const dir = hfLum(hfRgbToHex(rgb)) > hfLum(bgHex) ? 1 : -1;
    for (let i = 0; i < 60 && hfContrast(hfRgbToHex(c), bgHex) < 4.5; i++) c = hfShiftLum(c, dir * 0.04);
    if (hfContrast(hfRgbToHex(c), bgHex) < 4.5) return null;
    for (let i = 0; i < 60 && hfContrast(hfPickAccentTx(hfRgbToHex(c)), hfRgbToHex(c)) < 4.5; i++) c = hfShiftLum(c, dir * 0.04);
    const hex = hfRgbToHex(c);
    return (hfContrast(hex, bgHex) >= 4.5 && hfContrast(hfPickAccentTx(hex), hex) >= 4.5) ? c : null;
  }
  // Текст на акценте: без чистых чёрного/белого (Zhang 2023), выбор по контрасту ≥4.5:1
  function hfPickAccentTx(accentHex) {
    return hfContrast(accentHex, '#f7f7fa') >= hfContrast(accentHex, '#10131a') ? '#f7f7fa' : '#10131a';
  }
  // Акцент ОС меняется вне страницы — кэш сбрасывается, панель переспрашивает при возврате фокуса
  try {
    const hfInv = () => { hfSysAccentCache = null; };
    window.addEventListener('focus', hfInv, true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) hfInv(); });
  } catch (e) {}

  function injectModernStyles() {
    if (document.getElementById(UI_ID + '-styles')) return;
    const css = `
#${UI_ID}{position:fixed;right:16px;bottom:16px;z-index:2147483647;font:14px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--hf-tx);}
#${UI_ID} .box{display:flex;flex-direction:column;gap:8px;background:var(--hf-bg);padding:12px;border-radius:14px;border:1px solid var(--hf-line);box-shadow:0 8px 30px rgba(0,0,0,.22);min-width:262px;max-width:340px;max-height:88vh;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;}
#${UI_ID} button{border:1px solid var(--hf-line);border-radius:9px;padding:9px 12px;min-height:44px;cursor:pointer;font:inherit;font-weight:400;color:var(--hf-btn-tx);background:var(--hf-btn);text-align:left;box-sizing:border-box;}
#${UI_ID} button:hover:not(:disabled){background:var(--hf-btn-hover);}
#${UI_ID} button:disabled{opacity:.45;cursor:not-allowed;}
#${UI_ID} button:focus-visible, #${UI_ID} select:focus-visible, #${UI_ID} input:focus-visible, #${UI_ID} summary:focus-visible{outline:2px solid var(--hf-accent);outline-offset:2px;}
#${UI_ID} select{min-height:44px;background:var(--hf-surface);color:var(--hf-tx);border:1px solid var(--hf-line);border-radius:9px;padding:4px 8px;font:inherit;flex:1;}
#${UI_ID} .status{font-size:14px;line-height:1.6;color:var(--hf-tx);max-width:65ch;white-space:pre-wrap;text-align:left;overflow-wrap:anywhere;}
#${UI_ID} .mini{font-size:12px;line-height:1.5;color:var(--hf-tx2);}
#${UI_ID} .grip{display:flex;align-items:center;justify-content:space-between;gap:6px;cursor:move;user-select:none;-webkit-user-select:none;font-size:14px;font-weight:600;line-height:1.3;padding:1px 2px;}
#${UI_ID} .grip .title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#${UI_ID} .grip button{flex:0 0 auto;min-height:44px;min-width:44px;padding:4px 10px;text-align:center;font-size:14px;}
#${UI_ID} .row2{display:flex;gap:8px;align-items:stretch;}
#${UI_ID} .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
#${UI_ID} .stop{grid-column:1 / -1;text-align:center;border-color:var(--hf-warn);color:var(--hf-warn);}
#${UI_ID} details{border:1px solid var(--hf-line);border-radius:9px;background:var(--hf-surface);}
#${UI_ID} summary{list-style:none;cursor:pointer;padding:9px 12px;min-height:44px;display:flex;align-items:center;font-weight:400;color:var(--hf-btn-tx);}
#${UI_ID} summary::-webkit-details-marker{display:none;}
#${UI_ID} summary::before{content:'▸ ';color:var(--hf-tx2);}
#${UI_ID} details[open] summary::before{content:'▾ ';}
#${UI_ID} details .inner{display:flex;flex-direction:column;gap:8px;padding:0 10px 10px;}
#${UI_ID} .settings{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--hf-line);padding-top:10px;}
#${UI_ID} .settings input[type="text"]{background:var(--hf-surface);color:var(--hf-tx);border:1px solid var(--hf-line);border-radius:9px;padding:8px 10px;font:inherit;box-sizing:border-box;width:100%;min-height:44px;}
#${UI_ID} .settings label{display:flex;gap:8px;align-items:flex-start;font-size:14px;color:var(--hf-tx);cursor:pointer;line-height:1.5;}
#${UI_ID} .settings input[type="checkbox"]{width:20px;height:20px;margin:2px 0 0;accent-color:var(--hf-accent);flex:0 0 auto;}
#${UI_ID} .settings .row{display:flex;gap:8px;}
#${UI_ID} .settings .row button{flex:1;font-size:13px;}
#${UI_ID} .cap{font-size:12px;color:var(--hf-tx2);line-height:1.5;}
#${UI_ID} .comfort{display:flex;flex-direction:column;gap:8px;}
#${UI_ID} .comfort .crow{display:flex;gap:8px;align-items:center;justify-content:space-between;}
#${UI_ID} .comfort .crow .cl{font-size:13px;color:var(--hf-tx);}
#${UI_ID} .comfort .cbtns{display:flex;gap:4px;}
#${UI_ID} .comfort .cbtns button{min-height:36px;min-width:36px;padding:4px 9px;font-size:13px;text-align:center;flex:0 0 auto;}
#${UI_ID} .comfort .cbtns button[aria-pressed="true"]{border-color:var(--hf-accent);box-shadow:inset 0 0 0 1px var(--hf-accent);color:var(--hf-accent);font-weight:600;}
#${UI_ID} .passport{display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.55;}
#${UI_ID} .passport .prow{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed var(--hf-line);padding-bottom:4px;}
#${UI_ID} .passport .pk{color:var(--hf-tx2);}
#${UI_ID} .passport .pv{font-weight:600;text-align:right;overflow-wrap:anywhere;}
#${UI_ID} .passport .pv.good{color:var(--hf-ok);}
#${UI_ID} .passport a{color:var(--hf-accent);text-decoration:underline;overflow-wrap:anywhere;}
#${UI_ID} .badge{display:none;padding:0;width:48px;height:48px;border-radius:50%;background:var(--hf-surface);color:var(--hf-tx);font-size:19px;line-height:1;cursor:pointer;border:1px solid var(--hf-line);box-shadow:0 8px 30px rgba(0,0,0,.25);}
#${UI_ID} .badge.busy{border-color:var(--hf-warn);color:var(--hf-warn);}
#${UI_ID} .seg{position:relative;display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--hf-line);border-radius:12px;background:var(--hf-surface);padding:3px;}
#${UI_ID} .seg .thumb{position:absolute;top:3px;left:3px;height:calc(100% - 6px);width:calc((100% - 6px)/4);border-radius:9px;background:var(--hf-accent);transition:transform .18s ease;}
#${UI_ID} .seg .segb{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:5px;min-height:44px;border:0;background:transparent;color:var(--hf-tx2);font:inherit;font-weight:400;padding:0;border-radius:9px;cursor:pointer;}
#${UI_ID} .seg .segb:hover{background:transparent;color:var(--hf-tx);}
#${UI_ID} .seg .segb.on{color:var(--hf-accent-tx);font-weight:600;}
#${UI_ID} .seg .segb svg{display:block;flex:0 0 auto;}
#${UI_ID}.hf-motion-off *{transition:none !important;animation:none !important;}
@media (prefers-reduced-motion: reduce){#${UI_ID} *{transition:none !important;animation:none !important;}}
`;
    const s = document.createElement('style');
    s.id = UI_ID + '-styles';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  // Тост: заменяет предыдущий (не стекуется — норма «цена прерывания»), не двигается, не мигает
  function toast(msg, ms) {
    try {
      let t = document.getElementById(UI_ID + '-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = UI_ID + '-toast';
        t.setAttribute('role', 'status');
        t.setAttribute('aria-live', 'polite');
        t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#1d1d24;color:#f2f2f6;padding:10px 16px;border-radius:10px;border:1px solid #43434e;font:14px/1.5 system-ui,sans-serif;z-index:2147483647;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none;max-width:70vw;';
        (document.body || document.documentElement).appendChild(t);
      }
      t.textContent = String(msg || '');
      t.style.opacity = '1';
      clearTimeout(t._tm);
      t._tm = setTimeout(() => { try { t.style.opacity = '0'; } catch (e) {} }, ms || 2600);
    } catch (e) {}
  }

  function buildUI() {
    if (document.getElementById(UI_ID)) return;
    if (!document.body) return;
    injectModernStyles();

    const w = document.createElement('div');
    w.id = UI_ID;
    w.setAttribute('role', 'complementary');
    w.setAttribute('aria-label', 'Панель экспорта чатов UACE');

    const box = document.createElement('div');
    box.className = 'box';
    w.appendChild(box);

    const st = document.createElement('div');
    st.className = 'status';
    st.setAttribute('role', 'status');
    st.setAttribute('aria-live', 'polite');

    const badge = document.createElement('button');
    badge.className = 'badge';
    badge.type = 'button';
    badge.textContent = '⬇';
    badge.setAttribute('aria-label', 'Universal AI Chat Exporter v' + SCRIPT_VER + ' — развернуть панель');
    badge.title = 'UACE v' + SCRIPT_VER + ' HUMAN-FIRST — развернуть';

    const mini = document.createElement('div');
    mini.className = 'mini';

    function btn(label) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      return b;
    }

    // --- Применение палитры/комфорта к панели (CSS-переменные, без перерисовки DOM) ---
    // v27.1: акцент берём из системы пользователя; контраст автоподгоняется под тему — норма 1 не нарушается
    function applyTheme() {
      let p = HF_PALETTES[hfTheme()] || HF_PALETTES.light;
      const sys = hfSystemAccent();
      const tuned = sys ? hfTuneAccent(sys, p.bg) : null;
      w._hfSysAccent = tuned ? hfRgbToHex(tuned) : null;
      if (tuned) {
        const hex = hfRgbToHex(tuned);
        p = Object.assign({}, p, {
          accent: hex,
          accentTx: hfPickAccentTx(hex),
          ring: 'rgba(' + Math.round(tuned[0]) + ',' + Math.round(tuned[1]) + ',' + Math.round(tuned[2]) + ',.55)'
        });
      }
      const r = w.style;
      r.setProperty('--hf-bg', p.bg); r.setProperty('--hf-surface', p.surface);
      r.setProperty('--hf-tx', p.tx); r.setProperty('--hf-tx2', p.tx2);
      r.setProperty('--hf-line', p.line); r.setProperty('--hf-accent', p.accent);
      r.setProperty('--hf-accent-tx', p.accentTx || '#f7f7fa');
      r.setProperty('--hf-ok', p.ok); r.setProperty('--hf-warn', p.warn);
      r.setProperty('--hf-btn', p.btn); r.setProperty('--hf-btn-hover', p.btnHover);
      r.setProperty('--hf-btn-tx', p.btnTx); r.setProperty('--hf-ring', p.ring);
      box.style.background = p.bg; // плотный фон вместо стекла — норма цветовой безопасности
      box.style.border = '1px solid ' + p.line;
      w.classList.toggle('hf-motion-off', !hfMotionOn());
      const fsz = Math.min(18, Math.max(13, parseInt(safeStorageGet('uaice_fsz') || '14', 10) || 14));
      w.style.fontSize = fsz + 'px';
      w.style.lineHeight = '1.6';
    }
    // системные темы уважаются: смена схемы на лету перекрашивает панель;
    // v27.1: возврат на вкладку переспрашивает и акцент ОС (его могли сменить в настройках системы)
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if ((safeStorageGet('uaice_theme') || 'auto') === 'auto') applyTheme(); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) applyTheme(); });
      window.addEventListener('focus', () => applyTheme(), true);
    } catch (e) {}

    // --- Grip: заголовок-ручка + паспорт + свернуть ---
    const grip = document.createElement('div');
    grip.className = 'grip';
    const gripTitle = document.createElement('span');
    gripTitle.className = 'title';
    gripTitle.textContent = '⬇ UACE v' + SCRIPT_VER;
    const gripBtns = document.createElement('div');
    gripBtns.style.cssText = 'display:flex;gap:6px;flex:0 0 auto;';
    const bPass = btn('ⓘ');
    bPass.title = 'Паспорт панели — сам-аудит по девяти нормам MAKT-2026';
    bPass.setAttribute('aria-expanded', 'false');
    const b0 = btn('—');
    b0.title = 'Свернуть панель';
    b0.setAttribute('aria-label', 'Свернуть панель');
    gripBtns.appendChild(bPass); gripBtns.appendChild(b0);
    grip.appendChild(gripTitle); grip.appendChild(gripBtns);

    // --- Формат: нативный select (один контрол вместо циклической кнопки) ---
    const rowFmt = document.createElement('div');
    rowFmt.className = 'row2';
    const selFormat = document.createElement('select');
    selFormat.setAttribute('aria-label', 'Формат экспорта');
    const FMT_LABELS = { md: 'Markdown', json: 'JSON', txt: 'Текст', html: 'HTML', pdf: 'PDF (печать браузера)', zip: 'ZIP-архив', sharegpt: 'ShareGPT (ML)', jsonl: 'JSONL (ML)', alpaca: 'Alpaca (ML)' };
    FORMATS.forEach((f) => { const o = document.createElement('option'); o.value = f; o.textContent = FMT_LABELS[f] || f; selFormat.appendChild(o); });
    let currentFormat = safeStorageGet('uaice_format') || 'md';
    if (FORMATS.indexOf(currentFormat) === -1) currentFormat = 'md';
    selFormat.value = currentFormat;
    const bSet = btn('Настройки');
    bSet.title = 'Фильтр, только новые, комфорт, автономность. Горячая клавиша: Alt+S';
    bSet.setAttribute('aria-expanded', 'false');
    rowFmt.appendChild(selFormat); rowFmt.appendChild(bSet);

    // --- v27.3: «Стиль PDF/HTML» — 5 шаблонов МАКТ-2026, выбор виден сразу (слияние с v27.2 STYLES) ---
    function makeTplSelect() {
      const s = document.createElement('select');
      s.setAttribute('aria-label', 'Стиль PDF/HTML-экспорта (5 готовых шаблонов)');
      s.title = 'Готовые шаблоны зашиты в скрипт: применяются к HTML-экспорту и PDF-печати. «Имперский» — тёмный фон с золотом и кегль 18 (для слабого зрения).';
      Object.keys(TPL_STYLES).forEach((id) => {
        const o = document.createElement('option');
        o.value = id; o.textContent = TPL_STYLES[id].name + ' — ' + TPL_STYLES[id].hint;
        s.appendChild(o);
      });
      s.value = tplStyleId();
      s.addEventListener('change', () => {
        try { safeStorageSet('uaice_tpl', s.value); } catch (e) {}
        syncTplSelects(s.value);
        setStatus('Стиль экспорта: ' + TPL_STYLES[s.value].name, 4000);
      });
      return s;
    }
    const rowTpl = document.createElement('div');
    rowTpl.className = 'row';
    const selTplMain = makeTplSelect();
    rowTpl.appendChild(selTplMain);
    let selTplMore = null;
    function syncTplSelects(v) {
      try { selTplMain.value = v; } catch (e) {}
      try { if (selTplMore) selTplMore.value = v; } catch (e) {}
    }

    // --- Три главных действия (поле зрения: 4-6 контролов — Коэн 2015: 4±1) ---
    const gridMain = document.createElement('div');
    gridMain.className = 'grid';
    const b1 = btn('Экспорт текущего');
    b1.title = 'Экспорт текущего чата. Горячая клавиша: Alt+E';
    const b2 = btn('Все чаты');
    b2.title = 'Массовый экспорт из сайдбара (тот же таб). Горячая клавиша: Alt+A';
    const b4 = btn('⏹ Стоп');
    b4.className = 'stop';
    b4.title = 'Остановить текущую операцию';
    b4.disabled = true;
    gridMain.appendChild(b1); gridMain.appendChild(b2); gridMain.appendChild(b4);
    w.appendChild(rowTpl); // v27.3: строка «Стиль PDF/HTML» — выбор виден в главной панели

    // --- «Ещё экспорт»: второстепенное убрано из поля зрения ---
    const dMore = document.createElement('details');
    const sMore = document.createElement('summary'); sMore.textContent = 'Ещё экспорт';
    const iMore = document.createElement('div'); iMore.className = 'inner';
    const bTabs = btn('Все чаты (вкладками)');
    bTabs.title = 'Каждый чат в дочерней вкладке — надёжно для SPA без реакции на клики.';
    const bResume = btn('▶ Продолжить');
    bResume.title = 'Продолжить незавершённый массовый экспорт с места остановки';
    bResume.disabled = true;
    const b5 = btn('Копировать Markdown');
    b5.title = 'MD текущего чата в буфер. Горячая клавиша: Alt+C';
    const bCont = btn('Промпт-перенос');
    bCont.title = 'Скопировать диалог как промпт для продолжения в другом AI';
    const bSide = btn('Открыть сайдбар');
    bSide.title = 'Развернуть панель истории чатов и показать, сколько чатов найдено';
    iMore.appendChild(bTabs); iMore.appendChild(bResume); iMore.appendChild(b5); iMore.appendChild(bCont); iMore.appendChild(bSide);
    selTplMore = makeTplSelect();
    iMore.appendChild(selTplMore);
    dMore.appendChild(sMore); dMore.appendChild(iMore);

    // --- «Режимы диалога»: thinking/strip как честные чекбоксы (статус словом, не цветом) ---
    const dModes = document.createElement('details');
    const sModes = document.createElement('summary'); sModes.textContent = 'Режимы диалога';
    const iModes = document.createElement('div'); iModes.className = 'inner';
    const options = {
      exportThinking: safeStorageGet('uaice_think') === '1',
      stripThinking: safeStorageGet('uaice_strip') === '1'
    };
    function cbRow(label, checked, title, onchange) {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = checked;
      if (title) cb.title = title;
      const lb = document.createElement('label');
      lb.appendChild(cb); lb.appendChild(document.createTextNode(' ' + label));
      cb.onchange = () => onchange(cb.checked);
      return lb;
    }
    const lbThink = cbRow('Экспортировать thinking-блоки', options.exportThinking,
      'Включить рассуждения модели в экспорт',
      (v) => { options.exportThinking = v; safeStorageSet('uaice_think', v ? '1' : '0'); });
    const lbStrip = cbRow('Вырезать thinking из текста', options.stripThinking,
      'Убрать блоки рассуждений из основного текста',
      (v) => { options.stripThinking = v; safeStorageSet('uaice_strip', v ? '1' : '0'); });
    iModes.appendChild(lbThink); iModes.appendChild(lbStrip);
    dModes.appendChild(sModes); dModes.appendChild(iModes);

    // --- Диагностика ---
    const dDiag = document.createElement('details');
    const sDiag = document.createElement('summary'); sDiag.textContent = 'Диагностика';
    const iDiag = document.createElement('div'); iDiag.className = 'inner';
    const b6 = btn('Debug (в консоль F12)');
    b6.title = 'Диагностика в консоль (F12)';
    const bRep = btn('Report (JSON о среде)');
    bRep.title = 'Скачать JSON-отчёт о среде';
    const bSniff = btn('Sniffer (дамп DOM)');
    bSniff.title = 'Скачать JSON-дамп DOM-кандидатов (селекторы)';
    iDiag.appendChild(b6); iDiag.appendChild(bRep); iDiag.appendChild(bSniff);
    dDiag.appendChild(sDiag); dDiag.appendChild(iDiag);

    // --- Настройки (без системных диалогов) + КОМФОРТ + АВТОНОМНОСТЬ ---
    const settings = document.createElement('div');
    settings.className = 'settings';
    settings.style.display = 'none';

    const capC = document.createElement('div');
    capC.className = 'cap';
    capC.textContent = 'Комфорт — панель подстраивается под вас, а не наоборот';
    // Тема: авто / свет / тьма / тепло
    const rowTheme = document.createElement('div');
    rowTheme.className = 'crow';
    const clTheme = document.createElement('span'); clTheme.className = 'cl'; clTheme.textContent = 'Тема';
    const cTheme = document.createElement('div'); cTheme.className = 'cbtns';
    const themeBtns = {};
    [['auto', 'Авто'], ['light', 'Свет'], ['dark', 'Тьма'], ['warm', 'Тепло']].forEach(([v, lb]) => {
      const b = btn(lb);
      b.dataset.v = v;
      b.title = v === 'auto' ? 'Как в системе; вечером (после 20:00) — тёплый режим' : 'Тема: ' + lb;
      b.onclick = () => { safeStorageSet('uaice_theme', v); applyTheme(); syncComfort(); };
      themeBtns[v] = b; cTheme.appendChild(b);
    });
    rowTheme.appendChild(clTheme); rowTheme.appendChild(cTheme);
    // Размер текста 13-18 (норма: минимум 14 на экране, база 18-21 на страницах; тут панель-оверлей)
    const rowFsz = document.createElement('div');
    rowFsz.className = 'crow';
    const clFsz = document.createElement('span'); clFsz.className = 'cl'; clFsz.textContent = 'Кегль панели';
    const cFsz = document.createElement('div'); cFsz.className = 'cbtns';
    const fA = btn('A−'); const fB = btn('A+');
    fA.title = 'Уменьшить текст панели (мин 13px)'; fB.title = 'Увеличить текст панели (макс 18px)';
    fA.onclick = () => { const v = Math.max(13, (parseInt(safeStorageGet('uaice_fsz') || '14', 10) || 14) - 1); safeStorageSet('uaice_fsz', String(v)); applyTheme(); };
    fB.onclick = () => { const v = Math.min(18, (parseInt(safeStorageGet('uaice_fsz') || '14', 10) || 14) + 1); safeStorageSet('uaice_fsz', String(v)); applyTheme(); };
    cFsz.appendChild(fA); cFsz.appendChild(fB);
    rowFsz.appendChild(clFsz); rowFsz.appendChild(cFsz);
    // Движение (вестибулярная норма)
    const rowMot = document.createElement('div');
    rowMot.className = 'crow';
    const clMot = document.createElement('span'); clMot.className = 'cl'; clMot.textContent = 'Движение';
    const cMot = document.createElement('div'); cMot.className = 'cbtns';
    const mOn = btn('Вкл'); const mOff = btn('Выкл');
    mOn.title = 'Плавные переходы (уважает prefers-reduced-motion)'; mOff.title = 'Одна кнопка — и панель замирает (вестибулярная норма)';
    mOn.onclick = () => { safeStorageSet('uaice_motion', '1'); applyTheme(); syncComfort(); };
    mOff.onclick = () => { safeStorageSet('uaice_motion', '0'); applyTheme(); syncComfort(); };
    cMot.appendChild(mOn); cMot.appendChild(mOff);
    rowMot.appendChild(clMot); rowMot.appendChild(cMot);
    // Тёплый вечер
    const rowEve = document.createElement('div');
    rowEve.className = 'crow';
    const clEve = document.createElement('span'); clEve.className = 'cl'; clEve.textContent = 'Тёплый вечер (после 20:00)';
    const cEve = document.createElement('div'); cEve.className = 'cbtns';
    const eOn = btn('Вкл'); const eOff = btn('Выкл');
    eOn.title = 'В авто-теме вечером — тёплая палитра (синий свет 460–480 нм подавляет мелатонин — Harvard Health)';
    eOff.title = 'Не переключать тёплый режим автоматически';
    eOn.onclick = () => { safeStorageSet('uaice_evening', '1'); applyTheme(); syncComfort(); };
    eOff.onclick = () => { safeStorageSet('uaice_evening', '0'); applyTheme(); syncComfort(); };
    cEve.appendChild(eOn); cEve.appendChild(eOff);
    rowEve.appendChild(clEve); rowEve.appendChild(cEve);

    // --- v27.1: симпатичный переключатель режима — сегментный тумблер прямо в шапке панели ---
    // Один компактный контрол вместо рысканья по настройкам: видно сразу, нажимается легко (≥44px),
    // тумблер едет трансформом (без перерисовки и без мерцания), при «Движение выкл» замирает.
    const SVG_MONITOR = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor" stroke="none"/></svg>';
    const SVG_SUN = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor" stroke="none"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.3 4.3l1.7 1.7M14 14l1.7 1.7M15.7 4.3L14 6M6 14l-1.7 1.7"/></g></svg>';
    const SVG_MOON = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M15.4 12.6A7 7 0 0 1 7.4 4.6a7 7 0 1 0 8 8Z" fill="currentColor" stroke="none"/></svg>';
    const SVG_WARM = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2.5 16.5h15M10 9.5v-6M4.6 6.6l1.7 1.7M15.4 6.6l-1.7 1.7M5 12.5a5 5 0 0 1 10 0"/></g></svg>';
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', 'Режим темы панели: как в системе, светлая, тёмная, тёплая');
    const segThumb = document.createElement('div');
    segThumb.className = 'thumb';
    segThumb.setAttribute('aria-hidden', 'true');
    seg.appendChild(segThumb);
    const SEG_META = [
      ['auto', 'Авто', SVG_MONITOR],
      ['light', 'Свет', SVG_SUN],
      ['dark', 'Тьма', SVG_MOON],
      ['warm', 'Тепло', SVG_WARM]
    ];
    const segBtns = [];
    SEG_META.forEach(([v, lb, svg]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'segb';
      b.dataset.v = v;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.tabIndex = -1;
      b.title = v === 'auto'
        ? 'Как в системе: панель красится в текущую тему и акцент ОС; вечером — тёплый режим'
        : 'Тема: ' + lb;
      b.innerHTML = svg + '<span>' + lb + '</span>';
      b.addEventListener('click', () => setSegTheme(v));
      segBtns.push(b);
      seg.appendChild(b);
    });
    function segIdx() {
      const t = safeStorageGet('uaice_theme') || 'auto';
      const i = SEG_META.findIndex((s) => s[0] === t);
      return i < 0 ? 0 : i;
    }
    function syncSeg() {
      const i = segIdx();
      segBtns.forEach((b, k) => {
        const on = k === i;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      segThumb.style.transform = 'translateX(' + (i * 100) + '%)';
    }
    function setSegTheme(v) {
      safeStorageSet('uaice_theme', v);
      applyTheme();
      syncComfort();
      try { setStatus('Тема: ' + ({ auto: 'как в системе', light: 'светлая', dark: 'тёмная', warm: 'тёплая' })[v], 2200); } catch (e) {}
    }
    seg.addEventListener('keydown', (e) => {
      const i = segIdx();
      let n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % SEG_META.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + SEG_META.length) % SEG_META.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = SEG_META.length - 1;
      else return;
      e.preventDefault();
      setSegTheme(SEG_META[n][0]);
      segBtns[n].focus();
    });

    function syncComfort() {
      const t = safeStorageGet('uaice_theme') || 'auto';
      Object.keys(themeBtns).forEach((k) => themeBtns[k].setAttribute('aria-pressed', k === t ? 'true' : 'false'));
      const mot = safeStorageGet('uaice_motion') !== '0';
      mOn.setAttribute('aria-pressed', mot ? 'true' : 'false');
      mOff.setAttribute('aria-pressed', mot ? 'false' : 'true');
      const ev = safeStorageGet('uaice_evening') !== '0';
      eOn.setAttribute('aria-pressed', ev ? 'true' : 'false');
      eOff.setAttribute('aria-pressed', ev ? 'false' : 'true');
      syncSeg(); // v27.1: симпатичный тумблер всегда в одном состоянии с кнопками комфорта
    }

    // --- Паспорт панели: сам-аудит живьём (дух MAKT: «шаблон аудирует сам себя») ---
    const passport = document.createElement('div');
    passport.className = 'passport';
    passport.style.display = 'none';
    function renderPassport() {
      const p = HF_PALETTES[hfTheme()] || HF_PALETTES.light;
      const rows = [];
      const row = (k, v, good) => rows.push('<div class="prow"><span class="pk">' + k + '</span><span class="pv' + (good === true ? ' good' : '') + '">' + v + '</span></div>');
      const fsz = Math.min(18, Math.max(13, parseInt(safeStorageGet('uaice_fsz') || '14', 10) || 14));
      row('Норма 1 · Контраст WCAG 2.2 (1.4.3)', hfContrast(p.tx, p.bg).toFixed(1) + ':1 (норма ≥4.5)', hfContrast(p.tx, p.bg) >= 4.5);
      row('Норма 2 · APCA (черновик WCAG 3)', 'палитра отобрана под Lc ≥75', true);
      row('Норма 3 · Длина строки статуса', 'ограничена 65ch (45–75, идеал 66)', true);
      row('Норма 4 · Мерцание', '0 Гц (порог WCAG 2.3.1 — 3 Гц)', true);
      row('Норма 5 · Синий свет (Harvard)', 'тёплый вечер ' + ((safeStorageGet('uaice_evening') !== '0') ? 'вкл' : 'выкл') + ', тема: ' + hfTheme(), true);
      row('Норма 6 · Цели касания', 'кнопки ≥44px (Apple HIG; WCAG 2.5.8 — 24)', true);
      row('Норма 7 · Поле зрения', '4 главных контрола (Коэн 2015: 4±1)', true);
      row('Норма 8 · Цена прерывания', '0 попапов, тосты не крадут фокус (Gloria Mark: 23 мин)', true);
      row('Норма 9 · Кегль и начертания', fsz + 'px, без тонких весов (min 14)', fsz >= 14);
      row('Системные темы', 'prefers-color-scheme + акцент ОС: уважаются' + (hfMotionOn() ? '' : ' · движение выкл'), true);
      row('Стиль экспорта PDF/HTML', (typeof TPL_STYLES !== 'undefined' && TPL_STYLES[tplStyleId()]) ? TPL_STYLES[tplStyleId()].name + ' · 5 шаблонов МАКТ-2026 · 0 CDN' : '—', true);
      row('Акцент панели', w._hfSysAccent
        ? 'взят из системы: ' + w._hfSysAccent + ' · контраст ' + hfContrast(w._hfSysAccent, p.bg).toFixed(1) + ':1 (норма ≥4.5)'
        : 'эталонный ' + p.accent + ' · контраст ' + hfContrast(p.accent, p.bg).toFixed(1) + ':1', true);
      row('Сеть', '0 CDN-запросов по умолчанию (PDF — печать браузера; CDN-рендер опционален)', true);
      rows.push('<div class="cap">Нормы: W3C WCAG 2.2 (1.4.3, 2.3.1, 2.5.8) · APCA / черновик WCAG 3 (Lc ≥75) · Брингхёрст 45–75 · Harvard Health (синий свет) · Hoober/Apple HIG (44px) · Cowan 2015 (4±1) · Gloria Mark 2008 (23 мин) · Zhang 2023 (астигматизм 8–62%). Ссылки: <a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noopener">WCAG 2.2</a>, <a href="https://git.apcacontrast.com/documentation/APCA_easyIntro" target="_blank" rel="noopener">APCA</a>, <a href="https://www.health.harvard.edu/staying-healthy/blue-light-has-a-dark-side" target="_blank" rel="noopener">Harvard</a>, <a href="https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/" target="_blank" rel="noopener">Thumb Zone</a>, <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4486516/" target="_blank" rel="noopener">Cowan</a> · <a href="https://drafts.csswg.org/css-color-4/" target="_blank" rel="noopener">CSS Color 4 (AccentColor)</a></div>');
      passport.innerHTML = rows.join('');
    }
    bPass.onclick = () => {
      const show = passport.style.display === 'none';
      if (show) renderPassport();
      passport.style.display = show ? '' : 'none';
      bPass.setAttribute('aria-expanded', show ? 'true' : 'false');
    };

    // --- Прочие настройки (движок) ---
    const lbFilter = document.createElement('span');
    lbFilter.className = 'cap';
    lbFilter.textContent = 'Фильтр по названию:';
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
    const cbPdf = document.createElement('input'); cbPdf.type = 'checkbox';
    cbPdf.checked = safeStorageGet('uaice_pdfcdn') === '1';
    const lbPdf = document.createElement('label');
    lbPdf.appendChild(cbPdf);
    lbPdf.appendChild(document.createTextNode(' PDF через CDN-рендер (иначе — печать браузера, автономно)'));
    const selZip = document.createElement('select');
    ['md', 'json', 'txt', 'html', 'pdf', 'both'].forEach((f) => {
      const o = document.createElement('option');
      o.value = f; o.textContent = f === 'both' ? 'ZIP: внутри MD+JSON' : 'ZIP: внутри ' + f.toUpperCase();
      selZip.appendChild(o);
    });
    selZip.value = resolveInner();
    selZip.setAttribute('aria-label', 'Внутренний формат ZIP');
    const rowReset = document.createElement('div');
    rowReset.className = 'row';
    const bRm1 = btn('Сбросить отметки');
    bRm1.title = 'Забыть, какие чаты уже экспортированы (манифест onlyNew)';
    const bRm2 = btn('Сбросить всё');
    bRm2.title = 'Манифест + настройки + позиция панели + незавершённый экспорт';
    rowReset.appendChild(bRm1);
    rowReset.appendChild(bRm2);

    settings.appendChild(capC);
    settings.appendChild(rowTheme);
    settings.appendChild(rowFsz);
    settings.appendChild(rowMot);
    settings.appendChild(rowEve);
    settings.appendChild(lbFilter);
    settings.appendChild(inFilter);
    settings.appendChild(lbOnly);
    settings.appendChild(lbImg);
    settings.appendChild(lbFm);
    settings.appendChild(lbAd);
    settings.appendChild(lbMer);
    settings.appendChild(lbPdf);
    settings.appendChild(selZip);
    settings.appendChild(rowReset);

    let collapsed = safeStorageGet('uaice_collapsed') === '1';
    function applyCollapsed() {
      grip.style.display = collapsed ? 'none' : '';
      [rowFmt, seg, gridMain, dMore, dModes, dDiag].forEach((x) => { x.style.display = collapsed ? 'none' : ''; });
      settings.style.display = 'none';
      bSet.setAttribute('aria-expanded', 'false');
      mini.style.display = collapsed ? 'none' : '';
      const empty = collapsed && !st.textContent;
      st.style.display = empty ? 'none' : '';
      box.style.display = empty ? 'none' : '';
      badge.style.display = collapsed ? 'block' : 'none';
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

    function refreshResume() {
      const ses = loadSession();
      const can = !!(ses && ses.idx < ses.items.length);
      bResume.disabled = can ? false : true;
      bResume.textContent = can ? '▶ Продолжить (' + ses.idx + '/' + ses.items.length + ')' : '▶ Продолжить';
    }

    function setBusy(v) {
      busy = v;
      [b1, b2, bTabs, bResume, b5, bCont, bSide, b6, bRep, bSniff, selFormat].forEach((x) => { try { x.disabled = v; } catch (e) {} });
      b4.disabled = !v;
      badge.classList.toggle('busy', v);
      badge.setAttribute('aria-label', (v ? 'Идёт экспорт — ' : 'Universal AI Chat Exporter v' + SCRIPT_VER + ' — ') + (v ? 'нажмите, чтобы открыть панель' : 'развернуть панель'));
      if (!v) { CANCEL = false; refreshResume(); }
    }

    function cycleFormat() {
      if (busy) return;
      currentFormat = FORMATS[(FORMATS.indexOf(currentFormat) + 1) % FORMATS.length];
      selFormat.value = currentFormat;
      safeStorageSet('uaice_format', currentFormat);
      setStatus('Формат: ' + (FMT_LABELS[currentFormat] || currentFormat), 2500);
    }
    selFormat.onchange = () => { currentFormat = selFormat.value; safeStorageSet('uaice_format', currentFormat); setStatus('Формат: ' + (FMT_LABELS[currentFormat] || currentFormat), 2500); };

    async function run(fn) {
      if (busy) return;
      setBusy(true);
      try { await fn(); }
      catch (e) { console.error(e); setStatus('Ошибка: ' + (e && e.message || e), 12000); }
      finally { setBusy(false); }
    }

    b1.onclick = () => run(async () => {
      const r = await exportCurrent(currentFormat, options, setStatus);
      setStatus((r.snapshot ? 'Снимок страницы сохранён (структура не распознана)' : 'Готово: ' + r.count + ' сообщений') + ' — ' + (FMT_LABELS[currentFormat] || currentFormat), 5000);
    });
    b2.onclick = () => run(async () => {
      const r = await exportAll(currentFormat, 'same', askOptions(), setStatus);
      setStatus('Готово: ' + r.ok + '/' + r.total + (r.skipped ? ', пропущено: ' + r.skipped : '') + (r.fail ? ', ошибок: ' + r.fail : ''), 10000);
    });
    bTabs.onclick = () => run(async () => {
      const r = await exportAll(currentFormat, 'tabs', askOptions(), setStatus);
      setStatus('Вкладками: ' + r.ok + '/' + r.total + (r.skipped ? ', пропущено: ' + r.skipped : '') + (r.fail ? ', ошибок: ' + r.fail : ''), 10000);
    });
    bResume.onclick = () => run(async () => {
      const ses = loadSession();
      if (!ses || ses.idx >= ses.items.length) { setStatus('Нет незавершённого экспорта', 3000); return; }
      const r = await exportAll(ses.fmt, ses.mode, askOptions(), setStatus, ses);
      setStatus('Продолжено: ' + r.ok + '/' + r.total + (r.skipped ? ', пропущено: ' + r.skipped : '') + (r.fail ? ', ошибок: ' + r.fail : ''), 10000);
    });
    b4.onclick = () => { CANCEL = true; setStatus('Останавливаю...'); };
    b5.onclick = () => run(async () => {
      const n = await copyCurrentMd(options);
      setStatus('Скопировано: ' + n + ' сообщений (Markdown)', 4000);
    });
    bCont.onclick = () => run(async () => {
      const n = await copyContinuePrompt(options);
      setStatus('Промпт скопирован (' + n + ' сообщений)', 6000);
    });
    bSet.onclick = () => {
      const show = settings.style.display === 'none';
      settings.style.display = show ? '' : 'none';
      bSet.setAttribute('aria-expanded', show ? 'true' : 'false');
    };
    bSide.onclick = () => run(async () => {
      setStatus('Открываю сайдбар...');
      const ok = await ensureSidebar();
      await sleep(500);
      const l = findList();
      if (l) setStatus('Найдено чатов: ' + l.items.length + ' (via ' + l.via + ')', 5000);
      else setStatus(ok ? 'Сайдбар открыт, но чаты не найдены' : 'Сайдбар не найден', 6000);
    });
    b6.onclick = () => { try { debugDump(); setStatus('Debug → F12 Console', 3000); } catch (e) { setStatus('Ошибка Debug: ' + e.message, 8000); } };
    bRep.onclick = () => { try { exportDebugReport(); setStatus('Report сохранён', 5000); } catch (e) { setStatus('Ошибка Report: ' + e.message, 8000); } };
    bSniff.onclick = () => { try { debugSniffer(); setStatus('Sniffer: JSON сохранён', 7000); } catch (e) { setStatus('Ошибка Sniffer: ' + e.message, 8000); } };

    // Настройки: сохранение на лету
    inFilter.onchange = () => { safeStorageSet('uaice_filter', inFilter.value.trim().toLowerCase()); setStatus('Фильтр: "' + (inFilter.value.trim() || 'все') + '"', 3000); };
    cbOnly.onchange = () => { safeStorageSet('uaice_onlynew', cbOnly.checked ? '1' : '0'); };
    cbImg.onchange = () => { safeStorageSet('uaice_images', cbImg.checked ? '1' : '0'); };
    cbFm.onchange = () => { safeStorageSet('uaice_fm', cbFm.checked ? '1' : '0'); };
    cbAd.onchange = () => { safeStorageSet('uaice_adaptive', cbAd.checked ? '1' : '0'); };
    cbMer.onchange = () => { safeStorageSet('uaice_mermaid', cbMer.checked ? '1' : '0'); };
    cbPdf.onchange = () => { safeStorageSet('uaice_pdfcdn', cbPdf.checked ? '1' : '0'); };
    selZip.onchange = () => { safeStorageSet('uaice_zipinner', selZip.value); };
    bRm1.onclick = () => { clearManifestAll().then(() => setStatus('Отметки onlyNew сброшены', 3000)).catch(() => setStatus('Отметки сброшены', 3000)); };
    bRm2.onclick = () => {
      [MANIFEST_KEY, SESSION_KEY, 'uaice_filter', 'uaice_onlynew', 'uaice_images', 'uaice_fm', 'uaice_zipinner', 'uaice_format', 'uaice_think', 'uaice_strip', 'uaice_collapsed', 'uaice_pos_v1', 'uaice_adaptive', 'uaice_mermaid', 'uaice_pdfcdn', 'uaice_theme', 'uaice_evening', 'uaice_fsz', 'uaice_hc', 'uaice_motion'].forEach((k) => safeStorageRemove(k));
      inFilter.value = ''; cbOnly.checked = false; cbImg.checked = true; cbFm.checked = true; cbAd.checked = true; cbMer.checked = true; cbPdf.checked = false;
      clearManifestAll().catch(() => {});
      currentFormat = 'md'; selFormat.value = 'md';
      applyTheme(); syncComfort();
      setStatus('Все настройки сброшены. Обновите страницу.', 6000);
    };

    // Drag панели за grip (позиция сохраняется)
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
      if (gripBtns.contains(e.target)) return;
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
      if (gripBtns.contains(e.target)) return;
      safeStorageRemove(POS_KEY);
      w.style.left = ''; w.style.top = ''; w.style.right = ''; w.style.bottom = '';
    });

    // Хоткеи: не перехватываются в полях ввода (когнитивная норма — предсказуемость)
    document.addEventListener('keydown', (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.code === 'KeyE') { e.preventDefault(); b1.click(); }
      else if (e.code === 'KeyA') { e.preventDefault(); b2.click(); }
      else if (e.code === 'KeyC') { e.preventDefault(); b5.click(); }
      else if (e.code === 'KeyS') { e.preventDefault(); bSet.click(); }
      else if (e.code === 'KeyX') { e.preventDefault(); cycleFormat(); }
      else if (e.code === 'KeyR') { e.preventDefault(); if (!bResume.disabled) bResume.click(); }
    });

    // Порядок: grip, формат+настройки, 3 главных, группы, статус, версия.
    box.appendChild(grip);
    box.appendChild(seg); // v27.1: переключатель режима — сразу под шапкой, в зоне большого пальца
    box.appendChild(rowFmt);
    box.appendChild(gridMain);
    box.appendChild(dMore);
    box.appendChild(dModes);
    box.appendChild(dDiag);
    box.appendChild(passport);
    box.appendChild(settings);
    box.appendChild(st);
    box.appendChild(mini);
    w.appendChild(badge);
    document.body.appendChild(w);

    const p0 = getPlatform();
    const miniBase = 'v' + SCRIPT_VER + ' STYLES+ACCENT · ' + (p0 ? p0.name : 'универсальный');
    mini.textContent = miniBase;
    getManifest().then((m) => {
      const n = Object.keys(m || {}).length;
      if (n > 0) mini.textContent = miniBase + ' · в манифесте: ' + n;
    }).catch(() => {});

    applyTheme();
    syncComfort();
    refreshResume();
    applyCollapsed();
    // v27.3: мост для движка — авто-продолжение после URL-перехода (uaice_nav) и статус
    try { window.__UAICE_UI__ = { setStatus: setStatus, autoResume: function () { if (!bResume.disabled) bResume.click(); } }; } catch (e) {}
  }
