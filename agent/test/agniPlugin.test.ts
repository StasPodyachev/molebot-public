/**
 * Тесты Agni Finance plugin (mock mode)
 * ⚠️ Без реального RPC — все тесты в mockMode
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgniExecutor } from '../src/plugins/agni/executor.js';

function makeExecutor() {
  return new AgniExecutor({ mockMode: true });
}

const TOKEN_A = '0x' + 'a'.repeat(40) as `0x${string}`;
const TOKEN_B = '0x' + 'b'.repeat(40) as `0x${string}`;
const TOKEN_C = '0x' + 'c'.repeat(40) as `0x${string}`;

describe('AgniExecutor — mock mode', () => {
  let executor: AgniExecutor;

  beforeEach(() => {
    executor = makeExecutor();
  });

  // ========== executeSwap ==========

  it('должен исполнить успешный своп в mockMode', async () => {
    const result = await executor.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '1000000',
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();
    expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(result.amountIn).toBe('1000000');
    expect(BigInt(result.amountOut)).toBeGreaterThan(0n);
    expect(result.price).toBeGreaterThan(0);
    expect(result.fee).toBeDefined();
  });

  it('должен отклонить своп с нулевым amount', async () => {
    const result = await executor.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '0',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid amount');
  });

  it('должен отклонить своп с одинаковыми токенами', async () => {
    const result = await executor.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_A,
      amount: '1000000',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('different');
  });

  it('должен отклонить своп без токенов', async () => {
    const result = await executor.executeSwap({
      tokenIn: '' as `0x${string}`,
      tokenOut: '' as `0x${string}`,
      amount: '1000000',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('должен отклонить своп превышающий maxTradeAmount', async () => {
    const executor2 = new AgniExecutor({
      mockMode: true,
      maxTradeAmount: 1, // всего 1 USDC
    });

    const result = await executor2.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '5000000', // 5 USDC (в mockMode считается USDC smallest units)
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds max');
  });

  it('должен отклонить своп превышающий дневной лимит', async () => {
    const executor3 = new AgniExecutor({
      mockMode: true,
      dailyLimit: 3,
      maxTradeAmount: 2,
    });

    // Первый своп — успех (2 USDC)
    const r1 = await executor3.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '2000000', // 2 USDC
    });
    expect(r1.success).toBe(true);

    // Второй своп — превышает daily limit (2 + 2 > 3)
    const r2 = await executor3.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_C,
      amount: '2000000',
    });
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('Daily limit');
  });

  it('должен увеличивать dailyVolume после свопа', async () => {
    expect(executor.getDailyVolume()).toBe(0);

    await executor.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '1000000',
    });

    expect(executor.getDailyVolume()).toBeCloseTo(1, 0);
  });

  it('должен обновлять конфиг через updateConfig', async () => {
    executor.updateConfig({ maxTradeAmount: 500 });
    // проверяем, что трейд с суммой в рамках нового лимита проходит
    const result = await executor.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '400000000', // 400 USDC (< 500)
    });
    expect(result.success).toBe(true);
  });

  // ========== getQuote ==========

  it('должен возвращать mock quote', async () => {
    const quote = await executor.getQuote({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '1000000',
    });

    expect(quote.success).toBe(true);
    expect(BigInt(quote.amountOut)).toBeGreaterThan(0n);
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.route).toEqual([TOKEN_A, TOKEN_B]);
  });

  it('должен возвращать корректный fee в quote', async () => {
    const e = new AgniExecutor({
      mockMode: true,
      defaultFeeTier: 500, // 0.05%
    });

    const quote = await e.getQuote({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '1000000',
    });

    expect(quote.success).toBe(true);
    expect(quote.fee).toBe('0.0005');
  });

  // ========== getBalance ==========

  it('должен возвращать mock-баланс в mockMode', async () => {
    const balance = await executor.getBalance(TOKEN_A);

    expect(balance.balance).toBe('0');
    expect(balance.decimals).toBe(18);
    expect(balance.error).toBeUndefined();
  });

  it('должен возвращать кастомный mockBalance', async () => {
    const e = new AgniExecutor({
      mockMode: true,
      mockBalance: '1000000000000000000', // 1 токен с 18 decimals
    });

    const balance = await e.getBalance(TOKEN_A);
    expect(balance.balance).toBe('1000000000000000000');
    expect(balance.decimals).toBe(18);
  });

  // ========== конфиг ==========

  it('должен принимать кастомные адреса контрактов', () => {
    const customRouter = '0x' + 'f'.repeat(40) as `0x${string}`;
    const customQuoter = '0x' + 'e'.repeat(40) as `0x${string}`;

    const e = new AgniExecutor({
      routerAddress: customRouter,
      quoterAddress: customQuoter,
      mockMode: true,
    });

    expect(e).toBeDefined();
    expect(e.getDailyVolume()).toBe(0);
  });

  it('должен использовать дефолтный fee tier 3000', async () => {
    const result = await executor.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '1000000',
    });

    expect(result.success).toBe(true);
    // fee конвертируется из feeTier 3000 -> 0.0030
    expect(result.fee).toBe('0.0030');
  });

  // ========== краевые случаи ==========

  it('должен принимать slippage параметр', async () => {
    const result = await executor.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '1000000',
      slippage: 1.0,
    });

    expect(result.success).toBe(true);
    // с slippage 1% цена ~0.99
    expect(result.price).toBeLessThanOrEqual(1.0);
    expect(result.price).toBeGreaterThan(0.97);
  });

  it('должен принимать deadline параметр', async () => {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const result = await executor.executeSwap({
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amount: '1000000',
      deadline,
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();
  });

  // ========== vault config (T-TRADE-01 v2) ==========

  it('должен принимать vaultAddress в конфиге', () => {
    const vaultAddr = '0x' + 'd'.repeat(40) as `0x${string}`;
    const e = new AgniExecutor({ mockMode: true, vaultAddress: vaultAddr });
    expect(e.getVaultAddress()).toBe(vaultAddr);
  });

  it('должен использовать дефолтный vaultAddress из констант', () => {
    const e = new AgniExecutor({ mockMode: true });
    expect(e.getVaultAddress()).toBeDefined();
    expect(e.getVaultAddress().startsWith('0x')).toBe(true);
  });

  it('должен принимать sessionPrivateKey (не крешится)', () => {
    const e = new AgniExecutor({
      mockMode: true,
      sessionPrivateKey: '0x' + '1'.repeat(64) as `0x${string}`,
    });
    expect(e).toBeDefined();
  });
});
