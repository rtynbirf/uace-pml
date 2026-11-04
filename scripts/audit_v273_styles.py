#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Аудит v27.3.0: 1) UI-идентификаторы v273-ui покрыты сборкой; 2) контраст 5 стилей экспорта (tplCss)."""
import re, sys

SRC = open('/home/z/my-project/download/UACE-v27.3.0-STYLES-ACCENT.user.js', encoding='utf-8').read()
UI = open('/home/z/my-project/scripts/uace-v273-ui.js', encoding='utf-8').read()

# --- 1. Новые идентификаторы UI должны быть в собранном файле ---
need = ['TPL_STYLES', 'tplStyleId', 'safeStorageSet', 'setStatus', 'bResume', 'makeTplSelect',
        'syncTplSelects', 'selTplMain', 'selTplMore', 'rowTpl']
defs = set(re.findall(r'(?:function|const|let)\s+([A-Za-z_$][\w$]*)', SRC))
bad = [n for n in need if n not in defs]
print('1) Идентификаторы UI v27.3 в сборке:', 'ВСЕ НА МЕСТЕ' if not bad else 'ОТСУТСТВУЮТ: ' + str(bad))
# и наоборот: TPL_STYLES должен быть объявлен РАНЬШЕ UI-секции (TDZ при исполнении buildUI)
tpl_pos = SRC.find('const TPL_STYLES')
ui_pos = SRC.find('function makeTplSelect')
print('   TPL_STYLES объявлен до UI-кода:', tpl_pos < ui_pos, f'(движок @{tpl_pos}, UI @{ui_pos})')

# --- 2. Контраст стилей экспорта ---
def lum(hexs):
    h = hexs.lstrip('#')
    def f(i):
        x = int(h[i:i+2], 16) / 255
        return x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4)

def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

css = re.search(r'function tplCss\(\) \{.*?\n  \}', SRC, re.S)
css = css.group(0) if css else ''
print('2) tplCss извлечён:', len(css), 'символов')

# пары: базовые переменные + инверсии data-tpl
pairs = []
# база: из :root/.page переменных
for m in re.finditer(r'--ink:\s*(#[0-9a-fA-F]{3,6})', css): pairs.append(('ink на bg', m.group(1)))
for m in re.finditer(r'--bg:\s*(#[0-9a-fA-F]{3,6})', css): pairs.append(('BG', m.group(1)))
# соберём вручную по стилям: (имя стиля, цвет текста, фон)
manual = [
    # imperial: тёмный фон, светлый текст
    ('Имперский: текст на фоне', None, None),
]
# извлекаем блоки html[data-tpl="..."] { --... }
style_vars = {}
for m in re.finditer(r'html\[data-tpl="(\w+)"\]\s*\{([^}]*)\}', css):
    style_vars[m.group(1)] = m.group(2)
# базовые значения до переопределения
base_vars = {}
for m in re.finditer(r'(--[\w-]+):\s*(#[0-9a-fA-F]{3,6})', css):
    if m.group(1) not in base_vars:
        base_vars[m.group(1)] = m.group(2)
print('   базовые переменные:', {k: v for k, v in list(base_vars.items())[:10]})

all_ok = True
results = []
for sid, overrides in style_vars.items():
    ov = {}
    for m in re.finditer(r'(--[\w-]+):\s*(#[0-9a-fA-F]{3,6})', overrides):
        ov[m.group(1)] = m.group(2)
    ink = ov.get('--ink', base_vars.get('--ink'))
    bg = ov.get('--bg', base_vars.get('--bg'))
    ink2 = ov.get('--ink2', base_vars.get('--ink2'))
    if ink and bg:
        c = contrast(ink, bg)
        ok = c >= 4.5
        results.append(f'   {sid}: ink {ink} на bg {bg} = {c:.1f}:1 {"OK" if ok else "FAIL"}')
        if not ok: all_ok = False
    if ink2 and bg:
        c2 = contrast(ink2, bg)
        ok2 = c2 >= 4.5
        results.append(f'   {sid}: ink2 {ink2} на bg {bg} = {c2:.1f}:1 {"OK" if ok2 else "FAIL"}')
        if not ok2: all_ok = False
# золото имперского на тёмном (kicker) и роль-бейджи brutal
for m in re.finditer(r'\.kicker\{color:\s*(#[0-9a-fA-F]{3,6})', css):
    imp_ov = style_vars.get('imperial', '')
    imp_bg = (re.search(r'--bg:\s*(#[0-9a-fA-F]{3,6})', imp_ov).group(1)
              if re.search(r'--bg:\s*(#[0-9a-fA-F]{3,6})', imp_ov) else base_vars.get('--bg'))
    c = contrast(m.group(1), imp_bg)
    ok = c >= 3.0  # крупный декоративный текст — норма 3:1
    results.append(f'   imperial: kicker {m.group(1)} на bg {imp_bg} = {c:.1f}:1 {"OK(>=3)" if ok else "FAIL"}')
    if not ok: all_ok = False
# текст на бейджах ролей brutal (жёлтый/белый на тёмном/синем)
manual_pairs = re.findall(r'\.role\{[^}]*background:\s*(#[0-9a-fA-F]{3,6})[^}]*color:\s*(#[0-9a-fA-F]{3,6})', css)
for bgc, fgc in manual_pairs:
    c = contrast(fgc, bgc)
    ok = c >= 4.5
    results.append(f'   brutal: role-бейдж текст {fgc} на {bgc} = {c:.1f}:1 {"OK" if ok else "FAIL"}')
    if not ok: all_ok = False
user_badges = re.findall(r'\.msg\.user \.role\{[^}]*background:\s*(#[0-9a-fA-F]{3,6})[^}]*color:\s*(#[0-9a-fA-F]{3,6})', css)
for bgc, fgc in user_badges:
    c = contrast(fgc, bgc)
    ok = c >= 4.5
    results.append(f'   brutal: user-бейдж текст {fgc} на {bgc} = {c:.1f}:1 {"OK" if ok else "FAIL"}')
    if not ok: all_ok = False
print('\n'.join(results))
print('РЕЗУЛЬТАТ:', 'ALL PASS' if (all_ok and not bad) else 'ЕСТЬ ПРОБЛЕМЫ')
sys.exit(0 if (all_ok and not bad) else 1)
