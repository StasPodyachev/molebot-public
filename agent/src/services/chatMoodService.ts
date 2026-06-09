/**
 * chatMoodService — чтение mood из NFT контракта + генерация ответа
 *
 * mood=2 → дерзкий
 * mood=1 → нейтральный (default)
 * mood=0 → угрюмый
 */

import { createPublicClient, http } from 'viem';
import type { Chain } from 'viem';
import { LLMClient, type LLMRequest } from './llmClient.js';

/** Mantle Sepolia */
const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.sepolia.mantle.xyz'] } },
} as const satisfies Chain;

const getMoleDataAbi = [{
  type: 'function' as const,
  name: 'getMoleData',
  inputs: [{ type: 'uint256', name: 'tokenId' }],
  outputs: [{
    type: 'tuple',
    components: [
      { type: 'uint8', name: 'mood' },
      { type: 'uint8', name: 'levelIndex' },
      { type: 'int256', name: 'cumulativePnl' },
      { type: 'uint256', name: 'lastTradeTs' },
      { type: 'bool', name: 'isMythic' },
    ],
  }],
  stateMutability: 'view',
}];

interface MoleData {
  mood: number;
  levelIndex: number;
  cumulativePnl: bigint;
  lastTradeTs: bigint;
  isMythic: boolean;
}

/**
 * Сервис для работы с mood NFT
 * Может использовать LLM Gateway для генерации ответов (C-AI-02/03)
 */
export class ChatMoodService {
  private client: ReturnType<typeof createPublicClient>;
  private contractAddress: `0x${string}`;
  private llmClient: LLMClient | null;

  constructor(config: { contractAddress: `0x${string}`; rpcUrl?: string; llmGatewayUrl?: string }) {
    this.contractAddress = config.contractAddress;
    this.client = createPublicClient({
      chain: mantleSepolia,
      transport: http(config.rpcUrl ?? 'https://rpc.sepolia.mantle.xyz'),
    });
    this.llmClient = config.llmGatewayUrl ? new LLMClient(config.llmGatewayUrl) : null;
  }

  /**
   * Прочитать MoleData для tokenId
   */
  async getMoleData(tokenId: number): Promise<MoleData | null> {
    try {
      const data = await this.client.readContract({
        address: this.contractAddress,
        abi: getMoleDataAbi,
        functionName: 'getMoleData',
        args: [BigInt(tokenId)],
      });

      // viem возвращает tuple как массив (5 полей)
      if (Array.isArray(data) && data.length >= 5) {
        return {
          mood: Number(data[0]),
          levelIndex: Number(data[1]),
          cumulativePnl: data[2] as bigint,
          lastTradeTs: data[3] as bigint,
          isMythic: Boolean(data[4]),
        };
      }

      // Если объект
      const d = data as Record<string, unknown>;
      return {
        mood: Number(d.mood ?? 1),
        levelIndex: Number(d.levelIndex ?? 0),
        cumulativePnl: BigInt(String(d.cumulativePnl ?? 0)),
        lastTradeTs: BigInt(String(d.lastTradeTs ?? 0)),
        isMythic: Boolean(d.isMythic ?? false),
      };
    } catch (err) {
      console.warn(`[chatMoodService] getMoleData(${tokenId}) failed:`, (err as Error).message);
      return null;
    }
  }

  /**
   * Сгенерировать ответ с учётом mood
   * Если доступен LLM Gateway — использует его, иначе шаблонный ответ
   */
  async generateReply(userMessage: string, mood: number, moleData?: MoleData): Promise<string> {
    // Если LLM Gateway настроен — пробуем через него
    if (this.llmClient) {
      try {
        return await this.generateViaLLM(userMessage, mood, moleData);
      } catch (err) {
        console.warn('[chatMoodService] LLM Gateway failed, falling back to template:', (err as Error).message);
        // fallback to template
      }
    }

    return this.generateTemplateReply(userMessage, mood, moleData);
  }

  /**
   * Ответ через LLM Gateway
   */
  private async generateViaLLM(userMessage: string, mood: number, moleData?: MoleData): Promise<string> {
    const moodDesc = mood === 2 ? 'дерзкий' : mood === 0 ? 'угрюмый' : 'нейтральный';
    const levelInfo = moleData && moleData.levelIndex > 0
      ? ` (уровень ${moleData.levelIndex}${moleData.isMythic ? ', Mythic ✨' : ''})`
      : '';

    const systemPrompt = `You are Molebot, an on-chain AI trading mole on Mantle. Your current mood: ${moodDesc}${levelInfo}. Always respond in the SAME LANGUAGE the user wrote to you. Be brief, match your mood character. Use emoji.`;

    const llmReq: LLMRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: 256,
    };

    const llmResp = await this.llmClient!.chat(llmReq);
    return llmResp.content;
  }

  /**
   * Шаблонный ответ (без LLM) — используется как fallback
   */
  private generateTemplateReply(userMessage: string, mood: number, moleData?: MoleData): string {
    const context = moleData;

    // Приставка mood
    let prefix: string;
    switch (mood) {
      case 2:
        prefix = this.pickRandom(DERPZKIY_REPLIES);
        break;
      case 0:
        prefix = this.pickRandom(UGRYUMY_REPLIES);
        break;
      default:
        prefix = this.pickRandom(NEUTRAL_REPLIES);
        break;
    }

    // Если mythic — усилить
    if (context?.isMythic) {
      prefix += ' ✨';
    }

    // Уровень в конце если есть
    const levelSuffix = context && context.levelIndex > 0
      ? ` [Lv${context.levelIndex}]`
      : '';

    return `${prefix} ${userMessage}${levelSuffix}`;
  }

  private pickRandom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

/* -------------------------------------------------------------------------- */
/* Mood-зависимые реплики                                                     */
/* -------------------------------------------------------------------------- */

const DERPZKIY_REPLIES = [
  'О, ещё один гений со своим «глубоким» вопросом. Лады:',
  'Ну давай, удиви меня. Ща всё разрулю:',
  'Слушаю, начальник. Хотя ставки тут так себе...',
  'Твоя взяла, босс. Хотя мог бы и сам догадаться:',
  'Эх, опять работать... Ладно, вот тебе ответ:',
  'Да знаю я, знаю. Ща сделаем в лучшем виде:',
  'Ты б хоть поинтереснее спросил. Ну да ладно:',
];

const NEUTRAL_REPLIES = [
  'Принято. Мой ответ:',
  'Понял. Вот что могу сказать:',
  'Хорошо. Держи ответ:',
  'Окей, разбираюсь. Результат:',
  'Так, дай подумать... Готово:',
  'Интересный запрос. Мой вариант:',
  'Угу, есть такое. Короче:',
];

const UGRYUMY_REPLIES = [
  'Мда... Ну ладно, отвечу:',
  'Вздыхаю. Держи:',
  '*нехотя* Ну вот:',
  'Какая разница... В общем:',
  'Эх, опять работа... Держи ответ:',
  'Ладно, отвечу, раз просишь:',
  'Скучно... Вот ответ:',
];
