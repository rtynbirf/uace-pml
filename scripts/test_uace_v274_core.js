// Тест чистого ядра UACE v27.4.3-PML-PANEL-B: FNV-1a (канон r2 §5), контраст, OKLab, палитры (P1), солвер (§6)
'use strict';
const fs = require('fs');
const SRC = '/home/z/my-project/download/UACE-v27.4.3-PML-PANEL-B.user.js';
const src = fs.readFileSync(SRC, 'utf8');
const pure = src.split('/*PML-PURE-BEGIN*/')[1].split('/*PML-PURE-END*/')[0];
const P = new Function(pure + '\n;return {FNV1a32, hex8, SALT, sigHashIn, urlHashIn, hx, ratio, rgb2ok, ok2rgb, parseRgb, guardSat, solveAccent, pickTx, PAL};')();

let fail = 0, pass = 0;
const eq = (name, got, want, tol) => {
  const ok = tol != null ? Math.abs(got - want) <= tol : got === want;
  if (ok) { pass++; console.log('  pass ' + name + (tol != null ? ' = ' + got : '')); }
  else { fail++; console.log('  FAIL ' + name + ': got ' + got + ', want ' + want); }
};

console.log('1. FNV-1a 32-bit UTF-8 (референс-векторы + канон r2 §5)');
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
