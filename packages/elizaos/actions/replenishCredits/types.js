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
/** Адреса контрактов */
export const AI_CREDITS_ADDRESS = '0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64';
export const SAFE_ADDRESS = '0x660eAF880bCAbEf5EA1F174542f419E8eF30B07d';
export const AGENT_WALLET = '0xFecb0b79583A337c8Bd1E390B81661329b78450e';
/** Safe Transaction Service URL (Mantle Sepolia) */
export const SAFE_TX_SERVICE_URL = 'https://safe-transaction.mantle-sepolia.staging.gnosisdev.com';
/** AICredits ABI (только нужные функции) */
export const AI_CREDITS_ABI = [
    {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ type: 'address', name: 'account' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'allowance',
        inputs: [
            { type: 'address', name: 'owner' },
            { type: 'address', name: 'spender' },
        ],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'spendCredits',
        inputs: [
            { type: 'address', name: 'from' },
            { type: 'uint256', name: 'amount' },
        ],
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'mintCredits',
        inputs: [
            { type: 'address', name: 'to' },
            { type: 'uint256', name: 'amount' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
];
//# sourceMappingURL=types.js.map