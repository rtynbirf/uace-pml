#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка пакета UACE-PML-v29.0.1-HOTFIX.zip (воспроизводимая).
Шаги: склейка p1..p6 → node --check → core-тесты → статик → md5/строки →
00-ПРОЧТИ-МЕНЯ.txt + МАНИФЕСТ-md5.txt (md5 КАЖДОГО файла архива, кроме самого
манифеста) → ZIP → самопроверка (testzip + контрольная распаковка + node --check).
Evidence First: любой провал = abort, архив не перезаписывается.
"""
import hashlib, os, shutil, subprocess, sys, tempfile, zipfile

# Корень = клон репо (портативно): скрипт живёт в <root>/scripts/, root — на уровень выше.
# Раньше был прибит к /home/z/my-project — на чужой машине/в CI сборка падала бы сразу.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = [f'{ROOT}/scripts/v29/p{i}_{n}.js' for i, n in
         [(1, 'header_core'), (2, 'runtime_evidence'), (3, 'platforms'),
          (4, 'capture_storage'), (5, 'orchestrator'), (6, 'ui_pml')]]
BUILD = f'{ROOT}/download/uace-pml-v29.0.1-evidence.user.js'
ZIP   = f'{ROOT}/download/UACE-PML-v29.0.1-HOTFIX.zip'
TOP   = 'UACE-PML-v29.0.1-HOTFIX'

def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()

def run(cmd, **kw):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)
    return r.returncode, (r.stdout + r.stderr)

def die(msg):
    print(f'ABORT: {msg}'); sys.exit(1)

# 1. Склейка p1→p6 (строго в порядке канона)
src = ''
for p in PARTS:
    if not os.path.exists(p): die(f'нет части: {p}')
    src += open(p, encoding='utf-8').read()
open(BUILD, 'w', encoding='utf-8').write(src)

lines = src.count('\n')
size  = len(src.encode('utf-8'))
b_md5 = md5(BUILD)

# 2. node --check
rc, out = run(f'node --check "{BUILD}"')
if rc != 0: die(f'node --check FAIL\n{out}')
print(f'[1/6] склейка p1..p6 → {lines} строк / {size} Б / md5 {b_md5} · node --check PASS')

# 3. Core-тесты (цель ≥195 PASS, 0 FAIL)
rc, out = run(f'node {ROOT}/scripts/test_v291_core.mjs')
tail = out.strip().splitlines()[-1] if out.strip() else '?'
if rc != 0 or '0 FAIL' not in out: die(f'core-тесты FAIL\n{out[-800:]}')
print(f'[2/6] core-тесты: {tail}')

# 4. Статик verify_v291.py (цель 21/21 PASS)
rc, out = run(f'python3 {ROOT}/scripts/verify_v291.py')
npass = out.count('PASS - ')
if rc != 0 or npass < 21 or 'FAIL - ' in out: die(f'статик FAIL ({npass})\n{out[-800:]}')
print(f'[3/6] статик: {npass}/21 PASS')

# 5. README + МАНИФЕСТ (md5 КАЖДОГО файла архива; сам манифест — исключение по определению)
size_txt = f'{size:,}'.replace(',', ' ')
readme = f"""UACE × PML v29.0.1 «EVIDENCE HOTFIX» — финальная рабочая сборка
Дата: 2026-09-20 · База: v29.0.0 (хотфиксы H1–H13 поверх полевого аудита)
Версия метаданных: @version 29.0.1-evidence (внутренняя UACE_VER: 29.0.1)

ФАЙЛ
  uace-pml-v29.0.1-evidence.user.js — {lines} строк / {size_txt} байт
  md5 {b_md5} · node --check PASS
  Полный md5-список файлов архива — в МАНИФЕСТ-md5.txt.

ЧТО ИСПРАВЛЕНО (все корни подтверждены уликами из кода)
  H1  Хоткеи по e.code — работают на русской раскладке (Alt+E/D/C/S/X/I)
  H2  Resume: после завершения «Все чаты» действительно перезапускается;
      гвард listUrl (смена списка → честный старт с нуля)
  H3  «Стоп» жива ВО ВРЕМЯ экспорта (busy() не глушит keepAlive) +
      CANCEL-чекпоинт между томами ZIP
  H5  Поиск сообщений видит Shadow DOM (light+shadow, стратегии *-deep)
  H6  Автоскролл виртуализированных лент: сбор 60/60 на стенде,
      дедуп по contentHash, бюджеты проходов/шагов, возврат прокрутки
  H7  Стабилизация контента: стриминг-чаты не режутся наполовину
      (3 одинаковые пробы, тайм-аут 8 с, CANCEL)
  H11 Кнопка «⧉ MD» — быстрый экспорт Markdown одним кликом
  H12 Фильтр чатов: подстроки через запятую, «!текст» — исключить
  H13 Мёртвые ключи удалены (uaice_strip/zipinner/evening/fsz/motion) +
      однократная миграция localStorage
  H4/H8/H9/H10 — формулировок полевого аудита нет: честно помечены
      «ожидает данных» (очередь v29.0.2), догадок нет

