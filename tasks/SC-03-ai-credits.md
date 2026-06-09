---
id: SC-03
title: AICredits.sol — токен кредитов для LLM/действий
status: done
owner: coder
area: SC
priority: P0
branch:
pr:
depends_on: [H-1.2, H-1.7]
created: 2026-05-31
source: OC_Obsidian/Molebot.Mantle/C-tasks/C-SC-03-ai-credits.md
---

# SC-03 — AICredits.sol

## Контекст
ERC-20-подобный токен кредитов для биллинга LLM Gateway (AI-02) и ограничения частоты/объёма действий агента. Первый узел цепочки агентской экономики: AICredits → LLM Gateway → ElizaOS → trade.

## Acceptance criteria
- [x] Контракт `AICredits.sol` (Solidity ^0.8.28) скомпилирован и задеплоен на Mantle Sepolia.
- [x] `mintCredits(address to, uint256 amount)` — только owner (onlyOwner).
- [x] `spendCredits(address from, uint256 amount)` — вызывается агентом (onlyAgent).
- [x] `balanceOf(address account) view`.
- [x] События `CreditsMinted(to, amount)` и `CreditsSpent(from, amount)` (reason не реализован — контракт минимален).
- [x] Списание проверяет баланс → revert `AICredits: insufficient credits`.
- [x] Hardhat-тесты (31 тест): mint, spend, spend при нехватке, несанкц. вызовы, setAgent, renounceOwnership (revert).

## Scope
**В scope:** новый контракт AICredits.sol + тесты + добавление в `scripts/deploy.ts`.
**НЕ в scope:** изменение уже задеплоенного MolebotNFT и его адреса; правка hardhat.config (уже настроен на Mantle Sepolia).

## Затронутые файлы (план)
- `packages/contracts-evm/contracts/AICredits.sol` — новый
- `packages/contracts-evm/test/AICredits.test.ts` — новый (по образцу MolebotNFT.test.ts)
- `packages/contracts-evm/scripts/deploy.ts` — добавить `AICredits.deploy(ownerAddress, agentAddress)`

## Зависимости / блокеры
- depends_on: H-1.2 (Safe — минтер), H-1.7 (Infisical-секреты)
- Образец паттерна: SC-01 (MolebotNFT) — структура файла, тесты, onlyOwner/onlyAgent.

## Notes / лог
- (migrated) Перенесён из C-SC-03. critical_path: true.
- 2026-06-01: Перевод в done. Контракт задеплоен и верифицирован на MantleScan.
  Адрес: `0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64`.
  Explorer: https://sepolia.mantlescan.xyz/address/0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64#code
- 2026-06-01: Разблокирован AI-02 (LLM Gateway production mode).
