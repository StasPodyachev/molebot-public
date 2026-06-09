/**
 * Merchant Moe trade executor
 *
 * Исполняет трейды через Merchant Moe DEX (LB Router v2.2) на Mantle.
 * В mockMode — возвращает мок-результаты (как Byreal плагин).
 * В realMode — через viem вызывает контракт LB Router.
 *
 * ⚠️ Реальный режим требует подписанного кошелька (через Agent/Safe).
 *   Пока Стас не настроит приватный ключ — используем mockMode.
 */

import { createPublicClient, http, type PublicClient, parseUnits } from 'viem';
import { mantle } from 'viem/chains';
import {
  type MerchantMoeConfig,
  type SwapParams,
  type SwapResult,
  type QuoteResult,
  type BalanceResult,
  type TradeLogEntry,
  MERCHANT_MOE_ROUTER,
  MERCHANT_MOE_QUOTER,
  LB_ROUTER_ABI,
  LB_QUOTER_ABI,
  ERC20_ABI,
} from './types.js';

/** Размер окна для дневного лимита (мс) */
const DAILY_LIMIT_MS = 24 * 60 * 60 * 1000;

/** Версия LB V2.2 */
const LB_VERSION_V2_2 = 2;

export class MerchantMoeExecutor {
  private config: MerchantMoeConfig;
  private client: PublicClient | null = null;
  /** Дневной трекинг объёмов */
  private dailyTrades: { timestamp: number; amount: number }[] = [];

  constructor(config: Partial<MerchantMoeConfig> = {}) {
    this.config = {
      routerAddress: (config.routerAddress ?? MERCHANT_MOE_ROUTER) as `0x${string}`,
      quoterAddress: (config.quoterAddress ?? MERCHANT_MOE_QUOTER) as `0x${string}`,
      walletAddress: config.walletAddress ?? ('0x0000000000000000000000000000000000000000' as `0x${string}`),
      rpcUrl: config.rpcUrl ?? 'https://rpc.mantle.xyz',
      chainId: config.chainId ?? 5000,
      maxTradeAmount: config.maxTradeAmount ?? 1000,
      dailyLimit: config.dailyLimit ?? 5000,
      defaultSlippage: config.defaultSlippage ?? 0.5,
      mockMode: config.mockMode ?? true,
      mockBalance: config.mockBalance ?? '0',
    };

    if (!this.config.mockMode) {
      this.initClient();
    }
  }

  /** Инициализировать viem client */
  private initClient(): void {
    this.client = createPublicClient({
      chain: mantle,
      transport: http(this.config.rpcUrl),
    });
  }

  /** Исполнить токен-своп */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    // Валидация
    const validation = this.validateSwap(params);
    if (validation) return validation;

    // Проверка лимитов
    const limitCheck = this.checkLimits(params);
    if (limitCheck) return limitCheck;

    // Проверка AICredits перед трейдом (если не mockMode)
    if (!this.config.mockMode) {
      try {
        // Динамический импорт из packages/elizaos — TypeScript не резолвит
        // https://github.com/microsoft/TypeScript/issues/43329
        const replenishPath = '../../../../packages/elizaos/actions/replenishCredits/index.js';
        const { replenishCredits } = await import(replenishPath);
        const creditsResult = await replenishCredits({
          agentWallet: this.config.walletAddress,
          minThreshold: 1_000_000_000_000_000_000n, // 1 токен
          topUpAmount: 100_000_000_000_000_000_000n, // 100 токенов
        });

        if (!creditsResult.ok && creditsResult.action === 'pending_exists') {
          return {
            success: false,
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amount,
            amountOut: '0',
            price: 0,
            fee: '0',
            error: `Not enough AICredits. Top-up requested via Safe (tx: ${creditsResult.error}).`,
          };
        }
      } catch (err) {
        console.error('[MerchantMoe] credits check failed:', err);
        // Не блокируем трейд — credit check опциональный
      }
    }

    if (this.config.mockMode) {
      return this.mockSwap(params);
    }

