'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { MANTLE_RPC_URL } from '@/lib/mantle-chain';

interface UserBalanceProps {
  address: `0x${string}`;
  onBalanceChange?: (balance: bigint) => void;
}

/**
 * Component: full address + MNT balance + Faucet buttons when balance is 0
 *
 * - Shows full address (click to copy)
 * - MNT balance from Mantle Sepolia (polling every 30s)
 * - If balance = 0 — shows faucet links
 * - If balance ≥ 0.05 MNT — faucet block is hidden
 */
export default function UserBalance({ address, onBalanceChange }: UserBalanceProps) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [copied, setCopied] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  /** Fetch balance from RPC */
  const fetchBalance = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(MANTLE_RPC_URL);
      const bal = await provider.getBalance(address);
      setBalance(bal);
      setBalanceError(null);
      onBalanceChange?.(bal);
    } catch (err) {
      console.error('[UserBalance] fetch error:', err);
      setBalanceError('Failed to fetch balance');
    } finally {
      setBalanceLoading(false);
    }
  }, [address, onBalanceChange]);

  /** Copy address to clipboard */
  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for iOS Safari
      const textarea = document.createElement('textarea');
      textarea.value = address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  /** Poll every 30 seconds */
  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const mintCost = ethers.parseEther('0.05');
  const formattedBalance = ethers.formatEther(balance);
  const hasEnoughForMint = balance >= mintCost;
  const showFaucet = balance === 0n;

  return (
    <div className="flex flex-col gap-2 bg-gray-900 border border-gray-800 rounded-2xl p-4">
      {/* Row: network | balance */}
      <div className="flex items-center justify-between">
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
          Mantle Sepolia
        </span>
        <span className={`text-sm font-mono font-semibold ${
          balanceLoading ? 'text-gray-600 animate-pulse' :
          hasEnoughForMint ? 'text-mole-400' :
          'text-red-400'
        }`}>
          {balanceLoading ? '...' : `${parseFloat(formattedBalance).toFixed(4)} MNT`}
        </span>
      </div>

      {/* Row: full address + copy button */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={copyAddress}
          className="group flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          title="Click to copy address"
        >
          <span className="font-mono text-[10px]">
            {address.slice(0, 10)}...{address.slice(-6)}
          </span>
          {copied ? (
            <span className="text-mole-400 text-[10px]">Copied!</span>
          ) : (
            <svg className="w-3 h-3 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Faucet block (if balance = 0) */}
      {showFaucet && (
        <div className="mt-3 bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-xs w-full max-w-xs">
          <p className="text-red-400 mb-2">
            ⚠️ Your wallet has 0 MNT. You need testnet tokens to mint and trade.
          </p>
          <div className="space-y-1.5">
            <a
              href="https://faucet.mantle.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-mole-700 hover:bg-mole-600 text-white py-2 rounded-lg transition-colors"
            >
              Faucet 1: faucet.mantle.xyz
            </a>
            <a
              href="https://www.hackquest.io/faucets/5003"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded-lg transition-colors"
            >
              Faucet 2: hackquest.io/5003
            </a>
          </div>
          <p className="text-gray-500 mt-2">
            After receiving MNT, refresh the page.
          </p>
        </div>
      )}

      {/* Balance error */}
      {balanceError && (
        <p className="text-red-500 text-xs mt-1">{balanceError}</p>
      )}
    </div>
  );
}
