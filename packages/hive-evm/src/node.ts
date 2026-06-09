/**
 * Libp2p нода с gossipsub для P2P сети Molebot EVM
 */

import { createLibp2p } from 'libp2p';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { tcp } from '@libp2p/tcp';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import type { Message, PubSub } from '@libp2p/interface';
import type { MessageEnvelope, HiveEVMConfig } from './types.js';
import { DEFAULT_HIVE_CONFIG } from './types.js';

export type MessageHandler = (msg: MessageEnvelope) => void;

/**
 * Создать libp2p ноду с gossipsub сервисом
 */
export async function createHiveNode(
  config: Partial<HiveEVMConfig> = {},
) {
  const cfg: HiveEVMConfig = { ...DEFAULT_HIVE_CONFIG, ...config };

  const node = await createLibp2p({
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${cfg.port}`],
    },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      pubsub: gossipsub({
        allowPublishToZeroTopicPeers: cfg.allowPublishToZeroPeers,
        emitSelf: false,
      }),
    },
  });

  return node;
}

/**
 * Подписаться на входящие сообщения из gossipsub топика
 */
export function subscribeToTopic(
  pubsub: PubSub,
  topic: string,
  handler: MessageHandler,
): void {
  pubsub.subscribe(topic);

  pubsub.addEventListener('message', (evt: CustomEvent<Message>) => {
    const msg = evt.detail;

    if (msg.type !== 'signed') return;

    if (msg.topic !== topic) return;

    try {
      const decoded = new TextDecoder().decode(msg.data);
      const envelope: MessageEnvelope = JSON.parse(decoded);
      handler(envelope);
    } catch (err) {
      console.error(`[hive-evm] Failed to parse message on ${topic}:`, err);
    }
  });
}

/**
 * Опубликовать сообщение в gossipsub топик
 */
export async function publishToTopic(
  pubsub: PubSub,
  topic: string,
  envelope: MessageEnvelope,
): Promise<void> {
  const raw = new TextEncoder().encode(JSON.stringify(envelope));
  await pubsub.publish(topic, raw);
}

/**
 * Получить multiaddr ноды как строку
 */
export function getNodeAddress(node: { getMultiaddrs(): { toString(): string }[] }): string {
  const addrs = node.getMultiaddrs();
  return addrs.length > 0 ? addrs[0].toString() : '';
}
