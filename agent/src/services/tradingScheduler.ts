/**
 * tradingScheduler — TASK-015: Autonomous trading scheduler
 *
 * Главный цикл: каждые 15 минут оценка рынка → сигнал → сделка.
 *
 * Safety (critical):
 *   - ❌ Автоторговля НЕ работает при DEMO_MODE=true
 *   - ✅ Max trade amount: AGNI_MAX_TRADE_AMOUNT (env, default 1000)
 *   - ✅ Daily volume limit: AGNI_DAILY_LIMIT (env, default 5000)
 *   - ✅ Stop-loss -15% от entry
 *   - ✅ Только 1 открытая позиция на tokenId
 *   - ✅ Graceful shutdown на SIGTERM
 */

import { PriceFeed } from './priceFeed.js';
import { StrategyEngine, STRATEGIES } from './strategyEngine.js';
import type { StrategyId, Signal, DexPair as StrategyDexPair } from './strategyEngine.js';
import { PositionTracker } from './positionTracker.js';
import type { DexPair } from '../types.js';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface TradingConfig {
  /** Интервал между циклами в мс (default: 15 min) */
  intervalMs?: number;
  /** Максимальная сумма одной сделки (default: AGNI_MAX_TRADE_AMOUNT или 1000) */
  maxTradeAmount?: number;
  /** Дневной лимит по объёму (default: AGNI_DAILY_LIMIT или 5000) */
  dailyLimit?: number;
  /** Режим демо — автотрейдинг не запускается */
  demoMode?: boolean;
}

export interface TradingStatus {
  running: boolean;
  lastRun: number | null;
  nextRun: number | null;
  positions: number;
  cycleCount: number;
  pausedTokens: number[];
}

/* -------------------------------------------------------------------------- */
/* Token → Strategy mapping (default config)                                   */
/* -------------------------------------------------------------------------- */

const TOKEN_STRATEGIES: Record<number, { strategyId: StrategyId; pair: DexPair }> = {
  1: { strategyId: 'rsi', pair: 'MNT/USDC' },
  2: { strategyId: 'sma_crossover', pair: 'MNT/USDC' },
};

/* -------------------------------------------------------------------------- */
/* TradingScheduler                                                            */
/* -------------------------------------------------------------------------- */

export class TradingScheduler {
  private priceFeed: PriceFeed;
  private strategyEngine: StrategyEngine;
  private positionTracker: PositionTracker;
  private config: Required<TradingConfig>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastRun: number | null = null;
  private cycleCount = 0;
  private dailyVolume = 0;
  private dailyReset: number = Date.now();
  private pausedTokens = new Set<number>();

  constructor(
    priceFeed: PriceFeed,
    strategyEngine: StrategyEngine,
    positionTracker: PositionTracker,
    config?: TradingConfig,
  ) {
    this.priceFeed = priceFeed;
    this.strategyEngine = strategyEngine;
    this.positionTracker = positionTracker;

    this.config = {
      intervalMs: config?.intervalMs ?? 15 * 60 * 1000,
      maxTradeAmount: config?.maxTradeAmount
        ?? Number(process.env['AGNI_MAX_TRADE_AMOUNT'] ?? '1000'),
      dailyLimit: config?.dailyLimit
        ?? Number(process.env['AGNI_DAILY_LIMIT'] ?? '5000'),
      demoMode: config?.demoMode
        ?? (process.env['DEMO_MODE'] === 'true'),
    };
  }

  /* -- Public API -- */

  /** Запустить автотрейдинг. Не запускается в DEMO_MODE. */
  start(): void {
    if (this.running) return;

    if (this.config.demoMode) {
      console.log('[tradingScheduler] DEMO_MODE=true — автотрейдинг не запущен');
      return;
    }

    this.running = true;
    console.log(`[tradingScheduler] Started — interval=${this.config.intervalMs / 1000}s maxTrade=${this.config.maxTradeAmount} dailyLimit=${this.config.dailyLimit}`);

    // Первый тик сразу
    this.tick().catch(err => console.error('[tradingScheduler] Initial tick error:', err));

    this.timer = setInterval(() => {
      this.tick().catch(err => console.error('[tradingScheduler] Tick error:', err));
    }, this.config.intervalMs);
  }

