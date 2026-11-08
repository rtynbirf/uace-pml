// Где открылась незакрытая dq-строка перед строкой 590?
const fs = require('fs');
const s = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.0-PML-PANEL-B.user.js', 'utf8');
let state = 'code', line = 1, lastDqOpen = -1, lastSqOpen = -1, lastTplOpen = -1;
for (let i = 0; i < s.length; i++) {
  const c = s[i], n = s[i + 1];
  if (c === '\n') {
    line++;
    continue;
  }
  if (state === 'code') {
    if (c === "'") { state = 'sq'; lastSqOpen = line; }
    else if (c === '"') { state = 'dq'; lastDqOpen = line; }
    else if (c === '`') { state = 'tpl'; lastTplOpen = line; }
    else if (c === '/' && n === '/') { state = 'line'; }
    else if (c === '/' && n === '*') { state = 'block'; i++; }
  } else if (state === 'sq') { if (c === '\\') i++; else if (c === "'") state = 'code'; }
  else if (state === 'dq') { if (c === '\\') i++; else if (c === '"') state = 'code'; }
  else if (state === 'tpl') { if (c === '\\') i++; else if (c === '`') state = 'code'; }
  else if (state === 'block') { if (c === '*' && n === '/') { state = 'code'; i++; } }
}
console.log('последнее открытие dq:', lastDqOpen);
console.log('последнее открытие sq:', lastSqOpen);
console.log('последнее открытие tpl:', lastTplOpen);
