/**
 * Тесты ChatRouter (FR-002)
 *
 * Покрытие:
 * - Happy path → { ok: true, reply, mood, tokenId }
 * - Каждая billing-ошибка → корректный errorCode
 * - Invalid JSON / missing fields
 * - GET /api/chat/history
 * - GET /api/chat/health
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatRouter } from '../src/api/chatRouter.js';
import type { AppConfig } from '../src/config.js';
import type {
  ChatRequest,
  ChatSuccessResponse,
  ChatErrorResponse,
  ChatHistoryResponse,
} from '../src/types.js';

// ── Константы ──

const OWNER_ADDR = '0x1234567890123456789012345678901234567890' as `0x${string}`;
const AGENT_WALLET = '0xABABABABABABABABABABABABABABABABABABABAB' as `0x${string}`;
const CONTRACT_ADDR = '0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb' as `0x${string}`;
const TX_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
const CHAT_FEE_WEI = 1000000000000000n;
const TX_TIMESTAMP = Math.floor(Date.now() / 1000) - 60;
const BLOCK_HASH = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`;

// ── Моки ──

// Мок для billing service (весь verifyChatPayment)
vi.mock('../src/services/chatBillingService.js', () => ({
  ChatBillingService: vi.fn(() => ({
    verifyChatPayment: vi.fn(),
    close: vi.fn(),
  })),
}));

// Мок для mood service
vi.mock('../src/services/chatMoodService.js', () => ({
  ChatMoodService: vi.fn(() => ({
    getMoleData: vi.fn(),
    generateReply: vi.fn(),
  })),
}));

// Import моков после vi.mock
const { ChatBillingService } = await import('../src/services/chatBillingService.js');
const { ChatMoodService } = await import('../src/services/chatMoodService.js');

// ── Helpers ──

function makeConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    contractAddress: CONTRACT_ADDR,
    agentWallet: AGENT_WALLET,
    rpcUrl: 'https://rpc.sepolia.mantle.xyz',
    chainId: 5003,
    chatFee: CHAT_FEE_WEI,
    txMaxAgeSec: 600,
    redisTtlSec: 86400,
    sqlitePath: ':memory:',
    eip712Domain: { name: 'MolebotChat', version: '1', chainId: 5003 },
    githubRepo: 'StasPodyachev/molebot_mantle',
    ...overrides,
  };
}

function makeChatReq(overrides?: Partial<ChatRequest>): ChatRequest {
  return {
    signature: '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001b' as `0x${string}`,
    message: 'Привет, крот!',
    txHash: TX_HASH,
    tokenId: 1,
    timestamp: Math.floor(Date.now() / 1000) - 30,
    ...overrides,
  };
}

/** Выполнить HTTP-запрос к роутеру */
async function request(
  router: ChatRouter,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Преобразуем Fetch Request → Node IncomingMessage
  const nodeReq = {
    method,
    url: path,
    headers: Object.fromEntries(req.headers.entries()),
    on: (event: string, cb: (chunk?: Buffer) => void) => {
      if (event === 'data' && body) {
        cb(Buffer.from(JSON.stringify(body)));
      }
      if (event === 'end') cb();
    },
  } as unknown as import('node:http').IncomingMessage;

  let status = 0;
  let data: unknown;
  const nodeRes = {
    writeHead: (s: number) => { status = s; },
    end: (d: string) => { data = JSON.parse(d); },
    setHeader: () => {},
    getHeader: () => undefined,
  } as unknown as import('node:http').ServerResponse;

  await router.handle(nodeReq, nodeRes);
  return { status, data };
}

// ── Тесты ──

