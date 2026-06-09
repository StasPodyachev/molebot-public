'use client';

import { useState, useEffect, useCallback } from 'react';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface VaultBalanceResponse {
  ok: boolean;
  balance: string;
  balanceMnt: string;
  vaultAddress: string;
  cached: boolean;
}

interface VaultBalanceProps {
  tokenId: number;
  apiBase?: string;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function VaultBalance({ tokenId, apiBase }: VaultBalanceProps) {
  const API = apiBase || 'https://vps.molebot.org/api';

  const [balanceMnt, setBalanceMnt] = useState<string | null>(null);
  const [balanceWei, setBalanceWei] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(() => {
    setLoading(true);
    fetch(`${API}/vault/balance?tokenId=${tokenId}`)
      .then(r => r.json())
      .then((d: VaultBalanceResponse) => {
        if (d.ok) {
          setBalanceMnt(d.balanceMnt);
          setBalanceWei(d.balance);
          setError(null);
        }
      })
      .catch(() => setError('Сервис vault временно недоступен'))
      .finally(() => setLoading(false));
  }, [API, tokenId]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Refresh on focus / every 60s
  useEffect(() => {
    const onFocus = () => fetchBalance();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchBalance]);

  const hasBalance = balanceWei !== '0';

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">Vault баланс</p>
        <p className={`text-sm font-mono font-semibold ${
          loading ? 'text-gray-600 animate-pulse' :
          hasBalance ? 'text-mole-400' : 'text-gray-500'
        }`}>
          {loading ? '...' : `${balanceMnt ?? '0.0000'} MNT`}
        </p>
      </div>
      <button
        type="button"
        onClick={fetchBalance}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        title="Обновить баланс vault"
      >
        ↻
      </button>
      {error && (
        <span className="text-[10px] text-red-400">{error}</span>
      )}
    </div>
  );
}
