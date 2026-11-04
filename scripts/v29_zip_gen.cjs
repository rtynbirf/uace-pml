const fs = require('fs');
(0, eval)(fs.readFileSync('/home/z/my-project/download/uace-pml-v29.0.1-evidence.user.js', 'utf8'));
const C = globalThis.__UACE29__;
(async () => {
  const files = [
    { name: 'чат №1.md', data: '# Привет\n\nКириллица и эмодзи \u{1F680} — UTF-8.' },
    { name: 'big.bin', data: new Uint8Array(4000).map((_, i) => (i * 7) % 256) },
    { name: 'small.txt', data: 'x' }
  ];
  const u8 = await C.zipBuild(files);
  fs.writeFileSync('/home/z/my-project/scripts/v291-zip-test.zip', Buffer.from(u8));
  console.log('zip bytes:', u8.length);
})();
