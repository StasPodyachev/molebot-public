/**
 * C-FE-01: Unit-тесты
 *
 * Acceptance criteria:
 * 1. parseMoleData — корректно парсит on-chain данные
 * 2. LEVEL_NAMES, MOOD_EMOJI — правильные константы
 * 3. chainId — соответствует Mantle Sepolia
 * 4. NFT_CONTRACT_ADDRESS — соответствует задеплоенному контракту
 */

import { describe, it, expect, vi } from 'vitest';
import { parseMoleData, LEVEL_NAMES, MOOD_EMOJI, MOOD_LABEL } from '../lib/mole-data';
import { NFT_CONTRACT_ADDRESS, MINT_PRICE_ETHER } from '../lib/contract';
import { MANTLE_CHAIN_ID, MANTLE_RPC_URL } from '../lib/mantle-chain';

// Mock Privy: useWallets возвращает фейковый кошелёк для тестов
vi.mock('@privy-io/react-auth', () => ({
  useWallets: () => ({
    wallets: [{
      walletClientType: 'privy',
      address: '0x' + 'a'.repeat(40),
      getEthereumProvider: () => Promise.resolve({
        request: ({ method, params }: any) => {
          if (method === 'eth_signTypedData_v4') {
            return Promise.resolve('0x' + 'f'.repeat(130) as `0x${string}`);
          }
          return Promise.resolve('0x');
        },
      }),
    }],
  }),
  usePrivy: () => ({ authenticated: false, user: null }),
  PrivyProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('C-FE-01: lib/mole-data', () => {

  // ── 1. parseMoleData ────────────────────────────────────────────────
  it('parseMoleData возвращает null при null raw данных', () => {
    expect(parseMoleData(1, null, false, '')).toBeNull();
  });

  it('parseMoleData парсит on-chain данные корректно', () => {
    const raw = {
      mood: 2,
      levelIndex: 3,
      cumulativePnl: 1500000n, // 1.5 USDC
      lastTradeTs: 1000n,
      isMythic: true,
    };

    const result = parseMoleData(42, raw, true, 'ipfs://test/42.json');

    expect(result).not.toBeNull();
    expect(result!.tokenId).toBe(42);
    // serialNumber == tokenId (в контракте отдельного поля нет)
    expect(result!.serialNumber).toBe(42);
    expect(result!.mood).toBe(2);
    expect(result!.levelIndex).toBe(3);
    expect(result!.levelName).toBe('Tunneler');
    expect(result!.cumulativePnl).toBeCloseTo(1.5, 5);
    expect(result!.isMythic).toBe(true);
    expect(result!.hasRevealed).toBe(true);
    expect(result!.tokenURI).toBe('ipfs://test/42.json');
  });

  // ── 2. LEVEL_NAMES ──────────────────────────────────────────────────
  it('LEVEL_NAMES содержит все 9 уровней', () => {
    expect(Object.keys(LEVEL_NAMES)).toHaveLength(9);
    expect(LEVEL_NAMES[0]).toBe('Slumbering Mole');
    expect(LEVEL_NAMES[8]).toBe('Shadow Mole');
  });

  // ── 3. MOOD_EMOJI ───────────────────────────────────────────────────
  it('MOOD_EMOJI содержит 3 настроения', () => {
    expect(MOOD_EMOJI[0]).toBe('😒');
    expect(MOOD_EMOJI[1]).toBe('😐');
    expect(MOOD_EMOJI[2]).toBe('😏');
  });

  it('MOOD_LABEL содержит подписи', () => {
    expect(MOOD_LABEL[0]).toBe('Угрюмый');
    expect(MOOD_LABEL[1]).toBe('Нейтральный');
    expect(MOOD_LABEL[2]).toBe('Дерзкий');
  });
});

describe('C-FE-01: lib/contract', () => {

  it('NFT_CONTRACT_ADDRESS соответствует задеплоенному контракту', () => {
    expect(NFT_CONTRACT_ADDRESS).toBe('0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb');
  });

  it('MINT_PRICE_ETHER = 0.05 MNT', () => {
    expect(MINT_PRICE_ETHER).toBe('0.05');
  });
});

describe('C-FE-01: lib/mantle-chain', () => {

  it('MANTLE_CHAIN_ID = 5003 (Mantle Sepolia)', () => {
    expect(MANTLE_CHAIN_ID).toBe(5003);
  });

  it('MANTLE_RPC_URL корректный', () => {
    expect(MANTLE_RPC_URL).toBe('https://rpc.sepolia.mantle.xyz');
  });
});

describe('C-FE-01: lib/abi', () => {

  it('ABI содержит ключевые функции контракта', async () => {
    const { MOLEBOT_NFT_ABI } = await import('../lib/abi');
    const abiStr = JSON.stringify(MOLEBOT_NFT_ABI);

    expect(abiStr).toContain('balanceOf');
    expect(abiStr).toContain('mint');
    expect(abiStr).toContain('getMoleData');
    expect(abiStr).toContain('MoleMinted');
  });
});

// =============================================================================
// FE-01: Component tests
// =============================================================================
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import MoleNFTCard from '../components/MoleNFTCard';
import MoleMintButton from '../components/MoleMintButton';
import ChatPanel from '../components/ChatPanel';

// Mock fetch для ChatPanel
const originalFetch = globalThis.fetch;

describe('FE-01: MoleNFTCard', () => {
  const mockNFT = {
    tokenId: 42,
    serialNumber: 7,
    mood: 2,
    levelIndex: 3,
    levelName: 'Tunneler',
    cumulativePnl: 1250.5,
    isMythic: false,
    hasRevealed: true,
    tokenURI: 'ipfs://test/42.json',
  };

  const mockMythicNFT = {
    ...mockNFT,
    serialNumber: 1,
    isMythic: true,
    levelIndex: 8,
    levelName: 'Shadow Mole',
  };

  it('рендерит серийный номер и имя уровня', () => {
    render(<MoleNFTCard nft={mockNFT} />);
    expect(screen.getByText('Molebot #7')).toBeDefined();
    expect(screen.getByText('Tunneler')).toBeDefined();
  });

  it('рендерит mood эмодзи для mood=2', () => {
    render(<MoleNFTCard nft={mockNFT} />);
    expect(screen.getByText('😏')).toBeDefined();
    expect(screen.getByText('Дерзкий')).toBeDefined();
  });

  it('рендерит PnL с цветом', () => {
    render(<MoleNFTCard nft={mockNFT} />);
    const pnl = screen.getByText('+1250.5 USDC');
    expect(pnl).toBeDefined();
    expect(pnl.className).toContain('mole-400');
  });

  it('рендерит tokenId и уровень', () => {
    render(<MoleNFTCard nft={mockNFT} />);
    expect(screen.getByText('#42')).toBeDefined();
    expect(screen.getByText('Lvl 3')).toBeDefined();
  });

  it('рендерит Mythic badge для мифического крота', () => {
    render(<MoleNFTCard nft={mockMythicNFT} />);
    expect(screen.getByText('Mythic')).toBeDefined();
    expect(screen.getByText('🌟')).toBeDefined();
    expect(screen.getByText('Shadow Mole')).toBeDefined();
  });

  it('рендерит обычную эмодзи для не-мифического', () => {
    render(<MoleNFTCard nft={mockNFT} />);
    expect(screen.getByText('🦔')).toBeDefined();
  });

  it('показывает IPFS metadata если revealed', () => {
    render(<MoleNFTCard nft={mockNFT} />);
    const link = screen.getByText('IPFS metadata');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toContain('ipfs.io');
  });

  it('не показывает IPFS metadata если не revealed', () => {
    const unrevealed = { ...mockNFT, hasRevealed: false };
    render(<MoleNFTCard nft={unrevealed} />);
    expect(screen.queryByText('IPFS metadata')).toBeNull();
  });

  it('рендерит отрицательный PnL красным', () => {
    const negative = { ...mockNFT, cumulativePnl: -500 };
    render(<MoleNFTCard nft={negative} />);
    const pnl = screen.getByText('-500 USDC');
    expect(pnl).toBeDefined();
    expect(pnl.className).toContain('red-400');
  });
});

describe('FE-01: MoleMintButton', () => {
  it('рендерит кнопку Mint с текстом', () => {
    render(
      <MoleMintButton
        minting={false}
        error={null}
        txHash={null}
        onMint={vi.fn()}
      />
    );
    expect(screen.getByText('Mint Molebot (0.05 MNT)')).toBeDefined();
  });

  it('показывает спиннер при minting=true', () => {
    render(
      <MoleMintButton minting={true} error={null} txHash={null} onMint={vi.fn()} />
    );
    expect(screen.getByText('Minting...')).toBeDefined();
  });

  it('вызывает onMint по клику', () => {
    const onMint = vi.fn();
    render(
      <MoleMintButton minting={false} error={null} txHash={null} onMint={onMint} />
    );
    fireEvent.click(screen.getByText('Mint Molebot (0.05 MNT)'));
    expect(onMint).toHaveBeenCalledOnce();
  });

  it('не вызывает onMint когда minting=true (disabled)', () => {
    const onMint = vi.fn();
    render(
      <MoleMintButton minting={true} error={null} txHash={null} onMint={onMint} />
    );
    fireEvent.click(screen.getByText('Minting...'));
    expect(onMint).not.toHaveBeenCalled();
  });

  it('показывает ошибку', () => {
    render(
      <MoleMintButton
        minting={false}
        error="Недостаточно MNT"
        txHash={null}
        onMint={vi.fn()}
      />
    );
    expect(screen.getByText('❌ Недостаточно MNT')).toBeDefined();
  });

  it('показывает txHash и ссылку на explorer', () => {
    const hash = '0x' + 'a'.repeat(64);
    render(
      <MoleMintButton
        minting={false}
        error={null}
        txHash={hash}
        onMint={vi.fn()}
      />
    );
    expect(screen.getByText('✅ Транзакция отправлена!')).toBeDefined();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toContain(hash);
  });

  it('не показывает txHash когда он null', () => {
    render(
      <MoleMintButton
        minting={false}
        error={null}
        txHash={null}
        onMint={vi.fn()}
      />
    );
    expect(screen.queryByText('✅ Транзакция отправлена!')).toBeNull();
  });
});

describe('FE-01: ChatPanel', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('рендерит заголовок с tokenId', () => {
    render(<ChatPanel tokenId={42} />);
    expect(screen.getByText('Molebot #42')).toBeDefined();
  });

  it('рендерит поле ввода и кнопку отправки', () => {
    render(<ChatPanel tokenId={1} />);
    const input = screen.getByPlaceholderText('Напиши кроту...');
    const button = screen.getByText('→');
    expect(input).toBeDefined();
    expect(button).toBeDefined();
  });

  it('показывает плейсхолдер при пустом чате', () => {
    render(<ChatPanel tokenId={1} />);
    expect(screen.getByText('Напиши что-нибудь своему кроту!')).toBeDefined();
  });

  it('добавляет сообщение пользователя при отправке', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        reply: 'Ответ от крота!',
        mood: 2,
        tokenId: 1,
      }),
    }) as unknown as typeof fetch;

    render(<ChatPanel tokenId={1} />);
    const input = screen.getByPlaceholderText('Напиши кроту...');
    fireEvent.change(input, { target: { value: 'Привет!' } });
    fireEvent.click(screen.getByText('→'));

    // Сообщение пользователя должно появиться
    const userMsg = await screen.findByText('Привет!');
    expect(userMsg).toBeDefined();
  });

  it('показывает ответ ассистента', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        reply: 'Molebot: роем дальше!',
        mood: 2,
        tokenId: 1,
      }),
    }) as unknown as typeof fetch;

    render(<ChatPanel tokenId={1} />);
    const input = screen.getByPlaceholderText('Напиши кроту...');
    fireEvent.change(input, { target: { value: 'го' } });
    fireEvent.click(screen.getByText('→'));

    const reply = await screen.findByText('Molebot: роем дальше!');
    expect(reply).toBeDefined();
  });

  it('показывает ошибку при network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

    render(<ChatPanel tokenId={1} />);
    const input = screen.getByPlaceholderText('Напиши кроту...');
    fireEvent.change(input, { target: { value: 'тест' } });
    fireEvent.click(screen.getByText('→'));

    const errMsg = await screen.findByText(/Network error/);
    expect(errMsg).toBeDefined();
  });

  it('показывает ошибку биллинга', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        ok: false,
        errorCode: 'INSUFFICIENT_CREDITS',
        errorMessage: 'Not enough AICredits',
      }),
    }) as unknown as typeof fetch;

    render(<ChatPanel tokenId={1} />);
    const input = screen.getByPlaceholderText('Напиши кроту...');
    fireEvent.change(input, { target: { value: 'тест' } });
    fireEvent.click(screen.getByText('→'));

    const errMsg = await screen.findByText(/INSUFFICIENT_CREDITS|Ошибка/);
    expect(errMsg).toBeDefined();
  });
});
