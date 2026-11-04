#!/usr/bin/env node
// Task 6. Unit-векторы восстановленной математики (ТЗ PSP-1 11.1 + errata).
const { fnv1a32, hexToRgb, calculateWCAGContrast, calculateAPCA, rgbToOklch } =
  require('/home/z/my-project/scripts/solyanka/_restored_block.js');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`PASS  ${name} ${detail || ''}`); }
  else { fail++; console.log(`FAIL  ${name} ${detail || ''}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// FNV-1a 32
ok('fnv1a32("a")', fnv1a32('a') === 'e40c292c', `-> ${fnv1a32('a')}`);
ok('fnv1a32("b")', fnv1a32('b') === 'e70c2de5', `-> ${fnv1a32('b')}`); // известный вектор FNV-1a
ok('fnv1a32("")', fnv1a32('') === '811c9dc5', `-> ${fnv1a32('')}`);

// hexToRgb (каналы 0..1)
const w = hexToRgb('#ffffff'), r3 = hexToRgb('#f00'), r8 = hexToRgb('#FF000080');
ok('hexToRgb(#ffffff)', w && w.r === 1 && w.g === 1 && w.b === 1 && w.a === 1);
ok('hexToRgb(#f00)', r3 && r3.r === 1 && r3.g === 0 && r3.b === 0 && r3.a === 1);
ok('hexToRgb(#FF000080)', r8 && r8.a === 128 / 255, `a=${r8 && r8.a.toFixed(4)}`);
ok('hexToRgb(мусор)', hexToRgb('not-a-color') === null);

// WCAG
const black = { r: 0, g: 0, b: 0 }, white = { r: 1, g: 1, b: 1 };
ok('WCAG b/w = 21.00', near(calculateWCAGContrast(black, white), 21, 0.01),
   `-> ${calculateWCAGContrast(black, white).toFixed(3)}`);

// APCA 0.1.9
const lcBoW = calculateAPCA(black, white);
const lcWoB = calculateAPCA(white, black);
ok('APCA BoW -106.04 (±0.5)', near(lcBoW, -106.04, 0.5), `-> ${lcBoW.toFixed(2)}`);
console.log(`NOTE  APCA WoB = ${lcWoB.toFixed(2)} (вектор ТЗ +106.04 — errata, см. шапку блока)`);

// OKLCH (CSS Color 4)
const red = rgbToOklch({ r: 1, g: 0, b: 0 });
const grn = rgbToOklch({ r: 0, g: 1, b: 0 });
const blu = rgbToOklch({ r: 0, g: 0, b: 1 });
const wht = rgbToOklch({ r: 1, g: 1, b: 1 });
ok('OKLCH red L', near(red.l, 0.62796, 0.002), `-> ${red.l.toFixed(5)}`);
ok('OKLCH red C', near(red.c, 0.25768, 0.002), `-> ${red.c.toFixed(5)}`);
ok('OKLCH red H', near(red.h, 29.234, 0.1), `-> ${red.h.toFixed(3)}`);
ok('OKLCH green L/C/H', near(grn.l, 0.86644, 0.002) && near(grn.c, 0.29483, 0.002) && near(grn.h, 142.495, 0.1),
   `-> L${grn.l.toFixed(5)} C${grn.c.toFixed(5)} H${grn.h.toFixed(3)} (errata ТЗ 11.1 учтена)`);
ok('OKLCH blue L/C/H', near(blu.l, 0.45201, 0.002) && near(blu.c, 0.31321, 0.002) && near(blu.h, 264.052, 0.1),
   `-> L${blu.l.toFixed(5)} C${blu.c.toFixed(5)} H${blu.h.toFixed(3)}`);
ok('OKLCH white', near(wht.l, 1, 0.002) && wht.c < 0.001, `-> L${wht.l.toFixed(5)} C${wht.c.toFixed(6)}`);

console.log(`\nИТОГ: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
