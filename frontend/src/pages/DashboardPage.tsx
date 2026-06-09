import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useParams } from 'react-router-dom';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useMoleNFT, useMintNFT } from '@/hooks/useMoleNFT';
import { MANTLE_CHAIN_ID } from '@/lib/mantle-chain';
import ChatPanel from '@/components/ChatPanel';
import StrategyPanel from '@/components/StrategyPanel';
import TradePanel from '@/components/TradePanel';
import StatsPanel from '@/components/StatsPanel';
import VaultBalance from '@/components/VaultBalance';
import DepositButton from '@/components/DepositButton';
import UserBalance from '@/components/UserBalance';
import MoleNFTCard from '@/components/MoleNFTCard';
import MoleMintButton from '@/components/MoleMintButton';

const EXPLORER_BASE = 'https://explorer.sepolia.mantle.xyz';

function MolebotLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#9945ff" />
      <ellipse cx="16" cy="17" rx="9" ry="8" fill="#1a1816" />
      <circle cx="12" cy="15" r="2.5" fill="white" />
      <circle cx="20" cy="15" r="2.5" fill="white" />
      <circle cx="12.8" cy="14.8" r="1" fill="#1a1816" />
      <circle cx="20.8" cy="14.8" r="1" fill="#1a1816" />
      <ellipse cx="16" cy="19.5" rx="2.5" ry="1.5" fill="#3d1f00" />
      <ellipse cx="16" cy="19" rx="1.5" ry="1" fill="#b06dff" opacity="0.6" />
      <ellipse cx="8" cy="21" rx="2.5" ry="1.5" fill="#1a1816" />
      <ellipse cx="24" cy="21" rx="2.5" ry="1.5" fill="#1a1816" />
      <path d="M5 26 Q16 22 27 26 L27 32 L5 32Z" fill="#2a1f10" opacity="0.7" />
    </svg>
  );
}

/**
 * DashboardPage — отдельная страница дашборда.
 * Маршрут: /dashboard/:tokenId
 *
 * Содержит:
 *   - Авторизация (проверяется в RequireAuth выше)
 *   - NFT-карточка крота
 *   - Баланс MNT
 *   - Кнопка минта / статус
 *   - Чат с кротом
 */
