import { createWalletClient, http, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantleSepoliaTestnet } from 'viem/chains';
import { type CreditsCheckRequest, type CreditsCheckResponse, AI_CREDITS_ABI } from '../types.js';
import { type GatewayConfig, getPublicClient } from '../config.js';

/**
 * Сервис для работы с AICredits.sol on-chain через viem
 *
 * AICredits: 0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64 (Mantle Sepolia)
 * - balanceOf(address): view → читаем через publicClient
 * - spendCredits(from, amount): onlyAgent → вызываем через walletClient (если есть ключ)
 */
export class AICreditsService {
  private config: GatewayConfig;
  private walletClient: WalletClient | null = null;

  constructor(config: GatewayConfig) {
    this.config = config;
    if (config.agentPrivateKey) {
      this.initWalletClient();
    }
  }

  private initWalletClient(): void {
    if (!this.config.agentPrivateKey) return;
    const account = privateKeyToAccount(this.config.agentPrivateKey);
    this.walletClient = createWalletClient({
      account,
      chain: { ...mantleSepoliaTestnet, id: this.config.chainId },
      transport: http(this.config.mantleRpcUrl),
    });
    console.log('[AICredits] Wallet client initialized for', account.address);
  }

  /** Проверить, достаточно ли кредитов */
  async checkCredits(req: CreditsCheckRequest): Promise<CreditsCheckResponse> {
    if (this.isStubMode()) {
      return this.stubCheck(req);
    }
    return this.onChainCheck(req);
  }

  /** Списать кредиты */
  async spendCredits(from: `0x${string}`, amount: bigint): Promise<boolean> {
    if (this.isStubMode()) {
      console.log(`[AICredits:stub] spendCredits(${from}, ${amount}) → true`);
      return true;
    }
    return this.onChainSpend(from, amount);
  }

  /** Заглушка: всегда успешно */
  private stubCheck(req: CreditsCheckRequest): CreditsCheckResponse {
    return {
      ok: true,
      address: req.address,
      balance: '1000',
      required: req.amount.toString(),
      sufficient: true,
    };
  }

  private isStubMode(): boolean {
    return this.config.stubMode || process.env["AI_CREDITS_SKIP_CHECK"] === "true" ||
      this.config.aiCreditsAddress === '0x0000000000000000000000000000000000000000';
  }

  /**
   * Реальный on-chain check: вызывает balanceOf(address) через viem publicClient
   */
  private async onChainCheck(req: CreditsCheckRequest): Promise<CreditsCheckResponse> {
    try {
      const client = getPublicClient(this.config);
      const balance = await client.readContract({
        address: this.config.aiCreditsAddress,
        abi: AI_CREDITS_ABI,
        functionName: 'balanceOf',
        args: [req.address],
      }) as bigint;

      const sufficient = balance >= req.amount;
      return {
        ok: sufficient,
        address: req.address,
        balance: balance.toString(),
        required: req.amount.toString(),
        sufficient,
      };
    } catch (err) {
      console.error('[AICredits] onChainCheck failed:', err);
      return {
        ok: false,
        address: req.address,
        balance: '0',
        required: req.amount.toString(),
        sufficient: false,
      };
    }
  }

  /**
   * Реальный on-chain spend: вызывает spendCredits(from, amount) через viem walletClient
   * Если AGENT_PRIVATE_KEY не задан — логирует и возвращает true (graceful degradation)
   */
  private async onChainSpend(from: `0x${string}`, amount: bigint): Promise<boolean> {
    if (!this.walletClient) {
      console.warn('[AICredits] ⚠️ AGENT_PRIVATE_KEY not set — spendCredits skipped (graceful degradation)');
      console.warn(`[AICredits] Would spend ${amount} from ${from}`);
      return true; // Не блокируем работу, просто логируем
    }

    try {
      await this.walletClient.writeContract({
        address: this.config.aiCreditsAddress,
        abi: AI_CREDITS_ABI,
        chain: mantleSepoliaTestnet,
        account: this.walletClient.account!,
        functionName: 'spendCredits',
        args: [from, amount],
      });
      console.log(`[AICredits] ✅ spendCredits(${from}, ${amount}) — success`);
      return true;
    } catch (err) {
      console.error('[AICredits] spendCredits failed:', err);
      return false;
    }
  }
}
