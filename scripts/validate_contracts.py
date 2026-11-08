#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# П54 · КОНТРАКТ-СНАПШОТЫ 36 ДОМЕНОВ — python3-валидатор (issue uace-pml#5, волна ×6)
# ───────────────────────────────────────────────────────────────────────────
# Что это: НЕЗАВИСИМЫЙ (от node-раннера scripts/contract_runner.mjs волны ×4)
# CI-гейт на stdlib Python: на фиксированных HTML-фикстурах (contracts/fixtures/)
# воспроизводит конвейер экспорта (распознавание домена по РЕАЛЬНОМУ реестру
# scripts/v29/p3_platforms.js → платформенные селекторы → лестница ролей §5 →
# ChatDocument) и сверяет результат с JSON-схемой контракта
# contracts/schema/chatdocument.schema.json, с манифестом доменов
# contracts/manifest.json и со снапшотом expected.json.
#
# Зачем второй гейт: две независимые реализации (Node/JS и Python) ловят
# разные классы ошибок — правка селектора/роли в p3, дрейф схемы, ручная
# правка expected.json, рассинхрон манифеста — всё = красный с ТОЧНЫМ
# именем платформы/домена.
#
# Принципы (согласованы с contract_runner.mjs):
#  - только stdlib (html.parser, re, json, urllib) — ноль зависимостей;
#  - контракт пинит ПЛАТФОРМЕННЫЕ селекторы: generic-фолбэки/структурная
#    стратегия findMessages не воспроизводятся (в песочнике их нет) —
#    сломанный адаптер = красный, «спасающий» фолбэк не участвует;
#  - реестр 36 адаптеров парсится из ЖИВОГО p3 (имена, host-регэкспы,
#    msgSelectors, roleAttr, chatUrlPattern, source-хэш role-функций) —
#    правка p3 без перепиновки манифеста = красный;
#  - геометрия браузера в контракт не входит: filterValid в песочнице
#    считает элементы видимыми (константа 400×80) — это часть среды
#    фикстуры, не домена (зеркало getBoundingClientRect-стаба раннера);
#  - capturedAt в песочнице детерминирован и в снапшот не входит →
#    двойной прогон байт-в-байт идентичен.
#
# Запуск:
#   python3 scripts/validate_contracts.py            # 36 доменов + сверки, rc=0/1
#   python3 scripts/validate_contracts.py --emit-manifest
#       # перегенерировать contracts/manifest.json по живому p3 (с ревью diff!)
# ═══════════════════════════════════════════════════════════════════════════
import json
import math
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
P3 = os.path.join(ROOT, 'scripts', 'v29', 'p3_platforms.js')
P1 = os.path.join(ROOT, 'scripts', 'v29', 'p1_header_core.js')
CONTRACTS = os.path.join(ROOT, 'contracts')
FIXTURES = os.path.join(CONTRACTS, 'fixtures')
SCHEMA_PATH = os.path.join(CONTRACTS, 'schema', 'chatdocument.schema.json')
MANIFEST_PATH = os.path.join(CONTRACTS, 'manifest.json')
EXPECTED_DOMAINS = 36

# ────────────────────────── мини-DOM (html.parser) ──────────────────────────
VOID_TAGS = {'meta', 'link', 'br', 'hr', 'img', 'input', 'base', 'source', 'wbr', 'col', 'area'}


class El:
    __slots__ = ('tag', 'attrs', 'children', 'parent')

    def __init__(self, tag, attrs, parent):
        self.tag = tag.lower()          # html.parser отдаёт нижний регистр; сравнения внутри движка тоже в нижнем
        self.attrs = {k.lower(): (v if v is not None else '') for k, v in attrs}
        self.children = []              # El | str
        self.parent = parent

    def get_attr(self, name):
        return self.attrs.get(name.lower())

    def class_name(self):
        return self.attrs.get('class') or ''

    def id_value(self):
        return self.attrs.get('id') or ''

    def text_content(self):
        out = []

        def rec(n):
            for c in n.children:
                if isinstance(c, El):
                    rec(c)
                else:
                    out.append(c)
        rec(self)
        return ''.join(out)

    def contains(self, other):
        p = other
        while p is not None:
            if p is self:
                return True
            p = p.parent
        return False

    def closest(self, sel_group):
        p = self
        while p is not None:
            try:
                if matches_group(p, sel_group):
                    return p
            except SelectorError:
                return None
            p = p.parent
        return None

    def walk(self):
        for c in self.children:
            if isinstance(c, El):
                yield c
                yield from c.walk()


