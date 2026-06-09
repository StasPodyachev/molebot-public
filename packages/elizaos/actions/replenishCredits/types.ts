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
export const AI_CREDITS_ADDRESS = '0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64' as const;
export const SAFE_ADDRESS = '0x660eAF880bCAbEf5EA1F174542f419E8eF30B07d' as const;
export const AGENT_WALLET = '0xFecb0b79583A337c8Bd1E390B81661329b78450e' as const;

/** Safe Transaction Service URL (Mantle Sepolia) */
export const SAFE_TX_SERVICE_URL = 'https://safe-transaction.mantle-sepolia.staging.gnosisdev.com' as const;

/** AICredits ABI (только нужные функции) */
export const AI_CREDITS_ABI = [
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'allowance',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'spendCredits',
    inputs: [
      { type: 'address', name: 'from' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'mintCredits',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
] as const;
