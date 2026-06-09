/**
 * priceRouter — TASK-013: HTTP API for DEX prices
 *
 * GET /api/price?pair=MNT/USDC       → текущая цена пары
 * GET /api/price/history?pair=MNT/USDC&limit=50 → свечи (5-min candles)
 *
 * Поддерживает CORS (Access-Control-Allow-Origin: *)
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PriceFeed } from '../services/priceFeed.js';
import type { CandleStore } from '../services/candleStore.js';
import type { DexPair, DexPriceData, Candle } from '../types.js';
import { DEX_PAIRS } from '../types.js';

/* -------------------------------------------------------------------------- */
/* Response types                                                              */
/* -------------------------------------------------------------------------- */

export interface PriceResponse {
  ok: boolean;
  pair?: string;
  price?: number;
  source?: string;
  timestamp?: number;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PriceHistoryResponse {
  ok: boolean;
  pair?: string;
  candles?: Candle[];
  count?: number;
  errorCode?: string;
  errorMessage?: string;
}

/* -------------------------------------------------------------------------- */
/* Router class                                                                */
/* -------------------------------------------------------------------------- */

export class PriceRouter {
  private priceFeed: PriceFeed;
  private candleStore: CandleStore;

  constructor(priceFeed: PriceFeed, candleStore: CandleStore) {
    this.priceFeed = priceFeed;
    this.candleStore = candleStore;
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
      if (url.pathname === '/api/price' && method === 'GET') {
        await this.handlePrice(url, res);
      } else if (url.pathname === '/api/price/history' && method === 'GET') {
        await this.handleHistory(url, res);
      } else {
        this.json(res, 404, { error: 'not_found' });
      }
    } catch (err) {
      console.error('[priceRouter] Unhandled:', err);
      this.json(res, 500, {
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: `Internal error: ${(err as Error).message}`,
      });
    }
  }

  // ── GET /api/price?pair=MNT/USDC ──

  private async handlePrice(url: URL, res: ServerResponse): Promise<void> {
    const pair = url.searchParams.get('pair');
    if (!pair) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'MISSING_PAIR',
        errorMessage: `Query param 'pair' is required. Valid pairs: ${DEX_PAIRS.join(', ')}`,
      } satisfies PriceResponse);
      return;
    }

    if (!this.isValidPair(pair)) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'INVALID_PAIR',
        errorMessage: `Unknown pair: ${pair}. Valid pairs: ${DEX_PAIRS.join(', ')}`,
      } satisfies PriceResponse);
      return;
    }

    const dexPair = pair as DexPair;
    const data = await this.priceFeed.fetchPrice(dexPair);

    // Feed candle store
    if (data.price > 0) {
      this.candleStore.updatePrice(dexPair, data.price);
    }

    this.json(res, 200, {
      ok: true,
      pair: data.pair,
      price: data.price,
      source: data.source,
      timestamp: data.timestamp,
      error: data.error,
    } satisfies PriceResponse);
  }

  // ── GET /api/price/history?pair=MNT/USDC&limit=50 ──

  private async handleHistory(url: URL, res: ServerResponse): Promise<void> {
    const pair = url.searchParams.get('pair');
    if (!pair) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'MISSING_PAIR',
        errorMessage: `Query param 'pair' is required. Valid pairs: ${DEX_PAIRS.join(', ')}`,
      } satisfies PriceHistoryResponse);
      return;
    }

    if (!this.isValidPair(pair)) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'INVALID_PAIR',
        errorMessage: `Unknown pair: ${pair}. Valid pairs: ${DEX_PAIRS.join(', ')}`,
      } satisfies PriceHistoryResponse);
      return;
    }

    const dexPair = pair as DexPair;
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? Math.min(Number(limitStr), MAX_CANDLES_LIMIT) : 50;

    const candles = this.candleStore.getCandles(dexPair, limit);

    this.json(res, 200, {
      ok: true,
      pair: dexPair,
      candles,
      count: candles.length,
    } satisfies PriceHistoryResponse);
  }

  // ── Helpers ──

  private isValidPair(pair: string): pair is DexPair {
    return (DEX_PAIRS as readonly string[]).includes(pair);
  }

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}

const MAX_CANDLES_LIMIT = 200;