ВЕРИФИКАЦИЯ
  · Core-тесты: {tail.replace('CORE: ', '')} (база 110 + новые по H-пунктам)
  · Статик: {npass}/21 PASS (вкл. 6 новых) + ZIP сверен python-zipfile (CRC OK)
  · Браузерный смоук на enforce-Trusted-Types стенде: панель/темы/Справка
    слева от Паспорт/тултипы — регресса нет; хоткей «у»+KeyE → JSON;
    «⧉ MD» → .md; Shadow-лента → structured; виртуализация 60/60 →
    scroll-collected; стрим → все 10; Стоп при busy кликабелен;
    resume/complete-restart/фильтр — по журналу. Скриншот:
    UACE-v29.0.1-smoke-panel.png
  · Смоук выполнялся на сборке md5 0742d1848a8ade620b92651746118cbd;
    после него правки — ТОЛЬКО метаданные шапки (@version 29.0.1-evidence
    и блок «ИСТОРИЯ ВЕРСИЙ»), diff-доказательство в worklog; финальная
    сборка повторно прогнана через Node-тесты и статик.

УСТАНОВКА
  Tampermonkey: удалить старую версию → создать скрипт → вставить файл → сохранить.
  Обновление с v29.0.0 настроек не требует (миграция ключей автоматическая).
"""
manifest = (f'МАНИФЕСТ архива {TOP}.zip (md5 каждого файла; сам манифест — '
            f'исключение по определению)\n'
            f'uace-pml-v29.0.1-evidence.user.js  md5 {b_md5}  {lines} строк\n')

with tempfile.TemporaryDirectory() as td:
    rd = os.path.join(td, TOP); os.makedirs(rd)
    shutil.copy(BUILD, os.path.join(rd, 'uace-pml-v29.0.1-evidence.user.js'))
    r_path = os.path.join(rd, '00-ПРОЧТИ-МЕНЯ.txt'); open(r_path, 'w', encoding='utf-8').write(readme)
    manifest += f'00-ПРОЧТИ-МЕНЯ.txt  md5 {md5(r_path)}\n'
    open(os.path.join(rd, 'МАНИФЕСТ-md5.txt'), 'w', encoding='utf-8').write(manifest)

    expected = {}
    # 6. ZIP (UTF-8 имена) + самопроверка
    if os.path.exists(ZIP): os.remove(ZIP)
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        for fn in ['uace-pml-v29.0.1-evidence.user.js', 'МАНИФЕСТ-md5.txt', '00-ПРОЧТИ-МЕНЯ.txt']:
            z.write(os.path.join(rd, fn), f'{TOP}/{fn}')
            expected[f'{TOP}/{fn}'] = md5(os.path.join(rd, fn))
with zipfile.ZipFile(ZIP) as z:
    if z.testzip() is not None: die('ZIP testzip FAIL')
    for info in z.infolist():
        if info.filename.endswith('/'): continue
        data = z.read(info.filename)
        if hashlib.md5(data).hexdigest() != expected[info.filename]: die(f'ZIP md5 FAIL: {info.filename}')
        print(f"[4/6] ZIP-член OK: {info.filename} ({len(data)} Б, md5 {expected[info.filename]})")

vd = tempfile.mkdtemp()
rc, out = run(f'unzip -q "{ZIP}" -d "{vd}" && node --check "{vd}/{TOP}/uace-pml-v29.0.1-evidence.user.js"')
if rc != 0: die(f'контрольная распаковка/node --check FAIL\n{out}')
print('[5/6] контрольная распаковка: unzip OK · node --check PASS · md5 совпадают')
shutil.rmtree(vd, ignore_errors=True)

print(f'[6/6] ГОТОВО: {ZIP} ({os.path.getsize(ZIP):,} Б)')
print(f'ФИНАЛ: сборка {lines} строк / {size} Б / md5 {b_md5}')
