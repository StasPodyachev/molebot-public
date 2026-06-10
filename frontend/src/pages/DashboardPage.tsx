import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useParams } from 'react-router-dom';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useT } from '../i18n';
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
 * DashboardPage — main dashboard page.
 * Route: /dashboard/:tokenId
 *
 * Layout (≥900px):
 *   LEFT: NFT Card | StrategyPanel | TradePanel | StatsPanel
 *   RIGHT: UserBalance | VaultBalance | DepositButton | MoleMintButton | Chat toggle
 *
 * Layout (<900px): single column, sidebar first
 */
export default function DashboardPage() {
  const { t } = useT();
  const { tokenId: routeTokenId } = useParams<{ tokenId: string }>();
  const { logout } = usePrivy();
  const { wallets } = useWallets();
  const evmWallet = wallets.find((w) => w.walletClientType === 'privy');
  const userAddress = (evmWallet?.address?.toLowerCase()) as `0x${string}` | undefined;

  const {
    nft,
    loading: nftLoading,
    error: nftError,
    hasMinted,
    refresh,
  } = useMoleNFT(userAddress ?? null, Number(routeTokenId ?? 0) || null);

  const { mint, minting, mintError } = useMintNFT();
  const [mintTx, setMintTx] = useState<string | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const ensureCorrectChain = useCallback(
    async (): Promise<ethers.BrowserProvider | null> => {
      if (!evmWallet) {
        setChainError(t('wallet.notFound'));
        return null;
      }
      try {
        const p = await evmWallet.getEthereumProvider();
        const ep = new ethers.BrowserProvider(p);
        const n = await ep.getNetwork();
        if (Number(n.chainId) !== MANTLE_CHAIN_ID) {
          try {
            await p.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x138B' }],
            });
          } catch {
            setChainError(t('wallet.switchNetwork'));
            return null;
          }
        }
        return ep;
      } catch {
        setChainError(t('wallet.checkFailed'));
        return null;
      }
    },
    [evmWallet],
  );

  const handleMint = useCallback(async () => {
    setChainError(null);
    setMintTx(null);
    const provider = await ensureCorrectChain();
    if (!provider) return;
    try {
      const receipt = await mint(provider);
      const hash =
        receipt?.hash ?? (receipt as any)?.transactionHash ?? null;
      if (hash) setMintTx(hash);
      await refresh();
    } catch {
      /* mintError lives inside the hook */
    }
  }, [ensureCorrectChain, mint, refresh]);

  return (
    <div className="dashboard-page">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="landing-header">
        <div className="landing-header__inner">
          <div
            className="landing-header__brand"
            onClick={() => (window.location.href = '/')}
            style={{ cursor: 'pointer' }}
          >
            <MolebotLogo size={28} /> molebot
          </div>
          <nav className="landing-header__nav">
            <span className="text-xs text-gray-500">
              Token #{routeTokenId ?? '—'}
            </span>
            <button className="btn btn-primary" onClick={() => logout()}>
              {t('nav.logout')}
            </button>
          </nav>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────── */}
      <main className="dashboard-main">
        <div className="dashboard-inner">
          {/* Breadcrumb */}
          <p className="dashboard-breadcrumb">{t('dashboard.title')}</p>

          {/* Loading */}
          {nftLoading && (
            <div className="dashboard-loading">
              <p>{t('dashboard.loading')}</p>
            </div>
          )}

          {/* ── Has NFT ─────────────────────────────────────────── */}
          {!nftLoading && hasMinted && nft ? (
            <>
              {/* Two-column grid */}
              <div className="dashboard-grid">
                {/* LEFT: NFT card + trading panels */}
                <div className="dashboard-left">
                  <MoleNFTCard nft={nft} />
                  <StrategyPanel
                    tokenId={nft.tokenId}
                    apiBase={import.meta.env.VITE_API_BASE_URL}
                  />
                  <TradePanel
                    tokenId={nft.tokenId}
                    apiBase={import.meta.env.VITE_API_BASE_URL}
                  />
                  <StatsPanel
                    tokenId={nft.tokenId}
                    apiBase={import.meta.env.VITE_API_BASE_URL}
                  />
                </div>

                {/* RIGHT: wallet info + actions */}
                <div className="dashboard-sidebar">
                  {userAddress && (
                    <UserBalance address={userAddress} />
                  )}

                  {/* Vault balance + deposit */}
                  {nft && (
                    <div className="space-y-2">
                      <VaultBalance
                        tokenId={nft.tokenId}
                        apiBase={import.meta.env.VITE_API_BASE_URL}
                      />
                      <DepositButton
                        tokenId={nft.tokenId}
                        onDeposited={() => {
                          window.dispatchEvent(new Event('vault-deposit'));
                        }}
                      />
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
                    className="btn btn-ghost w-full"
                    onClick={() => setShowChat(!showChat)}
                  >
                    {showChat ? t('chat.hide') : t('chat.show')}
                  </button>
                </div>
              </div>

              {/* Chat panel — full width, collapsible */}
              {showChat && nft && (
                <div className="dashboard-chat">
                  <ChatPanel
                    tokenId={nft.tokenId}
                    apiBase={import.meta.env.VITE_API_BASE_URL}
                  />
                </div>
              )}
            </>
          ) : (
            /* ── No NFT ─────────────────────────────────────────── */
            !nftLoading && (
              <div className="dashboard-empty">
                <p className="text-text-muted mb-6">{t('dashboard.noMole')}</p>
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

          {/* NFT error */}
          {nftError && (
            <p className="text-error text-sm mt-4 text-center">{nftError}</p>
          )}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="section-container">
          <div className="landing-footer__inner">
            <div className="landing-footer__brand">
              <MolebotLogo size={20} /> molebot
            </div>
            <div className="landing-footer__links">
              <a href="https://github.com/StasPodyachev/molebot-public">
                GitHub
              </a>
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
