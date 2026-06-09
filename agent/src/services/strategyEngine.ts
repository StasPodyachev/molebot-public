/**
 * strategyEngine.ts — Real Trading Strategy Engine
 *
 * Поддерживаемые стратегии:
 *   - rsi: RSI(14) → <30 BUY, >70 SELL, confidence = distance from 50
 *   - sma_crossover: SMA(20)×SMA(50) → BUY на пересечении вверх, SELL вниз
 */

import { sma, rsi } from './indicators.js';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type DexPair = 'MNT/USDC' | 'ETH/MNT' | 'USDC/ETH';

export interface Candle {
  pair: DexPair;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number; // unix ms
  closed: boolean;
}

export type Signal = 'BUY' | 'SELL' | 'HOLD';

export type StrategyId = 'rsi' | 'sma_crossover';

export interface StrategyResult {
  signal: Signal;
  /** 0–1, где 1 = максимальная уверенность */
  confidence: number;
  detail?: string;
}

export interface StrategyInfo {
  id: StrategyId;
  name: string;
  description: string;
  risk: number; // 1–5
  pair: DexPair;
}

/* -------------------------------------------------------------------------- */
/* Available strategies                                                        */
/* -------------------------------------------------------------------------- */

export const STRATEGIES: Record<StrategyId, StrategyInfo> = {
  rsi: {
    id: 'rsi',
    name: 'RSI',
    description: 'Индекс относительной силы. Покупаем при перепроданности (<30), продаём при перекупленности (>70).',
    risk: 3,
    pair: 'MNT/USDC',
  },
  sma_crossover: {
    id: 'sma_crossover',
    name: 'SMA Crossover',
    description: 'Пересечение скользящих средних. BUY когда SMA(20) пересекает SMA(50) вверх, SELL когда вниз.',
    risk: 3,
    pair: 'MNT/USDC',
  },
};

const DEX_PAIRS: readonly DexPair[] = ['MNT/USDC', 'ETH/MNT', 'USDC/ETH'] as const;

/* -------------------------------------------------------------------------- */
/* CandleStore — in-memory mock candle data                                    */
/* -------------------------------------------------------------------------- */

export class CandleStore {
  private candles = new Map<DexPair, Candle[]>();

  constructor() {
    this.generateMockData();
  }

  /** Возвращает свечи для заданной пары. Последние `count` если указано. */
  getCandles(pair: DexPair, count?: number): Candle[] {
    const candles = this.candles.get(pair) ?? [];
    if (count !== undefined && count > 0) {
      return candles.slice(-count);
    }
    return candles;
  }

  // ── private ──

