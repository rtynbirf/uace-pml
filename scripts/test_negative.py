#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# П54 · НЕГАТИВНЫЙ ТЕСТ контракт-снапшотов (issue uace-pml#5, волна ×6)
# ───────────────────────────────────────────────────────────────────────────
# Чего требует приёмка предложения: «намеренно поломанный fixture даёт
# красный с именем домена (негативный тест)».
#
# Этот скрипт в ОБЫЧНОМ CI-прогоне сам зелёный — он доказывает, что
# python3-валидатор (scripts/validate_contracts.py) ПРАВИЛЬНО КРАСНЕЕТ на
# поломанной фикстуре. Шаги:
#   1. contracts/negative/ChatGPT-broken.html (типовая молчаливая смена
#      вёрстки: атрибут роли переименован) → извлечение обязано упасть,
#      причём домен обязан быть назван ТОЧНО: ChatGPT.
#   2. Контроль той же ячейки: боевой fixture ChatGPT — зелёный (красный
#      негатива — следствие поломки, а не слота).
#   3. Мутация в памяти: переименование атрибута роли в боевом fixture →
#      обязана краснеть (поломка ловится).
#   4. Мутация в памяти: изменение текста сообщения → обязана краснеть
#      (снапшот пинит тексты).
#   5. Сквозной гейт в теневой копии среза репо (временный каталог, боевые
#      файлы не трогаются): валидатор на чистом срезе = rc 0; с негативной
#      фикстурой вместо боевой = rc 1 и имя домена в stdout.
# rc=0 только если красный гейт доказан; иначе rc=1 (каркас сломан —
# «зелёный» валидатор ничего не гарантирует).
# ═══════════════════════════════════════════════════════════════════════════
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import validate_contracts as vc  # noqa: E402

NEGATIVE = os.path.join(ROOT, 'contracts', 'negative', 'ChatGPT-broken.html')
RESULTS = []


def check(cond, name, detail=''):
    RESULTS.append((bool(cond), name, detail))
    print(('PASS  ' if cond else 'FAIL  ') + name + ((' — ' + detail) if detail else ''))


