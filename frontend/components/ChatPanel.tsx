'use client';

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { CHAT_SKIP_PAYMENT, SPEND_LIMIT } from '@/lib/contract';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mood?: number;
  pending?: boolean;
}

interface ChatSuccess {
  ok: true;
  reply: string;
  mood: number;
  tokenId: number;
  remaining: number;
  spendLimit: number;
}

interface ChatError {
  ok: false;
  errorCode: string;
  errorMessage: string;
}

type ChatResponse = ChatSuccess | ChatError;

interface SessionResponse {
  ok: boolean;
  sessionActive: boolean;
  remaining: number;
  spendLimit: number;
  errorCode?: string;
  errorMessage?: string;
}

interface QuotaData {
  remaining: number;
  spendLimit: number;
  active: boolean;
}

interface ChatPanelProps {
  tokenId: number;
  apiBase?: string;
}

/* -------------------------------------------------------------------------- */
/* EIP-712 domain & types (ChatSession — FE-24: batch approve)                  */
/* -------------------------------------------------------------------------- */

const EIP712_DOMAIN = {
  name: 'MolebotChat',
  version: '1',
  chainId: 5003,
} as const;

const EIP712_CHAT_SESSION_TYPES = {
  ChatSession: [
    { name: 'tokenId',    type: 'uint256' },
    { name: 'spendLimit', type: 'uint256' },
    { name: 'timestamp',  type: 'uint256' },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/* Human-readable error messages                                               */
/* -------------------------------------------------------------------------- */

const ERROR_HUMAN: Record<string, string> = {
  INVALID_INPUT: 'Некорректный запрос. Проверьте введённые данные.',
  INTERNAL_ERROR: 'Внутренняя ошибка сервера. Попробуйте позже.',
  TxAlreadyUsed: 'Эта транзакция уже использована для чата.',
  NotTokenOwner: 'Вы не владелец этого NFT.',
  WrongRecipient: 'MNT-перевод отправлен не на адрес агента.',
  WrongSender: 'MNT-перевод отправлен не с вашего кошелька.',
  InsufficientFee: 'Недостаточная сумма перевода (нужно 0.001 MNT).',
  TxTooOld: 'Транзакция слишком старая. Отправьте новый перевод.',
};

function humanError(code: string, fallback: string): string {
  return ERROR_HUMAN[code] ?? `Ошибка чата: ${fallback}`;
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && (
    err.message === 'Failed to fetch' ||
    err.message === 'NetworkError when attempting to fetch resource.' ||
    err.message.includes('NetworkError') ||
    err.message.includes('fetch')
  );
}

/* -------------------------------------------------------------------------- */
/* Mood emoji                                                                  */
/* -------------------------------------------------------------------------- */

const MOOD_EMOJI: Record<number, string> = {
  0: '😒',
  1: '😐',
  2: '😏',
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function ChatPanel({ tokenId, apiBase }: ChatPanelProps) {
  // API base: VPS через Cloudflare proxy (HTTPS, без mixed content).
  // _redirects проксирует GET; POST идёт напрямую на VPS через HTTPS.
  const API = apiBase || 'https://vps.molebot.org/api';
  const { wallets } = useWallets();

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [lastMood, setLastMood] = useState<number>(1);
  const listRef = useRef<HTMLDivElement>(null);

  // Session state (FE-24)
  const [sessionActive, setSessionActive] = useState(CHAT_SKIP_PAYMENT);
  const [remaining, setRemaining] = useState(CHAT_SKIP_PAYMENT ? Infinity : 0);
  const [sessionLimit, setSessionLimit] = useState(CHAT_SKIP_PAYMENT ? Infinity : 0);
  const [signingSession, setSigningSession] = useState(false);
  const sessionFetchedRef = useRef(false);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch quota on mount (unless skip-payment)
  useEffect(() => {
    if (CHAT_SKIP_PAYMENT || sessionFetchedRef.current) return;
    sessionFetchedRef.current = true;

    fetch(`${API}/chat/quota?tokenId=${tokenId}`)
      .then(r => r.json())
      .then((q: QuotaData) => {
        if (q.active && q.remaining > 0) {
          setSessionActive(true);
          setRemaining(q.remaining);
          setSessionLimit(q.spendLimit);
        }
      })
      .catch(() => {
        // Сервер недоступен — покажем кнопку создания сессии
      });
  }, [API, tokenId]);

  /** Подписать EIP-712 ChatSession через Privy embedded wallet */
  const signChatSession = useCallback(async (): Promise<{ signature: `0x${string}`; timestamp: number }> => {
    // Privy может выставлять walletClientType как 'privy' или 'embedded' — ищем гибко
    const wallet = wallets.find(w =>
      typeof w.walletClientType === 'string' &&
      (w.walletClientType.includes('privy') || w.walletClientType.includes('embed'))
    ) ?? wallets[0];
    if (!wallet) {
      throw new Error('Кошелёк не найден. Подключите кошелёк через Privy и попробуйте снова.');
    }

    const provider = await wallet.getEthereumProvider();
    if (!provider) {
      throw new Error('Privy wallet provider unavailable.');
    }

    const address = wallet.address;
    if (!address) {
      throw new Error('Wallet address not available.');
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const typedData = {
      domain: EIP712_DOMAIN,
      types: EIP712_CHAT_SESSION_TYPES,
      primaryType: 'ChatSession',
      message: {
        tokenId: BigInt(tokenId),
        spendLimit: BigInt(SPEND_LIMIT),
        timestamp,
      },
    };

    const serializable = JSON.parse(
      JSON.stringify(typedData, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    );

    const signature = await provider.request({
      method: 'eth_signTypedData_v4',
      params: [address, serializable],
    }) as `0x${string}`;

    return { signature, timestamp };
  }, [tokenId, wallets]);

  /** Создать сессию: подписать EIP-712 → POST /api/chat/session */
  const createSession = useCallback(async () => {
    setSigningSession(true);
    try {
      const { signature, timestamp } = await signChatSession();

      const res = await fetch(`${API}/chat/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId,
          signature,
          spendLimit: SPEND_LIMIT,
          timestamp,
        }),
      });

      const _rawSession = await res.text();
      let data: SessionResponse;
      try { data = JSON.parse(_rawSession); } catch { throw new Error("Сервис чата временно недоступен (пустой ответ)"); }
      if (data.ok && data.sessionActive) {
        setSessionActive(true);
        setRemaining(data.remaining);
        setSessionLimit(data.spendLimit);
      } else {
        const errMsg = data.errorCode
          ? humanError(data.errorCode, data.errorMessage ?? 'Unknown error')
          : (data.errorMessage ?? 'Не удалось создать сессию');
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `⛔ ${errMsg}`,
        }]);
      }
    } catch (caught) {
      console.error('[ChatPanel] createSession error:', caught);
      const msg = isNetworkError(caught)
        ? 'Сервис чата временно недоступен'
        : caught instanceof Error ? caught.message : String(caught);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `⚠️ ${msg}`,
      }]);
    } finally {
      setSigningSession(false);
    }
  }, [API, tokenId, signChatSession]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || thinking) return;
    if (!sessionActive && !CHAT_SKIP_PAYMENT) return;

    setInput('');

    const userMsgId = `user-${Date.now()}`;
    const thinkMsgId = `think-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text },
      { id: thinkMsgId, role: 'assistant', text: 'Крот думает...', pending: true },
    ]);
    setThinking(true);

    try {
      // В сессионном режиме (FE-24) — шлём только tokenId + message
      const chatPayload = { tokenId, message: text };

      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      const _rawChat = await res.text();
      let data: ChatResponse;
      try { data = JSON.parse(_rawChat); } catch { throw new Error("Сервис чата временно недоступен (пустой ответ)"); }
      console.debug('[ChatPanel] POST /api/chat response:', { status: res.status, ok: res.ok, data });

      setMessages((prev) => prev.filter((m) => m.id !== thinkMsgId));

      if (data.ok) {
        setLastMood(data.mood);
        setMessages((prev) => [
          ...prev,
          { id: `asst-${Date.now()}`, role: 'assistant', text: data.reply, mood: data.mood },
        ]);

        // Обновить квоту из ответа (FE-24)
        if (!CHAT_SKIP_PAYMENT && data.remaining >= 0) {
          setRemaining(data.remaining);
          setSessionLimit(data.spendLimit);
          if (data.remaining <= 0) {
            setSessionActive(false);
          }
        }
      } else {
        const friendly = humanError(data.errorCode, data.errorMessage);
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'assistant', text: `⛔ ${friendly}` },
        ]);

        // Если ошибка из-за отсутствия сессии — сбросить состояние
        if (data.errorMessage?.includes('Нет активной сессии') || data.errorMessage?.includes('Session exhausted')) {
          setSessionActive(false);
          setRemaining(0);
        }
      }
    } catch (caught) {
      console.error('[ChatPanel] POST /api/chat error:', caught);
      const errText = isNetworkError(caught)
        ? 'Сервис чата временно недоступен'
        : caught instanceof Error ? caught.message : String(caught);
      setMessages((prev) => prev.filter((m) => m.id !== thinkMsgId));
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', text: `⚠️ ${errText}` },
      ]);
    } finally {
      setThinking(false);
    }
  };

  /* ----------------------------------------------------------------------- */
  /* Progress bar helpers                                                      */
  /* ----------------------------------------------------------------------- */

  const usedMessages = sessionLimit === Infinity ? 0 : sessionLimit - remaining;
  const progressPct = sessionLimit === Infinity || sessionLimit === 0
    ? 0
    : Math.round((usedMessages / sessionLimit) * 100);

  /* ----------------------------------------------------------------------- */
  /* Render                                                                    */
  /* ----------------------------------------------------------------------- */

  const needsSession = !CHAT_SKIP_PAYMENT && !sessionActive;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mole-400 to-mole-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-mole-500/20">
          🦔
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-100">
            Molebot #{tokenId}
          </h2>
          <p className="text-xs text-gray-500">
            Mood: {MOOD_EMOJI[lastMood] ?? '😐'} {lastMood === 2 ? 'Дерзкий' : lastMood === 0 ? 'Угрюмый' : 'Нейтральный'}
          </p>
        </div>
      </div>

      {/* Session quota progress bar (FE-24) */}
      {!CHAT_SKIP_PAYMENT && sessionActive && sessionLimit < Infinity && (
        <div className="px-4 py-2 border-b border-gray-800/50">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Осталось {remaining} / {sessionLimit} сообщений</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                remaining <= 2
                  ? 'bg-red-500'
                  : remaining <= 5
                    ? 'bg-yellow-500'
                    : 'bg-mole-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="text-center text-gray-600 mt-12">
            <p className="text-4xl mb-4">🦔</p>
            <p className="text-sm">Напиши что-нибудь своему кроту!</p>
            <p className="text-xs text-gray-700 mt-2">Token #{tokenId}</p>
            {needsSession && !CHAT_SKIP_PAYMENT && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={createSession}
                  disabled={signingSession}
                  className="inline-flex items-center gap-2 bg-mole-600 hover:bg-mole-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed"
                >
                  {signingSession ? (
                    <>
                      <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      Подписываю...
                    </>
                  ) : (
                    `Подписать сессию (${SPEND_LIMIT} сообщений)`
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-mole-700 text-white rounded-br-md'
                  : msg.pending
                    ? 'bg-gray-800/50 text-gray-400 italic rounded-bl-md animate-pulse-soft'
                    : 'bg-gray-800 text-gray-200 rounded-bl-md'
              }`}
            >
              {msg.pending ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-mole-500 rounded-full animate-bounce-slow" />
                  {msg.text}
                </span>
              ) : (
                <>
                  {msg.mood !== undefined && msg.role === 'assistant' && (
                    <span className="mr-1.5">{MOOD_EMOJI[msg.mood] ?? ''}</span>
                  )}
                  {msg.text}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 p-4 space-y-2">
        {/* Session CTA when exhausted */}
        {needsSession && messages.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-yellow-500">
              {sessionLimit > 0 ? 'Лимит сообщений исчерпан' : 'Требуется подпись сессии'}
            </span>
            <button
              type="button"
              onClick={createSession}
              disabled={signingSession}
              className="text-xs bg-mole-600 hover:bg-mole-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-3 py-1.5 rounded-lg transition-all disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {signingSession ? (
                <>
                  <span className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Подписываю...
                </>
              ) : (
                `Подписать ещё ${SPEND_LIMIT}`
              )}
            </button>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              needsSession && !CHAT_SKIP_PAYMENT
                ? 'Подпиши сессию чтобы писать...'
                : thinking
                  ? 'Крот отвечает...'
                  : 'Напиши кроту...'
            }
            disabled={thinking || needsSession}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-mole-500 focus:ring-1 focus:ring-mole-500/40 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={thinking || !input.trim() || needsSession}
            className="bg-mole-600 hover:bg-mole-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed"
          >
            {thinking ? '...' : '→'}
          </button>
        </form>
      </div>
    </div>
  );
}
