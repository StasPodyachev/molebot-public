/**
 * Тесты Hive EVM:
 * 1. Подпись + верификация — подписать сообщение EVM-ключом, верифицировать адрес
 * 2. verifyEnvelope — проверка целостности MessageEnvelope
 * 3. Publish + subscribe — через модульные тесты
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Wallet } from 'ethers';
import { signMessage, recoverAddress } from '../src/sign.js';
import { verifyEnvelope, buildSignPayload } from '../src/verify.js';
import type { MessageEnvelope } from '../src/types.js';
import { DEFAULT_TOPIC } from '../src/types.js';

// Тестовый кошелек (детерминированный, только для тестов)
function createTestWallet(): Wallet {
  return Wallet.createRandom();
}

describe('HiveEVM — sign + verify', () => {
  let wallet: Wallet;
  let senderAddress: string;

  beforeEach(() => {
    wallet = createTestWallet();
    senderAddress = wallet.address;
  });

  it('должен подписать и верифицировать сообщение', () => {
    const message = '{"action":"hello","data":"test"}';

    const signature = signMessage(wallet, message);
    expect(signature).toBeDefined();
    expect(signature).toMatch(/^0x[a-f0-9]{130}$/); // 65 байт = 130 hex chars

    const recovered = recoverAddress(message, signature);
    expect(recovered.toLowerCase()).toBe(senderAddress.toLowerCase());
  });

  it('должен корректно подписать и верифицировать другое сообщение', () => {
    const message = 'hello';
    const wrongMessage = 'wrong message';

    // Подписываем wrongMessage
    const signature = signMessage(wallet, wrongMessage);

    // recoverAddress восстановит адрес подписавшего (для wrongMessage)
    const recovered = recoverAddress(wrongMessage, signature);
    expect(recovered.toLowerCase()).toBe(senderAddress.toLowerCase());
  });
});

describe('HiveEVM — verifyEnvelope', () => {
  let wallet: Wallet;
  let senderAddress: string;

  beforeEach(() => {
    wallet = Wallet.createRandom();
    senderAddress = wallet.address;
  });

  function createEnvelope(overrides: Partial<MessageEnvelope> = {}): MessageEnvelope {
    const message = '{"price":"100","pair":"USDC/MNT"}';
    const timestamp = Math.floor(Date.now() / 1000);

    // Подписываем payload = {message, timestamp, topic}
    const payload = buildSignPayload({
      message,
      timestamp,
      topic: DEFAULT_TOPIC,
      sender: senderAddress,
    });
    const signature = signMessage(wallet, payload);

    return {
      sender: senderAddress,
      message,
      signature,
      timestamp,
      topic: DEFAULT_TOPIC,
      ...overrides,
    };
  }

  it('должен проверить валидный MessageEnvelope', () => {
    const envelope = createEnvelope();
    const valid = verifyEnvelope(envelope);
    expect(valid).toBe(true);
  });

  it('должен отклонить MessageEnvelope с подделанным sender', () => {
    const envelope = createEnvelope();
    // Меняем sender на другой адрес
    const otherWallet = Wallet.createRandom();
    envelope.sender = otherWallet.address;

    const valid = verifyEnvelope(envelope);
    expect(valid).toBe(false);
  });

  it('должен отклонить MessageEnvelope с подделанным message', () => {
    const envelope = createEnvelope();
    // Меняем message после подписи
    envelope.message = '{"price":"999999"}';

    const valid = verifyEnvelope(envelope);
    expect(valid).toBe(false);
  });

  it('должен отклонить MessageEnvelope с подделанным timestamp', () => {
    const envelope = createEnvelope();
    // Меняем timestamp после подписи
    envelope.timestamp = 9999999999;

    const valid = verifyEnvelope(envelope);
    expect(valid).toBe(false);
  });

  it('должен отклонить MessageEnvelope с поддельной подписью', () => {
    // Создаём envelope с подписью от другого payload
    const message = 'hello';
    const wrongMessage = 'wrong message';

    const wrongPayload = buildSignPayload({
      message: wrongMessage,
      timestamp: 1000,
      topic: 'test',
      sender: senderAddress,
    });
    const wrongSig = signMessage(wallet, wrongPayload);

    const result = verifyEnvelope({
      sender: senderAddress,
      message,
      signature: wrongSig,
      timestamp: 1000,
      topic: 'test',
    });
    expect(result).toBe(false);
  });
});

describe('HiveEVM — buildSignPayload', () => {
  it('должен правильно собрать payload для подписи', () => {
    const payload = buildSignPayload({
      message: 'test',
      timestamp: 1000,
      topic: DEFAULT_TOPIC,
      sender: '0x0000000000000000000000000000000000000000',
    });

    const parsed = JSON.parse(payload);
    expect(parsed.message).toBe('test');
    expect(parsed.timestamp).toBe(1000);
    expect(parsed.topic).toBe(DEFAULT_TOPIC);
  });
});

describe('HiveEVM — конфиг по умолчанию', () => {
  it('должен возвращать конфиг по умолчанию', async () => {
    const mod = await import('../src/types.js');
    expect(mod.DEFAULT_TOPIC).toBe('molebot/v1');
    expect(mod.DEFAULT_HIVE_CONFIG.port).toBe(0);
    expect(mod.DEFAULT_HIVE_CONFIG.allowPublishToZeroPeers).toBe(true);
  });

  it('должен экспортировать функции sign и verify', async () => {
    const signMod = await import('../src/sign.js');
    expect(typeof signMod.signMessage).toBe('function');
    expect(typeof signMod.recoverAddress).toBe('function');

    const verifyMod = await import('../src/verify.js');
    expect(typeof verifyMod.verifyEnvelope).toBe('function');
    expect(typeof verifyMod.buildSignPayload).toBe('function');
  });
});
