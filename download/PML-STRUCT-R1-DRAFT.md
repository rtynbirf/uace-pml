# РАУНД 1 · PML-STRUCT · ЕДИНЫЙ КОНТРАКТ ДАННЫХ РАЗВЕДКИ (проект)

Ведёт: сессия-179 (исходники у меня: ТЗ SSA-1 §I.6, Дополнение №1 Модуль I, живые отчёты SSEA v1.4).
Цель: обе стороны кладут и читают `struct` в `renderRecon(struct)` одинаково; для UACE тот же объект — резервный канал поиска списка сообщений (I-1/I-2), когда фирменные селекторы промахнулись.

## 0. Общие правила (замораживаются первыми)
- Первое поле объекта — `structVersion: 'r1'`. Рендерер обязан игнорировать неизвестные ключи (прямая совместимость), отсутствующая секция = «нет данных», не ошибка.
- Приватность: 0 текста страницы; только структура — теги, роли, размеры, пути. CSS-путь ≤120 символов, без текстовых узлов и атрибутов содержимого.
- Числа — целые; время — мс от старта сессии; хэши — FNV-1a 32-bit, hex (соль постоянная, та же в обеих сборках — иначе sigHash не сойдётся).
- Ёмкости (переполнение → усечение + флаг `truncated: true` в секции): groups ≤12, landmarks ≤20, containers ≤5, mountPoints ≤8, persistentPaths ≤8.

## 1. Конверт и секции (маппинг на вкладку «Разведка»)

```
struct = {
  structVersion: 'r1',
  meta:    { ts, viewport: {w, h}, dpr, urlHash },
  dom:     { maxDepth, blockCount, landmarks: [{tag, role|null, path}],
             groups: [{sigHash, count, depth, uniformity, samplePath}] },
  scroll:  { primary: {path, scrollHeight, clientHeight, ratio} | 'no-scroll-container',
             containers: [{path, scrollHeight, clientHeight}] },
  mut:     { window: 60, adds, removes, recycles, medianIntervalMs|null,
             streamCandidate: true|false|null },
  anchors: { mountPoints: [{path, mode, h}], persistentPaths: [path], stability }
}
```

- `dom` → «Каркас» (I-1): `groups[].uniformity` ∈ [0.6..1] (порог отсечения 0.6), `sigHash` — от структурной сигнатуры глубины 3, `samplePath` — путь первого элемента группы.
- `scroll` → «Скролл» (I-2): `primary` — каскадный выбор главного скролл-контейнера; строка-страж `'no-scroll-container'` — страница без прокрутки; `ratio = clientHeight / scrollHeight`.
- `mut` → «Мутации» (I-3): окно наблюдения 60 с (пассивный наблюдатель); `streamCandidate: null` — окно ещё не набрано; `recycles` — remove→add с равным sigHash (сигнал виртуализации/переиспользования узлов).
- `anchors` → «Якоря» (I-4a/I-4b): `mountPoints` — candidates fixed/sticky (mode, h); `persistentPaths` — пути, продержавшиеся ≥90% снапшотов; `stability` ∈ [0..1] — доля стойких якорей.
- `meta.urlHash` — FNV-1a от location.href (сам URL не хранится и не выводится).

## 2. Рендер-контракт
- renderRecon(struct) рисует только известные секции; секция без данных — строка «нет данных».
- Числа — живые в паспорт при повторных прогонах; разведка перезапускается кнопкой, а не по таймеру (0 фоновых наблюдателей между прогонами, кроме окна I-3 по явному запуску).

## 3. Резервный канал UACE — фиксируется носитель, формула в r2
В r1 фиксирую только носитель: экспортёр читает `struct.dom.groups` + `struct.scroll.primary` как кандидатов на список сообщений. Скоринг (веса групп/скролла/landmarks, пороги) — раунд 2 по struct, после живых прогонов на 3–5 разных макетах; в r1 его не замораживаем, чтобы не переуплотнять без данных.

## 4. Протокол r1
Ответ B: по секциям 0–3 → ACCEPT / AMEND (свой ключ/тип/ёмкость). Имена ключей правим только до r2 — после первого живого прогона двух сборок фиксируем PML-STRUCT 1.0.
