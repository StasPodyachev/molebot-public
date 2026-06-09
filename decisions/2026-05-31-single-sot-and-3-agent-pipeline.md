# 2026-05-31 — Единый SoT в molebot_mantle и переход на 3-агентный конвейер

- Status: accepted

## Context
Старая multi-agent схема (Одмин/Разраб/Тестер на OpenClaw + Telegram + OC_Obsidian)
оказалась нестабильной: агенты меняли роли, теряли токены, плохо координировались,
не выполняли задачи после тегов. Источники истины были размазаны по четырём репозиториям
(`molebot`, `molebot_mantle`, `molebot-agents`, `OC_Obsidian`), задачи жили в Obsidian,
код — в molebot_mantle, статусы — в тройных JSON-таскбордах. Документированный инцидент
рассинхрона: phantom-коммиты Разраба (Errors/2026-05-21-razrab-desync). Плюс в Obsidian
были закоммичены живые секреты (Telegram-токены, GitHub PAT, SSH).

## Decision
1. **Один SoT для активной работы — `molebot_mantle`.** Код, задачи (`tasks/`),
   решения (`decisions/`), доки (`docs/`), роли агентов (`agents/`) — здесь.
2. **Три постоянных агента** (planner, coder, reviewer) + опциональный deployer.
   Старые odmin/razrab/tester упразднены.
3. **Жёсткий pipeline:** task → planning → coding → review → decision → deploy.
   Handoff — через файл-артефакт и статус PR, не через Telegram.
4. **coder работает с git напрямую** (ветка+PR), но не мержит — это убирает
   причину phantom-коммитов (раньше код «передавался в чат»).
5. **Telegram** — только status/notify/confirm/alert.
6. **Obsidian** — read-only для человека. Агенты в него не пишут.
7. **ECC** используется как библиотека практик (AGENTS.md, роли, review gates,
   plan-before-code, append-only decisions), а не накатывается целиком.
8. **`molebot-agents`** заморожен и выведен из роли SoT.

## Consequences
- Человек выходит из роли ручного маршрутизатора: остаётся только на decision gate.
- Требуется срочная ротация секретов, утёкших в OC_Obsidian (см. migration plan, Day 0).
- Obsidian-таски мигрируются в `tasks/` выборочно (только активный критпуть).
- OpenClaw routing становится детерминированным по статусу таска/PR.
