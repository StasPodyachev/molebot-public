import { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LangProvider } from './i18n';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useMoleNFT } from '@/hooks/useMoleNFT';
import LandingPage from './LandingPage';
import DashboardPage from './pages/DashboardPage';
import RequireAuth from './pages/RequireAuth';

/**
 * App — корень SPA Molebot.Mantle.
 *
 * Маршруты:
 *   /                     →  лендинг (LandingPage)
 *   /dashboard/:tokenId   →  дашборд (RequireAuth + DashboardPage)
 *   *                     →  редирект на /
 */
export default function App() {
  const { login, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const evmWallet = wallets.find((w) => w.walletClientType === 'privy');
  const userAddress = (evmWallet?.address?.toLowerCase() ?? user?.wallet?.address?.toLowerCase()) as
    | `0x${string}`
    | undefined;

  const { nft, loading: nftLoading, hasMinted } = useMoleNFT(userAddress ?? null);
  const navigate = useNavigate();

  /* CTA с лендинга: логин или минт */
  const handleActivate = useCallback(() => {
    if (!authenticated) {
      login();
      return;
    }
    if (!hasMinted) {
      navigate('/dashboard');
    }
  }, [authenticated, hasMinted, login]);

  /* После минта — редирект на дашборд */
  useEffect(() => {
    if (authenticated && hasMinted && nft && !nftLoading) {
      navigate(`/dashboard/${nft.tokenId}`, { replace: true });
    }
  }, [authenticated, hasMinted, nft, nftLoading, navigate]);

  const location = useLocation();
  // Extract lang prefix from path for the LangProvider to detect
  const langFromPath = location.pathname.match(/^\/(ru|en)/)?.[1];

  return (
    <LangProvider>
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage
            onActivate={handleActivate}
            onGift={handleActivate}
            authenticated={authenticated}
            ready={ready}
          />
        }
      />
      <Route
        path="/dashboard/:tokenId"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route path="/ru" element={<Navigate to="/" replace />} />
      <Route path="/en" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </LangProvider>
  );
}
