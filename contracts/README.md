# Контракт-снапшоты 36 доменов (П54, issue uace-pml#5)

Домены меняют вёрстку молча — уже ловили на фрагментах v29 (волна FIX-1.2).
Этот каталог — машиночитаемый контракт: **фикстура × адаптер × схема** на каждый
из 36 платформ. CI гоняет все 36: поломка домена = красный гейт с ТОЧНЫМ именем
платформы.

## Устройство

```
contracts/
  schema/chatdocument.schema.json   # JSON Schema результата экспорта (ChatDocument/29)
  fixtures/NN-slug/fixture.html     # фиксированный HTML-снапшот вёрстки сообщений домена
  fixtures/NN-slug/expected.json    # замороженная проекция: platform, chatId, сообщения (role/method/confidence/text)
  negative/ChatGPT-broken.html      # намеренно поломанная вёрстка → обязана давать КРАСНЫЙ с именем домена
scripts/contract_runner.mjs        # раннер (stdlib Node, без внешних зависимостей)
.github/workflows/contracts.yml    # CI: selftest + прогон 36/36
```

## Как это работает (честно)

- Раннер исполняет **РЕАЛЬНЫЙ код адаптеров** — `scripts/v29/p1..p4` (PLATFORMS,
  `findMessages`, `extractRoleRaw`, `textOf`, `makeChatDocument`) — в функции-песочнице
  Node с мини-DOM (свой парсер HTML + подмножество CSS-селекторов; зависимости — ноль).
- Хост/путь фикстуры задаются `<meta name="uace-fixture" content="host=...;path=...;">` —
  так проверяется и распознавание домена (`getPlatform`).
- **Контракт пинит платформенные селекторы**: generic-фолбэки `GENERIC_MSG_SELS`
  обнуляются, структурная стратегия отключена — сломанный адаптер = красный,
  даже если «спасающий» фолбэк нашёл бы сообщения.
- Геометрия браузера в контракт не входит: `getBoundingClientRect`/
  `getComputedStyle` в песочнике возвращают константу («элемент видим») — это часть
  среды фикстуры, не домена.
- Результат прогона валидируется по `schema/chatdocument.schema.json` (мини-валидатор
  draft-07-подмножества) и сверяется с `expected.json` (заморожен фактическим
  извлечением: `node scripts/contract_runner.mjs --freeze`, затем ручная сверка ролей).
- `capturedAt` в снапшот не входит → двойной прогон байт-в-байт идентичен.

## Что пинит expected.json

- `platform` — точное имя адаптера (36 имён = реестр p3, порядок совпадает);
- `chatId` — извлечение id по `chatUrlPattern` (или null);
- `messages` — роль, метод улики (`attribute` 0.99 / `platform-selector` 0.95 /
  testid 0.97) и текст каждого сообщения.

Семантика `findMessages` — «первая валидированная стратегия»: у части доменов
(Claude) один заход даёт одну сторону диалога — снапшот пинит поведение как есть;
пересборка селекторов движка = пере-заморозка `--freeze` с ревью diff.

## Запуск

```bash
node scripts/contract_runner.mjs            # 36 доменов, rc=0/1 (FAIL-строки с именами)
node scripts/contract_runner.mjs --selftest # 6 проверок каркаса (реестр/36/негатив/мутация/детерминизм)
node scripts/contract_runner.mjs --freeze   # переписать expected.json по факту (с ревью diff!)
```

## Негативный тест

`contracts/negative/ChatGPT-broken.html` — та же фикстура ChatGPT, но атрибут роли
переименован (`data-msg-author-role`) — типовая «молчаливая смена вёрстки».
Selftest обязан получить КРАСНЫЙ с именем `ChatGPT`; иначе каркас сломан.
