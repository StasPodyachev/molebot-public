/**
 * POST /api/chat — верификация оплаты, генерация ответа по mood
 */

import { Router } from 'express';
import { parseEther } from 'viem';
import { createPublicClient, http } from 'viem';
import type { Chain } from 'viem';
import type { ChatBillingService } from '../../../agent/src/services/chatBillingService.js';
import { addMessage, getHistory } from '../services/chat-history.js';
import { logChatBilling } from '../services/chat-billing-log.js';

const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.sepolia.mantle.xyz'] } },
} as const satisfies Chain;

// ABI для getMoleData
const getMoleDataAbi = [{
  type: 'function' as const,
  name: 'getMoleData',
  inputs: [{ type: 'uint256', name: 'tokenId' }],
  outputs: [{
    components: [
      { type: 'uint8', name: 'mood' },
      { type: 'uint8', name: 'levelIndex' },
      { type: 'int256', name: 'cumulativePnl' },
      { type: 'uint256', name: 'lastTradeTs' },
      { type: 'bool', name: 'isMythic' },
    ],
    type: 'tuple',
  }],
  stateMutability: 'view' as const,
}];

interface MoleData {
  mood: number;
  levelIndex: number;
  cumulativePnl: bigint;
  lastTradeTs: bigint;
  isMythic: boolean;
}

// ---- Генерация ответа по mood ----

const MOOD_REPLIES: Record<number, string[]> = {
  0: [ // sad
    '...что надо?',
    'Ага. Понял.',
    'Слушаю.',
    'Ну.',
    'Говори уже.',
  ],
  1: [ // neutral
    'Принято. Чем могу помочь?',
    'Хорошо, разберёмся.',
    'Ваш запрос обработан.',
    'Понял вас. Есть план.',
    'Запрос получен. Действую.',
  ],
  2: [ // happy / дерзкий
    'Йо! Наконец-то ты написал! Слушаю внимательно 🦔',
    'Ого, свежие мысли! Ща разложим всё по полочкам.',
    'Давай, грузи! Этот крот готов к свершениям 💪',
    'На связи! Настроение огонь 🔥 Что стряслось?',
    'Крот на связи! Говори быстро и по делу.',
  ],
};

function generateReply(mood: number, message: string): string {
  const replies = MOOD_REPLIES[mood] ?? MOOD_REPLIES[1];
  const template = replies[Math.floor(Math.random() * replies.length)];

  // Если сообщение короткое — отвечаем шаблоном
  if (message.length < 20) return template;

  // Если сообщение длинное — добавляем рефлексию mood
  if (mood === 2) {
    return `${template}\n\nПрочитал твой месседж. Звучит интересно! Если нужны цифры или анализ — я на связи.`;
  }
  if (mood === 0) {
    return `${template}\n\nДлинно написано. Если коротко — скажи суть.`;
  }
  return `${template}\n\nПринял информацию. Анализирую.`;
}

// ---- Route handler ----

export function chatRouter(billingService: ChatBillingService): Router {
  const router = Router();
  const publicClient = createPublicClient({
    chain: mantleSepolia,
    transport: http(process.env.MANTLE_RPC_URL ?? 'https://rpc.sepolia.mantle.xyz'),
  });
  const contractAddress = (process.env.NFT_CONTRACT_ADDRESS ?? '0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb') as `0x${string}`;

  /** POST /api/chat */
  router.post('/', async (req, res) => {
    try {
      const { signature, message, txHash, tokenId, timestamp } = req.body;

      // Валидация
      if (!message || !tokenId) {
        return res.status(400).json({
          ok: false,
          errorCode: 'INVALID_INPUT',
          errorMessage: 'message и tokenId обязательны',
        });
      }

      // Сохраняем сообщение пользователя сразу
      const tokenIdBig = BigInt(tokenId);
      await addMessage(tokenIdBig, 'user', message);

      // Вызов chatBillingService
      const paymentResult = await billingService.verifyChatPayment({
        signature: signature as `0x${string}`,
        message,
        txHash: txHash as `0x${string}`,
        tokenId: tokenIdBig,
        timestamp: BigInt(timestamp ?? 0),
      });

      if (!paymentResult.valid) {
        // Лог отклонённого
        await logChatBilling(tokenIdBig, txHash ?? '0x', 0n, 'REJECTED');

        return res.json({
          ok: false,
          errorCode: paymentResult.error,
          errorMessage: paymentResult.detail ?? paymentResult.error,
        });
      }

      // Успешная верификация — читаем mood с контракта
      let mood = 1; // neutral по умолчанию
      try {
        const data = await publicClient.readContract({
          address: contractAddress,
          abi: getMoleDataAbi,
          functionName: 'getMoleData',
          args: [tokenIdBig],
        });
        mood = Number((data as MoleData).mood);
      } catch (err) {
        console.warn('[chat] getMoleData error, use default mood:', (err as Error).message);
      }

      // Генерация ответа
      const reply = generateReply(mood, message);

      // Сохраняем ответ
      await addMessage(tokenIdBig, 'assistant', reply, mood);

      // Лог биллинга
      const txValue = paymentResult.valid ? (
        // Попробуем получить value из tx — для лога
        0n
      ) : 0n;
      await logChatBilling(tokenIdBig, txHash as `0x${string}`, txValue, 'ANSWERED');

      // Ответ фронту
      return res.json({
        ok: true,
        reply,
        mood,
        tokenId: Number(tokenId),
      });
    } catch (err) {
      console.error('[chat] Unhandled error:', err);
      return res.status(500).json({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: (err as Error).message,
      });
    }
  });

  return router;
}
