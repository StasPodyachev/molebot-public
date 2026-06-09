# Project Brief — Molebot Mantle

> Краткий, стабильный контекст проекта. Перенесён и сжат из `OC_Obsidian/Molebot.Mantle/00_PROJECT_CONTEXT.md`.
> Это «что и зачем». Детали реализации — в `docs/architecture.md`.

## Что это

Molebot — автономный AI-торговый агент в виде «живого» NFT-тамагочи на **Mantle (EVM L2)**.
Пользователь минтит Mole, агент торгует, NFT меняет mood/level в зависимости от P&L.
Ключи никогда не покидают TEE (Turnkey); вывод средств — через Safe-мультисиг.

## Хакатон

- **Mantle Turing Test Hackathon 2026** (DoraHacks).
- Дедлайн сабмита: **2026-06-15**.
- Целевые треки: AI Trading (01), Alpha & Data (02), Consumer UI/UX (04), Agentic Economy / Byreal (06).
- Главный месседж демо: end-to-end — пользователь → запрос → решение агента → on-chain действие → P&L → mood/level NFT в UI.

## Критический путь демо (must work)

1. **Chat demo** — Privy auth → если есть NFT, дашборд; иначе mint → вопрос Molebot → ответ с учётом mood/level.
2. **On-chain decision logging** — решение агента → calldata → tx на Mantle → история по логам explorer.
3. **Trading/action demo** — решение → реальный/симулированный трейд через Byreal/Merchant Moe → P&L → поля NFT (cumulativePnl, level, mood) → видно в UI.

## Деплой (Mantle Sepolia, актуально)

| Контракт/кошелёк | Адрес | Статус |
|---|---|---|
| MolebotNFT | `0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb` | ✅ deployed 2026-05-25 |
| AICredits | `0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64` | ✅ deployed 2026-05-28 |
| Safe | `0x660eAF880bCAbEf5EA1F174542f419E8eF30B07d` | ✅ created 2026-05-28 |
| Agent Wallet | `0xFecb0b79583A337c8Bd1E390B81661329b78450e` | адрес агента |

Network: Mantle Sepolia · chainId `5003` · RPC `https://rpc.sepolia.mantle.xyz` · explorer `https://explorer.sepolia.mantle.xyz`.

## Стек (фактический в этом repo)

- Контракты: Solidity (`MolebotNFT`, `AICredits`, `GiftEscrow`, `MolebotAccessory`).
- Agent: TypeScript, плагины **byreal** + **merchant-moe**, сервисы (chatBilling, chatMood, price, llmClient).
- Backend: TS chat/history роуты.
- Frontend: Next.js (app router) + Privy + wagmi/viem (Mantle chain).
- Infra: Docker Compose + Caddy + Infisical на Hetzner.

## Приоритет на хакатон

Стабильность критического пути > полнота roadmap. Всё, что не на критическом пути демо — backlog.
