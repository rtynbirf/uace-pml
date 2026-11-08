# БАГ-РЕПОРТ B-5 · UPOLY v1.0.1-sk · живая сессия владельца (DeepSeek chat) · 2026-09-19

Объект: upload/UPOLY-v1.0.1-sk.user.js, md5 cf9c5cb0a861a1b201c754109d070152. Живой struct владельца + журнал + консоль разобраны.
Метод: статический аудит + воспроизведение в headless Chromium 811×599 (scripts/test_upoly_layout.js) — состояние владельца: журнал 13 записей, вкладка Журнал, Комфорт открыт, Паспорт открыт, кегль 15px.

## E1 · КРАШ РЕНДЕРА — «действие: Cannot read properties of undefined (reading 'path')» ×2 в журнале владельца
Строка 312: `s ? (s.primary === 'no-scroll-container' ? null : \`primary: ${s.primary.path}…\`) : null`.
buildStruct (стр. 543) при отсутствии primary кладёт в scroll СТРОКУ `'no-scroll-container'` → `s` truthy,
`s.primary` = undefined → `undefined === 'no-scroll-container'` = false → `s.primary.path` → TypeError.
buildStruct и renderRecon не согласованы между собой: эмиттер даёт строку, рендер ждёт объект.
Хронология владельца сходится: err на Alt+E (разведка) и на финише наблюдения (renderRecon из finishObservation).
Фикс: `s === 'no-scroll-container' || !s.primary ? null : …` — либо C1 (нормализация формы), тогда E1 уходит сам.

## B2 · ГЕОМЕТРИЯ: «панель сдвигается вверх» — измерено
Панель НЕ движется (box top = 16 стабильно). Реальное явление: при открытии Паспорта футер (min-content
≈490px: статус + открытый Комфорт ~156 + Паспорт ~254) не сжимается → `.pml-body` (flex, overflow:auto,
мин. высота 0) схлопывается с 443px контента до **20px** (журнал исчезает — «панель закрыта»), хвост футера
вылезает за box на **138px** (ftr bottom 635 > viewport 599) — низ паспорта за краем экрана.
Фикс (ПРОГНАН в Chromium, тест в scripts/test_upoly_layout.js — все метрики зелёные):
```css
.pml-body{flex:1 1 0;min-height:10vh}
.pml-ftr{flex:0 1 auto;min-height:0;overflow:auto;max-height:40vh}
.pml-kv{max-height:16vh;overflow:auto}
```
После фикса: журнал 80px+скролл, футер в границах (−1px запас), текст паспорта 96px+скролл, summary доступен.
Обход владельца без патча: закрыть «Комфорт» перед открытием «Паспорт» (ftr min-content ≈334 < доступных ~375).

## B1 · БИТЫЙ СЕЛЕКТОР (стр. 212): `.pml-badgeidden],.pml-boxidden]{display:none}` — потеряно `[h`
Правило мёртвое (invalid → отброшено). В Chromium 130+ свёртку спасает UA-правило `[hidden]` с !important,
но на движках/версиях без него `.pml-box{display:flex}` перебьёт hidden — свёртка и бейдж сломаются.
Фикс 1 строка: `.pml-badge[hidden],.pml-box[hidden]{display:none}`. Приоритет низкий (Chromium жив), но мёртвый код в мастере недопустим.

## C1 · ОТКЛОНЕНИЕ ОТ r1: форма scroll
Канон r1: `scroll: {primary: {…} | 'no-scroll-container', containers: […]}` — объект ВСЕГДА.
UPOLY: `scroll: 'no-scroll-container'` строкой (стр. 543), containers теряются. Править к ЧК-1/ЧК-2 (заодно закрывает E1).

## C2 · ОТКЛОНЕНИЕ ОТ 0-b: truncated
Канон 0-b (вердикт B, принят): `truncated` = СПИСОК имён коллекций (`["landmarks"]`), отсутствие = не резали.
UPOLY: boolean (dom/scroll/anchors). Править к ЧК-2 — иначе сверка форм на обмене struct расходится.

## C3 · ОТКЛОНЕНИЕ: landmarks без белого списка
findLandmarks (стр. 489–498) берёт ЛЮБОЙ role + теги {MAIN,NAV,HEADER,FOOTER,ASIDE,SECTION}. Канон r1:
roles {banner,main,navigation,complementary,contentinfo,search,region,form} + теги {header,nav,main,aside,footer}.
Живое следствие на DeepSeek: 18 из 20 landmarks — `role:"button"`, реальные ориентиры вытеснены за cap, truncated:true.
SECTION в канон не входит. Править к ЧК-2.

## D1 · Калибровка I-2 (не баг, данные ЧК-3)
DeepSeek chat → `no-scroll-container`. Возможен легитимный случай (короткий чат не оверфлоуит), но обязательный
макет FIX-06 (чат-список) на прогонах ЧК-3 ответит точно. На заметку: CAP.nodes 5000 + срез — на тяжёлых SPA возможен пропуск.

## Подтверждения (работает)
inPrimary в groups (AMEND 3-a) уже в бою ✓; блок recon по r2-черновику ✓; P8 whenReady ✓; FNV-1a UTF-8 ✓;
синглтон/гость в живой сессии ✓. К унификации ЧК-2: соль (M3, 'PMLSTRUCT' → 'pml-s1' префикс) И сериализация входа
urlHash: у A `SALT+'URL>'+href`, у B `'pml-s1'+href` — вход должен совпадать бит-в-бит. M1 (паспорт-identity, стр. 391) — открыт, воспроизвёлся снова (гость в журнале владельца).

## Статус
Вердикт прошлый ACCEPT сохраняется для логики; к канонизации UPOLY (ЧК-5) блокером становятся E1/C1 (+CSS B2).
Предлагаю A выпустить v1.0.2-sk: E1+C1+B2+B1+M1 — пять точечных правок, все с готовыми фиксами выше.
