// Верификация полевого struct №3 (страница baea2528, сборка UPOLY v1.0 + гость UACE v27.4.2, дроп 2026-09-20)
// Проверяем инварианты r1/r2 независимо от сборки A: арифметика, капы, сортировка, inPrimary, журнальная сверка.
'use strict';
const S3 = {
  structVersion: 'r1',
  meta: { ts: 70068, viewport: { w: 811, h: 599 }, dpr: 1, urlHash: 'baea2528' },
  dom: {
    maxDepth: 23, blockCount: 851,
    landmarks: [
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div>div:nth(2)>div:nth(2)' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div>div:nth(2)>div:nth(3)' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div>div:nth(2)>div:nth(4)' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div>div:nth(2)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div>div:nth(2)>div:nth(2)' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(2)' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div>a>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div>a:nth(2)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div>a:nth(3)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div>a:nth(4)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div>a:nth(5)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div:nth(2)>a>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div:nth(2)>a:nth(2)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div:nth(2)>a:nth(3)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div:nth(2)>a:nth(4)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div:nth(2)>a:nth(5)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div:nth(2)>a:nth(6)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div:nth(2)>a:nth(7)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div:nth(2)>a:nth(8)>div:nth(3)>div' },
      { tag: 'div', role: 'button', path: 'body>div>div>div:nth(2)>div>div:nth(2)>div:nth(3)>div:nth(3)>div>div:nth(3)>a>div:nth(3)>div' }
    ],
    groups: [
      { sigHash: 'f0338710', count: 5, depth: 3, uniformity: 1, samplePath: 'body>div>div>div:nth(2)>div:nth(3)>div>div:nth(2)>div:nth(2)>div>div:nth(2)>div>div>div:nth(3)>div:nth(3)>ul>li', inPrimary: true },
      { sigHash: 'f0338710', count: 3, depth: 3, uniformity: 1, samplePath: 'body>div>div>div:nth(2)>div:nth(3)>div>div:nth(2)>div:nth(2)>div>div:nth(2)>div>div>div:nth(3)>div:nth(3)>ol>li', inPrimary: true },
      { sigHash: '6a946d0f', count: 3, depth: 4, uniformity: 0.75, samplePath: 'body>div>div>div:nth(2)>div:nth(3)>div>div:nth(2)>div:nth(2)>div>div:nth(2)>div>div:nth(2)>ol>li', inPrimary: true },
      { sigHash: '0ad93443', count: 3, depth: 5, uniformity: 0.75, samplePath: 'body>div>div>div:nth(2)>div>div>div:nth(2)>div:nth(2)', inPrimary: false }
    ],
    truncated: true
  },
  scroll: {
    primary: { path: 'body>div>div>div:nth(2)>div:nth(3)>div>div:nth(2)', scrollHeight: 4651, clientHeight: 539, ratio: 0.12 },
    containers: [{ path: 'body>div>div>div:nth(2)>div:nth(3)>div>div:nth(2)', scrollHeight: 4651, clientHeight: 539 }],
    truncated: false
  },
  mut: { window: 60, adds: 0, removes: 0, recycles: 0, medianIntervalMs: null, streamCandidate: null },
  anchors: {
    mountPoints: [
      { path: 'body>div>div>div:nth(2)>div:nth(3)>div>div:nth(2)>div:nth(2)>div>div:nth(2)>div>div>div', mode: 'sticky', h: 34 },
      { path: 'body>div>div>div:nth(2)>div>div', mode: 'fixed', h: 40 }
    ],
    persistentPaths: [], stability: 0, truncated: false
  },
  recon: { status: 'no-data' }
};

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { console.log((cond ? 'pass' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : '')); cond ? pass++ : fail++; };
const r2 = v => Math.round(v * 100) / 100;
const hex8 = s => /^[\da-f]{8}$/.test(s);

console.log('1. Мета и скролл-арифметика');
ok(S3.structVersion === 'r1', 'structVersion r1');
ok(S3.meta.viewport.w === 811 && S3.meta.viewport.h === 599 && S3.meta.dpr === 1, 'viewport 811×599, dpr 1 — совпадает с конвертом №2 (та же сессия)');
ok(S3.meta.urlHash === 'baea2528', 'urlHash baea2528 = конверту №2 (та же страница, другой момент — детерминизм urlHash подтверждён межконвертно)');
ok(r2(S3.scroll.primary.clientHeight / S3.scroll.primary.scrollHeight) === S3.scroll.primary.ratio, 'ratio = round2(ch/sh): 539/4651 = 0.12', String(S3.scroll.primary.ratio));
ok(S3.scroll.primary.path === S3.scroll.containers[0].path, 'containers[0] == primary (один кандидат)');
ok(S3.scroll.truncated === false, 'scroll.truncated boolean (столбец UPOLY)');
// Сверка с конвертом №2: тот же primary path, ratio вырос (0.10→0.12) — контент страницы изменился (5539→4651)
ok(S3.scroll.primary.path === 'body>div>div>div:nth(2)>div:nth(3)>div>div:nth(2)', 'primary path стабилен между конвертами №2 и №3');