describe('ChatRouter — FR-002', () => {
  let router: ChatRouter;
  let mockVerify: ReturnType<typeof vi.fn>;
  let mockGetMoleData: ReturnType<typeof vi.fn>;
  let mockGenerateReply: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new ChatRouter(makeConfig());

    // Получаем ссылки на мокированные методы
    const billingInstance = (ChatBillingService as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    const moodInstance = (ChatMoodService as ReturnType<typeof vi.fn>).mock.results[0]?.value;

    // Если results[0] нет (новый инстанс) — перехватываем конструктор
    mockVerify = billingInstance?.verifyChatPayment ?? vi.fn();
    mockGetMoleData = moodInstance?.getMoleData ?? vi.fn();
    mockGenerateReply = moodInstance?.generateReply ?? vi.fn();
  });

  afterEach(async () => {
    await router.close();
  });

  // ── Happy path ──

  it('POST /api/chat — happy path (billing OK → mood → reply)', async () => {
    mockVerify.mockResolvedValue({ valid: true, tokenId: 1n, message: 'Привет, крот!' });
    mockGetMoleData.mockResolvedValue({ mood: 1, levelIndex: 2, cumulativePnl: 500n, isMythic: false });
    mockGenerateReply.mockReturnValue('Принято. Мой ответ: Привет, крот! [Lv2]');

    const { status, data } = await request(router, 'POST', '/api/chat', makeChatReq());

    expect(status).toBe(200);
    const resp = data as ChatSuccessResponse;
    expect(resp.ok).toBe(true);
    expect(resp.mood).toBe(1);
    expect(resp.tokenId).toBe(1);
    expect(resp.reply).toContain('Привет, крот!');
  });

  it('POST /api/chat — happy path with mood=2 (дерзкий)', async () => {
    mockVerify.mockResolvedValue({ valid: true, tokenId: 2n, message: 'Как дела?' });
    mockGetMoleData.mockResolvedValue({ mood: 2, levelIndex: 5, cumulativePnl: 2000n, isMythic: true });
    mockGenerateReply.mockReturnValue('О, ещё один гений со своим «глубоким» вопросом. Лады: Как дела? ✨ [Lv5]');

    const { status, data } = await request(router, 'POST', '/api/chat', makeChatReq({ tokenId: 2 }));

    expect(status).toBe(200);
    const resp = data as ChatSuccessResponse;
    expect(resp.ok).toBe(true);
    expect(resp.mood).toBe(2);
    expect(resp.tokenId).toBe(2);
  });

  // ── Billing ошибки → корректные errorCode ──

  const errorCases = [
    { error: 'NotTokenOwner' as const },
    { error: 'WrongRecipient' as const },
    { error: 'WrongSender' as const },
    { error: 'InsufficientFee' as const },
    { error: 'TxTooOld' as const },
    { error: 'TxAlreadyUsed' as const },
  ];

  for (const { error } of errorCases) {
    it(`POST /api/chat — billing error ${error} → errorCode ${error}`, async () => {
      mockVerify.mockResolvedValue({ valid: false, error, detail: `${error}: test detail` });

      const { status, data } = await request(router, 'POST', '/api/chat', makeChatReq());

      expect(status).toBe(402);
      const resp = data as ChatErrorResponse;
      expect(resp.ok).toBe(false);
      expect(resp.errorCode).toBe(error);
      expect(resp.errorMessage).toContain(error);
    });
  }

  // ── Валидация входа ──

  it('POST /api/chat — invalid JSON returns 400', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{{{',
    });

    const nodeReq = {
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      on: (event: string, cb: (chunk?: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from('not json{{{'));
        if (event === 'end') cb();
      },
    } as unknown as import('node:http').IncomingMessage;

    let status = 0;
    let data: unknown;
    const nodeRes = {
      writeHead: (s: number) => { status = s; },
      end: (d: string) => { data = JSON.parse(d); },
      setHeader: () => {},
      getHeader: () => undefined,
    } as unknown as import('node:http').ServerResponse;

    await router.handle(nodeReq, nodeRes);

    expect(status).toBe(400);
    const resp = data as ChatErrorResponse;
    expect(resp.ok).toBe(false);
  });

  it('POST /api/chat — missing fields returns 400', async () => {
    const { status, data } = await request(router, 'POST', '/api/chat', {
      signature: '0x...', // missing message, txHash, tokenId, timestamp
    });

    expect(status).toBe(400);
    const resp = data as ChatErrorResponse;
    expect(resp.ok).toBe(false);
    expect(resp.errorMessage).toContain('message');
    expect(resp.errorMessage).toContain('tokenId');
    expect(resp.errorMessage).not.toContain('txHash'); // txHash проверяется только вне DEMO_MODE
  });

  it('POST /api/chat — empty body returns 400', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });

    const nodeReq = {
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      on: (event: string, cb: (chunk?: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from(''));
        if (event === 'end') cb();
      },
    } as unknown as import('node:http').IncomingMessage;

    let status = 0;
    let data: unknown;
    const nodeRes = {
      writeHead: (s: number) => { status = s; },
      end: (d: string) => { data = JSON.parse(d); },
      setHeader: () => {},
      getHeader: () => undefined,
    } as unknown as import('node:http').ServerResponse;

    await router.handle(nodeReq, nodeRes);

    expect(status).toBe(400);
  });

  // ── History ──

  it('GET /api/chat/history — returns entries (or empty)', async () => {
    const { status, data } = await request(router, 'GET', '/api/chat/history?tokenId=1');

    expect(status).toBe(200);
    const resp = data as ChatHistoryResponse;
    expect(resp).toHaveProperty('entries');
    expect(resp.tokenId).toBe(1);
  });

  it('GET /api/chat/history — missing tokenId returns 400', async () => {
    const { status, data } = await request(router, 'GET', '/api/chat/history');

    expect(status).toBe(400);
    const resp = data as { error: string };
    expect(resp.error).toBe('missing_tokenId');
  });

  it('GET /api/chat/history — invalid tokenId returns 400', async () => {
    const { status } = await request(router, 'GET', '/api/chat/history?tokenId=abc');

    expect(status).toBe(400);
  });

  // ── Health ──

  it('GET /api/chat/health returns 200', async () => {
    const { status, data } = await request(router, 'GET', '/api/chat/health');

    expect(status).toBe(200);
    const resp = data as { status: string };
    expect(resp.ok).toBe(true);
  });

  // ── 404 ──

  it('unknown route returns 404', async () => {
    const { status } = await request(router, 'GET', '/api/nonexistent');

    expect(status).toBe(404);
  });
});
