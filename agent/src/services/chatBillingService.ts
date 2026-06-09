/**
 * chatBillingService — верификация off-chain оплаты чата
 *
 * Пользователь:
 *   1. transfer(agentWallet, 0.001 MNT) → txHash
 *   2. Подписывает EIP-712: { tokenId, message, txHash, timestamp }
 *   3. Шлёт агенту { signature, message, txHash, tokenId }
 *
 * Агент верифицирует 6 условий строго по порядку:
 *   1. recoverAddress == ownerOf(tokenId)     → NotTokenOwner
 *   2. tx.to == agentWallet                   → WrongRecipient
 *   3. tx.from == ownerOf(tokenId)            → WrongSender
 *   4. tx.value >= CHAT_FEE                   → InsufficientFee
 *   5. tx.timestamp > now - 10min             → TxTooOld
 *   6. txHash НЕ использован (атомарно)       → TxAlreadyUsed
 *
 * Шаг 6 атомарный (checkAndAdd) — double-spend невозможен.
 */

import { createPublicClient, http, recoverTypedDataAddress } from 'viem';
import type { Chain } from 'viem';
import type { AppConfig } from '../config.js';
import type { ChatPaymentPayload, ChatPaymentResult } from '../types.js';
import { chatPaymentTypes, chatPaymentPrimaryType } from '../types.js';
import { CompositeNonceStore } from './nonceStore.js';

/** Mantle Sepolia chain definition */
const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.sepolia.mantle.xyz'] } },
  blockExplorers: {
    default: { name: 'Mantlescan', url: 'https://sepolia.mantlescan.xyz' },
  },
} as const satisfies Chain;

export class ChatBillingService {
  private config: AppConfig;
  private client: ReturnType<typeof createPublicClient>;
  private nonceStore: CompositeNonceStore;

  constructor(config: AppConfig) {
    this.config = config;
    this.client = createPublicClient({
      chain: mantleSepolia,
      transport: http(config.rpcUrl),
    });
    this.nonceStore = new CompositeNonceStore(config);
  }

  /**
   * Основная точка входа — верификация платежа за чат.
   * Проверки выполняются строго последовательно (дешёвые сначала).
   * Шаг 6 атомарный — double-spend невозможен.
   */
  async verifyChatPayment(payload: ChatPaymentPayload): Promise<ChatPaymentResult> {
    // ── 1. Восстановить подписанта из EIP-712 ──
    const signerResult = await this.recoverSigner(payload);
    if (!signerResult.valid) return signerResult;

    const signer = (signerResult as { valid: true; address: `0x${string}` }).address;

    // Проверить что signer == ownerOf(tokenId)
    const ownerResult = await this.checkTokenOwner(payload.tokenId, signer);
    if (!ownerResult.valid) return ownerResult;

    // ── 2-5. Верификация on-chain транзакции ──
    const txResult = await this.verifyTransaction(payload.txHash, signer, payload.timestamp);
    if (!txResult.valid) return txResult;

    // ── 6. Атомарная проверка + отметка txHash ──
    // checkAndAdd — одна операция, TOCTOU невозможен
    const added = await this.nonceStore.checkAndAdd(payload.txHash);
    if (!added) {
      return {
        valid: false,
        error: 'TxAlreadyUsed',
        detail: `txHash ${payload.txHash} уже использован`,
      };
    }

    return {
      valid: true,
      tokenId: payload.tokenId,
      message: payload.message,
      signer,
    };
  }