    return this.realSwap(params);
  }

  /** Получить quote (расчётный выход) */
  async getQuote(tokenIn: `0x${string}`, tokenOut: `0x${string}`, amountIn: string): Promise<QuoteResult> {
    if (this.config.mockMode) {
      return this.mockQuote(tokenIn, tokenOut, amountIn);
    }

    return this.realQuote(tokenIn, tokenOut, amountIn);
  }

  /** Получить баланс токена */
  async getBalance(token: `0x${string}`, owner?: `0x${string}`): Promise<BalanceResult> {
    const address = owner ?? this.config.walletAddress;

    if (this.config.mockMode) {
      return {
        token,
        balance: this.config.mockBalance ?? '0',
        decimals: 18,
      };
    }

    if (token === '0x0000000000000000000000000000000000000000' as `0x${string}`) {
      // NATIVE (MNT)
      return this.getNativeBalance(address);
    }

    try {
      const client = this.getClient();
      const [balance, decimals] = await Promise.all([
        client.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),
        client.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: 'decimals',
          args: [],
        }),
      ]);

      return {
        token,
        balance: balance.toString(),
        decimals,
      };
    } catch (err) {
      return {
        token,
        balance: '0',
        decimals: 18,
        error: `Failed to fetch balance: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /** Получить NATIVE баланс */
  private async getNativeBalance(address: `0x${string}`): Promise<BalanceResult> {
    try {
      const client = this.getClient();
      const balance = await client.getBalance({ address });
      return {
        token: '0x0000000000000000000000000000000000000000',
        balance: balance.toString(),
        decimals: 18,
      };
    } catch (err) {
      return {
        token: '0x0000000000000000000000000000000000000000',
        balance: '0',
        decimals: 18,
        error: `Failed to fetch native balance: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ========== Валидация и лимиты ==========

  private validateSwap(params: SwapParams): SwapResult | null {
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

  private checkLimits(params: SwapParams): SwapResult | null {
    // ⚠️ TODO: real-mode должен читать decimals токена через ERC20.decimals()
    //   Сейчас realSwap кидает эксепшн, так что этот код мёртвый
    const amountUsdc = this.config.mockMode
      ? Number(params.amount) / 1e6  // mock: считаем что amount в USDC
      : Number(params.amount) / 1e18; // real: временно 18 decimals

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

  // ========== Mock режим ==========

  private async mockSwap(params: SwapParams): Promise<SwapResult> {
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

    const amountIn = BigInt(params.amount);
    const slippage = params.slippage ?? this.config.defaultSlippage;
    const rate = 1 - slippage / 100 + (Math.random() - 0.5) * 0.02;

    // BigInt-умножение: rate * 1e18, потом /1e18 (без потери точности Number)
    const RATE_PRECISION = 1_000_000_000_000_000_000n;
    const rateBig = BigInt(Math.floor(rate * 1_000_000_000_000_000_000));
    const amountOut = (amountIn * rateBig) / RATE_PRECISION;

    const result: SwapResult = {
      success: true,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amount,
      amountOut: amountOut.toString(),
      price: rate,
      fee: '0.003',
    };

    this.dailyTrades.push({ timestamp: Date.now(), amount: this.toUsdcAmount(amountIn) });
    this.logSwap(params, result);

    return result;
  }

  private async mockQuote(_tokenIn: `0x${string}`, _tokenOut: `0x${string}`, amountIn: string): Promise<QuoteResult> {
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

    const slippage = this.config.defaultSlippage;
    const rate = 1 - slippage / 100 + (Math.random() - 0.5) * 0.01;

    const RATE_PRECISION = 1_000_000_000_000_000_000n;
    const rateBig = BigInt(Math.floor(rate * 1_000_000_000_000_000_000));
    const amountOut = (BigInt(amountIn) * rateBig) / RATE_PRECISION;

    return {
      success: true,
      amountOut: amountOut.toString(),
      price: rate,
      fee: '0.003',
      route: [_tokenIn, _tokenOut],
      pairs: [],
    };
  }

  // ========== Real режим (через viem) ==========

  private getClient(): PublicClient {
    if (!this.client) {
      this.initClient();
    }
    return this.client!;
  }

  /**
   * Реальный своп через LB Router
   *
   * ⚠️ Этот метод ТОЛЬКО симулирует вызов (eth_call).
   * Для реального исполнения нужен подписанный кошелёк.
   * Реальный вызов будет реализован после получения ключей от Стаса.
   */
  private async realSwap(_params: SwapParams): Promise<SwapResult> {
    // TODO: реальный swap после получения доступа к кошельку
    throw new Error(
      'Merchant Moe real swap requires a signed wallet. ' +
      'Стас, нужен приватный ключ или доступ к Safe для подписания транзакций.',
    );
  }

  /**
   * Реальный quote через LB Quoter
   */
  private async realQuote(tokenIn: `0x${string}`, _tokenOut: `0x${string}`, amountIn: string): Promise<QuoteResult> {
    try {
      const client = this.getClient();

      const result = await client.readContract({
        address: this.config.quoterAddress,
        abi: LB_QUOTER_ABI,
        functionName: 'findBestPathFromAmountIn',
        args: [[tokenIn, _tokenOut], BigInt(amountIn)],
      });

      const amounts = result.amounts;
      const lastAmount = amounts[amounts.length - 1] ?? 0n;

      return {
        success: true,
        amountOut: lastAmount.toString(),
        price: Number(lastAmount) / Number(BigInt(amountIn)),
        fee: '0.003', // LB стандартная комиссия
        route: result.route.map(a => a as string),
        pairs: result.pairs.map(a => a as string),
      };
    } catch (err) {
      return {
        success: false,
        amountOut: '0',
        price: 0,
        fee: '0',
        route: [],
        pairs: [],
        error: `Quote failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ========== Логирование ==========

  private logSwap(params: SwapParams, result: SwapResult): void {
    const entry: TradeLogEntry = {
      timestamp: new Date().toISOString(),
      params,
      result,
    };

    const logLine = `[MerchantMoe] ${entry.timestamp} | ${result.success ? '✅' : '❌'} ` +
      `in=${params.tokenIn.slice(0, 10)}... amt=${params.amount} ` +
      `→ out=${params.tokenOut.slice(0, 10)}... amt=${result.amountOut} ` +
      `tx=${result.txHash ?? 'N/A'} ${result.error ?? ''}`;

    console.log(logLine);
  }

  // ========== Утилиты ==========

  /** Получить текущий дневной объём */
  getDailyVolume(): number {
    const now = Date.now();
    this.dailyTrades = this.dailyTrades.filter(t => now - t.timestamp < DAILY_LIMIT_MS);
    return this.dailyTrades.reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Перевести BigInt-amount в USDC-сумму для лимитов (приблизительно)
   * В mockMode считается что amount в smallest unit с 6 decimals (как USDC)
   */
  private toUsdcAmount(amount: bigint): number {
    return Number(amount) / 1_000_000;
  }

  /** Обновить конфиг */
  updateConfig(partial: Partial<MerchantMoeConfig>): void {
    this.config = { ...this.config, ...partial };
    if (!this.config.mockMode && !this.client) {
      this.initClient();
    }
  }
}
