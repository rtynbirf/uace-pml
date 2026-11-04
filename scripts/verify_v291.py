#!/usr/bin/env python3
# Независимая проверка ZIP-писателя v29 (Python zipfile как референсный архиватор)
import zipfile, io, subprocess, re, hashlib, sys

SRC = '/home/z/my-project/download/uace-pml-v29.0.1-evidence.user.js'
GEN = '/home/z/my-project/scripts/v29_zip_gen.cjs'
open(GEN, 'w').write("""const fs = require('fs');
(0, eval)(fs.readFileSync('/home/z/my-project/download/uace-pml-v29.0.1-evidence.user.js', 'utf8'));
const C = globalThis.__UACE29__;
(async () => {
  const files = [
    { name: 'чат №1.md', data: '# Привет\\n\\nКириллица и эмодзи \\u{1F680} — UTF-8.' },
    { name: 'big.bin', data: new Uint8Array(4000).map((_, i) => (i * 7) % 256) },
    { name: 'small.txt', data: 'x' }
  ];
  const u8 = await C.zipBuild(files);
  fs.writeFileSync('/home/z/my-project/scripts/v291-zip-test.zip', Buffer.from(u8));
  console.log('zip bytes:', u8.length);
})();
""")
r = subprocess.run(['node', GEN], capture_output=True, text=True)
print(r.stdout.strip())
if r.returncode != 0:
    print(r.stderr)
    sys.exit(1)

zf = zipfile.ZipFile(io.BytesIO(open('/home/z/my-project/scripts/v291-zip-test.zip', 'rb').read()))
bad = zf.testzip()
assert bad is None, f'CRC FAIL: {bad}'
names = zf.namelist()
assert names == ['чат №1.md', 'big.bin', 'small.txt'], names
infos = {i.filename: i for i in zf.infolist()}
data = zf.read('чат №1.md').decode('utf-8')
assert 'Привет' in data and '\U0001F680' in data
print('ZIP: python zipfile — CRC OK, имена UTF-8 OK, кириллица байт-в-байт OK')
methods = {n: infos[n].compress_type for n in names}
print('ZIP методы (8=deflate, 0=store):', methods)

code = open(SRC, encoding='utf-8').read()
stripped = re.sub(r'/\*[\s\S]*?\*/', '', code)
checks = {
  'node --check': subprocess.run(['node', '--check', SRC], capture_output=True).returncode == 0,
  'пустых catch в коде = 0': not re.search(r'catch\s*(\([^)]*\))?\s*\{\s*\}', stripped),
  'широкий connect-грант отсутствует в коде': '@connect' not in stripped,
  'mermaid.ink отсутствует в коде': 'mermaid.ink' not in stripped,
  'postMessage отсутствует': 'postMessage' not in stripped,
  'anonymous:true присутствует': 'anonymous: true' in stripped,
  'parity-догадка удалена': "i % 2 === 0 ? 'user'" not in stripped,
  'default-политика TT удалена': "createPolicy('default'" not in stripped,
  'resolve(true) удалён': 'resolve(true)' not in stripped,
  'ИМПЕРСКИЙ С ЗОЛОТОМ на месте': 'ИМПЕРСКИЙ С ЗОЛОТОМ' in code,
  'СПРАВКА слева от ПАСПОРТ': code.find('? Справка') < code.find('ⓘ Паспорт'),
  'канон соль PMLSTRUCT': "SALT = 'PMLSTRUCT'" in code,
  '36 платформ': code.count("{ name: '") >= 36,
  'хоткеи канона E/D/C/S/X/I': all(k in stripped for k in ["e: () =>", "d: () =>", "c: () =>", "s: () =>", "x: () =>", "i: () =>"]),
  'H3: busy не глушит keepAlive': "el.dataset.keepAlive !== '1'" in stripped,
  'H1: хоткеи по e.code': 'hotkeyActionFromCode(e.code)' in stripped,
  'H5: findMessages light+shadow (queryAllDeep)': "push('platform-deep'" in stripped and "push('generic-deep'" in stripped,
  'H13: мёртвые ключи удалены из whitelist': all(k not in re.search(r'const SETTINGS_KEYS = \[([^\]]+)\]', code).group(1) for k in ['uaice_strip','uaice_zipinner','uaice_evening','uaice_fsz','uaice_motion']),
  'H2: resumeEntryPlan в оркестраторе': 'resumeEntryPlan(session, items.length, location.href)' in stripped,
  'H12: фильтр применяется до цикла': 'applyChatFilterList(items, flt)' in stripped,
  'no-DOM fallback (Node возвращает ядро)': True,
}
fails = 0
for k, v in checks.items():
    print(('PASS' if v else 'FAIL'), '-', k)
    fails += 0 if v else 1
md5 = hashlib.md5(open(SRC, 'rb').read()).hexdigest()
lines = code.count('\n') + 1
print(f'\nФайл: {SRC}')
print(f'Строк: {lines} · Байт: {len(code.encode("utf-8"))} · md5: {md5}')
sys.exit(1 if fails else 0)
