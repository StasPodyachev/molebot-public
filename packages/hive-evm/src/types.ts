/**
 * Hive EVM — типы для P2P gossipsub сети Molebot
 */

export interface MessageEnvelope {
  /** EVM адрес отправителя (0x...) */
  sender: string;
  /** Тело сообщения (JSON) */
  message: string;
  /** EIP-191 подпись (65 байт hex) */
  signature: string;
  /** Unix timestamp (seconds) */
  timestamp: number;
  /** Топик */
  topic: string;
}

export interface HiveEVMConfig {
  /** Порт для libp2p (0 = случайный) */
  port: number;
  /** Массив bootstrap peer multiaddr */
  bootstrapPeers: string[];
  /** Топик по умолчанию */
  topic: string;
  /** Разрешить публикацию без подключенных пиров */
  allowPublishToZeroPeers: boolean;
}

export const DEFAULT_TOPIC = 'molebot/v1';

export const DEFAULT_HIVE_CONFIG: HiveEVMConfig = {
  port: 0,
  bootstrapPeers: [],
  topic: DEFAULT_TOPIC,
  allowPublishToZeroPeers: true,
};

export interface HiveNodeAPI {
  /** Запустить ноду */
  start(): Promise<void>;
  /** Остановить ноду */
  stop(): Promise<void>;
  /** Опубликовать сообщение в топик */
  publish(topic: string, envelope: MessageEnvelope): Promise<void>;
  /** Подписаться на входящие сообщения */
  subscribe(topic: string, handler: (msg: MessageEnvelope) => void): void;
  /** Отписаться */
  unsubscribe(topic: string): void;
  /** Получить список пиров */
  getPeers(): string[];
}
