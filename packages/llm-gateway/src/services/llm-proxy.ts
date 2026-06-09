import { type ChatRequest, type ChatResponse } from '../types.js';
import { type GatewayConfig } from '../config.js';

/**
 * Сервис для проксирования запросов к LLM провайдеру (DeepSeek)
 * stubMode=false — реальный прокси к DeepSeek API
 */
export class LLMProxyService {
  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  /** Отправить запрос к LLM */
  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (this.config.stubMode) {
      return this.stubResponse(req);
    }
    return this.proxyToLLM(req);
  }

  /** Заглушка: возвращает мок-ответ (только когда LLM_STUB_MODE=true) */
  private stubResponse(req: ChatRequest): ChatResponse {
    const lastMsg = req.messages[req.messages.length - 1]?.content ?? '';
    const model = req.model ?? this.config.defaultModel;

    console.log('[llm-proxy] ⚠️ stubMode active — returning mock response');

    return {
      id: `stub-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `[STUB] LLM Gateway заглушка. Получено сообщение: "${lastMsg.slice(0, 80)}..."\n` +
              `⚠️ LLM_STUB_MODE=true. Выключи для production.`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: lastMsg.length,
        completion_tokens: 30,
        total_tokens: lastMsg.length + 30,
      },
    };
  }

  /** Реальный прокси к LLM провайдеру (DeepSeek) */
  private async proxyToLLM(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? this.config.defaultModel;

    console.log(`[llm-proxy] → ${this.config.llmProviderUrl} model=${model}`);

    const response = await fetch(`${this.config.llmProviderUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.llmApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.max_tokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM provider error (${response.status}): ${errorText}`);
    }

    const result = await response.json() as ChatResponse;
    console.log(`[llm-proxy] ← ${model} ok tokens=${result.usage?.total_tokens}`);
    return result;
  }
}
