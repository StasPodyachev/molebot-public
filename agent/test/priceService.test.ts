/**
 * Тесты priceService (FR-003)
 *
 * 3 кейса:
 * 1. Pyth OK — возвращает цену с source='pyth'
 * 2. Pyth падает → CoinPaprika fallback — source='coinpaprika'
 * 3. Оба падают — PriceFeedUnavailable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriceService, PriceFeedUnavailable } from '../src/services/priceService.js';
import type { PriceData } from '../src/types.js';

// =========================================================================
// Константы для моков
// =========================================================================

const NOW_TS = Math.floor(Date.now() / 1000);

const MOCK_PYTH_RESPONSE = {
  parsed: [
    {
      id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      price: {
        price: '6700000000000',   // 67000.00000000
        conf: '1234567890',       // 12.34567890
        expo: -8,
        publish_time: NOW_TS - 30, // 30s ago — fresh
      },
      ema_price: {
        price: '6699000000000',
        conf: '1000000000',
        expo: -8,
        publish_time: NOW_TS - 30,
      },
    },
  ],
};

const MOCK_COINPAPRIKA_RESPONSE = {
  id: 'btc-bitcoin',
  name: 'Bitcoin',
  symbol: 'BTC',
  quotes: { USD: { price: 67123.45, percent_change_1h: 0.5 } },
  last_updated: new Date().toISOString(),
};

// =========================================================================
// Моки — используем vi.hoisted
// =========================================================================

const mockGetLatestPriceUpdates = vi.hoisted(() => vi.fn());

vi.mock('@pythnetwork/hermes-client', () => ({
  HermesClient: vi.fn(() => ({
    getLatestPriceUpdates: mockGetLatestPriceUpdates,
  })),
}));

// =========================================================================
// Тесты
// =========================================================================

describe('PriceService — FR-003', () => {
  let service: PriceService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PriceService();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Кейс 1: Pyth OK ──

  it('должен вернуть цену из Pyth (source=pyth)', async () => {
    mockGetLatestPriceUpdates.mockResolvedValue(MOCK_PYTH_RESPONSE);

    const result = await service.getPrice('BTC/USD');

    expect(result).toMatchObject({ symbol: 'BTC/USD', source: 'pyth' });
    expect(typeof result.price).toBe('number');
    expect(result.price).toBeCloseTo(67000, -1);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('getAllPrices возвращает массив из 3 цен от Pyth', async () => {
    mockGetLatestPriceUpdates.mockResolvedValue(MOCK_PYTH_RESPONSE);

    const results = await service.getAllPrices();

    expect(results.length).toBe(3);
    expect(results.map((r) => r.symbol).sort()).toEqual(['BTC/USD', 'ETH/USD', 'SOL/USD']);
    results.forEach((r) => expect(r.source).toBe('pyth'));
  });

  // ── Кейс 2: Pyth падает → CoinPaprika fallback ──

  it('должен переключиться на CoinPaprika когда Pyth недоступен', async () => {
    mockGetLatestPriceUpdates.mockRejectedValue(new Error('Pyth network error'));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_COINPAPRIKA_RESPONSE),
    });

    const result = await service.getPrice('BTC/USD');

    expect(result).toMatchObject({ symbol: 'BTC/USD', source: 'coinpaprika' });
    expect(typeof result.price).toBe('number');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.coinpaprika.com/v1/tickers/btc-bitcoin'),
      expect.anything(),
    );
  });

  it('CoinPaprika fallback: ETH/USD и SOL/USD тоже работают', async () => {
    mockGetLatestPriceUpdates.mockRejectedValue(new Error('Pyth error'));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...MOCK_COINPAPRIKA_RESPONSE,
        id: 'eth-ethereum',
        symbol: 'ETH',
        quotes: { USD: { price: 3456.78 } },
      }),
    });

    const result = await service.getPrice('ETH/USD');
    expect(result.source).toBe('coinpaprika');
    expect(result.price).toBe(3456.78);
  });

  // ── Кейс 3: Оба источника падают ──

  it('должен бросить PriceFeedUnavailable когда оба источника недоступны', async () => {
    mockGetLatestPriceUpdates.mockRejectedValue(new Error('Pyth network error'));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('CoinPaprika network error'));

    await expect(service.getPrice('BTC/USD')).rejects.toThrow(PriceFeedUnavailable);
    await expect(service.getPrice('BTC/USD')).rejects.toThrow('BTC/USD');
  });

  it('getAllPrices бросит PriceFeedUnavailable когда все недоступны', async () => {
    mockGetLatestPriceUpdates.mockRejectedValue(new Error('Pyth offline'));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('CoinPaprika offline'));

    await expect(service.getAllPrices()).rejects.toThrow(PriceFeedUnavailable);
  });

  // ── Кэш ──

  it('должен использовать кэш в пределах 90 секунд', async () => {
    mockGetLatestPriceUpdates.mockResolvedValue(MOCK_PYTH_RESPONSE);

    const first = await service.getPrice('BTC/USD');
    expect(mockGetLatestPriceUpdates).toHaveBeenCalledTimes(1);

    const second = await service.getPrice('BTC/USD');
    expect(mockGetLatestPriceUpdates).toHaveBeenCalledTimes(1); // кэш, не увеличилось

    expect(first).toEqual(second);
  });

  // ── close() ──

  it('close() — очищает кэш и не падает', async () => {
    mockGetLatestPriceUpdates.mockResolvedValue(MOCK_PYTH_RESPONSE);

    await service.getPrice('BTC/USD');
    expect((service as any).cache.size).toBe(1);

    await service.close();
    expect((service as any).cache.size).toBe(0);
  });

  // ── Pyth stale data → fallback ──

  it('должен отклонить Pyth данные старше 120 секунд и уйти на CoinPaprika', async () => {
    mockGetLatestPriceUpdates.mockResolvedValue({
      parsed: [
        {
          ...MOCK_PYTH_RESPONSE.parsed[0],
          price: {
            ...MOCK_PYTH_RESPONSE.parsed[0].price,
            publish_time: NOW_TS - 300, // 5 min ago — stale
          },
        },
      ],
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_COINPAPRIKA_RESPONSE),
    });

    const result = await service.getPrice('BTC/USD');
    expect(result.source).toBe('coinpaprika');
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
