// ZIP DEFLATE roundtrip на КОДЕ ИЗ собранного v27.3.0
// Извлекаем crc32/dosDateTime/deflateRaw/zipNoCompress/zipStore и гоняем на Node (без браузера):
// CompressionStream в Node 18+ доступен глобально -> ожидаем method 8.
const fs = require('fs');
const src = fs.readFileSync('/home/z/my-project/download/UACE-v27.3.0-STYLES-ACCENT.user.js', 'utf8');

function grab(startRe, endTag) {
  const i = src.search(startRe);
  if (i < 0) throw new Error('не найден блок: ' + startRe);
  const j = src.indexOf(endTag, i);
  if (j < 0) throw new Error('не найден конец: ' + endTag);
  return src.slice(i, j + endTag.length);
}
const code = [
  grab(/const CRC_TABLE = \(function \(\) \{/, '\n  })();'),
  grab(/function crc32\(u8\) \{/, '\n  }'),
  grab(/function dosDateTime\(d\) \{/, '\n  }'),
  grab(/async function deflateRaw\(u8\) \{/, '\n  }'),
  grab(/function zipNoCompress\(name\) \{/, '\n  }'),
  grab(/async function zipStore\(entries\) \{/, '\n  }'),
].join('\n');

const factory = new Function('CompressionStream', 'Blob', 'Response', 'TextEncoder', 'Date', 'Uint8Array', 'DataView', `
  const api = {};
  ${code.replace(/^  /gm, '')}
  api.zipStore = zipStore; api.deflateRaw = deflateRaw; api.crc32 = crc32; api.zipNoCompress = zipNoCompress;
  return api;
`);

(async () => {
  const api = factory(globalThis.CompressionStream, globalThis.Blob, globalThis.Response, TextEncoder, Date, Uint8Array, DataView);
  const enc = new TextEncoder();
  const kirillica = 'Проверка ZIP DEFLATE v27.3.0 — кириллица, повтор для сжатия. '.repeat(120);
  const entries = [
    { name: 'chats/001-тест.md', data: kirillica },
    { name: 'chats/002-тест.print.html', data: '<!DOCTYPE html><html lang="ru" data-tpl="imperial"></html>' },
    { name: '_index.json', data: JSON.stringify({ exporter: 'UACE v27.3.0 STYLES+ACCENT', chats: 2 }) },
    { name: 'images/001-01.png', data: enc.encode('бинарная заглушка — не должна жаться (zipNoCompress)') },
  ];
  const blob = await api.zipStore(entries);
  const buf = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync('/home/z/my-project/scripts/uace-v273-zip-test.zip', buf);
  console.log('zipStore: OK,', buf.length, 'байт на', entries.reduce((s, e) => s + (e.data.length || e.data.byteLength), 0), 'байт данных');
  // deflateRaw напрямую
  const deflated = await api.deflateRaw(enc.encode(kirillica));
  console.log('deflateRaw:', deflated ? ('OK, ' + kirillica.length + ' -> ' + deflated.length + ' байт (x' + (kirillica.length / deflated.length).toFixed(1) + ')') : 'ВЕРНУЛ NULL');
  console.log('zipNoCompress("images/001-01.png"):', api.zipNoCompress('images/001-01.png'), '(ожидание true)');
  console.log('zipNoCompress("chats/001-тест.md"):', api.zipNoCompress('chats/001-тест.md'), '(ожидание false)');
})().catch((e) => { console.error('ТЕСТ УПАЛ:', e); process.exit(1); });
