/**
 * Тесты ChatMoodService — mood + LLM Gateway интеграция
 *
 * Проверяет:
 * - Шаблонный ответ (без Gateway)
 * - LLM Gateway ответ (с Gateway)
 * - Fallback на шаблон при недоступности Gateway
 * - Разные mood'ы
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatMoodService } from '../src/services/chatMoodService.js';

describe('ChatMoodService', () => {
  const CONTRACT_ADDRESS = '0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb' as `0x${string}`;

  describe('template replies (no Gateway)', () => {
    let service: ChatMoodService;

    beforeEach(() => {
      service = new ChatMoodService({ contractAddress: CONTRACT_ADDRESS });
    });

    it('должен выдать нейтральный шаблонный ответ', async () => {
      const reply = await service.generateReply('привет', 1);
      expect(reply).toContain('привет');
      // Нейтральные реплики отличаются от дерзких
    });

    it('должен выдать дерзкий ответ для mood=2', async () => {
      const reply = await service.generateReply('как дела', 2);
      expect(reply).toBeTruthy();
      expect(reply).toContain('как дела');
    });

    it('должен выдать угрюмый ответ для mood=0', async () => {
      const reply = await service.generateReply('торгуй', 0);
      expect(reply).toBeTruthy();
      expect(reply).toContain('торгуй');
    });

    it('должен добавлять уровень в ответ', async () => {
      const reply = await service.generateReply('тест', 1, {
        mood: 1,
        levelIndex: 5,
        cumulativePnl: 1000n,
        isMythic: false,
      });
      expect(reply).toContain('[Lv5]');
    });

    it('должен добавлять ✨ для Mythic', async () => {
      const reply = await service.generateReply('тест', 2, {
        mood: 2,
        levelIndex: 10,
        cumulativePnl: 50000n,
        isMythic: true,
      });
      expect(reply).toContain('✨');
      expect(reply).toContain('[Lv10]');
    });
  });

  describe('with LLM Gateway', () => {
    const GATEWAY_URL = 'http://localhost:3010';
    let service: ChatMoodService;
    let originalFetch: typeof fetch;

    beforeEach(() => {
      service = new ChatMoodService({
        contractAddress: CONTRACT_ADDRESS,
        llmGatewayUrl: GATEWAY_URL,
      });
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('должен сгенерировать ответ через LLM Gateway', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Molebot: роем дальше! 🐹' } }],
          model: 'deepseek-chat',
        }),
      });

      const reply = await service.generateReply('го трейдить', 2, {
        mood: 2,
        levelIndex: 3,
        cumulativePnl: 1000n,
        isMythic: false,
      });

      expect(reply).toContain('Molebot');
      expect(reply).toContain('🐹');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('должен fallback на шаблон при недоступности Gateway', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const reply = await service.generateReply('привет', 1);

      // Должен вернуть шаблонный ответ, а не бросить ошибку
      expect(reply).toContain('привет');
      expect(reply).not.toContain('Molebot:'); // не LLM ответ
    });

    it('должен fallback при HTTP 500 от Gateway', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      });

      const reply = await service.generateReply('тест', 1);

      expect(reply).toContain('тест');
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('должен использовать системный промпт с mood', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OK' } }],
          model: 'deepseek-chat',
        }),
      });

      await service.generateReply('тест', 2, {
        mood: 2,
        levelIndex: 0,
        cumulativePnl: 0n,
        isMythic: false,
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      const systemMsg = body.messages.find((m: any) => m.role === 'system');

      expect(systemMsg).toBeDefined();
      expect(systemMsg.content).toContain('дерзкий');
      expect(systemMsg.content).toContain('Molebot');
    });

    it('должен включать Mythic в системный промпт', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OK' } }],
          model: 'deepseek-chat',
        }),
      });

      await service.generateReply('тест', 1, {
        mood: 1,
        levelIndex: 7,
        cumulativePnl: 100000n,
        isMythic: true,
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      const systemMsg = body.messages.find((m: any) => m.role === 'system');

      expect(systemMsg.content).toContain('Mythic');
      expect(systemMsg.content).toContain('уровень 7');
    });
  });
});
