/**
 * Тесты LLM Gateway
 *
 * ⚠️ stubMode=true — тестируем заглушку + HTTP-ручки.
 * Real mode тесты будут добавлены после получения LLM_API_KEY.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRouter } from '../src/routes/index.js';
import { type GatewayConfig } from '../src/config.js';

const TEST_CONFIG: GatewayConfig = {
  port: 3099,
  llmProviderUrl: 'https://api.deepseek.com',
  llmApiKey: '',
  defaultModel: 'deepseek-chat',
  aiCreditsAddress: '0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64' as `0x${string}`,
  agentWalletAddress: '0xFecb0b79583A337c8Bd1E390B81661329b78450e' as `0x${string}`,
  mantleRpcUrl: 'https://rpc.sepolia.mantle.xyz',
  chainId: 5003,
  cacheTtlSec: 60,
  stubMode: true, // Тесты в stub mode
};

function createTestApp(config: Partial<GatewayConfig> = {}) {
  const app = express();
  app.use(express.json());

  const mergedConfig = { ...TEST_CONFIG, ...config };
  app.use(createRouter(mergedConfig));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, stubMode: mergedConfig.stubMode });
  });

  return app;
}

describe('LLM Gateway', () => {
  describe('GET /health', () => {
    it('должен вернуть 200 с ok:true', async () => {
      const app = createTestApp();
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.stubMode).toBe(true);
    });
  });

  describe('POST /v1/chat/completions', () => {
    it('должен вернуть 200 при валидном запросе (stubMode)', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hello' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.object).toBe('chat.completion');
      expect(res.body.choices).toHaveLength(1);
      expect(res.body.choices[0].message.content).toContain('STUB');
      expect(res.body.usage).toBeDefined();
    });

    it('должен вернуть 400 при отсутствии messages', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/v1/chat/completions')
        .send({ model: 'deepseek-chat' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('должен вернуть 400 при пустом массиве messages', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/v1/chat/completions')
        .send({ messages: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('должен вернуть 400 при невалидном JSON', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/v1/chat/completions')
        .set('Content-Type', 'application/json')
        .send('not json');

      expect(res.status).toBe(400);
    });

    it('должен кэшировать ответы при одинаковом запросе', async () => {
      const app = createTestApp();
      const payload = {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Cache me' }],
      };

      const res1 = await request(app)
        .post('/v1/chat/completions')
        .send(payload);
      const res2 = await request(app)
        .post('/v1/chat/completions')
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      // Второй запрос должен вернуть кэшированный ответ (тот же id)
      expect(res2.body.id).toBe(res1.body.id);
    });

    it('должен ломаться при пустом body', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/v1/chat/completions')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/credits/check', () => {
    it('должен вернуть 200 с достаточными кредитами (stubMode)', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/v1/credits/check')
        .send({
          address: '0x' + 'a'.repeat(40),
          amount: '1',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.sufficient).toBe(true);
      expect(res.body.balance).toBe('1000');
    });

    it('должен вернуть 400 при отсутствии address', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/v1/credits/check')
        .send({ amount: '1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });
  });

  describe('response format', () => {
    it('должен возвращать корректный OpenAI-совместимый формат', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Test' },
          ],
          temperature: 0.5,
          max_tokens: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('object', 'chat.completion');
      expect(res.body).toHaveProperty('created');
      expect(res.body).toHaveProperty('model');
      expect(res.body).toHaveProperty('choices');
      expect(res.body).toHaveProperty('usage');
      expect(res.body.usage).toHaveProperty('prompt_tokens');
      expect(res.body.usage).toHaveProperty('completion_tokens');
      expect(res.body.usage).toHaveProperty('total_tokens');
    });
  });
});
