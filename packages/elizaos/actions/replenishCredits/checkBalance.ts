/**
 * Проверка баланса AICredits для кошелька агента
 *
 * Lazy-init: клиент создаётся только при первом вызове checkBalance().
 * RPC URL — из конфига (с fallback) для поддержки env-переменных.
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';
import { AI_CREDITS_ADDRESS, AI_CREDITS_ABI, AGENT_WALLET } from './types.js';

const DEFAULT_RPC_URL = 'https://rpc.sepolia.mantle.xyz';

let client: PublicClient | null = null;

function getClient(): PublicClient {
  if (!client) {
    const rpcUrl = process.env['MANTLE_RPC_URL'] ?? DEFAULT_RPC_URL;
    client = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(rpcUrl),
    });
  }
  return client;
}

/**
 * Получить баланс AICredits для указанного адреса
 * @param wallet — адрес кошелька (по умолчанию AGENT_WALLET)
 * @throws Error если RPC недоступен
 */
export async function checkBalance(
  wallet: `0x${string}` = AGENT_WALLET,
): Promise<bigint> {
  const c = getClient();
  const balance = await c.readContract({
    address: AI_CREDITS_ADDRESS,
    abi: AI_CREDITS_ABI,
    functionName: 'balanceOf',
    args: [wallet],
  });
  return balance;
}
