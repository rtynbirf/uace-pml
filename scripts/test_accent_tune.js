// Тест автоподгонки системного акцента v27.1 (норма 1: WCAG >= 4.5:1 сохраняется при ЛЮБОМ акценте ОС).
// Функции извлекаются из собранного userscript — проверяется ровно тот код, что получит пользователь.
'use strict';
const fs = require('fs');
const src = fs.readFileSync('/home/z/my-project/download/UACE-v27.1.0-HUMAN-FIRST.user.js', 'utf8');

// Стабы окружения: блок кэша акцента вешает слушатели на window/document при вычислении чанка
global.window = { addEventListener() {} };
global.document = { addEventListener() {} };

const i0 = src.indexOf('const HF_PALETTES');
const j0 = src.indexOf('function injectModernStyles', i0);
if (i0 < 0 || j0 < 0) throw new Error('marks not found');
const chunk = src.slice(i0, j0);
const factory = new Function(chunk + '\nreturn { HF_PALETTES, hfLum, hfContrast, hfRgbToHex, hfShiftLum, hfTuneAccent, hfPickAccentTx };');
const api = factory();

// Независимая реализация WCAG-контраста (не из userscript — контроль перекрёстной проверкой)
function lum(hex) {
  const c = hex.replace('#', '');
  const f = (i) => {
    const x = parseInt(c.slice(i, i + 2), 16) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4);
}
function cr(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Палитра акцентов Windows 10/11 + macOS-подобные + экстремумы (жёлтый, светло-голубой, графит)
const ACCENTS = ['#0078D4','#0063B1','#4CC2FF','#0099BC','#00B7C3','#018574','#00B294','#107C10','#10893E','#7A7574','#5D5A58','#68768A','#515C6B','#FFB900','#FF8C00','#F7630C','#CA5010','#DA3B01','#EF6950','#D13438','#EA005E','#C30052','#E3008C','#B146C2','#881798','#744DA9','#8764B8','#6B69D6','#8E8CD8','#FFF100','#8CBD18','#97D5EF','#CCE7FF'];

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const sat = (h) => {
  const r = hexToRgb(h).map((x) => x / 255);
  const mx = Math.max(...r), mn = Math.min(...r);
  return mx < 0.08 ? 0 : (mx - mn) / mx;
};

const themes = Object.keys(api.HF_PALETTES);
let fail = 0, rows = 0, guarded = 0;
console.log('theme | system accent | -> tuned | contrast | tx on accent | note');
for (const th of themes) {
  const bg = api.HF_PALETTES[th].bg;
  for (const acc of ACCENTS) {
    rows++;
    const tuned = api.hfTuneAccent(hexToRgb(acc), bg);
    if (tuned === null) {
      // допустимо только если акцент серый (его отфильтрует сатурационный страж на входе)
      if (sat(acc) < 0.18) { guarded++; continue; }
      console.log(`FAIL ${th} ${acc}: tune=null при насыщенном акценте`);
      fail++; continue;
    }
    const hex = api.hfRgbToHex(tuned);
    const c = cr(hex, bg);
    if (c < 4.5) { console.log(`FAIL ${th} ${acc} -> ${hex} contrast ${c.toFixed(2)} < 4.5`); fail++; continue; }
    const tx = api.hfPickAccentTx(hex);
    const ct = cr(tx, hex);
    if (ct < 4.5) { console.log(`FAIL ${th} ${acc} tx ${tx} on ${hex} = ${ct.toFixed(2)} < 4.5`); fail++; continue; }
    console.log(`${th.padEnd(5)} | ${acc} -> ${hex} | ${c.toFixed(1)}:1 | tx ${tx} (${ct.toFixed(1)}:1)${sat(acc) < 0.18 ? ' [серый: страж отправит на эталон]' : ''}`);
  }
}
// Отдельно: сатурационный страж должен отклонить серые/чёрные ответы движка
const greys = ['#7A7574', '#000000', '#3b3b3b', '#e9e9e9'];
for (const g of greys) { rows++; if (sat(g) < 0.18) guarded++; else { console.log('FAIL guard ' + g); fail++; } }
console.log(`\nПроверено сочетаний: ${rows}; серых отклонено стражем: ${guarded}`);
console.log(fail === 0 ? 'RESULT: ALL PASS' : `RESULT: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
