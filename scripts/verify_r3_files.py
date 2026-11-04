#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Верификация входящих файлов раунда 3 (линия-179 -> сессия B).

Сверка содержимого upload-файлов с курьерским текстом (эталоны в scripts/_courier_*.md):
1) точное равенство после нормализации переводов строк/хвостовых пробелов;
2) иначе - курьерский текст как подстрока (чужой титул/шапка допустимы);
3) иначе - unified diff для диагноза.
md5 считается по сырым байтам.
"""
import difflib
import hashlib
import os
import sys

UP = "/home/z/my-project/upload"
EXP = "/home/z/my-project/scripts"

PAIRS = [
    (os.path.join(EXP, "_courier_master_expected.md"),
     os.path.join(UP, "PML-PANEL-1.0-FROZEN-MASTER.md")),
    (os.path.join(EXP, "_courier_struct_expected.md"),
     os.path.join(UP, "PML-STRUCT-R1-DRAFT.md")),
]


def norm(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.rstrip() for ln in text.split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines) + "\n"


def md5_of(path):
    with open(path, "rb") as fh:
        return hashlib.md5(fh.read()).hexdigest()


def main():
    ok_all = True
    for exp_path, up_path in PAIRS:
        name = os.path.basename(up_path)
        print("=" * 72)
        print("ФАЙЛ:", name)
        if not os.path.exists(up_path):
            print("  ОШИБКА: файл отсутствует")
            ok_all = False
            continue

        with open(exp_path, encoding="utf-8") as fh:
            exp = norm(fh.read())
        with open(up_path, encoding="utf-8") as fh:
            got = norm(fh.read())

        print("  md5 (raw bytes):", md5_of(up_path))
        print("  строк/символов (норм.):", len(got.splitlines()), "/", len(got))

        if got == exp:
            print("  РЕЗУЛЬТАТ: ИДЕНТИЧЕН курьерскому тексту (нормализованное равенство)")
            continue

        idx = got.find(exp)
        if idx >= 0:
            head = got[:idx]
            tail = got[idx + len(exp):]
            print("  РЕЗУЛЬТАТ: курьерский текст СОДЕРЖИТСЯ в файле целиком")
            if head.strip():
                print("  --- лишняя шапка файла (до 8 строк) ---")
                print("\n".join(head.strip().splitlines()[:8]))
            if tail.strip():
                print("  --- лишний хвост файла (до 8 строк) ---")
                print("\n".join(tail.strip().splitlines()[:8]))
            continue

        ok_all = False
        print("  РЕЗУЛЬТАТ: РАСХОЖДЕНИЕ — unified diff (до 60 строк):")
        diff = difflib.unified_diff(
            exp.splitlines(), got.splitlines(), "courier", "file", lineterm="")
        for ln in list(diff)[:60]:
            print("   ", ln)

    print("=" * 72)
    print("ИТОГ:", "PASS" if ok_all else "FAIL")
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
