// Проверка чётности одинарных кавычек построчно в области structToHTML (грубая эвристика)
const fs = require('fs');
const s = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.0-PML-PANEL-B.user.js', 'utf8');
const lines = s.split('\n');
for (let i = 563; i < 592 && i < lines.length; i++) {
  const l = lines[i];
  let cnt = 0;
  for (let j = 0; j < l.length; j++) {
    if (l[j] === '\\' && l[j + 1] === "'") { j++; continue; } // экранированная
    if (l[j] === "'") cnt++;
  }
  if (cnt % 2) console.log('НЕЧЁТНО (' + cnt + ") строка " + (i + 1) + ': ' + l.trim().slice(0, 120));
}
console.log('scan done');
