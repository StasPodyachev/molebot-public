/**
 * Запрос пополнения AICredits через Safe Transaction Service API
 *
 * Создаёт Safe-транзакцию: mintCredits(agentWallet, topUpAmount)
 * Владелец (Stas) должен подтвердить в Safe UI.
 */
import { type TopUpRequest } from './types.js';
/**
 * Проверить, есть ли уже pendng запрос пополнения
 */
export declare function hasPendingTopUp(): TopUpRequest;
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
export declare function requestTopUp(agentWallet?: `0x${string}`, topUpAmount?: bigint): Promise<{
    ok: boolean;
    txId: string | null;
    error?: string;
}>;
/**
 * Сбросить pending (для тестов)
 */
export declare function resetPendingTopUp(): void;
//# sourceMappingURL=requestTopUp.d.ts.map