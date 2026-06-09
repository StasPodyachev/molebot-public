/**
 * Запрос пополнения AICredits через Safe Transaction Service API
 *
 * Создаёт Safe-транзакцию: mintCredits(agentWallet, topUpAmount)
 * Владелец (Stas) должен подтвердить в Safe UI.
 */
import { AGENT_WALLET, } from './types.js';
/** Память pending-запроса (чтобы не спамить Safe) */
let pendingRequest = null;
/** Таймаут pending-запроса (10 минут) */
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;
/** Кодировать mintCredits(to, amount) в calldata */
function encodeMintCredits(to, amount) {
    // function selector: mintCredits(address,uint256) = keccak256("mintCredits(address,uint256)")[:4]
    const SELECTOR = '0x40c10f19';
    const toPadded = to.slice(2).padStart(64, '0');
    const amountPadded = amount.toString(16).padStart(64, '0');
    return `${SELECTOR}${toPadded}${amountPadded}`;
}
/**
 * Проверить, есть ли уже pendng запрос пополнения
 */
export function hasPendingTopUp() {
    if (!pendingRequest) {
        return { hasPending: false };
    }
    const expired = Date.now() - pendingRequest.timestamp > PENDING_TIMEOUT_MS;
    if (expired) {
        pendingRequest = null;
        return { hasPending: false };
    }
    return {
        hasPending: true,
        pendingTxId: pendingRequest.txId,
    };
}
/**
 * Запросить пополнение AICredits через Safe Transaction Service
 *
 * @param agentWallet — адрес кошелька агента (получатель кредитов)
 * @param topUpAmount — количество кредитов
 * @returns топ-ап результат с id транзакции
 *
 * ⚠️ Для реального вызова нужен Safe API ключ.
 *   Пока работает в mockMode.
 */
export async function requestTopUp(agentWallet = AGENT_WALLET, topUpAmount = BigInt('100000000000000000000')) {
    // Проверка pending запроса
    const pending = hasPendingTopUp();
    if (pending.hasPending) {
        return {
            ok: false,
            txId: pending.pendingTxId ?? null,
            error: `Top-up already pending (tx: ${pending.pendingTxId ?? 'unknown'})`,
        };
    }
    try {
        const data = encodeMintCredits(agentWallet, topUpAmount);
        // В mockMode — просто логируем, не отправляем в Safe API
        const mockTxId = `mock-tx-${Date.now()}`;
        console.log('[ReplenishCredits] Requesting top-up via Safe:');
        console.log(`  to: ${agentWallet}`);
        console.log(`  amount: ${topUpAmount.toString()}`);
        console.log(`  data: ${data}`);
        console.log(`  → mock txId: ${mockTxId}`);
        pendingRequest = {
            timestamp: Date.now(),
            txId: mockTxId,
        };
        return { ok: true, txId: mockTxId };
        // TODO: реальный вызов Safe Transaction Service API
        // const url = `${SAFE_TX_SERVICE_URL}/api/v1/safes/${SAFE_ADDRESS}/transactions/`;
        // const body = {
        //   to: AI_CREDITS_ADDRESS,
        //   value: 0,
        //   data,
        //   operation: 0, // CALL
        // };
        // const res = await fetch(url, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(body),
        // });
        // if (!res.ok) throw new Error(`Safe API error: ${res.status} ${await res.text()}`);
        // const tx = await res.json();
        // pendingRequest = { timestamp: Date.now(), txId: tx.transactionHash };
        // return { ok: true, txId: tx.transactionHash };
    }
    catch (err) {
        return {
            ok: false,
            txId: null,
            error: `Failed to request top-up: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
/**
 * Сбросить pending (для тестов)
 */
export function resetPendingTopUp() {
    pendingRequest = null;
}
//# sourceMappingURL=requestTopUp.js.map