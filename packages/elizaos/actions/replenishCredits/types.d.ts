/**
 * C-AG-05 — ReplenishCreditsAction
 *
 * Типы для проверки баланса AICredits и запроса пополнения через Safe.
 *
 * Контракты (Mantle Sepolia):
 *   AICredits: 0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64
 *   Safe:      0x660eAF880bCAbEf5EA1F174542f419E8eF30B07d
 *   Agent:     0xFecb0b79583A337c8Bd1E390B81661329b78450e
 */
export interface ReplenishCreditsParams {
    /** Адрес кошелька агента */
    agentWallet: `0x${string}`;
    /** Минимальный баланс для триггера (напр. 1 токен = 10^18) */
    minThreshold: bigint;
    /** Сколько запросить при пополнении (напр. 100 * 10^18) */
    topUpAmount: bigint;
}
export type ReplenishAction = 'none' | 'requested' | 'pending_exists' | 'error';
export interface ReplenishCreditsResult {
    ok: boolean;
    balance: bigint;
    action: ReplenishAction;
    error?: string;
}
export interface TopUpRequest {
    /** Есть ли уже pendng запрос */
    hasPending: boolean;
    /** ID pending транзакции (если есть) */
    pendingTxId?: string;
}
/** Адреса контрактов */
export declare const AI_CREDITS_ADDRESS: "0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64";
export declare const SAFE_ADDRESS: "0x660eAF880bCAbEf5EA1F174542f419E8eF30B07d";
export declare const AGENT_WALLET: "0xFecb0b79583A337c8Bd1E390B81661329b78450e";
/** Safe Transaction Service URL (Mantle Sepolia) */
export declare const SAFE_TX_SERVICE_URL: "https://safe-transaction.mantle-sepolia.staging.gnosisdev.com";
/** AICredits ABI (только нужные функции) */
export declare const AI_CREDITS_ABI: readonly [{
    readonly type: "function";
    readonly name: "balanceOf";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "allowance";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "owner";
    }, {
        readonly type: "address";
        readonly name: "spender";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "spendCredits";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "mintCredits";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "to";
    }, {
        readonly type: "uint256";
        readonly name: "amount";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}];
//# sourceMappingURL=types.d.ts.map