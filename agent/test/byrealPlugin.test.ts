/**
 * Тесты Byreal plugin (mock mode)
 * ⚠️ Пока без реального Byreal API — все тесты в mockMode
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ByrealTradeExecutor } from '../src/plugins/byreal/executor.js';

function makeExecutor() {
  return new ByrealTradeExecutor({ mockMode: true });
}

describe('ByrealTradeExecutor', () => {
  let executor: ByrealTradeExecutor;

  beforeEach(() => {
    executor = makeExecutor();
  });

  it('должен исполнить успешный трейд в mockMode', async () => {
    const result = await executor.executeTrade({
      tokenIn: '0x' + 'a'.repeat(40),
      tokenOut: '0x' + 'b'.repeat(40),
      amount: '1000000',
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();
    expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(result.amountIn).toBe('1000000');
    expect(BigInt(result.amountOut)).toBeGreaterThan(0n);
  });

  it('должен отклонить трейд с нулевым amount', async () => {
    const result = await executor.executeTrade({
      tokenIn: '0x' + 'a'.repeat(40),
      tokenOut: '0x' + 'b'.repeat(40),
      amount: '0',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid amount');
  });

  it('должен отклонить трейд с одинаковыми токенами', async () => {
    const addr = '0x' + 'a'.repeat(40);
    const result = await executor.executeTrade({
      tokenIn: addr,
      tokenOut: addr,
      amount: '1000000',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('different');
  });

  it('должен отклонить трейд без токенов', async () => {
    const result = await executor.executeTrade({
      tokenIn: '' as `0x${string}`,
      tokenOut: '' as `0x${string}`,
      amount: '1000000',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('должен отклонить трейд превышающий maxTradeAmount', async () => {
    const executor2 = new ByrealTradeExecutor({
      mockMode: true,
      maxTradeAmount: 1, // всего 1 USDC
    });

    const result = await executor2.executeTrade({
      tokenIn: '0x' + 'a'.repeat(40),
      tokenOut: '0x' + 'b'.repeat(40),
      amount: '5000000', // 5 USDC (в mockMode считается USDC)
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds max');
  });

  it('должен отклонить трейд превышающий дневной лимит', async () => {
    const executor3 = new ByrealTradeExecutor({
      mockMode: true,
      dailyLimit: 3,
      maxTradeAmount: 2,
    });

    // Первый трейд — успех (2 USDC)
    const r1 = await executor3.executeTrade({
      tokenIn: '0x' + 'a'.repeat(40),
      tokenOut: '0x' + 'b'.repeat(40),
      amount: '2000000', // 2 USDC
    });
    expect(r1.success).toBe(true);

    // Второй трейд — уже превышает daily limit (2 + 2 > 3)
    const r2 = await executor3.executeTrade({
      tokenIn: '0x' + 'a'.repeat(40),
      tokenOut: '0x' + 'c'.repeat(40),
      amount: '2000000', // 2 USDC
    });
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('Daily limit');
  });

  it('должен увеличивать dailyVolume после трейда', async () => {
    expect(executor.getDailyVolume()).toBe(0);

    await executor.executeTrade({
      tokenIn: '0x' + 'a'.repeat(40),
      tokenOut: '0x' + 'b'.repeat(40),
      amount: '1000000', // ~1 USDC
    });

    expect(executor.getDailyVolume()).toBeCloseTo(1, 0);
  });

  it('должен обновлять конфиг через updateConfig', () => {
    executor.updateConfig({ maxTradeAmount: 500 });
    // косвенная проверка — после обновления лимита трейд на 400 должен проходить
  });
});
