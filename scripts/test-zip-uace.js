// Тест ZIP-писателя UACE v26: извлекаем РЕАЛЬНЫЕ функции из userscript-файла
// (crc32, dosDateTime, deflateRaw, zipStore) и проверяем архив Python'ом.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('/home/z/my-project/scripts/uace-v26-clean.user.js', 'utf8');

function extractBlock(startIdx) {
  let depth = 0, i = startIdx;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error('Дисбаланс скобок');
}
function extractFn(name) {
  const re = new RegExp('(?:async )?function ' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) throw new Error('Не найдена функция ' + name);
  return extractBlock(m.index);
}
function extractConst(name) {
  // CRC_TABLE объявлен как IIFE "(function(){...})();" — берём до закрывающей ")();" 
  const re = new RegExp('const ' + name + ' = [\\s\\S]*?\\}\\)\\(\\);');
  const m = src.match(re);
  if (!m) throw new Error('Не найдена константа ' + name);
  return m[0];
}

const code = [
  extractConst('CRC_TABLE'),
  extractFn('crc32'),
  extractFn('dosDateTime'),
  extractFn('deflateRaw'),
  extractFn('zipStore'),
  'return { crc32, dosDateTime, deflateRaw, zipStore };'
].join('\n');

const api = new Function(code)();

(async () => {
  const textA = ('# Заголовок\n\n' + 'Полимат-тест сжатия. '.repeat(500) + '\nUTF-8: русский текст ✔').trim();
  const textB = JSON.stringify({ hello: 'world', n: 12345, cyr: 'привет' }, null, 2);
  const entries = [
    { name: 'chats/001-Тестовый чат.md', data: textA },
    { name: 'chats/002-json.json', data: textB },
    { name: 'images/001-01.png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]) }
  ];
  const blob = await api.zipStore(entries);
  const buf = Buffer.from(await blob.arrayBuffer());
  const out = '/home/z/my-project/scripts/uace-zip-test.zip';
  fs.writeFileSync(out, buf);
  const raw = entries.reduce((s, e) => s + (typeof e.data === 'string' ? Buffer.byteLength(e.data, 'utf8') : e.data.length), 0);
  console.log('ZIP записан:', out, '| байт:', buf.length, '| несжатых данных:', raw, '| коэффициент:', (raw / buf.length).toFixed(2) + 'x');
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
