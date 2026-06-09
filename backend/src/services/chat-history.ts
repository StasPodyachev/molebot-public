/**
 * Хранилище истории чата с Chroma (persistent client)
 * Коллекция: molebot_chat_{tokenId}
 *
 * Если Chroma недоступен — fallback на JSON-файлы
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mood?: number;
  createdAt: number; // unix ms
}

const DATA_DIR = process.env.CHAT_HISTORY_DIR ?? './data/chat-history';

// ---- Chroma клиент (lazy init) ----
let chromaClient: any = null;
let chromaReady = false;

async function getChromaClient(): Promise<any> {
  if (chromaReady) return chromaClient;
  try {
    const { ChromaClient } = await import('chromadb');
    chromaClient = new ChromaClient({ path: 'http://localhost:8000' });
    // Проверяем heartbeat
    await chromaClient.heartbeat();
    chromaReady = true;
    return chromaClient;
  } catch (err) {
    console.warn('[chatHistory] Chroma недоступен, fallback на JSON:', (err as Error).message);
    return null;
  }
}

async function getOrCreateCollection(tokenId: bigint): Promise<any | null> {
  const client = await getChromaClient();
  if (!client) return null;
  const name = `molebot_chat_${tokenId}`;
  try {
    return await client.getOrCreateCollection({ name });
  } catch {
    return null;
  }
}

// ---- JSON fallback ----
function jsonPath(tokenId: bigint): string {
  return join(DATA_DIR, `chat-${tokenId}.json`);
}

async function ensureDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function readJsonHistory(tokenId: bigint): Promise<ChatMessageRecord[]> {
  await ensureDir();
  const path = jsonPath(tokenId);
  if (!existsSync(path)) return [];
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as ChatMessageRecord[];
  } catch {
    return [];
  }
}

async function writeJsonHistory(tokenId: bigint, messages: ChatMessageRecord[]): Promise<void> {
  await ensureDir();
  const path = jsonPath(tokenId);
  // Храним последние 50 сообщений
  const trimmed = messages.slice(-50);
  await writeFile(path, JSON.stringify(trimmed, null, 2), 'utf-8');
}

// ---- Public API ----

export async function addMessage(
  tokenId: bigint,
  role: 'user' | 'assistant',
  text: string,
  mood?: number,
): Promise<void> {
  const record: ChatMessageRecord = {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    mood,
    createdAt: Date.now(),
  };

  // Пробуем Chroma
  const collection = await getOrCreateCollection(tokenId);
  if (collection) {
    try {
      await collection.add({
        ids: [record.id],
        metadatas: [{
          role: record.role,
          mood: record.mood ?? 1,
          createdAt: record.createdAt,
        }],
        documents: [record.text],
      });
      return;
    } catch (err) {
      console.warn('[chatHistory] Chroma add error, fallback:', (err as Error).message);
    }
  }

  // Fallback на JSON
  const history = await readJsonHistory(tokenId);
  history.push(record);
  await writeJsonHistory(tokenId, history);
}

export async function getHistory(
  tokenId: bigint,
  limit = 50,
): Promise<ChatMessageRecord[]> {
  // Пробуем Chroma
  const collection = await getOrCreateCollection(tokenId);
  if (collection) {
    try {
      const result = await collection.get({ limit });
      const records: ChatMessageRecord[] = [];
      for (let i = 0; i < result.ids.length; i++) {
        records.push({
          id: result.ids[i],
          role: (result.metadatas?.[i]?.role as 'user' | 'assistant') ?? 'user',
          text: result.documents?.[i] ?? '',
          mood: (result.metadatas?.[i]?.mood as number) ?? 1,
          createdAt: (result.metadatas?.[i]?.createdAt as number) ?? 0,
        });
      }
      return records;
    } catch {
      // fallback
    }
  }

  // Fallback на JSON
  const history = await readJsonHistory(tokenId);
  return history.slice(-limit);
}
