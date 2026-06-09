/**
 * indicators.ts — Чистые функции технических индикаторов
 *
 * SMA, EMA, RSI — без зависимостей, без состояния.
 * Алгоритмы — стандартные (Wilder smoothing для RSI).
 */

/**
 * Simple Moving Average.
 * Возвращает массив той же длины, первые (period-1) элементов — NaN.
 */
export function sma(values: number[], period: number): number[] {
  if (period <= 0 || values.length === 0) return [];
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += values[j]!;
      }
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Exponential Moving Average.
 * Первое значение — SMA(period), затем EMA по формуле:
 *   EMA_t = alpha * price_t + (1 - alpha) * EMA_{t-1}
 * где alpha = 2 / (period + 1).
 * Возвращает массив той же длины, первые (period-1) элементов — NaN.
 */
export function ema(values: number[], period: number): number[] {
  if (period <= 0 || values.length === 0) return [];
  const alpha = 2 / (period + 1);
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      // Seed with SMA of first `period` values
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[j]!;
      }
      result.push(sum / period);
    } else {
      const prev = result[i - 1]!;
      result.push(alpha * values[i]! + (1 - alpha) * prev);
    }
  }
  return result;
}

/**
 * Relative Strength Index (Wilder smoothing).
 *   RSI = 100 - 100 / (1 + avgGain / avgLoss)
 * где avgGain/avgLoss — сглаженные средние прироста/падения по period.
 * Первые period элементов — NaN.
 */
export function rsi(values: number[], period: number): number[] {
  if (period <= 0 || values.length < period + 1) {
    return values.map(() => NaN);
  }

  const result: number[] = new Array(values.length).fill(NaN);

  // Calculate initial average gain/loss (simple average over first `period` changes)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i]! - values[i - 1]!;
    avgGain += change > 0 ? change : 0;
    avgLoss += change < 0 ? -change : 0;
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value at index = period
  {
    const rs = avgLoss === 0 ? (avgGain === 0 ? 1 : Infinity) : avgGain / avgLoss;
    result[period] = rs === Infinity ? 100 : 100 - 100 / (1 + rs);
  }

  // Wilder smoothing for subsequent values
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i]! - values[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? (avgGain === 0 ? 1 : Infinity) : avgGain / avgLoss;
    result[i] = rs === Infinity ? 100 : 100 - 100 / (1 + rs);
  }

  return result;
}
