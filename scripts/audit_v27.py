#!/usr/bin/env python3
"""1) Coverage check: identifiers used by UI chunk must be defined in engine+chunk.
   2) Independent WCAG contrast audit of the three palettes."""
import re, sys

UI = open("/home/z/my-project/scripts/uace-v27-ui.js", encoding="utf-8").read()
SRC = open(sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/UACE-v27.1.0-HUMAN-FIRST.user.js", encoding="utf-8").read()

# --- 1. Function coverage ---
defs = set(re.findall(r"(?:function|const|let)\s+([A-Za-z_$][\w$]*)", SRC))
# params/local of buildUI are inside SRC anyway
used = set(re.findall(r"([A-Za-z_$][\w$]*)\s*\(", UI))
builtins = {"if","for","while","switch","catch","return","function","new","typeof","delete","void","in","of","do","else","try","finally","const","let","var","Math","String","Number","Boolean","Date","Promise","Object","Array","JSON","parseInt","parseFloat","isNaN","encodeURIComponent","decodeURIComponent","setTimeout","clearTimeout","setInterval","clearInterval","document","window","console","Error","RegExp","Set","Map","URL","Blob","Uint8Array","AbortController","requestAnimationFrame","fetch","alert","confirm","prompt","matchMedia","getComputedStyle"}
missing = sorted(u for u in used - defs - builtins if not u.startswith("hf_"))
# hf_ functions are defined in the chunk itself; verify they are in SRC (assembled)
not_in_final = sorted(u for u in used - builtins if u not in defs)
print("Used but NOT defined anywhere (must be empty):", not_in_final)

# leftover refs to removed UI vars
for bad in ["b3", "bThink", "bStrip", "syncThink", "updateFormatLabel", "mainBtns"]:
    hits = [m.start() for m in re.finditer(r"\b" + bad + r"\b", SRC)]
    print(f"leftover '{bad}':", len(hits))

# --- 2. WCAG contrast audit ---
def lum(hexs):
    hexs = hexs.lstrip('#')
    def f(i):
        x = int(hexs[i:i+2], 16) / 255
        return x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4)

def cr(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

pal = {
 'light': dict(bg='#fbfbfd', tx='#1d1d1f', tx2='#55555c', accent='#0b66c3', btn='#ffffff', btnTx='#1d1d1f', warn='#a04b00', ok='#1d7a3c'),
 'dark':  dict(bg='#1d1d24', tx='#f2f2f6', tx2='#b9b9c3', accent='#74b3ff', btn='#2d2d37', btnTx='#f2f2f6', warn='#ffb066', ok='#6fd08c'),
 'warm':  dict(bg='#f6efe2', tx='#3a3226', tx2='#6b5f4c', accent='#8a5a00', btn='#fdf8ee', btnTx='#3a3226', warn='#a04b00', ok='#4a6b1f'),
}
print("\nWCAG 2.2 contrast audit (norm >= 4.5 text, >= 3 UI components):")
fail = False
for name, p in pal.items():
    checks = [
        ("text/bg", p['tx'], p['bg'], 4.5),
        ("secondary/bg", p['tx2'], p['bg'], 4.5),
        ("btn text/btn", p['btnTx'], p['btn'], 4.5),
        ("accent/btn (pressed)", p['accent'], p['btn'], 3.0),
        ("warn/btn (stop)", p['warn'], p['btn'], 3.0),
        ("ok/btn", p['ok'], p['btn'], 3.0),
    ]
    row = []
    for label, fg, bg, norm in checks:
        r = cr(fg, bg)
        ok = r >= norm
        if not ok: fail = True
        row.append(f"{label}={r:.1f}:1{'OK' if ok else '!!FAIL'}")
    print(f"  {name:5s} " + " | ".join(row))
print("\nRESULT:", "ALL PASS" if not fail else "FAILURES FOUND")
