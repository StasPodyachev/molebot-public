---
id: SC-01
title: MolebotNFT.sol — NFT с mood/level/PnL
status: done
owner: human
area: SC
priority: P0
branch:
pr:
depends_on: [SC-00, H-1.1, H-2.6]
created: 2026-05-25
source: OC_Obsidian/Molebot.Mantle/C-tasks/C-SC-01-molebot-nft.md
---

# SC-01 — MolebotNFT.sol

> ✅ DONE — задеплоен 2026-05-25, 29 тестов проходят. В новом процессе это **reference-эталон**
> паттерна (структура контракта, тесты, деплой). Активной работы не требует.

## Контекст
Центральный NFT критпути демо: каждый Molebot хранит serialNumber, personalityHash, mood, levelIndex, cumulativePnl, isMythic. Mood/level эволюционируют от торгового PnL. Источник правды для фронтенда и агента.

## Acceptance criteria
- [x] Контракт компилируется в Hardhat и задеплоен на Mantle Sepolia.
- [x] Unit-тесты на все ключевые операции (29 ✅).
- [x] Мутации состояния ограничены ролями (onlyOwner / onlyAgent).
- [x] Адрес прописан в .env, docker-compose, конфигах backend/frontend.
- [x] README и DEPLOY_MANTLE.md описаны.

## Deployment (факт)
- Сеть: Mantle Sepolia (chainId 5003), RPC `https://rpc.sepolia.mantle.xyz`
- MolebotNFT (без-OZ, верифицирован): `0x15fa9046d2db9e38308ed9bba8f8e872bebf6b64`
  https://sepolia.mantlescan.xyz/address/0x15fa9046d2db9e38308ed9bba8f8e872bebf6b64#code
- Agent (пока owner): `0x<твой адрес>`
- BASE_URI: `ipfs://bafybeigwkc4pzfugfpcjdv2stsgc7qq7hsnxa3czci6nncpebqvioryyoq/`
- Задеплоена без-OZ версия (212 строк, свой ERC-721).

## API контракта (reference)
`mint() payable` · `reveal(baseURI) onlyOwner` · `updateMood(tokenId, mood) onlyAgent` · `checkLevelUp(tokenId, pnlDelta) onlyAgent` · `setAgent(addr) onlyOwner` · `withdraw() onlyOwner` · `tokenURI(id)` · `getMoleData(id)`.
Параметры: MAX_SUPPLY=100, MAX_MINT_PER_WALLET=1, MINT_PRICE=0.05 MNT, MAX_LEVEL=8.
Уровни 0..8: Slumbering Mole(0) → Digger(150) → Scout(200) → Tunneler(300) → Excavator(500) → Prospector(1000) → Treasure Hunter(2000) → Crypt Keeper(5000) → Shadow Mole(10000).

## Notes / лог
- (migrated) Перенесён из C-SC-01. Статус done сохранён. Использовать как образец для SC-03 (AICredits).
