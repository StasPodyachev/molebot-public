/**
 * tradeRouter — FE-30: trade history + mock execution
 *
 * GET  /api/trade/history?tokenId=... — список последних сделок
 * GET  /api/trade/position?tokenId=... — активная позиция (или null)
 * GET  /api/trade/stats?tokenId=...   — статистика (PnL, winrate, …)
 * POST /api/trade/open   — открыть mock-сделку
 * POST /api/trade/close  — закрыть активную сделку
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface TradeEntry {
  id: string;
  tokenId: number;
  pair: string;
  side: 'BUY' | 'SELL';
  amount: number;       // USD
  price: number;         // price per unit
  pnl: number;           // realised PnL (USD), 0 if open
  status: 'open' | 'closed';
  openedAt: number;      // unix ms
  closedAt?: number;
}

export interface PositionData {
  active: boolean;
  trade?: TradeEntry;
  currentPrice?: number;
  pnlPercent?: number;
  durationMinutes?: number;
}

export interface TradeHistoryResponse {
  ok: boolean;
  trades: TradeEntry[];
  tokenId: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface PositionResponse {
  ok: boolean;
  position: PositionData;
  errorCode?: string;
  errorMessage?: string;
}

export interface TradeActionResponse {
  ok: boolean;
  trade?: TradeEntry;
  errorCode?: string;
  errorMessage?: string;
}

export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;           // 0–100
  totalPnl: number;           // суммарный PnL в USD
  bestTrade: number;          // лучшая сделка PnL USD
  worstTrade: number;         // худшая сделка PnL USD
  avgPnlPerTrade: number;     // средний PnL на сделку
  dailyPnl: number;           // PnL за сегодня (мок)
  activePosition: boolean;
}

export interface StatsResponse {
  ok: boolean;
  stats: TradeStats;
  errorCode?: string;
  errorMessage?: string;
}

/* -------------------------------------------------------------------------- */
/* Mock trade pairs & prices                                                   */
/* -------------------------------------------------------------------------- */

const PAIRS = ['MNT/USDC', 'ETH/MNT', 'WMNT/USDC', 'USDC/MNT'];

function mockPrice(pair: string): number {
  const base = {
    'MNT/USDC': 0.35,
    'ETH/MNT': 6200,
    'WMNT/USDC': 0.35,
    'USDC/MNT': 2.86,
  }[pair] ?? 1;
  // ±5% noise
  return base * (0.95 + Math.random() * 0.1);
}

/* -------------------------------------------------------------------------- */
/* In-memory store                                                            */
/* -------------------------------------------------------------------------- */

const tradeHistory: TradeEntry[] = [];
const activePositions = new Map<number, TradeEntry>();

let idSeq = 1;
function nextId(): string {
  return `trade-${idSeq++}-${Date.now()}`;
}

/** Seed some mock history for demo */
const MOCK_PAIRS = ['MNT/USDC', 'ETH/MNT'];
const MOCK_SIDES: TradeEntry['side'][] = ['BUY', 'SELL', 'BUY', 'SELL'];

