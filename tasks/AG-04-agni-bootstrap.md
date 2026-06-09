---
id: AG-04
title: Agni plugin bootstrap — инициализация в agent runtime
status: ready
owner: coder
area: AG
priority: P0
branch:
pr:
depends_on: [AG-01, INFRA-03]
created: 2026-06-01
---

# AG-04 — Agni plugin bootstrap

## Контекст
Плагин `agent/src/plugins/agni/` реализован (AG-01), env-переменные `AGNI_*` добавлены (INFRA-03). Но в точке входа агента (`agent/src/index.ts`) `initAgniPlugin()` не вызывается — плагин висит в коде без инициализации.

## Acceptance criteria
- [ ] В `agent/src/index.ts` добавлен импорт и вызов `initAgniPlugin()` с конфигом из env.
- [ ] Конфиг читает `AGNI_SWAP_ROUTER`, `AGNI_QUOTER`, `AGNI_MAX_TRADE_AMOUNT`, `AGNI_DAILY_LIMIT`, `AGNI_DEFAULT_SLIPPAGE`, `MANTLE_RPC_URL`, `CHAIN_ID` из `process.env` или `config.ts`.
- [ ] `AgniExecutor` доступен через `getAgniExecutor()` после старта сервера.
- [ ] При старте сервера в логе: `[server] Agni plugin initialized (mode: real/mock)`.
- [ ] Graceful degradation: если env не заданы — лог `[server] Agni plugin not configured` без падения.
- [ ] Unit-тест: при старте с env Agni инициализируется; без env — graceful skip.

## Scope
**В scope:** только `agent/src/index.ts` и/или `agent/src/bootstrap.ts`.
**НЕ в scope:** Merchant Moe, Byreal логика, фронтенд, чат.

## Затронутые файлы
- `agent/src/index.ts` — добавить импорт + вызов `initAgniPlugin()`
- `agent/test/agniBootstrap.test.ts` — тест инициализации
- `.env.example` — (уже есть в INFRA-03, проверить наличие)

## Зависимости
- AG-01 ✅ done — код плагина есть
- INFRA-03 ✅ done — env переменные описаны

## Notes / лог
- 2026-06-01: Создан по замечанию deployer'а после деплоя AG-01 + INFRA-03.
