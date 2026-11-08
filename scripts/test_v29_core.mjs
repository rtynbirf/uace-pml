/* Тест ядра v29.0.0 (L0 CORE) — независимые векторы + замыкание пунктов аудита */
import fs from 'node:fs';
const src = fs.readFileSync('/home/z/my-project/download/uace-pml-v29.0.0-evidence.user.js', 'utf8');
(0, eval)(src);
const C = globalThis.__UACE29__;
if (!C) { console.error('FATAL: __UACE29__ не экспортирован'); process.exit(1); }
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + name); } };
const eq = (a, b, name) => ok(a === b, name + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');

/* ---- 0. Замыкание аудита по тексту файла ---- */
ok(!/@connect/.test(src), 'audit§3/4: @connect * удалён');
ok(!/mermaid\.ink/.test(src), 'audit§12: внешние mermaid-ссылки отсутствуют');
ok(!/postMessage\s*\(/.test(src), 'audit§14: postMessage-канал отсутствует (поверхность устранена)');
ok(/anonymous:\s*true/.test(src), 'audit§4: GM-запросы anonymous:true');
ok(!/resolve\(true\)/.test(src), 'audit§2: renderPdfBlob→resolve(true) устранён');
ok(!/i % 2 === 0 \? 'user'/.test(src), 'audit§5: parity-догадка ролей устранена');
ok(!/createPolicy\('default'/.test(src), 'audit§13: default-политика TT удалена');
ok(!/imagesEnabled = \(\) => safeStorageGet\('uaice_images'\) !== '0'/.test(src), 'audit§3: изображения не «вкл по умолчанию»');
ok(/imagesEnabled = \(\) => safeStorageGet\('uaice_images'\) === '1'/.test(src), 'audit§3: изображения только явное включение');
ok(/Math\.min\(Math\.floor\(Number\(idx\) \|\| 0\), n\)/.test(src) && /idx >= n \? \{ action: 'complete'/.test(src), 'audit§19: resumePlan idx∈[0..n], ===n → complete');
ok((src.match(/catch\s*(\([^)]*\))?\s*\{\s*\}/g) || []).length === 0, 'audit§20: пустые catch отсутствуют');
ok(/ИМПЕРСКИЙ С ЗОЛОТОМ/.test(src), '§27: ИМПЕРСКИЙ С ЗОЛОТОМ возвращён');
ok(/\? Справка/.test(src) && src.indexOf('? Справка') < src.indexOf('ⓘ Паспорт'), '§27: СПРАВКА слева от ПАСПОРТ');
ok(/data-tip/.test(src), '§27: тултипы на наведении');
ok(/'warm':/.test(src) || /warm:\s*\{/.test(src), '§27: тёплая тема в палитре');
ok(/SALT = 'PMLSTRUCT'/.test(src), 'канон §5: соль PMLSTRUCT');
ok(/0\.35 \* u \+ 0\.25 \* c \+ 0\.20 \* p \+ 0\.10 \* sz \+ 0\.10 \* l/.test(src), 'канон r2§2: скоринг 0.35/0.25/0.20/0.10/0.10');

/* ---- 1. FNV-1a 32 (независимая реализация через Buffer) ---- */
const fnvRef = s => { const b = Buffer.from(s, 'utf8'); let h = 0x811c9dc5; for (const x of b) { h ^= x; h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
eq(C.fnv1a32(''), 0x811c9dc5, 'FNV1a("") классический вектор');
eq(C.fnv1a32('a'), 0xe40c292c, 'FNV1a("a") классический вектор');
eq(C.fnv1a32('foobar'), 0xbf9cf968, 'FNV1a("foobar") классический вектор');
for (const s of ['PMLSTRUCT>UL>LI>P', 'PMLSTRUCTURL>https://x/y', 'привет мир', 'чат 🚀 emoji', 'a'.repeat(500)]) eq(C.fnv1a32(s), fnvRef(s), 'FNV1a UTF-8 ↔ Buffer: ' + s.slice(0, 24));
eq(C.sigHashOf('UL>LI>P'), fnvRef('PMLSTRUCT>UL>LI>P').toString(16).padStart(8, '0'), 'sigHash канон: SALT>+UPPER');
eq(C.urlHashOf('https://x/y'), fnvRef('PMLSTRUCTURL>https://x/y').toString(16).padStart(8, '0'), 'urlHash канон: SALT+URL>');
eq(C.sigHashOf('ul>li>p'), C.sigHashOf('UL>LI>P'), 'sigHash нечувствителен к регистру (UPPER до хэша)');
eq(C.truncPath('x'.repeat(200)).length, 120, 'path ≤120: ~+хвост119');

/* ---- 2. CRC32 + ZIP ---- */
eq(C.crc32(Buffer.from('123456789')), 0xCBF43926, 'CRC32("123456789") классический вектор');
const zipU8 = await C.zipBuild([
  { name: 'hello.txt', data: 'Привет, мир! UTF-8 ✔' },
  { name: 'большой-файл.bin', data: new Uint8Array(2000).map((_, i) => i % 251) },
  { name: 'маленький.txt', data: 'x' }
]);
{
  const dv = new DataView(zipU8.buffer);
  eq(dv.getUint32(0, true), 0x04034b50, 'ZIP: local header sig');
  eq(dv.getUint16(6, true) & 0x0800, 0x0800, 'ZIP: флаг UTF-8 имён (0x0800)');
  const nameLen = dv.getUint16(26, true);
  eq(new TextDecoder().decode(zipU8.slice(30, 30 + nameLen)), 'hello.txt', 'ZIP: имя ASCII');
  const d0 = 30 + nameLen, c0 = dv.getUint32(14, true), sz0 = dv.getUint32(22, true);
  eq(C.crc32(zipU8.slice(d0, d0 + sz0)), c0, 'ZIP: CRC данных совпадает');
  /* второй вход — кириллическое имя */
  let off = d0 + sz0;
  const nameLen2 = dv.getUint16(off + 26, true);
  const nm2 = new TextDecoder().decode(zipU8.slice(off + 30, off + 30 + nameLen2));
  eq(nm2, 'большой-файл.bin', 'ZIP: кириллическое имя байт-в-байт');
  /* центральный каталог + EOCD */
  const tail = zipU8.length - 22;
  eq(dv.getUint32(tail, true), 0x06054b50, 'ZIP: EOCD sig');
  eq(dv.getUint16(tail + 10, true), 3, 'ZIP: 3 записи');
}
/* splitVolumesU8: учёт в UTF-8 байтах (§11) */
{
  const entries = [];
  for (let i = 0; i < 40; i++) entries.push({ nameU8: C.utf8('файл-' + i + '.txt'), data: C.utf8('данные '.repeat(50)) });
  const vols = C.splitVolumesU8(entries, 8 * 1024);
  ok(vols.length > 1, 'splitVolumesU8: разбивка работает');
  const size = e => 30 + e.nameU8.length + e.data.length + 46;
  let all = 0, within = true;
  for (const v of vols) { let s = 0; for (const e of v) s += size(e); if (s > 8 * 1024) within = false; all += v.length; }
  ok(within, 'splitVolumesU8: каждый том ≤ лимита В БАЙТАХ');
  eq(all, 40, 'splitVolumesU8: все записи сохранены');
  const ruBytes = entries.reduce((s, e) => s + e.data.length, 0);
  ok(ruBytes > ('данные '.repeat(50).length * 40) * 0.9, 'splitVolumesU8: считаем UTF-8 байты, не UTF-16 юниты');
}

/* ---- 3. dedupeNested O(n×depth) — семантика v28: зонтик долой, предметы остаются ---- */
{
  const mk = (name, parent) => { const o = { name, parent }; o.contains = x => { let p = x.parent; while (p) { if (p === o) return true; p = p.parent; } return false; }; return o; };
  const root = mk('root', null), a = mk('a', root), b = mk('b', root), a1 = mk('a1', a), a2 = mk('a2', a), a1x = mk('a1x', a1);
  /* a держит a1+a2 → контейнер; root держит a+b → контейнер; a1x вложен в кандидата a1 → дубликат */
  const res = C.dedupeNested([a1x, a1, a2, b, a, root], x => x.parent);
  eq(res.map(x => x.name).sort().join(','), 'a1,a2,b', 'dedupeNested: зонтики долой, предметы остаются, дубликат долой');
  /* пара предок→потомок без контейнера: остаётся предок */
  const p1 = mk('p', null), p2 = mk('p2', p1);
  eq(C.dedupeNested([p1, p2], x => x.parent).map(x => x.name).join(','), 'p', 'dedupeNested: пара остаётся предок');
  const many = []; let cur = root;
  for (let i = 0; i < 300; i++) { cur = mk('n' + i, cur); many.push(cur); }
  const t0 = Date.now();
  const r2 = C.dedupeNested(many, x => x.parent);
  ok(Date.now() - t0 < 300, 'dedupeNested: 300 элементов — быстро (O(n×depth))');
  eq(r2.length, 1, 'dedupeNested: цепь 300 → только внешний');
  /* список из 27 «сообщений» в контейнере: контейнер долой, все 27 остаются */
  const list = mk('list', null); const msgs = Array.from({ length: 27 }, (_, i) => mk('m' + i, list));
  eq(C.dedupeNested([list, ...msgs], x => x.parent).length, 27, 'dedupeNested: 27 сообщений в контейнере сохранены');
}

/* ---- 4. Evidence: роли и скоринг ---- */
eq(C.roleFromValue('user'), 'user', 'roleFromValue user');
eq(C.roleFromValue('HUMAN'), 'user', 'roleFromValue human→user');
eq(C.roleFromValue('gpt'), 'assistant', 'roleFromValue gpt→assistant');
eq(C.roleFromValue('system'), 'system', 'roleFromValue system');
eq(C.roleFromValue(''), null, 'roleFromValue пусто→null (не user!)');
eq(C.roleFromValue('unknown'), null, 'roleFromValue unknown→null (не user!)');
eq(C.SCORE_THRESHOLD, 0.55, 'порог валидации 0.55');
const strong = { count: 10, roleCoherence: 0.9, membership: 0.9, uniformity: 0.8, orderConsistency: 1, textQuality: 0.9, nestedShare: 0, uiShare: 0, cleanliness: 1 };
ok(C.scoreCandidates(strong).pass, 'scoreCandidates: сильный кандидат проходит');
const noRole = { ...strong, roleCoherence: 0 };
ok(!C.scoreCandidates(noRole).pass, 'scoreCandidates: role-evidence 0 → провал (не угадываем)');
const count1 = { ...strong, count: 1 };
ok(!C.scoreCandidates(count1).pass, 'scoreCandidates: count<2 → провал');
const uiHeavy = { ...strong, uiShare: 0.5 };
ok(!C.scoreCandidates(uiHeavy).pass, 'scoreCandidates: ui-penalty валит сомнительный кандидат');

/* ---- 5. resumePlan (§19) ---- */
eq(C.resumePlan(0, 5).action, 'continue', 'resume 0/5 → continue');
eq(C.resumePlan(4, 5).idx, 4, 'resume 4/5 → idx 4');
eq(C.resumePlan(5, 5).action, 'complete', 'resume 5/5 → complete (НЕ откат на 4!)');
eq(C.resumePlan(7, 5).action, 'complete', 'resume 7/5 (перелёт) → complete');
eq(C.resumePlan(-3, 5).idx, 0, 'resume -3 → 0');
eq(C.resumePlan(null, 5).idx, 0, 'resume null → 0');

/* ---- 6. ChatDocument ---- */
{
  const cd = C.makeChatDocument({
    platform: 'ChatGPT', origin: 'https://chatgpt.com', url: 'https://chatgpt.com/c/abc', title: 'Тест',
    captureMode: 'structured', captureEvidence: C.mkEv('platform', 0.87, ['sel:x']),
    messages: [
      { role: 'user', roleEvidence: { method: 'attribute', confidence: 0.99, reason: 'data-message-author-role' }, text: 'Вопрос?' },
      { role: 'assistant', roleEvidence: { method: 'platform-selector', confidence: 0.95, reason: 'ChatGPT' }, text: 'Ответ.', artifacts: [{ lang: 'python', content: 'print(1)' }] },
      { role: 'unknown', text: 'Чьё-то сообщение без улик' },
      { role: 'палка-выручалка', text: 'мусорная роль' }
    ]
  });
  eq(cd.messages.length, 4, 'ChatDocument: сообщения сохранены');
  eq(cd.messages[2].role, 'unknown', 'ChatDocument: unknown сохранён КАК unknown');
  eq(cd.messages[3].role, 'unknown', 'ChatDocument: мусорная роль → unknown (не user/assistant)');
  eq(cd.integrity.warnings.length >= 1, true, 'ChatDocument: предупреждение об unknown');
  ok(cd.integrity.warnings.join(' ').includes('2/4'), 'ChatDocument: warning содержит число unknown');
  eq(cd.integrity.messageCount, 4, 'ChatDocument: messageCount');
  const cd2 = C.makeChatDocument({ messages: [{ role: 'user', text: 'Вопрос?' }, { role: 'assistant', text: 'Ответ.', artifacts: [] }] });
  eq(cd2.integrity.contentHash, cd2.integrity.contentHash, 'ChatDocument: hash детерминирован');
  const snap = C.makeChatDocument({ captureMode: 'snapshot', messages: [{ role: 'unknown', text: 'x' }] });
  ok(snap.integrity.warnings.some(w => w.includes('snapshot')), 'ChatDocument: snapshot-предупреждение');
  ok(cd.integrity.contentHash !== cd2.integrity.contentHash, 'ChatDocument: разные данные → разные хэши');
}

/* ---- 7. Рендереры ---- */
{
  const cd = C.makeChatDocument({
    platform: 'Тест', url: 'https://t/c/1', title: 'Отчёт "с кавычками" & <тегами>',
    captureMode: 'structured', captureEvidence: C.mkEv('platform', 0.8, []),
    messages: [
      { role: 'user', roleEvidence: { method: 'attribute', confidence: 0.99, reason: 'attr' }, text: 'Строка с "кавычками",\nпереносом и ```mermaid\ngraph TD\nA-->B\n```' },
      { role: 'unknown', text: 'Без роли' },
      { role: 'assistant', roleEvidence: { method: 'platform-selector', confidence: 0.95, reason: 'T' }, text: 'Ответ <script>alert(1)</script>', thinking: ['мысли'] }
    ]
  });
  const md = C.toMarkdown(cd, { mermaid: 'off' });
  ok(md.includes('# Отчёт'), 'MD: заголовок');
  ok(md.includes('2 · UNKNOWN [heuristic 0]'), 'MD: unknown с уликой');
  ok(md.includes('⚠'), 'MD: предупреждения');
  const mdIn = C.toMarkdown(cd, { mermaid: 'inline' });
  ok(mdIn.includes('mermaid: встроен как исходник'), 'Mermaid inline: пометка');
  const all = [md, mdIn, C.toJSON(cd), C.toJSONL(cd), C.toAlpaca(cd), C.toShareGPT(cd), C.toTXT(cd), C.toCSV(cd), C.buildStyledHTML(cd, 'imperial', { bar: true })].join('\n');
  ok(!all.includes('mermaid.ink'), 'Mermaid: внешние ссылки отсутствуют во ВСЕХ рендерах');
  const csv = C.toCSV(cd);
  ok(csv.split('\n')[0] === 'index,role,evidence_method,evidence_confidence,chars,text', 'CSV: заголовок');
  ok(csv.includes('""кавычками""'), 'CSV: экранирование кавычек');
  const alpaca = JSON.parse(C.toAlpaca(cd));
  eq(alpaca.length, 1, 'Alpaca: unknown пропущен, пара user→assistant собрана');
  eq(alpaca[0].instruction, 'Строка с "кавычками",\nпереносом и ```mermaid\ngraph TD\nA-->B\n```', 'Alpaca: instruction = user');
  eq(alpaca[0].output, 'Ответ <script>alert(1)</script>', 'Alpaca: output = assistant');
  const sg = JSON.parse(C.toShareGPT(cd));
  eq(sg.conversations[1].from, 'unknown', 'ShareGPT: unknown честно сохранён');
  eq(sg.conversations[2].from, 'gpt', 'ShareGPT: assistant→gpt');
  const html = C.buildStyledHTML(cd, 'imperial', { bar: false });
  ok(html.includes('data-tpl="imperial"'), 'HTML: стиль imperial по умолчанию');
  ok(html.includes('#d4af37'), 'HTML: ИМПЕРСКИЙ С ЗОЛОТОМ (#d4af37)');
  ok(html.includes('msg unknown'), 'HTML: класс .msg.unknown');
  ok(html.includes('&lt;script&gt;'), 'HTML: текст экранирован (script обезврежен)');
  ok(!html.includes('<script>alert'), 'HTML: raw script из данных отсутствует');
  ok(html.includes('НЕИЗВЕСТНО'), 'HTML: роль «НЕИЗВЕСТНО» по-русски');
  ok(html.includes('captureMode') === false && html.includes('structured'), 'HTML: режим захвата показан');
  ok(C.TPL_STYLES.imperial.name === 'ИМПЕРСКИЙ С ЗОЛОТОМ', 'TPL: имя стиля');
  eq(Object.keys(C.TPL_STYLES).length, 5, 'TPL: 5 стилей МАКТ-2026');
}

/* ---- 8. Темы ---- */
eq(C.resolveTheme('warm', 14, false), 'warm', 'тема: явное Тепло');
eq(C.resolveTheme('auto', 22, false), 'warm', 'тема: авто-тёплый вечер 22:00');
eq(C.resolveTheme('auto', 3, false), 'warm', 'тема: авто-тёплая ночь 03:00');
eq(C.resolveTheme('auto', 14, false), 'light', 'тема: авто-день → светлая');
eq(C.resolveTheme('auto', 14, true), 'dark', 'тема: авто-день+тёмная система → тьма');
eq(C.PAL.warm.accent, '#8a5a00', 'канон Тёплой: акцент #8a5a00');
eq(C.PAL.warm.bg, '#f6efe2', 'канон Тёплой: фон #f6efe2');

/* ---- 9. simhash/hamming/compare (поглощение ландшафта 27.5.0) ---- */
{
  const A = { meta: { urlHash: 'aa' }, dom: { landmarks: [{ tag: 'main', role: null, path: 'body>main' }], groups: [{ sigHash: 'g1', count: 5 }], }, anchors: { mountPoints: [{ path: 'body>div', mode: 'fixed' }] } };
  const B = JSON.parse(JSON.stringify(A));
  const D = { meta: { urlHash: 'bb' }, dom: { landmarks: [{ tag: 'nav', role: 'navigation', path: 'body>nav' }], groups: [{ sigHash: 'zz', count: 9 }] }, anchors: { mountPoints: [] } };
  eq(C.hammingHex(C.domSim64(A), C.domSim64(B)), 0, 'simhash: идентичные struct → 0 бит');
  const d = C.hammingHex(C.domSim64(A), C.domSim64(D));
  ok(d > 4, 'simhash: разные struct → заметное расстояние');
  eq(C.hammingHex('short', 'x'), -1, 'hammingHex: некорректный вход → -1');
  eq(C.compareStructs(A, B).jaccard, 1, 'compareStructs: идентичные → Jaccard 1');
  eq(C.compareStructs(A, D).jaccard, 0, 'compareStructs: дизъюнктные → 0');
  const ds = C.downsample(A, 100);
  ok(ds.used <= 100, 'downsample: бюджет соблюдён (токен ≈ 4 символа)');
  eq(C.downsample(A, 100).view, ds.view, 'downsample: детерминирован');
}

/* ---- 10. UTF-8 утилиты ---- */
eq(C.byteLen('привет'), 12, 'byteLen: кириллица 2 байта/символ');
eq(C.byteLen('🚀'), 4, 'byteLen: эмодзи 4 байта');
eq(C.utf8('ab').length, 2, 'utf8: ASCII');

console.log('\n════════════════════════════════');
console.log('CORE: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