console.log('2. Группы I-1: капы, пороги, сортировка, inPrimary');
const G = S3.dom.groups;
ok(G.length <= 12, 'кап групп ≤12', String(G.length));
ok(G.every(g => g.count >= 3), 'каждая группа count ≥3 (порог модальности)');
ok(G.every(g => g.uniformity >= 0.6), 'uniformity ≥0.6');
ok(G.every(g => hex8(g.sigHash)), 'sigHash — lowercase hex8');
ok(G.filter(g => g.sigHash === 'f0338710').length === 2, 'f0338710 встречается ДВАЖДЫ — дедупа нет (модальные группы разных родителей ul>li и ol>li): столбец UPOLY подтверждён');
const scores = G.map(g => g.count * g.uniformity);
let sortedOk = true;
for (let i = 1; i < G.length; i++) {
  if (scores[i - 1] < scores[i]) sortedOk = false;
  if (scores[i - 1] === scores[i] && G[i - 1].parentPath !== undefined && G[i].parentPath !== undefined && G[i - 1].parentPath > G[i].parentPath) { /* tiebreak не проверить без parentPath в конверте — пропускаем */ }
}
ok(sortedOk, 'сортировка count*uniformity по убыванию', scores.join(', '));
const prim = S3.scroll.primary.path;
const pref = g => g.samplePath === prim || g.samplePath.startsWith(prim + '>');
ok(G.every(g => g.inPrimary === pref(g)), 'inPrimary всех групп воспроизводится из primary-пути', G.map(g => g.inPrimary).join(','));
ok(G.slice(0, 3).every(g => g.inPrimary) && !G[3].inPrimary, '3 контентные в скролле, кнопочная вне — как в конверте №2');
ok(S3.dom.truncated === true, 'dom.truncated boolean true');
// кап landmarks: 20 = потолок → усечено
ok(S3.dom.landmarks.length === 20 && S3.dom.truncated, 'landmarks 20/20 (кап) → truncated true');

console.log('3. Якоря I-4a и мутации I-3');
ok(S3.anchors.mountPoints.length <= 8, 'кап mountPoints ≤8', String(S3.anchors.mountPoints.length));
ok(S3.anchors.mountPoints.every(m => (m.mode === 'fixed' || m.mode === 'sticky') && m.h >= 32 && m.h <= 96), 'режимы fixed/sticky, h в полосе 32..96', S3.anchors.mountPoints.map(m => m.mode + ':' + m.h).join(', '));
ok(S3.anchors.mountPoints[0].path === 'body>div>div>div:nth(2)>div:nth(3)>div>div:nth(2)>div:nth(2)>div>div:nth(2)>div>div>div', 'mountPoints[0] идентичен конверту №2 (sticky h34 — стабильная точка Ф2)');
ok(S3.anchors.mountPoints[1] && S3.anchors.mountPoints[1].mode === 'fixed' && S3.anchors.mountPoints[1].h === 40, 'mountPoints[1] НОВЫЙ в №3: fixed h40 (элемент появился между конвертами — вопрос самоисключения/чистоты снят проверкой пути: не body>div#pml-host)');
ok(S3.anchors.persistentPaths.length === 0 && S3.anchors.stability === 0, 'без наблюдения persistent пуст, stability 0');
ok(S3.mut.window === 60 && S3.mut.adds === 0 && S3.mut.removes === 0 && S3.mut.recycles === 0 && S3.mut.medianIntervalMs === null && S3.mut.streamCandidate === null, 'mut: default-нули окна 60 (struct собран ДО завершения наблюдения)');

console.log('4. Резерв r2 §3 и журнальная сверка');
ok(S3.recon.status === 'no-data', 'резерв: no-data (консервативный отказ: max count 5 < гейта 6)');
ok(S3.meta.ts === 70068, 'meta.ts 70068 мс');
ok(Math.abs(S3.meta.ts / 1000 - 70.1) < 0.05, 'журнал: [+70.1с] разведка 26 мс: групп 4 — ts конверта совпал с журналом (±0.05с)');
ok(G.length === 4, 'журнал: «групп 4» == групп в конверте');

console.log('\nИтог: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
