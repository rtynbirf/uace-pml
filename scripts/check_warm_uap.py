#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WCAG-проверка канонической Тёплой палитры линии B для STP-1 v1.0 (uap-токены)."""

def lum(hex_color):
    h = hex_color.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    def f(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = f(r), f(g), f(b)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

WARM = {
    'bg': '#f6efe2', 'surface': '#fdf8ee', 'fg': '#3a3226', 'muted': '#6b5f4c',
    'line': '#d8ccb4', 'accent': '#8a5a00', 'accentTx': '#ffffff',
    'ok': '#4a6b1f', 'warn': '#a04b00', 'err': '#a63a2a',
}

PAIRS = [
    ('осн. текст', WARM['bg'], WARM['fg'], 7.0),
    ('втор. текст', WARM['bg'], WARM['muted'], 4.5),
    ('акцент на фоне', WARM['bg'], WARM['accent'], 4.5),
    ('текст на акценте', WARM['accent'], WARM['accentTx'], 4.5),
    ('ok на фоне', WARM['bg'], WARM['ok'], 4.5),
    ('warn на фоне', WARM['bg'], WARM['warn'], 4.5),
    ('err на фоне', WARM['bg'], WARM['err'], 4.5),
    ('осн. на surface', WARM['surface'], WARM['fg'], 7.0),
    ('втор. на surface', WARM['surface'], WARM['muted'], 4.5),
]

print('=== ТЁПЛАЯ (канон линии B) ===')
fails = 0
for name, a, b, need in PAIRS:
    r = ratio(a, b)
    ok = r >= need
    fails += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  {name:<18} {a} vs {b}  {r:.2f}:1  (need {need})")

# Проверка дыры замороженного текста: синий fallback #4da3ff на тёплом фоне
print('\n=== ДЫРА STP-1 §4: #4da3ff как fallback на Тёплой ===')
r = ratio(WARM['bg'], '#4da3ff')
print(f"{'PASS' if r >= 4.5 else 'FAIL'}  bg-Тёплой vs #4da3ff  {r:.2f}:1  (need 4.5)")

# Базовые пары их замороженных палитр (контроль, что остальное тянет)
print('\n=== Контроль их баз (композит dark bg = #141414) ===')
for name, a, b, need in [
    ('dark fg', '#141414', '#e8ecef', 7.0), ('dark muted', '#141414', '#9aa7b1', 4.5),
    ('dark fb-accent', '#141414', '#4da3ff', 4.5), ('light fg', '#f2f5f7', '#1c2126', 7.0),
    ('light muted', '#f2f5f7', '#5c6770', 4.5), ('light fb-accent', '#f2f5f7', '#0b62c4', 4.5),
]:
    r = ratio(a, b)
    print(f"{'PASS' if r >= need else 'FAIL'}  {name:<16} {r:.2f}:1")

print(f"\nИТОГ: {'ВСЕ ПАРЫ ТЯНУТ' if fails == 0 else f'ПРОВАЛОВ: {fails}'}")
