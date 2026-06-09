/**
 * tradingIntentParser — regex-based intent detection for chat trading commands
 *
 * TASK-016: Chat-to-Blockchain Trading Commands
 *
 * Распознаёт торговые команды в тексте сообщения:
 *   - "открой лонг ETH/MNT на 100" → { action: "open", pair: "ETH/MNT", side: "long", amount: 100 }
 *   - "закрой позицию" → { action: "close" }
 *   - "сколько позиция?" / "покажи pnl" → { action: "status" }
 *
 * Возвращает null если сообщение не является торговой командой.
 *
 * Используется как быстрый fallback/primary парсер; LLM может докрутить
 * сложные формулировки.
 */

import type { SwapParams } from '../plugins/agni/types.js';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface TradingIntent {
  action: 'open' | 'close' | 'status';
  pair?: string;
  side?: 'long' | 'short';
  /** Amount in USD (user-specified) */
  amount?: number;
}

/** Pairs we can trade from chat */
export type TradingPair = 'ETH/MNT' | 'MNT/USDC' | 'WMNT/USDC' | 'USDC/MNT';

/* -------------------------------------------------------------------------- */
/* Token addresses (Mantle Sepolia)                                            */
/* -------------------------------------------------------------------------- */

const WETH = '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111' as const;
const WMNT = '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A' as const;
const USDC = '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9' as const;

interface PairConfig {
  base: `0x${string}`;    // base currency (first in pair, e.g. ETH in ETH/MNT)
  quote: `0x${string}`;   // quote currency (second in pair, e.g. MNT in ETH/MNT)
  mockPrice: number;      // mock price for USD conversion (quote per base)
  baseDecimals: number;
  quoteDecimals: number;
}

const PAIR_CONFIG: Record<TradingPair, PairConfig> = {
  'ETH/MNT':    { base: WETH, quote: WMNT, mockPrice: 6200, baseDecimals: 18, quoteDecimals: 18 },
  'MNT/USDC':   { base: WMNT, quote: USDC, mockPrice: 0.35, baseDecimals: 18, quoteDecimals: 6 },
  'WMNT/USDC':  { base: WMNT, quote: USDC, mockPrice: 0.35, baseDecimals: 18, quoteDecimals: 6 },
  'USDC/MNT':   { base: USDC, quote: WMNT, mockPrice: 2.86, baseDecimals: 6,  quoteDecimals: 18 },
};

/** MNT/USDC price (mock, for USD→MNT conversion) */
const MNT_USDC_PRICE = 0.35;

/* -------------------------------------------------------------------------- */
/* Regex patterns                                                              */
/* -------------------------------------------------------------------------- */

const OPEN_RE = /откр(?:ой|ыть|ываю|ываем|ывай)\s+(лонг|шорт|long|short)\s+(\w+\/\w+)\s+на\s+(\d+(?:\.\d+)?)/i;
const CLOSE_RE = /закр(?:ой|ыть|ываю|ываем|ывай)\s+позици[юи]/i;
const STATUS_RE = /позици[юя]|pnl/i;

/** Recognised pair aliases → canonical form */
const PAIR_ALIASES: Record<string, TradingPair> = {
  'ETH/MNT': 'ETH/MNT',
  'MNT/USDC': 'MNT/USDC',
  'WMNT/USDC': 'WMNT/USDC',
  'USDC/MNT': 'USDC/MNT',
  'ETH-MNT': 'ETH/MNT',
  'MNT-USDC': 'MNT/USDC',
};

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Parse a user message for trading commands.
 * Returns TradingIntent or null (not a trading command).
 */
export function parseTradingCommand(message: string): TradingIntent | null {
  if (!message || typeof message !== 'string') return null;

  const trimmed = message.trim();

  // 1. Try "open" pattern
  const openMatch = trimmed.match(OPEN_RE);
  if (openMatch) {
    const sideRaw = openMatch[1].toLowerCase();
    const side: 'long' | 'short' = (sideRaw === 'лонг' || sideRaw === 'long') ? 'long' : 'short';
    const pairRaw = openMatch[2].toUpperCase().replace('-', '/');
    const pair = PAIR_ALIASES[pairRaw] ?? pairRaw;
    const amount = parseFloat(openMatch[3]);
    if (isNaN(amount) || amount <= 0) return null;
    return { action: 'open', pair, side, amount };
  }

  // 2. Try "close" pattern
  if (CLOSE_RE.test(trimmed)) {
    return { action: 'close' };
  }

  // 3. Try "status" pattern (least specific — check last)
  if (STATUS_RE.test(trimmed)) {
    return { action: 'status' };
  }

  return null;
}

/**
 * Convert TradingIntent → SwapParams for Agni executor.
 * Returns null if intent is not "open" or pair is unknown.
 */
export function intentToSwapParams(intent: TradingIntent): SwapParams | null {
  if (intent.action !== 'open' || !intent.pair || !intent.side || intent.amount === undefined) {
    return null;
  }

  const pairKey = intent.pair as TradingPair;
  const config = PAIR_CONFIG[pairKey];
  if (!config) return null;

  const { base, quote, mockPrice, baseDecimals, quoteDecimals } = config;

  // LONG: buy base, sell quote → tokenIn=quote, tokenOut=base
  // SHORT: sell base, buy quote → tokenIn=base, tokenOut=quote
  const isLong = intent.side === 'long';
  const tokenIn: `0x${string}` = isLong ? quote : base;
  const tokenOut: `0x${string}` = isLong ? base : quote;

  // Amount in USD → smallest unit of tokenIn
  const amount = intent.amount;
  let amountStr: string;

  if (isLong && quote === USDC) {
    // Quote is USDC: amount is already in USD → 6 decimals
    amountStr = BigInt(Math.floor(amount * 1_000_000)).toString();
  } else if (!isLong && base === USDC) {
    // Selling USDC: amount already in USD → 6 decimals
    amountStr = BigInt(Math.floor(amount * 1_000_000)).toString();
  } else {
    // Quote/base is MNT/ETH: convert USD → token via mock price
    const targetDecimals = isLong ? quoteDecimals : baseDecimals;
    const tokenPrice = isLong ? (quote === WMNT ? MNT_USDC_PRICE : mockPrice) : (base === WMNT ? MNT_USDC_PRICE : mockPrice);
    const tokenAmount = amount / tokenPrice;
    const multiplier = 10 ** targetDecimals;
    amountStr = BigInt(Math.floor(tokenAmount * multiplier)).toString();
  }

  return {
    tokenIn,
    tokenOut,
    amount: amountStr,
  };
}

/**
 * Get the display price for a pair (mock, for response formatting).
 */
export function getMockPrice(pair: string): number {
  const config = PAIR_CONFIG[pair as TradingPair];
  return config?.mockPrice ?? 0;
}

/**
 * Check if a pair is known/supported.
 */
export function isKnownPair(pair: string): boolean {
  return pair.toUpperCase() in PAIR_CONFIG;
}
