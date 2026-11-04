// Отладка: первые 30 переходов состояний токенизатора
const fs = require('fs');
const s = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.0-PML-PANEL-B.user.js', 'utf8');
let state = 'code', line = 1, transitions = 0;
for (let i = 0; i < s.length; i++) {
  const c = s[i], n = s[i + 1];
  if (c === '\n') { line++; continue; }
  const prev = state;
  if (state === 'code') {
    if (c === "'") state = 'sq';
    else if (c === '"') state = 'dq';
    else if (c === '`') state = 'tpl';
    else if (c === '/' && n === '/') { state = 'line'; i++; }
    else if (c === '/' && n === '*') { state = 'block'; i++; }
  } else if (state === 'sq') { if (c === '\\') i++; else if (c === "'") state = 'code'; }
  else if (state === 'dq') { if (c === '\\') i++; else if (c === '"') state = 'code'; }
  else if (state === 'tpl') { if (c === '\\') i++; else if (c === '`') state = 'code'; }
  else if (state === 'line') { /* до конца строки */ }
  else if (state === 'block') { if (c === '*' && n === '/') { state = 'code'; i++; } }
  if (state !== prev && transitions < 40) {
    transitions++;
    console.log('строка ' + line + ': ' + prev + ' → ' + state + '  | ctx: ' + JSON.stringify(s.slice(Math.max(0, i - 30), i + 5)));
  }
}
console.log('итог state:', state, 'строк:', line);
