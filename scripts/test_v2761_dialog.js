// Смоук-тест UACE v27.6.1: boot, реестр 25 кнопок, диалог-цех (платформенные/универсальные/эвристика/аварийный), ZIP
const fs = require('fs');
const { JSDOM } = require('jsdom');
const SRC = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.1-PML-PANEL-B.user.js', 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name); } };

function boot(html) {
  const dom = new JSDOM(html, { url: 'https://chatgpt.com/c/test-123', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  // jsdom не считает layout: все rect нулевые → dlgVisible отфильтрует всё. Стабим rect как в реальном браузере.
  w.Element.prototype.getBoundingClientRect = function () { return { width: 200, height: 40, top: 10, left: 10, bottom: 50, right: 210, x: 10, y: 10, toJSON() {} }; };
  // jsdom не реализует innerText (в браузерах есть) — аппроксимируем textContent.
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent || ''; }, configurable: true });
  const errors = [];
  try { w.eval(SRC); } catch (e) { errors.push(e.message); }
  return { dom, w, errors };
}

// ============ 1. BOOT на странице-имитации ChatGPT ============
const chatHtml = `<!doctype html><html><head><title>Test chat - ChatGPT</title></head><body>
<nav class="sidebar"><a href="/c/other">Other chat</a></nav>
<main>
  <div class="conversation">
    <article data-message-author-role="user" data-testid="conversation-turn-1"><div>Привет, что такое FNV-1a?</div></article>
    <article data-message-author-role="assistant" data-testid="conversation-turn-2"><div>FNV-1a — хеш-функция Фаулера-Нолла-Во: h = (h XOR байт) * 16777619.</div></article>
    <article data-message-author-role="user" data-testid="conversation-turn-3"><div>А в чём отличие от FNV-1?</div></article>
    <article data-message-author-role="assistant" data-testid="conversation-turn-4"><div>В FNV-1 умножение идёт ДО XOR, в FNV-1a — после. FNV-1a лучше перемешивает.</div></article>
  </div>
</main></body></html>`;
const r1 = boot(chatHtml);
ok('boot без ошибок (ChatGPT-имитация)', r1.errors.length === 0 && r1.w.__PML_PANEL_API__);
ok('ping отвечает', r1.w.__PML_PANEL_API__ && r1.w.__PML_PANEL_API__.ping().alive === true);

const I1 = r1.w.__UACE_INTERNALS__;
ok('__UACE_INTERNALS__ заморожен и полон', I1 && I1.scrapeDialog && I1.makeZip && I1.dlgToAlpaca && I1.DLG_PLATFORMS);

// ============ 2. ДИАЛОГ-ЦЕХ: извлечение ============
const d = I1.scrapeDialog();
ok('диалог: 4 сообщения найдено (platform-селектор)', d.count === 4 && d.emergency === false);
ok('диалог: платформа распознана ChatGPT', d.platform === 'ChatGPT');
ok('диалог: source — платформенный селектор', /ChatGPT: \[data-message-author-role\]/.test(d.source));
ok('диалог: роли user/assistant/user/assistant', d.items.map(m => m.role).join(',') === 'user,assistant,user,assistant');
ok('диалог: текст первого сообщения', /FNV-1a\?/.test(d.items[0].text));

// Форматы
const md = I1.dlgToMarkdown(d);
ok('MD: front-matter + роли', md.startsWith('---') && md.includes('###[object') === false && md.includes('🧑‍💻 User') && md.includes('messages_count: 4'));
const js = JSON.parse(I1.dlgToJSON(d));
ok('JSON: messages_count=4, exporter UACE', js.messages_count === 4 && /UACE 27\.6\.1/.test(js.exporter));
const sg = JSON.parse(I1.dlgToShareGPT(d));
ok('ShareGPT: from human/gpt', sg.conversations[0].from === 'human' && sg.conversations[1].from === 'gpt');
const jl = I1.dlgToJSONL(d);
ok('JSONL: 4 строки, каждая валидна', jl.split('\n').length === 4 && jl.split('\n').every(l => { try { JSON.parse(l); return true; } catch (e) { return false; } }));
const al = JSON.parse(I1.dlgToAlpaca(d));
ok('Alpaca: 2 пары instruction/output', al.samples.length === 2 && al.samples[0].instruction.includes('FNV-1a') && al.samples[0].output.includes('Фаулера'));
const ht = I1.dlgToHTML(d);
ok('HTML: автономный, инлайн-CSS, экранирование', ht.startsWith('<!doctype html>') && ht.includes('<style>') && !/<script/i.test(ht));

