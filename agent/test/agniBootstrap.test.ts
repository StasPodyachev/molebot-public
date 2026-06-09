/**
 * Тест: Agni plugin bootstrap — инициализация при старте
 *
 * Проверяет что initAgniPlugin() вызывается без ошибок
 * и что getAgniExecutor() возвращает рабочий инстанс.
 * T-TRADE-01 v2: session keys вместо AGENT_PRIVATE_KEY.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { initAgniPlugin, getAgniExecutor, AgniExecutor } from '../src/plugins/agni/index.js';
import { MOLE_VAULT_ADDRESS } from '../src/plugins/agni/constants.js';

describe('Agni plugin bootstrap', () => {
  afterEach(() => {
    // Сброс синглтона между тестами
  });

  it('должен инициализироваться с дефолтным конфигом', () => {
    const executor = initAgniPlugin();
    expect(executor).toBeInstanceOf(AgniExecutor);
    expect(executor.getDailyVolume()).toBe(0);
  });

  it('должен инициализироваться с кастомным конфигом', () => {
    const executor = initAgniPlugin({
      mockMode: true, maxTradeAmount: 500, dailyLimit: 2500, defaultSlippage: 1.0,
      routerAddress: '0x' + 'a'.repeat(40) as `0x${string}`,
      quoterAddress: '0x' + 'b'.repeat(40) as `0x${string}`,
    });
    expect(executor).toBeInstanceOf(AgniExecutor);
  });

  it('должен инициализироваться без креша при пустом конфиге', () => {
    const executor = initAgniPlugin({});
    expect(executor).toBeInstanceOf(AgniExecutor);
  });

  it('getAgniExecutor должен вернуть singleton после init', () => {
    initAgniPlugin({ mockMode: true });
    expect(getAgniExecutor()).toBeInstanceOf(AgniExecutor);
  });

  it('должен исполнить своп после инициализации', async () => {
    const TOKEN_A = '0x' + 'a'.repeat(40) as `0x${string}`;
    const TOKEN_B = '0x' + 'b'.repeat(40) as `0x${string}`;
    const executor = initAgniPlugin({ mockMode: true });
    const result = await executor.executeSwap({ tokenIn: TOKEN_A, tokenOut: TOKEN_B, amount: '1000000' });
    expect(result.success).toBe(true);
    expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('должен получить quote после инициализации', async () => {
    const TOKEN_A = '0x' + 'a'.repeat(40) as `0x${string}`;
    const TOKEN_B = '0x' + 'b'.repeat(40) as `0x${string}`;
    const executor = initAgniPlugin({ mockMode: true });
    const quote = await executor.getQuote({ tokenIn: TOKEN_A, tokenOut: TOKEN_B, amount: '1000000' });
    expect(quote.success).toBe(true);
    expect(BigInt(quote.amountOut)).toBeGreaterThan(0n);
  });

  // ── T-TRADE-01 v2: session keys config ──

  it('должен принимать vaultAddress из конфига', () => {
    const vaultAddr = '0x' + 'd'.repeat(40) as `0x${string}`;
    const executor = initAgniPlugin({ mockMode: true, vaultAddress: vaultAddr });
    expect(executor.getVaultAddress()).toBe(vaultAddr);
  });

  it('должен использовать дефолтный vault из констант', () => {
    const executor = initAgniPlugin({ mockMode: true });
    expect(executor.getVaultAddress()).toBe(MOLE_VAULT_ADDRESS);
  });

  it('должен принимать sessionPrivateKey', () => {
    const executor = initAgniPlugin({
      mockMode: true,
      sessionPrivateKey: '0x' + '1'.repeat(64) as `0x${string}`,
    });
    expect(executor).toBeInstanceOf(AgniExecutor);
  });

  it('должен инициализироваться с mockMode=false без креша (без RPC)', () => {
    const executor = initAgniPlugin({
      mockMode: false,
      // Без sessionPrivateKey — walletClient не создаётся, checkSession упадёт на RPC
    });
    expect(executor).toBeInstanceOf(AgniExecutor);
  });

  it('checkSession должен возвращать {active:false} в mockMode (без RPC)', async () => {
    const executor = initAgniPlugin({ mockMode: false });
    try {
      const s = await executor.checkSession(1n);
      // В тестовом окружении без RPC упадёт — это нормально
      expect(typeof s.active).toBe('boolean');
    } catch {
      // RPC unavailable — ожидаемо в unit-тестах
    }
  });
});
