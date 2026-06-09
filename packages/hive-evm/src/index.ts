/**
 * Hive EVM — P2P gossipsub сеть для Molebot на EVM (Mantle)
 *
 * Позволяет двум кротам общаться через libp2p gossipsub:
 * 1. Подписать сообщение EVM-ключом (EIP-191)
 * 2. Опубликовать через gossipsub
 * 3. Получить и верифицировать подпись
 */

export { createHiveNode, subscribeToTopic, publishToTopic, getNodeAddress } from './node.js';
export type { MessageHandler } from './node.js';
export { signMessage, recoverAddress } from './sign.js';
export { verifyEnvelope, buildSignPayload } from './verify.js';
export type { MessageEnvelope, HiveEVMConfig, HiveNodeAPI } from './types.js';
export { DEFAULT_TOPIC, DEFAULT_HIVE_CONFIG } from './types.js';
