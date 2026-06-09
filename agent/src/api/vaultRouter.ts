/**
 * vaultRouter — FE-34: vault balance for dashboard
 *
 * GET /api/vault/balance?tokenId=... — native MNT balance in vault
 *
 * Читает MoleVault.getVaultBalance(tokenId, 0x0) через RPC.
 * Кэш 30 сек чтобы не дудосить RPC.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createPublicClient, http } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface VaultBalanceResponse {
  ok: boolean;
  tokenId: number;
  balance: string;        // wei as string (safe for bigint)
  balanceMnt: string;     // human-readable MNT
  vaultAddress: string;
  cached: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/* -------------------------------------------------------------------------- */
/* Vault contract ABI (getVaultBalance only)                                   */
/* -------------------------------------------------------------------------- */

const vaultAbi = [{
  type: 'function' as const,
  name: 'getVaultBalance',
  inputs: [
    { type: 'uint256', name: 'tokenId' },
    { type: 'address', name: 'token' },
  ],
  outputs: [{ type: 'uint256', name: '' }],
  stateMutability: 'view',
}];

/* -------------------------------------------------------------------------- */
/* Cache                                                                       */
/* -------------------------------------------------------------------------- */

interface CacheEntry {
  balance: bigint;
  ts: number;
}

const cache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 30_000;

/* -------------------------------------------------------------------------- */
/* Router                                                                      */
/* -------------------------------------------------------------------------- */

export class VaultRouter {
  private vaultAddress: `0x${string}`;
  private rpcUrl: string;

  constructor(vaultAddress: `0x${string}`, rpcUrl?: string) {
    this.vaultAddress = vaultAddress;
    this.rpcUrl = rpcUrl ?? 'https://rpc.sepolia.mantle.xyz';
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const method = req.method?.toUpperCase() ?? 'GET';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      this.json(res, 204, null);
      return;
    }

    try {
      if (url.pathname === '/api/vault/balance' && method === 'GET') {
        await this.handleBalance(url, res);
      } else {
        this.json(res, 404, { error: 'not_found' });
      }
    } catch (err) {
      console.error('[vaultRouter] Unhandled:', err);
      this.json(res, 500, { ok: false, errorMessage: `Internal error: ${(err as Error).message}` });
    }
  }

  private async handleBalance(url: URL, res: ServerResponse): Promise<void> {
    const tokenIdStr = url.searchParams.get('tokenId');
    if (!tokenIdStr) {
      this.json(res, 400, { ok: false, errorCode: 'MISSING_TOKENID', errorMessage: 'tokenId обязателен' });
      return;
    }
    const tokenId = Number(tokenIdStr);
    if (!Number.isInteger(tokenId) || tokenId < 1) {
      this.json(res, 400, { ok: false, errorCode: 'INVALID_TOKENID', errorMessage: 'tokenId должен быть > 0' });
      return;
    }

    // Check cache
    const cached = cache.get(tokenId);
    const now = Date.now();
    if (cached && (now - cached.ts) < CACHE_TTL_MS) {
      const balanceMnt = Number(cached.balance) / 1e18;
      this.json(res, 200, {
        ok: true,
        tokenId,
        balance: cached.balance.toString(),
        balanceMnt: balanceMnt.toFixed(4),
        vaultAddress: this.vaultAddress,
        cached: true,
      } satisfies VaultBalanceResponse);
      return;
    }

    // Read from chain
    try {
      const client = createPublicClient({
        chain: mantleSepoliaTestnet,
        transport: http(this.rpcUrl),
      });

      const balance = await client.readContract({
        address: this.vaultAddress,
        abi: vaultAbi,
        functionName: 'getVaultBalance',
        args: [BigInt(tokenId), '0x0000000000000000000000000000000000000000'],
      }) as bigint;

      // Cache
      cache.set(tokenId, { balance, ts: now });

      const balanceMnt = Number(balance) / 1e18;

      this.json(res, 200, {
        ok: true,
        tokenId,
        balance: balance.toString(),
        balanceMnt: balanceMnt.toFixed(4),
        vaultAddress: this.vaultAddress,
        cached: false,
      } satisfies VaultBalanceResponse);
    } catch (err) {
      console.warn(`[vaultRouter] getVaultBalance(${tokenId}) failed:`, (err as Error).message);
      // Fallback: return 0 balance with cached=false
      this.json(res, 200, {
        ok: true,
        tokenId,
        balance: '0',
        balanceMnt: '0.0000',
        vaultAddress: this.vaultAddress,
        cached: false,
        errorCode: 'RPC_ERROR',
        errorMessage: `Не удалось прочитать баланс vault: ${(err as Error).message}`,
      } satisfies VaultBalanceResponse);
    }
  }

  // ── Helpers ──

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
