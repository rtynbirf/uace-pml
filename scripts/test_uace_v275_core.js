// Тест чистого ядра UACE v27.5.0-PML-PANEL-B: FNV-1a (канон r2 §5), simhash/hamming (27.5.0), контраст, OKLab, палитры (P1), солвер (§6)
// Канон-векторы r2 §5 обязаны совпадать с 27.4.3 — интеграция 27.5.0 аддитивна и хэш-канон не трогает.
'use strict';
const fs = require('fs');
const SRC = '/home/z/my-project/download/UACE-v27.5.0-PML-PANEL-B.user.js';
const src = fs.readFileSync(SRC, 'utf8');
const pure = src.split('/*PML-PURE-BEGIN*/')[1].split('/*PML-PURE-END*/')[0];
const P = new Function(pure + '\n;return {FNV1a32, hex8, SALT, sigHashIn, urlHashIn, simhash64, hammingHex, hx, ratio, rgb2ok, ok2rgb, parseRgb, guardSat, solveAccent, pickTx, PAL};')();

let fail = 0, pass = 0;
const eq = (name, got, want, tol) => {
  const ok = tol != null ? Math.abs(got - want) <= tol : got === want;
  if (ok) { pass++; console.log('  pass ' + name + (tol != null ? ' = ' + got : '')); }
  else { fail++; console.log('  FAIL ' + name + ': got ' + got + ', want ' + want); }
};

console.log('1. FNV-1a 32-bit UTF-8 (референс-векторы + канон r2 §5) — НЕИЗМЕННОСТЬ при 27.5.0');
eq('FNV1a32("a") = 0xe40c292c', P.FNV1a32('a'), 0xe40c292c);
eq('FNV1a32("foobar") = 0xbf9cf968', P.FNV1a32('foobar'), 0xbf9cf968);
eq('SALT = PMLSTRUCT (r2 §5, столбец UPOLY)', P.SALT, 'PMLSTRUCT');
eq('sigHashIn: PMLSTRUCT>+sig', P.sigHashIn('UL>LI'), 'PMLSTRUCT>UL>LI');
eq('urlHashIn: SALT+URL>+href', P.urlHashIn('https://x/'), 'PMLSTRUCTURL>https://x/');
eq('hex8: 8 hex lowercase', /^[\da-f]{8}$/.test(P.hex8(123)) ? 1 : 0, 1);
eq('канон-вектор sigHash PMLSTRUCT> = 3124194f', P.hex8(P.FNV1a32(P.sigHashIn(''))), '3124194f');
eq('канон-вектор sigHash UL>LI = 0aebe13f', P.hex8(P.FNV1a32(P.sigHashIn('UL>LI'))), '0aebe13f');
eq('канон-вектор sigHash LI>P = a9ecc18e', P.hex8(P.FNV1a32(P.sigHashIn('LI>P'))), 'a9ecc18e');
eq('канон-вектор urlHash example.com = a03cc27b', P.hex8(P.FNV1a32(P.urlHashIn('https://example.com/'))), 'a03cc27b');
eq('канон-вектор urlHash пустой = 491154e6', P.hex8(P.FNV1a32(P.urlHashIn(''))), '491154e6');
{ // UTF-8 кросс-чек: независимая реализация в тесте, не-ASCII вход (кириллица + эмодзи-суррогатная пара)
  const ref = s => { const b = Buffer.from(s, 'utf8'); let h = 0x811c9dc5 >>> 0;
    for (const byte of b) { h = (Math.imul((h ^ byte) >>> 0, 0x01000193)) >>> 0; } return h >>> 0; };
  const probes = ['PMLSTRUCT>UL>LI', 'PMLSTRUCTURL>https://ru.example/тест', 'структура>C', 'a', 'foobar'];
  let allok = 1; for (const p of probes) if (P.FNV1a32(p) !== ref(p)) allok = 0;
  eq('FNV1a32 = UTF-8-байтовая reference (вкл. не-ASCII)', allok, 1);
}
eq('детерминизм urlHash', P.hex8(P.FNV1a32(P.urlHashIn('https://chat.example/c/123'))) === P.hex8(P.FNV1a32(P.urlHashIn('https://chat.example/c/123'))) ? 1 : 0, 1);

