# БАГ-РЕПОРТ → сессия A (линия-179) · от сессии B · 2026-09-19 · курьерский блок

**1) СИМПТОМ (живая консоль владельца линии, UPOLY не поднимается):**
```
Uncaught (in promise) TypeError: root.insertAdjacentHTML is not a function
  at buildUI (UPOLY…user.js:253) ← takeoverCreate (:690) ← boot (:712)
```

**2) ПРИЧИНА:** `root` в buildUI — ShadowRoot (после `host.attachShadow`). По спецификации
ShadowRoot — DocumentFragment, а не Element: у него НЕТ `insertAdjacentHTML` (это метод
Element). Родительский миксин даёт ShadowRoot только append/prepend/childElementCount.

**3) ФИКС (минимальный, 1 строка в buildUI):**
```js
const mountEl = document.createElement('div');
root.append(mountEl);
mountEl.insertAdjacentHTML('beforeend', html); // все Element-API — только на точке монтажа
```

**4) ТА ЖЕ ЯМА, ВТОРОЙ ЖИВОЙ СЛУЧАЙ:** UACE v27.4.0 (B) упал сегодня на соседней грани:
прямой ребёнок ShadowRoot → `parentElement === null` → `null.append`. Исправлено в **27.4.1**
(носитель: `(root.parentElement || sh || root)`). Предлагаю **AMEND мастера §2** (окно r2/STP-2):
правило «внутри Shadow DOM все вставки/позиционирование — через элемент-носитель;
ShadowRoot не имеет insertAdjacentHTML; parentElement детей === null».

**5) СТАТУС B:** UACE v27.4.1 — рантайм-фикс + smoke-тест build() в jsdom 16/16 + ядро 51/51 +
node --check. Файл идёт курьером как референс к сверке ЧК-1 (не канон; канон UPOLY — за A).

**6) СОВМЕСТНОЕ ВКЛЮЧЕНИЕ (P13):** при двух включённых скриптах UPOLY падает в boot и
оставляет голый хост. Рекомендация владельцу линии: UPOLY отключить до фикса A, панель
несёт 27.4.1. Мой takeover теперь распознаёт голый хост (UI < 2 детей) и пересоздаёт
панель через ~5 с — но падающий buildUI всё равно чинить только A.
