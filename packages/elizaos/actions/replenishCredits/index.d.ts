/**
 * ReplenishCreditsAction — биллинг AICredits для трейдинга
 *
 * Проверка баланса AICredits, запрос пополнения через Safe.
 *
 * Триггеры:
 * - Перед отправкой сообщения в LLM Gateway
 * - Перед трейдом в Merchant Moe
 *
 * Использование:
 * ```ts
 * import { replenishCredits } from './replenishCredits/index.js';
 *
 * const result = await replenishCredits({
 *   agentWallet: '0xFecb0...',
 *   minThreshold: ethers.parseUnits("1", 18),
 *   topUpAmount: ethers.parseUnits("100", 18),
 * });
 * ```
 */
import type { ReplenishCreditsParams, ReplenishCreditsResult } from './types.js';
/**
 * Полный цикл: проверка → решение → пополнение
 *
 * 1. Проверить balanceOf(agentWallet) на AICredits
 * 2. Если balance >= minThreshold → ok, ничего не делаем
 * 3. Если balance < minThreshold → запросить пополнение через Safe
 */
export declare function replenishCredits(params: ReplenishCreditsParams): Promise<ReplenishCreditsResult>;
export { resetPendingTopUp } from './requestTopUp.js';
export { checkBalance } from './checkBalance.js';
export { requestTopUp } from './requestTopUp.js';
export type { ReplenishCreditsParams, ReplenishCreditsResult } from './types.js';
//# sourceMappingURL=index.d.ts.map