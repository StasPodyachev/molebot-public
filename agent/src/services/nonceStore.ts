/**
 * Nonce-реестр (usedTxHashes)
 * Redis SET NX (атомарно) + SQLite fallback
 */

import { createRequire } from 'module';
import type { AppConfig } from '../config.js';

const _require = createRequire(import.meta.url);

export interface NonceStore {
  /**
   * Атомарная проверка + отметка txHash как использованного.
   * Возвращает true если txHash был успешно добавлен (ранее не использован).
   * Возвращает false если txHash уже существует (уже использован).
   */
  checkAndAdd(txHash: `0x${string}`): Promise<boolean>;
  /** Закрыть соединения */
  close(): Promise<void>;
}

/**
 * Нормализованный ключ для txHash
 */
function key(txHash: `0x${string}`): string {
  return `chat:used:${txHash.toLowerCase()}`;
}

/**
 * Redis-based nonce store — использует SET NX (атомарно)
 */
class RedisNonceStore implements NonceStore {
  private redis: import('ioredis').Redis | null = null;
  private ttlSec: number;
  private ready = false;
  private _closed = false;

  constructor(url: string, ttlSec: number) {
    this.ttlSec = ttlSec;
    import('ioredis').then(mod => {
      if (this._closed) return; // уже закрыт — не создаём
      this.redis = new mod.default(url);
      this.ready = true;
    }).catch(err => {
      console.warn('[nonceStore] Redis недоступен:', err.message);
    });
  }

  private async getRedis(): Promise<import('ioredis').Redis> {
    for (let i = 0; i < 50; i++) {
      if (this.redis) return this.redis;
      if (this._closed) throw new Error('Redis closed');
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Redis not connected');
  }

  /**
   * Атомарная проверка + добавление через SET NX.
   * SET NX устанавливает ключ только если его нет — идеально для nonce.
   */
  async checkAndAdd(txHash: `0x${string}`): Promise<boolean> {
    const r = await this.getRedis();
    const result = await r.set(key(txHash), '1', 'EX', this.ttlSec, 'NX');
    return result === 'OK';
  }

  async close(): Promise<void> {
    this._closed = true;
    this.redis?.disconnect();
    this.redis = null;
  }
}

/**
 * SQLite-based nonce store — использует INSERT OR IGNORE (атомарно)
 */
class SqliteNonceStore implements NonceStore {
  private db: import('better-sqlite3').Database | null = null;
  private dbPath: string;
  private ttlSec: number;
  private ready = false;

  constructor(dbPath: string, ttlSec: number) {
    this.dbPath = dbPath;
    this.ttlSec = ttlSec;
  }

  private init(): import('better-sqlite3').Database {
    const existing = this.db;
    if (this.ready && existing) return existing;
    const BetterSqlite3 = _require('better-sqlite3');
    const db = new BetterSqlite3(this.dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS used_tx (
        tx_hash TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      )
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_used_tx_created ON used_tx(created_at)
    `);
    db.prepare('DELETE FROM used_tx WHERE created_at < ?').run(Date.now() - this.ttlSec * 1000);
    this.db = db;
    this.ready = true;
    return db;
  }

  /**
   * Атомарная проверка + добавление через INSERT OR IGNORE.
   * Возвращает true если строка была вставлена (txHash новый).
   */
  async checkAndAdd(txHash: `0x${string}`): Promise<boolean> {
    const db = this.init();
    const info = db.prepare('INSERT OR IGNORE INTO used_tx (tx_hash, created_at) VALUES (?, ?)').run(key(txHash), Date.now());
    return info.changes > 0;
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}

/**
 * Composite nonce store — пробует Redis, падает на SQLite
 */
export class CompositeNonceStore implements NonceStore {
  private primary: NonceStore | null = null;
  private fallback: SqliteNonceStore;
  private config: AppConfig;
  private warningLogged = false;

  constructor(config: AppConfig) {
    this.config = config;
    this.fallback = new SqliteNonceStore(config.sqlitePath, config.redisTtlSec);
  }

  private async getPrimary(): Promise<NonceStore> {
    if (this.primary) return this.primary;

    if (this.config.redisUrl) {
      try {
        this.primary = new RedisNonceStore(this.config.redisUrl, this.config.redisTtlSec);
        return this.primary;
      } catch (err) {
        if (!this.warningLogged) {
          console.warn('[nonceStore] Redis недоступен, fallback на SQLite:', (err as Error).message);
          this.warningLogged = true;
        }
      }
    }
    this.primary = this.fallback;
    return this.fallback;
  }

  /**
   * Атомарная операция: проверить И добавить.
   * Потокобезопасно — double-spend невозможен даже при конкурентных запросах.
   */
  async checkAndAdd(txHash: `0x${string}`): Promise<boolean> {
    const store = await this.getPrimary();
    try {
      return await store.checkAndAdd(txHash);
    } catch (err) {
      if (!this.warningLogged) {
        console.warn('[nonceStore] Primary store error, fallback на SQLite:', (err as Error).message);
        this.warningLogged = true;
      }
      return this.fallback.checkAndAdd(txHash);
    }
  }

  async close(): Promise<void> {
    await this.primary?.close();
    await this.fallback.close();
  }
}
