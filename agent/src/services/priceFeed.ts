/**
 * priceFeed — TASK-013: DEX price feed via Agni QuoterV2 on Mantle
 *
 * Источники (в порядке приоритета):
 *   1. In-memory cache (TTL 60 сек)
 *   2. Agni QuoterV2 (ончейн, read-only)
 *   3. Последняя кэшированная цена (graceful fallback, НЕ ошибка)
 *   4. Mock mode (MOCK_PRICES=true) — random walk симуляция
 *
 * Поддерживаемые пары: MNT/USDC, ETH/MNT, WMNT/USDC, USDC/MNT
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { mantleSepoliaTestnet } from 'viem/chains';
import type { DexPair, DexPriceData, DexPriceSource } from '../types.js';
import {
  PAIR_TOKENS,
  TOKEN_DECIMALS,
  DEX_PAIRS,
} from '../types.js';
import { QUOTER_V2_ABI } from '../plugins/agni/constants.js';

/* -------------------------------------------------------------------------- */
/* Конфигурация (env vars)                                                     */
/* -------------------------------------------------------------------------- */

const CACHE_TTL_MS = 60_000; // 1 min
const QUOTER_ADDRESS: `0x${string}` = (process.env['AGNI_QUOTER'] as `0x${string}` | undefined)
  ?? '0x49C8bb51C6bb791e8D6C31310cE0C14f68492991';
const RPC_URL = process.env['AGNI_RPC_URL'] ?? 'https://rpc.sepolia.mantle.xyz';
const MOCK_MODE = (process.env['MOCK_PRICES'] ?? 'false').toLowerCase() === 'true';
const FEE_TIER = 3000; // 0.3%

/* -------------------------------------------------------------------------- */
/* Mock price state (random walk)                                              */
/* -------------------------------------------------------------------------- */

const MOCK_BASE: Record<DexPair, number> = {
  'MNT/USDC': 0.35,
  'ETH/MNT': 6200,
  'WMNT/USDC': 0.35,
  'USDC/MNT': 2.86,
};

const mockState = new Map<DexPair, number>();
for (const p of DEX_PAIRS) mockState.set(p, MOCK_BASE[p]);

function randomWalk(pair: DexPair): number {
  const current = mockState.get(pair) ?? MOCK_BASE[pair];
  // Random walk: ±0.5% change
  const change = current * (Math.random() - 0.5) * 0.01;
  const next = current + change;
  mockState.set(pair, next);
  return Math.round(next * 10_000) / 10_000;
}

/* -------------------------------------------------------------------------- */
/* PriceFeed                                                                   */
/* -------------------------------------------------------------------------- */

export interface PriceFeedConfig {
  quoterAddress?: `0x${string}`;
  rpcUrl?: string;
  cacheTtlMs?: number;
  mockMode?: boolean;
}

export class PriceFeed {
  private cache = new Map<DexPair, DexPriceData>();
  private lastSuccess = new Map<DexPair, DexPriceData>();
  private client: PublicClient | null = null;
  private readonly quoterAddress: `0x${string}`;
  private readonly rpcUrl: string;
  private readonly cacheTtlMs: number;
  private readonly mockMode: boolean;

  constructor(config?: PriceFeedConfig) {
    this.quoterAddress = config?.quoterAddress ?? QUOTER_ADDRESS;
    this.rpcUrl = config?.rpcUrl ?? RPC_URL;
    this.cacheTtlMs = config?.cacheTtlMs ?? CACHE_TTL_MS;
    this.mockMode = config?.mockMode ?? MOCK_MODE;

    if (!this.mockMode) {
      this.client = createPublicClient({
        chain: mantleSepoliaTestnet,
        transport: http(this.rpcUrl),
      });
    }

    if (this.mockMode) {
      console.log('[priceFeed] Running in MOCK mode (MOCK_PRICES=true)');
    }
  }

