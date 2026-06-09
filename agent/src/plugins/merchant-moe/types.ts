/**
 * Merchant Moe plugin types
 * Merchant Moe — DEX на Mantle на базе Liquidity Book (LB) v2.2 (бывший Trader Joe)
 *
 * Контракты (Mantle Mainnet, chainId 5000):
 *   LB Router: 0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a
 *   LB Quoter: 0x501b8AFd35df20f531fF45F6f695793AC3316c85
 *   LB Factory: 0xa6630671775c4EA2743840F9A5016dCf2A104054
 */

export interface MerchantMoeConfig {
  /** LB Router address */
  routerAddress: `0x${string}`;
  /** LB Quoter address (для расчёта quote) */
  quoterAddress: `0x${string}`;
  /** Адрес кошелька агента (или Safe) */
  walletAddress: `0x${string}`;
  /** RPC URL Mantle */
  rpcUrl: string;
  /** Chain ID (5000 — mainnet, 5003 — sepolia) */
  chainId: number;
  /** Максимальная сумма одного трейда (в USDC) */
  maxTradeAmount: number;
  /** Максимальный дневной объём (в USDC) */
  dailyLimit: number;
  /** Slippage по умолчанию (в %, например 0.5) */
  defaultSlippage: number;
  /** Режим мока: true — контракты не вызываются */
  mockMode: boolean;
  /** Мок-баланс для getBalance в mockMode (в wei/smallest unit) */
  mockBalance?: string;
}

export interface SwapParams {
  /** Адрес токена, который продаём */
  tokenIn: `0x${string}`;
  /** Адрес токена, который покупаем */
  tokenOut: `0x${string}`;
  /** Сумма в smallest unit (wei) */
  amount: string;
  /** Допустимый slippage в % */
  slippage?: number;
  /** Дедлайн (unix timestamp, сек) */
  deadline?: number;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  price: number;
  fee: string;
  error?: string;
}

export interface QuoteResult {
  success: boolean;
  amountOut: string;
  price: number;
  fee: string;
  route: string[];
  pairs: string[];
  error?: string;
}

export interface BalanceResult {
  token: string;
  balance: string;
  decimals: number;
  error?: string;
}

export interface TradeLogEntry {
  timestamp: string;
  params: SwapParams;
  result: SwapResult;
}

/**
 * Стандартные адреса токенов на Mantle (mainnet)
 * ⚠️ WETH адрес — заглушка. На Mantle WETH — это bridge-токен.
 *    Каноничный адрес уточнить через Mantle Explorer.
 *    WMNT (wrapped MNT) — нативный wrapped токен, адрес корректен.
 */
export const MANTLE_TOKENS: Record<string, `0x${string}`> = {
  MNT:  '0x0000000000000000000000000000000000000000', // native
  USDC: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
  WETH: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111', // ⚠️ заглушка, уточнить
  USDT: '0x201EBa5CC46D216Ce6DC03F8968D2B8d8eC0c0eD',
  WMNT: '0x78c1b0C915c4FAA5FfA6CAbf0219DA63d7F7cb13',
};

/** LB Router address on Mantle (mainnet) */
export const MERCHANT_MOE_ROUTER = '0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a' as const;

/** LB Quoter address on Mantle (mainnet) */
export const MERCHANT_MOE_QUOTER = '0x501b8AFd35df20f531fF45F6f695793AC3316c85' as const;

/** Минимальный ABI LBRouter для swap */
export const LB_ROUTER_ABI = [
  {
    type: 'function' as const,
    name: 'swapExactTokensForTokens',
    inputs: [
      { type: 'uint256', name: 'amountIn' },
      { type: 'uint256', name: 'amountOutMin' },
      {
        type: 'tuple',
        name: 'path',
        components: [
          { type: 'uint256[]', name: 'pairBinSteps' },
          { type: 'uint8[]',   name: 'versions' },
          { type: 'address[]', name: 'tokenPath' },
        ],
      },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'deadline' },
    ],
    outputs: [{ type: 'uint256', name: 'amountOut' }],
    stateMutability: 'payable' as const,
  },
  {
    type: 'function' as const,
    name: 'swapExactNATIVEForTokens',
    inputs: [
      { type: 'uint256', name: 'amountOutMin' },
      {
        type: 'tuple',
        name: 'path',
        components: [
          { type: 'uint256[]', name: 'pairBinSteps' },
          { type: 'uint8[]',   name: 'versions' },
          { type: 'address[]', name: 'tokenPath' },
        ],
      },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'deadline' },
    ],
    outputs: [{ type: 'uint256', name: 'amountOut' }],
    stateMutability: 'payable' as const,
  },
  {
    type: 'function' as const,
    name: 'swapExactTokensForNATIVE',
    inputs: [
      { type: 'uint256', name: 'amountIn' },
      { type: 'uint256', name: 'amountOutMin' },
      {
        type: 'tuple',
        name: 'path',
        components: [
          { type: 'uint256[]', name: 'pairBinSteps' },
          { type: 'uint8[]',   name: 'versions' },
          { type: 'address[]', name: 'tokenPath' },
        ],
      },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'deadline' },
    ],
    outputs: [{ type: 'uint256', name: 'amountOut' }],
    stateMutability: 'payable' as const,
  },
] as const;

/** Минимальный ABI LBQuoter */
export const LB_QUOTER_ABI = [
  {
    type: 'function' as const,
    name: 'findBestPathFromAmountIn',
    inputs: [
      { type: 'address[]', name: 'route' },
      { type: 'uint128',   name: 'amountIn' },
    ],
    outputs: [{
      type: 'tuple',
      name: 'quote',
      components: [
        { type: 'address[]', name: 'route' },
        { type: 'address[]', name: 'pairs' },
        { type: 'uint256[]', name: 'binSteps' },
        { type: 'uint8[]',   name: 'versions' },
        { type: 'uint128[]', name: 'amounts' },
        { type: 'uint128[]', name: 'virtualAmountsWithoutSlippage' },
        { type: 'uint128[]', name: 'fees' },
      ],
    }],
    stateMutability: 'view' as const,
  },
] as const;

/** Минимальный ERC20 ABI */
export const ERC20_ABI = [
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
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
] as const;
