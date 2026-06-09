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

import { checkBalance } from './checkBalance.js';
import { requestTopUp, hasPendingTopUp, resetPendingTopUp } from './requestTopUp.js';
import type { ReplenishCreditsParams, ReplenishCreditsResult } from './types.js';

const LOG_FILE = './logs/replenishCredits.log';

/**
 * Полный цикл: проверка → решение → пополнение
 *
 * 1. Проверить balanceOf(agentWallet) на AICredits
 * 2. Если balance >= minThreshold → ok, ничего не делаем
 * 3. Если balance < minThreshold → запросить пополнение через Safe
 */
export async function replenishCredits(
  params: ReplenishCreditsParams,
): Promise<ReplenishCreditsResult> {
  const { agentWallet, minThreshold, topUpAmount } = params;
  const timestamp = new Date().toISOString();

  try {
    // Шаг 1: проверить баланс
    const balance = await checkBalance(agentWallet);

    // Шаг 2: если хватает — ничего не делаем
    if (balance >= minThreshold) {
      log(`${timestamp} [${agentWallet}] balance=${balance.toString()} threshold=${minThreshold.toString()} action=none`);
      return { ok: true, balance, action: 'none' };
    }

    // Шаг 3: проверяем есть ли уже pending запрос
    const pending = hasPendingTopUp();
    if (pending.hasPending) {
      log(`${timestamp} [${agentWallet}] balance=${balance.toString()} threshold=${minThreshold.toString()} action=pending_exists (tx: ${pending.pendingTxId ?? 'unknown'})`);
      return { ok: false, balance, action: 'pending_exists', error: `Top-up already pending (tx: ${pending.pendingTxId})` };
    }

    // Шаг 4: запрашиваем пополнение
    const topUp = await requestTopUp(agentWallet, topUpAmount);
    if (!topUp.ok) {
      log(`${timestamp} [${agentWallet}] balance=${balance.toString()} threshold=${minThreshold.toString()} action=error error="${topUp.error}"`);
      return { ok: false, balance, action: 'error', error: topUp.error };
    }

    log(`${timestamp} [${agentWallet}] balance=${balance.toString()} threshold=${minThreshold.toString()} action=requested tx=${topUp.txId}`);
    return { ok: true, balance, action: 'requested' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`${timestamp} [${agentWallet}] balance=? threshold=${minThreshold.toString()} action=error error="${msg}"`);
    return { ok: false, balance: 0n, action: 'error', error: msg };
  }
}

/** Логирование */
function log(entry: string): void {
  console.log(`[ReplenishCredits] ${entry}`);
  // TODO: файловый лог
  // import { appendFileSync } from 'node:fs';
  // appendFileSync(LOG_FILE, entry + '\n');
}

export { resetPendingTopUp } from './requestTopUp.js';
export { checkBalance } from './checkBalance.js';
export { requestTopUp } from './requestTopUp.js';
export type { ReplenishCreditsParams, ReplenishCreditsResult } from './types.js';
