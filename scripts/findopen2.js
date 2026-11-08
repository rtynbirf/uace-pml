// Корректный обход: сброс line-комментария на \n + трекинг открытий строк
const fs = require('fs');
const s = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.0-PML-PANEL-B.user.js', 'utf8');
let state = 'code', line = 1, lastDqOpen = -1, lastSqOpen = -1, lastTplOpen = -1, lineLog = [];
for (let i = 0; i < s.length; i++) {
  const c = s[i], n = s[i + 1];
  if (c === '\n') {
    line++;
    if (state === 'line') state = 'code';
    continue;
  }
  if (state === 'code') {
    if (c === "'") { state = 'sq'; lastSqOpen = line; }
    else if (c === '"') { state = 'dq'; lastDqOpen = line; lineLog.push(line); }
    else if (c === '`') { state = 'tpl'; lastTplOpen = line; }
    else if (c === '/' && n === '/') { state = 'line'; i++; }
    else if (c === '/' && n === '*') { state = 'block'; i++; }
  } else if (state === 'sq') { if (c === '\\') i++; else if (c === "'") state = 'code'; }
  else if (state === 'dq') { if (c === '\\') i++; else if (c === '"') state = 'code'; }
  else if (state === 'tpl') { if (c === '\\') i++; else if (c === '`') state = 'code'; }
  else if (state === 'block') { if (c === '*' && n === '/') { state = 'code'; i++; } }
}
console.log('dq открытия:', lineLog.join(','));
console.log('последнее dq открыто на строке:', lastDqOpen, '| незакрыто:', state === 'dq');
console.log('последнее sq открыто на строке:', lastSqOpen, '| незакрыто:', state === 'sq');
console.log('конечное состояние:', state);
const lines = s.split('\n');
if (lastDqOpen > 0) console.log('СТРОКА ' + lastDqOpen + ':', JSON.stringify(lines[lastDqOpen - 1].slice(0, 200)));
