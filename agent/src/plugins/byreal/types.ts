/**
 * Byreal plugin types
 * Byreal — агрегатор свопов на Mantle (аналог Jupiter для Solana)
 *
 * ⚠️ Stub mode: Byreal API ключи пока не получены (H-1.5).
 * После получения ключей от Стаса: byrealConfig.mockMode = false + apiKey
 */

export interface ByrealConfig {
  /** Byreal API endpoint */
  apiUrl: string;
  /** API ключ (будет получен от Стаса) */
  apiKey: string;
  /** Адрес Safe-кошелька для средств */
  safeAddress: `0x${string}`;
  /** Максимальная сумма одного трейда (в USDC) */
  maxTradeAmount: number;
  /** Максимальный дневной объём (в USDC) */
  dailyLimit: number;
  /** Slippage по умолчанию (в %, например 0.5) */
  defaultSlippage: number;
  /** Режим мока: true — Byreal не вызывается */
  mockMode: boolean;
}

export interface TradeParams {
  /** Адрес токена, который продаём */
  tokenIn: `0x${string}`;
  /** Адрес токена, который покупаем */
  tokenOut: `0x${string}`;
  /** Сумма в smallest unit (wei) */
  amount: string;
  /** Допустимый slippage в % */
  slippage?: number;
  /** Дедлайн (unix timestamp) */
  deadline?: number;
}

export interface TradeResult {
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

export interface TradeLogEntry {
  timestamp: string;
  params: TradeParams;
  result: TradeResult;
}

/** Стандартные адреса токенов на Mantle Sepolia */
export const MANTLE_TOKENS: Record<string, `0x${string}`> = {
  WETH: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111',
  USDC: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
  MNT: '0x0000000000000000000000000000000000000000', // native
};

/** Byreal API endpoint */
export const BYREAL_DEFAULT_API_URL = 'https://api.dev.byreal.io/v1';