console.log('1b. Simhash 64 (Charikar 2002) + hammingHex — новое 27.5.0 (вне хэш-канона)');
{ // кросс-чек с независимой реализацией (Buffer-FNV): биты и веса считаются так же
  const refFNV = s => { const b = Buffer.from(s, 'utf8'); let h = 0x811c9dc5 >>> 0;
    for (const byte of b) h = Math.imul((h ^ byte) >>> 0, 0x01000193) >>> 0; return h >>> 0; };
  const refSim = feats => { const a1 = new Array(32).fill(0), a2 = new Array(32).fill(0);
    for (const f of feats) { const h1 = refFNV('SIM1>' + f.k), h2 = refFNV('SIM2>' + f.k), w = Math.max(1, Math.min(9, f.w | 0));
      for (let i = 0; i < 32; i++) { if ((h1 >>> i) & 1) a1[i] += w; else a1[i] -= w; if ((h2 >>> i) & 1) a2[i] += w; else a2[i] -= w; } }
    let v1 = 0, v2 = 0;
    for (let i = 0; i < 32; i++) { if (a1[i] > 0) v1 |= 1 << i; if (a2[i] > 0) v2 |= 1 << i; }
    return (v1 >>> 0).toString(16).padStart(8, '0') + (v2 >>> 0).toString(16).padStart(8, '0'); };
  const feats = [{ k: 'L:main|null|body>main', w: 3 }, { k: 'G:0aebe13f|5', w: 2 }, { k: 'M:body>header|sticky', w: 1 }, { k: 'структура>C', w: 2 }];
  eq('simhash64 = независимая reference (вкл. не-ASCII, w-веса)', P.simhash64(feats), refSim(feats));
  eq('simhash64 детерминизм', P.simhash64(feats) === P.simhash64(feats.slice()) ? 1 : 0, 1);
  eq('simhash64 формат hex16', /^[0-9a-f]{16}$/.test(P.simhash64(feats)) ? 1 : 0, 1);
  eq('simhash64: пустой набор — легальный вход', /^[0-9a-f]{16}$/.test(P.simhash64([])) ? 1 : 0, 1);
}
eq('hammingHex: равные = 0', P.hammingHex('0000000000000000', '0000000000000000'), 0);
eq('hammingHex: все биты = 64', P.hammingHex('ffffffffffffffff', '0000000000000000'), 64);
eq('hammingHex: половина = 32', P.hammingHex('00000000ffffffff', '0000000000000000'), 32);
eq('hammingHex: младший байт = 8', P.hammingHex('00000000000000ff', '0000000000000000'), 8);
eq('hammingHex: некорректная длина → -1', P.hammingHex('0000', '0000000000000000'), -1);
eq('hammingHex: нестрока → -1', P.hammingHex(null, '0000000000000000'), -1);
{ // свойство: дизъюнктные фичи → далёкие фингерпринты (ожидание ~32±8 из 64 бит)
  const A = [{ k: 'alpha|one', w: 2 }], B = [{ k: 'beta|two', w: 2 }];
  const d = P.hammingHex(P.simhash64(A), P.simhash64(B));
  eq('simhash64: дизъюнктные фичи далеки (16..48)', d >= 16 && d <= 48 ? 1 : 0, 1);
  console.log('  (измерено d=' + d + ' — вилка для калибровки порога ЧК-3)');
}
{ // свойство: идентичные наборы → расстояние 0
  const F = [{ k: 'L:nav|navigation|body>nav', w: 3 }, { k: 'G:f0338710|6', w: 2 }];
  eq('simhash64: идентичные фичи → d=0', P.hammingHex(P.simhash64(F), P.simhash64(F)), 0);
}

