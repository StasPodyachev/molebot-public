/**
 * EVM ECDSA подпись сообщения через ethers
 */

import { Wallet, verifyMessage } from 'ethers';

/**
 * Подписать сообщение EVM-ключом (EIP-191)
 * Wallet.signMessageSync — синхронная EIP-191 подпись
 * @returns hex signature (65 bytes, r s v concatenated)
 */
export function signMessage(wallet: Wallet, message: string): string {
  return wallet.signMessageSync(message);
}

/**
 * Восстановить адрес отправителя из EIP-191 подписи
 * @returns EVM адрес (0x...)
 */
export function recoverAddress(message: string, signature: string): string {
  return verifyMessage(message, signature);
}
