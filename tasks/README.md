# tasks/

Единственный source of truth для задач проекта. Один файл = один атомарный таск.

- Шаблон: `TASK_TEMPLATE.md`.
- Имя файла: `<AREA>-<NN>-<slug>.md` (напр. `FE-02-faucet-balance.md`).
- Жизненный цикл статуса: `todo → ready → in_review → approved → done` (+ `changes_requested`, `blocked`).
- Владелец процесса: planner. Статус по коду подтверждается реальным git-состоянием, не только полем в файле.

Старые таски жили в `OC_Obsidian/Molebot.Mantle/{C,H}-tasks/`. Активные оттуда мигрируются сюда; остальное — read-only история в Obsidian.
