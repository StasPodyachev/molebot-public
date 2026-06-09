/**
 * chatHistoryStore — ChromaDB для истории сообщений
 *
 * Коллекция: molebot_chat_{tokenId}
 * Фикс по ревью:
 * - ensureCollection кешируется Set<string>
 * - getRecentEntries использует where (не metadatas)
 * - In-memory fallback сохраняется между вызовами
 */

import type { ChatHistoryEntry } from '../types.js';

const MAX_HISTORY = 50;

/**
 * In-memory fallback хранилище (ключ — tokenId)
 */
const memoryDb = new Map<number, ChatHistoryEntry[]>();

export class ChatHistoryStore {
  private baseUrl: string;
  private collectionPrefix = 'molebot_chat_';
  /** Кеш созданных коллекций — один HTTP запрос на создание */
  private ensuredCollections = new Set<string>();

  constructor(chromaUrl?: string) {
    this.baseUrl = (chromaUrl ?? process.env.CHROMA_URL ?? 'http://localhost:8000').replace(/\/$/, '');
  }

  private collectionName(tokenId: number): string {
    return `${this.collectionPrefix}${tokenId}`;
  }

  /**
   * Обеспечить существование коллекции (с кешем)
   */
  private async ensureCollection(tokenId: number): Promise<string | null> {
    const name = this.collectionName(tokenId);

    // Кеш — если уже создавали, не дёргаем Chroma
    if (this.ensuredCollections.has(name)) return name;

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      // 200 = created (or exists), 409 = already exists
      if (res.ok || res.status === 409) {
        this.ensuredCollections.add(name);
        return name;
      }
    } catch {
      // Chroma не запущен
    }
    this.ensuredCollections.add(name); // кешируем неудачу — не спамим
    return null;
  }

  /**
   * Добавить запись в историю
   */
  async addEntry(tokenId: number, entry: ChatHistoryEntry): Promise<void> {
    const name = await this.ensureCollection(tokenId);

    if (name) {
      // Chroma доступен — пишем туда
      const id = `${tokenId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        const res = await fetch(`${this.baseUrl}/api/v1/collections/${encodeURIComponent(name)}/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: [id],
            documents: [JSON.stringify(entry)],
            metadatas: [{
              tokenId,
              role: entry.role,
              mood: entry.mood,
              timestamp: entry.timestamp,
            }],
          }),
        });

        if (res.ok) {
          await this.trimHistory(tokenId, name);
          return;
        }
      } catch {
        // fallback
      }
    }

    // In-memory fallback
    if (!memoryDb.has(tokenId)) memoryDb.set(tokenId, []);
    const list = memoryDb.get(tokenId)!;
    list.push(entry);
    // Trim
    if (list.length > MAX_HISTORY) {
      memoryDb.set(tokenId, list.slice(-MAX_HISTORY));
    }
  }

  /**
   * Получить последние N записей
   */
  async getRecentEntries(tokenId: number, limit: number = MAX_HISTORY): Promise<ChatHistoryEntry[]> {
    const name = this.collectionName(tokenId);

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/collections/${encodeURIComponent(name)}/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit,
          where: { tokenId }, // ← исправлено: metadatas → where
          include: ['documents', 'metadatas'],
        }),
      });

      if (res.ok) {
        const data = await res.json() as { ids?: string[]; documents?: string[] };
        if (data.ids?.length) {
          const entries: ChatHistoryEntry[] = [];
          for (let i = 0; i < data.ids.length; i++) {
            try {
              const entry = JSON.parse(data.documents?.[i] ?? '') as ChatHistoryEntry;
              entries.push(entry);
            } catch { /* skip */ }
          }
          entries.sort((a, b) => a.timestamp - b.timestamp);
          return entries.slice(-limit);
        }
      }
    } catch {
      // fallback
    }

    // In-memory fallback
    const list = memoryDb.get(tokenId) ?? [];
    return list.slice(-limit);
  }

  /**
   * Обрезать историю Chroma до лимита
   */
  private async trimHistory(tokenId: number, collectionName: string): Promise<void> {
    try {
      // Сначала получаем все ID
      const res = await fetch(`${this.baseUrl}/api/v1/collections/${encodeURIComponent(collectionName)}/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 1000,
          where: { tokenId },
          include: ['metadatas'],
        }),
      });

      if (!res.ok) return;
      const data = await res.json() as { ids: string[]; metadatas?: Record<string, unknown>[] };

      if (!data.ids || data.ids.length <= MAX_HISTORY) return;

      // Сортируем по timestamp
      const sorted = data.ids
        .map((id, i) => ({ id, timestamp: (data.metadatas?.[i]?.timestamp as number) ?? 0 }))
        .sort((a, b) => a.timestamp - b.timestamp);

      // Удаляем самые старые
      const toDelete = sorted.slice(0, sorted.length - MAX_HISTORY).map(e => e.id);
      await fetch(`${this.baseUrl}/api/v1/collections/${encodeURIComponent(collectionName)}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: toDelete }),
      });
    } catch {
      // trim — не критично
    }
  }
}