def main():
    registry, schema, manifest, uace_ver, schema_ver = vc.load_all()
    neg_meta = (manifest.get('negative') or {})
    neg_domain = neg_meta.get('domain') or 'ChatGPT'
    neg_file = os.path.join(ROOT, neg_meta.get('file') or NEGATIVE)
    dom = next((d for d in manifest['domains'] if d['name'] == neg_domain), None)
    plat_enum = (schema.get('properties') or {}).get('platform', {}).get('enum') or []
    defs = schema.get('definitions') or {}
    role_enum = (defs.get('role') or {}).get('enum') or []
    method_enum = (defs.get('evidenceMethod') or {}).get('enum') or []

    def gate(fx_path, expected):
        """Точная семантика красного гейта валидатора на одном домене."""
        errs = vc.validate_expected_against_schema(expected, plat_enum, role_enum, method_enum)
        res = vc.extract_fixture(fx_path, registry, uace_ver, schema_ver)
        if not res['ok']:
            errs.append(res.get('reason') or 'извлечение не удалось')
        else:
            errs += ['schema ' + s for s in res['schema_errors']]
            errs += vc.compare_with_expected(res, expected)
        return errs, res

    # 0) домен негатива найден в манифесте (дальше нужны его боевые файлы)
    exp = None
    if dom:
        try:
            exp = json.load(open(os.path.join(ROOT, dom['expected']), encoding='utf-8'))
        except Exception as e:
            exp = None
        check(exp is not None, 'домен негатива найден в манифесте, боевой expected.json читается', neg_domain)
    else:
        check(False, 'домен негатива найден в манифесте', neg_domain)

    # 1) негативная фикстура → красный, домен назван ТОЧНО
    if not os.path.isfile(neg_file):
        check(False, 'негативная фикстура существует', neg_meta.get('file', '?'))
    else:
        errs, res = gate(neg_file, exp or {'platform': neg_domain, 'messages': [{'role': 'user'}, {'role': 'assistant'}]})
        check(bool(errs) and res.get('platform') == neg_domain,
              'негативная фикстура → красный с ТОЧНЫМ именем домена',
              '; '.join(errs)[:120])
        check(bool(errs), 'красный негатива содержит причину (не тихий провал)',
              '; '.join(errs)[:120])

    # 2) контроль ячейки: боевой fixture того же домена зелёный
    if dom and exp is not None:
        errs, good = gate(os.path.join(ROOT, dom['fixture']), exp)
        check(errs == [],
              'контроль: боевой fixture ' + neg_domain + ' зелёный (негатив краснеет из-за поломки)',
              str(len(good.get('messages') or [])) + ' сообщ.')

    # 3) мутация в памяти: переименование атрибута роли → красный
    if dom:
        src = open(os.path.join(ROOT, dom['fixture']), encoding='utf-8').read()
        mut = src.replace('data-message-author-role', 'data-msg-author-role')
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, 'mutation-role.html')
            open(p, 'w', encoding='utf-8').write(mut)
            exp = json.load(open(os.path.join(ROOT, dom['expected']), encoding='utf-8'))
            errs1, _r1 = gate(p, exp)
        check(bool(errs1), 'мутация атрибута роли в fixture ' + neg_domain + ' → красный',
              '; '.join(errs1)[:120])

        # 4) мутация в памяти: изменение текста сообщения → красный (снапшот пинит тексты)
        mut2 = src.replace('Сколько планет в Солнечной системе?', 'Сколько спутников у Марса?')
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, 'mutation-text.html')
            open(p, 'w', encoding='utf-8').write(mut2)
            exp = json.load(open(os.path.join(ROOT, dom['expected']), encoding='utf-8'))
            errs2, _r2 = gate(p, exp)
        check(bool(errs2), 'мутация текста сообщения в fixture ' + neg_domain + ' → красный',
              '; '.join(errs2)[:120])

    # 5) сквозной гейт в теневой копии среза репо (боевые файлы не трогаются)
    with tempfile.TemporaryDirectory() as td:
        os.makedirs(os.path.join(td, 'scripts'))
        shutil.copytree(os.path.join(ROOT, 'scripts', 'v29'), os.path.join(td, 'scripts', 'v29'))
        shutil.copy(os.path.abspath(vc.__file__), os.path.join(td, 'scripts', 'validate_contracts.py'))
        shutil.copytree(os.path.join(ROOT, 'contracts'), os.path.join(td, 'contracts'))
        base = subprocess.run([sys.executable, os.path.join(td, 'scripts', 'validate_contracts.py')],
                              capture_output=True, text=True)
        check(base.returncode == 0, 'теневой прогон на чистом срезе → rc 0 (36/36)',
              base.stdout.strip().splitlines()[-1] if base.stdout.strip() else '')
        if dom:
            shutil.copy(neg_file, os.path.join(td, 'contracts', 'fixtures', dom['slug'], 'fixture.html'))
            broken = subprocess.run([sys.executable, os.path.join(td, 'scripts', 'validate_contracts.py')],
                                    capture_output=True, text=True)
            check(broken.returncode == 1 and neg_domain in broken.stdout,
                  'теневой прогон с поломанной фикстурой → rc 1 и имя домена в stdout',
                  'краткий гейт: ' + (next((ln for ln in broken.stdout.splitlines() if ln.startswith('# КРАСНЫЙ')), '')[:140]))

    ok = all(r[0] for r in RESULTS)
    print('# Result: ' + str(sum(1 for r in RESULTS if r[0])) + ' passed, ' + str(sum(1 for r in RESULTS if not r[0])) + ' failed (of ' + str(len(RESULTS)) + ')')
    print('# NEGATIVE GATE ' + ('GREEN: валидатор правильно краснеет на поломанной фикстуре (гейт доказан)' if ok else 'RED: каркас не доказывает красный гейт — валидатору нельзя доверять'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
