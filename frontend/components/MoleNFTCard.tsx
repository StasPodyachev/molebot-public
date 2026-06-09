'use client';

import { MOOD_EMOJI, MOOD_LABEL, type MoleNFTInfo } from '@/lib/mole-data';

interface MoleNFTCardProps {
  nft: MoleNFTInfo;
}

/**
 * MoleNFTCard — карточка NFT крота
 *
 * Показывает: ID, изображение (аватар), уровень, mood, PnL, tokenId
 * Тёмная тема, адаптивный дизайн.
 */
export default function MoleNFTCard({ nft }: MoleNFTCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 max-w-[500px]">
      {/* Avatar */}
      <div className="w-full aspect-square max-w-[500px] max-h-[500px] rounded-xl bg-gradient-to-br from-mole-800 via-gray-900 to-mole-900 flex items-center justify-center mb-4 relative overflow-hidden">
        <span className="text-8xl">{nft.isMythic ? '🌟' : '🦔'}</span>
        {nft.isMythic && (
          <span className="absolute top-2 right-2 text-xs bg-yellow-600/80 text-yellow-200 px-2 py-0.5 rounded-full">
            Mythic
          </span>
        )}
      </div>

      {/* Info */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Molebot #{nft.serialNumber}
          </h3>
          <p className="text-sm text-gray-400">{nft.levelName}</p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-2xl">{MOOD_EMOJI[nft.mood]}</span>
          <span className="text-gray-300">{MOOD_LABEL[nft.mood]}</span>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Уровень</span>
            <span className="text-gray-200">Lvl {nft.levelIndex}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">PnL</span>
            <span className={nft.cumulativePnl >= 0 ? 'text-mole-400' : 'text-red-400'}>
              {nft.cumulativePnl >= 0 ? '+' : ''}{nft.cumulativePnl} USDC
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">TokenId</span>
            <span className="text-gray-400 font-mono text-xs">#{nft.tokenId}</span>
          </div>
        </div>

        {nft.hasRevealed && (
          <a
            href={`https://ipfs.io/ipfs/${nft.tokenURI.replace('ipfs://', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-gray-600 hover:text-gray-400 truncate"
          >
            IPFS metadata
          </a>
        )}
      </div>
    </div>
  );
}
