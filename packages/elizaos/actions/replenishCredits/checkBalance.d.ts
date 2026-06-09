/**
 * Проверка баланса AICredits для кошелька агента
 *
 * Lazy-init: клиент создаётся только при первом вызове checkBalance().
 * RPC URL — из конфига (с fallback) для поддержки env-переменных.
 */
/**
 * Получить баланс AICredits для указанного адреса
 * @param wallet — адрес кошелька (по умолчанию AGENT_WALLET)
 * @throws Error если RPC недоступен
 */
export declare function checkBalance(wallet?: `0x${string}`): Promise<bigint>;
//# sourceMappingURL=checkBalance.d.ts.map