export default function DashboardPage() {
  const { tokenId: routeTokenId } = useParams<{ tokenId: string }>();
  const { logout } = usePrivy();
  const { wallets } = useWallets();
  const evmWallet = wallets.find((w) => w.walletClientType === 'privy');
  const userAddress = (evmWallet?.address?.toLowerCase()) as `0x${string}` | undefined;

  const { nft, loading: nftLoading, error: nftError, hasMinted, refresh } = useMoleNFT(userAddress ?? null, Number(routeTokenId ?? 0) || null);
  const { mint, minting, mintError } = useMintNFT();
  const [mintTx, setMintTx] = useState<string | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const ensureCorrectChain = useCallback(async (): Promise<ethers.BrowserProvider | null> => {
    if (!evmWallet) {
      setChainError('Кошелёк не найден.');
      return null;
    }
    try {
      const p = await evmWallet.getEthereumProvider();
      const ep = new ethers.BrowserProvider(p);
      const n = await ep.getNetwork();
      if (Number(n.chainId) !== MANTLE_CHAIN_ID) {
        try {
          await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x138B' }] });
        } catch {
          setChainError('Требуется переключиться на Mantle Sepolia.');
          return null;
        }
      }
      return ep;
    } catch {
      setChainError('Не удалось проверить сеть.');
      return null;
    }
  }, [evmWallet]);

  const handleMint = useCallback(async () => {
    setChainError(null);
    setMintTx(null);
    const provider = await ensureCorrectChain();
    if (!provider) return;
    try {
      const receipt = await mint(provider);
      const hash = receipt?.hash ?? (receipt as any)?.transactionHash ?? null;
      if (hash) setMintTx(hash);
      await refresh();
    } catch {
      /* mintError внутри хука */
    }
  }, [ensureCorrectChain, mint, refresh]);

  return (
    <div className="bg-bg text-text font-sans antialiased min-h-dvh overflow-x-hidden">
      <header className="landing-header">
        <div className="landing-header__inner">
          <div className="landing-header__brand" onClick={() => window.location.href = '/'} style={{cursor: 'pointer'}}>
            <MolebotLogo size={28} /> molebot
          </div>
          <nav className="landing-header__nav">
            <span className="text-xs text-gray-500">Token #{routeTokenId ?? '—'}</span>
            <button className="btn btn-primary" onClick={() => logout()}>
              Выйти
            </button>
          </nav>
        </div>
      </header>

      <section className="section-container" style={{ paddingTop: '6rem' }}>
        <p className="section-label">Дашборд</p>

        {nftLoading && <p className="text-text-muted text-center">Загружаем твоего крота…</p>}

        {!nftLoading && hasMinted && nft ? (
          <>
            <div className="dashboard-grid">
              <MoleNFTCard nft={nft} />
              <div className="dashboard-sidebar">
                {userAddress && <UserBalance address={userAddress} />}

                {/* FE-34: Vault balance + deposit */}
                {nft && (
                  <div className="space-y-2">
                    <VaultBalance tokenId={nft.tokenId} apiBase={import.meta.env.VITE_API_BASE_URL} />
                    <DepositButton tokenId={nft.tokenId} onDeposited={() => {
                      // Force re-mount to refresh vault balance
                      window.dispatchEvent(new Event('vault-deposit'));
                    }} />
                  </div>
                )}

                <MoleMintButton
                  minting={minting}
                  error={mintError ?? chainError}
                  txHash={mintTx}
                  onMint={handleMint}
                  explorerTx={(hash) => `${EXPLORER_BASE}/tx/${hash}`}
                />
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowChat(!showChat)}
                  style={{ width: '100%' }}
                >
                  {showChat ? 'Скрыть чат' : 'Чат с кротом 🗣️'}
                </button>
              </div>
            </div>

            {/* FE-29: Strategy panel */}
            <div className="mt-6 max-w-[500px]">
              <StrategyPanel tokenId={nft.tokenId} apiBase={import.meta.env.VITE_API_BASE_URL} />
            </div>

            {/* FE-30: Trade panel */}
            <div className="mt-6 max-w-[500px]">
              <TradePanel tokenId={nft.tokenId} apiBase={import.meta.env.VITE_API_BASE_URL} />
            </div>

            {/* FE-31: Stats panel */}
            <div className="mt-6 max-w-[500px]">
              <StatsPanel tokenId={nft.tokenId} apiBase={import.meta.env.VITE_API_BASE_URL} />
            </div>
          </>
        ) : (
          !nftLoading && (
            <div className="dashboard-empty" style={{ textAlign: 'center' }}>
              <p className="text-text-muted mb-4">У тебя пока нет крота.</p>
              <MoleMintButton
                minting={minting}
                error={mintError ?? chainError}
                txHash={mintTx}
                onMint={handleMint}
                explorerTx={(hash) => `${EXPLORER_BASE}/tx/${hash}`}
              />
            </div>
          )
        )}

        {showChat && nft && (
          <div className="section-container">
            <ChatPanel tokenId={nft.tokenId} apiBase={import.meta.env.VITE_API_BASE_URL} />
          </div>
        )}

        {nftError && <p className="text-error text-sm mt-4 text-center">{nftError}</p>}
      </section>

      <footer className="landing-footer">
        <div className="section-container">
          <div className="landing-footer__inner">
            <div className="landing-footer__brand">
              <MolebotLogo size={20} /> molebot
            </div>
            <div className="landing-footer__links">
              <a href="https://github.com/StasPodyachev/molebot-public">GitHub</a>
              <a href="https://explorer.sepolia.mantle.xyz">Explorer</a>
              <a href="https://dorahacks.io">DoraHacks</a>
            </div>
            <p className="landing-footer__copy">© 2026 Molebot.Mantle</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
