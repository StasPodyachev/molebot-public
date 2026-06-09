/**
 * sessionStore — in-memory хранилище чат-сессий (FE-24)
 *
 * Одна сессия = один tokenId подписал "разрешаю spendLimit сообщений".
 * После каждого сообщения used++ пока used < spendLimit.
 * При исчерпании — нужна новая сессия.
 */

import type { ChatSessionData } from '../types.js';

export class SessionStore {
  private sessions = new Map<number, ChatSessionData>();

  /**
   * Создать новую сессию или перезаписать существующую.
   */
  createSession(
    tokenId: number,
    spendLimit: number,
    signer: `0x${string}`,
  ): ChatSessionData {
    const session: ChatSessionData = {
      tokenId,
      spendLimit,
      used: 0,
      signer,
      createdAt: Math.floor(Date.now() / 1000),
    };
    this.sessions.set(tokenId, session);
    return session;
  }

  /**
   * Использовать одно сообщение из квоты сессии.
   * Возвращает { ok: true, remaining } или { ok: false }.
   */
  useMessage(tokenId: number): { ok: true; remaining: number; spendLimit: number } | { ok: false; error: string } {
    const session = this.sessions.get(tokenId);
    if (!session) {
      return { ok: false, error: 'No active session. Sign a session first.' };
    }
    if (session.used >= session.spendLimit) {
      return { ok: false, error: `Session exhausted: ${session.used}/${session.spendLimit} messages used.` };
    }
    session.used++;
    return {
      ok: true,
      remaining: session.spendLimit - session.used,
      spendLimit: session.spendLimit,
    };
  }

  /**
   * Получить текущую квоту для tokenId.
   */
  getQuota(tokenId: number): { remaining: number; spendLimit: number; active: boolean } {
    const session = this.sessions.get(tokenId);
    if (!session) {
      return { remaining: 0, spendLimit: 0, active: false };
    }
    const remaining = Math.max(0, session.spendLimit - session.used);
    return {
      remaining,
      spendLimit: session.spendLimit,
      active: remaining > 0,
    };
  }

  /**
   * Проверить, есть ли активная сессия с неисчерпанной квотой.
   */
  hasActiveQuota(tokenId: number): boolean {
    const session = this.sessions.get(tokenId);
    if (!session) return false;
    return session.used < session.spendLimit;
  }

  /** Удалить сессию (для тестов/сброса) */
  deleteSession(tokenId: number): void {
    this.sessions.delete(tokenId);
  }

  /** Сколько сессий в памяти */
  get size(): number {
    return this.sessions.size;
  }
}
