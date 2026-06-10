'use client';

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import { VAULT_ADDRESS } from '@/lib/contract';

/* -------------------------------------------------------------------------- */
/* Vault deposit ABI (deposit only)                                            */
/* -------------------------------------------------------------------------- */

const vaultAbi = [
  'function deposit(uint256 tokenId) payable',
  'function getVaultBalance(uint256 tokenId, address token) view returns (uint256)',
];

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface DepositButtonProps {
  tokenId: number;
  onDeposited?: () => void;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function DepositButton({ tokenId, onDeposited }: DepositButtonProps) {
  const { wallets } = useWallets();
  const evmWallet = wallets.find(w =>
    typeof w.walletClientType === 'string' &&
    (w.walletClientType.includes('privy') || w.walletClientType.includes('embed'))
  ) ?? wallets[0];

  const [amount, setAmount] = useState('0.1');
  const [depositing, setDepositing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleDeposit = useCallback(async () => {
    if (!evmWallet) {
      setError('Wallet not found. Please connect your wallet via Privy.');
      return;
    }

    const valueWei = (() => {
      try { return ethers.parseEther(amount); }
      catch { return null; }
    })();
    if (!valueWei || valueWei <= 0n) {
      setError('Enter a valid MNT amount (e.g. 0.1)');
      return;
    }

    setDepositing(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = await evmWallet.getEthereumProvider();
      const ep = new ethers.BrowserProvider(provider);
      const signer = await ep.getSigner();

      const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);

      const tx = await vault.deposit(tokenId, { value: valueWei });
      setTxHash(tx.hash);

      await tx.wait();

      onDeposited?.();
      setShowForm(false);
    } catch (err) {
      console.error('[DepositButton] deposit error:', err);
      const msg = (err as any)?.reason
        ?? (err as any)?.shortMessage
        ?? (err as Error).message
        ?? 'Unknown error';
      setError(`Deposit error: ${msg}`);
    } finally {
      setDepositing(false);
    }
  }, [amount, tokenId, evmWallet, onDeposited]);

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => { setShowForm(true); setError(null); setTxHash(null); }}
        className="text-xs bg-mole-600 hover:bg-mole-500 text-white px-4 py-2 rounded-lg transition-all inline-flex items-center gap-1.5"
      >
        💰 Fund Vault
      </button>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300 font-medium">Fund Vault</span>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.1"
          disabled={depositing}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-mole-500 disabled:opacity-50"
        />
        <span className="text-xs text-gray-500">MNT</span>
      </div>

      <button
        type="button"
        onClick={handleDeposit}
        disabled={depositing || !amount}
        className="w-full text-xs bg-mole-600 hover:bg-mole-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-3 py-2 rounded-lg transition-all disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
      >
        {depositing ? (
          <>
            <span className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            Confirm in wallet...
          </>
        ) : (
          `Deposit ${amount || '0.00'} MNT`
        )}
      </button>

      {txHash && (
        <p className="text-xs text-green-400">
          ✅ Tx: <a
            href={`https://explorer.sepolia.mantle.xyz/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-green-300"
          >{txHash.slice(0, 12)}...</a>
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
