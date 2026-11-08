// Регрессия 27.6.1: канон-блок, REG-состав, хоткеи, ZIP round-trip (python -m zipfile --test)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');
const SRC = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.1-PML-PANEL-B.user.js', 'utf8');
const SRC60 = fs.readFileSync('/home/z/my-project/download/UACE-v27.6.0-PML-PANEL-B.user.js', 'utf8');
const SRC50 = fs.readFileSync('/home/z/my-project/download/UACE-v27.5.0-PML-PANEL-B.user.js', 'utf8');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n); } };
const pure = src => { const m = src.match(/\/\*PML-PURE-BEGIN\*\/[\s\S]*?\/\*PML-PURE-END\*\//); return m ? crypto.createHash('md5').update(m[0]).digest('hex') : 'NONE'; };
const pureSig = src => { const m = src.match(/const SALT[\s\S]*?const hex8[\s\S]*?;[\s\S]*?FNV1a32[\s\S]*?\n/); return m ? crypto.createHash('md5').update(m[0]).digest('hex') : 'NONE'; };

ok('канон PURE-блок идентичен 27.6.0', pure(SRC) === pure(SRC60) && pure(SRC) !== 'NONE');
ok('канон PURE-блок идентичен 27.5.0', pure(SRC) === pure(SRC50));
// соль дословно
ok("соль 'PMLSTRUCT' дословно", SRC.includes("SALT = 'PMLSTRUCT'") || /const SALT = 'PMLSTRUCT'/.test(SRC));
ok("urlHash-соль 'URL>' дословно", SRC.includes("'URL>'"));

// REG: 25 кнопок, уникальные id, все run
const regMatches = SRC.match(/const REG = \[([\s\S]*?)\];/);
const ids = [...regMatches[1].matchAll(/id: '([^']+)'/g)].map(m => m[1]);
ok('REG: 25 кнопок', ids.length === 25);
ok('REG: id уникальны', new Set(ids).size === 25);
const need = ['observe','copy-struct','copy-agent','dl-json','dl-md','dl-html','dl-txt','dl-csv','dl-agent','dl-zip','dlg-copy','dlg-md','dlg-json','dlg-txt','dlg-html','dlg-sharegpt','dlg-jsonl','dlg-alpaca','dlg-pdf','dlg-zip','stop','copylog','tabs','collapse','passport'];
ok('REG: все ожидаемые id присутствуют', need.every(x => ids.includes(x)));
ok('хоткеи: канон E/D/C/S/X/I не расширен', /'EDCSXI'\.indexOf/.test(SRC) && !/EDCSXIV|EDCSXIA/.test(SRC));

// ZIP round-trip: сгенерить и прогнать через настоящий python-zipfile
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
w.Element.prototype.getBoundingClientRect = () => ({ width: 200, height: 40, top: 10, left: 10, bottom: 50, right: 210, x: 10, y: 10, toJSON() {} });
Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent || ''; }, configurable: true });
w.eval(SRC);
const I = w.__UACE_INTERNALS__;
const files = I.buildExportSet().map(e => ({ name: e.name, text: e.text }));
files.push({ name: 'dialog-test.md', text: I.dlgToMarkdown(I.scrapeDialog()) });
files.push({ name: 'journal.txt', text: 'log line 1\nlog line 2' });
files.push({ name: 'passport.txt', text: 'PASSPORT' });
files.push({ name: 'README.txt', text: 'UACE 27.6.1 full bundle' });
const blob = I.makeZip(files);
blob.arrayBuffer().then(ab => {
  const buf = Buffer.from(ab);
  fs.writeFileSync('/home/z/my-project/scripts/_zipcheck.zip', buf);
  const { execSync } = require('child_process');
  try {
    const out = execSync('python3 -m zipfile --test /home/z/my-project/scripts/_zipcheck.zip 2>&1').toString().trim();
    ok('ZIP round-trip: python zipfile --test чисто', out === 'Done testing');
    if (out !== 'Done testing') console.log('   zipfile output:', JSON.stringify(out));
  } catch (e) { ok('ZIP round-trip: python zipfile --test чисто', false); console.log(e.stdout && e.stdout.toString()); }
  const listing = execSync('python3 -m zipfile -l /home/z/my-project/scripts/_zipcheck.zip').toString();
  const names = listing.split('\n').slice(1).map(l => l.replace(/\s+\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s+\d+\s*$/, '').trim()).filter(Boolean);
  ok('ZIP: все ' + files.length + ' файлов в архиве', files.every(f => names.includes(f.name)));
  const md = execSync('python3 -c "import zipfile;print(zipfile.ZipFile(\'/home/z/my-project/scripts/_zipcheck.zip\').read(\'dialog-test.md\').decode()[:40])"').toString();
  ok('ZIP: диалог-MD читается из архива', md.includes('---'));
  console.log('\nИТОГ: PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail ? 1 : 0);
});