class _Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = El('#document', [], None)
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        el = El(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(el)
        if tag.lower() not in VOID_TAGS:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        el = El(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(el)

    def handle_endtag(self, tag):
        t = tag.lower()
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == t:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if data:
            self.stack[-1].children.append(data)


def parse_html(src):
    b = _Builder()
    b.feed(src)
    b.close()
    return b.root


# ────────────── мини-движок CSS-селекторов (подмножество адаптеров) ──────────────
class SelectorError(Exception):
    pass


def _split_top(s, sep=','):
    out, depth, q, start = [], 0, None, 0
    for i, c in enumerate(s):
        if q:
            if c == q:
                q = None
            continue
        if c in '"\'':
            q = c
            continue
        if c in '[(':
            depth += 1
        elif c in '])':
            depth -= 1
        elif c == sep and depth == 0:
            out.append(s[start:i])
            start = i + 1
    out.append(s[start:])
    return out


def _parse_compound(s):
    p = {'tag': None, 'id': None, 'classes': [], 'attrs': [], 'nots': []}
    i = 0
    while i < len(s):
        c = s[i]
        if c == '*':
            i += 1
        elif c == '#':
            m = re.match(r'[-\w]+', s[i + 1:])
            if not m:
                raise SelectorError('#' + s[i:])
            p['id'] = m.group(0)
            i += 1 + m.end()
        elif c == '.':
            m = re.match(r'[-\w]+', s[i + 1:])
            if not m:
                raise SelectorError('.' + s[i:])
            p['classes'].append(m.group(0))
            i += 1 + m.end()
        elif c == '[':
            j = i + 1
            q = None
            depth = 1
            while j < len(s):
                ch = s[j]
                if q:
                    if ch == q:
                        q = None
                elif ch in '"\'':
                    q = ch
                elif ch == '[':
                    depth += 1
                elif ch == ']':
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            if depth != 0:
                raise SelectorError(s[i:j + 1])
            inner = s[i + 1:j].strip()
            i = j + 1
            mm = re.match(r'^([-\w]+)\s*(?:([*$^|~]?=)\s*("([^"]*)"|\'([^\']*)\'|([^]]*?)))?\s*(i)?\s*$', inner)
            if not mm:
                raise SelectorError('[' + inner + ']')
            if mm.group(4) is not None:
                val = mm.group(4)
            elif mm.group(5) is not None:
                val = mm.group(5)
            elif mm.group(6) is not None:
                val = mm.group(6).strip()
            else:
                val = None
            p['attrs'].append({'name': mm.group(1).lower(), 'op': mm.group(2), 'value': val, 'ci': bool(mm.group(7))})
        elif s.startswith(':not(', i):
            j = i + 5
            depth = 1
            while j < len(s):
                if s[j] == '(':
                    depth += 1
                elif s[j] == ')':
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            if depth != 0:
                raise SelectorError(s[i:j + 1])
            p['nots'].append(_parse_compound(s[i + 5:j]))
            i = j + 1
        elif re.match(r'[a-zA-Z]', c):
            m = re.match(r'[-\w]+', s[i:])
            p['tag'] = m.group(0).lower()
            i += m.end()
        else:
            i += 1
    return p


def _match_attr(el, a):
    v = el.get_attr(a['name'])
    if v is None:
        return False
    if a['op'] is None:
        return True
    val = v.lower() if a['ci'] else v
    t = (a['value'] or '').lower() if a['ci'] else (a['value'] or '')
    if a['op'] == '=':
        return val == t
    if a['op'] == '*=':
        return t in val
    if a['op'] == '^=':
        return val.startswith(t)
    if a['op'] == '$=':
        return val.endswith(t)
    if a['op'] == '~=':
        return t in re.split(r'\s+', val)
    if a['op'] == '|=':
        return val == t or val.startswith(t + '-')
    return False


def _match_one(el, p):
    if p['tag'] and el.tag != p['tag']:
        return False
    if p['id'] and el.id_value() != p['id']:
        return False
    cls = re.split(r'\s+', el.class_name()) if el.class_name() else ['']
    for c in p['classes']:
        if c not in cls:
            return False
    for a in p['attrs']:
        if not _match_attr(el, a):
            return False
    for n in p['nots']:
        if _match_one(el, n):
            return False
    return True


def matches_group(el, group):
    return any(_match_one(el, _parse_compound(part.strip())) for part in _split_top(group))


def qsa(root, sel):
    out = []
    for el in root.walk():
        try:
            if matches_group(el, sel):
                out.append(el)
        except SelectorError:
            pass  # неизвестный селектор = 0 совпадений (как в JS-раннере)
    return out


# ─────────────────────── парсер РЕАЛЬНОГО реестра p3_platforms.js ───────────────────────
def _js_skip_ws(src, i):
    while i < len(src) and src[i] in ' \t\r\n':
        i += 1
    return i


def _js_string(src, i):
    assert src[i] == "'", 'ожидалась строка'
    j = i + 1
    while j < len(src):
        if src[j] == '\\':
            j += 2
            continue
        if src[j] == "'":
            break
        j += 1
    return src[i + 1:j], j + 1


def _js_bracket(src, i, open_c, close_c):
    assert src[i] == open_c
    depth, j, q = 0, i, None
    while j < len(src):
        c = src[j]
        if q:
            if c == q:
                q = None
        elif c in '"\'':
            q = c
        elif c == open_c:
            depth += 1
        elif c == close_c:
            depth -= 1
            if depth == 0:
                return src[i + 1:j], j + 1
        j += 1
    raise ValueError('несбалансированные скобки')


def _js_regex(src, i):
    j = i + 1
    while j < len(src):
        if src[j] == '\\':
            j += 2
            continue
        if src[j] == '/':
            break
        j += 1
    source = src[i + 1:j]
    k = j + 1
    m = re.match(r'[a-z]*', src[k:])
    flags = m.group(0)
    return source, flags, k + len(flags)


def _js_value(src, i):
    """Значение поля: строка | [массив] | /регэксп/ | {объект} | выражение до top-level ','."""
    i = _js_skip_ws(src, i)
    c = src[i]
    if c == "'":
        return ('string',) + _js_string(src, i)
    if c == '[':
        body, end = _js_bracket(src, i, '[', ']')
        return ('array', body, end)
    if c == '/':
        source, flags, end = _js_regex(src, i)
        return ('regex', source, flags, end)
    if c == '{':
        body, end = _js_bracket(src, i, '{', '}')
        return ('object', body, end)
    depth, q, j = 0, None, i
    while j < len(src):
        ch = src[j]
        if q:
            if ch == q:
                q = None
        elif ch in '"\'':
            q = ch
        elif ch in '([{':
            depth += 1
        elif ch in ')]}':
            if depth == 0:
                break
            depth -= 1
        elif ch == ',' and depth == 0:
            break
        j += 1
    return ('expr', src[i:j].strip(), j)


def _field(body, key):
    """Позиция после «key:» — ключ-поле литерала (после { или , вне строк)."""
    m = re.search(r'(?:\{|,|^)\s*' + key + r'\s*:', body)
    if m:
        return m.end()
    return None


def parse_platforms(src):
    m = re.search(r'const\s+PLATFORMS\s*=\s*\[', src)
    if not m:
        raise ValueError('PLATFORMS не найден в p3')
    body, _ = _js_bracket(src, m.end() - 1, '[', ']')
    plats = []
    i = 0
    while i < len(body):
        i = _js_skip_ws(body, i)
        if i >= len(body) or body[i] != '{':
            break
        entry, i = _js_bracket(body, i, '{', '}')
        plats.append(_parse_entry(entry))
        i = _js_skip_ws(body, i)
        if i < len(body) and body[i] == ',':
            i += 1
    return plats


def _parse_entry(entry):
    p = {'name': None, 'hostsRe': [], 'path': None, 'msgSelectors': [], 'roleAttr': None,
         'chatUrlPattern': None, 'roleSrc': None}
    pos = _field(entry, 'name')
    if pos is None:
        raise ValueError('адаптер без name: ' + entry[:80])
    p['name'] = _js_value(entry, pos)[1]

    pos = _field(entry, 'hosts')
    if pos is not None:
        kind, body, _end = _js_value(entry, pos)
        for item in _split_top(body):
            item = item.strip()
            if not item:
                continue
            _k, src2, flags2, _e = _js_value(item, 0)
            p['hostsRe'].append((src2, flags2))
    pos = _field(entry, 'path')
    if pos is not None:
        _k, src2, flags2, _e = _js_value(entry, pos)
        p['path'] = (src2, flags2)
    pos = _field(entry, 'msgSelectors')
    if pos is not None:
        _k, body, _e = _js_value(entry, pos)
        for item in _split_top(body):
            item = item.strip()
            if item:
                p['msgSelectors'].append(_js_value(item, 0)[1])
    pos = _field(entry, 'roleAttr')
    if pos is not None:
        p['roleAttr'] = _js_value(entry, pos)[1]
    pos = _field(entry, 'chatUrlPattern')
    if pos is not None:
        p['chatUrlPattern'] = _js_value(entry, pos)[1]
    pos = _field(entry, 'role')
    if pos is not None:
        kind, val, _e = _js_value(entry, pos)
        src = ('{' + val + '}') if kind == 'object' else val
        p['roleSrc'] = re.sub(r'\s+', ' ', src.strip())
    return p


def js_re(source, flags):
    f = re.I if 'i' in (flags or '') else 0
    return re.compile(source, f)


def fnv1a32(s):
    h = 0x811c9dc5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def fnv1a_hex(s):
    return format(fnv1a32(s), '08x')


def round2(v):
    return math.floor(v * 100 + 0.5) / 100  # семантика Math.round (вверх на .5), v >= 0


# ─────────────────── python-зеркала конвейера экспорта (p1/p2/p3/p4) ───────────────────
ROLE_ATTRS = ['data-message-author-role', 'data-message-role', 'data-role', 'data-author', 'data-sender']
ROLE_LEVELS = {'attribute': 0.99, 'platform-selector': 0.95, 'semantic-class': 0.80,
               'ancestor': 0.70, 'structural-order': 0.60, 'framework-internal': 0.55, 'heuristic': 0.00}
TESTID_CONFIDENCE = 0.97
SCORE_THRESHOLD = 0.55
DEDUPE_CAP = 400
TEXT_CAP = 200000
UI_PREFIX_RE = re.compile(
    r'^\s*(вы сказали|you said|пользователь|user|chatgpt сказал|claude сказал|gemini сказал|'
    r'ассистент|assistant|бот|bot ответил|copilot сказал)\s*[:：—-]*\s*', re.I)
SKIP_TAGS = {'style', 'script', 'link', 'meta', 'noscript', 'template', 'head', 'title',
             'base', 'html', 'svg', 'path', 'mat-icon', 'br', 'hr'}
UI_HOST_ID = 'uaice-29'
HARD_EXCLUDE_SEL = '#' + UI_HOST_ID + ',#' + UI_HOST_ID + '-host,[class*="tooltip"]:not([class*="content"])'
CHAT_AREA_SEL = ('div.chat-container,#chat-history,[data-test-id="chat-history-container"],'
                 'conversation-container,div.conversation-container,ms-chat-turn,'
                 '[class*="chat-history-scroll"],[class*="turn-content"],main,[role="main"]')
UI_ZONE_SEL = 'nav,aside,header,footer,[role="navigation"],[role="banner"],button,[role="button"],[role="menu"],form'


def role_from_value(v):
    if v is None or v == '':
        return None
    s = str(v).lower()
    if re.search(r'system', s):
        return 'system'
    if re.search(r'user|human|question|query', s):
        return 'user'
    if re.search(r'assistant|bot|model|gpt|response|answer|reply', s):
        return 'assistant'
    return None


def _matches(el, group):
    try:
        return matches_group(el, group)
    except SelectorError:
        return False


def _cls(el):
    return el.class_name()


# python-зеркала role-функций p3 (ключ = точное имя адаптера). Дрейф контролируется
# дважды: (а) roleFnSig в манифесте пинит source-текст role-функции p3;
# (б) сверка результатов с expected.json — зеркала обязаны давать те же роли.
def _qwen_role(el):
    c = ((_cls(el) or '') + ' ' + (el.get_attr('data-message-role') or '') + ' ' + (el.get_attr('data-role') or ''))
    if re.search(r'user|human|question', c, re.I):
        return 'user'
    if re.search(r'assistant|bot|ai|model|response', c, re.I):
        return 'assistant'
    return 'unknown'


def _mistral_role(el):
    r = el.get_attr('data-message-role') or ''
    if re.search(r'user', r, re.I):
        return 'user'
    if re.search(r'assistant', r, re.I):
        return 'assistant'
    return 'user' if re.search(r'user', _cls(el) or '', re.I) else 'assistant'


def _zai_role(el):
    e = el.get_attr('data-role') or el.get_attr('data-message-role') or ''
    if e:
        return 'user' if re.search(r'user|human', e, re.I) else 'assistant'
    return 'user' if re.search(r'user|human', _cls(el) or '', re.I) else 'assistant'


def _dola_role(el):
    c = (_cls(el) or '').lower()
    if re.search(r'user|human|question', c):
        return 'user'
    if re.search(r'bot|assistant|ai|response|reply', c):
        return 'assistant'
    return 'unknown'


def _plain_user_human(el):
    return 'user' if re.search(r'user|human', _cls(el) or '', re.I) else 'assistant'


PLATFORM_ROLE_FNS = {
    'ChatGPT': None,
    'Claude': lambda el: 'user' if _matches(el, '[data-testid="user-message"], .font-user-message') else 'assistant',
    'Gemini': lambda el: ('user' if el.tag == 'user-query' else ('assistant' if el.tag == 'model-response' else ('user' if re.search(r'user|query|human', _cls(el) or '', re.I) else 'assistant'))),
    'Google AI Studio': lambda el: 'user' if (el.get_attr('data-role') or '') == 'user' else 'assistant',
    'DeepSeek': _plain_user_human,
    'Qwen': _qwen_role,
    'Kimi': lambda el: 'user' if re.search(r'user|human', (_cls(el) or '') + ' ' + (el.get_attr('data-role') or ''), re.I) else 'assistant',
    'MiniMax': _plain_user_human,
    'Mistral Le Chat': _mistral_role,
    'Groq': _plain_user_human,
    'OpenRouter': _plain_user_human,
    'HuggingChat': _plain_user_human,
    'NVIDIA NIM': _plain_user_human,
    'Z.ai': _zai_role,
    'Pollinations': _plain_user_human,
    'Puter': _plain_user_human,
    'Open WebUI': _plain_user_human,
    'Cloudflare AI': _plain_user_human,
    'Grok': _plain_user_human,
    'Microsoft Copilot': _plain_user_human,
    'Perplexity': lambda el: 'user' if re.search(r'query|user|human', _cls(el) or '', re.I) else 'assistant',
    'Poe': lambda el: 'user' if re.search(r'human|user', _cls(el) or '', re.I) else 'assistant',
    'Character.ai': _plain_user_human,
    'You.com': _plain_user_human,
    'Doubao': _plain_user_human,
    'Tencent Yuanbao': _plain_user_human,
    'Meta AI': _plain_user_human,
    'Yandex Alice AI': _plain_user_human,
    'Yandex Alice (path)': _plain_user_human,
    'Dola': _dola_role,
    'LM Arena': _plain_user_human,
    'NotebookLM': lambda el: 'user' if re.search(r'user|query|question', _cls(el) or '', re.I) else 'assistant',
    'GitHub Copilot': lambda el: 'user' if re.search(r'user', ((el.get_attr('data-testid') or '') + ' ' + el.class_name()), re.I) else 'assistant',
    'Coze': lambda el: 'user' if re.search(r'user|human|question', _cls(el) or '', re.I) else 'assistant',
    'Phind': lambda el: 'user' if re.search(r'question|user|human', _cls(el) or '', re.I) else 'assistant',
    'v0 (Vercel)': _plain_user_human,
}


def extract_role_raw(el, platform):
    for a in ROLE_ATTRS:
        v = el.get_attr(a)
        r = role_from_value(v)
        if r:
            return r, 'attribute', ROLE_LEVELS['attribute'], a + '=' + str(v)[:40]
    tid = el.get_attr('data-testid') or el.get_attr('data-test-id') or ''
    tv = role_from_value(tid)
    if tv:
        return tv, 'attribute', TESTID_CONFIDENCE, 'testid=' + tid[:40]
    fn = PLATFORM_ROLE_FNS.get(platform['name'])
    if fn is not None:
        try:
            r = fn(el)
            if r in ('user', 'assistant', 'system'):
                return r, 'platform-selector', ROLE_LEVELS['platform-selector'], platform['name']
        except Exception:
            pass  # platform-role-threw — как в p2
    cls = el.class_name() + ((' #' + el.id_value()) if el.id_value() else '')
    cv = role_from_value(cls)
    if cv:
        return cv, 'semantic-class', ROLE_LEVELS['semantic-class'], 'class/id: ' + cls[:60]
    anc, i = el.parent, 1
    while anc is not None and i <= 3:
        av = role_from_value(anc.get_attr('data-message-author-role') or anc.get_attr('data-message-role') or anc.get_attr('data-role'))
        if av:
            return av, 'ancestor', ROLE_LEVELS['ancestor'], 'ancestor+' + str(i) + ' (' + anc.tag + ')'
        i += 1
        anc = anc.parent
    return 'unknown', 'heuristic', 0, 'сигналы ролей противоречивы или отсутствуют'


def text_of(el):
    t = el.text_content()
    t = UI_PREFIX_RE.sub('', t, count=1)
    t = t.strip()
    if len(t) > TEXT_CAP:
        t = t[:TEXT_CAP]
    return t


def get_platform(host, path, registry):
    for p in registry:
        ok = any(js_re(src, fl).search(host or '') for src, fl in p['hostsRe'])
        if not ok:
            continue
        if p['path'] is not None and not js_re(*p['path']).search(path or ''):
            continue
        return p
    return None


def chat_id_from(platform, url):
    try:
        u = urlparse(url)
        if platform and platform.get('chatUrlPattern'):
            tmpl = [x for x in platform['chatUrlPattern'].split('/') if x]
            parts = [x for x in (u.path or '').split('/') if x]
            if len(parts) >= len(tmpl):
                cid, ok = None, True
                for i in range(len(tmpl)):
                    if tmpl[i] == '{id}':
                        cid = parts[i]
                    elif parts[i] != tmpl[i]:
                        ok = False
                        break
                if ok and cid:
                    return cid
        return None
    except Exception:
        return None


def filter_valid(els):
    # геометрия/стиль в песочнице контракта = константа «элемент видим» (зеркало
    # getBoundingClientRect/getComputedStyle-стаба contract_runner.mjs: 400×80)
    out = []
    for el in els:
        if el is None or el.tag in SKIP_TAGS:
            continue
        if el.closest(HARD_EXCLUDE_SEL) is not None:
            continue
        out.append(el)
    return out


def dedupe_nested(items):
    arr = list(items)[:DEDUPE_CAP]
    if len(arr) < 2:
        return arr
    idset = set(map(id, arr))

    def near_anc(el):
        p = el.parent
        while p is not None:
            if id(p) in idset:
                return p
            p = p.parent
        return None

    held_by = {}
    for el in arr:
        a = near_anc(el)
        if a is not None:
            held_by[id(a)] = held_by.get(id(a), 0) + 1
    containers = {k for k, c in held_by.items() if c >= 2}
    out = []
    for el in arr:
        if id(el) in containers:
            continue  # контейнер-«зонтик» долой
        a = near_anc(el)
        if a is not None and id(a) not in containers:
            continue  # вложен в кандидата-дубликата
        out.append(el)
    return out


def is_ui_zone(el):
    return el.closest(UI_ZONE_SEL) is not None


def chat_area_root(root):
    for el in qsa(root, CHAT_AREA_SEL):
        return el  # visible() в песочнике — константа true; первый в порядке документа
    return None


def candidate_features(els, platform, area_root):
    count = len(els)
    known = users = assistants = ui = in_area = non_empty = 0
    len_sum = 0
    sigs = {}
    for el in els:
        r, _, _, _ = extract_role_raw(el, platform)
        if r == 'user':
            users += 1
            known += 1
        elif r == 'assistant':
            assistants += 1
            known += 1
        sig = el.tag.upper() + '|' + (re.split(r'\s+', el.class_name())[0] if el.class_name() else '')
        sigs[sig] = sigs.get(sig, 0) + 1
        if is_ui_zone(el):
            ui += 1
        if area_root is not None and (el is area_root or area_root.contains(el)):
            in_area += 1
        ln = len(el.text_content().strip())
        if ln > 0:
            non_empty += 1
        len_sum += ln
    nested = 0
    for el in els:
        for other in els:
            if other is not el and other.contains(el):
                nested += 1
                break
    avg = (len_sum / count) if count else 0
    return {
        'count': count,
        'roleCoherence': (known / count) if count else 0,
        'membership': (in_area / count) if area_root is not None else 0.5,
        'uniformity': ((max(sigs.values()) if sigs else 0) / count) if count else 0,
        'orderConsistency': ((1 if (users > 0 and assistants > 0) else 0.2) if count >= 3 else 0.4),
        'textQuality': (min(1, (non_empty / count) * (1 if avg >= 8 else avg / 8))) if count else 0,
        'nestedShare': (nested / count) if count else 0,
        'uiShare': (ui / count) if count else 0,
        'cleanliness': (1 - min(1, ui / count)) if count else 0,
        'users': users,
        'assistants': assistants,
    }


def score_candidates(f):
    reasons = []
    if not f or not f.get('count') or f['count'] < 2:
        return {'score': 0, 'pass': False, 'reasons': ['count<2']}
    s = (0.30 * f['roleCoherence'] + 0.20 * f['membership'] + 0.15 * f['uniformity']
         + 0.15 * f['orderConsistency'] + 0.10 * f['textQuality'] + 0.10 * f['cleanliness'])
    if f['nestedShare'] > 0.3:
        s -= 0.15
        reasons.append('nesting-penalty')
    if f['uiShare'] > 0.2:
        s -= 0.15 + 0.3 * f['uiShare']
        reasons.append('ui-penalty')
    if f['roleCoherence'] == 0:
        reasons.append('role-evidence:0')
    s = max(0, min(1, s))
    return {'score': round2(s), 'pass': s >= SCORE_THRESHOLD and f['roleCoherence'] > 0 and f['uiShare'] <= 0.3, 'reasons': reasons}


def find_messages_pinned(platform, root):
    """Зеркало findMessages с пином контракта: ТОЛЬКО платформенные селекторы
    (generic-фолбэки обнулены, структурная стратегия отключена — как в раннере ×4)."""
    attempts = []
    for sel in platform.get('msgSelectors') or []:
        raw = qsa(root, sel)
        attempts.append((sel, filter_valid(raw)[:DEDUPE_CAP]))
    area = chat_area_root(root)
    best = None
    for sel, valid in attempts:
        if len(valid) < 2:
            continue
        ded = dedupe_nested(valid)
        if len(ded) < 2:
            continue
        f = candidate_features(ded, platform, area)
        s = score_candidates(f)
        if s['pass'] and (best is None or s['score'] > best[0]['score']):
            best = (s, ded, sel)
    if not best:
        return None
    return {'els': best[1], 'sel': best[2], 'score': best[0]['score']}


def parse_p1_consts():
    src = open(P1, encoding='utf-8').read()
    ver = re.search(r"const\s+UACE_VER\s*=\s*'([^']+)'", src)
    sv = re.search(r"const\s+SCHEMA_VER\s*=\s*'([^']+)'", src)
    return (ver.group(1) if ver else '?'), (sv.group(1) if sv else '?')


def make_chat_document(o, uace_ver, schema_ver):
    msgs = []
    for i, m in enumerate(o.get('messages') or []):
        role = m.get('role') if m.get('role') in ('user', 'assistant', 'system') else 'unknown'
        rev = m.get('roleEvidence') if (m.get('roleEvidence') or {}).get('method') else {'method': 'heuristic', 'confidence': 0, 'reason': 'no-signals'}
        msgs.append({
            'index': i, 'role': role, 'roleEvidence': rev,
            'text': str(m.get('text') or ''),
            'markdown': m.get('markdown') if m.get('markdown') is not None else str(m.get('text') or ''),
            'thinking': m.get('thinking') or [], 'images': m.get('images') or [],
            'attachments': m.get('attachments') or [], 'artifacts': m.get('artifacts') or [],
        })
    warnings = list(o.get('warnings') or [])
    unknown_roles = sum(1 for m in msgs if m['role'] == 'unknown')
    if unknown_roles:
        warnings.append('roles unknown: ' + str(unknown_roles) + '/' + str(len(msgs)) + ' — сохранены как unknown, НЕ восстановлены догадкой')
    content_hash = fnv1a_hex('\u0002'.join(m['role'] + '\u0001' + m['text'] for m in msgs))
    return {
        'schemaVersion': schema_ver,
        'exporter': 'UACE v' + uace_ver,
        'platform': o.get('platform') or None,
        'origin': o.get('origin') or None,
        'url': o.get('url') or None,
        'chatId': o.get('chatId') or None,
        'title': str(o.get('title') or ''),
        'capturedAt': '1970-01-01T00:00:00Z',  # детерминированная песочница контракта; capturedAt вне снапшота
        'captureMode': o.get('captureMode') or 'structured',
        'captureEvidence': o.get('captureEvidence') or {'strategy': 'unknown', 'confidence': 0, 'reasons': ['no evidence supplied'], 'source': None},
        'messages': msgs,
        'integrity': {'messageCount': len(msgs), 'contentHash': content_hash, 'warnings': warnings},
    }


# ─────────────────── мини-валидатор JSON Schema (draft-07 подмножество) ───────────────────
def _js_type_of(inst):
    if inst is None:
        return 'null'
    if isinstance(inst, bool):
        return 'boolean'
    if isinstance(inst, int):
        return 'integer'
    if isinstance(inst, float):
        return 'number'
    if isinstance(inst, str):
        return 'string'
    if isinstance(inst, list):
        return 'array'
    if isinstance(inst, dict):
        return 'object'
    return 'unknown'


def validate_schema(inst, schema, root=None, out=None, path='$'):
    root = root if root is not None else schema
    out = out if out is not None else []

    def err(msg):
        out.append(path + ': ' + msg)

    if '$ref' in schema:
        target = root
        for k in schema['$ref'].split('/')[1:]:
            target = target.get(k) if isinstance(target, dict) else None
        if target is None:
            err('неразрешимый $ref ' + schema['$ref'])
            return out
        return validate_schema(inst, target, root, out, path)
    if 'const' in schema:
        if json.dumps(inst, sort_keys=True, ensure_ascii=False) != json.dumps(schema['const'], sort_keys=True, ensure_ascii=False):
            err('ожидался const ' + json.dumps(schema['const'], ensure_ascii=False) + ', получено ' + json.dumps(inst, ensure_ascii=False))
    if 'enum' in schema:
        if not any(json.dumps(inst, sort_keys=True, ensure_ascii=False) == json.dumps(v, sort_keys=True, ensure_ascii=False) for v in schema['enum']):
            err('вне enum: ' + json.dumps(inst, ensure_ascii=False))
    if 'type' in schema:
        types = schema['type'] if isinstance(schema['type'], list) else [schema['type']]
        actual = _js_type_of(inst)
        if actual not in types and not ('number' in types and actual == 'integer'):
            err('тип: ожидался ' + '|'.join(types) + ', получено ' + actual)
    if isinstance(inst, str):
        if schema.get('minLength') is not None and len(inst) < schema['minLength']:
            err('длина < ' + str(schema['minLength']))
        if schema.get('pattern'):
            if not re.search(schema['pattern'], inst):
                err('не матчится pattern ' + schema['pattern'])
        if schema.get('format') == 'date-time':
            if not re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$', inst):
                err('не date-time: ' + inst)
    if isinstance(inst, (int, float)) and not isinstance(inst, bool):
        if schema.get('minimum') is not None and inst < schema['minimum']:
            err('< minimum ' + str(schema['minimum']))
        if schema.get('maximum') is not None and inst > schema['maximum']:
            err('> maximum ' + str(schema['maximum']))
    if isinstance(inst, list):
        if schema.get('minItems') is not None and len(inst) < schema['minItems']:
            err('массив < ' + str(schema['minItems']) + ' элементов')
        if schema.get('maxItems') is not None and len(inst) > schema['maxItems']:
            err('массив > ' + str(schema['maxItems']) + ' элементов')
        if schema.get('items'):
            for i, it in enumerate(inst):
                validate_schema(it, schema['items'], root, out, path + '[' + str(i) + ']')
    if isinstance(inst, dict):
        for r in schema.get('required') or []:
            if r not in inst:
                err('нет required-поля «' + r + '»')
        for k, sub in (schema.get('properties') or {}).items():
            if k in inst:
                validate_schema(inst[k], sub, root, out, path + '.' + k)
    return out


# ─────────────────────────────── извлечение по фикстуре ───────────────────────────────
SCHEMA = None  # загружается в load_all()


def parse_fixture_meta(root):
    for el in root.walk():
        if el.tag == 'meta' and el.get_attr('name') == 'uace-fixture':
            meta = {}
            for kv in (el.get_attr('content') or '').split(';'):
                idx = kv.find('=')
                if idx > 0:
                    meta[kv[:idx].strip()] = kv[idx + 1:].strip()
            return meta
    return {}


def fixture_title(root):
    for el in root.walk():
        if el.tag == 'title':
            t = re.sub(r'\s*[\|\-–·]\s*[^|\-–·]*$', '', el.text_content()).strip()
            return (t[:200] or 'Без названия')
    return 'Без названия'


def extract_fixture(fixture_path, registry, uace_ver, schema_ver):
    """→ {ok, platform, chatId, messages, projection, chat_document, schema_errors, reason}"""
    with open(fixture_path, encoding='utf-8') as f:
        root = parse_html(f.read())
    meta = parse_fixture_meta(root)
    host = meta.get('host') or 'fixture.invalid'
    path = meta.get('path') or '/'
    plat = get_platform(host, path, registry)
    if plat is None:
        return {'ok': False, 'platform': None, 'reason': 'платформа не распознана по host/path фикстуры'}
    url = 'https://' + host + path
    chat_id = chat_id_from(plat, url)
    found = find_messages_pinned(plat, root)
    if not found or len(found['els']) < 2:
        return {'ok': False, 'platform': plat['name'], 'reason': 'findMessages: платформенные селекторы не нашли ≥2 валидных сообщений (молчаливая смена вёрстки?)'}
    messages = []
    for el in found['els']:
        role, method, conf, reason = extract_role_raw(el, plat)
        messages.append({'role': role, 'method': method, 'confidence': conf, 'reason': reason, 'text': text_of(el)})
    cd = make_chat_document({
        'platform': plat['name'], 'origin': 'https://' + host, 'url': url,
        'title': fixture_title(root), 'captureMode': 'structured',
        'captureEvidence': {'strategy': 'platform-deep', 'confidence': found['score'],
                            'reasons': ['sel:' + found['sel'], 'raw:' + str(len(found['els']))],
                            'source': None, 'sel': found['sel']},
        'messages': [{'role': m['role'], 'roleEvidence': {'method': m['method'], 'confidence': m['confidence'], 'reason': m['reason']}, 'text': m['text']} for m in messages],
        'warnings': [],
    }, uace_ver, schema_ver)
    schema_errors = validate_schema(cd, SCHEMA)
    projection = {
        'platform': cd['platform'], 'chatId': chat_id,
        'messages': [{'role': m['role'], 'method': m['roleEvidence']['method'],
                      'confidence': m['roleEvidence']['confidence'], 'text': m['text']} for m in cd['messages']],
    }
    return {'ok': len(schema_errors) == 0, 'platform': plat['name'], 'chatId': chat_id,
            'messages': messages, 'projection': projection, 'chat_document': cd,
            'schema_errors': schema_errors, 'reason': None}


def compare_with_expected(res, expected):
    diffs = []
    if res['projection']['platform'] != expected.get('platform'):
        diffs.append('платформа: ' + str(res['projection']['platform']) + ' ≠ ' + str(expected.get('platform')))
    if (res['projection'].get('chatId') or None) != (expected.get('chatId') or None):
        diffs.append('chatId: ' + str(res['projection'].get('chatId')) + ' ≠ ' + str(expected.get('chatId')))
    exp = expected.get('messages') or []
    act = res['projection']['messages']
    if len(exp) != len(act):
        diffs.append('число сообщений: ' + str(len(act)) + ' ≠ ' + str(len(exp)))
    else:
        for i, (e, a) in enumerate(zip(exp, act)):
            ev = [e.get('role'), e.get('method'), e.get('confidence'), e.get('text')]
            av = [a['role'], a['method'], a['confidence'], a['text']]
            if ev != av:
                diffs.append('сообщение #' + str(i) + ': ' + json.dumps(av, ensure_ascii=False) + ' ≠ ' + json.dumps(ev, ensure_ascii=False))
    return diffs


def validate_expected_against_schema(expected, plat_enum, role_enum, method_enum):
    """Проекция expected.json против перечислений/границ ИЗ файла схемы (не хардкод)."""
    errs = []
    plat = expected.get('platform')
    if plat not in plat_enum:
        errs.append('platform вне enum схемы: ' + str(plat))
    msgs = expected.get('messages')
    if not isinstance(msgs, list) or len(msgs) < 2:
        errs.append('messages: ожидался массив ≥2 элементов')
        return errs
    if 'chatId' in expected and expected['chatId'] is not None and not isinstance(expected['chatId'], str):
        errs.append('chatId: ожидался string|null')
    for i, m in enumerate(msgs):
        if m.get('role') not in role_enum:
            errs.append('messages[' + str(i) + '].role вне enum схемы: ' + str(m.get('role')))
        if m.get('method') not in method_enum:
            errs.append('messages[' + str(i) + '].method вне enum схемы: ' + str(m.get('method')))
        c = m.get('confidence')
        if not isinstance(c, (int, float)) or isinstance(c, bool) or c < 0 or c > 1:
            errs.append('messages[' + str(i) + '].confidence вне [0..1]: ' + str(c))
        if not isinstance(m.get('text'), str):
            errs.append('messages[' + str(i) + '].text: ожидался string')
    return errs


# ─────────────────────────────── загрузка артефактов ───────────────────────────────
def load_all():
    global SCHEMA
    registry = parse_platforms(open(P3, encoding='utf-8').read())
    SCHEMA = json.load(open(SCHEMA_PATH, encoding='utf-8'))
    manifest = json.load(open(MANIFEST_PATH, encoding='utf-8'))
    uace_ver, schema_ver = parse_p1_consts()
    return registry, SCHEMA, manifest, uace_ver, schema_ver


def fixture_dirs():
    ds = [d for d in os.listdir(FIXTURES) if re.match(r'^\d+-', d) and os.path.isdir(os.path.join(FIXTURES, d))]
    return sorted(ds)


# читаемые routing-пробы (checkHost/checkPath) — проверяются валидатором по РЕАЛЬНЫМ
# регэкспам p3 с учётом ПОРЯДКА реестра (getPlatform = первый матч)
PROBES = {
    'ChatGPT': ('chatgpt.com', '/c/abc123'),
    'Claude': ('claude.ai', '/chat/cl-1'),
    'Gemini': ('gemini.google.com', '/app/g1'),
    'Google AI Studio': ('aistudio.google.com', '/chat/1'),
    'DeepSeek': ('deepseek.com', '/a/chat/s/ds1'),
    'Qwen': ('qwen.ai', '/c/q1'),
    'Kimi': ('kimi.moonshot.cn', '/kimi/k1'),
    'MiniMax': ('minimax.io', '/chat/mm1'),
    'Mistral Le Chat': ('mistral.ai', '/chat/m1'),
    'Groq': ('groq.com', '/play/gr1'),
    'OpenRouter': ('openrouter.ai', '/or1'),
    'HuggingChat': ('huggingface.co', '/chat/hf1'),
    'NVIDIA NIM': ('build.nvidia.com', '/nim1'),
    'Z.ai': ('z.ai', '/c/z1'),
    'Pollinations': ('pollinations.ai', '/p1'),
    'Puter': ('puter.com', '/pu1'),
    'Open WebUI': ('my-openwebui.local', '/ow1'),
    'Cloudflare AI': ('playground.ai.cloudflare.com', '/cf1'),
    'Grok': ('grok.com', '/c/gk1'),
    'Microsoft Copilot': ('copilot.microsoft.com', '/cp1'),
    'Perplexity': ('perplexity.ai', '/search/pp1'),
    'Poe': ('poe.com', '/chat/poe1'),
    'Character.ai': ('character.ai', '/ch1'),
    'You.com': ('you.com', '/yc1'),
    'Doubao': ('doubao.com', '/db1'),
    'Tencent Yuanbao': ('yuanbao.tencent.com', '/yb1'),
    'Meta AI': ('meta.ai', '/ma1'),
    'Yandex Alice AI': ('alice.yandex.ru', '/ya1'),
    'Yandex Alice (path)': ('yandex.ru', '/alice/chat-1'),
    'Dola': ('dola.com', '/chat/dl1'),
    'LM Arena': ('lmarena.ai', '/la1'),
    'NotebookLM': ('notebooklm.google.com', '/nb1'),
    'GitHub Copilot': ('github.com', '/copilot/r1'),
    'Coze': ('coze.com', '/cz1'),
    'Phind': ('phind.com', '/ph1'),
    'v0 (Vercel)': ('v0.dev', '/v01'),
}


def build_manifest(registry, dirs):
    domains = []
    for i, p in enumerate(registry):
        slug = dirs[i] if i < len(dirs) else ('%02d-slug' % (i + 1))
        chost, cpath = PROBES.get(p['name'], ('fixture.invalid', '/'))
        domains.append({
            'order': i + 1,
            'name': p['name'],
            'slug': slug,
            'fixture': 'contracts/fixtures/' + slug + '/fixture.html',
            'expected': 'contracts/fixtures/' + slug + '/expected.json',
            'checkHost': chost,
            'checkPath': cpath,
            'hostsRe': [src for src, _fl in p['hostsRe']],
            'pathRe': p['path'][0] if p['path'] is not None else None,
            'msgSelectors': list(p['msgSelectors']),
            'roleAttr': p['roleAttr'],
            'chatUrlPattern': p['chatUrlPattern'],
            'roleFnSig': fnv1a_hex(p['roleSrc']) if p['roleSrc'] else None,
        })
    return domains


def emit_manifest():
    """Перегенерация contracts/manifest.json по живому p3 (с ревью diff!)."""
    registry = parse_platforms(open(P3, encoding='utf-8').read())
    dirs = fixture_dirs()
    if len(registry) != EXPECTED_DOMAINS:
        print('# ОТКАЗ: в p3 ' + str(len(registry)) + ' адаптеров вместо ' + str(EXPECTED_DOMAINS) + ' — манифест не переписан', file=sys.stderr)
        return 2
    if len(dirs) != EXPECTED_DOMAINS:
        print('# ОТКАЗ: каталогов фикстур ' + str(len(dirs)) + ' вместо ' + str(EXPECTED_DOMAINS) + ' — манифест не переписан', file=sys.stderr)
        return 2
    manifest = {
        'proposal': 'ПРЕДЛОЖЕНИЕ-54 · контракт-снапшоты 36 доменов (issue uace-pml#5)',
        'wave': 'Волна ×6 (python3-валидатор scripts/validate_contracts.py)',
        'registrySource': 'scripts/v29/p3_platforms.js',
        'schema': 'contracts/schema/chatdocument.schema.json',
        'domainsCount': EXPECTED_DOMAINS,
        'note': 'манифест ПИНИТ живой реестр p3: имена/порядок, hostsRe, pathRe, msgSelectors, roleAttr, chatUrlPattern, roleFnSig (fnv1a source-текста role-функции). checkHost/checkPath — читаемые routing-пробы, валидатор проверяет их по реальным регэкспам p3 с учётом порядка реестра. Правка p3 без перепиновки манифеста (--emit-manifest + ревью diff) = красный гейт.',
        'domains': build_manifest(registry, dirs),
        'negative': {
            'file': 'contracts/negative/ChatGPT-broken.html',
            'domain': 'ChatGPT',
            'break': 'атрибут роли data-message-author-role → data-msg-author-role (типовая молчаливая смена вёрстки)',
        },
    }
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('# manifest.json переписан по живому p3: ' + str(len(manifest['domains'])) + ' доменов')
    return 0


# ────────────────────────────────────── main ──────────────────────────────────────
def main():
    registry, schema, manifest, uace_ver, schema_ver = load_all()
    lines = []
    struct_pass = struct_fail = 0
    dom_fail = []
    fail_names = []

    def spass(group, msg):
        nonlocal struct_pass
        struct_pass += 1
        lines.append('PASS  ' + group.ljust(10) + ' ' + msg)

    def sfail(group, msg):
        nonlocal struct_fail
        struct_fail += 1
        lines.append('FAIL  ' + group.ljust(10) + ' ' + msg)

    plat_enum = (schema.get('properties') or {}).get('platform', {}).get('enum') or []
    defs = schema.get('definitions') or {}
    role_enum = (defs.get('role') or {}).get('enum') or []
    method_enum = (defs.get('evidenceMethod') or {}).get('enum') or []
    reg_names = [p['name'] for p in registry]

    # 1) реестр: ровно 36 адаптеров
    if len(registry) == EXPECTED_DOMAINS:
        spass('реестр', 'PLATFORMS: ровно ' + str(EXPECTED_DOMAINS) + ' адаптеров из ' + os.path.relpath(P3, ROOT))
    else:
        sfail('реестр', 'PLATFORMS: ' + str(len(registry)) + ' адаптеров вместо ' + str(EXPECTED_DOMAINS))

    # 2) схема ↔ реестр: enum platform = 36 имён реестра (+null), порядок совпадает
    schema_names = [x for x in plat_enum if x is not None]
    if schema_names == reg_names:
        spass('схема', 'platform.enum схемы (' + str(len(schema_names)) + ' имён + null) = реестру p3, порядок совпадает')
    else:
        diffs = []
        for i in range(max(len(schema_names), len(reg_names))):
            s = schema_names[i] if i < len(schema_names) else None
            r = reg_names[i] if i < len(reg_names) else None
            if s != r:
                diffs.append('позиция ' + str(i) + ': схема=' + str(s) + ' реестр=' + str(r))
        sfail('схема', 'platform.enum ≠ реестр p3: схема[' + str(len(schema_names)) + '] реестр[' + str(len(reg_names)) + '] — ' + '; '.join(diffs))

    # 3) манифест ↔ реестр ↔ каталог фикстур
    doms = manifest.get('domains') or []
    man_names = [d.get('name') for d in doms]
    dirs = fixture_dirs()
    if len(doms) == EXPECTED_DOMAINS and man_names == reg_names:
        spass('манифест', '36 доменов = реестру p3, порядок совпадает (name/order)')
    else:
        diffs = []
        for i in range(max(len(man_names), len(reg_names))):
            m = man_names[i] if i < len(man_names) else None
            r = reg_names[i] if i < len(reg_names) else None
            if m != r:
                diffs.append('позиция ' + str(i) + ': манифест=' + str(m) + ' реестр=' + str(r))
        sfail('манифест', 'домены ≠ реестру p3: манифест[' + str(len(doms)) + '] — ' + '; '.join(diffs))

    if [d.get('slug') for d in doms] == dirs:
        spass('манифест', 'slug/порядок = каталогам fixtures/ (' + str(len(dirs)) + ' шт.)')
    else:
        sfail('манифест', 'slug ≠ каталогам fixtures/: ' + ','.join(str(d.get('slug')) for d in doms) + ' ≠ ' + ','.join(dirs))

    man_pin_fail = 0
    for d in doms:
        name = d.get('name') or '?'
        reg = next((p for p in registry if p['name'] == name), None)
        errs = []
        if reg is None:
            errs.append('имя не найдено в реестре p3')
        else:
            if list(d.get('msgSelectors') or []) != list(reg['msgSelectors']):
                errs.append('msgSelectors ≠ p3')
            if [src for src, _f in reg['hostsRe']] != list(d.get('hostsRe') or []):
                errs.append('hostsRe ≠ p3')
            if (d.get('pathRe') if d.get('pathRe') is not None else None) != (reg['path'][0] if reg['path'] is not None else None):
                errs.append('pathRe ≠ p3')
            if (d.get('roleAttr') or None) != (reg['roleAttr'] or None):
                errs.append('roleAttr ≠ p3')
            if (d.get('chatUrlPattern') or None) != (reg['chatUrlPattern'] or None):
                errs.append('chatUrlPattern ≠ p3')
            sig = fnv1a_hex(reg['roleSrc']) if reg['roleSrc'] else None
            if (d.get('roleFnSig') or None) != (sig or None):
                errs.append('roleFnSig ≠ p3 (role-функция правилась без перепиновки манифеста)')
            chost, cpath = d.get('checkHost') or 'fixture.invalid', d.get('checkPath') or '/'
            resolved = get_platform(chost, cpath, registry)
            if resolved is None or resolved['name'] != name:
                errs.append('routing-проба ' + chost + cpath + ' → ' + str(resolved['name'] if resolved else None) + ', ожидался ' + name)
        fx = os.path.join(ROOT, d.get('fixture') or '')
        ex = os.path.join(ROOT, d.get('expected') or '')
        if not os.path.isfile(fx):
            errs.append('нет файла фикстуры ' + str(d.get('fixture')))
        if not os.path.isfile(ex):
            errs.append('нет снапшота ' + str(d.get('expected')))
        if errs:
            man_pin_fail += 1
            fail_names.append(name)
            lines.append('FAIL  манифест    ' + name.ljust(20) + ' ' + '; '.join(errs))
        else:
            lines.append('PASS  манифест    ' + name.ljust(20) + ' пинит p3 (селекторы/hostsRe/pathRe/roleAttr/chatUrlPattern/roleFnSig) · routing ' + (d.get('checkHost') or '') + (d.get('checkPath') or ''))

    # 4) негативная фикстура объявлена в манифесте и существует
    neg = manifest.get('negative') or {}
    neg_path = os.path.join(ROOT, neg.get('file') or '')
    if neg.get('domain') in reg_names and os.path.isfile(neg_path):
        spass('негатив', 'файл ' + str(neg.get('file')) + ' на месте; домен ' + str(neg.get('domain')) + ' из реестра (красный гейт доказывает scripts/test_negative.py)')
    else:
        sfail('негатив', 'negative-запись манифеста битая: file=' + str(neg.get('file')) + ' domain=' + str(neg.get('domain')))

    # 5) фикстуры × конвейер экспорта × схема × expected
    pass_domains = 0
    for d in doms:
        name = d.get('name') or '?'
        slug = d.get('slug') or '?'
        fx = os.path.join(ROOT, d.get('fixture') or '')
        ex = os.path.join(ROOT, d.get('expected') or '')
        if not os.path.isfile(fx) or not os.path.isfile(ex):
            dom_fail.append((slug, name))
            fail_names.append(name)
            lines.append('FAIL  ' + slug.ljust(24) + ' ' + name.ljust(20) + ' файлы фикстуры/снапшота отсутствуют')
            continue
        try:
            expected = json.load(open(ex, encoding='utf-8'))
        except Exception as e:
            dom_fail.append((slug, name))
            fail_names.append(name)
            lines.append('FAIL  ' + slug.ljust(24) + ' ' + name.ljust(20) + ' expected.json не парсится: ' + str(e))
            continue
        errs = validate_expected_against_schema(expected, plat_enum, role_enum, method_enum)
        try:
            res = extract_fixture(fx, registry, uace_ver, schema_ver)
        except Exception as e:
            res = {'ok': False, 'platform': None, 'reason': 'исключение: ' + str(e)}
        if not res['ok']:
            errs.append(res.get('reason') or 'извлечение не удалось')
        else:
            errs += ['schema ' + s for s in res['schema_errors']]
            errs += compare_with_expected(res, expected)
        if errs:
            dom_fail.append((slug, name))
            fail_names.append(name)
            lines.append('FAIL  ' + slug.ljust(24) + ' ' + name.ljust(20) + ' ' + ' | '.join(errs))
        else:
            pass_domains += 1
            lines.append('PASS  ' + slug.ljust(24) + ' ' + name.ljust(20) + ' ' + str(len(res['messages'])) + ' сообщ. · ' + res['messages'][0]['method'] + ' ' + str(res['messages'][0]['confidence']) + ' · integrity ' + res['chat_document']['integrity']['contentHash'])

    print('П54 · контракт-снапшоты ' + str(EXPECTED_DOMAINS) + ' доменов — python3-валидатор (волна ×6) · схема ' + str(schema.get('schemaVersion')) + ' · UACE v' + uace_ver)
    for ln in lines:
        print(ln)
    print('# Result: домены ' + str(pass_domains) + '/' + str(len(doms)) + ' passed, ' + str(len(dom_fail)) + ' failed; пины манифеста ' + str(len(doms) - man_pin_fail) + '/' + str(len(doms)) + ' passed, ' + str(man_pin_fail) + ' failed; структурные ' + str(struct_pass) + ' passed, ' + str(struct_fail) + ' failed')
    if dom_fail or man_pin_fail or struct_fail:
        print('# КРАСНЫЙ ГЕЙТ — домены/проверки со сломанным контрактом: ' + ', '.join(dict.fromkeys(fail_names)))
        return 1
    print('# GREEN: реестр 36 · схема = реестр · манифест пинит p3 · 36/36 снапшотов зелёные')
    return 0


if __name__ == '__main__':
    if '--emit-manifest' in sys.argv[1:]:
        sys.exit(emit_manifest())
    sys.exit(main())
