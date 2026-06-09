/**
 * Проверка EVM подписи сообщения
 */

import { recoverAddress } from './sign.js';
import type { MessageEnvelope } from './types.js';

/**
 * Проверить что MessageEnvelope имеет валидную EIP-191 подпись
 * @returns true если подпись соответствует sender адресу
 */
export function verifyEnvelope(envelope: MessageEnvelope): boolean {
  try {
    const payload = buildSignPayload(envelope);
    const recovered = recoverAddress(payload, envelope.signature);

    // Сравниваем адреса (case-insensitive, т.к. ethers может вернуть checksummed)
    return recovered.toLowerCase() === envelope.sender.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Собрать payload для верификации (то же самое что подписывали)
 * Включает message, timestamp, topic — защита от replay
 */
export function buildSignPayload(envelope: Omit<MessageEnvelope, 'signature'>): string {
  return JSON.stringify({
    message: envelope.message,
    timestamp: envelope.timestamp,
    topic: envelope.topic,
  });
}
