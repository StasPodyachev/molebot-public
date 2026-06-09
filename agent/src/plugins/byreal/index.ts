/**
 * Byreal plugin — исполнение трейдов через Byreal на Mantle
 *
 * ⚠️ Режим мока (mockMode=true) — пока нет Byreal API ключей от Стаса.
 *   После получения ключей: mockMode=false + apiKey в конфиг.
 *
 * Экспортирует:
 * - ByrealTradeExecutor — класс для исполнения трейдов
 * - executeTrade — функция-обёртка для прямого вызова
 */

import { ByrealTradeExecutor } from './executor.js';
import { type TradeParams, type TradeResult } from './types.js';

// Singleton экземпляр (создаётся при инициализации агента)
let executor: ByrealTradeExecutor | null = null;

/**
 * Инициализировать плагин (вызвать при старте агента)
 */
export function initByrealPlugin(config?: Partial<import('./types.js').ByrealConfig>): ByrealTradeExecutor {
  executor = new ByrealTradeExecutor(config);
  return executor;
}

/**
 * Получить текущий экземпляр
 */
export function getByrealExecutor(): ByrealTradeExecutor {
  if (!executor) {
    executor = new ByrealTradeExecutor();
  }
  return executor;
}

/**
 * Исполнить трейд (обёртка для прямого вызова)
 */
export async function executeTrade(params: TradeParams): Promise<TradeResult> {
  return getByrealExecutor().executeTrade(params);
}

// Re-export типов
export { ByrealTradeExecutor } from './executor.js';
export * from './types.js';
