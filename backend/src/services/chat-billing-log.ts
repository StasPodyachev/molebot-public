/**
 * Логгер биллинга — append-only в OC_Obsidian/Daily/chat-billing.md
 * Формат: YYYY-MM-DD HH:mm | tokenId={N} | txHash={0x...} | {value} MNT | ANSWERED
 */

import { appendFile, mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const LOG_DIR = process.env.CHAT_BILLING_LOG_DIR ?? '/home/x/vault/Daily';
const LOG_FILE = join(LOG_DIR, 'chat-billing.md');

export async function logChatBilling(
  tokenId: bigint,
  txHash: `0x${string}`,
  value: bigint,
  status: 'ANSWERED' | 'REJECTED' = 'ANSWERED',
): Promise<void> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const valueEth = Number(value) / 1e18;
  const line = `${timestamp} | tokenId=${tokenId} | txHash=${txHash} | ${valueEth.toFixed(6)} MNT | ${status}\n`;

  // Создаём директорию если нет
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true });
  }

  // Создаём файл с заголовком если нет
  if (!existsSync(LOG_FILE)) {
    await writeFile(LOG_FILE, '# Chat Billing Log\n\n', 'utf-8');
  }

  try {
    await appendFile(LOG_FILE, line, 'utf-8');
  } catch (err) {
    console.warn('[chatBillingLog] Ошибка записи:', (err as Error).message);
  }
}
