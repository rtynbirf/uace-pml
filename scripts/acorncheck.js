// Аккорд: токенизируем файл, находим токены строки 590 и их типы
const fs = require('fs');
const acorn = require('acorn');
const s = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.0-PML-PANEL-B.user.js', 'utf8');
try {
  acorn.parse(s, { ecmaVersion: 'latest', allowHashBang: true });
  console.log('acorn: файл парсится ЦЕЛИКОМ');
} catch (e) {
  console.log('acorn: ОШИБКА ПАРСА —', e.message, 'строка', e.loc && e.loc.line);
}
// Токены вокруг строки 590
const tokens = [];
const walker = acorn.tokenizer(s, { ecmaVersion: 'latest', locations: true });
for (const t of walker) {
  if (t.loc.start.line >= 588 && t.loc.start.line <= 592) tokens.push(t);
  if (t.loc.start.line > 592) break;
}
for (const t of tokens) {
  console.log('L' + t.loc.start.line + ':' + t.loc.start.column, t.type.label, JSON.stringify(String(s.slice(t.start, t.end)).slice(0, 60)));
}
