import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantleSepoliaTestnet } from 'viem/chains';
import { readFileSync } from 'fs';
const keyPath = 'scripts/testnet-key.hex';
const rawKey = readFileSync(keyPath, 'utf-8').trim();
const k = rawKey.startsWith('0x') ? rawKey.slice(2) : rawKey;
const account = privateKeyToAccount('0x' + k);
const bin = readFileSync('/tmp/solc_build/WrappedMNT.bin', 'utf-8').trim();
const publicClient = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: mantleSepoliaTestnet, transport: http() });
async function main() {
  const bal = await publicClient.getBalance({ address: account.address });
  console.log('Balance:', formatEther(bal), 'MNT');
  const txHash = await walletClient.sendTransaction({ data: '0x' + bin, gas: 2000000n });
  console.log('Deploy tx:', txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('Status:', receipt.status);
  console.log('Contract:', receipt.contractAddress);
  console.log('Gas used:', receipt.gasUsed?.toString());
}
main().catch(console.error);
