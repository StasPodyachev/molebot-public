/**
 * Конфигурация chatBillingService
 * Загружается из env с fallback для тестов
 */

export interface AppConfig {
  /** Адрес контракта MolebotNFT (Mantle Sepolia) */
  contractAddress: `0x${string}`;
  /** Адрес кошелька агента (куда пользователи шлют MNT) */
  agentWallet: `0x${string}`;
  /** RPC URL Mantle Sepolia */
  rpcUrl: string;
  /** Chain ID Mantle Sepolia */
  chainId: number;
  /** Минимальная плата за сообщение (в wei) */
  chatFee: bigint;
  /** Максимальный возраст транзакции (сек) */
  txMaxAgeSec: number;
  /** TTL для usedTxHashes в Redis (сек) */
  redisTtlSec: number;
  /** Путь к SQLite файлу (fallback) */
  sqlitePath: string;
  /** Redis URL (опционально) */
  redisUrl?: string;
  /** EIP-712 domain */
  eip712Domain: {
    name: string;
    version: string;
    chainId: number;
  };
  /** ChromaDB URL (optional) */
  chromaUrl?: string;
  /** GitHub token для лога биллинга (optional) */
  githubToken?: string;
  /** GitHub repo для лога биллинга */
  githubRepo: string;
  /** LLM Gateway URL (опционально, см. C-AI-02) */
  llmGatewayUrl?: string;
}

export const CHAT_FEE_ETHER = '0.001';

function envOr(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function envOrUndefined(name: string): string | undefined {
  return process.env[name];
}

export function loadConfig(): AppConfig {
  return {
    contractAddress: (envOr('NFT_CONTRACT_ADDRESS', '0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb') as `0x${string}`),
    agentWallet:     (envOr('AGENT_WALLET_ADDRESS', '') as `0x${string}`),
    rpcUrl:          envOr('MANTLE_RPC_URL', 'https://rpc.sepolia.mantle.xyz'),
    chainId:         Number(envOr('CHAIN_ID', '5003')),
    chatFee:         BigInt(envOr('CHAT_FEE_WEI', '1000000000000000')), // 0.001 ether
    txMaxAgeSec:     Number(envOr('TX_MAX_AGE_SEC', '600')),           // 10 min
    redisTtlSec:     Number(envOr('REDIS_TTL_SEC', '86400')),          // 24h
    sqlitePath:      envOr('SQLITE_PATH', './data/used_tx.db'),
    redisUrl:        envOrUndefined('REDIS_URL'),
    chromaUrl:       envOrUndefined('CHROMA_URL'),
    githubToken:     envOrUndefined('GITHUB_TOKEN'),
    githubRepo:      envOr('GITHUB_REPO', 'StasPodyachev/molebot_mantle'),
    llmGatewayUrl:   envOrUndefined('LLM_GATEWAY_URL'),
    eip712Domain: {
      name:    'MolebotChat',
      version: '1',
      chainId: Number(envOr('CHAIN_ID', '5003')),
    },
  };
}
