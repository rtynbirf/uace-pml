#!/usr/bin/env python3
# splice_2770.py — вставка HF-модуля (линия v26/v27.0.0) в v27.7.0 перед renderRecon
import io, sys

BASE = '/home/z/my-project/download/UACE-v27.7.0-PML-PANEL-B.user.js'
PARTS = ['/home/z/my-project/scripts/hf_mod_%d.js' % i for i in range(1, 7)]
MARKER = '\nconst renderRecon = st => {'

src = io.open(BASE, encoding='utf-8').read()
if 'ЦЕХ HUMAN-FIRST 27.7.0' in src:
    print('ALREADY-SPLICED'); sys.exit(0)
mod = '\n'.join(io.open(p, encoding='utf-8').read().rstrip() + '\n' for p in PARTS)
idx = src.find(MARKER)
assert idx > 0, 'marker not found'
out = src[:idx] + '\n' + mod + src[idx:]
io.open(BASE, 'w', encoding='utf-8').write(out)
print('SPLICED +%d bytes' % (len(out) - len(src)))
