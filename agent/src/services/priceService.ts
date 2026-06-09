/**
 * priceService — FR-003: Pyth on Mantle + CoinPaprika fallback
 *
 * Primary: Pyth Hermes (off-chain price oracle)
 * Fallback: CoinPaprika REST API (без ключа)
 *
 * Кэш: 90 секунд (in-memory, настраивается через PRICE_CACHE_TTL_SEC)
 * Stale threshold: 120 секунд (publishTime, через PRICE_STALE_THRESHOLD_SEC)
 *
 * getPrice(symbol) + getAllPrices()
 *
 * Источники ошибок:
 * - Pyth offline/сломан → fallback на CoinPaprika
 * - CoinPaprika тоже offline → PriceFeedUnavailable
 */

import { HermesClient } from '@pythnetwork/hermes-client';
import type { HexString } from '@pythnetwork/hermes-client';
import type { AppConfig } from '../config.js';
import type { PriceCacheEntry, PriceData, PriceSymbol, PriceSource } from '../types.js';
import { PRICE_SYMBOLS, SYMBOL_TO_PYTH_ID } from '../types.js';

/* -------------------------------------------------------------------------- */
/* Параметры (из env с fallback)                                               */
/* -------------------------------------------------------------------------- */

const HERMES_URL = 'https://hermes.pyth.network';
const COINPAPRIKA_BASE = 'https://api.coinpaprika.com/v1';

function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

/* -------------------------------------------------------------------------- */
/* CoinPaprika тикер ID mapping                                                */
/* -------------------------------------------------------------------------- */

const SYMBOL_TO_COINPAPRIKA_ID: Record<PriceSymbol, string> = {
  'BTC/USD': 'btc-bitcoin',
  'ETH/USD': 'eth-ethereum',
  'SOL/USD': 'sol-solana',
};

/* -------------------------------------------------------------------------- */
/* PriceService                                                                */
/* -------------------------------------------------------------------------- */

export class PriceService {
  private hermes: HermesClient;
  private cache = new Map<PriceSymbol, PriceCacheEntry>();
  private readonly staleThresholdSec: number;
  private readonly cacheTtlSec: number;
  private readonly timeoutMs: number;
  private readonly githubRepo: string;
  private readonly githubToken: string | undefined;

  constructor(config?: Pick<AppConfig, 'githubRepo' | 'githubToken'>) {
    this.staleThresholdSec = envNum('PRICE_STALE_THRESHOLD_SEC', 120);
    this.cacheTtlSec = envNum('PRICE_CACHE_TTL_SEC', 90);
    this.timeoutMs = envNum('PYTH_RPC_TIMEOUT_MS', 10_000);
    this.githubRepo = config?.githubRepo ?? process.env.GITHUB_REPO ?? 'StasPodyachev/molebot_mantle';
    this.githubToken = config?.githubToken ?? process.env.GITHUB_TOKEN;

    this.hermes = new HermesClient(HERMES_URL, {
      timeout: this.timeoutMs,
      httpRetries: 2,
    });
  }

  /**
   * getPrice — получить цену для символа
   * Проверяет кэш → Pyth Hermes → CoinPaprika → PriceFeedUnavailable
   */
  async getPrice(symbol: PriceSymbol): Promise<PriceData> {
    // 1. Проверить кэш
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlSec * 1000) {
      return cached.data;
    }

    // 2. Pyth Hermes
    try {
      const data = await this.fetchFromPyth(symbol);
      this.cache.set(symbol, { data, timestamp: Date.now() });
      return data;
    } catch (pythErr) {
      console.warn(`[priceService] Pyth error for ${symbol}:`, (pythErr as Error).message);
    }

    // 3. CoinPaprika fallback
    try {
      const data = await this.fetchFromCoinPaprika(symbol);
      this.cache.set(symbol, { data, timestamp: Date.now() });
      // Лог перехода на fallback (не блокируем ответ)
      this.logFallback(symbol, 'CoinPaprika').catch(() => {});
      return data;
    } catch (cpErr) {
      console.warn(`[priceService] CoinPaprika error for ${symbol}:`, (cpErr as Error).message);
    }

