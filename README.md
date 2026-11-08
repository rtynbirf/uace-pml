# UACE × PML — Universal AI Chat Exporter

Userscript-экспортёр диалогов ИИ (36 платформ: ChatGPT, Claude, Gemini, DeepSeek,
Kimi, Qwen, Grok, Copilot и др.) по канонам **PML-PANEL 1.0** и **PML-STRUCT r1+r2**.

Главный принцип — **Evidence First**: каждый результат несёт
`{value, evidence, confidence, source, strategy}`; «не уверен» → `unknown`, догадки запрещены.

## Текущий финал

| Сборка | Файл | md5 | Проверки |
|---|---|---|---|
| **v29.0.1-evidence** (HOTFIX H1–H13) | `download/uace-pml-v29.0.1-evidence.user.js` | `8e267bf454c08cdaabf183aa24d0d7ad` | node --check PASS · core 195/195 · статик 21/21 · смоук 10/10 |
| v29.0.0 (база) | `download/uace-pml-v29.0.0-evidence.user.js` | `1472df4fbebea1d5d7917d04cfb28b6c` | core 110/110 · статик 15/15 |
| v28.3.0 (откат) | `download/uace-pml-v28.3.0-unified.user.js` | `c2508271b9927e82652af4dbc718da07` | стабильная |

ZIP-доставка: `download/UACE-PML-v29.0.1-HOTFIX.zip` (сборка + МАНИФЕСТ-md5 + 00-ПРОЧТИ-МЕНЯ).

## Структура

- `download/` — деливераблы: сборки `.user.js`, ZIP-архивы, скриншоты смоука, документы линии (PML-*).
- `scripts/v29/` — исходники слоёв `p1_header_core → p2_runtime_evidence → p3_platforms → p4_capture_storage → p5_orchestrator → p6_ui_pml` (склейка строго в этом порядке).
- `scripts/` — тесты и инструменты: `test_v291_core.mjs` (195), `verify_v291.py` (статик 21), `build_v291_package.py` (воспроизводимый сборщик пакета), смоук-стенды.
- `contracts/` — контракт-снапшоты 36 доменов (П54): `schema/chatdocument.schema.json` (JSON Schema результата экспорта) + `manifest.json` (пин реестра p3: имена/порядок, hostsRe, msgSelectors, roleFnSig) + `fixtures/NN-slug/fixture.html` + `expected.json` на каждый домен + `negative/ChatGPT-broken.html` (негативный тест); CI — ДВА независимых гейта: `.github/workflows/contracts.yml` (раннер `scripts/contract_runner.mjs`, волна ×4) и `.github/workflows/validate-contracts.yml` (python3-валидатор `scripts/validate_contracts.py` + `scripts/test_negative.py`, волна ×6) — см. `contracts/README.md`.
- `scripts/final-stage/` — задание на v29.0.1 и контрольные копии.
- `worklog.md` — журнал задач (Task ID + Work Log + Stage Summary).

## Как проверить / собрать

```bash
node --check download/uace-pml-v29.0.1-evidence.user.js
node scripts/test_v291_core.mjs          # CORE: 195 PASS, 0 FAIL
python3 scripts/verify_v291.py           # 21/21 PASS
python3 scripts/build_v291_package.py    # полная пересборка ZIP с самопроверкой
node scripts/contract_runner.mjs         # П54: 36 доменов зелёные (FAIL = имя домена)
node scripts/contract_runner.mjs --selftest # П54: 6/6 (реестр/36/негатив/мутация/детерминизм)
python3 scripts/validate_contracts.py    # П54 ×6: python-гейт 36/36 + пин манифеста (FAIL = имя домена)
python3 scripts/test_negative.py         # П54 ×6: негативный тест 8/8 — красный гейт доказан
```

## Приватность

`upload/` и `.env` вне репо (в `.gitignore`). Экспортёр по умолчанию делает
0 внешних запросов; сеть — только по явной опции с журналом (см. §3/§4 аудита в шапке сборки).
