/* --- v28.3.0: СПРАВКА — инструкция по эксплуатации (кнопка «?» слева от «ⓘ Паспорт») --- */
  const helpBox = document.createElement('div'); helpBox.className = 'passport help'; helpBox.style.display = 'none';
  function fillHelp() {
    if (helpBox.getAttribute('data-filled') === '1') return;
    const rows = [
      ['Alt+E', 'Экспорт текущего чата в выбранном формате'],
      ['Alt+A', 'Экспорт всех чатов сайдбара'],
      ['Alt+C', 'Скопировать Markdown в буфер обмена'],
      ['Alt+S', 'Настройки панели: показать/скрыть'],
      ['Alt+X', 'Цикл формата экспорта'],
      ['Alt+R', 'Продолжить прерванный экспорт'],
      ['Alt+Shift+E', 'PML-разведка каркаса страницы'],
      ['Alt+Shift+D', 'PML-наблюдение 60 с (Esc — стоп)'],
      ['Alt+Shift+C', 'PML-копия struct (JSON-канал)'],
      ['Alt+Shift+S', 'PML-стоп (наблюдение/разведка)'],
      ['Alt+Shift+X', 'Цикл вкладок PML: Разведка/Действия/Журнал'],
      ['Alt+Shift+I', 'Паспорт PML']
    ];
    let h = '';
    h += '<h3>1 · Что это</h3><p>Единая панель UACE × PML: экспорт диалогов ИИ (36+ платформ, 9 форматов) + разведка каркаса страницы (PML-STRUCT r1+r2). Всё локально: 0 внешних запросов, текст страницы читается только по кнопке экспорта или разведки.</p>';
    h += '<h3>2 · Быстрый старт</h3><p>1) Выберите формат и стиль. 2) «Экспорт текущего» — файл уйдёт в загрузки. 3) PDF: откроется диалог печати — выберите «Сохранить как PDF». Если печать заблокирована, панель сама сохранит стилизованный .print.html: откройте его → Ctrl+P → «Сохранить как PDF».</p>';
    h += '<h3>3 · Темы</h3><p>Тьма · Свет · ТЕПЛО (кремовый фон #f6efe2, охра-акцент #8a5a00 — для вечера и слабого зрения) · Авто (днём — системная схема; с 20:00 до 06:59 — тёплая; отключается тумблером «Тёплый вечер» в Настройках). Выбор запоминается. Кнопки тем — прямо под заголовком панели.</p>';
    h += '<h3>4 · Стили экспорта PDF/HTML (5)</h3><p>Селект под форматом: <b>Имперский</b> (тёмный фон + золото #d4af37, кегль 18 — по умолчанию), МАКТ Светлый, Швейцарская сетка, Нео-брутализм, Сепия Вечер. Стиль применяется к PDF-печати, HTML-файлам, ZIP и .print.html. Контраст каждого ≥4.5:1. В диалоге печати включите «Фоновая графика», чтобы сохранились фон и золото.</p>';
    h += '<h3>5 · Кнопки и хоткеи</h3>';
    h += rows.map(r => '<div class="hrow"><span class="hk">' + r[0] + '</span><span>' + r[1] + '</span></div>').join('');
    h += '<p class="cap2">Хоткеи не срабатывают в полях ввода. Канон §13 соблюдён: новых клавиш нет — новые действия только кнопками. Подсказка по любой кнопке: наведите курсор (или Tab-фокус).</p>';
    h += '<h3>6 · PML-разведка</h3><p>«Разведка» строит каркас страницы (блоки, скролл-контейнеры, якоря, мутации) без чтения текстов; «Наблюдение 60 с» следит за динамикой (Esc — стоп); «Копировать struct» — JSON-канал для второй панели. Резервный скоринг консервативен: «не уверен» = «нет данных», 0 угадываний.</p>';
    h += '<h3>7 · Приватность</h3><p>0 внешних запросов по умолчанию. CDN-рендер PDF (html2pdf) выключен и включается только явной галкой в Настройках. Файлы создаются Blob-загрузкой в браузере и никуда не отправляются.</p>';
    h += '<h3>8 · Если что-то не так</h3><p>• Панель не появилась (gemini/Trusted Types) — обновите скрипт до v' + SCRIPT_VER + '; панель самовосстанавливается ≤2 с (watchdog).<br>• PDF пустой или без стилей — в окне печати включите «Фоновая графика»; либо сохраните HTML в выбранном стиле и распечатайте его.<br>• Снесло настройки — «Настройки → Сбросить всё».<br>• Кнопка ТЕПЛО: если темы не видно — обновите скрипт; в v' + SCRIPT_VER + ' строка тем вынесена из «Настроек» наверх.</p>';
    h += '<div class="cap2">UACE v' + UACE_VER + ' × PML v' + UPOLY_VER + ' · сборка v' + SCRIPT_VER + ' · PML-PANEL 1.0 (§1–17) · PML-STRUCT r2</div>';
    setHTML(helpBox, h);
    const closer = document.createElement('button');
    closer.type = 'button';
    closer.textContent = '× Закрыть справку';
    closer.onclick = () => toggleHelp(false);
    helpBox.appendChild(closer);
    helpBox.setAttribute('data-filled', '1');
  }
  function toggleHelp(force) {
    const show = (force !== undefined) ? !!force : (helpBox.style.display === 'none');
    if (show) fillHelp();
    helpBox.style.display = show ? '' : 'none';
    bHelp.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) {
      passport.style.display = 'none';
      bPass.setAttribute('aria-expanded', 'false');
      /* v28.3.0: панель прокручивается к справке — она открывается ВИДИМОЙ */
      try { helpBox.scrollIntoView({ block: 'start' }); } catch (e) {}
    }
  }
  bHelp.onclick = () => toggleHelp();

  /* --- v28.3.0: всплывающие подсказки при наведении курсора / Tab-фокусе --- */
  const tipEl = document.createElement('div');
  tipEl.id = UI_ID + '-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.setAttribute('aria-hidden', 'true');
  let tipTimer = 0;
  function showTipFor(el) {
    const t = el && el.getAttribute && el.getAttribute('data-tip');
    if (!t) return;
    tipEl.textContent = t;
    tipEl.classList.add('on');
    const vw = window.innerWidth || 1920, vh = window.innerHeight || 1080;
    const tw = Math.min(280, vw - 16);
    tipEl.style.maxWidth = tw + 'px';
    tipEl.style.left = '0px'; tipEl.style.top = '0px';
    const r = el.getBoundingClientRect();
    let left = r.left + r.width / 2 - tw / 2;
    if (left < 8) left = 8;
    if (left + tw > vw - 8) left = vw - 8 - tw;
    let top = r.bottom + 8;
    const th = tipEl.offsetHeight || 40;
    if (top + th > vh - 8) top = r.top - th - 8;
    if (top < 8) top = 8;
    tipEl.style.left = Math.round(left) + 'px';
    tipEl.style.top = Math.round(top) + 'px';
  }
  function hideTip() { clearTimeout(tipTimer); tipEl.classList.remove('on'); }
  function bindTip(el) {
    if (!el || el.__tipBound) return;
    el.__tipBound = true;
    const t = el.getAttribute('title');
    if (t && !el.getAttribute('data-tip')) el.setAttribute('data-tip', t);
    el.removeAttribute('title');
    if (!el.getAttribute('data-tip')) return;
    el.addEventListener('mouseenter', () => { clearTimeout(tipTimer); tipTimer = setTimeout(() => showTipFor(el), 320); });
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('mousedown', hideTip);
    el.addEventListener('focus', () => showTipFor(el));
    el.addEventListener('blur', hideTip);
  }
  const TIPS = [
    [badge, 'UACE × PML v' + SCRIPT_VER + ' — свернуть/развернуть панель'],
    [bHelp, 'СПРАВКА: инструкция по эксплуатации — старт, темы, стили PDF, хоткеи, приватность'],
    [bPass, 'Паспорт панели: сам-аудит контраста/целей + стиль экспорта'],
    [b0, 'Свернуть панель в бейдж UP'],
    [selFormat, 'Формат экспорта текущего чата (Alt+X — цикл)'],
    [selTpl, 'СТИЛЬ PDF/HTML: Имперский (тёмный + золото), МАКТ Светлый, Швейцарская сетка, Нео-брутализм, Сепия Вечер. Применяется к PDF, HTML и ZIP'],
    [bSet, 'Настройки: фильтр, комфорт, автономность (Alt+S)'],
    [b1, 'Экспорт текущего чата в выбранном формате (Alt+E)'],
    [b2, 'Обойти все чаты сайдбара и экспортировать (Alt+A)'],
    [b4, 'Остановить пакетный экспорт'],
    [bTabs, 'Все чаты — отдельными вкладками браузера'],
    [bResume, 'Продолжить прерванный экспорт (Alt+R)'],
    [b5, 'Скопировать весь чат как Markdown в буфер (Alt+C)'],
    [bCont, 'Скопировать промпт-перенос для продолжения чата'],
    [bSide, 'Развернуть и просканировать сайдбар с чатами'],
    [themeBtns.auto, 'Тема АВТО: днём — системная схема; вечером (20:00–06:59) — тёплая'],
    [themeBtns.light, 'Тема СВЕТ: белый фон, тёмный текст'],
    [themeBtns.dark, 'Тема ТЬМА: тёмный фон, светлый текст'],
    [themeBtns.warm, 'Тема ТЕПЛО: кремовый фон #f6efe2, охра-акцент — вечерний режим, забота о глазах'],
    [fA, 'Кегль панели меньше (минимум 13px)'],
    [fB, 'Кегль панели больше (максимум 18px)'],
    [mOn, 'Включить анимации панели'],
    [mOff, 'Выключить анимации (и уважать prefers-reduced-motion)'],
    [eOn, '«Авто» тёплая с 20:00 до 06:59'],
    [eOff, '«Авто» всегда по системной схеме, без вечернего сдвига'],
    [bPmlRecon, 'PML-разведка: каркас страницы (блоки/скролл/якоря), без чтения текстов (Alt+Shift+E)'],
    [bPmlObs, 'PML-наблюдение 60 с: мутации, рециклы, поток (Esc — стоп) (Alt+Shift+D)'],
    [bPmlCopyStruct, 'Скопировать struct-JSON последней разведки (Alt+Shift+C)'],
    [bPmlStop, 'PML-стоп: прервать наблюдение/разведку (Alt+Shift+S)'],
    [bPmlCopyJournal, 'Скопировать журнал PML (последние события)'],
    [bPmlCycleTabs, 'Цикл вкладок PML: Разведка → Действия → Журнал (Alt+Shift+X)'],
    [bPmlPassport, 'Паспорт PML: канон §15, палитра, акцент, счётчики (Alt+Shift+I)'],
    [b6, 'Отладочный дамп в консоль DevTools (F12)'],
    [bRep, 'Сохранить debug-отчёт JSON-файлом'],
    [bSniff, 'DOM-сниффер: снимок селекторов для отладки детекции'],
    [sMore, 'Дополнительные каналы экспорта: вкладками, продолжение, буфер'],
    [sPml, 'PML-разведка: вкладки Разведка/Действия/Журнал'],
    [sModes, 'Режимы: thinking-блоки в экспорте'],
    [sDiag, 'Диагностика: debug, отчёт, сниффер'],
    [selZip, 'Что класть внутрь ZIP: формат файлов'],
    [bRm1, 'Сбросить отметки «только новые» в манифесте'],
    [bRm2, 'Сбросить ВСЕ настройки и манифест (включая тему и стиль)']
  ];
  TIPS.forEach(p => { if (p[0]) { p[0].setAttribute('data-tip', p[1]); bindTip(p[0]); } });
  try { box.querySelectorAll('button, select, summary, input[type="checkbox"], label').forEach(bindTip); } catch (e) {}
  try { box.addEventListener('scroll', hideTip, { passive: true }); } catch (e) {}
  try { window.addEventListener('scroll', hideTip, { passive: true }); } catch (e) {}

