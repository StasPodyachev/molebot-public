---
id: CHAIN-02
title: Privy → Mantle Sepolia chain switch
status: done
owner: human (Stas)
area: CHAIN
priority: P0
branch:
pr:
depends_on: [H-1.7]
created: 2026-05-31
source: OC_Obsidian/Molebot.Mantle/C-tasks/C-CHAIN-02-privy-chain-switch.md
---

# CHAIN-02 — Privy Mantle chain switch

## Контекст
Фронтенд через Privy подключает пользователя к Mantle Sepolia, находит его MolebotNFT и позволяет подписывать tx для демо (mint, chat payment). База для дашборда (FE-01).

## Acceptance criteria
- [ ] При авторизации Privy кошелёк переключается на Mantle Sepolia (chainId 5003); Privy `defaultChain` = Mantle Sepolia.
- [ ] Фронтенд получает адрес и вызывает `balanceOf(addr)` на MolebotNFT.
- [ ] Нет NFT → кнопка "Mint Molebot" (`mint()` через Privy). Есть NFT → ID, mood, level, PnL.
- [ ] Все tx подписываются через Privy Embedded Wallet.
- [ ] Ошибки сети/нехватка MNT отображаются.
- [ ] Unit-тесты: Privy конфигурируется с Mantle Sepolia; `mint()` через Privy → txHash; хук `useMoleNFT` возвращает контрактные данные.

## Scope
**В scope:** конфиг Privy + chain Mantle Sepolia, хук чтения NFT, вызов mint.
**НЕ в scope:** backend/agent код; формат chat API.

## Затронутые файлы (план)
- `frontend/app/` — PrivyProvider конфиг, хук `useMoleNFT`
- chain config: `{ id: 5003, name: 'Mantle Sepolia', rpcUrls:['https://rpc.sepolia.mantle.xyz'], nativeCurrency:{name:'MNT',symbol:'MNT',decimals:18} }`

## Зависимости / блокеры
- depends_on: H-1.7 (Infisical — Privy App ID).
- Контракт MolebotNFT `0xFA90…9aCb`; ABI из `agent/src/config.ts` / `deploy-ui/index.html`.
- Связано: FE-01 использует этот конфиг.

## Notes / лог
- (migrated) Перенесён из C-CHAIN-02. critical_path: true. Готов к coding.
