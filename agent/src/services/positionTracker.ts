/**
 * positionTracker — TASK-015: In-memory position tracker
 *
 * Отслеживает открытые позиции, PnL, stop-loss и take-profit.
 * Одна открытая позиция на tokenId.
 */

import type { DexPair } from '../types.js';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface Position {
  tokenId: number;
  pair: DexPair;
  side: 'BUY' | 'SELL';
  amount: number;
  entryPrice: number;
  openedAt: number;
  pnl: number;
  status: 'open' | 'closed';
}

/* -------------------------------------------------------------------------- */
/* PositionTracker                                                             */
/* -------------------------------------------------------------------------- */

const DEFAULT_STOP_LOSS_PCT = 0.15;   // -15%
const DEFAULT_TAKE_PROFIT_PCT = 0.25; // +25%

export class PositionTracker {
  private positions = new Map<number, Position>();

  /**
   * open — открыть позицию для токена.
   * Автоматически закрывает предыдущую открытую позицию, если есть.
   */
  open(
    tokenId: number,
    pair: DexPair,
    side: 'BUY' | 'SELL',
    amount: number,
    price: number,
  ): Position {
    // Закрываем существующую позицию по текущей цене
    const existing = this.positions.get(tokenId);
    if (existing && existing.status === 'open') {
      this.close(tokenId, price);
    }

    const pos: Position = {
      tokenId,
      pair,
      side,
      amount,
      entryPrice: price,
      openedAt: Date.now(),
      pnl: 0,
      status: 'open',
    };
    this.positions.set(tokenId, pos);
    return { ...pos };
  }

  /**
   * close — закрыть открытую позицию для токена.
   * Возвращает PnL и цену выхода, либо null если позиции нет.
   */
  close(tokenId: number, exitPrice?: number): { pnl: number; exitPrice: number } | null {
    const pos = this.positions.get(tokenId);
    if (!pos || pos.status !== 'open') return null;

    const price = exitPrice ?? pos.entryPrice;
    const pnl = pos.side === 'BUY'
      ? (price - pos.entryPrice) * (pos.amount / pos.entryPrice)
      : (pos.entryPrice - price) * (pos.amount / pos.entryPrice);

    pos.status = 'closed';
    pos.pnl = Math.round(pnl * 100) / 100;
    this.positions.delete(tokenId);

    return { pnl: pos.pnl, exitPrice: price };
  }

  /** Получить позицию для токена (или null) */
  getPosition(tokenId: number): Position | null {
    return this.positions.get(tokenId) ?? null;
  }

  /** Все открытые позиции */
  getAll(): Position[] {
    return Array.from(this.positions.values());
  }

  /** Проверить, есть ли открытая позиция */
  hasOpen(tokenId: number): boolean {
    const pos = this.positions.get(tokenId);
    return pos !== undefined && pos.status === 'open';
  }

  /**
   * checkStopLoss — true если позиция должна быть закрыта по стоп-лоссу.
   * Для BUY: цена упала ≥ stopLossPct ниже entry.
   * Для SELL: цена выросла ≥ stopLossPct выше entry.
   */
  checkStopLoss(
    tokenId: number,
    currentPrice: number,
    stopLossPct: number = DEFAULT_STOP_LOSS_PCT,
  ): boolean {
    const pos = this.positions.get(tokenId);
    if (!pos || pos.status !== 'open') return false;

    if (pos.side === 'BUY') {
      return (pos.entryPrice - currentPrice) / pos.entryPrice >= stopLossPct;
    } else {
      return (currentPrice - pos.entryPrice) / pos.entryPrice >= stopLossPct;
    }
  }

  /**
   * checkTakeProfit — true если позиция должна быть закрыта по тейк-профиту.
   * Для BUY: цена выросла ≥ takeProfitPct выше entry.
   * Для SELL: цена упала ≥ takeProfitPct ниже entry.
   */
  checkTakeProfit(
    tokenId: number,
    currentPrice: number,
    takeProfitPct: number = DEFAULT_TAKE_PROFIT_PCT,
  ): boolean {
    const pos = this.positions.get(tokenId);
    if (!pos || pos.status !== 'open') return false;

    if (pos.side === 'BUY') {
      return (currentPrice - pos.entryPrice) / pos.entryPrice >= takeProfitPct;
    } else {
      return (pos.entryPrice - currentPrice) / pos.entryPrice >= takeProfitPct;
    }
  }
}
