// Функциональный тест buildStyledHTML: извлекаем стилевой движок из собранного v27.3.0 и строим документ.
const fs = require('fs');
const src = fs.readFileSync('/home/z/my-project/download/UACE-v27.3.0-STYLES-ACCENT.user.js', 'utf8');

const start = src.indexOf('  // ============ v27.2 STYLES ENGINE: PDF/HTML по шаблону МАКТ-2026 ============');
const end = src.indexOf('  // ============ ДОСТАВКА: BLOB / СОБСТВЕННЫЙ ZIP (без CDN) / PDF ============');
if (start < 0 || end < 0) { console.error('блок стилей не найден'); process.exit(1); }
let block = src.slice(start, end);

// моки зависимостей движка (в IIFE они определены выше)
const SCRIPT_VER = '27.3.0';
const now = () => '2026-09-19 12:00';
const platformName = () => 'Тест-платформа';
const sanitize = (s) => String(s || '').replace(/[^\wа-яёА-ЯЁ\- ]+/g, '_').slice(0, 60).trim() || 'chat';

const TPL_KEY = 'uaice_tpl';
const store = { uaice_tpl: 'swiss' };
const safeStorageGet = (k) => store[k] || '';
const safeStorageSet = (k, v) => { store[k] = v; };

const factory = new Function('SCRIPT_VER', 'now', 'platformName', 'sanitize', 'safeStorageGet', 'safeStorageSet', 'location', 'roleLabel', 'mdInline', `
  const api = {};
  ${block.replace(/^  /gm, '')}
  api.buildStyledHTML = buildStyledHTML;
  api.tplStyleId = tplStyleId;
  api.TPL_STYLES = TPL_STYLES;
  return api;
`);
const roleLabel = (r) => r === 'user' ? 'User' : (r === 'assistant' ? 'Assistant' : 'System');
const mdInline = (s) => String(s || '');
const api = factory(SCRIPT_VER, now, platformName, sanitize, safeStorageGet, safeStorageSet, { href: 'https://test.local/chat/1' }, roleLabel, mdInline);

const fakeScraped = { items: [
  { role: 'user', text: 'Вопрос про проверку стилей' },
  { role: 'assistant', text: 'Ответ с **markdown** и кодом:\n```js\nconsole.log(1);\n```' },
] };
const html = api.buildStyledHTML(fakeScraped, 'Тестовый диалог', {});

const checks = [
  ['DOCTYPE', html.startsWith('<!DOCTYPE html>')],
  ['data-tpl=swiss (из storage)', html.includes('data-tpl="swiss"')],
  ['CSS внутри', html.includes('--ink:')],
  ['паспорт страницы', html.includes('Паспорт страницы')],
  ['cover/kicker', html.includes('class="kicker"')],
  ['мета: сообщений 2', html.includes('>2<')],
  ['колофон v27.3.0', html.includes('Universal AI Chat Exporter v27.3.0')],
  ['бар переключения стилей', html.includes('tpl-bar') || html.includes('tpl-btn')],
  ['кириллица цела', html.includes('Вопрос про проверку стилей')],
  ['5 стилей в TPL_STYLES', Object.keys(api.TPL_STYLES).length === 5],
  ['tplStyleId = swiss', api.tplStyleId() === 'swiss'],
];
let bad = 0;
for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + n); if (!ok) bad++; }
fs.writeFileSync('/home/z/my-project/scripts/v273-styled-sample.html', html);
console.log('размер документа:', html.length, 'байт');
process.exit(bad ? 1 : 0);