  /** Остановить автотрейдинг */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    console.log('[tradingScheduler] Stopped');
  }

  /** Текущий статус */
  getStatus(): TradingStatus {
    return {
      running: this.running,
      lastRun: this.lastRun,
      nextRun: this.lastRun !== null && this.running
        ? this.lastRun + this.config.intervalMs
        : null,
      positions: this.positionTracker.getAll().length,
      cycleCount: this.cycleCount,
      pausedTokens: Array.from(this.pausedTokens),
    };
  }

  /** Поставить на паузу автотрейдинг для конкретного токена */
  pause(tokenId: number): boolean {
    if (!TOKEN_STRATEGIES[tokenId]) return false;
    this.pausedTokens.add(tokenId);
    console.log(`[tradingScheduler] Paused tokenId=${tokenId}`);
    return true;
  }

  /** Возобновить автотрейдинг для токена */
  resume(tokenId: number): boolean {
    const removed = this.pausedTokens.delete(tokenId);
    if (removed) console.log(`[tradingScheduler] Resumed tokenId=${tokenId}`);
    return removed;
  }

  /** Проверить, на паузе ли токен */
  isPaused(tokenId: number): boolean {
    return this.pausedTokens.has(tokenId);
  }

  /** Текущий дневной объём */
  getDailyVolume(): number {
    this.resetDailyIfNeeded();
    return this.dailyVolume;
  }

  /* -- Private -- */

  private async tick(): Promise<void> {
    this.lastRun = Date.now();
    this.cycleCount++;
    this.resetDailyIfNeeded();

    console.log(`[tradingScheduler] Cycle #${this.cycleCount} @ ${new Date().toISOString()}`);

    for (const [tokenIdStr, cfg] of Object.entries(TOKEN_STRATEGIES)) {
      const tokenId = Number(tokenIdStr);
      if (this.pausedTokens.has(tokenId)) continue;

      try {
        await this.processToken(tokenId, cfg.strategyId, cfg.pair);
      } catch (err) {
        console.error(
          `[tradingScheduler] Error tokenId=${tokenId}:`,
          (err as Error).message,
        );
      }
    }
  }

  private async processToken(
    tokenId: number,
    strategyId: StrategyId,
    pair: DexPair,
  ): Promise<void> {
    // 1. Fetch current price
    const priceData = await this.priceFeed.fetchPrice(pair);

    // 2. Evaluate strategy (cast DexPair → StrategyDexPair — both share 'MNT/USDC' | 'ETH/MNT')
    const result = this.strategyEngine.evaluateForPair(strategyId, pair as unknown as StrategyDexPair);

    const strategyName = STRATEGIES[strategyId].name;
    console.log(
      `[tradingScheduler] tokenId=${tokenId} pair=${pair} price=${priceData.price} ` +
      `strategy=${strategyName} signal=${result.signal} confidence=${result.confidence.toFixed(2)}`,
    );

    // 3. If we have an open position — check stop-loss / take-profit / signal-close
    const existingPos = this.positionTracker.getPosition(tokenId);
    if (existingPos && existingPos.status === 'open') {
      await this.manageOpenPosition(tokenId, pair, priceData.price, result);
      return;
    }

    // 4. No open position — check for new entry signal
    if (result.confidence <= 0.5) return;

    // Check daily volume limit
    if (this.dailyVolume >= this.config.dailyLimit) {
      console.log(
        `[tradingScheduler] Daily limit reached ` +
        `(${this.dailyVolume}/${this.config.dailyLimit})`,
      );
      return;
    }

    const tradeAmount = Math.min(
      this.config.maxTradeAmount,
      this.config.dailyLimit - this.dailyVolume,
    );

    // Only open on BUY signal (long-only)
    if (result.signal === 'BUY') {
      const pos = this.positionTracker.open(
        tokenId, pair, 'BUY', tradeAmount, priceData.price,
      );
      this.dailyVolume += tradeAmount;
      console.log(
        `[tradingScheduler] OPEN: tokenId=${tokenId} pair=${pair} ` +
        `amount=${tradeAmount} price=${priceData.price} ` +
        `strategy=${strategyName} confidence=${result.confidence.toFixed(2)} ` +
        `detail=${result.detail}`,
      );
    }
  }

  private async manageOpenPosition(
    tokenId: number,
    pair: DexPair,
    currentPrice: number,
    result: { signal: Signal; confidence: number; detail?: string },
  ): Promise<void> {
    // Stop-loss check
    if (this.positionTracker.checkStopLoss(tokenId, currentPrice)) {
      const closed = this.positionTracker.close(tokenId, currentPrice);
      console.log(
        `[tradingScheduler] STOP-LOSS: tokenId=${tokenId} pair=${pair} ` +
        `pnl=${closed?.pnl} entryPrice=${this.positionTracker.getPosition(tokenId)?.entryPrice ?? '?'} exitPrice=${closed?.exitPrice}`,
      );
      return;
    }

    // Take-profit check
    if (this.positionTracker.checkTakeProfit(tokenId, currentPrice)) {
      const closed = this.positionTracker.close(tokenId, currentPrice);
      console.log(
        `[tradingScheduler] TAKE-PROFIT: tokenId=${tokenId} pair=${pair} ` +
        `pnl=${closed?.pnl} exitPrice=${closed?.exitPrice}`,
      );
      return;
    }

    // Signal-close: if we have BUY position and get SELL signal with confidence > 0.5
    if (result.signal === 'SELL' && result.confidence > 0.5) {
      const closed = this.positionTracker.close(tokenId, currentPrice);
      console.log(
        `[tradingScheduler] SIGNAL-CLOSE: tokenId=${tokenId} pair=${pair} ` +
        `signal=SELL confidence=${result.confidence.toFixed(2)} pnl=${closed?.pnl} ` +
        `detail=${result.detail}`,
      );
    }
  }

  private resetDailyIfNeeded(): void {
    const now = Date.now();
    if (now - this.dailyReset > 24 * 60 * 60 * 1000) {
      this.dailyVolume = 0;
      this.dailyReset = now;
    }
  }
}
