/**
 * Конфигурация сети Mantle Sepolia для Privy
 */
export const MANTLE_SEPOLIA = {
  id: 5003,
  name: 'Mantle Sepolia',
  rpcUrls: {
    default: { http: ['https://vps.molebot.org/rpc'] },
  },
  nativeCurrency: {
    name: 'MNT',
    symbol: 'MNT',
    decimals: 18,
  },
  blockExplorers: {
    default: { name: 'Mantle Explorer', url: 'https://explorer.sepolia.mantle.xyz' },
  },
} as const;

/** RPC URLs в порядке приоритета — FallbackProvider использует первый доступный */
export const MANTLE_RPC_URLS = [
  'https://vps.molebot.org/rpc',
  'https://rpc.sepolia.mantle.xyz',
  'https://mantle-sepolia.drpc.org',
];

/** Основной RPC для простых провайдеров */
export const MANTLE_RPC_URL = MANTLE_RPC_URLS[0];

/** Chain ID */
export const MANTLE_CHAIN_ID = 5003;
