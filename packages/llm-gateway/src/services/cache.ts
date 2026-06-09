import { type ChatRequest, type ChatResponse, type CacheEntry } from '../types.js';

/**
 * In-memory кэш для LLM ответов с TTL
 * Для хакатона Redis не обязателен
 */
export class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private ttlMs: number;

  constructor(ttlSec: number) {
    this.ttlMs = ttlSec * 1000;
  }

  /** Генерация ключа кэша из запроса */
  private makeKey(req: ChatRequest): string {
    return JSON.stringify({
      model: req.model,
      messages: req.messages,
      temperature: req.temperature,
    });
  }

  /** Получить кэшированный ответ */
  get(req: ChatRequest): ChatResponse | null {
    const key = this.makeKey(req);
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  /** Сохранить ответ в кэш */
  set(req: ChatRequest, response: ChatResponse): void {
    const key = this.makeKey(req);
    this.cache.set(key, { response, timestamp: Date.now() });
  }

  /** Очистка просроченных записей */
  clean(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.cache.size;
  }
}
