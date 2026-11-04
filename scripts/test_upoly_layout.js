// Layout-тест UPOLY v1.0.1-sk в headless Chromium — проверка «сдвига панели» при открытом Паспорте
// и битого селектора [hidden]. Воспроизводит состояние владельца: 811x599, журнал 13 записей,
// вкладка Журнал, Комфорт открыт, Паспорт открыт, кегль 15px.
'use strict';
const fs = require('fs');
const { chromium } = require('playwright');

const src = fs.readFileSync('/home/z/my-project/upload/UPOLY-v1.0.1-sk.user.js', 'utf8');
const css = src.match(/const CSS = `([\s\S]*?)`;/)[1];
const html = src.match(/wrap\.innerHTML = `([\s\S]*?)`;/)[1];

const FIX_CSS = '.pml-body{flex:1 1 0;min-height:10vh}.pml-ftr{flex:0 1 auto;min-height:0;overflow:auto;max-height:40vh}.pml-kv{max-height:16vh;overflow:auto}.pml-badge[hidden],.pml-box[hidden]{display:none}';

const JOURNAL = ['действие: Cannot read properties of undefined (reading \'path\')', 'наблюдение завершено: adds 2, recycles 1, поток нет',
  'struct скопирован (JSON)', 'окно наблюдения 60 с (Esc — стоп)', 'действие: Cannot read properties of undefined (reading \'path\')',
  'подключён через mount(config): UACE v27.4.1', 'Alt+i занят (паспорт), действие кнопкой', 'Alt+x занят (цикл вкладок), действие кнопкой',
  'Alt+c занят (копировать struct), действие кнопкой', 'Alt+e занят (разведка), действие кнопкой', 'соль FNV-1a: PMLSTRUCT',
  'панель создана', 'монтирован UPOLY v1.0'];

const PASSPORT = ['Скрипт: UPOLY v1.0', 'Панель: PML-PANEL 1.0', 'Тема: system (dark)', 'Акцент: #4da3ff (default) · 0:1',
  'Движение: вкл · кегль 15px', 'Разведка: прогонов 2, наблюдений 1, struct копировался', 'Uptime: 1401 с · записей в журнале: 13',
  'Хоткеи: Alt+E разведка · Alt+D наблюдение 60 с · Alt+C копировать struct · Alt+S стоп · Alt+X цикл вкладок · Alt+I паспорт',
  'Соль FNV-1a: PMLSTRUCT · контракт: PML-STRUCT r1+r2'].join('\n');

async function measure(browser, extraCss, label) {
  const page = await browser.newPage({ viewport: { width: 811, height: 599 } });
  await page.setContent('<!doctype html><html><body><main style="height:2000px">страница</main></body></html>');
  const res = await page.evaluate(({ css, html, extraCss, JOURNAL, PASSPORT }) => {
    const host = document.createElement('div'); host.id = 'pml-host';
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = css + (extraCss ? '\n' + extraCss : ''); root.appendChild(st);
    const vars = document.createElement('style');
    vars.textContent = ':host{--pml-bg:#121821;--pml-fg:#e6ebf2;--pml-fg-dim:#9aa8ba;--pml-line:#2a3441;--pml-accent:#4da3ff;--pml-accent-tx:#0e0f12;--pml-ring:#4da3ff;--pml-ok:#3ebe78;--pml-warn:#ffb454;--pml-crit:#ff6b6b;--pml-radius:12px;--pml-fs:15px;--pml-z:2147483000}';
    root.appendChild(vars);
    const wrap = document.createElement('div'); wrap.innerHTML = html;
    while (wrap.firstChild) root.appendChild(wrap.firstChild);
    const q = s => root.querySelector(s);
    const r = el => { const x = el.getBoundingClientRect(); return { top: Math.round(x.top), bottom: Math.round(x.bottom), h: Math.round(x.height) }; };
    const log = q('#log-list');
    log.innerHTML = JOURNAL.map(e => '<li><i data-l="info"></i><span><span class="pml-dim">+0.1с</span> ' + e + '</span></li>').join('');
    [...root.querySelectorAll('.pml-body section')].forEach(s => { s.hidden = s.dataset.tab !== 'log'; });
    const dts = root.querySelectorAll('.pml-ftr details');
    dts[0].open = true;  // Комфорт открыт (как на скриншоте владельца)
    dts[1].open = true;  // Паспорт открыт
    q('#passport').textContent = PASSPORT;
    const box = q('.pml-box'), body = q('.pml-body'), ftr = q('.pml-ftr'), sum = dts[1].querySelector('summary'), kv = q('#passport');
    // скрытая секция «Действия» не мешает (display:none через hidden-атрибут — секции без авторского display)
    const collapseTest = (() => { box.hidden = true; const d = getComputedStyle(box).display; box.hidden = false; return d; })();
    const badge = q('.pml-badge');
    const badgeVisibleAtBoot = getComputedStyle(badge).display !== 'none'; // в разметке badge hidden
    return {
      viewport: { w: innerWidth, h: innerHeight },
      box: r(box), body: r(body), ftr: r(ftr), kv: r(kv),
      bodyClientH: body.clientHeight, bodyScrollH: body.scrollHeight,
      ftrClipped: ftr.getBoundingClientRect().bottom > box.getBoundingClientRect().bottom + 0.5,
      ftrOverflowPx: Math.round(ftr.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom),
      summaryInViewport: sum.getBoundingClientRect().bottom <= innerHeight,
      journalVisiblePx: body.clientHeight,
      collapseDisplay: collapseTest,
      badgeVisibleAtBoot
    };
  }, { css, html, extraCss, JOURNAL, PASSPORT });
  console.log('=== ' + label + ' ===');
  console.log(JSON.stringify(res, null, 1));
  await page.close();
  return res;
}

(async () => {
  const browser = await chromium.launch();
  const before = await measure(browser, '', 'ДО ФИКСА (как у владельца)');
  const after = await measure(browser, FIX_CSS, 'ПОСЛЕ ФИКСА (предложение B)');
  const verdict = {
    'B1 свёртка сломана (display после hidden)': before.collapseDisplay !== 'none',
    'B1 фикс свёртки работает': after.collapseDisplay === 'none',
    'B2 футер обрезается при открытом Паспорте': before.ftrClipped,
    'B2 журнал исчез (body=0)': before.journalVisiblePx < 5,
    'B2 фикс: футер в границах': !after.ftrClipped,
    'B2 фикс: журнал видим': after.journalVisiblePx > 40
  };
  console.log('=== ВЕРДИКТ ===');
  for (const [k, v] of Object.entries(verdict)) console.log((v ? 'ПОДТВЕРЖДЕНО' : 'НЕ ПОДТВ.') + '  ' + k);
  await browser.close();
})().catch(e => { console.error('TEST ERROR:', e); process.exit(1); });
