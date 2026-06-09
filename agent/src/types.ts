/**
 * Типы для chatBillingService
 */

/** Полезная нагрузка от пользователя */
export interface ChatPaymentPayload {
  /** EIP-712 подпись (hex) */
  signature: `0x${string}`;
  /** Текст сообщения */
  message: string;
  /** Хеш транзакции перевода MNT */
  txHash: `0x${string}`;
  /** Token ID (NFT) */
  tokenId: bigint;
  /** timestamp подписи (unix sec) */
  timestamp: bigint;
}

/** Результат успешной верификации */
export interface ChatPaymentSuccess {
  valid: true;
  tokenId: bigint;
  message: string;
  /** Адрес подписавшего (recoverFromSignature) */
  signer: `0x${string}`;
}

/** Типизированная ошибка верификации */
export type ChatPaymentErrorCode =
  | 'NotTokenOwner'
  | 'WrongRecipient'
  | 'WrongSender'
  | 'InsufficientFee'
  | 'TxTooOld'
  | 'TxAlreadyUsed'
  | 'INVALID_INPUT'
  | 'INTERNAL_ERROR';

export interface ChatPaymentError {
  valid: false;
  error: ChatPaymentErrorCode;
  detail?: string;
}

export type ChatPaymentResult = ChatPaymentSuccess | ChatPaymentError;

/** EIP-712 типы для ChatPayment */
export const chatPaymentTypes = {
  ChatPayment: [
    { name: 'tokenId',   type: 'uint256' },
    { name: 'message',   type: 'string' },
    { name: 'txHash',    type: 'bytes32' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

/** EIP-712 primaryType */
export const chatPaymentPrimaryType = 'ChatPayment' as const;

/* ======================================================================== */
/* FR-002: Chat API типы                                                      */
/* ======================================================================== */

/** POST /api/chat — тело запроса */
export interface ChatRequest {
  signature: `0x${string}`;
  message: string;
  txHash: `0x${string}`;
  tokenId: number;
  timestamp: number;
}

/** POST /api/chat — успешный ответ */
export interface ChatSuccessResponse {
  ok: true;
  reply: string;
  mood: number;
  tokenId: number;
  /** TASK-016: trading action type (open/close/status/null) */
  action?: string | null;
  /** TASK-016: transaction hash if action was executed */
  txHash?: string;
}

/** POST /api/chat — ошибочный ответ */
export interface ChatErrorResponse {
  ok: false;
  errorCode: ChatPaymentErrorCode;
  errorMessage: string;
}

export type ChatResponse = ChatSuccessResponse | ChatErrorResponse;

/** GET /api/chat/history — элемент истории */
export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  message: string;
  mood: number;
  timestamp: number;
}

/** GET /api/chat/history — ответ */
export interface ChatHistoryResponse {
  entries: ChatHistoryEntry[];
  tokenId: number;
}

/* ======================================================================== */
/* FE-24: ChatSession — batch approve 10 сообщений                              */
/* ======================================================================== */

/** EIP-712 типы для ChatSession (один раз на spendLimit сообщений) */
export const chatSessionTypes = {
  ChatSession: [
    { name: 'tokenId',    type: 'uint256' },
    { name: 'spendLimit', type: 'uint256' },
    { name: 'timestamp',  type: 'uint256' },
  ],
} as const;

export const chatSessionPrimaryType = 'ChatSession' as const;

/** POST /api/chat/session — тело запроса */
export interface ChatSessionRequest {
  tokenId: number;
  signature: `0x${string}`;
  spendLimit?: number;
  timestamp: number;
}

/** POST /api/chat/session — ответ */
export interface ChatSessionResponse {
  ok: boolean;
  sessionActive?: boolean;
  remaining?: number;
  spendLimit?: number;
  errorCode?: string;
  errorMessage?: string;
}

/** GET /api/chat/quota — ответ */
export interface ChatQuotaResponse {
  tokenId: number;
  remaining?: number;
  spendLimit?: number;
  active: boolean;
}

/** Сессия в памяти */
export interface ChatSessionData {
  tokenId: number;
  spendLimit: number;
  used: number;
  signer: `0x${string}`;
  createdAt: number;
}

/** Билл-лог запись */
export interface BillingLogEntry {
  timestamp: string;
  tokenId: number;
  txHash: string;
  signer: string;
  message: string;
  fee: string;
  chainId: number;
}

/* ======================================================================== */
/* FR-003: Price Service типы                                                 */
/* ======================================================================== */

export type PriceSymbol = 'BTC/USD' | 'ETH/USD' | 'SOL/USD';
export type PriceSource = 'pyth' | 'coinpaprika';

export interface PriceData {
  symbol: PriceSymbol;
  price: number;
  confidence: number;
  timestamp: number; // unix seconds
  source: PriceSource;
}

export interface PriceCacheEntry {
  data: PriceData;
  timestamp: number; // unix ms когда был закэширован
}

export const PRICE_SYMBOLS: PriceSymbol[] = ['BTC/USD', 'ETH/USD', 'SOL/USD'];

/** Symbol → Pyth feed ID lookup (единственный source of truth) */
export const SYMBOL_TO_PYTH_ID: Record<PriceSymbol, string> = {
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
};

/* ======================================================================== */
/* TASK-013: Dex Price types                                                 */
/* ======================================================================== */

/** Supported DEX pairs */
export type DexPair = 'MNT/USDC' | 'ETH/MNT' | 'WMNT/USDC' | 'USDC/MNT';

/** Where the price came from */
export type DexPriceSource = 'agni_quoter' | 'cache' | 'mock' | 'fallback';

/** Price data for a DEX pair */
export interface DexPriceData {
  pair: DexPair;
  price: number;
  /** Token amounts from quoter (raw, in smallest unit) */
  amountIn: string;
  amountOut: string;
  source: DexPriceSource;
  timestamp: number; // unix ms
  /** Error message if price unavailable (empty string = ok) */
  error?: string;
}

/** Candle (5-min OHLC) */
export interface Candle {
  pair: DexPair;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number; // unix ms (start of 5-min bucket)
  /** Whether this candle is closed (full 5-min elapsed) */
  closed: boolean;
}

/**
 * Token address mapping per pair.
 * Order: [tokenIn, tokenOut] for the Agni QuoterV2 quote.
 * For pairs marked with `invert: true`, the price is 1 / quotePrice.
 */
export const PAIR_TOKENS: Record<DexPair, { tokenIn: `0x${string}`; tokenOut: `0x${string}` }> = {
  'MNT/USDC': {
    tokenIn: '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A',  // WMNT
    tokenOut: '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9', // USDC
  },
  'ETH/MNT': {
    tokenIn: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',  // WETH (Mantle canonical)
    tokenOut: '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A', // WMNT
  },
  'WMNT/USDC': {
    tokenIn: '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A',  // WMNT
    tokenOut: '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9', // USDC
  },
  'USDC/MNT': {
    tokenIn: '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9', // USDC
    tokenOut: '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A',  // WMNT
  },
};

/** All supported DEX pairs */
export const DEX_PAIRS: DexPair[] = ['MNT/USDC', 'ETH/MNT', 'WMNT/USDC', 'USDC/MNT'];

/** Decimal precision per token (for price normalisation) */
export const TOKEN_DECIMALS: Record<string, number> = {
  '0xEa12Be2389c2254bAaD383c6eD1fa1e15202b52A': 18,  // WMNT
  '0x82a2eb46a64e4908bbc403854bc8aa699bf058e9': 6,   // USDC
  '0xDeadDeAddeAddEAddeadDEaDDEAddEAdDEAdDEad1111': 18, // WETH
};
