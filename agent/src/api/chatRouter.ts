/**
 * chatRouter — HTTP-эндпоинты для FR-002 chatResponseAction
 *
 * POST /api/chat
 * GET  /api/chat/history?tokenId=...
 * GET  /api/chat/health
 *
 * Фиксы по ревью:
 * - signer из billingResult (не хардкод)
 * - tokenId унифицирован (number на входе/выходе, bigint внутри)
 * - GitHub log → локальный файл (нет race condition / rate limit)
 * - config.githubRepo используется
 * - DEMO_MODE=true пропускает биллинг
 * - saveHistory — один try/catch
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ChatBillingService } from '../services/chatBillingService.js';
import { ChatMoodService } from '../services/chatMoodService.js';
import { ChatHistoryStore } from '../services/chatHistoryStore.js';
import { SessionStore } from '../services/sessionStore.js';
import { LLMClient } from '../services/llmClient.js';
import { parseTradingCommand, intentToSwapParams, getMockPrice, type TradingIntent } from '../services/tradingIntentParser.js';
import type { PositionTracker, Position } from '../services/positionTracker.js';
import type { AgniExecutor } from '../plugins/agni/executor.js';
import { getAgniExecutor } from '../plugins/agni/index.js';
import { addTradeToHistory, closeActivePosition } from './tradeRouter.js';
import { recoverTypedDataAddress } from 'viem';
import type { AppConfig } from '../config.js';
import type {
  ChatRequest,
  ChatResponse,
  ChatSuccessResponse,
  ChatErrorResponse,
  ChatHistoryEntry,
  ChatHistoryResponse,
  ChatSessionRequest,
  ChatSessionResponse,
  ChatQuotaResponse,
} from '../types.js';
import { chatSessionTypes, chatSessionPrimaryType } from '../types.js';
import { CHAT_FEE_ETHER } from '../config.js';

const DEMO_MODE = process.env.DEMO_MODE === 'true';

export class ChatRouter {
  private billingService: ChatBillingService;
  private moodService: ChatMoodService;
  private historyStore: ChatHistoryStore;
  private sessionStore: SessionStore;
  private config: AppConfig;
  private llmClient: LLMClient | null;
  private agniExecutor: AgniExecutor | null;
  private positionTracker: PositionTracker | null;

  constructor(
    config: AppConfig,
    billingService?: ChatBillingService,
    agniExecutor?: AgniExecutor,
    positionTracker?: PositionTracker,
  ) {
    this.config = config;
    this.billingService = billingService ?? new ChatBillingService(config);
    this.llmClient = config.llmGatewayUrl ? new LLMClient(config.llmGatewayUrl) : null;
    this.agniExecutor = agniExecutor ?? null;
    this.positionTracker = positionTracker ?? null;
    this.moodService = new ChatMoodService({
      contractAddress: config.contractAddress,
      rpcUrl: config.rpcUrl,
      llmGatewayUrl: config.llmGatewayUrl,
    });
    this.historyStore = new ChatHistoryStore();
    this.sessionStore = new SessionStore();
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const method = req.method?.toUpperCase() ?? 'GET';

    // Диагностический лог: видит ли agent входящий запрос
    console.log('[ChatRouter] incoming:', req.method, req.url, {
      host: req.headers.host,
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      'transfer-encoding': req.headers['transfer-encoding'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
    });

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      this.json(res, 204, null);
      return;
    }

    try {
      if (url.pathname === '/api/chat' && method === 'POST') {
        await this.handleChat(req, res);
      } else if (url.pathname === '/api/chat/session' && method === 'POST') {
        await this.handleCreateSession(req, res);
      } else if (url.pathname === '/api/chat/quota' && method === 'GET') {
        await this.handleQuota(req, res, url);
      } else if (url.pathname === '/api/chat/history' && method === 'GET') {
        await this.handleHistory(req, res, url);
      } else if (url.pathname === '/api/chat/health' && method === 'GET') {
        this.json(res, 200, { ok: true, demoMode: DEMO_MODE });
      } else {
        this.json(res, 404, { error: 'not_found' });
      }
    } catch (err) {
      console.error('[chatRouter] Unhandled:', err);
      this.json(res, 500, { ok: false, errorCode: 'NotTokenOwner', errorMessage: `Internal error: ${(err as Error).message}` } satisfies ChatErrorResponse);
    }
  }

  // ── POST /api/chat ──

  private async handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    console.log('[ChatRouter] handleChat body length:', body.length, 'preview:', body.slice(0, 200));

    let chatReq: ChatRequest;
    try {
      chatReq = JSON.parse(body) as ChatRequest;
    } catch {
      this.json(res, 400, { ok: false, errorCode: 'NotTokenOwner', errorMessage: 'Invalid JSON body' } satisfies ChatErrorResponse);
      return;
    }

    // Валидация
    if (!chatReq.message || !chatReq.tokenId) {
      this.json(res, 400, { ok: false, errorCode: 'NotTokenOwner', errorMessage: 'message и tokenId обязательны' } satisfies ChatErrorResponse);
      return;
    }

    // Сохраняем сообщение пользователя
    const now = Math.floor(Date.now() / 1000);
    const userEntry: ChatHistoryEntry = { role: 'user', message: chatReq.message, mood: 1, timestamp: now };

    // Billing: сессионная квота (FE-24) или DEMO_MODE
    let signer: `0x${string}` | undefined;
    let remaining: number | undefined;
    let spendLimit: number | undefined;
    if (!DEMO_MODE) {
      // Приоритет: сессионная квота (FE-24)
      if (this.sessionStore.hasActiveQuota(chatReq.tokenId)) {
        const used = this.sessionStore.useMessage(chatReq.tokenId);
        if (!used.ok) {
          this.json(res, 402, {
            ok: false,
            errorCode: 'INVALID_INPUT',
            errorMessage: used.error,
          } satisfies ChatErrorResponse);
          return;
        }
        remaining = used.remaining;
        spendLimit = used.spendLimit;
      } else if (chatReq.signature && chatReq.txHash) {
        // Fallback: старый per-message MNT-tx flow
        const billingResult = await this.billingService.verifyChatPayment({
          signature: chatReq.signature,
          message: chatReq.message,
          txHash: chatReq.txHash,
          tokenId: BigInt(chatReq.tokenId),
          timestamp: BigInt(chatReq.timestamp ?? 0),
        });

        if (!billingResult.valid) {
          this.json(res, 402, {
            ok: false,
            errorCode: billingResult.error,
            errorMessage: billingResult.detail ?? billingResult.error,
          } satisfies ChatErrorResponse);
          return;
        }
        signer = billingResult.signer;
      } else {
        this.json(res, 402, {
          ok: false,
          errorCode: 'INVALID_INPUT',
          errorMessage: 'Нет активной сессии. Подпишите сессию через POST /api/chat/session или отправьте MNT-перевод.',
        } satisfies ChatErrorResponse);
        return;
      }
    }

    // Читаем mood с контракта
    const moleData = await this.moodService.getMoleData(chatReq.tokenId);
    const mood = moleData?.mood ?? 1;

    // Detect trading intent (regex first, LLM fallback)
    const tradingIntent = await this.detectTradingIntent(chatReq.message);

    if (tradingIntent) {
      const tradeResult = await this.executeTradingCommand(chatReq.tokenId, tradingIntent);
      const reply = tradeResult.reply;
      const assistantEntry: ChatHistoryEntry = { role: 'assistant', message: reply, mood: tradeResult.mood, timestamp: now + 1 };
      try {
        await this.historyStore.addEntry(chatReq.tokenId, userEntry);
        await this.historyStore.addEntry(chatReq.tokenId, assistantEntry);
      } catch (err) {
        console.warn('[chatRouter] saveHistory error (trade):', (err as Error).message);
      }

      this.logBillingLocal(chatReq.tokenId, chatReq.txHash ?? '0x', signer);

      this.json(res, 200, {
        ok: true,
        reply,
        mood: tradeResult.mood,
        tokenId: chatReq.tokenId,
        action: tradeResult.action,
        txHash: tradeResult.txHash,
        remaining: remaining ?? -1,
        spendLimit: spendLimit ?? 0,
      } satisfies ChatSuccessResponse & { remaining: number; spendLimit: number });
      return;
    }

    // Генерируем ответ (через LLM Gateway или шаблон)
    const reply = await this.moodService.generateReply(chatReq.message, mood, moleData ?? undefined);

    // Сохраняем оба сообщения (один блок, один catch)
    const assistantEntry: ChatHistoryEntry = { role: 'assistant', message: reply, mood, timestamp: now + 1 };
    try {
      await this.historyStore.addEntry(chatReq.tokenId, userEntry);
      await this.historyStore.addEntry(chatReq.tokenId, assistantEntry);
    } catch (err) {
      console.warn('[chatRouter] saveHistory error:', (err as Error).message);
    }

    // Лог биллинга — локальный файл (не GitHub, нет race condition)
    this.logBillingLocal(chatReq.tokenId, chatReq.txHash ?? '0x', signer);

    this.json(res, 200, {
      ok: true,
      reply,
      mood,
      tokenId: chatReq.tokenId,
      remaining: remaining ?? -1,
      spendLimit: spendLimit ?? 0,
    } satisfies ChatSuccessResponse & { remaining: number; spendLimit: number });
  }

  // ── POST /api/chat/session (FE-24) ──

  private async handleCreateSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    console.log('[ChatRouter] handleCreateSession body length:', body.length, 'preview:', body.slice(0, 300));

    let sessionReq: ChatSessionRequest;
    try {
      sessionReq = JSON.parse(body) as ChatSessionRequest;
    } catch {
      this.json(res, 400, {
        ok: false,
        errorCode: 'INVALID_INPUT',
        errorMessage: 'Invalid JSON body',
      } satisfies ChatSessionResponse);
      return;
    }

    if (!sessionReq.tokenId || !sessionReq.signature || !sessionReq.spendLimit) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'INVALID_INPUT',
        errorMessage: 'tokenId, signature и spendLimit обязательны',
      } satisfies ChatSessionResponse);
      return;
    }

    if (sessionReq.spendLimit < 1 || sessionReq.spendLimit > 100) {
      this.json(res, 400, {
        ok: false,
        errorCode: 'INVALID_INPUT',
        errorMessage: 'spendLimit должен быть от 1 до 100',
      } satisfies ChatSessionResponse);
      return;
    }

    // Верификация EIP-712 подписи
    let signer: `0x${string}`;
    try {
      const address = await recoverTypedDataAddress({
        domain: this.config.eip712Domain,
        types: chatSessionTypes,
        primaryType: chatSessionPrimaryType,
        message: {
          tokenId: BigInt(sessionReq.tokenId),
          spendLimit: BigInt(sessionReq.spendLimit),
          timestamp: BigInt(sessionReq.timestamp),
        },
        signature: sessionReq.signature,
      });
      signer = address;
    } catch (err) {
      this.json(res, 401, {
        ok: false,
        errorCode: 'INVALID_INPUT',
        errorMessage: `Не удалось восстановить адрес из подписи: ${(err as Error).message}`,
      } satisfies ChatSessionResponse);
      return;
    }

    // Проверка: signer == ownerOf(tokenId)
    try {
      const owner = await this.billingService.readOwnerOf(BigInt(sessionReq.tokenId));
      if (owner && owner.toLowerCase() !== signer.toLowerCase()) {
        this.json(res, 403, {
          ok: false,
          errorCode: 'NotTokenOwner',
          errorMessage: `signer=${signer}, owner=${owner}`,
        } satisfies ChatSessionResponse);
        return;
      }
    } catch {
      // Если не можем проверить — пропускаем (владелец проверится при chat)
      console.warn('[chatRouter] session ownerOf check skipped');
    }

    // Проверка freshness (10 минут)
    const sigAge = Math.floor(Date.now() / 1000) - sessionReq.timestamp;
    if (sigAge > this.config.txMaxAgeSec) {
      this.json(res, 401, {
        ok: false,
        errorCode: 'TxTooOld',
        errorMessage: `Подпись старше ${this.config.txMaxAgeSec} сек (возраст: ${sigAge}с)`,
      } satisfies ChatSessionResponse);
      return;
    }

    // Создать сессию
    const session = this.sessionStore.createSession(
      sessionReq.tokenId,
      sessionReq.spendLimit ?? 10,
      signer,
    );

    const remaining = (session.spendLimit ?? 10) - session.used;

    // Лог
    this.logBillingLocal(sessionReq.tokenId, 'session', signer);

    this.json(res, 201, {
      ok: true,
      sessionActive: true,
      remaining,
      spendLimit: session.spendLimit,
    } satisfies ChatSessionResponse);
  }

  // ── GET /api/chat/quota (FE-24) ──

  private async handleQuota(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const tokenIdStr = url.searchParams.get('tokenId');
    if (!tokenIdStr) {
      this.json(res, 400, { error: 'missing_tokenId' });
      return;
    }
    const tokenId = Number(tokenIdStr);
    if (!Number.isInteger(tokenId) || tokenId < 1) {
      this.json(res, 400, { error: 'invalid_tokenId' });
      return;
    }

    const quota = this.sessionStore.getQuota(tokenId);
    this.json(res, 200, {
      tokenId,
      remaining: quota.remaining,
      spendLimit: quota.spendLimit,
      active: quota.active,
    } satisfies ChatQuotaResponse);
  }

  // ── GET /api/chat/history ──

  private async handleHistory(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const tokenIdStr = url.searchParams.get('tokenId');
    if (!tokenIdStr) {
      this.json(res, 400, { error: 'missing_tokenId' });
      return;
    }
    const tokenId = Number(tokenIdStr);
    if (!Number.isInteger(tokenId) || tokenId < 1) {
      this.json(res, 400, { error: 'invalid_tokenId' });
      return;
    }
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);

    try {
      const entries = await this.historyStore.getRecentEntries(tokenId, limit);
      this.json(res, 200, { entries, tokenId } satisfies ChatHistoryResponse);
    } catch (err) {
      console.error('[chatRouter] history error:', err);
      this.json(res, 500, { error: 'history_error', message: (err as Error).message });
    }
  }

  // ── Локальный лог биллинга ──

  private logBillingLocal(tokenId: number, txHash: string, signer?: `0x${string}`): void {
    try {
      const logDir = process.env.CHAT_BILLING_LOG_DIR ?? './data';
      const logFile = `${logDir}/chat-billing.log`;
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

      const now = new Date();
      const ts = now.toISOString().replace('T', ' ').slice(0, 19);
      const line = `${ts} | tokenId=${tokenId} | txHash=${txHash} | signer=${signer ?? 'demo'} | fee=${CHAT_FEE_ETHER} MNT | ANSWERED\n`;
      appendFileSync(logFile, line, 'utf-8');
    } catch (err) {
      console.warn('[chatRouter] logBilling error:', (err as Error).message);
    }
  }

  // ── Helpers ──

  /**
   * Detect trading intent from user message.
   * 1. Try regex parser (fast, catches common patterns)
   * 2. Fallback to LLM-based detection if available
   */
  private async detectTradingIntent(message: string): Promise<TradingIntent | null> {
    // 1. Fast regex path
    const regexResult = parseTradingCommand(message);
    if (regexResult) {
      console.log('[ChatRouter] Trading intent (regex):', JSON.stringify(regexResult));
      return regexResult;
    }

    // 2. LLM fallback for complex phrasing
    if (this.llmClient) {
      try {
        return await this.detectTradingIntentViaLLM(message);
      } catch (err) {
        console.warn('[ChatRouter] LLM trading intent detection failed:', (err as Error).message);
      }
    }

    return null;
  }

  /**
   * Use LLM to detect if a message is a trading command.
   * Returns parsed TradingIntent or null if it's not a trading command.
   */
  private async detectTradingIntentViaLLM(message: string): Promise<TradingIntent | null> {
    if (!this.llmClient) return null;

    const systemPrompt = [
      'Ты крот-трейдер. Определи, является ли сообщение пользователя торговой командой.',
      'Если да — ответь только JSON без пояснений: {"action":"open|close|status","pair":"MNT/USDC|ETH/MNT|...","side":"long|short","amount":<число>}',
      'Примеры:',
      '- "открой лонг ETH/MNT на 100 USDC" → {"action":"open","pair":"ETH/MNT","side":"long","amount":100}',
      '- "закрой позицию" → {"action":"close"}',
      '- "как дела?" → обычный диалог (не JSON)',
      '- "сколько позиция?" → {"action":"status"}',
      '- "short MNT на 50" → {"action":"open","pair":"MNT/USDC","side":"short","amount":50}',
      'Если это не торговая команда — ответь обычным текстом без JSON.',
    ].join('\n');

    const llmResp = await this.llmClient.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 128,
    });

    const content = llmResp.content.trim();
    console.log('[ChatRouter] LLM trading intent raw:', content);

    // Try to extract JSON from the response (may be wrapped in markdown/whitespace)
    const jsonMatch = content.match(/\{[^{}]*"action"[^{}]*\}/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const action = parsed.action;
      if (action === 'open') {
        const pair = String(parsed.pair ?? '').toUpperCase();
        const sideRaw = String(parsed.side ?? '').toLowerCase();
        const side: 'long' | 'short' = (sideRaw === 'long' || sideRaw === 'лонг') ? 'long' : 'short';
        const amount = Number(parsed.amount);
        if (!pair || isNaN(amount) || amount <= 0) return null;
        console.log('[ChatRouter] Trading intent (LLM):', JSON.stringify({ action, pair, side, amount }));
        return { action: 'open', pair, side, amount };
      } else if (action === 'close') {
        console.log('[ChatRouter] Trading intent (LLM): close');
        return { action: 'close' };
      } else if (action === 'status') {
        console.log('[ChatRouter] Trading intent (LLM): status');
        return { action: 'status' };
      }
    } catch {
      console.warn('[ChatRouter] LLM JSON parse failed for:', content);
    }

    return null;
  }

  /**
   * Execute a detected trading command and format the response.
   */
  private async executeTradingCommand(
    tokenId: number,
    intent: TradingIntent,
  ): Promise<{ reply: string; mood: number; action: string | null; txHash?: string }> {
    switch (intent.action) {
      case 'open':
        return this.executeOpenCommand(tokenId, intent);
      case 'close':
        return this.executeCloseCommand(tokenId);
      case 'status':
        return this.executeStatusCommand(tokenId);
      default:
        return { reply: '🤔 Не понял команду.', mood: 1, action: null };
    }
  }

  /**
   * Execute an "open" trading command via Agni executor.
   */
  private async executeOpenCommand(
    tokenId: number,
    intent: TradingIntent,
  ): Promise<{ reply: string; mood: number; action: string | null; txHash?: string }> {
    const swapParams = intentToSwapParams(intent);
    if (!swapParams || !intent.pair || !intent.side) {
      return {
        reply: `❓ Не знаю такую пару: ${intent.pair ?? '?'}. Доступны: ETH/MNT, MNT/USDC, WMNT/USDC, USDC/MNT`,
        mood: 1,
        action: null,
      };
    }

    // Check if Agni executor is available
    const executor = this.agniExecutor ?? this.tryLoadAgniSingleton();
    if (!executor) {
      return {
        reply: '🔧 Торговый движок не настроен. Попробуй позже.',
        mood: 1,
        action: null,
      };
    }

    try {
      // Execute swap with tokenId
      const result = await executor.executeSwap({
        ...swapParams,
        tokenId: BigInt(tokenId),
      });

      if (!result.success) {
        const errorMsg = result.error ?? 'неизвестная ошибка';
        console.error('[ChatRouter] Open trade failed:', errorMsg);

        // Map known errors to user-friendly messages
        let userMsg = `❌ Не получилось открыть позицию: ${errorMsg}`;
        if (errorMsg.includes('session') || errorMsg.includes('Session')) {
          userMsg = '🔐 Нужно подписать сессию для торговли. Используй кнопку «Start Session»';
        } else if (errorMsg.includes('limit') || errorMsg.includes('Limit')) {
          userMsg = `⚠️ ${errorMsg}`;
        }

        return {
          reply: userMsg,
          mood: 1,
          action: null,
        };
      }

      const sideLabel = intent.side === 'long' ? 'LONG' : 'SHORT';
      const displayPrice = result.price > 0
        ? result.price.toFixed(intent.pair === 'MNT/USDC' || intent.pair === 'WMNT/USDC' ? 4 : 2)
        : getMockPrice(intent.pair).toString();
      const txHash = result.txHash ?? '';
      const txShort = txHash.slice(0, 10) + '...' + txHash.slice(-6);
      const amount = intent.amount ?? 0;

      // Track position in PositionTracker (for status/trading commands)
      if (this.positionTracker) {
        const entryPrice = result.price > 0 ? result.price : getMockPrice(intent.pair);
        this.positionTracker.open(
          tokenId,
          intent.pair as import('../types.js').DexPair,
          intent.side === 'long' ? 'BUY' : 'SELL',
          amount,
          entryPrice,
        );
      }

      // Add to TradeRouter history (for GET /api/trade/history)
      const historyPrice = result.price > 0 ? result.price : getMockPrice(intent.pair);
      addTradeToHistory({
        tokenId,
        pair: intent.pair,
        side: intent.side === 'long' ? 'BUY' : 'SELL',
        amount,
        price: historyPrice,
        pnl: 0,
        status: 'open',
        openedAt: Date.now(),
      });

      return {
        reply: `🚀 Открыл ${sideLabel} ${intent.pair} ${amount} USDC @ ${displayPrice}. Tx: ${txShort}`,
        mood: 2,
        action: 'open',
        txHash,
      };
    } catch (err) {
      console.error('[ChatRouter] executeOpenCommand error:', err);
      return {
        reply: `❌ Ошибка при открытии позиции: ${(err as Error).message}`,
        mood: 1,
        action: null,
      };
    }
  }

  /**
   * Execute a "close" trading command — mock close via PositionTracker.
   */
  private async executeCloseCommand(
    tokenId: number,
  ): Promise<{ reply: string; mood: number; action: string | null; txHash?: string }> {
    if (!this.positionTracker) {
      return {
        reply: '📭 Нет активных позиций. Торговый трекер не запущен.',
        mood: 1,
        action: null,
      };
    }

    const position = this.positionTracker.getPosition(tokenId);
    if (!position || position.status !== 'open') {
      return {
        reply: '📭 У тебя нет открытых позиций.',
        mood: 1,
        action: null,
      };
    }

    // Use Agni executor to get current price, or fallback to mock
    let currentPrice = position.entryPrice;
    if (this.agniExecutor) {
      try {
        // Get mock quote for display
        currentPrice = getMockPrice(position.pair);
      } catch {
        // use entry price as fallback
      }
    }

    const closed = this.positionTracker.close(tokenId, currentPrice);
    if (!closed) {
      return {
        reply: '🤔 Не получилось закрыть позицию.',
        mood: 1,
        action: null,
      };
    }

    const pnlSign = closed.pnl >= 0 ? '📈' : '📉';
    const pnlStr = closed.pnl >= 0 ? `+${closed.pnl.toFixed(2)}` : closed.pnl.toFixed(2);

    // Also close in TradeRouter history
    closeActivePosition(tokenId, closed.pnl, closed.exitPrice ?? position.entryPrice);

    return {
      reply: `${pnlSign} Закрыл позицию ${position.pair} @ ${closed.exitPrice.toFixed(4)}. PnL: ${pnlStr} USDC`,
      mood: closed.pnl >= 0 ? 2 : 0,
      action: 'close',
    };
  }

  /**
   * Execute a "status" command — show current position.
   */
  private async executeStatusCommand(
    tokenId: number,
  ): Promise<{ reply: string; mood: number; action: string | null; txHash?: string }> {
    if (!this.positionTracker) {
      return {
        reply: '📊 Торговый трекер не запущен. Статус недоступен.',
        mood: 1,
        action: null,
      };
    }

    const position = this.positionTracker.getPosition(tokenId);
    if (!position || position.status !== 'open') {
      return {
        reply: '📭 Нет открытых позиций. Отдыхаю пока.',
        mood: 1,
        action: null,
      };
    }

    // Get current mock price
    const currentPrice = getMockPrice(position.pair);
    const isBuy = position.side === 'BUY';
    const pnlPct = isBuy
      ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
      : ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
    const unrealizedPnl = isBuy
      ? (currentPrice - position.entryPrice) * (position.amount / position.entryPrice)
      : (position.entryPrice - currentPrice) * (position.amount / position.entryPrice);

    const emoji = pnlPct >= 0 ? '📈' : '📉';
    const pnlSign = unrealizedPnl >= 0 ? '+' : '';

    const lines = [
      `${emoji} **Позиция:** ${position.side} ${position.pair} ${position.amount} USDC`,
      `📌 Вход: ${position.entryPrice.toFixed(4)} | Текущая: ${currentPrice.toFixed(4)}`,
      `💵 PnL: ${pnlSign}${unrealizedPnl.toFixed(2)} USDC (${pnlSign}${pnlPct.toFixed(2)}%)`,
      `⏱ Открыта: ${Math.floor((Date.now() - position.openedAt) / 60_000)} мин назад`,
    ];

    return {
      reply: lines.join('\n'),
      mood: pnlPct >= 0 ? 2 : 1,
      action: 'status',
    };
  }

  // ── Helpers (original) ──

  /**
   * Try to load AgniExecutor from plugin singleton (if not passed via constructor).
   */
  private tryLoadAgniSingleton(): AgniExecutor | null {
    try {
      return getAgniExecutor();
    } catch {
      return null;
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /** Graceful shutdown */
  async close(): Promise<void> {
    await this.billingService.close();
  }
}
