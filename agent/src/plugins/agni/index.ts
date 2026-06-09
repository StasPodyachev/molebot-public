/**
 * Agni Finance plugin — исполнение трейдов через Agni Finance DEX на Mantle Sepolia
 *
 * Agni — Uniswap V3-style AMM. Плагин вызывает контракты напрямую через viem:
 * - SwapRouter.exactInputSingle() — исполнение свопа
 * - QuoterV2.quoteExactInputSingle() — расчёт цены (оффчейн)
 *
 * ⚠️ Режим мока (mockMode=true) — пока нет доступа к кошельку для подписи.
 * После настройки Safe/ключа: mockMode=false + walletAddress в конфиг.
 *
 * Экспортирует:
 * - AgniExecutor — класс для исполнения трейдов
 * - executeSwap — функция-обёртка
 * - getQuote — расчёт свопа
 * - getBalance — проверка баланса
 */

import { AgniExecutor } from './executor.js';
import {
  type SwapParams,
  type SwapResult,
  type QuoteParams,
  type QuoteResult,
  type BalanceResult,
} from './types.js';

// Singleton
let executor: AgniExecutor | null = null;

/**
 * Инициализировать плагин (вызвать при старте агента)
 */
export function initAgniPlugin(config?: Partial<import('./types.js').AgniConfig>): AgniExecutor {
  executor = new AgniExecutor(config);
  return executor;
}

/**
 * Получить текущий экземпляр
 */
export function getAgniExecutor(): AgniExecutor {
  if (!executor) {
    executor = new AgniExecutor();
  }
  return executor;
}

/**
 * Исполнить своп (обёртка)
 */
export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  return getAgniExecutor().executeSwap(params);
}

/**
 * Получить quote
 */
export async function getQuote(params: QuoteParams): Promise<QuoteResult> {
  return getAgniExecutor().getQuote(params);
}

/**
 * Получить баланс токена
 */
export async function getBalance(token: `0x${string}`, owner?: `0x${string}`): Promise<BalanceResult> {
  return getAgniExecutor().getBalance(token, owner);
}

// Re-export типов и констант
export { AgniExecutor } from './executor.js';
export * from './types.js';
export * from './constants.js';