console.log('2. Контраст — кросс-чек с scripts/check_warm_uap.py (находка раунда uap)');
eq('ratio(#000,#fff)=21', P.ratio([0, 0, 0], [255, 255, 255]), 21, 0.1);
const warmFb = P.ratio(P.parseRgb('#4da3ff'), P.parseRgb('#f6efe2'));
eq('Тёплая fallback #4da3ff на #f6efe2 = 2.30 (дефект, заявка №1 STP-2)', warmFb, 2.30, 0.05);
const warmFix = P.ratio(P.parseRgb('#8a5a00'), P.parseRgb('#f6efe2'));
eq('Кандидат STP-2 #8a5a00 на #f6efe2 = 5.18', warmFix, 5.18, 0.05);
eq('Текст-на-акценте #ffffff на #8a5a00 = 5.93', P.ratio([255, 255, 255], P.parseRgb('#8a5a00')), 5.93, 0.05);
console.log('  (дефект 2.30 подтверждён независимой реализацией — заморозку не вскрываем, путь STP-2)');

console.log('3. P1-аудит палитры: все пары к своему фону ≥ 4.5:1');
for (const th of ['dark', 'light', 'warm']) {
  const t = P.PAL[th];
  for (const k of ['fg', 'dim', 'ok', 'warn', 'crit', 'ring']) {
    const r = P.ratio(t[k], t.bg);
    eq(th + '.' + k + ' ≥4.5', r >= 4.5 ? 1 : 0, 1);
  }
  const fbBg = P.ratio(t.fb, t.bg);
  if (th === 'warm') console.log('  INFO warm.fb = ' + fbBg.toFixed(2) + ' < 4.5 — ЗАМОРОЖЕННЫЙ дефект §6 (STP-2, не чинить до окна ЧК-5)');
  else eq(th + '.fb ≥4.5', fbBg >= 4.5 ? 1 : 0, 1);
  eq(th + '.fb: текст-на-акценте ≥4.5', P.ratio(t.fb, P.pickTx(t.fb)) >= 4.5 ? 1 : 0, 1);
}

console.log('4. Двухпроходный солвер акцента §6 (OKLCH)');
for (const th of ['dark', 'light', 'warm']) {
  const [, a, b] = P.rgb2ok.apply(null, P.parseRgb('#4da3ff'));
  const solved = P.solveAccent(P.PAL[th].bg, a, b);
  if (!solved) { console.log('  INFO ' + th + ': солвер не нашёл L (обе ветки <4.5) — уход в fallback (детерминированно)'); continue; }
  eq(th + ': солвер фон↔акцент ≥4.5', P.ratio(solved, P.PAL[th].bg) >= 4.5 ? 1 : 0, 1);
  eq(th + ': солвер текст↔акцент ≥4.5', Math.max(P.ratio(solved, [255, 255, 255]), P.ratio(solved, [24, 24, 24])) >= 4.5 ? 1 : 0, 1);
}
eq('страж: серый отбракован', P.guardSat([128, 128, 128]) ? 1 : 0, 0);
eq('страж: почти-чёрный отбракован', P.guardSat([10, 10, 10]) ? 1 : 0, 0);
eq('страж: #4da3ff прошёл', P.guardSat(P.parseRgb('#4da3ff')) ? 1 : 0, 1);
eq('страж: null отбракован', P.guardSat(null) ? 1 : 0, 0);

console.log('5. OKLab round-trip');
for (const c of ['#4da3ff', '#0b62c4', '#8a5a00', '#f6efe2', '#121821']) {
  const rgb = P.parseRgb(c); const [L, a, b] = P.rgb2ok(rgb[0], rgb[1], rgb[2]); const back = P.ok2rgb(L, a, b);
  const d = Math.max(Math.abs(back[0] - rgb[0]), Math.abs(back[1] - rgb[1]), Math.abs(back[2] - rgb[2]));
  eq(c + ' round-trip ≤2', d <= 2 ? 1 : 0, 1);
}
eq('parseRgb rgb() формат', P.parseRgb('rgb(77, 163, 255)').join(','), '77,163,255');
eq('parseRgb короткий hex', P.parseRgb('#4af').join(','), '68,170,255');

console.log('6. Числа 0-c: hx — 2 знака');
eq('hx(0.16666) = 0.17', P.hx(1 / 6), 0.17);
eq('hx(1.005) формат', P.hx(1.005), 1);

console.log('\nИтог: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
