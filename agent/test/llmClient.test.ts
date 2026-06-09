/**
 * Тесты LLMClient — HTTP-клиент к LLM Gateway
 *
 * Проверяет:
 * - Успешный запрос к Gateway
 * - Таймаут
 * - 5xx ошибка Gateway
 * - Невалидный ответ
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMClient } from '../src/services/llmClient.js';

describe('LLMClient', () => {
  const GATEWAY_URL = 'http://localhost:3010';
  let client: LLMClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    client = new LLMClient(GATEWAY_URL);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const validResponse = {
    choices: [{ message: { content: 'Hello from Gateway!' } }],
    model: 'deepseek-chat',
  };

  it('должен успешно отправить запрос и получить ответ', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validResponse),
    });

    const result = await client.chat({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.content).toBe('Hello from Gateway!');
    expect(result.model).toBe('deepseek-chat');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${GATEWAY_URL}/v1/chat/completions`,
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('должен отправлять корректный body в Gateway', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validResponse),
    });

    await client.chat({
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Test message' },
      ],
      temperature: 0.5,
      max_tokens: 100,
    });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);

    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.messages).toHaveLength(2);
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(100);
  });

  it('должен бросить ошибку при HTTP 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    await expect(
      client.chat({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow('LLM Gateway error (500)');
  });

  it('должен бросить ошибку при HTTP 502', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('Bad Gateway'),
    });

    await expect(
      client.chat({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow('LLM Gateway error (502)');
  });

  it('должен бросить ошибку при таймауте', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

    await expect(
      client.chat({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow('timeout');
  });

  it('должен бросить ошибку при невалидном JSON в ответе', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}), // нет choices
    });

    await expect(
      client.chat({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow('invalid response format');
  });

  it('должен бросать ошибку при network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      client.chat({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('должен убирать trailing slash из gatewayUrl', () => {
    const c = new LLMClient('http://localhost:3010///');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validResponse),
    });

    c.chat({ messages: [{ role: 'user', content: 'Hi' }] });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3010/v1/chat/completions',
      expect.any(Object),
    );
  });
});
