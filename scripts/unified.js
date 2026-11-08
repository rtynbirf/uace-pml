// ЕДИНЫЙ процесс: md5 + дамп строки 590 + acorn-токены строки 590
const fs = require('fs');
const crypto = require('crypto');
const acorn = require('acorn');
const F = '/home/z/my-project/download/UACE-v27.6.0-PML-PANEL-B.user.js';
const buf = fs.readFileSync(F);
const md5 = crypto.createHash('md5').update(buf).digest('hex');
console.log('md5:', md5);
const s = buf.toString('utf8');
const line590 = s.split('\n')[589];
console.log('строка 590 (первые 160):', JSON.stringify(line590.slice(0, 160)));
// коды символов вокруг 'm => '
const idx = line590.indexOf('m => ');
console.log('символы после "m => ":', [...line590.slice(idx + 5, idx + 12)].map(ch => ch + '(U+' + ch.codePointAt(0).toString(16).padStart(4, '0') + ')').join(' '));
try {
  acorn.parse(s, { ecmaVersion: 'latest' });
  console.log('acorn parse: OK');
} catch (e) { console.log('acorn parse FAIL:', e.message); }
