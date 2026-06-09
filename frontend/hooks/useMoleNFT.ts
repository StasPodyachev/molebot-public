'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { MOLEBOT_NFT_ABI } from '@/lib/abi';
import { NFT_CONTRACT_ADDRESS, MINT_PRICE_ETHER } from '@/lib/contract';
import { MANTLE_RPC_URLS } from '@/lib/mantle-chain';
import { parseMoleData, type MoleNFTInfo, type MoleDataRaw } from '@/lib/mole-data';

/** Хук для чтения данных MolebotNFT с on-chain контракта */
export function useMoleNFT(address: string | null, tokenId?: number | null) {
  // ВАЖНО: хуки вызываются безусловно (Rules of Hooks). Логика «нет кошелька — нет NFT»
  // обрабатывается внутри refresh() и useEffect ниже, а не ранним return.
  const [nft, setNft] = useState<MoleNFTInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMinted, setHasMinted] = useState(false);

  const refresh = useCallback(async (forceTokenId?: number | null) => {
    const effectiveTokenId = forceTokenId ?? tokenId;
    if (!address && !effectiveTokenId) {
      setNft(null);
      setHasMinted(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Адрес ещё не загружен (Privy не инициализирован) — выходим
    if (!address) {
      setNft(null);
      setHasMinted(false);
      setLoading(false);
      return;
    }

    try {
      // JsonRpcProvider со статической сетью (без автоматического детекта chainId).
      // dRPC иногда отвечает с chainId=1 (mainnet) — это ломает FallbackProvider.
      const provider = new ethers.JsonRpcProvider(
        MANTLE_RPC_URLS[0],
        { chainId: 5003, name: 'mantle-sepolia' }
      );
      const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, MOLEBOT_NFT_ABI, provider);

      // Проверяем minted или balanceOf
      const balance = await contract.balanceOf(address);

      if (effectiveTokenId) {
        // Читаем конкретный tokenId из маршрута
        setHasMinted(true);
        const tokenIdBI = BigInt(effectiveTokenId);
        const [rawData, revealed, uri] = await Promise.all([
          contract.getMoleData(tokenIdBI).catch(() => null),
          contract.revealed().catch(() => false),
          contract.tokenURI(tokenIdBI).catch(() => ''),
        ]);
        const parsed = parseMoleData(effectiveTokenId, rawData, revealed, uri);
        setNft(parsed);
        return;
      }

      if (balance === 0n) {
        setNft(null);
        setHasMinted(false);
        return;
      }

      // Получаем tokenId (max 1 per wallet)
      let tokenIdNum: number | null = null;
      const MAX_SUPPLY = 100;
      const scanPromises = Array.from({ length: MAX_SUPPLY }, (_, i) =>
        contract.ownerOf(i + 1).catch(() => null)
      );
      const owners = await Promise.all(scanPromises);
      const idx = owners.findIndex(o => o?.toLowerCase() === address.toLowerCase());
      if (idx >= 0) {
        tokenIdNum = idx + 1;
      } else {
        setNft(null);
        setHasMinted(false);
        return;
      }

      setHasMinted(true);

      // Получаем данные NFT
      const tokenIdBI = BigInt(tokenIdNum);
      const [rawData, revealed, uri] = await Promise.all([
        contract.getMoleData(tokenIdBI).catch(() => null) as Promise<MoleDataRaw | null>,
        contract.revealed() as Promise<boolean>,
        contract.tokenURI(tokenIdBI) as Promise<string>,
      ]);

      const parsed = parseMoleData(tokenIdNum, rawData, revealed, uri);
      setNft(parsed);
    } catch (err) {
      console.error('[useMoleNFT] Error:', err);
      setError((err as Error).message);
      setNft(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Автообновление при смене адреса или tokenId
  useEffect(() => {
    if (tokenId) { refresh(tokenId); }
    else { refresh(); }
  }, [refresh, address, tokenId]);

  return { nft, loading, error, hasMinted, refresh };
}

/** Хук для минта NFT */
export function useMintNFT() {
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const mint = useCallback(async (provider: ethers.BrowserProvider) => {
    setMinting(true);
    setMintError(null);

    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, MOLEBOT_NFT_ABI, signer);

      const price = ethers.parseEther(MINT_PRICE_ETHER);
      const tx = await contract.mint({ value: price });
      const receipt = await tx.wait();

      return receipt;
    } catch (err: any) {
      const msg = err?.reason ?? err?.message ?? 'Mint failed';
      setMintError(msg);
      throw err;
    } finally {
      setMinting(false);
    }
  }, []);

  return { mint, minting, mintError };
}
