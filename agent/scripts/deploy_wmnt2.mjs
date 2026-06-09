import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantleSepoliaTestnet } from 'viem/chains';
import { readFileSync } from 'fs';

const keyPath = 'scripts/testnet-key.hex';
const rawKey = readFileSync(keyPath, 'utf-8').trim();
const key = rawKey.startsWith('0x') ? rawKey.slice(2) : rawKey;
const account = privateKeyToAccount('0x' + key);

const bin = readFileSync('/tmp/solc_build/WrappedMNT.bin', 'utf-8').trim();
const publicClient = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: mantleSepoliaTestnet, transport: http() });
const ADDR = account.address;

async function main() {
  console.log('Deploying from:', ADDR);
  const bal = await publicClient.getBalance({ address: ADDR });
  console.log('Balance:', formatEther(bal), 'MNT');

  const txHash = await walletClient.sendTransaction({
    data: '0x' + bin,
    gas: 500000n,
  });
  console.log('Deploy tx:', txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('Deployed at:', receipt.contractAddress);
  console.log('Gas used:', receipt.gasUsed ? receipt.gasUsed.toString() : 'unknown');
}
main().catch(console.error);
