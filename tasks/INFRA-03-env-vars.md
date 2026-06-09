---
id: INFRA-03
title: ENV vars + .env.example для всех сервисов
status: done
owner: coder
area: INFRA
priority: P0
branch: feat/INFRA-03-env-vars
pr: https://github.com/StasPodyachev/molebot_mantle/pull/6
depends_on: [H-1.7]
created: 2026-05-31
source: OC_Obsidian/Molebot.Mantle/C-tasks/C-INFRA-03-env-vars.md
---

# INFRA-03 — ENV vars для Molebot.Mantle

> Базовый таск: почти всё критпути зависит от него. Делать рано.

## Контекст
Единый, задокументированный набор env-переменных для всех сервисов (Mantle RPC, Turnkey, Safe, DeepSeek, Byreal, AICredits, Gateway, Agent, Web) + `.env.example` + привязка к Infisical. Секреты — только имена/ссылки, без значений.

## Acceptance criteria
- [ ] `.env.example` в корне, в `packages/llm-gateway/`, `frontend/`, `agent/`.
- [ ] Каждый `.env.example`: все переменные с комментариями, пометка secret/not-secret, fallback для тестов.
- [ ] Всё задокументировано в `ENV_REFERENCE.md`, сгруппировано по сервисам.
- [ ] Указано: обязательные / опциональные.

## Полный список (reference)
- **Mantle RPC:** `MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz`, `CHAIN_ID=5003`, `MANTLE_SCAN_API_KEY`(secret,опц).
- **NFT/Credits:** `NFT_CONTRACT_ADDRESS=0xFA90…9aCb`, `AI_CREDITS_CONTRACT_ADDRESS`, `AGENT_WALLET_ADDRESS=0xFecb…450e`, `PLACEHOLDER_URI=ipfs://placeholder/`.
- **DeepSeek/LLM:** `DEEPSEEK_API_KEY`(secret), `LLM_GATEWAY_URL=http://llm-gateway:3010`, `LLM_MODEL=deepseek-chat`(опц).
- **Agni Finance:** `AGNI_SWAP_ROUTER=0xe2DB…c1df`, `AGNI_QUOTER=0x49C8…9191`, `AGNI_USDC=0x82a2…58e9`, `AGNI_MAX_TRADE_AMOUNT=1000`, `AGNI_DAILY_LIMIT=5000`, `AGNI_DEFAULT_SLIPPAGE=0.5`.
- **Turnkey:** `TURNKEY_API_PUBLIC_KEY`(secret), `TURNKEY_API_PRIVATE_KEY`(secret), `TURNKEY_ORGANIZATION_ID`.
- **Agent:** `CHAT_FEE_WEI=1000000000000000`, `API_PORT=3002`.
- **Redis:** `REDIS_URL=redis://redis:6379`.
- **Web:** `NEXT_PUBLIC_NFT_CONTRACT=0xFA90…9aCb`, `NEXT_PUBLIC_API_URL=http://localhost:3002`, `NEXT_PUBLIC_PRIVY_APP_ID`.

## Scope
**В scope:** свести существующие `backend/.env.example`, `frontend/.env.local.example`, compose к единому стандарту + ENV_REFERENCE.md.
**НЕ в scope:** менять работающие переменные в docker-compose и `agent/config.ts`. 🔴 Значения секретов в git НЕ писать — только в Infisical.

## Уже есть в репозитории
- `infra/.env.mantle` — рабочий env для демо (Privy ID, Safe, AICredits, DeepSeek)
- `.env.example` в `backend/` и `frontend/` — частичные

## Зависимости / блокеры
- depends_on: H-1.7 (Infisical — готов, секреты заведены).

## Notes / лог
- (migrated) Перенесён из C-INFRA-03. critical_path: true.
- 2026-06-01: PR #6 открыт. ENV_REFERENCE.md + .env.example + infra/.env.mantle.