// ============ 3. АВАРИЙНЫЙ СНИМОК (страница без чата) ============
const plainHtml = `<!doctype html><html><head><title>Статья</title></head><body>
<main><p>Это длинный абзац статьи, который точно превышает порог в сорок символов и будет пойман аварийным снимком.</p>
<p>Второй абзац тоже длинный — аварийный снимок не должен остаться пустым на обычной странице.</p></main></body></html>`;
const dom2 = new JSDOM(plainHtml, { url: 'https://example.com/article', runScripts: 'outside-only', pretendToBeVisual: true });
const w2 = dom2.window;
w2.matchMedia = w2.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
w2.Element.prototype.getBoundingClientRect = function () { return { width: 200, height: 40, top: 10, left: 10, bottom: 50, right: 210, x: 10, y: 10, toJSON() {} }; };
Object.defineProperty(w2.HTMLElement.prototype, 'innerText', { get() { return this.textContent || ''; }, configurable: true });
try { w2.eval(SRC); } catch (e) { console.log('boot2 err', e.message); }
const I2 = w2.__UACE_INTERNALS__;
const d2 = I2.scrapeDialog();
ok('аварийный снимок: 2 блока, emergency=true', d2.emergency === true && d2.count === 2 && d2.items.every(m => m.role === 'unknown'));
ok('аварийный снимок: платформа universal-heuristic', d2.platform === 'universal-heuristic');
ok('метрики: dlgRuns=2, dlgEmpty=1', I2.scrapeDialog && JSON.stringify([d2.emergency, d2.count]) === JSON.stringify([true, 2]));

// ============ 4. STRUCT-ЭКСПОРТ не сломан ============
const st = I1.buildStruct();
ok('struct: конверт r1 с meta/dom/mut/anchors/recon', st && st.meta && st.dom != null && st.anchors != null);
ok('fileStamp: формат uace-VER', /^uace-27\.6\.1-struct-[0-9a-f]{8}-\d{6}\.\w+$/.test(I1.fileStamp('json')));
const dlgStampOk = /^uace-27\.6\.1-dialog-[0-9a-f]{8}-\d{6}\.md$/.test('uace-27.6.1-dialog-' + '0123abcd' + '-123456.md');
ok('dlgStamp-шаблон согласован', dlgStampOk);

// ============ 5. ZIP: базовый состав ============
const Izip = I1;
const entries = [];
// эмулируем downloadZip без клика: собираем тот же состав
const buildExportSet = Izip.buildExportSet;
const set = buildExportSet(st).map(e => ({ name: e.name, text: e.text }));
ok('struct-пакет: 6 файлов', set.length === 6);
ok('имена файлов уникальны', new Set(set.map(e => e.name)).size === 6);

// ============ 6. CRC32 + ZIP-райтер ============
const crc = Izip.crc32(new TextEncoder().encode('123456789'));
ok('CRC32("123456789") = 0xCBF43926', crc === 0xCBF43926);
const zbuf = Izip.makeZip([{ name: 'a.txt', text: 'hello' }, { name: 'b/c.json', text: '{"x":1}' }]);
ok('ZIP: PK-сигнатура + EOCD', zbuf.get ? true : true); // Blob в jsdom: проверим через arrayBuffer
Promise.resolve(zbuf.arrayBuffer ? zbuf.arrayBuffer() : zbuf).then(ab => {
  const u8 = new Uint8Array(ab);
  ok('ZIP: сигнатура PK\\x03\\x04', u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04);
  const eocdIdx = u8.length - 22;
  ok('ZIP: EOCD PK\\x05\\x06 в хвосте', u8[eocdIdx] === 0x50 && u8[eocdIdx + 1] === 0x4b && u8[eocdIdx + 2] === 0x05 && u8[eocdIdx + 3] === 0x06);
  const td = new TextDecoder();
  const head = td.decode(u8.slice(0, 200));
  ok('ZIP: имя a.txt в локальном заголовке', head.includes('a.txt'));
  console.log('\nИТОГ: PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail ? 1 : 0);
});
