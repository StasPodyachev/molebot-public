---
id: AG-01
title: Agni Finance plugin — execution layer (EXECUTE_TRADE)
status: done
owner: coder
area: AG
priority: P0
branch: feat/AG-01-agni-plugin
pr: https://github.com/StasPodyachev/molebot_mantle/pull/5
depends_on: [INFRA-03, SC-01]
created: 2026-06-01
source: tasks/AG-01-byreal-plugin.md (rewritten: Byreal → Agni, 2026-06-01)
code_location: agent/src/plugins/agni/
---

# AG-01 — Agni Finance plugin (execution)

> **Решение:** Byreal — Solana-only (docs.byreal.io — Solana DEX). Для Mantle (EVM L2) выбрана **Agni Finance** — Uniswap V3-style DEX с контрактами на Mantle Sepolia.  
> Adamant: `realTrade()` в старом Byreal plugin кидал `Error('Byreal API not configured')`. После перехода на Agni — реальный on-chain swap через контракты тестнета.

## Контекст
Плагин ElizaOS, исполняющий трейд/своп через **Agni Finance** на Mantle Sepolia по сигналу агента, с лимитами и логированием. Это шаг демо «решение → on-chain действие → P&L → mood». В отличие от старого Byreal (Solana, REST API), Agni — EVM-контракты, вызывается через viem/ethers.

**Agni Sepolia-адреса** (из `agni-sdk`):

| Контракт | Адрес |
|---|---|
| SwapRouter | `0xe2DB835566F8677d6889ffFC4F3304e8Df5Fc1df` |
| QuoterV2 | `0x49C8bb51C6bb791e8D6C31310cE0C14f68492991` |
| AgniFactory | `0x503Ca2ad7C9C70F4157d14CF94D3ef5Fa96D7032` |
| WMNT | `0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A` |
| USDC | `0x82a2eb46a64e4908bbc403854bc8aa699bf058e9` |
| USDT | `0x3e163F861826C3f7878bD8fa8117A179d80731Ab` |

**SDK:** https://github.com/agni-protocol/agni-sdk · `npm install agni-sdk`

## Acceptance criteria
- [ ] Новый плагин `agent/src/plugins/agni/` с `AgniExecutor`.
- [ ] `executeSwap(params)` — вызов `SwapRouter.exactInputSingle()` через viem.
- [ ] `getQuote(params)` — вызов `QuoterV2.quoteExactInputSingle()` (оффчейн, без отправки tx).
- [ ] Конфиг: адреса контрактов, slippage, deadline, RPC из env.
- [ ] Валидация: tokenIn/tokenOut, amount > 0, slippage, лимиты (макс.сумма, дневной объём).
- [ ] Успех → `txHash + amountOut + price`.
- [ ] Ошибка (нет ликвидности, slippage превышен, реверт) → читаемое сообщение.
- [ ] Логирование всех трейдов в runtime-лог.
- [ ] Unit-тесты: успешный своп (мок viem client), превышение лимитов, невалидные параметры, недоступный RPC.

## План реализации

### Шаг 1 — структура плагина (по образу merchant-moe)
Файлы:
- `agent/src/plugins/agni/index.ts` — экспорт `AgniExecutor`
- `agent/src/plugins/agni/executor.ts` — основной класс
- `agent/src/plugins/agni/types.ts` — типы и конфиг
- `agent/src/plugins/agni/constants.ts` — адреса контрактов
- `agent/test/agniPlugin.test.ts` — тесты

### Шаг 2 — `AgniExecutor` class
```typescript
class AgniExecutor {
  constructor(config: AgniConfig)
  async executeSwap(params: SwapParams): Promise<SwapResult>
  async getQuote(params: QuoteParams): Promise<QuoteResult>
  private async sendSwap(params: SwapParams): Promise<`0x${string}`>
  private validateTrade(params): SwapResult | null
  private checkLimits(params): SwapResult | null
  private logTrade(params, result): void
}
```

### Шаг 3 — ключевые функции
- `getQuote` — вызывает `QuoterV2.quoteExactInputSingle()` (view, без газа). Возвращает `amountOut`, `sqrtPriceX96After`.
- `executeSwap` — проверяет quote → если OK, вызывает `SwapRouter.exactInputSingle()` через viem `sendTransaction`.

### Шаг 4 — лимиты (из env)
- `AGNI_MAX_TRADE_AMOUNT` (default 1000 USDC)
- `AGNI_DAILY_LIMIT` (default 5000 USDC)
- `AGNI_DEFAULT_SLIPPAGE` (default 0.5%)
- `AGNI_DEADLINE_SEC` (default 600 = 10 min)

### Шаг 5 — ABI
SwapRouter ABI — стандартный `ISwapRouter` от Uniswap V3:
```solidity
function exactInputSingle(ExactInputSingleParams calldata params)
  external payable returns (uint256 amountOut);

struct ExactInputSingleParams {
  address tokenIn;
  address tokenOut;
  uint24 fee;
  address recipient;
  uint256 deadline;
  uint256 amountIn;
  uint256 amountOutMinimum;
  uint160 sqrtPriceLimitX96;
}
```
QuoterV2 ABI — `quoteExactInputSingle()`.

## Scope
**В scope:** новый плагин `agent/src/plugins/agni/`, тесты, env-конфиг.
**НЕ в scope:** чат/backend, фронтенд, изменение контрактов, Turnkey/Safe.

## Зависимости
- **INFRA-03** — env-переменные `AGNI_*` должны быть в `.env` и Infisical.
- **SC-01** — адрес MolebotNFT нужен для `checkLevelUp` после трейда (зависимость по данным, не блокер).
- **Не зависит от H-1.5** (Byreal) — ключи не требуются, всё on-chain через RPC.

## Тестовая среда
- Mantle Sepolia (chainId 5003), RPC `https://rpc.sepolia.mantle.xyz`
- Тестовые токены: WMNT, USDC, USDT (адреса выше)
- Faucet: https://faucet.sepolia.mantle.xyz/
- Explorer: https://explorer.sepolia.mantle.xyz/

## Notes / лог
- 2026-06-01: Переписан с Byreal → Agni. Byreal — Solana-only, не подходит для Mantle.
- 2026-06-01: Подтверждено Стасом. Agni Finance — рабочий вариант на Mantle Sepolia.
- 2026-06-01: Merchant Moe (AG-02/fallback) удалён из critical path — mainnet-only, нет Sepolia-контрактов.
- 2026-06-01: PR #5 смержен и задеплоен. 1083 строки, 76 тестов ✅
