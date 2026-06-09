/**
 * Тесты replenishCredits
 *
 * Мокаем checkBalance чтобы не ходить в реальный RPC.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Мокаем checkBalance перед импортом модуля
vi.mock('../checkBalance.js', () => ({
  checkBalance: vi.fn(),
}));

import { checkBalance } from '../checkBalance.js';
import { replenishCredits, resetPendingTopUp } from '../index.js';

const AGENT = '0xfecb0b79583a337c8bd1e390b81661329b78450e' as `0x${string}`;
const THRESHOLD = 1_000_000_000_000_000_000n; // 1 токен
const TOP_UP = 100_000_000_000_000_000_000n;  // 100 токенов

describe('replenishCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPendingTopUp();
  });

  it('баланс > minThreshold → action=none (ничего не делаем)', async () => {
    // Баланс больше порога
    (checkBalance as ReturnType<typeof vi.fn>).mockResolvedValue(2_000_000_000_000_000_000n);

    const result = await replenishCredits({
      agentWallet: AGENT,
      minThreshold: THRESHOLD,
      topUpAmount: TOP_UP,
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe('none');
    expect(result.balance).toBe(2_000_000_000_000_000_000n);
    expect(result.error).toBeUndefined();
  });

  it('баланс < minThreshold → action=requested', async () => {
    // Баланс меньше порога
    (checkBalance as ReturnType<typeof vi.fn>).mockResolvedValue(0n);

    const result = await replenishCredits({
      agentWallet: AGENT,
      minThreshold: THRESHOLD,
      topUpAmount: TOP_UP,
    });

    expect(result.ok).toBe(true);
    expect(result.action).toBe('requested');
    expect(result.balance).toBe(0n);
  });

  it('повторный вызов при pending → action=pending_exists', async () => {
    (checkBalance as ReturnType<typeof vi.fn>).mockResolvedValue(0n);

    // Первый вызов — запрашивает пополнение
    const r1 = await replenishCredits({
      agentWallet: AGENT,
      minThreshold: THRESHOLD,
      topUpAmount: TOP_UP,
    });
    expect(r1.action).toBe('requested');

    // Второй вызов — уже есть pending
    const r2 = await replenishCredits({
      agentWallet: AGENT,
      minThreshold: THRESHOLD,
      topUpAmount: TOP_UP,
    });
    expect(r2.ok).toBe(false);
    expect(r2.action).toBe('pending_exists');
    expect(r2.error).toContain('pending');
  });

  it('ошибка контракта → handled gracefully', async () => {
    // checkBalance кидает ошибку
    (checkBalance as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('RPC error: connection refused'));

    const result = await replenishCredits({
      agentWallet: AGENT,
      minThreshold: THRESHOLD,
      topUpAmount: TOP_UP,
    });

    expect(result.ok).toBe(false);
    expect(result.action).toBe('error');
    expect(result.error).toContain('RPC error');
  });

  it('pending протухает после таймаута', async () => {
    (checkBalance as ReturnType<typeof vi.fn>).mockResolvedValue(0n);

    // Первый вызов — pending
    const r1 = await replenishCredits({
      agentWallet: AGENT,
      minThreshold: THRESHOLD,
      topUpAmount: TOP_UP,
    });
    expect(r1.action).toBe('requested');

    // Сбрасываем pending (симуляция таймаута)
    resetPendingTopUp();

    // Теперь можно снова запросить
    const r2 = await replenishCredits({
      agentWallet: AGENT,
      minThreshold: THRESHOLD,
      topUpAmount: TOP_UP,
    });
    expect(r2.action).toBe('requested');
  });
});