    // 4. Оба источника недоступны
    throw new PriceFeedUnavailable(symbol);
  }

  /**
   * getAllPrices — получить цены для всех символов
   */
  async getAllPrices(): Promise<PriceData[]> {
    const symbols = [...PRICE_SYMBOLS];
    const results = await Promise.allSettled(
      symbols.map((sym) => this.getPrice(sym)),
    );

    const prices: PriceData[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        prices.push(result.value);
      }
    }

    if (prices.length === 0) {
      throw new PriceFeedUnavailable('ALL');
    }

    return prices;
  }

  /* -- Pyth Hermes -- */

  private async fetchFromPyth(symbol: PriceSymbol): Promise<PriceData> {
    const feedId = SYMBOL_TO_PYTH_ID[symbol];
    if (!feedId) throw new Error(`Unknown symbol: ${symbol}`);

    const updates = await this.hermes.getLatestPriceUpdates([feedId as HexString], {
      parsed: true,
    });

    if (!updates.parsed?.length) {
      throw new Error(`No Pyth data for ${symbol}`);
    }

    const parsed = updates.parsed[0];
    const p = parsed.price;
    const now = Math.floor(Date.now() / 1000);

    // Проверка актуальности
    if (now - p.publish_time > this.staleThresholdSec) {
      throw new Error(
        `Pyth data stale for ${symbol}: publishTime=${p.publish_time}, now=${now}, threshold=${this.staleThresholdSec}s`,
      );
    }

    // Преобразование: price.price * 10^price.expo
    const priceNum = this.parsePythPrice(p.price, p.expo);
    const confNum = this.parsePythPrice(p.conf, p.expo);

    return {
      symbol,
      price: priceNum,
      confidence: confNum,
      timestamp: p.publish_time,
      source: 'pyth',
    };
  }

  /**
   * Парсинг Pyth цены из строки + экспонента
   * Использует BigInt → строковое представление → Number, чтобы избежать
   * потери точности на значениях > 2^53 (замечание тестера).
   *
   * Пример: price="6700000000000", expo=-8 → 67000.00000000
   */
  private parsePythPrice(priceStr: string, expo: number): number {
    const big = BigInt(priceStr);

    if (expo >= 0) {
      // positive exponent — big * 10^expo может выйти за 2^53, используем строку
      const mul = BigInt(10) ** BigInt(expo);
      return Number(big * mul);
    }

    const negExpo = BigInt(-expo);
    const divisor = BigInt(10) ** negExpo;
    const whole = big / divisor;
    const frac = big % divisor;

    // Строим строку вручную, чтобы избежать IEEE 754 потерь
    const fracStr = frac.toString().padStart(Number(negExpo), '0');
    return Number(`${whole}.${fracStr}`);
  }

  /* -- CoinPaprika fallback -- */

  private async fetchFromCoinPaprika(symbol: PriceSymbol): Promise<PriceData> {
    const tickerId = SYMBOL_TO_COINPAPRIKA_ID[symbol];
    if (!tickerId) throw new Error(`Unknown CoinPaprika ticker for ${symbol}`);

    const res = await fetch(`${COINPAPRIKA_BASE}/tickers/${tickerId}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`CoinPaprika returned ${res.status} for ${tickerId}`);
    }

    const data = await res.json() as {
      id: string;
      name: string;
      symbol: string;
      quotes: {
        USD: {
          price: number;
          percent_change_1h?: number;
        };
      };
      last_updated: string;
    };

    const usdQuote = data.quotes?.USD;
    if (!usdQuote || typeof usdQuote.price !== 'number') {
      throw new Error(`CoinPaprika: no USD price for ${tickerId}`);
    }

    const ts = Math.floor(new Date(data.last_updated).getTime() / 1000) || Math.floor(Date.now() / 1000);

    return {
      symbol,
      price: usdQuote.price,
      confidence: 0,
      timestamp: ts,
      source: 'coinpaprika',
    };
  }

  /* -- Лог fallback в GitHub -- */

  private async logFallback(symbol: PriceSymbol, fallbackSource: string): Promise<void> {
    const token = this.githubToken;
    if (!token) return;

    const filePath = 'OC_Obsidian/Errors/price-feed.log';
    const line = `[${new Date().toISOString()}] FALLBACK: ${symbol} → ${fallbackSource} (Pyth unavailable)`;

    try {
      const getRes = await fetch(`https://api.github.com/repos/${this.githubRepo}/contents/${filePath}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
      });

      let sha: string | undefined;
      let currentContent = '';
      if (getRes.ok) {
        const file = await getRes.json() as { sha: string; content: string };
        sha = file.sha;
        currentContent = Buffer.from(file.content, 'base64').toString('utf-8');
      }

      const newContent = currentContent
        ? currentContent + '\n' + line
        : `# Price Feed Fallback Log\n\n${line}`;

      await fetch(`https://api.github.com/repos/${this.githubRepo}/contents/${filePath}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `price-feed: fallback ${symbol} → ${fallbackSource}`,
          content: Buffer.from(newContent).toString('base64'),
          sha,
        }),
      });
    } catch {
      // non-critical
    }
  }

  /** Закрыть HTTP-соединения (graceful shutdown) */
  async close(): Promise<void> {
    // HermesClient не имеет close(), но мы очищаем кэш
    this.cache.clear();
  }
}

/* -------------------------------------------------------------------------- */
/* Error                                                                       */
/* -------------------------------------------------------------------------- */

export class PriceFeedUnavailable extends Error {
  public readonly symbol: string;

  constructor(symbol: string) {
    super(`Price feed unavailable for ${symbol}`);
    this.name = 'PriceFeedUnavailable';
    this.symbol = symbol;
  }
}
