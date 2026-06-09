/**
 * Agni Finance trade executor (T-TRADE-01 v2: Session Keys)
 *
 * Исполняет трейды через Agni Finance (Uniswap V3-style AMM) на Mantle Sepolia.
 * В mockMode — возвращает мок-результаты.
 * В realMode — проверяет session key через vault.checkSession(), затем вызывает vault.executeSwap().
 *
 * Flow (real mode, session keys):
 *   1. getQuote() → QuoterV2.quoteExactInputSingle() (оффчейн, read-only)
 *   2. executeSwap():
 *      a. vault.checkSession(tokenId, sessionAgent) → проверяет активную сессию
 *      b. Кодирует exactInputSingle calldata для Agni Router (recipient=vault)
 *      c. vault.executeSwap(tokenId, tokenIn, amountIn, swapData) — подписанная транзакция
 *
 * ⚠️ AGENT_PRIVATE_KEY НЕ ИСПОЛЬЗУЕТСЯ.
 *   Только session key, зарегистрированный через vault.registerSession() (EIP-712).
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantleSepoliaTestnet } from 'viem/chains';
import {
  type AgniConfig,
  type SwapParams,
  type SwapResult,
  type QuoteParams,
  type QuoteResult,
  type BalanceResult,
} from './types.js';
import {
  AGNI_SWAP_ROUTER,
  AGNI_QUOTER_V2,
  MOLE_VAULT_ADDRESS,
  SWAP_ROUTER_ABI,
  QUOTER_V2_ABI,
  MOLEVAULT_ABI,
  ERC20_ABI,
  DEFAULT_FEE_TIER,
} from './constants.js';

const DAILY_LIMIT_MS = 24 * 60 * 60 * 1000;

function fail(params: Pick<SwapParams, 'tokenIn' | 'tokenOut' | 'amount'>, error: string): SwapResult {
  return { success: false, tokenIn: params.tokenIn, tokenOut: params.tokenOut, amountIn: params.amount, amountOut: '0', price: 0, fee: '0', error };
}

function cat(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class AgniExecutor {
  private config: AgniConfig;
  private publicClient: PublicClient | null = null;
  private walletClient: WalletClient | null = null;
  private dailyTrades: { timestamp: number; amount: number }[] = [];

  constructor(config: Partial<AgniConfig> = {}) {
    this.config = {
      routerAddress: (config.routerAddress ?? AGNI_SWAP_ROUTER) as `0x${string}`,
      quoterAddress: (config.quoterAddress ?? AGNI_QUOTER_V2) as `0x${string}`,
      walletAddress: config.walletAddress ?? ('0x0000000000000000000000000000000000000000' as `0x${string}`),
      vaultAddress: config.vaultAddress ?? (MOLE_VAULT_ADDRESS as `0x${string}`),
      rpcUrl: config.rpcUrl ?? 'https://rpc.sepolia.mantle.xyz',
      chainId: config.chainId ?? 5003,
      maxTradeAmount: config.maxTradeAmount ?? 1000,
      dailyLimit: config.dailyLimit ?? 5000,
      defaultSlippage: config.defaultSlippage ?? 0.5,
      defaultFeeTier: config.defaultFeeTier ?? DEFAULT_FEE_TIER,
      deadlineSec: config.deadlineSec ?? 600,
      mockMode: config.mockMode ?? true,
      mockBalance: config.mockBalance ?? '0',
      sessionPrivateKey: config.sessionPrivateKey,
    };
    if (!this.config.mockMode) this.initClient();
  }

  private initClient(): void {
    const chain = { ...mantleSepoliaTestnet, id: this.config.chainId };
    const transport = http(this.config.rpcUrl);
    this.publicClient = createPublicClient({ chain, transport });
    if (this.config.sessionPrivateKey) {
      const account = privateKeyToAccount(this.config.sessionPrivateKey);
      this.walletClient = createWalletClient({ account, chain, transport });
    }
  }

  private getPublicClient(): PublicClient {
    if (!this.publicClient) this.initClient();
    return this.publicClient!;
  }

  private getWalletClient(): WalletClient {
    if (!this.walletClient) {
      if (!this.config.sessionPrivateKey) throw new Error('SESSION_PRIVATE_KEY not configured');
      this.initClient();
    }
    return this.walletClient!;
  }

  // ================================================================
  // Public API
  // ================================================================

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const v = this.validateSwap(params);
    if (v) return v;
    const l = this.checkLimits(params);
    if (l) return l;
    if (this.config.mockMode) return this.mockSwap(params);
    return this.realSwap(params);
  }

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    if (this.config.mockMode) return this.mockQuote(params);
    return this.realQuote(params);
  }

  async getBalance(token: `0x${string}`, owner?: `0x${string}`): Promise<BalanceResult> {
    const addr = owner ?? this.config.walletAddress;
    if (this.config.mockMode) return { token, balance: this.config.mockBalance ?? '0', decimals: 18 };
    if (token === ('0x0000000000000000000000000000000000000000' as `0x${string}`)) return this.getNativeBalance(addr);
    try {
      const client = this.getPublicClient();
      const [balance, decimals] = await Promise.all([
        client.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] }),
        client.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals', args: [] }),
      ]);
      return { token, balance: (balance as bigint).toString(), decimals: decimals as number };
    } catch (caught: unknown) {
      return { token, balance: '0', decimals: 18, error: `Balance fetch failed: ${cat(caught)}` };
    }
  }

  async checkSession(tokenId: bigint, caller?: `0x${string}`): Promise<{ active: boolean; remaining: bigint }> {
    try {
      const client = this.getPublicClient();
      const addr = caller ?? this.config.walletAddress;
      const [active, remaining] = await client.readContract({
        address: this.config.vaultAddress,
        abi: MOLEVAULT_ABI,
        functionName: 'checkSession',
        args: [tokenId, addr],
      }) as [boolean, bigint];
      return { active, remaining };
    } catch {
      return { active: false, remaining: 0n };
    }
  }

  // ================================================================
  // Validation + Limits
  // ================================================================

  private validateSwap(params: SwapParams): SwapResult | null {
    if (BigInt(params.amount) <= 0n) return fail(params, 'Invalid amount: must be > 0');
    if (!params.tokenIn || !params.tokenOut) return fail(params, 'tokenIn and tokenOut are required');
    if (params.tokenIn === params.tokenOut) return fail(params, 'tokenIn and tokenOut must be different');
    return null;
  }

  private checkLimits(params: SwapParams): SwapResult | null {
    const amt = this.config.mockMode ? Number(params.amount) / 1e6 : Number(params.amount) / 1e18;
    if (amt > this.config.maxTradeAmount) return fail(params, `Trade amount ${amt} exceeds max ${this.config.maxTradeAmount}`);
    const now = Date.now();
    this.dailyTrades = this.dailyTrades.filter(t => now - t.timestamp < DAILY_LIMIT_MS);
    const total = this.dailyTrades.reduce((s, t) => s + t.amount, 0);
    if (total + amt > this.config.dailyLimit) return fail(params, `Daily limit ${this.config.dailyLimit} exceeded (${total.toFixed(2)})`);
    return null;
  }

  // ================================================================
  // Mock
  // ================================================================

  private async mockSwap(params: SwapParams): Promise<SwapResult> {
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
    const amountIn = BigInt(params.amount);
    const rate = 1 - (params.slippage ?? this.config.defaultSlippage) / 100 + (Math.random() - 0.5) * 0.02;
    const PR = 1_000_000_000_000_000_000n;
    const amountOut = (amountIn * BigInt(Math.floor(rate * Number(PR)))) / PR;
    const feeTier = params.feeTier ?? this.config.defaultFeeTier;
    const result: SwapResult = {
      success: true,
      txHash: `0x${Array.from({length:64},()=>Math.floor(Math.random()*16).toString(16)).join('')}`,
      tokenIn: params.tokenIn, tokenOut: params.tokenOut,
      amountIn: params.amount, amountOut: amountOut.toString(), price: rate,
      fee: (feeTier / 1_000_000).toFixed(4),
    };
    this.dailyTrades.push({ timestamp: Date.now(), amount: Number(amountIn) / 1_000_000 });
    this.log(params, result);
    return result;
  }

  private async mockQuote(params: QuoteParams): Promise<QuoteResult> {
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
    const rate = 1 - this.config.defaultSlippage / 100 + (Math.random() - 0.5) * 0.01;
    const PR = 1_000_000_000_000_000_000n;
    const amountOut = (BigInt(params.amount) * BigInt(Math.floor(rate * Number(PR)))) / PR;
    const feeTier = params.feeTier ?? this.config.defaultFeeTier;
    return { success: true, amountOut: amountOut.toString(), price: rate, fee: (feeTier / 1_000_000).toFixed(4), route: [params.tokenIn, params.tokenOut] };
  }

  // ================================================================
  // Real mode (vault + session keys)
  // ================================================================

  private async realSwap(params: SwapParams): Promise<SwapResult> {
    const tokenId = params.tokenId ?? 1n;
    const agentAddr = this.config.walletAddress;

    // 1. Check session
    const session = await this.checkSession(tokenId, agentAddr);
    if (!session.active) return fail(params, 'No active session — register via vault.registerSession() first');
    const amountIn = BigInt(params.amount);
    if (session.remaining < amountIn) return fail(params, `Session limit exceeded: remaining=${session.remaining}`);

    // 2. Quote
    const feeTier = params.feeTier ?? this.config.defaultFeeTier;
    const quote = await this.realQuote({ tokenIn: params.tokenIn, tokenOut: params.tokenOut, amount: params.amount, feeTier });
    if (!quote.success) return fail(params, `Quote failed: ${quote.error ?? 'no liquidity'}`);

    // 3. Build calldata
    const slippage = params.slippage ?? this.config.defaultSlippage;
    const amountOutMin = BigInt(quote.amountOut) * BigInt(Math.floor((100 - slippage) * 100)) / 10000n;
    const deadline = BigInt(params.deadline ?? Math.floor(Date.now() / 1000) + this.config.deadlineSec);

    const swapData = encodeFunctionData({
      abi: SWAP_ROUTER_ABI, functionName: 'exactInputSingle',
      args: [{ tokenIn: params.tokenIn, tokenOut: params.tokenOut, fee: feeTier, recipient: this.config.vaultAddress, deadline, amountIn, amountOutMinimum: amountOutMin, sqrtPriceLimitX96: 0n }],
    });

    // 4. Send tx
    try {
      const wallet = this.getWalletClient();
      const txHash = await wallet.writeContract({
        address: this.config.vaultAddress, abi: MOLEVAULT_ABI, functionName: 'executeSwap',
        args: [tokenId, params.tokenIn, amountIn, swapData],
        chain: { ...mantleSepoliaTestnet, id: this.config.chainId },
        account: wallet.account ?? undefined,
      } as any);
      console.log(`[Agni] TX sent: ${txHash}`);

      let ok = true;
      try {
        const receipt = await this.getPublicClient().waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
        ok = receipt.status === 'success';
      } catch { console.log(`[Agni] TX ${txHash} pending`); }

      const result: SwapResult = {
        success: ok, txHash, tokenIn: params.tokenIn, tokenOut: params.tokenOut,
        amountIn: params.amount, amountOut: ok ? quote.amountOut : '0',
        price: ok ? quote.price : 0, fee: (feeTier / 1_000_000).toFixed(4),
        error: ok ? undefined : 'Transaction reverted',
      };
      if (ok) this.dailyTrades.push({ timestamp: Date.now(), amount: Number(amountIn) / 1e18 });
      this.log(params, result);
      return result;
    } catch (caught: unknown) {
      const e = cat(caught);
      if (e.includes('NoActiveSession') || e.includes('NotAgent')) return fail(params, 'Session revoked/expired');
      if (e.includes('SessionExpired')) return fail(params, 'Session expired');
      if (e.includes('SessionLimitExceeded')) return fail(params, 'Session limit exceeded on-chain');
      if (e.includes('InsufficientBalance')) return fail(params, 'Insufficient vault balance');
      return fail(params, `Swap failed: ${e}`);
    }
  }

  private async realQuote(params: QuoteParams): Promise<QuoteResult> {
    try {
      const client = this.getPublicClient();
      const feeTier = params.feeTier ?? this.config.defaultFeeTier;
      const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = await client.readContract({
        address: this.config.quoterAddress, abi: QUOTER_V2_ABI, functionName: 'quoteExactInputSingle',
        args: [{ tokenIn: params.tokenIn, tokenOut: params.tokenOut, amountIn: BigInt(params.amount), fee: feeTier, sqrtPriceLimitX96: params.sqrtPriceLimitX96 ?? 0n }],
      }) as [bigint, bigint, number, bigint];
      const ain = BigInt(params.amount);
      return {
        success: true, amountOut: amountOut.toString(), price: ain > 0n ? Number(amountOut) / Number(ain) : 0,
        fee: (feeTier / 1_000_000).toFixed(4), sqrtPriceX96After: sqrtPriceX96After.toString(),
        initializedTicksCrossed, gasEstimate: gasEstimate.toString(), route: [params.tokenIn, params.tokenOut],
      };
    } catch (caught: unknown) {
      return { success: false, amountOut: '0', price: 0, fee: '0', route: [], error: `Quote failed: ${cat(caught)}` };
    }
  }

  private async getNativeBalance(addr: `0x${string}`): Promise<BalanceResult> {
    try {
      const bal = await this.getPublicClient().getBalance({ address: addr });
      return { token: '0x0000000000000000000000000000000000000000', balance: bal.toString(), decimals: 18 };
    } catch (caught: unknown) {
      return { token: '0x0000000000000000000000000000000000000000', balance: '0', decimals: 18, error: `Native balance failed: ${cat(caught)}` };
    }
  }

  private log(params: SwapParams, result: SwapResult): void {
    console.log(`[Agni] ${new Date().toISOString()} | ${result.success ? '✅' : '❌'} tokenId=${params.tokenId ?? 'n/a'} in=${params.tokenIn.slice(0,10)}... amt=${params.amount} → out=${params.tokenOut.slice(0,10)}... amt=${result.amountOut} tx=${result.txHash ?? 'N/A'} ${result.error ?? ''}`);
  }

  getDailyVolume(): number {
    const now = Date.now();
    this.dailyTrades = this.dailyTrades.filter(t => now - t.timestamp < DAILY_LIMIT_MS);
    return this.dailyTrades.reduce((s, t) => s + t.amount, 0);
  }

  getVaultAddress(): `0x${string}` { return this.config.vaultAddress; }

  updateConfig(partial: Partial<AgniConfig>): void {
    this.config = { ...this.config, ...partial };
    if (!this.config.mockMode && !this.publicClient) this.initClient();
  }
}
