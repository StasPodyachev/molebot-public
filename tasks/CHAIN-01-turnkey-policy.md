---
id: CHAIN-01
title: Turnkey EVM policy для Mantle
status: done
owner: human (Stas)
area: CHAIN
priority: P0
branch:
pr:
depends_on: [H-1.1, H-1.2, H-1.7]
created: 2026-05-31
source: OC_Obsidian/Molebot.Mantle/C-tasks/C-CHAIN-01-turnkey-policy.md
code_location: agent/infra/turnkey/ (ранее molebot-agents)
---

# CHAIN-01 — Turnkey EVM policy

> ⚠️ Часть работы — в Turnkey Dashboard (ручная), часть — policy-as-code в repo. Трекинг здесь.

## Контекст
Политика Turnkey для Mantle Sepolia: какие контракты/функции можно вызывать, какими адресами, с какими лимитами. Слой безопасности подписи для агента и Gateway.

## Acceptance criteria
- [ ] В Turnkey Dashboard создана EVM-политика для Mantle Sepolia.
- [ ] Разрешено: `mint()` на MolebotNFT (любой); `updateMood()`/`checkLevelUp()` только с адреса агента; `spendCredits()` на AICredits только с адреса LLM Gateway; трейды через Byreal — с адреса агента, с лимитом на tx.
- [ ] Запрещено: `withdraw()`/`reveal()` — только owner (Stas); `mintCredits()` — только Safe/owner.
- [ ] Политика закодирована в repo (`turnkey-policy.json` или `policy.ts`).
- [ ] Тесты политики (эмуляция разрешённых/запрещённых вызовов).

## Scope
**В scope:** создание политики в Dashboard + policy-as-code файл + тесты.
**НЕ в scope:** изменение задеплоенных адресов контрактов.

## Затронутые файлы (план)
- `agent/infra/turnkey/turnkey-policy.{json,ts}` — новый
- тесты политики

## Зависимости / блокеры
- depends_on: H-1.1 (Turnkey org/keys — готово), H-1.2 (Safe), H-1.7 (Infisical).
- Адреса: MolebotNFT `0xFA90…9aCb`, Agent `0xFecb…450e`. Safe-адрес уточнить.
- Формат: `contractAddress`, `selector`, `maxValue`, `allowedCallers`. Селекторы через `encodeFunctionSignature`.

## Notes / лог
- (migrated) Перенесён из C-CHAIN-01 (был repo: molebot-agents). critical_path: true. Готов к работе (H-1.1 done).
