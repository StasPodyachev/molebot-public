/**
 * Agni Finance plugin — типы и интерфейсы
 *
 * Agni — Uniswap V3-style AMM на Mantle.
 * Плагин вызывает контракты напрямую через viem.
 */

// ====== Конфиг ======

export interface AgniConfig {
  /** Адрес SwapRouter */
  routerAddress: `0x${string}`;
  /** Адрес QuoterV2 */
  quoterAddress: `0x${string}`;
  /** Адрес кошелька (recipient свопа) */
  walletAddress: `0x${string}`;
  /** RPC URL (Mantle Sepolia по умолчанию) */
  rpcUrl: string;
  /** Chain ID (5003 — Mantle Sepolia) */
  chainId: number;
  /** Максимальная сумма одного трейда (в USDC) */
  maxTradeAmount: number;
  /** Максимальный дневной объём (в USDC) */
  dailyLimit: number;
  /** Slippage по умолчанию (в %, например 0.5) */
  defaultSlippage: number;
  /** Fee tier (в сотых долях б.п., default 3000 = 0.3%) */
  defaultFeeTier: number;
  /** Дедлайн в секундах (default 600 = 10 min) */
  deadlineSec: number;
  /** Режим мока: true — контракты не вызываются */
  mockMode: boolean;
  /** Мок-баланс для getBalance в mockMode (в wei/smallest unit) */
  mockBalance?: string;
  /** MoleVault address с session keys (T-VAULT-02) */
  vaultAddress: `0x${string}`;
  /** Приватный ключ session agent (НЕ immutable AGENT) */
  sessionPrivateKey?: `0x${string}`;
}

// ====== Параметры свопа ======

export interface SwapParams {
  /** Адрес токена, который продаём */
  tokenIn: `0x${string}`;
  /** Адрес токена, который покупаем */
  tokenOut: `0x${string}`;
  /** Сумма в smallest unit (wei / 6 decimals для USDC) */
  amount: string;
  /** Допустимый slippage в % (переопределяет дефолтный) */
  slippage?: number;
  /** Дедлайн (unix timestamp, сек). Переопределяет deadlineSec из конфига */
  deadline?: number;
  /** Fee tier (переопределяет defaultFeeTier) */
  feeTier?: number;
  /** NFT tokenId (обязателен для session key flow) */
  tokenId?: bigint;
}

// ====== Результат свопа ======

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

// ====== Quote ======

export interface QuoteParams {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amount: string;
  feeTier?: number;
  sqrtPriceLimitX96?: bigint;
}

export interface QuoteResult {
  success: boolean;
  amountOut: string;
  price: number;
  fee: string;
  sqrtPriceX96After?: string;
  initializedTicksCrossed?: number;
  gasEstimate?: string;
  route: string[];
  error?: string;
}

// ====== Баланс ======

export interface BalanceResult {
  token: string;
  balance: string;
  decimals: number;
  error?: string;
}

// ====== Лог ======

export interface TradeLogEntry {
  timestamp: string;
  params: SwapParams;
  result: SwapResult;
}

// ====== Токены ======

/** Адреса токенов на Mantle Sepolia (из agni-sdk) */
export const AGNI_TOKENS: Record<string, `0x${string}`> = {
  MNT: '0x0000000000000000000000000000000000000000' as `0x${string}`,  // native
  WMNT: '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A',
  USDC: '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9',
  USDT: '0x3e163F861826C3f7878bD8fa8117A179d80731Ab',
};
