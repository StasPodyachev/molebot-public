/**
 * Адрес контракта MolebotNFT на Mantle Sepolia
 * Задеплоен: 2026-05-25
 * Версия: OZ-based (ERC721 + ERC721Enumerable + Ownable)
 */
export const NFT_CONTRACT_ADDRESS = '0xFA9071C5c87c5B940Bf83B030fE52f3500559aCb';

/** MINT_PRICE = 0.05 MNT */
export const MINT_PRICE_ETHER = '0.05';

/** CHAT_FEE = 0.001 MNT — плата за сообщение в чат */
export const CHAT_FEE_ETHER = '0.001';

/** Адрес Agent-контракта, получатель чат-платежей */
export const AGENT_ADDRESS = '0xFecb0b79583A337c8Bd1E390B81661329b78450e';

/** Адрес MoleVault (FE-34) — хранилище средств крота */
export const VAULT_ADDRESS = '0x252F0d506Da5131Bdc469796b273c724AB8Bc6F7';

/** Сколько сообщений в одной сессии (FE-24) */
export const SPEND_LIMIT = 10;

/** Пропустить MNT-перевод при VITE_CHAT_SKIP_PAYMENT=true (dev-режим) */
export const CHAT_SKIP_PAYMENT = import.meta.env.VITE_CHAT_SKIP_PAYMENT === 'true';
