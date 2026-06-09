/**
 * Тесты chatBillingService
 * Покрытие: все 6 ошибок + happy path + порядок проверок + атомарный nonce
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted — создаём refs на уровне hoisting, ДО vi.mock
// ---------------------------------------------------------------------------

const { mockClientRef, mockNonceRef, mockRecoverRef } = vi.hoisted(() => {
  type MockClient = {
    readContract: ReturnType<typeof vi.fn>;
    getTransaction: ReturnType<typeof vi.fn>;
    getBlock: ReturnType<typeof vi.fn>;
  };
  return {
    mockClientRef: { current: null as MockClient | null },
    mockNonceRef: { current: null as { checkAndAdd: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } | null },
    mockRecoverRef: { current: null as ReturnType<typeof vi.fn> | null },
  };
});

vi.mock('viem', async () => {
  const client = {
    readContract: vi.fn(),
    getTransaction: vi.fn(),
    getBlock: vi.fn(),
  };
  mockClientRef.current = client;

  const recoverFn = vi.fn();
  mockRecoverRef.current = recoverFn;

  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => client),
    recoverTypedDataAddress: recoverFn,
  };
});

vi.mock('../src/services/nonceStore.js', () => {
  const store = { checkAndAdd: vi.fn(), close: vi.fn() };
  mockNonceRef.current = store;
  return { CompositeNonceStore: vi.fn(() => store) };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ChatBillingService } from '../src/services/chatBillingService.js';
import type { AppConfig } from '../src/config.js';

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------

const OWNER_ADDR    = '0x1234567890123456789012345678901234567890' as const;
const WRONG_ADDR    = '0xDEADBEAFDEADBEAFDEADBEAFDEADBEAFDEADBEAF' as const;
const AGENT_WALLET  = '0xABABABABABABABABABABABABABABABABABABABAB' as const;
const TX_HASH       = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const CHAT_FEE_WEI  = 1000000000000000n;

function makeConfig(agentWallet?: string): AppConfig {
  return {
    contractAddress: '0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb' as `0x${string}`,
    agentWallet: (agentWallet ?? AGENT_WALLET) as `0x${string}`,
    rpcUrl: 'https://rpc.sepolia.mantle.xyz',
    chainId: 5003,
    chatFee: CHAT_FEE_WEI,
    txMaxAgeSec: 600,
    redisTtlSec: 86400,
    sqlitePath: ':memory:',
    eip712Domain: { name: 'MolebotChat', version: '1', chainId: 5003 },
  };
}

function payload(opts?: Partial<{
  message: string;
  tokenId: bigint;
  timestamp: bigint;
}>): Parameters<ChatBillingService['verifyChatPayment']>[0] {
  return {
    signature: '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001b' as `0x${string}`,
    message: 'Hello, mole!',
    txHash: TX_HASH as `0x${string}`,
    tokenId: 1n,
    timestamp: BigInt(Math.floor(Date.now() / 1000) - 30),
    ...opts,
  };
}

function mockTx(opts?: Partial<{
  to: `0x${string}` | null;
  from: `0x${string}`;
  value: bigint;
  blockHash: `0x${string}` | null;
}>) {
  return {
    to: AGENT_WALLET as `0x${string}`,
    from: OWNER_ADDR as `0x${string}`,
    value: CHAT_FEE_WEI,
    blockHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
    ...opts,
  };
}

// ---------------------------------------------------------------------------
// Тесты
// ---------------------------------------------------------------------------

describe('ChatBillingService', () => {
  let service: ChatBillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    // По умолчанию recoverTypedDataAddress возвращает OWNER_ADDR
    // Конкретные тесты могут переопределить
    if (mockRecoverRef.current) {
      mockRecoverRef.current.mockResolvedValue(OWNER_ADDR);
    }
    service = new ChatBillingService(makeConfig());
  });

  afterEach(async () => {
    await service.close();
  });

  it('должен пройти верификацию (happy path)', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx());
    c.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor(Date.now() / 1000) - 60) });
    mockNonceRef.current!.checkAndAdd.mockResolvedValue(true);
    const result = await service.verifyChatPayment(payload());
    expect(result).toEqual({ valid: true, tokenId: 1n, message: 'Hello, mole!', signer: OWNER_ADDR });
    expect(mockNonceRef.current!.checkAndAdd).toHaveBeenCalledWith(TX_HASH);
  });

  it('NotTokenOwner — ownerOf не совпадает', async () => {
    mockClientRef.current!.readContract.mockResolvedValue(WRONG_ADDR);
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'NotTokenOwner' });
  });

  it('NotTokenOwner — ownerOf падает', async () => {
    mockClientRef.current!.readContract.mockRejectedValue(new Error('nonexistent token'));
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'NotTokenOwner' });
  });

  it('WrongRecipient — tx.to не agentWallet', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx({ to: WRONG_ADDR as `0x${string}` }));
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'WrongRecipient' });
  });

  it('WrongRecipient — tx.to === null', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx({ to: null }));
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'WrongRecipient' });
  });

  it('WrongSender — tx.from != signer', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx({ from: WRONG_ADDR as `0x${string}` }));
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'WrongSender' });
  });

  it('InsufficientFee — value < CHAT_FEE', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx({ value: CHAT_FEE_WEI - 1n }));
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'InsufficientFee' });
  });

  it('TxTooOld — транзакция старше 10 минут', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx());
    c.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor(Date.now() / 1000) - 3600) });
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'TxTooOld' });
  });

  it('TxTooOld — транзакция pending (нет blockHash)', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx({ blockHash: null }));
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'TxTooOld' });
  });

  it('TxTooOld — timestamp подписи старше 10 минут', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx());
    c.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor(Date.now() / 1000) - 60) });
    const result = await service.verifyChatPayment(
      payload({ timestamp: BigInt(Math.floor(Date.now() / 1000) - 3600) })
    );
    expect(result).toMatchObject({ valid: false, error: 'TxTooOld' });
  });

  it('TxAlreadyUsed — checkAndAdd вернул false', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx());
    c.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor(Date.now() / 1000) - 60) });
    mockNonceRef.current!.checkAndAdd.mockResolvedValue(false);
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'TxAlreadyUsed' });
  });

  it('Порядок: подпись ДО запроса транзакции', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockRejectedValue(new Error('fail fast'));
    c.getTransaction.mockRejectedValue(new Error('should not be called'));
    await service.verifyChatPayment(payload());
    expect(c.readContract).toHaveBeenCalledTimes(1);
    expect(c.getTransaction).not.toHaveBeenCalled();
  });

  it('Порядок: nonce ПОСЛЕ проверки транзакции', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockResolvedValue(mockTx());
    c.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor(Date.now() / 1000) - 60) });
    mockNonceRef.current!.checkAndAdd.mockResolvedValue(false);
    await service.verifyChatPayment(payload());
    expect(c.getTransaction).toHaveBeenCalled();
    expect(mockNonceRef.current!.checkAndAdd).toHaveBeenCalledTimes(1);
  });

  it('NotTokenOwner — recoverTypedDataAddress падает', async () => {
    mockRecoverRef.current!.mockRejectedValue(new Error('invalid signature length'));
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'NotTokenOwner' });
  });

  it('WrongRecipient — getTransaction падает', async () => {
    const c = mockClientRef.current!;
    c.readContract.mockResolvedValue(OWNER_ADDR);
    c.getTransaction.mockRejectedValue(new Error('not found'));
    const result = await service.verifyChatPayment(payload());
    expect(result).toMatchObject({ valid: false, error: 'WrongRecipient' });
  });
});
