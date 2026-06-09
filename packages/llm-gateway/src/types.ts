/**
 * Типы для LLM Gateway (OpenAI-совместимый формат)
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** Адрес пользователя для проверки AICredits */
  user?: string;
}

export interface ChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'error';
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CreditsCheckRequest {
  address: `0x${string}`;
  /** Количество кредитов, которое нужно проверить */
  amount: bigint;
}

export interface CreditsCheckResponse {
  ok: boolean;
  address: `0x${string}`;
  balance: string;
  required: string;
  sufficient: boolean;
}

export interface CacheEntry {
  response: ChatResponse;
  timestamp: number;
}

/**
 * ABI для AICredits.sol — viem-формат
 * Контракт: 0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64 (Mantle Sepolia)
 */
export const AI_CREDITS_ABI = [
  {
    type: 'function' as const,
    name: 'spendCredits',
    inputs: [
      { type: 'address', name: 'from' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
] as const;