  private generateMockData(): void {
    const now = Date.now();
    for (const pair of DEX_PAIRS) {
      let price: number;
      let volatility: number;
      switch (pair) {
        case 'MNT/USDC': price = 1.2; volatility = 0.015; break;
        case 'ETH/MNT': price = 2500; volatility = 0.02; break;
        case 'USDC/ETH': price = 0.0004; volatility = 0.01; break;
      }

      const candles: Candle[] = [];
      for (let i = 0; i < 300; i++) {
        const t = now - (300 - i) * 3600000; // hourly candles
        const change = (Math.random() - 0.5) * 2 * price * volatility;
        const close = price + change;
        const halfRange = Math.abs(change) * (0.5 + Math.random());
        const open = price;
        const high = Math.max(open, close) + halfRange * Math.random();
        const low = Math.min(open, close) - halfRange * Math.random();
        candles.push({
          pair,
          open,
          high,
          low,
          close,
          timestamp: t,
          closed: true,
        });
        price = close;
      }
      this.candles.set(pair, candles);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* StrategyEngine                                                              */
/* -------------------------------------------------------------------------- */

export class StrategyEngine {
  private candleStore: CandleStore;

  constructor(candleStore: CandleStore) {
    this.candleStore = candleStore;
  }

  /**
   * Оценить сигнал по заданной стратегии на данных свечей.
   */
  evaluate(
    strategyId: StrategyId,
    candles: Candle[],
    params?: Record<string, unknown>,
  ): StrategyResult {
    if (candles.length < 50) {
      return { signal: 'HOLD', confidence: 0, detail: 'Недостаточно данных (нужно ≥50 свечей)' };
    }

    switch (strategyId) {
      case 'rsi':
        return this.evaluateRSI(candles, params);
      case 'sma_crossover':
        return this.evaluateSMACrossover(candles, params);
      default:
        return { signal: 'HOLD', confidence: 0, detail: `Неизвестная стратегия: ${strategyId}` };
    }
  }

  /**
   * Удобный метод: получить свечи из CandleStore и оценить.
   */
  evaluateForPair(
    strategyId: StrategyId,
    pair: DexPair,
    params?: Record<string, unknown>,
  ): StrategyResult {
    const candles = this.candleStore.getCandles(pair, 200);
    return this.evaluate(strategyId, candles, params);
  }

  // ── private strategies ──

  private evaluateRSI(candles: Candle[], params?: Record<string, unknown>): StrategyResult {
    const period = (params?.period as number) ?? 14;
    const closes = candles.map((c) => c.close);
    const rsiValues = rsi(closes, period);
    const current = rsiValues[rsiValues.length - 1];

    if (current === undefined || isNaN(current)) {
      return { signal: 'HOLD', confidence: 0, detail: 'RSI не вычислен' };
    }

    if (current < 30) {
      const confidence = Math.min(1, (50 - current) / 50);
      return {
        signal: 'BUY',
        confidence,
        detail: `RSI(${period})=${current.toFixed(1)} — перепродан (oversold)`,
      };
    }

    if (current > 70) {
      const confidence = Math.min(1, (current - 50) / 50);
      return {
        signal: 'SELL',
        confidence,
        detail: `RSI(${period})=${current.toFixed(1)} — перекуплен (overbought)`,
      };
    }

    const distFromCenter = Math.abs(current - 50) / 50;
    return {
      signal: 'HOLD',
      confidence: 1 - distFromCenter,
      detail: `RSI(${period})=${current.toFixed(1)} — нейтральная зона`,
    };
  }

  private evaluateSMACrossover(
    candles: Candle[],
    params?: Record<string, unknown>,
  ): StrategyResult {
    const fastPeriod = (params?.fastPeriod as number) ?? 20;
    const slowPeriod = (params?.slowPeriod as number) ?? 50;
    const closes = candles.map((c) => c.close);
    const smaFast = sma(closes, fastPeriod);
    const smaSlow = sma(closes, slowPeriod);

    if (smaFast.length < 2 || smaSlow.length < 2) {
      return { signal: 'HOLD', confidence: 0, detail: 'Недостаточно данных для SMA crossover' };
    }

    const prevFast = smaFast[smaFast.length - 2]!;
    const prevSlow = smaSlow[smaSlow.length - 2]!;
    const currFast = smaFast[smaFast.length - 1]!;
    const currSlow = smaSlow[smaSlow.length - 1]!;

    if (isNaN(prevFast) || isNaN(prevSlow) || isNaN(currFast) || isNaN(currSlow)) {
      return { signal: 'HOLD', confidence: 0, detail: 'SMA значения недоступны' };
    }

    // Golden cross: fast crosses above slow
    if (prevFast <= prevSlow && currFast > currSlow) {
      const diffPct = Math.abs((currFast - currSlow) / currSlow) * 100;
      return {
        signal: 'BUY',
        confidence: Math.min(1, diffPct / 2),
        detail: `Golden cross: SMA${fastPeriod} (${currFast.toFixed(4)}) ↑ SMA${slowPeriod} (${currSlow.toFixed(4)})`,
      };
    }

    // Death cross: fast crosses below slow
    if (prevFast >= prevSlow && currFast < currSlow) {
      const diffPct = Math.abs((currSlow - currFast) / currSlow) * 100;
      return {
        signal: 'SELL',
        confidence: Math.min(1, diffPct / 2),
        detail: `Death cross: SMA${fastPeriod} (${currFast.toFixed(4)}) ↓ SMA${slowPeriod} (${currSlow.toFixed(4)})`,
      };
    }

    return {
      signal: 'HOLD',
      confidence: 0.5,
      detail: `SMA${fastPeriod}=${currFast.toFixed(4)} SMA${slowPeriod}=${currSlow.toFixed(4)} — пересечения нет`,
    };
  }
}
