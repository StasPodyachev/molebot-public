/**
 * strategyRouter — Real trading strategy signals via StrategyEngine
 *
 * GET  /api/strategy?tokenId=...&pair=...  — сигнал от engine
 * GET  /api/strategy/list                   — список доступных стратегий
 * POST /api/strategy/set                    — выбрать стратегию
 *
 * Стратегии хранятся in-memory (на память процесса).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { StrategyEngine, Signal, DexPair, StrategyId } from '../services/strategyEngine.js';
import { STRATEGIES } from '../services/strategyEngine.js';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface StrategyResponse {
  ok: boolean;
  strategy?: string;
  strategyName?: string;
  signal?: Signal;
  description?: string;
  risk?: number;
  updatedAt?: number;
  confidence?: number;
  detail?: string;
  /** Присутствует только при ok=false */
  errorCode?: string;
  errorMessage?: string;
}

export interface StrategySetRequest {
  strategy: string;
  tokenId: number;
  pair?: string;
}

export interface StrategySetResponse {
  ok: boolean;
  strategy?: string;
  signal?: Signal;
  confidence?: number;
  detail?: string;
  /** Присутствует только при ok=false */
  errorCode?: string;
  errorMessage?: string;
}

export interface StrategyListItem {
  id: string;
  name: string;
  description: string;
  risk: number;
  pair: string;
}

export interface StrategyListResponse {
  ok: boolean;
  strategies: StrategyListItem[];
}

/* -------------------------------------------------------------------------- */
/* In-memory store (tokenId → strategyId)                                      */
/* -------------------------------------------------------------------------- */

interface PerTokenState {
  strategyId: StrategyId;
  updatedAt: number; // unix seconds
}

const DEFAULT_STRATEGY: StrategyId = 'rsi';
const DEFAULT_PAIR: DexPair = 'MNT/USDC';

/* -------------------------------------------------------------------------- */
/* Router class                                                                */
/* -------------------------------------------------------------------------- */

export class StrategyRouter {
  private engine: StrategyEngine;
  private store = new Map<number, PerTokenState>();

  constructor(engine: StrategyEngine) {
    this.engine = engine;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const method = req.method?.toUpperCase() ?? 'GET';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      this.json(res, 204, null);
      return;
    }

    try {
      if (url.pathname === '/api/strategy' && method === 'GET') {
        await this.handleGet(url, res);
      } else if (url.pathname === '/api/strategy/list' && method === 'GET') {
        this.handleList(res);
      } else if (url.pathname === '/api/strategy/set' && method === 'POST') {
        await this.handleSet(req, res);
      } else {
        this.json(res, 404, { error: 'not_found' });
      }
    } catch (err) {
      console.error('[strategyRouter] Unhandled:', err);
      this.json(res, 500, { ok: false, errorMessage: `Internal error: ${(err as Error).message}` });
    }
  }

  // ── handlers ──

  private async handleGet(url: URL, res: ServerResponse): Promise<void> {
    const tokenIdStr = url.searchParams.get('tokenId');
    if (!tokenIdStr) {
      this.json(res, 400, { ok: false, errorCode: 'MISSING_TOKENID', errorMessage: 'tokenId обязателен' });
      return;
    }
    const tokenId = Number(tokenIdStr);
    if (!Number.isInteger(tokenId) || tokenId < 1) {
      this.json(res, 400, { ok: false, errorCode: 'INVALID_TOKENID', errorMessage: 'tokenId должен быть целым > 0' });
      return;
    }

    const state = this.getOrCreateState(tokenId);
    const strategy = STRATEGIES[state.strategyId] ?? STRATEGIES[DEFAULT_STRATEGY];

    // Parse optional pair param
    const pairParam = url.searchParams.get('pair') as DexPair | null;
    const pair = this.validatePair(pairParam) ? pairParam! : strategy.pair;

    // Evaluate real signal via engine
    const result = this.engine.evaluateForPair(state.strategyId, pair);

    this.json(res, 200, {
      ok: true,
      strategy: state.strategyId,
      strategyName: strategy.name,
      signal: result.signal,
      description: strategy.description,
      risk: strategy.risk,
      confidence: result.confidence,
      detail: result.detail,
      updatedAt: state.updatedAt,
    } satisfies StrategyResponse);
  }

  private handleList(res: ServerResponse): void {
    const items: StrategyListItem[] = Object.values(STRATEGIES).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      risk: s.risk,
      pair: s.pair,
    }));

    this.json(res, 200, {
      ok: true,
      strategies: items,
    } satisfies StrategyListResponse);
  }

  private async handleSet(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);

    let setReq: StrategySetRequest;
    try {
      setReq = JSON.parse(body) as StrategySetRequest;
    } catch {
      this.json(res, 400, { ok: false, errorCode: 'INVALID_JSON', errorMessage: 'Invalid JSON body' });
      return;
    }

    if (!setReq.strategy || !setReq.tokenId) {
      this.json(res, 400, { ok: false, errorCode: 'MISSING_FIELDS', errorMessage: 'strategy и tokenId обязательны' });
      return;
    }

    if (!(setReq.strategy in STRATEGIES)) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'UNKNOWN_STRATEGY',
        errorMessage: `Неизвестная стратегия: ${setReq.strategy}. Доступны: ${Object.keys(STRATEGIES).join(', ')}`,
      });
      return;
    }

    const strategyId = setReq.strategy as StrategyId;
    const tokenId = setReq.tokenId;
    const strategy = STRATEGIES[strategyId];
    const pairParam = setReq.pair as DexPair | undefined;
    const pair = this.validatePair(pairParam) ? pairParam! : strategy.pair;

    // Evaluate immediately to get current signal
    const result = this.engine.evaluateForPair(strategyId, pair);

    const state = this.getOrCreateState(tokenId);
    state.strategyId = strategyId;
    state.updatedAt = Math.floor(Date.now() / 1000);

    console.log(`[strategyRouter] tokenId=${tokenId} strategy=${setReq.strategy} signal=${result.signal} confidence=${result.confidence.toFixed(2)}`);

    this.json(res, 200, {
      ok: true,
      strategy: state.strategyId,
      signal: result.signal,
      confidence: result.confidence,
      detail: result.detail,
    } satisfies StrategySetResponse);
  }

  // ── helpers ──

  private getOrCreateState(tokenId: number): PerTokenState {
    let state = this.store.get(tokenId);
    if (!state) {
      state = {
        strategyId: DEFAULT_STRATEGY,
        updatedAt: Math.floor(Date.now() / 1000),
      };
      this.store.set(tokenId, state);
    }
    return state;
  }

  private validatePair(pair: string | undefined | null): pair is DexPair {
    return pair === 'MNT/USDC' || pair === 'ETH/MNT' || pair === 'USDC/ETH';
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
