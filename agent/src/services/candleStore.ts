/**
 * candleStore — TASK-013: In-memory 5-min candle store for DEX pairs
 *
 * - Автоматически создаёт свечи от последней цены каждые 5 минут
 * - Хранит до 200 свечей (~16.6 часов истории)
 * - При обновлении цены: обновляет текущую свечу или создаёт новую, если прошло >5 мин
 *
 * Методы:
 *   updatePrice(pair, price)  — вызывается из PriceFeed при каждом fetchPrice
 *   getCandles(pair, count)   — возвращает последние N свечей
 */

import type { DexPair, Candle } from '../types.js';
import { DEX_PAIRS } from '../types.js';

/* -------------------------------------------------------------------------- */
/* Конфигурация                                                                */
/* -------------------------------------------------------------------------- */

/** Размер свечи в миллисекундах (5 минут) */
const CANDLE_MS = 5 * 60 * 1000;
/** Максимальное количество свечей на пару */
const MAX_CANDLES = 200;

/* -------------------------------------------------------------------------- */
/* CandleStore                                                                 */
/* -------------------------------------------------------------------------- */

export class CandleStore {
  private candles = new Map<DexPair, Candle[]>();

  constructor() {
    // Инициализируем пустые массивы для всех пар
    for (const pair of DEX_PAIRS) {
      this.candles.set(pair, []);
    }
  }

  /**
   * updatePrice — обновить свечу последней ценой.
   * Вызывается каждый раз, когда получена свежая цена.
   */
  updatePrice(pair: DexPair, price: number): void {
    const bucket = this.getBucketStart();
    const candles = this.candles.get(pair) ?? [];

    const last = candles.length > 0 ? candles[candles.length - 1] : null;

    if (!last || last.timestamp !== bucket) {
      // Новый 5-min bucket — закрываем старую и создаём новую
      if (last) {
        last.closed = true;
      }
      const newCandle: Candle = {
        pair,
        open: price,
        high: price,
        low: price,
        close: price,
        timestamp: bucket,
        closed: false,
      };
      candles.push(newCandle);

      // Trim to MAX_CANDLES
      while (candles.length > MAX_CANDLES) {
        candles.shift();
      }
    } else {
      // Обновляем текущую свечу
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.close = price;
    }
  }

  /**
   * getCandles — получить последние N свечей для пары.
   *
   * @param pair  Торговая пара
   * @param count Количество свечей (default: 50, max: 200)
   * @returns Массив свечей, от старых к новым
   */
  getCandles(pair: DexPair, count: number = 50): Candle[] {
    const candles = this.candles.get(pair) ?? [];
    const limit = Math.min(count, candles.length, MAX_CANDLES);
    // Возвращаем последние count (от старых к новым)
    return candles.slice(-limit);
  }

  /** Получить количество свечей для пары */
  getCandleCount(pair: DexPair): number {
    return (this.candles.get(pair) ?? []).length;
  }

  /** Очистить все свечи */
  clear(): void {
    for (const pair of DEX_PAIRS) {
      this.candles.set(pair, []);
    }
  }

  /* -- Private -- */

  /**
   * Округлить текущее время до начала 5-минутного bucket (UTC).
   * Например, 12:07:30 → 12:05:00
   */
  private getBucketStart(): number {
    const now = Date.now();
    return Math.floor(now / CANDLE_MS) * CANDLE_MS;
  }
}
