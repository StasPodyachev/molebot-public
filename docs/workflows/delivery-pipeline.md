# Delivery Pipeline — Molebot Mantle

> Единственный разрешённый путь задачи. Без вариаций, без обходов.
> Цель: handoff через **файлы и статус PR**, а не через Telegram-теги.

## Pipeline

```
task → planning → coding → review → decision → deploy
```

### 1. task (planner или человек)
- Создаётся `tasks/<ID>.md` по `tasks/TASK_TEMPLATE.md`.
- `status: todo`. ID формата `<AREA>-<NN>` (SC / AG / FE / INFRA / CHAIN / AI).

### 2. planning (planner)
- Planner заполняет: контекст, acceptance criteria, затронутые файлы, зависимости, scope-границы.
- Один таск = одна атомарная единица работы (≤ ~1 PR).
- `status: ready`. Только теперь coder имеет право брать таск.

### 3. coding (coder)
- Берёт **один** `ready`-таск.
- Создаёт ветку `feat/<ID>-<slug>` от свежего `main`.
- Пишет код + тесты (обязательны для критичной логики). Least Solution.
- Открывает PR с телом `Closes <ID>`. Прогоняет локально typecheck/тесты.
- В таске: `status: in_review`, проставляет `pr:` ссылку и `branch:`.
- 🔴 Coder **не мержит** и **не деплоит**.

### 4. review (reviewer)
- Проходит `docs/workflows/review-checklist.md` по PR.
- Результат: `approve` → `status: approved`; иначе оставляет комментарии → `status: changes_requested` (возврат к шагу 3).
- 🔴 Reviewer **не пишет фичекод** и **не мержит** (может предложить diff в комментарии).

### 5. decision (human gate)
- Человек (Stas) смотрит approved PR + зелёный CI.
- Решение: merge / hold / reject. Это единственный обязательный ручной gate.
- Архитектурно значимое решение → запись в `decisions/<date>-<slug>.md` (append-only).

### 6. deploy (deployer, опц.)
- Только из смерженного `main`, только по явной команде человека.
- После деплоя: `status: done`, запись результата (адреса, SHA, окружение) в `decisions/`.

## Статусы таска (единственный жизненный цикл)

```
todo → ready → in_review → approved → done
                    └── changes_requested ──┘ (loop)
                    blocked (если внешняя зависимость)
```

## Жёсткие правила (анти-десинк)

1. **Нет ветки/PR на GitHub → таск НЕ in_review.** Запрещено ставить статус по «написал в файле».
2. **git — источник истины про код.** Перед статусом про merge: `git fetch && git log origin/main`.
3. **Один таск в работе на coder за раз.** Не распыляться.
4. **Code не передаётся через Telegram.** Только ветка + PR.
5. **decisions/ append-only.** Старые решения не редактируются, новое решение = новый файл.

## OpenClaw: session tools & multi-agent routing без хаоса

- **Детерминированный routing по этапу, не по тегам.** Маршрут определяется статусом таска/PR:
  - `ready` без исполнителя → coder-сессия;
  - PR открыт (`in_review`) → reviewer-сессия;
  - `approved` → уведомление человеку (decision gate).
- **Изоляция:** 1 агент = 1 `agentId` = 1 workspace = 1 Telegram account. Никаких conflicting bindings.
- **Сессии:** короткие, по одному таску/PR. Состояние не держим в сессии — читаем из repo при старте.
- **sessions_send** используется только для системных пингов (например, «есть ready-таск»), не для передачи контента.
- **agentDir** каждого агента: только `AGENTS.md` (общая конституция) + `agents/<role>.md` (его роль). Ничего лишнего, чтобы агент не «расползался» по чужим зонам.

## Telegram (строго ограниченный список)

| Сигнал | Триггер |
|---|---|
| `/status` | по запросу — сводка `tasks/` + открытые PR |
| notify: PR открыт | coder открыл PR |
| notify: review готов | reviewer завершил |
| confirm: deploy? | deployer перед деплоем (человек подтверждает) |
| alert: CI failed / prod down | критическая ошибка |

Всё остальное в Telegram — запрещено.
