/**
 * Конфигурация LLM Gateway
 * ✅ Production mode: stubMode=false — ходит в DeepSeek, проверяет AICredits on-chain
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';

export interface GatewayConfig {
  port: number;
  /** URL OpenAI-совместимого LLM провайдера */
  llmProviderUrl: string;
  /** API ключ LLM провайдера */
  llmApiKey: string;
  /** Модель по умолчанию */
  defaultModel: string;
  /** Адрес контракта AICredits (Mantle Sepolia) */
  aiCreditsAddress: `0x${string}`;
  /** Адрес кошелька агента (для spendCredits) */
  agentWalletAddress: `0x${string}`;
  /** Приватный ключ агента (опционально, для spendCredits) */
  agentPrivateKey?: `0x${string}`;
  /** RPC URL Mantle Sepolia */
  mantleRpcUrl: string;
  /** Chain ID */
  chainId: number;
  /** TTL кэша в секундах */
  cacheTtlSec: number;
  /** Режим заглушки: true — мок-ответы, false — реальный LLM + on-chain AICredits */
  stubMode: boolean;
}

function envOr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export function loadConfig(): GatewayConfig {
  const agentPk = process.env['AGENT_PRIVATE_KEY'];
  return {
    port: Number(envOr('LLM_GATEWAY_PORT', '3010')),
    llmProviderUrl: envOr('LLM_PROVIDER_URL', 'https://api.deepseek.com'),
    llmApiKey: envOr('LLM_API_KEY', ''),
    defaultModel: envOr('LLM_DEFAULT_MODEL', 'deepseek-chat'),
    aiCreditsAddress: (envOr('AI_CREDITS_CONTRACT_ADDRESS', '0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64') as `0x${string}`),
    agentWalletAddress: (envOr('AGENT_WALLET_ADDRESS', '0xFecb0b79583A337c8Bd1E390B81661329b78450e') as `0x${string}`),
    agentPrivateKey: agentPk ? (agentPk.startsWith('0x') ? agentPk as `0x${string}` : `0x${agentPk}` as `0x${string}`) : undefined,
    mantleRpcUrl: envOr('MANTLE_RPC_URL', 'https://rpc.sepolia.mantle.xyz'),
    chainId: Number(envOr('CHAIN_ID', '5003')),
    cacheTtlSec: Number(envOr('CACHE_TTL_SEC', '60')),
    stubMode: envOr('LLM_STUB_MODE', 'false') === 'true',
  };
}

/** Viem public client for read-only calls */
let _publicClient: PublicClient | null = null;

export function getPublicClient(config: GatewayConfig): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: { ...mantleSepoliaTestnet, id: config.chainId },
      transport: http(config.mantleRpcUrl),
    });
  }
  return _publicClient;
}

export function resetPublicClient(): void {
  _publicClient = null;
}
