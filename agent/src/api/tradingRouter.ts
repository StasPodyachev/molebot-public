/**
 * tradingRouter — TASK-015: Trading control API
 *
 * GET  /api/trading/status?tokenId= — статус: running, lastSignal, position
 * POST /api/trading/start            — запустить цикл
 * POST /api/trading/stop             — остановить
 * POST /api/trading/pause?tokenId=   — приостановить для конкретного токена
 * POST /api/trading/resume?tokenId=  — возобновить
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TradingScheduler } from '../services/tradingScheduler.js';
import type { PositionTracker } from '../services/positionTracker.js';

/* -------------------------------------------------------------------------- */
/* Response types                                                              */
/* -------------------------------------------------------------------------- */

export interface TradingStatusResponse {
  ok: boolean;
  scheduler: {
    running: boolean;
    lastRun: number | null;
    nextRun: number | null;
    cycleCount: number;
    pausedTokens: number[];
  };
  position: {
    active: boolean;
    tokenId: number;
    pair?: string;
    side?: string;
    amount?: number;
    entryPrice?: number;
    pnl?: number;
    openedAt?: number;
  };
  errorCode?: string;
  errorMessage?: string;
}

export interface TradingActionResponse {
  ok: boolean;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
}

/* -------------------------------------------------------------------------- */
/* Router                                                                      */
/* -------------------------------------------------------------------------- */

export class TradingRouter {
  private scheduler: TradingScheduler;
  private positions: PositionTracker;

  constructor(scheduler: TradingScheduler, positions: PositionTracker) {
    this.scheduler = scheduler;
    this.positions = positions;
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
      if (url.pathname === '/api/trading/status' && method === 'GET') {
        this.handleStatus(url, res);
      } else if (url.pathname === '/api/trading/start' && method === 'POST') {
        this.handleStart(res);
      } else if (url.pathname === '/api/trading/stop' && method === 'POST') {
        this.handleStop(res);
      } else if (url.pathname === '/api/trading/pause' && method === 'POST') {
        this.handlePause(url, res);
      } else if (url.pathname === '/api/trading/resume' && method === 'POST') {
        this.handleResume(url, res);
      } else {
        this.json(res, 404, { error: 'not_found' });
      }
    } catch (err) {
      console.error('[tradingRouter] Unhandled:', err);
      this.json(res, 500, {
        ok: false,
        errorMessage: `Internal error: ${(err as Error).message}`,
      } satisfies TradingActionResponse);
    }
  }

  // ── GET /api/trading/status ──

  private handleStatus(url: URL, res: ServerResponse): void {
    const tokenIdStr = url.searchParams.get('tokenId');
    const tokenId = tokenIdStr !== null ? Number(tokenIdStr) : 1;

    const status = this.scheduler.getStatus();
    const position = this.positions.getPosition(tokenId);

    const response: TradingStatusResponse = {
      ok: true,
      scheduler: {
        running: status.running,
        lastRun: status.lastRun,
        nextRun: status.nextRun,
        cycleCount: status.cycleCount,
        pausedTokens: status.pausedTokens,
      },
      position: position
        ? {
            active: true,
            tokenId: position.tokenId,
            pair: position.pair,
            side: position.side,
            amount: position.amount,
            entryPrice: position.entryPrice,
            pnl: position.pnl,
            openedAt: position.openedAt,
          }
        : {
            active: false,
            tokenId,
          },
    };

    this.json(res, 200, response);
  }

  // ── POST /api/trading/start ──

  private handleStart(res: ServerResponse): void {
    this.scheduler.start();
    const status = this.scheduler.getStatus();

    this.json(res, 200, {
      ok: status.running,
      message: status.running
        ? 'Trading scheduler started'
        : 'Trading scheduler not started (DEMO_MODE enabled?)',
    } satisfies TradingActionResponse);
  }

  // ── POST /api/trading/stop ──

  private handleStop(res: ServerResponse): void {
    this.scheduler.stop();

    this.json(res, 200, {
      ok: true,
      message: 'Trading scheduler stopped',
    } satisfies TradingActionResponse);
  }

  // ── POST /api/trading/pause ──

  private handlePause(url: URL, res: ServerResponse): void {
    const tokenIdStr = url.searchParams.get('tokenId');
    if (!tokenIdStr) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'MISSING_TOKENID',
        errorMessage: 'tokenId обязателен',
      } satisfies TradingActionResponse);
      return;
    }

    const tokenId = Number(tokenIdStr);
    const paused = this.scheduler.pause(tokenId);

    this.json(res, 200, {
      ok: paused,
      message: paused
        ? `Auto-trading paused for tokenId=${tokenId}`
        : `No strategy configured for tokenId=${tokenId}`,
    } satisfies TradingActionResponse);
  }

  // ── POST /api/trading/resume ──

  private handleResume(url: URL, res: ServerResponse): void {
    const tokenIdStr = url.searchParams.get('tokenId');
    if (!tokenIdStr) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'MISSING_TOKENID',
        errorMessage: 'tokenId обязателен',
      } satisfies TradingActionResponse);
      return;
    }

    const tokenId = Number(tokenIdStr);
    const resumed = this.scheduler.resume(tokenId);

    this.json(res, 200, {
      ok: true,
      message: resumed
        ? `Auto-trading resumed for tokenId=${tokenId}`
        : `Token tokenId=${tokenId} was not paused`,
    } satisfies TradingActionResponse);
  }

  // ── Helpers ──

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