  /**
   * Шаг 1: восстановить подписавшего из EIP-712 подписи
   */
  private async recoverSigner(
    payload: ChatPaymentPayload
  ): Promise<{ valid: true; address: `0x${string}` } | ChatPaymentResult> {
    try {
      const address = await recoverTypedDataAddress({
        domain: this.config.eip712Domain,
        types: chatPaymentTypes,
        primaryType: chatPaymentPrimaryType,
        message: {
          tokenId: payload.tokenId,
          message: payload.message,
          txHash: payload.txHash,
          timestamp: payload.timestamp,
        },
        signature: payload.signature,
      });
      return { valid: true, address } as const;
    } catch (err) {
      return {
        valid: false,
        error: 'NotTokenOwner',
        detail: `Не удалось восстановить адрес из подписи: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Шаг 1b: проверить что signer == ownerOf(tokenId)
   */
  private async checkTokenOwner(
    tokenId: bigint,
    signer: `0x${string}`
  ): Promise<ChatPaymentResult> {
    try {
      const owner = await this.readOwnerOf(tokenId);
      if (owner.toLowerCase() !== signer.toLowerCase()) {
        return {
          valid: false,
          error: 'NotTokenOwner',
          detail: `signer=${signer}, owner=${owner}`,
        };
      }
      return { valid: true, error: '' as never } as unknown as ChatPaymentResult;
    } catch (err) {
      return {
        valid: false,
        error: 'NotTokenOwner',
        detail: `Ошибка ownerOf(${tokenId}): ${(err as Error).message}`,
      };
    }
  }

  /**
   * Вызов ownerOf на контракте (публичный для session-верификации FE-24)
   */
  async readOwnerOf(tokenId: bigint): Promise<`0x${string}`> {
    return await this.client.readContract({
      address: this.config.contractAddress,
      abi: [{
        type: 'function',
        name: 'ownerOf',
        inputs: [{ type: 'uint256', name: 'tokenId' }],
        outputs: [{ type: 'address', name: 'owner' }],
        stateMutability: 'view',
      }],
      functionName: 'ownerOf',
      args: [tokenId],
    });
  }

  /**
   * Шаги 2-5: верификация on-chain транзакции + проверка подписи
   */
  private async verifyTransaction(
    txHash: `0x${string}`,
    expectedSender: `0x${string}`,
    signatureTimestamp: bigint,
  ): Promise<ChatPaymentResult> {
    let tx;
    try {
      tx = await this.client.getTransaction({ hash: txHash });
    } catch (err) {
      return {
        valid: false,
        error: 'WrongRecipient',
        detail: `Транзакция не найдена: ${(err as Error).message}`,
      };
    }

    // Шаг 2: tx.to == agentWallet
    if (!tx.to || tx.to.toLowerCase() !== this.config.agentWallet.toLowerCase()) {
      return {
        valid: false,
        error: 'WrongRecipient',
        detail: `tx.to=${tx.to}, expected=${this.config.agentWallet}`,
      };
    }

    // Шаг 3: tx.from == ownerOf(tokenId)
    if (tx.from.toLowerCase() !== expectedSender.toLowerCase()) {
      return {
        valid: false,
        error: 'WrongSender',
        detail: `tx.from=${tx.from}, expected=${expectedSender}`,
      };
    }

    // Шаг 4: tx.value >= CHAT_FEE
    if (tx.value < this.config.chatFee) {
      return {
        valid: false,
        error: 'InsufficientFee',
        detail: `tx.value=${tx.value}, required=${this.config.chatFee}`,
      };
    }

    // Шаг 5: tx.timestamp + signature timestamp > now - 10min
    let txTime: number;
    try {
      // Проверка: если транзакция ещё pending (не замайнена) — отклоняем
      if (!tx.blockHash) {
        return {
          valid: false,
          error: 'TxTooOld',
          detail: 'transaction still pending (no blockHash)',
        };
      }
      const block = await this.client.getBlock({ blockHash: tx.blockHash });
      txTime = Number(block.timestamp);
    } catch (err) {
      return {
        valid: false,
        error: 'TxTooOld',
        detail: `Не удалось прочитать блок: ${(err as Error).message}`,
      };
    }

    // Проверка возраста on-chain транзакции
    const now = Math.floor(Date.now() / 1000);
    const maxAge = this.config.txMaxAgeSec;

    if (now - txTime > maxAge) {
      return {
        valid: false,
        error: 'TxTooOld',
        detail: `txTime=${txTime}, now=${now}, maxAge=${maxAge}s`,
      };
    }

    // Defence-in-depth: проверка что подпись тоже свежая
    const sigTime = Number(signatureTimestamp);
    if (sigTime > 0 && now - sigTime > maxAge) {
      return {
        valid: false,
        error: 'TxTooOld',
        detail: `signature timestamp=${sigTime} older than maxAge=${maxAge}s`,
      };
    }

    // Все проверки прошли
    return { valid: true, error: '' as never } as unknown as ChatPaymentResult;
  }

  /** Закрыть соединения */
  async close(): Promise<void> {
    await this.nonceStore.close();
  }
}
