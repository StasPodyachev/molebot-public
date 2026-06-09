/**
 * LLMClient — отправка запросов к LLM Gateway (C-AI-02)
 *
 * Если Gateway недоступен или не настроен — возвращает null
 * (агент падает с ошибкой согласно C-AI-03 AC)
 */

export interface LLMRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
}

export class LLMClient {
  private gatewayUrl: string;

  constructor(gatewayUrl: string) {
    this.gatewayUrl = gatewayUrl.replace(/\/+$/, '');
  }

  /**
   * Отправить запрос к LLM Gateway
   * @throws Error если Gateway недоступен
   */
  async chat(req: LLMRequest): Promise<LLMResponse> {
    const url = `${this.gatewayUrl}/v1/chat/completions`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.max_tokens ?? 512,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM Gateway error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as {
        choices: { message: { content: string } }[];
        model: string;
      };

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('LLM Gateway: invalid response format');
      }

      return {
        content: data.choices[0].message.content,
        model: data.model ?? 'unknown',
      };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('LLM Gateway: timeout (10s)');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
