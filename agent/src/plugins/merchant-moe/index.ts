/**
 * Merchant Moe plugin — исполнение трейдов через Merchant Moe DEX на Mantle
 *
 * Fallback-плагин к Byreal (на случай недоступности Byreal).
 * Базируется на LB (Liquidity Book) v2.2 — той же технологии, что LFJ/Trader Joe.
 *
 * ⚠️ Режим мока (mockMode=true) — пока нет доступа к кошельку для подписи.
 * После настройки Safe/ключа: mockMode=false + walletAddress в конфиг.
 *
 * Экспортирует:
 * - MerchantMoeExecutor — класс для исполнения трейдов
 * - executeSwap — функция-обёртка
 * - getQuote — расчёт маршрута
 * - getBalance — проверка баланса
 */

import { MerchantMoeExecutor } from './executor.js';
import { type SwapParams, type SwapResult, type QuoteResult, type BalanceResult } from './types.js';

// Singleton
let executor: MerchantMoeExecutor | null = null;

/**
 * Инициализировать плагин (вызвать при старте агента)
 */
export function initMerchantMoePlugin(config?: Partial<import('./types.js').MerchantMoeConfig>): MerchantMoeExecutor {
  executor = new MerchantMoeExecutor(config);
  return executor;
}

/**
 * Получить текущий экземпляр
 */
export function getMerchantMoeExecutor(): MerchantMoeExecutor {
  if (!executor) {
    executor = new MerchantMoeExecutor();
  }
  return executor;
}

/**
 * Исполнить своп (обёртка)
 */
export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  return getMerchantMoeExecutor().executeSwap(params);
}

/**
 * Получить quote
 */
export async function getQuote(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: string,
): Promise<QuoteResult> {
  return getMerchantMoeExecutor().getQuote(tokenIn, tokenOut, amountIn);
}

/**
 * Получить баланс токена
 */
export async function getBalance(token: `0x${string}`, owner?: `0x${string}`): Promise<BalanceResult> {
  return getMerchantMoeExecutor().getBalance(token, owner);
}

// Re-export типов
export { MerchantMoeExecutor } from './executor.js';
export * from './types.js';