function seedHistory(tokenId: number): void {
  const existing = tradeHistory.filter(t => t.tokenId === tokenId);
  if (existing.length > 0) return;

  const now = Date.now();
  for (let i = 0; i < 3; i++) {
    const pair = MOCK_PAIRS[i % 2];
    const side = MOCK_SIDES[i];
    const price = mockPrice(pair);
    tradeHistory.push({
      id: nextId(),
      tokenId,
      pair,
      side,
      amount: Math.round((50 + Math.random() * 200) * 100) / 100,
      price,
      pnl: side === 'SELL' ? Math.round((Math.random() - 0.3) * 20 * 100) / 100 : 0,
      status: 'closed',
      openedAt: now - (3 - i) * 3600_000 - Math.floor(Math.random() * 600_000),
      closedAt: now - (3 - i) * 3600_000,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Router                                                                      */
/* -------------------------------------------------------------------------- */

export class TradeRouter {
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
      if (url.pathname === '/api/trade/history' && method === 'GET') {
        await this.handleHistory(url, res);
      } else if (url.pathname === '/api/trade/stats' && method === 'GET') {
        await this.handleStats(url, res);
      } else if (url.pathname === '/api/trade/position' && method === 'GET') {
        await this.handlePosition(url, res);
      } else if (url.pathname === '/api/trade/open' && method === 'POST') {
        await this.handleOpen(req, res);
      } else if (url.pathname === '/api/trade/close' && method === 'POST') {
        await this.handleClose(req, res);
      } else {
        this.json(res, 404, { error: 'not_found' });
      }
    } catch (err) {
      console.error('[tradeRouter] Unhandled:', err);
      this.json(res, 500, { ok: false, errorMessage: `Internal error: ${(err as Error).message}` });
    }
  }

  // ── GET /api/trade/history ──

  private async handleHistory(url: URL, res: ServerResponse): Promise<void> {
    const tokenIdStr = url.searchParams.get('tokenId');
    if (!tokenIdStr) {
      this.json(res, 400, { ok: false, errorCode: 'MISSING_TOKENID', errorMessage: 'tokenId обязателен' });
      return;
    }
    const tokenId = Number(tokenIdStr);

    seedHistory(tokenId);

    const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100);
    const trades = tradeHistory
      .filter(t => t.tokenId === tokenId)
      .slice(-limit)
      .reverse();

    this.json(res, 200, {
      ok: true,
      trades,
      tokenId,
    } satisfies TradeHistoryResponse);
  }

  // ── GET /api/trade/position ──

  private async handlePosition(url: URL, res: ServerResponse): Promise<void> {
    const tokenIdStr = url.searchParams.get('tokenId');
    if (!tokenIdStr) {
      this.json(res, 400, { ok: false, errorCode: 'MISSING_TOKENID', errorMessage: 'tokenId обязателен' });
      return;
    }
    const tokenId = Number(tokenIdStr);

    const active = activePositions.get(tokenId);
    if (!active) {
      this.json(res, 200, {
        ok: true,
        position: { active: false },
      } satisfies PositionResponse);
      return;
    }

    // Update mock price
    const currentPrice = mockPrice(active.pair);
    const isBuy = active.side === 'BUY';
    const pnlPercent = isBuy
      ? ((currentPrice - active.price) / active.price) * 100
      : ((active.price - currentPrice) / active.price) * 100;
    const durationMinutes = Math.floor((Date.now() - active.openedAt) / 60_000);

    this.json(res, 200, {
      ok: true,
      position: {
        active: true,
        trade: active,
        currentPrice: Math.round(currentPrice * 10_000) / 10_000,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
        durationMinutes,
      },
    } satisfies PositionResponse);
  }

  // ── GET /api/trade/stats ──

  private async handleStats(url: URL, res: ServerResponse): Promise<void> {
    const tokenIdStr = url.searchParams.get('tokenId');
    if (!tokenIdStr) {
      this.json(res, 400, { ok: false, errorCode: 'MISSING_TOKENID', errorMessage: 'tokenId обязателен' });
      return;
    }
    const tokenId = Number(tokenIdStr);

    seedHistory(tokenId);

    const closed = tradeHistory.filter(t => t.tokenId === tokenId && t.status === 'closed');
    const winners = closed.filter(t => t.pnl > 0);
    const losers = closed.filter(t => t.pnl < 0);
    const allPnls = closed.map(t => t.pnl);
    const totalPnl = allPnls.reduce((s, v) => s + v, 0);
    const bestTrade = allPnls.length > 0 ? Math.max(...allPnls) : 0;
    const worstTrade = allPnls.length > 0 ? Math.min(...allPnls) : 0;

    // Daily PnL: mock — totalPnl + небольшой случайный дрифт
    const dailyPnl = closed.length > 0
      ? Math.round((totalPnl * 0.3 + (Math.random() - 0.5) * 5) * 100) / 100
      : 0;

    const stats: TradeStats = {
      totalTrades: tradeHistory.filter(t => t.tokenId === tokenId).length,
      winningTrades: winners.length,
      losingTrades: losers.length,
      winRate: closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0,
      totalPnl: Math.round(totalPnl * 100) / 100,
      bestTrade: Math.round(bestTrade * 100) / 100,
      worstTrade: Math.round(worstTrade * 100) / 100,
      avgPnlPerTrade: closed.length > 0 ? Math.round((totalPnl / closed.length) * 100) / 100 : 0,
      dailyPnl,
      activePosition: activePositions.has(tokenId),
    };

    this.json(res, 200, { ok: true, stats } satisfies StatsResponse);
  }

  // ── POST /api/trade/open ──

  private async handleOpen(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    let params: { tokenId?: number; pair?: string; amount?: number; side?: 'BUY' | 'SELL' };
    try {
      params = JSON.parse(body);
    } catch {
      this.json(res, 400, { ok: false, errorCode: 'INVALID_JSON', errorMessage: 'Invalid JSON' });
      return;
    }

    const tokenId = params.tokenId ?? 1;
    const pair = params.pair ?? PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const side = params.side ?? 'BUY';
    const amount = params.amount ?? Math.round((50 + Math.random() * 200) * 100) / 100;
    const price = mockPrice(pair);

    // Close any existing position first
    const existing = activePositions.get(tokenId);
    if (existing) {
      existing.status = 'closed';
      existing.closedAt = Date.now();
      // Randomly win or lose on auto-close
      existing.pnl = Math.round((Math.random() - 0.4) * existing.amount * 0.05 * 100) / 100;
      tradeHistory.push({ ...existing });
      activePositions.delete(tokenId);
    }

    const trade: TradeEntry = {
      id: nextId(),
      tokenId,
      pair,
      side,
      amount,
      price,
      pnl: 0,
      status: 'open',
      openedAt: Date.now(),
    };

    tradeHistory.push(trade);
    activePositions.set(tokenId, trade);

    console.log(`[tradeRouter] OPEN: tokenId=${tokenId} ${side} ${amount} ${pair} @ ${price}`);

    this.json(res, 201, { ok: true, trade } satisfies TradeActionResponse);
  }

  // ── POST /api/trade/close ──

  private async handleClose(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    let params: { tokenId?: number };
    try {
      params = JSON.parse(body);
    } catch {
      this.json(res, 400, { ok: false, errorCode: 'INVALID_JSON', errorMessage: 'Invalid JSON' });
      return;
    }

    const tokenId = params.tokenId ?? 1;
    const trade = activePositions.get(tokenId);
    if (!trade) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'NO_POSITION',
        errorMessage: 'Нет активной позиции',
      });
      return;
    }

    const exitPrice = mockPrice(trade.pair);
    const isBuy = trade.side === 'BUY';
    const pnl = isBuy
      ? (exitPrice - trade.price) * (trade.amount / trade.price)
      : (trade.price - exitPrice) * (trade.amount / trade.price);

    trade.status = 'closed';
    trade.closedAt = Date.now();
    trade.pnl = Math.round(pnl * 100) / 100;

    activePositions.delete(tokenId);

    console.log(`[tradeRouter] CLOSE: tokenId=${tokenId} pnl=${trade.pnl} @ ${exitPrice}`);

    this.json(res, 200, { ok: true, trade } satisfies TradeActionResponse);
  }

  // ── Helpers ──

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

/* ======================================================================== */
/* Exported helpers for ChatRouter (TASK-016)                                 */
/* ======================================================================== */

/**
 * Add a trade to the in-memory history (used by ChatRouter when user
 * sends a trading command like "открой лонг ETH/MNT на 100 USDC").
 */
export function addTradeToHistory(entry: {
  tokenId: number;
  pair: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  pnl: number;
  status: 'open' | 'closed';
  openedAt: number;
}): void {
  const trade: TradeEntry = {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tokenId: entry.tokenId,
    pair: entry.pair,
    side: entry.side,
    amount: entry.amount,
    price: entry.price,
    pnl: entry.pnl,
    status: entry.status,
    openedAt: entry.openedAt,
  };
  tradeHistory.push(trade);
  if (entry.status === 'open') {
    activePositions.set(entry.tokenId, trade);
  }
}

/**
 * Close an active position in the in-memory history.
 */
export function closeActivePosition(tokenId: number, pnl: number, exitPrice: number): void {
  const pos = activePositions.get(tokenId);
  if (pos) {
    pos.status = 'closed';
    pos.closedAt = Date.now();
    pos.pnl = pnl;
    activePositions.delete(tokenId);
  }
}