  /**
   * fetchPrice — получить цену для торговой пары.
   *
   * Порядок:
   *   1. Mock mode → random walk
   *   2. Cache hit (TTL valid)
   *   3. Agni QuoterV2
   *   4. Last cached price (graceful fallback, source='fallback')
   */
  async fetchPrice(pair: DexPair): Promise<DexPriceData> {
    // 1. Mock mode
    if (this.mockMode) {
      return this.mockPrice(pair);
    }

    // 2. Cache hit
    const cached = this.cache.get(pair);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return { ...cached, source: 'cache' as DexPriceSource };
    }

    // 3. Agni QuoterV2
    try {
      const data = await this.fetchFromQuoter(pair);
      this.cache.set(pair, data);
      this.lastSuccess.set(pair, data);
      return data;
    } catch (err) {
      console.warn(`[priceFeed] Quoter error for ${pair}:`, (err as Error).message);

      // 4. Graceful fallback — last cached (even if stale)
      const last = this.lastSuccess.get(pair);
      if (last) {
        return {
          ...last,
          source: 'fallback' as DexPriceSource,
          error: 'quoter_unavailable',
        };
      }

      // No data at all
      return {
        pair,
        price: 0,
        amountIn: '0',
        amountOut: '0',
        source: 'fallback' as DexPriceSource,
        timestamp: Date.now(),
        error: `Quoter unavailable for ${pair}: ${(err as Error).message}`,
      };
    }
  }

  /**
   * fetchAllPrices — получить цены для всех DEX-пар.
   */
  async fetchAllPrices(): Promise<DexPriceData[]> {
    const results = await Promise.allSettled(
      DEX_PAIRS.map((pair) => this.fetchPrice(pair)),
    );

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        pair: DEX_PAIRS[i],
        price: 0,
        amountIn: '0',
        amountOut: '0',
        source: 'fallback' as DexPriceSource,
        timestamp: Date.now(),
        error: `fetch failed: ${(r as PromiseRejectedResult).reason}`,
      };
    });
  }

  /* -- Agni QuoterV2 -- */

  private async fetchFromQuoter(pair: DexPair): Promise<DexPriceData> {
    const mapping = PAIR_TOKENS[pair];
    if (!mapping) throw new Error(`Unknown pair: ${pair}`);

    const decimalsIn = TOKEN_DECIMALS[mapping.tokenIn] ?? 18;
    const decimalsOut = TOKEN_DECIMALS[mapping.tokenOut] ?? 18;
    const amountIn = BigInt(10) ** BigInt(decimalsIn); // 1 token in smallest unit

    const client = this.client!;
    const [amountOut] = await client.readContract({
      address: this.quoterAddress,
      abi: QUOTER_V2_ABI,
      functionName: 'quoteExactInputSingle',
      args: [{
        tokenIn: mapping.tokenIn,
        tokenOut: mapping.tokenOut,
        amountIn,
        fee: FEE_TIER,
        sqrtPriceLimitX96: 0n,
      }],
    }) as [bigint, bigint, number, bigint];

    // Price = amountOut / amountIn, normalised by decimals
    const priceRaw = Number(amountOut) / Number(amountIn);
    // Price = (amountOut / 10^decimalsOut) / (amountIn / 10^decimalsIn)
    //       = (amountOut / amountIn) * 10^(decimalsIn - decimalsOut)
    const decimalAdjust = 10 ** (decimalsIn - decimalsOut);
    const price = priceRaw * decimalAdjust;

    return {
      pair,
      price: Math.round(price * 10_000) / 10_000,
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      source: 'agni_quoter',
      timestamp: Date.now(),
    };
  }

  /* -- Mock -- */

  private mockPrice(pair: DexPair): DexPriceData {
    const price = randomWalk(pair);
    return {
      pair,
      price,
      amountIn: '1000000000000000000',
      amountOut: '350000',
      source: 'mock',
      timestamp: Date.now(),
    };
  }

  /** Invalidate cache for a specific pair */
  invalidateCache(pair?: DexPair): void {
    if (pair) {
      this.cache.delete(pair);
    } else {
      this.cache.clear();
    }
  }
}
