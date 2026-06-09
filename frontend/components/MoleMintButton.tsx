'use client';

import { type ReactNode } from 'react';

interface MoleMintButtonProps {
  minting: boolean;
  error: string | null;
  txHash: string | null;
  onMint: () => void;
  /** URL на explorer для txHash */
  explorerTx?: (hash: string) => string;
}

/**
 * MoleMintButton — кнопка минта NFT с отображением статуса
 *
 * Состояния:
 * - minting=false → кнопка "Mint Molebot (0.05 MNT)"
 * - minting=true → спиннер + "Minting..."
 * - error → красное сообщение об ошибке
 * - txHash → ссылка на explorer
 */
export default function MoleMintButton({
  minting,
  error,
  txHash,
  onMint,
  explorerTx,
}: MoleMintButtonProps) {
  const defaultExplorerTx = (hash: string) =>
    `https://explorer.sepolia.mantle.xyz/tx/${hash}`;
  const explorer = explorerTx ?? defaultExplorerTx;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={onMint}
        disabled={minting}
        className="bg-gradient-to-r from-mole-600 to-mole-500 hover:from-mole-500 hover:to-mole-400 disabled:from-gray-700 disabled:to-gray-700 text-white px-10 py-4 rounded-2xl text-lg font-semibold transition-all disabled:cursor-not-allowed shadow-xl shadow-mole-500/20 disabled:shadow-none"
      >
        {minting ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Minting...
          </span>
        ) : (
          <>Mint Molebot (0.05 MNT)</>
        )}
      </button>

      {error && (
        <p className="text-red-400 text-sm max-w-md text-center">
          ❌ {error}
        </p>
      )}

      {txHash && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm w-full max-w-md">
          <p className="text-mole-400 mb-1">✅ Транзакция отправлена!</p>
          <a
            href={explorer(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-mole-300 underline break-all font-mono text-xs"
          >
            {explorer(txHash)}
          </a>
        </div>
      )}
    </div>
  );
}
