/**
 * Byreal trade executor — заглушка (mock mode)
 * ⚠️ Реальный Byreal API будет подключён после получения ключей от Стаса (H-1.5)
 */

import {
  type ByrealConfig,
  type TradeParams,
  type TradeResult,
  type TradeLogEntry,
  BYREAL_DEFAULT_API_URL,
} from './types.js';

/** Размер толаретной памяти для дневного лимита */
const DAILY_LIMIT_MS = 24 * 60 * 60 * 1000;

export class ByrealTradeExecutor {
  private config: ByrealConfig;
  /** Дневной трекинг объёмов */
  private dailyTrades: { timestamp: number; amount: number }[] = [];

  constructor(config: Partial<ByrealConfig> = {}) {
    this.config = {
      apiUrl: config.apiUrl ?? BYREAL_DEFAULT_API_URL,
      apiKey: config.apiKey ?? '',
      safeAddress: config.safeAddress ?? ('0x0000000000000000000000000000000000000000' as `0x${string}`),
      maxTradeAmount: config.maxTradeAmount ?? 1000,
      dailyLimit: config.dailyLimit ?? 5000,
      defaultSlippage: config.defaultSlippage ?? 0.5,
      mockMode: config.mockMode ?? true,
    };
  }

  /**
   * Исполнить трейд
   * В mockMode — возвращает мок-результат
   */
  async executeTrade(params: TradeParams): Promise<TradeResult> {
    // Валидация
    const validation = this.validateTrade(params);
    if (validation) return validation;

    // Проверка лимитов
    const limitCheck = this.checkLimits(params);
    if (limitCheck) return limitCheck;

    if (this.config.mockMode) {
      return this.mockTrade(params);
    }

    return this.realTrade(params);
  }

  /** Валидация параметров трейда */
  private validateTrade(params: TradeParams): TradeResult | null {
    const amount = BigInt(params.amount);
    if (amount <= 0n) {
      return {
        success: false,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: '0',
        amountOut: '0',
        price: 0,
        fee: '0',
        error: 'Invalid amount: must be > 0',
      };
    }

    if (!params.tokenIn || !params.tokenOut) {
      return {
        success: false,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: '0',
        amountOut: '0',
        price: 0,
        fee: '0',
        error: 'tokenIn and tokenOut are required',
      };
    }

    if (params.tokenIn === params.tokenOut) {
      return {
        success: false,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: '0',
        amountOut: '0',
        price: 0,
        fee: '0',
        error: 'tokenIn and tokenOut must be different',
      };
    }

    return null;
  }

  /** Проверка лимитов */
  private checkLimits(params: TradeParams): TradeResult | null {
    const amountUsdc = this.config.mockMode
      ? Number(params.amount) / 1e6  // mock: считаем что amount в USDC
      : Number(params.amount) / 1e18; // real: в wei

    // Максимальная сумма за трейд
    if (amountUsdc > this.config.maxTradeAmount) {
      return {
        success: false,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amount,
        amountOut: '0',
        price: 0,
        fee: '0',
        error: `Trade amount ${amountUsdc} USDC exceeds max ${this.config.maxTradeAmount} USDC`,
      };
    }

    // Дневной лимит
    const now = Date.now();
    this.dailyTrades = this.dailyTrades.filter(t => now - t.timestamp < DAILY_LIMIT_MS);
    const dailyTotal = this.dailyTrades.reduce((sum, t) => sum + t.amount, 0);

    if (dailyTotal + amountUsdc > this.config.dailyLimit) {
      return {
        success: false,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amount,
        amountOut: '0',
        price: 0,
        fee: '0',
        error: `Daily limit ${this.config.dailyLimit} USDC exceeded (current: ${dailyTotal} USDC)`,
      };
    }

    return null;
  }

  /** Мок-трейд (пока нет Byreal API ключей) */
  private async mockTrade(params: TradeParams): Promise<TradeResult> {
    // Симуляция задержки сети
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

    const amountIn = BigInt(params.amount);
    // Мок: курс ~1:1 с небольшим проскальзыванием
    const slippage = params.slippage ?? this.config.defaultSlippage;
    const rate = 1 - slippage / 100 + (Math.random() - 0.5) * 0.02;
    const amountOut = BigInt(Math.floor(Number(amountIn) * rate));

    const result: TradeResult = {
      success: true,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amount,
      amountOut: amountOut.toString(),
      price: rate,
      fee: '0.001',
    };

    // Логируем
    this.dailyTrades.push({ timestamp: Date.now(), amount: Number(amountIn) / 1e6 });
    this.logTrade(params, result);

    return result;
  }

  /** Реальный трейд через Byreal API */
  private async realTrade(_params: TradeParams): Promise<TradeResult> {
    // TODO: реализовать после получения Byreal API ключей от Стаса
    throw new Error('Byreal API not configured. Стас, нужны ключи (H-1.5).');
  }

  /** Логирование трейда */
  private logTrade(params: TradeParams, result: TradeResult): void {
    const entry: TradeLogEntry = {
      timestamp: new Date().toISOString(),
      params,
      result,
    };

    // Пишем в runtime-лог
    const logLine = `[Byreal] ${entry.timestamp} | ${result.success ? '✅' : '❌'} ` +
      `in=${params.tokenIn.slice(0, 10)}... amt=${params.amount} ` +
      `→ out=${params.tokenOut.slice(0, 10)}... amt=${result.amountOut} ` +
      `tx=${result.txHash ?? 'N/A'} ${result.error ?? ''}`;

    console.log(logLine);

    // TODO: файловый лог (если нужен)
    // appendFileSync('.data/byreal-trades.log', logLine + '\n');
  }

  /** Получить текущий дневной объём */
  getDailyVolume(): number {
    const now = Date.now();
    this.dailyTrades = this.dailyTrades.filter(t => now - t.timestamp < DAILY_LIMIT_MS);
    return this.dailyTrades.reduce((sum, t) => sum + t.amount, 0);
  }

  /** Обновить конфиг (например, при получении ключей) */
  updateConfig(partial: Partial<ByrealConfig>): void {
    this.config = { ...this.config, ...partial };
  }
}
