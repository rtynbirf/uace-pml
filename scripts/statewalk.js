// Мини-токенизатор: отслеживает состояние (строка/комментарий) по символам файла
// и проверяет, в каком состоянии находится строка 590 (m => .path).
const fs = require('fs');
const s = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.0-PML-PANEL-B.user.js', 'utf8');
let state = 'code'; // code | sq | dq | tpl | line | block
let line = 1, lastLineState = [];
for (let i = 0; i < s.length; i++) {
  const c = s[i], n = s[i + 1];
  if (c === '\n') {
    line++;
    if (line === 590) console.log('СОСТОЯНИЕ на входе в строку 590:', state);
    if (state === 'line') state = 'code';
    continue;
  }
  if (state === 'code') {
    if (c === "'") state = 'sq';
    else if (c === '"') state = 'dq';
    else if (c === '`') state = 'tpl';
    else if (c === '/' && n === '/') state = 'line';
    else if (c === '/' && n === '*') { state = 'block'; i++; }
  } else if (state === 'sq') {
    if (c === '\\') i++;
    else if (c === "'") state = 'code';
  } else if (state === 'dq') {
    if (c === '\\') i++;
    else if (c === '"') state = 'code';
  } else if (state === 'tpl') {
    if (c === '\\') i++;
    else if (c === '`') state = 'code';
  } else if (state === 'block') {
    if (c === '*' && n === '/') { state = 'code'; i++; }
  }
}
console.log('Конец файла: state =', state, ', строк всего:', line);
// Также: вывести состояние на каждой строке 580-595
